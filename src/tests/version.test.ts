import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NEWS } from '../ui/news';
import { APP_VERSION } from '../version';

// One version everywhere (docs/HARDENING.md L-1): package.json is the source; What's new starts with
// it; the exe's numeric version (tauri.conf.json, Cargo.toml) is the same without the "-beta" tag.
describe('version', () => {
  it("package.json, What's new, tauri.conf.json and Cargo.toml agree", () => {
    const numeric = APP_VERSION.replace(/-.*$/, '');
    expect(NEWS[0].version).toBe(APP_VERSION);
    expect(JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version).toBe(numeric);
    const cargo = /^version = "([^"]+)"$/m.exec(readFileSync('src-tauri/Cargo.toml', 'utf8'));
    expect(cargo?.[1]).toBe(numeric);
  });
});
