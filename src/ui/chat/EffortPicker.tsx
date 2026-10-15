// Reasoning effort ("Impegno"): a compact pill beside the model in the chat composer, and a
// select under the model in the agent panel. Both offer only the levels the chosen model
// lists (ModelInfo.reasoning.efforts) and show nothing for a model that lists none.
// "Default" sends no level: the backend's own default (named when the provider states it).

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defaultEffort, isEffortLevel, modelEfforts } from '../../runtime/providers/effort';
import { useConnections, useT } from '../context';

type Tr = ReturnType<typeof useT>;

/** "Medio" / "Medium"; a level RealmNest has no label for is shown as it is */
export function effortLabel(t: Tr, level: string): string {
  return isEffortLevel(level) ? t(`a.effort.${level}`) : level;
}

/** the levels of a connection's model and its default (none: no effort choice for it) */
export function useEfforts(connectionId: string | undefined, modelId: string | undefined): { efforts: string[]; byDefault?: string } {
  const connections = useConnections();
  const models = connectionId ? connections.models(connectionId) : [];
  return { efforts: modelEfforts(models, modelId), byDefault: defaultEffort(models, modelId) };
}

function defaultText(t: Tr, byDefault: string | undefined) {
  return byDefault ? t('a.effort.defaultOf', { level: effortLabel(t, byDefault) }) : t('a.effort.default');
}

/** the composer pill ("Impegno: Medio") and its menu; nothing when the model has no levels */
export function EffortPicker({ efforts, byDefault, value, onChange, disabled }: { efforts: string[]; byDefault?: string; value: string | undefined; onChange: (effort: string) => void; disabled?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    // Escape closes the menu only (not the chat or the panel behind it)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc, true);
    return () => (window.removeEventListener('mousedown', close), window.removeEventListener('keydown', esc, true));
  }, [open]);
  if (!efforts.length) return null;
  // a level the model does not list (another model was chosen) counts as the default
  const current = value && efforts.includes(value) ? value : '';
  const shown = current ? effortLabel(t, current) : t('a.effort.default');
  const pick = (v: string) => (onChange(v), setOpen(false));
  const row = (v: string, label: string) => (
    <button key={v || 'default'} type="button" className={`ai-row ${current === v ? 'on' : ''}`} onClick={() => pick(v)} role="menuitemradio" aria-checked={current === v}>
      <span className="ai-row-text">
        <b>{label}</b>
      </span>
      {current === v && <Check size={15} />}
    </button>
  );
  return (
    <div className="ai-picker effort-picker" ref={box}>
      <button type="button" className="ai-picker-btn effort-btn" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`${t('a.effort.label')}: ${shown}`} title={t('a.effort.hint')}>
        <span>
          {t('a.effort.label')}: {shown}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="ai-menu">
          <div className="ai-pop effort-pop" role="menu" aria-label={t('a.effort.label')}>
            <p className="ai-pop-note">{t('a.effort.hint')}</p>
            {row('', defaultText(t, byDefault))}
            {efforts.map((e) => row(e, effortLabel(t, e)))}
          </div>
        </div>
      )}
    </div>
  );
}

/** the agent panel's select (the app's themed select); nothing when the model has no levels */
export function EffortSelect({ efforts, byDefault, value, onChange, disabled }: { efforts: string[]; byDefault?: string; value: string | undefined; onChange: (effort: string) => void; disabled?: boolean }) {
  const t = useT();
  if (!efforts.length) return null;
  const current = value && efforts.includes(value) ? value : '';
  return (
    <select value={current} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={t('a.effort.label')} title={t('a.effort.hint')}>
      <option value="">{defaultText(t, byDefault)}</option>
      {efforts.map((e) => (
        <option key={e} value={e}>
          {effortLabel(t, e)}
        </option>
      ))}
    </select>
  );
}
