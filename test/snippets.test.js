// Snippets: the generated files in snippets/ match packages/vscode-hue/snippets/hue.json,
// and every snippet's default text renders as the Hue it promises.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'
import { defaultText, loadSnippets, snippetFiles } from '../scripts/build-snippets.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const md = new MarkdownIt().use(hue)

test('snippets/ is up to date with the VS Code snippets (run node scripts/build-snippets.js)', () => {
  const files = snippetFiles()
  for (const [file, content] of Object.entries(files)) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, file)
  }
  for (const dir of ['snippets/sublime', 'snippets/obsidian']) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      assert.ok(files[`${dir}/${f}`], `${dir}/${f} is not generated: remove it or add it to the source`)
    }
  }
})

const EXPECT = {
  'Hue Info Box': /<div class="hue-box hue-box-blue" role="note">\s*<div class="hue-box-title">Title<\/div>/,
  'Hue Warning Box': /<div class="hue-box hue-box-orange"/,
  'Hue OK / Success Box': /<div class="hue-box hue-box-green"/,
  'Hue Note Box': /<div class="hue-box hue-box-purple"/,
  'Hue Danger Box': /<div class="hue-box hue-box-red"/,
  'Hue Generic Box': /<div class="hue-box hue-box-blue"/,
  'Hue Split Boxes (Side-by-Side)': /<div class="hue-columns hue-columns-2">\s*<div class="hue-box hue-box-green" role="note">\s*<div class="hue-box-title">Left title<\/div>[\s\S]*<div class="hue-box hue-box-orange" role="note">\s*<div class="hue-box-title">Right title<\/div>[\s\S]*Right content/,
  'Hue Rounded Box': /<div class="hue-box hue-box-blue"/,
  'Hue Color Span': /<span class="hue hue-blue">text<\/span>/,
  'Hue Diff Span': /<ins class="hue hue-diff-add">changed text<\/ins>/,
  'Hue Key Cap': /<kbd class="hue-kbd">Ctrl\+Shift\+P<\/kbd>/,
  'Hue Progress Bar': /<span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="80"/,
  'Hue Multi-State Task': /<li class="hue-task hue-task-todo">/
}

test('every snippet renders as Hue with its default text', () => {
  const snippets = loadSnippets()
  assert.deepEqual(snippets.map((s) => s.name).sort(), Object.keys(EXPECT).sort(), 'each snippet has an expectation')
  for (const s of snippets) {
    const html = md.render(defaultText(s.body))
    assert.match(html, EXPECT[s.name], `${s.name}:\n${defaultText(s.body)}\n${html}`)
  }
})

test('Obsidian templates render as Hue', () => {
  const dir = path.join(root, 'snippets', 'obsidian')
  for (const f of fs.readdirSync(dir)) {
    const html = md.render(fs.readFileSync(path.join(dir, f), 'utf8'))
    assert.match(html, /hue-box|hue-task/, f)
  }
})

test('Sublime snippets are well-formed and use no VS Code choice syntax', () => {
  const dir = path.join(root, 'snippets', 'sublime')
  for (const f of fs.readdirSync(dir)) {
    const xml = fs.readFileSync(path.join(dir, f), 'utf8')
    assert.match(xml, /^<snippet>[\s\S]*<content><!\[CDATA\[[\s\S]*\]\]><\/content>[\s\S]*<tabTrigger>[^<]+<\/tabTrigger>[\s\S]*<\/snippet>\n$/, f)
    assert.doesNotMatch(xml, /\$\{\d+\|/, f)
  }
})
