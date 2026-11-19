import { test } from 'node:test'
import assert from 'node:assert/strict'
import { downloadLinks, isShipped } from '../scripts/check-release-sync.js'

test('finds download links in Markdown and in render-demo.js', () => {
  const md = '[`a.zip`](https://github.com/spingras/hue-md/releases/latest/download/a.zip)'
  const js = "href: REL + 'b.user.js', extra: { href: REL + 'c.vsix' }"
  assert.deepEqual([...downloadLinks(md + '\n' + js)].sort(), ['a.zip', 'b.user.js', 'c.vsix'])
})

test('knows which files ship in a release', () => {
  assert.equal(isShipped('packages/obsidian-hue/main.js'), true)
  assert.equal(isShipped('src/index.js'), true)
  assert.equal(isShipped('snippets/ultisnips/hue.snippets'), true)
  assert.equal(isShipped('packages/obsidian-hue/test/render.test.js'), false)
  assert.equal(isShipped('test/acc.test.js'), false)
  assert.equal(isShipped('README.md'), false)
  assert.equal(isShipped('packages/remark-hue/src/index.js'), false)
})
