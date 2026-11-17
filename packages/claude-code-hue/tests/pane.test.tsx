import { expect, test } from 'claude-code/testing'

const SAMPLE = [
  '# Launch',
  '',
  '## Show HN {ok: ready}',
  '',
  '- Reddit {warn: next week}',
  '',
  'Build: {ok: passing} · Deploy: {!: blocked}',
  '',
  '+-- warn Heads up',
  '| Check {warn: this} first.',
  '+--',
  '',
  '| Step | Status |',
  '| :--- | :--- |',
  '| Push | {ok: done} |',
  '',
  'Plain paragraph with **bold**.'
].join('\n')

const PANE = {
  plugin: 'hue-md',
  component: 'Pane',
  requestId: 'hue-md-preview',
  props: {
    title: 'Hue',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {}
  }
} as const

test('the pane renders spans, boxes and tables from a .hue.md file', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => ({ value: SAMPLE }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'hue-md:preview', args: 'notes.hue.md' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^passing$/ }))?.text).toBe('passing')
  expect((await ui.find({ type: 'Text', text: /^blocked$/ }))?.text).toBe('blocked')
  expect((await ui.find({ type: 'Text', text: /^Heads up$/ }))?.text).toBe('Heads up')
  expect((await ui.find({ type: 'Text', text: /^done$/ }))?.text).toBe('done')
  expect((await ui.find({ type: 'Text', text: /^ready$/ }))?.text).toBe('ready')
  expect((await ui.find({ type: 'Text', text: /^next week$/ }))?.text).toBe('next week')
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.unmount()
})

const TRICKY = [
  '+-- warn Two lines',
  '| First line.',
  '| Second line.',
  '+--',
  '',
  '```',
  'Post text.',
  '',
  '{ok: passing} stays literal here',
  '',
  '+-- info Note',
  '| Not a box inside a code block.',
  '+--',
  '```',
  '',
  '| Plain | Table |',
  '| :--- | :--- |',
  '| a | b |'
].join('\n')

test('code blocks stay whole, box lines keep their breaks, plain tables match Hue tables', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => ({ value: TRICKY }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'hue-md:preview', args: 'tricky.hue.md' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const markdown = await ui.findAll({ type: 'Markdown' })
  const fence = markdown.find((m) => String(m.props.text).startsWith('```'))
  expect(fence?.props.text).toContain('{ok: passing} stays literal here')
  expect(fence?.props.text).toContain('| Not a box inside a code block.')
  expect(await ui.find({ type: 'Text', text: /^passing$/ })).toBeUndefined()
  const box = markdown.find((m) => String(m.props.text).startsWith('First line.'))
  expect(box?.props.text).toBe('First line.  \nSecond line.')
  expect((await ui.find({ type: 'Text', text: /^Plain$/ }))?.text).toBe('Plain')
  await ui.unmount()
})

test('the pane explains itself before a file is chosen', async ($) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /hue-md:preview/ }))?.text).toMatch(/No file yet/)
  await ui.unmount()
})
