import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../bin/md-hue.js', import.meta.url))
const run = (args, input, env = {}) => spawnSync(process.execPath, [bin, ...args], { input, encoding: 'utf8', env: { ...process.env, ...env } })

test('view reads stdin; colors only when asked or on a TTY', () => {
  assert.equal(run(['view', '-'], '{red: x}').stdout, 'x\n') // piped: no TTY, so no color
  assert.match(run(['view', '-', '--color', 'always'], '{red: x}').stdout, /\x1b\[38;2;255;123;114mx/)
  assert.equal(run(['view', '-', '--color=never'], '{red: x}').stdout, 'x\n')
})

test('downgrade and html', () => {
  assert.equal(run(['downgrade', '-'], '{!: stop}').stdout, '**stop**\n')
  assert.equal(run(['downgrade', '-', '--spans', 'plain'], '{!: stop}').stdout, 'stop\n')
  assert.equal(run(['html', '-'], '{ok: y}').stdout, '<p><span class="hue hue-green">y</span></p>\n')
  assert.match(run(['html', '-', '--standalone'], '# T').stdout, /^<!doctype html>[\s\S]*--hue-red/)
})

test('html escapes raw HTML by default', () => {
  assert.equal(run(['html', '-'], '<script>x</script>').stdout, '<p>&lt;script&gt;x&lt;/script&gt;</p>\n')
})

test('errors exit with code 2 and a message', () => {
  const r = run(['frob', 'x'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /unknown command "frob"/)
  assert.match(run(['view', 'does-not-exist.md']).stderr, /cannot read does-not-exist.md: ENOENT/)
  assert.match(run(['downgrade', '-', '--spans', 'rainbow'], 'x').stderr, /--spans must be/)
  assert.equal(run(['--help']).status, 0)
})
