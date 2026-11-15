# Hue Markdown for Notepad++ (`HueMarkdown.dll`)

Native x64 C++ plugin for Notepad++ providing live Scintilla coloring and HTML preview/downgrade tools for Hue Markdown (`.hue.md`).

## Features

1. **Integrated Side-by-Side Live Preview (`Ctrl+Shift+H`)**
   - Docks a live rendered HTML preview panel directly inside the Notepad++ window on the right side (exactly like MDHero / VS Code split view).
   - Shows Hue badges (`{ok: passing}`, `{warn: 71%}`, `{!: blocked}`), styled cards, and formatted Markdown in real time as you edit.
   - Draggable vertical splitter lets you adjust editor vs. preview width seamlessly in the same window.

2. **Live In-Editor Scintilla Coloring**
   - Highlights Hue inline spans (`{red: text}`, `{warn: text}`, `{blue bg-gray: text}`, `{#c0ffee bg-#333333: hex}`) and drawn boxes (`┌──┐`, `╭──╮`, `+--+`) directly in the Notepad++ editor pane.
   - Uses Scintilla container indicators (`8..24`) so standard Markdown syntax highlighting (`#` headings, `**bold**`, `` `code` ``) remains intact underneath.
   - Automatically detects whether Notepad++ is using a Light or Dark editor background and applies the exact WCAG AA palette from `src/palette.js`.
   - Ignores ordinary braces in prose (`{a: 1}`, `{key: value}`) and code spans/fences (except ```` ```hue ```` fences).

3. **`Plugins → Hue Markdown` Menu & Shortcuts**
   - **Toggle Side-by-Side Live Preview (`Ctrl+Shift+H`)**: Toggles the integrated docking preview panel on the right side.
   - **Open HTML Preview in Browser**: Opens the standalone rendered HTML in your default external web browser.
   - **Auto-Update Preview on Save**: Automatically refreshes the preview when saving.
   - **Downgrade to GitHub Markdown (`Ctrl+Shift+G`)**: Runs `md-hue downgrade` on the active buffer and opens the converted GitHub Markdown (with `> [!NOTE]` / `> [!WARNING]` alerts) in a new Notepad++ tab.
   - **Enable In-Editor Hue Coloring**: Toggle live Scintilla Hue coloring on/off.
   - **Open Hue Demo Document (`demo.hue.md`)**: Opens `demo/demo.hue.md` directly in Notepad++.

## Quick Start (No Admin / UAC Required)

```powershell
.\notepadpp-hue\run-local.ps1
```

This builds `HueMarkdown.dll` (if needed), stages a local portable Notepad++ instance in `%LOCALAPPDATA%\Notepad++Hue` with `HueMarkdown.dll` pre-installed, and opens `demo/demo.hue.md`.

## Install into System Notepad++ (`C:\Program Files\Notepad++`)

Either:
- Run `.\notepadpp-hue\install-system.ps1` (prompts for Windows UAC elevation once to copy `HueMarkdown.dll` into `C:\Program Files\Notepad++\plugins\HueMarkdown\`), or
- In Notepad++, choose **Settings → Import → Import plugin(s)...** and select `notepadpp-hue\dist\HueMarkdown\HueMarkdown.dll`.

## Build from Source

```powershell
.\notepadpp-hue\build.ps1
```
