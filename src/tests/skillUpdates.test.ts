import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { DesktopNotifier, type NotifyTransport } from '../runtime/notify/service';
import { packageHash, reviewPackage, utf8 } from '../runtime/skills/package';
import { SkillService } from '../runtime/skills/service';
import { MemorySkillStore } from '../runtime/skills/store';
import { fileChanges, lineDiff, sensitiveChanges, toolArea } from '../runtime/skills/updates';
import { ToolRegistry } from '../runtime/tools/registry';

// Updates of Skills installed from GitHub (docs/SKILLS.md › Updates): provenance kept at install,
// branch / tag / commit checks, the review of what changes, atomic install, local edits.

const sha = (n: number) => n.toString(16).padStart(40, '0');
const enc = (s: string) => new TextEncoder().encode(s);
const skillMd = (body: string, tools?: string) => `---\nname: pdf\ndescription: Work with PDF files\n${tools ? `allowed-tools: ${tools}\n` : ''}---\n${body}\n`;

/** a tiny GitHub: commits with their whole file tree, branches and tags, and the REST/raw endpoints a check uses */
class FakeGithub {
  commits = new Map<string, { files: Record<string, string>; message: string; parent?: string; date: string }>();
  branches: Record<string, string> = {};
  tags: Record<string, string> = {};
  asked: string[] = [];
  down = false;
  private n = 0;
  commit(branch: string, message: string, change: Record<string, string | null>) {
    const parent = this.branches[branch];
    const files = { ...(parent ? this.commits.get(parent)!.files : {}) };
    for (const [p, v] of Object.entries(change)) if (v === null) delete files[p];
    else files[p] = v;
    const id = sha(++this.n);
    this.commits.set(id, { files, message, ...(parent && { parent }), date: `2026-10-${String(this.n).padStart(2, '0')}T10:00:00Z` });
    this.branches[branch] = id;
    return id;
  }
  private resolve(ref: string) {
    return this.branches[ref] ?? this.tags[ref] ?? (this.commits.has(ref) ? ref : undefined);
  }
  fetch = async (url: string) => {
    this.asked.push(url);
    if (this.down) throw new Error('the server answered 503');
    const ok = (v: unknown) => ({ bytes: enc(typeof v === 'string' ? v : JSON.stringify(v)), url });
    const raw = /^https:\/\/raw\.githubusercontent\.com\/acme\/skills\/([0-9a-f]{40})\/(.+)$/.exec(url);
    if (raw) {
      const text = this.commits.get(raw[1])?.files[decodeURIComponent(raw[2])];
      if (text === undefined) throw new Error('the server answered 404');
      return ok(text);
    }
    const u = new URL(url);
    const path = u.pathname.replace('/repos/acme/skills', '');
    if (path === '') return ok({ default_branch: 'main' });
    let m = /^\/git\/ref\/(heads|tags)\/(.+)$/.exec(path);
    if (m) {
      const target = (m[1] === 'heads' ? this.branches : this.tags)[decodeURIComponent(m[2])];
      if (!target) throw new Error('the server answered 404');
      return ok({ object: { sha: target } });
    }
    if (path === '/commits') {
      let at: string | undefined = this.resolve(u.searchParams.get('sha')!);
      const dir = u.searchParams.get('path') ?? '';
      const n = Number(u.searchParams.get('per_page'));
      const out: unknown[] = [];
      const inDir = (files: Record<string, string>) => JSON.stringify(Object.entries(files).filter(([p]) => !dir || p.startsWith(`${dir}/`)));
      while (at && out.length < n) {
        const c: { files: Record<string, string>; message: string; parent?: string; date: string } = this.commits.get(at)!;
        if (!c.parent || inDir(c.files) !== inDir(this.commits.get(c.parent)!.files)) out.push({ sha: at, commit: { message: `${c.message}\n\nbody`, committer: { date: c.date } } });
        at = c.parent;
      }
      return ok(out);
    }
    m = /^\/commits\/(.+)$/.exec(path);
    if (m) {
      const at = this.resolve(decodeURIComponent(m[1]));
      if (!at) throw new Error('the server answered 404');
      return ok({ sha: at });
    }
    m = /^\/git\/trees\/([0-9a-f]{40})$/.exec(path);
    if (m) return ok({ truncated: false, tree: Object.entries(this.commits.get(m[1])!.files).map(([p, v]) => ({ path: p, type: 'blob', size: v.length })) });
    if (path === '/tags') return ok(Object.keys(this.tags).map((name) => ({ name })));
    throw new Error(`the server answered 404 (${url})`);
  };
}

async function setup(gh: FakeGithub, storage = new MemoryAdapter()) {
  const store = new MemorySkillStore();
  store.fetch = gh.fetch;
  const bus = new EventBus();
  const events: { available: string[]; fresh: { id: string; name: string }[] }[] = [];
  bus.on('skill.updates', (p) => events.push(p));
  let now = 1_000_000;
  const skills = new SkillService(storage, store, new ToolRegistry(), { permission: () => 'allow', mcpServers: () => [] }, bus, { now: () => now });
  await skills.init();
  const install = async (url: string, dir = 'skills/pdf') => {
    const found = await skills.githubList(url);
    const review = await skills.githubReview(found, found.skills.find((s) => s.dir === dir)!);
    return skills.install(review, { overrides: { id: 'acme.pdf' } });
  };
  return { skills, store, bus, events, install, storage, later: (ms: number) => (now += ms) };
}

const repo = () => {
  const gh = new FakeGithub();
  gh.commit('main', 'add pdf', { 'README.md': '# Skills', 'skills/pdf/SKILL.md': skillMd('# PDF\n\nRead PDF forms.'), 'skills/pdf/reference.md': '# Reference\n' });
  return gh;
};

describe('Skill updates from GitHub', () => {
  it('keeps repo, ref and its kind, folder and commit; a branch change outside the folder is not an update', async () => {
    const gh = repo();
    const first = gh.branches.main;
    const { skills, install } = await setup(gh);
    const s = await install('https://github.com/acme/skills');
    expect(s.source.github).toEqual({ owner: 'acme', repo: 'skills', ref: 'main', refKind: 'branch', dir: 'skills/pdf', commit: first, dirCommit: first });
    // the files came from the commit, not from the moving branch name
    expect(gh.asked.filter((u) => u.includes('raw.githubusercontent.com')).every((u) => u.includes(first))).toBe(true);
    gh.commit('main', 'docs', { 'README.md': '# Skills, now with more' });
    expect(await skills.checkUpdates()).toMatchObject({ checked: 1, available: 0, failed: 0 });
    expect(skills.get('acme.pdf')!.update).toMatchObject({ checkedAt: expect.any(Number) });
    expect(skills.get('acme.pdf')!.update!.available).toBeUndefined();
  });

  it('a new commit in the folder: listed with its message, reviewed (files, sensitive changes), installed only on yes', async () => {
    const gh = repo();
    const { skills, install, store, events } = await setup(gh);
    await install('https://github.com/acme/skills/tree/main/skills/pdf');
    await skills.setEnabled('acme.pdf', false);
    gh.commit('main', 'fill forms too', { 'skills/pdf/SKILL.md': skillMd('# PDF\n\nRead PDF forms.\nFill them in.', 'WebFetch, Read'), 'skills/pdf/forms.md': '# Forms\nfield list\n', 'skills/pdf/reference.md': null });
    const head = gh.branches.main;
    await skills.checkUpdates();
    const u = skills.get('acme.pdf')!.update!;
    expect(u.available).toMatchObject({ kind: 'commit', commit: head, more: false });
    expect(u.available?.kind === 'commit' && u.available.commits.map((c) => c.message)).toEqual(['fill forms too']);
    expect(skills.withUpdates().map((s) => s.manifest.id)).toEqual(['acme.pdf']);
    // found once: a second check does not announce it again
    await skills.checkUpdates();
    expect(events.map((e) => e.fresh.length)).toEqual([1, 0]);

    const plan = await skills.prepareUpdate('acme.pdf');
    // nothing installed yet
    expect(skills.get('acme.pdf')!.source.github!.commit).not.toBe(head);
    expect(plan.files).toEqual([
      { path: 'SKILL.md', change: 'changed', plus: 1, minus: 0 },
      { path: 'forms.md', change: 'added', plus: 3, minus: 0 },
      { path: 'reference.md', change: 'removed', plus: 0, minus: 2 },
    ]);
    expect(plan.sensitive).toEqual([
      { area: 'network', change: 'added', what: 'WebFetch' },
      { area: 'filesystem', change: 'added', what: 'Read' },
    ]);
    expect(plan.localChanges).toBe(false);

    const s = await skills.applyUpdate('acme.pdf');
    expect(s.manifest.id).toBe('acme.pdf');
    expect(s.enabled).toBe(false);
    expect(s.source.github).toMatchObject({ ref: 'main', commit: head, dirCommit: head });
    expect(s.update).toBeUndefined();
    expect(s.instructions).toContain('Fill them in.');
    expect((await store.read('acme.pdf')).map((f) => f.path).sort()).toEqual(['SKILL.md', 'forms.md', 'skill.json']);
    expect(skills.withUpdates()).toEqual([]);
  });

  it('a tag is pinned: only a newer version tag is reported; a commit is never updated', async () => {
    const gh = repo();
    gh.tags['v1.0.0'] = gh.branches.main;
    const { skills, install } = await setup(gh);
    const s = await install('https://github.com/acme/skills/tree/v1.0.0/skills/pdf');
    expect(s.source.github).toMatchObject({ ref: 'v1.0.0', refKind: 'tag' });
    gh.commit('main', 'next', { 'skills/pdf/SKILL.md': skillMd('# PDF v2') });
    await skills.checkUpdates();
    expect(skills.get('acme.pdf')!.update!.available).toBeUndefined();
    gh.tags['v1.1.0'] = gh.branches.main;
    gh.tags['nightly'] = gh.branches.main;
    await skills.checkUpdates();
    expect(skills.get('acme.pdf')!.update!.available).toEqual({ kind: 'tag', tag: 'v1.1.0' });
    const plan = await skills.prepareUpdate('acme.pdf');
    expect(plan.to).toMatchObject({ ref: 'v1.1.0', commit: gh.tags['v1.1.0'] });
    await skills.applyUpdate('acme.pdf');
    expect(skills.get('acme.pdf')!.source.github).toMatchObject({ ref: 'v1.1.0', refKind: 'tag', commit: gh.tags['v1.1.0'] });

    const pinned = repo();
    const at = pinned.branches.main;
    const b = await setup(pinned);
    const p = await b.install(`https://github.com/acme/skills/tree/${at}/skills/pdf`);
    expect(p.source.github).toMatchObject({ ref: at, refKind: 'commit', commit: at });
    pinned.commit('main', 'next', { 'skills/pdf/SKILL.md': skillMd('# PDF v2') });
    const asked = pinned.asked.length;
    await b.skills.checkUpdates();
    expect(b.skills.get('acme.pdf')!.update!.available).toBeUndefined();
    // a pinned commit is not even looked up
    expect(pinned.asked.length).toBe(asked);
  });

  it('local changes: edited in RealmNest or on disk, the update asks to replace them', async () => {
    const gh = repo();
    const { skills, install, store } = await setup(gh);
    await install('https://github.com/acme/skills');
    gh.commit('main', 'v2', { 'skills/pdf/SKILL.md': skillMd('# PDF v2') });
    await skills.checkUpdates();
    expect((await skills.prepareUpdate('acme.pdf')).localChanges).toBe(false);
    // a file changed outside RealmNest
    const files = await store.read('acme.pdf');
    await store.write('acme.pdf', files.map((f) => (f.path === 'reference.md' ? { ...f, bytes: utf8('# Mine\n') } : f)));
    expect((await skills.prepareUpdate('acme.pdf')).localChanges).toBe(true);
    await expect(skills.applyUpdate('acme.pdf')).rejects.toThrow(/changed here/);
    expect(skills.get('acme.pdf')!.instructions).not.toContain('v2');
    await skills.applyUpdate('acme.pdf', { overwriteLocal: true });
    expect(skills.get('acme.pdf')!.instructions).toContain('v2');
    expect(skills.get('acme.pdf')!.modified).toBeUndefined();

    // edited in RealmNest
    gh.commit('main', 'v3', { 'skills/pdf/SKILL.md': skillMd('# PDF v3') });
    const s = skills.get('acme.pdf')!;
    await skills.update('acme.pdf', { name: s.manifest.name, description: s.manifest.description, instructions: 'my own', requiresCapabilities: [], requiresTools: [], optionalTools: [], tags: [] });
    await skills.checkUpdates();
    expect((await skills.prepareUpdate('acme.pdf')).localChanges).toBe(true);
  });

  it('atomic: a failed download or save leaves the installed Skill as it was', async () => {
    const gh = repo();
    const storage = new MemoryAdapter();
    const { skills, install, store } = await setup(gh, storage);
    await install('https://github.com/acme/skills');
    const before = await packageHash(await store.read('acme.pdf'));
    gh.commit('main', 'v2', { 'skills/pdf/SKILL.md': skillMd('# PDF v2') });
    await skills.checkUpdates();
    gh.down = true;
    await expect(skills.prepareUpdate('acme.pdf')).rejects.toThrow(/503/);
    gh.down = false;
    await skills.prepareUpdate('acme.pdf');
    const set = storage.set.bind(storage);
    storage.set = async () => {
      throw new Error('disk full');
    };
    await expect(skills.applyUpdate('acme.pdf')).rejects.toThrow(/disk full/);
    storage.set = set;
    expect(skills.get('acme.pdf')!.instructions).not.toContain('v2');
    expect(await packageHash(await store.read('acme.pdf'))).toBe(before);
    // and the update is still there to try again
    await skills.applyUpdate('acme.pdf');
    expect(skills.get('acme.pdf')!.instructions).toContain('v2');
  });

  it('a check that fails keeps the error on the Skill; GitHub limits are said in words', async () => {
    const gh = repo();
    const { skills, install, store } = await setup(gh);
    await install('https://github.com/acme/skills');
    store.fetch = async () => {
      throw new Error('the server answered 403');
    };
    expect(await skills.checkUpdates()).toMatchObject({ failed: 1 });
    expect(skills.get('acme.pdf')!.update!.error).toMatch(/limiting requests/);
  });

  it('a Skill installed before the commit was kept: the first check compares its files, then follows the folder', async () => {
    const gh = repo();
    const { skills } = await setup(gh);
    // what 0.13 kept: a git source with its address, no commit
    const files = [
      { path: 'pdf/SKILL.md', bytes: enc(gh.commits.get(gh.branches.main)!.files['skills/pdf/SKILL.md']) },
      { path: 'pdf/reference.md', bytes: enc('# Reference\n') },
    ];
    const review = await reviewPackage(files, { kind: 'git', label: 'acme/skills/skills/pdf', url: 'https://github.com/acme/skills/tree/main/skills/pdf' });
    await skills.install(review, { overrides: { id: 'acme.pdf' } });
    expect(skills.githubSkills().map((s) => s.manifest.id)).toEqual(['acme.pdf']);
    await skills.checkUpdates();
    expect(skills.get('acme.pdf')!.update!.available).toBeUndefined();
    expect(skills.get('acme.pdf')!.source.github).toMatchObject({ refKind: 'branch', dir: 'skills/pdf', dirCommit: gh.branches.main });
    gh.commit('main', 'v2', { 'skills/pdf/SKILL.md': skillMd('# PDF v2') });
    await skills.checkUpdates();
    expect(skills.get('acme.pdf')!.update!.available).toMatchObject({ kind: 'commit', commit: gh.branches.main });
  });

  it('the daily check runs only when a day has passed and it is on', async () => {
    const gh = repo();
    const { skills, install, later } = await setup(gh);
    await install('https://github.com/acme/skills');
    await skills.checkUpdates();
    const at = skills.updateSettings().lastCheck;
    expect(at).toBeGreaterThan(0);
    // a single Skill's check does not move the daily clock
    later(1000);
    await skills.checkUpdates(['acme.pdf']);
    expect(skills.updateSettings().lastCheck).toBe(at);
    await skills.setAutoCheck(false);
    expect(skills.updateSettings()).toMatchObject({ auto: false });
  });
});

describe('what an update changes', () => {
  it('lines, files and access', () => {
    expect(lineDiff('a\nb\nc', 'a\nc\nd\ne')).toEqual({ plus: 2, minus: 1 });
    // a binary file: changed, without line counts
    expect(fileChanges({ files: [{ path: 'x.png', bytes: new Uint8Array([0x89, 0xff, 1]) }], instructions: 'same' }, { files: [{ path: 'x.png', bytes: new Uint8Array([0x89, 0xff, 2]) }], instructions: 'same' })).toEqual([{ path: 'x.png', change: 'changed' }]);
    expect(toolArea({ mcpServer: 'figma', tool: 'get_file' })).toBe('mcp');
    expect(toolArea('mcp.photocraft.doc_open')).toBe('mcp');
    expect(toolArea('web_fetch')).toBe('network');
    expect(toolArea('write_text_file')).toBe('filesystem');
    expect(toolArea('Bash')).toBe('filesystem');
    const m = { schemaVersion: 1, id: 'a.b', name: 'b', description: 'd', version: '1.0.0', requiresCapabilities: [], requiresTools: [], optionalTools: [], tags: [] };
    expect(
      sensitiveChanges(
        { manifest: { ...m, requiresCapabilities: ['text.chat'], permissions: ['reads files'] } },
        { manifest: { ...m, requiresCapabilities: ['web.search'], requiresTools: ['write_text_file'], permissions: ['reads files', 'sends e-mail'] } },
      ),
    ).toEqual([
      { area: 'network', change: 'added', what: 'web.search' },
      { area: 'filesystem', change: 'added', what: 'write_text_file' },
      { area: 'permission', change: 'added', what: 'sends e-mail' },
      { area: 'capability', change: 'removed', what: 'text.chat' },
    ]);
  });

  it('a Windows notification when the check finds updates (once), opening the Skills screen', async () => {
    const shown: { title: string; body: string; tag: string }[] = [];
    const transport: NotifyTransport = { available: true, show: async (title, body, tag) => void shown.push({ title, body, tag }), onClick: () => undefined };
    const bus = new EventBus();
    const n = new DesktopNotifier({
      bus,
      storage: new MemoryAdapter(),
      transport,
      t: () => (k, v) => `${k}${v ? ` ${JSON.stringify(v)}` : ''}`,
      agentName: () => undefined,
      task: () => undefined,
      approval: () => undefined,
      crew: () => undefined,
      workflow: () => undefined,
      research: () => undefined,
      open: () => undefined,
    });
    await n.init();
    bus.emit('skill.updates', { available: ['acme.pdf'], fresh: [], auto: true });
    bus.emit('skill.updates', { available: ['acme.pdf', 'acme.docx'], fresh: [{ id: 'acme.pdf', name: 'pdf' }, { id: 'acme.docx', name: 'docx' }], auto: true });
    expect(shown).toEqual([{ title: 'nt.skillUpdates {"n":2}', body: 'pdf, docx', tag: 'skills:updates' }]);
    await n.setSettings({ updates: false });
    bus.emit('skill.updates', { available: ['acme.x'], fresh: [{ id: 'acme.x', name: 'x' }], auto: true });
    expect(shown.length).toBe(1);
  });
});
