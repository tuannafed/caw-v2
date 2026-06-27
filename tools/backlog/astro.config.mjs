import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Two build targets share one source tree:
//
//   1. Local SSR (default) — Node adapter, reads docs/caw/stories/
//      live via filesystem. Run:
//        CAW_PROJECT_ROOT=/path/to/project pnpm dev
//
//   2. Static snapshot for Vercel — Vercel static adapter, every API route
//      pre-renders to a flat JSON file at build time. Re-build (typically
//      via pre-commit hook) whenever task files change. Run:
//        DEPLOY_TARGET=vercel pnpm build
//
// The DEPLOY_TARGET flag is forwarded to API routes via Vite define so each
// route can flip `prerender = true` and switch its data source. Routes that
// require a live filesystem (events SSE, project-files, system) short-circuit
// to an empty response in static mode.
//
// Auth (PUBLIC_AUTH_USER + PUBLIC_AUTH_PASS) is fully client-side using
// localStorage — no middleware, no serverless. Acceptable for low-stakes
// internal tools because credentials are embedded in the JS bundle.
const target = process.env.DEPLOY_TARGET === 'vercel' ? 'vercel' : 'local';
const isStatic = target === 'vercel';

export default defineConfig({
  output: isStatic ? 'static' : 'server',
  adapter: isStatic ? vercel() : node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_DEPLOY_TARGET': JSON.stringify(target),
    },
  },
  server: {
    port: Number(process.env.PORT) || 4321,
    // Bind to localhost by default. The API routes serve project files + host
    // telemetry with NO server-side auth (auth is cosmetic, client-side only),
    // so `host: true` (0.0.0.0) would expose them to anyone on the LAN. Set
    // HOST=0.0.0.0 explicitly to opt into network access.
    host: process.env.HOST || '127.0.0.1',
  },
});
