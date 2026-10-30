// Skills from a GitHub repository: the address of a repo (or a folder in it) → the
// Skills it holds (every folder with a SKILL.md) → one Skill's files, downloaded from
// raw.githubusercontent.com and then reviewed like a picked folder. Public repos only,
// through the same native download as "from URL" (https, size-capped, public addresses).
// Only files a Skill may contain are downloaded (no scripts, no executables).
// Every Skill keeps where it came from (repo, ref and its kind, folder, commit), so
// RealmNest can look for a newer version later (docs/SKILLS.md › Updates).

import { compareVersions, SEMVER, type SkillGithubSource } from '../../domain/skill';
import { SKILL_LIMITS, type PackageFile } from './package';

export interface GithubRepo {
  owner: string;
  repo: string;
  /** branch, tag or commit; resolved to the default branch when the address has none */
  ref?: string;
  /** a folder inside the repo ('' = the whole repo) */
  base: string;
}

export interface GithubSkill {
  /** folder in the repo holding SKILL.md ('' = the repo root) */
  dir: string;
  /** display name: the folder's name */
  name: string;
  /** files to download, relative to the repo */
  files: { path: string; size: number }[];
  /** files left out (scripts, other types), shown in the review */
  skipped: number;
}

export type Fetch = (url: string) => Promise<{ bytes: Uint8Array; url: string }>;

/** what a ref is, and the commit it points at now */
export interface ResolvedRef {
  ref: string;
  refKind: SkillGithubSource['refKind'];
  commit: string;
}

/** one commit, for the list of changes shown before an update */
export interface GithubCommit {
  sha: string;
  /** the first line of the message */
  message: string;
  date?: string;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const ALLOWED = /\.(md|markdown|txt|json|ya?ml|csv|tsv|png|jpe?g|webp|gif)$/i;

/** github.com/owner/repo[/tree|blob/<ref>/<path>] → its parts */
export function parseGithubUrl(raw: string): GithubRepo | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:' || (u.hostname !== 'github.com' && u.hostname !== 'www.github.com')) return undefined;
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [owner, repoRaw, kind, ref, ...rest] = parts;
  const repo = repoRaw?.replace(/\.git$/, '');
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) return undefined;
  if (!kind) return { owner, repo, base: '' };
  if ((kind !== 'tree' && kind !== 'blob') || !ref) return undefined;
  let base = rest.join('/');
  // a link to the SKILL.md itself means its folder
  if (kind === 'blob') base = rest.slice(0, -1).join('/');
  return { owner, repo, ref, base };
}

const json = (b: Uint8Array) => JSON.parse(new TextDecoder().decode(b)) as Record<string, unknown>;
const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/');

const api = (repo: Pick<GithubRepo, 'owner' | 'repo'>, path: string) => `https://api.github.com/repos/${repo.owner}/${repo.repo}${path}`;
const FULL_SHA = /^[0-9a-f]{40}$/;

/** GitHub's answers in words (it limits requests without an account to 60 an hour) */
export function githubError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b(403|429)\b/.test(msg)) return new Error('GitHub is limiting requests from this computer for now: try again in an hour.');
  if (/\b404\b/.test(msg)) return new Error('GitHub did not find it: the repository, branch, tag or folder may have been renamed, deleted or made private.');
  return e instanceof Error ? e : new Error(msg);
}

/** a branch, tag or commit → its kind and the commit it points at (no ref: the default branch) */
export async function resolveRef(fetch: Fetch, repo: Pick<GithubRepo, 'owner' | 'repo' | 'ref'>): Promise<ResolvedRef> {
  let ref = repo.ref;
  if (ref && FULL_SHA.test(ref)) return { ref, refKind: 'commit', commit: ref };
  if (!ref) {
    const info = json((await fetch(api(repo, ''))).bytes);
    ref = typeof info.default_branch === 'string' ? info.default_branch : 'main';
  }
  const tryJson = async (url: string) => {
    try {
      return json((await fetch(url)).bytes);
    } catch {
      return undefined;
    }
  };
  let refKind: ResolvedRef['refKind'] = 'commit';
  if (await tryJson(api(repo, `/git/ref/heads/${enc(ref)}`))) refKind = 'branch';
  else if (await tryJson(api(repo, `/git/ref/tags/${enc(ref)}`))) refKind = 'tag';
  // the commit itself (a tag object or a short sha resolve here too)
  const c = json((await fetch(api(repo, `/commits/${enc(ref)}`))).bytes);
  if (typeof c.sha !== 'string' || !FULL_SHA.test(c.sha)) throw new Error(`${ref} is not a branch, tag or commit of ${repo.owner}/${repo.repo}.`);
  return { ref, refKind, commit: c.sha };
}

/** the newest commits that changed a folder on a ref (newest first); '' = the whole repo */
export async function folderCommits(fetch: Fetch, repo: Pick<GithubRepo, 'owner' | 'repo'>, ref: string, dir: string, n = 10): Promise<GithubCommit[]> {
  const list = JSON.parse(new TextDecoder().decode((await fetch(api(repo, `/commits?sha=${encodeURIComponent(ref)}${dir ? `&path=${encodeURIComponent(dir)}` : ''}&per_page=${n}`))).bytes)) as unknown;
  return (Array.isArray(list) ? list : [])
    .map((c: { sha?: unknown; commit?: { message?: unknown; committer?: { date?: unknown } } }) => ({
      sha: typeof c.sha === 'string' ? c.sha : '',
      message: typeof c.commit?.message === 'string' ? c.commit.message.split('\n')[0].slice(0, 200) : '',
      ...(typeof c.commit?.committer?.date === 'string' && { date: c.commit.committer.date }),
    }))
    .filter((c) => FULL_SHA.test(c.sha));
}

/** a newer version tag than `current` (v1.2.0 > v1.1.0), if the repo has one; tags that are not versions are ignored */
export async function newerTag(fetch: Fetch, repo: Pick<GithubRepo, 'owner' | 'repo'>, current: string): Promise<string | undefined> {
  const ver = (t: string) => (SEMVER.test(t.replace(/^v/i, '')) ? t.replace(/^v/i, '') : undefined);
  const now = ver(current);
  if (!now) return undefined;
  const list = JSON.parse(new TextDecoder().decode((await fetch(api(repo, '/tags?per_page=100'))).bytes)) as unknown;
  const names = (Array.isArray(list) ? list : []).map((t: { name?: unknown }) => (typeof t.name === 'string' ? t.name : '')).filter((t) => ver(t));
  const best = names.sort((a, b) => compareVersions(ver(b)!, ver(a)!))[0];
  return best && compareVersions(ver(best)!, now) > 0 ? best : undefined;
}

/** the Skills in a repository (or under one of its folders), at the commit its ref points at now */
export async function listGithubSkills(fetch: Fetch, repo: GithubRepo): Promise<{ repo: Required<GithubRepo>; at: ResolvedRef; skills: GithubSkill[]; truncated: boolean }> {
  const at = await resolveRef(fetch, repo);
  const ref = at.ref;
  const tree = json((await fetch(api(repo, `/git/trees/${at.commit}?recursive=1`))).bytes);
  const entries = (Array.isArray(tree.tree) ? tree.tree : []) as { path?: string; type?: string; size?: number }[];
  const base = repo.base.replace(/\/+$/, '');
  const inBase = (p: string) => !base || p === base || p.startsWith(`${base}/`);
  const blobs = entries.filter((e) => e.type === 'blob' && typeof e.path === 'string' && inBase(e.path)) as { path: string; size?: number }[];
  const dirs = blobs.filter((b) => b.path.split('/').pop() === 'SKILL.md').map((b) => b.path.split('/').slice(0, -1).join('/'));
  const skills: GithubSkill[] = dirs
    .map((dir) => {
      const prefix = dir ? `${dir}/` : '';
      // the folder's files, not those of a Skill nested inside it
      const own = blobs.filter((b) => b.path.startsWith(prefix) && !dirs.some((d) => d !== dir && d.startsWith(prefix) && b.path.startsWith(`${d}/`)));
      const usable = own.filter((b) => {
        const rel = b.path.slice(prefix.length);
        return ALLOWED.test(rel) && !rel.split('/').includes('scripts') && rel.split('/').length <= SKILL_LIMITS.depth && (b.size ?? 0) <= SKILL_LIMITS.fileBytes;
      });
      return { dir, name: dir.split('/').pop() || repo.repo, files: usable.slice(0, SKILL_LIMITS.files).map((b) => ({ path: b.path, size: b.size ?? 0 })), skipped: own.length - Math.min(usable.length, SKILL_LIMITS.files) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { repo: { ...repo, ref, base }, at, skills, truncated: tree.truncated === true };
}

/** one Skill's files, as a picked folder would give them (`<folder>/SKILL.md`, …), at a commit (default: the ref) */
export async function downloadGithubSkill(fetch: Fetch, repo: Required<GithubRepo>, skill: GithubSkill, commit = repo.ref): Promise<PackageFile[]> {
  const total = skill.files.reduce((n, f) => n + f.size, 0);
  if (total > SKILL_LIMITS.totalBytes) throw new Error(`This Skill is ${(total / 1024 / 1024).toFixed(1)} MB: too large to install.`);
  const prefix = skill.dir ? `${skill.dir}/` : '';
  const out: PackageFile[] = [];
  for (const f of skill.files) {
    const r = await fetch(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${enc(commit)}/${enc(f.path)}`);
    out.push({ path: `${skill.name}/${f.path.slice(prefix.length)}`, bytes: r.bytes });
  }
  return out;
}
