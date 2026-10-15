# Art direction — beta 0.2 vs. the reference

## Where the reference is

The reference is a cozy isometric garden scene.

- **Framing.** It is a window into a larger place. Ground, hedges, buildings and vegetation run past every edge of the frame, and the camera sits inside the world.
- **Ground.** The ground is a material, not a colour: paving stones vary stone by stone, grout lines are visible, moss grows in the joints, leaves are scattered, and grass is built from tufts in three or four tones.
- **Density.** Almost every tile carries something: pots, flowers, vines, crates, lanterns, steps, low walls. Props overlap and layer, so empty floor is rare.
- **Organic shapes.** Foliage is built from clumps, flowers are colour-dotted, and vines climb over the architecture. Outlines are tinted by the colour they enclose (selective outline), not a uniform black.
- **Architecture frames the scene.** A house with a green tiled roof, wooden and glass greenhouses and a pergola set the scale and give each zone a purpose.
- **Light.** One warm sun throughout: shadows fall consistently to the lower right, and a single colour grade unifies characters and environment.
- **Characters.** Readable at a small size, with modelled shading, tinted outlines and clothes that pick up the scene's light.

## Where 0.2 was

| Area | 0.2 | Problem |
| --- | --- | --- |
| Framing | Diorama slab floating over a gradient sky | Reads as a "mockup in a void", not a place |
| Ground | Flat diamonds with sparse lines | No material, no variation |
| Density | About one prop every 6–8 tiles | Large empty floors, layout-diagram feel |
| Shapes | Boxes with a black outline | Schematic and hard |
| Context | Nothing outside the playable grid | No sense of location |
| Light | Flat, gradient background | Characters and scenery don't share light |
| Characters | Flat fills, black outline | Pasted on, not integrated |
| Home layout | Scrolls at 1920×1080; "current world" is at the bottom of the right column | Long dashboard instead of one composed screen |

## Rules from 0.3 on

1. **Three visual layers per world:** the playable area, the extended environment (props and buildings around it, not interactive), and scenic ground that covers the whole camera range, so no void can show.
2. **The camera explores a place.** It is clamped inside the scene and never zooms out far enough to show an edge.
3. **Ground is shaded per pixel**, from 3–5-tone palettes with stones, planks, grout, moss and wear. Gradients are rendered with ordered (Bayer) dithering, never smooth blends.
4. **Selective outline** on sprites and foliage: the outline is a darkened version of the adjacent colour.
5. **Density target:** in the vertical-slice world, almost no 2×2 tile area is left completely empty.
6. **One light**, a warm sun from the upper left: consistent shadows, a soft-light colour grade over the frame, and window light pools indoors.
7. **Architecture frames each zone**, both inside the playable area and around it.

## Status after 0.3

| Rule | Farm (vertical slice) | Other worlds |
| --- | --- | --- |
| Three layers, no void | done (hand-authored countryside) | done (`building()` / `station()` / harbour) |
| Per-pixel materials, dithering | done | done |
| Selective outline, single light | done | done |
| Density | high: yard, beds, decor, wildflowers, critters | medium: wall decor, street furniture; interiors still airy |
| Architecture frames the zones | farmhouse, barn, greenhouse, pergola, coop | neighbouring facades, cutaway walls |

**Next, per world**, following the Farm recipe:

1. Replace generic surroundings with hand-authored context, e.g. an office courtyard café, the factory yard with trucks, the lab's greenhouse wing.
2. Add an interior clutter pass: desk items, cables, papers, boxes and plants on every surface.
3. Draw two or three signature landmarks per world as large bespoke props.
4. Swap procedural props for hand-drawn PNGs through `src/render/assets.ts` once final art exists.
