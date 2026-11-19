// Guards against main promising what the latest GitHub release does not have.
//
// 1. Every download link (releases/latest/download/<file>) in the READMEs and
//    on the website must exist as an asset of the latest release.
// 2. Files that ship inside the release (platform zips, CLI, extension) may not
//    change on main without a release tag: otherwise the site and READMEs
//    describe features the downloads do not have yet.
//
// Run: node scripts/check-release-sync.js            (CI on main, before every push)
//      node scripts/check-release-sync.js --dir dist/release
//                                                     (release workflow: links vs the built files)
// A commit that carries a v* tag skips both checks: the release workflow
// builds its assets and runs this script with --dir.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'spingras/hue-md'

// Paths whose contents end up in a release asset or on npm.
export const SHIPPED = [
  'src/',
  'bin/',
  'spec/spec.md',
  'packages/md-hue/src/',
  'packages/md-hue/bin/',
  'packages/vscode-hue/',
  'packages/notepadpp-hue/',
  'packages/obsidian-hue/',
  'packages/joplin-hue/',
  'packages/nvim-hue/',
  'packages/emacs-hue/',
  'packages/github-hue/extension/',
  'packages/github-hue/userscript/',
  'packages/github-hue/src/',
  'snippets/',
  'scripts/package-release.ps1'
]
const NOT_SHIPPED = /(^|\/)(test|tests)\//

export function isShipped (file) {
  return SHIPPED.some((p) => file.startsWith(p)) && !NOT_SHIPPED.test(file)
}

// Download file names linked from a text.
export function downloadLinks (text) {
  const names = new Set()
  for (const m of text.matchAll(/releases\/latest\/download\/([A-Za-z0-9._-]+)/g)) names.add(m[1])
  for (const m of text.matchAll(/\bREL \+ '([^']+)'/g)) names.add(m[1])
  return names
}

function linkSources () {
  const files = ['README.md', 'README.hue.md', 'scripts/render-demo.js', 'snippets/README.md']
  for (const dir of fs.readdirSync(path.join(root, 'packages'))) {
    const f = `packages/${dir}/README.md`
    if (fs.existsSync(path.join(root, f))) files.push(f)
  }
  return files.filter((f) => fs.existsSync(path.join(root, f)))
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

async function latestRelease () {
  const headers = { 'User-Agent': 'hue-md-release-check', Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers })
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for the latest release`)
  const json = await res.json()
  return { tag: json.tag_name, assets: new Set(json.assets.map((a) => a.name)) }
}

async function main () {
  const dirArg = process.argv.indexOf('--dir')
  const problems = []

  if (dirArg === -1 && git('tag', '--points-at', 'HEAD').split('\n').some((t) => /^v\d/.test(t))) {
    console.log('HEAD is a release tag: the release workflow checks it with --dir.')
    return
  }

  let assets, tag
  if (dirArg !== -1) {
    const dir = path.resolve(root, process.argv[dirArg + 1])
    assets = new Set(fs.readdirSync(dir))
    tag = `built files in ${path.relative(root, dir)}`
  } else {
    const rel = await latestRelease()
    assets = rel.assets
    tag = `release ${rel.tag}`
  }

  for (const file of linkSources()) {
    for (const name of downloadLinks(fs.readFileSync(path.join(root, file), 'utf8'))) {
      if (!assets.has(name)) problems.push(`${file} links to ${name}, which is not in the ${tag}`)
    }
  }

  if (dirArg === -1) {
    const rel = tag.replace('release ', '')
    let changed = []
    try {
      changed = git('diff', '--name-only', `${rel}..HEAD`).split('\n').filter(Boolean).filter(isShipped)
    } catch {
      problems.push(`cannot compare with tag ${rel}: fetch tags first (git fetch --tags)`)
    }
    if (changed.length) {
      problems.push(`${changed.length} shipped file(s) changed since ${rel} without a new release tag:\n    ` +
        changed.slice(0, 15).join('\n    ') + (changed.length > 15 ? `\n    … and ${changed.length - 15} more` : '') +
        '\n  Ship them as a release (one commit + its tag, pushed together), or keep them off main.')
    }
  }

  if (problems.length) {
    console.error('Release sync check FAILED:\n- ' + problems.join('\n- '))
    process.exit(1)
  }
  console.log(`Release sync check passed against the ${tag}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1) })
}
