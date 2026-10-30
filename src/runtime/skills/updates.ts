// Updates of Skills installed from GitHub (docs/SKILLS.md › Updates): what changes
// between the installed version and the new one, shown before the user agrees.
//
//   files      added / removed / changed, with lines added and removed (SKILL.md by its instructions)
//   sensitive  capabilities, tools, MCP tools, network and file access, declared permissions
//              that the new version adds or drops: shown first, highlighted
//
// Nothing here downloads or installs: SkillService does that, atomically, only on confirmation.

import { requirementLabel, type SkillManifest, type ToolRequirement } from '../../domain/skill';
import type { GithubCommit } from './github';
import { textOf, type PackageFile } from './package';

export type SensitiveArea = 'capability' | 'tool' | 'mcp' | 'network' | 'filesystem' | 'permission';

export interface SensitiveChange {
  area: SensitiveArea;
  change: 'added' | 'removed';
  what: string;
  /** an optional tool (used when there, not needed) */
  optional?: boolean;
}

export interface FileChange {
  path: string;
  change: 'added' | 'removed' | 'changed';
  /** text files: lines added and removed */
  plus?: number;
  minus?: number;
}

/** everything the update screen shows; the download is kept by the service until the user decides */
export interface SkillUpdatePlan {
  id: string;
  name: string;
  from: { ref: string; commit: string; version: string };
  to: { ref: string; commit: string; version: string };
  /** a branch: the commits that changed the Skill's folder since the installed one (newest first) */
  commits: GithubCommit[];
  /** more commits than listed (or the installed one is unknown) */
  more: boolean;
  files: FileChange[];
  sensitive: SensitiveChange[];
  /** edited in RealmNest, or its files changed outside RealmNest, since it was installed */
  localChanges: boolean;
  /** blocking: the new version cannot be installed */
  problems: string[];
  warnings: string[];
}

/** lines added and removed between two texts (as multisets: moved lines do not count) */
export function lineDiff(a: string, b: string): { plus: number; minus: number } {
  const count = (s: string) => {
    const m = new Map<string, number>();
    for (const line of s.replace(/\r\n/g, '\n').split('\n')) m.set(line, (m.get(line) ?? 0) + 1);
    return m;
  };
  const x = count(a);
  const y = count(b);
  let plus = 0;
  let minus = 0;
  for (const [line, n] of y) plus += Math.max(0, n - (x.get(line) ?? 0));
  for (const [line, n] of x) minus += Math.max(0, n - (y.get(line) ?? 0));
  return { plus, minus };
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
/** the manifest and the instructions are compared as such; the files around them by content */
const isResource = (f: PackageFile) => f.path !== 'skill.json' && f.path !== 'SKILL.md';

/** the files an update adds, removes and changes */
export function fileChanges(before: { files: PackageFile[]; instructions: string }, after: { files: PackageFile[]; instructions: string }): FileChange[] {
  const out: FileChange[] = [];
  if (before.instructions.trim() !== after.instructions.trim()) out.push({ path: 'SKILL.md', change: 'changed', ...lineDiff(before.instructions.trim(), after.instructions.trim()) });
  const old = new Map(before.files.filter(isResource).map((f) => [f.path, f]));
  const next = new Map(after.files.filter(isResource).map((f) => [f.path, f]));
  for (const [path, f] of next) {
    const prev = old.get(path);
    const text = textOf(f.bytes);
    if (!prev) out.push({ path, change: 'added', ...(text !== undefined && { plus: text.split('\n').length, minus: 0 }) });
    else if (!same(prev.bytes, f.bytes)) {
      const was = textOf(prev.bytes);
      out.push({ path, change: 'changed', ...(text !== undefined && was !== undefined && lineDiff(was, text)) });
    }
  }
  for (const [path, f] of old) if (!next.has(path)) out.push({ path, change: 'removed', ...(textOf(f.bytes) !== undefined && { plus: 0, minus: textOf(f.bytes)!.split('\n').length }) });
  return out.sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)));
}

const NETWORK = /web|fetch|http|url|browser|search|download|upload|email|mail|send|post/i;
const FILES = /file|folder|dir|path|read|write|edit|glob|grep|bash|shell|terminal|exec|workspace|notebook/i;

/** what kind of access a tool gives, from its name */
export function toolArea(r: ToolRequirement | string): SensitiveArea {
  if (typeof r === 'object' && 'mcpServer' in r) return 'mcp';
  const label = requirementLabel(r);
  if (/^mcp\./.test(label)) return 'mcp';
  if (NETWORK.test(label)) return 'network';
  if (FILES.test(label)) return 'filesystem';
  return 'tool';
}

const capArea = (c: string): SensitiveArea => (c === 'web.search' ? 'network' : c === 'files.input' ? 'filesystem' : 'capability');

/** capabilities, tools, MCP, network, files and permissions that the new version adds or drops */
export function sensitiveChanges(before: { manifest: SkillManifest; declaredTools?: string[] }, after: { manifest: SkillManifest; declaredTools?: string[] }): SensitiveChange[] {
  const out: SensitiveChange[] = [];
  const diff = <T>(a: T[], b: T[], key: (v: T) => string, push: (v: T, change: 'added' | 'removed') => void) => {
    const ka = new Set(a.map(key));
    const kb = new Set(b.map(key));
    for (const v of b) if (!ka.has(key(v))) push(v, 'added');
    for (const v of a) if (!kb.has(key(v))) push(v, 'removed');
  };
  const m0 = before.manifest;
  const m1 = after.manifest;
  diff(m0.requiresCapabilities, m1.requiresCapabilities, String, (c, change) => out.push({ area: capArea(c), change, what: c }));
  diff(m0.requiresTools, m1.requiresTools, requirementLabel, (r, change) => out.push({ area: toolArea(r), change, what: requirementLabel(r) }));
  diff(m0.optionalTools, m1.optionalTools, requirementLabel, (r, change) => out.push({ area: toolArea(r), change, what: requirementLabel(r), optional: true }));
  // another product's tools (Claude's allowed-tools): RealmNest does not grant them, but a change says what the Skill now expects
  diff(before.declaredTools ?? [], after.declaredTools ?? [], String, (r, change) => out.push({ area: toolArea(r), change, what: r }));
  diff(m0.permissions ?? [], m1.permissions ?? [], String, (p, change) => out.push({ area: 'permission', change, what: p }));
  diff(m0.conflicts ?? [], m1.conflicts ?? [], String, (c, change) => out.push({ area: 'tool', change, what: `conflicts with ${c}` }));
  // what gives more access first
  const rank: Record<SensitiveArea, number> = { mcp: 0, network: 1, filesystem: 2, permission: 3, tool: 4, capability: 5 };
  return out.sort((a, b) => Number(a.change === 'removed') - Number(b.change === 'removed') || rank[a.area] - rank[b.area]);
}
