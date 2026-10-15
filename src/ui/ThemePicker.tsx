// Settings › Appearance: every theme as a small preview (background, surface,
// accent, text). A click applies it at once; the choice is saved with the
// other settings.

import { Check } from 'lucide-react';
import { THEMES, type ThemeId } from '../themes';
import { useT } from './context';

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  const t = useT();
  return (
    <div className="theme-grid" role="radiogroup" aria-label={t('a.theme.label')}>
      {THEMES.map((th) => {
        const k = th.tokens;
        const on = th.id === value;
        return (
          <button key={th.id} type="button" role="radio" aria-checked={on} className={`theme-card ${on ? 'on' : ''}`} onClick={() => onChange(th.id)}>
            <span className="theme-preview" style={{ background: k.background, borderColor: k.border }}>
              <span className="tp-rail" style={{ background: k.surface }} />
              <span className="tp-panel" style={{ background: k.surfaceElevated, borderColor: k.border }}>
                <span className="tp-line" style={{ background: k.textPrimary }} />
                <span className="tp-line short" style={{ background: k.textMuted }} />
                <span className="tp-pill" style={{ background: k.accent }} />
              </span>
              <span className="tp-glow" style={{ background: `radial-gradient(closest-side, ${k.accent}55, transparent)` }} />
            </span>
            <span className="theme-name">
              <b>{th.name}</b>
              <small>{th.scheme === 'light' ? t('a.theme.light') : t('a.theme.dark')}</small>
              {on && <Check size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
