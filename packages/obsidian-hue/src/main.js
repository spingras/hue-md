// Hue MD for Obsidian. Built into ../main.js by scripts/build.mjs.

import { MarkdownRenderChild, MarkdownRenderer, Plugin } from 'obsidian'
import { createPostProcessor } from '../../../src/dom.js'

const BOXES = [
  { id: 'info', label: 'info box (+-- info)', token: 'info', title: 'Pro Tip' },
  { id: 'ok', label: 'success box (+-- ok)', token: 'ok', title: 'Success' },
  { id: 'note', label: 'note box (+-- note)', token: 'note', title: 'Important Detail' },
  { id: 'warn', label: 'warning box (+-- warn)', token: 'warn', title: 'Heads Up' },
  { id: 'danger', label: 'danger box (+-- !)', token: '!', title: 'Critical Warning' }
]

export default class HueMdPlugin extends Plugin {
  async onload () {
    const app = this.app

    // Obsidian's own renderer, for box bodies and ```hue fences. It runs every
    // post-processor again on what it renders, Hue's included.
    const render = async (markdown, container, ctx) => {
      const child = new MarkdownRenderChild(container)
      if (ctx && typeof ctx.addChild === 'function') ctx.addChild(child)
      else this.addChild(child)
      const sourcePath = (ctx && ctx.sourcePath) || ''
      if (typeof MarkdownRenderer.render === 'function') {
        await MarkdownRenderer.render(app, markdown, container, sourcePath, child)
      } else {
        await MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, child)
      }
    }

    const isResolved = (target, ctx) => {
      const cache = app.metadataCache
      if (!cache || typeof cache.getFirstLinkpathDest !== 'function') return false
      return !!cache.getFirstLinkpathDest(target, (ctx && ctx.sourcePath) || '')
    }

    this.registerMarkdownPostProcessor(createPostProcessor({ render, isResolved }))

    // ```hue fences render their content as Hue, like every other Hue surface.
    this.registerMarkdownCodeBlockProcessor('hue', async (source, el, ctx) => {
      el.classList.add('hue-fence')
      await render(source, el, ctx)
    })

    for (const k of BOXES) {
      this.addCommand({
        id: 'insert-box-' + k.id,
        name: 'Insert ' + k.label,
        editorCallback: (editor) => {
          const sel = editor.getSelection()
          const body = sel
            ? sel.split(/\r?\n/).map((l) => '| ' + l).join('\n')
            : '| First point\n| Second point'
          editor.replaceSelection(`+-- ${k.token} ${k.title}\n${body}\n+--\n`)
        }
      })
    }

    this.addCommand({
      id: 'insert-split-box',
      name: 'Insert side-by-side boxes (+-- ok / +-- warn)',
      editorCallback: (editor) => {
        editor.replaceSelection([
          '+-- ok Do this                    +-- warn Avoid this',
          '| First point                     | First point',
          '+--                               +--',
          ''
        ].join('\n'))
      }
    })
  }
}
