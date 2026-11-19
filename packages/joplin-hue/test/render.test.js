// Renders demo/demo.hue.md through Joplin's own renderer (@joplin/renderer,
// the MdToHtml class the desktop and mobile apps use) with the built content
// script loaded the way Joplin loads a plugin's markdown-it content script.
//
// Run `npm run dist` first: the test loads dist/contentScript.js, the file
// that ships inside the .jpl.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const tar = require('tar')
const MdToHtml = require('@joplin/renderer/MdToHtml').default

const pkgDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(pkgDir, '..', '..')
const distDir = path.join(pkgDir, 'dist')
const scriptPath = path.join(distDir, 'contentScript.js')

if (!fs.existsSync(scriptPath)) {
	throw new Error('dist/contentScript.js is missing: run `npm run dist` in packages/joplin-hue first')
}

const contentScript = require(scriptPath).default

// pluginOptions mirror Joplin settings. The desktop default has "soft breaks"
// off, which runs markdown-it with breaks: true.
function renderer (pluginOptions = {}) {
	return new MdToHtml({
		pluginOptions,
		extraRendererRules: [{
			id: 'hue-md',
			module: contentScript({ contentScriptId: 'hue-md' }),
			assetPath: distDir,
			pluginId: 'io.github.spingras.hue-md'
		}]
	})
}

async function render (md, theme = {}, pluginOptions = {}) {
	return renderer(pluginOptions).render(md, theme, { bodyOnly: true })
}

const demo = fs.readFileSync(path.join(repoDir, 'demo', 'demo.hue.md'), 'utf8')

test('demo: colored spans, hex spans and diff spans', async () => {
	const { html } = await render(demo)
	assert.match(html, /<span class="hue hue-green">passing<\/span>/)
	assert.match(html, /<span class="hue hue-orange">71%<\/span>/)
	assert.match(html, /<span class="hue hue-red">blocked<\/span>/)
	assert.match(html, /<span class="hue hue-bg-yellow">key phrases<\/span>/)
	assert.match(html, /<span class="hue hue-blue hue-bg-gray">text and background<\/span>/)
	// Joplin's HTML sanitizer must keep the inline style of hex colors
	assert.match(html, /<span class="hue" style="color:#c0ffee;background:#333333">hex color<\/span>/)
	assert.match(html, /Normal prose like \{a: 1\} or \{key: value\} stays untouched/)
	assert.match(html, /<ins class="hue hue-diff-add">added key caps and progress bars<\/ins>/)
	assert.match(html, /<del class="hue hue-diff-del">removed the old md-hue package<\/del>/)
})

test('demo: boxes with titles, markdown and lists inside', async () => {
	const { html } = await render(demo)
	for (const [color, title] of [
		['blue', 'Effortless Boxes'],
		['green', 'Full Markdown Inside'],
		['purple', 'GitHub Ready'],
		['orange', 'Heads Up'],
		['red', 'Never Commit Secrets']
	]) {
		assert.match(html, new RegExp(`<div class="hue-box hue-box-${color}" role="note">\\s*<div class="hue-box-title">${title}</div>`))
	}
	assert.match(html, /Boxes support <strong>bold<\/strong>, <em>italics<\/em>/)
	assert.match(html, /<li>Rotate any key that leaked <span class="hue hue-red">immediately<\/span><\/li>/)
	// `+--` only survives inside inline code, never as a raw box border
	assert.doesNotMatch(html.replace(/<code[^>]*>[^<]*<\/code>/g, ''), /\+--|^\| /m, 'no raw box borders left in the output')
})

test('box lines get one line break each with Joplin default settings', async () => {
	const { html } = await render('+-- ok Title\n| one\n| two\n+--\n', {}, { softbreaks: { enabled: false } })
	assert.match(html, /<p>one<br>two<\/p>/)
	const plain = await render('a\nb\n', {}, { softbreaks: { enabled: false } })
	assert.match(plain.html, /a<br>b/)
})

test('demo: split boxes render side by side', async () => {
	const { html } = await render(demo)
	assert.match(html, /<div class="hue-columns hue-columns-2">\s*<div class="hue-box hue-box-green" role="note">\s*<div class="hue-box-title">Do this<\/div>[\s\S]*<div class="hue-box hue-box-orange" role="note">\s*<div class="hue-box-title">Avoid this<\/div>/)
})

test('demo: multi-state tasks, with [ ] and [x] left to Joplin checkboxes', async () => {
	const { html } = await render(demo)
	assert.match(html, /<li class="hue-task hue-task-progress"><span class="hue-task-box hue-task-box-progress" aria-hidden="true">&#9680;<\/span> Release notes <ins class="hue hue-diff-add">in progress<\/ins><\/li>/)
	assert.match(html, /<li class="hue-task hue-task-blocked"><span class="hue-task-box hue-task-box-blocked" aria-hidden="true">!<\/span> Launch post/)
	assert.match(html, /<li class="hue-task hue-task-question"><span class="hue-task-box hue-task-box-question" aria-hidden="true">\?<\/span> More examples/)
	// Joplin's own clickable checkboxes, which tick the note source when clicked
	assert.match(html, /<input type="checkbox" id="md-checkbox-\d+"[^>]*checked="checked"><label[^>]*>Spec and tests pass<\/label>/)
	assert.match(html, /<input type="checkbox" id="md-checkbox-\d+"[^>]*"><label[^>]*class="checkbox-label-unchecked">Announce the release<\/label>/)
	assert.doesNotMatch(html, /\[[-!?]\]/, 'no raw task markers left')
})

test('plain checklists stay interactive Joplin checklists', async () => {
	const { html } = await render('- [ ] milk\n- [x] bread\n')
	assert.match(html, /<ul data-is-checklist="1">/)
	assert.equal((html.match(/<input type="checkbox"/g) || []).length, 2)
	assert.doesNotMatch(html, /hue-task/)
})

test('demo: key caps and progress bars', async () => {
	const { html } = await render(demo)
	assert.match(html, /<kbd class="hue-kbd">Ctrl\+Shift\+V<\/kbd>/)
	assert.match(html, /<kbd class="hue-kbd">Esc<\/kbd>/)
	assert.match(html, /<span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="80"[^>]*><span class="hue-progress-track"><span class="hue-progress-fill" style="width:80%"><\/span><\/span><span class="hue-progress-label">80%<\/span><\/span>/)
	assert.match(html, /<span class="hue-progress hue-progress-green" role="progressbar" aria-valuenow="100"/)
})

test('```hue fences render as Hue', async () => {
	const { html } = await render('```hue\n{ok: inside a fence}\n```\n')
	assert.match(html, /<span class="hue hue-green">inside a fence<\/span>/)
})

test('assets: stylesheet from dist plus theme colors for light and dark', async () => {
	const light = await render(demo, { appearance: 'light', color: '#32373F' })
	const sheet = light.pluginAssets.find((a) => a.name === 'hue-md/hue-md.css')
	assert.ok(sheet, 'hue-md.css is a plugin asset')
	assert.ok(fs.existsSync(sheet.path), `asset file exists at ${sheet.path}`)
	assert.match(fs.readFileSync(sheet.path, 'utf8'), /\.hue-box\s*\{/)

	const lightCss = light.cssStrings.find((s) => s.includes(':root:root:root'))
	assert.match(lightCss, /--hue-green: #067647;/)
	assert.match(lightCss, /--hue-text: #32373F;/)

	const dark = await render(demo, { appearance: 'dark', color: '#dddddd' })
	const darkCss = dark.cssStrings.find((s) => s.includes(':root:root:root'))
	assert.match(darkCss, /--hue-green: #3fb950;/)
	assert.match(darkCss, /--hue-text: #dddddd;/)
})

test('.jpl archive holds the plugin and matches the package version', async () => {
	const pkg = require(path.join(pkgDir, 'package.json'))
	const rootPkg = require(path.join(repoDir, 'package.json'))
	const manifest = require(path.join(pkgDir, 'src', 'manifest.json'))
	assert.equal(manifest.version, pkg.version)
	assert.equal(pkg.version, rootPkg.version)
	assert.equal(manifest.homepage_url, 'https://spingras.github.io/hue-md/')
	assert.equal(manifest.repository_url, 'https://github.com/spingras/hue-md')

	const jpl = path.join(pkgDir, 'publish', `${manifest.id}.jpl`)
	assert.ok(fs.existsSync(jpl), `${jpl} exists`)
	const entries = []
	await tar.t({ file: jpl, onentry: (e) => entries.push(e.path) })
	for (const f of ['index.js', 'contentScript.js', 'hue-md.css', 'manifest.json']) {
		assert.ok(entries.includes(f), `${f} is in the .jpl (found ${entries.join(', ')})`)
	}
})

test('plugin registers the Tools → Hue MD menu with the demo note command', () => {
	const main = fs.readFileSync(path.join(distDir, 'index.js'), 'utf8')
	assert.match(main, /hueMdToolsMenu/)
	assert.match(main, /New Hue MD demo note/)
	assert.match(main, /Insert info box/)
	assert.ok(main.includes(JSON.stringify(demo).slice(1, 60)), 'demo note text is bundled')
})
