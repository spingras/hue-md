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

- **Tampermonkey / Violentmonkey**: Install `userscript/hue-md.user.js`.
- **Chrome / Edge Extension**:
  1. Open `chrome://extensions` or `edge://extensions`.
  2. Enable "Developer mode".
  3. Click "Load unpacked" and select the `packages/github-hue/extension/` directory.

Browsing any `.hue.md` file or repository with Hue markdown on GitHub will now render live styled cards, borders, and colors!
