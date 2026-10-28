import { describe, expect, it } from 'vitest';
import { inline, parseMarkdown } from '../ui/chat/mdParse';

describe('Markdown in chat answers', () => {
  it('reads headings, paragraphs with line breaks and rules', () => {
    expect(parseMarkdown('## Titolo\nRiga uno\nriga due\n\n---\n#hashtag')).toEqual([
      { t: 'h', level: 2, c: [{ t: 'text', v: 'Titolo' }] },
      { t: 'p', c: [{ t: 'text', v: 'Riga uno' }, { t: 'br' }, { t: 'text', v: 'riga due' }] },
      { t: 'hr' },
      { t: 'p', c: [{ t: 'text', v: '#hashtag' }] },
    ]);
  });

  it('reads bullet, ordered, nested and task lists', () => {
    const [list] = parseMarkdown('- uno\n  - dentro\n- [x] fatto\n- [ ] da fare');
    expect(list).toMatchObject({ t: 'list', ordered: false, items: [{ c: [{ t: 'p' }, { t: 'list', items: [{ c: [{ t: 'p', c: [{ t: 'text', v: 'dentro' }] }] }] }] }, { task: true }, { task: false }] });
    const [ol] = parseMarkdown('3. tre\n4. quattro');
    expect(ol).toMatchObject({ t: 'list', ordered: true, start: 3 });
    expect((ol as { items: unknown[] }).items).toHaveLength(2);
  });

  it('a list right after a paragraph line starts a list; a loose list stays one list', () => {
    const blocks = parseMarkdown('Ecco i punti:\n1. primo\n\n2. secondo');
    expect(blocks.map((b) => b.t)).toEqual(['p', 'list']);
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('keeps fenced code as it is, also while it is still streaming', () => {
    expect(parseMarkdown('```ts\nconst a = **b**;\n```\ndopo')).toEqual([
      { t: 'code', lang: 'ts', v: 'const a = **b**;' },
      { t: 'p', c: [{ t: 'text', v: 'dopo' }] },
    ]);
    expect(parseMarkdown('```\nnon chiuso')).toEqual([{ t: 'code', lang: '', v: 'non chiuso' }]);
  });

  it('reads tables with alignment and quotes', () => {
    const [table, quote] = parseMarkdown('| a | b |\n|:--|--:|\n| 1 | **2** |\n\n> citato');
    expect(table).toMatchObject({ t: 'table', align: ['left', 'right'], head: [[{ v: 'a' }], [{ v: 'b' }]], rows: [[[{ v: '1' }], [{ t: 'strong' }]]] });
    expect(quote).toEqual({ t: 'quote', c: [{ t: 'p', c: [{ t: 'text', v: 'citato' }] }] });
  });

  it('reads bold, italics, strikethrough and code; snake_case and lone stars stay text', () => {
    expect(inline('**forte** e *corsivo* e ~~via~~ e `x*y`')).toEqual([
      { t: 'strong', c: [{ t: 'text', v: 'forte' }] },
      { t: 'text', v: ' e ' },
      { t: 'em', c: [{ t: 'text', v: 'corsivo' }] },
      { t: 'text', v: ' e ' },
      { t: 'del', c: [{ t: 'text', v: 'via' }] },
      { t: 'text', v: ' e ' },
      { t: 'code', v: 'x*y' },
    ]);
    expect(inline('my_var_name e 2 * 3 * 4')).toEqual([{ t: 'text', v: 'my_var_name e 2 * 3 * 4' }]);
    expect(inline('*a **b** c*')).toEqual([{ t: 'em', c: [{ t: 'text', v: 'a ' }, { t: 'strong', c: [{ t: 'text', v: 'b' }] }, { t: 'text', v: ' c' }] }]);
  });

  it('links only http(s) addresses; citations and other schemes stay text', () => {
    expect(inline('vedi [il sito](https://example.com/a_(b)) [W1]')).toEqual([
      { t: 'text', v: 'vedi ' },
      { t: 'link', href: 'https://example.com/a_(b)', c: [{ t: 'text', v: 'il sito' }] },
      { t: 'text', v: ' [W1]' },
    ]);
    expect(inline('[clic](javascript:alert(1))')).toEqual([{ t: 'text', v: 'clic' }]);
    expect(inline('apri https://example.com/x. Poi (https://example.org)')).toEqual([
      { t: 'text', v: 'apri ' },
      { t: 'link', href: 'https://example.com/x', c: [{ t: 'text', v: 'https://example.com/x' }] },
      { t: 'text', v: '. Poi (' },
      { t: 'link', href: 'https://example.org', c: [{ t: 'text', v: 'https://example.org' }] },
      { t: 'text', v: ')' },
    ]);
  });

  it('backslash escapes are literal', () => {
    expect(inline('\\*non corsivo\\*')).toEqual([{ t: 'text', v: '*non corsivo*' }]);
  });
});
