// markdown-it-hue: plugin for the Hue Markdown flavor (.hue.md).
//
//   Inline:   {red: text}  {! : text}  {bg-yellow: text}  {blue bg-gray: text}  {#c0ffee: text}
//   Diffs:    {+: added text}  {-: removed text}
//   Keycaps:  [[Ctrl]]  [[Shift]]  [[Cmd+K]]
//   Progress: [======....] 60%  [==========] 100%
//   Tasks:    - [ ] todo  - [-] in progress  - [!] blocked  - [?] question  - [x] done
//   Boxes:    ┌─ blue Title ─┐        +-- ! Title --+
//             │ any markdown │        | markdown    |
//             └──────────────┘        +-------------+
//   Columns:  +-- ok Left    +-- warn Right
//             | col 1        | col 2
//             +--            +--
//   Fence:    ```hue  ... ```  renders its content as Hue (keeps box shape where Hue is unsupported)

import MarkdownIt from 'markdown-it'
import { HTML_TAG_RE } from 'markdown-it/lib/common/html_re.mjs'
import {
  COLORS,
  PAGE,
  SEMANTIC,
  MAX_SPEC_LEN,
  parseSpec,
  parseLabel,
  parseTop,
  stripSide,
  styleClasses,
  BOX_TOP,
  BOX_BOTTOM,
  BOX_SIDE,
  findBoxColumnStarts,
  parseSplitBoxes,
  TASK_STATES,
  KEY_NAMES,
  KEY_SYMBOLS,
  isValidKeycap,
  progressColor,
  matchProgressBar
} from './core.js'

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

// ---------------------------------------------------------------- inline brace matching

function matchBraces (src, html) {
  const n = src.length
  const match = new Int32Array(n).fill(-1)

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

// ---------------------------------------------------------------- inline color spans

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

// Every inline Hue construct (color spans, diff spans, keycaps) in inline source text.
export function findInlineHue (src, { html = true } = {}) {
  if (!src.includes('{') && !src.includes('[[')) return { spans: [], diffs: [], kbds: [] }
  const m = html
    ? (inlineMdTrue ||= new MarkdownIt({ html: true }).use(hue))
    : (inlineMdFalse ||= new MarkdownIt({ html: false }).use(hue))
  const tokens = m.parseInline(src, {})
  const spans = []
  const diffs = []
  const kbds = []
  for (const ch of tokens[0]?.children || []) {
    if (ch.type === 'hue_open' && ch.meta?.span) spans.push(ch.meta.span)
    else if (ch.type === 'hue_diff_open' && ch.meta?.diff) diffs.push(ch.meta.diff)
    else if (ch.type === 'hue_kbd' && ch.meta?.kbd) kbds.push(ch.meta.kbd)
  }
  return { spans, diffs, kbds }
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

// ---------------------------------------------------------------- v0.2: inline diff spans ({+: ...}, {-: ...})

function diffHead (src, pos, posMax) {
  if (src.charCodeAt(pos) !== 0x7B /* { */) return null
  const limit = Math.min(posMax, pos + 10)
  let colon = pos + 1
  while (colon < limit && src.charCodeAt(colon) !== 0x3A /* : */) colon++
  if (colon >= limit) return null
  const specText = src.slice(pos + 1, colon)
  if (/[\n{}]/.test(specText)) return null
  const trimmed = specText.trim()
  if (trimmed !== '+' && trimmed !== '-') return null
  let contentStart = colon + 1
  while (contentStart < posMax && src.charCodeAt(contentStart) === 0x20) contentStart++
  return { kind: trimmed === '+' ? 'add' : 'del', specText, contentStart }
}

function hueDiffRule (opts) {
  return function hue_diff (state, silent) {
    const { src, pos, posMax } = state
    const head = diffHead(src, pos, posMax)
    if (!head) return false
    const { kind, specText, contentStart } = head
    const close = closeOf(state, pos)
    if (close === -1 || close >= posMax || close <= contentStart) return false

    if (!silent) {
      const tag = kind === 'add' ? 'ins' : 'del'
      const open = state.push('hue_diff_open', tag, 1)
      open.attrs = [['class', `hue hue-diff-${kind}`]]
      if (opts.inlineStyles) {
        const c = kind === 'add' ? COLORS.green.light : COLORS.red.light
        const dec = kind === 'add' ? 'none' : 'line-through'
        open.attrs.push(['style', `color:${c.fg};background:${c.bg};text-decoration:${dec};padding:0 0.2em;border-radius:3px`])
      }
      open.markup = `{${specText}:`
      open.meta = { kind, diff: { open: pos, contentStart, close, kind } }

      const oldMax = state.posMax
      state.pos = contentStart
      state.posMax = close
      state.md.inline.tokenize(state)
      state.posMax = oldMax

      const shut = state.push('hue_diff_close', tag, -1)
      shut.markup = '}'
    }
    state.pos = close + 1
    return true
  }
}

// ---------------------------------------------------------------- v0.2: key caps ([[Key]])

function hueKeycapRule (opts) {
  return function hue_kbd (state, silent) {
    if (silent) return false
    const { src, pos, posMax } = state
    if (pos + 4 >= posMax) return false
    if (src.charCodeAt(pos) !== 0x5B /* [ */ || src.charCodeAt(pos + 1) !== 0x5B /* [ */) return false

    if (pos > 0) {
      const prev = src.charCodeAt(pos - 1)
      if (prev === 0x5B || prev === 0x5D || (prev >= 0x30 && prev <= 0x39) || (prev >= 0x41 && prev <= 0x5A) || (prev >= 0x61 && prev <= 0x7A)) {
        return false
      }
    }

    const limit = Math.min(posMax - 1, pos + 2 + 32)
    let close = pos + 2
    while (close < limit && !(src.charCodeAt(close) === 0x5D && src.charCodeAt(close + 1) === 0x5D)) {
      if (src.charCodeAt(close) === 0x0A || src.charCodeAt(close) === 0x5B) return false
      close++
    }
    if (close >= limit || src.charCodeAt(close) !== 0x5D || src.charCodeAt(close + 1) !== 0x5D) return false
    if (close + 2 < posMax && (src.charCodeAt(close + 2) === 0x5D || src.charCodeAt(close + 2) === 0x28)) return false

    const keyText = src.slice(pos + 2, close)
    if (!isValidKeycap(keyText)) return false

    const tok = state.push('hue_kbd', 'kbd', 0)
    tok.attrs = [['class', 'hue-kbd']]
    if (opts.inlineStyles) {
      tok.attrs.push(['style', 'display:inline-block;padding:0.1em 0.4em;font-size:0.85em;font-family:monospace;border:1px solid #98a2b3;border-bottom-width:2px;border-radius:4px;background:#f2f4f7;color:#1d2939'])
    }
    tok.content = keyText
    tok.markup = `[[${keyText}]]`
    tok.meta = { kbd: { open: pos, close: close + 2, keyText } }
    state.pos = close + 2
    return true
  }
}

// ---------------------------------------------------------------- v0.2: progress bars ([======....] 60%)

function hueProgressRule (opts) {
  return function hue_progress (state, silent) {
    if (silent) return false
    const { src, pos, posMax } = state
    const hit = matchProgressBar(src, pos, posMax)
    if (!hit) return false

    const tok = state.push('hue_progress', 'span', 0)
    tok.meta = hit
    tok.content = `${hit.pct}%`
    tok.markup = hit.raw
    tok.attrs = [
      ['class', `hue-progress hue-progress-${hit.color}`],
      ['role', 'progressbar'],
      ['aria-valuenow', String(hit.pct)],
      ['aria-valuemin', '0'],
      ['aria-valuemax', '100']
    ]
    if (opts.inlineStyles) {
      tok.attrs.push(['style', 'display:inline-flex;align-items:center;gap:0.4em;vertical-align:middle'])
    }
    state.pos = hit.endPos
    return true
  }
}

// ---------------------------------------------------------------- v0.2: multi-state tasks

const TASK_RE = /^\[([ xX\-!?])\](\s+)/

function hueTaskRule (opts) {
  return function hue_tasks (state) {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline') continue
      if (tokens[i - 1].type !== 'paragraph_open') continue
      if (tokens[i - 2].type !== 'list_item_open') continue

      const children = tokens[i].children
      if (!children || !children.length || children[0].type !== 'text') continue
      const m = TASK_RE.exec(children[0].content)
      if (!m) continue

      const marker = m[1]
      const info = TASK_STATES[marker]
      if (!info) continue

      children[0].content = children[0].content.slice(m[0].length)

      const boxToken = new state.Token('hue_task_box', 'span', 0)
      boxToken.attrs = [
        ['class', `hue-task-box hue-task-box-${info.name}`],
        ['aria-hidden', 'true']
      ]
      if (opts.inlineStyles) {
        const p = COLORS[info.color].light
        boxToken.attrs.push(['style', `color:${p.fg};background:${p.bg};border:1px solid ${p.fg};border-radius:3px;padding:0 0.25em;margin-right:0.4em;font-weight:600`])
      }
      boxToken.meta = { marker: marker.toLowerCase(), state: info.name, color: info.color, icon: info.icon, htmlSymbol: info.htmlSymbol }
      children.unshift(boxToken)

      const li = tokens[i - 2]
      const liClass = li.attrGet('class')
      li.attrSet('class', (liClass ? liClass + ' ' : '') + `hue-task hue-task-${info.name}`)
      li.meta = { ...(li.meta || {}), task: boxToken.meta }

      for (let j = i - 3; j >= 0; j--) {
        if (tokens[j].type === 'bullet_list_open' || tokens[j].type === 'ordered_list_open') {
          const ulClass = tokens[j].attrGet('class') || ''
          if (!ulClass.split(/\s+/).includes('hue-task-list')) {
            tokens[j].attrSet('class', (ulClass ? ulClass + ' ' : '') + 'hue-task-list')
          }
          break
        }
      }
    }
  }
}

// ---------------------------------------------------------------- boxes & split box columns

function lineText (state, line) {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
}

function rawLineWithIndent (state, line, baseIndent) {
  const start = Math.min(state.eMarks[line], state.bMarks[line] + baseIndent)
  return state.src.slice(start, state.eMarks[line])
}

// markdown-it attribute list from the shared class/style rules
function styleAttrs (style, opts, kind) {
  const { className, style: css } = styleClasses(style, kind, opts)
  const attrs = [['class', className.join(' ')]]
  if (css) attrs.push(['style', css])
  return attrs
}

function hueSplitBox (opts) {
  return function hue_split_box (state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const baseIndent = state.tShift[startLine]
    const first = lineText(state, startLine)
    const starts = findBoxColumnStarts(first)
    if (starts.length < 2) return false

    const cols = []
    for (let k = 0; k < starts.length; k++) {
      const seg = first.slice(starts[k], starts[k + 1]).trimEnd()
      const top = parseTop(seg)
      if (!top) return false
      cols.push({ top, inner: [], closed: false })
    }

    let endIdx = -1
    for (let line = startLine + 1; line < endLine; line++) {
      const text = rawLineWithIndent(state, line, baseIndent)
      for (let k = 0; k < starts.length; k++) {
        const seg = (k < starts.length - 1 ? text.slice(starts[k], starts[k + 1]) : text.slice(starts[k])).trimEnd()
        if (cols[k].closed) {
          if (seg.trim() !== '') return false
        } else if (BOX_BOTTOM.test(seg)) {
          cols[k].closed = true
        } else if (BOX_SIDE.test(seg)) {
          cols[k].inner.push(stripSide(seg))
        } else {
          return false
        }
      }
      if (cols.every((c) => c.closed)) {
        endIdx = line
        break
      }
    }

    if (endIdx === -1) return false
    if (silent) return true

    const lineCount = endIdx - startLine + 1
    const wrapOpen = state.push('hue_columns_open', 'div', 1)
    wrapOpen.attrs = [['class', `hue-columns hue-columns-${cols.length}`]]
    if (opts.inlineStyles) {
      wrapOpen.attrs.push(['style', 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1em;margin:1em 0'])
    }
    wrapOpen.block = true
    wrapOpen.map = [startLine, startLine + lineCount]
    wrapOpen.meta = { columns: cols.length }

    for (const col of cols) {
      const { style, title, corners } = col.top
      const open = state.push('hue_box_open', 'div', 1)
      open.attrs = styleAttrs(style, opts, 'box')
      open.attrs.push(['role', 'note'])
      open.block = true
      open.map = [startLine, startLine + lineCount]
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

      state.md.block.parse(col.inner.join('\n'), state.md, state.env, state.tokens)
      state.push('hue_box_close', 'div', -1).block = true
    }

    state.push('hue_columns_close', 'div', -1).block = true
    state.line = startLine + lineCount
    return true
  }
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
${prefix}.hue-task-list { list-style: none; padding-left: 0.4em; }
${prefix}.hue-task { display: flex; align-items: baseline; gap: 0.45em; margin: 0.25em 0; }
${prefix}.hue-task-box { display: inline-flex; align-items: center; justify-content: center; width: 1.25em; height: 1.25em; border-radius: 4px; font-size: 0.85em; font-weight: 700; flex-shrink: 0; border: 1.5px solid var(--hue-gray); color: var(--hue-gray); background: var(--hue-gray-bg); }
${prefix}.hue-task-box-progress { border-color: var(--hue-blue); color: var(--hue-blue); background: var(--hue-blue-bg); }
${prefix}.hue-task-box-blocked { border-color: var(--hue-red); color: var(--hue-red); background: var(--hue-red-bg); }
${prefix}.hue-task-box-question { border-color: var(--hue-purple); color: var(--hue-purple); background: var(--hue-purple-bg); }
${prefix}.hue-task-box-done { border-color: var(--hue-green); color: var(--hue-green); background: var(--hue-green-bg); }
${prefix}.hue-columns { display: -ms-flexbox; display: flex; -ms-flex-wrap: nowrap; flex-wrap: nowrap; margin: 1em 0; align-items: stretch; }
${prefix}.hue-columns > .hue-box { -ms-flex: 1 1 0px; flex: 1 1 0px; margin: 0; box-sizing: border-box; }
${prefix}.hue-columns > .hue-box + .hue-box { margin-left: 16px; }
${prefix}.hue-kbd { display: inline-block; padding: 0.1em 0.42em; font-size: 0.84em; line-height: 1.2; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--hue-text); background: var(--hue-neutral-bg); border: 1px solid var(--hue-gray); border-bottom-width: 2px; border-radius: 4px; }
${prefix}.hue-progress { display: inline-flex; align-items: center; gap: 0.45em; vertical-align: middle; font-variant-numeric: tabular-nums; }
${prefix}.hue-progress-track { display: inline-block; width: 5.5em; height: 0.55em; background: var(--hue-neutral-bg); border-radius: 999px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--hue-gray) 35%, transparent); }
${prefix}.hue-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--hue-blue); }
${prefix}.hue-progress-green .hue-progress-fill { background: var(--hue-green); }
${prefix}.hue-progress-blue .hue-progress-fill { background: var(--hue-blue); }
${prefix}.hue-progress-orange .hue-progress-fill { background: var(--hue-orange); }
${prefix}.hue-progress-red .hue-progress-fill { background: var(--hue-red); }
${prefix}.hue-progress-label { font-size: 0.85em; font-weight: 600; color: var(--hue-text); }
${prefix}ins.hue-diff-add { color: var(--hue-green); background: var(--hue-green-bg); text-decoration: none; padding: 0 0.22em; border-radius: 3px; }
${prefix}del.hue-diff-del { color: var(--hue-red); background: var(--hue-red-bg); text-decoration: line-through; padding: 0 0.22em; border-radius: 3px; }
`
}

// ---------------------------------------------------------------- plugin

export default function hue (md, options = {}) {
  const opts = { inlineStyles: false, fence: true, ...options }

  md.inline.ruler.before('emphasis', 'hue_diff', hueDiffRule(opts))
  md.inline.ruler.before('emphasis', 'hue_span', hueInline(opts))
  md.inline.ruler.before('link', 'hue_progress', hueProgressRule(opts))
  md.inline.ruler.before('link', 'hue_kbd', hueKeycapRule(opts))

  md.block.ruler.before('fence', 'hue_split_box', hueSplitBox(opts), {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })
  md.block.ruler.before('fence', 'hue_box', hueBox(opts), {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })

  md.core.ruler.after('inline', 'hue_tasks', hueTaskRule(opts))

  md.renderer.rules.hue_task_box = (tokens, idx, o, env, self) => {
    const t = tokens[idx]
    return `<span${self.renderAttrs(t)}>${t.meta.htmlSymbol}</span> `
  }

  md.renderer.rules.hue_kbd = (tokens, idx, o, env, self) => {
    const t = tokens[idx]
    return `<kbd${self.renderAttrs(t)}>${md.utils.escapeHtml(t.content)}</kbd>`
  }

  md.renderer.rules.hue_progress = (tokens, idx, o, env, self) => {
    const t = tokens[idx]
    const { pct, color } = t.meta
    const fillStyle = opts.inlineStyles
      ? `display:block;height:100%;width:${pct}%;background:${COLORS[color].light.fg}`
      : `width:${pct}%`
    const trackStyle = opts.inlineStyles
      ? 'display:inline-block;width:5.5em;height:0.55em;background:#f2f4f7;border-radius:999px;overflow:hidden'
      : ''
    const trackAttr = trackStyle ? ` style="${trackStyle}"` : ''
    return `<span${self.renderAttrs(t)}><span class="hue-progress-track"${trackAttr}><span class="hue-progress-fill" style="${fillStyle}"></span></span><span class="hue-progress-label">${pct}%</span></span>`
  }

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

export {
  COLORS,
  SEMANTIC,
  PAGE,
  parseSpec,
  parseLabel,
  parseTop,
  stripSide,
  BOX_TOP,
  BOX_BOTTOM,
  BOX_SIDE,
  findBoxColumnStarts,
  parseSplitBoxes,
  TASK_STATES,
  KEY_NAMES,
  KEY_SYMBOLS,
  isValidKeycap,
  progressColor,
  matchProgressBar
}
