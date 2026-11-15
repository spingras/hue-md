// ==UserScript==
// @name         Hue MD for GitHub
// @namespace    https://spingras.github.io/hue-md/
// @version      0.1.0
// @description  Renders live Hue MD color spans, badges, and styled callout boxes on GitHub
// @author       spingras
// @match        https://github.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Embed Hue stylesheet
  const HUE_CSS = `
    .hue-box {
      border-left: 4px solid var(--hue-gray, #8b949e);
      background: var(--hue-neutral-bg, rgba(175, 184, 193, 0.2));
      padding: .6em 1em;
      margin: 1em 0;
      border-radius: 6px;
    }
    .hue-box p { white-space: pre-line; }
    .hue-box > :first-child { margin-top: 0; }
    .hue-box > :last-child { margin-bottom: 0; }
    .hue-box-title { font-weight: 600; margin-bottom: .35em; }

    .hue-red { color: #cf222e; }
    [data-color-mode="dark"] .hue-red { color: #ff7b72; }
    .hue-bg-red { background: #ffebe9; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-red { background: #490202; }
    .hue-box-red { border-left-color: #cf222e; background: #ffebe9; }
    [data-color-mode="dark"] .hue-box-red { border-left-color: #ff7b72; background: #490202; }
    .hue-box-red > .hue-box-title { color: #cf222e; }
    [data-color-mode="dark"] .hue-box-red > .hue-box-title { color: #ff7b72; }

    .hue-orange { color: #9a6700; }
    [data-color-mode="dark"] .hue-orange { color: #ffa657; }
    .hue-bg-orange { background: #fff8c5; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-orange { background: #3b2300; }
    .hue-box-orange { border-left-color: #9a6700; background: #fff8c5; }
    [data-color-mode="dark"] .hue-box-orange { border-left-color: #ffa657; background: #3b2300; }
    .hue-box-orange > .hue-box-title { color: #9a6700; }
    [data-color-mode="dark"] .hue-box-orange > .hue-box-title { color: #ffa657; }

    .hue-yellow { color: #7d4e00; }
    [data-color-mode="dark"] .hue-yellow { color: #e3b341; }
    .hue-bg-yellow { background: #fffbe6; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-yellow { background: #362b0a; }
    .hue-box-yellow { border-left-color: #7d4e00; background: #fffbe6; }
    [data-color-mode="dark"] .hue-box-yellow { border-left-color: #e3b341; background: #362b0a; }
    .hue-box-yellow > .hue-box-title { color: #7d4e00; }
    [data-color-mode="dark"] .hue-box-yellow > .hue-box-title { color: #e3b341; }

    .hue-green { color: #1a7f37; }
    [data-color-mode="dark"] .hue-green { color: #3fb950; }
    .hue-bg-green { background: #dafbe1; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-green { background: #04260f; }
    .hue-box-green { border-left-color: #1a7f37; background: #dafbe1; }
    [data-color-mode="dark"] .hue-box-green { border-left-color: #3fb950; background: #04260f; }
    .hue-box-green > .hue-box-title { color: #1a7f37; }
    [data-color-mode="dark"] .hue-box-green > .hue-box-title { color: #3fb950; }

    .hue-blue { color: #0969da; }
    [data-color-mode="dark"] .hue-blue { color: #58a6ff; }
    .hue-bg-blue { background: #ddf4ff; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-blue { background: #0c2d6b; }
    .hue-box-blue { border-left-color: #0969da; background: #ddf4ff; }
    [data-color-mode="dark"] .hue-box-blue { border-left-color: #58a6ff; background: #0c2d6b; }
    .hue-box-blue > .hue-box-title { color: #0969da; }
    [data-color-mode="dark"] .hue-box-blue > .hue-box-title { color: #58a6ff; }

    .hue-purple { color: #8250df; }
    [data-color-mode="dark"] .hue-purple { color: #d2a8ff; }
    .hue-bg-purple { background: #fbefff; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-purple { background: #2b1145; }
    .hue-box-purple { border-left-color: #8250df; background: #fbefff; }
    [data-color-mode="dark"] .hue-box-purple { border-left-color: #d2a8ff; background: #2b1145; }
    .hue-box-purple > .hue-box-title { color: #8250df; }
    [data-color-mode="dark"] .hue-box-purple > .hue-box-title { color: #d2a8ff; }

    .hue-gray { color: #57606a; }
    [data-color-mode="dark"] .hue-gray { color: #8b949e; }
    .hue-bg-gray { background: #f6f8fa; padding: 0 .25em; border-radius: 3px; }
    [data-color-mode="dark"] .hue-bg-gray { background: #161b22; }
    .hue-box-gray { border-left-color: #57606a; background: #f6f8fa; }
    [data-color-mode="dark"] .hue-box-gray { border-left-color: #8b949e; background: #161b22; }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(HUE_CSS);
  } else {
    const styleEl = document.createElement('style');
    styleEl.textContent = HUE_CSS;
    document.head.appendChild(styleEl);
  }

  const COLOR_MAP = {
    red: 'red',
    orange: 'orange',
    yellow: 'yellow',
    green: 'green',
    blue: 'blue',
    purple: 'purple',
    gray: 'gray',
    ok: 'green',
    warn: 'orange',
    info: 'blue',
    note: 'purple',
    '!': 'red'
  };

  // Convert inline text spans: {token: text}
  function transformSpans(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      if (!text || text.indexOf('{') === -1) return;

      const spanRegex = /\{([a-zA-Z0-9_\-\s#]+?):((?:[^{}]|\{[^{}]*\})*)\}/g;
      if (!spanRegex.test(text)) return;
      spanRegex.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = spanRegex.exec(text)) !== null) {
        const spec = match[1].trim();
        const content = match[2];

        // Check tokens
        const tokens = spec.split(/\s+/);
        let valid = true;
        let fgClass = null;
        let bgClass = null;
        let customFg = null;
        let customBg = null;

        for (const token of tokens) {
          if (token.startsWith('bg-')) {
            const val = token.slice(3);
            if (COLOR_MAP[val]) bgClass = 'hue-bg-' + COLOR_MAP[val];
            else if (/^#[0-9a-fA-F]{3,6}$/.test(val)) customBg = val;
            else valid = false;
          } else {
            if (COLOR_MAP[token]) fgClass = 'hue-' + COLOR_MAP[token];
            else if (/^#[0-9a-fA-F]{3,6}$/.test(token)) customFg = token;
            else valid = false;
          }
        }

        if (!valid) continue;

        // Add preceding text
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        // Create span
        const span = document.createElement('span');
        span.className = 'hue ' + (fgClass || '') + ' ' + (bgClass || '');
        if (customFg) span.style.color = customFg;
        if (customBg) span.style.backgroundColor = customBg;
        span.textContent = content;
        fragment.appendChild(span);

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      if (fragment.childNodes.length > 0) {
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'PRE' || node.tagName === 'CODE') return;
      const children = Array.from(node.childNodes);
      for (const child of children) {
        transformSpans(child);
      }
    }
  }

  function parseBoxTop(line) {
    const m = line.match(/^\s*([┌╭\+])([─\-]+)(.*?)\s*$/);
    if (!m) return null;
    const left = m[1];
    let rest = m[3].trim();
    let right = null;
    if (rest.length > 0 && '┐╮+'.includes(rest[rest.length - 1])) {
      right = rest[rest.length - 1];
      rest = rest.slice(0, -1).trim();
    }
    if (right && (left === '+') !== (right === '+')) return null;
    rest = rest.replace(/[─\-]+$/, '').trim();
    let colorToken = '';
    let title = '';
    if (rest) {
      const parts = rest.split(/\s+/);
      if (parts[0] && (COLOR_MAP[parts[0]] || /^#[0-9a-fA-F]{3,6}$/.test(parts[0]))) {
        colorToken = parts[0];
        title = parts.slice(1).join(' ');
      } else {
        title = rest;
      }
    }
    return { left, colorToken, title };
  }

  // Convert preformatted ASCII/Unicode box fences
  function transformBoxes(container) {
    const pres = container.querySelectorAll('pre');
    for (const pre of pres) {
      const code = pre.querySelector('code');
      if (!code) continue;

      const text = code.innerText || code.textContent;
      const lines = text.split(/\r?\n/);
      if (lines.length < 3) continue;

      const top = parseBoxTop(lines[0]);
      const botMatch = lines[lines.length - 1].match(/^\s*(?:[└╰][─\-]+[┘╯]?|\+[─\-]+\+?)\s*$/);

      if (top && botMatch) {
        const color = top.colorToken ? (COLOR_MAP[top.colorToken] || 'gray') : 'gray';
        const title = top.title;

        const boxDiv = document.createElement('div');
        boxDiv.className = `hue-box hue-box-${color}`;

        if (title) {
          const titleDiv = document.createElement('div');
          titleDiv.className = 'hue-box-title';
          titleDiv.textContent = title;
          boxDiv.appendChild(titleDiv);
        }

        const bodyLines = lines.slice(1, -1).map(l => {
          return l.replace(/^\s*[│|]\s?/, '').replace(/\s?[│|]\s*$/, '');
        });

        const p = document.createElement('p');
        p.textContent = bodyLines.join('\n');
        boxDiv.appendChild(p);

        transformSpans(boxDiv);
        pre.parentNode.replaceChild(boxDiv, pre);
      }
    }
  }

  function processPage() {
    const containers = document.querySelectorAll('.markdown-body, [data-target="react-app.embedded-markdown"]');
    for (const c of containers) {
      if (c.dataset.hueProcessed) continue;
      c.dataset.hueProcessed = 'true';
      transformBoxes(c);
      transformSpans(c);
    }
  }

  // Initial pass
  processPage();

  // Handle GitHub SPA navigations (Turbo / PJAX)
  document.addEventListener('turbo:render', processPage);
  document.addEventListener('turbo:load', processPage);
  document.addEventListener('pjax:end', processPage);

  // MutationObserver for dynamic updates
  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldRun = true;
        break;
      }
    }
    if (shouldRun) processPage();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
