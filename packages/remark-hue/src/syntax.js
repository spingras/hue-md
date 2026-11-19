// micromark syntax extension for Hue Markdown: spans `{red: text}` and drawn boxes.
//
// Spans: micromark feeds a paragraph to the text tokenizer one line at a time,
// so a span cannot look ahead in a string the way the markdown-it plugin does.
// Instead a `check` scans forward for the matching `}`, delegating to
// micromark's own code-span, autolink, raw-HTML and escape constructs, so
// braces inside those don't count (as the spec requires). If a match exists,
// the content is emitted as its own text chunk: links and emphasis inside it
// are parsed in isolation and can't cross the span boundary.
//
// Boxes: a flow construct that validates the drawn border line by line. The
// interior (sides stripped) is emitted as a linked `document` chunk, so it is
// parsed as a full nested document: lists, quotes, code and nested boxes.
import { autolink, characterEscape, codeText, htmlText } from 'micromark-core-commonmark'
import { markdownLineEnding, markdownSpace } from 'micromark-util-character'
import { MAX_SPEC_LEN, parseSpec, parseTop, BOX_BOTTOM, BOX_SIDE, findBoxColumnStarts, isValidKeycap, matchProgressBar } from 'markdown-it-hue/core'

const EOF = null
const LEFT_BRACE = 123
const RIGHT_BRACE = 125
const COLON = 58
const BACKSLASH = 92
const GRAVE = 96
const LESS_THAN = 60
const SPACE = 32
const PLUS = 43
const PIPE = 124
const BOX_LIGHT_VERTICAL = 0x2502 // │
const TOP_CORNERS = [0x250c, 0x256d, PLUS] // ┌ ╭ +
const BOTTOM_CORNERS = [0x2514, 0x2570, PLUS] // └ ╰ +

// Code -> character, for collecting line text (tabs and virtual spaces become spaces).
const char = (code) => (code === -2 || code === -1 ? ' ' : code < 0 ? '' : String.fromCodePoint(code))

// ---------------------------------------------------------------- spans

// `{+: added}` and `{-: removed}`: a span whose spec is a single + or -.
export const isDiffSpec = (spec) => /^\s*[+-]\s*$/.test(spec)

const hueSpan = { name: 'hueSpan', tokenize: tokenizeSpan }

function tokenizeSpan (effects, ok, nok) {
  const self = this
  let closeOffset = -1
  let spec = ''
  let previous

  // Lookahead: is there a valid head and a matching `}`? Records where it is.
  const scan = { partial: true, tokenize: tokenizeScan }
  function tokenizeScan (effects, ok, nok) {
    let depth = 1
    let headLen = 0
    let hasContent = false
    return function start (code) {
      effects.enter('hueSpanScan')
      effects.consume(code) // {
      return head
    }
    function head (code) {
      if (code === COLON) {
        // a color style, or + / - for a diff span
        if (!parseSpec(spec) && !isDiffSpec(spec)) return nok(code)
        effects.consume(code)
        return spaces
      }
      if (code === EOF || markdownLineEnding(code) || code === LEFT_BRACE || code === RIGHT_BRACE || ++headLen > MAX_SPEC_LEN) return nok(code)
      spec += char(code)
      effects.consume(code)
      return head
    }
    function spaces (code) {
      if (code === SPACE) { effects.consume(code); return spaces }
      return body(code)
    }
    function body (code) {
      if (code === EOF) return nok(code)
      if (code === RIGHT_BRACE && --depth === 0) {
        if (!hasContent) return nok(code)
        closeOffset = self.now().offset
        effects.exit('hueSpanScan')
        return ok(code)
      }
      hasContent = true
      if (code === LEFT_BRACE) depth++
      if (code === BACKSLASH) return effects.attempt(characterEscape, body, consumeOne)(code)
      if (code === GRAVE) return effects.attempt(codeText, body, backtickRun)(code)
      if (code === LESS_THAN) return effects.attempt(autolink, body, effects.attempt(htmlText, body, consumeOne))(code)
      return consumeOne(code)
    }
    function consumeOne (code) {
      effects.consume(code)
      return body
    }
    // An unmatched backtick run is literal as a whole
    function backtickRun (code) {
      if (code === GRAVE) { effects.consume(code); return backtickRun }
      return body(code)
    }
  }

  return function start (code) {
    return effects.check(scan, open, nok)(code)
  }

  function open (code) {
    effects.enter('hueSpan')
    effects.enter('hueSpanMarker')
    effects.consume(code) // {
    return openHead
  }
  function openHead (code) {
    effects.consume(code)
    if (code === COLON) return openSpaces
    return openHead
  }
  function openSpaces (code) {
    if (code === SPACE) { effects.consume(code); return openSpaces }
    effects.exit('hueSpanMarker')
    return atBreak(code)
  }
  // Content: one linked text chunk per line, each ending with its line ending
  // (the shape micromark's subtokenizer expects, as for paragraph lines).
  function atBreak (code) {
    if (self.now().offset === closeOffset) return close(code)
    const token = effects.enter('chunkText', { contentType: 'text', previous })
    if (previous) previous.next = token
    previous = token
    return data(code)
  }
  function data (code) {
    if (self.now().offset === closeOffset) {
      effects.exit('chunkText')
      return close(code)
    }
    effects.consume(code)
    if (markdownLineEnding(code)) {
      effects.exit('chunkText')
      return atBreak
    }
    return data
  }
  function close (code) {
    effects.enter('hueSpanMarker')
    effects.consume(code) // }
    effects.exit('hueSpanMarker')
    effects.exit('hueSpan')
    return ok
  }
}

// ---------------------------------------------------------------- boxes

// A box validates its drawn border line by line and records the raw lines on
// the token (`_hueLines`). The interior can't be a micromark chunk: the right
// border sits between the content and the line ending, and a chunk can't skip
// characters. So mdast building parses the stripped interior as a nested
// document instead, exactly like the markdown-it plugin.
const hueBox = { name: 'hueBox', tokenize: tokenizeBox, concrete: true }

function tokenizeBox (effects, ok, nok) {
  const self = this
  const lines = []
  let line = ''
  let box

  return function start (code) {
    box = effects.enter('hueBox')
    effects.enter('hueBoxLine')
    return top(code)
  }

  function top (code) {
    if (code === EOF || markdownLineEnding(code)) {
      effects.exit('hueBoxLine')
      if (!parseTop(line.trimEnd()) || code === EOF) return nok(code)
      lines.push(line)
      return lineEnd(code)
    }
    line += char(code)
    effects.consume(code)
    return top
  }

  function lineEnd (code) {
    effects.enter('lineEnding')
    effects.consume(code)
    effects.exit('lineEnding')
    return lineStart
  }

  function lineStart (code) {
    // A lazy line (e.g. missing "> " inside a quote) ends the container, so this isn't a box
    if (self.parser.lazy[self.now().line] || code === EOF || markdownLineEnding(code)) return nok(code)
    line = ''
    if (markdownSpace(code)) {
      effects.enter('linePrefix')
      return indent(code)
    }
    return border(code)
  }
  function indent (code) {
    if (markdownSpace(code)) { effects.consume(code); return indent }
    effects.exit('linePrefix')
    return border(code)
  }

  function border (code) {
    if (code === BOX_LIGHT_VERTICAL || code === PIPE) {
      effects.enter('hueBoxLine')
      return interior(code)
    }
    if (BOTTOM_CORNERS.includes(code)) {
      effects.enter('hueBoxLine')
      return bottom(code)
    }
    return nok(code)
  }

  function interior (code) {
    if (code === EOF) return nok(code)
    if (markdownLineEnding(code)) {
      effects.exit('hueBoxLine')
      lines.push(line)
      return lineEnd(code)
    }
    line += char(code)
    effects.consume(code)
    return interior
  }

  function bottom (code) {
    if (code === EOF || markdownLineEnding(code)) {
      effects.exit('hueBoxLine')
      if (!BOX_BOTTOM.test(line)) return nok(code)
      lines.push(line)
      box._hueLines = lines
      effects.exit('hueBox')
      return ok(code)
    }
    line += char(code)
    effects.consume(code)
    return bottom
  }
}

// ---------------------------------------------------------------- v0.2: key caps ([[Ctrl+C]])

const LEFT_BRACKET = 91
const RIGHT_BRACKET = 93
const LEFT_PAREN = 40
const isAsciiAlnum = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

const hueKbd = { name: 'hueKbd', tokenize: tokenizeKbd, add: 'before' }

function tokenizeKbd (effects, ok, nok) {
  const self = this
  let key = ''
  let length = 0

  return function start (code) {
    const prev = self.previous
    if (prev === LEFT_BRACKET || prev === RIGHT_BRACKET || isAsciiAlnum(prev)) return nok(code)
    effects.enter('hueKbd')
    effects.enter('hueKbdMarker')
    effects.consume(code) // [
    return second
  }
  function second (code) {
    if (code !== LEFT_BRACKET) return nok(code)
    effects.consume(code)
    effects.exit('hueKbdMarker')
    effects.enter('hueKbdText')
    return inside
  }
  function inside (code) {
    if (code === RIGHT_BRACKET) {
      effects.exit('hueKbdText')
      effects.enter('hueKbdMarker')
      effects.consume(code)
      return close
    }
    if (code === EOF || markdownLineEnding(code) || code === LEFT_BRACKET || ++length > 32) return nok(code)
    key += char(code)
    effects.consume(code)
    return inside
  }
  function close (code) {
    if (code !== RIGHT_BRACKET) return nok(code)
    effects.consume(code)
    effects.exit('hueKbdMarker')
    return after
  }
  // `[[Key]]` directly followed by `]` or `(` is something else (a link, nested brackets)
  function after (code) {
    if (code === RIGHT_BRACKET || code === LEFT_PAREN || !isValidKeycap(key)) return nok(code)
    effects.exit('hueKbd')
    return ok(code)
  }
}

// ---------------------------------------------------------------- v0.2: progress bars ([======....] 60%)

const BAR_CHARS = new Set([...'=#■█.-_░ '].map((c) => c.codePointAt(0)))
const isDigit = (c) => c >= 48 && c <= 57

const hueProgress = { name: 'hueProgress', tokenize: tokenizeProgress, add: 'before' }

// Consumes `[bar] NN%` and lets the shared matchProgressBar (src/core.js) decide.
function tokenizeProgress (effects, ok, nok) {
  const self = this
  let raw = ''
  let barLength = 0
  let digits = 0

  return function start (code) {
    if (self.previous === LEFT_BRACKET) return nok(code)
    effects.enter('hueProgress')
    raw += '['
    effects.consume(code)
    return bar
  }
  function bar (code) {
    if (code === RIGHT_BRACKET) { raw += ']'; effects.consume(code); return spaces }
    if (!BAR_CHARS.has(code) || ++barLength > 80) return nok(code)
    raw += char(code)
    effects.consume(code)
    return bar
  }
  function spaces (code) {
    if (markdownSpace(code)) { raw += char(code); effects.consume(code); return spaces }
    return number(code)
  }
  function number (code) {
    if (isDigit(code) && digits < 3) { digits++; raw += char(code); effects.consume(code); return number }
    if (code !== 37 /* % */ || digits === 0) return nok(code)
    raw += '%'
    effects.consume(code)
    return after
  }
  function after (code) {
    const hit = matchProgressBar(raw + (code === LEFT_PAREN ? '(' : code === LEFT_BRACKET ? '[' : ''), 0, raw.length + 1)
    if (!hit || hit.endPos !== raw.length) return nok(code)
    effects.exit('hueProgress')
    return ok(code)
  }
}

// ---------------------------------------------------------------- v0.2: side-by-side boxes

// Boxes on the same lines, two or more spaces apart. Every line is cut into
// columns where the boxes start on the top line (src/core.js parseSplitBoxes);
// mdast building turns the recorded lines into hueColumns of hueBoxes.
const hueSplitBox = { name: 'hueSplitBox', tokenize: tokenizeSplitBox, concrete: true }

function tokenizeSplitBox (effects, ok, nok) {
  const self = this
  const lines = []
  let line = ''
  let box
  let startColumn
  let starts
  let closed

  return function start (code) {
    startColumn = self.now().column
    box = effects.enter('hueBox')
    effects.enter('hueBoxLine')
    return top(code)
  }

  function top (code) {
    if (code === EOF || markdownLineEnding(code)) {
      effects.exit('hueBoxLine')
      starts = findBoxColumnStarts(line)
      if (code === EOF || starts.length < 2) return nok(code)
      for (let k = 0; k < starts.length; k++) {
        if (!parseTop(line.slice(starts[k], starts[k + 1]).trimEnd())) return nok(code)
      }
      closed = starts.map(() => false)
      lines.push(line)
      return lineEnd(code)
    }
    line += char(code)
    effects.consume(code)
    return top
  }

  function lineEnd (code) {
    effects.enter('lineEnding')
    effects.consume(code)
    effects.exit('lineEnding')
    return lineStart
  }

  function lineStart (code) {
    if (self.parser.lazy[self.now().line] || code === EOF || markdownLineEnding(code)) return nok(code)
    if (markdownSpace(code)) {
      effects.enter('linePrefix')
      return indent(code)
    }
    return content(code)
  }
  function indent (code) {
    if (markdownSpace(code)) { effects.consume(code); return indent }
    effects.exit('linePrefix')
    if (code === EOF || markdownLineEnding(code)) return nok(code)
    return content(code)
  }

  // Column positions count from where the top line starts.
  function content (code) {
    line = ' '.repeat(Math.max(0, self.now().column - startColumn))
    effects.enter('hueBoxLine')
    return rest(code)
  }

  function rest (code) {
    if (code === EOF || markdownLineEnding(code)) {
      effects.exit('hueBoxLine')
      for (let k = 0; k < starts.length; k++) {
        const seg = (k < starts.length - 1 ? line.slice(starts[k], starts[k + 1]) : line.slice(starts[k])).trimEnd()
        if (closed[k]) {
          if (seg.trim() !== '') return nok(code)
        } else if (BOX_BOTTOM.test(seg)) {
          closed[k] = true
        } else if (!BOX_SIDE.test(seg)) {
          return nok(code)
        }
      }
      lines.push(line)
      if (closed.every(Boolean)) {
        box._hueLines = lines
        box._hueSplit = true
        effects.exit('hueBox')
        return ok(code)
      }
      if (code === EOF) return nok(code)
      return lineEnd(code)
    }
    line += char(code)
    effects.consume(code)
    return rest
  }
}

/**
 * micromark extension for Hue Markdown.
 * @returns {import('micromark-util-types').Extension}
 */
export function hue () {
  const flow = {}
  // Side-by-side boxes first, as in the markdown-it plugin
  for (const c of TOP_CORNERS) flow[c] = [hueSplitBox, hueBox]
  return { text: { [LEFT_BRACE]: hueSpan, [LEFT_BRACKET]: [hueProgress, hueKbd] }, flow }
}
