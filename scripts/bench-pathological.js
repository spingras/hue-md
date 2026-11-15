// Times adversarial inputs that could make the parser slow (super-linear).
import MarkdownIt from 'markdown-it'
import hue from '../src/index.js'

const md = new MarkdownIt().use(hue)
const plain = new MarkdownIt()

export const CASES = {
  'unclosed openers': (n) => '{red: '.repeat(n),
  'nested closed': (n) => '{red: '.repeat(n) + 'x' + '}'.repeat(n),
  'openers + backticks': (n) => '{red: `'.repeat(n),
  'many short spans': (n) => '{red: a} '.repeat(n),
  'unclosed box': (n) => '┌─ red ─┐\n' + '│ line\n'.repeat(n),
  'stacked box tops': (n) => '┌─ red ─┐\n'.repeat(n),
  'nested boxes': (n) => {
    let s = 'x'
    for (let i = 0; i < Math.min(n, 60); i++) s = ['┌─ red ─┐', ...s.split('\n').map((l) => '│ ' + l), '└───────┘'].join('\n')
    return s
  }
}

export function time (fn) {
  const t = performance.now(); fn(); return performance.now() - t
}

if (process.argv[1]?.endsWith('bench-pathological.js')) {
  for (const [name, make] of Object.entries(CASES)) {
    const row = [5000, 10000, 20000].map((n) => {
      const src = make(n)
      const ms = time(() => md.render(src))
      const base = time(() => plain.render(src))
      return `n=${n}: ${ms.toFixed(0)}ms (plain ${base.toFixed(0)}ms)`
    })
    console.log(name.padEnd(20), row.join('  |  '))
  }
}
