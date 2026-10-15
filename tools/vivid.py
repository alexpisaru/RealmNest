"""Dev only: compare a world render with the owner's reference picture.

    python tools/vivid.py <world> <render.png> [out_dir]

<render.png> is a whole-frame render (tools/scene.ts at any scale). Both pictures
are brought to the reference's size and compared on:
  sat      mean saturation
  lum_std  brightness contrast (spread of luminance)
  p5/p95   the darkest and brightest 5% (shadows and highlights)
  edges    fine detail (mean edge strength): the main sign of missing detail
It also writes <out_dir>/<world>_detail_gap.png: the reference with a red overlay
where it has much more detail than the render (an 8×6 grid with the ratio per
cell). Add detail where it's red.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageStat

world, mine = sys.argv[1], sys.argv[2]
out_dir = sys.argv[3] if len(sys.argv) > 3 else '.'
ref = Image.open(f'docs/worlds-bake/ritocchi/{world}.webp').convert('RGB')
m = Image.open(mine).convert('RGB').resize(ref.size, Image.LANCZOS)


def stats(im):
    s = im.convert('HSV').split()[1]
    L = im.convert('L')
    lv = sorted(L.getdata())
    n = len(lv)
    return {
        'sat': round(ImageStat.Stat(s).mean[0] / 255, 3),
        'lum_std': round(ImageStat.Stat(L).stddev[0] / 255, 3),
        'p5': lv[n // 20],
        'p95': lv[n * 19 // 20],
        'edges': round(ImageStat.Stat(L.filter(ImageFilter.FIND_EDGES)).mean[0], 1),
    }


a, b = stats(ref), stats(m)
print('reference:', a)
print('render:   ', b)
print('detail ratio (render/reference):', round(b['edges'] / max(1e-6, a['edges']), 2), '- aim for >= 0.9')
er = ref.convert('L').filter(ImageFilter.FIND_EDGES)
em = m.convert('L').filter(ImageFilter.FIND_EDGES)
over = ref.copy()
d = ImageDraw.Draw(over, 'RGBA')
gx, gy = 8, 6
W, H = ref.size
for j in range(gy):
    for i in range(gx):
        box = (i * W // gx, j * H // gy, (i + 1) * W // gx, (j + 1) * H // gy)
        r = ImageStat.Stat(er.crop(box)).mean[0]
        q = ImageStat.Stat(em.crop(box)).mean[0]
        ratio = q / max(1e-6, r)
        if ratio < 0.85:
            d.rectangle(box, fill=(255, 0, 0, int(min(150, (0.85 - ratio) * 300))))
        d.rectangle(box, outline=(255, 255, 0, 90))
        d.text((box[0] + 4, box[1] + 4), f'{ratio:.2f}', fill=(255, 255, 255, 255))
over.save(f'{out_dir}/{world}_detail_gap.png')
print(f'wrote {out_dir}/{world}_detail_gap.png')
