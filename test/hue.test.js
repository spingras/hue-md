import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import hue, { COLORS, PAGE, parseSpec } from '../src/index.js'

const md = new MarkdownIt().use(hue)
const r = (s) => md.render(s).trim()

// ------------------------------------------------------------ inline spans

test('color span', () => {
  assert.equal(r('{red: hi}'), '<p><span class="hue hue-red">hi</span></p>')
})

test('semantic names and ! shorthand resolve to palette colors', () => {
  assert.match(r('{ok: a}'), /hue-green/)
  assert.match(r('{!: a}'), /hue-red/)
  assert.match(r('{warn: a}'), /hue-orange/)
})

test('background and combined tokens', () => {
  assert.equal(r('{blue bg-yellow: x}'), '<p><span class="hue hue-blue hue-bg-yellow">x</span></p>')
})

test('inline markdown and nested spans inside a span', () => {
  assert.equal(r('{red: **a** {blue: b}}'),
    '<p><span class="hue hue-red"><strong>a</strong> <span class="hue hue-blue">b</span></span></p>')
})

test('brace inside a code span does not close the span', () => {
  assert.equal(r('{red: `}` x}'), '<p><span class="hue hue-red"><code>}</code> x</span></p>')
})

test('unknown words stay literal prose', () => {
  assert.equal(r('{a: 1} and {foo bar: baz}'), '<p>{a: 1} and {foo bar: baz}</p>')
})

test('escaped brace stays literal', () => {
  assert.equal(r('\\{red: x}'), '<p>{red: x}</p>')
})

test('unclosed or empty span stays literal', () => {
  assert.equal(r('{red: oops'), '<p>{red: oops</p>')
  assert.equal(r('{red:}'), '<p>{red:}</p>')
})

test('hex escape hatch emits a style attribute', () => {
  assert.equal(r('{#c0ffee: x}'), '<p><span class="hue" style="color:#c0ffee">x</span></p>')
})

test('malformed hex is rejected, so no CSS injection', () => {
  assert.equal(r('{#fff;background:url(x): y}'), '<p>{#fff;background:url(x): y}</p>')
})

test('inlineStyles option for CSS-less targets such as email', () => {
  const mdInline = new MarkdownIt().use(hue, { inlineStyles: true })
  const out = mdInline.render('{red: x}')
  assert.match(out, /style="color:#b42318"/)
  assert.equal(mdInline.render('{constructor: x} {toString: y} {bg-constructor: z}'), '<p>{constructor: x} {toString: y} {bg-constructor: z}</p>\n')
  assert.equal(r('{constructor: x} {toString: y}'), '<p>{constructor: x} {toString: y}</p>')
})

test('spans work inside link text', () => {
  assert.equal(r('[{red: go}](/x)'), '<p><a href="/x"><span class="hue hue-red">go</span></a></p>')
})

test('math formulas and set-builder notation stay literal', () => {
  const plain = new MarkdownIt()
  const samples = [
    'Set notation: $S = \\{x \\in \\mathbb{R} : x > 0\\}$ and $\{k: v\\}$.',
    'LaTeX color macro: $\\color{red}{\\text{warning}} + \\frac{a}{b}$.',
    '$$\n\\begin{cases}\na: 1 \\\\\nb: 2\n\\end{cases}\n$$'
  ]
  for (const s of samples) {
    assert.equal(md.render(s), plain.render(s))
  }
})

// ------------------------------------------------------------ boxes

test('unicode box with color and title, inner markdown parsed', () => {
  const out = r(['┌─ ! Careful ──┐', '│ **bold**     │', '│ - item       │', '└──────────────┘'].join('\n'))
  assert.equal(out, [
    '<div class="hue-box hue-box-red" role="note">',
    '<div class="hue-box-title">Careful</div>',
    '<p><strong>bold</strong></p>',
    '<ul>', '<li>item</li>', '</ul>',
    '</div>'
  ].join('\n'))
})

test('ascii box', () => {
  assert.match(r(['+-- info --+', '| hi |', '+----------+'].join('\n')), /hue-box hue-box-blue/)
})

test('minimal open ascii box (+-- info Title / | content / +--)', () => {
  const out = r([
    '+-- info Pro Tip',
    '| First point',
    '| Second point',
    '+--'
  ].join('\n'))
  assert.match(out, /<div class="hue-box hue-box-blue" role="note">/)
  assert.match(out, /<div class="hue-box-title">Pro Tip<\/div>/)
  assert.match(out, /<p>First point\nSecond point<\/p>/)
})

test('minimal open unicode and rounded boxes', () => {
  const round = r([
    '╭── warn Watch Out',
    '│ Danger ahead',
    '╰──'
  ].join('\n'))
  assert.match(round, /hue-box-orange/)
  assert.match(round, /<div class="hue-box-title">Watch Out<\/div>/)

  const square = r([
    '┌── ok All Clear',
    '│ All systems nominal',
    '└──'
  ].join('\n'))
  assert.match(square, /hue-box-green/)
  assert.match(square, /<div class="hue-box-title">All Clear<\/div>/)
})

test('rounded corners and missing right border are accepted', () => {
  assert.match(r(['╭─ ok ─╮', '│ fine', '╰──────╯'].join('\n')), /hue-box-green/)
})

test('box without a bottom border falls back to plain text', () => {
  assert.doesNotMatch(r(['┌─ red ─┐', '│ open'].join('\n')), /hue-box/)
})

test('box can interrupt a paragraph', () => {
  assert.match(r(['Intro line', '┌─ blue ─┐', '│ x │', '└────────┘'].join('\n')), /<p>Intro line<\/p>\n<div class="hue-box/)
})

test('nested boxes', () => {
  const out = r(['┌─ blue ─────────┐', '│ ┌─ red ─┐      │', '│ │ in    │      │', '│ └───────┘      │', '└────────────────┘'].join('\n'))
  assert.match(out, /hue-box-blue[\s\S]*hue-box-red/)
})

test('```hue fence renders its content as Hue', () => {
  const out = r(['```hue', '┌─ ok ─┐', '│ yes  │', '└──────┘', '```'].join('\n'))
  assert.match(out, /hue-box-green/)
  assert.doesNotMatch(out, /<pre>/)
})

test('other fences are untouched', () => {
  assert.match(r('```js\nx\n```'), /<pre><code class="language-js">/)
})

test('parseSpec', () => {
  assert.deepEqual(parseSpec('red bg-blue'), { fg: 'red', bg: 'blue', fgHex: null, bgHex: null })
  assert.equal(parseSpec('reddish'), null)
})

// ------------------------------------------------------------ external check 1: CommonMark superset
// Every CommonMark example must render identically with and without the plugin.

test('CommonMark 0.31.2: plugin changes no spec example', () => {
  const spec = JSON.parse(readFileSync(new URL('./fixtures/commonmark-0.31.2.json', import.meta.url), 'utf8'))
  const plain = new MarkdownIt('commonmark')
  const hueed = new MarkdownIt('commonmark').use(hue)
  const diffs = spec.filter((ex) => plain.render(ex.markdown) !== hueed.render(ex.markdown))
  assert.deepEqual(diffs.map((d) => d.example), [], `changed examples: ${diffs.map((d) => d.example).join(', ')}`)
  assert.equal(spec.length, 652)
})

// ------------------------------------------------------------ external check 2: WCAG 2.x contrast

function luminance (hex) {
  const n = hex.slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast (a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

for (const mode of ['light', 'dark']) {
  for (const [name, c] of Object.entries(COLORS)) {
    test(`WCAG AA ${mode} ${name}: text on page, body text on shade, text on own shade`, () => {
      const p = c[mode]
      const page = PAGE[mode]
      assert.ok(contrast(p.fg, page.bg) >= 4.5, `fg on page ${contrast(p.fg, page.bg).toFixed(2)}`)
      assert.ok(contrast(page.text, p.bg) >= 4.5, `text on bg ${contrast(page.text, p.bg).toFixed(2)}`)
      assert.ok(contrast(p.fg, p.bg) >= 4.5, `fg on own bg ${contrast(p.fg, p.bg).toFixed(2)}`)
    })
  }
}
