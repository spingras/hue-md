#!/usr/bin/env bash
# Publishes a mirror made by scripts/build-mirror.js to its own GitHub repository:
# the generated tree as one commit on main and a tag equal to the version
# (Obsidian wants "0.2.6", not "v0.2.6"). The tag starts the mirror's own
# release workflow, which builds main.js, manifest.json and styles.css from
# that repository's source and attaches them to a GitHub release there.
# Run by .github/workflows/mirrors.yml after "Release Hue MD Artifacts" succeeded.
#
#   bash scripts/publish-mirror.sh <mirror dir> <owner/repo>
#
# Environment:
#   DEPLOY_KEY_FILE  private SSH deploy key with write access to <owner/repo> only
#   DRY_RUN          "true" (default): build the commit, show what changes, push nothing
#   MIRROR_URL       clone URL, for a local test against a bare repository
set -euo pipefail

src=$(cd "$1" && pwd)
repo="$2"
dry="${DRY_RUN:-true}"
version=$(cd "$src" && node -p "require('./manifest.json').version")
here=$(pwd)

[ -f "$src/.hue-mirror" ] || { echo "$src was not made by scripts/build-mirror.js"; exit 1; }

# The mirror follows releases, never main: publish only from the commit tagged v<version>.
if [ "$dry" != "true" ]; then
  tag=$(git describe --exact-match --tags HEAD 2>/dev/null || true)
  [ "$tag" = "v$version" ] || { echo "HEAD is tagged '${tag:-nothing}', not v$version: refusing to publish"; exit 1; }
fi

url="${MIRROR_URL:-}"
if [ -z "$url" ]; then
  if [ -n "${DEPLOY_KEY_FILE:-}" ]; then
    url="git@github.com:${repo}.git"
    export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY_FILE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  elif [ "$dry" = "true" ]; then
    url="https://github.com/${repo}.git"
  else
    echo "DEPLOY_KEY_FILE is empty: add the MIRROR_DEPLOY_KEY secret"; exit 1
  fi
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git clone --quiet "$url" "$work"
cd "$work"
git checkout --quiet -B main

# Replace the tracked tree with the generated one (its .gitignore keeps the built files out).
git ls-files -z | xargs -0 -r git rm -q
cp -a "$src"/. .
rm -f .hue-mirror main.js styles.css
git add -A

sha="${GITHUB_SHA:-$(git -C "$here" rev-parse HEAD)}"
changed=true
git diff --cached --quiet && changed=false
echo "Changes for $repo $version:"
git status --short

if [ "$dry" = "true" ]; then
  echo "DRY_RUN: nothing pushed."
  exit 0
fi

if $changed; then
  git -c user.name="spingras" -c user.email="spingras@users.noreply.github.com" \
    commit --quiet -m "Hue MD for Obsidian $version" -m "Generated from spingras/hue-md@$sha by scripts/build-mirror.js. Edit the source there; this repository is overwritten on every release."
fi

if git ls-remote --exit-code --tags origin "refs/tags/$version" >/dev/null; then
  echo "Tag $version already exists on $repo: not moved."
  if $changed; then echo "but the generated tree differs from what is on main there"; exit 1; fi
else
  git tag "$version"
  git push --quiet --atomic origin main "refs/tags/$version"
  echo "Pushed main and tag $version to $repo; its release workflow builds and attaches the plugin files."
fi
