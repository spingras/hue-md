// Loads the built main.js (the file that ships to .obsidian/plugins/hue-md/)
// with a stand-in `obsidian` module, and runs its post-processor on
// demo/demo.hue.md in a jsdom document.
//
// Obsidian itself is not available here, so `readingView()` models what its
// Reading view hands to post-processors: one <div> per top-level block, rendered
// with soft line breaks as <br>, wikilinks as <a class="internal-link"
// data-href>, and every `- [c]` item as <li data-task="c"> with an
// <input class="task-list-item-checkbox">. That shape is modeled on Obsidian's
// HTML, not captured from it: the manual check in README.md covers the real app.
//
// Run `npm run build` first (`npm test` does it for you).

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const Module = require('module')
const { JSDOM } = require('jsdom')
const MarkdownIt = require('markdown-it')

const pkgDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(pkgDir, '..', '..')
const demo = fs.readFileSync(path.join(repoDir, 'demo', 'demo.hue.md'), 'utf8')

// ---------------------------------------------------------------- Obsidian-like markdown

function wikilinks (md) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const m = /^\[\[([^\]\n|]+)\]\]/.exec(state.src.slice(state.pos, state.posMax))
    if (!m) return false
    if (!silent) {
      const t = state.push('html_inline', '', 0)
      const target = md.utils.escapeHtml(m[1])
      t.content = `<a data-href="${target}" href="${target}" class="internal-link" target="_blank" rel="noopener">${target}</a>`
    }
    state.pos += m[0].length
    return true
  })
}

function tasks (md) {
  md.core.ruler.after('inline', 'obsidian_tasks', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
      const first = tokens[i].children[0]
      const m = first && first.type === 'text' && /^\[(.)\]\s+/.exec(first.content)
      if (!m) continue
      first.content = first.content.slice(m[0].length)
      const li = tokens[i - 2]
      li.attrSet('data-task', m[1] === ' ' ? '' : m[1])
      li.attrSet('class', 'task-list-item' + (m[1] === ' ' ? '' : ' is-checked'))
      const box = new state.Token('html_inline', '', 0)
      box.content = `<input data-line="${li.map[0]}" class="task-list-item-checkbox" type="checkbox"${m[1] === ' ' ? '' : ' checked'}>`
      tokens[i].children.unshift(box)
      for (let j = i - 3; j >= 0; j--) {
        if (tokens[j].type === 'bullet_list_open' || tokens[j].type === 'ordered_list_open') {
          tokens[j].attrSet('class', 'contains-task-list')
          break
        }
      }
    }
  })
}

// #tag after a space or at the start, with at least one non-digit
function tags (md) {
  md.inline.ruler.push('tag', (state, silent) => {
    if (state.src[state.pos] !== '#' || (state.pos > 0 && !/\s/.test(state.src[state.pos - 1]))) return false
    const m = /^#([\w/-]*[A-Za-z_/-][\w/-]*)/.exec(state.src.slice(state.pos, state.posMax))
    if (!m) return false
    if (!silent) {
      const t = state.push('html_inline', '', 0)
      t.content = `<a href="${m[0]}" class="tag" target="_blank" rel="noopener">${m[0]}</a>`
    }
    state.pos += m[0].length
    return true
  })
}

const obsidianMd = new MarkdownIt({ html: true, breaks: true }).use(wikilinks).use(tasks).use(tags)

// ---------------------------------------------------------------- stand-in `obsidian` module

let current = null // the plugin whose processors the stand-in renderer runs

class Component {
  addChild (c) { return c }
}
class MarkdownRenderChild extends Component {
  constructor (containerEl) { super(); this.containerEl = containerEl }
}
class Plugin extends Component {
  constructor (app, manifest) {
    super()
    this.app = app
    this.manifest = manifest
    this.postProcessors = []
    this.codeBlocks = new Map()
    this.commands = []
  }
  registerMarkdownPostProcessor (fn) { this.postProcessors.push(fn) }
  registerMarkdownCodeBlockProcessor (lang, fn) { this.codeBlocks.set(lang, fn) }
  addCommand (c) { this.commands.push(c) }
}

// Renders like Reading view: a section <div> per top-level block, then the
// code block processor or the post-processors on each one.
async function renderSections (markdown, container, { sectionInfo = true, sourcePath = 'demo.md' } = {}) {
  const doc = container.ownerDocument
  const tokens = obsidianMd.parse(markdown, {})
  const env = {}
  for (let i = 0; i < tokens.length;) {
    let j = i
    if (tokens[i].nesting === 1) {
      let depth = 0
      for (; j < tokens.length; j++) {
        depth += tokens[j].nesting
        if (depth === 0) break
      }
    }
    const block = tokens.slice(i, j + 1)
    const map = tokens[i].map
    i = j + 1
    const el = doc.createElement('div')
    container.appendChild(el)
    const ctx = {
      sourcePath,
      addChild () {},
      getSectionInfo: (e) => (sectionInfo && e === el ? { text: markdown, lineStart: map[0], lineEnd: map[1] - 1 } : null)
    }
    const fence = block[0].type === 'fence' && current.codeBlocks.get(block[0].info.trim())
    if (fence) {
      await fence(block[0].content, el, ctx)
      continue
    }
    el.innerHTML = obsidianMd.renderer.render(block, obsidianMd.options, env)
    for (const pp of current.postProcessors) await pp(el, ctx)
  }
}

const nested = { sectionInfo: true }
const MarkdownRenderer = {
  async render (app, markdown, container, sourcePath) {
    await renderSections(markdown, container, { sectionInfo: nested.sectionInfo, sourcePath })
  }
}

const obsidian = { Plugin, Component, MarkdownRenderChild, MarkdownRenderer }

const mainPath = path.join(pkgDir, 'main.js')
if (!fs.existsSync(mainPath)) throw new Error('main.js is missing: run `npm run build` in packages/obsidian-hue first')

const load = Module._load
Module._load = function (request, ...rest) {
  if (request === 'obsidian') return obsidian
  return load.call(this, request, ...rest)
}
const mainModule = require(mainPath)
Module._load = load
const HueMdPlugin = mainModule.default || mainModule

const notes = new Set(['Existing note'])
const app = { metadataCache: { getFirstLinkpathDest: (name) => (notes.has(name) ? { path: name + '.md' } : null) } }

async function view (markdown, { sectionInfo = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><body class="theme-light"><div class="markdown-rendered"></div></body></html>')
  const container = dom.window.document.querySelector('.markdown-rendered')
  current = new HueMdPlugin(app, { id: 'hue-md' })
  await current.onload()
  nested.sectionInfo = sectionInfo
  await renderSections(markdown, container, { sectionInfo })
  return container
}

const html = async (md, opts) => (await view(md, opts)).innerHTML

// ---------------------------------------------------------------- tests

test('plugin registers a post-processor, the hue fence and the insert commands', async () => {
  const plugin = new HueMdPlugin(app, { id: 'hue-md' })
  await plugin.onload()
  assert.equal(plugin.postProcessors.length, 1)
  assert.ok(plugin.codeBlocks.has('hue'))
  assert.deepEqual(plugin.commands.map((c) => c.id), ['insert-box-info', 'insert-box-ok', 'insert-box-note', 'insert-box-warn', 'insert-box-danger', 'insert-split-box'])
})

test('demo: colored spans, hex spans and diff spans', async () => {
  const out = await html(demo)
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

test('demo: boxes with titles, Obsidian-rendered markdown and lists inside', async () => {
  const root = await view(demo)
  const boxes = Array.from(root.querySelectorAll(':scope > div > .hue-box'))
  assert.deepEqual(boxes.map((b) => [b.className, b.querySelector('.hue-box-title').textContent]), [
    ['hue-box hue-box-blue', 'Effortless Boxes'],
    ['hue-box hue-box-green', 'Full Markdown Inside'],
    ['hue-box hue-box-purple', 'GitHub Ready'],
    ['hue-box hue-box-orange', 'Heads Up'],
    ['hue-box hue-box-red', 'Never Commit Secrets']
  ])
  for (const b of boxes) assert.equal(b.getAttribute('role'), 'note')
  const out = root.innerHTML
  assert.match(out, /Boxes support <strong>bold<\/strong>, <em>italics<\/em>, <code>inline code<\/code>, and <span class="hue hue-green">colored spans<\/span>/)
  assert.match(out, /<li>Rotate any key that leaked <span class="hue hue-red">immediately<\/span><\/li>/)
  // each box line is its own line: a hard break between the lines
  assert.match(out, /Start with <code>\+--<\/code> followed by[^<]*(<code>[^<]*<\/code>[^<]*)*<br>\s*Every <code>\|<\/code> line/)
  assert.doesNotMatch(out.replace(/<code[^>]*>[^<]*<\/code>/g, ''), /\+--|^\| /m, 'no raw box borders left')
})

test('demo: split boxes render side by side', async () => {
  const root = await view(demo)
  const cols = root.querySelector('.hue-columns.hue-columns-2')
  assert.ok(cols, 'split box wrapper')
  const boxes = Array.from(cols.children)
  assert.deepEqual(boxes.map((b) => b.className), ['hue-box hue-box-green', 'hue-box hue-box-orange'])
  assert.deepEqual(boxes.map((b) => b.querySelector('.hue-box-title').textContent), ['Do this', 'Avoid this'])
  assert.match(boxes[1].innerHTML, /Raw <code>&lt;span&gt;<\/code> HTML in your notes\./)
})

test('demo: [-] [!] [?] become Hue task states, [ ] and [x] stay Obsidian checkboxes', async () => {
  const root = await view(demo)
  const items = Array.from(root.querySelectorAll('ul.contains-task-list > li'))
  assert.equal(items.length, 5)
  const [done, progress, blocked, question, todo] = items

  for (const [li, name, symbol] of [[progress, 'progress', '◐'], [blocked, 'blocked', '!'], [question, 'question', '?']]) {
    assert.ok(li.classList.contains(`hue-task-${name}`), li.outerHTML)
    assert.ok(!li.classList.contains('is-checked'), 'Hue states are not drawn as done')
    const box = li.querySelector('.hue-task-box')
    assert.equal(box.className, `hue-task-box hue-task-box-${name}`)
    assert.equal(box.textContent, symbol)
    assert.equal(li.querySelector('input'), null, 'checkbox replaced')
  }
  assert.match(progress.innerHTML, /Release notes <ins class="hue hue-diff-add">in progress<\/ins>/)
  assert.match(blocked.innerHTML, /Launch post <span class="hue hue-red">blocked<\/span> on review/)

  for (const [li, checked] of [[done, true], [todo, false]]) {
    const box = li.querySelector('input.task-list-item-checkbox')
    assert.ok(box, 'Obsidian checkbox kept')
    assert.equal(box.hasAttribute('checked'), checked)
    assert.ok(!li.classList.contains('hue-task'))
  }
  assert.doesNotMatch(root.textContent, /\[[-!?]\]/, 'no raw task markers left')
})

test('demo: key caps and progress bars', async () => {
  const out = await html(demo)
  assert.match(out, /<kbd class="hue-kbd">Ctrl\+Shift\+V<\/kbd>/)
  assert.match(out, /<kbd class="hue-kbd">Esc<\/kbd>/)
  assert.match(out, /<span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="80"[^>]*><span class="hue-progress-track"><span class="hue-progress-fill" style="width:80%"><\/span><\/span><span class="hue-progress-label">80%<\/span><\/span>/)
  assert.match(out, /<span class="hue-progress hue-progress-green" role="progressbar" aria-valuenow="100"/)
})

test('wikilinks to real notes, aliased links and non-keys stay links', async () => {
  const out = await html('[[Existing note]] [[Esc]] [[Ctrl+K]] [[Some page]]\n')
  assert.match(out, /<kbd class="hue-kbd">Esc<\/kbd>/)
  assert.match(out, /<kbd class="hue-kbd">Ctrl\+K<\/kbd>/)
  assert.match(out, /<a data-href="Existing note"[^>]*>Existing note<\/a>/)
  assert.match(out, /<a data-href="Some page"[^>]*>Some page<\/a>/)
  notes.add('Esc')
  try {
    assert.match(await html('[[Esc]]\n'), /<a data-href="Esc"/, 'a note named Esc wins over the key cap')
  } finally {
    notes.delete('Esc')
  }
})

test('spans keep Obsidian elements inside them and skip code', async () => {
  const out = await html('{ok: **bold** and [[Existing note]]} and `{ok: code}`\n')
  assert.match(out, /<span class="hue hue-green"><strong>bold<\/strong> and <a data-href="Existing note"[^>]*>Existing note<\/a><\/span>/)
  assert.match(out, /<code>\{ok: code\}<\/code>/)
})

test('a hex color Obsidian read as a #tag still works in a span spec; other tags stay tags', async () => {
  const out = await html('{bg-yellow #c0ffee: hex on yellow} and #project and {ok: done #c0ffee}\n')
  assert.match(out, /<span class="hue hue-bg-yellow" style="color:#c0ffee">hex on yellow<\/span>/)
  assert.match(out, / and <a href="#project" class="tag"[^>]*>#project<\/a> and /)
  assert.match(out, /<span class="hue hue-green">done <a href="#c0ffee" class="tag"[^>]*>#c0ffee<\/a><\/span>/)
})

test('code blocks with box lines are left alone', async () => {
  const out = await html('```\n+-- info Not a box\n| text\n+--\n```\n')
  assert.match(out, /<pre><code>\+-- info Not a box\n\| text\n\+--\n<\/code><\/pre>/)
  assert.doesNotMatch(out, /hue-box/)
})

test('boxes render without section info (embeds, nested renders)', async () => {
  const root = await view(demo, { sectionInfo: false })
  assert.equal(root.querySelectorAll('.hue-box').length, 7)
  assert.ok(root.querySelector('.hue-columns-2'))
  assert.match(root.innerHTML, /<li>Rotate any key that leaked <span class="hue hue-red">immediately<\/span><\/li>/)
  assert.match(root.innerHTML, /Boxes support <strong>bold<\/strong>/)
})

test('nested boxes render', async () => {
  const root = await view('+-- info Outer\n| +-- warn Inner\n| | {warn: careful}\n| +--\n+--\n')
  const inner = root.querySelector('.hue-box-blue .hue-box-orange')
  assert.ok(inner, root.innerHTML)
  assert.match(inner.innerHTML, /<span class="hue hue-orange">careful<\/span>/)
})

test('```hue fences render as Hue', async () => {
  const out = await html('```hue\n{ok: inside a fence}\n\n+-- ok Fenced box\n| hi\n+--\n```\n')
  assert.match(out, /<span class="hue hue-green">inside a fence<\/span>/)
  assert.match(out, /<div class="hue-box hue-box-green" role="note"><div class="hue-box-title">Fenced box<\/div>/)
})

test('styles.css: shared layout plus colors for Obsidian light and dark themes', () => {
  const styles = fs.readFileSync(path.join(pkgDir, 'styles.css'), 'utf8')
  assert.match(styles, /\.hue-box \{/)
  assert.match(styles, /\.hue-columns \{/)
  assert.match(styles, /\.hue-kbd \{/)
  assert.match(styles, /\.hue-progress-fill \{/)
  assert.match(styles, /del\.hue-diff-del \{/)
  const block = (sel) => new RegExp(`${sel} \\{([^}]*)\\}`).exec(styles)[1]
  assert.match(block('body\\.theme-light'), /--hue-green: #067647;/)
  assert.match(block('body\\.theme-light'), /--hue-text: var\(--text-normal\);/)
  assert.match(block('body\\.theme-dark'), /--hue-green: #3fb950;/)
  assert.match(block('body\\.theme-dark'), /--hue-red-bg: #3d1614;/)
})

test('manifest.json matches the root package version', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'manifest.json'), 'utf8'))
  const rootPkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'))
  assert.equal(manifest.id, 'hue-md')
  assert.equal(manifest.version, rootPkg.version)
  assert.match(fs.readFileSync(mainPath, 'utf8'), new RegExp(`Hue MD for Obsidian ${rootPkg.version.replace(/\./g, '\\.')}`))
})
