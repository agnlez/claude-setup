# Vulnerability & Dependency Security Guidelines

Guidelines for triaging and fixing CVEs, security advisories (GHSA), and other dependency vulnerabilities across JS/TS and Python ecosystems.

---

## 1. Discovery

### How vulnerabilities surface

| Source | Command / Tool | Scope |
|--------|---------------|-------|
| npm/pnpm/yarn audit | `npm audit`, `pnpm audit`, `yarn audit` | JS/TS packages |
| GitHub Dependabot alerts | GitHub Security tab | All languages |
| uv-secure | `uvx uv-secure` | Python packages (reads `uv.lock` directly) |
| pip-audit via uv export | `uv export --no-hashes \| pip-audit -r /dev/stdin --no-deps` | Python packages |
| Manual advisory review | [GitHub Advisory Database](https://github.com/advisories) | Cross-language |

### Routine checks

Run the appropriate audit command for your package manager before starting any vulnerability remediation session. This gives a full picture of outstanding issues and prevents duplicate work.

For Python services managed with uv, the simplest approach is `uv-secure`, which reads `uv.lock` directly:

```sh
cd <python-service>
uvx uv-secure
```

Alternatively, export the lockfile and pipe it to `pip-audit`:

```sh
cd <python-service>
uv export --no-hashes | pip-audit -r /dev/stdin --no-deps
```

Note: `pip-audit` cannot read `uv.lock` directly. The `uv export` step converts it to a requirements.txt format that `pip-audit` understands. The `--no-deps` flag prevents `pip-audit` from trying to resolve dependencies itself (uv already did that).

---

## 2. Triage

### Severity classification

Use the CVSS score and advisory severity as a starting point, then adjust based on **reachability** — whether the vulnerable code path is actually exercised in the application.

| Severity | CVSS | Response Time |
|----------|------|---------------|
| **Critical** | 9.0–10.0 | Same day |
| **High** | 7.0–8.9 | Within 2 business days |
| **Medium** | 4.0–6.9 | Within 1 week |
| **Low** | 0.1–3.9 | Next scheduled maintenance window |

### Key triage questions

1. **Is the package a direct or transitive dependency?** Direct dependencies are easier to upgrade; transitive ones may require overrides.
2. **Is it a production or dev-only dependency?** Dev-only vulnerabilities (test runners, linters, build tools) are lower priority — they don't ship to production.
3. **Is the vulnerable code path reachable?** A ReDoS in a regex library you never call is lower risk than an RCE in your HTTP framework.
4. **Is a patched version available?** If not, evaluate workarounds or consider using dependency overrides as a temporary escape hatch.

### When to skip or defer

It is acceptable to defer a fix when **all** of the following are true:
- The vulnerability is Low or Medium severity
- The package is a dev-only or build-time dependency
- The vulnerable code path is not reachable in the project's usage
- No patched version is available yet

Document the deferral reason in the PR or commit message.

---

## 3. Fix Strategies

### Strategy A: Direct upgrade (preferred)

Bump the package to an exact pinned version. **Always use exact versions — no ranges (`^`, `~`, `>=`).** This ensures reproducible installs and prevents unintended upgrades.

Use the appropriate command for your package manager:

```sh
# pnpm
pnpm --filter <workspace> add --save-exact <package>@<version>

# npm
npm install --save-exact <package>@<version>

# yarn
yarn add --exact <package>@<version>

# Then verify
<pm> install
<pm> audit
```

**Use when:** A patched version exists and is within the same major version (no breaking changes expected).

### Strategy B: Dependency overrides

When the vulnerability is in a **transitive production dependency** and no direct upgrade path exists, pin the transitive package to its patched version using your package manager's override mechanism.

**Where overrides are declared by package manager:**

| Package Manager | Override Field | Location |
|----------------|---------------|----------|
| pnpm | `pnpm.overrides` | `pnpm-workspace.yaml` |
| npm | `overrides` | `package.json` |
| yarn | `resolutions` | `package.json` |

**Do not add overrides for dev-only dependencies.** If the vulnerable package is only reachable through devDependencies (linters, test runners, build tools, bundler plugins), it does not ship to production. Prefer deferring or upgrading the parent when convenient — but do not add an override just to silence the audit for a dev-only path.

**Always pin to exact versions.** Never use semver ranges (`^`, `~`, `>=`). This applies to both Strategy A and B.

**Scope the override when possible.** Only override the transitive dependency within the specific parent that pulls in the vulnerable version. Never apply a blanket override that affects the entire dependency tree — other packages may depend on a different major version of the same library.

```yaml
# pnpm-workspace.yaml example

# GOOD: nested override — only affects minimatch as pulled by @eslint/eslintrc
overrides:
  "@eslint/eslintrc>minimatch": "3.1.5"

# BAD: blanket override — forces version for every consumer in the tree
overrides:
  minimatch: "3.1.5"

# BAD: range — could pull in unexpected versions
overrides:
  minimatch: ">=3.1.5"
```

```json
// npm package.json example
{
  "overrides": {
    "@eslint/eslintrc": {
      "minimatch": "3.1.5"
    }
  }
}
```

```sh
# After adding the override
<pm> install
<pm> audit
```

**Use when:** The transitive dependency is pinned by an outdated parent and a direct upgrade (Strategy A) of the parent isn't possible. Overrides bypass the parent's declared compatibility range, so they should be treated as **temporary**.

**Override hygiene — always check if overrides can be removed:**
- Every time you run the vulnerability workflow, review existing override entries **before** applying any new fixes
- For each override, compare three things:
  1. **Parent's declared range** — what the installed parent's `package.json` says (e.g., `"flatted": "^3.2.9"`)
  2. **Lockfile resolution** — what version is actually resolved in `node_modules`
  3. **Latest parent version** — check if a newer minor/patch release of the parent ships the patched transitive dep
- If a newer parent version ships the fix: upgrade the parent (Strategy A), remove the override, verify, and **commit as its own atomic commit**
- Each override removal + parent upgrade must be its own **atomic commit** (see Commit Convention), separate from new vulnerability fixes
- Stale overrides add hidden complexity and can mask other issues

**Lockfile interaction — removing overrides where the parent's range already allows the patched version:**
- Most package managers are conservative with existing lockfile resolutions. Even if a parent declares a semver range (e.g., `^3.2.9`) that includes the patched version (e.g., `3.4.2`), running install will **not** automatically upgrade an already-resolved version in the lockfile. It preserves the existing resolution.
- This means you **cannot** remove an override and expect the package manager to upgrade in a single step if the lockfile still has the old version pinned.
- **Two-step approach:** First bump the override to the patched version and commit. Then, in a follow-up commit, remove the now-redundant override — the lockfile already has the correct version, so it will be preserved.
- Alternatively, remove the override and explicitly update the package to force re-resolution within the allowed range, then verify with the audit command.

### Strategy C: Python dependency updates (uv)

For Python services managed with uv:

```sh
cd <python-service>

# Upgrade the vulnerable package in the lockfile
uv lock --upgrade-package <package>

# Sync the virtual environment with the updated lockfile
uv sync

# Re-audit to confirm the fix
uvx uv-secure
```

**Use when:** A Python dependency has a known vulnerability. Follow the same triage criteria as JS/TS packages. The `uv lock --upgrade-package` command upgrades only the specified package within the constraints of `pyproject.toml` — if the patched version falls outside the declared version range, update `pyproject.toml` first.

---

## 4. Verification

After applying any fix:

1. **Re-run audit** — Use the appropriate audit command to confirm the vulnerability is resolved.
2. **Run tests** — Run the project's test suite to catch regressions.
3. **Run type checks** — If applicable, run type checks to catch type-level breakage from version bumps.
4. **Spot-check affected service** — If the upgrade touches a runtime dependency, start the service locally and verify core functionality.

---

## 5. Commit Convention

All vulnerability fixes follow the **conventional commit** format:

### Commit message format

```
fix(deps): upgrade <package> to <version> to fix <short description> (<advisory-id>)
```

### Examples

```
fix(deps): upgrade express to 5.2.1 to fix qs DoS via bracket notation (GHSA-6rw7-vpxm-498p)
fix(deps): upgrade @eslint/eslintrc to 3.3.4 to fix ajv v6 ReDoS (GHSA-2g4f-4pwh-qvx6)
fix(deps): patch minimatch ReDoS vulnerability (CVE-2026-26996)
```

### Rules

- **Type:** Always `fix(deps):`
- **Subject line:** Include the package name, target version, and a brief description of what the vulnerability enables (RCE, ReDoS, DoS, prototype pollution, etc.)
- **Advisory ID:** Include CVE or GHSA identifier when available — in the subject line (parenthesized) or in the body
- **Body (optional):** Add details when the fix is non-obvious (e.g., overrides applied, override-to-upgrade transitions, or multiple packages updated together)

### Atomic commits

Every fix must be a **single, self-contained commit** that can be independently reverted with `git revert` without affecting other fixes. This means:

- **One commit per vulnerability fix.** Do not combine unrelated vulnerability fixes in a single commit.
- **One commit per override removal.** When an existing override can be replaced by a direct upgrade (Strategy A), that transition is its own atomic commit — separate from any new vulnerability fix.
- **Each commit must leave the repo in a working state.** Run install, audit, and tests before committing to ensure nothing is broken.
- **Rationale:** If a fix introduces a regression, an atomic commit allows a clean `git revert` without losing other unrelated fixes applied in the same session.

---

## 6. PR & Branch Guidelines

### Never work on `main`

All vulnerability fixes must be done on a **dedicated branch**, never directly on `main`. If the current branch is `main`, create a new branch before making any changes.

**Branch naming convention:**
```
fix/deps/<advisory-id>
```

**Examples:**
```
fix/deps/CVE-2026-26996
fix/deps/GHSA-3ppc-4f35-3m26
fix/deps/audit-2026-02-27      # when batching multiple fixes from a single audit session
```

### Workflow

1. **Ensure `main` is up to date.** Pull the latest changes from origin before branching.
2. **Check current branch.** If on `main`, create and switch to a new branch. If already on a fix branch, rebase it on `main` to ensure it starts from the latest state.
3. Make fixes as atomic commits on the branch.
4. Open a PR to `main` for review.
5. PR title: `fix(deps): <short description>` for a single fix, or `fix(deps): address <N> dependency vulnerabilities` when batching multiple fixes.
6. If multiple unrelated vulnerabilities are addressed in a single session, they can share the same branch with **separate atomic commits**.

---

## 7. Handling False Positives & Disputed Advisories

Sometimes audit tools or GitHub flag vulnerabilities that don't apply to the project's usage. In these cases:

1. **Investigate the advisory** — Read the full GHSA/CVE description and determine if the project's code exercises the vulnerable path.
2. **Document the decision** — If deemed not applicable, note it in the PR/commit or in this file's appendix.
3. **Suppress if needed** — Use the audit tool's ignore mechanism for known false positives. Avoid blanket suppressions.

---

## 8. Checklist for Agents

When Claude Code or another agent is asked to fix dependency vulnerabilities:

- [ ] **Detect the project ecosystem** — identify the package manager(s) in use from lockfiles and config files
- [ ] **Ensure `main` is up to date** — pull latest from origin (`git pull origin main`)
- [ ] **Check current branch** — if on `main`, create and switch to a new `fix/deps/<advisory-id>` branch. If already on a fix branch, rebase on `main` (`git rebase main`)
- [ ] Run the appropriate audit command to get the current vulnerability list
- [ ] Triage each vulnerability using the severity table and triage questions above
- [ ] **Review existing overrides before fixing new vulnerabilities** — for each override, check the parent's declared range and the lockfile's resolved version
- [ ] If the parent now ships a version that includes the patched transitive dep: upgrade the parent (Strategy A), remove the override, verify, and **commit as its own atomic commit**
- [ ] If the parent's semver range allows the patched version but the lockfile is stale: bump the override first (commit), then remove the override in a follow-up commit (or explicitly update the package to re-resolve)
- [ ] Apply the appropriate fix strategy for the target vulnerability (A → B in order of preference)
- [ ] **Do not add overrides for dev-only dependencies** — if the vulnerable package is only reachable through devDependencies (linters, test runners, build tools), defer or upgrade the parent instead
- [ ] When using overrides (Strategy B), scope to the parent package with an exact pinned version
- [ ] Run install to ensure lockfile consistency
- [ ] Re-run audit to verify the fix
- [ ] Run tests and type checks to catch regressions
- [ ] **Commit each fix as a single atomic commit** — one vulnerability per commit, independently revertable
- [ ] Use the `fix(deps):` convention with advisory IDs
- [ ] Do **not** upgrade major versions without explicit user approval
- [ ] Do **not** apply dependency overrides without explicit user approval
