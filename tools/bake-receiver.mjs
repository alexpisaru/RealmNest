// Dev only: saves what the bake and shot helpers (src/dev/bake.ts, shots.ts) POST to
// http://localhost:5199/<name>. Output folder: the first argument, else ./bake-out (git-ignored by hand).
//   node tools/bake-receiver.mjs [out-dir]
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'bake-out');
mkdirSync(out, { recursive: true });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (req.method !== 'POST') return res.writeHead(200, cors).end('receiver up');
  const name = basename(decodeURIComponent(req.url.slice(1))) || 'file.bin';
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    writeFileSync(join(out, name), buf);
    console.log('saved', name, buf.length);
    res.writeHead(200, cors).end('ok');
  });
}).listen(5199, '127.0.0.1', () => console.log('receiver on 5199 ->', out));
