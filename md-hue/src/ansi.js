// Renders Hue Markdown for a terminal: ANSI truecolor for spans, box-drawing
// frames for boxes, word wrap that keeps colors intact across lines.
import MarkdownIt from 'markdown-it'
import hue, { COLORS } from '../../src/index.js'

const ESC = '\x1b['

// ------------------------------------------------------------ text width

// Display width of one code point: 0 for combining marks, 2 for wide CJK/emoji.
function cpWidth (cp) {
  if (cp === 0 || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfe0f) return 0
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) return 2
  return 1
}
export function textWidth (s) {
  let w = 0
  for (const ch of s.replace(/\x1b\[[0-9;]*m/g, '')) w += cpWidth(ch.codePointAt(0))
  return w
}

// ------------------------------------------------------------ styles and runs
// A run is { text, s } where s is a style: { b, i, u, strike, dim, code, fg, bg } (fg/bg are "#rrggbb").

function hexToRgb (hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16))
}

function sgr (s) {
  const codes = []
  if (s.b) codes.push(1)
  if (s.dim) codes.push(2)
  if (s.i) codes.push(3)
  if (s.u) codes.push(4)
  if (s.strike) codes.push(9)
  if (s.fg) codes.push('38;2;' + hexToRgb(s.fg).join(';'))
  else if (s.code) codes.push(36)
  if (s.bg) codes.push('48;2;' + hexToRgb(s.bg).join(';'))
  return codes.length ? ESC + codes.join(';') + 'm' : ''
}

function serialize (runs, color) {
  if (!color) return runs.map((r) => r.text).join('')
  let out = ''
  for (const r of runs) {
    const code = sgr(r.s)
    out += code ? code + r.text + ESC + '0m' : r.text
  }
  return out
}

// ------------------------------------------------------------ inline tokens -> runs

function spanColors (style, theme) {
  const out = {}
  if (style.fg) out.fg = COLORS[style.fg][theme].fg
  if (style.fgHex) out.fg = style.fgHex
  if (style.bg) out.bg = COLORS[style.bg][theme].bg
  if (style.bgHex) out.bg = style.bgHex
  return out
}

function inlineRuns (children, ctx) {
  const runs = []
  const stack = [{}]
  const top = () => stack[stack.length - 1]
  const push = (extra) => stack.push({ ...top(), ...extra })
  const pop = () => { if (stack.length > 1) stack.pop() }
  const links = []

  for (const t of children || []) {
    switch (t.type) {
      case 'text': runs.push({ text: t.content, s: top() }); break
      case 'softbreak': runs.push(ctx.inBox ? { br: true } : { text: ' ', s: top() }); break
      case 'hardbreak': runs.push({ br: true }); break
      case 'code_inline': runs.push({ text: t.content, s: { ...top(), code: true } }); break
      case 'html_inline': runs.push({ text: t.content, s: { ...top(), dim: true } }); break
      case 'strong_open': push({ b: true }); break
      case 'em_open': push({ i: true }); break
      case 's_open': push({ strike: true }); break
      case 'link_open': links.push({ href: t.attrGet('href'), start: runs.length }); push({ u: true }); break
      case 'link_close': {
        pop()
        const l = links.pop()
        const label = runs.slice(l.start).map((r) => r.text || '').join('')
        if (l.href && l.href !== label && 'mailto:' + label !== l.href) runs.push({ text: ` (${l.href})`, s: { ...top(), dim: true } })
        break
      }
      case 'image': runs.push({ text: `[image: ${t.content || t.attrGet('src')}]`, s: { ...top(), dim: true } }); break
      case 'hue_open': push(spanColors(t.meta.style, ctx.theme)); break
      case 'strong_close': case 'em_close': case 's_close': case 'hue_close': pop(); break
      default: if (t.content) runs.push({ text: t.content, s: top() })
    }
  }
  return runs
}

// ------------------------------------------------------------ word wrap on runs

function wrapRuns (runs, width, color) {
  const lines = []
  let line = []; let lineW = 0; let pendingSpace = null

  const flush = () => { lines.push(serialize(line, color)); line = []; lineW = 0; pendingSpace = null }
  const addWord = (text, s) => {
    let w = textWidth(text)
    const spaceW = pendingSpace && lineW > 0 ? 1 : 0
    if (lineW > 0 && lineW + spaceW + w > width) flush()
    else if (spaceW) { line.push(pendingSpace); lineW += 1 }
    pendingSpace = null
    // hard-split words longer than the line
    while (w > width && width > 0) {
      let cut = ''; let cw = 0
      for (const ch of text) { const c = cpWidth(ch.codePointAt(0)); if (cw + c > width - lineW) break; cut += ch; cw += c }
      if (!cut) {
        if (lineW > 0) { flush(); continue }
        const first = String.fromCodePoint(text.codePointAt(0))
        cut = first; cw = cpWidth(first.codePointAt(0))
      }
      line.push({ text: cut, s }); lineW += cw; flush()
      text = text.slice(cut.length); w = textWidth(text)
    }
    if (text) { line.push({ text, s }); lineW += w }
  }

  for (const r of runs) {
    if (r.br) { flush(); continue }
    for (const piece of r.text.split(/( +)/)) {
      if (!piece) continue
      if (piece[0] === ' ') pendingSpace = { text: ' ', s: r.s }
      else addWord(piece, r.s)
    }
  }
  if (line.length || !lines.length) flush()
  return lines
}

// ------------------------------------------------------------ block tokens -> lines

// Tokens between an *_open at i and its matching *_close.
function inner (tokens, i) {
  const open = tokens[i]
  const closeType = open.type.replace(/_open$/, '_close')
  let depth = 0
  for (let j = i; j < tokens.length; j++) {
    if (tokens[j].type === open.type) depth++
    else if (tokens[j].type === closeType && --depth === 0) return [tokens.slice(i + 1, j), j + 1]
  }
  return [tokens.slice(i + 1), tokens.length]
}

function paint (text, s, ctx) { return ctx.color ? sgr(s) + text + ESC + '0m' : text }

function boxLines (open, body, ctx, width) {
  const { style, title, corners } = open.meta
  const [tl, tr, bl, br] = corners === 'round' ? ['╭', '╮', '╰', '╯'] : ['┌', '┐', '└', '┘']
  const c = style.fg || style.bg
  const borderS = c ? { fg: COLORS[c][ctx.theme].fg } : { fg: COLORS.gray[ctx.theme].fg }
  const innerW = Math.max(1, width - 4)
  const content = blocks(body.tokens, { ...ctx, inBox: true }, innerW)
  const titleText = body.title ? serialize(body.title.map((r) => ({ text: r.text, s: { ...r.s, b: true, ...(c ? { fg: borderS.fg } : {}) } })), ctx.color) : ''
  const titleW = textWidth(titleText)
  const contentW = Math.max(innerW, ...content.map(textWidth))
  const fullW = Math.max(contentW, titleW + 2)
  const out = []
  out.push(title
    ? paint(tl + '─ ', borderS, ctx) + titleText + paint(' ' + '─'.repeat(Math.max(0, fullW - titleW - 1)) + tr, borderS, ctx)
    : paint(tl + '─'.repeat(fullW + 2) + tr, borderS, ctx))
  for (const l of content.length ? content : ['']) {
    out.push(paint('│', borderS, ctx) + ' ' + l + ' '.repeat(Math.max(0, fullW - textWidth(l))) + ' ' + paint('│', borderS, ctx))
  }
  out.push(paint(bl + '─'.repeat(fullW + 2) + br, borderS, ctx))
  return out
}

function table (tokens, ctx) {
  const rows = []; let row = null
  for (const t of tokens) {
    if (t.type === 'tr_open') row = []
    else if (t.type === 'tr_close') rows.push(row)
    else if (t.type === 'inline' && row) row.push(serialize(inlineRuns(t.children, ctx), ctx.color))
  }
  const widths = []
  for (const r of rows) r.forEach((cell, k) => { widths[k] = Math.max(widths[k] || 0, textWidth(cell)) })
  const dim = (s) => paint(s, { dim: true }, ctx)
  const lines = rows.map((r) => r.map((cell, k) => cell + ' '.repeat(widths[k] - textWidth(cell))).join(dim(' │ ')))
  if (lines.length > 1) lines.splice(1, 0, dim(widths.map((w) => '─'.repeat(w)).join('─┼─')))
  return lines
}

function blocks (tokens, ctx, width, { tight = false } = {}) {
  const out = [] // array of { lines, tight }
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i]
    switch (t.type) {
      case 'paragraph_open': {
        const il = tokens[i + 1]
        out.push({ lines: wrapRuns(inlineRuns(il.children, ctx), width, ctx.color), tight: t.hidden })
        i += 3; break
      }
      case 'heading_open': {
        const level = Number(t.tag.slice(1))
        const s = level === 1 ? { b: true, u: true } : level === 2 ? { b: true } : { b: true, dim: level > 3 }
        const runs = inlineRuns(tokens[i + 1].children, ctx).map((r) => (r.br ? r : { ...r, s: { ...r.s, ...s } }))
        out.push({ lines: wrapRuns(runs, width, ctx.color) })
        i += 3; break
      }
      case 'fence': case 'code_block': {
        const info = t.info.trim().split(/\s+/)[0]
        if (t.type === 'fence' && info === 'hue') {
          out.push({ lines: blocks(ctx.md.parse(t.content, {}), ctx, width) })
        } else {
          const s = { fg: COLORS.gray[ctx.theme].fg }
          out.push({ lines: t.content.replace(/\n$/, '').split('\n').map((l) => '  ' + paint(l, s, ctx)) })
        }
        i++; break
      }
      case 'hr': out.push({ lines: [paint('─'.repeat(width), { dim: true }, ctx)] }); i++; break
      case 'html_block': out.push({ lines: t.content.replace(/\n$/, '').split('\n').map((l) => paint(l, { dim: true }, ctx)) }); i++; break
      case 'blockquote_open': {
        const [body, next] = inner(tokens, i)
        const bar = paint('│', { fg: COLORS.gray[ctx.theme].fg }, ctx) + ' '
        out.push({ lines: blocks(body, ctx, Math.max(1, width - 2)).map((l) => bar + l) })
        i = next; break
      }
      case 'bullet_list_open': case 'ordered_list_open': {
        const [body, next] = inner(tokens, i)
        const ordered = t.type === 'ordered_list_open'
        let n = Number(t.attrGet('start') || 1)
        const lines = []
        let first = true
        for (let k = 0; k < body.length;) {
          if (body[k].type !== 'list_item_open') { k++; continue }
          const [item, after] = inner(body, k)
          const marker = ordered ? `${n++}. ` : '• '
          const mw = textWidth(marker)
          const loose = item.some((x) => x.type === 'paragraph_open' && !x.hidden)
          const itemLines = blocks(item, ctx, Math.max(1, width - mw), { tight: !loose })
          if (!first && loose) lines.push('')
          itemLines.forEach((l, idx) => lines.push((idx === 0 ? paint(marker, { dim: !ordered }, ctx) : ' '.repeat(mw)) + l))
          first = false
          k = after
        }
        out.push({ lines })
        i = next; break
      }
      case 'table_open': {
        const [body, next] = inner(tokens, i)
        out.push({ lines: table(body, ctx) })
        i = next; break
      }
      case 'hue_box_open': {
        const [body, next] = inner(tokens, i)
        let title = null; let rest = body
        if (body[0]?.type === 'hue_box_title_open') {
          title = inlineRuns(body[1].children, ctx)
          rest = body.slice(3)
        }
        out.push({ lines: boxLines(t, { title, tokens: rest }, ctx, width) })
        i = next; break
      }
      default: i++
    }
  }
  // Blank line between blocks, except inside a tight list item
  const lines = []
  out.forEach((b, k) => {
    if (k > 0 && !tight) lines.push('')
    lines.push(...b.lines)
  })
  return lines
}

// ------------------------------------------------------------ public API

export function createRenderer () {
  return new MarkdownIt({ html: true }).use(hue)
}

/**
 * Render Hue Markdown to terminal text.
 * @param {string} src
 * @param {{ width?: number, theme?: 'dark'|'light', color?: boolean }} [opts]
 */
export function renderAnsi (src, { width = 80, theme = 'dark', color = true } = {}) {
  const md = createRenderer()
  const ctx = { md, theme, color }
  return blocks(md.parse(src, {}), ctx, width).join('\n') + '\n'
}
