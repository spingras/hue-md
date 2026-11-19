// Hue MD on github.com: renders Hue in every rendered Markdown view (files,
// READMEs, issues, pull requests, comments).
//
// Built by scripts/build.mjs into extension/content.js (Chrome / Edge / Firefox
// extension) and userscript/hue-md.user.js (Tampermonkey / Violentmonkey).
// GitHub renders Markdown on the server, so this works on the HTML it sends,
// with the shared DOM pass in src/dom.js and the real Hue parser.

import MarkdownIt from 'markdown-it'
import hue from '../../../src/index.js'
import { createPostProcessor } from '../../../src/dom.js'

// Box bodies and ```hue fences are rendered with the real Hue markdown-it plugin.
// The input is rebuilt from GitHub's own (already sanitized) HTML, so inline
// HTML in it is GitHub's markup.
const md = new MarkdownIt({ html: true, linkify: true }).use(hue)

function render (markdown, container) {
  container.innerHTML = md.render(markdown)
}

const processor = createPostProcessor({ render })

const SELECTOR = '.markdown-body'

// ```hue fences: GitHub shows them as code (<pre lang="hue">); render the content as Hue.
function renderHueFences (root) {
  for (const pre of Array.from(root.querySelectorAll('pre[lang="hue"], .highlight-source-hue > pre'))) {
    const wrapper = pre.closest('.snippet-clipboard-content, .highlight') || pre
    if (!root.contains(wrapper)) continue
    const div = root.ownerDocument.createElement('div')
    div.className = 'hue-fence'
    render(pre.textContent, div)
    wrapper.replaceWith(div)
  }
}

export async function renderHue (root) {
  renderHueFences(root)
  await processor(root, null)
}

// Renders every Markdown view in `doc` once. Running it again is harmless: the
// passes skip what they already rendered.
export async function processDocument (doc) {
  for (const el of Array.from(doc.querySelectorAll(SELECTOR))) {
    if (el.parentElement && el.parentElement.closest(SELECTOR)) continue
    await renderHue(el)
  }
}

function injectStyles (doc, css) {
  if (!css) return
  if (typeof GM_addStyle === 'function') { GM_addStyle(css); return } // eslint-disable-line no-undef
  const style = doc.createElement('style')
  style.id = 'hue-md-styles'
  style.textContent = css
  ;(doc.head || doc.documentElement).appendChild(style)
}

// GitHub swaps page content without full loads (Turbo, React): watch for new
// Markdown and render it. Changes made during a run (GitHub's or this script's
// own) trigger one more run; a run that finds nothing new changes nothing, so
// it stops there.
export function start (win) {
  const doc = win.document
  // The userscript build inlines the stylesheet; the extension loads hue.css from its manifest.
  injectStyles(doc, typeof __HUE_CSS__ === 'string' ? __HUE_CSS__ : null) // eslint-disable-line no-undef

  let running = false
  let again = false
  let timer = null
  const observer = new win.MutationObserver(() => schedule())

  async function run () {
    if (running) { again = true; return }
    running = true
    try {
      await processDocument(doc)
    } catch (error) {
      console.error('[hue-md]', error)
    } finally {
      running = false
      if (again) { again = false; schedule() }
    }
  }

  function schedule () {
    if (timer) return
    timer = win.setTimeout(() => { timer = null; run() }, 50)
  }

  for (const ev of ['turbo:render', 'turbo:load', 'pjax:end']) doc.addEventListener(ev, schedule)
  observer.observe(doc.body, { childList: true, subtree: true })
  return run()
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.__HUE_MD_NO_AUTOSTART__) {
  start(window)
}
