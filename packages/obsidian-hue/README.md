# Hue MD for Obsidian (`hue-md`)

Renders [Hue Markdown](https://spingras.github.io/hue-md/) v0.2 in Obsidian's **Reading view**:

- colored spans: `{ok: passing}`, `{warn: 71%}`, `{!: blocked}`, `{bg-yellow: key phrase}`, `{#c0ffee: hex}`
- diff spans: `{+: added}`, `{-: removed}`
- key caps: `[[Ctrl+Shift+V]]`
- progress bars: `[========..] 80%`
- multi-state tasks: `- [-] in progress`, `- [!] blocked`, `- [?] question`
- drawn callout boxes (`+-- info Title` … `+--`), also side by side, and nested
- ` ```hue ` fences

The plugin bundles the real Hue parser (`src/index.js` and `src/core.js` at the repo root), so a note looks the same as in VS Code, Joplin or the CLI. Colors follow Obsidian's own light/dark theme (**Settings → Appearance → Base color scheme**), whatever the OS is set to.

How it fits into Obsidian:

- **Boxes** are drawn from the note source, and the text inside a box is rendered by Obsidian itself, so wikilinks, embeds, tags and lists keep working inside boxes.
- **`- [ ]` and `- [x]`** stay Obsidian's own clickable checkboxes. Hue only draws the states Obsidian has no checkbox for (`[-]`, `[!]`, `[?]`), the same choice as the Joplin plugin.
- **`[[Ctrl+C]]`** is a wikilink to Obsidian. If it has no alias, no note with that name exists and the text is a valid key cap, Hue draws a key cap. A note called `Esc` keeps `[[Esc]]` a link.
- **Live Preview and Source mode** still show the raw Hue text. Switch to Reading view (`Ctrl+E` / `Cmd+E`) to see it rendered.

Command palette (`Ctrl+P` / `Cmd+P`), in the editor:

- `Hue MD: Insert info box (+-- info)`, `success box (+-- ok)`, `note box (+-- note)`, `warning box (+-- warn)`, `danger box (+-- !)`: wraps the selection in a box
- `Hue MD: Insert side-by-side boxes (+-- ok / +-- warn)`

## Install

Copy three files into your vault's `.obsidian/plugins/hue-md/` folder:

```text
<YourVault>/.obsidian/plugins/hue-md/
├── main.js
├── manifest.json
└── styles.css
```

Get them from `hue-md-obsidian.zip` on a release, or from this folder (after a build, see below). Then open **Settings → Community plugins**, turn on community plugins if needed, click the reload icon next to **Installed plugins** and enable **Hue MD**.

## Build

`main.js`, `manifest.json` and `styles.css` are generated: edit `src/` and rebuild. The build needs the root dev dependencies (esbuild), so run `npm install` once at the repo root. Then, from the repo root:

```bash
node packages/obsidian-hue/scripts/build.mjs
```

(In WSL without a Linux Node, use `node.exe`.) It writes:

- `main.js`: `src/main.js` bundled with the Hue parser and the shared DOM pass (`src/dom.js` at the repo root)
- `manifest.json`: `src/manifest.json`, with the version from the root `package.json`
- `styles.css`: the shared Hue stylesheet, the `body.theme-light` / `body.theme-dark` colors from `src/palette.js`, and `src/obsidian.css`

## Test

`npm test` at the repo root runs `test/render.test.js`: it loads the built `main.js` with a stand-in `obsidian` module and runs the post-processor on `demo/demo.hue.md` in a jsdom page, checking spans, diff spans, boxes, split boxes, nested boxes, tasks, key caps, progress bars, ` ```hue ` fences and the theme colors. The stand-in models Obsidian's Reading view HTML; it is not Obsidian. The manual check below covers the real app.

## Manual check in Obsidian

1. Build (see above), then make a test vault and copy the plugin and the demo note into it. From the repo root, in WSL bash (pick any folder under `/mnt/c/`):

   ```bash
   VAULT=/mnt/c/Users/<you>/Documents/HueTestVault
   ```

   ```bash
   mkdir -p "$VAULT/.obsidian/plugins/hue-md" && cp packages/obsidian-hue/main.js packages/obsidian-hue/manifest.json packages/obsidian-hue/styles.css "$VAULT/.obsidian/plugins/hue-md/" && cp demo/demo.hue.md "$VAULT/"
   ```

2. In Obsidian: **Open another vault → Open folder as vault**, pick `HueTestVault`, and trust the author when asked.
3. **Settings → Community plugins**: turn on community plugins, enable **Hue MD**.
4. Open the `demo.hue` note and switch to **Reading view** (`Ctrl+E`). Check:
   - [ ] `passing` green, `71%` orange, `blocked` red; the yellow highlight, the blue-on-gray span and the `#c0ffee` hex span are colored (not turned into a `#tag`); `{a: 1}` stays plain text
   - [ ] five boxes (blue, green, purple, orange, red) with titles, each `|` line on its own line, the bullet list inside the red box
   - [ ] the two boxes at the end sit side by side (green "Do this", orange "Avoid this")
   - [ ] tasks: `[-]` blue ◐, `[!]` red !, `[?]` purple ?, lined up with the two normal checkboxes; ticking those two still edits the note
   - [ ] `Ctrl+Shift+V` and `Esc` are key caps, not links
   - [ ] the 80% bar is blue, the 100% bar green; the Changelog line shows green inserted and red struck-through text
5. **Settings → Appearance → Base color scheme**: switch between Light and Dark; the Hue colors switch with it.
6. Optional: put a box with a `[[wikilink]]` inside, and check the link works in Reading view.
