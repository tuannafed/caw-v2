#!/usr/bin/env node
// Vercel build entry — wraps `astro build` with explicit env + output relocation.
//
// Why a Node script instead of an inline shell one-liner?
//   1. POSIX subshell substitution (`$(cd .. && pwd)`) is fragile on
//      Vercel's build container. Node resolves paths deterministically.
//   2. We need to copy the adapter's `.vercel/output/` from this subfolder
//      up to the repo root so Vercel's runtime picks it up.
//   3. Verbose logging makes Vercel build failures debuggable from the
//      dashboard without re-running locally.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const viewerDir = resolve(scriptDir, '..');
// Viewer installs at <project>/backlog/, so the project root is one level up.
const repoRoot = resolve(viewerDir, '..');

function log(msg) {
  console.log(`[build-vercel] ${msg}`);
}

log(`viewer dir : ${viewerDir}`);
log(`repo root  : ${repoRoot}`);
log(`node       : ${process.version}`);

const env = {
  ...process.env,
  DEPLOY_TARGET: 'vercel',
  CAW_PROJECT_ROOT: repoRoot,
};

log('running astro build');
const result = spawnSync('node_modules/.bin/astro', ['build'], {
  cwd: viewerDir,
  env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  log(`astro build exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}

const adapterOut = resolve(viewerDir, '.vercel', 'output');
const rootOut = resolve(repoRoot, '.vercel', 'output');

if (!existsSync(adapterOut)) {
  log(`ERROR: adapter did not produce ${adapterOut}`);
  process.exit(1);
}

log(`relocating ${adapterOut} → ${rootOut}`);
if (existsSync(rootOut)) {
  rmSync(rootOut, { recursive: true, force: true });
}
mkdirSync(dirname(rootOut), { recursive: true });
// IMPORTANT: must dereference pnpm-style symlinks. Astro Vercel adapter
// produces `node_modules/clsx -> .pnpm/clsx@x.x.x/node_modules/clsx` style
// symlinks. Without dereferencing, Vercel's deployment upload either strips
// the broken symlinks or fails to follow them, causing the Lambda to crash
// at runtime with `ERR_MODULE_NOT_FOUND: Cannot find package 'clsx'`.
//
// Node's fs.cpSync({ dereference: true }) only dereferences the top-level
// path, not nested symlinks. So we shell out to `cp -RL` (capital L = follow
// ALL symlinks at every depth). This works on macOS and Linux (Vercel build
// runs on Linux).
const cpResult = spawnSync('cp', ['-RL', `${adapterOut}/.`, rootOut], {
  stdio: 'inherit',
});
if (cpResult.status !== 0) {
  log(`ERROR: cp -RL failed with exit code ${cpResult.status}`);
  process.exit(cpResult.status ?? 1);
}

log('done.');
