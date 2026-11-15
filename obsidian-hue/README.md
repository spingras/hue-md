# Hue MD for Obsidian (`hue-md`)

Native Obsidian plugin that renders Hue MD inline color spans (`{ok: passing}`, `{warn: 71%}`, `{!: blocked}`) and effortless callout boxes (`+-- info`, `ok`, `note`, `warn`, `!`) across your Obsidian vault.

## 1-Step Install

1. Extract `hue-md-obsidian.zip` into your vault's `.obsidian/plugins/hue-md/` folder:
   ```text
   <YourVault>/.obsidian/plugins/hue-md/
   ├── manifest.json
   ├── main.js
   └── styles.css
   ```
2. Open Obsidian **Settings → Community plugins**, reload plugins, and enable **Hue MD**.

## Features
- **Live Box & Span Rendering**: Renders `+-- info`, `ok`, `note`, `warn`, and `!` boxes and `{color: text}` spans with WCAG AA light/dark contrast.
- **Command Palette (`Ctrl+P` / `Cmd+P`)**:
  - `Hue MD: Insert Info Box (+-- info)`
  - `Hue MD: Insert Success Box (+-- ok)`
  - `Hue MD: Insert Important Note Box (+-- note)`
  - `Hue MD: Insert Warning Box (+-- warn)`
  - `Hue MD: Insert Danger Box (+-- !)`
