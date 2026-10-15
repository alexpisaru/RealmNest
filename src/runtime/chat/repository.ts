// Conversations and their runs on the StorageAdapter (key "conversations").
// Same rules as the task runtime: coalesced writes while streaming, bounded
// size, and turns cut short by a restart marked as failed on load.

import { isFinished } from '../../domain/agent';
import type { Conversation, ConversationRun } from '../../domain/conversation';
import { CoalescedWriter } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';

export const CHAT_SCHEMA = 1;
const KEY = 'conversations';
export const MAX_CONVERSATIONS = 200;
export const MAX_MESSAGE_CHARS = 100_000;

export interface ChatSnapshot {
  version: number;
  conversations: Conversation[];
  runs: ConversationRun[];
}

export class ConversationRepository {
  private writer: CoalescedWriter<ChatSnapshot>;

  constructor(
    private storage: StorageAdapter,
    delayMs = 1_000,
  ) {
    this.writer = new CoalescedWriter(storage, KEY, delayMs, pruneChat);
  }

  async load(now = Date.now()): Promise<ChatSnapshot> {
    const raw = await this.storage.get<Partial<ChatSnapshot>>(KEY);
    const interrupted = { code: 'interrupted', message: 'RealmNest was closed while this reply was being written.' };
    // records are checked one by one: a broken one is dropped, never the whole history (D-2)
    const runs = (Array.isArray(raw?.runs) ? raw.runs : []).filter(isRecord).map((r) => (isFinished(r.status) ? r : { ...r, status: 'failed' as const, finishedAt: now, error: interrupted }));
    const conversations = (Array.isArray(raw?.conversations) ? raw.conversations : []).filter(isRecord).map((c) => ({
      ...c,
      messages: (Array.isArray(c.messages) ? c.messages : [])
        .filter(isRecord)
        .map((m) => (typeof m.content === 'string' ? m : { ...m, content: '' }))
        .map((m) => (m.status === 'streaming' ? { ...m, status: 'failed' as const, error: interrupted } : m)),
    }));
    return { version: CHAT_SCHEMA, conversations, runs };
  }

  touch(get: () => ChatSnapshot) {
    this.writer.touch(get);
  }

  flush(get?: () => ChatSnapshot) {
    return this.writer.flush(get);
  }
}

const isRecord = <T extends { id: string }>(v: T | null | undefined): v is T => typeof v === 'object' && v !== null && typeof v.id === 'string';

/**
 * Keep the most recently used conversations (and their runs); cap message sizes. Pinned
 * conversations and those with a reply being written are never pruned (D-9).
 */
export function pruneChat(s: ChatSnapshot): ChatSnapshot {
  const active = new Set(s.runs.filter((r) => !isFinished(r.status)).map((r) => r.conversationId));
  const kept = (c: Conversation) => !!c.pinned || active.has(c.id) || c.messages.some((m) => m.status === 'streaming');
  const sorted = [...s.conversations].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  const protectedCount = sorted.filter(kept).length;
  let room = Math.max(0, MAX_CONVERSATIONS - protectedCount);
  const conversations = sorted
    .filter((c) => kept(c) || room-- > 0)
    .map((c) => ({
      ...c,
      messages: c.messages.map((m) => (typeof m.content === 'string' && m.content.length > MAX_MESSAGE_CHARS ? { ...m, content: `${m.content.slice(0, MAX_MESSAGE_CHARS)}\n… [truncated]` } : m)),
    }));
  const keep = new Set(conversations.map((c) => c.id));
  return { version: CHAT_SCHEMA, conversations, runs: s.runs.filter((r) => keep.has(r.conversationId)) };
}
