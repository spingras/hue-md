---
title: Hue Markdown Spec
version: 0.2.6
date: 2026-11-15
license: CC-BY-SA 4.0
---

# Introduction

## What is Hue Markdown?

Hue Markdown ("Hue") is a strict superset of [CommonMark 0.31.2]
that adds:

1. **Spans**: colored text and background shades, `{red: like this}`.
2. **Boxes**: blocks whose border is drawn in the source with
   box-drawing or ASCII characters.
3. **Hue fences**: a fenced code block with the info string `hue`,
   whose content is rendered as Hue Markdown.
4. **Diff spans**: inserted and removed text, `{+: added}` and
   `{-: removed}`.
5. **Key caps**: keyboard keys and shortcuts, `[[Ctrl+C]]`.
6. **Progress bars**: `[======....] 60%`.
7. **Tasks** with more states than done and to do: `- [-]` in
   progress, `- [!]` blocked, `- [?]` question.
8. **Side-by-side boxes**: boxes drawn next to each other become
   columns.

Hue's main design rule is that **the source must stay readable when
it is not rendered.** Every construct in this document was chosen
because it still looks like what it means in plain text.

[CommonMark 0.31.2]: https://spec.commonmark.org/0.31.2/

## Files

Hue documents use the file extension `.hue.md`, for example
`notes.hue.md`. Because the name ends in `.md`, tools that do not know
Hue treat the file as ordinary Markdown. The media type is
`text/markdown; variant=hue`.

## Conformance

A conforming implementation:

1. renders every CommonMark 0.31.2 example exactly as it would without
   Hue (Hue adds syntax, it never changes the meaning of existing
   CommonMark), and
2. renders every example in this document as shown.

## About the examples

Examples are written as in the CommonMark spec: Markdown source on the
left (above the `.`), and the expected HTML on the right (below it).
The HTML assumes a CommonMark-compliant renderer with raw HTML enabled.
Renderers for other targets (terminal, plain text) must produce
output with the same structure; see [Rendering](#rendering).

# Tokens

A **style** is a list of one or more **tokens** separated by spaces.
Styles appear in spans (`{red bg-yellow: …}`) and in box labels
(`┌─ red Title ─┐`). Tokens are case-sensitive.

## Colors

There are seven **colors**:

| Token    | Meaning |
|----------|---------|
| `red`    | red     |
| `orange` | orange  |
| `yellow` | yellow  |
| `green`  | green   |
| `blue`   | blue    |
| `purple` | purple  |
| `gray`   | gray    |

## Semantic aliases

**Aliases** name what text *means*. Each alias maps to one color.
Authors should prefer aliases, because they let renderers add meaning
beyond color (an icon or an accessible label) and keep documents
consistent.

| Token    | Color    | Use for |
|----------|----------|---------|
| `danger` | `red`    | errors, destructive actions, hard warnings |
| `!`      | `red`    | short form of `danger` |
| `warn`   | `orange` | cautions |
| `ok`     | `green`  | success, passing, done |
| `info`   | `blue`   | neutral information |
| `note`   | `purple` | asides, remarks |
| `muted`  | `gray`   | de-emphasized text |

Aliases render exactly like their color: `{ok: x}` produces the same
output as `{green: x}`.

## Backgrounds

`bg-` followed by a color or alias is a **background token**, e.g.
`bg-yellow` or `bg-warn`.

## Hex colors

`#rgb` or `#rrggbb` (hexadecimal digits, either case) is a **hex text
color**. `bg-#rgb` or `bg-#rrggbb` is a **hex background**. Hex
colors are an escape hatch: they ignore the theme and are not checked
for contrast, so authors should prefer the palette. Any other `#…`
value is not a token.

## Combining tokens

A style holds at most one text color and one background. If a style
names several text colors (or several backgrounds), the last one
wins. A palette color and a hex color of the same kind also replace
each other, so the last one still wins.

If **any** word in a style is not a token, the whole style is
invalid, and the construct that contains it is not recognized.

# Spans

## Syntax

A **span** is:

1. a `{`,
2. a style, written on one line, at most 64 characters,
3. a `:`,
4. optional spaces (ignored),
5. the **content**: one or more characters of inline Markdown,
6. the `}` that matches the opening `{`.

Braces are matched like parentheses: each `{` is paired with the next
unpaired `}`. Backslash-escaped braces (`\{`, `\}`) do not count. The
content is parsed as inline Markdown and may contain other spans.

**Precedence.** Code spans, autolinks and raw HTML tags bind more
tightly than spans, exactly as they bind more tightly than link text
in CommonMark: braces inside them do not count. Spans bind more
tightly than links and emphasis: braces are matched before links and
emphasis are parsed, so neither can cross a span boundary. A `}`
inside a link destination therefore closes the span; escape it as
`\}` or percent-encode it as `%7D`.

## Basic spans

A color:

```````````````````````````````` example
{red: stop}
.
<p><span class="hue hue-red">stop</span></p>
````````````````````````````````

An alias renders like its color:

```````````````````````````````` example
Build {ok: passing}, deploy {!: blocked}.
.
<p>Build <span class="hue hue-green">passing</span>, deploy <span class="hue hue-red">blocked</span>.</p>
````````````````````````````````

All aliases:

```````````````````````````````` example
{danger: a} {warn: b} {ok: c} {info: d} {note: e} {muted: f}
.
<p><span class="hue hue-red">a</span> <span class="hue hue-orange">b</span> <span class="hue hue-green">c</span> <span class="hue hue-blue">d</span> <span class="hue hue-purple">e</span> <span class="hue hue-gray">f</span></p>
````````````````````````````````

A background:

```````````````````````````````` example
{bg-yellow: highlighted}
.
<p><span class="hue hue-bg-yellow">highlighted</span></p>
````````````````````````````````

A background alias:

```````````````````````````````` example
{bg-warn: careful}
.
<p><span class="hue hue-bg-orange">careful</span></p>
````````````````````````````````

Text color and background together:

```````````````````````````````` example
{blue bg-gray: both}
.
<p><span class="hue hue-blue hue-bg-gray">both</span></p>
````````````````````````````````

When a style names two text colors, the last one wins:

```````````````````````````````` example
{red blue: x}
.
<p><span class="hue hue-blue">x</span></p>
````````````````````````````````

Palette and hex colors replace each other too:

```````````````````````````````` example
{#fff red: x} {red #fff: y}
.
<p><span class="hue hue-red">x</span> <span class="hue" style="color:#fff">y</span></p>
````````````````````````````````

## Spacing

The space after the colon is optional, and extra spaces are ignored:

```````````````````````````````` example
{red:tight} {red:   loose}
.
<p><span class="hue hue-red">tight</span> <span class="hue hue-red">loose</span></p>
````````````````````````````````

Spaces around tokens are allowed:

```````````````````````````````` example
{ ! : alert}
.
<p><span class="hue hue-red">alert</span></p>
````````````````````````````````

## Hex colors

```````````````````````````````` example
{#c0ffee: mint} {bg-#333: dark} {#C0FFEE bg-#000000: both}
.
<p><span class="hue" style="color:#c0ffee">mint</span> <span class="hue" style="background:#333">dark</span> <span class="hue" style="color:#C0FFEE;background:#000000">both</span></p>
````````````````````````````````

Hex colors must have 3 or 6 digits. Anything else is not a token,
so the span is not recognized:

```````````````````````````````` example
{#ffff: four} {#ggg: letters} {#fff;color:red: injection}
.
<p>{#ffff: four} {#ggg: letters} {#fff;color:red: injection}</p>
````````````````````````````````

## Content

Content is inline Markdown:

```````````````````````````````` example
{red: **bold** and `code` and [a link](/url)}
.
<p><span class="hue hue-red"><strong>bold</strong> and <code>code</code> and <a href="/url">a link</a></span></p>
````````````````````````````````

Spans nest:

```````````````````````````````` example
{red: outer {blue: inner} outer}
.
<p><span class="hue hue-red">outer <span class="hue hue-blue">inner</span> outer</span></p>
````````````````````````````````

A `}` inside a code span does not close the span:

```````````````````````````````` example
{red: use `}` here}
.
<p><span class="hue hue-red">use <code>}</code> here</span></p>
````````````````````````````````

An escaped brace does not close the span:

```````````````````````````````` example
{red: a \} b}
.
<p><span class="hue hue-red">a } b</span></p>
````````````````````````````````

Balanced braces in the content are kept:

```````````````````````````````` example
{red: f(x) = {x}}
.
<p><span class="hue hue-red">f(x) = {x}</span></p>
````````````````````````````````

Content may continue on the next line of the same paragraph:

```````````````````````````````` example
{red: first line
second line}
.
<p><span class="hue hue-red">first line
second line</span></p>
````````````````````````````````

## Precedence

Emphasis cannot cross a span boundary:

```````````````````````````````` example
{red: *a} b*
.
<p><span class="hue hue-red">*a</span> b*</p>
````````````````````````````````

Emphasis around a span is fine:

```````````````````````````````` example
*{red: a}*
.
<p><em><span class="hue hue-red">a</span></em></p>
````````````````````````````````

A span inside link text:

```````````````````````````````` example
[{red: go}](/url)
.
<p><a href="/url"><span class="hue hue-red">go</span></a></p>
````````````````````````````````

Code spans bind more tightly than spans:

```````````````````````````````` example
`{red: x}`
.
<p><code>{red: x}</code></p>
````````````````````````````````

Braces inside autolinks and raw HTML do not count either:

```````````````````````````````` example
{red: <https://example.com/}> and <b title="}">bold</b>}
.
<p><span class="hue hue-red"><a href="https://example.com/%7D">https://example.com/}</a> and <b title="}">bold</b></span></p>
````````````````````````````````

A span that starts inside link text and does not end there takes the
closing bracket with it, so the link is not recognized:

```````````````````````````````` example
[a {red: b](/url) c}
.
<p>[a <span class="hue hue-red">b](/url) c</span></p>
````````````````````````````````

A `}` inside a link destination closes the span:

```````````````````````````````` example
{red: [x](/a}) y}
.
<p><span class="hue hue-red">[x](/a</span>) y}</p>
````````````````````````````````

Escape it to keep the link inside the span:

```````````````````````````````` example
{red: [x](/a\}) y}
.
<p><span class="hue hue-red"><a href="/a%7D">x</a> y</span></p>
````````````````````````````````

Spans are not recognized in code blocks:

```````````````````````````````` example
    {red: x}
.
<pre><code>{red: x}
</code></pre>
````````````````````````````````

## Not a span

Ordinary text that looks a bit like a span stays as written. A word
that is not a token makes the whole style invalid:

```````````````````````````````` example
{a: 1} {key: value} {Red: x} {red reddish: x}
.
<p>{a: 1} {key: value} {Red: x} {red reddish: x}</p>
````````````````````````````````

No colon:

```````````````````````````````` example
{red} {red x}
.
<p>{red} {red x}</p>
````````````````````````````````

Empty content:

```````````````````````````````` example
{red:} {red: }
.
<p>{red:} {red: }</p>
````````````````````````````````

No matching `}`:

```````````````````````````````` example
{red: never closed
.
<p>{red: never closed</p>
````````````````````````````````

An escaped opening brace:

```````````````````````````````` example
\{red: x}
.
<p>{red: x}</p>
````````````````````````````````

A style may not span lines:

```````````````````````````````` example
{red
blue: x}
.
<p>{red
blue: x}</p>
````````````````````````````````

# Boxes

## Syntax

A **box** is a block made of three parts:

1. A **top border**: a corner (`┌`, `╭` or `+`), one or more
   horizontal characters (`─` or `-`), and an optional **label**. An
   optional closing corner (`┐`, `╮` or `+`) may be included after optional
   horizontal characters. If a closing corner is present, it must match
   the family of the opening corner (a `+` starts and ends with `+`;
   `┌` or `╭` end with `┐` or `╮`).
2. Zero or more **interior lines**, each starting with a side border
   (`│` or `|`). The right side border is optional.
3. A **bottom border**: a corner (`└`, `╰` or `+`), and one or more
   horizontal characters (`─` or `-`). An optional closing corner (`┘`,
   `╯` or `+`) may be included at the end.

The top border may be indented by up to three spaces (four or more
make it an indented code block). Spaces before the other lines are
ignored, as are trailing spaces.

The **label** has two parts: as many leading words as are valid
tokens form the box's **style**, and the remaining words form its
**title**. A label word that comes after the title starts is part of
the title, even if it is a token.

The **interior** is the content of the interior lines, with the left
side border, one following space (if present), the right side border
and trailing spaces removed. It is parsed as a sequence of blocks,
like the content of a block quote.

If any line between the top border and the bottom border does not
start with a side border, or there is no bottom border, the lines do
not form a box and are parsed as ordinary Markdown.

A box can interrupt a paragraph.

## Basic boxes

```````````````````````````````` example
┌─ info ──────────┐
│ Hello, **box**. │
└─────────────────┘
.
<div class="hue-box hue-box-blue" role="note">
<p>Hello, <strong>box</strong>.</p>
</div>
````````````````````````````````

A style and a title:

```````````````````````````````` example
┌─ ! Never commit secrets ─┐
│ Keep `.env` out of git.  │
└──────────────────────────┘
.
<div class="hue-box hue-box-red" role="note">
<div class="hue-box-title">Never commit secrets</div>
<p>Keep <code>.env</code> out of git.</p>
</div>
````````````````````````````````

A title without a style gives a neutral box:

```````````````````````````````` example
┌─ Notes ───┐
│ Plain box │
└───────────┘
.
<div class="hue-box" role="note">
<div class="hue-box-title">Notes</div>
<p>Plain box</p>
</div>
````````````````````````````````

No label at all:

```````````````````````````````` example
┌───────┐
│ quiet │
└───────┘
.
<div class="hue-box" role="note">
<p>quiet</p>
</div>
````````````````````````````````

Once the title has started, tokens are part of the title:

```````````````````````````````` example
┌─ Ready ok ─┐
│ x          │
└────────────┘
.
<div class="hue-box" role="note">
<div class="hue-box-title">Ready ok</div>
<p>x</p>
</div>
````````````````````````````````

Box styles use palette tokens only. A hex word starts the title:

```````````````````````````````` example
┌─ #f00 Hot ─┐
│ x          │
└────────────┘
.
<div class="hue-box" role="note">
<div class="hue-box-title">#f00 Hot</div>
<p>x</p>
</div>
````````````````````````````````

Inline Markdown in the title:

```````````````````````````````` example
┌─ warn Read *this* ─┐
│ x                  │
└────────────────────┘
.
<div class="hue-box hue-box-orange" role="note">
<div class="hue-box-title">Read <em>this</em></div>
<p>x</p>
</div>
````````````````````````````````

## Border styles

ASCII:

```````````````````````````````` example
+-- ok Saved --+
| All good.    |
+--------------+
.
<div class="hue-box hue-box-green" role="note">
<div class="hue-box-title">Saved</div>
<p>All good.</p>
</div>
````````````````````````````````

Rounded corners:

```````````````````````````````` example
╭─ note ──╮
│ Rounded │
╰─────────╯
.
<div class="hue-box hue-box-purple" role="note">
<p>Rounded</p>
</div>
````````````````````````````````

The right side border is optional, and borders need not line up:

```````````````````````````````` example
┌─ blue ─────┐
│ ragged
│ edges are fine │
└──┘
.
<div class="hue-box hue-box-blue" role="note">
<p>ragged
edges are fine</p>
</div>
````````````````````````````````

Minimal open borders without right corners are also supported for effortless typing:

```````````````````````````````` example
+-- info Pro Tip
| First point
| Second point
+--
.
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Pro Tip</div>
<p>First point
Second point</p>
</div>
````````````````````````````````

Mixed corner families in the top border are not a box:

```````````````````````````````` example
┌─ red ─+
│ x
└───────┘
.
<p>┌─ red ─+
│ x
└───────┘</p>
````````````````````````````````

## Interior

The interior holds any blocks:

```````````````````````````````` example
┌─ green ─────────┐
│ Steps:          │
│                 │
│ 1. Build        │
│ 2. Test         │
│                 │
│ ```sh           │
│ npm test        │
│ ```             │
└─────────────────┘
.
<div class="hue-box hue-box-green" role="note">
<p>Steps:</p>
<ol>
<li>Build</li>
<li>Test</li>
</ol>
<pre><code class="language-sh">npm test
</code></pre>
</div>
````````````````````````````````

Each interior line shows on its own line, also inside a paragraph.
In HTML the lines stay one paragraph joined by a newline, and the
reference stylesheet sets `white-space: pre-line` on box paragraphs so
the browser shows that newline as a line break. The GFM downgrade
writes a hard line break (two trailing spaces) and terminals keep the
lines as drawn. So `│ one` and `│ two` render as one `<p>` that
holds both lines and displays them as two lines.

Boxes nest:

```````````````````````````````` example
┌─ blue ───────┐
│ ┌─ red ──┐   │
│ │ inner  │   │
│ └────────┘   │
└──────────────┘
.
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box hue-box-red" role="note">
<p>inner</p>
</div>
</div>
````````````````````````````````

An empty box:

```````````````````````````````` example
┌─ gray ─┐
└────────┘
.
<div class="hue-box hue-box-gray" role="note"></div>
````````````````````````````````

## Context

A box interrupts a paragraph:

```````````````````````````````` example
Before
┌─ ok ─┐
│ x    │
└──────┘
After
.
<p>Before</p>
<div class="hue-box hue-box-green" role="note">
<p>x</p>
</div>
<p>After</p>
````````````````````````````````

A box inside a list item:

```````````````````````````````` example
- item

  ┌─ ok ─┐
  │ x    │
  └──────┘
.
<ul>
<li>
<p>item</p>
<div class="hue-box hue-box-green" role="note">
<p>x</p>
</div>
</li>
</ul>
````````````````````````````````

A box inside a block quote:

```````````````````````````````` example
> ┌─ info ─┐
> │ quoted │
> └────────┘
.
<blockquote>
<div class="hue-box hue-box-blue" role="note">
<p>quoted</p>
</div>
</blockquote>
````````````````````````````````

Indented four spaces, it is a code block:

```````````````````````````````` example
    ┌─ red ─┐
    │ x     │
    └───────┘
.
<pre><code>┌─ red ─┐
│ x     │
└───────┘
</code></pre>
````````````````````````````````

## Not a box

No bottom border:

```````````````````````````````` example
┌─ red ─┐
│ open
.
<p>┌─ red ─┐
│ open</p>
````````````````````````````````

A line without a side border:

```````````````````````````````` example
┌─ red ─┐
│ one
two
└───────┘
.
<p>┌─ red ─┐
│ one
two
└───────┘</p>
````````````````````````````````

A top border without corners:

```````````````````````````````` example
── red ──
│ x
└───────┘
.
<p>── red ──
│ x
└───────┘</p>
````````````````````````````````

# Hue fences

Plain Markdown joins consecutive lines into one paragraph, which
garbles a drawn box on platforms that don't support Hue. A fenced
code block whose info string's first word is `hue` keeps its content
as monospace text on those platforms. Hue renders the content as Hue
Markdown, as if the fence were not there.

```````````````````````````````` example
```hue
┌─ ok ─┐
│ yes  │
└──────┘
```
.
<div class="hue-box hue-box-green" role="note">
<p>yes</p>
</div>
````````````````````````````````

Tilde fences and extra words in the info string work too:

```````````````````````````````` example
~~~ hue portable
{red: x}
~~~
.
<p><span class="hue hue-red">x</span></p>
````````````````````````````````

Other fences are ordinary code blocks:

```````````````````````````````` example
```md
{red: x}
```
.
<pre><code class="language-md">{red: x}
</code></pre>
````````````````````````````````

# Diff spans

A diff span marks inserted or removed text. It is a span whose style
is the single token `+` (inserted) or `-` (removed), and it follows
every span rule above: brace matching, Markdown inside, code spans and
escapes.

- `{+: content}` renders as `<ins class="hue hue-diff-add">content</ins>`.
- `{-: content}` renders as `<del class="hue hue-diff-del">content</del>`.

Basic inline addition and deletion:

```````````````````````````````` example
v0.2: {+: Added slide mode}, {-: Removed legacy flag}.
.
<p>v0.2: <ins class="hue hue-diff-add">Added slide mode</ins>, <del class="hue hue-diff-del">Removed legacy flag</del>.</p>
````````````````````````````````

Nested Markdown and Hue spans inside diff spans:

```````````````````````````````` example
{+: Enable **fast** `O(n)` scanning} and {-: drop *slow* path}.
.
<p><ins class="hue hue-diff-add">Enable <strong>fast</strong> <code>O(n)</code> scanning</ins> and <del class="hue hue-diff-del">drop <em>slow</em> path</del>.</p>
````````````````````````````````

Braces inside code spans do not close a diff span:

```````````````````````````````` example
{+: Added `fn() { return 1 }` helper}
.
<p><ins class="hue hue-diff-add">Added <code>fn() { return 1 }</code> helper</ins></p>
````````````````````````````````

Escaped or empty diff spans stay literal text:

```````````````````````````````` example
\{+: literal} and {+:} and {-: unclosed
.
<p>{+: literal} and {+:} and {-: unclosed</p>
````````````````````````````````

# Key caps

`[[Key]]` renders as `<kbd class="hue-kbd">Key</kbd>` when `Key` is a
keyboard key or a chord of keys joined by `+`:

1. **Named keys** (case-insensitive): `Ctrl`, `Control`, `Shift`, `Alt`, `Option`, `Opt`, `Cmd`, `Command`, `Super`, `Meta`, `Win`, `Fn`, `Enter`, `Return`, `Esc`, `Escape`, `Tab`, `Space`, `Spacebar`, `Backspace`, `Bksp`, `Delete`, `Del`, `Insert`, `Ins`, `Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PgUp`, `PageUp`, `PgDn`, `PageDown`, `CapsLock`, `Caps`, `NumLock`, `ScrollLock`, `PrtSc`, `PrintScreen`, `Pause`, `Break`, `Menu`, `Clear`, `F1`–`F24`.
2. **Single uppercase letter or key symbol**: `A`–`Z`, `/`, `?`, `+`, `-`, `=`, `~`, `⌘`, `⌥`, `⇧`, `⌃`, `⏎`, `⌫`, `⇥`, `⎋`, `↑`, `↓`, `←`, `→`.
3. **Key chords** joined by `+`: e.g., `[[Ctrl+C]]`, `[[Cmd+Shift+P]]`, `[[Alt+F4]]`, `[[Ctrl+1]]`, `[[Ctrl++]]`.

Anything else between `[[` and `]]` stays literal text: wiki links
(`[[Project Roadmap]]`), unknown words, lowercase single letters and
digits (`[[a]]`, `[[0]]`). So does `[[` directly after a letter, a digit
or a bracket (`arr[[0]]`), and `[[Key]]` directly followed by `]` or
`(`. A key cap is at most 32 characters.

Individual keys separated by text:

```````````````````````````````` example
Press [[Ctrl]] + [[Shift]] + [[P]] to open the palette.
.
<p>Press <kbd class="hue-kbd">Ctrl</kbd> + <kbd class="hue-kbd">Shift</kbd> + <kbd class="hue-kbd">P</kbd> to open the palette.</p>
````````````````````````````````

Combined chord inside a single keycap:

```````````````````````````````` example
Use [[Cmd+Shift+P]] or [[Alt+F4]] or [[Ctrl++]].
.
<p>Use <kbd class="hue-kbd">Cmd+Shift+P</kbd> or <kbd class="hue-kbd">Alt+F4</kbd> or <kbd class="hue-kbd">Ctrl++</kbd>.</p>
````````````````````````````````

Navigation, function, and symbol keys:

```````````````````````````````` example
Hit [[Esc]], [[Enter]], [[Tab]], [[F5]], or [[?]].
.
<p>Hit <kbd class="hue-kbd">Esc</kbd>, <kbd class="hue-kbd">Enter</kbd>, <kbd class="hue-kbd">Tab</kbd>, <kbd class="hue-kbd">F5</kbd>, or <kbd class="hue-kbd">?</kbd>.</p>
````````````````````````````````

WikiLinks and unknown words are never touched:

```````````````````````````````` example
See [[Project Roadmap]] and [[internal_doc]] for details.
.
<p>See [[Project Roadmap]] and [[internal_doc]] for details.</p>
````````````````````````````````

Array indexing and lowercase/digit tokens stay untouched:

```````````````````````````````` example
Matrix value `a[[0]]` or [[0]] or [[a]] or [[1, 2]].
.
<p>Matrix value <code>a[[0]]</code> or [[0]] or [[a]] or [[1, 2]].</p>
````````````````````````````````

Backslash-escaped keycaps stay literal:

```````````````````````````````` example
Literal \[[Ctrl]] keycap.
.
<p>Literal [[Ctrl]] keycap.</p>
````````````````````````````````

# Progress bars

`[bar] NN%` renders as a progress bar:

1. **Bar characters**: `4` to `40` total characters inside `[...]`, consisting of `0..40` filled characters (`=`, `#`, `■`, `█`) followed by `0..40` empty characters (`.`, `-`, `_`, `░`, ` `), with at least one non-space character.
2. **Percentage**: Followed by optional whitespace and an integer `0`–`100` with `%`.
3. **Color thresholds**:
   - `100%` -> `green` (`hue-progress-green`)
   - `50%`–`99%` -> `blue` (`hue-progress-blue`)
   - `25%`–`49%` -> `orange` (`hue-progress-orange`)
   - `0%`–`24%` -> `red` (`hue-progress-red`)

The bar must not directly follow `[` and the percentage must not be
directly followed by `(` or `[`, so links and nested brackets keep
their meaning.

All four automatic color tiers:

```````````````````````````````` example
Done: [==========] 100%
Active: [======....] 60%
Warmup: [===.......] 30%
Low: [=.........] 10%
.
<p>Done: <span class="hue-progress hue-progress-green" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:100%"></span></span><span class="hue-progress-label">100%</span></span>
Active: <span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:60%"></span></span><span class="hue-progress-label">60%</span></span>
Warmup: <span class="hue-progress hue-progress-orange" role="progressbar" aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:30%"></span></span><span class="hue-progress-label">30%</span></span>
Low: <span class="hue-progress hue-progress-red" role="progressbar" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:10%"></span></span><span class="hue-progress-label">10%</span></span></p>
````````````````````````````````

Zero percent progress bar:

```````````````````````````````` example
Queued: [..........] 0%
.
<p>Queued: <span class="hue-progress hue-progress-red" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:0%"></span></span><span class="hue-progress-label">0%</span></span></p>
````````````````````````````````

Hash and Unicode block characters also work:

```````````````````````````````` example
Build: [####----] 50%
.
<p>Build: <span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:50%"></span></span><span class="hue-progress-label">50%</span></span></p>
````````````````````````````````

Brackets without a trailing percentage or shorter than 4 bar chars stay literal:

```````````````````````````````` example
Not a bar: [====] and [==] 50% and [====] 150%.
.
<p>Not a bar: [====] and [==] 50% and [====] 150%.</p>
````````````````````````````````

# Tasks

A list item whose text starts with a marker in brackets, followed by
at least one space, is a task. Tasks extend the GitHub task list
(`[ ]` and `[x]`) with three more states:

| Marker | State | Color | HTML symbol |
|--------|-------|-------|-------------|
| `[ ]` | `todo` | `gray` | `&#9744;` (☐) |
| `[-]` | `progress` | `blue` | `&#9680;` (◐) |
| `[!]` | `blocked` | `red` | `!` |
| `[?]` | `question` | `purple` | `?` |
| `[x]` or `[X]` | `done` | `green` | `&#10003;` (✓) |

The item gets the classes `hue-task hue-task-<state>`, its list gets
`hue-task-list`, and the item starts with
`<span class="hue-task-box hue-task-box-<state>" aria-hidden="true">`
holding the HTML symbol.

```````````````````````````````` example
- [ ] Write parser tests
- [-] Implement split boxes
- [!] Fix regression bug
- [?] Confirm keycap list
- [x] Ship ACC suite
.
<ul class="hue-task-list">
<li class="hue-task hue-task-todo"><span class="hue-task-box hue-task-box-todo" aria-hidden="true">&#9744;</span> Write parser tests</li>
<li class="hue-task hue-task-progress"><span class="hue-task-box hue-task-box-progress" aria-hidden="true">&#9680;</span> Implement split boxes</li>
<li class="hue-task hue-task-blocked"><span class="hue-task-box hue-task-box-blocked" aria-hidden="true">!</span> Fix regression bug</li>
<li class="hue-task hue-task-question"><span class="hue-task-box hue-task-box-question" aria-hidden="true">?</span> Confirm keycap list</li>
<li class="hue-task hue-task-done"><span class="hue-task-box hue-task-box-done" aria-hidden="true">&#10003;</span> Ship ACC suite</li>
</ul>
````````````````````````````````

Uppercase `[X]` maps to the `done` state:

```````````````````````````````` example
1. [X] First milestone
.
<ol class="hue-task-list">
<li class="hue-task hue-task-done"><span class="hue-task-box hue-task-box-done" aria-hidden="true">&#10003;</span> First milestone</li>
</ol>
````````````````````````````````

Inline formatting and Hue spans work inside task items:

```````````````````````````````` example
- [!] Resolve {red: critical} **build** error
.
<ul class="hue-task-list">
<li class="hue-task hue-task-blocked"><span class="hue-task-box hue-task-box-blocked" aria-hidden="true">!</span> Resolve <span class="hue hue-red">critical</span> <strong>build</strong> error</li>
</ul>
````````````````````````````````

Unknown marker characters or missing trailing spaces stay literal text:

```````````````````````````````` example
- [a] Not a task state
- [x]No space after bracket
.
<ul>
<li>[a] Not a task state</li>
<li>[x]No space after bracket</li>
</ul>
````````````````````````````````

A defined CommonMark shortcut reference link `[x]` takes precedence over task markers:

```````````````````````````````` example
- [x] linked item

[x]: /done
.
<ul>
<li><a href="/done">x</a> linked item</li>
</ul>
````````````````````````````````

# Side-by-side boxes

Boxes on the same lines, separated by at least two spaces, form a row
of columns (`<div class="hue-columns hue-columns-N">`):

1. **Top row**: Every column must start with a valid Hue box top border (`+--`, `┌─`, `╭─`) preceded by at least two spaces after the previous column.
2. **Interior rows**: Each column slice `[col_k, col_{k+1})` must start with a side border (`|` or `│`), a bottom border (`+--`, `└──`, `╰──`), or blank padding after that column's bottom border.
3. **Bottom closure**: All columns must close with a valid bottom border. If any column is unclosed or invalid, the block falls back without matching.

Every line is cut into columns at the positions where the boxes start
on the top line, so the columns must line up.

Two open ASCII boxes side by side:

```````````````````````````````` example
+-- ok Good practice          +-- warn Bad practice
| Return early on error.      | Deeply nest conditionals.
| Keep state immutable.       | Mutate shared globals.
+--                           +--
.
<div class="hue-columns hue-columns-2">
<div class="hue-box hue-box-green" role="note">
<div class="hue-box-title">Good practice</div>
<p>Return early on error.
Keep state immutable.</p>
</div>
<div class="hue-box hue-box-orange" role="note">
<div class="hue-box-title">Bad practice</div>
<p>Deeply nest conditionals.
Mutate shared globals.</p>
</div>
</div>
````````````````````````````````

Closed Unicode boxes side by side:

```````````````````````````````` example
┌─ blue Client ─────┐  ┌─ purple Server ───┐
│ Sends **JSON**    │  │ Validates schema  │
└───────────────────┘  └───────────────────┘
.
<div class="hue-columns hue-columns-2">
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Client</div>
<p>Sends <strong>JSON</strong></p>
</div>
<div class="hue-box hue-box-purple" role="note">
<div class="hue-box-title">Server</div>
<p>Validates schema</p>
</div>
</div>
````````````````````````````````

Three columns side by side:

```````````````````````````````` example
+-- info Plan    +-- warn Build   +-- ok Ship
| Draft spec     | Run tests      | Tag release
+--              +--              +--
.
<div class="hue-columns hue-columns-3">
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Plan</div>
<p>Draft spec</p>
</div>
<div class="hue-box hue-box-orange" role="note">
<div class="hue-box-title">Build</div>
<p>Run tests</p>
</div>
<div class="hue-box hue-box-green" role="note">
<div class="hue-box-title">Ship</div>
<p>Tag release</p>
</div>
</div>
````````````````````````````````

Columns of unequal height (one column closes earlier than the other):

```````````````````````````````` example
+-- ok Short     +-- info Longer
| One line       | First line
+--              | Second line
                 +--
.
<div class="hue-columns hue-columns-2">
<div class="hue-box hue-box-green" role="note">
<div class="hue-box-title">Short</div>
<p>One line</p>
</div>
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Longer</div>
<p>First line
Second line</p>
</div>
</div>
````````````````````````````````

# Combining constructs

All constructs work inside boxes, side-by-side boxes, lists and links,
and never inside code:

```````````````````````````````` example
+-- info Keyboard & Progress
| Press [[Ctrl+K]] to run:
| [========..] 80%
| - [x] {+: Ready}
+--
.
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Keyboard &amp; Progress</div>
<p>Press <kbd class="hue-kbd">Ctrl+K</kbd> to run:
<span class="hue-progress hue-progress-blue" role="progressbar" aria-valuenow="80" aria-valuemin="0" aria-valuemax="100"><span class="hue-progress-track"><span class="hue-progress-fill" style="width:80%"></span></span><span class="hue-progress-label">80%</span></span></p>
<ul class="hue-task-list">
<li class="hue-task hue-task-done"><span class="hue-task-box hue-task-box-done" aria-hidden="true">&#10003;</span> <ins class="hue hue-diff-add">Ready</ins></li>
</ul>
</div>
````````````````````````````````

````hue` fenced blocks render all ACC features:

```````````````````````````````` example
```hue
- [-] {+: Deploying} with [[Ctrl+Enter]]
```
.
<ul class="hue-task-list">
<li class="hue-task hue-task-progress"><span class="hue-task-box hue-task-box-progress" aria-hidden="true">&#9680;</span> <ins class="hue hue-diff-add">Deploying</ins> with <kbd class="hue-kbd">Ctrl+Enter</kbd></li>
</ul>
````````````````````````````````

Other code fences never parse ACC syntax:

```````````````````````````````` example
```txt
- [!] [[Ctrl+C]] {+: raw} [=====.....] 50%
```
.
<pre><code class="language-txt">- [!] [[Ctrl+C]] {+: raw} [=====.....] 50%
</code></pre>
````````````````````````````````

Inline code spans never parse ACC syntax:

```````````````````````````````` example
Code: `[[Ctrl]]`, `{+: add}`, `[====....] 60%`.
.
<p>Code: <code>[[Ctrl]]</code>, <code>{+: add}</code>, <code>[====....] 60%</code>.</p>
````````````````````````````````

Keycaps and diff spans work inside link text:

```````````````````````````````` example
[Press [[Enter]] to {+: continue}](/start)
.
<p><a href="/start">Press <kbd class="hue-kbd">Enter</kbd> to <ins class="hue hue-diff-add">continue</ins></a></p>
````````````````````````````````

Split boxes containing tasks and diff spans:

```````````````````````````````` example
+-- ! Before              +-- ok After
| - [!] {-: Slow regex}   | - [x] {+: Linear scan}
+--                       +--
.
<div class="hue-columns hue-columns-2">
<div class="hue-box hue-box-red" role="note">
<div class="hue-box-title">Before</div>
<ul class="hue-task-list">
<li class="hue-task hue-task-blocked"><span class="hue-task-box hue-task-box-blocked" aria-hidden="true">!</span> <del class="hue hue-diff-del">Slow regex</del></li>
</ul>
</div>
<div class="hue-box hue-box-green" role="note">
<div class="hue-box-title">After</div>
<ul class="hue-task-list">
<li class="hue-task hue-task-done"><span class="hue-task-box hue-task-box-done" aria-hidden="true">&#10003;</span> <ins class="hue hue-diff-add">Linear scan</ins></li>
</ul>
</div>
</div>
````````````````````````````````

Single box with spaces in its title is never mistaken for split columns:

```````````````````````````````` example
+-- info Release   Notes
| Single column box.
+--
.
<div class="hue-box hue-box-blue" role="note">
<div class="hue-box-title">Release Notes</div>
<p>Single column box.</p>
</div>
````````````````````````````````

# Rendering

## HTML

| Construct | Element | Classes and attributes |
|-----------|---------|------------------------|
| span | `span` | `hue`, then `hue-<color>` for the text color and `hue-bg-<color>` for the background. Aliases are written as their color |
| span with hex colors | `span` | `hue` plus a `style` attribute with `color:` and/or `background:` |
| box | `div` | `hue-box`, plus `hue-box-<color>` when the style has a text color (or else a background color); `role="note"` |
| box title | `div` | `hue-box-title`, the first child of the box |
| side-by-side boxes | `div` | `hue-columns hue-columns-<N>` around the `N` boxes |
| diff span | `ins` / `del` | `hue hue-diff-add` / `hue hue-diff-del` |
| key cap | `kbd` | `hue-kbd` |
| progress bar | `span` | `hue-progress hue-progress-<color>`, `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`; holds `span.hue-progress-track > span.hue-progress-fill` (`style="width:N%"`) and `span.hue-progress-label` |
| task | `li` | `hue-task hue-task-<state>`, starting with `span.hue-task-box.hue-task-box-<state>` (`aria-hidden="true"`); its list gets `hue-task-list` |

The reference stylesheet maps each color to a text color and a
background shade for light and dark themes. Every pair meets WCAG 2.x
AA contrast (4.5:1): colored text on the page, body text on each
background shade, and colored text on its own shade.

## Other targets

- **Plain text and Markdown without Hue:** a span becomes its content;
  a box keeps its title and content. A *downgrade* to GitHub Flavored
  Markdown may map boxes to alerts (`> [!NOTE]`, `> [!WARNING]`).
- **Terminals:** spans become ANSI colors; boxes are drawn with
  box-drawing characters.
- Renderers must not use color as the only signal for `danger` and
  `warn` where they can add text or an icon.

# Appendix: palette

| Color  | Light text | Light shade | Dark text | Dark shade |
|--------|------------|-------------|-----------|------------|
| red    | `#b42318`  | `#fde8e7`   | `#ff7b72` | `#3d1614`  |
| orange | `#b54708`  | `#fdeedc`   | `#ffa657` | `#3b2410`  |
| yellow | `#7a5a00`  | `#fdf6d3`   | `#e3b341` | `#362b0a`  |
| green  | `#067647`  | `#dcf5e7`   | `#3fb950` | `#0f2e1c`  |
| blue   | `#175cd3`  | `#e0ecfd`   | `#58a6ff` | `#0f2444`  |
| purple | `#6941c6`  | `#efe7fd`   | `#d2a8ff` | `#2a1b45`  |
| gray   | `#57606a`  | `#eef0f2`   | `#8b949e` | `#21262d`  |
