# Hue MD (`.hue.md`) {ok: v0.2}

Hue MD adds {ok: color spans}, {+: inline additions}, {-: inline removals}, [[Ctrl+Shift+P]] key caps, [========..] 80% progress bars, multi-state tasks, and drawn boxes to Markdown text.

+-- info Readable Raw Source
| Every Hue construct is plain text first.
| Read this file in a terminal with `npx hue-md view README.hue.md`
| or present it as slides with `npx hue-md slides README.hue.md -i`.
+--

---

## 1. Side-by-Side Split Boxes & Single Boxes

Place two or more boxes side by side separated by at least two spaces:

+-- ok Do This (Recommended)        +-- warn Avoid This
| Keep raw source human-readable.   | Pollute notes with raw `<span>` HTML.
| Use semantic colors (`ok`, `!`).  | Trap docs inside a JSX build step.
| Run `npm test` before promoting.  | Push untested syntax to production.
+--                                 +--

Single boxes support five semantic styles (`info`, `ok`, `note`, `warn`, `!`):

+-- note GitHub Downgrade Ready
| Run `hue-md downgrade README.hue.md` to convert boxes and split boxes
| into native GitHub Alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
+--

+-- ! Never Commit Secrets
| Keep `.env` files out of git.
| - Add `.env` to `.gitignore`
| - Rotate any leaked key {!: immediately}
+--

---

## 2. Multi-State Tasks & Status Ticks

- [x] Pass all 652 CommonMark 0.31.2 conformance tests
- [x] Verify 0 false positives across 250 real-world Markdown files
- [-] Present slide decks in the terminal with `hue-md slides -i`
- [!] Resolve {!: production blockers} before tagging release
- [?] Confirm whether `[[Key]]` should use `<kbd>` or backticks in GFM
- [ ] Publish next release package

---

## 3. Color Spans, Diff Spans, Key Caps & Progress Bars

Inline status and diff spans:
- Build status: {ok: passing} · Coverage: {info: 94%} · Latency: {warn: 180ms} · Prod: {!: blocked}
- Changelog: {+: added linear split-box scanner and terminal slide deck}, {-: removed legacy fallback}

Editor shortcuts:
- Press [[Ctrl+Shift+V]] in VS Code to open the side-by-side preview.
- Press [[Ctrl+Shift+H]] in Notepad++ to toggle the docked live preview panel.
- Press [[Ctrl+Shift+G]] in Notepad++ to downgrade the current buffer to GitHub Markdown.

Release progress:

| Component | Status | Coverage |
| :--- | :--- | :--- |
| Core Parser & CSS | {ok: ready} | [==========] 100% |
| CLI & Slide Deck Mode | {ok: ready} | [==========] 100% |
| Claude Code CLI Plugin | {ok: ready} | [==========] 100% |
| Notepad++ & VS Code | {ok: ready} | [==========] 100% |

---

## 4. Install & Commands

| Platform | Command / Package |
| :--- | :--- |
| npm CLI & library | `npm install -g hue-md` |
| Claude Code | `/plugin install hue-md --marketplace spingras/hue-md` |
| VS Code / Cursor | Search `spingras.hue-md` in Extensions |
| Notepad++ (x64) | Extract the zip and run `install.ps1` |
| Obsidian | Extract `hue-md-obsidian.zip` to `.obsidian/plugins/hue-md/` |
| Joplin | **Install from file** with `io.github.spingras.hue-md.jpl` |
| Neovim | Extract `hue-md-nvim.zip` to your `pack/*/start/` folder |
| GitHub.com | `hue-md.user.js` (userscript) or `hue-md-browser.zip` (Chromium) |
| Snippets | `hue-md-snippets.zip`: Sublime Text, UltiSnips, LuaSnip, Obsidian |

```sh
hue-md view README.hue.md
hue-md slides README.hue.md -i
hue-md downgrade README.hue.md -o README.gfm.md
hue-md html README.hue.md --standalone -o README.html
```
