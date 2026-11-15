// Downgrades Hue Markdown to GitHub Flavored Markdown that renders well
// without Hue: spans lose their braces, boxes become GitHub alerts.
//
// It rewrites the source text instead of re-serializing a syntax tree, so
// everything that is not Hue stays byte-for-byte as the author wrote it.
import MarkdownIt from 'markdown-it'
import hue, { findSpans, parseTop, stripSide } from '../../src/index.js'

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

// Rewrite every span in a piece of inline text.
export function downgradeSpans (text, { spans = 'auto' } = {}) {
  const found = findSpans(text)
  if (!found.length) return text
  const edits = []
  for (const s of found) {
    // keep surrounding spaces outside the markers, so **bold** stays valid emphasis
    let end = s.close
    while (end > s.contentStart && /\s/.test(text[end - 1])) end--
    const [pre, post] = spanMarkers(s.style, text.slice(s.contentStart, end), spans)
    edits.push({ from: s.open, to: s.contentStart, text: pre })
    edits.push({ from: end, to: s.close + 1, text: post + text.slice(end, s.close) })
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

function boxToAlert (lines, opts) {
  const prefix = linePrefix(lines[0])
  const parsed = parseTop(lines[0].slice(prefix.length).trimStart())
  const style = parsed?.style || { fg: null, bg: null }
  const title = parsed?.title || ''
  const interior = lines.slice(1, -1).map((l) => stripSide(l.slice(Math.min(prefix.length, linePrefix(l).length)).trimStart()))
  const body = downgrade(interior.join('\n'), opts).replace(/\n$/, '').split('\n')
  const kind = ALERTS[style.fg || style.bg]
  const out = []
  if (kind) out.push(`> [!${kind}]`)
  if (title) out.push(`> **${downgradeSpans(title, opts)}**`)
  if (title && body.some((l) => l.trim())) out.push('>')
  for (const l of body) out.push(l ? '> ' + l : '>')
  return out.map((l) => prefix + l)
}

/**
 * Downgrade Hue Markdown to GitHub Flavored Markdown.
 * @param {string} src
 * @param {{ spans?: 'auto'|'plain'|'bold'|'latex' }} [opts]
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
    if (t.type === 'hue_box_open') {
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

  // Rewrite spans paragraph by paragraph (a span never crosses a blank line)
  const out = []
  let chunk = []
  const flush = () => { if (chunk.length) out.push(...downgradeSpans(chunk.join('\n'), opts).split('\n')); chunk = [] }
  for (let i = 0; i < lines.length; i++) {
    const r = replace.get(i)
    if (r) { flush(); out.push(...r.lines); i = r.end - 1; continue }
    if (protect.has(i) || !inlineLines.has(i) || !lines[i].trim()) { flush(); out.push(lines[i]); continue }
    chunk.push(lines[i])
  }
  flush()
  return out.join('\n')
}
