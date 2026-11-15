// md-hue: core API for Hue Markdown tools.
import MarkdownIt from 'markdown-it'
import hue, { css } from '../../src/index.js'

export { renderAnsi, renderAnsi as renderTerminal } from './ansi.js'
export { downgrade, downgradeSpans, ALERTS } from './downgrade.js'

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Render Hue Markdown to HTML.
 * @param {string} src
 * @param {{ standalone?: boolean, title?: string, html?: boolean }} [opts]
 *   html: allow raw HTML in the source (default false, safer for untrusted input)
 */
export function toHtml (src, { standalone = false, title = 'Hue document', html = false } = {}) {
  const body = new MarkdownIt({ html }).use(hue).render(src)
  if (!standalone) return body
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { font: 16px/1.6 system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 16px; background: #fff; color: #1f2328; }
@media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } }
code { font-size: .9em; }
${css()}</style>
</head>
<body>
${body}</body>
</html>
`
}
