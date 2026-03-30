#!/bin/bash
# Claude Code hook: detects image files staged for commit and suggests WEBP optimization.
# Event: PreToolUse (Bash) — blocks git commit when unoptimized images are found.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.command||'')}catch{}})")

# Only trigger on git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

# Raster image extensions that benefit from WEBP conversion (excludes SVG — vector format)
IMAGE_EXTENSIONS="png|jpg|jpeg|gif|bmp|tiff|tif"

# Favicon-related file patterns to exclude (must remain in original format)
FAVICON_PATTERN="favicon|apple-icon|apple-touch-icon|android-chrome|mstile"

# Get staged image files (Added, Copied, or Modified only), excluding favicon-related files
STAGED_IMAGES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -iE "\.($IMAGE_EXTENSIONS)$" | grep -ivE "$FAVICON_PATTERN" || true)

if [ -z "$STAGED_IMAGES" ]; then
  exit 0
fi

IMAGE_COUNT=$(echo "$STAGED_IMAGES" | wc -l | tr -d ' ')

{
  echo ""
  echo "Found $IMAGE_COUNT image file(s) staged for commit that may benefit from WEBP optimization:"  echo ""
  while IFS= read -r img; do
    if [ -f "$img" ]; then
      SIZE=$(stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null)
      if [ "$SIZE" -ge 1048576 ]; then
        SIZE_DISPLAY="$(echo "scale=1; $SIZE / 1048576" | bc)MB"
      else
        SIZE_DISPLAY="$((SIZE / 1024))KB"
      fi
      echo "  - $img ($SIZE_DISPLAY)"
    else
      echo "  - $img"
    fi
  done <<< "$STAGED_IMAGES"
  echo ""
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  echo "Ask the user whether they want to optimize these images to WEBP before committing."
  echo "Default quality: 80 (user can choose a different value)."
  echo "To optimize, run: node \"$SCRIPT_DIR/optimize-images.mjs\" [--quality 80] <image-paths...>"
  echo "After optimization: unstage the original files, stage the new .webp files, then re-commit."
  echo ""
  echo "IMPORTANT: After optimization, display a before/after comparison table with columns:"
  echo "  File | Original | WEBP | Savings"
  echo "If the size savings is minimal (under 5%), suggest keeping the original file instead."
} >&2

exit 2