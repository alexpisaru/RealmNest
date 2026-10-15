# Character pipeline prototype (EffectCraft)

This folder turns one rest-pose sprite per character into animated, pixel-safe sprite sheets. The rig and animations are shared, rendered by EffectCraft and validated by our own tools.

What it is and how well it works: [docs/charpipe/REPORT.md](../../docs/charpipe/REPORT.md).

## Run

You need EffectCraft 0.8 or later. The pipeline finds `effectcraft-cli` through `$EFFECTCRAFT_CLI` first, then `C:\Program Files\EffectCraft`, then `PATH`.

```bash
npm run character:build -- alex
npm run character:build -- giulia
```

Then `npm run dev` and open http://localhost:5173/charpipe.html.

Optional review material:

```bash
npx vite-node tools/charpipe/compare.ts alex     # docs/charpipe/img/*_compare.png
npx vite-node tools/charpipe/diff.ts alex        # pixel diff vs the shipped rig
npx vite-node tools/charpipe/mcp-demo.ts alex    # an agent makes a "wave" over MCP
python tools/charpipe/gifs.py alex               # GIFs (Pillow)
```

## Add a character

1. Put an 80×128 rest pose, feet on row 120, in `characters/<id>/source/`.
2. Copy `characters/giulia/character.json` and set its pivots, cut rects, overlaps, soles and reach. Keep the same joints.
3. Run `npm run character:build -- <id>` and check the console. Every idle should report `rest diff 0 px`.

## Add an outfit or a hat

- **Recolour:** add a `variants.<name>.recolor` map.
- **New shape:** draw a new rest-pose sprite. Not wired yet: today a variant is a recolour of the source.
- **Hat:** draw an 80×128 rest-pose PNG and list it under `accessories` with its `joint`. Add an `offset` to reuse it on another head.

## Add an animation

Add `animations/<id>.json`. Each track is per-frame and joint-relative:

- `rot`: degrees clockwise.
- `dx` / `dy`: whole pixels.
- `step`: pixels along the ground diagonal.

`groundLock` solves the pelvis height for rotation-based legs. Every character picks the new animation up on its next build.
