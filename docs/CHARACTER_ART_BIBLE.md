# RealmNest character art bible

Derived on 2026-10-12 from what ships and the cast sheets. Measured:

- Alex's shipped `se` view.
- The `se` standing cell of all 11 `docs/characters/cast/*_sheet.png`.

Use it for any new character, hand-drawn or tool-built. Change it only on purpose.

## Canvas and anchor

| | |
|---|---|
| Frame | **80 × 128 px**, transparent, one figure per frame |
| Anchor (feet) | **(40, 120)**: the point between the feet, one row below the near sole |
| Soles | Near foot's bottom row **119**. The far foot sits 2 px higher (**117**): that is how depth reads in the three-quarter view |
| Top of figure | Row 5–10 (hair included) |
| Figure height | **110–118 px**; 112 px is typical |
| Side margins | Figure bbox x ≈ 14–65; keep at least 8 px clear on each side so arms can swing |
| Views | Drawn: `se` (three-quarter front, faces screen-right) and `ne`. `sw`/`nw` are mirrors, `s`/`n` are only for portraits. Prototype characters draw `se` first |

## Proportions (se view)

| | Women (cast) | Men (cast) |
|---|---|---|
| Head (hair to chin) | about 30 px, **≈ 27 % of height** (semi-chibi, not big-head chibi) | same |
| Neck | rows ≈ 36–40, 13–15 px wide including collar | 15–19 px |
| Shoulder width (arms included) | **38–42 px** | 44–47 px |
| Torso | shoulders ≈ row 42, waist ≈ row 62, hips/crotch ≈ row 80 | same rows |
| Legs | crotch ≈ 80 → soles 119: **≈ 38 px (≈ 35 %)**, knee ≈ row 100 | same |
| Arms | shoulder ≈ row 44 → hand bottom ≈ row 80; elbow ≈ row 57; hands are 6–7 px fists | same |
| Feet | 10–14 px long, toes pointing screen-right (the facing side) | bigger boots |

## Line, shading, palette

- **Outline:** 1 px, very dark warm plum/brown (`#150409`–`#1a050a`). It goes around the whole silhouette and around parts that overlap (arms over the torso, the jacket edge over the shirt). No outline across joints or seams.
- **Light:** from the **upper left**. Each material gets base + 1 shadow (right side, underside, under the hair and collar) + an optional 1 highlight (top-left edges). No gradients, no dithering on characters.
- **Shading shape:** flat cel clusters of at least 2 px; no single stray pixels except eye highlights.
- **Palette:** **at most 40 colours** per character view (cast: 31–37). Skin ramp 3 tones, hair 3–4, each garment 3. Outline 1–2 darks.
- **Faces:** one fully visible eye (≈ 3 × 3, a dark lash line on top, a coloured iris, a 1-px light highlight), a partial far eye, a 1–2 px nose bump on the facing-side edge, and a 2-px mouth.
- **Colours vs worlds:** characters are warmer and more saturated than the worlds (worlds are muted, cool, blue-grey). Signature or outfit colours should read against a cool floor.
- **Edges:** hard alpha (0 or 255), no anti-aliasing, whole-pixel positions, nearest-neighbour only.

## Construction for animation

Draw the rest pose on separate layers, one group per rig part. All parts share the full 80 × 128 canvas and **are never cropped**.

| Group | Contents |
|---|---|
| `head` | face, ear, eyes, `hair_front`; plus `hair_back` (attached to the head, drawn behind the body) |
| `torso` | neck, shirt, jacket body, trousers hips |
| `upper_arm_R/L` | sleeve to the elbow |
| `lower_arm_R/L` | forearm or cuff, and the hand |
| `upper_leg_R/L` | thigh |
| `lower_leg_R/L` | shin and shoe |

Rules:

- R is the character's right, which is **image-left** in `se`. It is nearer the camera and drawn in front of the body; the L limbs go behind.
- Parts overlap their parent by 2–3 px at each joint and are drawn complete underneath neighbours, so nothing opens when a part turns.
- Pivots follow the rig standard (`art/charpipe/rig/humanoid-3q.json`): hip, knee, shoulder, elbow, neck.
- Outfit layers sit inside each part group, separate from body (skin) layers. An outfit swap then replaces only outfit layers.

## Animation format

- Sheets: horizontal strips, one per animation, frames of 80 × 128, no padding (`<anim>.png`).
- Manifest: `<id>.anims.json` with frame size, anchor, `fps`, `frames`, `loop`, outfits and accessories (see `tools/charpipe`).
- Shipped rates for reference: walk 8 frames at 14 fps, work 2 at 4, talk 2 at 5.

## HD base (2026-10-12)

The owner's reference `art/charpipe/reference/base_body_ref.webp` sets a second, denser standard. One reference pixel is 6 image pixels.

| | |
|---|---|
| Frame | **160 × 256**, anchor **(80, 240)** |
| Figure | About **200 px** tall: head about 52 px wide, near sole on row 239, the far foot higher |
| Outline | On the figure's outer edge, **2 px near-black** (`#1a0806`) with a **1-px dark brown halo** outside (`#4a251a`). Inside the figure (chin over neck, an arm over the torso, a hem, a collar) it is **one 1-px dark line**. Outlines are added after animation, per band, so turned limbs keep a clean edge |
| Skin | 4 close warm tones (hl/base/shade/deep), low contrast, lit from the upper left |
| Face | Big eyes (about 9 × 10): a 2-row lash, a thin white, a dark iris over a lighter lower half, a 2 × 2 highlight. Thick 3-row brows; the ear drawn inside the skull's outline; a 1-px nose and mouth |
| Base | Bald, grey briefs, bare feet. The near foot faces the viewer and the far foot is in profile |
| Male / female | Male (`base`): the reference's own silhouette, 3-row brows. Female (`base-f`): narrower shoulders and waist, hips wider at the front, a 4-px bust, a softer jaw, arms angled out so the waist shows; 2-row brows, lash flicks, pink lips, high-cut briefs and a grey sports top |
| Depth | Back hair, far arm, both legs, torso (with briefs), head, near arm |
| Motion | Own animations in `art/charpipe/studio/animations` (pixel-exact): a 1-px breath with the head and arms riding on the torso (no lag), a walk whose planted foot never leaves the ground and whose hands swing 7 px, and a typing pose with both hands at a keyboard in front of the body |

Assets (hair, tops, bottoms, shoes) are drawn once on this body, cut to the same rig parts, and composited band by band at runtime. The tools are in `tools/charpipe/hd/`, and `npm run character:studio` rebuilds everything.
