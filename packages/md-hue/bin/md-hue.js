#!/usr/bin/env node
// hue-md: command-line tools for Hue Markdown (.hue.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { renderAnsi, parseSlides, renderSlides } from '../src/ansi.js'
import { downgrade } from '../src/downgrade.js'
import { toHtml } from '../src/index.js'

const HELP = `hue-md: tools for Hue Markdown (.hue.md)

Usage:
  hue-md view <file>        Show a file in the terminal with colors and boxes
  hue-md slides <file>      Render slide deck in the terminal (split on ---)
  hue-md downgrade <file>   Convert to GitHub Markdown (boxes become alerts)
  hue-md html <file>        Convert to HTML (add --standalone for a full page)

Use "-" as <file> to read standard input.

Options:
  --width <n>               view/slides: line width (default: terminal width or 80)
  --theme dark|light        view/slides: palette to use (default: dark)
  --color auto|always|never view/slides: colors (default: auto; respects NO_COLOR)
  --slide <n>               slides: render only slide number <n> (1..N)
  -i, --interactive         slides: interactive arrow-key slide deck mode
  --spans auto|plain|bold|latex
                            downgrade: what colored text becomes (default: auto:
                            red/orange text becomes bold, other colors are dropped)
  --standalone              html: full page with the Hue stylesheet
  -o, --out <file>          write to a file instead of standard output
  -h, --help                show this help
`

function parseArgs (argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') args.help = true
    else if (a === '--standalone') args.standalone = true
    else if (a === '-i' || a === '--interactive') args.interactive = true
    else if (a === '-o' || a === '--out') args.out = argv[++i]
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      args[k] = v ?? argv[++i]
    } else args._.push(a)
  }
  return args
}

function fail (msg) {
  process.stderr.write(`hue-md: ${msg}\n\n${HELP}`)
  process.exit(2)
}

function runInteractiveSlides (src, { width, theme, color }) {
  const slides = parseSlides(src)
  let current = 1
  const total = slides.length

  const draw = () => {
    process.stdout.write('\x1b[2J\x1b[H')
    const out = renderSlides(src, { width, theme, color, slide: current, minHeight: 12 })
    process.stdout.write(out)
    process.stdout.write(`\n  [←/p] Previous   [→/n/Space] Next   [q/Esc] Quit   (Slide ${current}/${total})\n`)
  }

  draw()
  if (!process.stdin.isTTY) return
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('data', (buf) => {
    const s = buf.toString('utf8')
    if (s === 'q' || s === 'Q' || s === '\x03' || s === '\x1b') {
      process.stdin.setRawMode(false)
      process.stdout.write('\n')
      process.exit(0)
    } else if (s === 'n' || s === ' ' || s === '\x1b[C' || s === '\x1b[B') {
      if (current < total) { current++; draw() }
    } else if (s === 'p' || s === '\x1b[D' || s === '\x1b[A') {
      if (current > 1) { current--; draw() }
    }
  })
}

const args = parseArgs(process.argv.slice(2))
const [cmd, file] = args._
if (args.help || !cmd) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2) }
if (!['view', 'slides', 'downgrade', 'html'].includes(cmd)) fail(`unknown command "${cmd}"`)
if (!file) fail('missing <file>')

let src
try {
  src = readFileSync(file === '-' ? 0 : file, 'utf8')
} catch (e) {
  fail(`cannot read ${file}: ${e.code || e.message}`)
}

let output
if (cmd === 'view' || cmd === 'slides') {
  const color = args.color === 'always' ? true
    : args.color === 'never' ? false
      : !process.env.NO_COLOR && !!process.stdout.isTTY && !args.out
  if (args.theme && !['dark', 'light'].includes(args.theme)) fail('--theme must be dark or light')
  const width = Number(args.width) || Math.min(process.stdout.columns || 80, 120)
  const theme = args.theme || 'dark'
  if (cmd === 'view') {
    output = renderAnsi(src, { width, theme, color })
  } else if (args.interactive) {
    runInteractiveSlides(src, { width, theme, color: true })
  } else {
    const slide = args.slide ? Number(args.slide) : null
    output = renderSlides(src, { width, theme, color, slide })
  }
} else if (cmd === 'downgrade') {
  if (args.spans && !['auto', 'plain', 'bold', 'latex'].includes(args.spans)) fail('--spans must be auto, plain, bold or latex')
  output = downgrade(src, { spans: args.spans || 'auto' })
  if (!output.endsWith('\n')) output += '\n'
} else {
  output = toHtml(src, { standalone: args.standalone, title: file === '-' ? 'Hue document' : file })
}

if (output !== undefined) {
  if (args.out) writeFileSync(args.out, output)
  else process.stdout.write(output)
}
