// Character pipeline prototype: can an agent make a new animation through EffectCraft's MCP server?
//
//   npx vite-node tools/charpipe/mcp-demo.ts [alex]        (after npm run character:build)
//
// Plays the part of a future RealmNest agent asked "make Alex wave": it talks JSON-RPC to
// `effectcraft-cli mcp` confined to the build folder (reads) and build/<id>/mcp (writes), so only
// engine commands are allowed (scripts are refused while confined). It opens the x1 template,
// duplicates the idle comp into "wave", keys the far arm, renders a PNG sequence and saves the
// project. The frames then go through the same normaliser and packer as every build.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { contactSheet, normalise, pack, paletteOf } from './frames';
import { readPng, writePng } from './img';
import { BUILD, ROOT, effectcraftCli } from './spec';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--')) ?? 'alex';
const build = join(BUILD, id);
const out = join(build, 'mcp');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'wave', 'raw'), { recursive: true });
const fwd = (p: string) => p.replace(/\\/g, '/');

const proc = spawn(effectcraftCli(), ['mcp', '--automation-read-root', build, '--automation-write-root', out], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map<number, (m: { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: unknown }) => void>();
createInterface({ input: proc.stdout }).on('line', (line) => {
  const m = JSON.parse(line);
  if (m.id !== undefined && pending.has(m.id)) pending.get(m.id)!(m);
});
let next = 1;
function rpc(method: string, params: unknown) {
  const id = next++;
  return new Promise<{ result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: unknown }>((res) => {
    pending.set(id, res);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const log: string[] = [];
async function tool(name: string, args: Record<string, unknown>) {
  const r = await rpc('tools/call', { name, arguments: args });
  const text = r.result?.content?.map((c) => c.text ?? `[${c.type}]`).join(' ') ?? JSON.stringify(r.error);
  const ok = !r.error && !r.result?.isError;
  log.push(`${ok ? '✓' : '✗'} ${name} ${JSON.stringify(args).slice(0, 140)}\n    → ${text.replace(/\s+/g, ' ').slice(0, 200)}`);
  if (!ok) throw new Error(`${name} failed: ${text}`);
  return text;
}

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nestra-charpipe-demo', version: '0' } });
proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

// the request: "an 8-frame wave for Alex", built from the rig's joints
const FPS = 8;
const upper = [-128, -132, -134, -132, -128, -132, -134, -132]; // far arm raised beside the head
const lower = [-30, -10, 10, -10, -30, -10, 10, -10]; // the forearm waves at the elbow
try {
  await tool('open_project', { path: fwd(join(build, 'x1', 'nestra-character-template.ecproj')) });
  // a script would be refused here (confined server): everything below is plain engine commands
  const refused = await rpc('tools/call', { name: 'run_script', arguments: { code: 'app.project.numItems' } });
  log.push(`(expected) run_script while confined → ${refused.result?.isError || refused.error ? 'refused' : 'ALLOWED'}`);
  const dup = JSON.parse(await tool('execute_command', { command: 'project.duplicate', params: { items: ['idle'] } }));
  await tool('execute_command', { command: 'project.rename', params: { item: dup.items?.[0] ?? dup.result?.items?.[0], name: 'wave' } });
  await tool('add_keyframe', { comp: 'wave', layer: 'j_upper_arm_L', path: 'transform/rotation', keys: upper.map((value, f) => ({ time: f / FPS, value })), interpolation: 'hold' });
  await tool('add_keyframe', { comp: 'wave', layer: 'j_lower_arm_L', path: 'transform/rotation', keys: lower.map((value, f) => ({ time: f / FPS, value })), interpolation: 'hold' });
  await tool('execute_command', { command: 'renderQueue.add', params: { comp: 'wave', format: 'png', channels: 'rgba', quality: 'draft', output: fwd(join(out, 'wave', 'raw', 'raw_[###].png')) } });
  await tool('execute_command', { command: 'renderQueue.render', params: { wait: true } });
  await tool('save_project', { path: fwd(join(out, `${id}_wave.ecproj`)) });
} finally {
  proc.stdin.end();
}
console.log(log.join('\n'));

const sprite = readPng(join(build, 'parts', 'default', '_sprite.png'));
const { report, frames } = normalise(join(out, 'wave', 'raw'), join(out, 'wave'), { anim: 'wave', mode: 'mcp/x1', k: 1, w: 80, h: 128, palette: paletteOf(sprite) });
writePng(join(out, 'wave.png'), pack(frames));
writePng(join(ROOT, 'docs/charpipe/img/mcp_wave.png'), contactSheet([frames], 4, 120));
console.log(`wave: ${frames.length} frames, ${report.warnings.length ? report.warnings.join('; ') : 'no corrections needed'} → ${fwd(join(out, 'wave.png'))}`);
