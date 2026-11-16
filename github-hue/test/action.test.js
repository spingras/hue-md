import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAction, generatedHeader, isGenerated } from '../action/src/index.js'

test('GitHub Action syncs .hue.md to .md with native GitHub alerts', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hue-action-test-'))
  try {
    const hueFile = join(tmp, 'test-doc.hue.md')
    const mdFile = join(tmp, 'test-doc.md')

    const inputContent = `# Hue Test Document

Status: {ok: operational} · Alert: {!: urgent}

┌── info Configuration tip ──────────┐
│ Make sure to set your API keys.    │
└────────────────────────────────────┘
`
    writeFileSync(hueFile, inputContent, 'utf8')

    // Run action in sync mode
    const res = runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: false })
    assert.equal(res.success, true)
    assert.equal(res.outOfSyncCount, 1)
    assert.ok(existsSync(mdFile))

    const generated = readFileSync(mdFile, 'utf8')
    assert.ok(generated.includes('operational'))
    assert.ok(generated.includes('**urgent**'))
    assert.ok(generated.includes('> [!NOTE]'))
    assert.ok(generated.includes('Configuration tip'))
    assert.ok(generated.includes('Make sure to set your API keys.'))

    // Second run: should be in sync
    const checkRes = runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: true })
    assert.equal(checkRes.success, true)
    assert.equal(checkRes.outOfSyncCount, 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('GitHub Action checkOnly flags out-of-sync files (including INPUT_CHECK-ONLY env and default glob)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hue-action-check-'))
  const prevCheck = process.env['INPUT_CHECK-ONLY']
  try {
    const hueFile = join(tmp, 'readme.hue.md')
    const mdFile = join(tmp, 'readme.md')
    const plainMd = join(tmp, 'notes.md')

    const stale = generatedHeader('readme.hue.md') + 'Stale content'
    writeFileSync(hueFile, 'Version: {warn: outdated}', 'utf8')
    writeFileSync(mdFile, stale, 'utf8')
    writeFileSync(plainMd, 'Keep {red: literal} in plain .md', 'utf8')

    process.env['INPUT_CHECK-ONLY'] = 'true'
    // Also uses default pattern "**/*.hue.md"
    const checkRes = runAction({ cwd: tmp })
    assert.equal(checkRes.success, false)
    assert.equal(checkRes.outOfSyncCount, 1)
    // Must not have written mdFile in check-only mode
    assert.equal(readFileSync(mdFile, 'utf8'), stale)

    // Even if pattern is ".md", plain notes.md must never be overwritten in place
    delete process.env['INPUT_CHECK-ONLY']
    runAction({ cwd: tmp, pattern: '.md', checkOnly: false })
    assert.equal(readFileSync(plainMd, 'utf8'), 'Keep {red: literal} in plain .md')
  } finally {
    if (prevCheck === undefined) delete process.env['INPUT_CHECK-ONLY']
    else process.env['INPUT_CHECK-ONLY'] = prevCheck
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('GitHub Action never overwrites a hand-written .md next to a .hue.md', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hue-action-handwritten-'))
  try {
    const hueFile = join(tmp, 'README.hue.md')
    const mdFile = join(tmp, 'README.md')
    const handWritten = '# My full README\n\nInstall table and everything else.\n'
    writeFileSync(hueFile, 'Short {ok: Hue} version', 'utf8')
    writeFileSync(mdFile, handWritten, 'utf8')

    const syncRes = runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: false })
    assert.equal(syncRes.success, true)
    assert.equal(syncRes.outOfSyncCount, 0)
    assert.deepEqual(syncRes.skipped, [mdFile])
    assert.equal(readFileSync(mdFile, 'utf8'), handWritten)

    // A pull request check does not fail on a file the sync does not manage.
    const checkRes = runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: true })
    assert.equal(checkRes.success, true)
    assert.equal(readFileSync(mdFile, 'utf8'), handWritten)

    // A file the sync generated is recognised and kept up to date.
    const generated = join(tmp, 'notes.hue.md')
    writeFileSync(generated, '{warn: v1}', 'utf8')
    runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: false })
    assert.ok(isGenerated(readFileSync(join(tmp, 'notes.md'), 'utf8')))
    writeFileSync(generated, '{warn: v2}', 'utf8')
    runAction({ cwd: tmp, pattern: '.hue.md', checkOnly: false })
    assert.ok(readFileSync(join(tmp, 'notes.md'), 'utf8').includes('**v2**'))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('GitHub UserScript and Extension files exist and are valid', () => {
  const userScript = readFileSync('github-hue/userscript/hue-md.user.js', 'utf8')
  assert.ok(userScript.includes('==UserScript=='))
  assert.ok(userScript.includes('Hue MD for GitHub'))

  const manifest = JSON.parse(readFileSync('github-hue/extension/manifest.json', 'utf8'))
  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.name, 'Hue MD for GitHub')
  assert.ok(existsSync('github-hue/extension/content.js'))
  assert.ok(existsSync('github-hue/extension/hue.css'))
  assert.ok(existsSync('github-hue/extension/icon128.png'))
})
