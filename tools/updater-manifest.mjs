// The updater's manifest for a release (docs/UPDATES.md): latest.json, uploaded to the GitHub release
// next to the installer and its signature. Installed RealmNest reads it from
// https://github.com/alexpisaru/RealmNest/releases/latest/download/latest.json.
//   node tools/updater-manifest.mjs <installer.exe> [notes.md]
// The installer must have been built with the signing key (TAURI_SIGNING_PRIVATE_KEY), which writes
// <installer>.exe.sig next to it. The version comes from the installer's name.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const REPO = 'alexpisaru/RealmNest';
const [installer, notesFile] = process.argv.slice(2);
if (!installer || !existsSync(installer)) throw new Error('give the installer (.exe) built with the signing key');
const sigFile = `${installer}.sig`;
if (!existsSync(sigFile)) throw new Error(`${basename(sigFile)} is missing: build with TAURI_SIGNING_PRIVATE_KEY set`);
const name = basename(installer);
const version = /_(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)_/.exec(name)?.[1];
if (!version) throw new Error(`no version in ${name} (expected RealmNest-OS_<version>_x64-setup.exe)`);
// the notes shown in the app ("What's new"): the release notes without their first heading, up to the
// Install section, at most 4,000 characters cut at a line end
function appNotes(text) {
  const body = text.replace(/\r\n/g, '\n').replace(/^#[^\n]*\n+/, '').split(/\n## Install\b/)[0].trim();
  if (body.length <= 4000) return body;
  return body.slice(0, body.lastIndexOf('\n', 4000)).trim();
}
const notes = notesFile && existsSync(notesFile) ? appNotes(readFileSync(notesFile, 'utf8')) : `RealmNest OS ${version}`;
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(sigFile, 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(name)}`,
    },
  },
};
const out = join(dirname(installer), 'latest.json');
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${out} for ${version}`);
