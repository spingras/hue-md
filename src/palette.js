// Single source of truth for Hue colors.
// `fg` is text color on the page background; `bg` is a light background shade
// that default body text must stay readable on. Both have light and dark values.

export const PAGE = {
  light: { bg: '#ffffff', text: '#1f2328' },
  dark: { bg: '#0d1117', text: '#e6edf3' }
}

export const COLORS = {
  red:    { light: { fg: '#b42318', bg: '#fde8e7' }, dark: { fg: '#ff7b72', bg: '#3d1614' } },
  orange: { light: { fg: '#b54708', bg: '#fdeedc' }, dark: { fg: '#ffa657', bg: '#3b2410' } },
  yellow: { light: { fg: '#7a5a00', bg: '#fdf6d3' }, dark: { fg: '#e3b341', bg: '#362b0a' } },
  green:  { light: { fg: '#067647', bg: '#dcf5e7' }, dark: { fg: '#3fb950', bg: '#0f2e1c' } },
  blue:   { light: { fg: '#175cd3', bg: '#e0ecfd' }, dark: { fg: '#58a6ff', bg: '#0f2444' } },
  purple: { light: { fg: '#6941c6', bg: '#efe7fd' }, dark: { fg: '#d2a8ff', bg: '#2a1b45' } },
  gray:   { light: { fg: '#57606a', bg: '#eef0f2' }, dark: { fg: '#8b949e', bg: '#21262d' } }
}

// Meaning first: semantic names resolve to a palette color.
export const SEMANTIC = {
  danger: 'red',
  '!': 'red',
  warn: 'orange',
  ok: 'green',
  info: 'blue',
  note: 'purple',
  muted: 'gray'
}

export function resolveColor (name) {
  if (Object.hasOwn(COLORS, name)) return name
  if (Object.hasOwn(SEMANTIC, name)) return SEMANTIC[name]
  return null
}
