import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFlags, HELP_TEXT } from './installer/flags.mjs';
import { loadManifest, findComponent } from './installer/manifest.mjs';
import { fetchBytes, rawUrl } from './installer/fetch.mjs';
import { scopeRoot, settingsPath } from './installer/paths.mjs';
import { mergeSettings } from './installer/merge-settings.mjs';
import { createPrompt, pickComponents, pickDefaultScope, pickProjectRoot, confirm } from './installer/prompt.mjs';

const VERSION = '0.1.0';

async function main(argv) {
  const flags = parseFlags(argv);

  if (flags.help) { console.log(HELP_TEXT); return 0; }
  if (flags.version) { console.log(VERSION); return 0; }

  const manifest = loadManifest(manifestPathAdjacent());
  if (flags.ref) manifest.repo.ref = flags.ref;
  else if (process.env.CLAUDE_SETUP_REF) manifest.repo.ref = process.env.CLAUDE_SETUP_REF;

  if (flags.list) { printList(manifest); return 0; }

  const interactive = isInteractive(flags);
  const prompt = interactive ? createPrompt() : null;

  try {
    if (interactive && !flags.scopeDefault) {
      flags.scopeDefault = await pickDefaultScope(prompt.ask);
    }

    const projectRoot = path.resolve(
      flags.projectRoot ??
        (interactive ? await pickProjectRoot(process.cwd(), prompt.ask) : process.cwd())
    );

    const selected = await selectComponents(manifest, flags, prompt);
    if (selected.length === 0) {
      console.log('No components selected. Nothing to do.');
      return 0;
    }

    const plan = buildPlan(manifest, selected, flags, projectRoot);

    printPlan(plan, flags);
    if (!flags.yes && interactive) {
      const ok = await confirm('\nProceed?', prompt.ask, { defaultYes: false });
      if (!ok) { console.log('Aborted.'); return 1; }
    }

    await execute(plan, manifest, flags);
    console.log('\nDone. Restart Claude Code to pick up new hooks/skills.');
    return 0;
  } finally {
    prompt?.close();
  }
}

function manifestPathAdjacent() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, 'manifest.json');
}

function isInteractive(flags) {
  if (flags.nonInteractive) return false;
  if (flags.all || flags.components.length > 0) return false;
  return process.stdin.isTTY === true;
}

function printList(manifest) {
  console.log(`claude-setup manifest (${manifest.components.length} components)\n`);
  for (const c of manifest.components) {
    console.log(`  ${c.id}`);
    if (c.description) console.log(`    ${c.description}`);
    console.log(`    scopes: ${c.scopes.join(', ')} (default: ${c.defaultScope})`);
  }
}

async function selectComponents(manifest, flags, prompt) {
  if (flags.all) return [...manifest.components];

  if (flags.components.length > 0) {
    const out = [];
    for (const id of flags.components) {
      const c = findComponent(manifest, id);
      if (!c) throw new Error(`Unknown component id: ${id}`);
      if (!out.includes(c)) out.push(c);
    }
    return out;
  }

  if (!prompt) {
    throw new Error('No components selected. Pass --all or --component=<id>, or run interactively.');
  }
  return pickComponents(manifest.components, prompt.ask);
}

function buildPlan(manifest, selected, flags, projectRoot) {
  const actions = [];

  for (const component of selected) {
    const scope = resolveScope(component, flags);
    const installRoot = scopeRoot(scope, projectRoot);
    const conflictPolicy = component.conflictPolicy ?? 'overwriteWithBackup';

    for (const file of component.files) {
      const dst = path.join(installRoot, file.dst);
      const conflict = existsSync(dst) ? detectConflict(dst, conflictPolicy, flags) : null;
      const finalDst = conflict?.divertTo ?? dst;
      actions.push({
        kind: 'file',
        component,
        scope,
        installRoot,
        src: file.src,
        dst: finalDst,
        originalDst: dst,
        mode: file.mode,
        conflict,
      });
    }

    if (component.settingsPatch) {
      actions.push({
        kind: 'settings',
        component,
        scope,
        installRoot,
        settingsPath: settingsPath(scope, projectRoot),
        patch: component.settingsPatch,
      });
    }
  }

  return { actions, projectRoot };
}

function resolveScope(component, flags) {
  const override = flags.scopeOverrides[component.id];
  if (override) {
    if (!component.scopes.includes(override)) {
      throw new Error(`Component ${component.id} does not support scope '${override}'`);
    }
    return override;
  }
  return flags.scopeDefault && component.scopes.includes(flags.scopeDefault)
    ? flags.scopeDefault
    : component.defaultScope;
}

function detectConflict(dst, policy, flags) {
  if (policy === 'neverOverwrite') {
    return { policy, divertTo: `${dst}.from-claude-setup`, reason: 'exists, will divert' };
  }
  if (policy === 'overwriteWithBackup') {
    return { policy, divertTo: null, reason: flags.force ? 'will overwrite (--force)' : 'will back up + overwrite' };
  }
  return { policy, divertTo: null, reason: 'unknown policy' };
}

function printPlan(plan, flags) {
  console.log(`\nInstall plan${flags.dryRun ? ' (dry run)' : ''}:`);
  console.log(`  project root: ${plan.projectRoot}`);
  for (const a of plan.actions) {
    if (a.kind === 'file') {
      const note = a.conflict ? `  [${a.conflict.reason}]` : '';
      console.log(`  write    ${a.src}  ->  ${a.dst}${note}`);
    } else if (a.kind === 'settings') {
      console.log(`  merge    settings.json  ->  ${a.settingsPath}  (${a.component.id})`);
    }
  }
}

async function execute(plan, manifest, flags) {
  console.log('');
  for (const a of plan.actions) {
    if (a.kind === 'file') await executeFile(a, manifest, flags);
    else if (a.kind === 'settings') executeSettings(a, flags);
  }
}

async function executeFile(action, manifest, flags) {
  const url = rawUrl(manifest.repo, action.src);
  if (flags.dryRun) {
    console.log(`  (dry-run) would write ${action.dst}`);
    return;
  }

  const bytes = await fetchBytes(url);

  if (existsSync(action.originalDst) && action.conflict?.policy === 'overwriteWithBackup') {
    const existing = readFileSync(action.originalDst);
    if (!bytes.equals(existing)) {
      copyFileSync(action.originalDst, `${action.originalDst}.bak-${Date.now()}`);
    } else {
      console.log(`  skip     ${action.dst} (identical)`);
      return;
    }
  }

  mkdirSync(path.dirname(action.dst), { recursive: true });
  const tmp = `${action.dst}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, action.dst);

  if (action.mode) {
    try { chmodSync(action.dst, parseInt(action.mode, 8)); } catch { /* chmod no-op on Windows */ }
  }

  const tag = action.conflict?.divertTo ? 'divert  ' : 'wrote   ';
  console.log(`  ${tag} ${action.dst}`);
}

function executeSettings(action, flags) {
  const result = mergeSettings(action.settingsPath, action.patch, action.installRoot, { dryRun: flags.dryRun });
  if (flags.dryRun) {
    console.log(`  (dry-run) would ${result.changed ? 'merge into' : 'leave unchanged'} ${action.settingsPath}`);
    return;
  }
  if (result.changed) console.log(`  merged   ${action.settingsPath}`);
  else console.log(`  skip     ${action.settingsPath} (already configured)`);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
);
