// Who a new chat talks to: RealmNest or one of the agents. The same control as the AI picker (a
// quiet button, a menu of rows with a tick), not a native select.

import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Character } from '../../domain/character';
import { useT, useTD } from '../context';
import { Portrait } from '../kit';
import { lookOf } from '../sessionManager';

export function AgentPicker({ value, agents, onChange, disabled }: { value: string; agents: Character[]; onChange: (id: string) => void; disabled?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => (window.removeEventListener('mousedown', close), window.removeEventListener('keydown', esc));
  }, [open]);
  // as tall as the room between the composer and the screen's edge it opens towards
  const [room, setRoom] = useState(420);
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const btn = box.current.getBoundingClientRect();
    const area = box.current.closest('.chat-surface')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const down = !!box.current.closest('.is-empty');
    setRoom(Math.max(180, Math.min(420, down ? area.bottom - btn.bottom - 24 : btn.top - area.top - 24)));
  }, [open]);
  const sorted = useMemo(() => [...agents].sort((a, b) => a.name.localeCompare(b.name)), [agents]);
  const current = agents.find((a) => a.id === value);
  const pick = (id: string) => (onChange(id), setOpen(false));

  return (
    <div className="ai-picker agent-picker" ref={box} title={t('chat.agentHint')}>
      <button type="button" className="ai-picker-btn" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`${t('chat.talkTo')}: ${current?.name ?? 'RealmNest'}`}>
        <span>{current?.name ?? 'RealmNest'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="ai-menu align-left" style={{ ['--menu-max' as string]: `${room}px` }}>
          <div className="ai-pop agent-pop" role="menu" aria-label={t('chat.talkTo')}>
            <button type="button" className={`ai-row ${!value ? 'on' : ''}`} onClick={() => pick('')} role="menuitemradio" aria-checked={!value}>
              <Sparkles size={15} />
              <span className="ai-row-text">
                <b>RealmNest</b>
                <small>{t('chat.assistantHint')}</small>
              </span>
              {!value && <Check size={15} />}
            </button>
            {sorted.map((c) => (
              <AgentRow key={c.id} c={c} on={c.id === value} onPick={() => pick(c.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentRow({ c, on, onPick }: { c: Character; on: boolean; onPick: () => void }) {
  const td = useTD();
  const look = useMemo(() => lookOf(c), [c]);
  return (
    <button type="button" className={`ai-row ${on ? 'on' : ''}`} onClick={onPick} role="menuitemradio" aria-checked={on}>
      <span className="agent-face">
        <Portrait look={look} scale={1} bust />
      </span>
      <span className="ai-row-text">
        <b>{c.name}</b>
        {c.role && <small>{td(c.role)}</small>}
      </span>
      {on && <Check size={15} />}
    </button>
  );
}
