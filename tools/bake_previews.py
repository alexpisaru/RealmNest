"""World previews for Home: a small picture of each baked world, cut from its real map.

    python tools/bake_previews.py            (after a bake: public/baked/<world>/scene_half.webp)

Writes public/baked/<world>/preview.webp: the middle of the baked scene (where the world is),
16:10, 640 px wide. Home shows these on the world cards; the live scene takes over once the
world is selected. Rerun after re-baking a world.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
W, H = 640, 400
# the share of the scene's width the preview keeps (the world, without most of its surroundings)
KEEP = 0.62

for scene in sorted((ROOT / 'public/baked').glob('*/scene_half.webp')):
    im = Image.open(scene).convert('RGB')
    cw = round(im.width * KEEP)
    ch = round(cw * H / W)
    x0 = (im.width - cw) // 2
    y0 = (im.height - ch) // 2
    out = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
    dest = scene.with_name('preview.webp')
    out.save(dest, quality=86, method=6)
    print(f'{dest.relative_to(ROOT)}: {dest.stat().st_size // 1024} KB')
