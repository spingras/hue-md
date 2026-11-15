# md-hue

Command-line tools and core API for [Hue Markdown](../spec/spec.md) (`.hue.md`).

```bash
md-hue view notes.hue.md          # colors and boxes in the terminal
md-hue downgrade notes.hue.md     # GitHub Markdown: boxes become alerts
md-hue html notes.hue.md --standalone > notes.html
```

| Command | Does |
|---|---|
| `view` | Renders for the terminal: truecolor spans from the Hue palette (`--theme dark\|light`), boxes drawn with box characters, word wrap to `--width`. Colors turn off when piped or when `NO_COLOR` is set (`--color always` forces them). |
| `downgrade` | Rewrites Hue syntax only, leaving everything else byte-for-byte: boxes become GitHub alerts (red → CAUTION, orange/yellow → WARNING, green → TIP, blue → NOTE, purple → IMPORTANT, gray/none → quote), `hue` fences are unwrapped, and spans lose their braces. `--spans auto` (default) makes red/orange text **bold**; also `plain`, `bold`, `latex` (GitHub math colors for plain-text spans). |
| `html` | HTML with Hue classes; `--standalone` adds a page with the light/dark stylesheet. Raw HTML in the source is escaped. |

## API

```js
import { renderAnsi, downgrade, toHtml } from 'md-hue'
```
