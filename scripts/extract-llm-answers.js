// Extracts assistant answers (Markdown) from local Claude Code transcripts into a corpus folder.
// Usage: node scripts/extract-llm-answers.js <projectsDir> <outDir> [count=50] [excludeSubstring]
// Output stays local (corpus/ is git-ignored). Picks answers round-robin across projects.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [root, outDir, countArg = '50', exclude = 'modern-markdown'] = process.argv.slice(2)
const COUNT = Number(countArg)
const MIN_LEN = 400 // skip one-liners; we want real formatted answers

const perProject = []
for (const proj of readdirSync(root)) {
  if (proj.includes(exclude)) continue
  const dir = join(root, proj)
  if (!statSync(dir).isDirectory()) continue
  const answers = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
      if (!line.includes('"assistant"')) continue
      let rec
      try { rec = JSON.parse(line) } catch { continue }
      if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) continue
      for (const block of rec.message.content) {
        if (block.type === 'text' && block.text.length >= MIN_LEN) answers.push(block.text)
      }
    }
  }
  if (answers.length) perProject.push({ proj, answers })
}

mkdirSync(outDir, { recursive: true })
let n = 0
for (let round = 0; n < COUNT; round++) {
  let took = false
  for (const p of perProject) {
    // spread picks over each project's history instead of taking the first ones
    const idx = Math.floor((round * 7919) % p.answers.length)
    if (round < p.answers.length && n < COUNT) {
      writeFileSync(join(outDir, `${String(n + 1).padStart(2, '0')}.md`), p.answers[idx])
      n++; took = true
    }
  }
  if (!took) break
}
console.log(`projects with answers: ${perProject.length} (${perProject.map((p) => `${p.proj.split('-').pop()}:${p.answers.length}`).join(', ')})`)
console.log(`wrote ${n} answers to ${outDir}`)
