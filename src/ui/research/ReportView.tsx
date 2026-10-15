// The report, rendered by RealmNest from the run's structured data (never model HTML): numbered
// citation chips (hover: the quotes; click: the page or the document), sentences the check flagged,
// tables, timeline, charts drawn from cited numbers, and the actions (export, Knowledge, Discuss).

import { Copy, Download, ExternalLink, EyeOff, FileText, Images, MessagesSquare, Microscope, RefreshCw, TriangleAlert } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ResearchRun, ResearchSource } from '../../domain/research';
import type { TKey } from '../../i18n';
import { citedLabels } from '../../runtime/knowledge/grounding';
import { chartSvg, citationNumbers, toHtml, toMarkdown } from '../../runtime/research/export';
import { pictureData, pictureLayout, type Picture } from '../../runtime/research/pictures';
import { useChat, useKnowledge, useResearch, useServices, useT, useWeb } from '../context';
import { useArtifacts } from '../files/FileViews';
import { AddToKnowledge } from '../knowledge/common';
import { Button } from '../kit';

const MARKERS = /\[(?:[KW]\d{1,3})(?:\]\s*\[[KW]\d{1,3})*\]/g;

function useCite(run: ResearchRun) {
  const web = useWeb();
  const { store } = useServices();
  const nums = useMemo(() => citationNumbers(run), [run.report, run.sources.length]);
  const open = (s: ResearchSource) => {
    if (s.kind === 'web') void web.open(s.finalUrl ?? s.url ?? '').catch(() => undefined);
    else store.openKnowledge({ ...(s.baseId && { baseId: s.baseId }), ...(s.documentId && { documentId: s.documentId }), ...(s.chunkId && { chunkId: s.chunkId }) });
  };
  const flagged = useMemo(() => new Map((run.verification?.checks ?? []).map((c) => [c.sentence.trim(), c])), [run.verification]);
  /** text with [W3] markers → chips; sentences the check flagged are marked */
  const render = (text: string): ReactNode => {
    let marked: ReactNode[] = [text];
    for (const [sentence, check] of flagged) {
      if (check.status === 'supported' || !text.includes(sentence)) continue;
      marked = marked.flatMap((part, i) => {
        if (typeof part !== 'string' || !part.includes(sentence)) return [part];
        const [a, ...rest] = part.split(sentence);
        return [
          a,
          <mark key={`m${i}`} className={`rs-flag ${check.status}`} title={check.note ?? ''}>
            {sentence}
          </mark>,
          rest.join(sentence),
        ];
      });
    }
    const chips = (s: string, key: string) => {
      const out: ReactNode[] = [];
      let last = 0;
      let k = 0;
      for (const m of s.matchAll(MARKERS)) {
        out.push(s.slice(last, m.index));
        for (const l of citedLabels(m[0])) {
          const n = nums.get(l);
          const src = run.sources.find((x) => x.id === l);
          if (!n || !src) continue;
          const quotes = run.evidence
            .filter((e) => e.sourceId === l)
            .slice(0, 2)
            .map((e) => `“${e.quote}”${e.context ? `\n  ${e.context}` : ''}`);
          out.push(
            <button
              key={`${key}-${k++}`}
              type="button"
              className={`cite rs-cite ${src.kind}`}
              title={`${src.title ?? src.domain ?? src.documentName ?? ''}${src.domain ? ` · ${src.domain}` : ''}\n${quotes.join('\n')}`}
              onClick={() => open(src)}
            >
              {n}
            </button>,
          );
        }
        last = (m.index ?? 0) + m[0].length;
      }
      out.push(s.slice(last));
      return out;
    };
    return marked.map((part, i) =>
      typeof part === 'string' ? (
        <Fragment key={i}>{chips(part, `p${i}`)}</Fragment>
      ) : (
        <mark key={i} className={(part as { props: { className: string } }).props.className} title={(part as { props: { title: string } }).props.title}>
          {chips(String((part as { props: { children: string } }).props.children), `f${i}`)}
        </mark>
      ),
    );
  };
  return { nums, render, open };
}

type TocEntry = { id: string; label: string; sub?: boolean };

/** the report's contents: one entry per part that is there; tables and charts indented */
function tocOf(run: ResearchRun, t: ReturnType<typeof useT>): TocEntry[] {
  const r = run.report!;
  const id = (k: string) => `rs-${run.id}-${k}`;
  return [
    { id: id('summary'), label: t('rs.summaryTitle') },
    ...(r.keyFindings.length ? [{ id: id('findings'), label: t('rs.keyFindings') }] : []),
    ...r.sections.map((s, i) => ({ id: id(`s${i}`), label: s.heading || `${i + 1}` })),
    ...r.tables.map((tb, i) => ({ id: id(`t${i}`), label: tb.title, sub: true })),
    ...(r.timeline.length ? [{ id: id('timeline'), label: t('rs.timeline') }] : []),
    ...r.charts.map((c, i) => ({ id: id(`c${i}`), label: c.title, sub: true })),
    ...(r.disagreements.length ? [{ id: id('disagree'), label: t('rs.disagree') }] : []),
    ...(r.openQuestions.length ? [{ id: id('open'), label: t('rs.open') }] : []),
    { id: id('sources'), label: t('rs.sources') },
  ];
}

/** the contents on the left: follows the reading (the part at the top of the view is lit) */
function ReportToc({ entries }: { entries: TocEntry[] }) {
  const t = useT();
  const [active, setActive] = useState<string | undefined>(entries[0]?.id);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    // the scrolling column the report sits in
    let box = nav.current?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (!box) return;
    const scroller = box;
    let frame = 0;
    const update = () => {
      frame = 0;
      // a part is current once its heading is in the upper third of the view
      const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.3;
      // at the very end: the last part, even when it is short
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) return setActive(entries.at(-1)?.id);
      let current = entries[0]?.id;
      for (const e of entries) {
        const el = document.getElementById(e.id);
        if (el && el.getBoundingClientRect().top <= top) current = e.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [entries]);
  return (
    <nav className="rs-toc" aria-label={t('rs.toc')} ref={nav}>
      <b>{t('rs.toc')}</b>
      {entries.map((e) => (
        <button
          key={e.id}
          type="button"
          className={`${e.sub ? 'sub' : ''} ${active === e.id ? 'on' : ''}`}
          onClick={() => {
            setActive(e.id);
            document.getElementById(e.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {e.label}
        </button>
      ))}
    </nav>
  );
}

/** a kept picture as an address the app can show (made once per picture, released when no view shows it) */
const pictureUrls = new Map<string, { url: Promise<string>; users: number }>();
function usePicture(ref: string | undefined) {
  const { files } = useServices();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!ref) return;
    let live = true;
    let entry = pictureUrls.get(ref);
    if (!entry) {
      const p = files.get(ref).then((b) => URL.createObjectURL(new Blob([b as BlobPart], { type: 'image/webp' })));
      entry = { url: p, users: 0 };
      pictureUrls.set(ref, entry);
      p.catch(() => pictureUrls.delete(ref));
    }
    const mine = entry;
    mine.users++;
    mine.url.then((u) => live && setUrl(u)).catch(() => undefined);
    return () => {
      live = false;
      // the last view of this picture is gone: free its blob
      if (--mine.users > 0) return;
      if (pictureUrls.get(ref) === mine) pictureUrls.delete(ref);
      mine.url.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    };
  }, [ref, files]);
  return url;
}

/** a report picture: from the source it belongs to (caption, click: the page), another one, or none */
function ReportPicture({ run, pic, spare, kind, onSource }: { run: ResearchRun; pic: Picture; spare: number; kind: 'hero' | 'pic'; onSource: (s: ResearchSource) => void }) {
  const t = useT();
  const research = useResearch();
  const url = usePicture(pic.ref);
  const s = run.sources.find((x) => x.id === pic.sourceId);
  const layout = pictureLayout(run);
  if (!url || !s) return null;
  return (
    <figure className={`rs-pic ${kind}`}>
      <img src={url} alt="" width={pic.w} height={pic.h} />
      <figcaption>
        {t('rs.picFrom')}{' '}
        <button type="button" className="link-btn" onClick={() => onSource(s)}>
          {s.title || s.domain}
        </button>
        {s.domain && <span className="muted"> · {s.domain}</span>}
      </figcaption>
      <div className="rs-pic-tools">
        <button type="button" title={t('rs.picOther')} aria-label={t('rs.picOther')} disabled={!spare} onClick={() => layout.spare[0] && research.setPicture(run.id, pic.slot, layout.spare[0].sourceId)}>
          <RefreshCw size={14} />
        </button>
        <button type="button" title={t('rs.picHide')} aria-label={t('rs.picHide')} onClick={() => research.setPicture(run.id, pic.slot, null, pic.sourceId)}>
          <EyeOff size={14} />
        </button>
      </div>
    </figure>
  );
}

export function ReportView({ run }: { run: ResearchRun }) {
  const t = useT();
  const r = run.report!;
  const { nums, render, open } = useCite(run);
  const research = useResearch();
  const pics = useMemo(() => pictureLayout(run), [run.report, run.sources, run.pictures]);
  const v = run.verification;
  const bad = v?.checks.filter((c) => c.status !== 'supported') ?? [];
  const toc = useMemo(() => tocOf(run, t), [run.report, run.id, t]);
  const id = (k: string) => `rs-${run.id}-${k}`;
  return (
    <div className="rs-report-layout">
      <ReportToc entries={toc} />
      <article className={`rs-report kind-${run.plan?.kind ?? 'general'}`}>
        <ReportActions run={run} />
        {v && (
          <p className={`rs-check ${bad.length ? 'warn' : 'ok'}`}>
            {bad.length ? <TriangleAlert size={14} /> : null}
            {bad.length ? t('rs.checkWarn', { n: bad.length }) : t('rs.checkOk', { n: v.lexical.cited })}
            {v.invalidMarkers.length > 0 && ` ${t('rs.invalidMarkers', { list: v.invalidMarkers.join(', ') })}`}
          </p>
        )}
        {pics.hero && <ReportPicture run={run} pic={pics.hero} spare={pics.spare.length} kind="hero" onSource={open} />}
        {pics.hidden > 0 && (
          <button type="button" className="link-btn rs-pic-restore" onClick={() => research.resetPictures(run.id)}>
            <Images size={13} /> {t('rs.picRestore', { n: pics.hidden })}
          </button>
        )}
        <p className="rs-summary" id={id('summary')}>
          {render(r.summary)}
        </p>
        {r.verdict && (
          <div className="rs-verdict">
            <b>{r.verdict.label}</b> {render(r.verdict.text)}
          </div>
        )}
        {r.keyFindings.length > 0 && (
          <section id={id('findings')}>
            <h3>{t('rs.keyFindings')}</h3>
            <ul className="rs-findings">
              {r.keyFindings.map((f, i) => (
                <li key={i}>{render(f)}</li>
              ))}
            </ul>
          </section>
        )}
        {r.sections.map((s, i) => (
          <section key={i} id={id(`s${i}`)}>
            <h3>{s.heading}</h3>
            {pics.sections[i] && <ReportPicture run={run} pic={pics.sections[i]!} spare={pics.spare.length} kind="pic" onSource={open} />}
            {s.paragraphs.map((p, j) => (
              <p key={j}>{render(p)}</p>
            ))}
          </section>
        ))}
        {r.tables.map((tb, i) => (
          <section key={`t${i}`} id={id(`t${i}`)}>
            <h4>{tb.title}</h4>
            <div className="rs-table-wrap">
              <table className="rs-table">
                <thead>
                  <tr>
                    {tb.columns.map((c, j) => (
                      <th key={j}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((c, k) => (
                        <td key={k} className={c.tone ?? ''}>
                          {render(c.text)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tb.note && <small className="muted">{render(tb.note)}</small>}
          </section>
        ))}
        {r.timeline.length > 0 && (
          <section id={id('timeline')}>
            <h3>{t('rs.timeline')}</h3>
            <ol className="rs-timeline">
              {r.timeline.map((e, i) => (
                <li key={i}>
                  <b>{e.date}</b> {render(e.event)}
                </li>
              ))}
            </ol>
          </section>
        )}
        {r.charts.map((c, i) => (
          <section key={`c${i}`} id={id(`c${i}`)} className="rs-chart">
            <h4>
              {c.title}
              {c.unit ? ` (${c.unit})` : ''}
            </h4>
            {/* built by RealmNest from numbers with a source (every text escaped) */}
            <div dangerouslySetInnerHTML={{ __html: chartSvg(c, (id) => nums.get(id)) }} />
          </section>
        ))}
        {r.disagreements.length > 0 && (
          <section id={id('disagree')}>
            <h3>{t('rs.disagree')}</h3>
            {r.disagreements.map((d, i) => (
              <div key={i} className="rs-dis">
                <b>{d.topic}</b>
                <ul>
                  {d.positions.map((p, j) => (
                    <li key={j}>{render(p)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
        {r.openQuestions.length > 0 && (
          <section id={id('open')}>
            <h3>{t('rs.open')}</h3>
            <ul>
              {r.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}
        <section id={id('sources')}>
          <h3>{t('rs.sources')}</h3>
          <SourcesList run={run} citedOnly />
        </section>
      </article>
    </div>
  );
}

export function SourcesList({ run, citedOnly }: { run: ResearchRun; citedOnly?: boolean }) {
  const t = useT();
  const nums = useMemo(() => citationNumbers(run), [run.report, run.sources.length]);
  const { open } = useCite(run);
  const list = run.sources.filter((s) => (citedOnly ? nums.has(s.id) : true)).sort((a, b) => (nums.get(a.id) ?? 999) - (nums.get(b.id) ?? 999));
  if (!list.length) return <p className="muted small">{t('rs.noSources')}</p>;
  return (
    <ol className="rs-sources">
      {list.map((s) => (
        <li key={s.id} className={s.irrelevant ? 'irrelevant' : ''}>
          <span className="rs-src-n">{nums.get(s.id) ?? '·'}</span>
          <span className="rs-src-main">
            <button type="button" className="link-btn" onClick={() => open(s)}>
              {s.title || s.domain || s.documentName || s.id}
            </button>
            <small className="muted">
              {[
                s.kind === 'web' ? s.domain : t('rs.fromKnowledge'),
                s.publishedAt,
                t(`rs.type.${s.type}` as TKey),
                s.irrelevant ? t('rs.irrelevant') : `${run.evidence.filter((e) => e.sourceId === s.id).length} ${t('rs.quotes')}`,
                s.query && `“${s.query}”`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ReportActions({ run }: { run: ResearchRun }) {
  const t = useT();
  const artifacts = useArtifacts();
  const knowledge = useKnowledge();
  const chat = useChat();
  const research = useResearch();
  const { store, files } = useServices();
  const [msg, setMsg] = useState('');
  const name = (ext: string) =>
    `${
      (run.report!.title || 'research')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
        .toLowerCase() || 'research'
    }.${ext}`;
  const asArtifact = async () => {
    const a = await artifacts.register({ name: name('html'), bytes: new TextEncoder().encode(toHtml(run, await pictureData(run, files))), mimeType: 'text/html', provenance: { origin: 'manual', runId: run.id } });
    research.markSaved(run.id, { kind: 'artifact', id: a.id });
    return a;
  };
  const run2 = (fn: () => Promise<unknown>) => void fn().catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  const discuss = () =>
    run2(async () => {
      // the report becomes a Knowledge document; a new chat answers from it with citations
      let base = knowledge.listBases().find((b) => !b.builtIn && b.name === 'Deep Research');
      if (!base) base = await knowledge.createBase({ name: 'Deep Research', description: t('rs.discussBase') });
      const doc = await knowledge.addFile(base.id, { name: name('md'), bytes: new TextEncoder().encode(toMarkdown(run)) });
      research.markSaved(run.id, { kind: 'knowledge', id: doc.id });
      await knowledge.idle();
      const c = chat.create({ connectionId: run.connectionId, ...(run.model && { model: run.model }) });
      chat.setKnowledge(c.id, { baseIds: [base.id], mode: 'grounded' });
      store.openChat(c.id);
    });
  return (
    <div className="rs-report-actions">
      <Button size="sm" tone="ghost" icon={<ExternalLink size={14} />} onClick={() => run2(async () => files.openReport(name('html'), toHtml(run, await pictureData(run, files))))}>
        {t('rs.openBrowser')}
      </Button>
      <Button size="sm" tone="ghost" icon={<FileText size={14} />} onClick={() => run2(async () => files.reportPdf(name('pdf'), toHtml(run, await pictureData(run, files))).then((p) => p && setMsg(t('rs.exported', { path: p }))))}>
        {t('rs.exportPdf')}
      </Button>
      <Button size="sm" tone="ghost" icon={<Download size={14} />} onClick={() => run2(async () => artifacts.exportCopy((await asArtifact()).id).then((p: string | null) => p && setMsg(t('rs.exported', { path: p }))))}>
        {t('rs.exportHtml')}
      </Button>
      <AddToKnowledge
        tone="ghost"
        label={t('rs.saveKnowledge')}
        add={async (baseId) => {
          const doc = await knowledge.addFile(baseId, { name: name('md'), bytes: new TextEncoder().encode(toMarkdown(run)) });
          research.markSaved(run.id, { kind: 'knowledge', id: doc.id });
        }}
      />
      <Button size="sm" tone="ghost" icon={<MessagesSquare size={14} />} onClick={discuss}>
        {t('rs.discuss')}
      </Button>
      {run.report!.openQuestions.length > 0 && (
        <Button size="sm" tone="ghost" icon={<Microscope size={14} />} onClick={() => store.openResearch({ question: `${run.question}\n\n${t('rs.digDeeperPrefix')} ${run.report!.openQuestions.join('; ')}` })}>
          {t('rs.digDeeper')}
        </Button>
      )}
      <Button size="sm" tone="ghost" icon={<Copy size={14} />} onClick={() => run2(async () => navigator.clipboard.writeText(toMarkdown(run)).then(() => setMsg(t('rs.copied'))))}>
        {t('rs.copyMd')}
      </Button>
      {msg && <small className="muted">{msg}</small>}
    </div>
  );
}
