import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toPosixPath } from './paths.mjs';

const backedUpThisRun = new Set();

export function mergeSettings(settingsPath, patch, installRoot, { dryRun = false } = {}) {
  const rendered = renderEntry(patch.entry, { installRoot: toPosixPath(installRoot) });

  let doc = {};
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, 'utf8').trim();
    doc = raw === '' ? {} : JSON.parse(raw);
  }

  const cursor = ensureArrayAt(doc, patch.path);

  let group = cursor.find((g) => g[patch.matcherKey] === patch.matcher);
  let createdGroup = false;
  if (!group) {
    group = { [patch.matcherKey]: patch.matcher, hooks: [] };
    createdGroup = true;
  }

  const exists = group.hooks.some((h) => h[patch.dedupKey] === rendered[patch.dedupKey]);
  if (exists) {
    return { changed: false, settingsPath };
  }

  group.hooks.push(rendered);
  if (createdGroup) cursor.push(group);

  if (dryRun) {
    return { changed: true, settingsPath, dryRun: true };
  }

  if (existsSync(settingsPath) && !backedUpThisRun.has(settingsPath)) {
    copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
    backedUpThisRun.add(settingsPath);
  }
  writeFileAtomic(settingsPath, JSON.stringify(doc, null, 2) + '\n');
  return { changed: true, settingsPath };
}

function ensureArrayAt(doc, keys) {
  let node = doc;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (node[k] == null || typeof node[k] !== 'object') node[k] = {};
    node = node[k];
  }
  const last = keys[keys.length - 1];
  if (!Array.isArray(node[last])) node[last] = [];
  return node[last];
}

function renderEntry(entry, vars) {
  const json = JSON.stringify(entry);
  const replaced = json.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Unknown template var {{${k}}}`);
    return vars[k].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  });
  return JSON.parse(replaced);
}

function writeFileAtomic(target, contents) {
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, contents);
  renameSync(tmp, target);
}

export function _resetBackupTrackerForTests() {
  backedUpThisRun.clear();
}
