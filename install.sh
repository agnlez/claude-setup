#!/usr/bin/env bash
# claude-setup installer bootstrap.
# Verifies Node.js, downloads install.mjs + manifest.json from GitHub,
# then re-execs into Node with stdin reattached to a TTY when possible.
set -eu

REPO_OWNER="agnlez"
REPO_NAME="claude-setup"
REF="${CLAUDE_SETUP_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REF}"

die() { printf '%s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js >=18 is required. Install: https://nodejs.org"
command -v curl >/dev/null 2>&1 || die "curl is required."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js >=18 is required (found $(node -v))."
fi

TMP=$(mktemp -d 2>/dev/null || mktemp -d -t 'claude-setup')
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW_BASE/install.mjs"   -o "$TMP/install.mjs"   || die "Failed to download install.mjs from $RAW_BASE"
curl -fsSL "$RAW_BASE/manifest.json" -o "$TMP/manifest.json" || die "Failed to download manifest.json from $RAW_BASE"

if [ -t 0 ]; then
  exec node "$TMP/install.mjs" "$@"
elif [ -e /dev/tty ]; then
  exec node "$TMP/install.mjs" "$@" </dev/tty
else
  exec node "$TMP/install.mjs" --non-interactive "$@"
fi
