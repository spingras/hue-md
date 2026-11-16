import { test } from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'
import { CASES, time } from '../scripts/bench-pathological.js'

const md = new MarkdownIt().use(hue)

// ------------------------------------------------------------ step 17: adversarial input stays fast
// These tests check how render time grows, not a fixed number of milliseconds,
// so a slow CI machine cannot fail them. From n=5000 to n=20000 (4x the input),
// linear code takes about 4x as long and quadratic code about 16x; before the
// fix, "unclosed openers" was quadratic and took ~2,400 ms at n=20000. The hard
// cap catches anything catastrophic on any machine.

const MAX_GROWTH = 10
const HARD_CAP_MS = 2000
const best = (fn) => Math.min(time(fn), time(fn), time(fn))

function assertLinear (renderer, name, make) {
  const small = make(5000)
  const big = make(20000)
  renderer.render(small) // warm-up
  renderer.render(big)
  const tSmall = best(() => renderer.render(small))
  const tBig = best(() => renderer.render(big))
  const growth = tBig / Math.max(tSmall, 1)
  assert.ok(tBig < HARD_CAP_MS, `${name}: n=20000 took ${tBig.toFixed(0)} ms (hard cap ${HARD_CAP_MS} ms)`)
  assert.ok(growth < MAX_GROWTH, `${name}: 4x the input took ${growth.toFixed(1)}x the time (${tSmall.toFixed(1)} ms -> ${tBig.toFixed(1)} ms); linear is about 4x`)
}

for (const [name, make] of Object.entries(CASES)) {
  test(`pathological: ${name} grows linearly (n=5000 -> 20000)`, () => {
    assertLinear(md, name, make)
  })
}

const mdHtml = new MarkdownIt('commonmark').use(hue) // raw HTML enabled
const ANGLE_CASES = {
  'unclosed angle brackets': (n) => '{red: ' + '<'.repeat(n),
  'unclosed autolinks': (n) => '{red: ' + '<http://x}'.repeat(n),
  'unclosed html attributes': (n) => '{red: ' + '<a title="}'.repeat(n),
  'many complete tags': (n) => '{red: ' + '<b title="}">x</b>'.repeat(n) + '}'
}
for (const [name, make] of Object.entries(ANGLE_CASES)) {
  test(`pathological (raw HTML on): ${name} grows linearly (n=5000 -> 20000)`, () => {
    assertLinear(mdHtml, name, make)
  })
}

test('pathological: braces without colons grow linearly (n=5000 -> 20000)', () => {
  assertLinear(md, 'braces without colons', (n) => '{'.repeat(n * 2.5) + ' ' + '{red'.repeat(n))
})

// ------------------------------------------------------------ step 19: fuzzing
// Seeded, so any failure is reproducible from the printed seed and iteration.

function rng (seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PIECES = ['{', '}', ':', ' ', '\n', '`', '``', '\\', 'red', 'bg-blue', '!', 'ok', '#fff', '#c0ffee',
  '┌─', '─┐', '│', '└──┘', '+--', '--+', '|', '╭─', '╰─╯', '*', '_', '[', ']', '(', ')', 'x', 'hello',
  '```hue\n', '```\n', '> ', '- ', '1. ', '<span>', '&amp;', '"', "'"]

const count = (s, re) => (s.match(re) || []).length

test('fuzz: 10,000 random documents never throw, stay fast, and keep tags balanced', () => {
  const SEED = 20261115
  const rand = rng(SEED)
  let slowest = 0
  for (let i = 0; i < 10000; i++) {
    const len = Math.floor(rand() * 60)
    let src = ''
    for (let k = 0; k < len; k++) src += PIECES[Math.floor(rand() * PIECES.length)]

    let html
    const ms = time(() => { html = md.render(src) })
    slowest = Math.max(slowest, ms)
    const where = `seed ${SEED}, iteration ${i}, input ${JSON.stringify(src)}`
    assert.ok(ms < 50, `slow (${ms.toFixed(1)} ms): ${where}`)
    // Raw HTML is escaped (html: false), so every </span> in the output is ours
    assert.equal(count(html, /<span class="hue/g), count(html, /<\/span>/g), `span balance: ${where}`)
    assert.equal(count(html, /<div /g), count(html, /<\/div>/g), `div balance: ${where}`)
    assert.doesNotMatch(html, /style="[^"]*(url|expression|;[^"]*:[^"]*\()/i, `unsafe style: ${where}`)
  }
  assert.ok(slowest < 50)
})

test('fuzz: input without "{" or box characters renders exactly like plain markdown-it', () => {
  const plain = new MarkdownIt()
  const rand = rng(42)
  const safe = PIECES.filter((p) => !/[{[┌╭+│|└╰]/.test(p) && !p.startsWith('```hue'))
  for (let i = 0; i < 5000; i++) {
    let src = ''
    for (let k = Math.floor(rand() * 60); k > 0; k--) src += safe[Math.floor(rand() * safe.length)]
    assert.equal(md.render(src), plain.render(src), `iteration ${i}: ${JSON.stringify(src)}`)
  }
})
