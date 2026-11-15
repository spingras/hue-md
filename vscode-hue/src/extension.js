// VS Code extension for Hue Markdown
import * as vscode from 'vscode'
import hue from '../../src/index.js'
import { COLORS, resolveColor, parseSpec, parseTop, stripSide, BOX_TOP, BOX_BOTTOM, BOX_SIDE } from '../../src/core.js'
import { downgrade } from '../../md-hue/src/downgrade.js'

// Decoration types cache for colors & backgrounds
let decorationTypes = null

function initDecorations () {
  if (decorationTypes) return decorationTypes

  const types = {
    spans: {},
    boxBorders: {},
    boxTitles: {}
  }

  for (const [colorName, colorDef] of Object.entries(COLORS)) {
    // Foreground and background text decorations
    types.spans[colorName] = vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor(`hue.${colorName}`),
      light: {
        color: colorDef.light.fg,
        backgroundColor: colorDef.light.bg,
        borderRadius: '3px'
      },
      dark: {
        color: colorDef.dark.fg,
        backgroundColor: colorDef.dark.bg,
        borderRadius: '3px'
      }
    })

    // Box top / bottom border decorations
    types.boxBorders[colorName] = vscode.window.createTextEditorDecorationType({
      light: { color: colorDef.light.fg },
      dark: { color: colorDef.dark.fg }
    })

    // Box title decorations
    types.boxTitles[colorName] = vscode.window.createTextEditorDecorationType({
      fontWeight: 'bold',
      light: { color: colorDef.light.fg },
      dark: { color: colorDef.dark.fg }
    })
  }

  // Fallback / default gray border for unstyled boxes
  types.boxBorders.default = vscode.window.createTextEditorDecorationType({
    light: { color: COLORS.gray.light.fg },
    dark: { color: COLORS.gray.dark.fg }
  })

  decorationTypes = types
  return types
}

// Update editor text decorations for live syntax coloring
function updateDecorations (editor) {
  if (!editor || !editor.document) return
  const doc = editor.document
  if (doc.languageId !== 'hue-markdown' && doc.languageId !== 'markdown') return

  const types = initDecorations()
  const spanRanges = {}
  const boxBorderRanges = {}
  const boxTitleRanges = {}

  for (const c of Object.keys(COLORS)) {
    spanRanges[c] = []
    boxBorderRanges[c] = []
    boxTitleRanges[c] = []
  }
  boxBorderRanges.default = []

  const text = doc.getText()
  const lines = text.split(/\r?\n/)

  let inHueFence = false

  // Regex for inline span: {color: text}
  const spanRegex = /\{([a-zA-Z0-9_\-\s#]+?):((?:[^{}]|\{[^{}]*\})*)\}/g

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const trimmed = line.trim()

    if (trimmed.startsWith('```hue') || trimmed.startsWith('~~~hue')) {
      inHueFence = true
      continue
    }
    if (inHueFence && (trimmed.startsWith('```') || trimmed.startsWith('~~~'))) {
      inHueFence = false
      continue
    }

    // Check for box top: ┌── color title ──┐ or +-- info Title
    const indent = line.length - line.trimStart().length
    const content = line.slice(indent)

    const top = parseTop(content)
    if (top) {
      const color = top.style?.fg || top.style?.bg
      const targetColor = color || 'default'
      boxBorderRanges[targetColor]?.push(new vscode.Range(lineIndex, indent, lineIndex, line.length))
      if (top.title && color && boxTitleRanges[color]) {
        const titleIdx = line.indexOf(top.title, indent)
        if (titleIdx !== -1) {
          boxTitleRanges[color].push(new vscode.Range(lineIndex, titleIdx, lineIndex, titleIdx + top.title.length))
        }
      }
      continue
    }

    // Check for box bottom: └── ... ──┘ or +--
    if (BOX_BOTTOM.test(content)) {
      boxBorderRanges.default.push(new vscode.Range(lineIndex, indent, lineIndex, line.length))
      continue
    }

    // Inline spans
    spanRegex.lastIndex = 0
    let match
    while ((match = spanRegex.exec(line)) !== null) {
      const spec = match[1]
      const parsed = parseSpec(spec)
      if (parsed) {
        const color = parsed.fg || parsed.bg
        if (color && spanRanges[color]) {
          const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + match[0].length)
          spanRanges[color].push(range)
        }
      }
    }
  }

  // Apply ranges to decorations
  for (const [c, ranges] of Object.entries(spanRanges)) {
    editor.setDecorations(types.spans[c], ranges)
  }
  for (const [c, ranges] of Object.entries(boxBorderRanges)) {
    if (types.boxBorders[c]) editor.setDecorations(types.boxBorders[c], ranges)
  }
  for (const [c, ranges] of Object.entries(boxTitleRanges)) {
    if (types.boxTitles[c]) editor.setDecorations(types.boxTitles[c], ranges)
  }
}

export function activate (context) {
  // Command: Open Side-by-Side preview
  const openPreviewCmd = vscode.commands.registerCommand('hue.openPreviewSideBySide', async () => {
    await vscode.commands.executeCommand('markdown.showPreviewToSide')
  })
  context.subscriptions.push(openPreviewCmd)

  // Command: Downgrade to standard GFM Alert Markdown
  const downgradeCmd = vscode.commands.registerCommand('hue.downgradeToGfm', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

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
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const kinds = [
      { label: 'info', description: 'Blue callout / Pro Tip / General Info' },
      { label: 'ok', description: 'Green callout / Success / Resolved' },
      { label: 'warn', description: 'Orange callout / Warning / Heads Up' },
      { label: 'note', description: 'Purple callout / Key Note / Highlight' },
      { label: 'danger', description: 'Red callout / Critical / Caution' }
    ]

    const choice = await vscode.window.showQuickPick(kinds, { placeHolder: 'Select box type' })
    if (!choice) return

    const title = await vscode.window.showInputBox({ prompt: 'Enter box title (optional)', placeHolder: 'Pro Tip' })
    const titleStr = title ? ` ${title}` : ''

    const snippetText = `+-- ${choice.label}${titleStr}\n| \${1:Content}\n+--\n`
    await editor.insertSnippet(new vscode.SnippetString(snippetText))
  })
  context.subscriptions.push(insertBoxCmd)

  // Command: Wrap Selection in Box
  const wrapBoxCmd = vscode.commands.registerCommand('hue.wrapSelectionInBox', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const selection = editor.selection
    const selectedText = editor.document.getText(selection)
    if (!selectedText) {
      vscode.commands.executeCommand('hue.insertBox')
      return
    }

    const kinds = [
      { label: 'info', description: 'Blue callout / Pro Tip / General Info' },
      { label: 'ok', description: 'Green callout / Success / Resolved' },
      { label: 'warn', description: 'Orange callout / Warning / Heads Up' },
      { label: 'note', description: 'Purple callout / Key Note / Highlight' },
      { label: 'danger', description: 'Red callout / Critical / Caution' }
    ]

    const choice = await vscode.window.showQuickPick(kinds, { placeHolder: 'Select box type' })
    if (!choice) return

    const title = await vscode.window.showInputBox({ prompt: 'Enter box title (optional)', placeHolder: 'Pro Tip' })
    const titleStr = title ? ` ${title}` : ''

    const lines = selectedText.split(/\r?\n/)
    const boxedLines = lines.map(l => l.startsWith('|') ? l : `| ${l}`)
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
    if (editor) updateDecorations(editor)
  }, null, context.subscriptions)

  vscode.workspace.onDidChangeTextDocument(event => {
    if (activeEditor && event.document === activeEditor.document) {
      updateDecorations(activeEditor)
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
    for (const d of Object.values(decorationTypes.spans)) d.dispose()
    for (const d of Object.values(decorationTypes.boxBorders)) d.dispose()
    for (const d of Object.values(decorationTypes.boxTitles)) d.dispose()
    decorationTypes = null
  }
}
