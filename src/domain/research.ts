// ─────────────────────────────────────────────────────────────
// Deep Research (docs/DEEP_RESEARCH.md): a question → an approved plan of sub-questions →
// rounds of search (the chosen provider's own web search) and reading (the Web layer, Knowledge)
// → an evidence ledger of verbatim quotes → a structured report whose every [W3] / [K1] points
// to a source the run read, checked against the quotes.
//
// Sources: W1… (web pages read), K1… (Knowledge passages). Evidence: E1… (a claim + its exact
// quote from one source). Nothing in a report is HTML: RealmNest renders it.
// ─────────────────────────────────────────────────────────────

import type { GroundingReport } from './knowledge';

export type ResearchPreset = 'quick' | 'standard' | 'deep';

export interface ResearchBudget {
  /** search-and-read rounds */
  rounds: number;
  /** searches in the whole run */
  searches: number;
  /** pages read in one round */
  pagesPerRound: number;
  /** pages read in the whole run */
  pages: number;
  /** wall-clock minutes before writing starts anyway */
  minutes: number;
  /** model tokens (in + out) for the whole run; writing still happens */
  tokens: number;
}

export const RESEARCH_PRESETS: Record<ResearchPreset, ResearchBudget> = {
  quick: { rounds: 2, searches: 8, pagesPerRound: 6, pages: 12, minutes: 6, tokens: 250_000 },
  standard: { rounds: 4, searches: 14, pagesPerRound: 8, pages: 24, minutes: 15, tokens: 700_000 },
  deep: { rounds: 7, searches: 30, pagesPerRound: 10, pages: 50, minutes: 35, tokens: 1_600_000 },
};

export type ReportKind = 'general' | 'product' | 'comparison' | 'howto' | 'factcheck' | 'timeline' | 'landscape';
export const REPORT_KINDS: ReportKind[] = ['general', 'product', 'comparison', 'howto', 'factcheck', 'timeline', 'landscape'];

export interface SubQuestion {
  /** Q1, Q2… */
  id: string;
  text: string;
  /** what would answer it (shown in the plan, used by the reader) */
  lookFor?: string;
  /** short phrases a document answering it would contain, in English and the user's language
   *  (Knowledge search: the user's documents may not be in the language of the question) */
  terms?: string[];
  coverage: 'open' | 'thin' | 'covered';
}

export interface ResearchPlan {
  title: string;
  kind: ReportKind;
  /** the language the report is written in (the user's) */
  language: string;
  subQuestions: SubQuestion[];
}

export type SourceType = 'primary' | 'secondary' | 'opinion' | 'unknown';

export interface ResearchSource {
  /** W1… for web pages, K1… for Knowledge passages */
  id: string;
  kind: 'web' | 'knowledge';
  title?: string;
  /** web */
  url?: string;
  finalUrl?: string;
  domain?: string;
  publishedAt?: string;
  fetchedAt?: number;
  method?: string;
  /** the search that found it, and with what */
  query?: string;
  engine?: string;
  /** knowledge */
  baseId?: string;
  documentId?: string;
  documentName?: string;
  chunkId?: string;
  /** sha256 of the text read (web) or the chunk hash (knowledge) */
  hash?: string;
  type: SourceType;
  /** read but nothing relevant was found */
  irrelevant?: boolean;
  /** the page's preview picture (og:image), kept by RealmNest in its file store (never loaded
   *  from the site when the report is shown) */
  image?: SourceImage;
}

export interface SourceImage {
  /** where the page said it is */
  url: string;
  /** the kept copy (content-addressed: the same picture on two pages is one file) */
  ref?: string;
  w?: number;
  h?: number;
}

export interface Evidence {
  /** E1… */
  id: string;
  sourceId: string;
  subQuestionIds: string[];
  claim: string;
  /** verbatim from the source (checked when it was stored) */
  quote: string;
  /** verbatim snippets near the quote holding the claim's numbers the quote lacks (a price in a
   *  product box, a date in a header), found by RealmNest in the page, never written by the model */
  context?: string;
}

export interface ResearchEvent {
  at: number;
  phase: 'clarify' | 'plan' | 'search' | 'read' | 'extract' | 'knowledge' | 'coverage' | 'write' | 'verify' | 'done' | 'warning' | 'error' | 'cancel' | 'resume';
  message: string;
  /** round number, url, query… */
  data?: Record<string, string | number>;
}

export interface ReportCell {
  text: string;
  /** a typed judgement for colouring (never inferred from words) */
  tone?: 'good' | 'mixed' | 'bad';
}

export interface ReportSection {
  heading: string;
  /** paragraphs with [W3] / [K1] markers */
  paragraphs: string[];
}

export interface ResearchReport {
  title: string;
  /** 2–4 sentences with markers */
  summary: string;
  keyFindings: string[];
  sections: ReportSection[];
  tables: { title: string; columns: string[]; rows: ReportCell[][]; note?: string }[];
  timeline: { date: string; event: string }[];
  /** numeric series drawn by RealmNest; every value with its source */
  charts: { title: string; kind: 'bar' | 'line'; unit?: string; points: { label: string; value: number; source: string }[] }[];
  disagreements: { topic: string; positions: string[] }[];
  openQuestions: string[];
  /** factcheck: supported / mixed / unsupported; product, comparison: the pick */
  verdict?: { label: string; text: string };
}

export interface SentenceCheck {
  /** where: "summary", "finding 2", "section 3 ¶1" */
  where: string;
  sentence: string;
  status: 'supported' | 'partial' | 'unsupported' | 'uncited';
  note?: string;
}

export interface ResearchVerification {
  lexical: GroundingReport;
  /** model check of cited sentences against their quotes */
  checks: SentenceCheck[];
  /** markers that point to no source of this run */
  invalidMarkers: string[];
}

export type ResearchStatus = 'clarifying' | 'planning' | 'awaiting_plan' | 'running' | 'writing' | 'verifying' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export interface ResearchUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

export interface ResearchRun {
  id: string;
  question: string;
  /** the question plus the user's answers to the clarifying questions */
  brief: string;
  clarifyingQuestions?: string[];
  owner: { kind: 'user' } | { kind: 'agent'; agentId: string; runId?: string };
  connectionId: string;
  /** planner and writer */
  model?: string;
  /** reads pages and extracts evidence */
  readerModel?: string;
  preset: ResearchPreset;
  budget: ResearchBudget;
  knowledgeBaseIds: string[];
  /** search the web with the connection's own search */
  web: boolean;
  status: ResearchStatus;
  plan?: ResearchPlan;
  round: number;
  queries: { round: number; text: string; subQuestionId?: string; results: number; error?: string }[];
  sources: ResearchSource[];
  evidence: Evidence[];
  report?: ResearchReport;
  verification?: ResearchVerification;
  usage: ResearchUsage;
  events: ResearchEvent[];
  error?: string;
  /** why the rounds stopped */
  stopReason?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** saved elsewhere (Knowledge document, Artifact) */
  savedTo?: { kind: 'knowledge' | 'artifact'; id: string; at: number }[];
  /** the user's picture choices in the report: slot ("hero", "s2") → a source id, or null (none) */
  pictures?: Record<string, string | null>;
  /** sources whose picture the user hid: never placed again in this report */
  picturesHidden?: string[];
}

export const RESEARCH_LIMITS = {
  runs: 60,
  events: 400,
  quoteChars: 600,
  claimChars: 400,
  /** page text the reader sees */
  pageChars: 14_000,
  evidencePerSource: 8,
  /** evidence entries the writer sees */
  writerEvidence: 160,
  /** preview pictures kept per run */
  pictures: 16,
};

export const isActive = (s: ResearchStatus) => s === 'clarifying' || s === 'planning' || s === 'running' || s === 'writing' || s === 'verifying';
