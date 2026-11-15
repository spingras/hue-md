// Dev helper: replaces "TODO" outputs in spec.md with what the implementation renders now.
// Every filled example must be reviewed by hand before it is committed.
import { readFileSync, writeFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'
import { parseSpecExamples } from './parse-spec.js'

const file = new URL('./spec.md', import.meta.url)
const md = new MarkdownIt('commonmark').use(hue)
const text = readFileSync(file, 'utf8')
const lines = text.split('\n')
let filled = 0
for (const ex of parseSpecExamples(text).reverse()) {
  if (ex.html !== 'TODO\n') continue
  const todo = lines.indexOf('TODO', ex.line)
  lines.splice(todo, 1, ...md.render(ex.markdown.replace(/\t/g, '→')).replace(/\n$/, '').split('\n'))
  filled++
}
writeFileSync(file, lines.join('\n'))
console.log(`filled ${filled} examples`)
