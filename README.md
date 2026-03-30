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
- `check-committed-images.sh` — hook script that detects staged images and blocks the commit
- `optimize-images.mjs` — converts images to WEBP with configurable quality (default: 80)

## Skills

### fix-vulnerabilities

A skill (`/fix-vulnerabilities`) that audits and fixes dependency vulnerabilities. It can target a specific CVE/advisory or run a full audit. Each fix is committed atomically following `fix(deps):` conventions.

> **Note:** This skill is currently tailored for projects using **pnpm** (JS/TS) and **uv** (Python).

**Usage:**
```
/fix-vulnerabilities CVE-2026-26996
/fix-vulnerabilities https://github.com/advisories/GHSA-xxxx
/fix-vulnerabilities              # full audit
```

## Installation

### Skills

Copy or symlink the skill directory into your Claude Code skills folder:

```
~/.claude/skills/fix-vulnerabilities/
  SKILL.md
  VULNERABILITIES_GUIDELINES.md
```

Skills are automatically available as slash commands (e.g., `/fix-vulnerabilities`).

### Hooks

Copy or symlink the hook directory, then register it in your `settings.json` (global at `~/.claude/settings.json` or per-project at `.claude/settings.json`):

```
~/.claude/hooks/optimize-images/
  check-committed-images.sh
  optimize-images.mjs
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/optimize-images/check-committed-images.sh"
          }
        ]
      }
    ]
  }
}
```

See each hook's README for detailed setup instructions.
