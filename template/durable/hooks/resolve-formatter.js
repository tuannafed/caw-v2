/**
 * Formatter resolution utilities for caw hooks.
 * Detects Biome or Prettier in the project root and resolves the binary.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const projectRootCache = new Map();
const formatterCache = new Map();
const binCache = new Map();

const BIOME_CONFIGS = ['biome.json', 'biome.jsonc'];

const PRETTIER_CONFIGS = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs',
  '.prettierrc.mjs', '.prettierrc.yml', '.prettierrc.yaml', '.prettierrc.toml',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs'
];

const PROJECT_ROOT_MARKERS = ['package.json', ...BIOME_CONFIGS, ...PRETTIER_CONFIGS];
const WIN_CMD_SHIMS = { npx: 'npx.cmd', pnpm: 'pnpm.cmd', yarn: 'yarn.cmd', bunx: 'bunx.cmd' };
const FORMATTER_PACKAGES = {
  biome: { binName: 'biome', pkgName: '@biomejs/biome' },
  prettier: { binName: 'prettier', pkgName: 'prettier' }
};

function findProjectRoot(startDir) {
  if (projectRootCache.has(startDir)) return projectRootCache.get(startDir);
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    for (const marker of PROJECT_ROOT_MARKERS) {
      if (fs.existsSync(path.join(dir, marker))) {
        projectRootCache.set(startDir, dir);
        return dir;
      }
    }
    dir = path.dirname(dir);
  }
  projectRootCache.set(startDir, startDir);
  return startDir;
}

function detectFormatter(projectRoot) {
  if (formatterCache.has(projectRoot)) return formatterCache.get(projectRoot);
  for (const cfg of BIOME_CONFIGS) {
    if (fs.existsSync(path.join(projectRoot, cfg))) {
      formatterCache.set(projectRoot, 'biome');
      return 'biome';
    }
  }
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if ('prettier' in pkg) {
        formatterCache.set(projectRoot, 'prettier');
        return 'prettier';
      }
    }
  } catch { /* malformed package.json */ }
  for (const cfg of PRETTIER_CONFIGS) {
    if (fs.existsSync(path.join(projectRoot, cfg))) {
      formatterCache.set(projectRoot, 'prettier');
      return 'prettier';
    }
  }
  formatterCache.set(projectRoot, null);
  return null;
}

/** Detect package manager from lock files */
function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function resolveFormatterBin(projectRoot, formatter) {
  const cacheKey = `${projectRoot}:${formatter}`;
  if (binCache.has(cacheKey)) return binCache.get(cacheKey);

  const pkg = FORMATTER_PACKAGES[formatter];
  if (!pkg) { binCache.set(cacheKey, null); return null; }

  const isWin = process.platform === 'win32';
  const localBin = path.join(projectRoot, 'node_modules', '.bin', isWin ? `${pkg.binName}.cmd` : pkg.binName);
  if (fs.existsSync(localBin)) {
    const result = { bin: localBin, prefix: [] };
    binCache.set(cacheKey, result);
    return result;
  }

  const pm = detectPackageManager(projectRoot);
  const execMap = { pnpm: 'pnpm dlx', bun: 'bunx', yarn: 'yarn dlx', npm: 'npx' };
  const execCmd = execMap[pm] || 'npx';
  const [rawBin = 'npx', ...prefix] = execCmd.split(/\s+/).filter(Boolean);
  const bin = isWin ? WIN_CMD_SHIMS[rawBin] || rawBin : rawBin;
  const result = { bin, prefix: [...prefix, pkg.pkgName] };
  binCache.set(cacheKey, result);
  return result;
}

module.exports = { findProjectRoot, detectFormatter, resolveFormatterBin };
