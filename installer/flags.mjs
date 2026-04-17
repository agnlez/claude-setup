const VALID_SCOPES = new Set(['global', 'project', 'projectRoot']);

export function parseFlags(argv) {
  const flags = {
    all: false,
    components: [],
    scopeOverrides: {},
    scopeDefault: null,
    projectRoot: null,
    ref: null,
    dryRun: false,
    yes: false,
    nonInteractive: false,
    force: false,
    list: false,
    help: false,
    version: false,
  };

  for (const raw of argv) {
    const [key, value] = splitArg(raw);
    switch (key) {
      case '--all':
        flags.all = true;
        break;
      case '--component':
        flags.components.push(requireValue(key, value));
        break;
      case '--hook':
        flags.components.push(`hook:${requireValue(key, value)}`);
        break;
      case '--skill':
        flags.components.push(`skill:${requireValue(key, value)}`);
        break;
      case '--rule':
        flags.components.push(`rule:${requireValue(key, value)}`);
        break;
      case '--template':
        flags.components.push(`template:${requireValue(key, value)}`);
        break;
      case '--scope': {
        const v = requireValue(key, value);
        const idx = v.lastIndexOf(':');
        if (idx === -1) throw new Error(`--scope expects <id>:<scope>, got: ${v}`);
        const id = v.slice(0, idx);
        const scope = v.slice(idx + 1);
        if (!VALID_SCOPES.has(scope)) throw new Error(`Invalid scope '${scope}' in --scope=${v}`);
        flags.scopeOverrides[id] = scope;
        break;
      }
      case '--scope-default': {
        const v = requireValue(key, value);
        if (!VALID_SCOPES.has(v)) throw new Error(`Invalid --scope-default: ${v}`);
        flags.scopeDefault = v;
        break;
      }
      case '--project-root':
        flags.projectRoot = requireValue(key, value);
        break;
      case '--ref':
        flags.ref = requireValue(key, value);
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--yes':
      case '-y':
        flags.yes = true;
        break;
      case '--non-interactive':
        flags.nonInteractive = true;
        break;
      case '--force':
        flags.force = true;
        break;
      case '--list':
        flags.list = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      case '--version':
      case '-v':
        flags.version = true;
        break;
      default:
        throw new Error(`Unknown flag: ${key}`);
    }
  }

  return flags;
}

function splitArg(raw) {
  const eq = raw.indexOf('=');
  if (eq === -1) return [raw, null];
  return [raw.slice(0, eq), raw.slice(eq + 1)];
}

function requireValue(key, value) {
  if (value === null || value === '') {
    throw new Error(`${key} requires a value (use ${key}=<value>)`);
  }
  return value;
}

export const HELP_TEXT = `claude-setup installer

Usage:
  install.sh [flags]

Flags:
  --all                              Select every component (uses each defaultScope)
  --component=<id>                   Select a component by manifest id (repeatable)
  --hook=<name>                      Sugar for --component=hook:<name>
  --skill=<name>                     Sugar for --component=skill:<name>
  --rule=<name>                      Sugar for --component=rule:<name>
  --template=<name>                  Sugar for --component=template:<name>
  --scope=<id>:<scope>               Per-component scope override (repeatable)
  --scope-default=<scope>            Override defaultScope for all selected
  --project-root=<path>              Project root (default: cwd)
  --ref=<branch|tag|sha>             Source ref override (also via CLAUDE_SETUP_REF env)
  --dry-run                          Print plan, write nothing
  --yes, -y                          Skip confirmation
  --non-interactive                  Fail if input missing (implied by no-TTY)
  --force                            Overwrite conflicting files (still backs up)
  --list                             Print manifest summary and exit
  --help, -h                         Show this help
  --version, -v                      Show version

Scopes: global | project | projectRoot

Examples:
  curl -fsSL .../install.sh | bash
  curl -fsSL .../install.sh | bash -s -- --all --yes
  curl -fsSL .../install.sh | bash -s -- --skill=fix-vulnerabilities -y
  curl -fsSL .../install.sh | bash -s -- --component=hook:optimize-images --scope-default=project --project-root=. -y
`;
