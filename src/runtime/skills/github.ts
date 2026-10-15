// Skills from a GitHub repository: the address of a repo (or a folder in it) → the
// Skills it holds (every folder with a SKILL.md) → one Skill's files, downloaded from
// raw.githubusercontent.com and then reviewed like a picked folder. Public repos only,
// through the same native download as "from URL" (https, size-capped, public addresses).
// Only files a Skill may contain are downloaded (no scripts, no executables).

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

type Fetch = (url: string) => Promise<{ bytes: Uint8Array; url: string }>;

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

/** the Skills in a repository (or under one of its folders) */
export async function listGithubSkills(fetch: Fetch, repo: GithubRepo): Promise<{ repo: Required<GithubRepo>; skills: GithubSkill[]; truncated: boolean }> {
  let ref = repo.ref;
  if (!ref) {
    const info = json((await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`)).bytes);
    ref = typeof info.default_branch === 'string' ? info.default_branch : 'main';
  }
  const tree = json((await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)).bytes);
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
  return { repo: { ...repo, ref, base }, skills, truncated: tree.truncated === true };
}

/** one Skill's files, as a picked folder would give them (`<folder>/SKILL.md`, …) */
export async function downloadGithubSkill(fetch: Fetch, repo: Required<GithubRepo>, skill: GithubSkill): Promise<PackageFile[]> {
  const total = skill.files.reduce((n, f) => n + f.size, 0);
  if (total > SKILL_LIMITS.totalBytes) throw new Error(`This Skill is ${(total / 1024 / 1024).toFixed(1)} MB: too large to install.`);
  const prefix = skill.dir ? `${skill.dir}/` : '';
  const out: PackageFile[] = [];
  for (const f of skill.files) {
    const r = await fetch(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${enc(repo.ref)}/${enc(f.path)}`);
    out.push({ path: `${skill.name}/${f.path.slice(prefix.length)}`, bytes: r.bytes });
  }
  return out;
}
