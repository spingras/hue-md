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
import { hue as hueSyntax } from './syntax.js'
import { hueFromMarkdown } from './from-markdown.js'

export { hueSyntax, hueFromMarkdown }

/**
 * Add Hue Markdown support: spans, boxes and `hue` fences.
 * Produces mdast `hueSpan`, `hueBox` and `hueBoxTitle` nodes that remark-rehype
 * turns into the HTML described in the spec.
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

  // A fenced code block with info string `hue` is Hue content
  return function transformer (tree) {
    unwrapFences(tree)
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
