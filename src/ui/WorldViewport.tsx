import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Camera } from '../render/camera';
import { DEFAULT_RENDER, readyRenderer, type RenderOptions } from '../render/worldRenderer';
import { useApp, useServices } from './context';

export interface ViewportControls {
  zoom: (dir: 1 | -1) => void;
  reset: () => void;
}

interface Props {
  interactive?: boolean;
  /** debug: when set, clicks on the floor report the tile instead of selecting */
  onTile?: (t: { x: number; y: number }) => void;
  controls?: Ref<ViewportControls>;
  className?: string;
  /** extra zoom-out for small previews */
  padding?: number;
  /** CSS px covered on the right (e.g. an open drawer) — the world centres in the rest */
  insetRight?: number;
}

/** Live isometric view of the current world session. */
export function WorldViewport({ interactive = true, onTile, controls, className, padding = 0, insetRight = 0 }: Props) {
  const { sessions } = useServices();
  const settings = useApp().settings;
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const cam = useRef(new Camera());
  const fitted = useRef<string>('');
  const hover = useRef<string | null>(null);
  const opts = useRef<RenderOptions>(DEFAULT_RENDER);
  const onTileRef = useRef(onTile);
  onTileRef.current = onTile;
  const insetRef = useRef(insetRight);
  insetRef.current = insetRight;

  opts.current = {
    labels: settings.showLabels,
    showPaths: settings.showPaths,
    showPoints: settings.showPoints,
    showTargets: settings.showTargets,
    showGrid: settings.showGrid,
    animSpeed: settings.animationSpeed,
    selected: new Set(),
    night: settings.night,
  };

  const view = () => {
    const el = cv.current!;
    return { w: el.width, h: el.height, dpr: window.devicePixelRatio || 1 };
  };

  const refit = () => {
    const s = sessions.session;
    if (!s || !cv.current) return;
    const r = readyRenderer(s.world);
    if (!r) return;
    const b = r.bounds();
    const { w, h, dpr } = view();
    const pad = padding * dpr;
    const inset = insetRight * dpr;
    cam.current.fit(b, w - pad * 2 - inset, h - pad * 2 - 80 * dpr * (interactive ? 1 : 0), interactive && settings.defaultZoom ? settings.defaultZoom * dpr : 0);
    cam.current.cx += inset / 2 / cam.current.zoom;
    cam.current.clamp(r.sceneBounds(), w, h, inset);
    fitted.current = s.world.id;
  };

  useImperativeHandle(controls, () => ({
    zoom: (dir) => {
      const { w, h } = view();
      cam.current.zoomAt(dir, w / 2, h / 2, w, h);
    },
    reset: refit,
  }));

  useEffect(() => {
    if (fitted.current) refit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetRight]);

  useEffect(() => {
    const el = cv.current!;
    const container = wrap.current!;
    const c = el.getContext('2d')!;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(container.clientWidth * dpr));
      el.height = Math.max(1, Math.round(container.clientHeight * dpr));
      el.style.width = `${container.clientWidth}px`;
      el.style.height = `${container.clientHeight}px`;
      refit();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const off = sessions.onFrame((now) => {
      const s = sessions.session;
      if (!s) return;
      const r = readyRenderer(s.world);
      const { w, h, dpr } = view();
      if (!r) {
        // still building (in a worker): a quiet dusk in the world's colours
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, s.world.theme.sky[0]);
        g.addColorStop(1, s.world.theme.sky[1]);
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        return;
      }
      if (fitted.current !== s.world.id) refit();
      const o = { ...opts.current, selected: s.selected, hover: hover.current };
      r.renderFrame(s.sim, now / 1000, o, [], r.viewOf(cam.current, w, h));
      r.composite(c, w, h, cam.current, s.sim, o, dpr);
    });
    return () => {
      off();
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, interactive, padding]);

  // ── input ──────────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const local = (e: React.MouseEvent | MouseEvent) => {
    const r = cv.current!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
  };
  const pick = (sx: number, sy: number) => {
    const s = sessions.session;
    const r = s ? readyRenderer(s.world) : null;
    if (!s || !r) return { id: null as string | null, tile: null as { x: number; y: number } | null };
    const { w, h } = view();
    const f = cam.current.toFrame(sx, sy, w, h);
    const id = r.pickAgent(s.sim, f.x, f.y);
    const wt = r.unproject(f.x, f.y);
    const tile = { x: Math.floor(wt.x), y: Math.floor(wt.y) };
    return { id, tile: s.sim.grid.inside(tile.x, tile.y) ? tile : null };
  };

  const handlers = interactive
    ? {
        onWheel: (e: React.WheelEvent) => {
          const p = local(e);
          const { w, h } = view();
          cam.current.zoomAt(e.deltaY < 0 ? 1 : -1, p.x, p.y, w, h);
          const r = sessions.session && readyRenderer(sessions.session.world);
          if (r) cam.current.clamp(r.sceneBounds(), w, h, insetRef.current * (window.devicePixelRatio || 1));
        },
        onMouseDown: (e: React.MouseEvent) => {
          drag.current = { ...local(e), moved: false };
        },
        onMouseMove: (e: React.MouseEvent) => {
          const p = local(e);
          if (drag.current && e.buttons) {
            const dx = p.x - drag.current.x;
            const dy = p.y - drag.current.y;
            if (drag.current.moved || Math.hypot(dx, dy) > 4) {
              drag.current.moved = true;
              cam.current.pan(dx, dy);
              const r = sessions.session && readyRenderer(sessions.session.world);
              if (r) cam.current.clamp(r.sceneBounds(), view().w, view().h, insetRef.current * (window.devicePixelRatio || 1));
              drag.current.x = p.x;
              drag.current.y = p.y;
            }
            e.currentTarget.classList.add('grabbing');
            return;
          }
          const { id } = pick(p.x, p.y);
          hover.current = id;
          (e.currentTarget as HTMLElement).style.cursor = id ? 'pointer' : onTileRef.current ? 'crosshair' : 'grab';
        },
        onMouseUp: (e: React.MouseEvent) => {
          e.currentTarget.classList.remove('grabbing');
          const d = drag.current;
          drag.current = null;
          if (d?.moved) return;
          const p = local(e);
          const { id, tile } = pick(p.x, p.y);
          if (onTileRef.current && tile && !id) return onTileRef.current(tile);
          sessions.session?.select(id, e.shiftKey || e.ctrlKey || e.metaKey);
        },
        onMouseLeave: () => {
          drag.current = null;
          hover.current = null;
        },
      }
    : {};

  return (
    <div ref={wrap} className={`viewport ${className ?? ''}`}>
      <canvas ref={cv} {...handlers} />
    </div>
  );
}
