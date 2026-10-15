// The native side of an MCP server connection. In the desktop app Rust starts
// the server process (an executable + argv, never a shell), owns its process
// tree, reads stdout line by line and hands each message over; nothing here
// parses protocol semantics. The protocol lives in McpClient (client.ts).

import { Channel, invoke } from '@tauri-apps/api/core';

export interface McpLaunch {
  serverId: string;
  /** an online server (Streamable HTTP) instead of a program */
  url?: string;
  /** online: plain headers */
  headers?: Record<string, string>;
  /** online: header → credential-store name; Rust reads the values */
  secretHeaders?: Record<string, string>;
  /** online: OAuth tokens added by the native host */
  oauth?: boolean;
  command: string;
  args: string[];
  cwd?: string;
  /** plain variables */
  env: Record<string, string>;
  /** variable → credential-store name; Rust reads the values, the page never sees them */
  secretEnv: Record<string, string>;
}

export type McpExitReason =
  /** the server ended after we closed its input (a normal stop) */
  | 'stopped'
  /** it ended by itself */
  | 'exited'
  /** we had to kill it */
  | 'killed'
  /** never started: the launch was refused (bad executable, arguments, folder…) */
  | 'refused'
  /** the executable was not found */
  | 'not_found'
  /** the user said no on the native confirmation */
  | 'declined'
  /** a secret variable has no value in the credential store */
  | 'missing_secret'
  /** an online server wants a (new) sign-in or rejected the credentials */
  | 'auth_required';

export type McpHostEvent =
  | { t: 'started'; pid: number; executable: string }
  /** one stdout line, parsed as JSON by the host */
  | { t: 'message'; message: unknown; bytes: number }
  /** a stdout line that was not JSON, or too long (the server broke the protocol) */
  | { t: 'invalid'; reason: string; bytes: number }
  /** stderr, line by line (secrets already redacted) */
  | { t: 'stderr'; line: string }
  | { t: 'exit'; reason: McpExitReason; code?: number | null; message?: string };

export interface McpTransportHost {
  readonly available: boolean;
  /** start a server; everything after arrives on onEvent and ends with one `exit` */
  start(launch: McpLaunch, onEvent: (e: McpHostEvent) => void): Promise<void>;
  /** write one JSON-RPC message (the host serializes it on a single line) */
  send(serverId: string, message: object): Promise<void>;
  /** close its input, wait briefly, then kill the whole process tree */
  stop(serverId: string): Promise<void>;
  /** online servers: OAuth sign-in in the browser (tokens stay native) */
  oauthLogin?(serverId: string, url: string): Promise<void>;
  oauthStatus?(serverId: string): Promise<boolean>;
  oauthLogout?(serverId: string): Promise<void>;
}

export class TauriMcpHost implements McpTransportHost {
  readonly available = true;
  /** servers reached over HTTP (the others are processes) */
  private online = new Set<string>();
  async start(launch: McpLaunch, onEvent: (e: McpHostEvent) => void) {
    const channel = new Channel<McpHostEvent>();
    channel.onmessage = onEvent;
    if (launch.url) {
      this.online.add(launch.serverId);
      await invoke('mcp_http_start', { launch: { serverId: launch.serverId, url: launch.url, headers: launch.headers ?? {}, secretHeaders: launch.secretHeaders ?? {}, oauth: !!launch.oauth }, channel });
      return;
    }
    this.online.delete(launch.serverId);
    await invoke('mcp_start', { launch, channel });
  }
  async send(serverId: string, message: object) {
    await invoke(this.online.has(serverId) ? 'mcp_http_send' : 'mcp_send', { serverId, message });
  }
  async stop(serverId: string) {
    await invoke(this.online.has(serverId) ? 'mcp_http_stop' : 'mcp_stop', { serverId });
  }
  async oauthLogin(serverId: string, url: string) {
    await invoke('mcp_oauth_login', { serverId, url });
  }
  oauthStatus(serverId: string) {
    return invoke<boolean>('mcp_oauth_status', { serverId });
  }
  async oauthLogout(serverId: string) {
    await invoke('mcp_oauth_logout', { serverId });
  }
}

export class UnavailableMcpHost implements McpTransportHost {
  readonly available = false;
  async start(_launch: McpLaunch, onEvent: (e: McpHostEvent) => void) {
    onEvent({ t: 'exit', reason: 'refused', message: 'MCP servers run only in the RealmNest desktop app.' });
  }
  async send() {
    throw new Error('MCP servers run only in the RealmNest desktop app.');
  }
  async stop() {}
}
