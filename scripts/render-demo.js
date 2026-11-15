// Builds the playground page (site/ for GitHub Pages, demo/ for local use).
// The page's live output is produced by the real Hue packages, bundled from
// scripts/playground-entry.js, so it can never differ from what users install.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import MarkdownIt from 'markdown-it'
import hue, { css } from '../src/index.js'

const url = (p) => new URL(p, import.meta.url)
const md = new MarkdownIt().use(hue)
const src = readFileSync(url('../demo/demo.hue.md'), 'utf8')
const version = JSON.parse(readFileSync(url('../package.json'), 'utf8')).version
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const REL = 'https://github.com/spingras/hue-md/releases/latest/download/'
const KOFI = 'https://ko-fi.com/hue_md'
const PATREON = 'https://patreon.com/hue_md'
const REPO = 'https://github.com/spingras/hue-md'

// Install list. `early: true` marks plugins that only have automated tests so far.
const INSTALL = [
  {
    group: 'Editors',
    items: [
      { name: 'VS Code', note: 'Also Cursor and Windsurf', text: 'Search for “Hue MD” in Extensions. Adds a live preview, editor colors and box snippets.', href: 'https://marketplace.visualstudio.com/items?itemName=spingras.hue-md', action: 'Open Marketplace', extra: { href: REL + 'hue-md-0.1.1.vsix', label: '.vsix' } },
      { name: 'Notepad++', note: 'Windows x64', text: 'Download the zip and run install.ps1. Press Ctrl+Shift+H for the live preview.', href: REL + 'hue-md-npp-x64.zip', action: 'Download' },
      { name: 'Obsidian', text: 'Shows Hue colors and boxes in your vault. Install steps are in the zip.', href: REL + 'hue-md-obsidian.zip', action: 'Download', early: true },
      { name: 'Neovim', text: 'Editor colors and a :HueBox command. Install steps are in the zip.', href: REL + 'hue-md-nvim.zip', action: 'Download', early: true },
      { name: 'Sublime Text and Emacs', text: 'Box snippets for Sublime Text and hue-md-mode.el for Emacs.', href: REL + 'hue-md-snippets.zip', action: 'Download', early: true }
    ]
  },
  {
    group: 'Command line and code',
    items: [
      { name: 'npm', text: 'Terminal viewer, GitHub downgrade, HTML export and the markdown-it plugin.', code: 'npm install -g hue-md', href: 'https://www.npmjs.com/package/hue-md', action: 'View on npm' },
      { name: 'Stylesheet', text: 'Light and dark Hue colors for your own website.', href: REL + 'hue-md.css', action: 'Download' }
    ]
  },
  {
    group: 'Browser',
    items: [
      { name: 'Userscript', text: 'Shows Hue on github.com. Install it with Tampermonkey or Violentmonkey.', href: REL + 'hue-md.user.js', action: 'Install', early: true },
      { name: 'Chrome and Edge', text: 'The same as the userscript, as an extension. Load the unzipped folder in developer mode.', href: REL + 'hue-md-browser.zip', action: 'Download', early: true }
    ]
  }
]

const BOXES = [
  { kind: 'info', color: 'blue', title: 'Tip' },
  { kind: 'ok', color: 'green', title: 'Done' },
  { kind: 'note', color: 'purple', title: 'Note' },
  { kind: 'warn', color: 'orange', title: 'Careful' },
  { kind: '!', color: 'red', title: 'Stop' }
]

const installHtml = INSTALL.map((g) => `
      <div class="install-group">
        <h3>${g.group}</h3>
        <ul class="install-list">${g.items.map((it) => `
          <li class="install-row">
            <div class="install-main">
              <p class="install-name">${esc(it.name)}${it.note ? ` <span class="install-note">${esc(it.note)}</span>` : ''}${it.early ? ' <span class="tag">Early version</span>' : ''}</p>
              <p class="install-text">${esc(it.text)}</p>${it.code ? `
              <div class="cmd"><code>${esc(it.code)}</code><button class="copy" type="button" data-copy="${esc(it.code)}">Copy</button></div>` : ''}
            </div>
            <div class="install-actions">
              <a class="btn" href="${it.href}">${esc(it.action)}</a>${it.extra ? `
              <a class="btn btn-quiet" href="${it.extra.href}">${esc(it.extra.label)}</a>` : ''}
            </div>
          </li>`).join('')}
        </ul>
      </div>`).join('')

const boxButtons = BOXES.map((b) => `<button class="chip" type="button" data-box="${esc(b.kind)}" data-title="${b.title}"><span class="dot" style="background:var(--hue-${b.color})"></span>${esc(b.kind)}</button>`).join('')

const sunMoon = `<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>`

const pageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hue MD: color and boxes for Markdown</title>
<meta name="description" content="Hue Markdown adds colored text and drawn boxes to Markdown. The source stays easy to read as plain text. Try it in your browser.">
<style>
${css()}
:root {
  --bg: #ffffff;
  --bg-subtle: #f6f8fa;
  --bg-inset: #eff2f5;
  --line: #d0d7de;
  --line-soft: #e4e8ec;
  --text: #1f2328;
  --muted: #59636e;
  --accent: #175cd3;
  --term-bg: #0d1117;
  --term-bar: #161b22;
  --shadow: 0 1px 2px rgba(31,35,40,.06), 0 8px 24px rgba(31,35,40,.06);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d1117; --bg-subtle: #151b23; --bg-inset: #1a212b; --line: #30363d; --line-soft: #252c35;
    --text: #e6edf3; --muted: #9198a1; --accent: #58a6ff; --term-bg: #010409; --term-bar: #0d1117;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0d1117; --bg-subtle: #151b23; --bg-inset: #1a212b; --line: #30363d; --line-soft: #252c35;
  --text: #e6edf3; --muted: #9198a1; --accent: #58a6ff; --term-bg: #010409; --term-bar: #0d1117;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
  color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--sans); }
a { color: var(--accent); }
code { font: .88em var(--mono); background: var(--bg-inset); padding: .12em .38em; border-radius: 5px; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
[id] { scroll-margin-top: 76px; }
@media (max-width: 600px) { .wrap { padding: 0 16px; } }

/* header */
.top { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line-soft); }
.top .wrap { display: flex; align-items: center; gap: 24px; height: 60px; }
.brand { display: flex; align-items: baseline; gap: 8px; color: var(--text); text-decoration: none; font-weight: 650; font-size: 1.05rem; }
.brand small { color: var(--muted); font: 500 .75rem var(--mono); }
.nav { display: flex; gap: 20px; margin-right: auto; }
.nav a { color: var(--muted); text-decoration: none; font-size: .92rem; }
.nav a:hover { color: var(--text); }
.top-actions { display: flex; align-items: center; gap: 8px; }
@media (max-width: 760px) { .nav { display: none; } .top .wrap { justify-content: space-between; } }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: 600 .88rem var(--sans); text-decoration: none; cursor: pointer; white-space: nowrap; transition: border-color .15s, background .15s; }
.btn:hover { border-color: var(--muted); }
.btn:focus-visible, .chip:focus-visible, .tab:focus-visible, .copy:focus-visible, .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-primary { background: var(--text); border-color: var(--text); color: var(--bg); }
.btn-primary:hover { opacity: .88; border-color: var(--text); }
.btn-quiet { font-family: var(--mono); font-weight: 500; color: var(--muted); }
.btn-kofi { background: #ff5e5b; border-color: #ff5e5b; color: #fff; }
.btn-patreon { background: #f96854; border-color: #f96854; color: #fff; }
.btn-kofi:hover, .btn-patreon:hover { border-color: transparent; opacity: .9; }
.btn-sm { height: 32px; padding: 0 11px; font-size: .82rem; }
.icon-btn { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; }
.icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.icon-btn[data-mode="dark"] .i-moon, .icon-btn[data-mode="light"] .i-sun { display: none; }
@media (max-width: 480px) { .top-actions .btn-kofi, .top-actions .btn-patreon { display: none; } }

/* hero */
.hero { padding-top: 64px; padding-bottom: 40px; }
.eyebrow { font: 500 .78rem var(--mono); color: var(--muted); letter-spacing: .04em; margin: 0 0 16px; }
.hero h1 { font-size: clamp(2rem, 5vw, 3.1rem); line-height: 1.08; letter-spacing: -.025em; margin: 0 0 18px; font-weight: 650; max-width: 16ch; }
.hero .lead { font-size: 1.15rem; color: var(--muted); max-width: 58ch; margin: 0 0 28px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* playground */
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin: 0 0 14px; }
.section-head h2 { font-size: 1.35rem; letter-spacing: -.015em; margin: 0; font-weight: 650; }
.section-head p { margin: 0; color: var(--muted); font-size: .92rem; }
.playground { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg); box-shadow: var(--shadow); height: clamp(520px, 72vh, 760px); }
.pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pane + .pane { border-left: 1px solid var(--line); }
.bar { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 12px; background: var(--bg-subtle); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.file { font: 600 .82rem var(--mono); color: var(--text); margin-right: auto; display: flex; align-items: center; gap: 8px; }
.file::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--hue-green); }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 9px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: 500 .78rem var(--mono); cursor: pointer; }
.chip:hover { border-color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.chip-label { font-size: .78rem; color: var(--muted); margin-right: 2px; }
.editor-wrap { flex: 1; display: flex; min-height: 0; background: var(--bg); }
.gutter { flex: none; width: 46px; padding: 16px 10px 16px 0; overflow: hidden; text-align: right; font: 13px/1.6 var(--mono); color: var(--muted); opacity: .6; user-select: none; background: var(--bg-subtle); border-right: 1px solid var(--line-soft); }
.gutter span { display: block; }
#editor { flex: 1; min-width: 0; border: 0; margin: 0; padding: 16px 18px; resize: none; outline: none; background: transparent; color: var(--text); font: 13px/1.6 var(--mono); white-space: pre; overflow: auto; tab-size: 2; }
.tabs { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--bg-inset); margin-right: auto; }
.tab { height: 28px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font: 600 .82rem var(--sans); cursor: pointer; }
.tab[aria-selected="true"] { background: var(--bg); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.view { flex: 1; overflow: auto; min-height: 0; }
.view[hidden] { display: none !important; }
#view-preview { padding: 20px 26px; }
#view-preview > :first-child { margin-top: 0; }
#view-preview h1 { font-size: 1.7rem; letter-spacing: -.02em; padding-bottom: .3em; border-bottom: 1px solid var(--line-soft); }
#view-preview h2 { font-size: 1.3rem; }
#view-preview .hue-box { border-radius: 8px; }
#view-terminal { background: var(--term-bg); padding: 0; display: flex; flex-direction: column; }
.term-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; background: var(--term-bar); border-bottom: 1px solid #21262d; font: 500 .75rem var(--mono); color: #8b949e; }
.term-bar i { width: 10px; height: 10px; border-radius: 50%; background: #30363d; }
.term-bar span { margin-left: 8px; }
#terminal-out { flex: 1; margin: 0; padding: 16px 18px; color: #e6edf3; font: 13px/1.45 var(--mono); white-space: pre; overflow: auto; }
.prompt { color: #3fb950; }
#view-github pre { margin: 0; padding: 16px 20px; font: 13px/1.6 var(--mono); white-space: pre-wrap; word-break: break-word; }
.status { padding: 0 12px; color: var(--hue-red); font-size: .82rem; }
.status:empty { display: none; }
@media (max-width: 900px) {
  .playground { grid-template-columns: minmax(0, 1fr); height: auto; }
  .pane { height: 460px; }
  .pane + .pane { border-left: 0; border-top: 1px solid var(--line); }
}

/* install */
main > section.wrap { margin-top: 72px; }
.install-group { margin-top: 28px; }
.install-group h3 { font: 600 .78rem var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 10px; }
.install-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.install-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px; padding: 16px 20px; background: var(--bg); }
.install-row + .install-row { border-top: 1px solid var(--line-soft); }
.install-name { margin: 0; font-weight: 650; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.install-note { font-weight: 400; color: var(--muted); font-size: .88rem; }
.tag { font: 500 .72rem var(--mono); color: var(--hue-orange); background: var(--hue-orange-bg); padding: 2px 8px; border-radius: 99px; }
.install-text { margin: 3px 0 0; color: var(--muted); font-size: .93rem; }
.install-actions { display: flex; gap: 8px; }
.cmd { display: inline-flex; align-items: center; gap: 4px; margin-top: 10px; padding: 4px 4px 4px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-subtle); }
.cmd code { background: none; padding: 0; font-size: .86rem; }
.copy { height: 26px; padding: 0 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--muted); font: 600 .75rem var(--sans); cursor: pointer; }
@media (max-width: 640px) {
  .install-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
}

/* support */
.support { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; border: 1px solid var(--line); border-radius: 12px; padding: 24px 28px; background: var(--bg-subtle); }
.support h2 { margin: 0 0 4px; font-size: 1.2rem; font-weight: 650; }
.support p { margin: 0; color: var(--muted); }
.support-actions { display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 760px) { .support { grid-template-columns: 1fr; } }

footer { margin-top: 64px; border-top: 1px solid var(--line-soft); padding: 28px 0 48px; color: var(--muted); font-size: .88rem; }
footer .wrap { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
footer a { color: var(--muted); }
footer a:hover { color: var(--text); }
</style>
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="brand" href="#">Hue MD <small>v${version}</small></a>
    <nav class="nav" aria-label="Main">
      <a href="#playground">Playground</a>
      <a href="#install">Install</a>
      <a href="${REPO}">GitHub</a>
    </nav>
    <div class="top-actions">
      <a class="btn btn-sm btn-kofi" href="${KOFI}" target="_blank" rel="noopener">Ko-fi</a>
      <a class="btn btn-sm btn-patreon" href="${PATREON}" target="_blank" rel="noopener">Patreon</a>
      <button class="icon-btn" id="theme" type="button" aria-label="Switch theme">${sunMoon}</button>
    </div>
  </div>
</header>

<main>
  <div class="wrap hero">
    <p class="eyebrow">OPEN SOURCE · MIT LICENSE · COMMONMARK COMPATIBLE</p>
    <h1>Color and boxes for Markdown</h1>
    <p class="lead">Hue Markdown adds colored text and drawn boxes to Markdown. The source stays easy to read as plain text, for people and for AI. Edit the example below to see how it works.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#install">Install</a>
      <a class="btn" href="${REPO}">Source on GitHub</a>
    </div>
  </div>

  <div class="wrap" id="playground">
    <div class="section-head">
      <h2>Playground</h2>
    </div>
    <div class="playground">
      <div class="pane">
        <div class="bar">
          <span class="file">demo.hue.md</span>
          <span class="chip-label">Add box</span>${boxButtons}
          <button class="chip" type="button" id="reset" title="Restore the example">Reset</button>
        </div>
        <div class="editor-wrap">
          <div class="gutter" id="gutter" aria-hidden="true"></div>
          <textarea id="editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Hue Markdown source">${esc(src)}</textarea>
        </div>
      </div>
      <div class="pane">
        <div class="bar">
          <div class="tabs" role="tablist" aria-label="Output">
            <button class="tab" role="tab" type="button" data-view="preview" aria-selected="true">Preview</button>
            <button class="tab" role="tab" type="button" data-view="terminal" aria-selected="false" tabindex="-1">Terminal</button>
            <button class="tab" role="tab" type="button" data-view="github" aria-selected="false" tabindex="-1">GitHub</button>
          </div>
          <button class="copy" type="button" id="copy-github" hidden>Copy</button>
        </div>
        <div class="view" id="view-preview" role="tabpanel" aria-label="Preview">${md.render(src)}</div>
        <div class="view" id="view-terminal" role="tabpanel" aria-label="Terminal" hidden>
          <div class="term-bar"><i></i><i></i><i></i><span><b class="prompt">$</b> hue-md view demo.hue.md</span></div>
          <pre id="terminal-out"></pre>
        </div>
        <div class="view" id="view-github" role="tabpanel" aria-label="GitHub Markdown" hidden><pre id="github-out"></pre></div>
        <p class="status" id="status" role="status"></p>
      </div>
    </div>
  </div>

  <section class="wrap" id="install">
    <div class="section-head">
      <h2>Install</h2>
      <p>Plugins marked “Early version” have automated tests only. Feedback is welcome.</p>
    </div>${installHtml}
  </section>

  <section class="wrap">
    <div class="support">
      <div>
        <h2>Support Hue MD</h2>
        <p>Hue MD is free and open source. If it is useful to you, you can support the work.</p>
      </div>
      <div class="support-actions">
        <a class="btn btn-kofi" href="${KOFI}" target="_blank" rel="noopener">Buy me a coffee on Ko-fi</a>
        <a class="btn btn-patreon" href="${PATREON}" target="_blank" rel="noopener">Support on Patreon</a>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <span>Hue MD is built and maintained by <a href="https://spingras.io">SpinGras</a>. MIT license.</span>
    <span><a href="${REPO}">GitHub</a> · <a href="https://www.npmjs.com/package/hue-md">npm</a> · <a href="${KOFI}">Ko-fi</a> · <a href="${PATREON}">Patreon</a></span>
  </div>
</footer>
<script src="playground.js" defer></script>
</body>
</html>
`

await build({
  entryPoints: [fileURLToPath(url('./playground-entry.js'))],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  outfile: fileURLToPath(url('../site/playground.js')),
  logLevel: 'warning'
})

mkdirSync(url('../site/'), { recursive: true })
writeFileSync(url('../site/index.html'), pageHtml)
writeFileSync(url('../demo/index.html'), pageHtml)
copyFileSync(url('../site/playground.js'), url('../demo/playground.js'))
copyFileSync(url('../demo/demo.hue.md'), url('../site/demo.hue.md'))
console.log('wrote site/ and demo/ (index.html, playground.js)')
