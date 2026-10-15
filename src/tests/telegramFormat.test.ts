import { describe, expect, it } from 'vitest';
import { markdownParts, markdownToHtml } from '../runtime/telegram/format';

describe('Telegram formatting: an agent\'s Markdown as Telegram HTML', () => {
  it('headings, bold, italics, lists, code, links and quotes; everything else escaped', () => {
    const md = [
      '## Tre idee per Vocella',
      '',
      '1. **Dietro le quinte**: un video *breve* sul team',
      '2. Un sondaggio: `A` o `B`?',
      '- un punto',
      '  - un sotto-punto',
      '> una citazione',
      'Leggi [la guida](https://example.com/a?b=1) & poi <scrivi>.',
      '```',
      'const x = 1 < 2;',
      '```',
    ].join('\n');
    expect(markdownToHtml(md)).toBe(
      [
        '<b>Tre idee per Vocella</b>',
        '',
        '<b>1.</b> <b>Dietro le quinte</b>: un video <i>breve</i> sul team',
        '<b>2.</b> Un sondaggio: <code>A</code> o <code>B</code>?',
        '• un punto',
        '   ◦ un sotto-punto',
        '<blockquote>una citazione</blockquote>',
        'Leggi <a href="https://example.com/a?b=1">la guida</a> &amp; poi &lt;scrivi&gt;.',
        '<pre>const x = 1 &lt; 2;</pre>',
      ].join('\n'),
    );
  });

  it('underscores inside words stay, and a long answer is cut into whole parts', () => {
    expect(markdownToHtml('file_name_v2.md e snake_case')).toBe('file_name_v2.md e snake_case');
    const md = Array.from({ length: 40 }, (_, i) => `Paragrafo **${i}**: ${'parole '.repeat(30)}`).join('\n\n');
    const parts = markdownParts(md, 1000);
    expect(parts.length).toBeGreaterThan(5);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(1000);
      expect(p.match(/<b>/g)?.length).toBe(p.match(/<\/b>/g)?.length);
    }
  });
});
