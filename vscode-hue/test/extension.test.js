import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import hue from '../../src/index.js'
import { downgrade } from '../../md-hue/src/downgrade.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('VS Code extension manifest is valid and complete', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'))
  assert.equal(pkg.name, 'hue-md')
  assert.equal(pkg.publisher, 'spingras')
  assert.equal(pkg.engines.vscode, '^1.75.0')
  assert.ok(pkg.contributes.languages.some(l => l.id === 'hue-markdown' && l.extensions.includes('.hue.md')))
  assert.ok(pkg.contributes.grammars.some(g => g.language === 'hue-markdown'))
  assert.ok(pkg.contributes['markdown.markdownItPlugins'])
  assert.ok(pkg.contributes['markdown.previewStyles'].includes('./media/hue.css'))
  assert.equal(pkg.contributes.commands.length, 4)
  // Verify no broken resourceExtname == .hue.md anywhere in menus/keybindings
  const rawPkg = readFileSync(resolve(__dirname, '../package.json'), 'utf8')
  assert.ok(!rawPkg.includes('resourceExtname == .hue.md'))
  // Verify media/hue.css has v0.2 styles and valid dark-mode selectors
  const mediaCss = readFileSync(resolve(__dirname, '../media/hue.css'), 'utf8')
  assert.ok(mediaCss.includes('.hue-columns'))
  assert.ok(mediaCss.includes('.hue-task-box'))
  assert.ok(mediaCss.includes('.hue-kbd'))
  assert.ok(mediaCss.includes('.hue-progress'))
  assert.ok(mediaCss.includes('ins.hue-diff-add'))
  assert.ok(mediaCss.includes('del.hue-diff-del'))
  assert.ok(mediaCss.includes('body.vscode-dark'))
  assert.ok(!mediaCss.includes(',\n@media'))
  assert.ok(existsSync(resolve(__dirname, '../dist/extension.cjs')))
  assert.ok(existsSync(resolve(__dirname, '../media/hue.css')))
  assert.ok(existsSync(resolve(__dirname, '../media/icon.png')))
})

test('VS Code extension extendMarkdownIt renders inline spans and boxes', () => {
  const md = new MarkdownIt()
  hue(md)

  const sample = `
Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}

+-- info Typing tip -----------------+
| ASCII boxes work too: \`+-+\` and \`|\` |
+------------------------------------+
`
  const html = md.render(sample)
  assert.match(html, /<span class="hue hue-green">passing<\/span>/)
  assert.match(html, /<span class="hue hue-orange">71%<\/span>/)
  assert.match(html, /<span class="hue hue-red">blocked<\/span>/)
  assert.match(html, /class="hue-box hue-box-blue"/)
  assert.match(html, /<div class="hue-box-title">Typing tip<\/div>/)
})

test('VS Code extension handles full palette colors and background tints', () => {
  const md = new MarkdownIt()
  hue(md)

  const text = `
{red: Red} {orange: Orange} {yellow: Yellow} {green: Green} {blue: Blue} {purple: Purple} {gray: Gray}
{bg-yellow: Highlight} {blue bg-gray: Dual} {#123456: Hex}
`
  const html = md.render(text)
  assert.match(html, /class="hue hue-red"/)
  assert.match(html, /class="hue hue-orange"/)
  assert.match(html, /class="hue hue-yellow"/)
  assert.match(html, /class="hue hue-green"/)
  assert.match(html, /class="hue hue-blue"/)
  assert.match(html, /class="hue hue-purple"/)
  assert.match(html, /class="hue hue-gray"/)
  assert.match(html, /class="hue hue-bg-yellow"/)
  assert.match(html, /class="hue hue-blue hue-bg-gray"/)
  assert.match(html, /style="color:#123456"/)
})

test('VS Code extension does not false-positive on json or math', () => {
  const md = new MarkdownIt()
  hue(md)

  const text = 'Config: {"key": "value"} or {foo: bar} or \\{red: escaped\\}'
  const html = md.render(text)
  assert.ok(!html.includes('class="hue'))
  assert.ok(html.includes('{foo: bar}'))
  assert.ok(html.includes('{red: escaped}'))
})

test('VS Code TextMate grammar patterns match Hue tokens', () => {
  const grammar = JSON.parse(readFileSync(resolve(__dirname, '../syntaxes/hue-markdown.tmLanguage.json'), 'utf8'))

  // Box top regex test
  const topPattern = new RegExp(grammar.repository['hue-box-top'].match)
  assert.ok(topPattern.test('┌── ! Never commit secrets ──────────────┐'))
  assert.ok(topPattern.test('+-- info Typing tip -----------------+'))
  assert.ok(topPattern.test('╭── ok ──────────────────────────────╮'))

  // Box bottom regex test
  const botPattern = new RegExp(grammar.repository['hue-box-bottom'].match)
  assert.ok(botPattern.test('└────────────────────────────────────────┘'))
  assert.ok(botPattern.test('+------------------------------------+'))
  assert.ok(botPattern.test('╰────────────────────────────────────╯'))

  // Box side regex test (single and split columns)
  const sidePattern = new RegExp(grammar.repository['hue-box-side'].match, 'g')
  assert.ok(sidePattern.test('│ Keep `.env` files out of git.'))
  sidePattern.lastIndex = 0
  assert.ok(sidePattern.test('| ASCII boxes work too:'))
  const splitSideMatches = [...'| Left column   | Right column'.matchAll(new RegExp(grammar.repository['hue-box-side'].match, 'g'))]
  assert.equal(splitSideMatches.length, 2)

  // Split box top & bottom regex test
  const splitTopMatches = [...'+-- ok Left Title   +-- warn Right Title'.matchAll(new RegExp(grammar.repository['hue-box-top'].match, 'g'))]
  assert.equal(splitTopMatches.length, 2)
  const splitBotMatches = [...'+--                 +--'.matchAll(new RegExp(grammar.repository['hue-box-bottom'].match, 'g'))]
  assert.equal(splitBotMatches.length, 2)

  // Inline span regex test
  const spanPattern = new RegExp(grammar.repository['hue-inline-span'].match)
  assert.ok(spanPattern.test('{ok: passing}'))
  assert.ok(spanPattern.test('{warn: 71%}'))
  assert.ok(spanPattern.test('{!: blocked}'))
  assert.ok(spanPattern.test('{blue bg-gray: color and background}'))
  assert.ok(spanPattern.test('{#c0ffee: hex value}'))
})

test('VS Code command downgradeToGfm converts demo.hue.md to GitHub alerts', () => {
  const demoContent = readFileSync(resolve(__dirname, '../../demo/demo.hue.md'), 'utf8')
  const downgraded = downgrade(demoContent)

  // Spans should have no raw {leftover
  assert.ok(!downgraded.includes('{ok: passing}'))
  assert.ok(downgraded.includes('passing'))
  assert.ok(downgraded.includes('**blocked**')) // red becomes bold in auto mode

  // Boxes should become GitHub alerts
  assert.ok(downgraded.includes('> [!CAUTION]'))
  assert.ok(downgraded.includes('Never Commit Secrets'))
  assert.ok(downgraded.includes('> [!NOTE]'))
  assert.ok(downgraded.includes('Effortless Boxes'))
  assert.ok(downgraded.includes('> [!TIP]'))
  assert.ok(downgraded.includes('> [!IMPORTANT]'))
  assert.ok(downgraded.includes('> [!WARNING]'))
})
