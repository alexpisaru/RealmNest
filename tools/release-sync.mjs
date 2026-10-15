// Brings an existing release source tree (a Git checkout made by release-files.mjs) in line with the
// development folder's public set: copies new and changed files, removes tracked files that left it.
//   node tools/release-sync.mjs <release tree>
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dest = process.argv[2];
if (!dest || !existsSync(join(dest, '.git'))) throw new Error('give the release tree (a Git checkout)');
const wanted = execFileSync(process.execPath, [join(root, 'tools/release-files.mjs')], { encoding: 'utf8' }).trim().split('\n');
const set = new Set(wanted);
let copied = 0;
let removed = 0;
for (const f of wanted) {
  const from = join(root, ...f.split('/'));
  const to = join(dest, ...f.split('/'));
  if (existsSync(to) && readFileSync(from).equals(readFileSync(to))) continue;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}
const tracked = execFileSync('git', ['-C', dest, 'ls-files'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const f of tracked) if (!set.has(f)) (rmSync(join(dest, ...f.split('/'))), removed++);
console.log(`synced ${dest}: ${copied} copied, ${removed} removed, ${wanted.length} files in the public set`);
