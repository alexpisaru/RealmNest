// MemoryExtractor: one short, stateless request after a run that might hold something worth
// remembering. The model gets the user's words (secrets redacted), the reply (clipped) and the
// agent's related memories, and must answer JSON matching PROPOSAL_SCHEMA: as a structured
// output when the adapter and model support it, otherwise as plain JSON text. Either way the
// answer is validated strictly: anything that does not match the schema yields no proposal.
// Then deterministic rules decide: refuse() (secrets, sensitive data, instructions, guesses)
// and classify() (new / duplicate / update / conflict against active memories).

import { MEMORY_LIMITS, MEMORY_TYPES, type MemoryConfidence, type MemoryEntry, type MemoryImportance, type MemoryType, type ProposalRelation } from '../../domain/memory';
import { stem, tokenize } from '../knowledge/search';
import { redactSecrets, refuse, type Refusal } from './policy';

export const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['memories'],
  properties: {
    memories: {
      type: 'array',
      maxItems: MEMORY_LIMITS.proposalsPerRun,
      items: {
        type: 'object',
        additionalProperties: false,
        // strict structured outputs need every field required: optional ones are empty strings / lists
        required: ['type', 'content', 'subject', 'key', 'value', 'reason', 'confidence', 'importance', 'relation', 'existing', 'tags'],
        properties: {
          type: { type: 'string', enum: [...MEMORY_TYPES] },
          content: { type: 'string', description: 'one short sentence, third person, max 300 characters' },
          subject: { type: 'string' },
          key: { type: 'string' },
          value: { type: 'string' },
          reason: { type: 'string', description: 'why it is worth remembering' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          importance: { type: 'string', enum: ['low', 'normal', 'high'] },
          relation: { type: 'string', enum: ['new', 'duplicate', 'update', 'conflict'] },
          existing: { type: 'string', description: 'the label (E1…) of the related existing memory, or ""' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        },
      },
    },
  },
} as const;

export const EXTRACT_PROMPT = `You decide what an AI agent should remember about its user from one exchange, for future conversations.
Propose at most ${MEMORY_LIMITS.proposalsPerRun} memories, and usually none. Propose only what the USER said that will still be true and useful later:
stable preferences, project decisions, constraints, workflow preferences, stable facts (names, tools, stacks), useful relationships.
Never propose: greetings, small talk, moods, one-off or temporary requests, progress of the current task, document or web page contents, guesses or anything only the assistant said,
passwords, keys, tokens or other secrets, health, religion, politics, sex life, precise locations, ID or bank numbers, or instructions about how the AI must behave in general.
Write each memory as one short neutral sentence in the user's language (e.g. "Project reports should be written in Italian.").
Compare with the existing memories listed: "duplicate" if one already says the same, "update" if the user explicitly changed it, "conflict" if it contradicts one without saying so, else "new"; put that memory's label (E1…) in "existing", or "" when new.
Answer with JSON only, no prose, exactly: {"memories":[{"type":"preference","content":"…","subject":"…","key":"…","value":"…","reason":"…","confidence":"high","importance":"normal","relation":"new","existing":"","tags":[]}]}
Types: ${MEMORY_TYPES.join(', ')}. If nothing is worth remembering answer {"memories":[]}.`;

export interface ExtractionInput {
  /** what the user wrote in this run (and the one or two messages before it, for context) */
  userTexts: string[];
  answer: string;
  existing: MemoryEntry[];
  agentName?: string;
}

export function extractionMessage(i: ExtractionInput): { text: string; labels: Map<string, string> } {
  const labels = new Map<string, string>();
  const existing = i.existing.slice(0, 8).map((e, n) => {
    labels.set(`E${n + 1}`, e.id);
    return `E${n + 1} [${e.type}] ${e.content.slice(0, 200)}`;
  });
  const user = i.userTexts.map((t) => redactSecrets(t).slice(0, 2_000)).join('\n---\n');
  const text = [`USER:\n${user}`, `ASSISTANT${i.agentName ? ` (${i.agentName})` : ''}:\n${redactSecrets(i.answer).slice(0, 1_500)}`, `EXISTING MEMORIES:\n${existing.join('\n') || '(none)'}`].join('\n\n');
  return { text, labels };
}

export interface RawProposal {
  type: MemoryType;
  content: string;
  subject?: string;
  key?: string;
  value?: string;
  reason: string;
  confidence: MemoryConfidence;
  importance: MemoryImportance;
  relation: ProposalRelation;
  existing: string;
  tags: string[];
}

export class ExtractionError extends Error {}

const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

/**
 * Strict validation of the model's answer. Only a ```json fence around the object is tolerated;
 * any other prose, an extra field or a wrong value rejects the whole answer.
 */
export function parseProposals(raw: string): RawProposal[] {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(t);
  if (fence) t = fence[1].trim();
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    throw new ExtractionError('The answer is not JSON.');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ExtractionError('The answer is not a JSON object.');
  const keys = Object.keys(v);
  if (keys.length !== 1 || keys[0] !== 'memories' || !Array.isArray((v as { memories: unknown }).memories)) throw new ExtractionError('The answer must be {"memories": [...]}.');
  const list = (v as { memories: unknown[] }).memories;
  if (list.length > MEMORY_LIMITS.proposalsPerRun) throw new ExtractionError('Too many memories proposed.');
  const allowed = new Set(['type', 'content', 'subject', 'key', 'value', 'reason', 'confidence', 'importance', 'relation', 'existing', 'tags']);
  return list.map((x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw new ExtractionError('A memory is not an object.');
    const o = x as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!allowed.has(k)) throw new ExtractionError(`Unknown field "${k.slice(0, 20)}".`);
    if (!(MEMORY_TYPES as readonly string[]).includes(o.type as string)) throw new ExtractionError('Unknown memory type.');
    if (!str(o.content, 400) || !(o.content as string).trim()) throw new ExtractionError('Invalid content.');
    if (!str(o.reason, 400)) throw new ExtractionError('Invalid reason.');
    if (!['low', 'medium', 'high'].includes(o.confidence as string)) throw new ExtractionError('Invalid confidence.');
    if (!['low', 'normal', 'high'].includes(o.importance as string)) throw new ExtractionError('Invalid importance.');
    if (!['new', 'duplicate', 'update', 'conflict'].includes(o.relation as string)) throw new ExtractionError('Invalid relation.');
    if (!str(o.existing, 8)) throw new ExtractionError('Invalid existing label.');
    for (const k of ['subject', 'key', 'value'] as const) if (o[k] !== undefined && !str(o[k], 120)) throw new ExtractionError(`Invalid ${k}.`);
    if (o.tags !== undefined && (!Array.isArray(o.tags) || o.tags.length > 4 || o.tags.some((t) => !str(t, 32)))) throw new ExtractionError('Invalid tags.');
    return {
      type: o.type as MemoryType,
      content: (o.content as string).trim(),
      ...(typeof o.subject === 'string' && o.subject.trim() && { subject: o.subject.trim() }),
      ...(typeof o.key === 'string' && o.key.trim() && { key: o.key.trim() }),
      ...(typeof o.value === 'string' && o.value.trim() && { value: o.value.trim() }),
      reason: o.reason as string,
      confidence: o.confidence as MemoryConfidence,
      importance: o.importance as MemoryImportance,
      relation: o.relation as ProposalRelation,
      existing: o.existing as string,
      tags: ((o.tags as string[] | undefined) ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    };
  });
}

/** words that change the tone, not the content ("should" / "must" / "always") */
const FILLER = new Set(['should', 'must', 'shall', 'would', 'could', 'can', 'need', 'need', 'always', 'please', 'user', 'prefer', 'prefers', 'like', 'deve', 'devono', 'sempre', 'utente', 'preferisce'].map(stem));
const words = (s: string) => new Set(tokenize(s).filter((t) => !FILLER.has(t)));

/** word overlap (stemmed, stop and filler words out): 1 = the same words */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (x.size + y.size - both);
}

const CHANGE = /\b(actually|instead|from now on|no longer|not anymore|changed?|switch(ed)? to|now (use|prefer)|in realta|invece|d'ora in poi|non piu|cambia\w*|adesso (usa|preferisco))\b/i;
const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The relation decided by RealmNest: an exact or near-identical memory is a duplicate whatever the
 * model said; the model's update / conflict counts only with a real existing label; a change of
 * an existing memory is an "update" when the user said so, else a "conflict".
 */
export function classify(p: Pick<RawProposal, 'content' | 'subject' | 'key' | 'value' | 'relation' | 'existing' | 'type'>, labels: Map<string, string>, existing: MemoryEntry[], userText: string): { relation: ProposalRelation; existingId?: string } {
  const sims = existing.map((e) => ({ e, s: similarity(p.content, e.content) })).sort((a, b) => b.s - a.s);
  const best = sims[0];
  if (best && best.s >= 0.75) return { relation: 'duplicate', existingId: best.e.id };
  const changed = CHANGE.test(fold(userText));
  // same subject + key, another value: the same thing said differently
  const sameKey = p.subject && p.key ? existing.find((e) => e.subject && e.key && fold(e.subject) === fold(p.subject!) && fold(e.key) === fold(p.key!)) : undefined;
  if (sameKey) {
    if (p.value && sameKey.value && fold(p.value) === fold(sameKey.value)) return { relation: 'duplicate', existingId: sameKey.id };
    return { relation: changed ? 'update' : 'conflict', existingId: sameKey.id };
  }
  const id = p.existing ? labels.get(p.existing.toUpperCase()) : undefined;
  if (id && p.relation !== 'new') {
    if (p.relation === 'duplicate') return { relation: 'duplicate', existingId: id };
    return { relation: changed ? 'update' : 'conflict', existingId: id };
  }
  return { relation: 'new' };
}

export interface ExtractedProposal extends RawProposal {
  existingId?: string;
}

/** the model's answer → proposals that may reach the user, and what was dropped (with why) */
export function screen(raw: RawProposal[], labels: Map<string, string>, existing: MemoryEntry[], userText: string): { keep: ExtractedProposal[]; dropped: { content: string; why: Refusal | 'duplicate' }[] } {
  const keep: ExtractedProposal[] = [];
  const dropped: { content: string; why: Refusal | 'duplicate' }[] = [];
  for (const r of raw) {
    const no = refuse(r.content, userText);
    if (no) {
      dropped.push({ content: no.why === 'secret' ? '[redacted]' : r.content.slice(0, 80), why: no.why });
      continue;
    }
    const c = classify(r, labels, existing, userText);
    // the same thing twice in one answer
    if (keep.some((k) => similarity(k.content, r.content) >= 0.75)) {
      dropped.push({ content: r.content.slice(0, 80), why: 'duplicate' });
      continue;
    }
    keep.push({ ...r, relation: c.relation, ...(c.existingId && { existingId: c.existingId }) });
  }
  return { keep, dropped };
}
