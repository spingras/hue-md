// Browser code for the playground page (bundled by scripts/render-demo.js).
// It uses the real Hue parser, downgrade and terminal renderer, so the
// playground always shows exactly what the packages do.
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'
import { downgrade } from '../md-hue/src/downgrade.js'
import { renderAnsi } from '../md-hue/src/ansi.js'

const md = new MarkdownIt().use(hue)

const $ = (id) => document.getElementById(id)
const editor = $('editor')
const gutter = $('gutter')
const views = { preview: $('view-preview'), terminal: $('view-terminal'), github: $('view-github') }
const terminalOut = $('terminal-out')
const githubOut = $('github-out')
const copyBtn = $('copy-github')
const status = $('status')
const original = editor.value
let current = 'preview'

// ---------------------------------------------------------------- ANSI -> HTML

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function ansiToHtml (text) {
  let out = ''
  let state = {}
  let open = false
  const style = () => {
    const css = []
    if (state.fg) css.push(`color:${state.fg}`)
    if (state.bg) css.push(`background:${state.bg}`)
    if (state.bold) css.push('font-weight:700')
    if (state.dim) css.push('opacity:.65')
    if (state.italic) css.push('font-style:italic')
    if (state.underline) css.push('text-decoration:underline')
    return css.join(';')
  }
  const parts = text.split(/\x1b\[([0-9;]*)m/)
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { out += esc(parts[i]); continue }
    const p = parts[i] === '' ? [0] : parts[i].split(';').map(Number)
    for (let k = 0; k < p.length; k++) {
      const n = p[k]
      if (n === 0) state = {}
      else if (n === 1) state.bold = true
      else if (n === 2) state.dim = true
      else if (n === 3) state.italic = true
      else if (n === 4) state.underline = true
      else if (n === 22) { state.bold = false; state.dim = false }
      else if (n === 23) state.italic = false
      else if (n === 24) state.underline = false
      else if (n === 39) state.fg = null
      else if (n === 49) state.bg = null
      else if ((n === 38 || n === 48) && p[k + 1] === 2) {
        const rgb = `rgb(${p[k + 2]},${p[k + 3]},${p[k + 4]})`
        if (n === 38) state.fg = rgb; else state.bg = rgb
        k += 4
      }
    }
    if (open) out += '</span>'
    const css = style()
    open = Boolean(css)
    if (open) out += `<span style="${css}">`
  }
  if (open) out += '</span>'
  return out
}

// ---------------------------------------------------------------- rendering

function terminalColumns () {
  const probe = document.createElement('span')
  probe.textContent = 'MMMMMMMMMM'
  probe.style.visibility = 'hidden'
  terminalOut.appendChild(probe)
  const charW = probe.getBoundingClientRect().width / 10 || 8
  probe.remove()
  const cs = getComputedStyle(terminalOut)
  const w = terminalOut.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4
  return Math.max(30, Math.min(100, Math.floor(w / charW)))
}

function render () {
  const src = editor.value
  try {
    if (current === 'preview') views.preview.innerHTML = md.render(src)
    if (current === 'terminal') terminalOut.innerHTML = ansiToHtml(renderAnsi(src, { width: terminalColumns(), theme: 'dark' }))
    if (current === 'github') githubOut.textContent = downgrade(src)
    status.textContent = ''
  } catch (err) {
    status.textContent = 'Could not render: ' + err.message
  }
}

let queued = false
function schedule () {
  if (queued) return
  queued = true
  requestAnimationFrame(() => { queued = false; render(); updateGutter() })
}

// ---------------------------------------------------------------- editor

function updateGutter () {
  const lines = editor.value.split('\n').length
  if (gutter.childElementCount !== lines) {
    let html = ''
    for (let i = 1; i <= lines; i++) html += `<span>${i}</span>`
    gutter.innerHTML = html
  }
  gutter.scrollTop = editor.scrollTop
}

editor.addEventListener('input', schedule)
editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop })

document.querySelectorAll('[data-box]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const kind = btn.dataset.box
    const title = btn.dataset.title
    const at = editor.selectionEnd
    const before = editor.value.slice(0, at)
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const snippet = `${lead}+-- ${kind} ${title}\n| First point\n| Second point\n+--\n`
    editor.setRangeText(snippet, at, at, 'end')
    const start = at + lead.length + `+-- ${kind} `.length
    editor.focus()
    editor.setSelectionRange(start, start + title.length)
    schedule()
  })
})

$('reset').addEventListener('click', () => {
  editor.value = original
  editor.scrollTop = 0
  schedule()
})

// ---------------------------------------------------------------- tabs

const tabs = document.querySelectorAll('[role="tab"]')
function select (name) {
  current = name
  tabs.forEach((t) => {
    const on = t.dataset.view === name
    t.setAttribute('aria-selected', String(on))
    t.tabIndex = on ? 0 : -1
  })
  for (const [k, el] of Object.entries(views)) el.hidden = k !== name
  copyBtn.hidden = name !== 'github'
  render()
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t.dataset.view))
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    next.focus()
    select(next.dataset.view)
  })
})

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(githubOut.textContent)
    copyBtn.textContent = 'Copied'
  } catch {
    copyBtn.textContent = 'Select the text to copy'
  }
  setTimeout(() => { copyBtn.textContent = 'Copy' }, 1600)
})

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy)
      btn.textContent = 'Copied'
    } catch {
      btn.textContent = 'Select to copy'
    }
    setTimeout(() => { btn.textContent = 'Copy' }, 1600)
  })
})

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => { if (current === 'terminal') render() }, 150)
})

// ---------------------------------------------------------------- theme

const themeBtn = $('theme')
function applyTheme (t) {
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  themeBtn.dataset.mode = dark ? 'dark' : 'light'
}
let saved = null
try { saved = localStorage.getItem('hue-theme') } catch {}
applyTheme(saved)
themeBtn.addEventListener('click', () => {
  const next = themeBtn.dataset.mode === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem('hue-theme', next) } catch {}
  applyTheme(next)
})

updateGutter()
render()
