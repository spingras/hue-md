// Markdown-it content script for Joplin's note viewer.
//
// Registers the real Hue parser (src/index.js at the repo root) on Joplin's
// markdown-it instance, so notes render exactly like every other Hue surface.
// webpack bundles the parser into dist/contentScript.js at build time.

import hue from '../../../src/index.js'
import { themeCss } from './themeCss'

// `- [ ]` and `- [x]` items: Joplin renders these as clickable checkboxes that
// tick the note source, so Hue leaves them to Joplin. Hue's own states
// (`[-]`, `[!]`, `[?]`) still render as Hue task boxes.
const JOPLIN_TASK_RE = /^\[[ xX]\](?=\s)/
const HIDE = '\u0000'

// Wraps Hue's task rule so it skips the items Joplin's checkbox rule handles.
// The wrapper hides their marker for one pass and restores it afterwards.
function keepJoplinCheckboxes (markdownIt) {
	const rule = markdownIt.core.ruler.__rules__.find((r) => r.name === 'hue_tasks')
	if (!rule) return
	const hueTasks = rule.fn
	markdownIt.core.ruler.at('hue_tasks', function hue_tasks_joplin (state) {
		const hidden = []
		const tokens = state.tokens
		for (let i = 2; i < tokens.length; i++) {
			if (tokens[i].type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
			const first = tokens[i].children && tokens[i].children[0]
			if (first && first.type === 'text' && JOPLIN_TASK_RE.test(first.content)) {
				first.content = HIDE + first.content
				hidden.push(first)
			}
		}
		try {
			return hueTasks(state)
		} finally {
			for (const t of hidden) t.content = t.content.slice(HIDE.length)
		}
	})
}

// With Joplin's default "soft breaks" setting off, markdown-it runs with
// `breaks: true` and renders each newline as "<br>\n". Hue boxes keep newlines
// visible (white-space: pre-line), so that newline would add a second, empty
// line. Render the break as a bare <br>; it looks the same everywhere else.
function singleLineBreaks (markdownIt) {
	const softbreak = markdownIt.renderer.rules.softbreak
	markdownIt.renderer.rules.softbreak = function (tokens, idx, options, env, self) {
		if (options.breaks) return options.xhtmlOut ? '<br />' : '<br>'
		return softbreak ? softbreak(tokens, idx, options, env, self) : '\n'
	}
}

export default function (context) {
	return {
		plugin (markdownIt) {
			markdownIt.use(hue)
			keepJoplinCheckboxes(markdownIt)
			singleLineBreaks(markdownIt)
		},
		// Joplin calls assets() with its current theme. The stylesheet holds the
		// layout rules; the inline CSS pins the color variables to the Joplin
		// theme (light or dark), whatever the OS color scheme says.
		assets (theme) {
			return [
				{ name: 'hue-md.css' },
				{ inline: true, mime: 'text/css', text: themeCss(theme) }
			]
		}
	}
}
