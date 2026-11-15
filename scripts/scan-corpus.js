// False-positive scan: which real-world Markdown files would Hue change, and how?
// Usage: node scripts/scan-corpus.js <dir> [<dir> ...]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'

const md = new MarkdownIt().use(hue)
const plain = new MarkdownIt()

function walk (tokens, hits, file, lines) {
  for (const t of tokens) {
    if (t.type === 'hue_box_open') hits.push({ file, kind: 'box', line: t.map?.[0], text: lines[t.map?.[0]] })
    if (t.type === 'fence' && t.info.trim().split(/\s+/)[0] === 'hue') hits.push({ file, kind: 'fence', line: t.map?.[0] })
    if (t.type === 'inline' && t.children) {
      for (const c of t.children) {
        if (c.type === 'hue_open') hits.push({ file, kind: 'span', line: t.map?.[0], text: c.markup + ' …' , context: t.content.slice(0, 120) })
      }
    }
    if (t.children && t.type !== 'inline') walk(t.children, hits, file, lines)
  }
}

let files = 0; let changed = 0; const hits = []
for (const dir of process.argv.slice(2)) {
  for (const name of readdirSync(dir).filter((f) => /\.(md|markdown)$/i.test(f))) {
    const src = readFileSync(join(dir, name), 'utf8')
    files++
    if (md.render(src) !== plain.render(src)) changed++
    walk(md.parse(src, {}), hits, join(dir, name), src.split('\n'))
  }
}
const byKind = hits.reduce((a, h) => ((a[h.kind] = (a[h.kind] || 0) + 1), a), {})
console.log(`files scanned: ${files}`)
console.log(`files whose HTML changes with Hue: ${changed} (${(100 * changed / files).toFixed(2)}%)`)
console.log(`hits by kind: ${JSON.stringify(byKind)}`)
for (const h of hits) console.log(`- ${h.kind} ${h.file}:${(h.line ?? 0) + 1}  ${h.text ?? ''}  ${h.context ? '| ' + h.context : ''}`)
