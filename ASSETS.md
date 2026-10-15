# Assets

What ships inside the RealmNest OS exe besides code, and where it comes from. Copyright (C) 2026 Marius Alexandru Pisaru unless stated otherwise.

| asset | where | origin |
| --- | --- | --- |
| world scenes (10 worlds, baked pictures) | `public/baked/<world>/` | drawn by RealmNest's own pixel-art engine (`src/render`), art-directed by the owner with AI assistance (mainly Claude and ChatGPT) |
| world map illustration | `public/home/world-map.webp` | made by the owner with AI image tools (mainly ChatGPT) |
| characters (bodies, outfits, hair) | `src/assets/characters/` | the owner's character sheets, made with AI assistance (mainly Claude and ChatGPT) |
| icons | `lucide-react` | Lucide, ISC licence |
| fonts | Inter, Fraunces, JetBrains Mono (`@fontsource-variable/*`) | SIL Open Font License 1.1 (texts in THIRD_PARTY_NOTICES.md) |
| sound | none: music, ambience and effects are synthesised at run time (`src/audio`) | — |

AI-assisted images are used under the terms of the tools that produced them. Whether AI-generated images can carry copyright differs between countries; they are distributed here together with the code under the AGPL v3 or later, without any claim beyond what the law allows.

Not shipped (development only, in the repository): `art/`, `assets_3d/` (Quaternius kits, CC0 1.0), `promo/`, the videos and pictures at the repository root, `docs/` pictures.
