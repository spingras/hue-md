// Hue MD on HTML that another Markdown renderer already produced.
//
// Obsidian and GitHub render notes with their own Markdown engines, so the Hue
// markdown-it plugin cannot hook into them. This file works on the HTML they
// produced and reuses the real parser:
//
//   boxes, split boxes  source lines (from the host, or rebuilt from the rendered
//                       paragraph) are parsed with the shared box rules in
//                       src/core.js; the box body goes back through the host's
//                       renderer, so its own features keep working inside boxes.
//   spans, diff spans,  each run of inline content is turned back into a string
//   key caps, progress  (child elements become placeholder characters) and
//                       parsed by the real Hue inline rules from src/index.js.
//                       The rendered result keeps the host's own elements.
//   key caps as links   Obsidian reads [[Ctrl+C]] as a wikilink; an unresolved
//                       link whose target is a valid key cap becomes a <kbd>.
//   tasks               the host keeps `- [ ]` and `- [x]` as its own checkboxes.
//                       Hue only draws `[-]`, `[!]` and `[?]`, the same choice as
//                       the Joplin plugin.
//
// Used by packages/obsidian-hue and packages/github-hue (extension, userscript).
// No host imports here: callers pass in the renderer, so tests run it on jsdom.

import MarkdownIt from 'markdown-it'
import hue from './index.js'
import {
  BOX_BOTTOM,
  BOX_SIDE,
  TASK_STATES,
  findBoxColumnStarts,
  isValidKeycap,
  parseSplitBoxes,
  parseTop,
  stripSide,
  styleClasses
} from './core.js'

// ---------------------------------------------------------------- inline Hue

// Only the Hue inline rules (plus plain text) are on: the text has already been
// through Obsidian, so emphasis, links, escapes and entities must not run again.
let inlineMd = null
function inlineParser () {
  if (!inlineMd) inlineMd = new MarkdownIt('zero').use(hue, { fence: false })
  return inlineMd
}

// Elements whose content is never Hue: code, existing Hue output, form controls, media, math, embeds.
const SKIP_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'SVG', 'MATH', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'MJX-CONTAINER'])
const SKIP_CLASSES = ['hue-kbd', 'hue-progress', 'hue-task-box', 'markdown-embed', 'internal-embed', 'math', 'frontmatter']

// Block children end an inline run: a span never wraps a list or a paragraph.
const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL', 'DD', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'UL'])

// Placeholder characters (Unicode private use area) stand in for child elements.
const PUA = 0xE000
const PUA_MAX = 0xF8FF
const PUA_RE = /[-]/
const PUA_ALL = /[-]/g

const tagOf = (node) => node.nodeName.toUpperCase()

function skipped (node) {
  if (SKIP_TAGS.has(tagOf(node))) return true
  const cl = node.classList
  return !!cl && SKIP_CLASSES.some((c) => cl.contains(c))
}

// Applies Hue inline syntax everywhere below `root`.
export function hueInline (root) {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 1 && !skipped(child)) hueInline(child)
  }
  let run = []
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 1 && BLOCK_TAGS.has(tagOf(child))) {
      inlineRun(run)
      run = []
    } else {
      run.push(child)
    }
  }
  inlineRun(run)
}

// Obsidian turns ` #c0ffee` into a tag link, also inside `{bg-yellow #c0ffee: text}`.
const isHexTag = (n) => n.nodeType === 1 && tagOf(n) === 'A' && n.classList.contains('tag') && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(n.textContent)

// Inline source for a run: text as is, elements as placeholders. Hex tags in
// `asText` count as their text, so they can be part of a span's spec.
function runSource (nodes, asText) {
  let src = ''
  const held = []
  const tags = []
  for (const n of nodes) {
    if (n.nodeType === 3) {
      if (PUA_RE.test(n.nodeValue)) return null
      src += n.nodeValue
    } else if (asText.has(n)) {
      tags.push({ node: n, at: src.length })
      src += n.textContent
    } else {
      if (PUA + held.length > PUA_MAX) return null
      src += String.fromCharCode(PUA + held.length)
      held.push(n)
    }
  }
  return { src, held, tags }
}

function inlineRun (nodes) {
  if (!nodes.some((n) => n.nodeType === 3 && /[{[]/.test(n.nodeValue))) return
  const md = inlineParser()
  const parse = (asText) => {
    const run = runSource(nodes, asText)
    if (!run) return null
    run.children = md.parseInline(run.src, {})[0]?.children || []
    return run
  }

  let run = parse(new Set(nodes.filter(isHexTag)))
  if (!run) return
  // A hex tag stays a tag unless it ended up inside a span's spec.
  const specs = run.children.filter((t) => t.type === 'hue_open' && t.meta?.span).map((t) => t.meta.span)
  const keep = run.tags.filter(({ at }) => specs.some((s) => at > s.open && at < s.contentStart))
  if (keep.length !== run.tags.length) run = parse(new Set(keep.map((t) => t.node)))
  if (!run) return

  const { held, children } = run
  if (!children.some((t) => t.type.startsWith('hue_'))) return
  const html = md.renderer.renderInline(children, md.options, {})
  // Every held element must come back exactly once, or the DOM is left alone.
  const marks = html.match(PUA_ALL) || []
  if (marks.length !== held.length || new Set(marks).size !== held.length) return

  const doc = nodes[0].ownerDocument
  const parent = nodes[0].parentNode
  const anchor = doc.createComment('')
  parent.insertBefore(anchor, nodes[0])
  const tpl = doc.createElement('template')
  tpl.innerHTML = html
  // Text nodes and the hex tags read as text are replaced; held elements move into the result.
  const kept = new Set(held)
  for (const n of nodes) if (!kept.has(n) && n.parentNode) n.parentNode.removeChild(n)
  restorePlaceholders(tpl.content, held)
  parent.insertBefore(tpl.content, anchor)
  parent.removeChild(anchor)
}

function restorePlaceholders (root, held) {
  const texts = []
  const collect = (n) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) texts.push(c)
      else collect(c)
    }
  }
  collect(root)
  const doc = root.ownerDocument
  for (const t of texts) {
    const v = t.nodeValue
    if (!PUA_RE.test(v)) continue
    const frag = doc.createDocumentFragment()
    let buf = ''
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i)
      if (c >= PUA && c <= PUA_MAX) {
        if (buf) frag.appendChild(doc.createTextNode(buf))
        buf = ''
        frag.appendChild(held[c - PUA])
      } else {
        buf += v[i]
      }
    }
    if (buf) frag.appendChild(doc.createTextNode(buf))
    t.parentNode.replaceChild(frag, t)
  }
}

// ---------------------------------------------------------------- key caps written as wikilinks

// [[Ctrl+C]] is a wikilink to Obsidian. When the link has no alias, does not
// point at an existing note and its target is a valid key cap, draw a key cap.
export function hueKeycapLinks (root, isResolved) {
  for (const a of Array.from(root.querySelectorAll('a.internal-link'))) {
    const target = a.getAttribute('data-href') ?? a.getAttribute('href')
    if (!target || a.textContent !== target || !isValidKeycap(target)) continue
    if (isResolved && isResolved(target)) continue
    const kbd = a.ownerDocument.createElement('kbd')
    kbd.className = 'hue-kbd'
    kbd.textContent = target
    a.parentNode.replaceChild(kbd, a)
  }
}

// ---------------------------------------------------------------- multi-state tasks

// Hue draws these; `[ ]` and `[x]` stay Obsidian's clickable checkboxes.
const HUE_TASKS = { '-': TASK_STATES['-'], '!': TASK_STATES['!'], '?': TASK_STATES['?'] }
const LITERAL_TASK_RE = /^\[([-!?])\]\s+/

function taskBox (doc, info) {
  const box = doc.createElement('span')
  box.className = `hue-task-box hue-task-box-${info.name}`
  box.setAttribute('aria-hidden', 'true')
  box.innerHTML = info.htmlSymbol
  return box
}

function markTask (li, info) {
  li.classList.add('hue-task', `hue-task-${info.name}`)
  li.classList.remove('is-checked')
}

// The li's own checkbox, not one from a nested list.
function ownCheckbox (li) {
  for (const box of Array.from(li.querySelectorAll('input.task-list-item-checkbox, input[type=checkbox]'))) {
    if (box.closest('li') === li) return box
  }
  return null
}

function firstText (li) {
  let n = li.firstChild
  while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.nextSibling
  if (n && n.nodeType === 1 && tagOf(n) === 'P') n = n.firstChild
  return n && n.nodeType === 3 ? n : null
}

export function hueTasks (root) {
  for (const li of Array.from(root.querySelectorAll('li'))) {
    if (li.classList.contains('hue-task')) continue
    const doc = li.ownerDocument
    // Obsidian renders any `[c]` as a task item with data-task="c" and a checkbox.
    const marker = li.getAttribute('data-task')
    if (marker !== null) {
      const info = HUE_TASKS[marker]
      const box = info && ownCheckbox(li)
      if (!box) continue
      box.parentNode.replaceChild(taskBox(doc, info), box)
      markTask(li, info)
      continue
    }
    // Plain list item that still shows the marker as text.
    const text = firstText(li)
    const m = text && LITERAL_TASK_RE.exec(text.nodeValue)
    if (!m) continue
    const info = HUE_TASKS[m[1]]
    text.nodeValue = text.nodeValue.slice(m[0].length)
    text.parentNode.insertBefore(taskBox(doc, info), text)
    markTask(li, info)
    const list = li.parentNode
    if (list && !list.classList.contains('contains-task-list')) list.classList.add('hue-task-list')
  }
}

// ---------------------------------------------------------------- boxes and split boxes

const MAY_HAVE_BOX = /^[ \t]*[┌╭+][─\-]/m

// Splits source lines into plain markdown runs and boxes, with the same rules as
// the markdown-it block rules (src/index.js hue_split_box and hue_box).
export function boxSegments (lines) {
  const segs = []
  let text = []
  let found = false
  const flush = () => {
    if (text.length) segs.push({ type: 'markdown', lines: text })
    text = []
  }
  for (let i = 0; i < lines.length;) {
    const indent = /^ {0,3}/.exec(lines[i])[0].length
    const first = lines[i].slice(indent)

    if (findBoxColumnStarts(first).length >= 2) {
      const split = parseSplitBoxes([first, ...lines.slice(i + 1).map((l) => l.slice(Math.min(indent, l.length)))])
      if (split) {
        flush()
        segs.push({ type: 'columns', cols: split.cols.map((c) => ({ top: c.top, inner: c.inner })) })
        found = true
        i += split.lineCount
        continue
      }
    }

    const top = parseTop(first)
    if (top) {
      const inner = []
      let j = i + 1
      let closed = false
      for (; j < lines.length; j++) {
        const t = lines[j].replace(/^\s+/, '')
        if (BOX_BOTTOM.test(t)) { closed = true; break }
        if (!BOX_SIDE.test(t)) break
        inner.push(stripSide(t))
      }
      if (closed) {
        flush()
        segs.push({ type: 'box', top, inner })
        found = true
        i = j + 1
        continue
      }
    }

    text.push(lines[i])
    i++
  }
  flush()
  return found ? segs : null
}

// Each box line starts a new line, whatever Obsidian's "strict line breaks"
// setting is: end the line with a hard break (two spaces), except in code fences.
function hardBreaks (lines) {
  let fence = null
  return lines.map((l) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(l)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (f[1][0] === fence) fence = null
      return l
    }
    return fence || !l.trim() ? l : l + '  '
  }).join('\n')
}

async function renderBox (doc, { top, inner }, render) {
  const box = doc.createElement('div')
  box.className = styleClasses(top.style, 'box').className.join(' ')
  box.setAttribute('role', 'note')
  if (top.title) {
    const title = doc.createElement('div')
    title.className = 'hue-box-title'
    title.textContent = top.title
    hueInline(title)
    box.appendChild(title)
  }
  const body = doc.createElement('div')
  body.className = 'hue-box-body'
  box.appendChild(body)
  await render(hardBreaks(inner), body)
  return box
}

async function renderSegments (doc, segs, render) {
  const out = []
  for (const seg of segs) {
    if (seg.type === 'markdown') {
      const div = doc.createElement('div')
      await render(seg.lines.join('\n'), div)
      out.push(...Array.from(div.childNodes))
    } else if (seg.type === 'box') {
      out.push(await renderBox(doc, seg, render))
    } else {
      const wrap = doc.createElement('div')
      wrap.className = `hue-columns hue-columns-${seg.cols.length}`
      for (const col of seg.cols) wrap.appendChild(await renderBox(doc, col, render))
      out.push(wrap)
    }
  }
  return out
}

// Markdown source of a rendered paragraph, for when Obsidian gives no section
// info (embeds, nested renders). Code, bold, italics, strikethrough and
// highlights come back as their usual Markdown, so split box columns keep
// their widths; other elements come back as HTML, which Obsidian renders again.
const WRAP = { STRONG: '**', B: '**', EM: '*', I: '*', DEL: '~~', S: '~~', MARK: '==' }

function inlineSource (node) {
  let out = ''
  for (const n of Array.from(node.childNodes)) {
    if (n.nodeType === 3) {
      out += n.nodeValue.replace(/&(?=#?[a-zA-Z0-9]+;)/g, '&amp;').replace(/<(?=[a-zA-Z/!?])/g, '&lt;')
    } else if (n.nodeType === 1) {
      const tag = tagOf(n)
      if (tag === 'BR') {
        out += '\n'
      } else if (tag === 'CODE') {
        const text = n.textContent
        const longest = Math.max(0, ...(text.match(/`+/g) || []).map((r) => r.length))
        const ticks = '`'.repeat(longest + 1)
        out += longest ? `${ticks} ${text} ${ticks}` : ticks + text + ticks
      } else if (WRAP[tag]) {
        out += WRAP[tag] + inlineSource(n) + WRAP[tag]
      } else {
        out += n.outerHTML
      }
    }
  }
  return out
}

function paragraphSource (p) {
  return inlineSource(p).replace(/\n[ \t]*(?=\n)/g, '').replace(/\n+/g, '\n')
}

const elementChildren = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 1)

// Renders the boxes in one Obsidian section. Returns a promise when it found
// boxes, null when there is nothing to do.
export function hueBoxes (el, ctx, render) {
  // A box is always one CommonMark paragraph: every line starts with `+` or `|`.
  const kids = elementChildren(el)
  const info = ctx && typeof ctx.getSectionInfo === 'function' ? ctx.getSectionInfo(el) : null
  if (info && kids.length === 1 && tagOf(kids[0]) === 'P') {
    const lines = info.text.split(/\r?\n/).slice(info.lineStart, info.lineEnd + 1)
    const segs = MAY_HAVE_BOX.test(lines.join('\n')) && boxSegments(lines)
    if (segs) {
      return renderSegments(el.ownerDocument, segs, render).then((nodes) => {
        el.replaceChildren(...nodes)
      })
    }
    return null
  }

  const jobs = []
  for (const p of Array.from(el.querySelectorAll('p'))) {
    if (p.closest('.hue-box, pre, code')) continue
    if (!MAY_HAVE_BOX.test(p.textContent)) continue
    const segs = boxSegments(paragraphSource(p).split('\n'))
    if (!segs) continue
    jobs.push(renderSegments(el.ownerDocument, segs, render).then((nodes) => {
      p.replaceWith(...nodes)
    }))
  }
  return jobs.length ? Promise.all(jobs) : null
}

// ---------------------------------------------------------------- post-processor

// render(markdown, container, ctx): Obsidian's markdown renderer.
// isResolved(linkTarget, ctx): true when the wikilink points at an existing note.
export function createPostProcessor ({ render, isResolved }) {
  const inlinePasses = (el, ctx) => {
    hueTasks(el)
    hueKeycapLinks(el, isResolved ? (t) => isResolved(t, ctx) : null)
    hueInline(el)
  }
  return function hueMdPostProcessor (el, ctx) {
    const boxes = hueBoxes(el, ctx, (md, container) => render(md, container, ctx))
    // Box bodies went through Obsidian's renderer, which ran this post-processor on them.
    if (boxes) return boxes.then(() => inlinePasses(el, ctx))
    inlinePasses(el, ctx)
  }
}
