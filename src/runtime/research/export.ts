// A finished research as Markdown (for Knowledge, copying) and as one self-contained HTML file
// (for sharing, printing to PDF): everything escaped, charts drawn here as SVG, one script of
// RealmNest's own (the contents follow the reading; allowed by its hash, nothing else can run), no
// remote resources — opening it contacts nobody.

import type { ResearchReport, ResearchRun, ResearchSource } from '../../domain/research';
import { citedLabels } from '../knowledge/grounding';
import { pictureLayout, type Picture } from './pictures';
import tocScript from './report-toc.js?raw';

/** the contents follow the reading in a browser: RealmNest's one script, allowed by its hash (the
 *  page policy and the native lock both name it: nothing else can run) */
export const TOC_SCRIPT = tocScript.trim();
export const TOC_SCRIPT_HASH = 'sha256-QA0mEiyNQK9SX/umq7jxrbUyKUx7kdkznzYDkVDGh3s=';

const MARKERS = /\[(?:[KW]\d{1,3})(?:\]\s*\[[KW]\d{1,3})*\]/g;

/** source id → its number in this report (in order of first citation) */
export function citationNumbers(run: ResearchRun): Map<string, number> {
  const order = new Map<string, number>();
  const r = run.report;
  if (!r) return order;
  const texts = [r.summary, ...r.keyFindings, ...r.sections.flatMap((s) => s.paragraphs), ...r.timeline.map((e) => e.event), ...r.disagreements.flatMap((d) => d.positions), r.verdict?.text ?? '', ...r.tables.map((t) => t.note ?? '')];
  const known = new Set(run.sources.map((s) => s.id));
  for (const t of texts) for (const l of citedLabels(t)) if (known.has(l) && !order.has(l)) order.set(l, order.size + 1);
  for (const p of r.charts.flatMap((c) => c.points)) if (known.has(p.source) && !order.has(p.source)) order.set(p.source, order.size + 1);
  return order;
}

const sourceLine = (s: ResearchSource) =>
  s.kind === 'web' ? `${s.title ?? s.domain ?? s.url} — ${s.finalUrl ?? s.url}${s.publishedAt ? ` (${s.publishedAt})` : ''}` : `${s.documentName ?? s.title ?? 'Knowledge'} (Knowledge)`;

export function toMarkdown(run: ResearchRun): string {
  const r = run.report;
  if (!r) return '';
  const nums = citationNumbers(run);
  const md = (t: string) => t.replace(MARKERS, (m) => citedLabels(m).map((l) => (nums.has(l) ? `[${nums.get(l)}]` : '')).join(''));
  const out: string[] = [`# ${r.title}`, '', `> ${run.question.replace(/\n+/g, ' ')}`, '', md(r.summary), ''];
  if (r.verdict) out.push(`**${r.verdict.label}** — ${md(r.verdict.text)}`, '');
  if (r.keyFindings.length) out.push('## Key findings', '', ...r.keyFindings.map((f) => `- ${md(f)}`), '');
  for (const s of r.sections) out.push(`## ${s.heading}`, '', ...s.paragraphs.flatMap((p) => [md(p), '']));
  for (const t of r.tables) {
    out.push(`### ${t.title}`, '', `| ${t.columns.join(' | ')} |`, `| ${t.columns.map(() => '---').join(' | ')} |`, ...t.rows.map((row) => `| ${row.map((c) => c.text.replace(/\|/g, '/')).join(' | ')} |`), '');
    if (t.note) out.push(md(t.note), '');
  }
  if (r.timeline.length) out.push('## Timeline', '', ...r.timeline.map((e) => `- **${e.date}** — ${md(e.event)}`), '');
  for (const c of r.charts) out.push(`### ${c.title}`, '', ...c.points.map((p) => `- ${p.label}: ${p.value}${c.unit ? ` ${c.unit}` : ''} [${nums.get(p.source) ?? '?'}]`), '');
  if (r.disagreements.length) out.push('## Where sources disagree', '', ...r.disagreements.flatMap((d) => [`**${d.topic}**`, ...d.positions.map((p) => `- ${md(p)}`), '']));
  if (r.openQuestions.length) out.push('## Still open', '', ...r.openQuestions.map((q) => `- ${q}`), '');
  out.push('## Sources', '', ...[...nums.entries()].map(([id, n]) => `${n}. ${sourceLine(run.sources.find((s) => s.id === id)!)}`), '');
  out.push(`_Deep Research · ${new Date(run.finishedAt ?? run.updatedAt).toISOString().slice(0, 10)} · ${run.sources.filter((s) => !s.irrelevant).length} sources · ${run.evidence.length} pieces of evidence_`);
  return out.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** a bar or line chart as inline SVG (values only from the report, each with its source number) */
export function chartSvg(c: ResearchReport['charts'][number], num: (id: string) => number | undefined): string {
  const W = 560;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 46 };
  const max = Math.max(...c.points.map((p) => p.value), 0);
  const min = Math.min(...c.points.map((p) => p.value), 0);
  const span = max - min || 1;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / span);
  const step = (W - pad.l - pad.r) / c.points.length;
  const parts: string[] = [`<line x1="${pad.l}" y1="${y(0)}" x2="${W - pad.r}" y2="${y(0)}" class="axis"/>`];
  for (const tick of [max, (max + min) / 2, min]) parts.push(`<text x="${pad.l - 6}" y="${y(tick) + 4}" text-anchor="end" class="tick">${esc(fmt(tick))}</text>`);
  if (c.kind === 'line') {
    const pts = c.points.map((p, i) => `${pad.l + step * (i + 0.5)},${y(p.value)}`).join(' ');
    parts.push(`<polyline points="${pts}" class="line"/>`);
  }
  c.points.forEach((p, i) => {
    const cx = pad.l + step * (i + 0.5);
    if (c.kind === 'bar') parts.push(`<rect x="${cx - step * 0.32}" y="${Math.min(y(p.value), y(0))}" width="${step * 0.64}" height="${Math.max(1, Math.abs(y(0) - y(p.value)))}" class="bar"/>`);
    else parts.push(`<circle cx="${cx}" cy="${y(p.value)}" r="4" class="dot"/>`);
    parts.push(`<text x="${cx}" y="${Math.min(y(p.value), y(0)) - 5}" text-anchor="middle" class="val">${esc(fmt(p.value))}${num(p.source) ? ` [${num(p.source)}]` : ''}</text>`);
    parts.push(`<text x="${cx}" y="${H - pad.b + 16}" text-anchor="middle" class="lab">${esc(p.label.slice(0, 18))}</text>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}">${parts.join('')}</svg>`;
}
const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));

/** `pictures`: the report's pictures as data: addresses (pictureData), carried inside the page */
export function toHtml(run: ResearchRun, pictures?: Map<string, string>): string {
  const r = run.report;
  if (!r) return '';
  const nums = citationNumbers(run);
  const num = (id: string) => nums.get(id);
  const text = (t: string) =>
    esc(t).replace(/\[(?:[KW]\d{1,3})(?:\]\s*\[[KW]\d{1,3})*\]/g, (m) =>
      citedLabels(m)
        .map((l) => (nums.has(l) ? `<a class="cite" href="#src-${nums.get(l)}">${nums.get(l)}</a>` : ''))
        .join(''),
    );
  const flagged = new Set((run.verification?.checks ?? []).filter((c) => c.status === 'unsupported').map((c) => c.sentence));
  const para = (t: string) => {
    let h = text(t);
    for (const s of flagged) if (t.includes(s)) h = h.replace(text(s), `<mark title="Not supported by the cited sources">${text(s)}</mark>`);
    return `<p>${h}</p>`;
  };
  const it = (run.plan?.language ?? 'en') === 'it';
  const L = it
    ? { toc: 'Indice', summary: 'Sintesi', findings: 'Punti chiave', timeline: 'Cronologia', disagree: 'Dove le fonti divergono', open: 'Ancora aperto', sources: 'Fonti', n: 'fonti', ev: 'evidenze', rounds: 'giri', round: 'giro', pic: 'Immagine da' }
    : { toc: 'Contents', summary: 'Summary', findings: 'Key findings', timeline: 'Timeline', disagree: 'Where sources disagree', open: 'Still open', sources: 'Sources', n: 'sources', ev: 'pieces of evidence', rounds: 'rounds', round: 'round', pic: 'Picture from' };
  // pictures: only RealmNest's own copies, inside the page (nothing is loaded from the sites)
  const layout = pictures?.size ? pictureLayout(run) : undefined;
  const figure = (p: Picture | undefined, cls: string) => {
    const data = p && pictures?.get(p.ref);
    if (!p || !data) return '';
    const s = run.sources.find((x) => x.id === p.sourceId);
    const n = nums.get(p.sourceId);
    return `<figure class="${cls}"><img src="${data}" alt=""${p.w && p.h ? ` width="${p.w}" height="${p.h}"` : ''}><figcaption>${L.pic} ${esc(s?.title ?? s?.domain ?? '')}${s?.domain ? ` · ${esc(s.domain)}` : ''}${n ? ` <a class="cite" href="#src-${n}">${n}</a>` : ''}</figcaption></figure>`;
  };
  const body: string[] = [];
  // the contents: every section gets an id; sub-entries (tables, charts) are indented
  const toc: { id: string; label: string; sub?: boolean }[] = [];
  const sec = (id: string, label: string, inner: string, h: 'h2' | 'h3' = 'h2', cls = '') => {
    toc.push({ id, label, ...(h === 'h3' && { sub: true }) });
    body.push(`<section id="${id}"${cls ? ` class="${cls}"` : ''}><${h}>${esc(label)}</${h}>${inner}</section>`);
  };
  body.push(`<header><div class="kind">${esc(r.verdict?.label ?? run.plan?.kind ?? 'research')}</div><h1>${esc(r.title)}</h1><p class="q">${esc(run.question)}</p><p class="meta">${esc(new Date(run.finishedAt ?? run.updatedAt).toLocaleDateString(it ? 'it-IT' : 'en-GB'))} · ${run.sources.filter((s) => !s.irrelevant).length} ${L.n} · ${run.evidence.length} ${L.ev} · ${run.round} ${run.round === 1 ? L.round : L.rounds}</p></header>`);
  if (layout) body.push(figure(layout.hero, 'hero'));
  sec('summary', L.summary, `${para(r.summary)}${r.verdict ? `<div class="verdict"><b>${esc(r.verdict.label)}</b> ${text(r.verdict.text)}</div>` : ''}`, 'h2', 'summary');
  if (r.keyFindings.length) sec('findings', L.findings, `<ul class="findings">${r.keyFindings.map((f) => `<li>${text(f)}</li>`).join('')}</ul>`);
  r.sections.forEach((s, i) => sec(`s${i + 1}`, s.heading, `${layout ? figure(layout.sections[i], 'pic') : ''}${s.paragraphs.map(para).join('')}`));
  r.tables.forEach((t, i) =>
    sec(
      `t${i + 1}`,
      t.title,
      `<table><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((row) => `<tr>${row.map((c, j) => `<${j ? 'td' : 'th'}${c.tone ? ` class="${c.tone}"` : ''}>${text(c.text)}</${j ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table>${t.note ? `<p class="note">${text(t.note)}</p>` : ''}`,
      'h3',
    ),
  );
  if (r.timeline.length) sec('timeline', L.timeline, `<ol class="timeline">${r.timeline.map((e) => `<li><b>${esc(e.date)}</b> ${text(e.event)}</li>`).join('')}</ol>`);
  r.charts.forEach((c, i) => sec(`c${i + 1}`, `${c.title}${c.unit ? ` (${c.unit})` : ''}`, chartSvg(c, num), 'h3'));
  if (r.disagreements.length) sec('disagree', L.disagree, r.disagreements.map((d) => `<div class="dis"><b>${esc(d.topic)}</b><ul>${d.positions.map((p) => `<li>${text(p)}</li>`).join('')}</ul></div>`).join(''));
  if (r.openQuestions.length) sec('open', L.open, `<ul>${r.openQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`);
  sec(
    'sources',
    L.sources,
    `<ol>${[...nums.entries()]
      .map(([id, n]) => {
        const s = run.sources.find((x) => x.id === id)!;
        const quotes = run.evidence.filter((e) => e.sourceId === id).slice(0, 3);
        const head = s.kind === 'web' ? `<a href="${esc(s.finalUrl ?? s.url ?? '')}" rel="noreferrer noopener">${esc(s.title ?? s.domain ?? '')}</a> <small>${esc(s.domain ?? '')}${s.publishedAt ? ` · ${esc(s.publishedAt)}` : ''} · ${esc(s.type)}</small>` : `${esc(s.documentName ?? 'Knowledge')} <small>Knowledge</small>`;
        return `<li id="src-${n}" value="${n}">${head}${quotes.map((q) => `<blockquote>${esc(q.quote)}${q.context ? `<small>${esc(q.context)}</small>` : ''}</blockquote>`).join('')}</li>`;
      })
      .join('')}</ol>`,
    'h2',
    'sources',
  );
  // the contents column; report-toc.js lights the part being read (class "on": a selector every browser knows)
  const nav = `<aside class="toc"><b>${L.toc}</b><nav>${toc.map((e) => `<a href="#${e.id}"${e.sub ? ' class="sub"' : ''}>${esc(e.label)}</a>`).join('')}</nav></aside>`;
  const css = `:root{--bg:#f7f5f0;--fg:#1d1f22;--mut:#666b73;--acc:#0f766e;--line:#e2ded5;--good:#dcfce7;--mixed:#fef3c7;--bad:#fee2e2}@media (prefers-color-scheme:dark){:root{--bg:#131516;--fg:#e8e6e1;--mut:#9aa0a6;--acc:#5eead4;--line:#2a2d30;--good:#14532d;--mixed:#713f12;--bad:#7f1d1d}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Georgia,'Iowan Old Style',serif}main{max-width:780px;margin:0 auto;padding:48px 24px 80px}h1,h2,h3,.kind,.meta,table,small,.cite,svg text{font-family:system-ui,'Segoe UI',sans-serif}h1{font-size:34px;line-height:1.15;margin:.2em 0}.kind{text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:var(--acc);font-weight:700}.q{color:var(--mut);font-style:italic}.meta{color:var(--mut);font-size:13px}h2{font-size:22px;margin-top:2em;border-bottom:1px solid var(--line);padding-bottom:.3em}h3{font-size:17px;margin-top:1.6em}.summary{font-size:18px}.verdict{border-left:4px solid var(--acc);padding:8px 14px;margin-top:12px}.findings li{margin:.4em 0}.cite{display:inline-block;min-width:1.4em;padding:0 .3em;margin-left:2px;border-radius:5px;background:color-mix(in srgb,var(--acc) 15%,transparent);color:var(--acc);font-size:11px;font-weight:700;text-align:center;text-decoration:none;vertical-align:super}mark{background:color-mix(in srgb,#f59e0b 25%,transparent);color:inherit}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}td.good{background:var(--good)}td.mixed{background:var(--mixed)}td.bad{background:var(--bad)}.note{font-size:13px;color:var(--mut)}.timeline{list-style:none;padding:0;border-left:2px solid var(--acc)}.timeline li{padding:4px 0 8px 14px}svg{width:100%;height:auto}svg .axis{stroke:var(--line)}svg .bar{fill:var(--acc)}svg .line{fill:none;stroke:var(--acc);stroke-width:2}svg .dot{fill:var(--acc)}svg text{font-size:11px;fill:var(--mut)}svg .val{fill:var(--fg);font-weight:600}.dis{margin:1em 0}.sources ol{padding-left:1.4em}.sources li{margin:.8em 0}.sources blockquote{margin:.3em 0;padding-left:10px;border-left:2px solid var(--line);color:var(--mut);font-size:14px}a{color:var(--acc)}@media print{body{background:#fff}main{padding:0}}.layout{display:grid;grid-template-columns:230px minmax(0,780px);gap:56px;justify-content:center;padding:0 24px}main{max-width:none;margin:0;padding:48px 0 80px}.toc{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:56px 0 24px;font-family:system-ui,'Segoe UI',sans-serif}.toc b{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:0 0 10px 12px}.toc nav{display:flex;flex-direction:column;gap:2px}.toc a{display:block;padding:6px 10px 6px 12px;border-left:2px solid transparent;border-radius:0 8px 8px 0;color:var(--mut);font-size:14px;line-height:1.35;text-decoration:none}.toc a.sub{padding-left:24px;font-size:13px}.toc a:hover{color:var(--fg);background:color-mix(in srgb,var(--acc) 7%,transparent)}.toc a.on{color:var(--acc);border-left-color:var(--acc);background:color-mix(in srgb,var(--acc) 10%,transparent);font-weight:600}html{scroll-behavior:smooth}section{scroll-margin-top:16px}section:target>h2,section:target>h3{color:var(--acc)}figure{margin:18px 0}figure img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:var(--line)}figure.hero img{max-height:420px;object-fit:cover}figure.pic img{max-height:340px;object-fit:cover}figcaption{margin-top:6px;font:12px/1.4 system-ui,'Segoe UI',sans-serif;color:var(--mut)}@media (max-width:980px){.layout{display:block}.toc{display:none}main{padding:48px 0 80px}}@media print{:root{--bg:#fff;--fg:#1d1f22;--mut:#555;--acc:#0f766e;--line:#ddd;--good:#dcfce7;--mixed:#fef3c7;--bad:#fee2e2}.toc{display:none}.layout{display:block;padding:0}main{padding:0}figure,table,blockquote,.verdict{break-inside:avoid}h2,h3{break-after:avoid}a{color:inherit}}`;
  return `<!doctype html><html lang="${esc(run.plan?.language ?? 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src '${TOC_SCRIPT_HASH}'"><title>${esc(r.title)}</title><style>${css}</style></head><body><div class="layout">${nav}<main>${body.join('\n')}<footer class="meta">RealmNest Deep Research</footer></main></div><script>${TOC_SCRIPT}</script></body></html>`;
}
