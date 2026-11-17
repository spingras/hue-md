// mdast-util-from-markdown extension: turns Hue tokens into mdast nodes.
//
//   hueSpan       { style, children: PhrasingContent[] }      -> <span class="hue hue-red">
//   hueBox        { style, title, corners, children: [hueBoxTitle?, ...FlowContent] }
//                                                             -> <div class="hue-box hue-box-red" role="note">
//   hueBoxTitle   { children: PhrasingContent[] }             -> <div class="hue-box-title">
//
// Each node carries `data.hName` / `data.hProperties`, so remark-rehype
// renders it without any custom handler.
import { fromMarkdown } from 'mdast-util-from-markdown'
import { parseSpec, parseTop, stripSide, styleClasses } from 'markdown-it-hue/core'

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

/**
 * @param {() => import('mdast-util-from-markdown').Options} getOptions
 *   the parse options in effect (all micromark + mdast extensions), used to
 *   parse box interiors and titles as nested Markdown
 */
export function hueFromMarkdown (getOptions) {
  return {
    canContainEols: ['hueSpan'],
    enter: { hueSpan: enterSpan, hueBox: enterBox },
    exit: { hueSpanMarker: exitSpanMarker, hueSpan: exitNode, hueBox: exitNode }
  }

  function enterSpan (token) {
    this.enter({ type: 'hueSpan', style: null, children: [] }, token)
  }

  // The first marker ("{red: ") carries the style
  function exitSpanMarker (token) {
    const node = this.stack[this.stack.length - 1]
    if (node.type !== 'hueSpan' || node.style) return
    const raw = this.sliceSerialize(token)
    node.style = parseSpec(raw.slice(1, raw.indexOf(':')))
    node.data = spanData(node.style)
  }

  function enterBox (token) {
    const lines = token._hueLines
    const top = parseTop(lines[0].trimEnd())
    const options = getOptions()
    const interior = fromMarkdown(lines.slice(1, -1).map(stripSide).join('\n'), options)
    for (const child of interior.children) shiftLines(child, token.start.line)

    const children = interior.children
    if (top.title) {
      const parsed = fromMarkdown(top.title, options).children[0]
      const phrasing = parsed && parsed.type === 'paragraph' ? parsed.children : [{ type: 'text', value: top.title }]
      for (const c of phrasing) shiftLines(c, token.start.line - 1)
      children.unshift({ type: 'hueBoxTitle', children: phrasing, data: { hName: 'div', hProperties: { className: ['hue-box-title'] } } })
    }

    const { className } = styleClasses(top.style, 'box')
    this.enter({
      type: 'hueBox',
      style: top.style,
      title: top.title || null,
      corners: top.corners,
      children,
      data: { hName: 'div', hProperties: { className, role: 'note' } }
    }, token)
  }

  function exitNode (token) {
    this.exit(token)
  }
}
