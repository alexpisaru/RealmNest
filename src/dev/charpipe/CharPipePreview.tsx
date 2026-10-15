// Dev only: plays the sprite sheets made by `npm run character:build` (tools/charpipe) next to the
// shipped character renderer, so EffectCraft's output can be judged at RealmNest's own pixel density.
// Nothing here is used by the app; the production characters are untouched.
import { useEffect, useMemo, useRef, useState } from 'react';
import { composeTemplate } from '../../render/hd4/peopleTemplate';
import type { PoseMode } from '../../render/sprites';

interface Manifest {
  id: string;
  name: string;
  effectcraft: string;
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  modes: Record<string, string>;
  outfits: Record<string, string>;
  accessories: Record<string, string>;
  animations: { id: string; label: string; frames: number; fps: number; loop: boolean }[];
  sheets: Record<string, Record<string, Record<string, string>>>;
}

const manifests = import.meta.glob<Manifest>('/src/assets/characters/prototype/*/*.anims.json', { eager: true, import: 'default' });
const sheetUrls = import.meta.glob<string>('/src/assets/characters/prototype/**/*.png', { eager: true, query: '?url', import: 'default' });
const OFFICE = '/baked/office/scene.webp';

type View = 'production' | 'outfits' | 'modes' | 'world';
const VIEWS: [View, string][] = [
  ['production', 'vs shipped rig (Alex)'],
  ['outfits', 'Outfit transfer'],
  ['modes', 'x1 vs RotSprite'],
  ['world', 'In the office'],
];
/** the shipped renderer's pose and frame rate for each prototype animation (worldRenderer.poseFor) */
const PROD: Record<string, { mode: PoseMode; frames: number; fps: number }> = {
  idle: { mode: 'stand', frames: 1, fps: 1 },
  walk: { mode: 'walk', frames: 8, fps: 14 },
  walk_planar: { mode: 'walk', frames: 8, fps: 14 },
  work: { mode: 'work', frames: 2, fps: 4 },
  // the shipped characters have no sitting pose: they stand, cropped, on the seat
  sit: { mode: 'stand', frames: 1, fps: 1 },
};

const imageCache = new Map<string, HTMLImageElement>();
function image(url: string): HTMLImageElement {
  let im = imageCache.get(url);
  if (!im) {
    im = new Image();
    im.src = url;
    imageCache.set(url, im);
  }
  return im;
}
const prodCache = new Map<string, HTMLCanvasElement>();
function prodFrame(mode: PoseMode, frame: number): HTMLCanvasElement {
  const key = `${mode}:${frame}`;
  let c = prodCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 80;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const data = ctx.createImageData(80, 128);
    composeTemplate({ dir: 'se', mode, frame }).forEach((col, i) => {
      if (!col) return;
      const n = parseInt(col.slice(1), 16);
      data.data.set([n >> 16, (n >> 8) & 255, n & 255, 255], i * 4);
    });
    ctx.putImageData(data, 0, 0);
    prodCache.set(key, c);
  }
  return c;
}

interface Figure {
  label: string;
  /** a sheet (horizontal strip) or the shipped composer */
  src: { sheet: string; frames: number; fps: number } | { prod: PoseMode; frames: number; fps: number };
}

export function CharPipePreview() {
  const list = Object.values(manifests);
  const [charId, setCharId] = useState(list[0]?.id);
  const m = list.find((x) => x.id === charId);
  const [anim, setAnim] = useState('walk');
  const [mode, setMode] = useState('rotsprite');
  const [outfit, setOutfit] = useState('default');
  const [acc, setAcc] = useState('');
  const [view, setView] = useState<View>('production');
  /** 0 = the largest whole zoom that fits */
  const [zoom, setZoom] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  const [anchor, setAnchor] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ t: 0, last: 0 });

  const a = m?.animations.find((x) => x.id === anim) ?? m?.animations[0];
  const combo = (o: string, ac: string) => [o, ...(ac ? [ac] : [])].join('+');
  const url = (md: string, cb: string, an: string) => {
    const rel = m?.sheets[md]?.[cb]?.[an];
    return rel ? sheetUrls[`/src/assets/characters/prototype/${m!.id}/${rel}`] : undefined;
  };

  const figures: Figure[] = useMemo(() => {
    if (!m || !a) return [];
    const ec = (md: string, cb: string, label: string): Figure => ({ label, src: { sheet: url(md, cb, a.id) ?? '', frames: a.frames, fps: a.fps } });
    const p = PROD[a.id] ?? PROD.idle;
    const prod: Figure = { label: `Shipped rig · ${p.frames} fr @ ${p.fps} fps`, src: { prod: p.mode, frames: p.frames, fps: p.fps } };
    const cur = combo(m.outfits[outfit] ? outfit : 'default', acc);
    // only Alex has a shipped rig to compare with
    const withProd = m.id === 'alex' ? [prod] : [];
    if (view === 'production' || view === 'world') return [...withProd, ec(mode, cur, `EffectCraft ${mode} · ${a.frames} fr @ ${a.fps} fps`)];
    if (view === 'modes') return Object.keys(m.modes).map((md) => ec(md, cur, `EffectCraft ${md}`));
    return Object.keys(m.outfits).flatMap((o) => ['', ...Object.keys(m.accessories)].map((ac) => ec(mode, combo(o, ac), [m.outfits[o].split(' (')[0].split(' + ')[0], ac && m.accessories[ac]].filter(Boolean).join(' + '))));
  }, [m, a, mode, outfit, acc, view]);

  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c || !m) return;
      const ck = clock.current;
      if (playing) ck.t += (Math.min(100, now - (ck.last || now)) / 1000) * speed;
      ck.last = now;
      const dpr = window.devicePixelRatio || 1;
      const cssW = c.clientWidth;
      const cssH = c.clientHeight;
      if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
        c.width = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      const fw = m.frameWidth;
      const fh = m.frameHeight;
      const n = figures.length;
      const fit = Math.max(1, Math.floor(Math.min(cssH / (fh + 36), cssW / (n * fw + (n - 1) * 16 + 16))));
      const z = (zoom || fit) * dpr;
      const frameOf = (frames: number, fps: number) => (playing ? Math.floor(ck.t * fps) : step) % frames;
      // layout: figures side by side, feet on one ground line
      const gap = view === 'world' ? 0 : 16;
      const totalW = figures.length * fw + (figures.length - 1) * gap;
      const ox = Math.floor((c.width / z - totalW) / 2);
      const groundY = Math.floor((c.height / z) * 0.5 + fh / 2 - 10);
      if (view === 'world') {
        const bg = image(OFFICE);
        // the office floor at 1:1 (the bake is at character density), centred on the spawn tile (14, 0)
        if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 3088 - Math.floor(c.width / z / 2), 2004 - groundY, c.width / z, c.height / z, 0, 0, Math.ceil(c.width / z) * z, Math.ceil(c.height / z) * z);
      }
      figures.forEach((f, i) => {
        const x = ox + i * (fw + gap);
        const y = groundY - m.anchor.y;
        const s = f.src;
        if (view !== 'world') {
          ctx.fillStyle = 'rgba(255,236,214,0.10)';
          ctx.fillRect(x * z, groundY * z, fw * z, Math.max(1, dpr));
        }
        if ('prod' in s) ctx.drawImage(prodFrame(s.prod, frameOf(s.frames, s.fps)), 0, 0, fw, fh, x * z, y * z, fw * z, fh * z);
        else if (s.sheet) {
          const im = image(s.sheet);
          if (im.complete && im.naturalWidth) ctx.drawImage(im, frameOf(s.frames, s.fps) * fw, 0, fw, fh, x * z, y * z, fw * z, fh * z);
        }
        if (anchor) {
          ctx.fillStyle = '#ef6a5a';
          ctx.fillRect((x + m.anchor.x) * z - dpr, groundY * z - 3 * dpr, 2 * dpr, 6 * dpr);
        }
        ctx.font = `${12 * dpr}px 'Inter Variable', sans-serif`;
        ctx.fillStyle = view === 'world' ? '#fff' : '#cbbfb1';
        ctx.textAlign = 'center';
        ctx.fillText(f.label, (x + fw / 2) * z, (groundY + 14) * z + 14 * dpr);
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [m, figures, zoom, speed, playing, step, anchor, view]);

  if (!m || !a)
    return (
      <div className="cp-empty">
        No prototype sheets yet. Run <code>npm run character:build -- alex</code> (needs EffectCraft), then reload.
      </div>
    );

  const outfitKey = m.outfits[outfit] ? outfit : 'default';
  const strip = url(mode, combo(outfitKey, acc), a.id);
  return (
    <div className="cp">
      <aside className="cp-side">
        <h1>Character pipeline</h1>
        <p className="cp-sub">
          {m.name} · {m.effectcraft} · {m.frameWidth}×{m.frameHeight}, anchor ({m.anchor.x}, {m.anchor.y})
        </p>
        {list.length > 1 && <Seg label="Character" value={charId} options={list.map((x) => [x.id, x.name])} onChange={setCharId} />}
        <Seg label="Compare" value={view} options={VIEWS} onChange={(v) => setView(v as View)} />
        <Seg label="Animation" value={a.id} options={m.animations.map((x) => [x.id, x.id === 'walk_planar' ? 'Walk (planar)' : x.id[0].toUpperCase() + x.id.slice(1)])} onChange={setAnim} />
        <p className="cp-note">{a.label}</p>
        <Seg label="Render mode" value={mode} options={Object.keys(m.modes).map((k) => [k, k === 'x1' ? '1× Draft' : 'RotSprite 8×'])} onChange={setMode} />
        <Seg label="Outfit" value={outfitKey} options={Object.entries(m.outfits).map(([k, v]) => [k, v.split(' (')[0]])} onChange={setOutfit} />
        <Seg label="Headgear" value={acc} options={[['', 'None'], ...Object.entries(m.accessories)]} onChange={setAcc} />
        <label className="cp-field">
          <span>Speed {speed.toFixed(2)}×</span>
          <input type="range" min={0.1} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
        </label>
        <label className="cp-field">
          <span>Zoom {zoom ? `${zoom}×` : 'fit (whole steps)'}</span>
          <input type="range" min={0} max={8} step={1} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
        <div className="cp-row">
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
          <button disabled={playing} onClick={() => setStep((s) => (s + a.frames - 1) % a.frames)}>‹ Frame</button>
          <button disabled={playing} onClick={() => setStep((s) => (s + 1) % a.frames)}>Frame ›</button>
        </div>
        <label className="cp-check">
          <input type="checkbox" checked={anchor} onChange={(e) => setAnchor(e.target.checked)} /> Show foot anchor
        </label>
      </aside>
      <main className="cp-main">
        <canvas ref={canvas} className="cp-stage" />
        {strip && (
          <div className="cp-strip">
            <span>
              Sheet <code>{m.sheets[mode][combo(outfitKey, acc)][a.id]}</code> · {a.frames}×{m.frameWidth} = {a.frames * m.frameWidth}×{m.frameHeight}
            </span>
            <img src={strip} alt="" style={{ width: a.frames * m.frameWidth, imageRendering: 'pixelated' }} />
          </div>
        )}
      </main>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string | undefined; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="cp-field">
      <span>{label}</span>
      <div className="cp-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
