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

## New in v0.2

- [x] Spec and tests pass
- [ ] *(in progress)* Release notes **+in progress**
- [ ] **[!]** Launch post **blocked** on review
- [ ] **[?]** More examples in the playground?
- [ ] Announce the release

Press <kbd>Ctrl+Shift+V</kbd> in VS Code for the live preview, or <kbd>Esc</kbd> to close it.

Build: [========..] 80% · Tests: [==========] 100%

Changelog: **+added key caps and progress bars**, ~~removed the old md-hue package~~.

> [!TIP]
> **Do this**
>
> Keep the source readable.  
> Use `ok`, `warn` and `!`.

> [!WARNING]
> **Avoid this**
>
> Raw `<span>` HTML in your notes.  
> A build step for your docs.
