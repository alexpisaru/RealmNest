# Assets

The beta ships **no binary art**. Characters, outfits, props and worlds are drawn procedurally, so the app runs with zero asset files. This folder is where hand-drawn art goes as it gets made.

```
assets/
  characters/
    bases/     body sheets per body type / skin (future)
    hair/      hair layer sheets (future)
    outfits/   outfit layer sheets, one per outfit id (future)
  worlds/
    office/ factory/ farm/ space/ chemlab/
    studio/ robotics/ datacenter/ research/ port/
               prop PNGs for that world
  ui/          illustrations, title-screen art
  icons/       app icons (Tauri icon source: 1024×1024 PNG)
```

## Replacing a world prop

1. Draw the prop on the same isometric grid: tiles are 32×16 px, and 1 art pixel = 1 world pixel.
2. Save it as `worlds/<world>/<prop>.png`, for example `worlds/office/desk.png`.
3. Register it in `src/render/assets.ts`:

   ```ts
   import desk from '../assets/worlds/office/desk.png';
   registerPropImage('desk', { url: desk, anchorX: 32, anchorY: 44 });
   // per-variant: registerPropImage('container', { url: red, anchorX: 40, anchorY: 30 }, 'red');
   ```

   `anchorX` / `anchorY` is the pixel in your image that sits on the prop's **back corner at floor level**: world `(x, y, 0)` of the placement.
4. Call `registerProjectAssets()` once at startup, from `main.tsx`.

Collision, interaction points and depth sorting still come from the world data (`src/data/worlds/*.ts`) and `PROP_META`, so the art doesn't need to know about gameplay.

## Replacing character art (next step)

Characters are composed in `src/render/sprites.ts` as **base body → outfit → arms → face → hair → headgear → accessory** on a 20×30 canvas. To move to hand-drawn layers, keep the same contract:

- Sheet layout: one row per facing (`s, se, ne, n, nw, sw`), columns = frames: `stand×1`, `walk×4`, `work×2`, `talk×2`.
- Frame size 20×30. The feet sit at pixel (10, 28).
- One sheet per layer: `bases/<body>-<skin>.png`, `hair/<style>.png` (tinted at runtime or pre-coloured), `outfits/<outfit-id>.png`.
- Swap the body of `compose()` for a canvas that stacks the matching frames from each sheet. Everything above `getSprite()` stays as is: engine, renderer, cache keys.

The founder preset (`PRESETS[0]`, `founderPreset: true`) is the reference for proportions and quality. Keep its silhouette recognisable when its final sheet is drawn.
