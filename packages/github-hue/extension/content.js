// Hue Markdown content script for GitHub
(function () {
  'use strict';

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

        const tokens = spec.split(/\s+/);
        let valid = true;
        let fgClass = null;
        let bgClass = null;
        let customFg = null;
        let customBg = null;

        for (const token of tokens) {
          if (token.startsWith('bg-')) {
            const val = token.slice(3);
            if (Object.hasOwn(COLOR_MAP, val)) bgClass = 'hue-bg-' + COLOR_MAP[val];
            else if (/^#[0-9a-fA-F]{3,6}$/.test(val)) customBg = val;
            else valid = false;
          } else {
            if (Object.hasOwn(COLOR_MAP, token)) fgClass = 'hue-' + COLOR_MAP[token];
            else if (/^#[0-9a-fA-F]{3,6}$/.test(token)) customFg = token;
            else valid = false;
          }
        }

        if (!valid) continue;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

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
      if (parts[0] && (Object.hasOwn(COLOR_MAP, parts[0]) || /^#[0-9a-fA-F]{3,6}$/.test(parts[0]))) {
        colorToken = parts[0];
        title = parts.slice(1).join(' ');
      } else {
        title = rest;
      }
    }
    return { left, colorToken, title };
  }

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

  processPage();

  document.addEventListener('turbo:render', processPage);
  document.addEventListener('turbo:load', processPage);
  document.addEventListener('pjax:end', processPage);

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
