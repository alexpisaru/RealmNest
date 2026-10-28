// Markdown → a small tree (never HTML), for chat answers and agent results (Markdown.tsx renders it).
// The CommonMark-like subset models write: headings, paragraphs, lists (nested, ordered, tasks),
// quotes, fenced code, tables, rules; bold, italics, strikethrough, code, links. Links are kept only
// for http(s) addresses; anything else stays text. Unclosed fences and emphasis (a streaming answer)
// are read as far as they go.

export type MdInline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'br' }
  | { t: 'strong' | 'em' | 'del'; c: MdInline[] }
  | { t: 'link'; href: string; c: MdInline[] };

export type MdAlign = 'left' | 'center' | 'right' | null;

export type MdBlock =
  | { t: 'p'; c: MdInline[] }
  | { t: 'h'; level: number; c: MdInline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'quote'; c: MdBlock[] }
  | { t: 'list'; ordered: boolean; start: number; items: { task?: boolean; c: MdBlock[] }[] }
  | { t: 'table'; align: MdAlign[]; head: MdInline[][]; rows: MdInline[][][] }
  | { t: 'hr' };

const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*)|[ \t]*$)/;
const SEPARATOR = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const blank = (line: string) => !line.trim();
const indentOf = (line: string) => line.length - line.trimStart().length;
const dedent = (line: string, n: number) => line.slice(Math.min(n, indentOf(line)));

/** a table starts here: a row with pipes and a separator line (with pipes) under it */
const tableAt = (lines: string[], i: number) => i + 1 < lines.length && lines[i].includes('|') && lines[i + 1].includes('|') && SEPARATOR.test(lines[i + 1]);

/** a list item with text (a bare "-" is not one) */
const itemAt = (line: string) => !!ITEM.exec(line)?.[3];

/** a line that ends a paragraph and starts a block of its own */
const startsBlock = (lines: string[], i: number) => {
  const line = lines[i];
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || (itemAt(line) && indentOf(line) <= 3) || tableAt(lines, i);
};

function cells(row: string): string[] {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

export function parseMarkdown(text: string): MdBlock[] {
  return blocks(text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}

function blocks(lines: string[]): MdBlock[] {
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }
    // fenced code: everything up to the same fence (or the end, while an answer streams)
    const fence = FENCE.exec(line);
    if (fence) {
      const [, pad, mark, lang] = fence;
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}[ \\t]*$`).test(lines[i])) body.push(dedent(lines[i++], pad.length));
      i++;
      out.push({ t: 'code', lang, v: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ t: 'h', level: heading[1].length, c: inline(heading[2] ?? '') });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push({ t: 'hr' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].replace(QUOTE, ''));
      out.push({ t: 'quote', c: blocks(body) });
      continue;
    }
    if (tableAt(lines, i)) {
      const head = cells(lines[i]);
      const align = cells(lines[i + 1]).map((c): MdAlign => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < lines.length && !blank(lines[i]) && lines[i].includes('|')) {
        const row = cells(lines[i++]);
        rows.push(head.map((_, k) => inline(row[k] ?? '')));
      }
      out.push({ t: 'table', align: head.map((_, k) => align[k] ?? null), head: head.map((c) => inline(c)), rows });
      continue;
    }
    if (itemAt(line)) {
      i = list(lines, i, out);
      continue;
    }
    // a paragraph: lines up to a blank one or the start of another block
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !blank(lines[i]) && !startsBlock(lines, i)) para.push(lines[i++].trim());
    out.push({ t: 'p', c: inline(para.join('\n')) });
  }
  return out;
}

/** a list from line i (items of the same kind at the same indent); returns the next line */
function list(lines: string[], i: number, out: MdBlock[]): number {
  const first = ITEM.exec(lines[i])!;
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const node: Extract<MdBlock, { t: 'list' }> = { t: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items: [] };
  while (i < lines.length) {
    const m = ITEM.exec(lines[i]);
    if (!m || m[1].length > base + 1 || m[1].length < base || /\d/.test(m[2]) !== ordered) break;
    const content = m[1].length + m[2].length + 1;
    const body: string[] = [m[3] ?? ''];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (blank(next)) {
        // a blank line belongs to the item when what follows is indented under it or is the next item
        let j = i;
        while (j < lines.length && blank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > base + 1) {
          body.push('');
          i++;
          continue;
        }
        const n = ITEM.exec(lines[j] ?? '');
        if (n && n[1].length <= base + 1 && n[1].length >= base && /\d/.test(n[2]) === ordered) i = j;
        break;
      }
      if (indentOf(next) > base + 1) {
        body.push(dedent(next, content));
        i++;
        continue;
      }
      // lazy continuation of the item's text
      if (!ITEM.test(next) && !startsBlock(lines, i)) {
        body.push(next.trim());
        i++;
        continue;
      }
      break;
    }
    const task = /^\[([ xX])\][ \t]+/.exec(body[0]);
    if (task) body[0] = body[0].slice(task[0].length);
    node.items.push({ ...(task ? { task: task[1] !== ' ' } : {}), c: blocks(body) });
  }
  out.push(node);
  return i;
}

const SAFE_LINK = /^https?:\/\/[^\s]+$/i;
const LINK = /^\[((?:[^[\]\n]|\[[^[\]\n]*\])+)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))+)>?(?:\s+"[^"\n]*")?\s*\)/;
const AUTOLINK = /^<?(https?:\/\/(?:[^\s<>()[\]]|\([^\s<>()]*\))+)/i;
const word = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/** inline Markdown → nodes; newlines inside a paragraph become line breaks */
export function inline(s: string): MdInline[] {
  const out: MdInline[] = [];
  let text = '';
  const push = (node: MdInline) => {
    if (text) out.push({ t: 'text', v: text });
    text = '';
    out.push(node);
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const rest = s.slice(i);
    if (ch === '\\' && i + 1 < s.length && /[!-/:-@[-`{-~]/.test(s[i + 1])) {
      text += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === '\n') {
      push({ t: 'br' });
      i++;
      continue;
    }
    if (ch === '`') {
      const run = /^`+/.exec(rest)![0];
      const end = s.indexOf(run, i + run.length);
      if (end > 0) {
        let v = s.slice(i + run.length, end).replace(/\n/g, ' ');
        if (v.length > 2 && v.startsWith(' ') && v.endsWith(' ')) v = v.slice(1, -1);
        push({ t: 'code', v });
        i = end + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    if (ch === '[') {
      const m = LINK.exec(rest);
      if (m) {
        if (SAFE_LINK.test(m[2])) push({ t: 'link', href: m[2], c: inline(m[1]) });
        else out.push(...flush(), ...inline(m[1]));
        i += m[0].length;
        continue;
      }
    }
    if ((ch === 'h' || ch === 'H' || ch === '<') && !word(s[i - 1])) {
      const m = AUTOLINK.exec(rest);
      if (m) {
        // trailing punctuation, and a closing bracket nobody opened, are not part of the address
        let href = m[1].replace(/[.,;:!?'"*_~]+$/, '');
        while (href.endsWith(')') && (href.match(/\(/g)?.length ?? 0) < (href.match(/\)/g)?.length ?? 0)) href = href.slice(0, -1);
        push({ t: 'link', href, c: [{ t: 'text', v: href }] });
        i += href.length + (ch === '<' ? 1 : 0);
        if (ch === '<' && s[i] === '>') i++;
        continue;
      }
    }
    if (ch === '*' || ch === '_' || ch === '~') {
      const em = emphasis(s, i);
      if (em) {
        push(em.node);
        i = em.end;
        continue;
      }
    }
    text += ch;
    i++;
  }
  if (text) out.push({ t: 'text', v: text });
  return out;

  function flush(): MdInline[] {
    const done: MdInline[] = text ? [{ t: 'text', v: text }] : [];
    text = '';
    return done;
  }
}

/** **strong**, __strong__, *em*, _em_, ~~del~~ at i; underscores only between non-letters (snake_case stays) */
function emphasis(s: string, i: number): { node: MdInline; end: number } | null {
  const ch = s[i];
  const double = s[i + 1] === ch;
  if (ch === '~' && !double) return null;
  const mark = double ? ch + ch : ch;
  if (ch === '_' && word(s[i - 1])) return null;
  const from = i + mark.length;
  if (from >= s.length || /\s/.test(s[from]) || (!double && s[from] === ch)) return null;
  let j = from;
  while ((j = s.indexOf(mark, j + 1)) !== -1) {
    // a single mark inside a longer run (the ** of a bold inside *…*) does not close
    if (!double && s[j + 1] === ch) {
      while (s[j + 1] === ch) j++;
      continue;
    }
    if (/\s/.test(s[j - 1])) continue;
    if (ch === '_' && word(s[j + mark.length])) continue;
    const t = ch === '~' ? 'del' : double ? 'strong' : 'em';
    return { node: { t, c: inline(s.slice(from, j)) }, end: j + mark.length };
  }
  return null;
}
