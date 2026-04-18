#!/usr/bin/env bash
# claude-setup installer bootstrap.
# Verifies Node.js, downloads the repo tarball from GitHub, extracts it,
# then re-execs into Node with stdin reattached to a TTY when possible.
set -eu

REPO_OWNER="agnlez"
REPO_NAME="claude-setup"
REF="${CLAUDE_SETUP_REF:-main}"
TARBALL_URL="https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/tar.gz/${REF}"

die() { printf '%s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js >=18 is required. Install: https://nodejs.org"
command -v curl >/dev/null 2>&1 || die "curl is required."
command -v tar  >/dev/null 2>&1 || die "tar is required."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js >=18 is required (found $(node -v))."
fi

TMP=$(mktemp -d 2>/dev/null || mktemp -d -t 'claude-setup')
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMP" --strip-components=1 \
  || die "Failed to download or extract tarball from $TARBALL_URL"

if [ -t 0 ]; then
  exec node "$TMP/install.mjs" "$@"
elif { : </dev/tty; } 2>/dev/null; then
  exec node "$TMP/install.mjs" "$@" </dev/tty
else
  exec node "$TMP/install.mjs" --non-interactive "$@"
fi
