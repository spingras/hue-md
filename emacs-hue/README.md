# Hue Markdown for Emacs & Android Emacs (`hue-markdown-mode.el`)

Single-file, zero-dependency Emacs package (`hue-markdown-mode.el`) for Hue Markdown (`.hue.md`), designed for both **Android Emacs** (native GUI `org.gnu.emacs` on F-Droid / SourceForge and Termux Emacs) and **Desktop Emacs** (Windows, macOS, Linux).

## Why It Works Great on Android Emacs

1. **100% Pure Emacs Lisp (No Node.js or External Binaries Required)**
   - Live in-buffer coloring of Hue spans (`{ok: passing}`, `{warn: 71%}`, `{!: blocked}`, `{blue bg-gray: ...}`, `{#c0ffee: ...}`) and drawn boxes (`┌──┐`, `╭──╮`, `+--+`).
   - Pure-Elisp in-Emacs preview (`C-c C-h p`) and GitHub Markdown downgrade (`C-c C-h d`) work inside the Android sandbox without needing Node.js or an external browser.
   - Automatically adapts between the WCAG AA **light** and **dark** Hue palettes from `src/palette.js` based on your Emacs frame background.

2. **Touch Menu Bar (`Hue`) & Soft-Keyboard Helpers**
   - Adds a top-level **`Hue`** menu to the Emacs menu bar so you can trigger every action with one tap on Android.
   - Includes **Wrap Region/Word in Hue Span...** (`C-c C-h s`) and **Wrap Region/Line in Hue Box...** (`C-c C-h x`) so you never have to hunt for `{`, `}`, `┌`, `─`, or `│` on a phone keyboard.

## Installation

### 1. Android Emacs (Native GUI App `org.gnu.emacs` or Termux)

Copy `hue-markdown-mode.el` into your Emacs config directory (`~/.emacs.d/lisp/hue-markdown-mode.el` — on Android GUI Emacs, `~` is `/data/data/org.gnu.emacs/files` or `/sdcard/Android/data/org.gnu.emacs/files`, accessible via `C-x C-f ~/.emacs.d/init.el`), then add to `~/.emacs.d/init.el`:

```elisp
(add-to-list 'load-path (expand-file-name "lisp" user-emacs-directory))
(require 'hue-markdown-mode)

;; Automatically enable Hue coloring in all Markdown buffers as well as .hue.md:
(add-hook 'markdown-mode-hook #'hue-markdown-mode)
```

### 2. Desktop Emacs (Windows / macOS / Linux)

Add to your `~/.emacs.d/init.el`:

```elisp
(add-to-list 'load-path "c:/Users/bartv/Documents/Coding Projects/modern-markdown/emacs-hue")
(require 'hue-markdown-mode)
(add-hook 'markdown-mode-hook #'hue-markdown-mode)
```

Or with `use-package`:

```elisp
(use-package hue-markdown-mode
  :load-path "c:/Users/bartv/Documents/Coding Projects/modern-markdown/emacs-hue"
  :mode "\\.hue\\.md\\'"
  :hook (markdown-mode . hue-markdown-mode))
```

## Commands & Keybindings (also in the `Hue` Menu Bar)

| Key | Command | Description |
| :--- | :--- | :--- |
| `C-c C-h s` | `hue-markdown-insert-span` | Wrap region or word at point in `{spec: ...}` with completion |
| `C-c C-h x` | `hue-markdown-insert-box` | Draw a padded `┌──┐` / `╭──╮` / `+--+` box around region or current line |
| `C-c C-h p` | `hue-markdown-preview-buffer` | Open clean in-Emacs preview buffer (`*Hue Preview*`) with delimiters concealed |
| `C-c C-h c` | `hue-markdown-toggle-conceal` | Toggle hiding `{spec: ` and `}` delimiters in the current buffer |
| `C-c C-h d` | `hue-markdown-downgrade-buffer` | Convert current buffer to GitHub Markdown (`> [!NOTE]`, `> [!WARNING]`, etc.) |
| `C-c C-h b` | `hue-markdown-preview-browser` | Render standalone HTML and open in external browser |
| `C-c C-h r` | `hue-markdown-fontify-buffer` | Force re-scan of Hue overlays |
