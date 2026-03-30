#!/usr/bin/env node

/**
 * Image optimization script for Claude Code hook. * Converts raster images to WEBP format using sharp. * * Usage: node optimize-images.mjs [--quality N] [--keep] <image-paths...> *   --quality N   WEBP quality 1-100 (default: 80) *   --keep        Keep original files after conversion * * Outputs JSON with per-file results for Claude to display as a comparison table. */
import { createRequire } from 'node:module';
import { stat, unlink, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

// Self-bootstrapping sharp resolution.
// 1. Try project-local import (works if sharp is already a dependency)
// 2. Fall back to a shared cache at ~/.cache/claude-hooks/node_modules
//    and auto-install sharp there on first run. Subsequent runs are instant.
const CACHE_DIR = join(homedir(), '.cache', 'claude-hooks');
let sharp;

try {
  sharp = (await import('sharp')).default;
} catch {
  // Check if sharp exists in the shared cache
  const cacheRequire = createRequire(join(CACHE_DIR, '_'));
  try {
    sharp = cacheRequire('sharp');
  } catch {
    // Auto-install sharp into the shared cache
    console.error('sharp not found — installing into ~/.cache/claude-hooks (one-time setup)...');
    await mkdir(CACHE_DIR, { recursive: true });
    execSync('npm install --prefix . sharp', { cwd: CACHE_DIR, stdio: 'inherit' });
    sharp = cacheRequire('sharp');
  }
}

// Parse arguments
const args = process.argv.slice(2);
let quality = 80;
let keepOriginals = false;
const files = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--quality' && args[i + 1]) {
    quality = parseInt(args[i + 1], 10);
    if (isNaN(quality) || quality < 1 || quality > 100) {
      console.error('Error: --quality must be between 1 and 100');
      process.exit(1);
    }
    i++;
  } else if (args[i] === '--keep') {
    keepOriginals = true;
  } else if (!args[i].startsWith('-')) {
    files.push(args[i]);
  }
}

if (files.length === 0) {
  console.error('Usage: node optimize-images.mjs [--quality N] [--keep] <image-paths...>');
  console.error('  --quality N   WEBP quality 1-100 (default: 80)');
  console.error('  --keep        Keep original files after conversion');
  process.exit(1);
}

function formatSize(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const SKIP_EXTENSIONS = new Set(['.webp', '.svg']);

const FAVICON_PATTERNS = ['favicon', 'apple-icon', 'apple-touch-icon', 'android-chrome', 'mstile'];
const results = [];

for (const file of files) {
  const ext = extname(file).toLowerCase();

  if (SKIP_EXTENSIONS.has(ext)) {
    results.push({
      file,
      skipped: true,
      reason:
        ext === '.svg'
          ? 'SVG is a vector format — converting to WEBP would rasterize it and lose scalability'
          : 'File is already in WEBP format',
    });
    continue;
  }

  const name = basename(file, ext);
  const dir = dirname(file);

  if (FAVICON_PATTERNS.some((pattern) => name.toLowerCase().includes(pattern))) {
    results.push({
      file,
      skipped: true,
      reason: 'Favicon-related file — must remain in original format for browser/device compatibility',
    });
    continue;
  }

  const outputPath = join(dir, `${name}.webp`);

  try {
    const originalStat = await stat(file);
    const originalSize = originalStat.size;

    await sharp(file).webp({ quality }).toFile(outputPath);

    const newStat = await stat(outputPath);
    const newSize = newStat.size;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    const result = {
      file,
      outputFile: outputPath,
      originalSize,
      originalSizeFormatted: formatSize(originalSize),
      newSize,
      newSizeFormatted: formatSize(newSize),
      savings: parseFloat(savings),
    };

    if (newSize >= originalSize) {
      // WEBP is larger — revert and keep original
      result.note =
        'WEBP is larger than the original. This typically happens with very small images, ' +
        'already highly-compressed files (e.g., optimized PNGs), or images with very few colors. ' +
        'Consider keeping the original format or trying a lower quality setting.';
      result.reverted = true;
      await unlink(outputPath);
    } else if (parseFloat(savings) < 5) {
      result.note =
        'Minimal size reduction (<5%). The source image is likely already well-compressed. ' +
        'WEBP conversion is optional — the savings may not justify the format change. ' +
        'You could try a lower quality value or keep the original format.';
    }

    if (!result.reverted && !keepOriginals) {
      await unlink(file);
      result.originalRemoved = true;
    }

    results.push(result);
  } catch (err) {
    results.push({
      file,
      error: err.message,
    });
  }
}

console.log(JSON.stringify({ quality, keepOriginals, results }, null, 2));
