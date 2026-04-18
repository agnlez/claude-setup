# claude-setup

Shareable configurations for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — skills, hooks, settings, and other reusable components that can be installed across projects.

## Quick install

Run the installer from any project directory. It opens an interactive menu of every available component:

```
curl -fsSL https://raw.githubusercontent.com/agnlez/claude-setup/main/install.sh | bash
```

Choose where components should land (global `~/.claude/` or project-local `.claude/`), pick the ones you want, and the installer copies files and merges any required `settings.json` entries idempotently.

For scripted/CI use, skip the menu with flags:

```
# Install everything with defaults
curl -fsSL https://raw.githubusercontent.com/agnlez/claude-setup/main/install.sh | bash -s -- --all --yes

# Install just one skill
curl -fsSL https://raw.githubusercontent.com/agnlez/claude-setup/main/install.sh | bash -s -- --skill=fix-vulnerabilities --yes

# Project-local install of the hook
curl -fsSL https://raw.githubusercontent.com/agnlez/claude-setup/main/install.sh | bash -s -- \
  --component=hook:optimize-images --scope-default=project --project-root=. --yes

# See all options
curl -fsSL https://raw.githubusercontent.com/agnlez/claude-setup/main/install.sh | bash -s -- --help
```

Pin a specific tag/branch via `CLAUDE_SETUP_REF=v1.0 curl ... | bash` or `--ref=v1.0`.

Requires `node >=18`, `bash`, `curl`, and `tar`. After install, restart Claude Code so it picks up new hooks/skills.

## Structure

```
CLAUDE.template.md   Starter CLAUDE.md to copy into your own project root
hooks/               Reusable hook scripts
rules/               Shareable project rules (drop into CLAUDE.md or .claude/rules/)
skills/              Custom skills (slash commands)
install.sh           Bootstrap that downloads and runs the installer
install.mjs          Node-based installer (selects, fetches, merges settings.json)
manifest.json        Catalog of installable components (source of truth for the installer)
installer/           Installer modules and smoke tests
```

## Starter CLAUDE.md

Copy `CLAUDE.template.md` to the root of your project as `CLAUDE.md`, then adapt the sections to your needs. It comes pre-populated with the rules from this repo so you can prune what you don't want and add your own on top.

## Hooks

### optimize-images

A `PreToolUse` hook that intercepts `git commit` when staged raster images (PNG, JPG, GIF, BMP, TIFF) are detected. It prompts the user to convert them to WEBP before committing, using [sharp](https://sharp.pixelplumbing.com/) for conversion. Favicons and SVGs are excluded automatically.

**Files:**
- `check-committed-images.sh` — hook script that detects staged images and blocks the commit
- `optimize-images.mjs` — converts images to WEBP with configurable quality (default: 80)

## Skills

### fix-vulnerabilities

A skill (`/fix-vulnerabilities`) that audits and fixes dependency vulnerabilities. It can target a specific CVE/advisory or run a full audit. It auto-detects the project's package manager (npm, pnpm, yarn, uv) and applies the appropriate fix strategy. Each fix is committed atomically following `fix(deps):` conventions.

**Usage:**
```
/fix-vulnerabilities CVE-2026-26996
/fix-vulnerabilities https://github.com/advisories/GHSA-xxxx
/fix-vulnerabilities              # full audit
```

## Rules

### documentation-driven-development

A rule that makes documentation a first-class part of the development workflow. Before implementing any change, review existing project documentation for context. After implementing, update documentation proportionally to the complexity and impact of the change.

## Manual installation (alternative)

Skip the installer and copy files yourself if you prefer.

### Rules

Copy a rule file into your project's `.claude/rules/` directory, or paste its contents into your `CLAUDE.md`:

```
.claude/rules/documentation-driven-development.md
```

Rules in `.claude/rules/` are automatically loaded by Claude Code.

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
