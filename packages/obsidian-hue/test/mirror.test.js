// The standalone repo spingras/hue-md-obsidian is generated from this package
// by scripts/build-mirror.js on every release. This test builds it into
// dist/mirror-test/ and runs the mirror's own build there: it must produce the
// same main.js, manifest.json and styles.css as this package, or the published
// plugin would differ from the one tested here.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const repoDir = path.resolve(__dirname, '..', '..', '..')
const out = path.join(repoDir, 'dist', 'mirror-test', 'hue-md-obsidian')

test('Obsidian mirror builds the same plugin files as packages/obsidian-hue', async () => {
  const { buildMirror } = await import(pathToFileURL(path.join(repoDir, 'scripts', 'build-mirror.js')))
  const r = buildMirror('obsidian', out, { check: true })
  const version = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8')).version
  assert.equal(r.version, version)

  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
  assert.equal(manifest.id, 'hue-md')
  assert.equal(manifest.version, version)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'versions.json'), 'utf8')), { [version]: manifest.minAppVersion })
  for (const f of ['README.md', 'LICENSE', '.gitattributes', 'package-lock.json', '.github/workflows/release.yml','hue/dom.js', 'hue/index.js', 'hue/core.js', 'hue/palette.js', 'src/main.js', 'scripts/build.mjs']) {
    assert.ok(fs.existsSync(path.join(out, f)), `mirror has ${f}`)
  }
  // Only the built files at the root are ignored; the sources must be committed.
  assert.equal(fs.readFileSync(path.join(out, '.gitignore'), 'utf8'), 'node_modules/\n/main.js\n/styles.css\n')
})

test('Obsidian mirror check fails when the mirror would build different code', async () => {
  const { buildMirror, checkMirror } = await import(pathToFileURL(path.join(repoDir, 'scripts', 'build-mirror.js')))
  // A separate folder, so the first test's output is not touched while it runs.
  const probe = path.join(repoDir, 'dist', 'mirror-test', 'drift-probe')
  const r = buildMirror('obsidian', probe)
  const dom = path.join(probe, 'hue', 'dom.js')
  fs.writeFileSync(dom, fs.readFileSync(dom, 'utf8').replace("box.setAttribute('aria-hidden', 'true')", "box.setAttribute('aria-hidden', 'false')"))
  assert.throws(() => checkMirror(probe, r), /main\.js differs/)
})

test('Obsidian plugin uses no innerHTML, outerHTML or insertAdjacentHTML (Obsidian review rule)', () => {
  const main = fs.readFileSync(path.join(repoDir, 'packages', 'obsidian-hue', 'main.js'), 'utf8')
  assert.doesNotMatch(main, /innerHTML|outerHTML|insertAdjacentHTML/)
})
