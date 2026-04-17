import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadManifest } from '../manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALL_MJS = path.join(REPO_ROOT, 'install.mjs');
const IS_WINDOWS = platform() === 'win32';

let failures = 0;
let testNum = 0;

function test(name, fn) {
  testNum++;
  process.stdout.write(`  [${testNum}] ${name} ... `);
  try {
    fn();
    console.log('OK');
  } catch (err) {
    failures++;
    console.log('FAIL');
    console.log(`      ${err.message}`);
    if (err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

function makeSandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'claude-setup-smoke-'));
  const home = path.join(root, 'home');
  const proj = path.join(root, 'proj');
  mkdirSync(home, { recursive: true });
  mkdirSync(proj, { recursive: true });
  return { root, home, proj };
}

function runInstall(args, sandbox, extraEnv = {}) {
  const env = {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    CLAUDE_SETUP_LOCAL_SOURCE: REPO_ROOT,
    ...extraEnv,
  };
  return spawnSync(process.execPath, [INSTALL_MJS, ...args], { env, encoding: 'utf8' });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}\n      expected: ${expected}\n      actual:   ${actual}`);
}

console.log('claude-setup installer smoke tests\n');

test('manifest validates', () => {
  const m = loadManifest();
  assert(m.components.length > 0, 'no components in manifest');
  for (const c of m.components) {
    for (const f of c.files) {
      const abs = path.join(REPO_ROOT, f.src);
      assert(existsSync(abs), `manifest file not found in repo: ${f.src}`);
    }
  }
});

test('--list exits 0 and prints components', () => {
  const sb = makeSandbox();
  const r = runInstall(['--list'], sb);
  assertEq(r.status, 0, `--list exit code (stderr: ${r.stderr})`);
  assert(r.stdout.includes('hook:optimize-images'), 'list missing hook');
  assert(r.stdout.includes('skill:fix-vulnerabilities'), 'list missing skill');
  rmSync(sb.root, { recursive: true, force: true });
});

test('--all --dry-run writes nothing', () => {
  const sb = makeSandbox();
  const r = runInstall(
    ['--all', '--yes', '--dry-run', `--project-root=${sb.proj}`, '--scope-default=project'],
    sb
  );
  assertEq(r.status, 0, `dry-run exit code (stderr: ${r.stderr})`);
  assert(!existsSync(path.join(sb.proj, '.claude')), '.claude/ should not exist after dry-run');
  assert(!existsSync(path.join(sb.proj, 'CLAUDE.md')), 'CLAUDE.md should not exist after dry-run');
  rmSync(sb.root, { recursive: true, force: true });
});

test('--all real install creates files and merges settings', () => {
  const sb = makeSandbox();
  const r = runInstall(
    ['--all', '--yes', `--project-root=${sb.proj}`, '--scope-default=project'],
    sb
  );
  assertEq(r.status, 0, `install exit code (stderr: ${r.stderr})`);

  const hookSh = path.join(sb.proj, '.claude/hooks/optimize-images/check-committed-images.sh');
  const hookMjs = path.join(sb.proj, '.claude/hooks/optimize-images/optimize-images.mjs');
  const skillMd = path.join(sb.proj, '.claude/skills/fix-vulnerabilities/SKILL.md');
  const ruleMd = path.join(sb.proj, '.claude/rules/documentation-driven-development.md');
  const claudeMd = path.join(sb.proj, 'CLAUDE.md');
  const settings = path.join(sb.proj, '.claude/settings.json');

  assert(existsSync(hookSh), 'hook script not written');
  assert(existsSync(hookMjs), 'hook node script not written');
  assert(existsSync(skillMd), 'skill not written');
  assert(existsSync(ruleMd), 'rule not written');
  assert(existsSync(claudeMd), 'template not written');
  assert(existsSync(settings), 'settings.json not created');

  assertEq(
    readFileSync(hookSh, 'utf8'),
    readFileSync(path.join(REPO_ROOT, 'hooks/optimize-images/check-committed-images.sh'), 'utf8'),
    'hook script bytes mismatch'
  );

  if (!IS_WINDOWS) {
    const mode = statSync(hookSh).mode & 0o777;
    assert(mode & 0o100, `hook script not executable, mode=${mode.toString(8)}`);
  }

  const doc = JSON.parse(readFileSync(settings, 'utf8'));
  assert(Array.isArray(doc.hooks?.PreToolUse), 'settings.hooks.PreToolUse missing');
  const group = doc.hooks.PreToolUse.find((g) => g.matcher === 'Bash');
  assert(group, 'Bash matcher group missing');
  assert(group.hooks.some((h) => h.command?.includes('check-committed-images.sh')), 'hook command missing');

  rmSync(sb.root, { recursive: true, force: true });
});

test('idempotency: re-running produces no changes', () => {
  const sb = makeSandbox();
  const args = ['--all', '--yes', `--project-root=${sb.proj}`, '--scope-default=project'];
  const r1 = runInstall(args, sb);
  assertEq(r1.status, 0, `first install (stderr: ${r1.stderr})`);

  const settingsPath = path.join(sb.proj, '.claude/settings.json');
  const settings1 = readFileSync(settingsPath, 'utf8');

  const r2 = runInstall(args, sb);
  assertEq(r2.status, 0, `second install (stderr: ${r2.stderr})`);

  const settings2 = readFileSync(settingsPath, 'utf8');
  assertEq(settings1, settings2, 'settings.json changed on re-run');
  assert(r2.stdout.includes('skip') || r2.stdout.includes('identical'), 'expected skip/identical messaging');

  rmSync(sb.root, { recursive: true, force: true });
});

test('CLAUDE.md is never overwritten silently', () => {
  const sb = makeSandbox();
  const claudeMd = path.join(sb.proj, 'CLAUDE.md');
  const original = '# my existing rules\n\n- do not touch me\n';
  writeFileSync(claudeMd, original);

  const r = runInstall(
    ['--component=template:claude-md', '--yes', `--project-root=${sb.proj}`],
    sb
  );
  assertEq(r.status, 0, `install exit code (stderr: ${r.stderr})`);

  assertEq(readFileSync(claudeMd, 'utf8'), original, 'existing CLAUDE.md was modified');
  assert(existsSync(`${claudeMd}.from-claude-setup`), 'diverted file not written');

  rmSync(sb.root, { recursive: true, force: true });
});

test('settings.json: pre-existing unrelated content preserved', () => {
  const sb = makeSandbox();
  const settingsDir = path.join(sb.proj, '.claude');
  mkdirSync(settingsDir, { recursive: true });
  const settingsPath = path.join(settingsDir, 'settings.json');
  const existing = {
    permissions: { allow: ['Bash(npm test)'] },
    hooks: {
      PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo edit' }] }],
    },
  };
  writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');

  const r = runInstall(
    ['--component=hook:optimize-images', '--scope=hook:optimize-images:project', '--yes', `--project-root=${sb.proj}`],
    sb
  );
  assertEq(r.status, 0, `install exit code (stderr: ${r.stderr})`);

  const after = JSON.parse(readFileSync(settingsPath, 'utf8'));
  assertEq(after.permissions?.allow?.[0], 'Bash(npm test)', 'permissions wiped');
  const editGroup = after.hooks.PreToolUse.find((g) => g.matcher === 'Edit');
  assert(editGroup && editGroup.hooks[0].command === 'echo edit', 'unrelated Edit matcher wiped');
  const bashGroup = after.hooks.PreToolUse.find((g) => g.matcher === 'Bash');
  assert(bashGroup, 'Bash matcher not added');
  assert(bashGroup.hooks.some((h) => h.command?.includes('check-committed-images.sh')), 'hook entry not added');

  rmSync(sb.root, { recursive: true, force: true });
});

test('--non-interactive without selection fails fast', () => {
  const sb = makeSandbox();
  const r = runInstall(['--non-interactive', `--project-root=${sb.proj}`], sb);
  assert(r.status !== 0, 'expected non-zero exit when no selection given');
  assert(/component/i.test(r.stderr), `expected error mentioning components, got: ${r.stderr}`);
  rmSync(sb.root, { recursive: true, force: true });
});

console.log(`\n${testNum - failures}/${testNum} passed`);
process.exit(failures === 0 ? 0 : 1);
