/**
 * Build-time deploy target flag.
 *
 * - `local`  → Astro Node SSR. Routes read filesystem on every request.
 * - `vercel` → Astro hybrid build. Data routes (those that opt in via
 *              `export const prerender = IS_STATIC`) snapshot to flat JSON
 *              at build time. Auth routes (login API, middleware) stay
 *              serverless so they can run per-request. Live filesystem
 *              endpoints (events SSE, project-files, system) short-circuit
 *              to empty responses in the snapshot because Vercel serverless
 *              has no access to the caw project tree at runtime.
 *
 * Forwarded into client code via `import.meta.env.PUBLIC_DEPLOY_TARGET`
 * (see astro.config.mjs vite.define).
 */
export const DEPLOY_TARGET: 'local' | 'vercel' =
  process.env.DEPLOY_TARGET === 'vercel' ? 'vercel' : 'local';

// IS_STATIC == "should this data route prerender at build time on Vercel?"
// Used by data routes that snapshot task/project state. Auth/login routes
// do NOT use this flag — they stay dynamic on every target.
export const IS_STATIC = DEPLOY_TARGET === 'vercel';
