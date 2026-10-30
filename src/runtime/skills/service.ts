// ─────────────────────────────────────────────────────────────
// SkillService: installed Skills, their packages and their activation.
//
//   install:  files ─reviewPackage─▶ review screen ─install()─▶ index + native store
//   run:      agent / chat ─activate(skillIds)─▶ { context, toolIds, refs }
//                 resolver: requirements READY?   tools: only what the Skills need
//                 limits: count, tools per turn, context size, declared conflicts
//
// No parallel runtime: LiveRuntime and ConversationRuntime call activate()
// before the provider runs and use the result like any other run input; the
// tools still go through ToolRuntime (permissions, approval, history).
// ─────────────────────────────────────────────────────────────

import type { SkillCatalogEntry } from './mentions';
import type { EventBus } from '../../core/events';
import { isSkillId, SEMVER, SKILL_SCHEMA_VERSION, type InstalledSkill, type SkillErrorCode, type SkillGithubSource, type SkillManifest, type SkillReadiness, type SkillRunRef, type SkillSource, type SkillUpdateState, type ToolRequirement } from '../../domain/skill';
import type { CapabilityId } from '../../domain/capability';
import type { StorageAdapter } from '../../persistence/storage';
import type { ToolRegistry } from '../tools/registry';
import { MAX_OFFERED_TOOLS } from '../tools/service';
import { BUILT_IN_SKILLS } from './builtin';
import { exportBundle, packageFiles, packageHash, reviewPackage, textOf, type PackageFile, type SkillReview, isBundleName } from './package';
import { SkillDependencyResolver, type ResolveContext, type ResolverDeps, type SkillResolution } from './resolver';
import { downloadGithubSkill, folderCommits, githubError, listGithubSkills, newerTag, parseGithubUrl, resolveRef, type GithubRepo, type GithubSkill, type ResolvedRef } from './github';
import type { SkillStore } from './store';
import { fileChanges, sensitiveChanges, type SkillUpdatePlan } from './updates';

const KEY = 'skills';
/** Skills active in one run */
export const MAX_ACTIVE_SKILLS = 3;
/** characters of Skill context per run (Claude Code takes at most 20k of system prompt in all) */
export const SKILL_CONTEXT_BUDGET = 14_000;
const EXAMPLE_BUDGET = 2_000;
/** the read-only tool for Skill resources */
export const SKILL_RESOURCE_TOOL = 'read_skill_resource';
/** GitHub Skills are checked at most once a day by themselves */
export const UPDATE_EVERY_MS = 24 * 60 * 60_000;

/** the automatic update check (GitHub Skills) */
export interface SkillUpdateSettings {
  auto: boolean;
  lastCheck: number;
}

export class SkillError extends Error {
  constructor(
    readonly code: SkillErrorCode,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

export type SkillActivation =
  | {
      ok: true;
      /** structured runtime context, for the system prompt (never the user's message) */
      context: string;
      /** the tools this run may be offered: the Skills' own, then the agent's */
      toolIds: string[];
      refs: SkillRunRef[];
      resolutions: Record<string, SkillResolution>;
    }
  | { ok: false; error: { code: SkillErrorCode; message: string; details?: string[] } };

export interface ActivationContext extends ResolveContext {
  /** the agent's own tools (kept after the Skills' ones, within the limit); when set, a Skill's tools must be among them */
  agentToolIds?: string[];
  /** whether the connection/model can take RealmNest tools at all */
  canUseTools?: boolean;
}

/** what the user may change on a Skill (user-created, or an imported one: then marked modified) */
export interface SkillDraft {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  version?: string;
  requiresCapabilities: CapabilityId[];
  requiresTools: ToolRequirement[];
  optionalTools: ToolRequirement[];
  tags: string[];
  permissions?: string[];
}

export interface InstallOptions {
  /** replace an installed Skill with the same id (the UI asks first) */
  replace?: boolean;
  /** what the user mapped on the review screen for a non-RealmNest package */
  overrides?: Partial<Pick<SkillManifest, 'id' | 'name' | 'version' | 'requiresCapabilities' | 'requiresTools' | 'optionalTools' | 'tags'>>;
  /** an update keeps the Skill on or off as it was */
  enabled?: boolean;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'skill';

export class SkillService {
  private skills: InstalledSkill[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private updates: SkillUpdateSettings = { auto: true, lastCheck: 0 };
  /** downloaded updates waiting for the user's yes (never installed without it) */
  private plans = new Map<string, { plan: SkillUpdatePlan; review: SkillReview; overrides: InstallOptions['overrides'] }>();
  private checking?: Promise<{ checked: number; available: number; failed: number }>;
  readonly resolver: SkillDependencyResolver;

  constructor(
    private storage: StorageAdapter,
    private store: SkillStore,
    private registry: ToolRegistry,
    deps: Omit<ResolverDeps, 'registry'>,
    private bus?: EventBus,
    private opts: { now?: () => number } = {},
  ) {
    this.resolver = new SkillDependencyResolver({ ...deps, registry });
    // the one tool that reads Skill resources: read-only, offered only with a Skill that has files
    registry.register(
      {
        id: SKILL_RESOURCE_TOOL,
        name: SKILL_RESOURCE_TOOL,
        description: 'Reads a resource file (reference, template, example) of an active Skill. Read-only.',
        source: 'native',
        inputSchema: {
          type: 'object',
          properties: { skill: { type: 'string', maxLength: 100, description: 'the Skill id, e.g. nestra.workspace-note' }, path: { type: 'string', maxLength: 200, description: 'a path listed in the Skill context, e.g. resources/guide.md' } },
          required: ['skill', 'path'],
          additionalProperties: false,
        },
        risk: 'low',
        permissions: {},
        cancellable: true,
        timeoutMs: 10_000,
        version: '1',
        metadata: { skillOnly: 'true' },
      },
      async ({ input }) => {
        try {
          const content = await this.readResource(String(input.skill), String(input.path));
          return { success: true, content };
        } catch (err) {
          return { success: false, error: { code: 'FILE_NOT_FOUND', message: err instanceof Error ? err.message : String(err) } };
        }
      },
    );
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  async init() {
    const raw = await this.storage.get<{ skills?: InstalledSkill[]; updates?: Partial<SkillUpdateSettings> }>(KEY);
    this.updates = { auto: raw?.updates?.auto !== false, lastCheck: Number(raw?.updates?.lastCheck) || 0 };
    const stored = Array.isArray(raw?.skills) ? raw.skills.filter((s) => s?.manifest && isSkillId(s.manifest.id) && typeof s.instructions === 'string') : [];
    // built-ins always match this build; only their on/off state is the user's
    const t = this.now();
    const built = BUILT_IN_SKILLS.map((b) => {
      const prev = stored.find((s) => s.manifest.id === b.manifest.id);
      return { ...b, enabled: prev?.enabled ?? true, installedAt: prev?.installedAt ?? t, updatedAt: t } as InstalledSkill;
    });
    this.skills = [...built, ...stored.filter((s) => s.origin !== 'built_in' && !BUILT_IN_SKILLS.some((b) => b.manifest.id === s.manifest.id))];
    this.changed();
  }

  get storeAvailable() {
    return this.store.available;
  }

  // ── reading ──────────────────────────────────────────────
  list(): InstalledSkill[] {
    return this.skills;
  }
  get(id: string): InstalledSkill | undefined {
    return this.skills.find((s) => s.manifest.id === id);
  }

  resolve(id: string, ctx: ResolveContext = {}): SkillResolution | undefined {
    const s = this.get(id);
    return s && this.resolver.resolve(s.manifest, ctx);
  }

  readiness(id: string, ctx: ResolveContext = {}): SkillReadiness {
    const s = this.get(id);
    if (!s) return 'UNAVAILABLE';
    if (!s.enabled) return 'DISABLED';
    return this.resolver.resolve(s.manifest, ctx).readiness;
  }

  // ── installing ───────────────────────────────────────────
  /** check a package and describe it for the review screen; nothing is kept */
  review(files: PackageFile[], source: Omit<SkillSource, 'format'>): Promise<SkillReview> {
    return reviewPackage(files, source);
  }

  /** download a package (HTTPS, size-capped) and review it */
  async reviewUrl(url: string): Promise<SkillReview> {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') throw new SkillError('SKILL_NOT_FOUND', 'Only https:// addresses are allowed.');
    if (u.username || u.password) throw new SkillError('SKILL_NOT_FOUND', 'Addresses with a user name or password are not allowed.');
    const r = await this.store.fetch(u.toString());
    const name = decodeURIComponent(new URL(r.url).pathname.split('/').pop() || 'SKILL.md');
    // one file: a SKILL.md, or a .realmnest-skill (or legacy .nestra-skill) bundle
    const path = isBundleName(name) ? name : 'SKILL.md';
    return reviewPackage([{ path, bytes: r.bytes }], { kind: 'url', label: `${u.host}${u.pathname}`, url: `${u.origin}${u.pathname}` });
  }

  /** the Skills in a public GitHub repository (or one of its folders) */
  async githubList(url: string) {
    const repo = parseGithubUrl(url);
    if (!repo) throw new SkillError('SKILL_NOT_FOUND', 'Paste the address of a GitHub repository, e.g. https://github.com/anthropics/skills');
    const r = await listGithubSkills(this.fetcher(), repo).catch((e) => Promise.reject(githubError(e)));
    if (!r.skills.length) throw new SkillError('SKILL_NOT_FOUND', 'No folder with a SKILL.md was found there.');
    return r;
  }

  /** download one Skill of a repository and review it like a picked folder; the review keeps where it came from */
  async githubReview(found: { repo: Required<GithubRepo>; at: ResolvedRef }, skill: GithubSkill): Promise<SkillReview> {
    const { repo, at } = found;
    const fetch = this.fetcher();
    const files = await downloadGithubSkill(fetch, repo, skill, at.commit).catch((e) => Promise.reject(githubError(e)));
    // a branch: the folder's newest commit is what a later check compares
    const dirCommit = at.refKind === 'branch' ? (await folderCommits(fetch, repo, at.commit, skill.dir, 1).catch(() => []))[0]?.sha : undefined;
    const github: SkillGithubSource = { owner: repo.owner, repo: repo.repo, ref: at.ref, refKind: at.refKind, dir: skill.dir, commit: at.commit, ...(dirCommit && { dirCommit }) };
    return reviewPackage(files, this.githubSource(github));
  }

  private fetcher() {
    return (u: string) => this.store.fetch(u);
  }

  private githubSource(g: SkillGithubSource): Omit<SkillSource, 'format'> {
    const where = [g.owner, g.repo, g.dir].filter(Boolean).join('/');
    return { kind: 'git', label: where, url: `https://github.com/${g.owner}/${g.repo}/tree/${g.ref}${g.dir ? `/${g.dir}` : ''}`, github: g };
  }

  /** the installed Skill a review would replace, if any */
  existing(review: SkillReview, overrides?: InstallOptions['overrides']) {
    return this.get(overrides?.id ?? review.manifest.id);
  }

  /** keep a reviewed package (the review must have no problems) */
  async install(review: SkillReview, o: InstallOptions = {}): Promise<InstalledSkill> {
    if (review.problems.length) throw new SkillError('SKILL_NOT_READY', 'This package cannot be installed.', review.problems);
    const manifest: SkillManifest = { ...review.manifest, ...o.overrides };
    if (!isSkillId(manifest.id)) throw new SkillError('SKILL_NOT_FOUND', 'The Skill id must look like publisher.skill-name.');
    const prev = this.get(manifest.id);
    if (prev?.origin === 'built_in') throw new SkillError('SKILL_CONFLICT', `${manifest.id} is a built-in Skill and cannot be replaced.`);
    if (prev && !o.replace) throw new SkillError('SKILL_CONFLICT', `${manifest.id} ${prev.manifest.version} is already installed.`);
    // the stored package always carries the final manifest (also when the user mapped requirements)
    const files = packageFiles({ manifest, instructions: review.instructions }, review.files);
    if (files.some((f) => f.path !== 'skill.json' && f.path !== 'SKILL.md') && !this.store.available) throw new SkillError('SKILL_NOT_READY', 'Skills with resource files can be installed only in the desktop app.');
    // replacing: the old files come back if the index cannot be saved (the native write itself swaps folders atomically)
    const oldFiles = prev && this.store.available ? await this.store.read(manifest.id) : undefined;
    if (this.store.available) await this.store.write(manifest.id, files);
    const t = this.now();
    const skill: InstalledSkill = {
      manifest,
      instructions: review.instructions,
      origin: 'imported',
      source: review.source,
      enabled: o.enabled ?? true,
      installedAt: prev?.installedAt ?? t,
      updatedAt: t,
      // the hash of what came in (modification detection); the stored copy differs only by the final manifest
      packageHash: review.hash,
      storeHash: await packageHash(files),
      ...(review.unmappedTools.length && { declaredTools: review.unmappedTools }),
      files: review.fileInfo,
      importNotes: [...review.mapping, ...review.excluded.map((e) => `left out ${e.path}: ${e.reason}`)],
    };
    const before = this.skills;
    this.skills = [...this.skills.filter((s) => s.manifest.id !== manifest.id), skill];
    try {
      await this.save();
    } catch (e) {
      this.skills = before;
      if (this.store.available) await (oldFiles ? this.store.write(manifest.id, oldFiles) : this.store.remove(manifest.id)).catch(() => undefined);
      throw e;
    }
    this.bus?.emit('skill.installed', { skillId: manifest.id, version: manifest.version, origin: 'imported', replaced: !!prev });
    this.changed();
    return skill;
  }

  // ── updates (GitHub Skills; docs/SKILLS.md › Updates) ────
  updateSettings(): SkillUpdateSettings {
    return this.updates;
  }
  async setAutoCheck(auto: boolean) {
    this.updates = { ...this.updates, auto };
    await this.save();
    this.changed();
  }

  /** Skills that came from GitHub (also those installed before RealmNest kept the commit) */
  githubSkills(): InstalledSkill[] {
    return this.skills.filter((s) => s.origin === 'imported' && (s.source.github || (s.source.kind === 'git' && s.source.url && parseGithubUrl(s.source.url))));
  }
  /** Skills with an update waiting for the user */
  withUpdates(): InstalledSkill[] {
    return this.skills.filter((s) => s.update?.available);
  }
  checkingUpdates() {
    return !!this.checking;
  }

  /**
   * Look for updates of GitHub Skills (all, or some): a branch → its folder's newest commit against the
   * installed one; a tag → a newer version tag; a commit → nothing (pinned). Nothing is downloaded or installed.
   */
  checkUpdates(ids?: string[], auto = false) {
    if (this.checking) return this.checking;
    const run = async () => {
      const list = this.githubSkills().filter((s) => !ids || ids.includes(s.manifest.id));
      const fresh: { id: string; name: string }[] = [];
      let failed = 0;
      for (const s of list) {
        const before = s.update?.available;
        let state: SkillUpdateState;
        let github: SkillGithubSource | undefined;
        try {
          ({ github, ...state } = await this.checkOne(s));
        } catch (e) {
          failed++;
          state = { ...(s.update ?? {}), checkedAt: this.now(), error: githubError(e).message };
        }
        if (!this.get(s.manifest.id)) continue;
        const target = (a?: SkillUpdateState['available']) => (a ? (a.kind === 'tag' ? a.tag : a.commit) : '');
        if (state.available && target(state.available) !== target(before)) fresh.push({ id: s.manifest.id, name: s.manifest.name });
        this.skills = this.skills.map((x) => (x.manifest.id === s.manifest.id ? { ...x, update: state, ...(github && { source: { ...x.source, github } }) } : x));
      }
      if (!ids) this.updates = { ...this.updates, lastCheck: this.now() };
      await this.save();
      this.bus?.emit('skill.updates', { available: this.withUpdates().map((s) => s.manifest.id), fresh, auto });
      return { checked: list.length, available: this.withUpdates().length, failed };
    };
    this.checking = run().finally(() => {
      this.checking = undefined;
      this.changed();
    });
    this.changed();
    return this.checking;
  }

  /** one Skill's check; `github` is set when the source was completed (an older install) */
  private async checkOne(s: InstalledSkill): Promise<SkillUpdateState & { github?: SkillGithubSource }> {
    const fetch = this.fetcher();
    const checkedAt = this.now();
    let g = s.source.github;
    let adopted: SkillGithubSource | undefined;
    if (!g) {
      // installed before the commit was kept: find what it follows; on a branch, the files say whether it is the newest
      const p = parseGithubUrl(s.source.url ?? '')!;
      const at = await resolveRef(fetch, p);
      g = { owner: p.owner, repo: p.repo, ref: at.ref, refKind: at.refKind, dir: p.base, commit: at.commit };
      if (at.refKind === 'branch') {
        const head = (await folderCommits(fetch, g, at.ref, g.dir, 1))[0];
        const remote = head && (await this.fetchSkill(g, head.sha));
        if (head && remote?.hash === s.packageHash) g = { ...g, commit: head.sha, dirCommit: head.sha };
      }
      adopted = g;
    }
    if (g.refKind === 'commit') return { checkedAt, ...(adopted && { github: adopted }) };
    if (g.refKind === 'tag') {
      const tag = await newerTag(fetch, g, g.ref);
      return { checkedAt, ...(tag && { available: { kind: 'tag', tag } }), ...(adopted && { github: adopted }) };
    }
    const commits = await folderCommits(fetch, g, g.ref, g.dir, 10);
    const head = commits[0];
    if (!head) throw new Error(`The folder ${g.dir || '(root)'} is not on ${g.ref} any more.`);
    if (head.sha === g.dirCommit) return { checkedAt, ...(adopted && { github: adopted }) };
    const known = g.dirCommit ? commits.findIndex((c) => c.sha === g.dirCommit) : -1;
    return { checkedAt, available: { kind: 'commit', commit: head.sha, commits: known >= 0 ? commits.slice(0, known) : commits, more: known < 0 }, ...(adopted && { github: adopted }) };
  }

  /** a GitHub Skill's files at a commit or ref, reviewed */
  private async fetchSkill(g: SkillGithubSource, at: string): Promise<SkillReview> {
    const fetch = this.fetcher();
    const found = await listGithubSkills(fetch, { owner: g.owner, repo: g.repo, ref: at, base: g.dir });
    const skill = found.skills.find((x) => x.dir === g.dir);
    if (!skill) throw new SkillError('SKILL_NOT_FOUND', `There is no SKILL.md in ${g.dir || 'the repository root'} at ${at.slice(0, 12)} any more.`);
    const files = await downloadGithubSkill(fetch, found.repo, skill, found.at.commit);
    return reviewPackage(files, this.githubSource({ ...g, commit: found.at.commit }));
  }

  /** download the update and describe it (files, commits, sensitive changes, local edits); nothing is installed */
  async prepareUpdate(id: string): Promise<SkillUpdatePlan> {
    const s = this.get(id);
    const g = s?.source.github;
    const available = s?.update?.available;
    if (!s || !g || !available) throw new SkillError('SKILL_NOT_FOUND', 'There is no update for this Skill: check for updates first.');
    try {
      const at = available.kind === 'commit' ? available.commit : available.tag;
      const fetched = await this.fetchSkill(available.kind === 'tag' ? { ...g, ref: available.tag, refKind: 'tag' } : g, at);
      const next: SkillGithubSource = { ...g, ...(available.kind === 'tag' && { ref: available.tag }), commit: fetched.source.github!.commit, ...(available.kind === 'commit' && { dirCommit: available.commit }) };
      const review: SkillReview = { ...fetched, source: { ...fetched.source, ...this.githubSource(next) } };
      // the same Skill: its id, and what the user mapped when the package had no RealmNest manifest
      const overrides: InstallOptions['overrides'] = {
        id,
        ...(review.needsConfirmation && { requiresCapabilities: s.manifest.requiresCapabilities, requiresTools: s.manifest.requiresTools, optionalTools: s.manifest.optionalTools, tags: s.manifest.tags }),
      };
      const after = { ...review.manifest, ...overrides };
      const stored = this.store.available ? await this.store.read(id) : [];
      const localChanges = !!s.modified || (!!s.storeHash && this.store.available && (await packageHash(stored)) !== s.storeHash);
      const plan: SkillUpdatePlan = {
        id,
        name: s.manifest.name,
        from: { ref: g.ref, commit: g.commit, version: s.manifest.version },
        to: { ref: next.ref, commit: next.commit, version: after.version },
        commits: available.kind === 'commit' ? available.commits : [],
        more: available.kind === 'commit' && available.more,
        files: fileChanges({ files: stored, instructions: s.instructions }, { files: review.files, instructions: review.instructions }),
        sensitive: sensitiveChanges({ manifest: s.manifest, declaredTools: s.declaredTools }, { manifest: after, declaredTools: review.unmappedTools }),
        localChanges,
        problems: review.problems,
        warnings: review.warnings,
      };
      this.plans.set(id, { plan, review, overrides });
      return plan;
    } catch (e) {
      throw e instanceof SkillError ? e : githubError(e);
    }
  }

  /** install a prepared update: atomic (the old version stays if anything fails); local edits need `overwriteLocal` */
  async applyUpdate(id: string, o: { overwriteLocal?: boolean } = {}): Promise<InstalledSkill> {
    const p = this.plans.get(id);
    const s = this.get(id);
    if (!p || !s) throw new SkillError('SKILL_NOT_FOUND', 'Review the update first.');
    if (p.plan.problems.length) throw new SkillError('SKILL_NOT_READY', 'This version cannot be installed.', p.plan.problems);
    if (p.plan.localChanges && !o.overwriteLocal) throw new SkillError('SKILL_CONFLICT', 'This Skill was changed here since it was installed: confirm that the update may replace those changes.');
    const installed = await this.install(p.review, { replace: true, overrides: p.overrides, enabled: s.enabled });
    this.plans.delete(id);
    this.bus?.emit('skill.updated', { skillId: id, version: installed.manifest.version });
    this.bus?.emit('skill.updates', { available: this.withUpdates().map((x) => x.manifest.id), fresh: [], auto: false });
    return installed;
  }

  discardUpdate(id: string) {
    this.plans.delete(id);
  }

  /** the automatic check: a few minutes after start, then whenever a day has passed since the last one */
  startAutoCheck(): () => void {
    const tick = () => {
      if (!this.updates.auto || !this.store.available || !this.githubSkills().length || this.now() - this.updates.lastCheck < UPDATE_EVERY_MS) return;
      void this.checkUpdates(undefined, true).catch(() => undefined);
    };
    const first = setTimeout(tick, 3 * 60_000);
    const every = setInterval(tick, 60 * 60_000);
    return () => (clearTimeout(first), clearInterval(every));
  }

  /** a Skill written in RealmNest */
  async create(d: SkillDraft): Promise<InstalledSkill> {
    const id = d.id?.trim() || `user.${slug(d.name)}`;
    if (!isSkillId(id)) throw new SkillError('SKILL_NOT_FOUND', 'The Skill id must look like publisher.skill-name.');
    if (this.get(id)) throw new SkillError('SKILL_CONFLICT', `A Skill with id ${id} already exists.`);
    this.checkDraft(d);
    const t = this.now();
    const skill: InstalledSkill = {
      manifest: this.manifestOf(d, id, d.version ?? '1.0.0'),
      instructions: d.instructions.trim(),
      origin: 'user_created',
      source: { kind: 'created', label: 'Created in RealmNest', format: 'nestra-package' },
      enabled: true,
      installedAt: t,
      updatedAt: t,
      files: [],
    };
    const files = packageFiles(skill, []);
    if (this.store.available) await this.store.write(id, files);
    skill.files = files.map((f) => ({ path: f.path, bytes: f.bytes.length, kind: f.path === 'skill.json' ? 'manifest' : 'instructions' }));
    this.skills = [...this.skills, skill];
    await this.save();
    this.bus?.emit('skill.installed', { skillId: id, version: skill.manifest.version, origin: 'user_created', replaced: false });
    this.changed();
    return skill;
  }

  /** change a Skill's text and requirements (an imported one becomes "modified") */
  async update(id: string, d: SkillDraft) {
    const s = this.get(id);
    if (!s) throw new SkillError('SKILL_NOT_FOUND', `${id} is not installed.`);
    if (s.origin === 'built_in') throw new SkillError('SKILL_CONFLICT', 'Built-in Skills cannot be changed.');
    this.checkDraft(d);
    const next: InstalledSkill = { ...s, manifest: { ...s.manifest, ...this.manifestOf(d, id, d.version ?? s.manifest.version), ...(s.manifest.author && { author: s.manifest.author }) }, instructions: d.instructions.trim(), updatedAt: this.now(), ...(s.origin === 'imported' && { modified: true }) };
    if (this.store.available) {
      const resources = (await this.store.read(id)).filter((f) => f.path !== 'skill.json' && f.path !== 'SKILL.md');
      await this.store.write(id, packageFiles(next, resources));
    }
    this.skills = this.skills.map((x) => (x.manifest.id === id ? next : x));
    await this.save();
    this.bus?.emit('skill.updated', { skillId: id, version: next.manifest.version });
    this.changed();
  }

  private manifestOf(d: SkillDraft, id: string, version: string): SkillManifest {
    return {
      schemaVersion: SKILL_SCHEMA_VERSION,
      id,
      name: d.name.trim().slice(0, 80),
      description: d.description.trim().slice(0, 1024),
      version,
      requiresCapabilities: d.requiresCapabilities,
      requiresTools: d.requiresTools,
      optionalTools: d.optionalTools,
      tags: d.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20),
      ...(d.permissions?.length && { permissions: d.permissions }),
    };
  }

  private checkDraft(d: SkillDraft) {
    if (!d.name.trim()) throw new SkillError('SKILL_NOT_READY', 'A name is required.');
    if (!d.description.trim()) throw new SkillError('SKILL_NOT_READY', 'A description is required.');
    if (!d.instructions.trim()) throw new SkillError('SKILL_NOT_READY', 'Instructions are required.');
    if (d.version && !SEMVER.test(d.version)) throw new SkillError('SKILL_NOT_READY', 'The version must look like 1.0.0.');
  }

  async setEnabled(id: string, enabled: boolean) {
    const s = this.get(id);
    if (!s || s.enabled === enabled) return;
    this.skills = this.skills.map((x) => (x.manifest.id === id ? { ...x, enabled, updatedAt: this.now() } : x));
    await this.save();
    this.bus?.emit('skill.updated', { skillId: id, version: s.manifest.version });
    this.changed();
  }

  /** remove a Skill and its files; agents and history keep their references (shown as unavailable) */
  async uninstall(id: string) {
    const s = this.get(id);
    if (!s) return;
    if (s.origin === 'built_in') throw new SkillError('SKILL_CONFLICT', 'Built-in Skills can be disabled, not uninstalled.');
    if (this.store.available) await this.store.remove(id);
    this.skills = this.skills.filter((x) => x.manifest.id !== id);
    await this.save();
    this.bus?.emit('skill.uninstalled', { skillId: id, version: s.manifest.version });
    this.changed();
  }

  /** a portable `.realmnest-skill` file in Documents\RealmNest Skills */
  async export(id: string): Promise<{ path: string; filename: string }> {
    const s = this.get(id);
    if (!s) throw new SkillError('SKILL_NOT_FOUND', `${id} is not installed.`);
    const resources = this.store.available && s.origin !== 'built_in' ? (await this.store.read(id)).filter((f) => f.path !== 'skill.json' && f.path !== 'SKILL.md') : [];
    const b = exportBundle(s, resources);
    if (b.problems.length) throw new SkillError('SKILL_NOT_READY', 'This Skill cannot be exported as is.', b.problems);
    return { path: await this.store.export(b.filename, b.text), filename: b.filename };
  }

  /** the hash of what is stored now vs at install (detects changes made outside RealmNest) */
  async storedHash(id: string): Promise<string | undefined> {
    if (!this.store.available) return undefined;
    return packageHash(await this.store.read(id));
  }

  async readResource(id: string, path: string): Promise<string> {
    const s = this.get(id);
    if (!s || !s.enabled) throw new Error(`${id} is not an enabled Skill.`);
    const f = s.files.find((x) => x.path === path && (x.kind === 'resource' || x.kind === 'example' || x.kind === 'other'));
    if (!f) throw new Error(`${path} is not a resource of ${id}.`);
    const text = textOf(await this.store.readFile(id, path));
    if (text === undefined) throw new Error(`${path} is not a text file.`);
    return text.slice(0, 64 * 1024);
  }

  /** the enabled Skills, for `@` mentions in a chat and the catalog the model is shown */
  catalog(): SkillCatalogEntry[] {
    return this.list()
      .filter((s) => s.enabled)
      .map((s) => ({ id: s.manifest.id, name: s.manifest.name, description: s.manifest.description }));
  }

  // ── activation ───────────────────────────────────────────
  /** everything a run needs from its Skills, or a structured reason it cannot start */
  activate(skillIds: string[], ctx: ActivationContext = {}): SkillActivation {
    const fail = (code: SkillErrorCode, message: string, details?: string[]): SkillActivation => ({ ok: false, error: { code, message, ...(details && { details }) } });
    const ids = [...new Set(skillIds)];
    if (ids.length > MAX_ACTIVE_SKILLS) return fail('SKILL_TOO_MANY', `At most ${MAX_ACTIVE_SKILLS} Skills can be active in one run (${ids.length} are assigned).`);
    const active: InstalledSkill[] = [];
    const resolutions: Record<string, SkillResolution> = {};
    for (const id of ids) {
      const s = this.get(id);
      if (!s) return fail('SKILL_NOT_FOUND', `The Skill ${id} is not installed any more.`);
      if (!s.enabled) return fail('SKILL_DISABLED', `The Skill ${s.manifest.name} is disabled.`);
      const r = this.resolver.resolve(s.manifest, ctx);
      resolutions[id] = r;
      if (r.readiness === 'NOT_READY')
        return fail(
          'SKILL_NOT_READY',
          `${s.manifest.name} is missing something it needs.`,
          r.items.filter((i) => i.required && i.state !== 'READY').map((i) => `${i.requirement}: ${i.state}${i.note ? ` (${i.note})` : ''}`),
        );
      active.push(s);
    }
    // declared conflicts, either way round
    for (const a of active)
      for (const b of active)
        if (a !== b && a.manifest.conflicts?.includes(b.manifest.id)) return fail('SKILL_CONFLICT', `${a.manifest.name} declares that it must not run together with ${b.manifest.name}.`);

    const required = [...new Set(active.flatMap((s) => resolutions[s.manifest.id].requiredToolIds))];
    // a Skill never grants a tool the agent was not given (docs/HARDENING.md I-5): what it needs must be among the agent's tools
    const granted = ctx.agentToolIds ? new Set(ctx.agentToolIds) : undefined;
    const notGiven = granted ? required.filter((id) => !granted.has(id)) : [];
    if (notGiven.length) return fail('SKILL_NOT_READY', 'The active Skills need tools this agent was not given: allow them in its panel first.', notGiven);
    if (required.length && ctx.canUseTools === false) return fail('SKILL_MODEL_NO_TOOLS', 'The active Skills need tools, but this model cannot call tools.', required);
    const withResources = active.filter((s) => s.files.some((f) => f.kind === 'resource' || f.kind === 'example'));
    const resourceTool = withResources.length && this.registry.available(SKILL_RESOURCE_TOOL) ? [SKILL_RESOURCE_TOOL] : [];
    if (required.length + resourceTool.length > MAX_OFFERED_TOOLS)
      return fail('SKILL_TOOL_LIMIT_EXCEEDED', `The active Skills need ${required.length + resourceTool.length} tools; a model turn can take at most ${MAX_OFFERED_TOOLS}.`, required);
    const optional = active.flatMap((s) => resolutions[s.manifest.id].optionalToolIds).filter((id) => !granted || granted.has(id));
    const toolIds = [...new Set([...required, ...resourceTool, ...optional, ...(ctx.agentToolIds ?? [])])].slice(0, MAX_OFFERED_TOOLS);

    const sections = active.map((s) => this.contextOf(s));
    const context = [
      '# Active Skills',
      `The following Skill${active.length > 1 ? 's are' : ' is'} active for this task. Follow the procedure when it applies; RealmNest still decides which tool calls may run.`,
      ...sections,
    ].join('\n\n');
    if (context.length > SKILL_CONTEXT_BUDGET) return fail('SKILL_CONTEXT_TOO_LARGE', `The active Skills' instructions are ${Math.round(context.length / 1000)}k characters; a run can take at most ${SKILL_CONTEXT_BUDGET / 1000}k.`);
    return { ok: true, context, toolIds, refs: active.map((s) => ({ id: s.manifest.id, version: s.manifest.version, name: s.manifest.name })), resolutions };
  }

  /** one Skill as runtime context: who it is, its instructions, a few examples, its resources */
  private contextOf(s: InstalledSkill): string {
    const m = s.manifest;
    const parts = [`## Skill: ${m.name} (${m.id} ${m.version})`, m.description, s.instructions.trim()];
    let budget = EXAMPLE_BUDGET;
    const examples = (m.examples ?? []).filter((e) => {
      const size = e.input.length + e.procedure.length + 40;
      if (size > budget) return false;
      budget -= size;
      return true;
    });
    if (examples.length) parts.push(['### Examples', ...examples.map((e) => `- Input: ${e.input}\n  Procedure: ${e.procedure}`)].join('\n'));
    const resources = s.files.filter((f) => f.kind === 'resource' || f.kind === 'example');
    if (resources.length)
      parts.push(
        [`### Resources (read-only)`, `Read one with the ${SKILL_RESOURCE_TOOL} tool (skill "${m.id}", path) when the procedure needs it:`, ...resources.slice(0, 40).map((f) => `- ${f.path}`)].join('\n'),
      );
    return parts.filter(Boolean).join('\n\n');
  }

  // ── plumbing ─────────────────────────────────────────────
  private save() {
    // built-ins are code: only their on/off state is stored
    return this.storage.set(KEY, { version: 1, skills: this.skills.map((s) => (s.origin === 'built_in' ? { ...s, instructions: '' } : s)), updates: this.updates });
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
