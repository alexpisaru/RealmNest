"""Dev only: review images and GIFs of the character factory for docs/charpipe/FACTORY_REPORT.md.

    python tools/charpipe/factory_media.py      (after npm run character:create -- maya / teo)

Reads the published (cleaned) strips in src/assets/characters/prototype/<id>/rotsprite/<combo>/<anim>.png
and the PhotoCraft previews; writes docs/charpipe/img/factory/.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'src/assets/characters/prototype'
chars = root / 'art/charpipe/characters'
out = root / 'docs/charpipe/img/factory'
out.mkdir(parents=True, exist_ok=True)
BG, GROUND, K, TICK, SECONDS = (58, 63, 74, 255), (88, 96, 112, 255), 3, 1 / 24, 2.0
FPS = {'idle': 8, 'walk': 12, 'work': 6}


def strip(cid, combo, anim):
    s = Image.open(assets / cid / 'rotsprite' / combo / f'{anim}.png').convert('RGBA')
    return [s.crop((i * 80, 0, i * 80 + 80, 128)) for i in range(s.width // 80)]


def row(cells, k=K):
    im = Image.new('RGBA', (len(cells) * 84, 128), BG)
    im.paste(GROUND, (0, 120, im.width, 121))
    for i, c in enumerate(cells):
        im.alpha_composite(c, (i * 84 + 2, 0))
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def gif(name, cols):
    """cols: [(frames, fps)], all on one clock"""
    frames = [row([f[int(t * TICK * fps) % len(f)] for f, fps in cols]).convert('RGB') for t in range(int(SECONDS / TICK))]
    frames[0].save(out / name, save_all=True, append_images=frames[1:], duration=int(TICK * 1000), loop=0)
    print(out / name)


# the drawing passes, as PhotoCraft saved them, and the alternative outfit
passes = [Image.open(chars / 'maya/previews' / f).convert('RGBA') for f in ('01_flat.png', '02_shade.png', '03_detail.png', '04_outline.png')]
passes.append(Image.open(chars / 'maya/base_lab.png').convert('RGBA'))
row(passes, 4).save(out / 'maya_passes.png')
print(out / 'maya_passes.png')

gif('maya_animations.gif', [(strip('maya', 'field+glasses', a), FPS[a]) for a in ('idle', 'walk', 'work')])
for a in ('idle', 'walk', 'work'):
    gif(f'maya_outfits_{a}.gif', [(strip('maya', c, a), FPS[a]) for c in ('field', 'field+glasses', 'lab', 'lab+glasses')])
gif('teo_animations.gif', [(strip('teo', 'tech', a), FPS[a]) for a in ('idle', 'walk', 'work')])
# one walk file, four bodies: two hand-drawn (Alex, Giulia), two built in PhotoCraft (Maya, Teo)
gif('factory_vs_cast_walk.gif', [(strip('alex', 'default', 'walk'), 12), (strip('giulia', 'default', 'walk'), 12), (strip('maya', 'field+glasses', 'walk'), 12), (strip('teo', 'tech', 'walk'), 12)])
gif('factory_vs_cast_idle.gif', [(strip('alex', 'default', 'idle'), 8), (strip('giulia', 'default', 'idle'), 8), (strip('maya', 'field+glasses', 'idle'), 8), (strip('teo', 'tech', 'idle'), 8)])
