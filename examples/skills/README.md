# Example Skills

Packages to try the Skill installer with (Skills › Install skill › From folder). See [docs/SKILLS.md](../../docs/SKILLS.md).

| folder | format | what it shows |
| --- | --- | --- |
| `inspect-image/` | RealmNest package (`skill.json` + `SKILL.md` + `resources/` + `examples/`) | portable MCP tool requirements (`{ "mcpServer": "photocraft", "tool": "doc_open" }`), a read-only resource, an example |
| `agent-skills-format/release-notes/` | an Agent Skills folder (SKILL.md frontmatter, `references/`, `scripts/`) written for this repo to emulate the public format | the import adapter: id from the author, version `1.0` → `1.0.0`, `allowed-tools` reported as not mapped, the script left out |

The built-in **Workspace Note** Skill (`nestra.workspace-note`) ships with RealmNest itself (`src/runtime/skills/builtin.ts`).
