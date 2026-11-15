# Hue Markdown

Build: passing · Coverage: **71%** · Deploy: **blocked**

Highlight key phrases, combine text and background,
or reach for an exact hex color when the palette is not enough.
Normal prose like {a: 1} or {key: value} stays untouched.

> [!NOTE]
> **Effortless Boxes**
>
> Start with `+--` followed by `info`, `ok`, `note`, `warn`, or `!`
> Every `|` line automatically starts on a new line
> Close with `+--` — no right border or alignment needed

> [!TIP]
> **Full Markdown Inside**
>
> Boxes support **bold**, *italics*, `inline code`, and colored spans.
> Everything works out of the box across Web, CLI, VS Code, and Notepad++.

> [!IMPORTANT]
> **GitHub Ready**
>
> Run `hue-md downgrade` to convert Hue boxes into native GitHub Alerts
> (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).

> [!WARNING]
> **Heads Up**
>
> Public API endpoints are rate-limited to **100 requests/min**.
> Cache responses locally before deploying to production.

> [!CAUTION]
> **Never Commit Secrets**
>
> Keep `.env` files out of git.
> - Add `.env` to `.gitignore`
> - Rotate any key that leaked **immediately**
