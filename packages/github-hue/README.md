# Hue Markdown for GitHub

Integration suite for Hue Markdown (`.hue.md`) on GitHub:
1. **GitHub Action (`action/`)**: Automatically downgrades `.hue.md` files to standard GitHub Flavored Markdown with native GitHub alerts (`> [!NOTE]`, `> [!WARNING]`, etc.) on push or pull request.
2. **Pre-commit Hook (`hooks/`)**: Ensures local commits automatically sync `.hue.md` -> `.md` so visitors always see rendered GitHub alerts.
3. **GitHub UserScript & Extension (`userscript/`, `extension/`)**: Directly renders live Hue color spans and styled boxes in the GitHub web interface when viewing `.hue.md` repositories.

## 1. GitHub Action

Add `.github/workflows/hue-sync.yml`:

```yaml
name: Hue Markdown Sync

on:
  push:
    paths:
      - '**/*.hue.md'
  pull_request:
    paths:
      - '**/*.hue.md'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hue-md/action@v0.1
        with:
          pattern: '.hue.md'
          mode: 'auto'
          check-only: ${{ github.event_name == 'pull_request' }}
          commit: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
```

## 2. Pre-commit Hook

Install the pre-commit hook in your local repository:

```powershell
.\packages\github-hue\hooks\install-hooks.ps1
```

Or on macOS/Linux:
```bash
./packages/github-hue/hooks/install-hooks.sh
```

Whenever you commit a `.hue.md` file, its `.md` counterpart is automatically generated and staged.

## 3. GitHub Browser Extension & UserScript

Renders Hue MD v0.2 in every rendered Markdown view on github.com (files, READMEs, issues, pull requests, comments): colored spans, diff spans `{+: }` `{-: }`, key caps `[[Ctrl+C]]`, progress bars `[=====.....] 50%`, multi-state tasks `[-] [!] [?]`, boxes, side-by-side boxes, and ` ```hue ` fences. `- [ ]` and `- [x]` stay GitHub's own checkboxes. Colors follow GitHub's light/dark setting.

Both are built from `src/content.js` with the real Hue parser (`src/index.js` and the shared DOM pass `src/dom.js` at the repo root):

- **Tampermonkey / Violentmonkey**: install `userscript/hue-md.user.js`.
- **Chrome / Edge extension**:
  1. Open `chrome://extensions` or `edge://extensions`.
  2. Enable "Developer mode".
  3. Click "Load unpacked" and select the `packages/github-hue/extension/` folder.

### Build

`extension/content.js`, `extension/hue.css`, the extension version and `userscript/hue-md.user.js` are generated: edit `src/` and rebuild. From the repo root (after `npm install`):

```bash
node packages/github-hue/scripts/build.mjs
```

`npm test` at the repo root runs `test/web.test.js`: it loads the built extension and userscript in a jsdom page holding `demo/demo.hue.md` rendered the way GitHub renders Markdown, and checks every feature.

### Manual check

1. Load the extension (steps above), or install the userscript.
2. Open `demo/demo.hue.md` in this repository on github.com.
3. Check: colored spans, five colored boxes, two boxes side by side at the end, ◐ ! ? task boxes next to the two normal checkboxes, `Ctrl+Shift+V` and `Esc` as key caps, a blue 80% and a green 100% progress bar, green inserted and red struck-through text.
4. Switch GitHub's theme (**Settings → Appearance**) between light and dark: the Hue colors follow.
