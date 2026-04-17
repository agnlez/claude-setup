import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import path from 'node:path';
import { URL } from 'node:url';

export function rawUrl(repo, srcPath) {
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.ref}/${srcPath}`;
}

export async function fetchBytes(url, { retries = 1 } = {}) {
  // Smoke tests: read from a local repo checkout instead of GitHub.
  const localRoot = process.env.CLAUDE_SETUP_LOCAL_SOURCE;
  if (localRoot) {
    const srcPath = url.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, '');
    return readFileSync(path.join(localRoot, srcPath));
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await getOnce(url);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function getOnce(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request(
      {
        method: 'GET',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { 'User-Agent': 'claude-setup-installer' },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          getOnce(new URL(res.headers.location, url).toString()).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
