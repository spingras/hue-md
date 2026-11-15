# `hue-md.nvim` — Hue MD for Neovim

Native Neovim Lua plugin for Hue MD (`.hue.md` and `.md`):
- Live extmark highlighting for `{ok: ...}`, `{warn: ...}`, `{!: ...}` inline spans and `+-- info`, `ok`, `note`, `warn`, `!` callout boxes using the WCAG AA Light & Dark palette.
- Auto-continues `| ` when pressing `<Enter>` inside a box, and closes with `+--` when pressing `<Enter>` on an empty `| ` line.
- `:HueBox [info|ok|note|warn|!]` command with tab completion.

## Install

### With `lazy.nvim` (from local or release zip)
Extract `hue-md-nvim.zip` to `~/.config/nvim/pack/hue-md/start/hue-md.nvim` (loads automatically with zero config), or with `lazy.nvim`:
```lua
{
  "spingras/hue-md",
  config = function()
    vim.opt.rtp:append(vim.fn.stdpath("data") .. "/lazy/hue-md/nvim-hue")
    require("hue-md").setup()
  end,
}
```
