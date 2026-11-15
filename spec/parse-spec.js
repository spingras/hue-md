// Reads spec.md and returns its examples, in the CommonMark spec format:
// 32 backticks + " example", Markdown, a line with ".", HTML, 32 backticks. "→" stands for a tab.
const FENCE = '`'.repeat(32)

export function parseSpecExamples (text) {
  const lines = text.split(/\r?\n/)
  const examples = []
  let section = ''
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{1,6} (.*)$/.exec(lines[i])
    if (h) { section = h[1]; continue }
    if (lines[i] !== FENCE + ' example') continue
    const start = i + 1
    const md = []; const html = []
    let part = md
    for (i++; i < lines.length && lines[i] !== FENCE; i++) {
      if (lines[i] === '.' && part === md) { part = html; continue }
      part.push(lines[i])
    }
    const join = (a) => (a.length ? a.join('\n') + '\n' : '').replace(/→/g, '\t')
    examples.push({ number: examples.length + 1, section, line: start, markdown: join(md), html: join(html) })
  }
  return examples
}
