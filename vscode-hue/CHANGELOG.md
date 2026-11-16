# Changelog

All notable changes to the `hue-md` extension are documented in this file.

## [0.2.0] - 2026-11-16

### Added
- Side-by-side split box columns (`+-- ok Left   +-- warn Right`) with 16 px horizontal gap
- Multi-state task lists: `- [ ]` (todo), `- [-]` (in progress), `- [!]` (blocked), `- [?]` (question), `- [x]` / `- [X]` (done)
- Native keyboard shortcut key caps (`[[Ctrl+Shift+V]]`, `[[Cmd+K]]`, `[[Esc]]`, `[[?]]`)
- Text progress bars (`[========..] 80%`, `[==========] 100%`)
- Inline diff spans (`{+: added text}` and `{-: removed text}`)
- New TextMate grammar rules and snippets (`split`, `diff`, `kbd`, `progress`, `task`)
- Updated `Hue: Convert to GitHub Alert Markdown (.md)` to downgrade all v0.2 constructs

## [0.1.1] - 2026-11-15

### Added
- Line continuation inside boxes (`Enter` inserts `| `, empty `| ` closes with `+--`)
- Quick commands `Hue: Insert Box...` and `Hue: Wrap Selection in Box...`

## [0.1.0] - 2026-11-15

### Added
- Native VS Code Markdown preview integration (`extendMarkdownIt`)
- Complete dark and light theme styles (`media/hue.css`)
- Rich TextMate syntax grammar for `.hue.md` files
- TextMate injection grammar for standard `.md` files
- Editor decorations for live color feedback in raw code view
- Command `Hue: Open Side-by-Side Preview`
- Command `Hue: Convert to GitHub Alert Markdown (.md)`
- Packaging into `.vsix` bundle
