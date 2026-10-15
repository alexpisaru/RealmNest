"""Dev only: a character next to the cast for proportion checks.

    python tools/charpipe/review.py <sprite.png> <out.png> [scale]

Columns: the sprite, Giulia (cast, se), Alex (shipped, se), each on the world-ish background with
the ground row (120) marked, enlarged with nearest neighbour.
"""
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
src, out = sys.argv[1], sys.argv[2]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 4
cells = [Image.open(src).convert('RGBA'),
         Image.open(root / 'docs/characters/cast/office_sheet.png').convert('RGBA').crop((0, 128, 80, 256)),
         Image.open(root / 'art/charpipe/characters/alex/source/alex_se.png').convert('RGBA')]
sheet = Image.new('RGBA', (len(cells) * 84, 128), (58, 63, 74, 255))
for i, c in enumerate(cells):
    sheet.paste((88, 96, 112, 255), (i * 84, 120, i * 84 + 80, 121))
    sheet.alpha_composite(c, (i * 84, 0))
sheet.resize((sheet.width * k, sheet.height * k), Image.NEAREST).save(out)
