// Hero and box images whose "rendered" half is real output of the Hue renderer.
// The SVG embeds HTML in a <foreignObject>, so the browser lays out the text
// (no hand-placed coordinates) and the picture can never drift from the parser.
//
// usage: node scripts/build-hero.js [repo-root] [out-dir]
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(process.argv[2] || join(__dirname, '..'))
const out = resolve(process.argv[3] || join(repo, 'assets'))
const imp = (p) => import(pathToFileURL(join(repo, p)).href)
const { default: MarkdownIt } = await import(pathToFileURL(join(repo, 'node_modules/markdown-it/index.mjs')).href)
const { default: hue, css } = await imp('src/index.js')
const { PAGE, COLORS } = await imp('src/palette.js')

const SOURCE = `# Release notes (v0.2)

Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}  
Diff: {+: added split boxes & tasks} · {-: removed HTML spans}  
Preview: [[Ctrl+Shift+V]] · Progress: [========..] 80%

- [x] Ship core v0.2 parser & CLI slide deck
- [-] Update editor previews ({blue bg-gray: VS Code & Notepad++})
- [!] Resolve {!: release blocker} before tagging
- [?] Confirm keycap downgrade
- [ ] Announce the release

+-- ok Do this                      +-- warn Avoid this
| Keep raw source readable.         | Pollute notes with \`<span>\` HTML.
| Use \`ok\`, \`warn\`, and \`!\`.        | Trap docs in a JSX build step.
+--                                 +--

+-- ! Never commit secrets
| Keep \`.env\` out of git and rotate leaked keys {!: immediately}.
+--`

const BOXES_SOURCE = `+-- info Effortless Boxes
| Start with \`+--\` followed by \`info\`, \`ok\`, \`note\`, \`warn\`, or \`!\`.
| Every \`|\` line automatically starts on a new line.
+--

+-- ok Full Markdown Inside
| Boxes support **bold**, *italics*, \`inline code\`, and {ok: colored spans}.
+--

+-- note GitHub Ready
| Run \`hue-md downgrade\` to convert Hue boxes into native GitHub Alerts.
+--

+-- warn Heads Up
| Public API endpoints are rate-limited to {warn: 100 requests/min}.
+--

+-- ! Never Commit Secrets
| Keep \`.env\` files out of git and rotate leaked keys {!: immediately}.
+--`

const WIDTH = 1200
const HEIGHT = 560

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const md = new MarkdownIt({ xhtmlOut: true }).use(hue)

function hero (mode) {
  const page = PAGE[mode]
  const pane = mode === 'dark' ? '#161b22' : '#f6f8fa'
  const line = mode === 'dark' ? '#30363d' : '#d0d7de'
  const muted = COLORS.gray[mode].fg
  const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`
  const mono = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" data-theme="${mode}">
<title>Hue Markdown: the plain-text source on the left, how Hue renders it on the right</title>
<foreignObject x="0" y="0" width="${WIDTH}" height="${HEIGHT}">
<div xmlns="http://www.w3.org/1999/xhtml" class="frame">
<style>
${css()}
.frame { box-sizing: border-box; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 18px; display: flex; gap: 18px;
  background: ${page.bg}; color: ${page.text}; font: 14.5px/1.48 ${sans}; border: 1px solid ${line}; border-radius: 12px; }
.pane { flex: 1; min-width: 0; border: 1px solid ${line}; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.bar { padding: 7px 14px; font: 600 12px/1.4 ${sans}; color: ${muted}; background: ${pane}; border-bottom: 1px solid ${line}; letter-spacing: .02em; }
.src { margin: 0; padding: 12px 16px; flex: 1; background: ${pane}; font: 12.4px/1.48 ${mono}; white-space: pre-wrap; color: ${page.text}; }
.out { padding: 4px 20px 12px; flex: 1; }
.out h1 { font-size: 1.45em; margin: .4em 0 .35em; padding-bottom: .22em; border-bottom: 1px solid ${line}; }
.out p { margin: .45em 0; }
.out ul.hue-task-list { margin: .5em 0; }
.out code { font: .88em ${mono}; background: ${pane}; padding: .1em .35em; border-radius: 4px; }
.out .hue-box { margin: .6em 0; padding: .48em .85em; }
.out .hue-columns { margin: .6em 0; }
.out .hue-columns > .hue-box { margin: 0; padding: .48em .85em; }
</style>
<div class="pane"><div class="bar">release.hue.md · plain text, as typed</div><pre class="src">${esc(SOURCE)}</pre></div>
<div class="pane"><div class="bar">Rendered by Hue · VS Code, Notepad++, Claude Code, web, terminal</div><div class="out">${md.render(SOURCE)}</div></div>
</div>
</foreignObject>
</svg>
`
}

function boxesSvg (mode) {
  const page = PAGE[mode]
  const pane = mode === 'dark' ? '#161b22' : '#f6f8fa'
  const line = mode === 'dark' ? '#30363d' : '#d0d7de'
  const muted = COLORS.gray[mode].fg
  const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`
  const mono = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`
  const h = 470
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}" viewBox="0 0 ${WIDTH} ${h}" data-theme="${mode}">
<title>Hue Markdown: all 5 semantic callout boxes (info, ok, note, warn, !)</title>
<foreignObject x="0" y="0" width="${WIDTH}" height="${h}">
<div xmlns="http://www.w3.org/1999/xhtml" class="frame">
<style>
${css()}
.frame { box-sizing: border-box; width: ${WIDTH}px; height: ${h}px; padding: 18px; display: flex; gap: 18px;
  background: ${page.bg}; color: ${page.text}; font: 14px/1.45 ${sans}; border: 1px solid ${line}; border-radius: 12px; }
.pane { flex: 1; min-width: 0; border: 1px solid ${line}; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.bar { padding: 7px 14px; font: 600 12px/1.4 ${sans}; color: ${muted}; background: ${pane}; border-bottom: 1px solid ${line}; }
.src { margin: 0; padding: 12px 16px; flex: 1; background: ${pane}; font: 12.2px/1.45 ${mono}; white-space: pre-wrap; color: ${page.text}; }
.out { padding: 8px 18px; flex: 1; }
.out code { font: .88em ${mono}; background: ${pane}; padding: .1em .35em; border-radius: 4px; }
.out .hue-box { margin: .55em 0; padding: .48em .9em; }
</style>
<div class="pane"><div class="bar">5 semantic callout boxes · raw plain text</div><pre class="src">${esc(BOXES_SOURCE)}</pre></div>
<div class="pane"><div class="bar">Rendered output · info, ok, note, warn, !</div><div class="out">${md.render(BOXES_SOURCE)}</div></div>
</div>
</foreignObject>
</svg>
`
}

mkdirSync(out, { recursive: true })
for (const mode of ['light', 'dark']) {
  writeFileSync(join(out, `hero-${mode}.svg`), hero(mode))
  writeFileSync(join(out, `boxes-${mode}.svg`), boxesSvg(mode))
  console.log('wrote', join(out, `hero-${mode}.svg`), 'and', join(out, `boxes-${mode}.svg`))
}
