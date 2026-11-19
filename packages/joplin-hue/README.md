# Hue MD for Joplin

Renders [Hue Markdown](https://spingras.github.io/hue-md/) in Joplin's note viewer:

- colored spans: `{ok: passing}`, `{warn: 71%}`, `{!: blocked}`, `{bg-yellow: key phrase}`, `{#c0ffee: hex}`
- diff spans: `{+: added}`, `{-: removed}`
- key caps: `[[Ctrl+Shift+V]]`
- progress bars: `[========..] 80%`
- multi-state tasks: `- [-] in progress`, `- [!] blocked`, `- [?] question`
- drawn callout boxes (`+-- info Title` … `+--`), also side by side
- ` ```hue ` fences

It also adds a **Tools → Hue MD** menu:

- **New Hue MD demo note**: creates a note with every Hue feature, in the current notebook
- **Insert info box**, **warning box**, **side-by-side boxes**, **task list**, **progress bar**, **key cap**, **colored text**: insert a ready-made snippet at the cursor (Markdown editor)

The plugin registers the real Hue parser (the `hue-md` markdown-it plugin) on Joplin's renderer, so a note looks the same as in VS Code, Obsidian or the CLI. Colors follow the Joplin theme: light themes get the light palette, dark themes (Dark, Dracula, Nord, OLED Dark, …) get the dark one, whatever the OS is set to.

`- [ ]` and `- [x]` stay Joplin's own clickable checkboxes, so ticking a box in the viewer still updates the note. Hue only draws the states Joplin has no checkbox for (`[-]`, `[!]`, `[?]`).

## Install

### From a file (now)

1. Get `io.github.spingras.hue-md.jpl` (from a release, or build it, see below).
2. In Joplin: **Tools → Options → Plugins** (macOS: **Joplin → Settings → Plugins**).
3. Click the gear icon → **Install from file**, pick the `.jpl` and restart Joplin.

### From the plugin repository (once published)

**Tools → Options → Plugins**, search for **Hue MD**, click **Install**, restart Joplin.

## Build

Needs Node 18 or newer. From the repo root, in WSL bash:

```bash
cd packages/joplin-hue
```

```bash
npm install
```

```bash
npm run dist
```

`npm run dist` writes `src/hue-md.css` from the shared Hue stylesheet, bundles the plugin with webpack (standard generator-joplin layout) and creates:

- `publish/io.github.spingras.hue-md.jpl`: the plugin file to install
- `publish/io.github.spingras.hue-md.json`: the manifest plus hash, for the plugin repository

## Test

```bash
npm test
```

The test renders `demo/demo.hue.md` through `@joplin/renderer` (the renderer the Joplin apps use) with the built `dist/contentScript.js` loaded as a plugin content script. It checks spans, boxes, split boxes, tasks next to Joplin checkboxes, key caps, progress bars, light and dark theme CSS, and the contents of the `.jpl`. Run `npm run dist` first.

## Limits

- **Rich Text editor:** Hue blocks are shown there, but the Rich Text editor turns notes back into Markdown when it saves, and it does not know Hue syntax. Edit Hue notes in the Markdown editor.
- **Mobile:** the content script has no desktop-only code, but it has only been tried on Joplin desktop.
- **Editor highlighting:** the plugin styles the viewer, not the Markdown editor.

## Publishing to the Joplin plugin repository (not done yet)

The Joplin plugin repository picks up plugins from npm automatically. What is needed:

1. **npm package name** starts with `joplin-plugin-`: it is `joplin-plugin-hue-md` (free on npm as of 18 Nov 2026).
2. **`keywords`** in `package.json` include `joplin-plugin` (done).
3. **`files`** ships `publish/` (the `.jpl` and `.json`); the `prepare` script runs `npm run dist`, so `npm publish` builds first (done).
4. **Plugin id** `io.github.spingras.hue-md` in `src/manifest.json` is permanent: never change it after the first publish.
5. **Version:** `version` in `package.json` and `src/manifest.json` must match, and must go up for every release (`npm run updateVersion` bumps both). It is kept equal to the root `hue-md` version.
6. **Manifest fields** used by the repository page: `name`, `description`, `homepage_url`, `repository_url`, `categories` (`viewer`, `appearance`) are set. Optional: add `screenshots` and `icons` before publishing, for a better listing.
7. **npm account** that owns the package (decide whether it is the spingras npm account), then from `packages/joplin-hue`: `npm publish`.
8. Within about 30 minutes the repository bot adds the plugin to [joplin/plugins](https://github.com/joplin/plugins). Check that it shows up in Joplin's plugin search.
9. Optional: announce it in the Joplin forum's *Plugins* category.

## License

MIT, see the repository [LICENSE](https://github.com/spingras/hue-md/blob/main/LICENSE).
