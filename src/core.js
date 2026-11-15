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
