// Text out of a PDF, page by page, without a PDF library: enough for the
// selectable text real tools write (Word, browsers' "Save as PDF", LaTeX,
// reports). No OCR: a scanned page has no text to extract, and the
// extractor says so instead of guessing.
//
//   objects (also inside object streams) → page tree (inherited resources)
//   → content streams (FlateDecode / ASCIIHex / ASCII85) → text operators
//   → bytes → Unicode through each font's ToUnicode CMap or its encoding
//
// Bounded: object count, stream sizes and recursion are capped; anything it
// cannot read becomes a warning, never a crash. Encrypted PDFs are refused.
// Hostile files too: inflate stops at its cap while streaming, every object is
// parsed only up to the next one, fonts and forms are cached by object, and one
// work budget per document yields to the UI, honours the AbortSignal and the
// deadline, and stops runaway fan-out.

import { ExtractStop, InflateLimit, inflateCapped, WorkBudget, type ExtractOptions } from './budget';

const MAX_OBJECTS = 50_000;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MAX_PAGES = 2_000;
/** page-tree nodes visited */
const MAX_TREE_NODES = 20_000;
const MAX_TEXT_CHARS = 4 * 1024 * 1024;
/** decoded stream bytes per document (every stream together, cached ones included) */
const MAX_DECODED_BYTES = 192 * 1024 * 1024;
/** content-stream operators (and objects) per document: hostile fan-out stops here */
const MAX_OPS = 20_000_000;
/** Form XObjects run per document (a form drawn many times is run many times) */
const MAX_FORM_RUNS = 5_000;
/** entries one font's ToUnicode CMap or width table may produce */
const MAX_FONT_ENTRIES = 200_000;
/** tokens read from one CMap */
const MAX_CMAP_TOKENS = 400_000;

export interface PdfPageText {
  number: number;
  text: string;
}

export interface PdfText {
  pages: PdfPageText[];
  warnings: string[];
  encrypted: boolean;
}

// ── values ──────────────────────────────────────────────────

type PdfValue = number | boolean | null | PdfName | PdfString | PdfRef | PdfValue[] | PdfDict;
interface PdfName {
  n: string;
}
interface PdfString {
  s: Uint8Array;
}
interface PdfRef {
  r: number;
}
interface PdfDict {
  d: Record<string, PdfValue>;
}

const isName = (v: unknown): v is PdfName => !!v && typeof v === 'object' && 'n' in (v as object);
const isStr = (v: unknown): v is PdfString => !!v && typeof v === 'object' && 's' in (v as object);
const isRef = (v: unknown): v is PdfRef => !!v && typeof v === 'object' && 'r' in (v as object);
const isDict = (v: unknown): v is PdfDict => !!v && typeof v === 'object' && 'd' in (v as object);

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/** arrays and dictionaries nested deeper than this are read flat (no unbounded recursion) */
const MAX_NESTING = 64;
/** bytes kept of one string (a longer one is cut; the lexer still skips all of it) */
const MAX_STRING = 1024 * 1024;
/** keywords that end an object: an unclosed array or dictionary stops there, never at EOF */
const ENDS = new Set(['obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer']);

/** a tokenizer + value parser over bytes (dictionaries, content streams, CMaps) */
class Lexer {
  pos = 0;
  private depth = 0;
  /** tokens read so far; past `maxTokens` the lexer reports the end */
  tokens = 0;
  constructor(
    readonly b: Uint8Array,
    start = 0,
    readonly end = b.length,
    readonly maxTokens = Infinity,
  ) {
    this.pos = start;
  }

  skipWs() {
    while (this.pos < this.end) {
      const c = this.b[this.pos];
      if (WS.has(c)) this.pos++;
      else if (c === 0x25) {
        while (this.pos < this.end && this.b[this.pos] !== 0x0a && this.b[this.pos] !== 0x0d) this.pos++;
      } else break;
    }
  }

  /** the next value, or an operator as {op} (content streams), or undefined at the end */
  next(): PdfValue | { op: string } | undefined {
    this.skipWs();
    if (this.pos >= this.end || ++this.tokens > this.maxTokens) return undefined;
    const c = this.b[this.pos];
    if (c === 0x2f) return this.name();
    if (c === 0x28) return this.literal();
    if (c === 0x3c) {
      if (this.b[this.pos + 1] === 0x3c) {
        this.pos += 2;
        if (this.depth >= MAX_NESTING) return { op: '<<' };
        this.depth++;
        try {
          return this.dict();
        } finally {
          this.depth--;
        }
      }
      return this.hex();
    }
    if (c === 0x5b) {
      this.pos++;
      if (this.depth >= MAX_NESTING) return { op: '[' };
      this.depth++;
      try {
        return this.array();
      } finally {
        this.depth--;
      }
    }
    if (c === 0x5d || c === 0x3e || c === 0x7d || c === 0x7b || c === 0x29) {
      this.pos++;
      return { op: String.fromCharCode(c) };
    }
    // a number or a keyword / operator
    const start = this.pos;
    while (this.pos < this.end && !WS.has(this.b[this.pos]) && !DELIM.has(this.b[this.pos])) this.pos++;
    if (this.pos === start) {
      this.pos++;
      return { op: String.fromCharCode(c) };
    }
    // a run of junk is a keyword, never a regex test over megabytes
    if (this.pos - start > 64) return { op: '?' };
    const word = latin1(this.b.subarray(start, this.pos));
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return Number(word);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return { op: word };
  }

  private array(): PdfValue[] {
    const arr: PdfValue[] = [];
    for (let guard = 0; guard < 1_000_000; guard++) {
      this.skipWs();
      if (this.pos >= this.end) break;
      if (this.b[this.pos] === 0x5d) {
        this.pos++;
        break;
      }
      const v = this.next();
      if (v === undefined) break;
      if (typeof v === 'object' && v !== null && 'op' in v) {
        // an unclosed array ends where the object does
        if (ENDS.has(v.op)) break;
        // R inside arrays: n g R
        if (v.op === 'R' && arr.length >= 2 && typeof arr[arr.length - 2] === 'number') {
          arr.length -= 1;
          arr[arr.length - 1] = { r: arr[arr.length - 1] as number };
        }
        continue;
      }
      arr.push(v);
    }
    return arr;
  }

  private name(): PdfName {
    this.pos++;
    const start = this.pos;
    while (this.pos < this.end && !WS.has(this.b[this.pos]) && !DELIM.has(this.b[this.pos])) this.pos++;
    return { n: latin1(this.b.subarray(start, this.pos)).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) };
  }

  private literal(): PdfString {
    this.pos++;
    const out: number[] = [];
    let depth = 1;
    while (this.pos < this.end) {
      const c = this.b[this.pos++];
      if (c === 0x5c) {
        const e = this.b[this.pos++];
        if (out.length >= MAX_STRING) continue;
        const map: Record<number, number> = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12, 0x28: 0x28, 0x29: 0x29, 0x5c: 0x5c };
        if (e in map) out.push(map[e]);
        else if (e >= 0x30 && e <= 0x37) {
          let oct = e - 0x30;
          for (let i = 0; i < 2 && this.b[this.pos] >= 0x30 && this.b[this.pos] <= 0x37; i++) oct = oct * 8 + (this.b[this.pos++] - 0x30);
          out.push(oct & 0xff);
        } else if (e === 0x0d) {
          if (this.b[this.pos] === 0x0a) this.pos++;
        } else if (e !== 0x0a) out.push(e);
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29 && --depth === 0) break;
      if (out.length < MAX_STRING) out.push(c);
    }
    return { s: Uint8Array.from(out) };
  }

  private hex(): PdfString {
    this.pos++;
    let digits = '';
    while (this.pos < this.end && this.b[this.pos] !== 0x3e) {
      const ch = String.fromCharCode(this.b[this.pos++]);
      if (digits.length < MAX_STRING * 2 && /[0-9a-fA-F]/.test(ch)) digits += ch;
    }
    this.pos++;
    if (digits.length % 2) digits += '0';
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return { s: out };
  }

  private dict(): PdfDict {
    // values in order, "n g R" collapsed into references, then paired as key / value
    const items: PdfValue[] = [];
    for (let guard = 0; guard < 1_000_000; guard++) {
      this.skipWs();
      if (this.pos >= this.end) break;
      if (this.b[this.pos] === 0x3e && this.b[this.pos + 1] === 0x3e) {
        this.pos += 2;
        break;
      }
      const v = this.next();
      if (v === undefined) break;
      if (typeof v === 'object' && v !== null && 'op' in v) {
        if (ENDS.has(v.op)) break;
        if (v.op === 'R' && items.length >= 2 && typeof items[items.length - 1] === 'number' && typeof items[items.length - 2] === 'number') {
          items.pop();
          items[items.length - 1] = { r: items[items.length - 1] as number };
        }
        continue;
      }
      items.push(v);
    }
    const d: Record<string, PdfValue> = {};
    for (let i = 0; i + 1 < items.length; ) {
      const k = items[i];
      if (isName(k)) {
        d[k.n] = items[i + 1];
        i += 2;
      } else i++;
    }
    return { d };
  }
}

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x4000) s += String.fromCharCode(...b.subarray(i, i + 0x4000));
  return s;
};

// ── decoding ────────────────────────────────────────────────

/** FlateDecode: zlib, else raw deflate; never more than `cap` bytes out */
async function inflate(data: Uint8Array, cap: number, signal?: AbortSignal): Promise<Uint8Array> {
  try {
    return await inflateCapped(data, 'deflate', cap, signal);
  } catch (err) {
    if (err instanceof InflateLimit || err instanceof ExtractStop) throw err;
    return inflateCapped(data, 'deflate-raw', cap, signal);
  }
}

function asciiHex(data: Uint8Array): Uint8Array {
  const s = latin1(data).replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(s.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function ascii85(data: Uint8Array, cap: number): Uint8Array {
  const s = latin1(data).replace(/\s/g, '').replace(/^<~/, '').replace(/~>[\s\S]*$/, '');
  const out: number[] = [];
  let group: number[] = [];
  for (const ch of s) {
    // "z" is four zero bytes: a run of them must not grow past the cap
    if (out.length > cap) throw new InflateLimit('an ASCII85 part is too large');
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) {
      let n = 0;
      for (const g of group) n = n * 85 + g;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      group = [];
    }
  }
  if (group.length) {
    const len = group.length;
    while (group.length < 5) group.push(84);
    let n = 0;
    for (const g of group) n = n * 85 + g;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, len - 1));
  }
  return Uint8Array.from(out);
}

// ── the document ────────────────────────────────────────────

interface PdfObject {
  value: PdfValue;
  stream?: Uint8Array;
}

class PdfFile {
  objects = new Map<number, PdfObject>();
  warnings: string[] = [];
  encrypted = false;
  /** decoded streams by object number (fonts, forms and page contents are shared) */
  private decoded = new Map<number, Promise<Uint8Array | undefined>>();
  private decodedBytes = 0;
  /** Form XObjects run so far */
  formRuns = 0;

  constructor(
    private b: Uint8Array,
    readonly budget: WorkBudget,
  ) {}

  async load() {
    const text = latin1(this.b);
    // (?<!\d): a long run of digits is tried once, not from every position inside it
    const re = /(?<!\d)(\d+)\s+(\d+)\s+obj\b/g;
    let m = re.exec(text);
    let count = 0;
    while (m) {
      if (++count > MAX_OBJECTS) {
        this.warnings.push('too many objects: the rest was not read');
        break;
      }
      if (this.budget.step()) await this.budget.pause();
      const num = Number(m[1]);
      const bodyStart = m.index + m[0].length;
      // an object is read only up to the next object header: an unclosed array or string
      // cannot make every object scan to the end of the file
      re.lastIndex = bodyStart;
      let next = re.exec(text);
      const lex = new Lexer(this.b, bodyStart, next ? next.index : this.b.length);
      const value = lex.next();
      if (value === undefined || (typeof value === 'object' && value !== null && 'op' in value)) {
        m = next;
        continue;
      }
      const obj: PdfObject = { value: value as PdfValue };
      // a stream follows its dictionary
      lex.skipWs();
      if (text.startsWith('stream', lex.pos) && isDict(value)) {
        let start = lex.pos + 6;
        if (this.b[start] === 0x0d) start++;
        if (this.b[start] === 0x0a) start++;
        const len = value.d.Length;
        let end = typeof len === 'number' && len >= 0 && start + len <= this.b.length && text.startsWith('endstream', skip(text, start + len)) ? start + len : -1;
        if (end < 0) {
          end = text.indexOf('endstream', start);
          if (end < 0) end = this.b.length;
          while (end > start && (this.b[end - 1] === 0x0a || this.b[end - 1] === 0x0d)) end--;
        }
        obj.stream = this.b.subarray(start, end);
        // binary stream data may look like an object header: look again after the stream
        if (next && next.index < end) {
          re.lastIndex = end;
          next = re.exec(text);
        }
      }
      this.objects.set(num, obj);
      m = next;
    }
    if (/\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(text)) this.encrypted = true;
    // objects packed in object streams (PDF 1.5+)
    for (const [, obj] of [...this.objects]) {
      if (!isDict(obj.value) || !isName(obj.value.d.Type) || obj.value.d.Type.n !== 'ObjStm' || !obj.stream) continue;
      const data = await this.decode(obj).catch((e) => {
        if (e instanceof ExtractStop) throw e;
        return undefined;
      });
      if (!data) continue;
      const n = Number(obj.value.d.N) || 0;
      const first = Number(obj.value.d.First) || 0;
      const head = new Lexer(data, 0, Math.min(first, data.length));
      const pairs: [number, number][] = [];
      for (let i = 0; i < n && this.objects.size + pairs.length < MAX_OBJECTS; i++) {
        const num = head.next();
        const off = head.next();
        if (typeof num !== 'number' || typeof off !== 'number') break;
        pairs.push([num, off]);
      }
      // each packed object ends where the next one starts
      const starts = pairs.map(([, off]) => first + off).sort((x, y) => x - y);
      const endOf = (at: number) => {
        let lo = 0;
        let hi = starts.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (starts[mid] <= at) lo = mid + 1;
          else hi = mid;
        }
        return lo < starts.length ? starts[lo] : data.length;
      };
      for (const [num, off] of pairs) {
        if (this.budget.step()) await this.budget.pause();
        if (this.objects.has(num)) continue; // a direct object (later update) wins
        const at = first + off;
        const v = new Lexer(data, at, Math.min(endOf(at), data.length)).next();
        if (v !== undefined && !(typeof v === 'object' && v !== null && 'op' in v)) this.objects.set(num, { value: v as PdfValue });
      }
    }
  }

  get(v: PdfValue | undefined, depth = 0): PdfValue | undefined {
    if (isRef(v) && depth < 20) return this.get(this.objects.get(v.r)?.value, depth + 1);
    return v;
  }
  dict(v: PdfValue | undefined): Record<string, PdfValue> | undefined {
    const x = this.get(v);
    return isDict(x) ? x.d : undefined;
  }
  objectOf(v: PdfValue | undefined): PdfObject | undefined {
    return isRef(v) ? this.objects.get(v.r) : undefined;
  }

  /** a stream's bytes with its filters applied (undefined when a filter is not supported) */
  async decode(obj: PdfObject): Promise<Uint8Array | undefined> {
    if (!obj.stream) return undefined;
    this.budget.check();
    let data: Uint8Array = obj.stream;
    const d = isDict(obj.value) ? obj.value.d : {};
    const f = this.get(d.Filter);
    const filters = (Array.isArray(f) ? f : f ? [f] : []).map((x) => (isName(x) ? x.n : ''));
    if (filters.length > 4) {
      this.warnings.push('a stream with too many filters was skipped');
      return undefined;
    }
    const left = MAX_DECODED_BYTES - this.decodedBytes;
    if (left <= 0) {
      this.warnings.push('the PDF expands to too much data: parts of it were not read');
      return undefined;
    }
    const cap = Math.min(MAX_STREAM_BYTES, left);
    for (const filter of filters) {
      if (filter === 'FlateDecode' || filter === 'Fl') data = await inflate(data, cap, this.budget.o.signal);
      else if (filter === 'ASCIIHexDecode' || filter === 'AHx') data = asciiHex(data);
      else if (filter === 'ASCII85Decode' || filter === 'A85') data = ascii85(data, cap);
      else {
        this.warnings.push(`a ${filter} stream was skipped (not supported)`);
        return undefined;
      }
    }
    this.decodedBytes += data.length;
    return data;
  }

  async decodeRef(v: PdfValue | undefined): Promise<Uint8Array | undefined> {
    const obj = this.objectOf(v);
    if (!obj) return undefined;
    const key = (v as PdfRef).r;
    if (!this.decoded.has(key))
      this.decoded.set(
        key,
        this.decode(obj).catch((e) => {
          // cancelled / out of time: the whole extraction stops; anything else skips this stream
          if (e instanceof ExtractStop) throw e;
          if (e instanceof InflateLimit) this.warnings.push(`${e.message}: it was skipped`);
          return undefined;
        }),
      );
    return this.decoded.get(key);
  }
}

const skip = (text: string, i: number) => {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
};

// ── fonts ───────────────────────────────────────────────────

/** byte codes → Unicode for one font */
interface FontMap {
  /** bytes per code (2 for Identity-H / most CID fonts) */
  width: 1 | 2;
  map: Map<number, string>;
  fallback: (code: number) => string;
  /** a glyph's advance, in 1/1000 of the font size */
  advance: (code: number) => number;
}

const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
const winAnsi = (c: number) => WIN_ANSI_HIGH[c] ?? String.fromCharCode(c);

/** the Adobe glyph names fonts use in /Differences (the common subset) */
const GLYPHS: Record<string, string> = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&', quotesingle: "'", quoteright: '’', quoteleft: '‘',
  parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',', hyphen: '-', minus: '−', period: '.', slash: '/', colon: ':', semicolon: ';',
  less: '<', equal: '=', greater: '>', question: '?', at: '@', bracketleft: '[', backslash: '\\', bracketright: ']', underscore: '_', braceleft: '{',
  bar: '|', braceright: '}', asciitilde: '~', endash: '–', emdash: '—', bullet: '•', ellipsis: '…', quotedblleft: '“', quotedblright: '”',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', agrave: 'à', aacute: 'á', egrave: 'è', eacute: 'é', igrave: 'ì', iacute: 'í', ograve: 'ò',
  oacute: 'ó', ugrave: 'ù', uacute: 'ú', ccedilla: 'ç', ntilde: 'ñ', udieresis: 'ü', odieresis: 'ö', adieresis: 'ä', germandbls: 'ß', Euro: '€', degree: '°',
};
const glyphChar = (name: string) => GLYPHS[name] ?? (/^[A-Za-z]$/.test(name) ? name : /^uni([0-9A-F]{4})$/.test(name) ? String.fromCharCode(parseInt(name.slice(3), 16)) : '');

function utf16be(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
  return s;
}

const codeOf = (b: Uint8Array) => b.reduce((n, x) => n * 256 + x, 0);

/** bfchar / bfrange entries of a ToUnicode CMap */
function parseToUnicode(data: Uint8Array): { map: Map<number, string>; width: 1 | 2 } {
  const map = new Map<number, string>();
  const lex = new Lexer(data, 0, data.length, MAX_CMAP_TOKENS);
  let width: 1 | 2 = 1;
  const tokens: (PdfValue | { op: string })[] = [];
  for (let t = lex.next(); t !== undefined; t = lex.next()) tokens.push(t);
  // work, not just size: many ranges over the same codes must stop too
  let entries = 0;
  const code = (x: PdfString) => (x.s.length >= 1 && x.s.length <= 4 ? codeOf(x.s) : undefined);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!(typeof t === 'object' && t !== null && 'op' in t)) continue;
    if (t.op === 'begincodespacerange') {
      const lo = tokens[i + 1];
      if (isStr(lo) && lo.s.length === 2) width = 2;
    }
    if (t.op === 'beginbfchar') {
      for (let j = i + 1; j + 1 < tokens.length; j += 2) {
        const a = tokens[j];
        const b = tokens[j + 1];
        if (!isStr(a) || !isStr(b) || ++entries > MAX_FONT_ENTRIES) break;
        if (a.s.length === 2) width = 2;
        const c = code(a);
        if (c !== undefined) map.set(c, utf16be(b.s.subarray(0, 64)));
      }
    }
    if (t.op === 'beginbfrange') {
      for (let j = i + 1; j + 2 < tokens.length; j += 3) {
        const lo = tokens[j];
        const hi = tokens[j + 1];
        const dst = tokens[j + 2];
        if (!isStr(lo) || !isStr(hi) || entries > MAX_FONT_ENTRIES) break;
        if (lo.s.length === 2) width = 2;
        const a = code(lo);
        const h = code(hi);
        if (a === undefined || h === undefined) continue;
        const z = Math.min(h, a + 65_535, a + (MAX_FONT_ENTRIES - entries));
        if (Array.isArray(dst))
          for (let k = 0; k < dst.length && k <= z - a; k++) {
            const d = dst[k];
            entries++;
            if (isStr(d)) map.set(a + k, utf16be(d.s.subarray(0, 64)));
          }
        else if (isStr(dst)) {
          const base = utf16be(dst.s.subarray(0, 64));
          entries += Math.max(0, z - a + 1);
          for (let c = a; c <= z; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + (c - a)));
        }
      }
    }
  }
  return { map, width };
}

async function fontMap(pdf: PdfFile, fontRef: PdfValue | undefined): Promise<FontMap> {
  const font = pdf.dict(fontRef) ?? {};
  const subtype = isName(font.Subtype) ? font.Subtype.n : '';
  const map = new Map<number, string>();
  let width: 1 | 2 = subtype === 'Type0' ? 2 : 1;
  const tu = await pdf.decodeRef(font.ToUnicode);
  if (tu) {
    const cm = parseToUnicode(tu);
    cm.map.forEach((v, k) => map.set(k, v));
    if (subtype === 'Type0') width = 2;
    else width = cm.width === 2 && subtype !== 'Type1' && subtype !== 'TrueType' ? 2 : 1;
  }
  // simple fonts: the encoding and its /Differences
  const enc = pdf.get(font.Encoding);
  const encDict = isDict(enc) ? enc.d : undefined;
  const base = isName(enc) ? enc.n : isName(encDict?.BaseEncoding) ? encDict!.BaseEncoding.n : 'StandardEncoding';
  const diffs = pdf.get(encDict?.Differences);
  if (Array.isArray(diffs)) {
    let code = 0;
    for (const d of diffs) {
      if (typeof d === 'number') code = d;
      else if (isName(d)) {
        const ch = glyphChar(d.n);
        if (ch && !map.has(code)) map.set(code, ch);
        code++;
      }
    }
  }
  const fallback = width === 2 ? () => '' : base === 'MacRomanEncoding' ? (c: number) => String.fromCharCode(c) : winAnsi;
  return { width, map, fallback, advance: widthsOf(pdf, font, subtype) };
}

/** glyph advances: /Widths (simple fonts) or the descendant's /W and /DW (CID fonts) */
function widthsOf(pdf: PdfFile, font: Record<string, PdfValue>, subtype: string): (code: number) => number {
  if (subtype === 'Type0') {
    const kids = pdf.get(font.DescendantFonts);
    const cid = pdf.dict(Array.isArray(kids) ? kids[0] : undefined) ?? {};
    const dw = typeof pdf.get(cid.DW) === 'number' ? (pdf.get(cid.DW) as number) : 1000;
    const table = new Map<number, number>();
    const w = pdf.get(cid.W);
    let entries = 0;
    if (Array.isArray(w))
      for (let i = 0; i < w.length && entries < MAX_FONT_ENTRIES; ) {
        const first = pdf.get(w[i]);
        const next = pdf.get(w[i + 1]);
        if (typeof first !== 'number') break;
        if (Array.isArray(next)) {
          next.slice(0, MAX_FONT_ENTRIES - entries).forEach((x, k) => typeof pdf.get(x) === 'number' && table.set(first + k, pdf.get(x) as number));
          entries += next.length;
          i += 2;
        } else {
          const last = next as number;
          const width = pdf.get(w[i + 2]);
          if (typeof last === 'number' && typeof width === 'number' && Number.isFinite(first) && Number.isFinite(last)) {
            const z = Math.min(last, first + 65_535, first + (MAX_FONT_ENTRIES - entries));
            entries += Math.max(0, z - first + 1);
            for (let c = first; c <= z; c++) table.set(c, width);
          }
          entries++;
          i += 3;
        }
      }
    return (code) => table.get(code) ?? dw;
  }
  const first = typeof pdf.get(font.FirstChar) === 'number' ? (pdf.get(font.FirstChar) as number) : 0;
  const widths = pdf.get(font.Widths);
  const desc = pdf.dict(font.FontDescriptor) ?? {};
  const missing = typeof pdf.get(desc.MissingWidth) === 'number' ? (pdf.get(desc.MissingWidth) as number) : 500;
  if (!Array.isArray(widths)) return () => missing || 500;
  return (code) => {
    const v = pdf.get(widths[code - first]);
    return typeof v === 'number' ? v : missing || 500;
  };
}

function decodeText(bytes: Uint8Array, f: FontMap | undefined): string {
  if (!f) return latin1(bytes);
  let s = '';
  for (let i = 0; i + f.width <= bytes.length; i += f.width) {
    const code = f.width === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    s += f.map.get(code) ?? f.fallback(code);
  }
  return s;
}

// ── content streams ─────────────────────────────────────────

interface Resources {
  fonts: Record<string, PdfValue>;
  xobjects: Record<string, PdfValue>;
}

function resourcesOf(pdf: PdfFile, res: PdfValue | undefined): Resources {
  const r = pdf.dict(res) ?? {};
  return { fonts: pdf.dict(r.Font) ?? {}, xobjects: pdf.dict(r.XObject) ?? {} };
}

/** where text goes: words get a space only where there is a real gap, lines and paragraphs from vertical moves */
class TextSink {
  out: string[] = [];
  private endX: number | undefined;
  private y: number | undefined;
  private size = 12;
  private chars = 0;
  /** a page's worth of text is there: the rest is not kept */
  get full() {
    return this.chars > MAX_TEXT_CHARS;
  }

  /** a run of text drawn from (x, y) to (x + w, y), at an effective font size */
  emit(text: string, x: number, y: number, w: number, size: number) {
    if (!text || this.full) return;
    this.chars += text.length;
    const s = Math.max(Math.abs(size), 0.1);
    if (this.y !== undefined) {
      const dy = Math.abs(y - this.y);
      if (dy > Math.max(this.size, s) * 1.7) this.break('\n\n');
      else if (dy > Math.min(this.size, s) * 0.4) this.break('\n');
      else if (this.endX !== undefined) {
        const gap = x - this.endX;
        if (gap > s * 0.18 || gap < -s * 4) this.space();
      }
    }
    this.out.push(text);
    this.endX = x + w;
    this.y = y;
    this.size = s;
  }
  private break(b: string) {
    const last = this.out[this.out.length - 1] ?? '';
    if (!last) return;
    if (b === '\n\n') this.out.push(last.endsWith('\n') ? '\n' : '\n\n');
    else if (!last.endsWith('\n')) this.out.push('\n');
  }
  private space() {
    const last = this.out[this.out.length - 1] ?? '';
    if (last && !/\s$/.test(last)) this.out.push(' ');
  }
}

/** the text state the operators change (PDF 9.3) */
interface TextState {
  tm: number[];
  tlm: number[];
  font?: FontMap;
  size: number;
  tc: number;
  tw: number;
  tz: number;
  tl: number;
}

const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

/** fonts by object number (one font is shared by many pages and forms) */
type FontCache = Map<unknown, FontMap>;
const cacheKey = (v: PdfValue) => (isRef(v) ? v.r : v);

async function runContent(pdf: PdfFile, data: Uint8Array, res: Resources, sink: TextSink, fonts: FontCache, depth: number, ctm0: number[] = [1, 0, 0, 1, 0, 0]) {
  const lex = new Lexer(data);
  const args: PdfValue[] = [];
  let ctm = ctm0;
  const stack: number[][] = [];
  const ts: TextState = { tm: [1, 0, 0, 1, 0, 0], tlm: [1, 0, 0, 1, 0, 0], size: 12, tc: 0, tw: 0, tz: 1, tl: 0 };
  const num = (i: number) => {
    const v = args[args.length - i];
    return typeof v === 'number' ? v : 0;
  };
  const nextLine = (tx: number, ty: number) => {
    ts.tlm = mul([1, 0, 0, 1, tx, ty], ts.tlm);
    ts.tm = [...ts.tlm];
  };
  /** draw one string: decode it, measure it, move the text matrix */
  const show = (bytes: Uint8Array) => {
    const f = ts.font;
    const text = decodeText(bytes, f);
    let advance = 0;
    if (f)
      for (let i = 0; i + f.width <= bytes.length; i += f.width) {
        const code = f.width === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
        advance += ((f.advance(code) / 1000) * ts.size + ts.tc + (f.width === 1 && code === 32 ? ts.tw : 0)) * ts.tz;
      }
    else advance = bytes.length * ts.size * 0.5;
    const m = mul(ts.tm, ctm);
    const scale = Math.hypot(m[0], m[1]) || 1;
    sink.emit(text, m[4], m[5], advance * scale, ts.size * (Math.hypot(m[2], m[3]) || 1));
    ts.tm = mul([1, 0, 0, 1, advance, 0], ts.tm);
  };
  for (let t = lex.next(), guard = 0; t !== undefined && guard < 5_000_000; t = lex.next(), guard++) {
    if (pdf.budget.step()) await pdf.budget.pause();
    if (!(typeof t === 'object' && t !== null && 'op' in t)) {
      args.push(t as PdfValue);
      continue;
    }
    switch (t.op) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        ctm = stack.pop() ?? ctm;
        break;
      case 'cm':
        ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], ctm);
        break;
      case 'BI': {
        // an inline image: skip its bytes up to " EI " (scanned in place, never copied)
        let p = lex.pos;
        while (p + 3 < data.length && !(data[p + 1] === 0x45 && data[p + 2] === 0x49 && WS.has(data[p]) && WS.has(data[p + 3]))) p++;
        pdf.budget.step(((p - lex.pos) >> 10) + 1);
        lex.pos = p + 3 < data.length ? p + 4 : data.length;
        break;
      }
      case 'BT':
        ts.tm = [1, 0, 0, 1, 0, 0];
        ts.tlm = [1, 0, 0, 1, 0, 0];
        break;
      case 'Tf': {
        const name = args[args.length - 2];
        ts.size = num(1);
        const ref = isName(name) ? res.fonts[name.n] : undefined;
        if (ref !== undefined) {
          const key = cacheKey(ref);
          if (!fonts.has(key)) fonts.set(key, await fontMap(pdf, ref));
          ts.font = fonts.get(key);
        }
        break;
      }
      case 'Tc':
        ts.tc = num(1);
        break;
      case 'Tw':
        ts.tw = num(1);
        break;
      case 'Tz':
        ts.tz = num(1) / 100;
        break;
      case 'TL':
        ts.tl = num(1);
        break;
      case 'Td':
        nextLine(num(2), num(1));
        break;
      case 'TD':
        ts.tl = -num(1);
        nextLine(num(2), num(1));
        break;
      case 'Tm':
        ts.tlm = [num(6), num(5), num(4), num(3), num(2), num(1)];
        ts.tm = [...ts.tlm];
        break;
      case 'T*':
        nextLine(0, -ts.tl);
        break;
      case "'": {
        nextLine(0, -ts.tl);
        const s = args[args.length - 1];
        if (isStr(s)) show(s.s);
        break;
      }
      case '"': {
        ts.tw = num(3);
        ts.tc = num(2);
        nextLine(0, -ts.tl);
        const s = args[args.length - 1];
        if (isStr(s)) show(s.s);
        break;
      }
      case 'Tj': {
        const s = args[args.length - 1];
        if (isStr(s)) show(s.s);
        break;
      }
      case 'TJ': {
        const arr = args[args.length - 1];
        if (Array.isArray(arr)) pdf.budget.step(arr.length);
        if (Array.isArray(arr))
          for (const x of arr) {
            if (isStr(x)) show(x.s);
            else if (typeof x === 'number') ts.tm = mul([1, 0, 0, 1, (-x / 1000) * ts.size * ts.tz, 0], ts.tm);
          }
        break;
      }
      case 'Do': {
        const name = args[args.length - 1];
        const ref = isName(name) ? res.xobjects[name.n] : undefined;
        const obj = pdf.objectOf(ref);
        const d = obj && isDict(obj.value) ? obj.value.d : undefined;
        if (obj && d && isName(d.Subtype) && d.Subtype.n === 'Form' && depth < 3) {
          // a form drawn again and again (or forms fanning out into forms) stops here
          if (++pdf.formRuns > MAX_FORM_RUNS) {
            pdf.warnings.push('the PDF draws too many forms: some were not read');
            break;
          }
          const sub = await pdf.decodeRef(ref);
          const fm = pdf.get(d.Matrix);
          const matrix = Array.isArray(fm) && fm.length === 6 && fm.every((x) => typeof x === 'number') ? (fm as number[]) : [1, 0, 0, 1, 0, 0];
          if (sub) await runContent(pdf, sub, d.Resources ? resourcesOf(pdf, d.Resources) : res, sink, fonts, depth + 1, mul(matrix, ctm));
        }
        break;
      }
    }
    args.length = 0;
    if (sink.out.length > 400_000 || sink.full) break;
  }
}

/** a page's text without trailing blanks or runs of spaces (linear: no backtracking regex) */
function tidy(raw: string): string {
  const lines = raw.replace(/\u0000/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let e = l.length;
    while (e > 0 && (l[e - 1] === ' ' || l[e - 1] === '\t')) e--;
    if (e < l.length) lines[i] = l.slice(0, e);
  }
  return lines
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** every page's text, in order; pages with no text come back empty */
export async function extractPdfText(bytes: Uint8Array, o: ExtractOptions = {}): Promise<PdfText> {
  const pdf = new PdfFile(bytes, new WorkBudget({ ...o, maxOps: MAX_OPS }));
  await pdf.load();
  if (pdf.encrypted) return { pages: [], warnings: ['the PDF is encrypted'], encrypted: true };
  // the catalogue → page tree (resources are inherited)
  let root: Record<string, PdfValue> | undefined;
  for (const [, obj] of pdf.objects) if (isDict(obj.value) && isName(obj.value.d.Type) && obj.value.d.Type.n === 'Catalog') root = obj.value.d;
  const pages: { dict: Record<string, PdfValue>; res: PdfValue | undefined }[] = [];
  // nodes by object number: a tree whose kids point back at themselves is walked once
  const seen = new Set<unknown>();
  let visited = 0;
  const walk = (node: PdfValue | undefined, inherited: PdfValue | undefined, depth: number) => {
    if (depth > 50 || pages.length >= MAX_PAGES || ++visited > MAX_TREE_NODES || node === undefined) return;
    const key = cacheKey(node);
    if (seen.has(key)) return;
    seen.add(key);
    const d = pdf.dict(node);
    if (!d) return;
    const res = d.Resources ?? inherited;
    const type = isName(d.Type) ? d.Type.n : '';
    if (type === 'Pages' || Array.isArray(pdf.get(d.Kids))) {
      const kids = pdf.get(d.Kids);
      if (Array.isArray(kids)) for (const k of kids) walk(k, res, depth + 1);
    } else pages.push({ dict: d, res });
  };
  if (root) walk(root.Pages, undefined, 0);
  if (!pages.length) {
    // no usable catalogue: take every page object in file order
    for (const [, obj] of pdf.objects) if (pages.length < MAX_PAGES && isDict(obj.value) && isName(obj.value.d.Type) && obj.value.d.Type.n === 'Page') pages.push({ dict: obj.value.d, res: obj.value.d.Resources });
    if (pages.length) pdf.warnings.push('the page order comes from the file, not its page tree');
  }
  const fonts: FontCache = new Map();
  const result: PdfPageText[] = [];
  let total = 0;
  for (let i = 0; i < pages.length; i++) {
    const { dict, res } = pages[i];
    const contents = pdf.get(dict.Contents);
    const refs = Array.isArray(contents) ? contents : [dict.Contents];
    const parts: Uint8Array[] = [];
    let size = 0;
    for (const r of refs.slice(0, 1_000)) {
      const data = await pdf.decodeRef(r as PdfValue);
      // one stream listed many times must not multiply into one huge page
      if (!data || size + data.length > MAX_STREAM_BYTES) continue;
      parts.push(data, Uint8Array.of(0x0a));
      size += data.length + 1;
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    const sink = new TextSink();
    let stopped = false;
    try {
      await runContent(pdf, all, resourcesOf(pdf, res), sink, fonts, 0);
    } catch (err) {
      // cancelled or out of time: no result; too much work: what was read so far
      if (err instanceof ExtractStop && err.kind !== 'budget') throw err;
      if (err instanceof ExtractStop) {
        stopped = true;
        pdf.warnings.push('the PDF is too complex to read in full: later pages were not read');
      } else pdf.warnings.push(`page ${i + 1}: ${String(err).slice(0, 80)}`);
    }
    const text = tidy(sink.out.join(''));
    total += text.length;
    result.push({ number: i + 1, text });
    if (stopped) break;
    if (total > MAX_TEXT_CHARS) {
      pdf.warnings.push('the text is very long: later pages were not read');
      break;
    }
  }
  return { pages: result, warnings: [...new Set(pdf.warnings)].slice(0, 20), encrypted: false };
}
