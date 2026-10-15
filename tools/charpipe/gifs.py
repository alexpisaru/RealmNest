"""Dev only: animated GIFs of the character pipeline prototype for docs/charpipe/REPORT.md.

    python tools/charpipe/gifs.py [alex]      (after npm run character:build and compare.ts)

Each GIF plays several sequences side by side on one clock (each at its own frame rate), enlarged
3x with nearest neighbour, feet on one ground line.
"""
import sys
from pathlib import Path
from PIL import Image

cid = sys.argv[1] if len(sys.argv) > 1 else 'alex'
root = Path(__file__).resolve().parents[2]
build = root / 'art/charpipe/build' / cid
out = root / 'docs/charpipe/img'
K, TICK, SECONDS, BG = 3, 1 / 24, 2.0, (58, 63, 74, 255)


def seq(path):
    return [Image.open(f).convert('RGBA') for f in sorted(Path(path).glob('frame_*.png'))]


def gif(name, cols):
    """cols: [(frames, fps)]"""
    w, h = 80, 128
    ticks = int(SECONDS / TICK)
    images = []
    for t in range(ticks):
        im = Image.new('RGBA', (len(cols) * (w + 8), h + 4), BG)
        im.paste((107, 115, 133, 255), (0, 120, im.width, 121))  # the ground line at the anchor row
        for i, (frames, fps) in enumerate(cols):
            f = frames[int(t * TICK * fps) % len(frames)]
            im.alpha_composite(f, (i * (w + 8) + 4, 0))
        images.append(im.resize((im.width * K, im.height * K), Image.NEAREST).convert('RGB'))
    images[0].save(out / name, save_all=True, append_images=images[1:], duration=int(TICK * 1000), loop=0, optimize=False)
    print(out / name)


if cid != 'alex':
    # a second character: its outfits, then the same animations next to Alex's (rig reuse)
    alex = root / 'art/charpipe/build/alex'
    combos = sorted(p.name for p in (build / 'rotsprite').iterdir() if p.is_dir())
    for anim, fps in (('idle', 8), ('walk', 12), ('work', 6)):
        gif(f'{cid}_outfits_{anim}.gif', [(seq(build / 'rotsprite' / c / anim), fps) for c in combos])
        if alex.exists():
            gif(f'rig_reuse_{anim}.gif', [(seq(alex / 'rotsprite' / c / anim), fps) for c in ('default', 'navy+beanie')] + [(seq(build / 'rotsprite' / c / anim), fps) for c in combos if c in ('default', 'teal+beanie')])
    sys.exit(0)

prod = build / 'production'
ec = lambda mode, combo, anim: seq(build / mode / combo / anim)
gif('walk_vs_shipped.gif', [(seq(prod / 'walk'), 14), (ec('x1', 'default', 'walk'), 12), (ec('rotsprite', 'default', 'walk'), 12), (ec('rotsprite', 'default', 'walk_planar'), 12)])
gif('work_vs_shipped.gif', [(seq(prod / 'work'), 4), (ec('x1', 'default', 'work'), 6), (ec('rotsprite', 'default', 'work'), 6)])
gif('idle.gif', [(seq(prod / 'stand'), 1), (ec('x1', 'default', 'idle'), 8), (ec('rotsprite', 'default', 'idle'), 8)])
for anim, fps in (('idle', 8), ('walk', 12), ('work', 6)):
    gif(f'outfits_{anim}.gif', [(ec('rotsprite', c, anim), fps) for c in ('default', 'navy', 'default+beanie', 'navy+beanie')])
if (build / 'mcp/wave').exists():
    gif('mcp_wave.gif', [(seq(build / 'mcp/wave'), 8)])
