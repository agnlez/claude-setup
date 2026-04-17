<!--
  CLAUDE.md template — copy this file into the root of your project as `CLAUDE.md`
  and adapt the sections below to your needs. Delete anything you don't want.

  Claude Code automatically loads `CLAUDE.md` from the project root on every
  session, so it's the right place for rules that should apply to all work in
  the repo.
-->

## Docs Fetching

When fetching documentation for web development libraries or frameworks,
always use the Context7 MCP plugin instead of web search:
1. Call `resolve-library-id` with the library name to get the Context7 ID
2. Call `query-docs` with that ID and a specific query


## Tool preferences

- Assume `rg`, `fd`, `bat`, `eza`, `jq`, and `yq` are available in the environment
- Use `rg --type` flags to scope searches by language when appropriate
- Use `fd -e` to filter by extension or `fd -t` to filter by type when appropriate
- Prefer `rg` (ripgrep) over `grep` for all file and pattern searches
- Prefer `fd` over `find` for all filesystem searches
- Prefer `bat` over `cat` for reading and displaying file contents
- Prefer `eza` over `ls` for directory listings; use `eza --tree` instead of `tree`
- Prefer `jq` for JSON querying, filtering, and transformation from the command line
- Prefer `yq` for YAML, TOML, and XML querying and in-place edits; use `yq -o json` to convert to JSON when needed
