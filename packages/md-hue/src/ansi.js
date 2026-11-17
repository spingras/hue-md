// Renders Hue Markdown for a terminal: ANSI truecolor for spans, box-drawing
// frames for boxes and split-box columns, multi-state tasks, keycaps,
// progress bars, diff spans, and slide decks.
import MarkdownIt from 'markdown-it'
import hue, { COLORS, parseTop, BOX_SIDE, BOX_BOTTOM } from '../../../src/index.js'

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
      case 'hue_diff_open': {
        const isAdd = t.meta.kind === 'add'
        const c = isAdd ? COLORS.green[ctx.theme] : COLORS.red[ctx.theme]
        push({ fg: c.fg, bg: c.bg, strike: !isAdd })
        break
      }
      case 'hue_kbd': {
        const g = COLORS.gray[ctx.theme]
        runs.push({ text: `[${t.content}]`, s: { ...top(), b: true, fg: g.fg, bg: g.bg } })
        break
      }
      case 'hue_progress': {
        const { pct, color } = t.meta
        const barW = 10
        const filledW = Math.round((pct / 100) * barW)
        const emptyW = barW - filledW
        const fg = COLORS[color][ctx.theme].fg
        const dimFg = COLORS.gray[ctx.theme].fg
        if (filledW > 0) runs.push({ text: '━'.repeat(filledW), s: { ...top(), fg, b: true } })
        if (emptyW > 0) runs.push({ text: '━'.repeat(emptyW), s: { ...top(), fg: dimFg, dim: true } })
        runs.push({ text: ` ${pct}%`, s: { ...top(), fg, b: true } })
        break
      }
      case 'hue_task_box': break
      case 'strong_close': case 'em_close': case 's_close': case 'hue_close': case 'hue_diff_close': pop(); break
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
          const liToken = body[k]
          const [item, after] = inner(body, k)
          const taskMeta = liToken.meta?.task
          let marker
          let markerStyle
          if (taskMeta) {
            marker = `[${taskMeta.icon}] `
            markerStyle = { fg: COLORS[taskMeta.color][ctx.theme].fg, b: taskMeta.state !== 'todo' }
          } else {
            marker = ordered ? `${n++}. ` : '• '
            markerStyle = { dim: !ordered }
          }
          const mw = textWidth(marker)
          const loose = item.some((x) => x.type === 'paragraph_open' && !x.hidden)
          const itemLines = blocks(item, ctx, Math.max(1, width - mw), { tight: !loose })
          if (!first && loose) lines.push('')
          itemLines.forEach((l, idx) => lines.push((idx === 0 ? paint(marker, markerStyle, ctx) : ' '.repeat(mw)) + l))
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
      case 'hue_columns_open': {
        const [body, next] = inner(tokens, i)
        const colBoxes = []
        for (let k = 0; k < body.length;) {
          if (body[k].type === 'hue_box_open') {
            const [boxBody, afterBox] = inner(body, k)
            colBoxes.push({ open: body[k], body: boxBody })
            k = afterBox
          } else {
            k++
          }
        }
        const gap = 2
        const colCount = Math.max(1, colBoxes.length)
        const colW = Math.max(10, Math.floor((width - gap * (colCount - 1)) / colCount))
        const renderedCols = colBoxes.map(({ open, body: b }) => {
          let title = null; let rest = b
          if (b[0]?.type === 'hue_box_title_open') {
            title = inlineRuns(b[1].children, ctx)
            rest = b.slice(3)
          }
          return boxLines(open, { title, tokens: rest }, ctx, colW)
        })
        const maxH = Math.max(0, ...renderedCols.map((c) => c.length))
        const colWidths = renderedCols.map((c) => Math.max(colW, ...c.map(textWidth)))
        const zipLines = []
        for (let r = 0; r < maxH; r++) {
          const rowParts = renderedCols.map((c, idx) => {
            const cell = c[r] || ''
            const pad = Math.max(0, colWidths[idx] - textWidth(cell))
            return idx < renderedCols.length - 1 ? cell + ' '.repeat(pad) : cell
          })
          zipLines.push(rowParts.join(' '.repeat(gap)))
        }
        out.push({ lines: zipLines })
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

// ------------------------------------------------------------ Terminal Slide Deck Mode

/**
 * Split a .hue.md document into individual slides on top-level `---` lines
 * (ignoring `---` inside code fences or Hue boxes).
 * @param {string} src
 */
export function parseSlides (src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const slides = []
  let current = []
  let inFence = null
  let inBox = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()

    const fm = /^(`{3,}|~{3,})(.*)$/.exec(trimmed)
    if (fm) {
      if (!inFence) inFence = fm[1]
      else if (fm[1][0] === inFence[0] && fm[1].length >= inFence.length && fm[2].trim() === '') inFence = null
      current.push(line)
      continue
    }
    if (inFence) {
      current.push(line)
      continue
    }

    if (!inBox && parseTop(trimmed)) {
      inBox = true
      current.push(line)
      continue
    }
    if (inBox) {
      if (BOX_BOTTOM.test(trimmed)) inBox = false
      else if (!BOX_SIDE.test(trimmed)) inBox = false
      current.push(line)
      continue
    }

    if (/^ {0,3}-{3,}\s*$/.test(line)) {
      const prev = current.length ? current[current.length - 1].trim() : ''
      if (prev === '' || /^#{1,6}\s/.test(prev) || BOX_BOTTOM.test(prev)) {
        if (current.some((l) => l.trim() !== '')) {
          slides.push(current.join('\n').trim())
        }
        current = []
        continue
      }
    }

    current.push(line)
  }

  if (current.some((l) => l.trim() !== '') || slides.length === 0) {
    slides.push(current.join('\n').trim())
  }

  return slides.map((content, idx) => {
    const headingMatch = /^#{1,3}\s+(.+)$/m.exec(content)
    return {
      index: idx + 1,
      title: headingMatch ? headingMatch[1].trim() : `Slide ${idx + 1}`,
      markdown: content
    }
  })
}

/**
 * Render a Hue Markdown slide deck for the terminal.
 * @param {string} src
 * @param {{ width?: number, theme?: 'dark'|'light', color?: boolean, slide?: number|null, minHeight?: number }} [opts]
 */
export function renderSlides (src, { width = 80, theme = 'dark', color = true, slide = null, minHeight = 0 } = {}) {
  const allSlides = parseSlides(src)
  const total = allSlides.length
  const selected = slide !== null
    ? allSlides.filter((s) => s.index === slide)
    : allSlides

  const ctx = { theme, color }
  const borderS = { fg: COLORS.blue[theme].fg }
  const titleS = { fg: COLORS.blue[theme].fg, b: true }
  const dimS = { fg: COLORS.gray[theme].fg, dim: true }
  const innerW = Math.max(20, width - 4)

  const renderedDeck = selected.map((s) => {
    const bodyRaw = renderAnsi(s.markdown, { width: innerW, theme, color }).replace(/\n$/, '')
    const bodyLines = bodyRaw ? bodyRaw.split('\n') : ['']
    while (bodyLines.length < minHeight) bodyLines.push('')

    const badgePlain = `[ ${s.index} / ${total} ]`
    const headerTitle = ` ${s.title} `
    const dashCount = Math.max(1, width - 6 - textWidth(headerTitle) - badgePlain.length)
    const topLine =
      paint('╭─', borderS, ctx) +
      paint(headerTitle, titleS, ctx) +
      paint('─'.repeat(dashCount) + ' ', borderS, ctx) +
      paint(badgePlain, dimS, ctx) +
      paint(' ─╮', borderS, ctx)

    const framedBody = bodyLines.map((l) => {
      const pad = Math.max(0, innerW - textWidth(l))
      return paint('│', borderS, ctx) + ' ' + l + ' '.repeat(pad) + ' ' + paint('│', borderS, ctx)
    })

    const barW = Math.min(12, Math.max(4, total * 2))
    const filled = Math.max(1, Math.round((s.index / total) * barW))
    const empty = Math.max(0, barW - filled)
    const footerDashes = Math.max(1, width - 5 - barW)
    const bottomLine =
      paint('╰' + '─'.repeat(footerDashes) + ' ', borderS, ctx) +
      paint('━'.repeat(filled), titleS, ctx) +
      paint('━'.repeat(empty), dimS, ctx) +
      paint(' ─╯', borderS, ctx)

    return [topLine, ...framedBody, bottomLine].join('\n')
  })

  return renderedDeck.join('\n\n') + '\n'
}
