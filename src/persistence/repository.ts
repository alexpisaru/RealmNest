// ─────────────────────────────────────────────────────────────
// RealmNestRepository — typed, versioned save data on top of a StorageAdapter.
// ─────────────────────────────────────────────────────────────

import type { Character } from '../domain/character';
import { DEFAULT_THEME, migrateTheme, type ThemeId } from '../themes';
import type { StorageAdapter } from './storage';

export const SCHEMA_VERSION = 1;

export interface Settings {
  language: 'it' | 'en';
  /** sound on (the switch on the world map); off until the user turns it on */
  sound: boolean;
  volume: { master: number; music: number; ambient: number; effects: number };
  defaultZoom: number; // 0 = auto-fit
  showLabels: boolean;
  debug: boolean;
  showPaths: boolean;
  showPoints: boolean;
  showTargets: boolean;
  showGrid: boolean;
  animationSpeed: number; // 0.5 … 2, scales sprite animations
  /** the app's look (src/themes.ts); light or dark comes from the theme */
  theme: ThemeId;
  /** how the user is greeted (Chat) and shown in the sidebar; empty = no name */
  displayName: string;
  /** a short line under the name, e.g. "Founder"; empty = none */
  profileRole: string;
  /** profile photo as a small square JPEG data URL (256 px); empty = the initial */
  avatar: string;
  /** a short AI title after a chat's first reply (one extra request) */
  aiTitles: boolean;
  /** the worlds at night (lamps, lit windows and rooms) */
  night: boolean;
  /** mock: simulated crew (demo, visual work) · live: agents run real tasks */
  runtimeMode: 'mock' | 'live';
}

/** a first run speaks the system's language: Italian for it-*, English otherwise */
export function systemLanguage(): Settings['language'] {
  const l = typeof navigator === 'undefined' ? '' : navigator.language ?? '';
  return /^it(-|$)/i.test(l) ? 'it' : 'en';
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'it',
  sound: false,
  volume: { master: 0.8, music: 0.6, ambient: 0.5, effects: 0.7 },
  defaultZoom: 0,
  showLabels: true,
  debug: false,
  showPaths: false,
  showPoints: false,
  showTargets: false,
  showGrid: false,
  animationSpeed: 1,
  theme: DEFAULT_THEME,
  displayName: '',
  profileRole: '',
  avatar: '',
  aiTitles: false,
  night: false,
  runtimeMode: 'mock',
};

export interface SaveData {
  version: number;
  characters: Character[];
  settings: Settings;
  currentWorldId: string;
  seenIntro: boolean;
}

const KEY = 'save';

export class RealmNestRepository {
  constructor(private storage: StorageAdapter) {}

  async load(): Promise<SaveData | undefined> {
    const raw = await this.storage.get<SaveData>(KEY);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    return migrate(raw);
  }

  /** the save exists but could not be read: keep it until the user changes something */
  unreadable() {
    return !!this.storage.isUnreadable?.(KEY);
  }

  async save(data: Omit<SaveData, 'version'>) {
    await this.storage.set<SaveData>(KEY, { ...data, version: SCHEMA_VERSION });
  }

  async clear() {
    await this.storage.remove(KEY);
  }
}

/** Forward-migrate older saves. Unknown fields are kept, missing ones defaulted. */
export function migrate(raw: Partial<SaveData>): SaveData {
  return {
    version: SCHEMA_VERSION,
    // the founder wears the owner's hand-drawn art (src/render/hd4/peopleTemplate.ts)
    characters: (Array.isArray(raw.characters) ? raw.characters : [])
      .filter(isCharacter)
      .map((c) => (c.metadata?.founder && !c.profile.art ? { ...c, profile: { ...c.profile, art: 'alex' as const } } : c)),
    settings: cleanSettings(raw.settings),
    currentWorldId: typeof raw.currentWorldId === 'string' ? raw.currentWorldId : 'farm',
    seenIntro: typeof raw.seenIntro === 'boolean' ? raw.seenIntro : false,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** a saved character the app can draw (the rest of the shape is the app's own) */
const isCharacter = (c: unknown): c is Character => isObject(c) && typeof c.id === 'string' && typeof c.worldId === 'string' && isObject(c.profile);

const clamp = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

const BOOLEANS = ['sound', 'showLabels', 'debug', 'showPaths', 'showPoints', 'showTargets', 'showGrid', 'aiTitles', 'night'] as const;
const STRINGS = ['displayName', 'profileRole', 'avatar'] as const;

/** saved settings with every field checked: a wrong value falls back to the default (D-2, D-14) */
export function cleanSettings(raw: unknown): Settings {
  const s = isObject(raw) ? raw : {};
  const vol = isObject(s.volume) ? s.volume : {};
  const d = DEFAULT_SETTINGS;
  const out: Settings = {
    ...d,
    ...s,
    language: s.language === 'it' || s.language === 'en' ? s.language : d.language,
    runtimeMode: s.runtimeMode === 'mock' || s.runtimeMode === 'live' ? s.runtimeMode : d.runtimeMode,
    volume: { master: clamp(vol.master, 0, 1, d.volume.master), music: clamp(vol.music, 0, 1, d.volume.music), ambient: clamp(vol.ambient, 0, 1, d.volume.ambient), effects: clamp(vol.effects, 0, 1, d.volume.effects) },
    defaultZoom: Math.round(clamp(s.defaultZoom, 0, 4, d.defaultZoom)),
    animationSpeed: clamp(s.animationSpeed, 0.5, 2, d.animationSpeed),
    theme: migrateTheme(s.theme),
  };
  for (const k of BOOLEANS) out[k] = typeof s[k] === 'boolean' ? (s[k] as boolean) : d[k];
  for (const k of STRINGS) out[k] = typeof s[k] === 'string' ? (s[k] as string) : d[k];
  return out;
}
