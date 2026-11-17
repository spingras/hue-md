import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import hue from '../../../src/index.js'
import { downgrade, downgradeSpans } from '../src/downgrade.js'
import { parseSpecExamples } from '../../../spec/parse-spec.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const withHue = new MarkdownIt({ html: true }).use(hue)
const plain = new MarkdownIt({ html: true })
const specExamples = parseSpecExamples(read('../../../spec/spec.md'))
const commonmark = JSON.parse(read('../../../test/fixtures/commonmark-0.31.2.json'))

test('spans: red/orange become bold, other colors are dropped (auto)', () => {
  assert.equal(downgradeSpans('{!: stop} {warn: careful} {ok: fine} {bg-yellow: mark}'), '**stop** **careful** fine mark')
})

test('spans: plain, bold and latex modes', () => {
  assert.equal(downgradeSpans('{red: a} {blue: b}', { spans: 'plain' }), 'a b')
  assert.equal(downgradeSpans('{red: a} {blue: b}', { spans: 'bold' }), '**a** **b**')
  assert.equal(downgradeSpans('{blue: go}', { spans: 'latex' }), String.raw`$\color{blue}{\text{go}}$`)
  // markdown inside content can't go in LaTeX: falls back (blue -> plain)
  assert.equal(downgradeSpans('{blue: **x**}', { spans: 'latex' }), '**x**')
})

test('spans: trailing spaces stay outside the bold markers', () => {
  assert.equal(downgradeSpans('{red: x  }.'), '**x**  .')
})

test('spans: nested spans and code spans', () => {
  assert.equal(downgradeSpans('{blue: a {red: b} c} `{red: no}`'), 'a **b** c `{red: no}`')
})

test('spans: link and image URLs are never modified by downgrade', () => {
  assert.equal(downgrade('[a](http://x/{red:y})'), '[a](http://x/{red:y})')
  assert.equal(downgrade('[{red: a}](http://x/{red:y})'), '[**a**](http://x/{red:y})')
  assert.equal(downgrade('![a](http://x/{red:y})'), '![a](http://x/{red:y})')
  assert.equal(downgrade('[ref]: http://x/{red:y}\n\n[ref]'), '[ref]: http://x/{red:y}\n\n[ref]')
})

test('boxes become GitHub alerts by color', () => {
  const box = (label) => downgrade(`┌─ ${label} ─┐\n│ x │\n└──┘`).split('\n')[0]
  assert.equal(box('danger'), '> [!CAUTION]')
  assert.equal(box('warn'), '> [!WARNING]')
  assert.equal(box('yellow'), '> [!WARNING]')
  assert.equal(box('ok'), '> [!TIP]')
  assert.equal(box('info'), '> [!NOTE]')
  assert.equal(box('note'), '> [!IMPORTANT]')
  assert.equal(box('muted Title'), '> **Title**')
})

test('boxes keep list indentation and quote prefixes', () => {
  assert.equal(downgrade('- a\n\n  ┌─ ok ─┐\n  │ x │\n  └──┘'), '- a\n\n  > [!TIP]\n  > x')
  assert.equal(downgrade('> ┌─ info ─┐\n> │ q │\n> └──┘'), '> > [!NOTE]\n> > q')
})

test('hue fences are unwrapped and downgraded', () => {
  assert.equal(downgrade('```hue\n┌─ ok ─┐\n│ x │\n└──┘\n```'), '> [!TIP]\n> x')
})

test('minimal open boxes downgrade to GitHub alerts and preserve line breaks', () => {
  const src = [
    '+-- info Pro Tip',
    '| First point',
    '| Second point',
    '+--'
  ].join('\n')
  const out = downgrade(src)
  assert.equal(out, [
    '> [!NOTE]',
    '> **Pro Tip**',
    '>',
    '> First point  ',
    '> Second point'
  ].join('\n'))
  assert.match(plain.render(out), /First point<br>\nSecond point/)
})

test('code is never touched', () => {
  const src = '```md\n{red: x}\n┌─ ok ─┐\n│ x │\n└──┘\n```\n\n    {red: y}\n\n<div>{red: z}</div>'
  assert.equal(downgrade(src), src)
})

// ------------------------------------------------------------ properties

test('property: every CommonMark 0.31.2 example is returned unchanged', () => {
  const changed = commonmark.filter((ex) => downgrade(ex.markdown) !== ex.markdown).map((ex) => ex.example)
  assert.deepEqual(changed, [])
})

// Two v0.2 constructs stay in the output on purpose, because GitHub shows them
// well as they are: task lists become GitHub checkboxes (`- [ ]`, `- [x]`),
// which Hue also reads as task states, and text progress bars (`[====..] 60%`)
// stay as plain text. They are removed before comparing; everything else
// (spans, boxes, key caps, diffs, fences) must be gone.
const KEPT_ON_PURPOSE = (md) => md
  .replace(/^(\s*(?:[-*+]|\d+[.)])) \[[ xX]\] /gm, '$1 ')
  .replace(/\[[=#■█]*[.\-_░ ]*\] *\d{1,3}%/g, 'BAR')

test('property: no Hue syntax survives a downgrade (all spec examples and the demo)', () => {
  const docs = [...specExamples.map((e) => [`spec example ${e.number}`, e.markdown]), ['demo', read('../../../demo/demo.hue.md')]]
  for (const mode of ['auto', 'plain', 'bold', 'latex']) {
    for (const [name, src] of docs) {
      const out = KEPT_ON_PURPOSE(downgrade(src, { spans: mode }))
      assert.equal(withHue.render(out), plain.render(out), `${name} (${mode}) still has Hue syntax:\n${out}`)
    }
  }
})

test('snapshot: demo downgrade', () => {
  assert.equal(downgrade(read('../../../demo/demo.hue.md')), read('./fixtures/demo.downgrade.md'))
})
