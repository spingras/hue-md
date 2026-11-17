// Builds the launch demo clip (assets/demo.gif and assets/demo.mp4) from the real parser,
// stylesheet and CLI, so the clip never shows syntax the parser doesn't support.
//
// Scene 1: raw .hue.md typed on the left, live preview on the right.
// Scene 2: the same file in the terminal with `hue-md view`.
// Scene 3: end card with the links.
//
// Needs headless Edge or Chrome and ffmpeg on PATH. Run: node scripts/build-demo-clip.js
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execFile, execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'
import { COLORS, PAGE } from '../src/palette.js'

const run = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '..')
const outDir = join(repo, 'assets')
const work = join(tmpdir(), `hue-clip-${Date.now()}`)
mkdirSync(work, { recursive: true })

const W = 1280
const H = 720
const FPS = 12
const md = new MarkdownIt({ html: false, linkify: true }).use(hue)
const hueCss = readFileSync(join(repo, 'dist', 'hue-md.css'), 'utf8')
const dark = (n) => COLORS[n].dark

const SOURCE = `# Release 0.3

Build: {ok: passing} · Deploy: {!: blocked}

Press [[Ctrl+Shift+V]] · [=======...] 70%

- [x] Parser
- [-] Docs
- [!] Signing key

+-- warn Before you merge
| Run the migration on {warn: staging} first.
+--`

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Light editor-style coloring of raw source: just enough to look like an editor, raw text unchanged.
function highlightRaw (text) {
  return text.split('\n').map((line) => {
    if (line.startsWith('#')) return `<span style="color:${dark('blue').fg};font-weight:700">${esc(line)}</span>`
    if (/^(\+--|\|)/.test(line)) {
      const m = line.match(/^(\+--|\|)(.*)$/)
      return `<span style="color:${dark('orange').fg}">${esc(m[1])}</span>${inlineRaw(m[2])}`
    }
    return inlineRaw(line)
  }).join('\n')
}
function inlineRaw (s) {
  return esc(s)
    .replace(/\{(ok|warn|!): ([^}]*)\}/g, (_, t, x) => {
      const c = dark(t === 'ok' ? 'green' : t === 'warn' ? 'orange' : 'red').fg
      return `<span style="color:${PAGE.dark.text};opacity:.55">{${t}:</span> <span style="color:${c}">${x}</span><span style="opacity:.55">}</span>`
    })
    .replace(/\[\[([^\]]+)\]\]/g, `<span style="color:${dark('purple').fg}">[[$1]]</span>`)
    .replace(/^(- )\[(.)\]/, (_, a, s2) => {
      const n = { x: 'green', '-': 'blue', '!': 'red' }[s2] || 'gray'
      return `${a}<span style="color:${dark(n).fg}">[${s2}]</span>`
    })
}

const BASE_CSS = `
${hueCss}
* { box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #010409;
  color: ${PAGE.dark.text}; font-family: "Segoe UI", -apple-system, Helvetica, Arial, sans-serif; }
.win { position: absolute; inset: 28px; border-radius: 12px; overflow: hidden; background: ${PAGE.dark.bg};
  border: 1px solid #30363d; box-shadow: 0 20px 60px rgba(0,0,0,.6); display: flex; flex-direction: column; }
.bar { height: 40px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center;
  padding: 0 16px; gap: 8px; font-size: 15px; color: #8b949e; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.bar .title { margin-left: 14px; }
.panes { flex: 1; display: flex; min-height: 0; }
.pane { flex: 1; padding: 26px 30px; overflow: hidden; }
.raw { border-right: 1px solid #30363d; font-family: Consolas, "Cascadia Mono", monospace; font-size: 21px;
  line-height: 1.55; white-space: pre; }
.label { font: 600 12px "Segoe UI", sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #6e7681; margin-bottom: 14px; }
.preview { font-size: 21px; line-height: 1.5; }
.preview h1 { font-size: 32px; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid #30363d; }
.preview p { margin: 0 0 12px; }
.preview ul { margin: 0 0 14px; padding-left: 4px; list-style: none; }
.preview .hue-box { margin: 0; }
.cursor { display: inline-block; width: 2px; height: 1.15em; background: #58a6ff; vertical-align: text-bottom; }
.term { flex: 1; padding: 26px 32px; font-family: Consolas, "Cascadia Mono", monospace; font-size: 20px;
  line-height: 1.45; white-space: pre; }
.prompt { color: ${dark('green').fg}; }
`

const bar = (title) => `<div class="bar"><span class="dot" style="background:#ff5f57"></span>
<span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>
<span class="title">${esc(title)}</span></div>`

function page (body) {
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<style>${BASE_CSS}</style></head><body>${body}</body></html>`
}

function editorFrame (typed) {
  return page(`<div class="win">${bar('notes.hue.md — raw text and live preview')}
<div class="panes">
  <div class="pane raw"><div class="label">notes.hue.md</div>${highlightRaw(typed)}<span class="cursor"></span></div>
  <div class="pane preview"><div class="label">Preview</div>${md.render(typed)}</div>
</div></div>`)
}

// Minimal ANSI SGR to HTML (bold, dim, italic, underline, strike, 24-bit colors).
function ansiToHtml (s) {
  let st = {}
  let out = ''
  const open = () => {
    const css = []
    if (st.fg) css.push(`color:${st.fg}`)
    if (st.bg) css.push(`background:${st.bg}`)
    if (st.b) css.push('font-weight:700')
    if (st.d) css.push('opacity:.6')
    if (st.i) css.push('font-style:italic')
    const deco = [st.u && 'underline', st.s && 'line-through'].filter(Boolean)
    if (deco.length) css.push(`text-decoration:${deco.join(' ')}`)
    return css.length ? `<span style="${css.join(';')}">` : '<span>'
  }
  for (const part of s.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/)
    if (!m) { if (part) out += open() + esc(part) + '</span>'; continue }
    const codes = (m[1] || '0').split(';').map(Number)
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]
      if (c === 0) st = {}
      else if (c === 1) st.b = true
      else if (c === 2) st.d = true
      else if (c === 3) st.i = true
      else if (c === 4) st.u = true
      else if (c === 9) st.s = true
      else if (c === 22) { st.b = false; st.d = false }
      else if (c === 23) st.i = false
      else if (c === 24) st.u = false
      else if (c === 29) st.s = false
      else if (c === 39) st.fg = null
      else if (c === 49) st.bg = null
      else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
        const rgb = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`
        if (c === 38) st.fg = rgb; else st.bg = rgb
        i += 4
      }
    }
  }
  return out
}

const srcFile = join(work, 'notes.hue.md')
writeFileSync(srcFile, SOURCE, 'utf8')
const viewAnsi = execFileSync(process.execPath, [join(repo, 'bin', 'hue-md.js'), 'view', srcFile,
  '--width', '80', '--theme', 'dark', '--color', 'always'], { encoding: 'utf8' })

function termFrame (cmd, output) {
  return page(`<div class="win">${bar('Terminal')}
<div class="term"><span class="prompt">$</span> ${esc(cmd)}${output == null ? '<span class="cursor"></span>' : '\n\n' + output}</div></div>`)
}

function endFrame () {
  return page(`<div class="win" style="align-items:center;justify-content:center;text-align:center">
<div style="font-size:64px;font-weight:800;letter-spacing:-.02em">Hue MD</div>
<div style="font-size:34px;font-weight:600;margin:8px 0 12px">Markdown that shows what matters.</div>
<div style="font-size:24px;color:#8b949e;line-height:1.45;margin:0 0 34px">Status, warnings and progress at a glance,<br>and it still reads fine as plain text.</div>
<div style="font-family:Consolas,monospace;font-size:22px;line-height:1.8">
<span style="color:${dark('green').fg}">VS Code · Cursor · Notepad++ · Obsidian · Neovim · terminal · GitHub</span><br>
<span style="color:${dark('blue').fg}">spingras.github.io/hue-md</span> · MIT</div></div>`)
}

// ---- frame list: [html, seconds]
const frames = []
const STEP = 4
for (let i = 0; i <= SOURCE.length; i += STEP) {
  frames.push([editorFrame(SOURCE.slice(0, i)), 1 / FPS])
}
frames.push([editorFrame(SOURCE), 3])

const CMD = 'npx hue-md view notes.hue.md'
for (let i = 0; i <= CMD.length; i += 3) frames.push([termFrame(CMD.slice(0, i), null), 1 / FPS])
frames.push([termFrame(CMD, ansiToHtml(viewAnsi)), 3.5])
frames.push([endFrame(), 3])

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(existsSync)
if (!browser) throw new Error('No headless Chromium browser (Chrome or Edge) found')

async function shoot (html, n) {
  const htmlPath = join(work, `f${n}.html`)
  const png = join(work, `f${String(n).padStart(4, '0')}.png`)
  writeFileSync(htmlPath, html, 'utf8')
  await run(browser, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${join(work, `profile${n % 6}`)}`,
    `--window-size=${W},${H}`, `--screenshot=${png}`, pathToFileURL(htmlPath).href])
  return png
}

const pngs = new Array(frames.length)
let next = 0
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < frames.length) {
    const n = next++
    pngs[n] = await shoot(frames[n][0], n)
  }
}))
console.log(`rendered ${frames.length} frames`)

// ffmpeg concat list with per-frame durations (last file repeated, as the concat demuxer requires).
const list = frames.map(([, d], n) => `file '${pngs[n].replace(/\\/g, '/')}'\nduration ${d.toFixed(4)}`).join('\n') +
  `\nfile '${pngs[pngs.length - 1].replace(/\\/g, '/')}'\n`
const listFile = join(work, 'list.txt')
writeFileSync(listFile, list, 'utf8')

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', join(outDir, 'demo.mp4')])
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf',
  `fps=${FPS},scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
  join(outDir, 'demo.gif')])

rmSync(work, { recursive: true, force: true })
console.log('wrote assets/demo.mp4 and assets/demo.gif')
