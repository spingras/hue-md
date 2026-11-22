# Changelog

All notable changes to the `hue-md` extension are documented in this file.

## [0.2.5] - 2026-11-22

### Also in this release (other platforms)
- Emacs: `hue-markdown-mode.el` loads again in current Emacs (29 and 30); it failed to load because of how the major mode picked its parent mode

## [0.2.4] - 2026-11-22

### Fixed
- The Markdown preview scrolls to the right line when the cursor is inside a box (lines inside boxes kept their position relative to the box instead of the file)

## [0.2.3] - 2026-11-19

### Fixed
- The `split` snippet now lines up its two columns, so it renders as side-by-side boxes

### Also in this release (other platforms)
- Obsidian, the GitHub browser extension and userscript, Neovim, and the Sublime, UltiSnips, LuaSnip and Obsidian snippets now support all v0.2 syntax

## [0.2.2] - 2026-11-17

### Fixed
- Command Palette now shows all four `Hue:` commands (`Open Side-by-Side Preview`, `Insert Box...`, `Wrap Selection in Box...`, and `Convert to GitHub Alert Markdown (.md)`)
- Editor decorations now highlight `{!: ...}` danger spans, `#hex` colors, inline diff spans (`{+:}` / `{-:}`), multi-state tasks, key caps, progress bars, and side-by-side split box borders
- Built-in VS Code Markdown preview stylesheet (`media/hue.css`) synced with all v0.2 rules and dark-mode selectors
- Box `Enter` line continuation after box headers and auto-closing (`+--`) on empty `| ` lines
- Updated Marketplace screenshot to showcase all v0.2 syntax features

## [0.2.1] - 2026-11-16

### Changed
- Updated Marketplace README and CHANGELOG for v0.2 features

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
