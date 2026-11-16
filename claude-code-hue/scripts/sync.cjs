#!/usr/bin/env node
// Usage: node sync.cjs <file.hue.md> [--force]
'use strict'

const { syncFile } = require('./sync-lib.cjs')

const args = process.argv.slice(2)
const force = args.includes('--force')
const file = args.find((a) => a !== '--force')

if (!file) {
  console.error('Usage: node sync.cjs <file.hue.md> [--force]')
  process.exit(2)
}

try {
  const r = syncFile(file, { force })
  if (r.status === 'written') console.log(`Wrote ${r.target}`)
  else {
    console.error(`Not written: ${r.reason}.${r.status === 'refused' ? ' Run again with --force to overwrite it.' : ''}`)
    process.exit(1)
  }
} catch (err) {
  console.error(`hue-md: ${err.message}`)
  process.exit(1)
}
