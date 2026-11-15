local M = {}

local ns = vim.api.nvim_create_namespace('hue-md')

local COLORS = {
  red = 'Red', orange = 'Orange', yellow = 'Yellow',
  green = 'Green', blue = 'Blue', purple = 'Purple', gray = 'Gray',
  danger = 'Red', ['!'] = 'Red',
  warn = 'Orange', warning = 'Orange',
  ok = 'Green', success = 'Green',
  info = 'Blue', tip = 'Blue',
  note = 'Purple', important = 'Purple',
  muted = 'Gray',
}

local PALETTE = {
  dark = {
    Red    = { fg = '#ff7b72', bg = '#3d1614' },
    Orange = { fg = '#ffa657', bg = '#3b2410' },
    Yellow = { fg = '#e3b341', bg = '#362b0a' },
    Green  = { fg = '#3fb950', bg = '#0f2e1c' },
    Blue   = { fg = '#58a6ff', bg = '#0f2444' },
    Purple = { fg = '#d2a8ff', bg = '#2a1b45' },
    Gray   = { fg = '#8b949e', bg = '#21262d' },
  },
  light = {
    Red    = { fg = '#b42318', bg = '#fde8e7' },
    Orange = { fg = '#b54708', bg = '#fdeedc' },
    Yellow = { fg = '#7a5a00', bg = '#fdf6d3' },
    Green  = { fg = '#067647', bg = '#dcf5e7' },
    Blue   = { fg = '#175cd3', bg = '#e0ecfd' },
    Purple = { fg = '#6941c6', bg = '#efe7fd' },
    Gray   = { fg = '#57606a', bg = '#eef0f2' },
  },
}

function M.setup_highlights()
  local mode = vim.o.background == 'light' and 'light' or 'dark'
  local p = PALETTE[mode]
  for name, c in pairs(p) do
    vim.api.nvim_set_hl(0, 'Hue' .. name, { fg = c.fg, bold = true })
    vim.api.nvim_set_hl(0, 'HueBg' .. name, { fg = c.fg, bg = c.bg })
  end
end

function M.highlight_buf(bufnr)
  bufnr = bufnr or vim.api.nvim_get_current_buf()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)

  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local box_color = nil

  for i, line in ipairs(lines) do
    local row = i - 1

    -- Top or bottom box border: +-- info Title or +--
    local border_rest = line:match('^[%+┌╭][%-─]+%s*(.*)$')
    if border_rest then
      local first_word = border_rest:match('^(%S+)')
      if first_word and COLORS[first_word] then
        box_color = COLORS[first_word]
      elseif border_rest == '' then
        -- closing border
      else
        box_color = 'Gray'
      end
      local hl = 'Hue' .. (box_color or 'Gray')
      vim.api.nvim_buf_set_extmark(bufnr, ns, row, 0, {
        end_col = #line,
        hl_group = hl,
      })
      if border_rest == '' then box_color = nil end
    elseif box_color and line:match('^[|│]') then
      vim.api.nvim_buf_set_extmark(bufnr, ns, row, 0, {
        end_col = 1,
        hl_group = 'Hue' .. box_color,
      })
    else
      box_color = nil
    end

    -- Inline spans: {ok: passing}, {bg-yellow: text}
    local init = 1
    while true do
      local s, e, spec = line:find('{([!%w_%-#%s]+):%s*[^{}]+}', init)
      if not s then break end
      local first = spec:match('^(%S+)')
      local hl = nil
      if first then
        if first:sub(1, 3) == 'bg-' then
          local c = COLORS[first:sub(4)]
          if c then hl = 'HueBg' .. c end
        elseif COLORS[first] then
          hl = 'Hue' .. COLORS[first]
        end
      end
      if hl then
        vim.api.nvim_buf_set_extmark(bufnr, ns, row, s - 1, {
          end_col = e,
          hl_group = hl,
        })
      end
      init = e + 1
    end
  end
end

function M.insert_box(kind)
  kind = (kind and kind ~= '') and kind or 'info'
  local titles = {
    info = 'Pro Tip',
    ok = 'Success',
    note = 'Important Detail',
    warn = 'Heads Up',
    ['!'] = 'Critical Warning',
    danger = 'Critical Warning',
  }
  local title = titles[kind] or 'Note'
  local row = vim.api.nvim_win_get_cursor(0)[1]
  local box_lines = {
    string.format('+-- %s %s', kind, title),
    '| First point',
    '| Second point',
    '+--',
  }
  vim.api.nvim_buf_set_lines(0, row, row, false, box_lines)
  vim.api.nvim_win_set_cursor(0, { row + 2, 13 })
  M.highlight_buf(0)
end

function M.setup()
  M.setup_highlights()

  vim.filetype.add({
    extension = {
      ['hue.md'] = 'markdown',
    },
    pattern = {
      ['.*%.hue%.md'] = 'markdown',
    },
  })

  local augroup = vim.api.nvim_create_augroup('HueMd', { clear = true })

  vim.api.nvim_create_autocmd('ColorScheme', {
    group = augroup,
    callback = function() M.setup_highlights() end,
  })

  vim.api.nvim_create_autocmd({ 'BufEnter', 'TextChanged', 'TextChangedI' }, {
    group = augroup,
    pattern = { '*.md', '*.hue.md' },
    callback = function(ev)
      M.highlight_buf(ev.buf)
    end,
  })

  vim.api.nvim_create_autocmd('FileType', {
    group = augroup,
    pattern = 'markdown',
    callback = function(ev)
      -- Auto-continue `| ` on Enter inside a Hue box
      vim.keymap.set('i', '<CR>', function()
        local line = vim.api.nvim_get_current_line()
        if line:match('^|%s*$') then
          return '<Esc>0"_D+--<CR>'
        elseif line:match('^|%s+') then
          return '<CR>| '
        elseif line:match('^%+--%s+%S+') then
          return '<CR>| '
        end
        return '<CR>'
      end, { buffer = ev.buf, expr = true, silent = true })
    end,
  })

  vim.api.nvim_create_user_command('HueBox', function(opts)
    M.insert_box(opts.args)
  end, {
    nargs = '?',
    complete = function()
      return { 'info', 'ok', 'note', 'warn', '!' }
    end,
  })
end

return M
