// What the Home dashboard shows, from data RealmNest really keeps (agents, their
// live tasks, conversations): no invented numbers. Pure, so it is tested.

import type { AgentTask } from '../domain/agent';
import type { Character } from '../domain/character';
import type { Conversation } from '../domain/conversation';
import type { WorldDef } from '../domain/world';

export interface HomeSources {
  characters: Character[];
  tasksOf: (agentId: string) => AgentTask[];
  /** whether the agent has a run going now */
  working: (agentId: string) => boolean;
  conversations: Conversation[];
}

export interface WorldSummary {
  world: WorldDef;
  agents: number;
  /** queued or running tasks */
  tasks: number;
  /** agents with a run going now */
  working: number;
}

const ACTIVE = new Set<AgentTask['status']>(['queued', 'running']);
const DAY = 86_400_000;

export function summarize(world: WorldDef, s: HomeSources): WorldSummary {
  const here = s.characters.filter((c) => c.worldId === world.id);
  return {
    world,
    agents: here.length,
    tasks: here.reduce((n, c) => n + s.tasksOf(c.id).filter((t) => ACTIVE.has(t.status)).length, 0),
    working: here.filter((c) => s.working(c.id)).length,
  };
}

export type ActivityKind = 'completed' | 'started' | 'failed' | 'cancelled' | 'chat' | 'agent';

export interface ActivityItem {
  key: string;
  at: number;
  kind: ActivityKind;
  /** the agent it is about (portrait), if any */
  agentId?: string;
  /** agent name, or undefined for direct chats */
  who?: string;
  /** task or conversation title */
  what: string;
}

export function recentActivity(s: HomeSources, limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [];
  const nameOf = (id?: string) => s.characters.find((c) => c.id === id)?.name;
  for (const c of s.characters) {
    for (const t of s.tasksOf(c.id)) {
      const kind: ActivityKind = t.status === 'completed' ? 'completed' : t.status === 'failed' ? 'failed' : t.status === 'cancelled' ? 'cancelled' : 'started';
      items.push({ key: `task-${t.id}`, at: t.updatedAt, kind, agentId: c.id, who: c.name, what: t.title });
    }
    items.push({ key: `agent-${c.id}`, at: c.metadata.createdAt, kind: 'agent', agentId: c.id, who: c.name, what: c.role });
  }
  for (const conv of s.conversations) {
    if (!conv.messages.length) continue;
    items.push({ key: `chat-${conv.id}`, at: conv.updatedAt, kind: 'chat', ...(conv.agentId && { agentId: conv.agentId, who: nameOf(conv.agentId) }), what: conv.title });
  }
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

export interface Overview {
  agents: number;
  working: number;
  doneToday: number;
  failedWeek: number;
}

export function overview(s: HomeSources, now = Date.now()): Overview {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tasks = s.characters.flatMap((c) => s.tasksOf(c.id));
  return {
    agents: s.characters.length,
    working: s.characters.filter((c) => s.working(c.id)).length,
    doneToday: tasks.filter((t) => t.status === 'completed' && t.updatedAt >= today.getTime()).length,
    failedWeek: tasks.filter((t) => t.status === 'failed' && t.updatedAt >= now - 7 * DAY).length,
  };
}

/** "2 min fa", "ieri"… in the UI language */
export function timeAgo(at: number, lang: 'it' | 'en', now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = Math.round((at - now) / 1000);
  if (s > -45) return lang === 'it' ? 'ora' : 'now';
  const m = Math.round(s / 60);
  if (m > -60) return rtf.format(m, 'minute');
  const h = Math.round(m / 60);
  if (h > -24) return rtf.format(h, 'hour');
  const d = Math.round(h / 24);
  if (d > -7) return rtf.format(d, 'day');
  return new Date(at).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

// ── tags on the world map ────────────────────────────────────

export interface TagBox {
  id: string;
  /** the zone's centre (0–1) and size (fractions of the map) */
  u: number;
  v: number;
  w: number;
  h: number;
}
export type TagSide = 'above' | 'below' | 'left' | 'right';
export interface TagPlace {
  /** anchor point (0–1); the tag hangs from it on `side` */
  x: number;
  y: number;
  side: TagSide;
}

export const TAG_PX = { w: 184, h: 46, gap: 4 };

type Rect = { x0: number; x1: number; y0: number; y1: number };

/**
 * Where each map tag goes: on top of its zone if there is room, else just
 * below, left or right of it, never over another tag and never past the part
 * of the map on screen (`view`, in map pixels) when a free spot exists.
 */
export function placeTags(boxes: TagBox[], mapW: number, mapH: number, view: Rect = { x0: 0, y0: 0, x1: mapW, y1: mapH }): Record<string, TagPlace> {
  const out: Record<string, TagPlace> = {};
  if (!mapW || !mapH) return out;
  const { w: tw, h: th, gap } = TAG_PX;
  const taken: Rect[] = [];
  const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const inside = (q: Rect) => q.x0 >= view.x0 && q.y0 >= view.y0 && q.x1 <= view.x1 && q.y1 <= view.y1;
  for (const b of [...boxes].sort((p, q) => p.v - q.v)) {
    const cx = b.u * mapW;
    const cy = b.v * mapH;
    const top = (b.v - b.h / 2) * mapH;
    const bottom = (b.v + b.h / 2) * mapH;
    const left = (b.u - b.w / 2) * mapW;
    const right = (b.u + b.w / 2) * mapW;
    const options: { side: TagSide; x: number; y: number; rect: Rect }[] = [
      // the upper part of the zone itself, so the tag reads as the zone's name
      { side: 'above', x: cx, y: top + th + gap, rect: { x0: cx - tw / 2, x1: cx + tw / 2, y0: top + gap, y1: top + gap + th } },
      { side: 'above', x: cx, y: top - gap, rect: { x0: cx - tw / 2, x1: cx + tw / 2, y0: top - gap - th, y1: top - gap } },
      { side: 'below', x: cx, y: bottom + gap, rect: { x0: cx - tw / 2, x1: cx + tw / 2, y0: bottom + gap, y1: bottom + gap + th } },
      { side: 'right', x: right + gap, y: cy, rect: { x0: right + gap, x1: right + gap + tw, y0: cy - th / 2, y1: cy + th / 2 } },
      { side: 'left', x: left - gap, y: cy, rect: { x0: left - gap - tw, x1: left - gap, y0: cy - th / 2, y1: cy + th / 2 } },
    ];
    const pick = options.find((o) => inside(o.rect) && !taken.some((t) => hit(t, o.rect))) ?? options.find((o) => inside(o.rect)) ?? options[0];
    taken.push(pick.rect);
    out[b.id] = { x: pick.x / mapW, y: pick.y / mapH, side: pick.side };
  }
  return out;
}
