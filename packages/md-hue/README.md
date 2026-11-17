# hue-md command-line tools

This folder holds the source of the `hue-md` command-line tool and its terminal, GitHub and HTML renderers for [Hue Markdown](../../spec/spec.md) (`.hue.md`). It ships as part of the [`hue-md`](https://www.npmjs.com/package/hue-md) npm package; it is not a separate package.

```bash
npm install -g hue-md
hue-md view notes.hue.md          # colors and boxes in the terminal
hue-md downgrade notes.hue.md     # GitHub Markdown: boxes become alerts
hue-md html notes.hue.md --standalone > notes.html
hue-md slides notes.hue.md -i     # a terminal slide deck
```

| Command | Does |
|---|---|
| `view` | Renders for the terminal: truecolor spans from the Hue palette (`--theme dark\|light`), boxes drawn with box characters, word wrap to `--width`. Colors turn off when piped or when `NO_COLOR` is set (`--color always` forces them). |
| `downgrade` | Rewrites Hue syntax only, leaving everything else byte-for-byte: boxes become GitHub alerts (red → CAUTION, orange/yellow → WARNING, green → TIP, blue → NOTE, purple → IMPORTANT, gray/none → quote), `hue` fences are unwrapped, and spans lose their braces. `--spans auto` (default) makes red/orange text **bold**; also `plain`, `bold`, `latex` (GitHub math colors for plain-text spans). |
| `html` | HTML with Hue classes; `--standalone` adds a page with the light/dark stylesheet. Raw HTML in the source is escaped. |
| `slides` | Splits the file into slides on `---` lines and shows them in the terminal; `-i` moves between slides with the arrow keys, `--slide <n>` shows one. |

The command is also installed as `md-hue`, the name it had before Hue MD became one package.

## API

```js
import { renderAnsi } from 'hue-md/ansi'
import { downgrade } from 'hue-md/downgrade'
import { toHtml } from 'hue-md/html'
```
