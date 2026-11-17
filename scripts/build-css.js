import { mkdirSync, writeFileSync } from 'node:fs'
import { css } from '../src/index.js'
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true })
mkdirSync(new URL('../packages/vscode-hue/media/', import.meta.url), { recursive: true })
writeFileSync(new URL('../dist/hue-md.css', import.meta.url), css())
writeFileSync(new URL('../dist/hue.css', import.meta.url), css())
writeFileSync(new URL('../packages/vscode-hue/media/hue.css', import.meta.url), css())
console.log('wrote dist/hue-md.css, dist/hue.css, and packages/vscode-hue/media/hue.css')
