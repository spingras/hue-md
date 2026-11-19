# Hue Markdown snippets for every editor

Type a trigger and press <kbd>Tab</kbd> to insert Hue MD v0.2 syntax:

| Trigger | Inserts |
|---|---|
| `info` / `tip`, `ok` / `success`, `warn` / `warning`, `note`, `danger` / `caution` | a box in that color |
| `box` | a box, color to pick |
| `split` / `columns` | two boxes side by side |
| `rbox` | a rounded Unicode box (`╭──` … `╰──`) |
| `span` / `color` | a colored span `{info: text}` |
| `diff` | a diff span `{+: added}` / `{-: removed}` |
| `kbd` / `key` | a key cap `[[Ctrl+Shift+P]]` |
| `progress` / `bar` | a progress bar `[========..] 80%` |
| `task` | a task `- [ ]`, `- [-]`, `- [!]`, `- [?]` or `- [x]` |

Every trigger also works with a `hue-` prefix (`hue-info`, `hue-split`, …).

```markdown
+-- info Pro Tip
| First point
| Second point
+--
```

Box colors: `info` blue, `ok` green, `warn` orange, `note` purple, `!` or `danger` red, `muted` gray, or any palette color (`red`, `orange`, `yellow`, `green`, `blue`, `purple`, `gray`). Side-by-side boxes need their columns lined up: each box starts at the same column on every line.

All files here are generated from the VS Code snippets (`packages/vscode-hue/snippets/hue.json`) by `node scripts/build-snippets.js`; edit that file, not these. `npm test` checks they are up to date and that each snippet's default text renders as Hue.

## Editors

### VS Code / Cursor / Windsurf / VSCodium
Built into the [Hue MD extension](../packages/vscode-hue/), with Enter continuing `| ` inside a box.

### Notepad++
Built into the [Hue MD plugin](../packages/notepadpp-hue/): **Plugins → Hue Markdown**.

### Sublime Text
Copy the files in [`sublime/`](./sublime) into your Sublime Text `Packages/User/` folder (**Preferences → Browse Packages…**). Triggers use the first name in the table (`info`, `split`, `kbd`, …).

### Neovim / Vim
- **UltiSnips**: copy [`ultisnips/hue.snippets`](./ultisnips/hue.snippets) to your UltiSnips snippet folder as `markdown.snippets` (or add `extends hue`).
- **LuaSnip**: copy [`luasnip/hue.lua`](./luasnip/hue.lua) into your config's `lua/` folder and add `require("luasnip").add_snippets("markdown", require("hue"))`.
- The [Neovim plugin](../packages/nvim-hue/) adds highlighting and `:HueBox`.

### Obsidian
Copy the notes in [`obsidian/`](./obsidian) into your vault's templates folder (**Settings → Templates → Template folder location**), then use **Templates: Insert template**. The [Obsidian plugin](../packages/obsidian-hue/) renders them and has insert commands of its own.
