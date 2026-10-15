// ─────────────────────────────────────────────────────────────
// Dev-server process host: a Vite plugin that lets the RealmNest page (and only
// it) run allowlisted local programs through NodeProcessRunner.
//
// A local HTTP endpoint that starts processes is dangerous if anything else
// can reach it, so every request must pass:
//   • Host header = localhost / 127.0.0.1 / [::1]   (defeats DNS rebinding)
//   • Origin, when sent, on the same local host      (no cross-site requests)
//   • the random per-start token, injected into index.html only
//   • the program's own allowlist (program id, arguments, cwd)
// Vite serves it only in `serve` mode; production builds contain none of it.
// ─────────────────────────────────────────────────────────────

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { BRIDGE_HEADER, BRIDGE_META, BRIDGE_PATH, type BridgeMessage, type BridgeRunRequest } from '../protocol';
import { NodeProcessRunner, type HostProgram } from './runner';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_BODY = 25_000_000; // a prompt plus chat attachments

const hostnameOf = (hostHeader: string | undefined) => {
  if (!hostHeader) return '';
  return hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
};

/** Returns the reason a request is refused, or null. Exported for tests. */
export function checkRequest(req: Pick<IncomingMessage, 'method' | 'headers'>, token: string): string | null {
  if (req.method !== 'POST') return 'method not allowed';
  const host = hostnameOf(req.headers.host);
  if (!LOCAL_HOSTS.has(host)) return 'host not allowed';
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return 'origin not allowed';
    }
    if (!LOCAL_HOSTS.has(o.hostname) || o.host !== req.headers.host) return 'origin not allowed';
  }
  const sent = req.headers[BRIDGE_HEADER];
  if (typeof sent !== 'string' || sent.length !== token.length || !timingSafeEqual(Buffer.from(sent), Buffer.from(token))) return 'bad token';
  return null;
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('request too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseRun(body: unknown): BridgeRunRequest | string {
  if (!body || typeof body !== 'object') return 'invalid request';
  const b = body as Record<string, unknown>;
  if (typeof b.program !== 'string') return 'program required';
  if (!Array.isArray(b.args) || b.args.length > 64 || b.args.some((a) => typeof a !== 'string')) return 'invalid args';
  if (b.stdin !== undefined && typeof b.stdin !== 'string') return 'invalid stdin';
  if (b.cwd !== undefined && typeof b.cwd !== 'string') return 'invalid cwd';
  if (b.timeoutMs !== undefined && (typeof b.timeoutMs !== 'number' || !Number.isFinite(b.timeoutMs))) return 'invalid timeout';
  if (b.env !== undefined && (!b.env || typeof b.env !== 'object' || Array.isArray(b.env) || Object.keys(b.env).length > 8 || Object.values(b.env).some((v) => typeof v !== 'string'))) return 'invalid env';
  return { program: b.program, args: b.args as string[], stdin: b.stdin as string | undefined, cwd: b.cwd as string | undefined, env: b.env as Record<string, string> | undefined, timeoutMs: b.timeoutMs as number | undefined };
}

export function createBridgeHandler(runner: NodeProcessRunner, token: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const fail = (status: number, message: string) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: message }));
    };
    const refused = checkRequest(req, token);
    if (refused) return fail(403, refused);
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (err) {
      return fail(400, (err as Error).message);
    }
    const route = (req.url ?? '').split('?')[0];

    if (route === '/locate') {
      const program = (body as { program?: unknown })?.program;
      if (typeof program !== 'string') return fail(400, 'program required');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(await runner.locate(program)));
      return;
    }
    if (route !== '/run') return fail(404, 'not found');

    const spec = parseRun(body);
    if (typeof spec === 'string') return fail(400, spec);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    const send = (m: BridgeMessage) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(m)}\n`);
    };
    // the page went away (navigation, cancel): kill the process
    const ac = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) ac.abort();
    });
    const end = await runner.run(
      { ...spec, signal: ac.signal },
      { onSpawn: () => send({ t: 'spawn' }), onStdout: (d) => send({ t: 'out', d }), onStderr: (d) => send({ t: 'err', d }) },
    );
    send({ t: 'end', end });
    res.end();
  };
}

/** Vite plugin: serves the process host during `vite` (dev) only. */
export function realmnestProcessBridge(programs: HostProgram[]): Plugin {
  const token = randomBytes(24).toString('hex');
  const runner = new NodeProcessRunner(programs);
  const handler = createBridgeHandler(runner, token);
  return {
    name: 'realmnest-process-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(BRIDGE_PATH, (req, res) => {
        handler(req, res).catch(() => {
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        });
      });
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: BRIDGE_META, content: token }, injectTo: 'head' }];
    },
  };
}
