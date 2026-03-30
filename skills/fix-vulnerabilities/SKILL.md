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
2. **Ensure up-to-date and branch off `main`** — Pull latest `main` from origin. If on `main`, create and switch to a new branch (`fix/deps/<advisory-id>`). If already on a fix branch, rebase it on `main`. Never commit vulnerability fixes directly to `main`.
3. **Understand the vulnerability** — If a GitHub URL was provided, fetch it to get full advisory details. If a CVE was provided, search for the advisory to understand the affected package, severity, and patched versions.
4. **Run audits** — Run `pnpm audit` (JS/TS) and `uvx uv-secure` in each Python service directory (Python) to get the full picture of current vulnerabilities before making changes.
5. **Review existing overrides** — Check `pnpm.overrides` in `pnpm-workspace.yaml`. For each existing override, check if the parent package now ships a version that includes the patched transitive dependency. If so, upgrade the parent (Strategy A), remove the override, verify (`pnpm install`, `pnpm audit`, `pnpm test`, `pnpm check`), and **commit this as its own atomic commit** before proceeding.
6. **Triage** — Classify severity, determine if the dependency is direct or transitive, production or dev-only, and whether the vulnerable code path is reachable.
7. **Apply the fix** — For JS/TS: Use Strategy A (direct upgrade with exact pinned version) when possible, fall back to Strategy B (nested pnpm override). For Python: Use Strategy C (`uv lock --upgrade-package`).
8. **Verify** — Re-run `pnpm audit` (JS/TS) and/or `uvx uv-secure` (Python), then `pnpm test` and `pnpm check` to confirm the fix and catch regressions.
9. **Commit** — Create a single atomic commit for this vulnerability fix using the `fix(deps):` convention. Each commit must be independently revertable. Do not push unless explicitly asked.

---

## Steps (full audit — no $ARGUMENTS)

1. **Read the guidelines** — Load `~/.claude/skills/fix-vulnerabilities/VULNERABILITIES_GUIDELINES.md` and follow the triage, fix strategy, verification, and commit convention sections exactly.
2. **Ensure up-to-date and branch off `main`** — Pull latest `main` from origin. If on `main`, create and switch to a new branch (`fix/deps/audit-<YYYY-MM-DD>`). If already on a fix branch, rebase it on `main`. Never commit vulnerability fixes directly to `main`.
3. **Run audits** — Run `pnpm audit` (JS/TS) and `uvx uv-secure` in each Python service directory (Python) to collect all current vulnerabilities.
4. **Present a summary to the user** — Display a table with: package name, ecosystem (JS/TS or Python), severity (Critical/High/Medium/Low), vulnerable version, patched version, dependency path (direct or transitive via which parent), and advisory ID.
5. **Ask the user to confirm** — Use AskUserQuestion to prompt the user before proceeding. Do **not** start fixing anything until the user explicitly confirms. The user may want to skip certain vulnerabilities or adjust priorities.
6. **Review existing overrides** — Check `pnpm.overrides` in `pnpm-workspace.yaml`. For each existing override, check if the parent package now ships a version that includes the patched transitive dependency. If so, upgrade the parent (Strategy A), remove the override, verify (`pnpm install`, `pnpm audit`, `pnpm test`, `pnpm check`), and **commit this as its own atomic commit** before proceeding to new fixes.
7. **Address each vulnerability** — Work through them from highest to lowest severity. For each one:
   a. **Triage** — Classify severity, direct vs transitive, production vs dev-only, reachability.
   b. **Apply the fix** — For JS/TS: Strategy A (direct upgrade, exact pinned version) first, fall back to Strategy B (nested override). For Python: Strategy C (`uv lock --upgrade-package`).
   c. **Verify** — Re-run `pnpm audit` (JS/TS) and/or `uvx uv-secure` (Python), then `pnpm test` and `pnpm check` after each fix.
   d. **Commit** — One atomic commit per vulnerability using the `fix(deps):` convention.
8. **Final verification** — Run `pnpm audit` (JS/TS) and `uvx uv-secure` (Python) one last time to confirm all vulnerabilities are resolved. Report the final state to the user.
