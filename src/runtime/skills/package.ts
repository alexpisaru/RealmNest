// ─────────────────────────────────────────────────────────────
// Skill packages: read, check, adapt, hash, export. Pure functions — the
// installer shows their result on a review screen before anything is kept.
//
//   my-skill/
//   ├── SKILL.md        instructions (Agent Skills-compatible frontmatter)
//   ├── skill.json      RealmNest manifest (id, version, requirements)
//   ├── resources/…     read-only reference files
//   └── examples/…
//
// Accepted inputs: a RealmNest package (folder), a `.realmnest-skill` bundle (or a legacy `.nestra-skill`; one
// JSON file), an Agent Skills folder (SKILL.md + references/assets/scripts),
// or a single SKILL.md. External formats go through an adapter that says
// what it mapped; it never invents tool or capability requirements.
// Content only: scripts and executables are never installed.
// ─────────────────────────────────────────────────────────────

import { CAPABILITY_IDS, type CapabilityId } from '../../domain/capability';
import {
  SEMVER,
  SKILL_SCHEMA_VERSION,
  isSkillId,
  type InstalledSkill,
  type SkillExample,
  type SkillFileInfo,
  type SkillManifest,
  type SkillPackageFormat,
  type SkillSource,
  type ToolRequirement,
} from '../../domain/skill';
import { parseFrontmatter, renderFrontmatter } from './frontmatter';

export const SKILL_LIMITS = {
  files: 200,
  fileBytes: 1024 * 1024,
  totalBytes: 5 * 1024 * 1024,
  skillMdBytes: 128 * 1024,
  /** instructions kept; activation has its own (smaller) context budget */
  instructionsChars: 64_000,
  pathChars: 200,
  depth: 6,
  manifestBytes: 64 * 1024,
};

/** one file as read from a folder, a bundle or a download */
export interface PackageFile {
  path: string;
  bytes: Uint8Array;
}

const TEXT = ['md', 'markdown', 'txt', 'json', 'yaml', 'yml', 'csv', 'tsv'];
const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
/** never installed: code a computer could run, or a page could render with scripts */
const EXECUTABLE = [
  'exe', 'dll', 'sys', 'com', 'scr', 'msi', 'msp', 'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'js', 'mjs', 'cjs', 'jse', 'ts', 'wsf', 'wsh', 'hta',
  'sh', 'bash', 'zsh', 'fish', 'py', 'pyw', 'pyc', 'rb', 'pl', 'php', 'lua', 'jar', 'class', 'app', 'so', 'dylib', 'bin', 'elf', 'lnk', 'reg', 'html', 'htm', 'svg', 'xml',
];
const SEGMENT = /^[A-Za-z0-9 _.()+-]{1,80}$/;

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
export const utf8 = (s: string) => encoder.encode(s);
export function textOf(bytes: Uint8Array): string | undefined {
  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}

const extOf = (path: string) => (path.includes('.') ? path.split('.').pop()!.toLowerCase() : '');

// ── secrets ─────────────────────────────────────────────────

const SECRET_PATTERNS: [string, RegExp][] = [
  ['an OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['an Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['an API key (sk-…)', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['a GitHub token', /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}/],
  ['an AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
];
const SECRET_KEYS = /^(api[_-]?key|apikey|token|access[_-]?token|refresh[_-]?token|secret|client[_-]?secret|password|passwd|bearer|authorization|private[_-]?key)$/i;

/** what looks like a credential in a text (kinds only, never the value) */
export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([what]) => what);
}

/** manifest fields named like credentials that carry a value */
function secretFields(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => secretFields(x, `${path}[${i}]`));
  if (v && typeof v === 'object')
    return Object.entries(v).flatMap(([k, x]) => (SECRET_KEYS.test(k) && typeof x === 'string' && x.trim() ? [`${path}${k}`] : secretFields(x, `${path}${k}.`)));
  return [];
}

// ── paths ───────────────────────────────────────────────────

/** a safe logical path, or the reason it is not */
export function checkPath(raw: string): { path?: string; problem?: string } {
  const path = raw.replace(/\\/g, '/');
  if (!path || path.length > SKILL_LIMITS.pathChars) return { problem: 'path too long or empty' };
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.startsWith('//')) return { problem: 'absolute path' };
  const parts = path.split('/');
  if (parts.length > SKILL_LIMITS.depth) return { problem: 'nested too deeply' };
  for (const p of parts) {
    if (p === '.' || p === '..') return { problem: 'leaves the package (..)' };
    if (!SEGMENT.test(p) || p.endsWith('.') || p.endsWith(' ')) return { problem: `invalid name "${p.slice(0, 40)}"` };
  }
  return { path };
}

/** a picked folder arrives as `folder/SKILL.md`: drop the shared top folder */
export function stripRoot(files: PackageFile[]): PackageFile[] {
  const firsts = new Set(files.map((f) => f.path.replace(/\\/g, '/').split('/')[0]));
  const all = files.every((f) => f.path.replace(/\\/g, '/').includes('/'));
  if (firsts.size !== 1 || !all) return files;
  const root = [...firsts][0];
  return files.map((f) => ({ ...f, path: f.path.replace(/\\/g, '/').slice(root.length + 1) }));
}

// ── review ──────────────────────────────────────────────────

export interface ExcludedFile {
  path: string;
  reason: string;
}

/** everything the review screen shows; nothing is installed yet */
export interface SkillReview {
  format: SkillPackageFormat;
  manifest: SkillManifest;
  instructions: string;
  /** files that will be installed (content included, for the native store) */
  files: PackageFile[];
  fileInfo: SkillFileInfo[];
  excluded: ExcludedFile[];
  /** blocking: cannot be installed as is */
  problems: string[];
  /** shown, not blocking */
  warnings: string[];
  /** what the adapter did to read a non-RealmNest format */
  mapping: string[];
  /** tools the external format named (e.g. Claude's own tool names) that RealmNest cannot map by itself */
  unmappedTools: string[];
  /** the user must confirm the id and requirements (no RealmNest manifest was present) */
  needsConfirmation: boolean;
  hash: string;
  source: SkillSource;
}

const fileKind = (path: string): SkillFileInfo['kind'] =>
  path === 'SKILL.md' ? 'instructions' : path === 'skill.json' ? 'manifest' : path.startsWith('examples/') ? 'example' : path.startsWith('resources/') || path.startsWith('references/') || path.startsWith('assets/') ? 'resource' : 'other';

/** sha256 over the kept files, sorted by path: `path \0 bytes \0` each */
export async function packageHash(files: PackageFile[]): Promise<string> {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts: Uint8Array[] = [];
  for (const f of sorted) parts.push(utf8(f.path), new Uint8Array([0]), f.bytes, new Uint8Array([0]));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** "1.0" → "1.0.0"; undefined when it cannot be made a version */
export function normalizeVersion(v: unknown): string | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = String(v).trim().replace(/^v/, '');
  if (SEMVER.test(s)) return s;
  if (/^\d+$/.test(s)) return `${s}.0.0`;
  if (/^\d+\.\d+$/.test(s)) return `${s}.0`;
  return undefined;
}

const str = (v: unknown, max = 1_000): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const strList = (v: unknown, max = 50): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, max).map((x) => x.trim()) : typeof v === 'string' && v.trim() ? splitList(v).slice(0, max) : [];

/** "Read Grep", "Read, Grep" or "Bash(git log:*), Read": spaces and commas separate, not inside brackets */
function splitList(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function toolRequirement(v: unknown): ToolRequirement | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.id === 'string' && o.id.trim()) return { id: o.id.trim() };
    if (typeof o.mcpServer === 'string' && typeof o.tool === 'string' && o.mcpServer.trim() && o.tool.trim()) return { mcpServer: o.mcpServer.trim(), tool: o.tool.trim() };
  }
  return undefined;
}

/** skill.json → a manifest, and what is wrong with it */
export function validateManifest(raw: unknown): { manifest?: SkillManifest; problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { problems: ['skill.json is not a JSON object'], warnings };
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== SKILL_SCHEMA_VERSION) problems.push(`schemaVersion must be ${SKILL_SCHEMA_VERSION}`);
  const id = str(o.id, 100);
  if (!id || !isSkillId(id)) problems.push('id must look like publisher.skill-name (lowercase letters, digits, hyphens, dots)');
  const name = str(o.name, 80);
  if (!name) problems.push('name is required');
  const description = str(o.description, 1024);
  if (!description) problems.push('description is required');
  const version = typeof o.version === 'string' && SEMVER.test(o.version) ? o.version : undefined;
  if (!version) problems.push('version must be semver, e.g. 1.0.0');
  const caps = strList(o.requiresCapabilities);
  const unknownCaps = caps.filter((c) => !(CAPABILITY_IDS as readonly string[]).includes(c));
  if (unknownCaps.length) problems.push(`unknown capabilities: ${unknownCaps.join(', ')}`);
  const reqList = (k: string) => {
    const list = Array.isArray(o[k]) ? (o[k] as unknown[]) : [];
    const out = list.map(toolRequirement);
    if (out.some((x) => !x)) problems.push(`${k} has an entry RealmNest cannot read`);
    return out.filter((x): x is ToolRequirement => !!x).slice(0, 64);
  };
  const examples: SkillExample[] = Array.isArray(o.examples)
    ? (o.examples as unknown[])
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({ ...(str(e.title, 120) && { title: str(e.title, 120) }), input: str(e.input, 2_000) ?? '', procedure: str(e.procedure, 4_000) ?? '' }))
        .filter((e) => e.input && e.procedure)
        .slice(0, 20)
    : [];
  const requiresTools = reqList('requiresTools');
  const optionalTools = reqList('optionalTools');
  const secrets = secretFields(o);
  if (secrets.length) problems.push(`skill.json has credential-like fields with values (${secrets.join(', ')}): Skills never carry secrets`);
  for (const k of ['entrypoints', 'scripts', 'commands', 'hooks']) if (k in o) warnings.push(`"${k}" is ignored: a Skill never runs code`);
  if (problems.length) return { problems, warnings };
  return {
    manifest: {
      schemaVersion: SKILL_SCHEMA_VERSION,
      id: id!,
      name: name!,
      description: description!,
      version: version!,
      ...(str(o.author, 120) && { author: str(o.author, 120) }),
      ...(str(o.homepage, 500) && { homepage: str(o.homepage, 500) }),
      ...(str(o.repository, 500) && { repository: str(o.repository, 500) }),
      ...(str(o.license, 200) && { license: str(o.license, 200) }),
      requiresCapabilities: caps as CapabilityId[],
      requiresTools,
      optionalTools,
      ...(strList(o.conflicts).length && { conflicts: strList(o.conflicts).filter(isSkillId) }),
      ...(strList(o.permissions, 20).length && { permissions: strList(o.permissions, 20).map((p) => p.slice(0, 200)) }),
      tags: strList(o.tags, 20).map((t) => t.slice(0, 40)),
      ...(str(o.compatibility, 500) && { compatibility: str(o.compatibility, 500) }),
      ...(examples.length && { examples }),
    },
    problems,
    warnings,
  };
}

/** files → the review (format detection, adapters, safety checks); nothing is kept */
export async function reviewPackage(input: PackageFile[], source: Omit<SkillSource, 'format'>): Promise<SkillReview> {
  const problems: string[] = [];
  const warnings: string[] = [];
  const mapping: string[] = [];
  const excluded: ExcludedFile[] = [];
  let files = stripRoot(input);

  // a `.realmnest-skill` bundle (or a legacy `.nestra-skill`) is one JSON file holding the package
  let format: SkillPackageFormat | undefined;
  if (files.length === 1 && isBundleName(files[0].path)) {
    const bundle = readBundle(files[0].bytes);
    if (bundle.problem) problems.push(bundle.problem);
    files = bundle.files;
    format = 'nestra-bundle';
  }
  if (files.length > SKILL_LIMITS.files) problems.push(`more than ${SKILL_LIMITS.files} files`);
  const total = files.reduce((n, f) => n + f.bytes.length, 0);
  if (total > SKILL_LIMITS.totalBytes) problems.push(`the package is ${(total / 1024 / 1024).toFixed(1)} MB; the limit is ${SKILL_LIMITS.totalBytes / 1024 / 1024} MB`);

  // each file: safe path, allowed type, not executable, not too big
  const kept: PackageFile[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const { path, problem } = checkPath(f.path);
    if (!path) {
      problems.push(`${f.path.slice(0, 80)}: ${problem}`);
      continue;
    }
    const key = path.toLowerCase();
    if (seen.has(key)) {
      problems.push(`${path}: listed twice`);
      continue;
    }
    seen.add(key);
    // LICENSE, NOTICE… without an extension are plain text
    const ext = extOf(path) || (/^(license|licence|notice|readme|copying)$/i.test(path.split('/').pop()!) ? 'txt' : '');
    const top = path.split('/')[0].toLowerCase();
    const magic = f.bytes.length >= 2 && ((f.bytes[0] === 0x4d && f.bytes[1] === 0x5a) || (f.bytes[0] === 0x7f && f.bytes[1] === 0x45) || (f.bytes[0] === 0x23 && f.bytes[1] === 0x21));
    if (EXECUTABLE.includes(ext) || top === 'scripts' || magic) {
      excluded.push({ path, reason: 'executable or script: a Skill never runs code' });
      continue;
    }
    if (!TEXT.includes(ext) && !IMAGES.includes(ext)) {
      excluded.push({ path, reason: `file type .${ext || '?'} is not allowed in a Skill` });
      continue;
    }
    if (f.bytes.length > SKILL_LIMITS.fileBytes) {
      excluded.push({ path, reason: `larger than ${SKILL_LIMITS.fileBytes / 1024 / 1024} MB` });
      continue;
    }
    if (TEXT.includes(ext)) {
      const text = textOf(f.bytes);
      if (text === undefined) {
        excluded.push({ path, reason: 'not valid UTF-8 text' });
        continue;
      }
      const secrets = findSecrets(text);
      if (secrets.length) problems.push(`${path} contains what looks like ${secrets.join(' and ')}: Skills never carry secrets`);
    }
    kept.push({ path, bytes: f.bytes });
  }

  const skillMd = kept.find((f) => f.path === 'SKILL.md') ?? kept.find((f) => f.path.toLowerCase() === 'skill.md');
  const skillJson = kept.find((f) => f.path === 'skill.json');
  let manifest: SkillManifest | undefined;
  let instructions = '';
  let unmappedTools: string[] = [];
  let needsConfirmation = false;

  const fm = skillMd ? parseFrontmatter(textOf(skillMd.bytes) ?? '') : undefined;
  if (skillMd && skillMd.bytes.length > SKILL_LIMITS.skillMdBytes) problems.push(`SKILL.md is larger than ${SKILL_LIMITS.skillMdBytes / 1024} KB`);
  if (fm?.problems.length) warnings.push(...fm.problems.map((p) => `SKILL.md frontmatter: ${p}`));
  instructions = (fm?.body ?? '').trim();

  if (skillJson) {
    // a RealmNest package: the manifest decides
    format ??= 'nestra-package';
    const text = textOf(skillJson.bytes);
    let raw: unknown;
    try {
      raw = text && text.length <= SKILL_LIMITS.manifestBytes ? JSON.parse(text) : undefined;
    } catch {
      problems.push('skill.json is not valid JSON');
    }
    if (raw !== undefined) {
      const v = validateManifest(raw);
      problems.push(...v.problems);
      warnings.push(...v.warnings);
      manifest = v.manifest;
    }
    if (!skillMd) problems.push('SKILL.md (the instructions) is missing');
  } else if (skillMd && fm) {
    // an Agent Skills folder or a single SKILL.md: read what can be known, ask for the rest
    format ??= kept.length > 1 ? 'agent-skills' : 'skill-md';
    needsConfirmation = true;
    const d = fm.data;
    const name = str(d.name, 64);
    if (!fm.present) problems.push('SKILL.md has no frontmatter (--- name / description ---)');
    if (!name) problems.push('SKILL.md frontmatter has no name');
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) warnings.push(`name "${name}" does not follow the Agent Skills rule (lowercase, digits, single hyphens)`);
    const description = str(d.description, 1024);
    if (!description) problems.push('SKILL.md frontmatter has no description');
    const meta = d.metadata && typeof d.metadata === 'object' ? (d.metadata as Record<string, unknown>) : {};
    const author = str(meta.author, 120) ?? str(d.author, 120);
    const slug = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    const publisher = author ? slug(author) || 'imported' : 'imported';
    const id = `${publisher}.${slug(name ?? 'skill') || 'skill'}`;
    mapping.push(`id ${id}: from ${author ? `the author "${author}"` : '"imported"'} and the name — change it if the publisher is known`);
    const declared = str(meta.version, 40) ?? str(d.version, 40);
    let version = normalizeVersion(declared);
    if (declared && version && version !== declared) mapping.push(`version "${declared}" read as ${version}`);
    if (!str(meta.version, 40) && str(d.version, 40)) mapping.push('version taken from a top-level "version" field (the Agent Skills spec puts it in metadata)');
    if (!version) {
      version = '0.0.0';
      mapping.push(declared ? `version "${declared}" is not semver: set to 0.0.0` : 'no version declared: set to 0.0.0');
    }
    const heading = /^#\s+(.+)$/m.exec(instructions)?.[1]?.trim();
    const display = heading && heading.length <= 80 && !heading.startsWith('/') ? heading : name ?? 'Imported skill';
    if (display !== name) mapping.push(`display name "${display}" from the first heading`);
    unmappedTools = strList(d['allowed-tools'], 40);
    if (unmappedTools.length) mapping.push(`allowed-tools (${unmappedTools.join(', ')}) name another product's tools: not mapped — choose RealmNest tools below if the Skill needs them`);
    const known = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools', 'version', 'author'];
    const extra = Object.keys(d).filter((k) => !known.includes(k));
    if (extra.length) mapping.push(`ignored frontmatter fields: ${extra.join(', ')}`);
    mapping.push('no tool or capability requirements were declared: none were invented');
    manifest = {
      schemaVersion: SKILL_SCHEMA_VERSION,
      id,
      name: display,
      description: description ?? '',
      version,
      ...(author && { author }),
      ...(str(d.license, 200) && { license: str(d.license, 200) }),
      requiresCapabilities: [],
      requiresTools: [],
      optionalTools: [],
      tags: [],
      ...(str(d.compatibility, 500) && { compatibility: str(d.compatibility, 500) }),
    };
  } else {
    problems.push('no SKILL.md found (a Skill needs SKILL.md, and RealmNest packages also skill.json)');
  }

  if (instructions.length > SKILL_LIMITS.instructionsChars) problems.push(`the instructions are ${Math.round(instructions.length / 1000)}k characters; the limit is ${SKILL_LIMITS.instructionsChars / 1000}k`);
  if (!instructions) warnings.push('SKILL.md has no instructions after the frontmatter');
  // links that point outside the package cannot be followed
  const outside = [...instructions.matchAll(/\]\((\.\.\/[^)]+)\)/g)].map((m) => m[1]);
  if (outside.length) warnings.push(`the instructions link outside the package (${[...new Set(outside)].slice(0, 3).join(', ')}): those files are not included`);
  if (excluded.some((e) => e.reason.startsWith('executable'))) warnings.push('scripts were left out: if the instructions tell the agent to run them, that part will not work in RealmNest');

  const fileInfo: SkillFileInfo[] = kept.map((f) => ({ path: f.path, bytes: f.bytes.length, kind: fileKind(f.path) }));
  return {
    format: format ?? 'skill-md',
    manifest: manifest ?? { schemaVersion: SKILL_SCHEMA_VERSION, id: '', name: '', description: '', version: '0.0.0', requiresCapabilities: [], requiresTools: [], optionalTools: [], tags: [] },
    instructions,
    files: kept,
    fileInfo,
    excluded,
    problems,
    warnings,
    mapping,
    unmappedTools,
    needsConfirmation,
    hash: await packageHash(kept),
    source: { ...source, format: format ?? 'skill-md' },
  };
}

// ── bundle (.realmnest-skill) ───────────────────────────────

export const BUNDLE_FORMAT = 'realmnest-skill';
export const BUNDLE_EXT = '.realmnest-skill';
/** bundles exported before the RealmNest rebrand: still read, never written */
export const LEGACY_BUNDLE_FORMAT = 'nestra-skill';
export const LEGACY_BUNDLE_EXT = '.nestra-skill';
export const isBundleName = (name: string) => {
  const n = name.toLowerCase();
  return n.endsWith(BUNDLE_EXT) || n.endsWith(LEGACY_BUNDLE_EXT);
};

interface BundleFile {
  path: string;
  encoding: 'utf8' | 'base64';
  content: string;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const base64 = { encode: toBase64, decode: fromBase64 };

function readBundle(bytes: Uint8Array): { files: PackageFile[]; problem?: string } {
  if (bytes.length > SKILL_LIMITS.totalBytes * 1.5) return { files: [], problem: 'the bundle is too large' };
  try {
    const b = JSON.parse(textOf(bytes) ?? '') as { format?: string; formatVersion?: number; files?: BundleFile[] };
    if ((b.format !== BUNDLE_FORMAT && b.format !== LEGACY_BUNDLE_FORMAT) || b.formatVersion !== 1 || !Array.isArray(b.files)) return { files: [], problem: 'not a RealmNest skill bundle (format realmnest-skill, version 1)' };
    return {
      files: b.files
        .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
        .map((f) => ({ path: f.path, bytes: f.encoding === 'base64' ? fromBase64(f.content) : utf8(f.content) })),
    };
  } catch {
    return { files: [], problem: 'the bundle is not valid JSON' };
  }
}

/** the SKILL.md RealmNest writes: Agent Skills frontmatter (readable elsewhere) + the instructions */
export function renderSkillMd(skill: Pick<InstalledSkill, 'manifest' | 'instructions'>): string {
  const m = skill.manifest;
  const name = m.id.split('.').slice(1).join('-').slice(0, 64) || 'skill';
  return `${renderFrontmatter({ name, description: m.description, ...(m.license && { license: m.license }), ...(m.compatibility && { compatibility: m.compatibility }), metadata: { 'realmnest-id': m.id, version: m.version, 'display-name': m.name } })}${skill.instructions.trim()}\n`;
}

/** the package files of a Skill (manifest + SKILL.md + its resources), ready to export or store */
export function packageFiles(skill: Pick<InstalledSkill, 'manifest' | 'instructions'>, resources: PackageFile[]): PackageFile[] {
  const manifest = JSON.stringify(skill.manifest, null, 2);
  return [{ path: 'skill.json', bytes: utf8(`${manifest}\n`) }, { path: 'SKILL.md', bytes: utf8(renderSkillMd(skill)) }, ...resources.filter((f) => f.path !== 'skill.json' && f.path !== 'SKILL.md')];
}

/** one portable file: `<id>-<version>.realmnest-skill` (no absolute paths, no machine ids, no secrets) */
export function exportBundle(skill: Pick<InstalledSkill, 'manifest' | 'instructions'>, resources: PackageFile[]): { filename: string; text: string; problems: string[] } {
  const files = packageFiles(skill, resources);
  const problems: string[] = [];
  for (const f of files) {
    const text = textOf(f.bytes);
    if (text !== undefined) {
      const s = findSecrets(text);
      if (s.length) problems.push(`${f.path} contains what looks like ${s.join(' and ')}`);
      if (/[A-Za-z]:\\Users\\|\/Users\/|\/home\//.test(text)) problems.push(`${f.path} contains a local absolute path`);
    }
  }
  const bundle = {
    format: BUNDLE_FORMAT,
    formatVersion: 1,
    files: files.map((f): BundleFile => {
      const text = TEXT.includes(extOf(f.path)) ? textOf(f.bytes) : undefined;
      return text !== undefined ? { path: f.path, encoding: 'utf8', content: text } : { path: f.path, encoding: 'base64', content: toBase64(f.bytes) };
    }),
  };
  return { filename: `${skill.manifest.id}-${skill.manifest.version}${BUNDLE_EXT}`, text: `${JSON.stringify(bundle, null, 2)}\n`, problems };
}
