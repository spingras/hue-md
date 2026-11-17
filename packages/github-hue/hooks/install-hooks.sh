#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GIT_HOOKS_DIR="$SCRIPT_DIR/../../.git/hooks"

if [ -d "$GIT_HOOKS_DIR" ]; then
  cp "$SCRIPT_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
  chmod +x "$GIT_HOOKS_DIR/pre-commit"
  echo "✓ Installed Hue pre-commit hook to $GIT_HOOKS_DIR/pre-commit"
else
  echo "Warning: .git/hooks directory not found."
fi
