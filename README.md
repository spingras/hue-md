# Hue MD (`.hue.md`)

> **Color and callout boxes for Markdown that still read gracefully as raw text.**

[![Live Playground](https://img.shields.io/badge/Playground-spingras.github.io%2Fhue--md-175cd3)](https://spingras.github.io/hue-md/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](vscode-hue/LICENSE)
[![CommonMark](https://img.shields.io/badge/CommonMark-652%2F652%20Pass-brightgreen)](#built-for-real-world-reliability)
[![FOSS](https://img.shields.io/badge/FOSS-100%25%20Free%20%26%20Open-orange)](#open-source-commitment-foss)
[![Sponsor](https://img.shields.io/badge/Support-Ko--fi%20%2F%20Patreon-ff5f5f)](#supporting-hue-md)

[**Try the Live Interactive Playground → spingras.github.io/hue-md**](https://spingras.github.io/hue-md/)

---

## Why Hue MD?

Markdown won the world because its raw source already looks like what it means: `*italic*` looks emphasized and `# Title` looks like a heading before any parser touches it.

For over 20 years, however, Markdown has had **no clean, portable way to add color or draw a callout box**:
- **Raw HTML** (`<span style="color:red">`) ruins plain-text readability and gets stripped by GitHub and chat apps.
- **MDX / Components** (`<Callout type="warn">`) turns your notes into JavaScript trapped inside a build pipeline.
- **GitHub Alerts** (`> [!NOTE]`) have zero inline color and look like noisy bracket syntax in raw text.

**Hue MD (`hue-md`)** bridges this gap. You write clean, human-readable text that renders into rich color badges, highlights, and callout cards across your editors — and downgrades with one command into native GitHub Alerts when you share on GitHub.

```markdown
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

+-- ! Never Commit Secrets
| Keep `.env` files out of git.
| - Add `.env` to `.gitignore`
| - Rotate any key that leaked {!: immediately}
+--
```

---

## 1-Click Install

Grab the installer for your setup from [**GitHub Releases**](https://github.com/spingras/hue-md/releases/latest):

| Platform | Download | What It Does |
| :--- | :--- | :--- |
| 💻 **VS Code / Cursor / Windsurf** | [**`hue-md-0.1.0.vsix`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-0.1.0.vsix) | Type `info`, `ok`, `note`, `warn` + <kbd>Tab</kbd> for instant boxes, auto-continue `\| ` on <kbd>Enter</kbd>, live side-by-side preview, and editor coloring. |
| 📝 **Notepad++ (Windows x64)** | [**`hue-md-npp-x64.zip`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-npp-x64.zip) | Native `hue-md.dll` plugin with a docked side-by-side Live Preview (`Ctrl+Shift+H`), editor coloring, and 1-click box menu actions. |
| 💎 **Obsidian Plugin** | [**`hue-md-obsidian.zip`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-obsidian.zip) | Native Obsidian plugin (`manifest.json`, `main.js`, `styles.css`) that renders Hue spans and boxes in your vault + Command Palette box insertion. |
| 🌙 **Neovim Plugin (`hue-md.nvim`)** | [**`hue-md-nvim.zip`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-nvim.zip) | Native Lua plugin with live extmark coloring, `:HueBox` command, and automatic `\| ` continuation on <kbd>Enter</kbd>. |
| 🐙 **GitHub.com (UserScript)** | [**`hue-md.user.js`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md.user.js) | 1-click install via Tampermonkey / Violentmonkey — renders `.hue.md` spans and boxes directly on `github.com`. |
| 🌐 **Chrome / Firefox Extension** | [**`hue-md-browser.zip`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-browser.zip) | Standalone browser extension for live Hue rendering on GitHub. |
| ⌨️ **Sublime & Emacs Pack** | [**`hue-md-snippets.zip`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md-snippets.zip) | Drop-in snippets (`info`, `ok`, `note`, `warn`, `danger`) + `hue-md-mode.el` for Emacs & Android Emacs. |
| 🎨 **Web Stylesheet** | [**`hue-md.css`**](https://github.com/spingras/hue-md/releases/latest/download/hue-md.css) | Drop-in light & dark mode CSS stylesheet for any website or docs site. |

---

## Syntax in 60 Seconds

### 1. Effortless Callout Boxes
You only need to choose **`info`**, **`ok`**, **`note`**, **`warn`**, or **`!`**:

```markdown
+-- info Pro Tip
| First point
| Second point
+--

+-- ok All Checks Passed
| Ready to deploy to production.
+--

+-- warn Heads Up
| Public API endpoints are rate-limited to {warn: 100 requests/min}.
+--
```

| Token | Color | GitHub Alert (`hue-md downgrade`) | Best For |
| :--- | :--- | :--- | :--- |
| **`info`** | Blue | `> [!NOTE]` | Pro tips, context, general notes |
| **`ok`** | Green | `> [!TIP]` | Success states, best practices |
| **`note`** | Purple | `> [!IMPORTANT]` | Key details, important reminders |
| **`warn`** | Orange | `> [!WARNING]` | Warnings, caveats, rate limits |
| **`!`** *(or `danger`)* | Red | `> [!CAUTION]` | Security alerts, breaking changes |

*(Want a framed box in plain text? Closed ASCII `+-- ... --+`, Unicode `┌─ ... ─┐`, and rounded `╭─ ... ─╮` borders work too.)*

### 2. Inline Color & Highlights
Wrap any phrase in `{style: text}`:

- **Semantic status**: `{ok: passing}`, `{info: beta}`, `{note: v2.0}`, `{warn: 71%}`, `{!: blocked}`
- **7 palette colors**: `{red: ...}`, `{orange: ...}`, `{yellow: ...}`, `{green: ...}`, `{blue: ...}`, `{purple: ...}`, `{gray: ...}`
- **Background highlights**: `{bg-yellow: review this}`, `{blue bg-gray: badge}`
- **Exact Hex colors**: `{#c0ffee bg-#333333: custom hex}`

---

## Terminal & GitHub Workflow (`hue-md`)

- **View in Terminal**: Render `.hue.md` files with 24-bit ANSI truecolor and box frames directly in Windows Terminal, iTerm2, or Linux shells:
  ```sh
  hue-md view demo/demo.hue.md
  ```
- **Downgrade for GitHub**: Convert `.hue.md` into standard GitHub Flavored Markdown where every box becomes a native GitHub Alert (`> [!NOTE]`, `> [!WARNING]`, etc.):
  ```sh
  hue-md downgrade README.hue.md -o README.md
  ```
- **Export Standalone HTML**:
  ```sh
  hue-md html demo/demo.hue.md --standalone -o index.html
  ```

---

## Built for Real-World Reliability

Hue MD was engineered so you can turn it on across all your Markdown files without ever worrying about broken prose or code:
- **Zero False Positives**: JSON snippets (`{"key": "value"}`), object literals (`{a: 1}`), math formulas, and code blocks are never touched. Verified across 250+ real-world npm READMEs and AI transcripts with **0 unintended changes**.
- **100% CommonMark Superset**: All 652/652 CommonMark 0.31.2 spec examples render identically byte-for-byte.
- **Accessible by Default**: All 7 colors are tuned for strict WCAG AA contrast (4.5:1+) in both Light and Dark themes.
- **Linear Performance**: One-pass brace matching; 20,000 unclosed adversarial braces parse in under 20ms.

---

## Open Source Commitment (FOSS)

Hue MD is and will always remain **100% Free and Open Source Software (MIT License)**.
- **Zero Telemetry**: No tracking, phone-home, or data collection.
- **Zero Vendor Lock-in**: Everything is standard plain text that you own forever.
- **Fork Friendly**: Embed it in your own editors, parsers, and static site generators.

### Supporting Hue MD
This project is entirely self-funded and community-driven. If Hue MD saves you time or enhances your documentation workflow, consider supporting independent development:
- ☕ **Ko-fi**: [ko-fi.com/hue-md](https://ko-fi.com/hue-md) (Buy me a coffee)
- 💖 **Patreon**: [patreon.com/hue-md](https://patreon.com/hue-md) (Monthly supporter)
- ⭐ **Star this repository** on [GitHub](https://github.com/spingras/hue-md) to help others discover it!
