// What may become a memory, decided deterministically before and after a model is asked.
//
//   eligible(run)      cheap filter: no extraction call for greetings, small talk, one-off
//                      requests ("remind me in five minutes") or messages with no durable cue
//   redactSecrets      keys, tokens, passwords, card / IBAN numbers never reach the extractor
//   refuse(proposal)   secrets, sensitive personal data (health, religion, politics, sex life,
//                      precise location, private identifiers, financial credentials), text
//                      that reads like an instruction to the model, or facts the user never said
//
// Conservative on purpose: a missed memory costs a sentence; a wrong one leaks or misleads.
// docs/MEMORY.md › Privacy.

import { tokenize } from '../knowledge/search';

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** phrases that say something should last (en + it) */
const DURABLE = [
  /\bfrom now on\b/, /\bgoing forward\b/, /\bfrom here on\b/, /\b(always|never)\b/, /\bby default\b/, /\bevery time\b/, /\bremember\b/, /\bkeep in mind\b/, /\bnote that\b/,
  /\bi (really )?(prefer|like|love|hate|dislike|want|need|use)\b/, /\bmy (preferred|favou?rite)\b/, /\bplease (use|write|answer|reply|keep|avoid)\b/,
  /\b(we|our team|our company) (use|uses|chose|decided|prefer|work)\b/, /\b(we've|we have) decided\b/, /\bdecided\b/, /\bdecision\b/, /\bis (called|named)\b/, /\b(uses|runs on|is built (on|with))\b/,
  /\bour (project|company|team|server|client|product|repo|database|stack|deadline)\b/, /\bmy (project|company|team|client|role|job|manager|deadline)\b/, /\bactually\b/, /\binstead\b/, /\bfor project\b/, /\bproject [a-z0-9]+ (uses|is|runs)\b/,
  /\bd'ora in poi\b/, /\bda ora in poi\b/, /\bda adesso\b/, /\b(sempre|mai)\b/, /\bdi default\b/, /\bogni volta\b/, /\bricorda(ti)?\b/, /\btieni (a mente|presente)\b/,
  /\b(preferisco|mi piace|odio|voglio|uso|usiamo|utilizziamo|abbiamo deciso|abbiamo scelto)\b/, /\bsi chiama\b/, /\bil (nostro|mio) (progetto|team|server|cliente|database)\b/, /\binvece\b/, /\bin realta\b/,
];

/** one-off or transient: nothing to keep unless something durable is said too */
const TRANSIENT = [/\bremind me\b/, /\bin (a|one|two|five|ten|\d+) (minute|minutes|hour|hours)\b/, /\b(today|tonight|right now|at the moment)\b/, /\bi'?m (tired|hungry|bored|busy)\b/, /\b(oggi|stasera|adesso|in questo momento)\b/, /\bricordami tra\b/, /\bsono (stanco|stanca)\b/];

const GREETING = /^(hi|hello|hey|ciao|salve|buongiorno|buonasera|grazie|thanks|thank you|ok|okay|perfetto|great|bene)[\s!.,?]*$/i;

export interface Eligibility {
  eligible: boolean;
  reason?: string;
}

/** should the extractor be asked at all? (the user's own words only: an answer cannot create a memory) */
export function eligible(userText: string): Eligibility {
  const t = fold(userText.trim());
  if (t.length < 12) return { eligible: false, reason: 'too short' };
  if (GREETING.test(t)) return { eligible: false, reason: 'greeting' };
  const durable = DURABLE.some((r) => r.test(t));
  if (!durable) return { eligible: false, reason: 'nothing durable said' };
  const transient = TRANSIENT.some((r) => r.test(t));
  const strong = /\b(from now on|going forward|always|never|by default|d'ora in poi|da ora in poi|sempre|mai|di default|prefer|preferisco|decided|abbiamo deciso)\b/.test(t);
  if (transient && !strong) return { eligible: false, reason: 'transient' };
  return { eligible: true };
}

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /\bsk-or-[A-Za-z0-9_-]{8,}/g,
  /\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{12,}/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  /\b(password|passwd|pwd|passcode|pin|token|api[ _-]?key|secret|chiave api|parola d'ordine)\s*[:=]\s*\S+/gi,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  /\b(?:\d[ -]?){13,19}\b/g,
  /\b[A-Fa-f0-9]{40,}\b/g,
];

/** the text with every secret-looking value replaced by [redacted] */
export function redactSecrets(text: string): string {
  let out = text;
  for (const r of SECRET_PATTERNS) out = out.replace(r, '[redacted]');
  return out;
}

export const hasSecret = (text: string) => SECRET_PATTERNS.some((r) => new RegExp(r.source, r.flags.replace('g', '')).test(text)) || /\b(password|passwd|api key|apikey|access token|private key|secret key|recovery code|parola d'ordine|password è|la mia password)\b/i.test(text);

/** categories never proposed automatically (a user may still write one by hand) */
export const SENSITIVE: { category: string; pattern: RegExp }[] = [
  { category: 'health', pattern: /\b(diagnos\w*|illness|disease|medication|medicine|therapy|therapist|pregnan\w*|depress\w*|anxiety|cancer|diabet\w*|disabilit\w*|hospital|malatti\w*|farmac\w*|terapi\w*|incinta|gravidanza|depression\w*|ansia|tumore|diabete|ospedale|psicolog\w*)\b/ },
  { category: 'religion', pattern: /\b(religio\w*|christian|catholic|muslim|islam\w*|jewish|judaism|hindu|buddhis\w*|atheis\w*|church|mosque|synagogue|cattolic\w*|musulman\w*|ebre\w*|ateo|atea|chiesa|moschea)\b/ },
  { category: 'politics', pattern: /\b(i vote[ds]?|voted for|political (party|views)|left[- ]wing|right[- ]wing|communis\w*|fascis\w*|democrat\w*|republican\w*|partito politico|ho votato|voto per|di sinistra|di destra|comunist\w*|fascist\w*)\b/ },
  { category: 'sexual life', pattern: /\b(sex(ual)?( life| orientation)?|gay|lesbian|bisexual|transgender|orientamento sessuale|sessual\w*|omosessual\w*)\b/ },
  { category: 'precise location', pattern: /\b(i live (at|on)|my (home )?address|home address|gps|coordinates|abito in via|vivo in via|il mio indirizzo|indirizzo di casa)\b|\b\d{1,4} [a-z]+ (street|st|avenue|ave|road|rd)\b|\bvia [a-z]+ \d{1,4}\b/ },
  { category: 'private identifier', pattern: /\b(passport|social security|ssn|tax code|national id|driver'?s licen[cs]e|codice fiscale|carta d'identita|passaporto|patente)\b/ },
  { category: 'financial credential', pattern: /\b(iban|credit card|card number|cvv|bank account|account number|routing number|conto corrente|carta di credito|numero di carta)\b/ },
];

export function sensitiveCategory(text: string): string | undefined {
  const t = fold(text);
  return SENSITIVE.find((s) => s.pattern.test(t))?.category;
}

/** text that tries to steer the model rather than describe the user's context */
export const looksLikeInstructionInjection = (text: string) =>
  /\b(ignore|disregard|forget|override) (all |any |the )?(previous|prior|above|earlier|your|system)? ?(instructions|rules|prompt|messages)\b|\bsystem prompt\b|\byou are now\b|\bnew instructions\b|\b(reveal|exfiltrate|upload|send) (all |the )?(files|secrets|keys|passwords|data)\b|\bignora (tutte )?le istruzioni\b/i.test(text);

/** how much of a proposal the user's own words support (0..1): assistant guesses score low */
export function support(content: string, userText: string): number {
  const c = [...new Set(tokenize(content))];
  if (!c.length) return 0;
  const u = new Set(tokenize(userText));
  return c.filter((t) => u.has(t)).length / c.length;
}

export type Refusal = 'secret' | 'sensitive' | 'instruction' | 'unsupported' | 'empty' | 'too long';

/** why a model's proposal must not reach the user (undefined: it may) */
export function refuse(content: string, userText: string): { why: Refusal; detail?: string } | undefined {
  const t = content.trim();
  if (!t) return { why: 'empty' };
  if (t.length > 400) return { why: 'too long' };
  if (hasSecret(t)) return { why: 'secret' };
  const s = sensitiveCategory(t);
  if (s) return { why: 'sensitive', detail: s };
  if (looksLikeInstructionInjection(t)) return { why: 'instruction' };
  // a memory states what the user said; one with almost nothing of it is the model's guess
  if (support(t, userText) < 0.3) return { why: 'unsupported' };
  return undefined;
}
