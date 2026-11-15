import { mkdirSync, writeFileSync } from 'node:fs'
import { COLORS, PAGE } from '../src/palette.js'

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true })

function esc (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHeroSvg (mode) {
  const isDark = mode === 'dark'
  const p = {
    canvasBg: PAGE[mode].bg,
    paneBg: isDark ? '#161b22' : '#f6f8fa',
    cardBg: PAGE[mode].bg,
    border: isDark ? '#30363d' : '#d0d7de',
    text: PAGE[mode].text,
    muted: isDark ? '#8b949e' : '#57606a',
    red: COLORS.red[mode],
    orange: COLORS.orange[mode],
    yellow: COLORS.yellow[mode],
    green: COLORS.green[mode],
    blue: COLORS.blue[mode],
    purple: COLORS.purple[mode],
    gray: COLORS.gray[mode]
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 530" width="100%">
  <defs>
    <style>
      .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>

  <!-- Outer container -->
  <rect x="1" y="1" width="1078" height="528" rx="12" fill="${p.canvasBg}" stroke="${p.border}" stroke-width="1.5"/>

  <!-- Left Pane: Raw .hue.md Source -->
  <rect x="20" y="20" width="505" height="490" rx="8" fill="${p.paneBg}" stroke="${p.border}"/>
  <rect x="20" y="20" width="505" height="36" rx="8" fill="${p.paneBg}" stroke="${p.border}"/>
  <circle cx="38" cy="38" r="5" fill="${p.red.fg}" opacity="0.8"/>
  <circle cx="54" cy="38" r="5" fill="${p.yellow.fg}" opacity="0.8"/>
  <circle cx="70" cy="38" r="5" fill="${p.green.fg}" opacity="0.8"/>
  <text x="90" y="43" class="mono" font-size="12.5" font-weight="600" fill="${p.muted}">demo.hue.md — Raw Plain Text</text>

  <!-- Raw Source Lines -->
  <g class="mono" font-size="12.8" fill="${p.text}">
    <text x="38" y="84" font-weight="700" fill="${p.blue.fg}"># Hue Markdown</text>

    <text x="38" y="114">Build: <tspan fill="${p.green.fg}">{ok: passing}</tspan> · Coverage: <tspan fill="${p.orange.fg}">{warn: 71%}</tspan></text>
    <text x="38" y="134">Deploy: <tspan fill="${p.red.fg}">{!: blocked}</tspan></text>

    <text x="38" y="164">You can <tspan fill="${p.yellow.fg}">{bg-yellow: highlight a phrase}</tspan>,</text>
    <text x="38" y="184">combine <tspan fill="${p.blue.fg}">{blue bg-gray: color and background}</tspan>,</text>
    <text x="38" y="204">or use <tspan fill="#58a6ff">{#c0ffee bg-#333333: hex values}</tspan>.</text>

    <text x="38" y="234" fill="${p.muted}">Prose like {a: 1} or {key: value} stays untouched.</text>

    <!-- Box 1 raw -->
    <text x="38" y="268" fill="${p.blue.fg}" font-weight="600">+-- info Pro Tip</text>
    <text x="38" y="288"><tspan fill="${p.blue.fg}">|</tspan> Start with +-- and info, ok, note, warn, or !</text>
    <text x="38" y="308"><tspan fill="${p.blue.fg}">|</tspan> Every | line starts on a new line automatically</text>
    <text x="38" y="328" fill="${p.blue.fg}" font-weight="600">+--</text>

    <!-- Box 2 raw -->
    <text x="38" y="362" fill="${p.green.fg}" font-weight="600">+-- ok Success</text>
    <text x="38" y="382"><tspan fill="${p.green.fg}">|</tspan> Supports **bold**, \`code\`, and <tspan fill="${p.green.fg}">{ok: spans}</tspan>.</text>
    <text x="38" y="402" fill="${p.green.fg}" font-weight="600">+--</text>

    <!-- Box 3 raw -->
    <text x="38" y="436" fill="${p.red.fg}" font-weight="600">+-- ! Never Commit Secrets</text>
    <text x="38" y="456"><tspan fill="${p.red.fg}">|</tspan> Keep \`.env\` out of git; rotate keys <tspan fill="${p.red.fg}">{!: now}</tspan>.</text>
    <text x="38" y="476" fill="${p.red.fg}" font-weight="600">+--</text>
  </g>

  <!-- Center Arrow Badge -->
  <circle cx="540" cy="265" r="16" fill="${p.blue.bg}" stroke="${p.blue.fg}" stroke-width="1.5"/>
  <text x="540" y="270" text-anchor="middle" class="sans" font-size="15" font-weight="700" fill="${p.blue.fg}">→</text>

  <!-- Right Pane: Rendered Result -->
  <rect x="555" y="20" width="505" height="490" rx="8" fill="${p.cardBg}" stroke="${p.border}"/>
  <rect x="555" y="20" width="505" height="36" rx="8" fill="${p.paneBg}" stroke="${p.border}"/>
  <text x="575" y="43" class="sans" font-size="12.5" font-weight="600" fill="${p.muted}">Rendered Output — Web · VS Code · Notepad++ · Obsidian</text>

  <g class="sans" fill="${p.text}">
    <!-- Heading -->
    <text x="578" y="88" font-size="20" font-weight="700">Hue Markdown</text>
    <line x1="578" y1="98" x2="1038" y2="98" stroke="${p.border}" stroke-width="1"/>

    <!-- Status line -->
    <text x="578" y="126" font-size="14">
      Build: <tspan fill="${p.green.fg}" font-weight="600">passing</tspan>
      <tspan fill="${p.muted}"> · </tspan>
      Coverage: <tspan fill="${p.orange.fg}" font-weight="600">71%</tspan>
      <tspan fill="${p.muted}"> · </tspan>
      Deploy: <tspan fill="${p.red.fg}" font-weight="600">blocked</tspan>
    </text>

    <!-- Highlight line 1 -->
    <text x="578" y="158" font-size="14">You can</text>
    <rect x="633" y="143" width="122" height="21" rx="4" fill="${p.yellow.bg}"/>
    <text x="639" y="158" font-size="14" fill="${p.text}">highlight a phrase,</text>

    <text x="762" y="158" font-size="14">combine</text>
    <rect x="820" y="143" width="150" height="21" rx="4" fill="${p.gray.bg}"/>
    <text x="826" y="158" font-size="14" fill="${p.blue.fg}" font-weight="500">color and background,</text>

    <!-- Highlight line 2 -->
    <text x="578" y="184" font-size="14">or reach for exact</text>
    <rect x="694" y="169" width="76" height="21" rx="4" fill="#333333"/>
    <text x="700" y="184" font-size="13.5" fill="#c0ffee" class="mono">hex values</text>
    <text x="774" y="184" font-size="14">.</text>

    <!-- Untouched prose -->
    <text x="578" y="214" font-size="13.5" fill="${p.muted}">Prose like {a: 1} or {key: value} stays untouched.</text>

    <!-- Rendered Box 1: info -->
    <rect x="578" y="232" width="460" height="82" rx="6" fill="${p.blue.bg}"/>
    <rect x="578" y="232" width="4" height="82" rx="2" fill="${p.blue.fg}"/>
    <text x="594" y="254" font-size="14" font-weight="700" fill="${p.blue.fg}">Pro Tip</text>
    <text x="594" y="276" font-size="13.5" fill="${p.text}">Start with <tspan class="mono">+--</tspan> and info, ok, note, warn, or !</text>
    <text x="594" y="298" font-size="13.5" fill="${p.text}">Every <tspan class="mono">|</tspan> line starts on a new line automatically</text>

    <!-- Rendered Box 2: ok -->
    <rect x="578" y="328" width="460" height="64" rx="6" fill="${p.green.bg}"/>
    <rect x="578" y="328" width="4" height="64" rx="2" fill="${p.green.fg}"/>
    <text x="594" y="350" font-size="14" font-weight="700" fill="${p.green.fg}">Success</text>
    <text x="594" y="373" font-size="13.5" fill="${p.text}">Supports <tspan font-weight="700">bold</tspan>, <tspan class="mono">code</tspan>, and <tspan fill="${p.green.fg}" font-weight="600">colored spans</tspan>.</text>

    <!-- Rendered Box 3: danger -->
    <rect x="578" y="406" width="460" height="68" rx="6" fill="${p.red.bg}"/>
    <rect x="578" y="406" width="4" height="68" rx="2" fill="${p.red.fg}"/>
    <text x="594" y="428" font-size="14" font-weight="700" fill="${p.red.fg}">Never Commit Secrets</text>
    <text x="594" y="452" font-size="13.5" fill="${p.text}">Keep <tspan class="mono">.env</tspan> files out of git and rotate leaked keys <tspan fill="${p.red.fg}" font-weight="700">immediately</tspan>.</text>
  </g>
</svg>`
}

function buildBoxesSvg (mode) {
  const isDark = mode === 'dark'
  const p = {
    canvasBg: PAGE[mode].bg,
    border: isDark ? '#30363d' : '#d0d7de',
    text: PAGE[mode].text,
    muted: isDark ? '#8b949e' : '#57606a',
    blue: COLORS.blue[mode],
    green: COLORS.green[mode],
    purple: COLORS.purple[mode],
    orange: COLORS.orange[mode],
    red: COLORS.red[mode]
  }

  const rows = [
    { token: 'info', title: 'Pro Tip (Blue)', body: 'General context, tips, and onboarding notes.', c: p.blue, alert: '[!NOTE]' },
    { token: 'ok', title: 'All Checks Passed (Green)', body: 'Success states, verified steps, and best practices.', c: p.green, alert: '[!TIP]' },
    { token: 'note', title: 'Important Detail (Purple)', body: 'Key architectural decisions and release notes.', c: p.purple, alert: '[!IMPORTANT]' },
    { token: 'warn', title: 'Heads Up (Orange)', body: 'Rate limits, deprecations, and configuration caveats.', c: p.orange, alert: '[!WARNING]' },
    { token: '!', title: 'Never Commit Secrets (Red)', body: 'Critical security warnings and breaking changes.', c: p.red, alert: '[!CAUTION]' }
  ]

  let itemsSvg = ''
  rows.forEach((r, idx) => {
    const y = 20 + idx * 78
    itemsSvg += `
    <!-- Raw token pill on left -->
    <rect x="20" y="${y + 8}" width="175" height="50" rx="6" fill="${isDark ? '#161b22' : '#f6f8fa'}" stroke="${p.border}"/>
    <text x="34" y="${y + 30}" class="mono" font-size="13" font-weight="700" fill="${r.c.fg}">+-- ${esc(r.token)} Title</text>
    <text x="34" y="${y + 48}" class="mono" font-size="11.5" fill="${p.muted}">→ GitHub ${r.alert}</text>

    <!-- Rendered box on right -->
    <rect x="215" y="${y}" width="845" height="64" rx="6" fill="${r.c.bg}"/>
    <rect x="215" y="${y}" width="4" height="64" rx="2" fill="${r.c.fg}"/>
    <text x="233" y="${y + 24}" class="sans" font-size="14" font-weight="700" fill="${r.c.fg}">${esc(r.title)}</text>
    <text x="233" y="${y + 47}" class="sans" font-size="13.5" fill="${p.text}">${esc(r.body)}</text>
    `
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 415" width="100%">
  <defs>
    <style>
      .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="1078" height="413" rx="10" fill="${p.canvasBg}" stroke="${p.border}" stroke-width="1.5"/>
  ${itemsSvg}
</svg>`
}

function buildTerminalSvg () {
  const p = {
    bg: '#0d1117',
    header: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    red: COLORS.red.dark.fg,
    orange: COLORS.orange.dark.fg,
    yellow: COLORS.yellow.dark,
    green: COLORS.green.dark.fg,
    blue: COLORS.blue.dark.fg,
    purple: COLORS.purple.dark.fg,
    gray: COLORS.gray.dark
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 340" width="100%">
  <defs>
    <style>
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="918" height="338" rx="10" fill="${p.bg}" stroke="${p.border}" stroke-width="1.5"/>
  <rect x="1" y="1" width="918" height="36" rx="10" fill="${p.header}" stroke="${p.border}"/>
  <circle cx="22" cy="19" r="5.5" fill="#ff5f56"/>
  <circle cx="40" cy="19" r="5.5" fill="#ffbd2e"/>
  <circle cx="58" cy="19" r="5.5" fill="#27c93f"/>
  <text x="460" y="24" text-anchor="middle" class="mono" font-size="12.5" fill="${p.muted}">hue-md view demo/demo.hue.md (24-bit ANSI Truecolor)</text>

  <g class="mono" font-size="13.5" fill="${p.text}">
    <text x="26" y="66"><tspan fill="${p.green}">$</tspan> hue-md view demo/demo.hue.md</text>
    <text x="26" y="96" font-weight="700">Hue Markdown</text>
    <text x="26" y="122">Build: <tspan fill="${p.green}">passing</tspan> · Coverage: <tspan fill="${p.orange}">71%</tspan> · Deploy: <tspan fill="${p.red}">blocked</tspan></text>

    <!-- Unicode box 1 -->
    <text x="26" y="156" fill="${p.blue}">┌─ <tspan font-weight="700">Effortless Boxes</tspan> ───────────────────────────────────────────────┐</text>
    <text x="26" y="178"><tspan fill="${p.blue}">│</tspan> Start with +-- followed by info, ok, note, warn, or !            <tspan fill="${p.blue}">│</tspan></text>
    <text x="26" y="200"><tspan fill="${p.blue}">│</tspan> Every | line automatically starts on a new line                  <tspan fill="${p.blue}">│</tspan></text>
    <text x="26" y="222" fill="${p.blue}">└──────────────────────────────────────────────────────────────────┘</text>

    <!-- Unicode box 2 -->
    <text x="26" y="256" fill="${p.red}">┌─ <tspan font-weight="700">Never Commit Secrets</tspan> ───────────────────────────────────────────┐</text>
    <text x="26" y="278"><tspan fill="${p.red}">│</tspan> Keep .env files out of git and rotate leaked keys <tspan fill="${p.red}" font-weight="700">immediately</tspan>.   <tspan fill="${p.red}">│</tspan></text>
    <text x="26" y="300" fill="${p.red}">└──────────────────────────────────────────────────────────────────┘</text>
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 390" width="100%">
  <defs>
    <style>
      .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="1078" height="388" rx="10" fill="${p.bg}" stroke="${p.border}" stroke-width="1.5"/>
  <!-- Top Tab Bar -->
  <rect x="1" y="1" width="1078" height="36" rx="10" fill="${p.tabBg}" stroke="${p.border}"/>
  <circle cx="22" cy="19" r="5.5" fill="#ff5f56"/>
  <circle cx="40" cy="19" r="5.5" fill="#ffbd2e"/>
  <circle cx="58" cy="19" r="5.5" fill="#27c93f"/>
  <text x="90" y="24" class="sans" font-size="12.5" font-weight="600" fill="${p.text}">demo.hue.md</text>
  <line x1="540" y1="1" x2="540" y2="389" stroke="${p.border}" stroke-width="1.5"/>
  <text x="562" y="24" class="sans" font-size="12.5" font-weight="600" fill="${p.text}">Preview demo.hue.md (Ctrl+Shift+V)</text>

  <!-- Left Editor Pane -->
  <g class="mono" font-size="12.5">
    <text x="20" y="68" fill="${p.muted}">1</text>
    <text x="46" y="68" fill="${p.blue.fg}" font-weight="700"># Hue Markdown</text>

    <text x="20" y="94" fill="${p.muted}">2</text>
    <text x="20" y="118" fill="${p.muted}">3</text>
    <rect x="92" y="103" width="100" height="20" rx="3" fill="${p.green.bg}"/>
    <rect x="285" y="103" width="84" height="20" rx="3" fill="${p.orange.bg}"/>
    <rect x="442" y="103" width="85" height="20" rx="3" fill="${p.red.bg}"/>
    <text x="46" y="118" fill="${p.text}">Build: <tspan fill="${p.green.fg}">{ok: passing}</tspan> · Coverage: <tspan fill="${p.orange.fg}">{warn: 71%}</tspan> · Deploy: <tspan fill="${p.red.fg}">{!: blocked}</tspan></text>

    <text x="20" y="146" fill="${p.muted}">4</text>
    <text x="20" y="170" fill="${p.muted}">5</text>
    <text x="46" y="170" fill="${p.blue.fg}" font-weight="700">+-- info Effortless Boxes</text>
    <text x="20" y="194" fill="${p.muted}">6</text>
    <text x="46" y="194" fill="${p.text}">| Start with \`+--\` and \`info\`, \`ok\`, \`note\`, \`warn\`, or \`!\`</text>
    <text x="20" y="218" fill="${p.muted}">7</text>
    <text x="46" y="218" fill="${p.text}">| Press Enter to auto-continue \`| \` on the next line</text>
    <text x="20" y="242" fill="${p.muted}">8</text>
    <text x="46" y="242" fill="${p.muted}">+--</text>

    <text x="20" y="270" fill="${p.muted}">9</text>
    <text x="14" y="294" fill="${p.muted}">10</text>
    <text x="46" y="294" fill="${p.red.fg}" font-weight="700">+-- ! Never Commit Secrets</text>
    <text x="14" y="318" fill="${p.muted}">11</text>
    <rect x="336" y="303" width="122" height="20" rx="3" fill="${p.red.bg}"/>
    <text x="46" y="318" fill="${p.text}">| Rotate any leaked key <tspan fill="${p.red.fg}">{!: immediately}</tspan>.</text>
    <text x="14" y="342" fill="${p.muted}">12</text>
    <text x="46" y="342" fill="${p.muted}">+--</text>
  </g>

  <!-- Right Live Preview Pane -->
  <g class="sans" fill="${p.text}">
    <text x="564" y="74" font-size="19" font-weight="700">Hue Markdown</text>
    <line x1="564" y1="84" x2="1052" y2="84" stroke="${p.border}"/>

    <text x="564" y="114" font-size="14">
      Build: <tspan fill="${p.green.fg}" font-weight="600">passing</tspan> · Coverage: <tspan fill="${p.orange.fg}" font-weight="600">71%</tspan> · Deploy: <tspan fill="${p.red.fg}" font-weight="600">blocked</tspan>
    </text>

    <rect x="564" y="140" width="488" height="86" rx="6" fill="${p.blue.bg}"/>
    <rect x="564" y="140" width="4" height="86" rx="2" fill="${p.blue.fg}"/>
    <text x="580" y="164" font-size="14" font-weight="700" fill="${p.blue.fg}">Effortless Boxes</text>
    <text x="580" y="188" font-size="13.5">Start with <tspan class="mono">+--</tspan> and <tspan class="mono">info</tspan>, <tspan class="mono">ok</tspan>, <tspan class="mono">note</tspan>, <tspan class="mono">warn</tspan>, or <tspan class="mono">!</tspan></text>
    <text x="580" y="210" font-size="13.5">Press Enter to auto-continue <tspan class="mono">| </tspan> on the next line</text>

    <rect x="564" y="246" width="488" height="68" rx="6" fill="${p.red.bg}"/>
    <rect x="564" y="246" width="4" height="68" rx="2" fill="${p.red.fg}"/>
    <text x="580" y="270" font-size="14" font-weight="700" fill="${p.red.fg}">Never Commit Secrets</text>
    <text x="580" y="294" font-size="13.5">Rotate any leaked key <tspan fill="${p.red.fg}" font-weight="700">immediately</tspan>.</text>
  </g>
</svg>`
}

writeFileSync(new URL('../assets/terminal.svg', import.meta.url), buildTerminalSvg())
writeFileSync(new URL('../assets/vscode-preview.svg', import.meta.url), buildVsCodePreviewSvg())

console.log('Generated README SVG assets in assets/')
