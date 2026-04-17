import { homedir } from 'node:os';
import path from 'node:path';

export function scopeRoot(scope, projectRoot) {
  switch (scope) {
    case 'global':
      return path.join(homedir(), '.claude');
    case 'project':
      return path.join(projectRoot, '.claude');
    case 'projectRoot':
      return projectRoot;
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

export function settingsPath(scope, projectRoot) {
  return path.join(scopeRoot(scope, projectRoot), 'settings.json');
}

// Bash on Windows (Git Bash / MSYS) handles forward slashes more reliably than
// backslashes inside command strings written to settings.json.
export function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}
