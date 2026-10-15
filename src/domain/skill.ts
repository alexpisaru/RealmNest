// ─────────────────────────────────────────────────────────────
// Skills: portable procedures an agent can follow.
//
//   tool        an executable action                 (domain/tool.ts)
//   capability  something a model or RealmNest can do   (domain/capability.ts)
//   skill       instructions + what they need        (this file)
//   plugin      code / UI / tools / skills (later; a different, executable system)
//   MCP         a source of tools                    (domain/mcp.ts)
//
// A Skill never runs code. It is content (instructions, examples, resource
// files) plus declared requirements; at run time it may only use tools and
// capabilities RealmNest already governs (ToolRuntime: permissions, approval).
// docs/SKILLS.md has the whole flow.
// ─────────────────────────────────────────────────────────────

import type { CapabilityId } from './capability';

export const SKILL_SCHEMA_VERSION = 1;

/**
 * A tool a Skill needs. Either an exact RealmNest tool id (`write_text_file`,
 * `mcp.photocraft.doc_open`), or — portable across machines — an MCP tool by
 * its server and tool name, matched against whatever local key the user gave
 * that server.
 */
export type ToolRequirement = string | { id: string } | { mcpServer: string; tool: string };

/** skill.json: the machine-readable manifest (instructions live in SKILL.md) */
export interface SkillManifest {
  schemaVersion: number;
  /** stable, portable: `publisher.skill-name` (lowercase, digits, dots, hyphens) */
  id: string;
  name: string;
  description: string;
  /** semver: 1.0.0 */
  version: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  requiresCapabilities: CapabilityId[];
  requiresTools: ToolRequirement[];
  optionalTools: ToolRequirement[];
  /** Skills it must not run together with (a declared, structured conflict) */
  conflicts?: string[];
  /** what using it may do, in plain words, shown before install ("writes files in the workspace") */
  permissions?: string[];
  tags: string[];
  /** free text: intended products, environments */
  compatibility?: string;
  /** short worked examples; the first ones may be given to the model */
  examples?: SkillExample[];
}

export interface SkillExample {
  title?: string;
  input: string;
  procedure: string;
}

export type SkillOrigin = 'built_in' | 'user_created' | 'imported';

export type SkillSourceKind = 'built_in' | 'created' | 'local_file' | 'local_directory' | 'url' | 'git' | 'registry';

/** where an installed Skill came from (never credentials) */
export interface SkillSource {
  kind: SkillSourceKind;
  /** what the user picked: a file or folder name, or the URL without credentials */
  label: string;
  url?: string;
  /** for a future gallery / registry */
  registryId?: string;
  publisher?: string;
  repository?: string;
  homepage?: string;
  /** the format it came in: a RealmNest package, an Agent Skills folder, a single SKILL.md, a bundle */
  format: SkillPackageFormat;
}

export type SkillPackageFormat = 'nestra-package' | 'nestra-bundle' | 'agent-skills' | 'skill-md';

/** a file in an installed package (content lives in RealmNest's skills folder) */
export interface SkillFileInfo {
  /** logical path inside the package: resources/template.md */
  path: string;
  bytes: number;
  kind: 'instructions' | 'manifest' | 'resource' | 'example' | 'other';
}

/** one Skill as RealmNest keeps it */
export interface InstalledSkill {
  manifest: SkillManifest;
  /** the SKILL.md body (without frontmatter) */
  instructions: string;
  origin: SkillOrigin;
  source: SkillSource;
  enabled: boolean;
  installedAt: number;
  updatedAt: number;
  /** sha256 of the package as installed (modification detection, update safety; not a signature) */
  packageHash?: string;
  /** edited in RealmNest after import/install */
  modified?: boolean;
  files: SkillFileInfo[];
  /** what the importer mapped or left out (shown in the detail) */
  importNotes?: string[];
  /** a future update (not checked online yet) */
  availableVersion?: string;
}

/** what a run remembers about the Skills it used (survives uninstall) */
export interface SkillRunRef {
  id: string;
  version: string;
  name: string;
  /**
   * how it became active (docs/SKILLS.md › Precedence): the user named it (@ or a chip), it is
   * assigned to the agent (or an older chat's setting), or RealmNest picked it; absent on runs
   * recorded before modes existed
   */
  activation?: 'explicit' | 'assigned' | 'automatic';
  /** why an automatic Skill was picked */
  reason?: string;
}

/** per-requirement states (never a single boolean) */
export type SkillRequirementState =
  | 'READY'
  | 'MISSING_CAPABILITY'
  | 'MISSING_TOOL'
  | 'TOOL_DISABLED'
  | 'TOOL_UNAVAILABLE'
  | 'CONNECTION_UNAVAILABLE';

export type SkillReadiness = 'READY' | 'PARTIALLY_READY' | 'NOT_READY' | 'DISABLED' | 'UNAVAILABLE';

export type SkillErrorCode =
  | 'SKILL_NOT_FOUND'
  | 'SKILL_DISABLED'
  | 'SKILL_NOT_READY'
  | 'SKILL_TOOL_LIMIT_EXCEEDED'
  | 'SKILL_CONFLICT'
  | 'SKILL_TOO_MANY'
  | 'SKILL_CONTEXT_TOO_LARGE'
  | 'SKILL_MODEL_NO_TOOLS';

/** id rule: publisher.name, e.g. nestra.workspace-note, community.product-photo-cleanup */
export const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export const isSkillId = (v: string) => v.length <= 100 && SKILL_ID.test(v);

/** a readable label for a requirement */
export function requirementLabel(r: ToolRequirement): string {
  if (typeof r === 'string') return r;
  if ('id' in r) return r.id;
  return `${r.mcpServer} › ${r.tool}`;
}

/** -1 / 0 / 1 for two semver versions (pre-release sorts before release) */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.split('-', 2);
    return { nums: core.split('.').map((n) => Number(n) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) < (y.nums[i] ?? 0) ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}
