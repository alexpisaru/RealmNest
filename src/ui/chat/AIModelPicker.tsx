// One compact AI selector for Chat, as a two-level menu: the first list holds
// Auto (the default chat route) and the user's connections; hovering or
// clicking a connection opens its models beside it. Everything comes from the
// live connections, their catalogues and the Capability System; nothing names
// a provider or a model here.
//
//   ┌───────────────────┐ ┌──────────────────────────┐
//   │ ✦ Auto            │ │ Models · OpenRouter 2     │
//   │ Claude Code     › │ │ 🔍 Search 458 models…     │
//   │ OpenRouter 2  ✓ › │ │ Default                   │
//   │───────────────────│ │ Nemotron 3 Super (free) ✓ │
//   │ Manage AI conn.   │ │ …                         │
//   └───────────────────┘ └──────────────────────────┘

import { Check, ChevronDown, ChevronRight, Search, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AIConnection } from '../../domain/connection';
import type { ModelInfo } from '../../runtime/providers/types';
import { statusLabel, useConnectionLabel } from '../connections';
import { useCapabilities, useChat, useConnections, useServices, useT } from '../context';
import { contextSummary, priceSummary, searchModels } from '../ModelPicker';

/** what the chat will use: the routing policy, or a connection (and maybe a model) */
export type AITarget = { auto: true } | { auto?: false; connectionId: string; model?: string };

const LISTED = 60;
const RECENT = 4;
const FLY_W = 330;
const GAP = 6;
const HOVER_MS = 140;
/** statuses where a turn cannot work until the user fixes the connection */
const BROKEN = new Set(['invalid_credentials', 'auth_required', 'unavailable', 'error', 'disconnected']);

/** "NVIDIA: Nemotron 3 Super (free)" → "Nemotron 3 Super (free)" */
export function shortModelName(m: ModelInfo | undefined, id?: string): string | undefined {
  const label = m?.label ?? id;
  if (!label) return undefined;
  return label.includes(': ') ? label.slice(label.indexOf(': ') + 2) : label;
}

export function AIModelPicker({
  value,
  onChange,
  lockedConnectionId,
  lockedReason,
  disabled,
}: {
  value: AITarget;
  onChange: (v: AITarget) => void;
  /** a started chat or an agent chat: only this connection's models */
  lockedConnectionId?: string;
  lockedReason?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const connections = useConnections();
  const capabilities = useCapabilities();
  const { store } = useServices();
  const labelOf = useConnectionLabel();
  const [open, setOpen] = useState(false);
  /** the connection whose models are shown beside the list */
  const [flyFor, setFlyFor] = useState<string | null>(null);
  // hover changes the panel after a short pause, so moving the pointer
  // diagonally towards the models does not switch to the rows it crosses
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTo = (id: string | null) => {
    if (hover.current) clearTimeout(hover.current);
    hover.current = setTimeout(() => setFlyFor(id), HOVER_MS);
  };
  const showNow = (id: string | null) => {
    if (hover.current) clearTimeout(hover.current);
    setFlyFor(id);
  };
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);
  const [side, setSide] = useState<'right' | 'left'>('right');
  /** room between the composer and the edge the menu opens towards */
  const [room, setRoom] = useState(520);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => (window.removeEventListener('mousedown', close), window.removeEventListener('keydown', esc));
  }, [open]);

  // models open beside the list: on the right when there is room, else on the left
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const btn = box.current.getBoundingClientRect();
    const area = box.current.closest('.chat-surface')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    setSide(btn.right + GAP + FLY_W <= area.right - 8 ? 'right' : 'left');
    // an empty chat opens the menu downwards, an active one upwards
    const down = !!box.current.closest('.is-empty');
    setRoom(Math.max(220, Math.min(520, down ? area.bottom - btn.bottom - 24 : btn.top - area.top - 24)));
  }, [open]);

  const route = capabilities.resolveRoute('text.chat');
  const hasRoute = capabilities.targets('text.chat').length > 0;

  const modelLabel = (connectionId: string, model?: string) => {
    const c = connections.get(connectionId);
    const id = model || c?.preferredModel;
    if (!id) return c?.name ?? t('picker.default');
    return shortModelName(connections.models(connectionId).find((m) => m.id === id), id)!;
  };
  const current = value.auto
    ? `${t('picker.auto')}${route.ok ? ` · ${modelLabel(route.target!.connectionId, route.target!.modelId)}` : ''}`
    : modelLabel(value.connectionId, value.model);

  const shown = connections.list().filter((c) => !lockedConnectionId || c.id === lockedConnectionId);
  const pick = (v: AITarget) => (onChange(v), setOpen(false));
  const toggle = () => {
    // start on the connection in use, so its models (and the ✓) are in view
    if (!open) setFlyFor(lockedConnectionId ?? (value.auto ? null : value.connectionId));
    setOpen((v) => !v);
  };
  const fly = flyFor ? connections.get(flyFor) : undefined;
  // "458 models", or the provider when the connection has another name
  const connectionHint = (c: AIConnection) => {
    const n = connections.models(c.id).length;
    if (n) return t('picker.count', { n });
    const provider = connections.catalog.get(c.providerId)?.name;
    return provider && provider !== c.name ? provider : t('picker.default');
  };

  return (
    <div className="ai-picker" ref={box}>
      <button type="button" className="ai-picker-btn" disabled={disabled} onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={`${t('picker.label')}: ${current}`} title={value.auto ? undefined : labelOf(value.connectionId)}>
        {value.auto && <Sparkles size={13} />}
        <span>{current}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        // the list always sits under the button; the models panel is placed beside it
        <div className={`ai-menu side-${side}`} style={{ ['--menu-max' as string]: `${room}px` }}>
          <div className="ai-pop" role="menu" aria-label={t('picker.label')}>
            {lockedReason && <p className="ai-pop-note">{lockedReason}</p>}
            {!lockedConnectionId && (
              <button
                type="button"
                className={`ai-row ai-auto ${value.auto ? 'on' : ''}`}
                disabled={!route.ok}
                onMouseEnter={() => hoverTo(null)}
                onClick={() => pick({ auto: true })}
                role="menuitemradio"
                aria-checked={!!value.auto}
              >
                <Sparkles size={15} />
                <span className="ai-row-text">
                  <b>{t('picker.auto')}</b>
                  <small>{route.ok ? `→ ${connections.get(route.target!.connectionId)?.name ?? ''} · ${modelLabel(route.target!.connectionId, route.target!.modelId)}${route.source === 'fallback' ? ` (${t('a.picker.fallback')})` : ''}` : hasRoute ? route.reason : t('picker.autoNone')}</small>
                </span>
                {value.auto && <Check size={15} />}
              </button>
            )}
            {shown.map((c) => {
              const inUse = !value.auto && value.connectionId === c.id;
              const broken = BROKEN.has(c.status);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ai-row ai-conn ${flyFor === c.id ? 'open' : ''} ${broken ? 'broken' : ''}`}
                  onMouseEnter={() => hoverTo(c.id)}
                  onFocus={() => showNow(c.id)}
                  onClick={() => showNow(c.id)}
                  onKeyDown={(e) => e.key === 'ArrowRight' && showNow(c.id)}
                  aria-haspopup="menu"
                  aria-expanded={flyFor === c.id}
                >
                  <i className={`ai-dot ${c.status}`} aria-hidden />
                  <span className="ai-row-text">
                    <b>{c.name}</b>
                    <small>{c.status !== 'connected' ? statusLabel(t, c.status) : inUse ? (value.model || c.preferredModel ? modelLabel(c.id, value.model) : t('picker.default')) : connectionHint(c)}</small>
                  </span>
                  {inUse && <Check size={15} className="ai-inuse" />}
                  <ChevronRight size={15} className="ai-chev" />
                </button>
              );
            })}
            <button type="button" className="ai-row ai-manage" onMouseEnter={() => hoverTo(null)} onClick={() => (setOpen(false), store.openSettings('ai'))}>
              <Settings2 size={15} />
              <span className="ai-row-text">
                <b>{t('picker.manage')}</b>
              </span>
            </button>
          </div>
          {fly && (
            // reaching the panel keeps it: no pending switch to a row the pointer crossed
            <div className="ai-fly-wrap" onMouseEnter={() => hover.current && clearTimeout(hover.current)}>
              <ModelsPanel key={fly.id} c={fly} value={value} onPick={pick} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The models of one connection, beside the connection list. */
function ModelsPanel({ c, value, onPick }: { c: AIConnection; value: AITarget; onPick: (v: AITarget) => void }) {
  const t = useT();
  const connections = useConnections();
  const capabilities = useCapabilities();
  const chat = useChat();
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const broken = BROKEN.has(c.status);
  const selected = !value.auto && value.connectionId === c.id;
  const catalog = connections.models(c.id);
  // the catalogue split by what the Capability System knows about chat
  const split = useMemo(() => capabilities.modelsFor(c.id, 'text.chat'), [capabilities, c.id, catalog.length, capabilities.getVersion()]);
  const usable = useMemo(() => [...split.supported, ...split.unknown], [split]);
  const unknown = useMemo(() => new Set(split.unknown.map((m) => m.id)), [split]);

  // first: the current model, the preferred one and models used in recent chats here
  const recent = useMemo(() => {
    const ids: string[] = [];
    const add = (id?: string) => id && !ids.includes(id) && usable.some((m) => m.id === id) && ids.push(id);
    if (selected) add(value.model);
    add(c.preferredModel);
    for (const conv of chat.list()) if (conv.connectionId === c.id) add(conv.model);
    return ids.slice(0, RECENT).map((id) => usable.find((m) => m.id === id)!);
  }, [usable, selected, value, c.preferredModel, chat]);
  const rest = useMemo(() => {
    // OpenRouter's own router first when the catalogue has it
    const ranked = [...usable].sort((a, b) => Number(b.id.endsWith('/auto')) - Number(a.id.endsWith('/auto')));
    return query ? searchModels(ranked, query) : ranked.filter((m) => !recent.includes(m));
  }, [usable, recent, query]);
  const isOn = (model?: string) => selected && (value.model || '') === (model || '');

  const row = (m: ModelInfo) => (
    <button key={m.id} type="button" className={`ai-row ${isOn(m.id) ? 'on' : ''}`} onClick={() => onPick({ connectionId: c.id, model: m.id })} role="menuitemradio" aria-checked={isOn(m.id)} title={m.id}>
      <span className="ai-row-text">
        <b>{shortModelName(m)}</b>
        <small>
          {[m.providerLabel, contextSummary(m.contextLength), priceSummary(m, t)].filter(Boolean).join(' · ')}
          {unknown.has(m.id) && <span className="badge">{t('a.picker.chatUnstated')}</span>}
        </small>
      </span>
      {isOn(m.id) && <Check size={15} />}
    </button>
  );

  return (
    <div className="ai-fly" role="menu" aria-label={`${t('picker.models')} · ${c.name}`}>
      <div className="ai-fly-head">
        <b>{t('picker.models')}</b>
        <small>{c.name}</small>
      </div>
      {broken ? (
        <p className="ai-pop-note">{c.statusMessage ?? statusLabel(t, c.status)}</p>
      ) : (
        <>
          {catalog.length > 0 && (
            <label className="ai-search">
              <Search size={13} />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('picker.search', { n: usable.length })} aria-label={`${t('picker.search', { n: usable.length })} (${c.name})`} />
            </label>
          )}
          <div className="ai-fly-list">
            {/* "Default" only when it means something: a preferred model, or a provider default (no catalogue) */}
            {!query && (c.preferredModel || !catalog.length) && (
              <button type="button" className={`ai-row ${isOn('') ? 'on' : ''}`} onClick={() => onPick({ connectionId: c.id })} role="menuitemradio" aria-checked={isOn('')}>
                <span className="ai-row-text">
                  <b>{t('picker.default')}</b>
                  <small>{c.preferredModel ? shortModelName(catalog.find((m) => m.id === c.preferredModel), c.preferredModel) : t('picker.defaultSub')}</small>
                </span>
                {isOn('') && <Check size={15} />}
              </button>
            )}
            {!query && recent.length > 0 && (
              <>
                <h5>{t('picker.recent')}</h5>
                {recent.map(row)}
              </>
            )}
            {rest.length > 0 && (
              <>
                {!query && <h5>{t('picker.all', { n: usable.length })}</h5>}
                {rest.slice(0, LISTED).map(row)}
                {rest.length > LISTED && <p className="ai-pop-note">{t('picker.more', { n: rest.length - LISTED })}</p>}
              </>
            )}
            {query && rest.length === 0 && <p className="ai-pop-note">{t('picker.noMatch')}</p>}
            {!catalog.length && (
              <form className="ai-search" onSubmit={(e) => (e.preventDefault(), custom.trim() && onPick({ connectionId: c.id, model: custom.trim() }))}>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('picker.custom')} aria-label={`${t('picker.custom')} (${c.name})`} />
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
