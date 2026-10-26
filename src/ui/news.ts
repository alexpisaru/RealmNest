import type { TKey } from '../i18n';

/** Shown in the main menu "What's new" panel. Keep in sync with CHANGELOG.md. Items are i18n keys (texts in src/locales/world.ts); **text** is bold.
The newest entry's version is the app's version (Settings › About). */
export const NEWS: { version: string; date: string; items: TKey[] }[] = [
  {
    version: '0.12.0-beta',
    date: '2026-10-26',
    items: ['w.news.120.1', 'w.news.120.2', 'w.news.120.3', 'w.news.120.4'],
  },
  {
    version: '0.11.2-beta',
    date: '2026-10-16',
    items: ['w.news.112.1', 'w.news.112.2', 'w.news.112.3'],
  },
  {
    version: '0.11.1-beta',
    date: '2026-10-15',
    items: ['w.news.111.1'],
  },
  {
    version: '0.11.0-beta',
    date: '2026-10-15',
    items: ['w.news.110.1', 'w.news.110.2', 'w.news.110.3', 'w.news.110.4', 'w.news.110.5', 'w.news.110.6', 'w.news.110.7', 'w.news.110.8'],
  },
  {
    version: '0.10.0-beta',
    date: '2026-10-14',
    items: ['w.news.100.1', 'w.news.100.2', 'w.news.100.3', 'w.news.100.4', 'w.news.100.5'],
  },
  {
    version: '0.9.0-beta',
    date: '2026-10-13',
    items: ['w.news.090.1', 'w.news.090.2', 'w.news.090.3', 'w.news.090.4', 'w.news.090.5'],
  },
  {
    version: '0.8.0-beta',
    date: '2026-10-12',
    items: ['w.news.080.1', 'w.news.080.2', 'w.news.080.3', 'w.news.080.4', 'w.news.080.5'],
  },
  {
    version: '0.7.0-beta',
    date: '2026-10-08',
    items: ['w.news.070.1', 'w.news.070.2', 'w.news.070.3', 'w.news.070.4'],
  },
  {
    version: '0.6.0-beta',
    date: '2026-10-07',
    items: ['w.news.060.1'],
  },
  {
    version: '0.5.0-beta',
    date: '2026-10-06',
    items: ['w.news.050.1'],
  },
  {
    version: '0.4.0-beta',
    date: '2026-10-06',
    items: ['w.news.040.1', 'w.news.040.2', 'w.news.040.3'],
  },
  {
    version: '0.3.0-beta',
    date: '2026-10-06',
    items: ['w.news.030.1', 'w.news.030.2', 'w.news.030.3', 'w.news.030.4'],
  },
  {
    version: '0.2.0-beta',
    date: '2026-10-06',
    items: ['w.news.020.1', 'w.news.020.2', 'w.news.020.3', 'w.news.020.4', 'w.news.020.5', 'w.news.020.6'],
  },
  { version: '0.1.0-beta', date: '2026-10-06', items: ['w.news.010.1'] },
];
