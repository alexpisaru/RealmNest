// Small text helpers shared by process runners and CLI providers.

/** Splits a chunked text stream into complete lines (\n or \r\n). */
export class LineBuffer {
  private rest = '';

  push(chunk: string): string[] {
    const text = this.rest + chunk;
    const parts = text.split('\n');
    this.rest = parts.pop() ?? '';
    return parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  }

  /** whatever is left after the stream ended (a last line without newline) */
  end(): string[] {
    const last = this.rest;
    this.rest = '';
    return last.trim() ? [last] : [];
  }
}

/** Keeps the last `max` characters of a stream (stderr tails). */
export class TailBuffer {
  private text = '';
  constructor(private max = 8_000) {}
  push(chunk: string) {
    this.text = (this.text + chunk).slice(-this.max);
  }
  toString() {
    return this.text;
  }
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  // OpenAI (sk-proj-…, sk-…) and OpenRouter (sk-or-…) keys
  /\bsk-(?!ant-)[A-Za-z0-9_-]{16,}/g,
  // a Telegram bot token: <bot id>:<35 characters>
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*)=([^\s"']+)/g,
  /("(?:access|refresh)_?token"\s*:\s*")[^"]+"/gi,
];

/** Masks things that look like credentials before text reaches a log or the UI. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce(
    (s, re) =>
      s.replace(re, (m, a: string | undefined) => {
        if (m.startsWith('sk-ant-')) return 'sk-ant-[redacted]';
        if (m.startsWith('sk-')) return 'sk-[redacted]';
        if (/^\d{6,12}:/.test(m)) return '[redacted bot token]';
        if (/^(Bearer|Basic)\s/i.test(m)) return `${a} [redacted]`;
        if (m.startsWith('"')) return `${a}[redacted]"`;
        return `${a}=[redacted]`;
      }),
    text,
  );
}

/** First `max` characters, with an ellipsis when cut. */
export function clip(text: string, max = 2_000): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
