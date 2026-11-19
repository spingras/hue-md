// Runs the built browser files (extension/content.js and userscript/hue-md.user.js)
// inside a jsdom page that holds demo/demo.hue.md rendered the way GitHub renders
// Markdown: no soft-break <br>, `- [ ]` / `- [x]` as disabled checkboxes in a
// .contains-task-list, other `[c]` markers left as text, and unknown fences as
// <pre lang="…">. That HTML is modeled on GitHub's, not fetched from it.
//
// Build first: node packages/github-hue/scripts/build.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import MarkdownIt from 'markdown-it'

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(pkgDir, '..', '..')
const demo = fs.readFileSync(path.join(repoDir, 'demo', 'demo.hue.md'), 'utf8')
const contentJs = fs.readFileSync(path.join(pkgDir, 'extension', 'content.js'), 'utf8')
const userJs = fs.readFileSync(path.join(pkgDir, 'userscript', 'hue-md.user.js'), 'utf8')

// ---------------------------------------------------------------- GitHub-like Markdown

function githubTasks (md) {
  md.core.ruler.after('inline', 'github_tasks', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
      const first = tokens[i].children[0]
      const m = first && first.type === 'text' && /^\[([ xX])\]\s+/.exec(first.content)
      if (!m) continue
      first.content = first.content.slice(m[0].length)
      tokens[i - 2].attrSet('class', 'task-list-item')
      const box = new state.Token('html_inline', '', 0)
      box.content = `<input type="checkbox" class="task-list-item-checkbox" disabled=""${m[1] === ' ' ? '' : ' checked=""'}> `
      tokens[i].children.unshift(box)
      for (let j = i - 3; j >= 0; j--) {
        if (tokens[j].type === 'bullet_list_open') { tokens[j].attrSet('class', 'contains-task-list'); break }
      }
    }
  })
}

const githubMd = new MarkdownIt({ html: true, linkify: true }).use(githubTasks)
githubMd.renderer.rules.fence = (tokens, idx) => {
  const t = tokens[idx]
  const lang = t.info.trim().split(/\s+/)[0]
  const code = githubMd.utils.escapeHtml(t.content)
  return lang
    ? `<div class="snippet-clipboard-content notranslate position-relative overflow-auto"><pre lang="${lang}" class="notranslate"><code class="notranslate">${code}</code></pre></div>\n`
    : `<div class="snippet-clipboard-content notranslate position-relative overflow-auto"><pre class="notranslate"><code class="notranslate">${code}</code></pre></div>\n`
}

function page (markdown, { colorMode = 'auto' } = {}) {
  return new JSDOM(`<!doctype html><html data-color-mode="${colorMode}" data-light-theme="light" data-dark-theme="dark"><head></head><body>
<div class="repository-content"><article class="markdown-body entry-content container-lg" itemprop="text">${githubMd.render(markdown)}</article></div>
</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true })
}

// Loads the extension's content script without its auto-start and renders the page.
async function rendered (markdown, opts) {
  const dom = page(markdown, opts)
  dom.window.__HUE_MD_NO_AUTOSTART__ = true
  dom.window.eval(contentJs)
  await dom.window.HueMD.processDocument(dom.window.document)
  return dom.window.document.querySelector('.markdown-body')
}

const until = async (fn, ms = 2000) => {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

// ---------------------------------------------------------------- tests

test('demo: colored spans, hex spans and diff spans', async () => {
  const out = (await rendered(demo)).innerHTML
  assert.match(out, /<span class="hue hue-green">passing<\/span>/)
  assert.match(out, /<span class="hue hue-orange">71%<\/span>/)
  assert.match(out, /<span class="hue hue-red">blocked<\/span>/)
  assert.match(out, /<span class="hue hue-bg-yellow">key phrases<\/span>/)
  assert.match(out, /<span class="hue hue-blue hue-bg-gray">text and background<\/span>/)
  assert.match(out, /<span class="hue" style="color:#c0ffee;background:#333333">hex color<\/span>/)
  assert.match(out, /Normal prose like \{a: 1\} or \{key: value\} stays untouched/)
  assert.match(out, /<ins class="hue hue-diff-add">added key caps and progress bars<\/ins>/)
  assert.match(out, /<del class="hue hue-diff-del">removed the old md-hue package<\/del>/)
})

test('demo: boxes with titles, markdown and lists inside', async () => {
  const root = await rendered(demo)
  const boxes = Array.from(root.querySelectorAll(':scope > .hue-box'))
  assert.deepEqual(boxes.map((b) => [b.className, b.querySelector('.hue-box-title').textContent]), [
    ['hue-box hue-box-blue', 'Effortless Boxes'],
    ['hue-box hue-box-green', 'Full Markdown Inside'],
    ['hue-box hue-box-purple', 'GitHub Ready'],
    ['hue-box hue-box-orange', 'Heads Up'],
    ['hue-box hue-box-red', 'Never Commit Secrets']
  ])
  const out = root.innerHTML
  assert.match(out, /Boxes support <strong>bold<\/strong>, <em>italics<\/em>, <code>inline code<\/code>, and <span class="hue hue-green">colored spans<\/span>/)
  assert.match(out, /<li>Rotate any key that leaked <span class="hue hue-red">immediately<\/span><\/li>/)
  assert.match(out, /Start with <code>\+--<\/code>[\s\S]*?<code>!<\/code><br>\nEvery <code>\|<\/code> line/, 'box lines keep their line breaks')
  assert.doesNotMatch(out.replace(/<code[^>]*>[^<]*<\/code>/g, ''), /\+--|^\| /m, 'no raw box borders left')
})

test('demo: split boxes render side by side', async () => {
  const root = await rendered(demo)
  const cols = root.querySelector('.hue-columns.hue-columns-2')
  assert.ok(cols, 'split box wrapper')
  const boxes = Array.from(cols.children)
  assert.deepEqual(boxes.map((b) => b.className), ['hue-box hue-box-green', 'hue-box hue-box-orange'])
  assert.deepEqual(boxes.map((b) => b.querySelector('.hue-box-title').textContent), ['Do this', 'Avoid this'])
  assert.match(boxes[1].innerHTML, /Raw <code>&lt;span&gt;<\/code> HTML in your notes\./)
})

test('demo: [-] [!] [?] become Hue task states, [ ] and [x] stay GitHub checkboxes', async () => {
  const root = await rendered(demo)
  const items = Array.from(root.querySelectorAll('ul.contains-task-list > li'))
  assert.equal(items.length, 5)
  const [done, progress, blocked, question, todo] = items
  for (const [li, name, symbol] of [[progress, 'progress', '◐'], [blocked, 'blocked', '!'], [question, 'question', '?']]) {
    assert.ok(li.classList.contains(`hue-task-${name}`), li.outerHTML)
    const box = li.querySelector('.hue-task-box')
    assert.equal(box.className, `hue-task-box hue-task-box-${name}`)
    assert.equal(box.textContent, symbol)
  }
  assert.match(progress.innerHTML, /Release notes <ins class="hue hue-diff-add">in progress<\/ins>/)
  for (const [li, checked] of [[done, true], [todo, false]]) {
    const box = li.querySelector('input.task-list-item-checkbox')
    assert.ok(box, 'GitHub checkbox kept')
    assert.equal(box.hasAttribute('checked'), checked)
    assert.ok(!li.classList.contains('hue-task'))
  }
  assert.doesNotMatch(root.textContent, /\[[-!?]\]/, 'no raw task markers left')
})

test('demo: key caps and progress bars', async () => {
  const out = (await rendered(demo)).innerHTML
  assert.match(out, /<kbd class="hue-kbd">Ctrl\+Shift\+V<\/kbd>/)
  assert.match(out, /<kbd class="hue-kbd">Esc<\/kbd>/)
  assert.match(out, /<span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="80"[^>]*><span class="hue-progress-track"><span class="hue-progress-fill" style="width:80%"><\/span><\/span><span class="hue-progress-label">80%<\/span><\/span>/)
  assert.match(out, /<span class="hue-progress hue-progress-green" role="progressbar" aria-valuenow="100"/)
})

test('```hue fences render as Hue; other code blocks stay code', async () => {
  const root = await rendered('```hue\n{ok: inside a fence}\n\n+-- ok Fenced box\n| hi\n+--\n```\n\n```\n+-- info Not a box\n| text\n+--\n```\n')
  assert.match(root.innerHTML, /<div class="hue-fence"><p><span class="hue hue-green">inside a fence<\/span><\/p>\n<div class="hue-box hue-box-green" role="note">/)
  assert.equal(root.querySelectorAll('pre').length, 1)
  assert.match(root.querySelector('pre').textContent, /\+-- info Not a box/)
})

test('rendering twice changes nothing', async () => {
  const dom = page(demo)
  dom.window.__HUE_MD_NO_AUTOSTART__ = true
  dom.window.eval(contentJs)
  await dom.window.HueMD.processDocument(dom.window.document)
  const once = dom.window.document.body.innerHTML
  await dom.window.HueMD.processDocument(dom.window.document)
  assert.equal(dom.window.document.body.innerHTML, once)
})

test('userscript starts by itself, injects its stylesheet and renders Markdown GitHub adds later', async () => {
  const dom = page('Build: {ok: passing}\n')
  dom.window.eval(userJs)
  const doc = dom.window.document
  await until(() => doc.querySelector('.hue-green'))
  const style = doc.getElementById('hue-md-styles')
  assert.ok(style, 'stylesheet injected')
  assert.match(style.textContent, /\.hue-box \{/)

  // GitHub swaps in new content (another comment, a new page)
  const comment = doc.createElement('div')
  comment.className = 'markdown-body'
  comment.innerHTML = githubMd.render('+-- warn Later\n| {!: added after load}\n+--\n')
  doc.body.appendChild(comment)
  await until(() => comment.querySelector('.hue-box-orange .hue-red'))
  dom.window.close()
})

test('extension: manifest, stylesheet with GitHub light/dark colors, versions match', () => {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'extension', 'manifest.json'), 'utf8'))
  assert.equal(manifest.version, rootPkg.version)
  assert.deepEqual(manifest.content_scripts[0].js, ['content.js'])
  assert.deepEqual(manifest.content_scripts[0].css, ['hue.css'])
  assert.match(userJs, new RegExp(`// @version {6}${rootPkg.version.replace(/\./g, '\\.')}\n`))

  const css = fs.readFileSync(path.join(pkgDir, 'extension', 'hue.css'), 'utf8')
  for (const rule of ['.hue-box {', '.hue-columns {', '.hue-kbd {', '.hue-progress-fill {', 'del.hue-diff-del {', '.hue-task-box {']) {
    assert.ok(css.includes(rule), rule)
  }
  const block = (sel) => {
    const at = css.indexOf(sel + ' {')
    assert.ok(at !== -1, sel)
    return css.slice(at, css.indexOf('}', at))
  }
  assert.match(block('[data-color-mode="light"][data-light-theme^="dark"] .markdown-body'), /--hue-green: #3fb950;/)
  assert.match(css, /\[data-color-mode\] \.markdown-body,[\s\S]*?--hue-green: #067647;/)
  assert.match(css, /\[data-color-mode="dark"\] \.markdown-body,[\s\S]*?--hue-green: #3fb950;/)
})
