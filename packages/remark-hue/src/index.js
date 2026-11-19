// remark-hue: remark plugin for Hue Markdown (spec: spec/spec.md).
//
//   import { unified } from 'unified'
//   import remarkParse from 'remark-parse'
//   import remarkHue from 'remark-hue'
//   import remarkRehype from 'remark-rehype'
//   import rehypeStringify from 'rehype-stringify'
//
//   unified().use(remarkParse).use(remarkHue).use(remarkRehype).use(rehypeStringify)
import { fromMarkdown } from 'mdast-util-from-markdown'
import { TASK_STATES } from 'markdown-it-hue/core'
import { hue as hueSyntax } from './syntax.js'
import { hueFromMarkdown } from './from-markdown.js'

export { hueSyntax, hueFromMarkdown }

/**
 * Add Hue Markdown support: spans, diff spans, key caps, progress bars, tasks,
 * boxes, side-by-side boxes and `hue` fences. Produces mdast nodes (`hueSpan`,
 * `hueDiff`, `hueKbd`, `hueProgress`, `hueBox`, `hueBoxTitle`, `hueColumns`;
 * tasks are `listItem`s with Hue classes) that remark-rehype turns into the
 * HTML described in the spec.
 */
export default function remarkHue () {
  const data = this.data()
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])

  // Nested parses (box interiors, titles, hue fences) use every extension in
  // effect, including ones added by plugins after this one.
  const options = () => ({ extensions: micromarkExtensions, mdastExtensions: fromMarkdownExtensions })

  micromarkExtensions.push(hueSyntax())
  fromMarkdownExtensions.push(hueFromMarkdown(options))

  // A fenced code block with info string `hue` is Hue content; then tasks,
  // which also reach into boxes and unwrapped fences.
  return function transformer (tree) {
    unwrapFences(tree)
    tasks(tree, null)
  }

  function unwrapFences (parent) {
    if (!parent.children) return
    for (let i = 0; i < parent.children.length; i++) {
      const node = parent.children[i]
      if (node.type === 'code' && node.lang === 'hue') {
        const replacement = fromMarkdown(node.value, options()).children
        parent.children.splice(i, 1, ...replacement)
        i-- // revisit: the replacement may hold more fences
        continue
      }
      unwrapFences(node)
    }
  }
}

// ---------------------------------------------------------------- tasks

// `- [-] text`: a list item whose first paragraph starts with a task marker and
// whitespace, as in the markdown-it plugin (hue_tasks in src/index.js). A
// defined reference `[x]` is a link, not text, so it never becomes a task.
const TASK_RE = /^\[([ xX\-!?])\](\s+)/

function tasks (node, list) {
  if (!node.children) return
  if (node.type === 'listItem') markTask(node, list)
  for (const child of node.children) tasks(child, node.type === 'list' ? node : list)
}

function markTask (item, list) {
  const para = item.children[0]
  const first = para && para.type === 'paragraph' && para.children[0]
  if (!first || first.type !== 'text') return
  const m = TASK_RE.exec(first.value)
  if (!m) return
  const info = TASK_STATES[m[1]]
  first.value = first.value.slice(m[0].length)
  if (!first.value) para.children.shift()
  para.children.unshift({
    type: 'hueTaskBox',
    state: info.name,
    data: {
      hName: 'span',
      hProperties: { className: ['hue-task-box', `hue-task-box-${info.name}`], ariaHidden: 'true' },
      hChildren: [{ type: 'text', value: decodeSymbol(info.htmlSymbol) }]
    }
  }, { type: 'text', value: ' ' })
  addClass(item, 'hue-task', `hue-task-${info.name}`)
  if (list) addClass(list, 'hue-task-list')
}

const decodeSymbol = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

function addClass (node, ...names) {
  const data = node.data || (node.data = {})
  const props = data.hProperties || (data.hProperties = {})
  const classes = props.className ? [].concat(props.className) : []
  for (const n of names) if (!classes.includes(n)) classes.push(n)
  props.className = classes
}
