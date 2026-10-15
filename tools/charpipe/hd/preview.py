"""Dev only: the HD studio's previews side by side, next to the reference.

    python tools/charpipe/hd/preview.py <out.png> [scale] [crop: x0,y0,x1,y1]
"""
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
d = root / 'art/charpipe/studio/base/previews'
out = sys.argv[1]
k = int(sys.argv[2]) if len(sys.argv) > 2 else 2
crop = tuple(int(v) for v in sys.argv[3].split(',')) if len(sys.argv) > 3 else None
ref = Image.open(root / 'art/charpipe/reference/base_body_ref_native.png').convert('RGBA')
cells = [ref.crop((3, -8, 163, 248))]  # reference, shifted onto the frame (x - 3, y + 8)
for f in ['body.png', 'casual_hair-short.png', 'field_hair-long.png', 'casual_hair-long.png', 'field_hair-short.png']:
    if (d / f).exists():
        cells.append(Image.open(d / f).convert('RGBA'))
if crop:
    cells = [c.crop(crop) for c in cells]
w, h = cells[0].size
sheet = Image.new('RGBA', (len(cells) * (w + 4), h), (58, 63, 74, 255))
for i, c in enumerate(cells):
    sheet.alpha_composite(c, (i * (w + 4), 0))
sheet.resize((sheet.width * k, sheet.height * k), Image.NEAREST).save(out)
