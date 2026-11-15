'use strict';

const obsidian = require('obsidian');

const COLORS = {
  red: 'red', orange: 'orange', yellow: 'yellow',
  green: 'green', blue: 'blue', purple: 'purple', gray: 'gray',
  danger: 'red', '!': 'red',
  warn: 'orange', warning: 'orange',
  ok: 'green', success: 'green',
  info: 'blue', tip: 'blue',
  note: 'purple', important: 'purple',
  muted: 'gray'
};

function resolveColor(name) {
  return Object.prototype.hasOwnProperty.call(COLORS, name) ? COLORS[name] : null;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function parseSpec(raw) {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  let fg = null;
  let bg = null;
  for (const w of words) {
    if (w.startsWith('bg-')) {
      const rest = w.slice(3);
      const c = resolveColor(rest);
      if (c) bg = { kind: 'palette', value: c };
      else if (HEX_RE.test(rest)) bg = { kind: 'hex', value: rest.toLowerCase() };
      else return null;
    } else {
      const c = resolveColor(w);
      if (c) fg = { kind: 'palette', value: c };
      else if (HEX_RE.test(w)) fg = { kind: 'hex', value: w.toLowerCase() };
      else return null;
    }
  }
  return { fg, bg };
}

function createHueSpan(spec, contentNodeOrText) {
  const span = document.createElement('span');
  const classes = ['hue'];
  const styles = [];
  if (spec.fg) {
    if (spec.fg.kind === 'palette') classes.push('hue-' + spec.fg.value);
    else styles.push('color:' + spec.fg.value);
  }
  if (spec.bg) {
    if (spec.bg.kind === 'palette') classes.push('hue-bg-' + spec.bg.value);
    else styles.push('background-color:' + spec.bg.value + ';padding:0 .2em;border-radius:3px');
  }
  span.className = classes.join(' ');
  if (styles.length) span.setAttribute('style', styles.join(';'));
  if (typeof contentNodeOrText === 'string') {
    span.textContent = contentNodeOrText;
  } else {
    span.appendChild(contentNodeOrText);
  }
  return span;
}

function transformTextNode(textNode) {
  const text = textNode.nodeValue;
  if (!text || !text.includes('{') || !text.includes(':')) return;
  const re = /\{([!a-zA-Z0-9_\-#\s]+):\s*([^{}]+)\}/g;
  let match;
  let lastIdx = 0;
  let frag = null;

  while ((match = re.exec(text)) !== null) {
    const spec = parseSpec(match[1]);
    if (!spec) continue;
    if (!frag) frag = document.createDocumentFragment();
    if (match.index > lastIdx) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    frag.appendChild(createHueSpan(spec, match[2]));
    lastIdx = match.index + match[0].length;
  }

  if (frag) {
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

function transformBoxParagraph(p) {
  const rawText = p.textContent || '';
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 2) return false;

  const topM = lines[0].match(/^([┌╭+])([─\-]{2,})(.*?)\s*$/);
  const botM = lines[lines.length - 1].match(/^(?:[└╰][─\-]{2,}[┘╯]?|\+[─\-]{2,}\+?)\s*$/);
  if (!topM || !botM) return false;

  const bodyLines = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const l = lines[i];
    if (!/^[│|]/.test(l)) return false;
    bodyLines.push(l.replace(/^[│|] ?/, '').replace(/ ?[│|]\s*$/, ''));
  }

  let rest = topM[3].trim();
  if (rest && '┐╮+'.includes(rest[rest.length - 1])) rest = rest.slice(0, -1).trim();
  rest = rest.replace(/[─\-]+$/, '').trim();

  const words = rest ? rest.split(/\s+/) : [];
  let color = null;
  let idx = 0;
  if (words[0]) {
    const c = resolveColor(words[0]);
    if (c) {
      color = c;
      idx = 1;
    }
  }
  const title = words.slice(idx).join(' ');

  const box = document.createElement('div');
  box.className = 'hue-box' + (color ? ' hue-box-' + color : '');
  box.setAttribute('role', 'note');

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'hue-box-title';
    titleEl.textContent = title;
    box.appendChild(titleEl);
  }

  const bodyP = document.createElement('p');
  bodyP.textContent = bodyLines.join('\n');
  box.appendChild(bodyP);

  p.parentNode.replaceChild(box, p);
  walkInlineSpans(box);
  return true;
}

function walkInlineSpans(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code, pre, a, script, style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) nodes.push(current);
  for (const n of nodes) transformTextNode(n);
}

class HueMdPlugin extends obsidian.Plugin {
  async onload() {
    this.registerMarkdownPostProcessor((el) => {
      const paragraphs = Array.from(el.querySelectorAll('p'));
      for (const p of paragraphs) {
        transformBoxParagraph(p);
      }
      walkInlineSpans(el);
    });

    const kinds = [
      { id: 'info', label: 'Info Box (+-- info)', token: 'info', title: 'Pro Tip' },
      { id: 'ok', label: 'Success Box (+-- ok)', token: 'ok', title: 'Success' },
      { id: 'note', label: 'Important Note Box (+-- note)', token: 'note', title: 'Important Detail' },
      { id: 'warn', label: 'Warning Box (+-- warn)', token: 'warn', title: 'Heads Up' },
      { id: 'danger', label: 'Danger Box (+-- !)', token: '!', title: 'Critical Warning' }
    ];

    for (const k of kinds) {
      this.addCommand({
        id: 'insert-box-' + k.id,
        name: 'Insert ' + k.label,
        editorCallback: (editor) => {
          const sel = editor.getSelection();
          const body = sel
            ? sel.split(/\r?\n/).map((l) => '| ' + l).join('\n')
            : '| First point\n| Second point';
          const box = `+-- ${k.token} ${k.title}\n${body}\n+--\n`;
          editor.replaceSelection(box);
        }
      });
    }
  }
}

module.exports = HueMdPlugin;
