// markdown-it-hue: prototype plugin for the Hue Markdown flavor.
//
//   Inline:  {red: text}  {! : text}  {bg-yellow: text}  {blue bg-gray: text}  {#c0ffee: text}
//   Boxes:   ┌─ blue Title ─┐        +-- ! Title --+
//            │ any markdown │        | markdown    |
//            └──────────────┘        +-------------+
//   Fence:   ```hue  ... ```  renders its content as Hue (keeps box shape where Hue is unsupported)

import MarkdownIt from 'markdown-it'
import { HTML_TAG_RE } from 'markdown-it/lib/common/html_re.mjs'
import { COLORS, PAGE, SEMANTIC, MAX_SPEC_LEN, parseSpec, parseLabel, parseTop, stripSide, styleClasses, BOX_TOP, BOX_BOTTOM, BOX_SIDE } from './core.js'

// Sticky copy of markdown-it's raw-HTML regex, to test at a position without slicing
const HTML_TAG_AT = new RegExp(HTML_TAG_RE.source.replace(/^\^/, ''), 'y')
// Same autolink patterns as markdown-it's autolink rule
const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/
const EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/

// If an autolink or (when enabled) a raw HTML tag starts at `i`, return the index after it.
function skipAngle (src, i, html) {
  let j = i + 1
  while (j < src.length) {
    const c = src.charCodeAt(j)
    if (c === 0x3C /* < */ || c === 0x0A) break
    if (c === 0x3E /* > */) {
      const url = src.slice(i + 1, j)
      if (AUTOLINK_RE.test(url) || EMAIL_RE.test(url)) return j + 1
      break
    }
    j++
  }
  if (html) {
    HTML_TAG_AT.lastIndex = i
    const m = HTML_TAG_AT.exec(src)
    if (m) return i + m[0].length
  }
  return -1
}

// ---------------------------------------------------------------- inline

// For every "{" in `src`, the index of its matching "}" (or -1).
// One left-to-right pass with a stack, so the cost is linear in the input
// (a per-opener rescan was quadratic on input like many unclosed "{red: ").
// Braces inside backslash escapes, code spans, autolinks and (when enabled)
// raw HTML tags don't count: those bind more tightly than spans, as in CommonMark.
function matchBraces (src, html) {
  const n = src.length
  const match = new Int32Array(n).fill(-1)

  // Positions of backtick runs grouped by run length, to find a closing run
  // of the same length in amortized O(1) with a forward-only pointer.
  const runs = new Map()
  for (let i = 0; i < n;) {
    if (src.charCodeAt(i) === 0x5C) { i += 2; continue }
    if (src.charCodeAt(i) !== 0x60) { i++; continue }
    let j = i
    while (j < n && src.charCodeAt(j) === 0x60) j++
    const len = j - i
    if (!runs.has(len)) runs.set(len, { pos: [], next: 0 })
    runs.get(len).pos.push(i)
    i = j
  }
  const nextRun = (len, after) => {
    const r = runs.get(len)
    while (r.next < r.pos.length && r.pos[r.next] <= after) r.next++
    return r.next < r.pos.length ? r.pos[r.next] : -1
  }

  const stack = []
  const openers = []
  for (let i = 0; i < n;) {
    const ch = src.charCodeAt(i)
    if (ch === 0x5C /* \ */) { i += 2; continue }
    if (ch === 0x60 /* ` */) {
      let j = i
      while (j < n && src.charCodeAt(j) === 0x60) j++
      const close = nextRun(j - i, i)
      i = close === -1 ? j : close + (j - i)
      continue
    }
    if (ch === 0x3C /* < */) {
      const end = skipAngle(src, i, html)
      if (end !== -1) { i = end; continue }
    }
    if (ch === 0x7B /* { */) { stack.push(i); openers.push(i) } else if (ch === 0x7D /* } */ && stack.length) match[stack.pop()] = i
    i++
  }
  return { match, openers }
}

const braceCache = new WeakMap()
function closeOf (state, openPos) {
  let entry = braceCache.get(state)
  if (!entry || entry.src !== state.src) {
    entry = { src: state.src, match: matchBraces(state.src, state.md.options.html).match }
    braceCache.set(state, entry)
  }
  return entry.match[openPos]
}

// The "{style:" head of a span starting at `pos`, or null.
// Bounded search, so a "{" with no colon nearby costs O(MAX_SPEC_LEN), not O(n).
function spanHead (src, pos, posMax) {
  if (src.charCodeAt(pos) !== 0x7B /* { */) return null
  const limit = Math.min(posMax, pos + 2 + MAX_SPEC_LEN)
  let colon = pos + 1
  while (colon < limit && src.charCodeAt(colon) !== 0x3A /* : */) colon++
  if (colon >= limit) return null
  const specText = src.slice(pos + 1, colon)
  if (/[\n{}]/.test(specText)) return null
  const style = parseSpec(specText)
  if (!style) return null
  let contentStart = colon + 1
  while (contentStart < posMax && src.charCodeAt(contentStart) === 0x20) contentStart++
  return { specText, style, contentStart }
}

let inlineMdTrue = null
let inlineMdFalse = null

// Every span in a piece of inline source text: [{ open, contentStart, close, style }].
// Used by tools that rewrite Hue source (e.g. downgrading to plain Markdown).
export function findSpans (src, { html = true } = {}) {
  if (!src.includes('{')) return []
  const m = html
    ? (inlineMdTrue ||= new MarkdownIt({ html: true }).use(hue))
    : (inlineMdFalse ||= new MarkdownIt({ html: false }).use(hue))
  const tokens = m.parseInline(src, {})
  const spans = []
  for (const ch of tokens[0]?.children || []) {
    if (ch.type === 'hue_open' && ch.meta?.span) spans.push(ch.meta.span)
  }
  return spans
}

function hueInline (opts) {
  return function hue_span (state, silent) {
    const { src, pos, posMax } = state
    const head = spanHead(src, pos, posMax)
    if (!head) return false
    const { specText, style, contentStart } = head
    const close = closeOf(state, pos)
    if (close === -1 || close >= posMax || close <= contentStart) return false

    if (!silent) {
      const open = state.push('hue_open', 'span', 1)
      open.attrs = styleAttrs(style, opts, 'span')
      open.markup = '{' + specText + ':'
      open.meta = { style, span: { open: pos, contentStart, close, style } }

      const oldMax = state.posMax
      state.pos = contentStart
      state.posMax = close
      state.md.inline.tokenize(state)
      state.posMax = oldMax

      const shut = state.push('hue_close', 'span', -1)
      shut.markup = '}'
    }
    state.pos = close + 1
    return true
  }
}

// ---------------------------------------------------------------- boxes

function lineText (state, line) {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
}

// markdown-it attribute list from the shared class/style rules
function styleAttrs (style, opts, kind) {
  const { className, style: css } = styleClasses(style, kind, opts)
  const attrs = [['class', className.join(' ')]]
  if (css) attrs.push(['style', css])
  return attrs
}

function hueBox (opts) {
  return function hue_box (state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const top = parseTop(lineText(state, startLine))
    if (!top) return false

    const inner = []
    let line = startLine + 1
    let closed = false
    for (; line < endLine; line++) {
      const text = lineText(state, line)
      if (BOX_BOTTOM.test(text)) { closed = true; break }
      if (!BOX_SIDE.test(text)) return false
      inner.push(stripSide(text))
    }
    if (!closed) return false
    if (silent) return true

    const { style, title, corners } = top
    const open = state.push('hue_box_open', 'div', 1)
    open.attrs = styleAttrs(style, opts, 'box')
    open.attrs.push(['role', 'note'])
    open.block = true
    open.map = [startLine, line + 1]
    open.meta = { style, title, corners }

    if (title) {
      const t = state.push('hue_box_title_open', 'div', 1)
      t.attrs = [['class', 'hue-box-title']]
      const il = state.push('inline', '', 0)
      il.content = title
      il.map = [startLine, startLine + 1]
      il.children = []
      state.push('hue_box_title_close', 'div', -1)
    }

    state.md.block.parse(inner.join('\n'), state.md, state.env, state.tokens)

    state.push('hue_box_close', 'div', -1).block = true
    state.line = line + 1
    return true
  }
}

// ---------------------------------------------------------------- css

export function css ({ prefix = '' } = {}) {
  const vars = (mode) => Object.entries(COLORS)
    .map(([n, c]) => `  --hue-${n}: ${c[mode].fg};\n  --hue-${n}-bg: ${c[mode].bg};`).join('\n')
  const rules = Object.keys(COLORS).map((n) => [
    `${prefix}.hue-${n} { color: var(--hue-${n}); }`,
    // :where() keeps specificity at 0 so an explicit text color always wins over the background's default text color
    `${prefix}:where(.hue-bg-${n}) { color: var(--hue-text); }`,
    `${prefix}.hue-bg-${n} { background: var(--hue-${n}-bg); padding: 0 .2em; border-radius: 3px; }`,
    `${prefix}.hue-box-${n} { border-left-color: var(--hue-${n}); background: var(--hue-${n}-bg); }`,
    `${prefix}.hue-box-${n} > .hue-box-title { color: var(--hue-${n}); }`
  ].join('\n')).join('\n')
  return `/* Hue theme: generated from src/palette.js */
:root {
  --hue-text: ${PAGE.light.text};
  --hue-neutral-bg: ${COLORS.gray.light.bg};
${vars('light')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --hue-text: ${PAGE.dark.text};
    --hue-neutral-bg: ${COLORS.gray.dark.bg};
${vars('dark')}
  }
}
:root[data-theme="dark"] {
  --hue-text: ${PAGE.dark.text};
  --hue-neutral-bg: ${COLORS.gray.dark.bg};
${vars('dark')}
}
${prefix}.hue-box { border-left: 4px solid var(--hue-gray); background: var(--hue-neutral-bg); padding: .6em 1em; margin: 1em 0; border-radius: 6px; }
${prefix}.hue-box p { white-space: pre-line; }
${prefix}.hue-box > :first-child { margin-top: 0; }
${prefix}.hue-box > :last-child { margin-bottom: 0; }
${prefix}.hue-box-title { font-weight: 600; margin-bottom: .35em; }
${rules}
`
}

// ---------------------------------------------------------------- plugin

export default function hue (md, options = {}) {
  const opts = { inlineStyles: false, fence: true, ...options }

  md.inline.ruler.before('emphasis', 'hue_span', hueInline(opts))
  md.block.ruler.before('fence', 'hue_box', hueBox(opts), {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })

  if (opts.fence) {
    const fallback = md.renderer.rules.fence ||
      ((tokens, idx, o, env, self) => self.renderToken(tokens, idx, o))
    md.renderer.rules.fence = (tokens, idx, o, env, self) => {
      const info = tokens[idx].info.trim().split(/\s+/)[0]
      if (info === 'hue') return md.render(tokens[idx].content, env)
      return fallback(tokens, idx, o, env, self)
    }
  }
}

export { COLORS, SEMANTIC, PAGE, parseSpec, parseLabel, parseTop, stripSide, BOX_TOP, BOX_BOTTOM, BOX_SIDE }
