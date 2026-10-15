// Small UI kit shared by every screen.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgentState } from '../domain/sim';
import { STATE_COLORS, type TKey } from '../i18n';
import { getSprite, type Look, type PoseMode, type SpriteDir, SPRITE_H, SPRITE_W } from '../render/sprites';
import { castAnimFor, castBox, castFrameAt, castMirror, castReady, getCastFrame, onCastReady } from '../render/cast/castPeople';
import { useT } from './context';
import { startLoop } from './loop';

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe3c8" />
          <stop offset="1" stopColor="#f2c294" />
        </linearGradient>
        <linearGradient id="lg-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1de" />
          <stop offset="1" stopColor="#f2b98a" />
        </linearGradient>
      </defs>
      <path d="M32 1 L35 10 L44 13 L35 16 L32 25 L29 16 L20 13 L29 10 Z" fill="url(#lg-star)" />
      <polygon points="32,24 54,35 32,46 10,35" fill="url(#lg-top)" />
      <polygon points="10,35 32,46 32,63 10,52" fill="#e9a875" />
      <polygon points="32,46 54,35 54,52 32,63" fill="#bf7a4c" />
      <polygon points="32,29 43,35 32,41 21,35" fill="#2a1d14" opacity="0.85" />
      <polyline points="21,35 32,41 43,35" fill="none" stroke="#f7d3ae" strokeWidth="1.2" />
    </svg>
  );
}

export function Button({
  children,
  onClick,
  tone = 'default',
  size = 'md',
  disabled,
  title,
  icon,
  className = '',
  type = 'button',
}: {
  children?: ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={`btn btn-${tone} btn-${size} ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {icon}
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, sub, k }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string; k?: string }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="toggle-text">
        <span>
          {label} {k && <kbd>{k}</kbd>}
        </span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`} />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  label,
  format = (v) => `${Math.round(((v - min) / (max - min)) * 100)}%`,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  /** how the value reads (default: a percentage of the range) */
  format?: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <output>{format(value)}</output>
    </label>
  );
}

export function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === value} aria-label={c} className={c === value ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={`chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StateBadge({ state }: { state: AgentState }) {
  const t = useT();
  return (
    <span className="state-badge" style={{ ['--s' as string]: STATE_COLORS[state] }}>
      <i />
      {t(`state.${state}` as TKey)}
    </span>
  );
}

/** open modals, innermost last: Escape and the focus trap belong to the top one only */
const modalStack: object[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const focusables = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  // the latest onClose without re-registering (a re-run would reorder the stack)
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const me = {};
    modalStack.push(me);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = box.current;
    // focus moves into the dialog (a field that focused itself keeps it); the dialog, not a button,
    // so Enter cannot confirm something by accident
    if (el && !el.contains(document.activeElement)) el.focus();
    const k = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== me || !el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      } else if (e.key === 'Tab') {
        // Tab cycles inside the dialog
        const items = focusables(el);
        if (!items.length) return e.preventDefault();
        const first = items[0];
        const last = items[items.length - 1];
        const at = document.activeElement;
        if (e.shiftKey && (at === first || at === el || !el.contains(at))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (at === last || !el.contains(at))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      modalStack.splice(modalStack.indexOf(me), 1);
      // back where the user was (the button that opened it), when it is still there
      if (before?.isConnected) before.focus();
    };
  }, []);
  // on the body: a screen's glass panel (backdrop-filter) would otherwise hold and clip it
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} style={{ outline: 'none' }} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal aria-label={title}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Pixel-perfect character portrait, optionally animated: the Cast figure once its atlases are loaded. */
export function Portrait({
  look,
  scale = 4,
  mode = 'stand',
  dir = 's',
  bust,
  sit,
  animate,
  className,
}: {
  look: Look;
  scale?: number;
  mode?: PoseMode;
  dir?: SpriteDir;
  bust?: boolean;
  /** seated (Cast only) */
  sit?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cast, setCast] = useState(castReady);
  useEffect(() => (cast ? undefined : onCastReady(() => setCast(true))), [cast]);
  const h = bust ? 21 : SPRITE_H;
  // the Cast frame's visible part (the same box for every frame of this look, so it does not jump)
  const box = cast ? castBox(look, !!bust) : null;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext('2d')!;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      c.imageSmoothingEnabled = false;
      if (box) {
        const pose = { dir, mode, frame: Math.floor(t * 12) % 8, sit };
        const a = castAnimFor(pose);
        const fr = getCastFrame(look, a, animate ? castFrameAt(a, pose, t) : 0, castMirror(pose));
        if (fr) c.drawImage(fr, box.x, box.y + (a === 'sit' ? -6 : 0), box.w, box.h, 0, 0, box.w, box.h);
        return;
      }
      const frames = mode === 'walk' ? 4 : mode === 'stand' ? 1 : 2;
      const frame = animate ? Math.floor(t * (mode === 'walk' ? 7 : 4)) % frames : 0;
      const blink = !!animate && t % 3.2 > 3.05;
      c.drawImage(getSprite(look, { dir, mode, frame, blink }), 0, 0, SPRITE_W, h, 0, 0, SPRITE_W * scale, h * scale);
    };
    if (animate) return startLoop(draw, 12);
    draw(t0);
  }, [look, scale, mode, dir, h, animate, sit, box?.x, box?.y, box?.w, box?.h]);
  if (box) {
    // the art at 1:1, shown at the size the old portrait had (pixelated up, smooth down)
    const cssH = h * scale;
    return <canvas ref={ref} width={box.w} height={box.h} className={`portrait cast ${className ?? ''}`} style={{ height: cssH, width: (cssH * box.w) / box.h, imageRendering: cssH >= box.h ? 'pixelated' : 'auto' }} aria-hidden />;
  }
  return <canvas ref={ref} width={SPRITE_W * scale} height={h * scale} className={`portrait ${className ?? ''}`} aria-hidden />;
}

export function Empty({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {sub && <span>{sub}</span>}
      {children}
    </div>
  );
}
