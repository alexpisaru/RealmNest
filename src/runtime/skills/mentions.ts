// Skills in a chat message: `@<skill id>` forces a Skill for that message, and every chat tells the
// model which Skills exist, so "which skills do you have?" gets a true answer (docs/SKILLS.md).
// Pure: the runtime and the composer both use it.

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
}

/** `@` + a Skill id, full (`publisher.skill-name`) or short (`skill-name`): at the start, or after a space or an opening bracket */
const MENTION = /(^|[\s(["'])@([a-z0-9][a-z0-9.-]*[a-z0-9])/gi;

/** a typed token → the Skill id it names: the full id, or a short id that only one Skill has */
function resolver(known: Iterable<string>) {
  const ids = [...known];
  const full = new Map(ids.map((id) => [id.toLowerCase(), id]));
  const short = new Map<string, string | null>();
  for (const id of ids) {
    const k = id.slice(id.indexOf('.') + 1).toLowerCase();
    short.set(k, short.has(k) ? null : id);
  }
  return (token: string): string | undefined => {
    const t = token.toLowerCase();
    for (const c of [t, t.replace(/\.+$/, '')]) {
      const hit = full.get(c) ?? (c.includes('.') ? undefined : short.get(c) ?? undefined);
      if (hit) return hit;
    }
    return undefined;
  };
}

/** the known Skill ids mentioned in a message, in order, once each (case does not matter) */
export function mentionedSkills(text: string, known: Iterable<string>): string[] {
  const resolve = resolver(known);
  const out: string[] = [];
  for (const m of text.matchAll(MENTION)) {
    const id = resolve(m[2]);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** the message without the mentions of these Skills (what the model reads: the Skill itself is active) */
export function stripMentions(text: string, ids: string[], known: Iterable<string>): string {
  if (!ids.length) return text;
  const resolve = resolver(known);
  return text
    .replace(MENTION, (all, lead: string, token: string) => {
      const id = resolve(token);
      if (!id || !ids.includes(id)) return all;
      // a trailing dot ended the sentence: keep it
      return lead + (token.endsWith('.') && !id.endsWith('.') ? '.' : '');
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

/**
 * Automatic selection, deliberately narrow: a Skill is picked only when the message names it by its
 * full name ("use the Workspace Note skill"), and only one. Anything vaguer picks nothing.
 */
export function autoSkills(text: string, catalog: SkillCatalogEntry[]): { id: string; reason: string }[] {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const hits = catalog.filter((s) => {
    const name = s.name.toLowerCase().trim();
    if (name.length < 6 && !name.includes(' ')) return false;
    const i = t.indexOf(name);
    return i > 0 && !/[a-z0-9]/.test(t[i - 1]) && !/[a-z0-9]/.test(t[i + name.length] ?? ' ');
  });
  return hits.length === 1 ? [{ id: hits[0].id, reason: `the message names “${hits[0].name}”` }] : [];
}

/** the mention being typed at the caret: where its `@` is and what follows it so far */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[\s(["'])@([a-z0-9.-]*)$/i.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

/** the Skills matching what is typed after `@`: id or name, prefix matches first */
export function matchSkills(all: SkillCatalogEntry[], query: string, limit = 8): SkillCatalogEntry[] {
  const q = query.toLowerCase();
  const score = (s: SkillCatalogEntry) => {
    const id = s.id.toLowerCase();
    const name = s.name.toLowerCase();
    const short = id.slice(id.indexOf('.') + 1);
    if (!q) return 1;
    if (short.startsWith(q) || name.startsWith(q) || id.startsWith(q)) return 3;
    if (id.includes(q) || name.includes(q)) return 2;
    return 0;
  };
  return all
    .map((s) => ({ s, k: score(s) }))
    .filter((x) => x.k > 0)
    .sort((a, b) => b.k - a.k || a.s.name.localeCompare(b.s.name))
    .slice(0, limit)
    .map((x) => x.s);
}

/** the text with the mention at `start` replaced by `@id ` (the caret goes after it) */
export function insertMention(text: string, start: number, caret: number, id: string): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret).replace(/^[a-z0-9.-]*/i, '');
  const token = `@${id}${after.startsWith(' ') ? '' : ' '}`;
  return { text: before + token + after, caret: before.length + token.length };
}

const MAX_LISTED = 40;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * What the model is told about Skills in every chat turn: what exists, which are the agent's own,
 * and how the user activates one. Undefined when no Skill is installed and enabled.
 */
export function skillCatalog(all: SkillCatalogEntry[], assignedIds: string[] = [], activeIds: string[] = []): string | undefined {
  if (!all.length) return undefined;
  const line = (s: SkillCatalogEntry) => `- @${s.id} — ${s.name}: ${clip(s.description.replace(/\s+/g, ' ').trim(), 160)}`;
  const own = all.filter((s) => assignedIds.includes(s.id));
  const rest = all.filter((s) => !assignedIds.includes(s.id));
  const parts = [
    '# Skills in RealmNest',
    'Skills are reusable procedures installed in RealmNest. The user activates one for a message by writing @ followed by its id; an active Skill’s full instructions then appear below. If the user asks which Skills are available, answer from this list (and say how to activate one).',
  ];
  if (own.length) parts.push(['Assigned to you:', ...own.slice(0, MAX_LISTED).map(line)].join('\n'));
  if (rest.length) parts.push([own.length ? 'Also installed:' : 'Installed:', ...rest.slice(0, MAX_LISTED).map(line), ...(rest.length > MAX_LISTED ? [`- …and ${rest.length - MAX_LISTED} more`] : [])].join('\n'));
  if (activeIds.length) parts.push(`Active for this message: ${activeIds.map((id) => `@${id}`).join(', ')}.`);
  return parts.join('\n\n');
}
