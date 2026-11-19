-- Hue MD for Neovim: highlights Hue syntax in .hue.md and .md buffers with
-- extmarks, adds box editing helpers and :HueBox. The parsing lives in
-- lua/hue-md/parse.lua.

local parse = require('hue-md.parse')

local M = {}

local ns = vim.api.nvim_create_namespace('hue-md')

local function cap (c)
  return c:sub(1, 1):upper() .. c:sub(2)
end

local function mode ()
  return vim.o.background == 'light' and 'light' or 'dark'
end

-- Groups for spans with a hex color or a text + background pair, made on first use.
local dynamic = {}

function M.setup_highlights ()
  local m = mode()
  local hl = function (name, opts) vim.api.nvim_set_hl(0, name, opts) end
  for _, name in ipairs(parse.COLOR_NAMES) do
    local c = parse.PALETTE[name][m]
    local C = cap(name)
    hl('Hue' .. C, { fg = c.fg, bold = true })
    hl('HueBg' .. C, { bg = c.bg })
    hl('HueBox' .. C, { fg = c.fg })
    hl('HueBoxTitle' .. C, { fg = c.fg, bold = true })
    hl('HueProgress' .. C, { fg = c.fg, bold = true })
  end
  local p = parse.PALETTE
  hl('HueMarkup', { link = 'Comment', default = true })
  hl('HueDiffAdd', { fg = p.green[m].fg, bg = p.green[m].bg })
  hl('HueDiffDel', { fg = p.red[m].fg, bg = p.red[m].bg, strikethrough = true })
  hl('HueKbd', { fg = p.gray[m].fg, bg = p.gray[m].bg, bold = true })
  hl('HueProgressEmpty', { fg = p.gray[m].fg })
  for _, state in pairs(parse.TASKS) do
    local c = p[state.color][m]
    hl('HueTask' .. cap(state.name), { fg = c.fg, bg = c.bg, bold = true })
  end
  dynamic = {}
end

-- Highlight group for a span style: { fg, bg, fgHex, bgHex }.
function M.style_group (style)
  local fg, bg = style.fg, style.bg
  if fg and not bg and not style.fgHex and not style.bgHex then return 'Hue' .. cap(fg) end
  if bg and not fg and not style.fgHex and not style.bgHex then return 'HueBg' .. cap(bg) end
  local key = (style.fgHex and style.fgHex:sub(2) or fg or 'none') .. '_' .. (style.bgHex and style.bgHex:sub(2) or bg or 'none')
  local name = 'HueSpan_' .. key
  if not dynamic[name] then
    local m = mode()
    local opts = {}
    if style.fgHex then opts.fg = style.fgHex elseif fg then opts.fg = parse.PALETTE[fg][m].fg; opts.bold = true end
    if style.bgHex then opts.bg = style.bgHex elseif bg then opts.bg = parse.PALETTE[bg][m].bg end
    vim.api.nvim_set_hl(0, name, opts)
    dynamic[name] = true
  end
  return name
end

function M.highlight_buf (bufnr)
  bufnr = bufnr or vim.api.nvim_get_current_buf()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  for _, mark in ipairs(parse.scan(lines)) do
    local group = mark.group or M.style_group(mark.style)
    pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, mark.row, mark.col, {
      end_col = mark.end_col,
      hl_group = group,
      priority = mark.priority,
    })
  end
end

local TITLES = {
  info = 'Pro Tip',
  ok = 'Success',
  note = 'Important Detail',
  warn = 'Heads Up',
  ['!'] = 'Critical Warning',
  danger = 'Critical Warning',
}

-- :HueBox [info|ok|note|warn|!|split]
function M.insert_box (kind)
  kind = (kind and kind ~= '') and kind or 'info'
  local row = vim.api.nvim_win_get_cursor(0)[1]
  local box_lines
  if kind == 'split' then
    box_lines = {
      '+-- ok Do this                    +-- warn Avoid this',
      '| First point                     | First point',
      '+--                               +--',
    }
  else
    box_lines = {
      string.format('+-- %s %s', kind, TITLES[kind] or 'Note'),
      '| First point',
      '| Second point',
      '+--',
    }
  end
  vim.api.nvim_buf_set_lines(0, row, row, false, box_lines)
  vim.api.nvim_win_set_cursor(0, { row + 2, 2 })
  M.highlight_buf(0)
end

function M.setup ()
  M.setup_highlights()

  vim.filetype.add({
    pattern = {
      ['.*%.hue%.md'] = 'markdown',
    },
  })

  local augroup = vim.api.nvim_create_augroup('HueMd', { clear = true })

  vim.api.nvim_create_autocmd('ColorScheme', {
    group = augroup,
    callback = function ()
      M.setup_highlights()
      M.highlight_buf(vim.api.nvim_get_current_buf())
    end,
  })

  vim.api.nvim_create_autocmd('OptionSet', {
    group = augroup,
    pattern = 'background',
    callback = function ()
      M.setup_highlights()
      M.highlight_buf(vim.api.nvim_get_current_buf())
    end,
  })

  vim.api.nvim_create_autocmd({ 'BufEnter', 'TextChanged', 'TextChangedI' }, {
    group = augroup,
    pattern = { '*.md', '*.hue.md' },
    callback = function (ev)
      M.highlight_buf(ev.buf)
    end,
  })

  vim.api.nvim_create_autocmd('FileType', {
    group = augroup,
    pattern = 'markdown',
    callback = function (ev)
      -- Enter inside a box continues the `| ` side; Enter on an empty `| ` closes the box.
      vim.keymap.set('i', '<CR>', function ()
        local line = vim.api.nvim_get_current_line()
        if line:match('^|%s*$') then
          -- stay in insert mode: clear the `| ` and type the bottom border
          return '<End>' .. string.rep('<BS>', vim.fn.strchars(line)) .. '+--<CR>'
        elseif line:match('^|%s+') then
          return '<CR>| '
        elseif line:match('^%+%-%-%s+%S+') and not line:match('%s%s+%+%-') then
          return '<CR>| '
        end
        return '<CR>'
      end, { buffer = ev.buf, expr = true, silent = true })
    end,
  })

  vim.api.nvim_create_user_command('HueBox', function (opts)
    M.insert_box(opts.args)
  end, {
    nargs = '?',
    complete = function ()
      return { 'info', 'ok', 'note', 'warn', '!', 'split' }
    end,
  })
end

return M
