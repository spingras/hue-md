-- Hue MD parsing for Neovim highlights: the rules of src/core.js and the
-- markdown-it plugin (src/index.js) in Lua, without any Neovim API, so it can
-- be tested outside Neovim. test/nvim.test.js at the repo root checks the
-- palette, key names and edge cases against the JavaScript implementation.
--
-- P.scan(lines) returns a list of marks:
--   { row = 0-based line, col = 0-based start byte, end_col = end byte (exclusive),
--     group = highlight group name, or style = span style for init.lua to resolve,
--     priority = number }
-- Columns are byte offsets, as nvim_buf_set_extmark wants them.

local P = {}

-- Generated from src/palette.js (the test fails when they differ).
P.PALETTE = {
  red    = { light = { fg = '#b42318', bg = '#fde8e7' }, dark = { fg = '#ff7b72', bg = '#3d1614' } },
  orange = { light = { fg = '#b54708', bg = '#fdeedc' }, dark = { fg = '#ffa657', bg = '#3b2410' } },
  yellow = { light = { fg = '#7a5a00', bg = '#fdf6d3' }, dark = { fg = '#e3b341', bg = '#362b0a' } },
  green  = { light = { fg = '#067647', bg = '#dcf5e7' }, dark = { fg = '#3fb950', bg = '#0f2e1c' } },
  blue   = { light = { fg = '#175cd3', bg = '#e0ecfd' }, dark = { fg = '#58a6ff', bg = '#0f2444' } },
  purple = { light = { fg = '#6941c6', bg = '#efe7fd' }, dark = { fg = '#d2a8ff', bg = '#2a1b45' } },
  gray   = { light = { fg = '#57606a', bg = '#eef0f2' }, dark = { fg = '#8b949e', bg = '#21262d' } },
}
P.COLOR_NAMES = { 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray' }
P.SEMANTIC = { danger = 'red', ['!'] = 'red', warn = 'orange', ok = 'green', info = 'blue', note = 'purple', muted = 'gray' }

-- Task markers: state name and palette color (src/core.js TASK_STATES).
P.TASKS = {
  [' '] = { name = 'todo', color = 'gray' },
  ['-'] = { name = 'progress', color = 'blue' },
  ['!'] = { name = 'blocked', color = 'red' },
  ['?'] = { name = 'question', color = 'purple' },
  x = { name = 'done', color = 'green' },
  X = { name = 'done', color = 'green' },
}

local function set (list)
  local s = {}
  for _, v in ipairs(list) do s[v] = true end
  return s
end

P.KEY_NAMES = set({
  'ctrl', 'control', 'shift', 'alt', 'option', 'opt', 'cmd', 'command', 'super', 'meta', 'win', 'fn',
  'enter', 'return', 'esc', 'escape', 'tab', 'space', 'spacebar', 'backspace', 'bksp', 'delete', 'del', 'insert', 'ins',
  'up', 'down', 'left', 'right', 'home', 'end', 'pgup', 'pageup', 'pgdn', 'pagedown',
  'capslock', 'caps', 'numlock', 'scrolllock', 'prtsc', 'printscreen', 'pause', 'break', 'menu', 'clear',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24',
  'plus', 'minus', 'slash', 'backslash', 'comma', 'period', 'dot', 'semicolon', 'quote', 'backtick', 'tilde',
})
P.KEY_SYMBOLS = set({ '⌘', '⌥', '⇧', '⌃', '⏎', '⌫', '⇥', '⎋', '↑', '↓', '←', '→', '/', '?', '+', '-', '=', '~', '`', '[', ']', '\\', ';', "'", ',', '.', '*', '<', '>' })

local MAX_SPEC_LEN = 64

-- ---------------------------------------------------------------- helpers

local function starts_with (s, prefix, i)
  return s:sub(i, i + #prefix - 1) == prefix
end

local function match_any (s, i, list)
  for _, p in ipairs(list) do
    if starts_with(s, p, i) then return p end
  end
  return nil
end

-- Byte length of the UTF-8 character starting at byte i.
local function char_len (s, i)
  local b = s:byte(i)
  if not b then return 0 end
  if b < 0x80 then return 1 elseif b < 0xE0 then return 2 elseif b < 0xF0 then return 3 end
  return 4
end

local function utf8_len (s)
  local n = 0
  for i = 1, #s do
    local b = s:byte(i)
    if b < 0x80 or b >= 0xC0 then n = n + 1 end
  end
  return n
end

local function trim (s)
  return (s:gsub('^%s+', ''):gsub('%s+$', ''))
end

local function is_space (c)
  return c == ' ' or c == '\t'
end

-- ---------------------------------------------------------------- styles

function P.resolve_color (name)
  if P.PALETTE[name] then return name end
  return P.SEMANTIC[name]
end

local function is_hex (v)
  return v:match('^#%x%x%x$') ~= nil or v:match('^#%x%x%x%x%x%x$') ~= nil
end

local function apply_word (out, w, allow_hex)
  local bg = w:sub(1, 3) == 'bg-'
  local v = bg and w:sub(4) or w
  if is_hex(v) then
    if not allow_hex then return false end
    if bg then out.bgHex = v; out.bg = nil else out.fgHex = v; out.fg = nil end
    return true
  end
  local c = P.resolve_color(v)
  if not c then return false end
  if bg then out.bg = c; out.bgHex = nil else out.fg = c; out.fgHex = nil end
  return true
end

-- "red bg-yellow" -> { fg = 'red', bg = 'yellow' }; nil unless every word is a Hue token.
function P.parse_spec (spec)
  local out = {}
  local n = 0
  for w in spec:gmatch('%S+') do
    n = n + 1
    if not apply_word(out, w, true) then return nil end
  end
  if n == 0 then return nil end
  return out
end

-- ---------------------------------------------------------------- key caps

function P.is_valid_keycap (raw)
  if raw == '' or utf8_len(raw) > 32 or raw:find('[\n\r\t]') then return false end
  if raw ~= trim(raw) then return false end

  if not raw:find('+', 1, true) or raw == '+' then
    if P.KEY_NAMES[raw:lower()] or P.KEY_SYMBOLS[raw] then return true end
    return raw:match('^[A-Z]$') ~= nil
  end

  local parts, cur = {}, ''
  for i = 1, #raw do
    local ch = raw:sub(i, i)
    if ch == '+' then
      if cur == '' and i > 1 and raw:sub(i - 1, i - 1) == '+' then
        cur = '+'
      elseif cur ~= '' then
        parts[#parts + 1] = cur
        cur = ''
      else
        return false
      end
    else
      cur = cur .. ch
    end
  end
  if cur ~= '' then parts[#parts + 1] = cur end
  if #parts < 2 then return false end
  for _, p in ipairs(parts) do
    if not (P.KEY_NAMES[p:lower()] or P.KEY_SYMBOLS[p] or p:match('^[A-Za-z0-9]$')) then return false end
  end
  return true
end

-- ---------------------------------------------------------------- progress bars

local FILLED = set({ '=', '#', '■', '█' })
local EMPTY = set({ '.', '-', '_', '░', ' ' })
local EMPTY_MARK = set({ '.', '-', '_', '░' })

function P.progress_color (pct)
  if pct >= 100 then return 'green' elseif pct >= 50 then return 'blue' elseif pct >= 25 then return 'orange' end
  return 'red'
end

-- `[======....] 60%` at byte i (s:sub(i, i) == '['), within s:sub(1, max).
-- Returns { fill_end, bar_end, end_pos, pct, color } with byte positions, or nil.
function P.match_progress (s, i, max)
  if s:sub(i, i) ~= '[' then return nil end
  if i > 1 and s:sub(i - 1, i - 1) == '[' then return nil end
  local j = i + 1
  local filled, empty, marks = 0, 0, false
  while j <= max and filled <= 40 do
    local n = char_len(s, j)
    if not FILLED[s:sub(j, j + n - 1)] then break end
    filled = filled + 1
    j = j + n
  end
  local fill_end = j
  while j <= max and empty <= 40 do
    local n = char_len(s, j)
    local c = s:sub(j, j + n - 1)
    if not EMPTY[c] then break end
    if EMPTY_MARK[c] then marks = true end
    empty = empty + 1
    j = j + n
  end
  if filled > 40 or empty > 40 then return nil end
  if s:sub(j, j) ~= ']' then return nil end
  local bar_end = j + 1
  j = bar_end
  while j <= max and s:sub(j, j):match('%s') do j = j + 1 end
  local digits = s:sub(j, max):match('^(%d%d?%d?)%%')
  if not digits then return nil end
  local total = filled + empty
  if total < 4 or total > 40 then return nil end
  if filled == 0 and not marks then return nil end
  local pct = tonumber(digits)
  if pct > 100 then return nil end
  local end_pos = j + #digits + 1
  local nxt = s:sub(end_pos, end_pos)
  if end_pos <= max and (nxt == '(' or nxt == '[') then return nil end
  return { fill_end = fill_end, bar_end = bar_end, pct_start = j, end_pos = end_pos, pct = pct, color = P.progress_color(pct) }
end

-- ---------------------------------------------------------------- boxes

local TOP_LEFT = { '┌', '╭', '+' }
local DASH = { '─', '-' }
local RIGHT = { '┐', '╮', '┘', '╯', '+' }

local function skip_dashes (s, i)
  local n = 0
  while true do
    local d = match_any(s, i, DASH)
    if not d then break end
    i = i + #d
    n = n + 1
  end
  return i, n
end

-- "─ blue Deploy notes ───" -> style, title (boxes take palette tokens only)
local function parse_label (raw)
  local label = raw
  while true do
    local d = match_any(label, 1, DASH)
    if d then label = label:sub(#d + 1)
    elseif is_space(label:sub(1, 1)) then label = label:sub(2)
    else break end
  end
  while #label > 0 do
    if label:sub(-3) == '─' then label = label:sub(1, -4)
    elseif label:sub(-1) == '-' or is_space(label:sub(-1)) then label = label:sub(1, -2)
    else break end
  end
  local words = {}
  for w in label:gmatch('%S+') do words[#words + 1] = w end
  local style = {}
  local i = 1
  while i <= #words and apply_word(style, words[i], false) do i = i + 1 end
  local title = {}
  for k = i, #words do title[#title + 1] = words[k] end
  return style, table.concat(title, ' ')
end

-- Top border (without indentation) -> { style, title, color } or nil.
function P.parse_top (line)
  local left = match_any(line, 1, TOP_LEFT)
  if not left then return nil end
  local i, n = skip_dashes(line, 1 + #left)
  if n == 0 then return nil end
  local dashes = line:sub(1 + #left, i - 1)
  local rest = line:sub(i):gsub('%s+$', '')

  local right, body = nil, rest
  if rest ~= '' then
    local only = match_any(rest, 1, RIGHT)
    if only and #only == #rest then
      right, body = rest, ''
    else
      for _, c in ipairs(RIGHT) do
        if #rest > #c and rest:sub(-#c) == c then
          local before = rest:sub(1, -#c - 1)
          if before:sub(-3) == '─' then
            right, body = c, before:sub(1, -4)
          elseif before:sub(-1) == '-' or before:sub(-1):match('%s') then
            right, body = c, before:sub(1, -2)
          end
          if right then break end
        end
      end
    end
  end
  if right then
    if right == '┘' or right == '╯' then return nil end
    if (left == '+') ~= (right == '+') then return nil end
  end

  local style, title = parse_label(dashes .. ' ' .. body)
  return { style = style, title = title, color = style.fg or style.bg or 'gray' }
end

function P.is_bottom (t)
  local l = match_any(t, 1, { '└', '╰', '+' })
  if not l then return false end
  local i, n = skip_dashes(t, 1 + #l)
  if n == 0 then return false end
  if l == '+' then
    if t:sub(i, i) == '+' then i = i + 1 end
  else
    local r = match_any(t, i, { '┘', '╯' })
    if r then i = i + #r end
  end
  return t:sub(i):match('^%s*$') ~= nil
end

function P.is_side (t)
  return t:sub(1, 1) == '|' or starts_with(t, '│', 1)
end

-- Byte positions (1-based) where split box columns start on a top line.
function P.column_starts (line)
  local starts = { 1 }
  local i = 1
  while i <= #line do
    if is_space(line:sub(i, i)) then
      local j = i
      while j <= #line and is_space(line:sub(j, j)) do j = j + 1 end
      if j - i >= 2 then
        local l = match_any(line, j, TOP_LEFT)
        if l and match_any(line, j + #l, DASH) then starts[#starts + 1] = j end
      end
      i = j
    else
      i = i + 1
    end
  end
  return starts
end

-- ---------------------------------------------------------------- inline

-- Code spans and brace pairs in s:sub(from, to), as in matchBraces (src/index.js).
local function scan_braces (s, from, to)
  local match, code = {}, {}
  local runs = {}
  local i = from
  while i <= to do
    local c = s:sub(i, i)
    if c == '\\' then
      i = i + 2
    elseif c == '`' then
      local j = i
      while j <= to and s:sub(j, j) == '`' do j = j + 1 end
      runs[#runs + 1] = { at = i, len = j - i }
      i = j
    else
      i = i + 1
    end
  end
  local stack = {}
  i = from
  local r = 1
  while i <= to do
    local c = s:sub(i, i)
    if c == '\\' then
      i = i + 2
    elseif c == '`' then
      while runs[r] and runs[r].at < i do r = r + 1 end
      local run = runs[r]
      local close = nil
      for k = r + 1, #runs do
        if runs[k].len == run.len then close = runs[k]; break end
      end
      if close then
        code[i] = close.at + close.len
        i = close.at + close.len
      else
        i = i + run.len
      end
    else
      if c == '{' then stack[#stack + 1] = i
      elseif c == '}' and #stack > 0 then match[stack[#stack]] = i; stack[#stack] = nil end
      i = i + 1
    end
  end
  return match, code
end

local function add (marks, row, col0, from, to, mark)
  if to <= from then return end
  mark.row = row
  mark.col = col0 + from - 1
  mark.end_col = col0 + to - 1
  marks[#marks + 1] = mark
end

-- Inline Hue in s:sub(from, to). col0: buffer column of s's first byte.
local function scan_inline (s, from, to, row, col0, marks, depth, braces, code)
  if not braces then braces, code = scan_braces(s, from, to) end
  local prio = 120 + depth * 10
  local i = from
  while i <= to do
    local c = s:sub(i, i)
    if code[i] then
      i = code[i]
    elseif c == '\\' then
      i = i + 2
    elseif c == '{' then
      local done = false
      local close = braces[i]
      local limit = math.min(to, i + 1 + MAX_SPEC_LEN)
      local colon = s:find(':', i + 1, true)
      if close and colon and colon <= limit and colon < close then
        local spec = s:sub(i + 1, colon - 1)
        if not spec:find('[{}\n]') then
          local start = colon + 1
          while start <= to and s:sub(start, start) == ' ' do start = start + 1 end
          local t = trim(spec)
          local mark = nil
          if t == '+' then mark = { group = 'HueDiffAdd' }
          elseif t == '-' then mark = { group = 'HueDiffDel' }
          else
            local style = P.parse_spec(spec)
            if style then mark = { style = style } end
          end
          if mark and close > start then
            mark.priority = prio
            add(marks, row, col0, start, close, mark)
            add(marks, row, col0, i, start, { group = 'HueMarkup', priority = prio + 5 })
            add(marks, row, col0, close, close + 1, { group = 'HueMarkup', priority = prio + 5 })
            scan_inline(s, start, close - 1, row, col0, marks, depth + 1, braces, code)
            i = close + 1
            done = true
          end
        end
      end
      if not done then i = i + 1 end
    elseif c == '[' then
      local hit = P.match_progress(s, i, to)
      if hit then
        local color = hit.color:sub(1, 1):upper() .. hit.color:sub(2)
        add(marks, row, col0, i, i + 1, { group = 'HueMarkup', priority = prio })
        add(marks, row, col0, i + 1, hit.fill_end, { group = 'HueProgress' .. color, priority = prio })
        add(marks, row, col0, hit.fill_end, hit.bar_end - 1, { group = 'HueProgressEmpty', priority = prio })
        add(marks, row, col0, hit.bar_end - 1, hit.bar_end, { group = 'HueMarkup', priority = prio })
        add(marks, row, col0, hit.pct_start, hit.end_pos, { group = 'Hue' .. color, priority = prio })
        i = hit.end_pos
      else
        local kbd_end = nil
        local prev = i > 1 and s:sub(i - 1, i - 1) or ''
        if s:sub(i + 1, i + 1) == '[' and not prev:match('[%[%]A-Za-z0-9]') then
          local close = s:find(']]', i + 2, true)
          if close and close <= to - 1 and utf8_len(s:sub(i + 2, close - 1)) <= 32 then
            local key = s:sub(i + 2, close - 1)
            local after = s:sub(close + 2, close + 2)
            if not key:find('[%[\n]') and after ~= ']' and after ~= '(' and P.is_valid_keycap(key) then
              kbd_end = close + 2
            end
          end
        end
        if kbd_end then
          add(marks, row, col0, i, kbd_end, { group = 'HueKbd', priority = prio })
          i = kbd_end
        else
          i = i + 1
        end
      end
    else
      i = i + 1
    end
  end
end

-- `- [-] text`: colors the task marker.
local function scan_task (s, row, col0, marks)
  local lead = s:match('^%s*[-*+]%s+') or s:match('^%s*%d+[.)]%s+')
  if not lead then return end
  local marker = s:sub(#lead + 1, #lead + 3)
  local state = marker:sub(2, 2)
  if marker:sub(1, 1) ~= '[' or marker:sub(3, 3) ~= ']' or not P.TASKS[state] then return end
  if not s:sub(#lead + 4, #lead + 4):match('%s') then return end
  local info = P.TASKS[state]
  local name = info.name:sub(1, 1):upper() .. info.name:sub(2)
  add(marks, row, col0, #lead + 1, #lead + 4, { group = 'HueTask' .. name, priority = 130 })
end

local function cap (c)
  return c:sub(1, 1):upper() .. c:sub(2)
end

-- ---------------------------------------------------------------- blocks

local scan_blocks

local function fence_open (t)
  local ind, ticks, info = t:match('^( *)(```+)(.*)$')
  if not ticks then ind, ticks, info = t:match('^( *)(~~~+)(.*)$') end
  if not ticks or #ind > 3 then return nil end
  if ticks:sub(1, 1) == '`' and info:find('`', 1, true) then return nil end
  return { char = ticks:sub(1, 1), len = #ticks, info = trim(info):match('^(%S*)') }
end

local function fence_closes (t, f)
  local ind, ticks = t:match('^( *)(' .. (f.char == '`' and '`' or '~') .. '+)%s*$')
  return ticks and #ind <= 3 and #ticks >= f.len
end

-- One box's top line marks: border in the box color, title bold.
local function mark_top (marks, row, col0, seg, top)
  local color = cap(top.color)
  add(marks, row, col0, 1, #seg + 1, { group = 'HueBox' .. color, priority = 110 })
  if top.title ~= '' then
    local at = seg:find(top.title, 1, true)
    if at then add(marks, row, col0, at, at + #top.title, { group = 'HueBoxTitle' .. color, priority = 115 }) end
  end
end

-- A box's interior line: the side bar in the box color; returns the content
-- (after the bar and one space) and its buffer column.
local function side_content (marks, row, col0, seg, color)
  local bar = seg:sub(1, 1) == '|' and 1 or 3
  add(marks, row, col0, 1, bar + 1, { group = 'HueBox' .. cap(color), priority = 110 })
  local start = bar + 1
  if seg:sub(start, start) == ' ' then start = start + 1 end
  return seg:sub(start), col0 + start - 1
end

-- Split boxes starting at items[i]; returns the index after them, or nil.
local function try_split (items, i, marks, depth)
  local it = items[i]
  local indent = #it.text:match('^ *')
  if indent > 3 then return nil end
  local first = it.text:sub(indent + 1)
  local starts = P.column_starts(first)
  if #starts < 2 then return nil end
  local cols = {}
  for k = 1, #starts do
    local seg = first:sub(starts[k], (starts[k + 1] or (#first + 1)) - 1):gsub('%s+$', '')
    local top = P.parse_top(seg)
    if not top then return nil end
    cols[k] = { top = top, inner = {}, closed = false, seg = seg }
  end
  local rows = {}
  local last = nil
  for j = i + 1, #items do
    local text = items[j].text:sub(math.min(indent, #items[j].text) + 1)
    local line = {}
    for k = 1, #starts do
      local a = starts[k]
      local b = starts[k + 1] and (starts[k + 1] - 1) or #text
      local seg = text:sub(a, b):gsub('%s+$', '')
      local col = cols[k]
      if col.closed then
        if trim(seg) ~= '' then return nil end
      elseif P.is_bottom(seg) then
        col.closed = true
        line[k] = { kind = 'bottom', seg = seg, a = a }
      elseif P.is_side(seg) then
        line[k] = { kind = 'side', seg = seg, a = a }
      else
        return nil
      end
    end
    rows[#rows + 1] = { item = items[j], indent = math.min(indent, #items[j].text), parts = line }
    local all = true
    for _, col in ipairs(cols) do if not col.closed then all = false end end
    if all then last = j; break end
  end
  if not last then return nil end

  for k, col in ipairs(cols) do
    mark_top(marks, it.row, it.col + indent + starts[k] - 1, col.seg, col.top)
  end
  for _, r in ipairs(rows) do
    for k, part in pairs(r.parts) do
      local col0 = r.item.col + r.indent + part.a - 1
      if part.kind == 'bottom' then
        add(marks, r.item.row, col0, 1, #part.seg + 1, { group = 'HueBox' .. cap(cols[k].top.color), priority = 110 })
      else
        local text, ccol = side_content(marks, r.item.row, col0, part.seg, cols[k].top.color)
        cols[k].inner[#cols[k].inner + 1] = { text = text, row = r.item.row, col = ccol }
      end
    end
  end
  for _, col in ipairs(cols) do scan_blocks(col.inner, marks, depth + 1) end
  return last + 1
end

-- A single box starting at items[i]; returns the index after it, or nil.
local function try_box (items, i, marks, depth)
  local it = items[i]
  local indent = #it.text:match('^ *')
  if indent > 3 then return nil end
  local top = P.parse_top(it.text:sub(indent + 1))
  if not top then return nil end
  local last = nil
  for j = i + 1, #items do
    local t = items[j].text
    local lead = #t:match('^%s*')
    local s = t:sub(lead + 1)
    if P.is_bottom(s) then last = j; break end
    if not P.is_side(s) then return nil end
  end
  if not last then return nil end

  mark_top(marks, it.row, it.col + indent, it.text:sub(indent + 1):gsub('%s+$', ''), top)
  local inner = {}
  for j = i + 1, last - 1 do
    local t = items[j].text
    local lead = #t:match('^%s*')
    local text, ccol = side_content(marks, items[j].row, items[j].col + lead, t:sub(lead + 1), top.color)
    inner[#inner + 1] = { text = text, row = items[j].row, col = ccol }
  end
  local t = items[last].text
  local lead = #t:match('^%s*')
  add(marks, items[last].row, items[last].col + lead, 1, #t - lead + 1, { group = 'HueBox' .. cap(top.color), priority = 110 })
  scan_blocks(inner, marks, depth + 1)
  return last + 1
end

-- items: { text, row, col } lines; boxes recurse into their content.
scan_blocks = function (items, marks, depth)
  local i = 1
  while i <= #items do
    local it = items[i]
    local f = fence_open(it.text)
    if f then
      local close = #items + 1
      for j = i + 1, #items do
        if fence_closes(items[j].text, f) then close = j; break end
      end
      if f.info == 'hue' then
        local inner = {}
        for j = i + 1, close - 1 do inner[#inner + 1] = items[j] end
        scan_blocks(inner, marks, depth + 1)
      end
      i = close + 1
    else
      local nxt = try_split(items, i, marks, depth) or try_box(items, i, marks, depth)
      if nxt then
        i = nxt
      else
        scan_task(it.text, it.row, it.col, marks)
        scan_inline(it.text, 1, #it.text, it.row, it.col, marks, depth)
        i = i + 1
      end
    end
  end
end

function P.scan (lines)
  local items = {}
  for n, line in ipairs(lines) do items[n] = { text = line, row = n - 1, col = 0 } end
  local marks = {}
  scan_blocks(items, marks, 0)
  return marks
end

return P
