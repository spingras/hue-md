import { mkdirSync, writeFileSync } from 'node:fs'
import { COLORS } from '../src/palette.js'

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true })

function buildTerminalSvg () {
  const p = {
    bg: '#0d1117',
    header: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    red: COLORS.red.dark.fg,
    orange: COLORS.orange.dark.fg,
    yellow: COLORS.yellow.dark.fg,
    green: COLORS.green.dark.fg,
    blue: COLORS.blue.dark.fg,
    purple: COLORS.purple.dark.fg,
    gray: COLORS.gray.dark.fg
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 450" width="100%">
  <defs>
    <style>
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="918" height="448" rx="10" fill="${p.bg}" stroke="${p.border}" stroke-width="1.5"/>
  <rect x="1" y="1" width="918" height="36" rx="10" fill="${p.header}" stroke="${p.border}"/>
  <circle cx="22" cy="19" r="5.5" fill="#ff5f56"/>
  <circle cx="40" cy="19" r="5.5" fill="#ffbd2e"/>
  <circle cx="58" cy="19" r="5.5" fill="#27c93f"/>
  <text x="460" y="24" text-anchor="middle" class="mono" font-size="12.5" fill="${p.muted}">hue-md view demo/demo.hue.md (24-bit ANSI Truecolor)</text>

  <g class="mono" font-size="13.2" fill="${p.text}">
    <text x="26" y="64"><tspan fill="${p.green}">$</tspan> hue-md view demo/demo.hue.md</text>
    <text x="26" y="92" font-weight="700">Hue Markdown (v0.2)</text>
    <text x="26" y="116">Build: <tspan fill="${p.green}">passing</tspan> · Coverage: <tspan fill="${p.orange}">71%</tspan> · Deploy: <tspan fill="${p.red}">blocked</tspan></text>
    <text x="26" y="138">Diff: <tspan fill="${p.green}">+ added split boxes &amp; tasks</tspan> · <tspan fill="${p.red}" text-decoration="line-through">- removed HTML spans</tspan></text>
    <text x="26" y="160">Shortcut: <tspan fill="${p.text}" font-weight="700">[Ctrl+Shift+V]</tspan> · Progress: <tspan fill="${p.green}">████████</tspan><tspan fill="${p.muted}">░░</tspan> <tspan font-weight="700">80%</tspan></text>

    <!-- Multi-state tasks -->
    <text x="26" y="190"><tspan fill="${p.green}" font-weight="700">[✓]</tspan> Ship core v0.2 parser &amp; CLI slide deck</text>
    <text x="26" y="210"><tspan fill="${p.blue}" font-weight="700">[▸]</tspan> Verify side-by-side editor previews</text>
    <text x="26" y="230"><tspan fill="${p.red}" font-weight="700">[!]</tspan> Resolve <tspan fill="${p.red}">release blocker</tspan> before tagging</text>
    <text x="26" y="250"><tspan fill="${p.purple}" font-weight="700">[?]</tspan> Confirm keycap downgrade · <tspan fill="${p.muted}">[ ]</tspan> Announce release</text>

    <!-- Side-by-side split boxes -->
    <text x="26" y="284"><tspan fill="${p.green}">┌─ <tspan font-weight="700">Do this</tspan> ──────────────────────┐</tspan>  <tspan fill="${p.orange}">┌─ <tspan font-weight="700">Avoid this</tspan> ───────────────────┐</tspan></text>
    <text x="26" y="305"><tspan fill="${p.green}">│</tspan> Keep the source readable.      <tspan fill="${p.green}">│</tspan>  <tspan fill="${p.orange}">│</tspan> Raw &lt;span&gt; HTML in your notes. <tspan fill="${p.orange}">│</tspan></text>
    <text x="26" y="326"><tspan fill="${p.green}">│</tspan> Use ok, warn and !.            <tspan fill="${p.green}">│</tspan>  <tspan fill="${p.orange}">│</tspan> A build step for your docs.    <tspan fill="${p.orange}">│</tspan></text>
    <text x="26" y="347"><tspan fill="${p.green}">└────────────────────────────────┘</tspan>  <tspan fill="${p.orange}">└────────────────────────────────┘</tspan></text>

    <!-- Single danger box -->
    <text x="26" y="379" fill="${p.red}">┌─ <tspan font-weight="700">Never Commit Secrets</tspan> ─────────────────────────────────────────────┐</text>
    <text x="26" y="400"><tspan fill="${p.red}">│</tspan> Keep .env files out of git and rotate leaked keys <tspan fill="${p.red}" font-weight="700">immediately</tspan>.     <tspan fill="${p.red}">│</tspan></text>
    <text x="26" y="421" fill="${p.red}">└────────────────────────────────────────────────────────────────────┘</text>
  </g>
</svg>`
}

function buildVsCodePreviewSvg () {
  const p = {
    bg: '#1e1e1e',
    tabBg: '#252526',
    border: '#333333',
    text: '#d4d4d4',
    muted: '#858585',
    red: COLORS.red.dark,
    orange: COLORS.orange.dark,
    yellow: COLORS.yellow.dark,
    green: COLORS.green.dark,
    blue: COLORS.blue.dark,
    purple: COLORS.purple.dark
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 420" width="100%">
  <defs>
    <style>
      .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="1078" height="418" rx="10" fill="${p.bg}" stroke="${p.border}" stroke-width="1.5"/>
  <!-- Top Tab Bar -->
  <rect x="1" y="1" width="1078" height="36" rx="10" fill="${p.tabBg}" stroke="${p.border}"/>
  <circle cx="22" cy="19" r="5.5" fill="#ff5f56"/>
  <circle cx="40" cy="19" r="5.5" fill="#ffbd2e"/>
  <circle cx="58" cy="19" r="5.5" fill="#27c93f"/>
  <text x="90" y="24" class="sans" font-size="12.5" font-weight="600" fill="${p.text}">demo.hue.md</text>
  <line x1="540" y1="1" x2="540" y2="419" stroke="${p.border}" stroke-width="1.5"/>
  <text x="562" y="24" class="sans" font-size="12.5" font-weight="600" fill="${p.text}">Preview demo.hue.md (Ctrl+Shift+V)</text>

  <!-- Left Editor Pane -->
  <g class="mono" font-size="12.2">
    <text x="20" y="66" fill="${p.muted}">1</text>
    <text x="46" y="66" fill="${p.blue.fg}" font-weight="700"># Hue Markdown (v0.2)</text>

    <text x="20" y="92" fill="${p.muted}">2</text>
    <rect x="90" y="77" width="96" height="20" rx="3" fill="${p.green.bg}"/>
    <rect x="278" y="77" width="80" height="20" rx="3" fill="${p.orange.bg}"/>
    <rect x="430" y="77" width="85" height="20" rx="3" fill="${p.red.bg}"/>
    <text x="46" y="92" fill="${p.text}">Build: <tspan fill="${p.green.fg}">{ok: passing}</tspan> · Coverage: <tspan fill="${p.orange.fg}">{warn: 71%}</tspan> · Deploy: <tspan fill="${p.red.fg}">{!: blocked}</tspan></text>

    <text x="20" y="118" fill="${p.muted}">3</text>
    <text x="46" y="118" fill="${p.text}">Diff: <tspan fill="${p.green.fg}">{+: added split boxes}</tspan> · <tspan fill="${p.red.fg}" text-decoration="line-through">{-: old spans}</tspan></text>

    <text x="20" y="144" fill="${p.muted}">4</text>
    <text x="46" y="144" fill="${p.text}">Preview: <tspan fill="${p.blue.fg}">[[Ctrl+Shift+V]]</tspan> · <tspan fill="${p.green.fg}">[========..] 80%</tspan></text>

    <text x="20" y="174" fill="${p.muted}">5</text>
    <text x="46" y="174" fill="${p.text}">- <tspan fill="${p.green.fg}" font-weight="700">[x]</tspan> Ship parser · - <tspan fill="${p.blue.fg}" font-weight="700">[-]</tspan> Live preview · - <tspan fill="${p.red.fg}" font-weight="700">[!]</tspan> Blocker</text>

    <text x="20" y="206" fill="${p.muted}">6</text>
    <text x="46" y="206"><tspan fill="${p.green.fg}" font-weight="700">+-- ok Do This</tspan>              <tspan fill="${p.orange.fg}" font-weight="700">+-- warn Avoid This</tspan></text>
    <text x="20" y="230" fill="${p.muted}">7</text>
    <text x="46" y="230" fill="${p.text}"><tspan fill="${p.green.fg}">|</tspan> Keep source readable.     <tspan fill="${p.orange.fg}">|</tspan> Raw &lt;span&gt; HTML.</text>
    <text x="20" y="254" fill="${p.muted}">8</text>
    <text x="46" y="254"><tspan fill="${p.green.fg}">+--</tspan>                         <tspan fill="${p.orange.fg}">+--</tspan></text>

    <text x="20" y="286" fill="${p.muted}">9</text>
    <text x="46" y="286" fill="${p.red.fg}" font-weight="700">+-- ! Never Commit Secrets</text>
    <text x="14" y="310" fill="${p.muted}">10</text>
    <rect x="330" y="295" width="118" height="20" rx="3" fill="${p.red.bg}"/>
    <text x="46" y="310" fill="${p.text}"><tspan fill="${p.red.fg}">|</tspan> Rotate any leaked key <tspan fill="${p.red.fg}">{!: immediately}</tspan>.</text>
    <text x="14" y="334" fill="${p.muted}">11</text>
    <text x="46" y="334" fill="${p.red.fg}">+--</text>
  </g>

  <!-- Right Live Preview Pane -->
  <g class="sans" fill="${p.text}">
    <text x="564" y="70" font-size="18" font-weight="700">Hue Markdown (v0.2)</text>
    <line x1="564" y1="80" x2="1052" y2="80" stroke="${p.border}"/>

    <text x="564" y="106" font-size="13.5">
      Build: <tspan fill="${p.green.fg}" font-weight="600">passing</tspan> · Coverage: <tspan fill="${p.orange.fg}" font-weight="600">71%</tspan> · Deploy: <tspan fill="${p.red.fg}" font-weight="600">blocked</tspan>
    </text>
    <text x="564" y="130" font-size="13.5">
      Diff: <tspan fill="${p.green.fg}">added split boxes</tspan> · <tspan fill="${p.red.fg}" text-decoration="line-through">old spans</tspan>
    </text>

    <rect x="564" y="192" width="236" height="68" rx="6" fill="${p.green.bg}"/>
    <rect x="564" y="192" width="4" height="68" rx="2" fill="${p.green.fg}"/>
    <text x="578" y="216" font-size="13.5" font-weight="700" fill="${p.green.fg}">Do This</text>
    <text x="578" y="240" font-size="13">Keep source readable.</text>

    <rect x="816" y="192" width="236" height="68" rx="6" fill="${p.orange.bg}"/>
    <rect x="816" y="192" width="4" height="68" rx="2" fill="${p.orange.fg}"/>
    <text x="830" y="216" font-size="13.5" font-weight="700" fill="${p.orange.fg}">Avoid This</text>
    <text x="830" y="240" font-size="13">Raw &lt;span&gt; HTML.</text>

    <rect x="564" y="276" width="488" height="68" rx="6" fill="${p.red.bg}"/>
    <rect x="564" y="276" width="4" height="68" rx="2" fill="${p.red.fg}"/>
    <text x="580" y="300" font-size="13.5" font-weight="700" fill="${p.red.fg}">Never Commit Secrets</text>
    <text x="580" y="324" font-size="13">Rotate any leaked key <tspan fill="${p.red.fg}" font-weight="700">immediately</tspan>.</text>
  </g>
</svg>`
}

writeFileSync(new URL('../assets/terminal.svg', import.meta.url), buildTerminalSvg())
writeFileSync(new URL('../assets/vscode-preview.svg', import.meta.url), buildVsCodePreviewSvg())

console.log('Generated README SVG assets in assets/')
