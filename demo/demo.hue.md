# Hue Markdown

Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}

Highlight {bg-yellow: key phrases}, combine {blue bg-gray: text and background},
or reach for an exact {#c0ffee bg-#333333: hex color} when the palette is not enough.
Normal prose like {a: 1} or {key: value} stays untouched.

+-- info Effortless Boxes
| Start with `+--` followed by `info`, `ok`, `note`, `warn`, or `!`
| Every `|` line automatically starts on a new line
| Close with `+--` — no right border or alignment needed
+--

+-- ok Full Markdown Inside
| Boxes support **bold**, *italics*, `inline code`, and {ok: colored spans}.
| Everything works out of the box across Web, CLI, VS Code, and Notepad++.
+--

+-- note GitHub Ready
| Run `hue-md downgrade` to convert Hue boxes into native GitHub Alerts
| (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
+--

+-- warn Heads Up
| Public API endpoints are rate-limited to {warn: 100 requests/min}.
| Cache responses locally before deploying to production.
+--

+-- ! Never Commit Secrets
| Keep `.env` files out of git.
| - Add `.env` to `.gitignore`
| - Rotate any key that leaked {!: immediately}
+--

## New in v0.2

- [x] Spec and tests pass
- [-] Release notes {+: in progress}
- [!] Launch post {!: blocked} on review
- [?] More examples in the playground?
- [ ] Announce the release

Press [[Ctrl+Shift+V]] in VS Code for the live preview, or [[Esc]] to close it.

Build: [========..] 80% · Tests: [==========] 100%

Changelog: {+: added key caps and progress bars}, {-: removed the old md-hue package}.

+-- ok Do this                    +-- warn Avoid this
| Keep the source readable.       | Raw `<span>` HTML in your notes.
| Use `ok`, `warn` and `!`.       | A build step for your docs.
+--                               +--
