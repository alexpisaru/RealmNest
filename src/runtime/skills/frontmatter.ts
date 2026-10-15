// SKILL.md frontmatter: the YAML subset real Skills use, without a YAML
// library (and without YAML's surprises: no tags, anchors or type coercion
// beyond what is listed). Supported:
//   key: plain / 'single' / "double \n escapes"
//   key: [flow, list]          key: |  or  >   (block text, - / + chomping)
//   key:                       key:
//     - block list               nested: map (one level, scalar values)
// Plain scalars stay strings (true / 3.0 are not converted): the importer
// decides what a field means. Bounded: 16 KB and 200 keys.

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
  /** there was a `---` block at the top */
  present: boolean;
  problems: string[];
}

const MAX_BYTES = 16 * 1024;
const MAX_KEYS = 200;
const KEY = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:(?:\s+(.*))?$/;

/** split `---` frontmatter from the Markdown body */
export function parseFrontmatter(text: string): Frontmatter {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { data: {}, body: src, present: false, problems: [] };
  const problems: string[] = [];
  if (m[1].length > MAX_BYTES) return { data: {}, body: src.slice(m[0].length), present: true, problems: ['the frontmatter is larger than 16 KB'] };
  return { data: parseYamlSubset(m[1], problems), body: src.slice(m[0].length), present: true, problems };
}

const indentOf = (line: string) => line.length - line.trimStart().length;

function unquote(raw: string, problems: string[]): string {
  const v = raw.trim();
  if (v.startsWith('"')) {
    const end = v.lastIndexOf('"');
    try {
      return JSON.parse(v.slice(0, end + 1).replace(/\\'/g, "'")) as string;
    } catch {
      problems.push(`cannot read the quoted text ${v.slice(0, 30)}`);
      return v.slice(1, end > 0 ? end : undefined);
    }
  }
  if (v.startsWith("'")) {
    const end = v.lastIndexOf("'");
    return v.slice(1, end > 0 ? end : undefined).replace(/''/g, "'");
  }
  // a plain scalar: drop an inline comment
  return v.replace(/\s+#.*$/, '');
}

function flowList(raw: string, problems: string[]): string[] {
  const inner = raw.trim().slice(1, -1);
  const items: string[] = [];
  let cur = '';
  let quote = '';
  for (const ch of inner) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ',') {
      items.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) items.push(cur);
  return items.map((i) => unquote(i, problems)).filter((i) => i !== '');
}

function scalar(raw: string, problems: string[]): unknown {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) return flowList(v, problems);
  if (v.startsWith('{')) {
    problems.push('inline maps ({…}) are not read');
    return v;
  }
  return unquote(v, problems);
}

export function parseYamlSubset(text: string, problems: string[] = []): Record<string, unknown> {
  const lines = text.split('\n');
  const out: Record<string, unknown> = {};
  let keys = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }
    if (indentOf(line) > 0) {
      problems.push(`unexpected indented line: ${line.trim().slice(0, 40)}`);
      i++;
      continue;
    }
    const m = KEY.exec(line);
    if (!m) {
      problems.push(`not a key: value line: ${line.slice(0, 40)}`);
      i++;
      continue;
    }
    if (++keys > MAX_KEYS) {
      problems.push(`more than ${MAX_KEYS} keys`);
      break;
    }
    const key = m[1];
    const rest = (m[2] ?? '').trim();
    i++;
    // the lines that belong to this key
    const block: string[] = [];
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0 || lines[i].startsWith('- '))) {
      block.push(lines[i]);
      i++;
    }
    while (block.length && !block[block.length - 1].trim()) block.pop();

    if (/^[|>][+-]?$/.test(rest)) {
      // block text
      const literal = rest.startsWith('|');
      const chomp = rest.slice(1);
      const pad = Math.min(...block.filter((l) => l.trim()).map(indentOf), Infinity);
      const body = block.map((l) => (l.trim() ? l.slice(pad === Infinity ? 0 : pad) : ''));
      let value = literal ? body.join('\n') : body.reduce((acc, l, idx) => (idx === 0 ? l : l === '' ? `${acc}\n` : acc.endsWith('\n') ? acc + l : `${acc} ${l}`), '');
      value = chomp === '-' ? value.replace(/\n+$/, '') : chomp === '+' ? `${value}\n` : `${value.replace(/\n+$/, '')}\n`;
      out[key] = value;
      continue;
    }
    if (rest) {
      // a plain scalar may continue on indented lines (folded with spaces)
      const more = block.map((l) => l.trim()).filter(Boolean);
      const v = scalar(rest, problems);
      out[key] = more.length && typeof v === 'string' && !/^["']/.test(rest) ? [v, ...more].join(' ') : v;
      continue;
    }
    const items = block.filter((l) => l.trim());
    if (!items.length) {
      out[key] = '';
      continue;
    }
    if (items.every((l) => l.trimStart().startsWith('- ') || l.trim() === '-')) {
      out[key] = items.map((l) => scalar(l.trimStart().replace(/^-\s?/, ''), problems));
      continue;
    }
    const map: Record<string, unknown> = {};
    for (const l of items) {
      const mm = KEY.exec(l.trim());
      if (mm) map[mm[1]] = scalar(mm[2] ?? '', problems);
      else problems.push(`cannot read ${key}: ${l.trim().slice(0, 40)}`);
    }
    out[key] = map;
  }
  return out;
}

/** a YAML-safe string (JSON double-quoted strings are valid YAML) */
const q = (s: string) => JSON.stringify(s);

/** frontmatter for an exported SKILL.md (Agent Skills fields, readable by other tools) */
export function renderFrontmatter(fields: { name: string; description: string; license?: string; compatibility?: string; metadata?: Record<string, string> }): string {
  const lines = ['---', `name: ${q(fields.name)}`, `description: ${q(fields.description)}`];
  if (fields.license) lines.push(`license: ${q(fields.license)}`);
  if (fields.compatibility) lines.push(`compatibility: ${q(fields.compatibility)}`);
  const meta = Object.entries(fields.metadata ?? {});
  if (meta.length) {
    lines.push('metadata:');
    for (const [k, v] of meta) lines.push(`  ${k}: ${q(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}
