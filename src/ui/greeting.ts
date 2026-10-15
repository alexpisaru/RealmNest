// The Chat greeting: a salutation from the local time, the user's name when
// they gave one (Settings › General), and one short line from a curated set.
// No model call; the line is picked from a seed so it stays put while the
// empty chat is open.

import type { TKey } from '../i18n';

type T = (k: TKey, vars?: Record<string, string | number>) => string;

export type DayPart = 'morning' | 'afternoon' | 'evening';

/** 05–12 morning, 12–18 afternoon, otherwise evening */
export function dayPart(date: Date): DayPart {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

const LINES: TKey[] = ['greet.p1', 'greet.p2', 'greet.p3', 'greet.p4'];

export function greeting(t: T, date: Date, name?: string, seed = 0): { hello: string; line: string } {
  const who = name?.trim();
  const hello = `${t(`greet.${dayPart(date)}`)}${who ? `, ${who}` : ''}.`;
  return { hello, line: t(LINES[Math.abs(Math.floor(seed)) % LINES.length]) };
}
