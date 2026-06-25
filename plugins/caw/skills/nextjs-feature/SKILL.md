---
name: nextjs-feature
description: Archetype for a feature-driven Next.js App Router product. Defines folder contract (app/ routes, src/features/<feature>/, src/components/ui/, src/lib/), feature ownership rules, and reuse boundaries. Use when scaffolding a Next.js SaaS or reviewing folder structure violations. For workspace/multi-area apps with capability-based modules, see nextjs-monorepo instead.
---

# Archetype: Next.js Feature SaaS

Neutral archetype for a feature-driven web product built with Next.js App Router.

## Use When

- The app is organized around user-facing product features (NOT workspace areas — use `nextjs-monorepo` for that)
- Routes should stay thin and compose feature modules
- Shared UI and infrastructure need clear separation from feature code

## Folder contract

```
app/                              ← Next.js routes (thin layer)
├── (marketing)/                  ← public route group
├── (app)/                        ← authenticated route group
│   └── <feature>/page.tsx        ← delegates to FeaturePage
└── api/                          ← Route handlers (thin, delegate to features)

src/
├── features/<feature>/           ← feature ownership (the unit of work)
│   ├── components/               ← feature-specific UI
│   ├── api/                      ← typed API client + hooks
│   ├── hooks/                    ← feature-specific hooks
│   ├── schemas/                  ← Zod validation schemas
│   ├── store/                    ← feature-scoped state (Zustand)
│   ├── constants.ts              ← feature constants
│   ├── utils.ts                  ← feature-scoped helpers
│   ├── types.ts
│   ├── tests/
│   └── index.ts                  ← public API of the feature
├── components/ui/                ← generic primitives (Button, Card, Dialog)
├── components/<shared>/          ← shared composite components (used by 2+ features)
└── lib/                          ← infrastructure (api-client, auth, permissions)
```

## Rules

### Feature ownership

- Code goes in `src/features/<feature>/` first; never in `app/` or top-level `src/`
- `app/<feature>/page.tsx` is **2-5 lines max** — imports and renders `<FeaturePage />` from the feature
- Each feature exports a single public API via `src/features/<feature>/index.ts`

### Shared vs feature

- **2+ features use it** → move to `src/components/<shared>/` or `src/lib/`
- **1 feature uses it** → keep inside that feature's folder
- Never copy-paste between feature folders; extract to shared instead

### Constants & utils

- **Inside the feature:** `<feature>/constants.ts` for magic strings/numbers; `<feature>/utils.ts` for helpers
- **Cross-feature:** `src/lib/<domain>/constants.ts` and `src/lib/<domain>/utils.ts`
- Never inline magic values in components or services

### Component splitting

- Components > 150 lines → split into sub-components in same folder
- Stateful logic > 20 lines → extract to `<feature>/hooks/use<Name>.ts`
- Same UI/UX in 2+ places → extract to shared component

## Forbidden patterns

- ❌ Business logic inside route files (`app/**/page.tsx`)
- ❌ Direct database/API calls from route files (use feature `api/` layer)
- ❌ Cross-feature imports outside `index.ts` (breaks encapsulation)
- ❌ Generic `utils/` or `helpers/` at root without ownership
- ❌ Same component duplicated in `src/features/A/` and `src/features/B/`

## Review signals

- ✅ Good: a single feature folder explains the full implementation surface; routes are 5-line files
- ⚠️ Warning: feature logic spread across `app/`, `components/`, and `hooks/` with no clear owner
- ❌ Bad: route file with > 50 lines of business logic, or feature B importing internals of feature A
