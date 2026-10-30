import { describe, expect, it } from 'vitest';
import { mcpHeaderVar, mcpUrlProblem } from '../domain/mcp';
import { validateServerInput } from '../runtime/mcp/manager';
import { downloadGithubSkill, listGithubSkills, parseGithubUrl } from '../runtime/skills/github';
import { reviewPackage } from '../runtime/skills/package';

// Skills from GitHub (a repo → its SKILL.md folders → one Skill's files) and the
// configuration of online MCP servers.

const enc = (s: string) => new TextEncoder().encode(s);
const HEAD = 'c0ffee'.padEnd(40, '0');

describe('Skills from GitHub', () => {
  it('reads repository, folder and file addresses', () => {
    expect(parseGithubUrl('https://github.com/anthropics/skills')).toEqual({ owner: 'anthropics', repo: 'skills', base: '' });
    expect(parseGithubUrl('https://github.com/anthropics/skills.git')).toMatchObject({ repo: 'skills' });
    expect(parseGithubUrl('https://github.com/anthropics/skills/tree/main/skills/pdf')).toEqual({ owner: 'anthropics', repo: 'skills', ref: 'main', base: 'skills/pdf' });
    expect(parseGithubUrl('https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md')).toEqual({ owner: 'anthropics', repo: 'skills', ref: 'main', base: 'skills/pdf' });
    for (const bad of ['http://github.com/a/b', 'https://gitlab.com/a/b', 'https://github.com/a', 'https://github.com/a/b/issues/1', 'not a url']) expect(parseGithubUrl(bad), bad).toBeUndefined();
  });

  it('finds every folder with a SKILL.md, leaves scripts out, downloads one as a folder', async () => {
    const tree = {
      truncated: false,
      tree: [
        { path: 'README.md', type: 'blob', size: 10 },
        { path: 'skills/pdf/SKILL.md', type: 'blob', size: 120 },
        { path: 'skills/pdf/reference.md', type: 'blob', size: 50 },
        { path: 'skills/pdf/scripts/fill.py', type: 'blob', size: 900 },
        { path: 'skills/pdf/logo.png', type: 'blob', size: 30 },
        { path: 'skills/brand/SKILL.md', type: 'blob', size: 80 },
        { path: 'skills/brand/tool.exe', type: 'blob', size: 5 },
        { path: 'skills', type: 'tree' },
      ],
    };
    const files: Record<string, string> = {
      'https://api.github.com/repos/acme/skills': JSON.stringify({ default_branch: 'main' }),
      'https://api.github.com/repos/acme/skills/git/ref/heads/main': JSON.stringify({ object: { sha: HEAD } }),
      'https://api.github.com/repos/acme/skills/commits/main': JSON.stringify({ sha: HEAD }),
      [`https://api.github.com/repos/acme/skills/git/trees/${HEAD}?recursive=1`]: JSON.stringify(tree),
      [`https://raw.githubusercontent.com/acme/skills/${HEAD}/skills/pdf/SKILL.md`]: '---\nname: pdf\ndescription: Work with PDF files\n---\n# PDF\n\nRead and fill PDF forms.\n',
      [`https://raw.githubusercontent.com/acme/skills/${HEAD}/skills/pdf/reference.md`]: '# Reference\n',
      [`https://raw.githubusercontent.com/acme/skills/${HEAD}/skills/pdf/logo.png`]: 'PNG',
    };
    const asked: string[] = [];
    const fetch = async (url: string) => {
      asked.push(url);
      if (!(url in files)) throw new Error(`404 ${url}`);
      return { bytes: enc(files[url]), url };
    };
    const r = await listGithubSkills(fetch, parseGithubUrl('https://github.com/acme/skills')!);
    expect(r.repo.ref).toBe('main');
    // the branch is read at one commit: every file comes from it, even if the branch moves meanwhile
    expect(r.at).toEqual({ ref: 'main', refKind: 'branch', commit: HEAD });
    expect(r.skills.map((s) => [s.name, s.dir, s.files.map((f) => f.path), s.skipped])).toEqual([
      ['brand', 'skills/brand', ['skills/brand/SKILL.md'], 1],
      ['pdf', 'skills/pdf', ['skills/pdf/SKILL.md', 'skills/pdf/reference.md', 'skills/pdf/logo.png'], 1],
    ]);
    const pdf = r.skills.find((s) => s.name === 'pdf')!;
    const got = await downloadGithubSkill(fetch, r.repo, pdf, r.at.commit);
    expect(got.map((f) => f.path)).toEqual(['pdf/SKILL.md', 'pdf/reference.md', 'pdf/logo.png']);
    expect(asked.some((u) => u.includes('scripts'))).toBe(false);
    const review = await reviewPackage(got, { kind: 'git', label: 'acme/skills/skills/pdf' });
    expect(review.problems).toEqual([]);
    expect(review.manifest).toMatchObject({ description: 'Work with PDF files' });
  });
});

describe('online MCP servers', () => {
  it('addresses: https anywhere, http only on this computer', () => {
    expect(mcpUrlProblem('https://mcp.example.com/mcp')).toBeUndefined();
    expect(mcpUrlProblem('http://127.0.0.1:3845/mcp')).toBeUndefined();
    expect(mcpUrlProblem('http://mcp.example.com/mcp')).toMatch(/https/);
    expect(mcpUrlProblem('https://u:p@mcp.example.com/')).toMatch(/header/);
    expect(mcpUrlProblem('nope')).toBeTruthy();
  });

  it('the form: secret headers, reserved names refused, no executable needed', () => {
    const base = { name: 'Figma', transport: 'http' as const, url: 'https://mcp.example.com/mcp', command: '', args: [], env: {}, secretEnv: [] };
    expect(validateServerInput({ ...base, secretHeaders: ['Authorization'] })).toBeUndefined();
    expect(validateServerInput({ ...base, secretHeaders: ['Host'] })).toMatch(/header/);
    expect(validateServerInput({ ...base, secretHeaders: ['Authorization', 'authorization'] })).toMatch(/twice/);
    expect(validateServerInput({ ...base, url: 'http://evil.example/' })).toMatch(/https/);
    expect(mcpHeaderVar('X-Api-Key')).toBe('HDR_X_API_KEY');
  });
});
