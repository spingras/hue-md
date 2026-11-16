// Hue Markdown core: tokens, styles and box-label rules shared by every
// implementation (markdown-it, remark/micromark, md-hue). No dependencies.
import { COLORS, PAGE, SEMANTIC, resolveColor } from './palette.js'

export { COLORS, PAGE, SEMANTIC, resolveColor }

export const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
export const MAX_SPEC_LEN = 64

// Parse a space-separated style spec like "red bg-yellow" or "!".
// Returns null if any word is not a known token, so ordinary prose like
// "{a: 1}" is never treated as Hue.
export function parseSpec (spec) {
  const words = spec.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const out = { fg: null, bg: null, fgHex: null, bgHex: null }
  for (const w of words) {
    if (!applyWord(out, w)) return null
  }
  return out
}

// Applies one token. A style holds one text color and one background:
// palette and hex values of the same kind replace each other, so the last one wins.
export function applyWord (out, w, { allowHex = true } = {}) {
  const bg = w.startsWith('bg-')
  const v = bg ? w.slice(3) : w
  if (HEX.test(v)) {
    if (!allowHex) return false
    if (bg) { out.bgHex = v; out.bg = null } else { out.fgHex = v; out.fg = null }
    return true
  }
  const c = resolveColor(v)
  if (!c) return false
  if (bg) { out.bg = c; out.bgHex = null } else { out.fg = c; out.fgHex = null }
  return true
}

// HTML class names and inline style for a span or box, per the spec's Rendering table.
export function styleClasses (style, kind, { inlineStyles = false } = {}) {
  const classes = [kind === 'box' ? 'hue-box' : 'hue']
  const css = []
  if (kind === 'box') {
    const c = style.fg || style.bg
    if (c) classes.push(`hue-box-${c}`)
    if (inlineStyles && c) {
      const p = COLORS[c].light
      css.push(`border-left:4px solid ${p.fg}`, `background:${p.bg}`, 'padding:0.5em 1em', 'border-radius:6px')
    }
  } else {
    if (style.fg) classes.push(`hue-${style.fg}`)
    if (style.bg) classes.push(`hue-bg-${style.bg}`)
    if (inlineStyles) {
      if (style.fg) css.push(`color:${COLORS[style.fg].light.fg}`)
      if (style.bg) css.push(`background:${COLORS[style.bg].light.bg}`, 'padding:0 0.2em', 'border-radius:3px')
    }
  }
  if (style.fgHex) css.push(`color:${style.fgHex}`)
  if (style.bgHex) css.push(`background:${style.bgHex}`)
  return { className: classes, style: css.length ? css.join(';') : null }
}

// ---------------------------------------------------------------- boxes

export const BOX_TOP = /^([┌╭+])([─\-]+)(.*?)\s*$/
export const BOX_BOTTOM = /^(?:[└╰][─\-]+[┘╯]?|\+[─\-]+\+?)\s*$/
export const BOX_SIDE = /^[│|]/

// Parse a top border line (without indentation). Returns null if it isn't one.
export function parseTop (line) {
  const top = BOX_TOP.exec(line)
  if (!top) return null
  const left = top[1]
  const rest = top[3].trimEnd()

  let right = null
  let body = rest
  if (rest) {
    if (/^[┐╮┘╯+]$/.test(rest)) {
      right = rest
      body = ''
    } else {
      const cm = /[\s─\-]([┐╮┘╯+])$/.exec(rest)
      if (cm) {
        right = cm[1]
        body = rest.slice(0, cm.index)
      }
    }
  }

  if (right) {
    if (right === '┘' || right === '╯') return null
    if ((left === '+') !== (right === '+')) return null
  }

  const raw = top[2] + ' ' + body
  return { ...parseLabel(raw), corners: left === '╭' ? 'round' : left === '+' ? 'ascii' : 'square' }
}

// "─ blue Deploy notes ───" -> { style, title }
export function parseLabel (raw) {
  const label = raw.replace(/^[─\-\s]+|[─\-\s]+$/g, '')
  const words = label ? label.split(/\s+/) : []
  const style = { fg: null, bg: null, fgHex: null, bgHex: null }
  let i = 0
  // Boxes take palette tokens only; a hex word starts the title
  while (i < words.length && applyWord(style, words[i], { allowHex: false })) i++
  return { style, title: words.slice(i).join(' ') }
}

// Interior line -> its content: drop the left border, one space, the right border and trailing space.
export function stripSide (text) {
  let t = text.replace(BOX_SIDE, '')
  if (t.startsWith(' ')) t = t.slice(1)
  t = t.replace(/\s*[│|]\s*$/, '')
  return t.replace(/\s+$/, '')
}

// ---------------------------------------------------------------- v0.2: split box columns

export function findBoxColumnStarts (line) {
  const starts = [0]
  const re = /\s{2,}(?=[┌╭+][─\-])/g
  let m
  while ((m = re.exec(line)) !== null) {
    starts.push(m.index + m[0].length)
  }
  return starts
}

export function parseSplitBoxes (lines) {
  if (!lines.length) return null
  const first = lines[0]
  const starts = findBoxColumnStarts(first)
  if (starts.length < 2) return null

  const cols = []
  for (let k = 0; k < starts.length; k++) {
    const seg = first.slice(starts[k], starts[k + 1]).trimEnd()
    const top = parseTop(seg)
    if (!top) return null
    cols.push({ top, inner: [], closed: false })
  }

  let endIdx = -1
  for (let i = 1; i < lines.length; i++) {
    const text = lines[i]
    for (let k = 0; k < starts.length; k++) {
      const seg = (k < starts.length - 1 ? text.slice(starts[k], starts[k + 1]) : text.slice(starts[k])).trimEnd()
      if (cols[k].closed) {
        if (seg.trim() !== '') return null
      } else if (BOX_BOTTOM.test(seg)) {
        cols[k].closed = true
      } else if (BOX_SIDE.test(seg)) {
        cols[k].inner.push(stripSide(seg))
      } else {
        return null
      }
    }
    if (cols.every((c) => c.closed)) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) return null
  return { cols, lineCount: endIdx + 1 }
}

// ---------------------------------------------------------------- v0.2: multi-state tasks

export const TASK_STATES = {
  ' ': { name: 'todo', color: 'gray', label: 'Todo', icon: '☐', htmlSymbol: '&#9744;' },
  '-': { name: 'progress', color: 'blue', label: 'In progress', icon: '◐', htmlSymbol: '&#9680;' },
  '!': { name: 'blocked', color: 'red', label: 'Blocked', icon: '!', htmlSymbol: '!' },
  '?': { name: 'question', color: 'purple', label: 'Question', icon: '?', htmlSymbol: '?' },
  x: { name: 'done', color: 'green', label: 'Done', icon: '✔', htmlSymbol: '&#10003;' },
  X: { name: 'done', color: 'green', label: 'Done', icon: '✔', htmlSymbol: '&#10003;' }
}

// ---------------------------------------------------------------- v0.2: key caps ([[Key]])

export const KEY_NAMES = new Set([
  'ctrl', 'control', 'shift', 'alt', 'option', 'opt', 'cmd', 'command', 'super', 'meta', 'win', 'fn',
  'enter', 'return', 'esc', 'escape', 'tab', 'space', 'spacebar', 'backspace', 'bksp', 'delete', 'del', 'insert', 'ins',
  'up', 'down', 'left', 'right', 'home', 'end', 'pgup', 'pageup', 'pgdn', 'pagedown',
  'capslock', 'caps', 'numlock', 'scrolllock', 'prtsc', 'printscreen', 'pause', 'break', 'menu', 'clear',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24',
  'plus', 'minus', 'slash', 'backslash', 'comma', 'period', 'dot', 'semicolon', 'quote', 'backtick', 'tilde'
])

export const KEY_SYMBOLS = new Set(['⌘', '⌥', '⇧', '⌃', '⏎', '⌫', '⇥', '⎋', '↑', '↓', '←', '→', '/', '?', '+', '-', '=', '~', '`', '[', ']', '\\', ';', "'", ',', '.', '*', '<', '>'])

export function isValidKeycap (raw) {
  if (!raw || raw.length > 32 || /[\n\r\t]/.test(raw)) return false
  if (raw !== raw.trim()) return false

  if (!raw.includes('+') || raw === '+') {
    if (KEY_NAMES.has(raw.toLowerCase())) return true
    if (KEY_SYMBOLS.has(raw)) return true
    if (/^[A-Z]$/.test(raw)) return true
    return false
  }

  const parts = []
  let cur = ''
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '+') {
      if (cur === '' && i > 0 && raw[i - 1] === '+') {
        cur = '+'
      } else if (cur !== '') {
        parts.push(cur)
        cur = ''
      } else {
        return false
      }
    } else {
      cur += raw[i]
    }
  }
  if (cur !== '') parts.push(cur)
  if (parts.length < 2) return false

  for (const p of parts) {
    if (KEY_NAMES.has(p.toLowerCase())) continue
    if (KEY_SYMBOLS.has(p)) continue
    if (/^[A-Za-z0-9]$/.test(p)) continue
    return false
  }
  return true
}

// ---------------------------------------------------------------- v0.2: progress bars ([======....] 60%)

const PROGRESS_RE = /^\[([=#■█]{0,40})([.\-_░ ]{0,40})\]\s*(\d{1,3})%/

export function progressColor (pct) {
  if (pct >= 100) return 'green'
  if (pct >= 50) return 'blue'
  if (pct >= 25) return 'orange'
  return 'red'
}

export function matchProgressBar (src, pos, posMax) {
  if (src.charCodeAt(pos) !== 0x5B /* [ */) return null
  if (pos > 0 && src.charCodeAt(pos - 1) === 0x5B) return null
  const slice = src.slice(pos, Math.min(posMax, pos + 52))
  const m = PROGRESS_RE.exec(slice)
  if (!m) return null
  const filled = m[1]
  const empty = m[2]
  const totalLen = filled.length + empty.length
  if (totalLen < 4 || totalLen > 40) return null
  if (filled.length === 0 && !/[.\-_░]/.test(empty)) return null

  const pct = Number(m[3])
  if (pct < 0 || pct > 100) return null

  const endPos = pos + m[0].length
  if (endPos < posMax && (src.charCodeAt(endPos) === 0x28 || src.charCodeAt(endPos) === 0x5B)) return null

  return {
    raw: m[0],
    filled: filled.length,
    empty: empty.length,
    total: totalLen,
    pct,
    color: progressColor(pct),
    endPos
  }
}
