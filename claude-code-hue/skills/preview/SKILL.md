---
name: preview
description: Render a .hue.md file to a standalone HTML page with colors, tasks, keycaps, progress bars, and boxes, and open it in the browser.
argument-hint: <file.hue.md>
disable-model-invocation: true
---

Preview the Hue Markdown file `$ARGUMENTS` in the browser.

Where Claude Code can load the plugin's pane module, `/hue-md:preview` opens a preview pane beside the chat and this skill does not run. These steps are the fallback for everywhere else.

1. If no file was given, look for `.hue.md` files in the current directory. If there is exactly one, use it; otherwise ask which one.
2. Render it to a standalone HTML page in the system temp directory, named after the file (for example `notes.hue.md` becomes `notes.hue.html`):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" html "<file>" --standalone -o "<temp dir>/<name>.hue.html"
   ```

   Do not write the HTML into the user's project.
3. Open the page with the platform's opener: `start "" "<path>"` on Windows (cmd or Git Bash), `Invoke-Item "<path>"` in PowerShell, `open "<path>"` on macOS, `xdg-open "<path>"` on Linux. If opening fails, give the user the full path instead.
4. Tell the user where the page is, and that they can also see colors or present slides in their own terminal with:

   ```
   ! node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" view "<file>"
   ! node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" slides "<file>" -i
   ```
