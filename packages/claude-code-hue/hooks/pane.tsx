// Hue preview pane: renders a .hue.md file beside the chat with Hue's colored
// spans, diff spans, keycaps, progress bars, multi-state tasks, boxes, and
// side-by-side split boxes. Plain Markdown parts are drawn by the surface's own
// Markdown renderer; parts that use Hue are drawn as Text and Box elements.
//
// It answers /hue-md:preview itself, so the skill of that name (which renders
// an HTML page in the browser) only runs where this module cannot load.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HueDoc } from '../types'

const PANE = 'hue-md-preview'
const COMMAND = 'hue-md:preview'
const EMPTY: HueDoc = { path: '', text: '', error: '' }
const doc = atom({ plugin: 'hue-md', key: 'doc' } as const, EMPTY, { shape: 'doc-1' })

// ------------------------------------------------------------------ palette

// Text colors: theme keys where the theme has a match, mid tones elsewhere, so
// they read on light and dark backgrounds alike.
const FG: Record<string, string> = {
  red: 'error', orange: 'warning', green: 'success', gray: 'subtle',
  yellow: '#c99a06', blue: '#3b82f6', purple: '#9b6cf0'
}
const BG: Record<string, string> = {
  red: 'rgba(240,80,70,0.18)', orange: 'rgba(230,120,40,0.18)', yellow: 'rgba(225,180,20,0.24)',
  green: 'rgba(50,170,80,0.18)', blue: 'rgba(60,130,250,0.16)', purple: 'rgba(160,110,245,0.16)',
  gray: 'rgba(120,130,140,0.18)'
}
const ALIAS: Record<string, string> = {
  danger: 'red', '!': 'red', warn: 'orange', ok: 'green', info: 'blue', note: 'purple', muted: 'gray'
}
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

type Style = { fg?: string; bg?: string; fgName?: string }

function colorName (tok: string): string | undefined {
  if (FG[tok]) return tok
  return ALIAS[tok]
}

// Parses a span or box style ("warn", "blue bg-gray", "#c0ffee bg-#333").
// Returns null when any word is not a token, as the spec requires.
function parseStyle (raw: string): Style | null {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  if (!words.length || raw.length > 64) return null
  const s: Style = {}
  for (const w of words) {
    if (w.startsWith('bg-')) {
      const v = w.slice(3)
      const name = colorName(v)
      if (name) s.bg = BG[name]
      else if (HEX.test(v)) s.bg = v
      else return null
    } else {
      const name = colorName(w)
      if (name) { s.fg = FG[name]; s.fgName = name } else if (HEX.test(w)) { s.fg = w; s.fgName = undefined } else return null
    }
  }
  return s
}

// ------------------------------------------------------------------ inline

type Run = { text: string; fg?: string; bg?: string; bold?: boolean; italic?: boolean; code?: boolean; link?: boolean }
type Fmt = Omit<Run, 'text'>

// Index of the "}" that closes the "{" at `open`, skipping code spans and escapes.
function matchBrace (s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { i++; continue }
    if (c === '`') {
      const n = /^`+/.exec(s.slice(i))![0].length
      const close = s.indexOf('`'.repeat(n), i + n)
      if (close >= 0) { i = close + n - 1; continue }
      i += n - 1
      continue
    }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

const KEY_NAMES = new Set([
  'ctrl', 'control', 'cmd', 'command', 'alt', 'opt', 'option', 'shift',
  'meta', 'super', 'win', 'fn', 'tab', 'enter', 'return', 'esc', 'escape',
  'space', 'spacebar', 'backspace', 'del', 'delete', 'ins', 'insert',
  'home', 'end', 'pgup', 'pgdn', 'pageup', 'pagedown',
  'up', 'down', 'left', 'right', 'capslock', 'numlock', 'scrolllock',
  'prtsc', 'printscreen', 'pause', 'break',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'
])

function isValidKeycap (raw: string): boolean {
  if (!raw || raw.length > 32 || /^\s|\s$/.test(raw) || /\s/.test(raw)) return false
  const normalized = raw.replace(/\+\+/g, '+\x00')
  const parts = normalized.split('+').map((p) => (p === '\x00' ? '+' : p))
  if (parts.some((p) => !p)) return false
  if (parts.length === 1) {
    const p = parts[0]
    if (KEY_NAMES.has(p.toLowerCase())) return true
    if (/^[A-Z]$/.test(p)) return true
    if (p.length === 1 && '+-*/=.,;:\'"`~!?@#$%^&|\\<>/?↑↓←→⌘⌥⇧⌃⏎⌫⌦⇥⎋'.includes(p)) return true
    return false
  }
  return parts.every((p) => KEY_NAMES.has(p.toLowerCase()) || /^[A-Za-z0-9]$/.test(p) || (p.length === 1 && '+-*/=.,;:\'"`~!?@#$%^&|\\<>/?↑↓←→⌘⌥⇧⌃⏎⌫⌦⇥⎋'.includes(p)))
}

function inline (s: string, fmt: Fmt = {}): Run[] {
  const out: Run[] = []
  let buf = ''
  const flush = () => { if (buf) { out.push({ ...fmt, text: buf }); buf = '' } }
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && /[!-/:-@[-`{-~]/.test(s[i + 1])) { buf += s[++i]; continue }
    if (c === '`') {
      const n = /^`+/.exec(s.slice(i))![0].length
      const close = s.indexOf('`'.repeat(n), i + n)
      if (close > 0) {
        flush()
        out.push({ ...fmt, text: s.slice(i + n, close).trim() || ' ', code: true })
        i = close + n - 1
        continue
      }
    }
    if (c === '{') {
      const end = matchBrace(s, i)
      const colon = end > 0 ? s.indexOf(':', i) : -1
      if (end > 0 && colon > i && colon < end) {
        const specRaw = s.slice(i + 1, colon).trim()
        const content = s.slice(colon + 1, end).trim()
        if ((specRaw === '+' || specRaw === '-') && content && !content.includes('\n')) {
          flush()
          const isAdd = specRaw === '+'
          out.push(...inline(isAdd ? `+${content}` : `-${content}`, {
            ...fmt,
            fg: isAdd ? FG.green : FG.red,
            bg: isAdd ? BG.green : BG.red,
            bold: isAdd
          }))
          i = end
          continue
        }
        const style = parseStyle(specRaw)
        if (style && content) {
          flush()
          out.push(...inline(content, { ...fmt, ...(style.fg ? { fg: style.fg } : {}), ...(style.bg ? { bg: style.bg } : {}) }))
          i = end
          continue
        }
      }
    }
    if (s.startsWith('[[', i) && (i === 0 || !/[\[\]A-Za-z0-9]/.test(s[i - 1]))) {
      const close = s.indexOf(']]', i + 2)
      if (close > i + 2 && close <= i + 34 && !/[\n\[]/.test(s.slice(i + 2, close))) {
        const keyText = s.slice(i + 2, close)
        if (isValidKeycap(keyText)) {
          flush()
          out.push({ ...fmt, text: `[${keyText}]`, code: true, bold: true, bg: BG.gray })
          i = close + 1
          continue
        }
      }
    }
    if (c === '[') {
      const prog = /^\[([=#.~ -]{4,40})\]\s+(100|[1-9]?\d)%(?![(\w])/.exec(s.slice(i))
      if (prog && /[=#.~-]/.test(prog[1])) {
        flush()
        const pct = Number(prog[2])
        const color = pct === 100 ? FG.green : pct >= 50 ? FG.blue : pct >= 25 ? FG.orange : FG.red
        const filled = Math.round((pct / 100) * 10)
        const empty = 10 - filled
        if (filled > 0) out.push({ ...fmt, text: '━'.repeat(filled), fg: color, bold: true })
        if (empty > 0) out.push({ ...fmt, text: '━'.repeat(empty), fg: FG.gray })
        out.push({ ...fmt, text: ` ${pct}%`, fg: color, bold: true })
        i += prog[0].length - 1
        continue
      }
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(s.slice(i))
      if (m) { flush(); out.push(...inline(m[1], { ...fmt, link: true })); i += m[0].length - 1; continue }
    }
    if (s.startsWith('**', i)) {
      const close = s.indexOf('**', i + 2)
      if (close > i + 2) { flush(); out.push(...inline(s.slice(i + 2, close), { ...fmt, bold: true })); i = close + 1; continue }
    }
    if (c === '*' && s[i + 1] !== ' ') {
      const close = s.indexOf('*', i + 1)
      if (close > i + 1) { flush(); out.push(...inline(s.slice(i + 1, close), { ...fmt, italic: true })); i = close; continue }
    }
    buf += c
  }
  flush()
  return out
}

const TASK_LINE = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX\-!?]\]\s+/m

function hasSpan (s: string): boolean {
  if (TASK_LINE.test(s)) return true
  return inline(s).some((r) => r.fg || r.bg)
}

// ------------------------------------------------------------------ blocks

type BoxBlock = { kind: 'box'; fg?: string; bg?: string; title: string; body: Block[] }
type Block =
  | { kind: 'md'; text: string }
  | BoxBlock
  | { kind: 'columns'; cols: BoxBlock[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'lines'; lines: string[] }

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)/
const TOP = /^ {0,3}([+┌╭])[-─]+(.*?)$/
const BOTTOM = /^\s*[+└╰][-─]+[+┘╯]?\s*$/
const SIDE = /^\s*[|│]/

function boxLabel (raw: string): { style: Style; title: string } | null {
  const label = raw.replace(/\s*[-─]*\s*[+┐╮]?\s*$/, '').trim()
  const words = label ? label.split(/\s+/) : []
  let n = 0
  while (n < words.length && parseStyle(words[n])) n++
  const style = n ? parseStyle(words.slice(0, n).join(' '))! : {}
  return { style, title: words.slice(n).join(' ') }
}

function stripSide (line: string): string {
  return line.replace(/^\s*[|│] ?/, '').replace(/\s*[|│]\s*$/, '').replace(/\s+$/, '')
}

// Inside a box every `|` line starts a new line (the Hue spec), so a line that
// continues a paragraph ends in a Markdown hard break. Lists, tables, headings,
// quotes and fences keep their own line handling.
const BLOCK_START = /^\s*([-*+]\s|\d+[.)]\s|\||#|>|```|~~~)/
function hardBreaks (lines: string[]): string[] {
  let inFence = false
  return lines.map((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence
    const nextLine = lines[i + 1]
    if (inFence || !l.trim() || nextLine === undefined || !nextLine.trim()) return l
    if (BLOCK_START.test(nextLine) || /^\s*\|/.test(l)) return l
    return l + '  '
  })
}

function isTable (lines: string[]): boolean {
  return lines.length >= 2 && lines.every((l) => l.trim().startsWith('|')) && /^\s*\|?\s*:?-{3,}/.test(lines[1])
}

function cells (line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const out: string[] = []
  let cur = ''
  let inCode = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue }
    if (c === '`') inCode = !inCode
    if (c === '|' && !inCode) { out.push(cur.trim()); cur = '' } else cur += c
  }
  out.push(cur.trim())
  return out
}

function findColumnStarts (line: string): number[] {
  const re = /(?:^|(?<= {2}))(?:┌─+|╭─+|\+--*)/g
  const starts: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) starts.push(m.index)
  return starts.length >= 2 ? starts : []
}

function parseSplitBoxColumns (lines: string[], startIdx: number): { cols: BoxBlock[]; nextIdx: number } | null {
  const first = lines[startIdx]
  const indent = /^ {0,3}/.exec(first)?.[0].length ?? 0
  const unindented = first.slice(indent)
  const starts = findColumnStarts(unindented)
  if (starts.length < 2) return null

  const colCount = starts.length
  const tops = starts.map((col, k) => {
    const end = k + 1 < colCount ? starts[k + 1] : unindented.length
    const slice = unindented.slice(col, end).trimEnd()
    const m = /^([+┌╭])[-─]+(.*?)$/.exec(slice)
    return m ? boxLabel(m[2]) : null
  })
  if (tops.some((t) => !t)) return null

  const colInner: string[][] = Array.from({ length: colCount }, () => [])
  const colClosed = new Array(colCount).fill(false)

  for (let r = startIdx + 1; r < lines.length; r++) {
    const raw = lines[r].slice(Math.min(indent, lines[r].length))
    for (let k = 0; k < colCount; k++) {
      const s = starts[k]
      const e = k + 1 < colCount ? starts[k + 1] : raw.length
      const cell = s < raw.length ? raw.slice(s, Math.min(e, raw.length)).trimEnd() : ''
      if (colClosed[k]) {
        if (cell.trim() !== '') return null
        continue
      }
      if (!cell.trim()) return null
      if (BOTTOM.test(cell)) {
        colClosed[k] = true
      } else if (SIDE.test(cell)) {
        colInner[k].push(stripSide(cell))
      } else {
        return null
      }
    }
    if (colClosed.every(Boolean)) {
      const cols: BoxBlock[] = tops.map((t, k) => ({
        kind: 'box',
        fg: t!.style.fg ?? 'subtle',
        bg: t!.style.fgName ? BG[t!.style.fgName] : t!.style.bg,
        title: t!.title,
        body: parse(hardBreaks(colInner[k]).join('\n'))
      }))
      return { cols, nextIdx: r }
    }
  }
  return null
}

function parse (src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let plain: string[] = []

  // Plain lines become Markdown, except paragraphs and tables that use Hue spans.
  const flushPlain = () => {
    const chunks: string[][] = [[]]
    for (const l of plain) {
      if (l.trim() === '') chunks.push([])
      else chunks[chunks.length - 1].push(l)
    }
    let md: string[] = []
    const flushMd = () => { if (md.join('').trim()) blocks.push({ kind: 'md', text: md.join('\n\n') }); md = [] }
    for (const ch of chunks) {
      if (!ch.length) continue
      const text = ch.join('\n')
      // Every table is drawn by the pane, so tables with and without Hue look alike.
      if (isTable(ch)) {
        flushMd()
        blocks.push({ kind: 'table', rows: [cells(ch[0] ?? ''), ...ch.slice(2).map(cells)] })
        continue
      }
      if (!hasSpan(text)) { md.push(text); continue }
      flushMd()
      blocks.push({ kind: 'lines', lines: ch })
    }
    flushMd()
    plain = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = FENCE.exec(line)
    if (fence) {
      const mark = fence[1]
      let j = i + 1
      while (j < lines.length && !(lines[j].trim().startsWith(mark[0].repeat(mark.length)) && lines[j].trim().replace(new RegExp(`^\\${mark[0]}+`), '') === '')) j++
      flushPlain()
      if (fence[2] === 'hue') {
        blocks.push(...parse(lines.slice(i + 1, j).join('\n')))
      } else {
        // A code block stays whole and literal: never split it at blank lines
        // or look for Hue inside it.
        blocks.push({ kind: 'md', text: lines.slice(i, Math.min(j + 1, lines.length)).join('\n') })
      }
      i = j
      continue
    }
    const split = parseSplitBoxColumns(lines, i)
    if (split) {
      flushPlain()
      blocks.push({ kind: 'columns', cols: split.cols })
      i = split.nextIdx
      continue
    }
    const top = TOP.exec(line)
    if (top) {
      // A box is a top border, only side-border lines, then a bottom border.
      let j = i + 1
      while (j < lines.length && !BOTTOM.test(lines[j]) && SIDE.test(lines[j])) j++
      if (j < lines.length && BOTTOM.test(lines[j])) {
        const { style, title } = boxLabel(top[2])!
        flushPlain()
        blocks.push({
          kind: 'box',
          fg: style.fg ?? 'subtle',
          bg: style.fgName ? BG[style.fgName] : style.bg,
          title,
          body: parse(hardBreaks(lines.slice(i + 1, j).map(stripSide)).join('\n'))
        })
        i = j
        continue
      }
    }
    plain.push(line)
  }
  flushPlain()
  return blocks
}

// ------------------------------------------------------------------ drawing

type Els = { Box: any; Text: any; Markdown: any; Button: any }

function drawRuns (els: Els, runs: Run[], base: Fmt = {}) {
  const { Text } = els
  return (
    <Text>
      {runs.map((r) => (
        <Text
          color={r.fg}
          backgroundColor={r.bg}
          weight={r.bold || base.bold ? 'semibold' : undefined}
          italic={r.italic}
          mono={r.code}
          underline={r.link}
        >
          {r.text}
        </Text>
      ))}
    </Text>
  )
}

const TASK_STATES: Record<string, { icon: string; color: string }> = {
  ' ': { icon: '[ ]', color: FG.gray },
  '-': { icon: '[◐]', color: FG.blue },
  '!': { icon: '[!]', color: FG.red },
  '?': { icon: '[?]', color: FG.purple },
  x: { icon: '[✔]', color: FG.green },
  X: { icon: '[✔]', color: FG.green }
}

function drawLine (els: Els, line: string) {
  const { Box, Text } = els
  // Never name a variable `h`: JSX compiles to calls of the global `h`.
  const head = /^ {0,3}(#{1,6})\s+(.*)$/.exec(line)
  if (head) {
    const size = head[1].length === 1 ? 'title' : head[1].length === 2 ? 'heading' : 'body'
    return <Text size={size} weight="bold">{drawRuns(els, inline(head[2].replace(/\s+#+\s*$/, '')))}</Text>
  }
  const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
  if (li) {
    const task = /^\[([ xX\-!?])\]\s+(.*)$/.exec(li[3])
    if (task) {
      const st = TASK_STATES[task[1]] ?? TASK_STATES[' ']
      return (
        <Box flexDirection="row" paddingLeft={li[1].length >= 2 ? 2 : 0} gap={1}>
          <Text color={st.color} weight="semibold">{st.icon}</Text>
          {drawRuns(els, inline(task[2]))}
        </Box>
      )
    }
    const bullet = /\d/.test(li[2]) ? li[2] : '•'
    return (
      <Box flexDirection="row" paddingLeft={li[1].length >= 2 ? 2 : 0} gap={1}>
        <Text dimColor>{bullet}</Text>
        {drawRuns(els, inline(li[3]))}
      </Box>
    )
  }
  return drawRuns(els, inline(line))
}

function drawTable (els: Els, rows: string[][]) {
  const { Box, Text } = els
  const n = Math.max(...rows.map((r) => r.length))
  const width = Array.from({ length: n }, (_, c) =>
    Math.max(4, ...rows.map((r) => (r[c] ?? '').replace(/\{[^:{}]*:\s*|\}|`|\*\*/g, '').length)))
  const total = width.reduce((a, b) => a + b, 0)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
      {rows.map((r, ri) => (
        <Box flexDirection="row" gap={2} paddingY={0} backgroundColor={ri === 0 ? 'rgba(120,130,140,0.14)' : undefined}>
          {Array.from({ length: n }, (_, c) => (
            <Box width={`${Math.round((width[c] / total) * 100)}%`} flexShrink={1}>
              {ri === 0
                ? <Text weight="semibold">{drawRuns(els, inline(r[c] ?? ''))}</Text>
                : drawRuns(els, inline(r[c] ?? ''))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

function drawBoxBlock (els: Els, b: BoxBlock) {
  const { Box, Text } = els
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={b.fg} backgroundColor={b.bg} paddingX={1} paddingY={0} gap="xs">
      {b.title ? <Text color={b.fg} weight="semibold">{b.title}</Text> : null}
      {drawBlocks(els, b.body)}
    </Box>
  )
}

function drawBlocks (els: Els, blocks: Block[]): any[] {
  const { Box, Markdown } = els
  return blocks.map((b) => {
    if (b.kind === 'md') return <Markdown text={b.text} />
    if (b.kind === 'table') return drawTable(els, b.rows)
    if (b.kind === 'lines') return <Box flexDirection="column">{b.lines.map((l) => drawLine(els, l))}</Box>
    if (b.kind === 'columns') {
      return (
        <Box flexDirection="row" gap={1}>
          {b.cols.map((col) => (
            <Box flexGrow={1} flexShrink={1}>
              {drawBoxBlock(els, col)}
            </Box>
          ))}
        </Box>
      )
    }
    return drawBoxBlock(els, b)
  })
}

// ------------------------------------------------------------------ file

function basename (p: string): string {
  return p.split(/[\\/]/).pop() || p
}

async function load ($: any, path: string): Promise<void> {
  let text = ''
  let error = ''
  try { text = await $.fs.read(path) } catch (err: any) { error = `Could not read ${path}: ${err?.message ?? err}` }
  await update($, doc, () => ({ path, text, error }))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Follow the file: re-read it every two seconds while one is shown.
    $.clock.every(2000, () => {
      void (async () => {
        const cur = await read($, doc)
        if (!cur.path) return
        try {
          const text = await $.fs.read(cur.path)
          if (text !== cur.text) await update($, doc, (d) => ({ ...d, text, error: '' }))
        } catch { /* keep the last good copy */ }
      })()
    })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    let path = e.args.trim().replace(/^["']|["']$/g, '')
    if (!path) path = (await read($, doc)).path
    if (!path) return { text: `Usage: /${COMMAND} <file.hue.md>` }
    try {
      await load($, path)
      await $.ui.open({ id: PANE, title: `Hue: ${basename(path)}` })
      return { text: `Showing ${path} in the Hue preview pane.` }
    } catch (err: any) {
      return { text: `Could not open the Hue preview pane: ${err?.message ?? err}` }
    }
  })

  // When Claude writes or edits a .hue.md file, show that file.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      if (e.tool === 'Write' || e.tool === 'Edit') {
        const path = e.file_path
        if (path && /\.hue\.md$/i.test(path)) {
          await load($, path)
          void $.ui.open({ id: PANE, title: `Hue: ${basename(path)}` }).catch(() => {})
        }
      }
    } catch { /* never let the preview get in the way of an edit */ }
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e) as unknown as Els
    const { Box, Text, Button } = els
    const cur = await read($, doc)
    if (!cur.path) {
      return <Text dimColor>No file yet. Run /{COMMAND} path/to/file.hue.md</Text>
    }
    return (
      <Box flexDirection="column" gap="sm" paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text dimColor size="footnote">{cur.path}</Text>
          <Button key="reload" label="Reload" onPress={() => { void load($, cur.path) }} />
        </Box>
        {cur.error ? <Text color="error">{cur.error}</Text> : drawBlocks(els, parse(cur.text))}
      </Box>
    )
  })
}
