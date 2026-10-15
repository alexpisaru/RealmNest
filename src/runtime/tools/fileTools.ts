// Tools over RealmNest's managed files (docs/FILES.md). A run reaches only its OWN attachments
// (ToolExecution.attachments: the chat's or the task's files), by name or id; never a storage
// ref or a host path from the model.

import type { ToolDefinition, ToolError } from '../../domain/tool';
import { FileError, type FileStore } from '../files/store';
import { FS_LIMITS } from './native';
import type { ToolExecutor, ToolRegistry } from './registry';

export const FILE_TOOLS: ToolDefinition[] = [
  {
    id: 'save_attachment',
    name: 'save_attachment',
    description:
      'Copies a file the user attached to this conversation or task into the workspace folder, so other tools (an image editor, a script) can open it there. Name the attachment as the user sees it (e.g. photo.png). The copy is a new workspace file; the attachment itself never changes.',
    source: 'native',
    inputSchema: {
      type: 'object',
      properties: {
        attachment: { type: 'string', maxLength: 200, description: 'The attachment’s file name (or id)' },
        path: { type: 'string', maxLength: FS_LIMITS.pathChars, description: 'Where to put it, relative to the workspace folder (default: its own name)' },
      },
      required: ['attachment'],
      additionalProperties: false,
    },
    risk: 'medium',
    permissions: {},
    needsWorkspace: true,
    cancellable: false,
    timeoutMs: 30_000,
    version: '1',
  },
];

const fail = (error: ToolError) => ({ success: false, error });

export function fileExecutors(files: FileStore): Record<string, ToolExecutor> {
  return {
    save_attachment: async ({ input, workspace, attachments = [] }) => {
      if (!workspace) return fail({ code: 'WORKSPACE_REQUIRED', message: 'No workspace folder is set for this agent or chat (Settings › General › Tools).' });
      const want = String(input.attachment).trim();
      const named = attachments.filter((a) => a.id === want || a.name === want);
      const match = named.length ? named : attachments.filter((a) => a.name.toLowerCase() === want.toLowerCase());
      if (!match.length) {
        const list = attachments.map((a) => a.name).join(', ');
        return fail({ code: 'FILE_NOT_FOUND', message: list ? `No attachment named ${want}. This run has: ${list}.` : 'This run has no attachments.' });
      }
      // the newest one when a name repeats
      const a = match[match.length - 1];
      const path = typeof input.path === 'string' && input.path.trim() ? input.path.trim() : a.name;
      try {
        const r = await files.toWorkspace(a.storageRef, workspace, path);
        return { success: true, content: `${r.created ? 'Saved' : 'Replaced'} ${r.path} (${r.bytes} bytes) from the attachment ${a.name}.`, structuredData: { path: r.path, bytes: r.bytes, attachment: a.name } };
      } catch (e) {
        const err = e instanceof FileError ? e : new FileError('IMPORT_FAILED', String(e));
        const code = err.code === 'FILE_NOT_FOUND' ? 'FILE_NOT_FOUND' : err.code === 'INVALID_FILE' ? 'PATH_OUTSIDE_WORKSPACE' : err.code === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'TOOL_EXECUTION_FAILED';
        return fail({ code, message: err.message });
      }
    },
  };
}

export function registerFileTools(registry: ToolRegistry, files: FileStore, available: boolean) {
  const run = fileExecutors(files);
  for (const t of FILE_TOOLS) registry.register(t, available ? run[t.id] : undefined);
  return registry;
}
