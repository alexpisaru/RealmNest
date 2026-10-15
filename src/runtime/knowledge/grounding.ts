// Citations and grounding, deterministic.
//
//   [K3], [K1, K3], [K1][K2]   labels the model wrote → resolved against what THIS run retrieved
//   [W2]                        the same for web pages the run read (docs/WEB.md): each family
//                               resolves only against its own sources, and a sentence cited with
//                               the other family is not "uncited" for this one
//   a label it was never given  → invalid (recorded, never shown as a source)
//   GroundingVerifier           → a conservative lexical check, not semantic proof:
//                                 cited sentences' numbers and codes must appear in the cited
//                                 sources; factual sentences without a citation are counted.

import type { Citation, GroundingReport, KnowledgeMode, RetrievedSource } from '../../domain/knowledge';

/** [K3], [W2], [K1, W3], and the full-width 【K3】 some models write */
export const CITATION_LABELS = /[[【]\s*([KW]\d{1,3}(?:\s*[,;，、]\s*[KW]\d{1,3})*)\s*[\]】]/gi;
const LABELS = CITATION_LABELS;
const SEP = /[,;，、]/;

/** every label written, in order of first appearance (only one family when `prefix` is given) */
export function citedLabels(text: string, prefix?: 'K' | 'W'): string[] {
  const out: string[] = [];
  for (const m of stripCode(text).matchAll(LABELS)) for (const l of m[1].split(SEP)) out.push(l.trim().toUpperCase());
  return [...new Set(out)].filter((l) => !prefix || l.startsWith(prefix));
}

/** fenced and inline code is not prose: labels and facts inside it are ignored */
const stripCode = (t: string) => t.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');

const excerptOf = (text: string, n = 280) => {
  const t = text.replace(/^\[[^\]\n]*\]\n/, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** resolve labels to the run's sources: [K3] → citation 1, …; unknown labels are invalid */
export function resolveCitations(text: string, retrieved: Map<string, RetrievedSource>): { citations: Citation[]; invalidLabels: string[] } {
  const citations: Citation[] = [];
  const invalidLabels: string[] = [];
  for (const label of citedLabels(text, 'K')) {
    const s = retrieved.get(label);
    if (!s) {
      invalidLabels.push(label);
      continue;
    }
    citations.push({ n: citations.length + 1, label, chunkId: s.chunkId, documentId: s.documentId, knowledgeBaseId: s.knowledgeBaseId, documentName: s.documentName, location: s.location, excerpt: excerptOf(s.text) });
  }
  return { citations, invalidLabels };
}

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** numbers (4.2, 4,2, 2027, 3rd) and codes (NX-74291, v2.3.1): what a sentence claims precisely */
export function factsOf(sentence: string): string[] {
  const s = fold(sentence.replace(LABELS, ' '));
  const out = new Set<string>();
  for (const m of s.matchAll(/[\p{L}\p{N}]+(?:[-_./:][\p{L}\p{N}]+)+|\d+(?:[.,]\d+)*/gu)) {
    const t = m[0].replace(/[.,:]+$/, '');
    if (!/\d/.test(t)) continue;
    // list markers and single digits say too little to check
    if (/^\d$/.test(t)) continue;
    out.add(t);
  }
  return [...out];
}

/** a fact appears in a text (decimal comma and point are the same; thousands separators ignored;
 *  a score or ratio like 65/100 may be written "65 points out of 100") */
export function appears(fact: string, haystack: string): boolean {
  if (haystack.includes(fact)) return true;
  if (/^\d+(?:[.,]\d+)*$/.test(fact)) {
    const variants = new Set([fact.replace(/,/g, '.'), fact.replace(/\./g, ','), fact.replace(/[.,]/g, '')]);
    for (const v of variants) if (v.length > 1 && new RegExp(`(^|[^\\d])${v.replace(/[.]/g, '\\.')}($|[^\\d])`).test(haystack.replace(/(\d)[ ' ](\d{3})/g, '$1$2'))) return true;
  }
  if (/^\d+(?:[.,]\d+)?\/\d+$/.test(fact)) return fact.split('/').every((p) => appears(p, haystack));
  return false;
}

const DECLINE = [
  /\b(sources?|documents?|knowledge( base)?|provided (?:texts?|material))\b[^.]{0,60}\b(do(?:es)? not|don't|doesn't|did not)\s+(contain|include|mention|say|cover|state|specify)/i,
  /\b(not|no)\b[^.]{0,30}\b(found|mentioned|present|stated|covered)\b[^.]{0,40}\b(sources?|documents?|knowledge)\b/i,
  /\b(fonti|documenti|knowledge|base di conoscenza)\b[^.]{0,60}\bnon\s+(contengono|contiene|riportano|riporta|indicano|indica|menzionano|parlano|specificano)/i,
  /\bnon\s+(è|e'|risulta|trovo|ho trovato|compare|viene)\b[^.]{0,60}\b(fonti|documenti|knowledge)\b/i,
];

/** sentences of prose (code, headings markers and list bullets dropped) */
export function sentencesOf(text: string): string[] {
  return stripCode(text)
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, '').trim())
    .filter(Boolean)
    .flatMap((l) => l.split(/(?<=[.!?…])\s+(?=[\p{Lu}\d"“(\[])/u))
    .map((s) => s.trim())
    .filter((s) => s.replace(LABELS, '').replace(/[\s\p{P}]/gu, '').length >= 3);
}

/**
 * The GroundingVerifier. `retrieved`: the run's sources; the answer's citations resolve against
 * them. Conservative: it can say a number is missing from a cited source, never that a claim is true.
 */
export function verifyGrounding(text: string, retrieved: Map<string, Pick<RetrievedSource, 'text'>>, mode: KnowledgeMode, prefix: 'K' | 'W' = 'K'): GroundingReport {
  const sentences = sentencesOf(text);
  const report: GroundingReport = { sentences: sentences.length, cited: 0, uncitedFactual: 0, lexicallySupported: 0, lexicalMismatch: 0, declaredUnsupported: false, verdict: 'not-checked' };
  // a short answer that says the sources do not have it (a long one may only be explaining a rule)
  report.declaredUnsupported = sentences.length <= 3 && DECLINE.some((r) => r.test(text));
  if (!retrieved.size) {
    report.verdict = 'no-sources';
    // nothing was retrieved: a factual answer cannot be grounded
    for (const s of sentences) if (factsOf(s).length && !citedLabels(s).some((l) => !l.startsWith(prefix))) report.uncitedFactual++;
    if (report.declaredUnsupported && !report.uncitedFactual) report.verdict = 'declined';
    return report;
  }
  for (const s of sentences) {
    const labels = citedLabels(s, prefix).filter((l) => retrieved.has(l));
    const facts = factsOf(s);
    // backed by the other family ([W] for Knowledge, [K] for Web): that check is not this one's
    if (!labels.length && citedLabels(s).some((l) => !l.startsWith(prefix))) continue;
    if (!labels.length) {
      if (facts.length) report.uncitedFactual++;
      continue;
    }
    report.cited++;
    const haystack = fold(labels.map((l) => retrieved.get(l)!.text).join('\n'));
    const missing = facts.filter((f) => !appears(f, haystack));
    if (missing.length) report.lexicalMismatch++;
    else report.lexicallySupported++;
  }
  if (!report.cited) {
    if (report.declaredUnsupported && !report.uncitedFactual) report.verdict = 'declined';
    else if (report.uncitedFactual || mode === 'strict') report.verdict = sentences.length ? 'unsupported' : 'not-checked';
    else report.verdict = 'not-checked';
  } else if (report.lexicalMismatch || report.uncitedFactual) report.verdict = report.lexicallySupported ? 'partially-supported' : 'unsupported';
  else report.verdict = 'supported';
  return report;
}

/** replace [K3] by the answer's own numbers [1] for display (invalid labels are marked) */
export function displayCitations(text: string, citations: Citation[]): string {
  const n = new Map(citations.map((c) => [c.label, c.n]));
  return text.replace(LABELS, (_all, inner: string) => {
    const parts = inner.split(SEP).map((l) => l.trim().toUpperCase());
    return parts.map((l) => (n.has(l) ? `[${n.get(l)}]` : `[?${l}]`)).join('');
  });
}
