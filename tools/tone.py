"""Dev only: match a world's brightness to the owner's reference picture.

    python tools/tone.py <world> <render.png>

<render.png> is a whole-frame render WITHOUT a tone curve (tools/scene.ts, any
scale). Matches the distribution of HSL lightness of the render to the
reference's (histogram matching), keeps the curve gentle (monotone, no more
than ±0.18 from the identity), and prints the 11 values for
src/render/hd/tones.ts: output lightness for input 0, 0.1 … 1.
"""
import sys
from PIL import Image

world, mine = sys.argv[1], sys.argv[2]
ref = Image.open(f'docs/worlds-bake/ritocchi/{world}.webp').convert('RGB')
m = Image.open(mine).convert('RGB').resize(ref.size, Image.LANCZOS)


def light(im):
    # HSL lightness (max + min) / 2, in 0..1
    px = im.getdata()
    return sorted((max(p) + min(p)) / 510 for p in px)


a = light(ref)
b = light(m)
n = len(a)


def quantile(v, q):
    return v[min(n - 1, int(q * n))]


# for each input lightness x, find its rank in the render and the reference lightness at that rank
out = []
import bisect
for i in range(11):
    x = i / 10
    rank = bisect.bisect_left(b, x) / n
    y = quantile(a, min(0.999, rank)) if 0 < i < 10 else x
    y = max(x - 0.18, min(x + 0.18, y))
    out.append(y)
# monotone, ends fixed
out[0], out[10] = 0.0, 1.0
for i in range(1, 11):
    out[i] = max(out[i], out[i - 1] + 0.02)
out[10] = 1.0
print(world + ': [' + ', '.join(f'{v:.3f}' for v in out) + '],')
