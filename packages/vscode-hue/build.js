import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function run () {
  mkdirSync(resolve(__dirname, 'dist'), { recursive: true })

  const entry = resolve(__dirname, 'src/extension.js')
  const out = resolve(__dirname, 'dist/extension.cjs')

  execSync(`npx esbuild "${entry}" --bundle --platform=node --target=node18 --format=cjs --outfile="${out}" --external:vscode --sourcemap`, {
    stdio: 'inherit'
  })

  console.log('✓ Bundled vscode-hue into dist/extension.cjs')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
