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
import { MAX_SPEC_LEN, parseSpec, parseTop, BOX_BOTTOM } from 'markdown-it-hue/core'

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
        if (!parseSpec(spec)) return nok(code)
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

/**
 * micromark extension for Hue Markdown.
 * @returns {import('micromark-util-types').Extension}
 */
export function hue () {
  const flow = {}
  for (const c of TOP_CORNERS) flow[c] = hueBox
  return { text: { [LEFT_BRACE]: hueSpan }, flow }
}
