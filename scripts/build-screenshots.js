// Builds raster screenshots (assets/hero-dark.jpg, assets/hero-light.jpg, assets/social-preview.png)
// using the real Hue parser + CSS and headless Edge/Chrome so screenshots never drift from the parser
// or show stale v0.1 syntax / mouse cursors.
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import MarkdownIt from 'markdown-it'
import hue, { css, findInlineHue } from '../src/index.js'
import {
  COLORS,
  PAGE,
  parseTop,
  BOX_BOTTOM,
  BOX_SIDE,
  findBoxColumnStarts,
  TASK_STATES,
  matchProgressBar
} from '../src/core.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '..')
const outDir = join(repo, 'assets')
mkdirSync(outDir, { recursive: true })

const md = new MarkdownIt({ html: false, linkify: true }).use(hue)

const DEMO_SOURCE = `# Hue Markdown (v0.2)

Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}  
Diff: {+: added split boxes & tasks} · {-: removed HTML spans}  
Shortcuts: press [[Ctrl+Shift+V]] for preview · Progress: [========..] 80%

- [x] Ship core v0.2 parser & CLI slide deck
- [-] Verify live side-by-side preview ({blue bg-gray: VS Code & Notepad++})
- [!] Resolve {!: release blocker} before tagging
- [?] Confirm keycap downgrade
- [ ] Announce the release

+-- ok Do This (Recommended)        +-- warn Avoid This
| Keep raw source human-readable.   | Pollute notes with raw \`<span>\` HTML.
| Use semantic colors (\`ok\`, \`!\`).  | Trap docs inside a JSX build step.
+--                                 +--

+-- info Effortless Boxes
| Start with \`+--\` followed by \`info\`, \`ok\`, \`note\`, \`warn\`, or \`!\`.
| Press \`Enter\` inside a box to continue \`| \` on the next line.
+--

+-- ! Never Commit Secrets
| Keep \`.env\` files out of git and rotate leaked keys {!: immediately}.
+--`

function esc (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+\.)\s+)(\[([ xX\-!?])\])(?=\s)/

// Highlights a single line of raw .hue.md exactly as the editor decorations do
function highlightLineHtml (line, mode, state) {
  const cPal = (name) => COLORS[name]?.[mode] || COLORS.gray[mode]
  const pill = (name, text, extra = '') => {
    const c = cPal(name)
    return `<span style="color:${c.fg};background:${c.bg};border-radius:3px;padding:0 2px;${extra}">${esc(text)}</span>`
  }
  const fgSpan = (name, text, bold = false) => {
    const c = cPal(name)
    return `<span style="color:${c.fg};${bold ? 'font-weight:700;' : ''}">${esc(text)}</span>`
  }

  if (line.startsWith('#')) {
    return `<span style="color:${cPal('blue').fg};font-weight:700">${esc(line)}</span>`
  }

  const indent = line.length - line.trimStart().length
  const content = line.slice(indent)

  // Check box top (single or split)
  const colStarts = findBoxColumnStarts(content)
  if (colStarts.length >= 1) {
    const parsedCols = []
    let allValid = true
    for (let k = 0; k < colStarts.length; k++) {
      const segStart = colStarts[k]
      const segEnd = k + 1 < colStarts.length ? colStarts[k + 1] : content.length
      const seg = content.slice(segStart, segEnd)
      const top = parseTop(seg.trimEnd())
      if (!top) { allValid = false; break }
      parsedCols.push({ segStart, segEnd, seg, top })
    }
    if (allValid) {
      state.activeBoxCols = []
      let out = esc(line.slice(0, indent))
      for (const col of parsedCols) {
        const color = col.top.style?.fg || col.top.style?.bg || 'gray'
        const trimmed = col.seg.trimEnd()
        const trail = col.seg.slice(trimmed.length)
        out += fgSpan(color, trimmed, true) + esc(trail)
        state.activeBoxCols.push({ start: col.segStart, color, closed: false })
      }
      return out
    }
  }

  // Check box side or bottom
  if (state.activeBoxCols && state.activeBoxCols.length > 0) {
    let out = esc(line.slice(0, indent))
    const cols = state.activeBoxCols
    for (let k = 0; k < cols.length; k++) {
      const col = cols[k]
      const segStart = col.start
      const segEnd = k + 1 < cols.length ? cols[k + 1].start : content.length
      const rawSeg = k + 1 < cols.length ? content.slice(segStart, segEnd) : content.slice(segStart)
      const trimmed = rawSeg.trimEnd()
      const trail = rawSeg.slice(trimmed.length)
      if (BOX_BOTTOM.test(trimmed)) {
        col.closed = true
        out += fgSpan(col.color, trimmed, true) + esc(trail)
      } else if (BOX_SIDE.test(trimmed)) {
        const barChar = trimmed[0]
        const rest = trimmed.slice(1)
        out += fgSpan(col.color, barChar, true) + highlightInlineHtml(rest, mode) + esc(trail)
      } else {
        out += highlightInlineHtml(rawSeg, mode)
      }
    }
    if (cols.every(c => c.closed)) state.activeBoxCols = null
    return out
  }

  return highlightInlineHtml(line, mode)
}

function highlightInlineHtml (line, mode) {
  const cPal = (name) => COLORS[name]?.[mode] || COLORS.gray[mode]
  const edits = []

  const taskMatch = TASK_LINE_RE.exec(line)
  if (taskMatch) {
    const marker = taskMatch[3]
    const taskState = TASK_STATES[marker]
    if (taskState) {
      const start = taskMatch[1].length
      const end = start + taskMatch[2].length
      const c = cPal(taskState.color)
      edits.push({
        start,
        end,
        html: `<span style="color:${c.fg};background:${c.bg};border-radius:3px;font-weight:700">${esc(taskMatch[2])}</span>`
      })
    }
  }

  if (line.includes('{') || line.includes('[[')) {
    const { spans, diffs, kbds } = findInlineHue(line, { html: false })
    for (const sp of spans) {
      const raw = line.slice(sp.open, sp.close + 1)
      const { fg, bg, fgHex, bgHex } = sp.style
      const fgColor = fgHex || (fg ? cPal(fg).fg : PAGE[mode].text)
      const bgColor = bgHex || (bg ? cPal(bg).bg : (fg ? cPal(fg).bg : 'transparent'))
      edits.push({
        start: sp.open,
        end: sp.close + 1,
        html: `<span style="color:${fgColor};background:${bgColor};border-radius:3px;padding:0 2px">${esc(raw)}</span>`
      })
    }
    for (const df of diffs) {
      const raw = line.slice(df.open, df.close + 1)
      const c = df.kind === 'add' ? cPal('green') : cPal('red')
      const dec = df.kind === 'del' ? 'text-decoration:line-through;' : ''
      edits.push({
        start: df.open,
        end: df.close + 1,
        html: `<span style="color:${c.fg};background:${c.bg};border-radius:3px;padding:0 2px;${dec}">${esc(raw)}</span>`
      })
    }
    for (const kb of kbds) {
      const raw = line.slice(kb.open, kb.close)
      const c = cPal('gray')
      edits.push({
        start: kb.open,
        end: kb.close,
        html: `<span style="color:${c.fg};background:${c.bg};border:1px solid ${c.fg};border-radius:3px;padding:0 2px">${esc(raw)}</span>`
      })
    }
  }

  if (line.includes('[') && line.includes('%')) {
    let searchPos = 0
    while (searchPos < line.length) {
      const idx = line.indexOf('[', searchPos)
      if (idx === -1) break
      const hit = matchProgressBar(line, idx, line.length)
      if (hit) {
        const raw = line.slice(idx, hit.endPos)
        const c = cPal(hit.color)
        edits.push({
          start: idx,
          end: hit.endPos,
          html: `<span style="color:${c.fg};background:${c.bg};border-radius:3px;padding:0 2px">${esc(raw)}</span>`
        })
        searchPos = hit.endPos
      } else {
        searchPos = idx + 1
      }
    }
  }

  edits.sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const e of edits) {
    if (e.start < cursor) continue
    out += esc(line.slice(cursor, e.start)) + e.html
    cursor = e.end
  }
  out += esc(line.slice(cursor))
  return out
}

function buildEditorHtml (mode, titleLeft, titleRight) {
  const isDark = mode === 'dark'
  const bg = isDark ? '#0d1117' : '#ffffff'
  const editorBg = isDark ? '#161b22' : '#f8fafc'
  const barBg = isDark ? '#161b22' : '#f1f5f9'
  const border = isDark ? '#30363d' : '#d0d7de'
  const text = PAGE[mode].text
  const muted = COLORS.gray[mode].fg

  const lines = DEMO_SOURCE.split('\n')
  const state = { activeBoxCols: null }
  const numberedRows = lines.map((line, idx) => {
    const highlighted = highlightLineHtml(line, mode, state) || '&nbsp;'
    return `<div class="line"><span class="ln">${idx + 1}</span><span class="lc">${highlighted}</span></div>`
  }).join('\n')

  return `<!doctype html>
<html lang="en" data-theme="${mode}">
<head>
<meta charset="utf-8">
<style>
${css()}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  background: ${bg};
  color: ${text};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.window {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 1280px;
  height: 720px;
  border: 1px solid ${border};
}
.pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
.pane-left {
  background: ${editorBg};
  border-right: 1px solid ${border};
}
.pane-right {
  background: ${bg};
}
.tabbar {
  height: 36px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${barBg};
  border-bottom: 1px solid ${border};
  font-size: 12.5px;
  font-weight: 600;
  color: ${muted};
}
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.editor {
  padding: 14px 12px;
  font-family: Consolas, "Cascadia Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.4px;
  line-height: 1.52;
  color: ${text};
}
.line {
  display: flex;
  white-space: pre;
}
.ln {
  width: 28px;
  text-align: right;
  padding-right: 12px;
  color: ${muted};
  opacity: 0.65;
  user-select: none;
  flex-shrink: 0;
}
.lc {
  flex: 1;
}
.preview {
  padding: 14px 26px;
  font-size: 14.2px;
  line-height: 1.5;
}
.preview h1 {
  font-size: 1.48em;
  margin: 0.15em 0 0.4em;
  padding-bottom: 0.22em;
  border-bottom: 1px solid ${border};
}
.preview p {
  margin: 0.48em 0;
}
.preview ul.hue-task-list {
  margin: 0.52em 0;
}
.preview code {
  font-family: Consolas, ui-monospace, monospace;
  font-size: 0.88em;
  background: ${ isDark ? 'rgba(127,127,127,0.18)' : '#eef2f6' };
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.preview .hue-box {
  margin: 0.58em 0;
  padding: 0.48em 0.88em;
}
.preview .hue-columns {
  margin: 0.58em 0;
}
.preview .hue-columns > .hue-box {
  margin: 0;
  padding: 0.48em 0.88em;
}
</style>
</head>
<body>
<div class="window">
  <div class="pane pane-left">
    <div class="tabbar">
      <span class="dot" style="background:#ff5f56"></span>
      <span class="dot" style="background:#ffbd2e"></span>
      <span class="dot" style="background:#27c93f"></span>
      <span style="margin-left:6px">${esc(titleLeft)}</span>
    </div>
    <div class="editor">${numberedRows}</div>
  </div>
  <div class="pane pane-right">
    <div class="tabbar">${esc(titleRight)}</div>
    <div class="preview">${md.render(DEMO_SOURCE)}</div>
  </div>
</div>
</body>
</html>`
}

function buildSocialPreviewHtml () {
  const mode = 'light'
  const page = PAGE[mode]
  const pane = '#f6f8fa'
  const line = '#d0d7de'
  const muted = COLORS.gray[mode].fg
  const state = { activeBoxCols: null }
  const shortSource = `# Hue Markdown (v0.2)

Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}  
Diff: {+: added split boxes & tasks} · {-: removed HTML spans}  
Preview: [[Ctrl+Shift+V]] · Progress: [========..] 80%

- [x] Ship core v0.2 parser & CLI slide deck
- [-] Update editor previews ({blue bg-gray: VS Code & Notepad++})
- [!] Resolve {!: release blocker} before tagging

+-- ok Do this                      +-- warn Avoid this
| Keep raw source readable.         | Pollute notes with \`<span>\` HTML.
| Use \`ok\`, \`warn\`, and \`!\`.        | Trap docs in a JSX build step.
+--                                 +--`
  const highlighted = shortSource.split('\n').map(l => highlightLineHtml(l, mode, state) || '&nbsp;').join('\n')

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<style>
${css()}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 1280px;
  height: 640px;
  overflow: hidden;
  background: #ffffff;
  color: ${page.text};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.wrap {
  padding: 32px 44px;
  height: 640px;
  display: flex;
  flex-direction: column;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 6px;
}
.head h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.badge {
  font-family: Consolas, ui-monospace, monospace;
  font-size: 24px;
  font-weight: 700;
  color: #175cd3;
  background: #e0ecfd;
  padding: 4px 14px;
  border-radius: 8px;
}
.sub {
  margin: 0 0 20px;
  font-size: 20px;
  color: ${muted};
}
.card {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  border: 1px solid ${line};
  border-radius: 12px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
}
.pane {
  border: 1px solid ${line};
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bar {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  color: ${muted};
  background: ${pane};
  border-bottom: 1px solid ${line};
}
.src {
  margin: 0;
  padding: 12px 14px;
  flex: 1;
  background: ${pane};
  font-family: Consolas, ui-monospace, monospace;
  font-size: 12.2px;
  line-height: 1.5;
  white-space: pre;
}
.out {
  padding: 6px 18px;
  flex: 1;
  font-size: 13.8px;
  line-height: 1.45;
}
.out h1 { font-size: 1.35em; margin: 0.3em 0; padding-bottom: 0.2em; border-bottom: 1px solid ${line}; }
.out p { margin: 0.42em 0; }
.out ul.hue-task-list { margin: 0.45em 0; }
.out code { font-family: Consolas, monospace; font-size: 0.88em; background: ${pane}; padding: 0.1em 0.3em; border-radius: 4px; }
.out .hue-box, .out .hue-columns { margin: 0.5em 0; }
.out .hue-columns > .hue-box { margin: 0; padding: 0.45em 0.8em; }
</style>
</head>
<body>
<div class="wrap">
  <div class="head"><h1>Hue MD</h1><span class="badge">.hue.md</span></div>
  <p class="sub">Color spans, diffs, tasks, key caps, progress bars, and callout boxes that stay readable as plain text</p>
  <div class="card">
    <div class="pane"><div class="bar">demo.hue.md · plain text, as typed</div><pre class="src">${highlighted}</pre></div>
    <div class="pane"><div class="bar">Rendered by Hue · VS Code, Notepad++, Claude Code, web, terminal</div><div class="out">${md.render(shortSource)}</div></div>
  </div>
</div>
</body>
</html>`
}

function findBrowser () {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error('No headless Chromium browser (Edge or Chrome) found')
}

function renderHtmlToImage (browser, htmlContent, width, height, outPath) {
  const tmpHtml = join(tmpdir(), `hue-shot-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)
  const tmpPng = outPath.endsWith('.png') ? outPath : `${ tmpHtml }.png`
  writeFileSync(tmpHtml, htmlContent, 'utf8')
  try {
    execFileSync(browser, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--window-size=${width},${height}`,
      `--screenshot=${tmpPng}`,
      pathToFileURL(tmpHtml).href
    ], { stdio: 'ignore' })

    if (outPath.endsWith('.jpg')) {
      const psScript = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${tmpPng.replace(/'/g, "''")}')
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]94)
$img.Save('${outPath.replace(/'/g, "''")}', $codec, $ep)
$img.Dispose()
`
      const psBin = existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
        ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        : 'pwsh'
      execFileSync(psBin, ['-NoProfile', '-Command', psScript], { stdio: 'ignore' })
      if (existsSync(tmpPng)) unlinkSync(tmpPng)
    }
  } finally {
    if (existsSync(tmpHtml)) unlinkSync(tmpHtml)
  }
}

const browser = findBrowser()

renderHtmlToImage(
  browser,
  buildEditorHtml('dark', 'demo.hue.md — VS Code Editor', 'Preview demo.hue.md (Ctrl+Shift+V)'),
  1280,
  720,
  join(outDir, 'hero-dark.jpg')
)
console.log('wrote assets/hero-dark.jpg')

renderHtmlToImage(
  browser,
  buildEditorHtml('light', 'demo.hue.md — Notepad++ Editor', 'Docked Live Preview (Ctrl+Shift+H)'),
  1280,
  720,
  join(outDir, 'hero-light.jpg')
)
console.log('wrote assets/hero-light.jpg')

renderHtmlToImage(
  browser,
  buildSocialPreviewHtml(),
  1280,
  640,
  join(outDir, 'social-preview.png')
)
console.log('wrote assets/social-preview.png')
