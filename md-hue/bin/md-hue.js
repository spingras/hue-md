#!/usr/bin/env node
// md-hue: command-line tools for Hue Markdown (.hue.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { renderAnsi } from '../src/ansi.js'
import { downgrade } from '../src/downgrade.js'
import { toHtml } from '../src/index.js'

const HELP = `md-hue: tools for Hue Markdown (.hue.md)

Usage:
  md-hue view <file>        Show a file in the terminal with colors and boxes
  md-hue downgrade <file>   Convert to GitHub Markdown (boxes become alerts)
  md-hue html <file>        Convert to HTML (add --standalone for a full page)

Use "-" as <file> to read standard input.

Options:
  --width <n>               view: line width (default: terminal width or 80)
  --theme dark|light        view: palette to use (default: dark)
  --color auto|always|never view: colors (default: auto; respects NO_COLOR)
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
    else if (a === '-o' || a === '--out') args.out = argv[++i]
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      args[k] = v ?? argv[++i]
    } else args._.push(a)
  }
  return args
}

function fail (msg) {
  process.stderr.write(`md-hue: ${msg}\n\n${HELP}`)
  process.exit(2)
}

const args = parseArgs(process.argv.slice(2))
const [cmd, file] = args._
if (args.help || !cmd) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2) }
if (!['view', 'downgrade', 'html'].includes(cmd)) fail(`unknown command "${cmd}"`)
if (!file) fail('missing <file>')

let src
try {
  src = readFileSync(file === '-' ? 0 : file, 'utf8')
} catch (e) {
  fail(`cannot read ${file}: ${e.code || e.message}`)
}

let output
if (cmd === 'view') {
  const color = args.color === 'always' ? true
    : args.color === 'never' ? false
      : !process.env.NO_COLOR && !!process.stdout.isTTY && !args.out
  if (args.theme && !['dark', 'light'].includes(args.theme)) fail('--theme must be dark or light')
  const width = Number(args.width) || Math.min(process.stdout.columns || 80, 120)
  output = renderAnsi(src, { width, theme: args.theme || 'dark', color })
} else if (cmd === 'downgrade') {
  if (args.spans && !['auto', 'plain', 'bold', 'latex'].includes(args.spans)) fail('--spans must be auto, plain, bold or latex')
  output = downgrade(src, { spans: args.spans || 'auto' })
  if (!output.endsWith('\n')) output += '\n'
} else {
  output = toHtml(src, { standalone: args.standalone, title: file === '-' ? 'Hue document' : file })
}

if (args.out) writeFileSync(args.out, output)
else process.stdout.write(output)
