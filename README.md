# claude-setup

Shareable configurations for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — skills, hooks, settings, and other reusable components that can be installed across projects.

## Structure

```
hooks/          Reusable hook scripts
skills/         Custom skills (slash commands)
```

## Hooks

### optimize-images

A `PreToolUse` hook that intercepts `git commit` when staged raster images (PNG, JPG, GIF, BMP, TIFF) are detected. It prompts the user to convert them to WEBP before committing, using [sharp](https://sharp.pixelplumbing.com/) for conversion. Favicons and SVGs are excluded automatically.

**Files:**
- `check-comitted-images.sh` — hook script that detects staged images and blocks the commit
- `optimize-images.mjs` — converts images to WEBP with configurable quality (default: 80)

## Skills

### fix-vulnerabilities

A skill (`/fix-vulnerabilities`) that audits and fixes dependency vulnerabilities. It can target a specific CVE/advisory or run a full audit across JS/TS (`pnpm audit`) and Python (`uvx uv-secure`) projects. Each fix is committed atomically following `fix(deps):` conventions.

**Usage:**
```
/fix-vulnerabilities CVE-2026-26996
/fix-vulnerabilities https://github.com/advisories/GHSA-xxxx
/fix-vulnerabilities              # full audit
```

## Installation

Copy or symlink the desired hooks/skills into your Claude Code configuration directory (`~/.claude/`), then reference them from your `settings.json`.
