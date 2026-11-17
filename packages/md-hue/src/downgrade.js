// Downgrades Hue Markdown to GitHub Flavored Markdown that renders well
// without Hue: spans lose their braces, diff spans become bold/strikethrough,
// keycaps become <kbd>, multi-state tasks become GFM checkboxes with labels,
// and boxes (including side-by-side split boxes) become GitHub alerts.
//
// It rewrites the source text instead of re-serializing a syntax tree, so
// everything that is not Hue stays byte-for-byte as the author wrote it.
import MarkdownIt from 'markdown-it'
import hue, { findInlineHue, parseTop, stripSide, parseSplitBoxes } from '../../../src/index.js'

// GitHub alert type for each palette color. Gray and unstyled boxes become plain quotes.
export const ALERTS = {
  red: 'CAUTION',
  orange: 'WARNING',
  yellow: 'WARNING',
  green: 'TIP',
  blue: 'NOTE',
  purple: 'IMPORTANT'
}

const STRONG = new Set(['red', 'orange']) // text colors that carry a warning: keep them visible as bold

// How a span's delimiters are rewritten. Returns [prefix, suffix].
function spanMarkers (style, content, mode) {
  const color = style.fg || style.bg
  if (mode === 'latex' && color && /^[\w .,:;!?'()%+-]+$/.test(content) && !style.bg) {
    // GitHub math: $\color{red}{\text{...}}$ only works for plain text
    return [`$\\color{${color === 'gray' ? 'gray' : color}}{\\text{`, '}}$']
  }
  const bold = mode === 'bold' || ((mode === 'auto' || mode === 'latex') && STRONG.has(style.fg))
  return bold ? ['**', '**'] : ['', '']
}

// Rewrite every inline Hue construct (color spans, diff spans, keycaps) in a piece of inline text.
export function downgradeSpans (text, { spans = 'auto', kbd = 'html' } = {}) {
  const { spans: foundSpans, diffs, kbds } = findInlineHue(text)
  if (!foundSpans.length && !diffs.length && !kbds.length) return text
  const edits = []

  for (const s of foundSpans) {
    // keep surrounding spaces outside the markers, so **bold** stays valid emphasis
    let end = s.close
    while (end > s.contentStart && /\s/.test(text[end - 1])) end--
    const [pre, post] = spanMarkers(s.style, text.slice(s.contentStart, end), spans)
    edits.push({ from: s.open, to: s.contentStart, text: pre })
    edits.push({ from: end, to: s.close + 1, text: post + text.slice(end, s.close) })
  }

  for (const d of diffs) {
    let end = d.close
    while (end > d.contentStart && /\s/.test(text[end - 1])) end--
    const [pre, post] = d.kind === 'add'
      ? (spans === 'plain' ? ['+', ''] : ['**+', '**'])
      : ['~~', '~~']
    edits.push({ from: d.open, to: d.contentStart, text: pre })
    edits.push({ from: end, to: d.close + 1, text: post + text.slice(end, d.close) })
  }

  for (const k of kbds) {
    const replacement = kbd === 'code' ? `\`${k.keyText}\`` : `<kbd>${k.keyText}</kbd>`
    edits.push({ from: k.open, to: k.close, text: replacement })
  }

  edits.sort((a, b) => b.from - a.from)
  let out = text
  for (const e of edits) out = out.slice(0, e.from) + e.text + out.slice(e.to)
  return out
}

const md = new MarkdownIt({ html: true }).use(hue)

// The text before the first box character on a line (indentation, "> " of a quote, …).
function linePrefix (line) {
  const m = /^[^┌╭+│|└╰]*/.exec(line)
  return m ? m[0] : ''
}

function renderAlertLines (style, title, interiorLines, prefix, opts) {
  const downgradedInterior = downgrade(interiorLines.join('\n'), opts).replace(/\n$/, '')
  const body = downgradedInterior.split('\n')
  for (const t of md.parse(downgradedInterior, {})) {
    if (t.type === 'paragraph_open' && t.map) {
      const [s, e] = t.map
      for (let k = s; k < e - 1; k++) {
        if (body[k] && !body[k].endsWith('  ') && !body[k].endsWith('\\')) body[k] += '  '
      }
    }
  }
  const kind = ALERTS[style.fg || style.bg]
  const out = []
  if (kind) out.push(`> [!${kind}]`)
  if (title) out.push(`> **${downgradeSpans(title, opts)}**`)
  if (title && body.some((l) => l.trim())) out.push('>')
  for (const l of body) out.push(l ? '> ' + l : '>')
  return out.map((l) => prefix + l)
}

function boxToAlert (lines, opts) {
  const prefix = linePrefix(lines[0])
  const parsed = parseTop(lines[0].slice(prefix.length).trimStart())
  const style = parsed?.style || { fg: null, bg: null }
  const title = parsed?.title || ''
  const interior = lines.slice(1, -1).map((l) => stripSide(l.slice(Math.min(prefix.length, linePrefix(l).length)).trimStart()))
  return renderAlertLines(style, title, interior, prefix, opts)
}

function splitBoxesToAlerts (lines, opts) {
  const prefix = linePrefix(lines[0])
  const sliceLines = lines.map((l) => l.slice(Math.min(prefix.length, l.length)))
  const split = parseSplitBoxes(sliceLines)
  if (!split) return lines
  const out = []
  split.cols.forEach((col, idx) => {
    if (idx > 0) out.push(prefix.trimEnd())
    out.push(...renderAlertLines(col.top.style, col.top.title, col.inner, prefix, opts))
  })
  return out
}

function rewriteTaskLine (line) {
  const m = /^(\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+)\[([ xX\-!?])\](\s+)(.*)$/.exec(line)
  if (!m) return line
  const [, listPrefix, state, space, rest] = m
  if (state === 'x' || state === 'X') return `${listPrefix}[x]${space}${rest}`
  if (state === ' ') return `${listPrefix}[ ]${space}${rest}`
  if (state === '-') return `${listPrefix}[ ] *(in progress)* ${rest}`
  if (state === '!') return `${listPrefix}[ ] **[!]** ${rest}`
  if (state === '?') return `${listPrefix}[ ] **[?]** ${rest}`
  return line
}

/**
 * Downgrade Hue Markdown to GitHub Flavored Markdown.
 * @param {string} src
 * @param {{ spans?: 'auto'|'plain'|'bold'|'latex', kbd?: 'html'|'code' }} [opts]
 *   auto (default): red/orange text becomes **bold**, other colors are dropped
 */
export function downgrade (src, opts = {}) {
  const lines = src.split('\n')
  const tokens = md.parse(src, {})
  const replace = new Map() // first line -> { end, lines }
  const protect = new Set()
  const inlineLines = new Set()

  let boxDepth = 0
  for (const t of tokens) {
    if (t.type === 'hue_columns_open') {
      if (boxDepth++ === 0 && t.map) {
        const [s, e] = t.map
        replace.set(s, { end: e, lines: splitBoxesToAlerts(lines.slice(s, e), opts) })
      }
    } else if (t.type === 'hue_columns_close') {
      boxDepth--
    } else if (t.type === 'hue_box_open') {
      if (boxDepth++ === 0 && t.map) {
        const [s, e] = t.map
        replace.set(s, { end: e, lines: boxToAlert(lines.slice(s, e), opts) })
      }
    } else if (t.type === 'hue_box_close') {
      boxDepth--
    } else if (boxDepth === 0 && t.map) {
      const [s, e] = t.map
      if (t.type === 'fence' && t.info.trim().split(/\s+/)[0] === 'hue') {
        const prefix = /^[\s>]*/.exec(lines[s])[0]
        replace.set(s, { end: e, lines: downgrade(t.content, opts).replace(/\n$/, '').split('\n').map((l) => (l ? prefix + l : prefix.trimEnd())) })
      } else if (t.type === 'fence' || t.type === 'code_block' || t.type === 'html_block') {
        for (let k = s; k < e; k++) protect.add(k)
      } else if (t.type === 'inline' || t.type === 'table_open') {
        for (let k = s; k < e; k++) inlineLines.add(k)
      }
    }
  }

  // Rewrite spans and task markers paragraph by paragraph (a span never crosses a blank line)
  const out = []
  let chunk = []
  const flush = () => {
    if (chunk.length) {
      const taskRewritten = chunk.map(rewriteTaskLine)
      out.push(...downgradeSpans(taskRewritten.join('\n'), opts).split('\n'))
      chunk = []
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const r = replace.get(i)
    if (r) { flush(); out.push(...r.lines); i = r.end - 1; continue }
    if (protect.has(i) || !inlineLines.has(i) || !lines[i].trim()) { flush(); out.push(lines[i]); continue }
    chunk.push(lines[i])
  }
  flush()
  return out.join('\n')
}
