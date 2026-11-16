// Automated Acceptance Test Suite (ACC) for Hue Markdown v0.2 features.
// Validates ACC-1 through ACC-6 plus non-regression gates before PRD promotion.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import hueNext, {
  css as cssNext,
  isValidKeycap,
  matchProgressBar,
  parseSplitBoxes
} from '../src/index.js'
import {
  downgrade as downgradeNext,
  renderAnsi as renderAnsiNext,
  parseSlides,
  renderSlides
} from '../md-hue/src/index.js'
import { textWidth } from '../md-hue/src/ansi.js'
import { parseSpecExamples } from '../spec/parse-spec.js'
import { time } from '../scripts/bench-pathological.js'

const md = new MarkdownIt('commonmark').use(hueNext)
const r = (s) => md.render(s).trim()

// ------------------------------------------------------------ Gate 1: Executable ACC Spec Examples

const accText = readFileSync(new URL('../acc/ACC.md', import.meta.url), 'utf8')
const accExamples = parseSpecExamples(accText)

test('ACC spec has at least 25 executable examples and no unfilled TODOs', () => {
  assert.ok(accExamples.length >= 25, `expected >= 25 ACC examples, found ${accExamples.length}`)
  const todos = accExamples.filter((e) => e.html === 'TODO\n').map((e) => e.number)
  assert.deepEqual(todos, [])
})

for (const ex of accExamples) {
  test(`ACC spec example ${ex.number} (${ex.section}, ACC.md line ${ex.line})`, () => {
    assert.equal(md.render(ex.markdown), ex.html)
  })
}

// ------------------------------------------------------------ Gate 2: Backward Compatibility with v0.1 Spec

const v1SpecText = readFileSync(new URL('../spec/spec.md', import.meta.url), 'utf8')
const v1Examples = parseSpecExamples(v1SpecText)

test('ACC backward compatibility: all 58 Hue v0.1 spec examples pass unchanged with hueNext', () => {
  assert.equal(v1Examples.length, 58)
  for (const ex of v1Examples) {
    assert.equal(md.render(ex.markdown), ex.html, `v0.1 spec example ${ex.number} failed`)
  }
})

// ------------------------------------------------------------ Gate 3: CommonMark 0.31.2 Strict Superset

test('ACC CommonMark 0.31.2 gate: all 652 CommonMark examples render identically with hueNext', () => {
  const cmSpec = JSON.parse(readFileSync(new URL('./fixtures/commonmark-0.31.2.json', import.meta.url), 'utf8'))
  const plain = new MarkdownIt('commonmark')
  const diffs = cmSpec.filter((ex) => plain.render(ex.markdown) !== md.render(ex.markdown))
  assert.deepEqual(diffs.map((d) => d.example), [], `CommonMark examples changed: ${diffs.map((d) => d.example).join(', ')}`)
  assert.equal(cmSpec.length, 652)
})

// ------------------------------------------------------------ Gate 4: Real-World Corpus False-Positive Check

// corpus/ is gitignored, so it only exists on machines that ran scripts/fetch-corpus.js.
// Without it (e.g. GitHub Actions) this gate is skipped instead of failing.
const corpusRoot = fileURLToPath(new URL('../corpus', import.meta.url))
const hasCorpus = existsSync(join(corpusRoot, 'readme')) || existsSync(join(corpusRoot, 'llm'))

test('ACC corpus gate: 0 unintended false positives on keycaps, progress bars, diff spans, or split boxes across 250 corpus files', {
  skip: hasCorpus ? false : 'corpus/ not present; run node scripts/fetch-corpus.js to enable'
}, () => {
  const dirs = [join(corpusRoot, 'readme'), join(corpusRoot, 'llm')].filter((d) => existsSync(d))
  const hits = []
  let scanned = 0

  function scanTokens (tokens, file) {
    for (const t of tokens) {
      if (t.type === 'hue_columns_open') hits.push({ file, kind: 'split_box' })
      if (t.type === 'inline' && t.children) {
        for (const c of t.children) {
          if (c.type === 'hue_kbd') hits.push({ file, kind: 'kbd', markup: c.markup })
          if (c.type === 'hue_progress') hits.push({ file, kind: 'progress', markup: c.markup })
          if (c.type === 'hue_diff_open') hits.push({ file, kind: 'diff', markup: c.markup })
        }
      }
      if (t.children && t.type !== 'inline') scanTokens(t.children, file)
    }
  }

  for (const d of dirs) {
    for (const name of readdirSync(d).filter((f) => /\.(md|markdown)$/i.test(f))) {
      scanned++
      const src = readFileSync(join(d, name), 'utf8')
      scanTokens(md.parse(src, {}), name)
    }
  }

  assert.ok(scanned >= 200, `expected >= 200 corpus files, scanned ${scanned}`)
  assert.deepEqual(hits, [], `Unexpected corpus hits: ${JSON.stringify(hits)}`)
})

// ------------------------------------------------------------ ACC-1: Multi-State Tasks Unit Tests

test('ACC-1: multi-state tasks support inlineStyles for email/CSS-less targets', () => {
  const mdInline = new MarkdownIt().use(hueNext, { inlineStyles: true })
  const out = mdInline.render('- [!] Urgent blocker\n- [-] In progress')
  assert.match(out, /hue-task-blocked/)
  assert.match(out, /style="color:#b42318;background:#fde8e7/)
  assert.match(out, /hue-task-progress/)
})

// ------------------------------------------------------------ ACC-2: Side-by-Side Split Boxes Unit Tests

test('ACC-2: split boxes fall back cleanly if second box is unclosed or misaligned', () => {
  const unclosed = [
    '+-- ok Left     +-- warn Right',
    '| closed        | unclosed',
    '+--             | still open'
  ].join('\n')
  assert.equal(parseSplitBoxes(unclosed.split('\n')), null)
  assert.doesNotMatch(r(unclosed), /hue-columns/)
})

test('ACC-2: split boxes support inlineStyles grid layout', () => {
  const mdInline = new MarkdownIt().use(hueNext, { inlineStyles: true })
  const out = mdInline.render(['+-- ok A  +-- info B', '| 1       | 2', '+--       +--'].join('\n'))
  assert.match(out, /display:grid;grid-template-columns:repeat\(auto-fit,minmax\(240px,1fr\)\)/)
})

// ------------------------------------------------------------ ACC-3: Native Key Caps Unit Tests

test('ACC-3: isValidKeycap accepts real shortcuts and rejects WikiLinks and array indices', () => {
  assert.equal(isValidKeycap('Ctrl'), true)
  assert.equal(isValidKeycap('Cmd+Shift+P'), true)
  assert.equal(isValidKeycap('Alt+F4'), true)
  assert.equal(isValidKeycap('Ctrl++'), true)
  assert.equal(isValidKeycap('Esc'), true)
  assert.equal(isValidKeycap('?'), true)
  assert.equal(isValidKeycap('K'), true)

  assert.equal(isValidKeycap('Project Plan'), false)
  assert.equal(isValidKeycap('wiki_page'), false)
  assert.equal(isValidKeycap('0'), false)
  assert.equal(isValidKeycap('a'), false)
  assert.equal(isValidKeycap('1, 2'), false)
  assert.equal(isValidKeycap(''), false)
})

test('ACC-3: keycaps escape HTML special characters', () => {
  assert.equal(r('Press [[<]] or [[>]].'), '<p>Press <kbd class="hue-kbd">&lt;</kbd> or <kbd class="hue-kbd">&gt;</kbd>.</p>')
})

// ------------------------------------------------------------ ACC-4: Text Progress Bars Unit Tests

test('ACC-4: matchProgressBar validates length and bounds', () => {
  assert.equal(matchProgressBar('[==] 50%', 0, 8), null) // < 4 chars
  assert.equal(matchProgressBar('[====] 101%', 0, 11), null) // > 100%
  assert.equal(matchProgressBar('[    ] 50%', 0, 10), null) // all spaces
  assert.equal(matchProgressBar('[====....] 60%(url)', 0, 19), null) // followed by (
  const valid = matchProgressBar('[======....] 60%', 0, 16)
  assert.equal(valid.pct, 60)
  assert.equal(valid.color, 'blue')
})

// ------------------------------------------------------------ ACC-5: Inline Diff Spans Unit Tests

test('ACC-5: diff spans support inlineStyles and nested spans', () => {
  const mdInline = new MarkdownIt().use(hueNext, { inlineStyles: true })
  const out = mdInline.render('{+: added} and {-: removed}')
  assert.match(out, /<ins class="hue hue-diff-add" style="color:#067647;background:#dcf5e7/)
  assert.match(out, /<del class="hue hue-diff-del" style="color:#b42318;background:#fde8e7;text-decoration:line-through/)
})

// ------------------------------------------------------------ ACC-6: Terminal Slide Deck Mode Unit Tests

test('ACC-6: parseSlides splits on top-level --- but ignores --- inside boxes and code fences', () => {
  const deck = [
    '# Intro Slide',
    'Welcome to Hue.',
    '',
    '---',
    '',
    '# Code & Box Slide',
    '```yaml',
    '---',
    'key: value',
    '```',
    '+-- info Note',
    '| ---',
    '+--',
    '',
    '---',
    '',
    '# Final Slide',
    '- [x] Done'
  ].join('\n')

  const slides = parseSlides(deck)
  assert.equal(slides.length, 3)
  assert.equal(slides[0].title, 'Intro Slide')
  assert.equal(slides[1].title, 'Code & Box Slide')
  assert.equal(slides[2].title, 'Final Slide')

  const ansiAll = renderSlides(deck, { width: 64, theme: 'dark', color: true })
  assert.match(ansiAll, /\[ 1 \/ 3 \]/)
  assert.match(ansiAll, /\[ 2 \/ 3 \]/)
  assert.match(ansiAll, /\[ 3 \/ 3 \]/)

  // Every line in the rendered slide deck fits exactly within width 64
  for (const line of ansiAll.trim().split('\n')) {
    if (line === '') continue
    assert.equal(textWidth(line), 64, `Slide line width ${textWidth(line)} != 64: ${line}`)
  }

  // Selecting a single slide works
  const single = renderSlides(deck, { width: 64, slide: 2, color: false })
  assert.match(single, /\[ 2 \/ 3 \]/)
  assert.doesNotMatch(single, /\[ 1 \/ 3 \]/)
})

// ------------------------------------------------------------ Downgrade Completeness Gate (ACC)

test('ACC downgrade: converts all 6 ACC constructs to valid GitHub Flavored Markdown', () => {
  const src = [
    '- [ ] Todo task',
    '- [-] Active task with [[Ctrl+C]]',
    '- [!] Blocked on {!: crash}',
    '- [?] Question about {+: new API} vs {-: old API}',
    '- [x] Completed [==========] 100%',
    '',
    '+-- ok Do this          +-- warn Avoid this',
    '| Pure functions        | Global mutation',
    '+--                     +--'
  ].join('\n')

  const gfm = downgradeNext(src)
  assert.match(gfm, /- \[ \] Todo task/)
  assert.match(gfm, /- \[ \] \*\(in progress\)\* Active task with <kbd>Ctrl\+C<\/kbd>/)
  assert.match(gfm, /- \[ \] \*\*\[!\]\*\* Blocked on \*\*crash\*\*/)
  assert.match(gfm, /- \[ \] \*\*\[\?\]\*\* Question about \*\*\+new API\*\* vs ~~old API~~/)
  assert.match(gfm, /- \[x\] Completed \[==========\] 100%/)
  assert.match(gfm, /> \[!TIP\]\n> \*\*Do this\*\*\n>\n> Pure functions/)
  assert.match(gfm, /> \[!WARNING\]\n> \*\*Avoid this\*\*\n>\n> Global mutation/)
  assert.doesNotMatch(gfm, /\{\+:|\{-:|\[\[Ctrl|\+--/)
})

test('ACC downgrade property: every CommonMark 0.31.2 example is returned unchanged', () => {
  const cmSpec = JSON.parse(readFileSync(new URL('./fixtures/commonmark-0.31.2.json', import.meta.url), 'utf8'))
  for (const ex of cmSpec) {
    const src = ex.markdown.replace(/\n$/, '')
    assert.equal(downgradeNext(src), src, `CommonMark example ${ex.example} changed on downgrade`)
  }
})

// ------------------------------------------------------------ Terminal ANSI Gate (ACC)

test('ACC ANSI renderer: renders tasks, split boxes, keycaps, progress bars, and diffs within width', () => {
  const src = [
    '# Release Status',
    '',
    'Press [[Ctrl+K]] to deploy {+: v0.2} ({-: v0.1}): [========..] 80%',
    '',
    '- [x] Spec complete',
    '- [-] Terminal view',
    '- [!] Blocker check',
    '',
    '+-- ok Fast             +-- info Safe',
    '| Linear scan           | Zero false positives',
    '+--                     +--'
  ].join('\n')

  const ansi = renderAnsiNext(src, { width: 60, theme: 'dark', color: true })
  const plainAnsi = ansi.replace(/\x1b\[[0-9;]*m/g, '')
  assert.match(ansi, /\[✔\]/)
  assert.match(ansi, /\[◐\]/)
  assert.match(ansi, /\[!\]/)
  assert.match(ansi, /\[Ctrl\+K\]/)
  assert.match(plainAnsi, /━━━━━━━━━━ 80%/)
  assert.match(ansi, /\x1b\[9;38;2;/) // strikethrough red for {-: v0.1}

  for (const line of ansi.replace(/\n$/, '').split('\n')) {
    assert.ok(textWidth(line) <= 60, `ANSI line exceeds width 60 (${textWidth(line)}): ${line}`)
    // Every colored line resets SGR at the end so colors never leak
    if (line.includes('\x1b[')) {
      assert.ok(line.endsWith('\x1b[0m') || !/\x1b\[[1-9]/.test(line.slice(line.lastIndexOf('\x1b[0m'))))
    }
  }
})

// ------------------------------------------------------------ CSS Gate (ACC)

test('ACC CSS generator: includes all v0.2 ACC selectors', () => {
  const sheet = cssNext()
  for (const cls of [
    '.hue-task-list',
    '.hue-task-box-progress',
    '.hue-task-box-blocked',
    '.hue-task-box-question',
    '.hue-task-box-done',
    '.hue-columns',
    '.hue-kbd',
    '.hue-progress',
    '.hue-progress-fill',
    'ins.hue-diff-add',
    'del.hue-diff-del'
  ]) {
    assert.ok(sheet.includes(cls), `missing CSS selector ${cls}`)
  }
})

// ------------------------------------------------------------ Pathological Performance Gate (ACC)

// The gate checks how render time grows, not a fixed number of milliseconds,
// so a slow CI runner cannot fail it (a 200 ms budget failed at 210 ms there).
// From 5,000 to 20,000 tokens (4x the input), linear code takes about 4x as
// long (measured 3.4x to 5.2x) and the real risk, quadratic code, about 16x.
// The hard cap catches anything catastrophic on any machine.
const ACC_MAX_GROWTH = 10
const ACC_HARD_CAP_MS = 2000
const best = (fn) => Math.min(time(fn), time(fn), time(fn))

test(`ACC pathological performance: 4x more unclosed ACC tokens costs under ${ACC_MAX_GROWTH}x the time`, () => {
  const cases = {
    'unclosed [[ keycaps': (n) => '[[Ctrl '.repeat(n),
    'unclosed [=== progress bars': (n) => '[====.... '.repeat(n),
    'unclosed {+: diff spans': (n) => '{+: added '.repeat(n),
    'unclosed {-: diff spans': (n) => '{-: removed '.repeat(n),
    'unclosed split boxes': (n) => '+-- ok A   +-- warn B\n'.repeat(n / 4)
  }

  for (const [name, make] of Object.entries(cases)) {
    const small = make(5000)
    const big = make(20000)
    md.render(small) // warm up
    md.render(big)
    const tSmall = best(() => md.render(small))
    const tBig = best(() => md.render(big))
    const growth = tBig / Math.max(tSmall, 1)
    assert.ok(tBig < ACC_HARD_CAP_MS, `${name}: 20,000 tokens took ${tBig.toFixed(1)} ms (hard cap ${ACC_HARD_CAP_MS} ms)`)
    assert.ok(growth < ACC_MAX_GROWTH, `${name}: 4x the input took ${growth.toFixed(1)}x the time (${tSmall.toFixed(1)} ms -> ${tBig.toFixed(1)} ms); linear is about 4x`)
  }
})

test('ACC seeded fuzz gate: 2,500 random documents with ACC tokens never throw and keep tags balanced', () => {
  let seed = 20261116
  const rand = () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pieces = [
    '{+:', '{-:', '{red:', '}', '[[Ctrl]]', '[[Shift+P]]', '[[', ']]',
    '[====....] 60%', '[==========] 100%', '[', ']',
    '- [ ] ', '- [-] ', '- [!] ', '- [?] ', '- [x] ',
    '+-- ok A   +-- warn B\n', '| x        | y\n', '+--        +--\n',
    ' ', '\n', '`', '**', 'hello', '---'
  ]
  const mdSafe = new MarkdownIt().use(hueNext)
  const count = (s, re) => (s.match(re) || []).length

  for (let i = 0; i < 2500; i++) {
    const len = Math.floor(rand() * 40)
    let src = ''
    for (let k = 0; k < len; k++) src += pieces[Math.floor(rand() * pieces.length)]
    const html = mdSafe.render(src)
    assert.equal(count(html, /<ins /g), count(html, /<\/ins>/g), `ins balance at iter ${i}`)
    assert.equal(count(html, /<del /g), count(html, /<\/del>/g), `del balance at iter ${i}`)
    assert.equal(count(html, /<kbd /g), count(html, /<\/kbd>/g), `kbd balance at iter ${i}`)
    assert.equal(count(html, /<div /g), count(html, /<\/div>/g), `div balance at iter ${i}`)
  }
})

