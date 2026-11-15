import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import hue, { css } from '../src/index.js'
import { downgrade } from '../md-hue/src/downgrade.js'

const md = new MarkdownIt().use(hue)
const src = readFileSync(new URL('../demo/demo.hue.md', import.meta.url), 'utf8')
const initialHtml = md.render(src)
const initialDowngrade = downgrade(src)

const pageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hue MD (hue-md) — Effortless Color & Callout Boxes for Markdown</title>
<meta name="description" content="Readable-raw color spans and effortless callout boxes for Markdown (.hue.md). Works across Web, CLI, VS Code, Notepad++, and GitHub.">
<style>
${css()}
:root {
  --surface: #ffffff;
  --surface-subtle: #f6f8fa;
  --border: #d0d7de;
  --muted: #57606a;
  --accent: #175cd3;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --surface: #0d1117;
    --surface-subtle: #161b22;
    --border: #30363d;
    --muted: #8b949e;
    --accent: #58a6ff;
  }
}
:root[data-theme="dark"] {
  --surface: #0d1117;
  --surface-subtle: #161b22;
  --border: #30363d;
  --muted: #8b949e;
  --accent: #58a6ff;
}
* { box-sizing: border-box; }
body {
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  background: var(--surface);
  color: var(--hue-text);
}
.container { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
header {
  border-bottom: 1px solid var(--border);
  background: var(--surface-subtle);
  padding: 14px 0;
}
.nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.2rem; text-decoration: none; color: inherit; }
.brand-badge {
  background: var(--hue-blue-bg);
  color: var(--hue-blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  padding: 2px 8px;
  border-radius: 6px;
}
.nav-links { display: flex; align-items: center; gap: 12px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--hue-text);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.btn:hover { border-color: var(--accent); }
.btn-primary { background: var(--hue-blue); color: #fff; border-color: var(--hue-blue); }
.hero { padding: 36px 0 24px; text-align: center; }
.hero h1 { font-size: 2.4rem; margin: 0 0 10px; letter-spacing: -0.02em; }
.hero p { font-size: 1.15rem; color: var(--muted); max-width: 700px; margin: 0 auto 24px; }
.downloads {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}
.dl-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-subtle);
  text-decoration: none;
  color: inherit;
  text-align: left;
  transition: transform 0.1s ease, border-color 0.1s ease;
}
.dl-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.dl-title { font-weight: 700; font-size: 0.98rem; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
.dl-file { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.78rem; color: var(--accent); }
.dl-desc { font-size: 0.82rem; color: var(--muted); margin-top: 4px; }
.playground {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 40px;
}
@media (max-width: 860px) { .playground { grid-template-columns: 1fr; } }
.pane {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  min-height: 540px;
}
.pane-bar {
  background: var(--surface-subtle);
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.85rem;
  font-weight: 600;
}
.quick-btns { display: flex; gap: 5px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--hue-text);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  cursor: pointer;
}
.chip:hover { border-color: var(--accent); }
textarea#editor {
  flex: 1;
  width: 100%;
  border: 0;
  padding: 16px;
  font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--surface);
  color: var(--hue-text);
  resize: vertical;
  outline: none;
}
.preview-body { padding: 18px 20px; flex: 1; overflow: auto; }
.preview-body h1:first-child { margin-top: 0; }
pre.downgrade-out {
  margin: 0;
  white-space: pre-wrap;
  font: 13.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: rgba(127, 127, 127, 0.12);
  padding: 0.15em 0.35em;
  border-radius: 4px;
}
footer {
  border-top: 1px solid var(--border);
  padding: 24px 0 40px;
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}
</style>
</head>
<body>
<header>
  <div class="container nav">
    <a class="brand" href="#">
      <span>Hue MD</span>
      <span class="brand-badge">hue-md</span>
    </a>
    <div class="nav-links">
      <button class="btn" id="themeBtn" type="button">Toggle Dark / Light</button>
      <a class="btn" href="https://github.com/spingras/hue-md">GitHub (spingras/hue-md)</a>
      <a class="btn btn-primary" href="https://github.com/spingras/hue-md/releases/latest">Releases</a>
    </div>
  </div>
</header>

<main class="container">
  <section class="hero">
    <h1>Color &amp; Callout Boxes for Markdown, Made Effortless</h1>
    <p>Type <code>+-- info</code>, <code>ok</code>, <code>note</code>, <code>warn</code>, or <code>!</code>. Readable as plain text, styled everywhere, and 100% compatible with CommonMark &amp; GitHub Alerts.</p>

    <div class="downloads">
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md-0.1.0.vsix">
        <div>
          <div class="dl-title"><span>VS Code / Cursor</span><span class="dl-file">hue-md-0.1.0.vsix</span></div>
          <div class="dl-desc">Snippets (<code>info</code> + Tab), live preview, syntax coloring &amp; GitHub downgrade.</div>
        </div>
      </a>
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md-npp-x64.zip">
        <div>
          <div class="dl-title"><span>Notepad++ (x64)</span><span class="dl-file">hue-md-npp-x64.zip</span></div>
          <div class="dl-desc">Native <code>hue-md.dll</code> plugin with docked live preview &amp; 1-click box menu.</div>
        </div>
      </a>
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md-obsidian.zip">
        <div>
          <div class="dl-title"><span>Obsidian Plugin</span><span class="dl-file">hue-md-obsidian.zip</span></div>
          <div class="dl-desc">Native Obsidian plugin for rendering Hue spans &amp; boxes inside your vault.</div>
        </div>
      </a>
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md-nvim.zip">
        <div>
          <div class="dl-title"><span>Neovim Plugin</span><span class="dl-file">hue-md-nvim.zip</span></div>
          <div class="dl-desc">Native Lua plugin (<code>hue-md.nvim</code>) with extmark coloring &amp; <code>:HueBox</code>.</div>
        </div>
      </a>
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md.user.js">
        <div>
          <div class="dl-title"><span>GitHub UserScript</span><span class="dl-file">hue-md.user.js</span></div>
          <div class="dl-desc">1-click install in Tampermonkey / Violentmonkey for live rendering on GitHub.com.</div>
        </div>
      </a>
      <a class="dl-card" href="https://github.com/spingras/hue-md/releases/latest/download/hue-md-snippets.zip">
        <div>
          <div class="dl-title"><span>Sublime &amp; Emacs</span><span class="dl-file">hue-md-snippets.zip</span></div>
          <div class="dl-desc">Sublime Text snippets, templates &amp; Emacs <code>hue-md-mode.el</code>.</div>
        </div>
      </a>
    </div>
  </section>

  <section class="playground">
    <div class="pane">
      <div class="pane-bar">
        <span>demo.hue.md (Editable)</span>
        <div class="quick-btns">
          <button class="chip" data-box="info" type="button">+ info</button>
          <button class="chip" data-box="ok" type="button">+ ok</button>
          <button class="chip" data-box="note" type="button">+ note</button>
          <button class="chip" data-box="warn" type="button">+ warn</button>
          <button class="chip" data-box="!" type="button">+ !</button>
        </div>
      </div>
      <textarea id="editor" spellcheck="false">${src.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
    </div>

    <div class="pane">
      <div class="pane-bar">
        <span>Live Output</span>
        <div class="quick-btns">
          <button class="chip" id="tabPreview" type="button">Rendered HTML</button>
          <button class="chip" id="tabDowngrade" type="button">GitHub Downgrade (.md)</button>
        </div>
      </div>
      <div class="preview-body" id="previewPane">${initialHtml}</div>
      <div class="preview-body" id="downgradePane" style="display:none"><pre class="downgrade-out" id="downgradeCode">${initialDowngrade.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></div>
    </div>
  </section>
</main>

<footer>
  <div class="container">
    Hue MD (<code>hue-md</code>) · 100% FOSS (MIT License) ·
    <a href="https://github.com/spingras/hue-md" style="color:inherit">GitHub</a> ·
    <a href="https://ko-fi.com/hue-md" style="color:inherit">Ko-fi</a> ·
    <a href="https://patreon.com/hue-md" style="color:inherit">Patreon</a>
  </div>
</footer>

<script>
(function() {
  const COLORS = { red:'red', orange:'orange', yellow:'yellow', green:'green', blue:'blue', purple:'purple', gray:'gray', danger:'red', '!':'red', warn:'orange', warning:'orange', ok:'green', success:'green', info:'blue', tip:'blue', note:'purple', important:'purple', muted:'gray' };
  const hasColor = (k) => Object.prototype.hasOwnProperty.call(COLORS, k);
  const ALERTS = { red:'CAUTION', orange:'WARNING', yellow:'WARNING', green:'TIP', blue:'NOTE', purple:'IMPORTANT', gray:'NOTE' };

  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderInline(s) {
    let out = esc(s);
    out = out.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    out = out.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    out = out.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    out = out.replace(/\\{([!a-zA-Z0-9_\\-#\\s]+):\\s*([^{}]+)\\}/g, (m, spec, body) => {
      const words = spec.trim().split(/\\s+/);
      const cls = ['hue'];
      const styles = [];
      for (const w of words) {
        if (w.startsWith('bg-')) {
          const v = w.slice(3);
          if (hasColor(v)) cls.push('hue-bg-' + COLORS[v]);
          else if (/^#[0-9a-fA-F]{3,6}$/.test(v)) styles.push('background-color:' + v);
          else return m;
        } else if (hasColor(w)) {
          cls.push('hue-' + COLORS[w]);
        } else if (/^#[0-9a-fA-F]{3,6}$/.test(w)) {
          styles.push('color:' + w);
        } else return m;
      }
      const st = styles.length ? ' style="' + styles.join(';') + ';padding:0 .2em;border-radius:3px"' : '';
      return '<span class="' + cls.join(' ') + '"' + st + '>' + body + '</span>';
    });
    return out;
  }

  function renderHue(mdText) {
    const lines = mdText.replace(/\\r\\n/g, '\\n').split('\\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (line.startsWith('# ')) { html += '<h1>' + renderInline(line.slice(2)) + '</h1>'; i++; continue; }
      if (line.startsWith('## ')) { html += '<h2>' + renderInline(line.slice(3)) + '</h2>'; i++; continue; }
      const topM = line.match(/^([┌╭+])([─\\-]+)(.*?)\\s*$/);
      if (topM) {
        let j = i + 1;
        const inner = [];
        let closed = false;
        while (j < lines.length) {
          if (/^(?:[└╰][─\\-]+[┘╯]?|\\+[─\\-]+\\+?)\\s*$/.test(lines[j])) { closed = true; break; }
          if (!/^[│|]/.test(lines[j])) break;
          inner.push(lines[j].replace(/^[│|] ?/, '').replace(/ ?[│|]\\s*$/, ''));
          j++;
        }
        if (closed) {
          let rest = topM[3].trim();
          if (rest && '┐╮+'.includes(rest[rest.length - 1])) rest = rest.slice(0, -1).trim();
          rest = rest.replace(/[─\\-]+$/, '').trim();
          const parts = rest ? rest.split(/\\s+/) : [];
          let color = null;
          let idx = 0;
          if (parts[0] && hasColor(parts[0])) { color = COLORS[parts[0]]; idx = 1; }
          const title = parts.slice(idx).join(' ');
          const boxCls = 'hue-box' + (color ? ' hue-box-' + color : '');
          html += '<div class="' + boxCls + '" role="note">';
          if (title) html += '<div class="hue-box-title">' + renderInline(title) + '</div>';
          const pLines = [];
          const ulLines = [];
          for (const il of inner) {
            if (il.startsWith('- ')) ulLines.push('<li>' + renderInline(il.slice(2)) + '</li>');
            else if (il.trim()) pLines.push(renderInline(il));
          }
          if (pLines.length) html += '<p>' + pLines.join('\\n') + '</p>';
          if (ulLines.length) html += '<ul>' + ulLines.join('') + '</ul>';
          html += '</div>';
          i = j + 1;
          continue;
        }
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !/^([┌╭+])([─\\-]+)/.test(lines[i])) {
        para.push(renderInline(lines[i]));
        i++;
      }
      if (para.length) html += '<p>' + para.join('\\n') + '</p>';
    }
    return html;
  }

  function renderDowngrade(mdText) {
    const lines = mdText.replace(/\\r\\n/g, '\\n').split('\\n');
    const out = [];
    let i = 0;
    const stripSpans = (s) => s.replace(/\\{([!a-zA-Z0-9_\\-#\\s]+):\\s*([^{}]+)\\}/g, (m, spec, body) => {
      const w = spec.trim().split(/\\s+/)[0];
      const c = hasColor(w) ? COLORS[w] : null;
      if (!c && !w.startsWith('#') && !w.startsWith('bg-')) return m;
      return (c === 'red' || c === 'orange') ? '**' + body + '**' : body;
    });
    while (i < lines.length) {
      const line = lines[i];
      const topM = line.match(/^([┌╭+])([─\\-]+)(.*?)\\s*$/);
      if (topM) {
        let j = i + 1;
        const inner = [];
        let closed = false;
        while (j < lines.length) {
          if (/^(?:[└╰][─\\-]+[┘╯]?|\\+[─\\-]+\\+?)\\s*$/.test(lines[j])) { closed = true; break; }
          if (!/^[│|]/.test(lines[j])) break;
          inner.push(lines[j].replace(/^[│|] ?/, '').replace(/ ?[│|]\\s*$/, ''));
          j++;
        }
        if (closed) {
          let rest = topM[3].trim();
          if (rest && '┐╮+'.includes(rest[rest.length - 1])) rest = rest.slice(0, -1).trim();
          rest = rest.replace(/[─\\-]+$/, '').trim();
          const parts = rest ? rest.split(/\\s+/) : [];
          let color = 'gray';
          let idx = 0;
          if (parts[0] && hasColor(parts[0])) { color = COLORS[parts[0]]; idx = 1; }
          const title = parts.slice(idx).join(' ');
          out.push('> [!' + (ALERTS[color] || 'NOTE') + ']');
          if (title) { out.push('> **' + stripSpans(title) + '**'); out.push('>'); }
          for (const il of inner) out.push(il.trim() ? '> ' + stripSpans(il) : '>');
          i = j + 1;
          continue;
        }
      }
      out.push(stripSpans(line));
      i++;
    }
    return out.join('\\n');
  }

  const editor = document.getElementById('editor');
  const previewPane = document.getElementById('previewPane');
  const downgradePane = document.getElementById('downgradePane');
  const downgradeCode = document.getElementById('downgradeCode');

  editor.addEventListener('input', () => {
    previewPane.innerHTML = renderHue(editor.value);
    downgradeCode.textContent = renderDowngrade(editor.value);
  });

  document.querySelectorAll('[data-box]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-box');
      const snippet = '\\n+-- ' + kind + ' Title\\n| Point one\\n| Point two\\n+--\\n';
      const start = editor.selectionStart || editor.value.length;
      editor.value = editor.value.slice(0, start) + snippet + editor.value.slice(start);
      editor.dispatchEvent(new Event('input'));
      editor.focus();
    });
  });

  document.getElementById('tabPreview').addEventListener('click', () => {
    previewPane.style.display = 'block';
    downgradePane.style.display = 'none';
  });
  document.getElementById('tabDowngrade').addEventListener('click', () => {
    previewPane.style.display = 'none';
    downgradePane.style.display = 'block';
  });
  document.getElementById('themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme');
    root.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
  });
})();
</script>
</body>
</html>
`

mkdirSync(new URL('../site/', import.meta.url), { recursive: true })
writeFileSync(new URL('../demo/index.html', import.meta.url), pageHtml)
writeFileSync(new URL('../site/index.html', import.meta.url), pageHtml)
copyFileSync(new URL('../demo/demo.hue.md', import.meta.url), new URL('../site/demo.hue.md', import.meta.url))
console.log('wrote demo/index.html and site/index.html')
