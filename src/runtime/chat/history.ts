// Chat history groups for the history drawer: Pinned first, then by the local
// day of last use (Today, Yesterday, Previous 7 days, Older). Pure, so the
// drawer and the tests agree on what goes where.

import type { Conversation } from '../../domain/conversation';

export type HistoryGroupKey = 'pinned' | 'today' | 'yesterday' | 'week' | 'older';

export interface HistoryGroup {
  key: HistoryGroupKey;
  items: Conversation[];
}

const ORDER: HistoryGroupKey[] = ['pinned', 'today', 'yesterday', 'week', 'older'];
const DAY = 86_400_000;

/** local midnight of the day `t` falls in */
function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function historyGroup(c: Conversation, now: number): HistoryGroupKey {
  if (c.pinned) return 'pinned';
  const today = startOfDay(now);
  if (c.updatedAt >= today) return 'today';
  if (c.updatedAt >= today - DAY) return 'yesterday';
  if (c.updatedAt >= today - 7 * DAY) return 'week';
  return 'older';
}

/** non-empty groups in display order; most recently used first inside each */
export function groupConversations(list: Conversation[], now = Date.now()): HistoryGroup[] {
  const groups = new Map<HistoryGroupKey, Conversation[]>(ORDER.map((k) => [k, []]));
  for (const c of [...list].sort((a, b) => b.updatedAt - a.updatedAt)) groups.get(historyGroup(c, now))!.push(c);
  return ORDER.map((key) => ({ key, items: groups.get(key)! })).filter((g) => g.items.length);
}

/** search by title and message text, every word must match */
export function searchConversations(list: Conversation[], query: string): Conversation[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((c) => {
    const hay = `${c.title} ${c.messages.map((m) => m.content).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
