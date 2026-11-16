// md-hue: core API for Hue Markdown tools.
import MarkdownIt from 'markdown-it'
import hue, { css } from '../../src/index.js'

export { renderAnsi, renderAnsi as renderTerminal, parseSlides, renderSlides } from './ansi.js'
export { downgrade, downgradeSpans, ALERTS } from './downgrade.js'

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const LEGACY_FALLBACK_CSS = `
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
th { background: #f6f8fa; }
code { font-family: Consolas, Menlo, monospace; font-size: .9em; background: #f2f4f7; padding: 1px 4px; border-radius: 3px; }
.hue-task-list { list-style: none; padding-left: 4px; }
.hue-task { margin: 6px 0; }
.hue-task-box { display: inline-block; min-width: 18px; text-align: center; border-radius: 4px; font-size: 0.85em; font-weight: 700; margin-right: 6px; padding: 0 3px; border: 1px solid #57606a; color: #57606a; background: #eef0f2; }
.hue-task-box-progress { border-color: #175cd3; color: #175cd3; background: #e0ecfd; }
.hue-task-box-blocked { border-color: #b42318; color: #b42318; background: #fde8e7; }
.hue-task-box-question { border-color: #6941c6; color: #6941c6; background: #efe7fd; }
.hue-task-box-done { border-color: #067647; color: #067647; background: #dcf5e7; }
.hue-columns { display: -ms-flexbox; display: flex; -ms-flex-wrap: nowrap; flex-wrap: nowrap; width: 100%; margin: 14px 0; }
.hue-columns > .hue-box { -ms-flex: 1 1 0px; flex: 1 1 0px; margin: 0; }
.hue-columns > .hue-box + .hue-box { margin-left: 16px; }
.hue-kbd { display: inline-block; padding: 1px 6px; font-size: 0.84em; font-family: Consolas, Menlo, monospace; color: #1f2328; background: #f2f4f7; border: 1px solid #98a2b3; border-bottom-width: 2px; border-radius: 4px; }
.hue-progress { display: inline-block; vertical-align: middle; white-space: nowrap; }
.hue-progress-track { display: inline-block; width: 72px; height: 8px; background: #eef0f2; border-radius: 99px; overflow: hidden; border: 1px solid #d0d7de; vertical-align: middle; margin-right: 6px; }
.hue-progress-fill { display: block; height: 100%; background: #175cd3; }
.hue-progress-green .hue-progress-fill { background: #067647; }
.hue-progress-blue .hue-progress-fill { background: #175cd3; }
.hue-progress-orange .hue-progress-fill { background: #b54708; }
.hue-progress-red .hue-progress-fill { background: #b42318; }
.hue-progress-label { font-size: 0.85em; font-weight: 600; vertical-align: middle; }
ins.hue-diff-add { color: #067647; background: #dcf5e7; text-decoration: none; padding: 1px 4px; border-radius: 3px; font-weight: 600; }
del.hue-diff-del { color: #b42318; background: #fde8e7; text-decoration: line-through; padding: 1px 4px; border-radius: 3px; }
`

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
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { font: 16px/1.6 system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 16px; background: #fff; color: #1f2328; }
@media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } th, td { border-color: #30363d; } th { background: #161b22; } code { background: #21262d; color: #e6edf3; } }
${LEGACY_FALLBACK_CSS}
${css()}</style>
</head>
<body>
${body}</body>
</html>
`
}
