// Character pipeline: a minimal MCP client (JSON-RPC 2.0 over stdio, one message per line) for the
// EffectCraft / PhotoCraft servers. Calls are sequential: the servers answer requests concurrently,
// so a client that does not wait for each reply can see edits run out of order.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface ToolResult {
  ok: boolean;
  text: string;
  /** base64 PNGs returned by render tools */
  images: string[];
}

export class McpClient {
  private proc: ChildProcessWithoutNullStreams;
  private next = 1;
  private pending = new Map<number, (m: { result?: { content?: { type: string; text?: string; data?: string }[]; isError?: boolean }; error?: { message?: string } }) => void>();
  /** every call, for the build log */
  readonly log: string[] = [];

  constructor(command: string, args: string[], cwd?: string) {
    this.proc = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    createInterface({ input: this.proc.stdout }).on('line', (line) => {
      let m: { id?: number };
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.id !== undefined && this.pending.has(m.id)) {
        this.pending.get(m.id)!(m as never);
        this.pending.delete(m.id);
      }
    });
  }

  private request(method: string, params: unknown) {
    const id = this.next++;
    return new Promise<{ result?: { content?: { type: string; text?: string; data?: string }[]; isError?: boolean }; error?: { message?: string } }>((res) => {
      this.pending.set(id, res);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async init(name: string) {
    const r = await this.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '0' } });
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return r;
  }

  /** Calls a tool; `soft` returns failures instead of throwing. */
  async tool(name: string, args: Record<string, unknown> = {}, soft = false): Promise<ToolResult> {
    const r = await this.request('tools/call', { name, arguments: args });
    const content = r.result?.content ?? [];
    const text = r.error?.message ?? content.map((c) => c.text ?? '').join(' ');
    const ok = !r.error && !r.result?.isError;
    this.log.push(`${ok ? '✓' : '✗'} ${name} ${JSON.stringify(args).slice(0, 160)}${ok ? '' : ` → ${text.slice(0, 200)}`}`);
    if (!ok && !soft) throw new Error(`${name} failed: ${text}`);
    return { ok, text, images: content.filter((c) => c.type === 'image' && c.data).map((c) => c.data!) };
  }

  close() {
    this.proc.stdin.end();
    return new Promise<void>((res) => this.proc.on('close', () => res()));
  }
}
