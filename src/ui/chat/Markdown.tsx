// Markdown answers as React elements (mdParse.ts), never as HTML. Links open in the user's browser,
// code blocks have a Copy button, and the plain text between them goes through `text`: chat answers
// pass CitedText there, so [K1] / [W2] still become citation chips.
import { Check, Copy } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useServices, useT } from '../context';
import { parseMarkdown, type MdBlock, type MdInline } from './mdParse';

export function Markdown({ text, plain = (s) => s, className }: { text: string; plain?: (s: string) => ReactNode; className?: string }) {
  const tree = useMemo(() => parseMarkdown(text), [text]);
  return <div className={`md${className ? ` ${className}` : ''}`}>{renderBlocks(tree, plain)}</div>;
}

function renderBlocks(list: MdBlock[], plain: (s: string) => ReactNode): ReactNode[] {
  return list.map((b, k) => {
    switch (b.t) {
      case 'p':
        return <p key={k}>{renderInline(b.c, plain)}</p>;
      case 'h': {
        const H = (['h3', 'h3', 'h4', 'h5', 'h6', 'h6'] as const)[b.level - 1];
        return <H key={k}>{renderInline(b.c, plain)}</H>;
      }
      case 'code':
        return <CodeBlock key={k} lang={b.lang} code={b.v} />;
      case 'quote':
        return <blockquote key={k}>{renderBlocks(b.c, plain)}</blockquote>;
      case 'list': {
        const items = b.items.map((it, n) => (
          <li key={n} className={it.task === undefined ? undefined : 'md-task'}>
            {it.task !== undefined && <input type="checkbox" checked={it.task} disabled readOnly />}
            {renderBlocks(it.c, plain)}
          </li>
        ));
        return b.ordered ? (
          <ol key={k} start={b.start === 1 ? undefined : b.start}>
            {items}
          </ol>
        ) : (
          <ul key={k}>{items}</ul>
        );
      }
      case 'table':
        return (
          <div key={k} className="md-table">
            <table>
              <thead>
                <tr>
                  {b.head.map((c, n) => (
                    <th key={n} style={b.align[n] ? { textAlign: b.align[n]! } : undefined}>
                      {renderInline(c, plain)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, n) => (
                      <td key={n} style={b.align[n] ? { textAlign: b.align[n]! } : undefined}>
                        {renderInline(c, plain)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'hr':
        return <hr key={k} />;
    }
  });
}

function renderInline(list: MdInline[], plain: (s: string) => ReactNode): ReactNode[] {
  return list.map((n, k) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={k}>{plain(n.v)}</Fragment>;
      case 'code':
        return <code key={k}>{n.v}</code>;
      case 'br':
        return <br key={k} />;
      case 'strong':
        return <strong key={k}>{renderInline(n.c, plain)}</strong>;
      case 'em':
        return <em key={k}>{renderInline(n.c, plain)}</em>;
      case 'del':
        return <del key={k}>{renderInline(n.c, plain)}</del>;
      case 'link':
        return (
          <Link key={k} href={n.href}>
            {renderInline(n.c, plain)}
          </Link>
        );
    }
  });
}

/** a link that opens in the user's browser; the app's own window never navigates */
function Link({ href, children }: { href: string; children: ReactNode }) {
  const { web } = useServices();
  return (
    <a
      href={href}
      className="md-link"
      title={href}
      onClick={(e) => {
        e.preventDefault();
        void web.open(href).catch(() => undefined);
      }}
      onAuxClick={(e) => e.preventDefault()}
    >
      {children}
    </a>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  return (
    <div className="md-code">
      <div className="md-code-head">
        <span>{lang}</span>
        <button type="button" className="link-btn" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('md.copied') : t('md.copy')}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
