# Skills Checklist

Two skill sources. Both end up in `.claude/skills/` of the target project.

```
templates/skills/   →  caw-owned     (5 skills)   workflow / archetype / integration
.agents/skills/     →  hub-curated   (65 skills)  vendor docs, pulled via skills.sh
```

**Priority:** If a topic is covered by a hub skill, prefer hub. Caw-owned skills exist only when no authoritative external source covers them.

**Curation:** Skills are hand-picked for D2V/Okushon stack. Avoid duplicates and skills where vendor docs / LLM knowledge is sufficient (CLI references, version upgrades, generic utilities).

> This is the curated source breakdown. For the machine-readable, per-skill index
> the `setup` agent parses, see [SKILLS-CATALOG.md](SKILLS-CATALOG.md) (auto-generated).

---

## Caw-owned (4)

| Skill | Purpose |
|---|---|
| `api-contract` | REST conventions + API Contract template (Plan → backend/frontend phase handoff) |
| `error-handling-patterns` | Error envelope spec + full-stack handling (filters, ApiError, RQ, toast/inline rules) |
| `nextjs-feature` | Archetype: feature-driven Next.js App Router (folder contract, ownership) |
| `react-component-testing` | Leak-free Jest + RTL + TanStack Query component-test patterns |

---

## Hub sources (65 skills)

| Source | Skills | Tier |
|---|---:|---|
| [cloudflare/skills](https://github.com/cloudflare/skills) | 5 | Official |
| [expo/skills](https://github.com/expo/skills) | 5 | Official |
| [deanpeters/product-manager-skills](https://github.com/deanpeters/product-manager-skills) | 5 | Community (PM/BA) |
| [auth0/agent-skills](https://github.com/auth0/agent-skills) | 4 | Official |
| [tanstack-skills/tanstack-skills](https://github.com/tanstack-skills/tanstack-skills) | 4 | Official |
| [wshobson/agents](https://github.com/wshobson/agents) | 4 | Community (35K stars) |
| [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) | 3 | Vendor-adjacent (RN community) |
| [getsentry/sentry-for-ai](https://github.com/getsentry/sentry-for-ai) | 3 | Official (Sentry) |
| [obra/superpowers](https://github.com/obra/superpowers) | 3 | Community (top installs ecosystem) |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 3 | Labs |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | 2 | Community (Addy Osmani — Google Chrome team) |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | 2 | Official (@github org) |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 2 | Community (67K stars — Matt Pocock) |
| [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | 2 | Labs |
| [prisma/skills](https://github.com/prisma/skills) | 2 | Official |
| [stripe/agent-toolkit](https://github.com/stripe/agent-toolkit) | 2 | Official |
| [supabase/agent-skills](https://github.com/supabase/agent-skills) | 2 | Official |
| [anthropics/skills](https://github.com/anthropics/skills) | 1 | Official (Anthropic) |
| [aj-geddes/claude-code-bmad-skills](https://github.com/aj-geddes/claude-code-bmad-skills) | 1 | Community (BMAD) |
| [currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill) | 1 | Vendor-adjacent (Currents) |
| [gocallum/nextjs16-agent-skills](https://github.com/gocallum/nextjs16-agent-skills) | 1 | Community |
| [honra-io/drizzle-best-practices](https://github.com/honra-io/drizzle-best-practices) | 1 | Community |
| [jeffallan/claude-skills](https://github.com/jeffallan/claude-skills) | 1 | Community (8.9K stars) |
| [kadajett/agent-nestjs-skills](https://github.com/kadajett/agent-nestjs-skills) | 1 | Community (15.5K installs) |
| [redis/agent-skills](https://github.com/redis/agent-skills) | 1 | Official |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/main/skills) | 1 | Official |
| [software-mansion-labs/skills](https://github.com/software-mansion-labs/skills) | 1 | Vendor-adjacent (RN authors) |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | 1 | Labs (CLI tooling) |
| [vercel/turborepo](https://github.com/vercel/turborepo) | 1 | Official |

---

## Coverage by platform

### Backend

| Stack | Skills |
|---|---|
| NestJS framework (DI, modules, JWT, validation, exceptions, testing) | `nestjs-best-practices` |
| WebSockets / Socket.io (auth, rooms, Redis adapter scaling) | `websocket-engineer` |
| Prisma ORM | `prisma-client-api`, `prisma-postgres` |
| Drizzle ORM (Postgres — schemas, queries, migrations) | `drizzle-best-practices` |
| Redis (cache + queue + RQE + RedisVL) | `redis-development` |
| Supabase (DB, Auth, Edge Functions, Realtime, Storage) | `supabase`, `supabase-postgres-best-practices` |
| Stripe payment | `stripe-best-practices`, `stripe-projects` |
| Auth0 (API guards) | Use `auth0-nextjs` (covers API + middleware) |

### Frontend (Web)

| Stack | Skills |
|---|---|
| Next.js | `next-best-practices`, `next-cache-components` |
| React | `vercel-react-best-practices`, `vercel-composition-patterns` |
| shadcn/ui | `shadcn` |
| Tailwind v4 (design system, CVA, migration) | `tailwind-design-system` |
| Auth0 (web) | `auth0-nextjs`, `auth0-react` |
| Auth.js v5 (next-auth) | `authjs-skills` |
| TanStack Query (server state) | `tanstack-query` |
| TanStack Router | `tanstack-router` |
| TanStack Start (full-stack) | `tanstack-start` |
| TanStack Table | `tanstack-table` |

### Mobile

| Stack | Skills |
|---|---|
| Expo Router fundamentals (UI, navigation, animations) | `building-native-ui` |
| Data fetching (fetch + RQ + offline + loaders) | `native-data-fetching` |
| Tailwind setup for Expo (NativeWind v5) | `expo-tailwind-setup` |
| Deployment (App Store / Play Store / web) | `expo-deployment` |
| EAS Update health monitoring | `eas-update-insights` |
| React Native (New Architecture, Reanimated, Gesture) | `react-native-best-practices`, `vercel-react-native-skills` |
| Auth0 (mobile) | `auth0-react-native`, `auth0-expo` |

### Edge / Serverless

| Stack | Skills |
|---|---|
| Cloudflare platform (Workers, KV, D1, R2, AI, networking) | `cloudflare` |
| Workers best practices | `workers-best-practices` |
| Wrangler CLI | `wrangler` |
| Durable Objects | `durable-objects` |
| Cloudflare Agents SDK | `agents-sdk` |

### Product / PM (planner depends on these — always installed)

| Activity | Skills |
|---|---|
| Discovery framing, problem statement, stakeholder analysis | `business-analyst` |
| PRD template structure (problem → users → solution → success criteria) | `prd-development` |
| Spec format optimized for downstream agents | `create-specification` |
| Mike Cohn user story + Gherkin acceptance criteria | `user-story` |
| Breaking large stories into deliverable phases | `user-story-splitting` |
| Picking RICE / ICE / value-effort for lane assignment | `prioritization-advisor` |
| Sequencing + dependency reasoning across phases | `roadmap-planning` |

### Workflow (planning, docs, testing, perf, review, debug)

| Activity | Skills |
|---|---|
| Generate PRD from conversation context | `to-prd` (Matt Pocock) |
| Web app E2E testing (Playwright + reconnaissance pattern) | `webapp-testing` (Anthropic) |
| JavaScript/TypeScript testing (Jest + Vitest + Testing Library) | `javascript-testing-patterns` |
| Web performance (Lighthouse, Core Web Vitals, budgets) | `performance` (Addy Osmani) |
| Web accessibility (WCAG, ARIA, axe-core) | `accessibility` (Addy Osmani) |
| Code review (security + perf + testing + architecture) | `code-review-excellence` |
| Refactoring (patterns + safe migration) | `refactor` (GitHub official) |
| Architecture deepening (find refactoring opportunities, consolidate modules) | `improve-codebase-architecture` (Matt Pocock) |
| Systematic debugging (87.5K installs — top ecosystem skill) | `systematic-debugging` |
| Test-driven development (red → green → refactor loop) | `test-driven-development` (obra) |
| Playwright deep guide (POM, flaky tests, CI, accessibility, security) | `playwright-best-practices` (Currents) |
| Verification before claiming done (evidence-before-assertions) | `verification-before-completion` (obra) |

### Monitoring / Observability

| Stack | Skills |
|---|---|
| Sentry — auto-detect platform + install correct SDK | `sentry-sdk-setup` |
| Sentry React (browser SDK, replay, profiling) | `sentry-react-sdk` |
| Sentry workflow (triage exceptions, review PR comments, fix from Sentry context) | `sentry-workflow` |

### Cross-cutting

| Stack | Skills |
|---|---|
| TypeScript advanced types (generics, conditional, mapped, template literals) | `typescript-advanced-types` |
| Turborepo (incl. pnpm workspaces) | `turborepo` |
| GitHub Actions / gh CLI | `github`, `github-actions` |
| Skill discovery | `find-skills` |
| Skill validation | `validate-skills` |

---

## Gaps

Topics with no quality hub skill — handled by LLM knowledge or caw-maintain.

| Gap | Recommendation |
|---|---|
| FastAPI | LLM + framework docs sufficient |
| BullMQ + Bull-Board (NestJS) | Caw-maintain if D2V needs custom queue patterns |
| Passport JWT + CASL (NestJS auth) | Caw-maintain (covered partially by `nestjs-best-practices`) |
| WXT Chrome extension | Pull `quangpl/browser-extension-skills` if needed |
| TypeORM | LLM + TypeORM docs sufficient (Okushon-BE only) |
| React Hook Form + Zod | LLM + RHF docs sufficient |
| Biome / Zustand | LLM sufficient — small APIs |
| Swagger / OpenAPI for NestJS | Covered by `nestjs-best-practices` patterns |
| Mailer / Handlebars / Throttler | LLM sufficient — niche utilities |

---

## Curation principles

A hub skill is kept only if it satisfies **all four**:

1. **Non-trivial knowledge** — Skill teaches patterns/best-practices that aren't covered by official docs alone (e.g., security nuances, performance tuning, framework-specific gotchas).
2. **Used by D2V / Okushon stack** — Skill maps to a real dependency in production code.
3. **No better duplicate** — Among similar skills, only the highest-quality / most-cited one is kept.
4. **Beats LLM baseline** — Generic CLI/upgrade/utility skills are removed; LLM + vendor docs cover those without overhead.

---

## Source-of-truth split

| Folder | What goes here | Editable? |
|---|---|---|
| `templates/skills/<name>/SKILL.md` | Caw-owned (workflow / archetype / integration) | Yes — flat layout, edit freely |
| `.agents/skills/<name>/SKILL.md` | Hub-curated (vendor docs) | No — sync via `npx skills update` |
| `.claude/skills/` (in target project) | Generated on `caw init` / `caw sync` | No — regenerate from sources |
