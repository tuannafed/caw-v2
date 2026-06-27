# Source-Driven Development

> Adapted from `source-driven-development` in addyosmani/agent-skills (MIT, © 2025 Addy
> Osmani). A thin discipline layered on the Context7 MCP caw already ships.

**Layer:** rule — non-negotiable. **Read by:** coder (before writing framework-specific
code) and reviewer (when auditing framework usage). No `paths:` — read explicitly.

## The rule

**Ground every framework/library decision in official docs — do not implement from
memory.** Your training data lags the library; a confidently-recalled API is the most
common silent bug source (renamed methods, changed defaults, deprecated options).

Before writing code that uses a framework, library, SDK, or cloud service API:

1. **Query Context7 first** (`resolve-library-id` → `query-docs`) for the exact API,
   config, or migration you're about to use — even for libraries you "know" (React,
   Next.js, Prisma, Stripe, …). caw enables Context7 as a companion; use it.
2. **Cite the source** in the task's `code.md` when the API was non-obvious or
   version-sensitive (one line: "per Context7 <lib> docs — `<api>` as of <version>").
3. **Don't paper over uncertainty.** If Context7 lacks the answer, say so and fall back
   to the library's own docs/repo — never guess an API signature and hope.

## When it applies
- Any framework-specific code (hooks, ORM queries, SDK calls, build config, cloud APIs).
- Version migrations ("upgrade Next 14 → 15", "Prisma 5 → 6").
- A library-specific bug whose fix depends on current behavior.

## When it doesn't
Pure business logic, language built-ins, or general programming with no library surface
— Context7 is for library docs, not for refactoring or writing scripts from scratch.

A clear from-memory API misuse the reviewer can trace to skipped docs is at least a
MEDIUM finding (HIGH if it's a security/data API).
