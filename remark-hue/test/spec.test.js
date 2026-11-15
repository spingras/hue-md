// remark-hue against the same spec examples as the markdown-it plugin, plus
// the CommonMark superset check: plain CommonMark must render the same with
// and without the plugin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeParse from 'rehype-parse'
import remarkHue from '../src/index.js'
import { parseSpecExamples } from '../../spec/parse-spec.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const examples = parseSpecExamples(read('../../spec/spec.md'))
const commonmark = JSON.parse(read('../../test/fixtures/commonmark-0.31.2.json'))

const pipeline = (withHue) => {
  const p = unified().use(remarkParse)
  if (withHue) p.use(remarkHue)
  return p.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true })
}
const hue = pipeline(true)
const plain = pipeline(false)
const render = (p, md) => String(p.processSync(md))

// Same HTML, different formatting: parse and re-serialize both sides with one
// serializer (entities, quoting), then drop whitespace between tags.
const canon = unified().use(rehypeParse, { fragment: true }).use(rehypeStringify)
const canonical = (html) => String(canon.processSync(html)).replace(/>\s+</g, '><').trim()

for (const ex of examples) {
  test(`spec example ${ex.number} (${ex.section})`, () => {
    assert.equal(canonical(render(hue, ex.markdown)), canonical(ex.html))
  })
}

test('CommonMark 0.31.2: remark-hue changes no example', () => {
  const changed = commonmark.filter((ex) => render(hue, ex.markdown) !== render(plain, ex.markdown)).map((ex) => ex.example)
  assert.deepEqual(changed, [])
})

test('control: without the plugin, every example with Hue output fails the comparison', () => {
  const hueExamples = examples.filter((ex) => /class="hue/.test(ex.html))
  assert.ok(hueExamples.length > 40)
  const indistinguishable = hueExamples.filter((ex) => canonical(render(plain, ex.markdown)) === canonical(ex.html)).map((ex) => ex.number)
  assert.deepEqual(indistinguishable, [])
})
