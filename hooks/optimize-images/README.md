# optimize-images hook

A Claude Code hook that detects raster images (PNG, JPG, GIF, BMP, TIFF) staged for commit and prompts the user to convert them to WEBP before committing.

## How it works

1. The hook runs on every `git commit` command (via `PreToolUse` on the `Bash` tool)
2. It scans staged files for raster image extensions
3. If images are found, it blocks the commit and asks the user whether to optimize them
4. The user chooses a quality level (default: 80) and the optimizer converts images to WEBP using [sharp](https://sharp.pixelplumbing.com/)
5. After optimization, a before/after comparison table is shown

Favicons and SVGs are automatically excluded.

## Setup

Add the following hook to your `settings.json` (either `~/.claude/settings.json` for global or `.claude/settings.json` for per-project):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/hooks/optimize-images/check-committed-images.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/hooks/optimize-images/` with the actual path to this directory (e.g., `~/.claude/hooks/optimize-images/`).

## Dependencies

- **Node.js** — required to run the optimizer script
- **sharp** — auto-installed into `~/.cache/claude-hooks/` on first use if not already available in the project

## Optimizer usage

The optimizer script can also be run standalone:

```
node optimize-images.mjs [--quality N] [--keep] <image-paths...>
```

| Flag | Description |
|------|-------------|
| `--quality N` | WEBP quality, 1-100 (default: 80) |
| `--keep` | Keep original files after conversion |
