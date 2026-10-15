// The first native tools. Filesystem work is done in Rust (src-tauri/src/tools),
// which resolves every path inside the workspace itself and never trusts the
// page; this file only describes the tools and calls the three narrow commands.

import { invoke } from '@tauri-apps/api/core';
import type { ToolDefinition, ToolError, ToolErrorCode } from '../../domain/tool';
import type { ToolExecutor, ToolRegistry } from './registry';

/** limits enforced natively (mirrored here for schemas and docs) */
export const FS_LIMITS = {
  readBytes: 256 * 1024,
  writeBytes: 256 * 1024,
  listEntries: 500,
  pathChars: 512,
} as const;

export interface DirEntry {
  name: string;
  kind: 'file' | 'dir' | 'link';
  size?: number;
}

/** what the native host answers; an error carries a ToolErrorCode */
export type NativeOutcome<T> = { ok: true; value: T } | { ok: false; error: ToolError };

/** the native side of the filesystem tools (Tauri in the desktop app) */
export interface NativeToolHost {
  readonly available: boolean;
  listDirectory(workspace: string, path: string): Promise<NativeOutcome<{ path: string; entries: DirEntry[]; truncated: boolean }>>;
  readText(workspace: string, path: string): Promise<NativeOutcome<{ path: string; content: string; bytes: number }>>;
  writeText(workspace: string, path: string, content: string): Promise<NativeOutcome<{ path: string; bytes: number; created: boolean }>>;
}

const toOutcome = async <T>(p: Promise<T>): Promise<NativeOutcome<T>> => {
  try {
    return { ok: true, value: await p };
  } catch (err) {
    // the Rust commands reject with { code, message }
    const e = err as Partial<ToolError> | string;
    if (typeof e === 'object' && e && typeof e.code === 'string') return { ok: false, error: { code: e.code as ToolErrorCode, message: e.message ?? e.code } };
    return { ok: false, error: { code: 'TOOL_EXECUTION_FAILED', message: String(err) } };
  }
};

export class TauriToolHost implements NativeToolHost {
  readonly available = true;
  listDirectory(workspace: string, path: string) {
    return toOutcome(invoke<{ path: string; entries: DirEntry[]; truncated: boolean }>('tool_list_directory', { workspace, path }));
  }
  readText(workspace: string, path: string) {
    return toOutcome(invoke<{ path: string; content: string; bytes: number }>('tool_read_text', { workspace, path }));
  }
  writeText(workspace: string, path: string, content: string) {
    return toOutcome(invoke<{ path: string; bytes: number; created: boolean }>('tool_write_text', { workspace, path, content }));
  }
}

export class UnavailableToolHost implements NativeToolHost {
  readonly available = false;
  private no = async () => ({ ok: false as const, error: { code: 'TOOL_UNAVAILABLE' as const, message: 'File tools run only in the RealmNest desktop app.' } });
  listDirectory = this.no;
  readText = this.no;
  writeText = this.no;
}

const PATH = { type: 'string', maxLength: FS_LIMITS.pathChars, description: 'A path relative to the workspace folder, e.g. notes/todo.md' } as const;

export const NATIVE_TOOLS: ToolDefinition[] = [
  {
    id: 'get_current_time',
    name: 'get_current_time',
    description: 'Returns the current local date and time of this computer, with its time zone.',
    source: 'native',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'low',
    permissions: {},
    cancellable: false,
    timeoutMs: 2_000,
    version: '1',
  },
  {
    id: 'list_directory',
    name: 'list_directory',
    description: `Lists the files and folders in a folder of the workspace (at most ${FS_LIMITS.listEntries} entries). Use "." for the workspace itself.`,
    source: 'native',
    inputSchema: { type: 'object', properties: { path: PATH }, required: ['path'], additionalProperties: false },
    risk: 'low',
    permissions: {},
    needsWorkspace: true,
    cancellable: true,
    timeoutMs: 10_000,
    version: '1',
  },
  {
    id: 'read_text_file',
    name: 'read_text_file',
    description: `Reads a UTF-8 text file from the workspace (at most ${FS_LIMITS.readBytes / 1024} KB).`,
    source: 'native',
    inputSchema: { type: 'object', properties: { path: PATH }, required: ['path'], additionalProperties: false },
    risk: 'low',
    permissions: {},
    needsWorkspace: true,
    cancellable: true,
    timeoutMs: 10_000,
    version: '1',
  },
  {
    id: 'write_text_file',
    name: 'write_text_file',
    description: `Writes a UTF-8 text file in the workspace, creating folders as needed and replacing the file if it exists (at most ${FS_LIMITS.writeBytes / 1024} KB).`,
    source: 'native',
    inputSchema: {
      type: 'object',
      properties: { path: PATH, content: { type: 'string', maxLength: FS_LIMITS.writeBytes, description: 'The whole text of the file' } },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    risk: 'medium',
    permissions: {},
    needsWorkspace: true,
    cancellable: true,
    timeoutMs: 10_000,
    version: '1',
  },
];

const fail = (error: ToolError) => ({ success: false, error });

export function nativeExecutors(host: NativeToolHost, now: () => Date = () => new Date()): Record<string, ToolExecutor> {
  const needWs = (ws?: string) => (ws ? undefined : fail({ code: 'WORKSPACE_REQUIRED', message: 'No workspace folder is set for this agent or chat (Settings › General › Tools).' }));
  return {
    get_current_time: async () => {
      const d = now();
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -d.getTimezoneOffset();
      const sign = offset >= 0 ? '+' : '-';
      const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
      const mm = String(Math.abs(offset) % 60).padStart(2, '0');
      const local = new Date(d.getTime() + offset * 60_000).toISOString().slice(0, 19);
      const iso = `${local}${sign}${hh}:${mm}`;
      return { success: true, content: `${iso} (${zone})`, structuredData: { iso, timeZone: zone } };
    },
    list_directory: async ({ input, workspace }) => {
      const no = needWs(workspace);
      if (no) return no;
      const r = await host.listDirectory(workspace!, String(input.path));
      if (!r.ok) return fail(r.error);
      const lines = r.value.entries.map((e) => `${e.kind === 'dir' ? '[dir] ' : e.kind === 'link' ? '[link] ' : ''}${e.name}${e.size !== undefined ? ` (${e.size} B)` : ''}`);
      return { success: true, content: lines.length ? lines.join('\n') + (r.value.truncated ? '\n…' : '') : '(empty folder)', structuredData: r.value };
    },
    read_text_file: async ({ input, workspace }) => {
      const no = needWs(workspace);
      if (no) return no;
      const r = await host.readText(workspace!, String(input.path));
      if (!r.ok) return fail(r.error);
      return { success: true, content: r.value.content, structuredData: { path: r.value.path, bytes: r.value.bytes } };
    },
    write_text_file: async ({ input, workspace }) => {
      const no = needWs(workspace);
      if (no) return no;
      const r = await host.writeText(workspace!, String(input.path), String(input.content));
      if (!r.ok) return fail(r.error);
      const action = r.value.created ? 'created' : 'updated';
      return {
        success: true,
        content: `${action === 'created' ? 'Created' : 'Updated'} ${r.value.path} (${r.value.bytes} bytes).`,
        structuredData: r.value,
        artifacts: [{ kind: 'file', path: r.value.path, action, bytes: r.value.bytes }],
      };
    },
  };
}

export function registerNativeTools(registry: ToolRegistry, host: NativeToolHost) {
  const run = nativeExecutors(host);
  for (const t of NATIVE_TOOLS) registry.register(t, t.needsWorkspace && !host.available ? undefined : run[t.id]);
  return registry;
}
