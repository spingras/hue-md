// Runs every example in spec/spec.md against the plugin, and checks that the
// spec documents every token the implementation accepts (and nothing more).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import hue, { COLORS, SEMANTIC } from '../src/index.js'
import { parseSpecExamples } from '../spec/parse-spec.js'

const specText = readFileSync(new URL('../spec/spec.md', import.meta.url), 'utf8')
const examples = parseSpecExamples(specText)
const md = new MarkdownIt('commonmark').use(hue)

test('spec has examples and no unfilled TODO outputs', () => {
  assert.ok(examples.length >= 50, `only ${examples.length} examples`)
  const todo = examples.filter((e) => e.html === 'TODO\n').map((e) => e.number)
  assert.deepEqual(todo, [])
})

for (const ex of examples) {
  test(`spec example ${ex.number} (${ex.section}, spec.md line ${ex.line})`, () => {
    assert.equal(md.render(ex.markdown), ex.html)
  })
}

// Token tables: rows in the "Colors" and "Semantic aliases" sections whose first cell is `token`
function tableTokens (heading) {
  const start = specText.indexOf(`## ${heading}\n`)
  const end = specText.indexOf('\n## ', start + 1)
  const section = specText.slice(start, end === -1 ? undefined : end)
  return [...section.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1])
}

test('spec color table lists exactly the palette colors', () => {
  assert.deepEqual(tableTokens('Colors').sort(), Object.keys(COLORS).sort())
})

test('spec alias table lists exactly the semantic aliases, mapped to the same colors', () => {
  assert.deepEqual(tableTokens('Semantic aliases').sort(), Object.keys(SEMANTIC).sort())
  const start = specText.indexOf('## Semantic aliases\n')
  for (const [alias, color] of Object.entries(SEMANTIC)) {
    const row = new RegExp('^\\| `' + alias.replace(/[!]/g, '\\$&') + '`\\s*\\| `' + color + '`', 'm')
    assert.match(specText.slice(start), row, `alias ${alias} should map to ${color} in the spec`)
  }
})

test('spec palette appendix matches palette.js', () => {
  for (const [name, c] of Object.entries(COLORS)) {
    const row = new RegExp(`^\\| ${name}\\s*\\| \`${c.light.fg}\`\\s*\\| \`${c.light.bg}\`\\s*\\| \`${c.dark.fg}\`\\s*\\| \`${c.dark.bg}\``, 'm')
    assert.match(specText, row, `palette row for ${name}`)
  }
})
