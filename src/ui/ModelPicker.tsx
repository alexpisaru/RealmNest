// Model choice for a connection. With a live catalogue (e.g. OpenRouter, hundreds
// of models) it is a searchable list; without one (e.g. Claude Code) a plain
// text field. "Automatic" means: the connection's preferred model, else the
// provider's default; it is never a made-up model id.
// The list opens over the page (a portal), so no panel can cut it off. Without a search it
// shows a few models, the chosen and recently used ones first, and "Show more".

import { Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CapabilityId } from '../domain/capability';
import type { ModelInfo } from '../runtime/providers/types';
import { translator, type TKey } from '../i18n';
import { useCapabilities, useConnections, useT } from './context';

/** the UI translator; plain helpers default to English when none is passed */
type Tr = ReturnType<typeof translator>;
const EN = translator('en');

const MAX_SHOWN = 80;
/** models listed before "Show more" (no search typed) */
const FEW = 5;
const RECENT_KEY = 'realmnest:model-recent';

/** the models last picked on each connection, newest first (this computer only) */
function recentModels(connectionId: string | undefined): string[] {
  if (!connectionId) return [];
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as Record<string, string[]>;
    return Array.isArray(all[connectionId]) ? all[connectionId] : [];
  } catch {
    return [];
  }
}
function rememberModel(connectionId: string | undefined, id: string) {
  if (!connectionId || !id) return;
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as Record<string, string[]>;
    all[connectionId] = [id, ...(all[connectionId] ?? []).filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(all));
  } catch {
    /* not remembered: the list keeps its usual order */
  }
}

/** the chosen model, then the recently used ones, then the rest (OpenRouter's own router first) */
export function rankModels(models: ModelInfo[], value: string | undefined, recent: string[]): ModelInfo[] {
  const order = [value, ...recent].filter((x): x is string => !!x);
  const rank = (m: ModelInfo) => {
    const i = order.indexOf(m.id);
    return i >= 0 ? i : order.length + (m.id.endsWith('/auto') ? 0 : 1);
  };
  return [...models].sort((a, b) => rank(a) - rank(b));
}
const MODALITIES = new Set(['image', 'file', 'audio', 'video']);

/** "$0.15 / $0.60 per 1M" · "free" · "variable" */
export function priceSummary(m: ModelInfo, t: Tr = EN): string | undefined {
  const p = m.pricing;
  if (!p?.prompt && !p?.completion) return undefined;
  const one = (v?: string) => {
    if (v === undefined) return '?';
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return t('a.price.variable');
    if (n === 0) return t('a.price.free');
    const per = n * 1_000_000;
    return `$${per < 1 ? per.toFixed(3) : per.toFixed(2)}`;
  };
  const a = one(p.prompt);
  const b = one(p.completion);
  if (a === t('a.price.free') && b === t('a.price.free')) return t('a.price.free');
  if (a === t('a.price.variable') || b === t('a.price.variable')) return t('a.price.variablePrice');
  return t('a.price.per', { a, b });
}

export function contextSummary(n?: number) {
  if (!n) return undefined;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M ctx` : `${Math.round(n / 1000)}k ctx`;
}

/** search over id, name and provider; every word must match */
export function searchModels(models: ModelInfo[], query: string): ModelInfo[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return models;
  return models.filter((m) => {
    const hay = `${m.id} ${m.label ?? ''} ${m.providerLabel ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** what "no model chosen" means on a connection */
export function defaultModelLabel(preferred: string | undefined, hasCatalog: boolean, t: Tr = EN) {
  if (preferred) return t('a.model.connDefault', { model: preferred });
  return hasCatalog ? t('a.model.choose') : t('a.model.auto');
}

export function ModelPicker({
  connectionId,
  value,
  onChange,
  disabled,
  autoLabel: autoLabelIn,
  capability = 'text.chat',
}: {
  connectionId: string | undefined;
  value: string | undefined;
  onChange: (model: string) => void;
  disabled?: boolean;
  autoLabel?: string;
  /** list the models that support this capability ('all': the whole catalogue, for debugging) */
  capability?: CapabilityId | 'all';
}) {
  const t = useT();
  const autoLabel = autoLabelIn ?? t('a.model.auto');
  const caps = useCapabilities();
  const connections = useConnections();
  const split = useMemo(
    () => (!connectionId ? { supported: [], unknown: [] } : capability === 'all' ? { supported: connections.models(connectionId), unknown: [] } : caps.modelsFor(connectionId, capability)),
    [caps, connections, connectionId, capability, caps.getVersion()],
  );
  const models = useMemo(() => [...split.supported, ...split.unknown], [split]);
  const unknownIds = useMemo(() => new Set(split.unknown.map((m) => m.id)), [split]);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number }>({ left: 0, maxHeight: 420 });
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  // under the button, or above it when there is no room; inside the window
  const measure = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(460, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
    const below = window.innerHeight - r.bottom - 16;
    const above = r.top - 16;
    setPlace(below >= 300 || below >= above ? { left, top: r.bottom + 6, maxHeight: Math.min(420, below) } : { left, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(420, above) });
  };
  useLayoutEffect(() => {
    if (open) measure();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node) && setOpen(false);
    // the button moved (a panel scrolled, the window changed): the list follows it
    const follow = (e: Event) => !pop.current?.contains(e.target as Node) && measure();
    // Escape closes the list only (not the panel or the world view behind it)
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', measure);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);

  if (!models.length)
    return (
      <input
        key={`${connectionId}-${value}`}
        className="model-text"
        defaultValue={value ?? ''}
        placeholder={autoLabel}
        disabled={disabled}
        onBlur={(e) => e.target.value.trim() !== (value ?? '') && onChange(e.target.value.trim())}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={t('a.model.label')}
      />
    );

  const current = models.find((m) => m.id === value);
  const ranked = rankModels(models, value, recentModels(connectionId));
  const found = searchModels(ranked, query);
  // no search: a few models, the rest behind "Show more"
  const short = !query && !all && found.length > FEW;
  const shown = short ? found.slice(0, FEW) : found.slice(0, MAX_SHOWN);
  const pick = (id: string) => {
    rememberModel(connectionId, id);
    onChange(id);
    setOpen(false);
    setAll(false);
    setQuery('');
  };

  return (
    <div className="model-picker" ref={box}>
      <button
        type="button"
        className="model-current"
        disabled={disabled}
        onClick={() => {
          setAll(false);
          setOpen((v) => !v);
        }}
        aria-label={t('a.model.label')}
        aria-expanded={open}
      >
        <span>{value ? (current?.label ?? value) : autoLabel}</span>
        {/* the same marker as the themed drop-downs (select::picker-icon) */}
        <span className="picker-caret" aria-hidden="true">▼</span>
      </button>
      {open &&
        createPortal(
        <div className="model-pop floating" role="listbox" ref={pop} style={{ left: place.left, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}>
          <label className="model-search">
            <Search size={14} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('picker.search', { n: models.length })} aria-label={t('a.model.searchLabel')} />
          </label>
          <ul>
            {!query && (
              <li>
                <button type="button" className={!value ? 'on' : ''} onClick={() => pick('')}>
                  <b>{autoLabel}</b>
                  <small>{t('a.model.preferred')}</small>
                </button>
              </li>
            )}
            {shown.map((m, i) => (
              <li key={m.id} className={unknownIds.has(m.id) && !unknownIds.has(shown[i - 1]?.id ?? '') ? 'model-unknown-start' : undefined}>
                <button type="button" className={m.id === value ? 'on' : ''} onClick={() => pick(m.id)} role="option" aria-selected={m.id === value}>
                  <b>{m.label ?? m.id}</b>
                  <small>
                    <code>{m.id}</code>
                    {contextSummary(m.contextLength) && <span>{contextSummary(m.contextLength)}</span>}
                    {priceSummary(m, t) && <span>{priceSummary(m, t)}</span>}
                    {m.inputModalities?.filter((x) => x !== 'text').map((x) => (
                      <span key={x} className="badge">
                        {t('a.model.input', { kind: MODALITIES.has(x) ? t(`a.mod.${x}` as TKey) : x })}
                      </span>
                    ))}
                    {unknownIds.has(m.id) && <span className="badge">{t('a.model.unstated')}</span>}
                  </small>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted small">{t('picker.noMatch')}</li>}
            {short && (
              <li>
                <button type="button" className="model-more" onClick={() => setAll(true)}>
                  {t('a.model.more', { n: found.length - FEW })}
                </button>
              </li>
            )}
            {!short && shown.length === MAX_SHOWN && <li className="muted small">{t('a.model.first', { n: MAX_SHOWN })}</li>}
          </ul>
        </div>,
          document.body,
        )}
    </div>
  );
}
