// Runs the Neovim plugin's Lua under fengari (a Lua 5.3 VM in JavaScript):
//   - lua/hue-md/parse.lua on demo/demo.hue.md, checking which text gets which
//     highlight group, and its palette, key names and rules against src/*.js
//   - lua/hue-md/init.lua with a stand-in `vim` API, checking setup() defines
//     the highlight groups for light and dark and highlight_buf() sets extmarks.
// Neovim itself runs LuaJIT (Lua 5.1); the plugin sticks to what both have.
// The manual check in packages/nvim-hue/README.md covers real Neovim.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { COLORS } from '../../../src/palette.js'
import { KEY_NAMES, KEY_SYMBOLS, isValidKeycap, matchProgressBar, parseSpec } from '../../../src/core.js'

const require = createRequire(import.meta.url)
const { lua, lauxlib, lualib, to_luastring: toLua } = require('fengari')

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(pkgDir, '..', '..')
const demo = fs.readFileSync(path.join(repoDir, 'demo', 'demo.hue.md'), 'utf8')
const parseLua = fs.readFileSync(path.join(pkgDir, 'lua', 'hue-md', 'parse.lua'), 'utf8')
const initLua = fs.readFileSync(path.join(pkgDir, 'lua', 'hue-md', 'init.lua'), 'utf8')

// Lua values -> JSON, so results come back to JavaScript.
const JSON_LUA = `
local function enc (v)
  local t = type(v)
  if t == 'nil' then return 'null' end
  if t == 'boolean' or t == 'number' then return tostring(v) end
  if t == 'string' then
    return '"' .. v:gsub('[%c"\\\\]', function (c) return string.format('\\\\u%04x', c:byte()) end) .. '"'
  end
  if t == 'function' then return '"<function>"' end
  local n = #v
  local keys = 0
  for _ in pairs(v) do keys = keys + 1 end
  if n > 0 and keys == n then
    local out = {}
    for i = 1, n do out[i] = enc(v[i]) end
    return '[' .. table.concat(out, ',') .. ']'
  end
  local out = {}
  for k, x in pairs(v) do out[#out + 1] = enc(tostring(k)) .. ':' .. enc(x) end
  return '{' .. table.concat(out, ',') .. '}'
end
`

// A long Lua string literal that the text cannot close.
function luaString (s) {
  let eq = ''
  while (s.includes(']' + eq + ']')) eq += '='
  return `[${eq}[\n${s}]${eq}]`
}

// Runs `body` (Lua, ending in `return value`) with parse.lua loaded as `P`.
function runLua (body, { prelude = '' } = {}) {
  const L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)
  const code = `${JSON_LUA}
package.preload['hue-md.parse'] = function () ${parseLua.replace(/^return P\s*$/m, 'return P')} end
local P = require('hue-md.parse')
${prelude}
local function main () ${body} end
return enc(main())`
  if (lauxlib.luaL_loadstring(L, toLua(code)) !== lua.LUA_OK || lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
    throw new Error(lua.lua_tojsstring(L, -1))
  }
  return JSON.parse(lua.lua_tojsstring(L, -1))
}

const lines = demo.replace(/\n$/, '').split('\n')
const linesLua = `local text = ${luaString(demo.replace(/\n$/, ''))}
local lines = {}
for l in (text .. '\\n'):gmatch('(.-)\\n') do lines[#lines + 1] = l end`

// [{ row, col, end_col, group | style }] with the marked text added (byte offsets -> text).
function scanDemo () {
  const marks = runLua(`${linesLua}\nreturn P.scan(lines)`)
  return marks.map((m) => ({ ...m, text: Buffer.from(lines[m.row], 'utf8').subarray(m.col, m.end_col).toString('utf8') }))
}

const find = (marks, group, text) => marks.find((m) => m.group === group && (text === undefined || m.text === text))

test('palette, key names and task states match src/palette.js and src/core.js', () => {
  const lua = runLua('return { palette = P.PALETTE, names = P.COLOR_NAMES, keys = P.KEY_NAMES, symbols = P.KEY_SYMBOLS }')
  assert.deepEqual(lua.palette, COLORS)
  assert.deepEqual(lua.names, Object.keys(COLORS))
  assert.deepEqual(Object.keys(lua.keys).sort(), [...KEY_NAMES].sort())
  assert.deepEqual(Object.keys(lua.symbols).sort(), [...KEY_SYMBOLS].sort())
})

test('key caps, progress bars and style specs follow the JavaScript rules', () => {
  const keys = ['Ctrl', 'ctrl+c', 'Ctrl+Shift+V', 'Esc', 'A', 'a', 'Ctrl++', '+', '⌘+K', 'Note', 'Ctrl+', '+C', ' Esc', 'F12', 'Cmd+Option+Esc', 'x+y', 'Shift+Tab']
  const bars = ['[========..] 80%', '[==========] 100%', '[....] 0%', '[    ] 0%', '[==] 50%', '[===.] 101%', '[####____] 50%', '[■■■░░░] 50%', '[====] 40%(x)', '[=====.....]50%']
  const specs = ['ok', 'red bg-yellow', '!', '#c0ffee bg-#333333', 'a', 'blue bg-gray', 'bg-#fff', 'ok warn', 'key', '']
  const lua = runLua(`
    local keys, bars, specs = ${JSON.stringify(keys).replace(/^\[/, '{').replace(/\]$/, '}')}, ${JSON.stringify(bars).replace(/^\[/, '{').replace(/\]$/, '}')}, ${JSON.stringify(specs).replace(/^\[/, '{').replace(/\]$/, '}')}
    local k, b, s = {}, {}, {}
    for i, v in ipairs(keys) do k[i] = P.is_valid_keycap(v) end
    for i, v in ipairs(bars) do local h = P.match_progress(v, 1, #v); b[i] = h and (h.pct .. ' ' .. h.color) or false end
    for i, v in ipairs(specs) do s[i] = P.parse_spec(v) or false end
    return { keys = k, bars = b, specs = s }`)
  assert.deepEqual(lua.keys, keys.map(isValidKeycap))
  assert.deepEqual(lua.bars, bars.map((b) => { const h = matchProgressBar(b, 0, b.length); return h ? `${h.pct} ${h.color}` : false }))
  const clean = (o) => (o ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) : false)
  assert.deepEqual(lua.specs, specs.map((s) => clean(parseSpec(s))))
})

test('demo: colored spans, hex spans and diff spans', () => {
  const marks = scanDemo()
  const span = (text) => marks.find((m) => m.style && m.text === text)
  assert.deepEqual(span('passing').style, { fg: 'green' })
  assert.deepEqual(span('71%').style, { fg: 'orange' })
  assert.deepEqual(span('blocked').style, { fg: 'red' })
  assert.deepEqual(span('key phrases').style, { bg: 'yellow' })
  assert.deepEqual(span('text and background').style, { fg: 'blue', bg: 'gray' })
  assert.deepEqual(span('hex color').style, { fgHex: '#c0ffee', bgHex: '#333333' })
  assert.ok(find(marks, 'HueMarkup', '{ok: '), 'span markup dimmed')
  assert.ok(!marks.some((m) => m.text === '1' || m.text === 'value'), '{a: 1} and {key: value} stay plain')
  assert.ok(find(marks, 'HueDiffAdd', 'added key caps and progress bars'))
  assert.ok(find(marks, 'HueDiffDel', 'removed the old md-hue package'))
  assert.ok(find(marks, 'HueDiffAdd', 'in progress'))
})

test('demo: boxes, titles and side bars in the box color; spans inside boxes', () => {
  const marks = scanDemo()
  for (const [color, title] of [['Blue', 'Effortless Boxes'], ['Green', 'Full Markdown Inside'], ['Purple', 'GitHub Ready'], ['Orange', 'Heads Up'], ['Red', 'Never Commit Secrets']]) {
    assert.ok(find(marks, 'HueBoxTitle' + color, title), title)
    const top = lines.findIndex((l) => l.includes(title))
    assert.equal(find(marks, 'HueBox' + color, lines[top]).row, top)
  }
  const blueSides = marks.filter((m) => m.group === 'HueBoxBlue' && m.text === '|')
  assert.equal(blueSides.length, 3)
  assert.ok(find(marks, 'HueBoxBlue', '+--'), 'bottom border')
  assert.ok(marks.find((m) => m.style && m.style.fg === 'red' && m.text === 'immediately'), 'span inside a box')
  assert.ok(!marks.some((m) => m.text === '+-- info' || (m.group && m.group.startsWith('HueBox') && m.text.includes('`+--`'))), 'inline code is not a box')
})

test('demo: split boxes color each column', () => {
  const marks = scanDemo()
  const top = lines.findIndex((l) => l.startsWith('+-- ok Do this'))
  assert.ok(find(marks, 'HueBoxTitleGreen', 'Do this'))
  assert.ok(find(marks, 'HueBoxTitleOrange', 'Avoid this'))
  const sides = (row) => marks.filter((m) => m.row === row && m.text === '|').map((m) => m.group)
  assert.deepEqual(sides(top + 1), ['HueBoxGreen', 'HueBoxOrange'])
  assert.deepEqual(sides(top + 2), ['HueBoxGreen', 'HueBoxOrange'])
  const bottoms = marks.filter((m) => m.row === top + 3 && m.text === '+--').map((m) => m.group)
  assert.deepEqual(bottoms, ['HueBoxGreen', 'HueBoxOrange'])
})

test('demo: task markers, key caps and progress bars', () => {
  const marks = scanDemo()
  assert.ok(find(marks, 'HueTaskDone', '[x]'))
  assert.ok(find(marks, 'HueTaskProgress', '[-]'))
  assert.ok(find(marks, 'HueTaskBlocked', '[!]'))
  assert.ok(find(marks, 'HueTaskQuestion', '[?]'))
  assert.ok(find(marks, 'HueTaskTodo', '[ ]'))
  assert.ok(find(marks, 'HueKbd', '[[Ctrl+Shift+V]]'))
  assert.ok(find(marks, 'HueKbd', '[[Esc]]'))
  assert.ok(find(marks, 'HueProgressBlue', '========'))
  assert.ok(find(marks, 'HueProgressEmpty', '..'))
  assert.ok(find(marks, 'HueBlue', '80%'))
  assert.ok(find(marks, 'HueProgressGreen', '=========='))
  assert.ok(find(marks, 'HueGreen', '100%'))
})

test('code blocks are skipped, ```hue fences are highlighted, nested boxes work', () => {
  const marks = runLua(`return P.scan({
    '\`\`\`', '{ok: in code}', '+-- info Not a box', '| x', '+--', '\`\`\`',
    'Use \`{ok: code}\` here',
    '\`\`\`hue', '{ok: in hue fence}', '\`\`\`',
    '+-- info Outer', '| +-- warn Inner', '| | {warn: careful}', '| +--', '+--'
  })`)
  assert.ok(!marks.some((m) => m.row <= 6), JSON.stringify(marks.filter((m) => m.row <= 6)))
  assert.ok(marks.some((m) => m.row === 8 && m.style && m.style.fg === 'green'))
  assert.ok(marks.some((m) => m.row === 11 && m.group === 'HueBoxTitleOrange'))
  assert.ok(marks.some((m) => m.row === 12 && m.group === 'HueBoxOrange'), 'inner side bar')
  assert.ok(marks.some((m) => m.row === 12 && m.style && m.style.fg === 'orange'))
})

// Stand-in for the parts of the Neovim API init.lua uses.
const VIM_STUB = `
local calls = { hl = {}, extmarks = {}, autocmds = {}, commands = {}, filetypes = {} }
local buffer = {}
vim = {
  o = { background = BACKGROUND },
  api = {
    nvim_create_namespace = function () return 7 end,
    nvim_set_hl = function (_, name, opts) calls.hl[name] = opts end,
    nvim_get_current_buf = function () return 1 end,
    nvim_buf_is_valid = function () return true end,
    nvim_buf_clear_namespace = function () end,
    nvim_buf_get_lines = function () return buffer end,
    nvim_buf_set_extmark = function (_, ns, row, col, opts)
      calls.extmarks[#calls.extmarks + 1] = { row = row, col = col, end_col = opts.end_col, hl_group = opts.hl_group }
    end,
    nvim_create_augroup = function () return 1 end,
    nvim_create_autocmd = function (ev) calls.autocmds[#calls.autocmds + 1] = type(ev) == 'table' and table.concat(ev, ',') or ev end,
    nvim_create_user_command = function (name) calls.commands[#calls.commands + 1] = name end,
  },
  filetype = { add = function (t) calls.filetypes[#calls.filetypes + 1] = t end },
  keymap = { set = function () end },
}
package.preload['hue-md'] = function () ${initLua} end
local M = require('hue-md')
`

test('init.lua: setup() defines highlight groups from the palette, light and dark', () => {
  for (const mode of ['light', 'dark']) {
    const r = runLua('M.setup()\nreturn calls', { prelude: VIM_STUB.replace('BACKGROUND', `'${mode}'`) })
    assert.deepEqual(r.hl.HueGreen, { fg: COLORS.green[mode].fg, bold: true })
    assert.deepEqual(r.hl.HueBgYellow, { bg: COLORS.yellow[mode].bg })
    assert.deepEqual(r.hl.HueBoxBlue, { fg: COLORS.blue[mode].fg })
    assert.equal(r.hl.HueDiffDel.strikethrough, true)
    assert.equal(r.hl.HueTaskBlocked.fg, COLORS.red[mode].fg)
    assert.ok(r.hl.HueKbd && r.hl.HueProgressEmpty && r.hl.HueMarkup)
    assert.deepEqual(r.commands, ['HueBox'])
    assert.ok(r.autocmds.includes('BufEnter,TextChanged,TextChangedI'))
  }
})

test('init.lua: highlight_buf() puts extmarks on the demo, with groups for hex and paired styles', () => {
  const r = runLua(`${linesLua}\nbuffer = lines\nM.setup()\nM.highlight_buf(1)\nreturn calls`, { prelude: VIM_STUB.replace('BACKGROUND', "'dark'") })
  assert.ok(r.extmarks.length > 60, `${r.extmarks.length} extmarks`)
  const groups = new Set(r.extmarks.map((e) => e.hl_group))
  for (const g of ['HueGreen', 'HueBgYellow', 'HueSpan_blue_gray', 'HueSpan_c0ffee_333333', 'HueDiffAdd', 'HueDiffDel', 'HueKbd', 'HueTaskProgress', 'HueBoxTitleRed', 'HueProgressBlue']) {
    assert.ok(groups.has(g), g)
  }
  assert.deepEqual(r.hl.HueSpan_c0ffee_333333, { fg: '#c0ffee', bg: '#333333' })
  assert.deepEqual(r.hl.HueSpan_blue_gray, { fg: COLORS.blue.dark.fg, bg: COLORS.gray.dark.bg, bold: true })
})
