# Hue Markdown for Visual Studio Code

Native color spans, badges, and styled callout boxes for Markdown (`.hue.md` and `.md`).

Hue Markdown brings readable-raw color, background tints, and drawn ASCII/Unicode boxes to Markdown that still read gracefully as plain text.

![Hue Demo Preview](../demo/demo.png)

## Features

- 🎨 **Live Side-by-Side Preview**: Full integration with VS Code's built-in Markdown preview (`Ctrl+Shift+V` or click the Split Preview icon). Color spans and drawn boxes render into styled badges and cards with full dark and light theme support.
- 🖋️ **Editor Syntax Highlighting**: Rich TextMate grammar coloring for `.hue.md` files: curly braces, semantic color tags (`ok`, `warn`, `info`, `note`, `!`), background tints (`bg-yellow`), hex colors (`#hex`), and box borders (`┌──`, `│`, `└──`, `+--`, `|`).
- ⚡ **Editor Color Decorations**: Live subtle color and box border tinting right inside the text editor.
- 🔄 **Downgrade to GitHub Alerts**: One-click command `Hue: Convert to GitHub Alert Markdown (.md)` automatically converts boxes into native GitHub alerts (`> [!NOTE]`, `> [!WARNING]`, etc.) for sharing with standard viewers.

## Syntax Quick Reference

### Inline Spans
```markdown
Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}
Highlight: {bg-yellow: phrase} · Combination: {blue bg-gray: text}
Hex color: {#c0ffee bg-#333333: exact hex}
```

### Callout Boxes
```markdown
┌── ! Never commit secrets ──────────────┐
│ Keep `.env` files out of git.          │
│ - Add `.env` to `.gitignore`           │
│ - Rotate any key that leaked {!: now}  │
└────────────────────────────────────────┘

+-- info Typing tip -----------------+
| ASCII boxes work too: `+-+` and `|`|
+------------------------------------+

╭── ok ──────────────────────────────╮
│ Rounded corners, no title, and     │
│ **any Markdown** inside            │
╰────────────────────────────────────╯
```

## Shortcuts & Commands

- `Ctrl+Shift+V` / `Ctrl+K V`: Open Markdown Preview (rendered with Hue theme)
- `Ctrl+Shift+P` -> `Hue: Open Side-by-Side Preview`: Split editor with live preview
- `Ctrl+Shift+P` -> `Hue: Convert to GitHub Alert Markdown (.md)`: Downgrades current file to CommonMark + GitHub alerts

## License

MIT
