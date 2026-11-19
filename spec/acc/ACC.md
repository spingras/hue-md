---
title: Hue Markdown v0.2 Acceptance Criteria & Spec (ACC)
version: 0.2.0-acc
date: 2026-11-16
status: Promoted to production in Hue MD v0.2.0 (src/). The v0.2 syntax and examples are now in spec/spec.md; this file stays as the record of the acceptance gates.
---

# Hue Markdown v0.2 Acceptance Criteria (ACC)

This document defines the Acceptance Criteria (ACC), grammar rules, target outputs (HTML, CSS, GitHub Flavored Markdown downgrade, and 24-bit ANSI terminal output), and executable test examples for the six Hue Markdown v0.2 features (ACC-1 to ACC-6), plus their composed interactions, before promoting any changes to production (`src/` and editor packages).

## Promotion Gate Checklist (ACC -> PRD)

1. **PRD Isolation**: Zero production files in `src/`, `packages/md-hue/src/`, `packages/vscode-hue/`, or `scripts/render-demo.js` / `scripts/playground-entry.js` are modified during ACC validation.
2. **CommonMark 0.31.2 Superset Gate**: All 652 CommonMark 0.31.2 specification examples render byte-for-byte identically with `hueNext` enabled.
3. **v0.1 Backward Compatibility Gate**: All 58 Hue MD v0.1 specification examples in `spec/spec.md` render identically with `hueNext` enabled.
4. **Executable ACC Spec Gate**: All 30 executable specification examples in this document pass automated verification.
5. **Corpus Safety Gate**: Zero unintended false positives for key caps (`[[...]]`), progress bars (`[===...] NN%`), diff spans (`{+: ...}`, `{-: ...}`), and split boxes across the 200 npm READMEs and 50 LLM responses in `corpus/`. The corpus is not committed (`corpus/` is in `.gitignore`), so this gate runs locally only: run `node scripts/fetch-corpus.js` once, then `npm test`. Without `corpus/`, as in GitHub Actions, the test is reported as skipped.
6. **Pathological Performance Gate**: 20,000 adversarial unclosed tokens (`[[`, `[===`, `{+:`, `{-:`, and 5,000 split box header rows) grow linearly: 4 times the input (5,000 to 20,000 tokens, best of 3 runs) costs less than 10 times the time, and 20,000 tokens render in under 2 seconds. Linear code takes about 4 times as long (measured 3.4 to 5.2 times); quadratic code, the risk this gate guards against, about 16 times. The gate measures growth instead of a fixed number of milliseconds because a fixed 200 ms budget failed at random on slower CI runners.
7. **Downgrade Completeness Gate**: Every ACC construct downgrades cleanly to valid GitHub Flavored Markdown with zero surviving Hue syntax.
8. **Terminal ANSI Gate**: Every ACC construct renders to 24-bit ANSI truecolor without exceeding target line width or leaking SGR escape codes across lines.

---

## ACC-1: Multi-State Tasks & Status Ticks

### Grammar
Inside a bullet or ordered list item, when the first inline text starts with `[marker]` followed by at least one whitespace character (`^\[([ xX\-!?])\]\s+`) and is not a resolved CommonMark reference link:

| Marker | State Name | Palette Color | HTML Symbol | GFM Downgrade | ANSI Marker |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `[ ]` | `todo` | `gray` | `&#9744;` (`☐`) | `- [ ] ...` | `[☐]` (gray) |
| `[-]` | `progress` | `blue` | `&#9680;` (`◐`) | `- [ ] *(in progress)* ...` | `[◐]` (blue) |
| `[!]` | `blocked` | `red` | `!` | `- [ ] **[!]** ...` | `[!]` (red) |
| `[?]` | `question` | `purple` | `?` | `- [ ] **[?]** ...` | `[?]` (purple) |
| `[x]` / `[X]` | `done` | `green` | `&#10003;` (`✔`) | `- [x] ...` | `[✔]` (green) |

### Examples

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

---

## ACC-2: Side-by-Side Split Box Columns

### Grammar
Two or more Hue boxes placed on the same lines and separated by at least two spaces (`  `) form a multi-column box group (`<div class="hue-columns hue-columns-N">`):

1. **Top row**: Every column must start with a valid Hue box top border (`+--`, `┌─`, `╭─`) preceded by at least two spaces after the previous column.
2. **Interior rows**: Each column slice `[col_k, col_{k+1})` must start with a side border (`|` or `│`), a bottom border (`+--`, `└──`, `╰──`), or blank padding after that column's bottom border.
3. **Bottom closure**: All columns must close with a valid bottom border. If any column is unclosed or invalid, the block falls back without matching.

### Examples

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

---

## ACC-3: Native Key Caps (`[[Key]]`)

### Grammar
`[[Key]]` renders as `<kbd class="hue-kbd">Key</kbd>` when `Key` is a recognized keyboard token or chord:

1. **Named keys** (case-insensitive): `Ctrl`, `Control`, `Shift`, `Alt`, `Option`, `Opt`, `Cmd`, `Command`, `Super`, `Meta`, `Win`, `Fn`, `Enter`, `Return`, `Esc`, `Escape`, `Tab`, `Space`, `Spacebar`, `Backspace`, `Bksp`, `Delete`, `Del`, `Insert`, `Ins`, `Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PgUp`, `PageUp`, `PgDn`, `PageDown`, `CapsLock`, `Caps`, `NumLock`, `ScrollLock`, `PrtSc`, `PrintScreen`, `Pause`, `Break`, `Menu`, `Clear`, `F1`–`F24`.
2. **Single uppercase letter or key symbol**: `A`–`Z`, `/`, `?`, `+`, `-`, `=`, `~`, `⌘`, `⌥`, `⇧`, `⌃`, `⏎`, `⌫`, `⇥`, `⎋`, `↑`, `↓`, `←`, `→`.
3. **Key chords** joined by `+`: e.g., `[[Ctrl+C]]`, `[[Cmd+Shift+P]]`, `[[Alt+F4]]`, `[[Ctrl+1]]`, `[[Ctrl++]]`.
4. **False-positive guards**:
   - WikiLinks with spaces or multi-letter unknown words (`[[Project Roadmap]]`, `[[foobar]]`) stay literal text.
   - Lowercase single letters or digits (`[[a]]`, `[[0]]`, `[[1]]`) and indexed expressions (`arr[[0]]`) stay literal text.

### Examples

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

---

## ACC-4: Text Progress & Metric Bars

### Grammar
`[fill+empty] NN%` renders as an accessible progress bar (`role="progressbar"`):

1. **Bar characters**: `4` to `40` total characters inside `[...]`, consisting of `0..40` filled characters (`=`, `#`, `■`, `█`) followed by `0..40` empty characters (`.`, `-`, `_`, `░`, ` `), with at least one non-space character.
2. **Percentage**: Followed by optional whitespace and an integer `0`–`100` with `%`.
3. **Color thresholds**:
   - `100%` -> `green` (`hue-progress-green`)
   - `50%`–`99%` -> `blue` (`hue-progress-blue`)
   - `25%`–`49%` -> `orange` (`hue-progress-orange`)
   - `0%`–`24%` -> `red` (`hue-progress-red`)

### Examples

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

---

## ACC-5: Inline Diff / Change Spans (`{+: ...}`, `{-: ...}`)

### Grammar
- `{+: content}` renders as `<ins class="hue hue-diff-add">content</ins>`.
- `{-: content}` renders as `<del class="hue hue-diff-del">content</del>`.
- Follows all Hue span rules: linear brace matching, inner Markdown parsing, code span protection, and backslash escaping.

### Examples

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

---

## ACC-6: Terminal Slide Deck Mode

### Grammar
`parseSlides(src)` splits a `.hue.md` document into slides; `renderSlides(src, options)` renders them as framed 24-bit ANSI terminal slides. Slides produce terminal output, not HTML, so this section has no executable HTML examples. The unit test `ACC-6: parseSlides splits on top-level ---…` in `test/acc.test.js` verifies the criteria below.

1. **Slide separator**: a line of three or more `-` (up to three spaces of indent) that is preceded by a blank line, a heading, or a box bottom border. A `---` directly under a paragraph line stays a setext heading underline.
2. **Protected regions**: `---` inside fenced code blocks (`` ``` `` or `~~~`) and inside Hue boxes never splits a slide.
3. **Titles**: each slide's title is its first `#`, `##`, or `###` heading, or `Slide N` when it has none.
4. **Frame**: every rendered line is exactly the requested `width` columns wide, and each slide shows a `[ N / total ]` footer.
5. **Single slide**: `renderSlides(src, { slide: N })` renders only slide `N`.

Example deck (three slides; the `---` inside the fence and the box do not split):

```markdown
# Intro Slide
Welcome to Hue.

---

# Code & Box Slide
~~~yaml
---
key: value
~~~
+-- info Note
| ---
+--

---

# Final Slide
- [x] Done
```

---

## Composed Features & Interactions

All ACC features compose inside boxes, split boxes, lists, and tables:

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
