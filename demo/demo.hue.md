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
