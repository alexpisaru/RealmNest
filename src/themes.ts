// Themes: one set of design tokens per theme, applied as CSS custom properties
// on <html>. The stylesheet only uses the tokens (styles.css), so a theme is
// data, not CSS. Light or dark comes from the theme itself (`scheme`).
// docs/UI_UX.md lists the tokens and the conventions.

export type ThemeId = 'ember' | 'azure' | 'violet' | 'ocean' | 'rose' | 'graphite' | 'solar' | 'forest' | 'ice' | 'mint' | 'lilac' | 'paper';

export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  /** text and icons on an accent fill */
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  scheme: 'dark' | 'light';
  tokens: ThemeTokens;
}

const DARK_STATUS = { success: '#5fd38d', warning: '#f2b84b', danger: '#ef6a5a', info: '#5ec8e6' };
const LIGHT_STATUS = { success: '#15803d', warning: '#b45309', danger: '#dc2626', info: '#0e7490' };

export const THEMES: Theme[] = [
  {
    id: 'azure',
    name: 'Azure',
    scheme: 'light',
    tokens: {
      background: '#f3f5f9',
      surface: '#ffffff',
      surfaceElevated: '#ffffff',
      surfaceHover: '#eef2f8',
      border: '#0f172a17',
      borderStrong: '#0f172a2b',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#6b7280',
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'solar',
    name: 'Solar',
    scheme: 'light',
    tokens: {
      background: '#f8f3ea',
      surface: '#fffcf6',
      surfaceElevated: '#ffffff',
      surfaceHover: '#f2eadb',
      border: '#3b2a0f1c',
      borderStrong: '#3b2a0f30',
      textPrimary: '#2a2116',
      textSecondary: '#5e5243',
      textMuted: '#837561',
      accent: '#a65604',
      accentHover: '#8a4703',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'ice',
    name: 'Ice',
    scheme: 'light',
    tokens: {
      background: '#edf1f5',
      surface: '#f8fafc',
      surfaceElevated: '#ffffff',
      surfaceHover: '#e4eaf1',
      border: '#0b1f3a1a',
      borderStrong: '#0b1f3a2e',
      textPrimary: '#0f1c2e',
      textSecondary: '#44546a',
      textMuted: '#687990',
      accent: '#0369a1',
      accentHover: '#075985',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    scheme: 'light',
    tokens: {
      background: '#eef5f1',
      surface: '#fbfefc',
      surfaceElevated: '#ffffff',
      surfaceHover: '#e3eee8',
      border: '#0b2a1e1a',
      borderStrong: '#0b2a1e2e',
      textPrimary: '#10221b',
      textSecondary: '#3f5a4f',
      textMuted: '#5f766c',
      accent: '#047857',
      accentHover: '#065f46',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'lilac',
    name: 'Lilac',
    scheme: 'light',
    tokens: {
      background: '#f4f2fa',
      surface: '#fdfcff',
      surfaceElevated: '#ffffff',
      surfaceHover: '#ebe7f6',
      border: '#1e10401a',
      borderStrong: '#1e10402e',
      textPrimary: '#1b1430',
      textSecondary: '#4f4766',
      textMuted: '#6d6683',
      accent: '#6d28d9',
      accentHover: '#5b21b6',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    scheme: 'light',
    tokens: {
      background: '#f4f4f1',
      surface: '#fcfcfa',
      surfaceElevated: '#ffffff',
      surfaceHover: '#ebebe7',
      border: '#1c1c1a1a',
      borderStrong: '#1c1c1a2e',
      textPrimary: '#19191b',
      textSecondary: '#4f4f57',
      textMuted: '#6c6c74',
      accent: '#c2410c',
      accentHover: '#9a3412',
      accentInk: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    scheme: 'dark',
    tokens: {
      background: '#100e12',
      surface: '#1c181e',
      surfaceElevated: '#26212a',
      surfaceHover: '#2f2934',
      border: '#ffecd617',
      borderStrong: '#ffecd629',
      textPrimary: '#f3e9dc',
      textSecondary: '#cbbfb1',
      textMuted: '#8f8478',
      accent: '#f2a66b',
      accentHover: '#f7bd8f',
      accentInk: '#2a1508',
      ...DARK_STATUS,
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    scheme: 'dark',
    tokens: {
      background: '#0f0d16',
      surface: '#17141f',
      surfaceElevated: '#201c2b',
      surfaceHover: '#282336',
      border: '#e6dcff17',
      borderStrong: '#e6dcff29',
      textPrimary: '#ece8f7',
      textSecondary: '#b7afcc',
      textMuted: '#817998',
      accent: '#a78bfa',
      accentHover: '#c4b5fd',
      accentInk: '#1a1130',
      ...DARK_STATUS,
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    scheme: 'dark',
    tokens: {
      background: '#09111e',
      surface: '#0f1a2b',
      surfaceElevated: '#152339',
      surfaceHover: '#1c2d47',
      border: '#cfe4ff17',
      borderStrong: '#cfe4ff29',
      textPrimary: '#e6f0fa',
      textSecondary: '#a6b8cc',
      textMuted: '#71859d',
      accent: '#38d6e8',
      accentHover: '#6ce3f0',
      accentInk: '#04202a',
      ...DARK_STATUS,
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    scheme: 'dark',
    tokens: {
      background: '#130d10',
      surface: '#1c1418',
      surfaceElevated: '#261b21',
      surfaceHover: '#30222a',
      border: '#ffd6e417',
      borderStrong: '#ffd6e429',
      textPrimary: '#f6e8ee',
      textSecondary: '#ccb3bf',
      textMuted: '#957c88',
      accent: '#f47aac',
      accentHover: '#f8a0c4',
      accentInk: '#2b0a18',
      ...DARK_STATUS,
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    scheme: 'dark',
    tokens: {
      background: '#111111',
      surface: '#191919',
      surfaceElevated: '#212121',
      surfaceHover: '#2a2a2a',
      border: '#ffffff17',
      borderStrong: '#ffffff2b',
      textPrimary: '#ededed',
      textSecondary: '#b4b4b4',
      textMuted: '#808080',
      accent: '#e4e4e4',
      accentHover: '#ffffff',
      accentInk: '#111111',
      ...DARK_STATUS,
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    scheme: 'dark',
    tokens: {
      background: '#0b130f',
      surface: '#111c16',
      surfaceElevated: '#18261e',
      surfaceHover: '#1f3027',
      border: '#dcf5e617',
      borderStrong: '#dcf5e629',
      textPrimary: '#e5f2ea',
      textSecondary: '#a7bdb0',
      textMuted: '#718a7c',
      accent: '#8fdcaa',
      accentHover: '#aee8c2',
      accentInk: '#0b2416',
      ...DARK_STATUS,
    },
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, Theme>;
export const DEFAULT_THEME: ThemeId = 'forest';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && v in THEME_BY_ID;

/** older saves stored 'dusk' / 'night', which were never applied: Ember is the look they had */
export function migrateTheme(v: unknown): ThemeId {
  if (isThemeId(v)) return v;
  if (v === 'dusk' || v === 'night') return 'ember';
  // RealmNest Dark was removed (Forest is its near twin)
  if (v === 'nestra') return 'forest';
  return DEFAULT_THEME;
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** the CSS custom properties of a theme, e.g. { '--text-primary': '#…' } */
export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.tokens)) vars[`--${kebab(k)}`] = v;
  return vars;
}

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  const theme = THEME_BY_ID[id] ?? THEME_BY_ID[DEFAULT_THEME];
  for (const [k, v] of Object.entries(themeVariables(theme))) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  root.style.colorScheme = theme.scheme;
}

/** WCAG relative luminance contrast between two #rrggbb colours (alpha ignored) */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '').slice(0, 6);
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
