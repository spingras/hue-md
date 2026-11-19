// Color variables for one Joplin appearance, taken from the shared Hue palette.
//
// hue-md.css picks light or dark colors from the OS (prefers-color-scheme),
// but Joplin's theme is chosen in the app and can differ from the OS. The
// selector :root:root:root outranks every :root rule in hue-md.css, so these
// variables win and the colors always match the Joplin theme.

import { COLORS, PAGE } from '../../../src/palette.js'

export function themeCss (theme: any): string {
	const mode = theme && theme.appearance === 'dark' ? 'dark' : 'light'
	// Body text inside colored backgrounds follows the Joplin theme text color.
	const text = (theme && theme.color) || PAGE[mode].text
	const vars = Object.entries(COLORS)
		.map(([n, c]: [string, any]) => `  --hue-${n}: ${c[mode].fg};\n  --hue-${n}-bg: ${c[mode].bg};`)
		.join('\n')
	return `:root:root:root {
  --hue-text: ${text};
  --hue-neutral-bg: ${COLORS.gray[mode].bg};
${vars}
}
${JOPLIN_CSS}`
}

// Lists that mix Hue states with Joplin checkboxes: put Joplin's checkbox at the
// start of the item, where Hue draws its task boxes, so the column lines up.
const JOPLIN_CSS = `ul.hue-task-list > li.md-checkbox input[type=checkbox] { margin-left: 0; margin-right: 0.45em; }
`
