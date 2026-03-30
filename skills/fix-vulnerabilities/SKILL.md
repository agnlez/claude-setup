---
name: fix-vulnerabilities
description: Fix dependency vulnerabilities (CVE or advisory ID)
argument-hint: "[CVE-identifier-or-url]"
disable-model-invocation: true
user-invocable: true
---

Fix dependency vulnerabilities: $ARGUMENTS

Follow the guidelines defined in ~/.claude/skills/fix-vulnerabilities/VULNERABILITIES_GUIDELINES.md strictly. Read that file before doing anything else.

## Modes

- **If $ARGUMENTS is provided:** It is either a CVE identifier (e.g., CVE-2026-26996) or a GitHub advisory URL. Fix only that specific vulnerability.
- **If $ARGUMENTS is empty:** Audit the entire project, present a summary of all vulnerabilities to the user, and then address each one following the guidelines.

---

## Steps (single vulnerability — $ARGUMENTS provided)

1. **Read the guidelines** — Load `~/.claude/skills/fix-vulnerabilities/VULNERABILITIES_GUIDELINES.md` and follow the triage, fix strategy, verification, and commit convention sections exactly.
2. **Detect the project ecosystem** — Inspect the project root for lockfiles and config files (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `uv.lock`, `pyproject.toml`, etc.) to determine the package manager(s) in use.
3. **Ensure up-to-date and branch off `main`** — Pull latest `main` from origin. If on `main`, create and switch to a new branch (`fix/deps/<advisory-id>`). If already on a fix branch, rebase it on `main`. Never commit vulnerability fixes directly to `main`.
4. **Understand the vulnerability** — If a GitHub URL was provided, fetch it to get full advisory details. If a CVE was provided, search for the advisory to understand the affected package, severity, and patched versions.
5. **Run audits** — Use the appropriate audit command for the detected ecosystem (e.g., `npm audit`, `pnpm audit`, `yarn audit` for JS/TS; `uvx uv-secure` or `pip-audit` for Python) to get the full picture of current vulnerabilities before making changes.
6. **Review existing overrides** — Check for dependency overrides in the project's configuration (e.g., `pnpm.overrides` in `pnpm-workspace.yaml`, `overrides` in `package.json` for npm, `resolutions` in `package.json` for yarn). For each existing override, check if the parent package now ships a version that includes the patched transitive dependency. If so, upgrade the parent (Strategy A), remove the override, verify (install, audit, test), and **commit this as its own atomic commit** before proceeding.
7. **Triage** — Classify severity, determine if the dependency is direct or transitive, production or dev-only, and whether the vulnerable code path is reachable.
8. **Apply the fix** — Use Strategy A (direct upgrade with exact pinned version) when possible, fall back to Strategy B (override for transitive dependencies). For Python: Use Strategy C (`uv lock --upgrade-package`). See the guidelines for details on each strategy.
9. **Verify** — Re-run the audit command, then run tests and type checks to confirm the fix and catch regressions.
10. **Commit** — Create a single atomic commit for this vulnerability fix using the `fix(deps):` convention. Each commit must be independently revertable. Do not push unless explicitly asked.

---

## Steps (full audit — no $ARGUMENTS)

1. **Read the guidelines** — Load `~/.claude/skills/fix-vulnerabilities/VULNERABILITIES_GUIDELINES.md` and follow the triage, fix strategy, verification, and commit convention sections exactly.
2. **Detect the project ecosystem** — Inspect the project root for lockfiles and config files to determine the package manager(s) in use.
3. **Ensure up-to-date and branch off `main`** — Pull latest `main` from origin. If on `main`, create and switch to a new branch (`fix/deps/audit-<YYYY-MM-DD>`). If already on a fix branch, rebase it on `main`. Never commit vulnerability fixes directly to `main`.
4. **Run audits** — Use the appropriate audit command(s) for the detected ecosystem to collect all current vulnerabilities.
5. **Present a summary to the user** — Display a table with: package name, ecosystem, severity (Critical/High/Medium/Low), vulnerable version, patched version, dependency path (direct or transitive via which parent), and advisory ID.
6. **Ask the user to confirm** — Use AskUserQuestion to prompt the user before proceeding. Do **not** start fixing anything until the user explicitly confirms. The user may want to skip certain vulnerabilities or adjust priorities.
7. **Review existing overrides** — Check for dependency overrides in the project's configuration. For each existing override, check if the parent package now ships a version that includes the patched transitive dependency. If so, upgrade the parent (Strategy A), remove the override, verify (install, audit, test), and **commit this as its own atomic commit** before proceeding to new fixes.
8. **Address each vulnerability** — Work through them from highest to lowest severity. For each one:
   a. **Triage** — Classify severity, direct vs transitive, production vs dev-only, reachability.
   b. **Apply the fix** — Strategy A (direct upgrade, exact pinned version) first, fall back to Strategy B (override). For Python: Strategy C (`uv lock --upgrade-package`).
   c. **Verify** — Re-run the audit command, then run tests and type checks after each fix.
   d. **Commit** — One atomic commit per vulnerability using the `fix(deps):` convention.
9. **Final verification** — Run the audit command(s) one last time to confirm all vulnerabilities are resolved. Report the final state to the user.
