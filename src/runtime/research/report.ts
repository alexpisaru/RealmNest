// The writer's JSON → a ResearchReport with only known shapes and capped sizes, and the checks:
// every [W3] / [K1] must be a source of this run; numbers and codes in a cited sentence must
// appear in that source's quotes (lexical); cited sentences are then judged by a model.

import type { GroundingReport } from '../../domain/knowledge';
import type { Evidence, ReportCell, ResearchReport, ResearchSource, SentenceCheck } from '../../domain/research';
import { appears, citedLabels, factsOf, sentencesOf } from '../knowledge/grounding';
import { arr, str } from './json';

const tone = (v: unknown): ReportCell['tone'] => (v === 'good' || v === 'mixed' || v === 'bad' ? v : undefined);

/** the writer's JSON, cleaned (unknown fields dropped, lengths capped); undefined when unusable */
export function cleanReport(raw: Record<string, unknown> | undefined, fallbackTitle: string, sourceIds: Set<string>): ResearchReport | undefined {
  if (!raw) return undefined;
  const sections = arr(raw.sections, 20)
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return { heading: str(o.heading, 160), paragraphs: arr(o.paragraphs, 12).map((p) => str(p, 3000)).filter(Boolean) };
    })
    .filter((s) => s.heading || s.paragraphs.length);
  const summary = str(raw.summary, 1500);
  if (!summary && !sections.length) return undefined;
  const verdict = raw.verdict && typeof raw.verdict === 'object' ? { label: str((raw.verdict as Record<string, unknown>).label, 140), text: str((raw.verdict as Record<string, unknown>).text, 800) } : undefined;
  return {
    title: str(raw.title, 160) || fallbackTitle,
    summary,
    keyFindings: arr(raw.keyFindings, 12).map((f) => str(f, 600)).filter(Boolean),
    sections,
    tables: arr(raw.tables, 6)
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const columns = arr(o.columns, 8).map((c) => str(c, 80));
        const rows = arr(o.rows, 30).map((r) =>
          arr(r, columns.length || 8).map((c): ReportCell => {
            const cell = (c && typeof c === 'object' ? c : { text: c }) as Record<string, unknown>;
            const t2 = tone(cell.tone);
            return { text: str(cell.text, 300), ...(t2 && { tone: t2 }) };
          }),
        );
        return { title: str(o.title, 160), columns, rows, ...(str(o.note, 300) && { note: str(o.note, 300) }) };
      })
      .filter((t) => t.columns.length && t.rows.length),
    timeline: arr(raw.timeline, 40)
      .map((e) => {
        const o = (e ?? {}) as Record<string, unknown>;
        return { date: str(o.date, 40), event: str(o.event, 500) };
      })
      .filter((e) => e.date && e.event),
    charts: arr(raw.charts, 4)
      .map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        const points = arr(o.points, 24)
          .map((p) => {
            const q = (p ?? {}) as Record<string, unknown>;
            const value = typeof q.value === 'number' ? q.value : Number(String(q.value ?? '').replace(',', '.'));
            return { label: str(q.label, 80), value, source: str(q.source, 8).toUpperCase() };
          })
          // a point without a real source of this run is not drawn
          .filter((p) => p.label && Number.isFinite(p.value) && sourceIds.has(p.source));
        return { title: str(o.title, 160), kind: o.kind === 'line' ? ('line' as const) : ('bar' as const), ...(str(o.unit, 16) && { unit: str(o.unit, 16) }), points };
      })
      .filter((c) => c.points.length >= 2),
    disagreements: arr(raw.disagreements, 8)
      .map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return { topic: str(o.topic, 200), positions: arr(o.positions, 6).map((p) => str(p, 600)).filter(Boolean) };
      })
      .filter((d) => d.topic && d.positions.length),
    openQuestions: arr(raw.openQuestions, 10).map((q) => str(q, 400)).filter(Boolean),
    ...(verdict?.label && { verdict }),
  };
}

/** every place of the report that holds sentences, labelled for the checks */
export function reportTexts(r: ResearchReport): { where: string; text: string }[] {
  return [
    { where: 'summary', text: r.summary },
    ...r.keyFindings.map((t, i) => ({ where: `finding ${i + 1}`, text: t })),
    ...r.sections.flatMap((s, i) => s.paragraphs.map((p, j) => ({ where: `section ${i + 1} ¶${j + 1}`, text: p }))),
    ...r.timeline.map((e, i) => ({ where: `timeline ${i + 1}`, text: e.event })),
    ...r.disagreements.flatMap((d, i) => d.positions.map((p, j) => ({ where: `disagreement ${i + 1}.${j + 1}`, text: p }))),
    ...(r.verdict ? [{ where: 'verdict', text: r.verdict.text }] : []),
  ].filter((x) => x.text);
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[‐-―−]/g, '-')
    // 4,57 and 4.57 are the same number
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim();

/** a quote really is in the text (whitespace, quotes, dashes and accents aside) */
export function quoteIn(quote: string, text: string): boolean {
  const q = fold(quote);
  if (q.length < 12) return false;
  return fold(text).includes(q);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** where a quote starts in the raw page (its first words, any spacing), or -1 */
function anchorOf(quote: string, body: string): number {
  const words = quote.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return -1;
  return body.search(new RegExp(words.map(escapeRe).join('\\s+'), 'i'));
}

/** every place a fact is written in the raw page (decimal comma or point, no thousands separator) */
function placesOf(fact: string, body: string): { at: number; len: number }[] {
  const numeric = /^\d+(?:[.,]\d+)*$/.test(fact);
  const variants = numeric ? [...new Set([fact, fact.replace(/,/g, '.'), fact.replace(/\./g, ','), fact.replace(/[.,]/g, '')])] : [fact];
  const out: { at: number; len: number }[] = [];
  for (const v of variants)
    for (const m of body.matchAll(new RegExp(numeric ? `(?<![\\d.,])${escapeRe(v)}(?![\\d]|[.,]\\d)` : escapeRe(v), 'gi'))) out.push({ at: m.index!, len: m[0].length });
  return out;
}

/** the claim's numbers and codes its quote lacks, each with a verbatim snippet of the page around
 *  its occurrence nearest the quote (a price in a product box, a date in a header). Facts the page
 *  does not hold are left out: the claim may have reworded them (a date, a unit), and the writer
 *  takes numbers only from quotes and context. */
export function claimContext(claim: string, quote: string, body: string): string | undefined {
  const q = fold(quote);
  const missing = factsOf(claim).filter((f) => !appears(fold(f), q));
  if (!missing.length) return undefined;
  const anchor = anchorOf(quote, body);
  const spans: [number, number][] = [];
  for (const f of missing) {
    const places = placesOf(f, body);
    if (!places.length) continue;
    const best = anchor < 0 ? places[0] : places.reduce((a, b) => (Math.abs(b.at - anchor) < Math.abs(a.at - anchor) ? b : a));
    let from = Math.max(0, best.at - 90);
    let to = Math.min(body.length, best.at + best.len + 90);
    // whole words at both ends
    while (from > 0 && !/\s/.test(body[from - 1]) && best.at - from < 130) from--;
    while (to < body.length && !/\s/.test(body[to]) && to - best.at < 150) to++;
    spans.push([from, to]);
  }
  if (!spans.length) return undefined;
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const text = merged.map(([a, b]) => `${a > 0 ? '…' : ''}${body.slice(a, b).replace(/\s+/g, ' ').trim()}${b < body.length ? '…' : ''}`).join(' ');
  return text.slice(0, 500);
}

const wordsOf = (s: string) => new Set(fold(s).match(/\p{L}{4,}/gu) ?? []);

/** the quotes that bear on a sentence most (its facts first, then shared words), best first */
function closest(sentence: string, quotes: string[], facts: string[], n: number): string[] {
  if (quotes.length <= n) return quotes;
  const words = wordsOf(sentence);
  const score = (q: string) => {
    const hay = fold(q);
    let s = facts.filter((f) => appears(fold(f), hay)).length * 5;
    for (const w of wordsOf(q)) if (words.has(w)) s++;
    return s;
  };
  return quotes
    .map((q, i) => ({ q, i, s: score(q) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.q);
}

/** the lexical check over the whole report; sentences to give the model for the semantic check */
export function lexicalCheck(
  r: ResearchReport,
  sources: ResearchSource[],
  evidence: Evidence[],
): { report: GroundingReport; checks: SentenceCheck[]; invalidMarkers: string[]; toJudge: { where: string; sentence: string; quotes: string[] }[] } {
  const known = new Set(sources.map((s) => s.id));
  const quotesOf = (id: string) => evidence.filter((e) => e.sourceId === id).flatMap((e) => (e.context ? [e.quote, e.context] : [e.quote]));
  const report: GroundingReport = { sentences: 0, cited: 0, uncitedFactual: 0, lexicallySupported: 0, lexicalMismatch: 0, declaredUnsupported: false, verdict: 'not-checked' };
  const checks: SentenceCheck[] = [];
  const invalid = new Set<string>();
  const toJudge: { where: string; sentence: string; quotes: string[] }[] = [];
  for (const { where, text } of reportTexts(r))
    for (const sentence of sentencesOf(text)) {
      report.sentences++;
      const labels = citedLabels(sentence);
      for (const l of labels) if (!known.has(l)) invalid.add(l);
      const cited = labels.filter((l) => known.has(l));
      const facts = factsOf(sentence);
      if (!cited.length) {
        if (facts.length) {
          report.uncitedFactual++;
          checks.push({ where, sentence, status: 'uncited', note: 'facts without a source' });
        }
        continue;
      }
      report.cited++;
      const quotes = cited.flatMap(quotesOf);
      // what the source itself says around its quotes: its title and date (a version or a year often lives there)
      const meta = cited.map((id) => sources.find((s) => s.id === id)).map((s) => [s?.title, s?.publishedAt, s?.documentName].filter(Boolean).join(' · '));
      const hay = fold([...quotes, ...meta].join('\n'));
      const missing = facts.filter((f) => !appears(fold(f), hay));
      if (missing.length) {
        report.lexicalMismatch++;
        checks.push({ where, sentence, status: 'partial', note: `not in the cited quotes: ${missing.slice(0, 4).join(', ')}` });
      } else report.lexicallySupported++;
      toJudge.push({ where, sentence, quotes: closest(sentence, quotes, facts, 6) });
    }
  report.verdict = !report.cited ? (report.uncitedFactual ? 'unsupported' : 'not-checked') : report.lexicalMismatch || report.uncitedFactual ? (report.lexicallySupported ? 'partially-supported' : 'unsupported') : 'supported';
  return { report, checks, invalidMarkers: [...invalid], toJudge };
}
