// mdast-util-from-markdown extension: turns Hue tokens into mdast nodes.
//
//   hueSpan       { style, children: PhrasingContent[] }      -> <span class="hue hue-red">
//   hueDiff       { kind: 'add' | 'del', children }           -> <ins class="hue hue-diff-add"> / <del class="hue hue-diff-del">
//   hueKbd        { value }                                   -> <kbd class="hue-kbd">
//   hueProgress   { pct, color }                              -> <span class="hue-progress …" role="progressbar">
//   hueBox        { style, title, corners, children: [hueBoxTitle?, ...FlowContent] }
//                                                             -> <div class="hue-box hue-box-red" role="note">
//   hueBoxTitle   { children: PhrasingContent[] }             -> <div class="hue-box-title">
//   hueColumns    { children: hueBox[] }                      -> <div class="hue-columns hue-columns-2">
//
// Each node carries `data.hName` / `data.hProperties` (and `data.hChildren`
// for leaves), so remark-rehype renders it without any custom handler.
import { fromMarkdown } from 'mdast-util-from-markdown'
import { matchProgressBar, parseSpec, parseSplitBoxes, parseTop, stripSide, styleClasses } from 'markdown-it-hue/core'
import { isDiffSpec } from './syntax.js'

function spanData (style) {
  const { className, style: css } = styleClasses(style, 'span')
  return { hName: 'span', hProperties: css ? { className, style: css } : { className } }
}

// Shift positions of a nested parse so they point into the outer document (by line).
function shiftLines (node, by) {
  if (node.position) {
    node.position = {
      start: { line: node.position.start.line + by, column: node.position.start.column },
      end: { line: node.position.end.line + by, column: node.position.end.column }
    }
  }
  if (node.children) for (const c of node.children) shiftLines(c, by)
}

const text = (value) => ({ type: 'text', value })
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children })

/**
 * @param {() => import('mdast-util-from-markdown').Options} getOptions
 *   the parse options in effect (all micromark + mdast extensions), used to
 *   parse box interiors and titles as nested Markdown
 */
export function hueFromMarkdown (getOptions) {
  return {
    canContainEols: ['hueSpan', 'hueDiff'],
    enter: { hueSpan: enterSpan, hueBox: enterBox, hueKbd: enterKbd, hueProgress: enterProgress },
    exit: { hueSpanMarker: exitSpanMarker, hueSpan: exitNode, hueBox: exitNode, hueKbd: exitNode, hueProgress: exitNode }
  }

  function enterSpan (token) {
    this.enter({ type: 'hueSpan', style: null, children: [] }, token)
  }

  // The first marker ("{red: " or "{+: ") carries the style
  function exitSpanMarker (token) {
    const node = this.stack[this.stack.length - 1]
    if (node.type !== 'hueSpan' || node.data) return
    const raw = this.sliceSerialize(token)
    const spec = raw.slice(1, raw.indexOf(':'))
    if (isDiffSpec(spec)) {
      const kind = spec.trim() === '+' ? 'add' : 'del'
      node.type = 'hueDiff'
      node.kind = kind
      delete node.style
      node.data = { hName: kind === 'add' ? 'ins' : 'del', hProperties: { className: ['hue', `hue-diff-${kind}`] } }
      return
    }
    node.style = parseSpec(spec)
    node.data = spanData(node.style)
  }

  function enterKbd (token) {
    const raw = this.sliceSerialize(token)
    const value = raw.slice(2, -2)
    this.enter({ type: 'hueKbd', value, data: { hName: 'kbd', hProperties: { className: ['hue-kbd'] }, hChildren: [text(value)] } }, token)
  }

  function enterProgress (token) {
    const raw = this.sliceSerialize(token)
    const { pct, color } = matchProgressBar(raw, 0, raw.length)
    this.enter({
      type: 'hueProgress',
      pct,
      color,
      data: {
        hName: 'span',
        hProperties: { className: ['hue-progress', `hue-progress-${color}`], role: 'progressbar', ariaValueNow: String(pct), ariaValueMin: '0', ariaValueMax: '100' },
        hChildren: [
          el('span', { className: ['hue-progress-track'] }, [el('span', { className: ['hue-progress-fill'], style: `width:${pct}%` })]),
          el('span', { className: ['hue-progress-label'] }, [text(`${pct}%`)])
        ]
      }
    }, token)
  }

  // One box node from its parsed top line and interior lines (sides stripped).
  function boxNode (top, inner, line) {
    const options = getOptions()
    const interior = fromMarkdown(inner.join('\n'), options)
    for (const child of interior.children) shiftLines(child, line)

    const children = interior.children
    if (top.title) {
      const parsed = fromMarkdown(top.title, options).children[0]
      const phrasing = parsed && parsed.type === 'paragraph' ? parsed.children : [text(top.title)]
      for (const c of phrasing) shiftLines(c, line - 1)
      children.unshift({ type: 'hueBoxTitle', children: phrasing, data: { hName: 'div', hProperties: { className: ['hue-box-title'] } } })
    }

    const { className } = styleClasses(top.style, 'box')
    return {
      type: 'hueBox',
      style: top.style,
      title: top.title || null,
      corners: top.corners,
      children,
      data: { hName: 'div', hProperties: { className, role: 'note' } }
    }
  }

  function enterBox (token) {
    const lines = token._hueLines
    if (token._hueSplit) {
      const { cols } = parseSplitBoxes(lines)
      this.enter({
        type: 'hueColumns',
        children: cols.map((col) => boxNode(col.top, col.inner, token.start.line)),
        data: { hName: 'div', hProperties: { className: ['hue-columns', `hue-columns-${cols.length}`] } }
      }, token)
      return
    }
    this.enter(boxNode(parseTop(lines[0].trimEnd()), lines.slice(1, -1).map(stripSide), token.start.line), token)
  }

  function exitNode (token) {
    this.exit(token)
  }
}
