---
name: release-notes
description: Turn a list of changes into short, friendly release notes. Use when someone pastes commits, a changelog or a list of fixes and asks for release notes.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Read Bash(git:*)
---

# Release Notes

1. Group the changes into New, Improved and Fixed.
2. Write one short line per change, in plain language, without internal ids.
3. Follow the tone in [the style guide](references/style.md).

To collect changes from a repository, run `scripts/collect.py` (not available in every product).
