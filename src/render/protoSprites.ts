// Dev only: prototype characters from the character pipeline (tools/charpipe, docs/charpipe) in the
// real world renderer. Opt in with a URL parameter, e.g. http://localhost:5173/?proto=maya,teo:
// the first agents the renderer draws get those characters' sheets, in that order. Everything
// else (position, depth sorting, shadow, selection, seating, states) stays the renderer's own.
// worldRenderer imports this module only in dev builds and only when ?proto= is present.
//
// Prototype sheets exist for the se view only: sw/nw mirror it (as the shipped characters do),
// and ne/nw (walking away) also show the front view for now. A seated agent (sofa, armchair,
// bench) gets the sit sheet, anchored on the floor under its hips.
import type { VisualAgent } from '../engine/worldSim';
import type { Pose } from './sprites';

interface Manifest {
  id: string;
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  animations: { id: string; frames: number; fps: number; anchorDy?: number }[];
}

const manifests = import.meta.glob<Manifest>('/src/assets/characters/prototype/*/*.anims.json', { eager: true, import: 'default' });
const sheetUrls = import.meta.glob<string>('/src/assets/characters/prototype/*/*_{idle,walk,work,sit}.png', { eager: true, query: '?url', import: 'default' });

const wanted = new URLSearchParams(location.search).get('proto')?.split(',').filter(Boolean) ?? [];
const assigned = new Map<string, string>();
const images = new Map<string, HTMLImageElement>();
const frames = new Map<string, HTMLCanvasElement>();

function sheet(char: string, anim: string): HTMLImageElement | null {
  const url = sheetUrls[`/src/assets/characters/prototype/${char}/${char}_${anim}.png`];
  if (!url) return null;
  let im = images.get(url);
  if (!im) {
    im = new Image();
    im.src = url;
    images.set(url, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

/** the prototype frame for this agent and pose ([frame, foot x, foot y, seated]), or null to draw the shipped character */
export function protoSprite(a: VisualAgent, pose: Pose, t: number): [HTMLCanvasElement, number, number, boolean] | null {
  let char = assigned.get(a.id);
  if (!char) {
    if (assigned.size >= wanted.length) return null;
    char = wanted[assigned.size];
    assigned.set(a.id, char);
    console.info(`[proto] agent ${a.id} is drawn as ${char}`);
  }
  const m = Object.values(manifests).find((x) => x.id === char);
  if (!m) return null;
  const anim = pose.mode === 'walk' ? 'walk' : pose.sit && m.animations.some((x) => x.id === 'sit') ? 'sit' : pose.mode === 'work' ? 'work' : 'idle';
  const spec = m.animations.find((x) => x.id === anim);
  const im = sheet(char, anim);
  if (!spec || !im) return null;
  // the walk follows the renderer's own walk phase; idle and work run at their sheet's rate
  const f = anim === 'walk' ? pose.frame % spec.frames : Math.floor(t * spec.fps) % spec.frames;
  const mirror = pose.dir === 'sw' || pose.dir === 'nw';
  const key = `${char}/${anim}/${f}/${mirror ? 1 : 0}`;
  let cv = frames.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = m.frameWidth;
    cv.height = m.frameHeight;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    if (mirror) c.setTransform(-1, 0, 0, 1, m.frameWidth, 0);
    c.drawImage(im, f * m.frameWidth, 0, m.frameWidth, m.frameHeight, 0, 0, m.frameWidth, m.frameHeight);
    frames.set(key, cv);
  }
  // mirrored, the feet stay on the same x (the anchor is the frame's centre)
  return [cv, mirror ? m.frameWidth - m.anchor.x : m.anchor.x, m.anchor.y + (spec.anchorDy ?? 0), anim === 'sit'];
}
