// Reading a model's JSON answer: thinking blocks and code fences removed, then the whole text,
// then the last balanced {…} that parses (so an echoed example earlier in the text never wins).

export function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/^[\s\S]*?<\/think(?:ing)?>/i, '')
    .trim();
}

function candidates(text: string): string[] {
  const out: string[] = [];
  for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        out.push(text.slice(start, i + 1));
        break;
      }
    }
    if (out.length > 200) break;
  }
  return out;
}

/** the model's JSON object, or undefined */
export function parseJsonObject<T = Record<string, unknown>>(raw: string): T | undefined {
  const text = stripThinking(raw).replace(/```(?:json)?/gi, '').trim();
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  } catch {
    /* not the whole text */
  }
  // the outermost objects, last first
  const all = candidates(text).sort((a, b) => b.length - a.length);
  const outer = all.filter((c) => !all.some((o) => o !== c && o.length > c.length && o.includes(c)));
  for (const c of outer.reverse()) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
    } catch {
      /* next */
    }
  }
  return undefined;
}

export const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
