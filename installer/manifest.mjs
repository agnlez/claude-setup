import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadManifest(manifestPath) {
  const resolved = manifestPath ?? defaultManifestPath();
  const raw = readFileSync(resolved, 'utf8');
  const doc = JSON.parse(raw);
  validate(doc);
  return doc;
}

function defaultManifestPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', 'manifest.json');
}

function validate(doc) {
  if (doc.schemaVersion !== 1) {
    throw new Error(`Unsupported manifest schemaVersion: ${doc.schemaVersion}`);
  }
  if (!doc.repo?.owner || !doc.repo?.name || !doc.repo?.ref) {
    throw new Error('manifest.repo must include owner, name, ref');
  }
  if (!Array.isArray(doc.components)) {
    throw new Error('manifest.components must be an array');
  }
  const ids = new Set();
  for (const c of doc.components) {
    if (!c.id || !c.type || !c.name) {
      throw new Error(`Component missing id/type/name: ${JSON.stringify(c)}`);
    }
    if (ids.has(c.id)) throw new Error(`Duplicate component id: ${c.id}`);
    ids.add(c.id);
    if (!Array.isArray(c.files) || c.files.length === 0) {
      throw new Error(`Component ${c.id} has no files`);
    }
    if (!Array.isArray(c.scopes) || c.scopes.length === 0) {
      throw new Error(`Component ${c.id} has no scopes`);
    }
    if (!c.scopes.includes(c.defaultScope)) {
      throw new Error(`Component ${c.id}: defaultScope '${c.defaultScope}' not in scopes`);
    }
  }
}

export function findComponent(doc, id) {
  return doc.components.find((c) => c.id === id);
}
