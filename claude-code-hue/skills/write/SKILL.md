---
name: write
description: Write and edit Hue Markdown (.hue.md), a CommonMark superset with colored spans, diff spans, keycaps, progress bars, multi-state tasks, drawn callout boxes, and side-by-side split boxes. Use when creating or editing a .hue.md file, or when the user asks for Markdown with colored text, status labels, tasks, keyboard shortcuts, progress bars, or callout boxes.
---

# Writing Hue Markdown

Hue Markdown is CommonMark plus colored **spans**, **diff spans**, **key caps**, **progress bars**, **multi-state tasks**, and drawn **boxes** (single or side-by-side). Its main rule: the raw text must read correctly without rendering, in an editor, a diff, a terminal, or for another AI agent. Write it so a person reading the source never needs the rendered version.

Files use the extension `.hue.md`. Everything that is valid CommonMark stays valid and renders unchanged.

## Spans

`{style: text}` colors inline text. The style is one or more tokens separated by spaces; the text is inline Markdown and may contain `**bold**`, `code` and other spans.

| Kind | Tokens |
| :--- | :--- |
| Meaning (prefer these) | `ok` (green), `warn` (orange), `!` or `danger` (red), `info` (blue), `note` (purple), `muted` (gray) |
| Color | `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `gray` |
| Background | `bg-` plus a color or meaning: `bg-yellow`, `bg-warn` |
| Hex (last resort) | `#rgb`, `#rrggbb`, `bg-#rrggbb` |

```markdown
Build: {ok: passing} · Coverage: {warn: 71%} · Deploy: {!: blocked}
Review {bg-yellow: this sentence} before Friday.
Badge: {blue bg-gray: beta}
```

Rules:

- Tokens are lowercase and case-sensitive. If any word in the style is not a token, nothing is colored: `{a: 1}`, `{key: value}` and `{Red: x}` stay literal text.
- The style must fit on one line, at most 64 characters.
- Braces inside inline code, autolinks and HTML don't count. Write a literal brace as `\{` or `\}`.
- A `}` inside a link destination closes the span, so escape it as `\}` or `%7D`.

## Inline diff spans

Use `{+: added text}` for additions (green) and `{-: removed text}` for removals (red strikethrough):

```markdown
Parser: {+: linear split-box scanner}, {-: quadratic rescan}.
```

## Multi-state tasks

Task list items support five states:

- `- [ ]` todo (gray)
- `- [-]` in progress (blue)
- `- [!]` blocked (red)
- `- [?]` question / needs review (purple)
- `- [x]` or `- [X]` done (green)

```markdown
- [x] Ship core parser
- [-] Verify terminal slide deck
- [!] Resolve blocker on Windows
- [?] Confirm keycap downgrade format
- [ ] Tag release
```

## Key caps and progress bars

- Key caps: wrap keyboard shortcuts in double brackets, such as `[[Ctrl+Shift+P]]`, `[[Cmd+K]]`, `[[Esc]]`, or `[[?]]`. WikiLinks with spaces (`[[Project Roadmap]]`) and array indices (`arr[[0]]`) stay plain text.
- Progress bars: write a bracketed bar of 4 to 40 characters (`=`, `#`, `.`, `-`, `~`, or space) followed by `0%` to `100%`, such as `[========..] 80%` or `[==========] 100%`.

## Boxes and side-by-side split boxes

A box opens with `+--` and a label, has one `|` line per line of content, and closes with `+--`. No right-hand border is needed, so never pad lines to align one.

```markdown
+-- warn Heads up
| The API allows {warn: 100 requests/min}.
| Cache responses before deploying.
+--
```

Place two or more boxes side by side separated by at least two spaces to create equal-width columns:

```markdown
+-- ok Do This                      +-- warn Avoid This
| Keep raw source human-readable.   | Pollute notes with raw HTML.
| Use semantic tokens (`ok`, `!`).  | Trap docs inside a build step.
+--                                 +--
```

- The label starts with style tokens and the remaining words are the title: `+-- info Release notes` is a blue box titled "Release notes". Use `info`, `ok`, `note`, `warn` or `!` for most boxes.
- Every line between the top and bottom border must start with `|`, or the lines are not a box. For a blank line inside a box, write a lone `|`.
- Box content is full Markdown: lists, bold, inline code and spans all work. Each `|` line starts a new line in the output.
- Closed borders also work: ASCII `+-- ok Title --+`, Unicode `┌─ ok Title ─┐ … └───┘`, rounded `╭─ … ╰─`. Prefer the open `+--` form when writing, because it needs no alignment.

## Hue fences

A fenced code block with the info string `hue` renders as Hue. Use it inside plain `.md` files (for example a README) where a box should still look like a box on platforms without Hue. Any other fence (` ```markdown `, ` ```txt `) shows Hue syntax literally, which is how you show Hue examples.

## When to use Hue, and how much

- Good fits: status reports, release notes, checklists, runbooks, handover notes, plans, slide decks, and agent instruction files that people also read.
- Use meaning tokens (`ok`, `warn`, `!`) over raw colors, so the text carries meaning without color.
- Color a few words, not whole paragraphs. One or two boxes per screen is plenty; a box is for something the reader must not miss.
- Do not add Hue to a plain `.md` file the user didn't ask to change. GitHub and most viewers show Hue syntax literally. Write `.hue.md` and convert it (see below) when it must look right on GitHub.

## Tools

The plugin bundles the hue-md CLI. Run it with Node:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" view notes.hue.md --width 80 --color never
node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" slides notes.hue.md --width 80
node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" downgrade notes.hue.md
node "${CLAUDE_PLUGIN_ROOT}/scripts/hue-md.cjs" html notes.hue.md --standalone -o notes.html
```

- `view` with `--color never` shows the rendered layout as plain text. Use it to check that your boxes and split boxes parsed: a box that parsed shows a drawn frame, one that didn't shows raw `+--` and `|` lines.
- `slides` splits the document on top-level `---` lines and renders framed terminal slides (add `--slide <n>` for one slide or `-i` for interactive arrow-key navigation).
- `downgrade` prints GitHub Markdown: boxes and split boxes become `> [!NOTE]`-style alerts, red and orange spans (`!`, `danger`, `warn`) become bold, `{+:}`/`{-:}` become bold/strikethrough, `[[Key]]` becomes `<kbd>Key</kbd>`, and multi-state tasks become GFM checkboxes with labels.
- The user can preview a file with `/hue-md:preview <file>` and write the GitHub copy with `/hue-md:github <file>`.
