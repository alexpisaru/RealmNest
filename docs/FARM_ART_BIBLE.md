# Farm art bible (vertical slice, 0.5: 128×64)

> Since 0.6 every world follows this direction with its own art pack and its own surroundings. How to author one is in `docs/PACK_GUIDE.md`; the 0.6 renders are in `docs/worlds-2x/`.

This is the local art bible for the Farm only. The other nine worlds keep the 32×16 renderer. Reference renders are in `docs/farm-2x/` (scene) and `docs/farm-2x/library/` (asset library sheets).

## 1. What 0.5 fixes (analysis of the 0.4 slice)

| Problem in 0.4 (64×32) | 0.5 (128×64) |
| --- | --- |
| Repetition: four foliage families, few prop variants, the same oak everywhere. | An asset library first: 11 tree species, 7 bushes, 10 flowers, 4 grasses, 4 fences + gate, 5 walls, 19 ground decals, 10 crop families, 30 props and storytelling pieces, a pond set. The world is dressed from it in variants, and flowers grow in drifts of one kind. |
| Uniform grass and terrain. | The ground is painted with marks: short blades with a shadow on their right, V-shaped tufts with dark roots and lit tips, clover and five-pixel blossoms, warm and cool grass patches, pebbles with lit tops on the paths, bleached path crowns, blades creeping over the verges. The noise lattices are rotated, so patches no longer show the diamond grid. |
| Clean, sterile path edges. | Borders are resolved per 2×2 pixel block with a ragged extra octave, and path edges carry decals (tufts, stones, crumbs, flowers, moss, puddles). |
| Regular crops. | Each plant has its own growth stage, with gaps and weeds; corn and beans are tall, wheat comes ripe or green with headlands. |
| Weak animals. | Animals are drawn as shaded volumes with hand-placed details: hens and a rooster, ducks, frogs, cats, a dog, sheep and a holstein cow (with a bell), plus butterflies and birds. The ones you see most come in two variants. |
| Few props, no storytelling. | Laundry on the line, the woodpile and chopping block, rain barrel, milk cans, a ladder on the barn, a tarp, an apple cart at harvest, baskets, seed bags, pot stacks, a birdhouse, the mailbox at the gate, a picnic under the cherry, a jetty and a rowboat. |
| No foreground or background depth; a floating feel. | Woods, copses and hedgerows reach the frame edge on every side, big trees frame the foreground, roads and lanes leave the frame, and there is no visible edge. |

## 2. Rules (binding for the Farm)

**Projection and scale**
- Classic 2:1 isometric. The ground tile is 128×64 and the half tile is 64×32.
- The Farm sets `environment.tile = 128`, so k = 4 over the base 32×16 projection. `PROP_META` heights stay in base units (1 unit = 4 px).
- **World-space proportions are unchanged.** The scene margin (`sceneMarginPx`) scales with k, so the scenic tile range and the camera framing are the same as at 64×32. The art gains pixels, not size.
- Characters use a 64×96 frame, foot at (32, 90). The visible body is about 40 px wide and 70 px tall.
- Size classes:
  - Small props: 32×32, 32×48 or 48×48 (pots, cans, baskets, gnomes).
  - Medium props: 64×64 or 64×96 (lamps, benches, barrels, ladders).
  - Structures: whole 128×64 tiles.
- Nearest-neighbour only, integer scaling only. No smoothing, no vector gradients, no soft painterly blends. Tones are quantised to the ramp with ordered dithering or clustered marks.

**Level of detail (how 2× is shown)**
- At zoom ≥ 1 (HiDPI screens, close-ups) the renderer draws the 128×64 art 1:1.
- Below 1× (the default framing on a 1080p screen is 0.5) it draws a half-resolution copy of every sprite and of the ground. That copy is a pixel-art-safe 2:1 reduction: the mode of each 2×2 block, ties going to the darker colour so outlines survive, and mostly-empty blocks dropped. Nothing is ever smoothed, and the picture stays crisp at the same framing as 0.4.

**Light**
- One sun from the upper left. Screen-left faces are lit, screen-right faces are in shade, and tops are brightest.
- Cast shadows fall to the lower right as dithered contact shadows in warm purple `#2a1a2a`. Foliage masses in front cast shadow on those behind.
- Ambient occlusion: darker grass along every path and bed edge, dark wet banks at the water, shaded forest floor under copses.

**Colour**
- Every material uses one ramp of 5–7 tones, with shadows shifted toward purple and lights toward warm yellow.
- Outlines are selective and warm (`#3b2a26` blended into the colour they enclose), never black.
- The palette is cozy and slightly warm. Grass varies between warm and cool patches.

**Materials (must read at 1:1)**

| Material | Treatment |
| --- | --- |
| Wood | Boards and siding with grain streaks, knots, nail heads, gaps, a worn lower edge |
| Dirt | Patchy compacted earth, grit, pebbles with a lit top, bleached crowns, damp verges |
| Grass | Blades, tufts, clover, blossoms, warm and cool patches |
| Stone | Field stones (Voronoi) with moss in the joints, cut blocks with chips, flagstones with grout and pitting |
| Brick | Running bond, colour variance, chipped bricks, mortar |
| Glass | Tinted panes, two diagonal reflections, grime in the corners, plants visible inside |
| Plaster | Speckle, hairline cracks, damp rising from the plinth |
| Water | Depth ramp, crest dashes, a thin foam line, wet banks, lilies; still water in the trough |
| Foliage | Per-pixel lit leaf volumes with clumps, seams, gaps and cast shadow |
| Fabric | Laundry, the picnic blanket and the tarp, with folds |
| Metal accents | Milk cans, the watering can, lantern posts: two or three tones and a highlight |

**Density and composition**
- Yard: every free edge carries walk-through flowers, grasses or decals. Lanes have worn, stony edges.
- Three layers: the playable homestead, an authored ring, and the countryside out to the frame edge.
  - **Authored ring.** North: house and barn yard with orchard rows. West: orchard at harvest, beehives, wheat. East: the farm gate, a poplar road, wheat, the paddock and kitchen plots. South: the pond and a meadow.
  - **Countryside.** Parcels of woods, orchards, fields, paddocks, meadows, farmsteads and ponds, bordered by hedgerows and walls. Copses grow where the land is left alone.
- Flowers grow in drifts of one species. Woods have one species mix each. Lone trees are rare; trees gather in copses.
- No empty fields, no visible edge, no floating diorama.

## 3. Asset library (128×64)

| Family | Variants |
| --- | --- |
| Trees (`tree`, `fruitTree`) | oak, birch, pine, willow, poplar, cherry (in blossom), apple, pear, plum, orange, sapling (staked) |
| Bushes (`bush`) | round, hydrangea, berry, boxwood, lavender, rose, fern |
| Flowers (`flowerPatch`) | daisy, tulip, poppy, marigold, hollyhock, foxglove, forget-me-not, cosmos, lavender, wild mix |
| Grasses (`tallGrass`) | tuft, seed heads, sedge, clump |
| Fences (`fenceRow`, `gate`) | rail, picket (low, weathered cream), wattle, broken; a wooden gate |
| Walls (`stoneWall`) | dry stone, cut stone, mossy, ruin, brick |
| Path edges (`decal`) | `edge.tufts`, `edge.stones`, `edge.crumbs`, `edge.flowers`, `edge.moss`, `edge.puddle` |
| Transitions (`decal`) | `trans.patchy`, `trans.worn`, `trans.mud`, `trans.dry`, `trans.clover`, `trans.gravel` |
| Clutter (`decal`) | `clutter.leaves`, `clutter.twigs`, `clutter.pebbles`, `clutter.mushrooms`, `clutter.flowers`, `clutter.weeds`; `steps` (stepping stones) |
| Crops (`crops`, `cropRow`) | carrot, cabbage, tomato, pumpkin, lettuce, corn, beans, herbs, wheat, green wheat; each has growth stages, gaps and weeds |
| Farm props | crate, bucket, watering can, sack, barrel, tools, basket, signpost, bench, lantern post, pots, wheelbarrow, milk can, firewood, hay, haystack, ladder, trough |
| Storytelling decor | laundry line, seed bags, pot stack, birdhouse, scarecrow, broom, tarp pile, rain barrel, picnic blanket, chopping block, apple cart, mailbox, bicycle, gnome, birdbath |
| Pond set | rocks (boulder, flat, mossy, cluster), reeds (cattail, reed grass, yellow iris, rush), lilies, jetty, rowboat |
| Buildings | farmhouse (gable dormer and chimney growing out of the slope, lead flashing), barn (cupola and weathervane), greenhouse (climbers, staging, potting bench, water butt), shed, coop, well, pergola, trellis, beehive, compost, raised beds, garden furniture, courtyard fountain (two tazze, animated water) |
| Animals | hen ×2, rooster, duck ×2 (white, mallard), cat ×2 (ginger, tuxedo), dog, sheep ×2 (white, brown), holstein cow, frog, butterfly ×3, bird ×2 |
| Characters | 64×96 composer over the existing crew system (see below) |

**Flat decals** (`PropMeta.flat`) are baked into the ground buffer. They never block a tile, and things can stand on them.

## 4. Implementation map

| Piece | Where |
| --- | --- |
| Scale switch, scene margin | `environment.tile: 128`; `tileScale()` and `sceneMarginPx()` in `domain/world.ts` |
| Renderer: k-generic, half-resolution level of detail below 1×, shared sprites, CPU raster | `src/render/worldRenderer.ts`, `src/render/hd/soft.ts` (`SoftCtx` with drawn-box tracking, `downsampleMode`) |
| Ground at 128×64: marks on hash grids rasterised per row, skeleton per 2×2 block | `src/render/hd/groundHD.ts` (`paint4`) |
| Art kit: ramps, layers (bounded, selective outline), per-pixel foliage volumes, trunks, stamps | `src/render/hd4/kit4.ts` |
| Materials | `src/render/hd4/materials4.ts` |
| Trees · plants · fences and walls · decals · crops · props · buildings · pond set | `src/render/hd4/trees.ts`, `plants.ts`, `fences.ts`, `decals.ts`, `crops.ts`, `props4.ts`, `buildings4.ts`, `water4.ts`; registered in `hd4/index.ts` |
| Animals | `src/render/hd4/animals.ts` |
| Characters 64×96 | `src/render/hd4/people.ts` |
| Layout: homestead, authored ring, countryside generator | `src/data/worlds/farm.ts`, `src/data/worlds/countryside.ts` |
| Dev catalogue and capture helpers (not shipped) | `src/dev/catalog.ts`, `src/dev/shots.ts` |
| Tests | `src/tests/farmHD.test.ts` |

## 5. Characters

The crew system is unchanged: the same profiles, outfits and poses. The 64×96 sprite is built from the 32×48 composition and enlarged with Scale2x, which rounds diagonals instead of making blocky stairs. It is then refined at native resolution:
- Eyes are redrawn with iris, pupil, catch-light and lids, plus brows, nose, mouth (open on talk frames), cheeks, freckles and glasses.
- Hair gets strands and sheen, and fabric gets weave and folds.
- A rim light runs along the sunny edges, with a 1-px warm outline.

Below 1× the level of detail is the hand-tuned 32×48 sprite.

## 6. Performance (measured on the dev machine)

- Building the Farm scene takes about 3.5 s. Of that, the ground is about 1.8 s for 20 Mpx including about 870 baked decals and the level-of-detail copy, and about 450 sprites take about 1.8 s. The 0.4 build took 1.8 s. The first unoptimised 128×64 build took 8.3 s.
- Drawing a frame takes 5–20 ms.
- Memory: the painted frame is 5152×3936. The ground canvas is about 81 MB, plus about 20 MB for the half-resolution copy, plus the sprites.

## 7. Status and remaining gaps

**Reached:** 128×64 scale with the same framing, a library that meets every minimum, a world dressed from it in variants, charming animals, storytelling around every building, and depth to the frame edge.

**Still open:**
1. **Characters.** They are refined Scale2x, not drawn natively at 64×96. Up close they are chunkier than the environment, and the walk cycle still has two poses.
2. **Elevation.** There is a single ground level: no terraces, steps or banks.
3. **Light.** The sun is fixed, with no time-of-day or rim light on props. Light is a global grade plus authored shading.
4. **Build time and memory.** These are about twice those of 0.4. A worker, or ground baked lazily in chunks, would hide this.
5. **Close repetition.** Repeated scenery shares 4–8 seeds per variant, so a careful eye can spot twins in large woods.
