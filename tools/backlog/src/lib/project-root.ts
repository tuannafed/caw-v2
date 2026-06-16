import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let cached: string | null = null;

/**
 * Resolve the caw project root:
 *   1. `CAW_PROJECT_ROOT` env var if set
 *   2. Walk up from cwd looking for `docs/caw/` (caw marker)
 *   3. Fall back to cwd
 *
 * Cached on first call — restart `pnpm dev` to re-detect.
 */
export function getProjectRoot(): string {
  if (cached) return cached;

  const env = process.env.CAW_PROJECT_ROOT;
  if (env && existsSync(env)) {
    cached = resolve(env);
    return cached;
  }

  const start = process.cwd();
  let dir = start;
  while (true) {
    const marker = resolve(dir, 'docs', 'caw');
    try {
      if (statSync(marker).isDirectory()) {
        cached = dir;
        return dir;
      }
    } catch {
      // not found at this level — keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cached = start;
  return start;
}
