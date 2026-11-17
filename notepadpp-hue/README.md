# Hue Markdown for Notepad++ (`hue-md.dll`)

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

## Install from the release zip

The zip contains `install.ps1` and a `hue-md` folder with `hue-md.dll`, `hue-md.cjs` and `demo.hue.md`. The plugin needs all three files in the same folder.

1. Extract the whole zip.
2. In the extracted folder, right-click `install.ps1` and choose **Run with PowerShell**. It asks for admin rights once and copies the `hue-md` folder to `C:\Program Files\Notepad++\plugins\hue-md\`.
3. Restart Notepad++ and choose **Plugins → Hue Markdown**.

For a portable Notepad++, run the script with your own plugins folder, no admin needed:

```powershell
.\install.ps1 -TargetDir "D:\Notepad++\plugins\hue-md"
```

Or copy the `hue-md` folder into the `plugins` folder yourself.

## From the repository

### Quick start (no admin needed)

```powershell
.\notepadpp-hue\run-local.ps1
```

This builds `hue-md.dll` (if needed), sets up a portable Notepad++ in `%LOCALAPPDATA%\Notepad++Hue` with the plugin installed, and opens `demo/demo.hue.md`.

### Install into Notepad++ in Program Files

Run `.\notepadpp-hue\install-system.ps1`. It asks for admin rights once and copies `hue-md.dll` into `C:\Program Files\Notepad++\plugins\hue-md\`.

### Build from source

```powershell
.\notepadpp-hue\build.ps1
```
