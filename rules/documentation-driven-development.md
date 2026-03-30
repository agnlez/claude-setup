# Documentation-driven development

Treat documentation as a first-class part of the development workflow — read it before making changes, and update it after.

## Before implementing

Before starting any change or feature, review the project's existing documentation for context:

- `CLAUDE.md` (or equivalent project rules)
- `docs/` directory, if present
- READMEs in the affected area
- Any other relevant documentation files

This ensures you understand the current architecture, conventions, and constraints before writing code.

## After implementing

Once a change or feature is complete, evaluate whether the documentation needs updating. Not every change requires a docs update — use your judgment based on complexity and impact:

| Change type | Documentation expectation |
|---|---|
| Bug fix or minor tweak | Usually none, unless it changes documented behavior |
| New feature or capability | Document what it does, how to use it, and any configuration |
| Behavioral change | Update any docs that describe the previous behavior |
| API or interface change | Update all references to the old interface |
| Architectural change | Update high-level docs, diagrams, or decision records |

## Guidelines

- Write documentation for humans — be clear, concise, and include examples where helpful
- Keep documentation close to the code it describes (e.g., a README in the relevant directory)
- If a change invalidates existing documentation, update or remove it — stale docs are worse than no docs
- Do not over-document simple or self-evident changes
