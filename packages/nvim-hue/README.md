# `hue-md.nvim`: Hue MD for Neovim

Neovim Lua plugin for [Hue Markdown](https://spingras.github.io/hue-md/) v0.2 in `.hue.md` and `.md` buffers:

- Highlights, with the Hue palette for `background=light` and `background=dark`:
  - colored spans `{ok: passing}`, `{bg-yellow: key phrase}`, `{blue bg-gray: both}`, hex `{#c0ffee: text}`; the `{spec:` and `}` markup is dimmed
  - diff spans `{+: added}` (green) and `{-: removed}` (red, struck through)
  - key caps `[[Ctrl+Shift+V]]`
  - progress bars `[========..] 80%`, colored by percentage
  - task markers `[ ]` `[x]` `[-]` `[!]` `[?]`
  - box borders, side bars and titles in the box color (`+-- info Title` … `+--`), also side-by-side boxes and boxes inside boxes
  - ` ```hue ` fences; other code blocks and inline code are left alone
- `<Enter>` inside a box continues the `| ` side; `<Enter>` on an empty `| ` line closes the box with `+--`.
- `:HueBox [info|ok|note|warn|!|split]` inserts a box (tab completion).

The rules are those of the Hue parser (`src/core.js`), in Lua: `lua/hue-md/parse.lua`. `test/nvim.test.js` (run by `npm test` at the repo root) checks the palette and key names against `src/palette.js` and `src/core.js`, and the highlights on `demo/demo.hue.md`. It runs the Lua in fengari (Lua 5.3 in JavaScript) with a stand-in for the Neovim API, not in Neovim itself; the manual check below covers that.

## Install

Extract `hue-md-nvim.zip` to `~/.config/nvim/pack/hue-md/start/hue-md.nvim` (Windows: `%LOCALAPPDATA%\nvim\pack\hue-md\start\hue-md.nvim`). It loads by itself, with no config.

Or with `lazy.nvim`, from this repository:

```lua
{
  "spingras/hue-md",
  config = function(plugin)
    vim.opt.rtp:append(plugin.dir .. "/packages/nvim-hue")
    require("hue-md").setup()
  end,
}
```

## Manual check

1. Install the plugin (above). For a quick try without touching your config, from the repo root:

   ```bash
   nvim --clean --cmd "set rtp^=packages/nvim-hue" --cmd "runtime plugin/hue-md.lua" demo/demo.hue.md
   ```

2. Check:
   - [ ] `passing` green, `71%` orange, `blocked` red; the yellow, blue-on-gray and `#c0ffee` spans colored; `{ok: ` and `}` dimmed; `{a: 1}` plain
   - [ ] the five box borders, side bars and titles in blue, green, purple, orange, red
   - [ ] the two side-by-side boxes at the end: left column green, right column orange
   - [ ] `[x]` green, `[-]` blue, `[!]` red, `[?]` purple, `[ ]` gray
   - [ ] `[[Ctrl+Shift+V]]` and `[[Esc]]` as key caps; the 80% bar blue, the 100% bar green
   - [ ] the Changelog line: green added text, red struck-through removed text
3. `:set background=light` and `:set background=dark`: the colors switch.
4. In insert mode on a `| ` line inside a box, press `<Enter>`: the next line starts with `| `. Press `<Enter>` on an empty `| `: the box closes with `+--`.
5. `:HueBox split` inserts two boxes side by side.
