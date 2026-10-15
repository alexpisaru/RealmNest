"""Dev only: HD studio frames composited from the band sheets, for frame-by-frame review.

    python tools/charpipe/hd/qa_sheet.py <out.png> <studio> <look> <anim> [scale] [crop x0,y0,x1,y1] [grid]

studio: base (male) | base-f (female)
look:   body | casual-short | casual-long | field-short | field-long
anim:   idle | walk | work
Frames are laid side by side (2 px apart) on a neutral background; with `grid` a faint line every
10 frame pixels and the frame coordinates along the top and left help name exact positions.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[3]
LOOKS = {
    'body': ['body'],
    'casual-short': ['body', 'shoes:sneakers', 'bottom:jeans', 'top:tee', 'hair:short'],
    'casual-long': ['body', 'shoes:sneakers', 'bottom:jeans', 'top:tee', 'hair:long'],
    'field-short': ['body', 'shoes:boots', 'bottom:chinos', 'top:jacket', 'hair:short'],
    'field-long': ['body', 'shoes:boots', 'bottom:chinos', 'top:jacket', 'hair:long'],
}


def load(studio):
    base = root / 'src/assets/characters/studio' / studio
    return base, json.loads((base / 'studio.json').read_text())


def frame(studio, look, anim, f):
    base, m = load(studio)
    W, H = m['frame']['w'], m['frame']['h']
    im = Image.new('RGBA', (W, H))
    for band in m['bands']:
        for slot in m['slots']:
            for a in LOOKS[look]:
                if m['assets'][a]['slot'] != slot:
                    continue
                rel = m['assets'][a]['sheets'].get(band, {}).get(anim)
                if rel:
                    s = Image.open(base / rel).convert('RGBA')
                    im.alpha_composite(s.crop((f * W, 0, f * W + W, H)))
    return im


if __name__ == '__main__':
    out, studio, look, anim = sys.argv[1:5]
    k = int(sys.argv[5]) if len(sys.argv) > 5 else 3
    _, m = load(studio)
    W, H = m['frame']['w'], m['frame']['h']
    crop = tuple(int(v) for v in sys.argv[6].split(',')) if len(sys.argv) > 6 else (0, 0, W, H)
    grid = len(sys.argv) > 7 and sys.argv[7] == 'grid'
    n = next(a['frames'] for a in m['animations'] if a['id'] == anim)
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    sheet = Image.new('RGBA', (n * (cw + 2), ch), (58, 63, 74, 255))
    for f in range(n):
        sheet.alpha_composite(frame(studio, look, anim, f).crop(crop), (f * (cw + 2), 0))
    big = sheet.resize((sheet.width * k, sheet.height * k), Image.NEAREST)
    if grid:
        d = ImageDraw.Draw(big)
        for f in range(n):
            ox = f * (cw + 2) * k
            for x in range((crop[0] // 10 + 1) * 10, crop[2], 10):
                d.line([(ox + (x - crop[0]) * k, 0), (ox + (x - crop[0]) * k, big.height)], fill=(255, 255, 0, 60))
                d.text((ox + (x - crop[0]) * k + 1, 1), str(x), fill=(255, 255, 0, 200))
            for y in range((crop[1] // 10 + 1) * 10, crop[3], 10):
                d.line([(ox, (y - crop[1]) * k), (ox + cw * k, (y - crop[1]) * k)], fill=(255, 255, 0, 60))
                d.text((ox + 1, (y - crop[1]) * k + 1), str(y), fill=(255, 255, 0, 200))
            d.text((ox + 2, big.height - 12), f'f{f}', fill=(255, 255, 255, 255))
    big.save(out)
