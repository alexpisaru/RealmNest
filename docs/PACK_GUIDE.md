# World packs at 128×64: authoring guide

This guide explains how to bring a world up to the Farm's art direction (`docs/FARM_ART_BIBLE.md`). The world gets 128×64 tiles and its own asset pack, and it is framed by surroundings that no other world shares. The Office is the reference implementation: read `src/render/hd4/packs/office/` and `src/data/worlds/office.ts` before you start.

## 1. The two rules that matter most

1. **Nothing is shared between worlds.**
   - Every prop, wall, floor, patch and piece of scenery a world shows is drawn in its own pack. The Office desk and the Data Center desk are two different drawings with different materials and details.
   - Never import another world's pack.
   - Shared *primitives* are fine: raster helpers, ramps, materials and planes in `kit4`, `materials4`, `plane4`, `packs/materials`, `packs/util`. Shared *designs* are not.
2. **Every world gets its own place.** The surroundings concept is fixed per world (section 9). No reused city block, no generic street, no `building()` / `station()` generators from `surroundings.ts`.

## 2. Art direction (binding)

**Projection and rendering**
- Classic 2:1 isometric, nearest neighbour, integer scaling only.
- No smooth gradients and no painterly blending. Tones come from 5–7-step ramps, with ordered dithering (`bayer`) where you need a transition.

**Light, colour and outlines**
- One sun from the **upper left**. Screen-left faces (the prop's front, at b = d) are lit, screen-right faces (the side, at a = w) are in shade, and tops are brightest.
- Cast and contact shadows fall to the **lower right** (`contactShadow`, `footShadow`), in warm purple `#2a1a2a`, never black.
- Outlines are selective, dark and warm: wrap shapes in `layer(c, draw, { outline })`. Never use pure black.
- Every material must read at 1:1: wood grain, metal sheen, glass reflection, fabric folds, stone joints, plaster speckle. Use the textured-face materials.

**Density and storytelling**
- The scene must look lived in: clutter, wear, plants, signs, tools, cables, small personal objects.
- Avoid flat empty areas, sterile borders, clones and a "floating diorama" look.
- The surroundings must reach the frame's edge on every side, with depth: big things near the frame edge, a roofscape or horizon far away.

**Variety**
- Repeated scenery needs variants (by `k.seed` or `variant`).
- Use the pack's `reuse` map so repeated types share 4–8 rasterised variations.

## 3. Scale

| Thing | Size |
| --- | --- |
| Tile | 128×64 px (k = 4). Prop-local `a` runs along the width, `b` along the depth, and **b = d is the front**. For rot 0 the front is the lit world +y face and the visible side is `a = w`, in shade. For rot 1 the front is the shaded world +x face and the visible side is **`a = 0`**, lit. `lbox` handles this; when you draw on planes yourself, use `side(p, rot ? 0 : w)`. |
| Height | 1 z unit = 4 px ≈ **10 cm**. A person is ~17.5 z (64×96 sprite, body ~40×70 px). |
| Furniture | Desk / table top ≈ 7.4 z · chair seat ≈ 4.5 z · counter ≈ 9 z · sofa seat ≈ 4.5 z · door ≈ 21–22 z · bookcase ≈ 20 z. |
| Rooms and buildings | Room back walls ≈ 36–44 z (Office: 40). A storey outside ≈ 32–36 z. Trees ≈ 120–170 z. |
| Footprint | A prop never draws far outside its footprint, except foliage and shadows: depth sorting is by footprint. Big buildings: make the footprint match the base. |

## 4. Files you own

| File | Contents |
| --- | --- |
| `src/render/hd4/packs/<world>/index.ts` | `export const <WORLD>: WorldPack = { props, floors, crisp, walls, patch, critters, reuse }` (the registry in `packs/index.ts` already imports it). Split the art into files as you like: `room.ts`, `walls.ts`, `ground.ts`, one or more for outside. |
| `src/data/worldProps/<world>.ts` | `PropMeta` for every **new** prop type you add (already merged into `PROP_META`). **Prefix new type names** with the world's prefix: `fac_`, `spc_`, `lab_`, `std_`, `rob_`, `dc_`, `res_`, `prt_`. Existing catalogue names (`desk`, `console`, `machine`, `rack`, `lowWall`, `crate`…) keep their names; you just draw them in your pack. |
| `src/data/worlds/<world>.ts` | The world definition (see section 7). |

Do not edit files outside these. That includes shared renderer files, other packs, `props.ts`, `domain/world.ts` and the tests. If you truly need a shared change, say so in your final report instead.

## 5. APIs

**Prop art.** A prop is a `PropArt`: `{ draw(p, k), anim?(p, k) }`.
- `p` is a `PropPainter`:
  - `p.P(a, b, z)` gives screen pixels.
  - `p.c` is the canvas context (a `SoftCtx` CPU raster: only `fillStyle`, `fillRect` and `globalAlpha` exist).
  - `p.k` = 4, `p.rot`, `p.pw` / `p.pd` (footprint).
- `k` is a `PropCtx`: `{ w, d, variant, color, seed, t, th }`.
- `draw` is rasterised once into a cached sprite. `anim` draws every frame on top, so keep it tiny: screens, steam, blinking lights, water.

**`kit4`**
- Ramps `R.*`, plus `px`, `ell`, `fillPoly`, `ln`, `curve`.
- `layer(c, draw, { outline?, rect? })`: always pass `rect` for small parts in big props, so the layer allocation stays small.
- `foliage(c, masses, ramp, seed, opts)`: per-pixel leaf volumes. Its cost scales with area.
- `contactShadow`, `dotFruit`, `trunk`, `hash`, `rng`, `noise2`, `bayer`, `at(ramp, i)`.

**`plane4`**
- `front(p, b)` and `side(p, a)` planes; `front3` / `side3` (planes that also know 3D points).
- `pq(p, pl, u0, u1, z0, z1, col)`: flat quad on a plane.
- `pt(p, pl, u0, u1, z0, z1, mat)`: textured quad.
- `poly3(p, pts3, mat, light, basis?)`: any planar polygon, exactly clipped. Use it for gables, slopes and cut faces.
- `ppoly`, `beam`, `window4`, `door4`, `flowerBox`.

**Materials.** A `Mat` is `(light, w, h) => (u, v, x, y) => color`. `u` and `v` are face pixels; `v` points up on walls.
- `materials4`: `boards4`, `siding4`, `plaster4`, `fieldStones4`, `cutStone4`, `bricks4`, `shingles4`, `glass4`.
- `packs/materials`: `velvet`, `twill`, `brushed`, `paint`, `marble`, `grain`, `cardboard`.
- When you pass an inline texture lambda to `pt` / `poly3`, annotate its parameters: `(u: number, v: number) => …`.

**`packs/util`**
- `anchor(p, a, b, z)`.
- `lbox(p, a0, b0, aw, bd, z0, h, { front, side, top, edge })`: a textured box by *local* faces, correct for both rotations.
- `mono(mat)`, `footShadow`.

**Walls.** A `WallPack` is `{ height, draw(p, side, world), art: { [wallPropType]: { draw(p, side, k), anim? } } }`.
- `p` is a `PropPainter` over the whole room at (0, 0): the NE wall is the plane b = 0 along a, and the NW wall is the plane a = 0 along b.
- Use `front3(p, 0)` for `side === 'ne'` and `side3(p, 0)` for `'nw'`, as in `office/walls.ts` (`planeOf`).
- `k.wp` is the placement: `at`, `w`, `variant`, `color`.
- The wall and its props are rasterised once into a sprite; `anim` runs each frame.

**Floors.** A `Floor4` is `(x, y, px, py, e) => 0xRRGGBB`.
- `x, y` are tile coordinates; `px, py` are frame pixels.
- `e.near` is 0 at a border with another material and 1 close to one; `e.other` is that material; `e.nA`, `e.nB`, `e.nC` are noise fields.
- Materials listed in `crisp` keep ruler-straight borders: floors, kerbs, roads.

**Patches.** `patch(P, s, world)` paints floor patches (rugs, lanes, pads, hazard stripes…) straight into the ground buffer, pixel by pixel (see `officePatch`).

**Critters.** `critters: { myKind: CritterArt }` declares new animals or robots (see `CritterArt` in `hd4/animals.ts`, and `volume()` for shaded bodies). Place them with `b.critters('myKind', x, y, w, d, count)`.

**Sprite sharing.** `reuse: { prt_gull_post: 6, … }` makes repeated scenic types share sprites. Use it for trees, lamps, bollards, crates and similar.

**Ground effects.** The bake adds drifting cloud shadows and a dark wet bank on land next to water. Cloud shadows never fall on the floor inside a room with walls. `groundFx: { clouds: false, bank: false }` turns either off for a world: Space has no weather, and the Data Center shades its own clouds on snow.

**Wide wall decor.** `decorateWalls(b, kinds, wide)` gives the kinds listed in `wide` two tiles wherever there is room.

## 6. Depth sorting

- Props sort by footprint (front-most tile). Long thin props (walls, fences, benches) are cut into half-tile columns automatically.
- Anything placed behind the room's back walls (y < 0 or x < 0, inside the room's span) is drawn **before** the walls.
- A prop draws only its visible faces: the front (b = d) and the visible side (a = w for rot 0, a = 0 for rot 1).
- The raster box around a prop reaches about `h/2 + 10` base units past its footprint on both sides, plus a little above `h`. Set `h` in its meta tall enough for its art, or crowns and roofs get clipped.

## 7. The world file

- Set `environment.tile: 128`.
- **Keep every station, seat, point, spawn, node and playable prop exactly as it is**: the simulation and the tests depend on them.
  - You may rotate or reshade playable props visually only if their footprint stays valid.
  - You may move purely decorative playable props (plants, boxes) to free tiles.
- Replace `building(...)` / `station(...)` with your own surroundings function in the world file, written like `officePiazza`.
  - Use `b.setScene({ ext, outer, frontWalls, light })`, `b.ground(mat, x, y, w, d)`, `b.scenic(type, x, y, opts)` and `b.decor(...)`. Flat decals are props with `flat: true` in their meta.
  - Fill the whole frame. The painted area spans about 25–40 tiles round the room; check the full-frame render.
- `decorateWalls(b, kinds)` fills free wall spans. Pass **your own** wall decor kinds, and draw them in your pack.
- Indoor worlds need `lowWall` in the pack: the cut front walls. Draw them as **your** building's facade, cut low.

## 8. Verifying

- The dev server runs on `http://localhost:5173` and a PNG receiver on `:5199`: `node tools/bake-receiver.mjs [out-dir]` (the `bake-receiver` entry of `.claude/launch.json`), which writes every POSTed file to `out-dir`.
- **Open your own browser tab** (`tabs_create`, then `navigate` to `http://localhost:5173/`). Use it for all your renders, not the default tab, because other worlds are being built in parallel.
- Render from that tab with the JavaScript tool, then `Read` the PNG files from `s2/`:

```js
const S = await import('/src/dev/shots.ts'); S.reset();
await S.shoot('<world>_full.png', { world: '<world>', w: 1920, h: 1080, zoom: 0.5, crew: true, t: 2 }); // the default framing (half-res level of detail)
await S.shoot('<world>_room.png', { world: '<world>', w: 1600, h: 1000, zoom: 1, at: [8, 6], crew: true }); // native 1:1
await S.shoot('<world>_z2.png', { world: '<world>', w: 1000, h: 640, zoom: 2, at: [x, y] }); // detail check
```

- Prefix every PNG name with your world id.
- If other people are editing files at the same time, Vite reloads the app page and cuts renders off. A tab opened directly at `http://localhost:5173/src/dev/shots.ts` has no hot-reload client; import the helpers from the console there.
- `crew: true` borrows a few demo characters, in the world's default outfit, for worlds with no demo crew.
- `shoot` returns `{ build, frame }` in ms. **Keep `build` under ~6000 ms.** Distant scenery should use flat fills (see `tetti` in `office/palazzi.ts`), not textured faces.
- Typecheck only your files, because others are being edited concurrently:

```bash
npx tsc --noEmit -p . 2>&1 | grep -E "packs/<world>|worlds/<world>|worldProps/<world>"
```

- Tests: run `npx vitest run src/tests/packs.test.ts src/tests/worlds.test.ts`. Coverage of art, wall props and critters for your world must pass.
- If a render fails because *another* world's file has a syntax error mid-edit, wait a moment and retry. Never edit another world's files.

## 9. The worlds and their places

| World | Place (surroundings) | Its own interior language |
| --- | --- | --- |
| **Factory** (`fac_`) | A red-brick industrial estate on a canal: sawtooth-roof mill sheds, a brick chimney stack, a riveted water tower, a rail spur with freight wagons, loading docks with lorries, a canal with a barge and a swing bridge, chain-link, pallets, gas cylinders, buddleia in the cracks. | Riveted steel machines, oily concrete, yellow-and-black safety paint, steel trusses. |
| **Space** (`spc_`) | An orbital station over a planet: hull plating with panel lines and greebles, external modules, trusses, big solar arrays, docking arms, a docked shuttle, antennas, thruster pods, a curved planet horizon and deep starfield. | Brushed metal, glowing panels, padded surfaces, cool palette with warm accents. |
| **Chemical Lab** (`lab_`) | A modern science-park campus by a pond: glass and white-concrete research buildings with brise-soleil, a fenced hazmat yard with tanks and drums, EV-charger parking under solar canopies, a reed pond with a boardwalk, birches and clipped lawns. | White and teal epoxy, stainless steel, glassware, safety signage. |
| **Creative Studio** (`std_`) | A seaside arts district on a boardwalk: colourful wooden beach houses and studios, murals, a pier, a surf shop, a food truck, palms, dunes with marram grass, the sea with a sandy beach, deckchairs and umbrellas. | Warm plank floors, colourful creative mess, plants, canvases, lights. |
| **Robotics Workshop** (`rob_`) | A hangar at a small airfield: hangar doors, a concrete apron with markings, a runway with lights, a control tower, small prop planes, a windsock, fuel truck, drones on pads, hangars in the distance, dry grass verges. | Workbench clutter, parts bins, pegboards, cable spools, prototypes. |
| **Data Center** (`dc_`) | A snowy northern site by a fjord: snow-covered ground and pines, the data hall's ribbed metal cladding, rooftop chillers with steam, a power substation with transformers and pylons, wind turbines on a ridge, a frozen lake, a snow plough, footprints in snow. | Cold aisles, raised floor tiles, rack LEDs, cable trays, cool blue and green light. |
| **Research Hub** (`res_`) | A mountain observatory: telescope domes, a radio dish, a stone lodge, rocky alpine meadows with wildflowers, larches and stone pines, a winding road, boulders, a cable car or a weather station, peaks and a valley below. | Old-library warmth: archives, globes, star charts, brass instruments, specimen terraria. |
| **Logistics Port** (`prt_`) | A working harbour (it is outdoor): quay with bollards and cleats, stacked containers, gantry cranes, warehouses, a lighthouse on a breakwater, a fish market, fishing boats and a ferry, gulls, crates, nets, rope coils, puddles and oil sheen. | Painted steel, rust, wet concrete, hazard markings. |

Animals and life belong to the place. Pigeons and cats are built in; add your own kinds through `critters`: gulls, robots, drones, arctic foxes, marmots, crabs and so on.

## 10. Baked scenes (the scene as a picture)

A world can load its static scene from a picture instead of painting it. The Farm ships its own pixel art baked this way, from `public/baked/farm/`.

### Baking the engine's own pixel art (what the Farm ships)

1. **Bake.** In the dev server console, with the receiver from §8 running, run `(await import('/src/dev/bake.ts')).bakePixel('<world>')`. It POSTs:
   - `scene.png` and `scene_half.png`, the still scene at full and half resolution;
   - `masks.png`, the exact silhouettes of the props people or animals pass behind;
   - `scene.json`, which also lists the props whose animations the app draws on top.
2. **Convert.** Convert the two scene PNGs to lossless WebP (PIL: `im.save('scene.webp', lossless=True)`). Copy them, `masks.png` and `scene.json` to `public/baked/<world>/`, and add the world to `SCENES` in `src/render/baked.ts`.
3. **Re-bake.** Re-bake after every change to the world's art or layout. `?procedural` in the URL shows the live-painted scene for comparison.
   - A layout change is caught on its own: `scene.json` carries a fingerprint (`sceneFingerprint`), the app paints the scene live when it no longer matches, and `src/tests/baked.test.ts` fails.
   - A change to the drawing code is not caught, so re-bake after one.

### Using a retouched picture instead

1. **Plate.** `plate('<world>')` POSTs:
   - `<world>_completa.png`, the scene with nothing that moves;
   - `<world>_guida.png`, where people and animals move, and which props must keep their place and silhouette.
2. **Retouch.** Keep the framing, positions and silhouettes; leave out animals, people, smoke and jets. Upscale a small result 4× with Real-ESRGAN (`realesrgan-ncnn-vulkan -n realesrgan-x4plus`).
3. **Fit and outline.**
   - `open('<world>', url)` fits the picture onto the frame.
   - `grid(name, box)` posts a crop with a frame-px grid to read outlines off.
   - `preview(name, cuts, box)` checks cut-outs on the picture.
4. **Recipe.** Write the recipe in `src/dev/bakeRecipes.ts` (`farmRitocco` is the example):
   - `keep`, `fixes` and `cuts` with tight outlines and ground points;
   - `fx` (glints, lanterns, bees) and `noAnim`.

   Keep outlines tight around posts and trunks. Colour separation (`refine`) only works where an object stands apart from the ground.
5. **Bake.** `run('<recipe>')` POSTs `masks.png` and `scene.json`; put them next to the picture.
6. **Check.** In the app, people must go behind the cut-outs and never vanish where the picture shows no object.
