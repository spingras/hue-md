// VS Code extension for Hue Markdown
import * as vscode from 'vscode'
import MarkdownIt from 'markdown-it'
import hue, { css, findInlineHue } from '../../src/index.js'
import {
  COLORS,
  parseTop,
  BOX_BOTTOM,
  BOX_SIDE,
  findBoxColumnStarts,
  TASK_STATES,
  matchProgressBar
} from '../../src/core.js'
import { downgrade } from '../../md-hue/src/downgrade.js'

const mdEngine = new MarkdownIt({ html: false, linkify: true }).use(hue)
let previewPanel = null
let previewDocUri = null
let isAutoClosingBox = false

function renderPreviewHtml (doc) {
  const bodyHtml = mdEngine.render(doc.getText())
  const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
  const themeAttr = isDark ? 'dark' : 'light'
  return `<!doctype html>
<html lang="en" data-theme="${themeAttr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${css()}
body {
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding: 20px 28px;
  color: var(--vscode-editor-foreground, var(--hue-text));
  background: var(--vscode-editor-background, transparent);
}
h1, h2, h3 {
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  padding-bottom: 0.25em;
}
code {
  font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 0.9em;
  background: rgba(127, 127, 127, 0.15);
  padding: 0.15em 0.35em;
  border-radius: 4px;
}
pre {
  background: rgba(127, 127, 127, 0.12);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

// Decoration types cache for colors, backgrounds, diffs, tasks, keycaps, progress bars, and boxes
let decorationTypes = null

function initDecorations () {
  if (decorationTypes) return decorationTypes

  const types = {
    fg: {},
    bg: {},
    boxBorders: {},
    boxTitles: {},
    tasks: {},
    hexCache: new Map(),
    diffAdd: vscode.window.createTextEditorDecorationType({
      light: { color: COLORS.green.light.fg, backgroundColor: COLORS.green.light.bg, borderRadius: '3px' },
      dark: { color: COLORS.green.dark.fg, backgroundColor: COLORS.green.dark.bg, borderRadius: '3px' }
    }),
    diffDel: vscode.window.createTextEditorDecorationType({
      textDecoration: 'line-through',
      light: { color: COLORS.red.light.fg, backgroundColor: COLORS.red.light.bg, borderRadius: '3px' },
      dark: { color: COLORS.red.dark.fg, backgroundColor: COLORS.red.dark.bg, borderRadius: '3px' }
    }),
    kbd: vscode.window.createTextEditorDecorationType({
      light: {
        color: COLORS.gray.light.fg,
        backgroundColor: COLORS.gray.light.bg,
        border: `1px solid ${COLORS.gray.light.fg}`,
        borderRadius: '3px'
      },
      dark: {
        color: COLORS.gray.dark.fg,
        backgroundColor: COLORS.gray.dark.bg,
        border: `1px solid ${COLORS.gray.dark.fg}`,
        borderRadius: '3px'
      }
    })
  }

  for (const [colorName, colorDef] of Object.entries(COLORS)) {
    types.fg[colorName] = vscode.window.createTextEditorDecorationType({
      light: { color: colorDef.light.fg },
      dark: { color: colorDef.dark.fg }
    })

    types.bg[colorName] = vscode.window.createTextEditorDecorationType({
      light: { backgroundColor: colorDef.light.bg, borderRadius: '3px' },
      dark: { backgroundColor: colorDef.dark.bg, borderRadius: '3px' }
    })

    types.boxBorders[colorName] = vscode.window.createTextEditorDecorationType({
      light: { color: colorDef.light.fg },
      dark: { color: colorDef.dark.fg }
    })

    types.boxTitles[colorName] = vscode.window.createTextEditorDecorationType({
      fontWeight: 'bold',
      light: { color: colorDef.light.fg },
      dark: { color: colorDef.dark.fg }
    })

    types.tasks[colorName] = vscode.window.createTextEditorDecorationType({
      fontWeight: 'bold',
      light: { color: colorDef.light.fg, backgroundColor: colorDef.light.bg, borderRadius: '3px' },
      dark: { color: colorDef.dark.fg, backgroundColor: colorDef.dark.bg, borderRadius: '3px' }
    })
  }

  types.boxBorders.default = vscode.window.createTextEditorDecorationType({
    light: { color: COLORS.gray.light.fg },
    dark: { color: COLORS.gray.dark.fg }
  })

  decorationTypes = types
  return types
}

function getHexDecorationType (types, fgHex, bgHex) {
  const key = `${fgHex || ''}:${bgHex || ''}`
  if (types.hexCache.has(key)) return types.hexCache.get(key)
  if (types.hexCache.size >= 64) {
    const oldestKey = types.hexCache.keys().next().value
    types.hexCache.get(oldestKey)?.dispose()
    types.hexCache.delete(oldestKey)
  }
  const style = {}
  if (fgHex) style.color = fgHex
  if (bgHex) {
    style.backgroundColor = bgHex
    style.borderRadius = '3px'
  }
  const dec = vscode.window.createTextEditorDecorationType(style)
  types.hexCache.set(key, dec)
  return dec
}

const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+\.)\s+)(\[([ xX\-!?])\])(?=\s)/
const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/

// Update editor text decorations for live syntax coloring
function updateDecorations (editor) {
  if (!editor || !editor.document) return
  const doc = editor.document
  if (doc.languageId !== 'hue-markdown' && doc.languageId !== 'markdown') return

  const types = initDecorations()
  const fgRanges = {}
  const bgRanges = {}
  const boxBorderRanges = {}
  const boxTitleRanges = {}
  const taskRanges = {}
  const diffAddRanges = []
  const diffDelRanges = []
  const kbdRanges = []
  const hexRanges = new Map()

  for (const c of Object.keys(COLORS)) {
    fgRanges[c] = []
    bgRanges[c] = []
    boxBorderRanges[c] = []
    boxTitleRanges[c] = []
    taskRanges[c] = []
  }
  boxBorderRanges.default = []

  const text = doc.getText()
  const lines = text.split(/\r?\n/)

  let inOtherFence = false
  let fenceMarker = ''
  let activeBoxCols = null // [{ start, color, closed }]

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const fenceMatch = FENCE_RE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[2][0]
      const info = fenceMatch[3].trim().split(/\s+/)[0]
      if (!fenceMarker) {
        fenceMarker = marker
        inOtherFence = info !== 'hue'
        activeBoxCols = null
        continue
      } else if (marker === fenceMarker && fenceMatch[3].trim() === '') {
        fenceMarker = ''
        inOtherFence = false
        activeBoxCols = null
        continue
      }
    }
    if (inOtherFence) continue

    const indent = line.length - line.trimStart().length
    const content = line.slice(indent)

    // 1. Check for single or side-by-side split box top line
    const colStarts = findBoxColumnStarts(content)
    if (colStarts.length >= 1) {
      const parsedCols = []
      let allValid = true
      for (let k = 0; k < colStarts.length; k++) {
        const segStart = colStarts[k]
        const segEnd = k + 1 < colStarts.length ? colStarts[k + 1] : content.length
        const seg = content.slice(segStart, segEnd).trimEnd()
        const top = parseTop(seg)
        if (!top) {
          allValid = false
          break
        }
        parsedCols.push({ segStart, segEnd: segStart + seg.length, top })
      }
      if (allValid) {
        activeBoxCols = []
        for (const col of parsedCols) {
          const color = col.top.style?.fg || col.top.style?.bg || 'default'
          const absStart = indent + col.segStart
          const absEnd = indent + col.segEnd
          boxBorderRanges[color]?.push(new vscode.Range(lineIndex, absStart, lineIndex, absEnd))
          if (col.top.title && color !== 'default' && boxTitleRanges[color]) {
            const segText = line.slice(absStart, absEnd)
            const titleRel = segText.indexOf(col.top.title)
            if (titleRel !== -1) {
              boxTitleRanges[color].push(
                new vscode.Range(lineIndex, absStart + titleRel, lineIndex, absStart + titleRel + col.top.title.length)
              )
            }
          }
          activeBoxCols.push({ start: col.segStart, color, closed: false })
        }
        continue
      }
    }

    // 2. Check for box side or bottom lines when inside a single or split box
    if (activeBoxCols && activeBoxCols.length > 0) {
      let matchesBox = true
      const sideDecorations = []
      const bottomDecorations = []
      for (let k = 0; k < activeBoxCols.length; k++) {
        const col = activeBoxCols[k]
        const segStart = col.start
        const segEnd = k + 1 < activeBoxCols.length ? activeBoxCols[k + 1].start : content.length
        const seg = (k + 1 < activeBoxCols.length ? content.slice(segStart, segEnd) : content.slice(segStart)).trimEnd()
        if (col.closed) {
          if (seg.trim() !== '') { matchesBox = false; break }
        } else if (BOX_BOTTOM.test(seg)) {
          col.closed = true
          bottomDecorations.push({
            color: col.color,
            start: indent + segStart,
            end: indent + segStart + seg.length
          })
        } else if (BOX_SIDE.test(seg)) {
          const leadWs = seg.length - seg.trimStart().length
          const barPos = indent + segStart + leadWs
          sideDecorations.push({
            color: col.color,
            start: barPos,
            end: barPos + 1
          })
          // Also check if closed right border exists
          const trimmedSeg = seg.trimEnd()
          if (trimmedSeg.length > 1 && (trimmedSeg.endsWith('│') || trimmedSeg.endsWith('|'))) {
            const rightPos = indent + segStart + trimmedSeg.length - 1
            sideDecorations.push({
              color: col.color,
              start: rightPos,
              end: rightPos + 1
            })
          }
        } else {
          matchesBox = false
          break
        }
      }

      if (matchesBox) {
        for (const b of bottomDecorations) {
          boxBorderRanges[b.color]?.push(new vscode.Range(lineIndex, b.start, lineIndex, b.end))
        }
        for (const s of sideDecorations) {
          boxBorderRanges[s.color]?.push(new vscode.Range(lineIndex, s.start, lineIndex, s.end))
        }
        if (activeBoxCols.every(c => c.closed)) {
          activeBoxCols = null
          continue
        }
      } else {
        activeBoxCols = null
      }
    } else if (BOX_BOTTOM.test(content)) {
      boxBorderRanges.default.push(new vscode.Range(lineIndex, indent, lineIndex, line.length))
      continue
    }

    // 3. Multi-state tasks (- [ ], - [-], - [!], - [?], - [x])
    const taskMatch = TASK_LINE_RE.exec(line)
    if (taskMatch) {
      const marker = taskMatch[3]
      const taskState = TASK_STATES[marker]
      if (taskState && taskRanges[taskState.color]) {
        const bracketStart = taskMatch[1].length
        const bracketEnd = bracketStart + taskMatch[2].length
        taskRanges[taskState.color].push(new vscode.Range(lineIndex, bracketStart, lineIndex, bracketEnd))
      }
    }

    // 4. Inline spans, diff spans, and keycaps via parser-accurate findInlineHue
    if (line.includes('{') || line.includes('[[')) {
      const { spans, diffs, kbds } = findInlineHue(line, { html: false })
      for (const sp of spans) {
        const range = new vscode.Range(lineIndex, sp.open, lineIndex, sp.close + 1)
        const { fg, bg, fgHex, bgHex } = sp.style
        if (fgHex || bgHex) {
          const resolvedFg = fgHex || (fg && COLORS[fg] ? COLORS[fg].dark.fg : null)
          const resolvedBg = bgHex || (bg && COLORS[bg] ? COLORS[bg].dark.bg : null)
          const hexType = getHexDecorationType(types, resolvedFg, resolvedBg)
          if (!hexRanges.has(hexType)) hexRanges.set(hexType, [])
          hexRanges.get(hexType).push(range)
        } else {
          if (fg && fgRanges[fg]) fgRanges[fg].push(range)
          if (bg && bgRanges[bg]) {
            bgRanges[bg].push(range)
          } else if (fg && bgRanges[fg]) {
            // Subtle pill background for foreground-only semantic/color spans in raw editor
            bgRanges[fg].push(range)
          }
        }
      }
      for (const df of diffs) {
        const range = new vscode.Range(lineIndex, df.open, lineIndex, df.close + 1)
        if (df.kind === 'add') diffAddRanges.push(range)
        else diffDelRanges.push(range)
      }
      for (const kb of kbds) {
        kbdRanges.push(new vscode.Range(lineIndex, kb.open, lineIndex, kb.close))
      }
    }

    // 5. Progress bars ([========..] 80%)
    if (line.includes('[') && line.includes('%')) {
      let searchPos = 0
      while (searchPos < line.length) {
        const bracketIdx = line.indexOf('[', searchPos)
        if (bracketIdx === -1) break
        const hit = matchProgressBar(line, bracketIdx, line.length)
        if (hit && fgRanges[hit.color]) {
          const range = new vscode.Range(lineIndex, bracketIdx, lineIndex, hit.endPos)
          fgRanges[hit.color].push(range)
          bgRanges[hit.color]?.push(range)
          searchPos = hit.endPos
        } else {
          searchPos = bracketIdx + 1
        }
      }
    }
  }

  // Apply all decoration ranges
  for (const c of Object.keys(COLORS)) {
    editor.setDecorations(types.fg[c], fgRanges[c])
    editor.setDecorations(types.bg[c], bgRanges[c])
    editor.setDecorations(types.boxBorders[c], boxBorderRanges[c])
    editor.setDecorations(types.boxTitles[c], boxTitleRanges[c])
    editor.setDecorations(types.tasks[c], taskRanges[c])
  }
  editor.setDecorations(types.boxBorders.default, boxBorderRanges.default)
  editor.setDecorations(types.diffAdd, diffAddRanges)
  editor.setDecorations(types.diffDel, diffDelRanges)
  editor.setDecorations(types.kbd, kbdRanges)

  for (const [hexType, dec] of types.hexCache.entries()) {
    editor.setDecorations(dec, hexRanges.get(dec) || [])
  }
}

function escapeSnippetText (str) {
  return str.replace(/[$}\\]/g, '\\$&')
}

function findTargetMarkdownEditor () {
  if (vscode.window.activeTextEditor) return vscode.window.activeTextEditor
  const visible = vscode.window.visibleTextEditors.find(
    e => e.document.languageId === 'hue-markdown' || e.document.languageId === 'markdown'
  )
  return visible || vscode.window.visibleTextEditors[0] || null
}

const BOX_QUICK_PICK_ITEMS = [
  { label: 'info', description: 'Blue callout / Pro Tip / General Info' },
  { label: 'ok', description: 'Green callout / Success / Resolved' },
  { label: 'note', description: 'Purple callout / Key Note / Highlight' },
  { label: 'warn', description: 'Orange callout / Warning / Heads Up' },
  { label: '!', description: 'Red callout / Critical / Caution' },
  { label: 'split', description: 'Side-by-side split boxes (two columns)' }
]

export function activate (context) {
  // Command: Open Side-by-Side preview (works for both .hue.md and .md)
  const openPreviewCmd = vscode.commands.registerCommand('hue.openPreviewSideBySide', async () => {
    const editor = findTargetMarkdownEditor()
    if (!editor) {
      vscode.window.showInformationMessage('Open a Markdown (.hue.md or .md) file first to preview.')
      return
    }
    const doc = editor.document
    previewDocUri = doc.uri.toString()
    const fileName = doc.fileName.split(/[\\/]/).pop()

    if (previewPanel) {
      previewPanel.title = `Preview ${fileName}`
      previewPanel.webview.html = renderPreviewHtml(doc)
      previewPanel.reveal(vscode.ViewColumn.Beside, true)
      return
    }

    previewPanel = vscode.window.createWebviewPanel(
      'hueMdPreview',
      `Preview ${fileName}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false }
    )
    previewPanel.webview.html = renderPreviewHtml(doc)
    previewPanel.onDidDispose(() => {
      previewPanel = null
      previewDocUri = null
    }, null, context.subscriptions)
  })
  context.subscriptions.push(openPreviewCmd)

  // Command: Downgrade to standard GFM Alert Markdown
  const downgradeCmd = vscode.commands.registerCommand('hue.downgradeToGfm', async () => {
    const editor = findTargetMarkdownEditor()
    if (!editor) {
      vscode.window.showInformationMessage('Open a Hue Markdown (.hue.md or .md) file first to convert.')
      return
    }

    const source = editor.document.getText()
    const converted = downgrade(source)

    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: converted
    })
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside })
  })
  context.subscriptions.push(downgradeCmd)

  // Command: Insert Box
  const insertBoxCmd = vscode.commands.registerCommand('hue.insertBox', async () => {
    const editor = findTargetMarkdownEditor()
    if (!editor) {
      vscode.window.showInformationMessage('Open a Markdown (.hue.md or .md) editor first to insert a box.')
      return
    }

    const choice = await vscode.window.showQuickPick(BOX_QUICK_PICK_ITEMS, {
      placeHolder: 'Select box type (info, ok, note, warn, !, or split)'
    })
    if (!choice) return

    if (choice.label === 'split') {
      const splitSnippet = '+-- ${1:ok} ${2:Do This}                    +-- ${3:warn} ${4:Avoid This}\n| ${5:Left content}                   | ${6:Right content}\n+--                                 +--\n'
      await editor.insertSnippet(new vscode.SnippetString(splitSnippet))
      return
    }

    const title = await vscode.window.showInputBox({ prompt: 'Enter box title (optional)', placeHolder: 'Pro Tip' })
    if (title === undefined) return
    const titleStr = title ? ` ${escapeSnippetText(title)}` : ''

    const snippetText = `+-- ${choice.label}${titleStr}\n| \${1:Content}\n+--\n`
    await editor.insertSnippet(new vscode.SnippetString(snippetText))
  })
  context.subscriptions.push(insertBoxCmd)

  // Command: Wrap Selection in Box
  const wrapBoxCmd = vscode.commands.registerCommand('hue.wrapSelectionInBox', async () => {
    const editor = findTargetMarkdownEditor()
    if (!editor) {
      vscode.window.showInformationMessage('Open a Markdown (.hue.md or .md) editor first to wrap a selection.')
      return
    }

    const selection = editor.selection
    const selectedText = editor.document.getText(selection)
    if (!selectedText) {
      vscode.commands.executeCommand('hue.insertBox')
      return
    }

    const wrapKinds = BOX_QUICK_PICK_ITEMS.filter(k => k.label !== 'split')
    const choice = await vscode.window.showQuickPick(wrapKinds, {
      placeHolder: 'Select box type (info, ok, note, warn, or !)'
    })
    if (!choice) return

    const title = await vscode.window.showInputBox({ prompt: 'Enter box title (optional)', placeHolder: 'Pro Tip' })
    if (title === undefined) return
    const titleStr = title ? ` ${title}` : ''

    const lines = selectedText.split(/\r?\n/)
    const boxedLines = lines.map(l => `| ${l}`)
    const replacement = `+-- ${choice.label}${titleStr}\n${boxedLines.join('\n')}\n+--\n`

    await editor.edit(editBuilder => {
      editBuilder.replace(selection, replacement)
    })
  })
  context.subscriptions.push(wrapBoxCmd)

  // Editor decoration change listeners
  let activeEditor = vscode.window.activeTextEditor
  if (activeEditor) updateDecorations(activeEditor)

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor
    if (editor) {
      updateDecorations(editor)
      if (previewPanel && (editor.document.languageId === 'hue-markdown' || editor.document.languageId === 'markdown')) {
        previewDocUri = editor.document.uri.toString()
        const fileName = editor.document.fileName.split(/[\\/]/).pop()
        previewPanel.title = `Preview ${fileName}`
        previewPanel.webview.html = renderPreviewHtml(editor.document)
      }
    }
  }, null, context.subscriptions)

  vscode.workspace.onDidChangeTextDocument(async event => {
    const doc = event.document
    if (activeEditor && doc === activeEditor.document) {
      // Auto-close box with +-- when pressing Enter on an empty "| " line
      if (
        !isAutoClosingBox &&
        (doc.languageId === 'hue-markdown' || doc.languageId === 'markdown') &&
        event.contentChanges.length === 1
      ) {
        const change = event.contentChanges[0]
        if (change.range.isEmpty && (change.text === '\n' || change.text === '\r\n')) {
          const prevLineIdx = change.range.start.line
          if (prevLineIdx >= 0 && prevLineIdx < doc.lineCount) {
            const prevLineText = doc.lineAt(prevLineIdx).text
            const emptySideMatch = /^(\s*)([|│])\s*$/.exec(prevLineText)
            if (emptySideMatch) {
              const indentStr = emptySideMatch[1]
              const sideChar = emptySideMatch[2]
              let closeBorder = sideChar === '│' ? '└──' : '+--'
              for (let l = prevLineIdx - 1; l >= 0; l--) {
                const t = doc.lineAt(l).text.trimStart()
                if (t.startsWith('╭')) { closeBorder = '╰──'; break }
                if (t.startsWith('┌')) { closeBorder = '└──'; break }
                if (t.startsWith('+')) { closeBorder = '+--'; break }
                if (!t.startsWith('|') && !t.startsWith('│')) break
              }
              const nextLineEnd = doc.lineAt(prevLineIdx + 1).range.end
              const replaceRange = new vscode.Range(prevLineIdx, 0, nextLineEnd.line, nextLineEnd.character)
              isAutoClosingBox = true
              try {
                await activeEditor.edit(editBuilder => {
                  editBuilder.replace(replaceRange, `${indentStr}${closeBorder}`)
                }, { undoStopBefore: false, undoStopAfter: true })
              } finally {
                isAutoClosingBox = false
              }
            }
          }
        }
      }
      updateDecorations(activeEditor)
    }
    if (previewPanel && doc.uri.toString() === previewDocUri) {
      previewPanel.webview.html = renderPreviewHtml(doc)
    }
  }, null, context.subscriptions)

  // Extension API for VS Code Markdown preview
  return {
    extendMarkdownIt (md) {
      return md.use(hue)
    }
  }
}

export function deactivate () {
  if (decorationTypes) {
    for (const d of Object.values(decorationTypes.fg)) d.dispose()
    for (const d of Object.values(decorationTypes.bg)) d.dispose()
    for (const d of Object.values(decorationTypes.boxBorders)) d.dispose()
    for (const d of Object.values(decorationTypes.boxTitles)) d.dispose()
    for (const d of Object.values(decorationTypes.tasks)) d.dispose()
    for (const d of decorationTypes.hexCache.values()) d.dispose()
    decorationTypes.diffAdd.dispose()
    decorationTypes.diffDel.dispose()
    decorationTypes.kbd.dispose()
    decorationTypes = null
  }
}
