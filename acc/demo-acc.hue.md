# Hue MD v0.2 — Acceptance Test Deck (`.hue.md`)

Readable raw Markdown with {ok: zero build steps}, {info: inline color}, and {note: clean plain-text fallback}.

---

## 1. Multi-State Tasks & Status Ticks

- [x] Pass all 652 CommonMark 0.31.2 conformance tests
- [x] Verify 0 false positives across 250 real-world Markdown files
- [-] Test side-by-side preview in local Notepad++ and terminal
- [!] Resolve {!: MSHTML flexbox fallback} for docked preview panel
- [?] Confirm whether `[[Key]]` should downgrade to `<kbd>` or backticks
- [ ] Promote v0.2 ACC to production after sign-off

---

## 2. Side-by-Side Split Box Columns

+-- ok Do This (Recommended)        +-- warn Avoid This
| Keep raw source human-readable.   | Pollute notes with raw `<span>` HTML.
| Use semantic colors (`ok`, `!`).  | Trap docs inside a JSX build step.
| Run `npm test` before promoting.  | Push untested syntax to production.
+--                                 +--

---

## 3. Native Key Caps & Inline Diff Spans

Shortcuts in Notepad++ and Terminal:
- Press [[Ctrl+Shift+H]] to toggle the Docked Live Preview in Notepad++.
- Press [[Ctrl+Shift+G]] to downgrade the buffer to GitHub Markdown.
- Press [[Ctrl]] + [[C]] or [[Esc]] to exit interactive slide mode, or [[?]] for help.

Changelog diff spans:
- Parser engine: {+: added linear O(n) split-box column scanner}, {-: removed quadratic rescan}.
- CLI tools: {+: added `slides` deck renderer}, {-: removed legacy `md-hue` label}.

---

## 4. Text Progress & Metric Bars

| Milestone          | Owner        | Status         | Completion        |
| :----------------- | :----------- | :------------- | :---------------- |
| Core v0.1 Spec     | {ok: team}   | {ok: shipped}  | [==========] 100% |
| ACC Test Suite     | {info: qa}   | {info: review} | [========..] 85%  |
| Notepad++ ACC      | {warn: dev}  | {warn: testing}| [====......] 45%  |
| Rust Parser Port   | {!: backlog} | {muted: plan}  | [=.........] 15%  |
