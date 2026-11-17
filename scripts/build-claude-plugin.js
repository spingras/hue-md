// Bundles the hue-md CLI into packages/claude-code-hue/scripts/hue-md.cjs, so the Claude
// Code plugin runs offline and matches this repository's parser.
// Run after changing src/ or packages/md-hue/src/: npm run build:claude
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entry = resolve(root, 'packages/md-hue/bin/md-hue.js')
const outfile = resolve(root, 'packages/claude-code-hue/scripts/hue-md.cjs')

execSync(`npx esbuild "${entry}" --bundle --platform=node --target=node18 --format=cjs --legal-comments=none --outfile="${outfile}"`, { stdio: 'inherit' })
console.log('✓ Bundled hue-md into packages/claude-code-hue/scripts/hue-md.cjs')
