// Downloads README files for a list of npm package names (one per line) into corpus/readme/.
// Usage: node scripts/fetch-corpus.js <names.txt>
// Sends only a fixed, anonymous User-Agent. Files are treated as data, never executed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const names = readFileSync(process.argv[2], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
const out = new URL('../corpus/readme/', import.meta.url)
mkdirSync(out, { recursive: true })
const CANDIDATES = ['README.md', 'readme.md', 'Readme.md', 'README.markdown', 'readme.markdown']

async function fetchReadme (name) {
  for (const file of CANDIDATES) {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/${name}/${file}`, { headers: { 'User-Agent': 'corpus-fetch' } })
    if (res.ok) return res.text()
  }
  return null
}

let ok = 0; const missing = []
const queue = [...names]
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const name = queue.shift()
    const file = new URL(name.replace(/[@/]/g, '_') + '.md', out)
    if (existsSync(file)) { ok++; continue }
    try {
      const text = await fetchReadme(name)
      if (text) { writeFileSync(file, text); ok++ } else missing.push(name)
    } catch { missing.push(name) }
  }
}))
console.log(`saved ${ok} READMEs; no README for ${missing.length}: ${missing.join(', ')}`)
