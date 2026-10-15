// Telegram's HTML (docs/TELEGRAM.md): the few tags it renders (<b> <i> <u> <s> <code> <pre> <a>
// <blockquote>), everything else escaped. Agents answer in Markdown: turned into that HTML here,
// in parts short enough for one message each, so a tag is never cut in two.

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** one line of Markdown → Telegram HTML (escaped first; then bold, italics, code, links) */
function inline(line: string): string {
  // code spans first: their content stays as it is
  const parts = line.split(/(`[^`\n]+`)/g);
  return parts
    .map((p) => {
      if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return `<code>${esc(p.slice(1, -1))}</code>`;
      let s = esc(p);
      s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text: string, url: string) => `<a href="${url.replace(/"/g, '&quot;')}">${text}</a>`);
      s = s.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_m, a?: string, b?: string) => `<b>${a ?? b}</b>`);
      s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
      s = s.replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
      s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
      return s;
    })
    .join('');
}

/** Markdown → Telegram HTML blocks (paragraphs, lists, headings, quotes, code blocks) */
export function markdownToHtml(md: string): string {
  const out: string[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let quote: string[] = [];
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.join('\n')}</blockquote>`);
    quote = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // a fenced code block, kept as it is
    const fence = /^\s*```/.exec(line);
    if (fence) {
      flushQuote();
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      out.push(`<pre>${esc(body.join('\n'))}</pre>`);
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      quote.push(inline(q[1]));
      continue;
    }
    flushQuote();
    const h = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      out.push(`<b>${inline(h[1].replace(/\*\*/g, ''))}</b>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('──────────');
      continue;
    }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(`${bullet[1].length >= 2 ? '   ◦' : '•'} ${inline(bullet[2])}`);
      continue;
    }
    const num = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (num) {
      out.push(`${num[1].length >= 2 ? '   ' : ''}<b>${num[2]}.</b> ${inline(num[3])}`);
      continue;
    }
    // a table row: as monospace text (Telegram has no tables)
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;
      out.push(`<code>${esc(line.trim())}</code>`);
      continue;
    }
    out.push(inline(line));
  }
  flushQuote();
  // at most one empty line in a row
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Markdown cut into parts of at most `max` characters of HTML each: at blank lines, then at
 * lines, never inside a code block; each part converted on its own.
 */
export function markdownParts(md: string, max = 3800): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  let inCode = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    cur.push(line);
    if (!inCode && line.trim() === '') {
      blocks.push(cur.join('\n'));
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur.join('\n'));
  const parts: string[] = [];
  let acc = '';
  const push = () => {
    const html = markdownToHtml(acc);
    if (html) parts.push(html);
    acc = '';
  };
  for (const b of blocks) {
    if (markdownToHtml(`${acc}\n${b}`).length > max && acc) push();
    if (markdownToHtml(b).length > max) {
      // one huge block: line by line, then plain cuts
      for (const line of b.split('\n')) {
        if (markdownToHtml(`${acc}\n${line}`).length > max && acc) push();
        acc = acc ? `${acc}\n${line}` : line;
        while (markdownToHtml(acc).length > max) {
          const head = acc.slice(0, Math.floor(max / 2));
          acc = acc.slice(head.length);
          parts.push(esc(head));
        }
      }
    } else acc = acc ? `${acc}\n${b}` : b;
  }
  if (acc.trim()) push();
  return parts.length ? parts : [''];
}
