import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderAnsi, textWidth } from '../src/ansi.js'
import { parseSpecExamples } from '../../spec/parse-spec.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const ESC = '\x1b['
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')

test('step 26: {red: x} becomes a truecolor escape from the palette', () => {
  assert.equal(renderAnsi('{red: x}'), `${ESC}38;2;255;123;114mx${ESC}0m\n`) // dark #ff7b72
  assert.equal(renderAnsi('{red: x}', { theme: 'light' }), `${ESC}38;2;180;35;24mx${ESC}0m\n`) // light #b42318
})

test('backgrounds, aliases, hex and nesting with markdown', () => {
  assert.equal(renderAnsi('{bg-warn: y}'), `${ESC}48;2;59;36;16my${ESC}0m\n`)
  assert.equal(renderAnsi('{#c0ffee: z}'), `${ESC}38;2;192;255;238mz${ESC}0m\n`)
  assert.equal(renderAnsi('{ok: **b**}'), `${ESC}1;38;2;63;185;80mb${ESC}0m\n`)
})

test('color: false gives plain text but keeps box drawings', () => {
  assert.equal(renderAnsi('{red: x}', { color: false }), 'x\n')
  assert.equal(renderAnsi('┌─ ok Done ─┐\n│ x │\n└──┘', { width: 20, color: false }),
    ['┌─ Done ───────────┐', '│ x                │', '└──────────────────┘', ''].join('\n'))
})

test('step 27: box borders take the box color, rounded corners are kept', () => {
  const out = renderAnsi('╭─ ok ─╮\n│ x │\n╰──╯', { width: 12 })
  assert.match(out, /^\x1b\[38;2;63;185;80m╭/)
  assert.match(strip(out), /╰─+╯/)
})

test('snapshot: demo at width 60, dark theme, with colors', () => {
  assert.equal(renderAnsi(read('../../demo/demo.hue.md'), { width: 60 }), read('./fixtures/demo.ansi.txt'))
})

// ------------------------------------------------------------ properties over every spec example

const specExamples = parseSpecExamples(read('../../spec/spec.md'))

test('property: no line leaks a color into the next one', () => {
  for (const ex of specExamples) {
    for (const line of renderAnsi(ex.markdown, { width: 30 }).split('\n')) {
      const codes = line.match(/\x1b\[[0-9;]*m/g) || []
      if (codes.length) assert.equal(codes.at(-1), `${ESC}0m`, `example ${ex.number}: ${JSON.stringify(line)}`)
    }
  }
})

test('property: wrapped text never exceeds the width, and boxes are rectangles', () => {
  const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'.split(' ')
  for (let w = 12; w <= 50; w += 7) {
    const para = Array.from({ length: 40 }, (_, k) => (k % 5 === 0 ? `{red: ${words[k % 12]}}` : words[k % 12])).join(' ')
    const out = renderAnsi(`${para}\n\n┌─ blue Box ─┐\n│ ${para}\n└──┘`, { width: w })
    const lines = out.trimEnd().split('\n')
    for (const l of lines) assert.ok(textWidth(l) <= w, `width ${w}: ${JSON.stringify(strip(l))}`)
    const box = lines.filter((l) => /[┌│└]/.test(strip(l)[0] || ''))
    assert.ok(box.length > 2)
    assert.equal(new Set(box.map(textWidth)).size, 1, `box lines differ in width at ${w}`)
    // nothing lost: same words in the same order
    assert.equal(strip(lines.join(' ')).split(/[\s│┌┐└┘─]+/).filter(Boolean).slice(0, 40).join(' '), para.replace(/\{red: |\}/g, '').split(' ').join(' '))
  }
})

test('textWidth counts wide characters as two columns', () => {
  assert.equal(textWidth('ab'), 2)
  assert.equal(textWidth('日本'), 4)
  assert.equal(textWidth(`${ESC}31mab${ESC}0m`), 2)
  assert.equal(renderAnsi('界', { width: 1, color: false }), '界\n')
  assert.equal(renderAnsi('a界b', { width: 1, color: false }), 'a\n界\nb\n')
  assert.equal(renderAnsi('{constructor: x}', { color: false }), '{constructor: x}\n')
})
