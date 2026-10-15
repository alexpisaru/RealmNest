---
name: "inspect-image"
description: "Open an image in PhotoCraft and report its size, mode and layers."
license: "MIT"
metadata:
  realmnest-id: "realmnest-examples.inspect-image"
  version: "1.0.0"
---
# Inspect Image

Use this procedure when you are asked what an image contains or how it is built.

1. Open the image with the PhotoCraft `doc_open` tool. Paths are relative to PhotoCraft's read root; use the file name you were given.
2. Call `doc_inspect` on the document you just opened.
3. Report, in this order:
   - the file name;
   - width × height in pixels, colour mode and bit depth;
   - the layers from top to bottom: name, kind, visibility.
4. Do not change, save or export anything. If opening the image is refused or fails, say so and stop.

The report layout is in `resources/report-template.md` (read it with the Skill resource tool if you need it).
