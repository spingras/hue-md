# Hue Markdown Snippets for All Editors

Effortlessly author Hue callout boxes across any editor or platform.

Type `info`, `warn`, `ok`, or `note` and press <kbd>Tab</kbd> (or <kbd>Enter</kbd>) to insert a perfectly formatted box.

## Syntax Standard

Hue boxes follow the standardized minimal open format:

```markdown
+-- info Pro Tip
| First point
| Second point
+--
```

Semantic callout tokens:
- `info` / `tip` -> Blue box (GitHub `[!NOTE]`)
- `ok` / `success` -> Green box (GitHub `[!TIP]`)
- `warn` / `warning` -> Orange box (GitHub `[!WARNING]`)
- `note` / `important` -> Purple box (GitHub `[!IMPORTANT]`)
- `danger` / `!` -> Red box (GitHub `[!CAUTION]`)

---

## Editor Support

### 1. VS Code / Cursor / Windsurf / VSCodium
Built directly into the [Hue Markdown Extension](../packages/vscode-hue/).
- Snippets available out of the box (`info` + <kbd>Tab</kbd>, `warn` + <kbd>Tab</kbd>, `ok` + <kbd>Tab</kbd>, `note` + <kbd>Tab</kbd>).
- Pressing <kbd>Enter</kbd> inside a box automatically continues the `| ` prefix on the next line.
- Commands: `Hue: Insert Callout Box` and `Hue: Wrap Selection in Box`.

### 2. Notepad++
Built directly into the [Hue Markdown Plugin](../packages/notepadpp-hue/).
- Menu items under **Plugins > Hue Markdown**:
  - `Insert Info Box (+-- info)`
  - `Insert Warn Box (+-- warn)`
  - `Insert OK Box (+-- ok)`
  - `Insert Note Box (+-- note)`
- Side-by-side live preview updates automatically in real-time.

### 3. Sublime Text
Copy the files in [`snippets/sublime/`](./sublime) into your Sublime Text `Packages/User/` directory:
- `info` + <kbd>Tab</kbd>
- `warn` + <kbd>Tab</kbd>
- `ok` + <kbd>Tab</kbd>
- `note` + <kbd>Tab</kbd>
- `danger` + <kbd>Tab</kbd>

### 4. Neovim / Vim
- **UltiSnips**: Copy [`snippets/ultisnips/hue.snippets`](./ultisnips/hue.snippets) to your UltiSnips snippet directory.
- **LuaSnip**: Require [`snippets/luasnip/hue.lua`](./luasnip/hue.lua) in your Neovim configuration.

### 5. Obsidian
Copy the markdown templates in [`snippets/obsidian/`](./obsidian) to your Obsidian templates vault folder.
