# Skill Loading Contract

Every caw agent (`planner`, `coder`, `tester`, `reviewer`, `setup`) loads domain
knowledge by **invoking the `Skill` tool** — not by recalling it from priors.
This rule defines the contract once so agent prompts don't repeat it.

## The rule

Before doing the agent's real work (drafting a plan, writing code, writing
tests, filing review findings), the agent **MUST** call `Skill({skill: "<name>"})`
for every skill its workflow requires.

- One call per skill. Issue them in parallel in a single message when possible.
- Wait for all `Skill` responses before reading project source files.
- After loading, restate in one line which skills are now active, e.g.
  `Skills active for task=backend: caw:api-contract, context7:next.js`.

## Skill sources (plugin era — no install step)

caw v2 ships as the **`caw` plugin**. There is no `/caw-setup --add`, no
`skill-map.yaml`, and no symlinked vendored skills. Skills come from three places,
all available the moment the relevant plugins are enabled:

- **Authored (caw)** — the 4 skills bundled in this plugin, namespaced:
  `caw:api-contract`, `caw:error-handling-patterns`,
  `caw:nextjs-feature`, `caw:react-component-testing`. Always present.
- **Workflow (Superpowers)** — TDD, systematic debugging, verification, code
  review. Loaded by their Superpowers namespace.
- **Framework docs (Context7)** — live library docs (Next.js, Prisma, Stripe,
  TanStack, Supabase, …). Queried on demand; there is no static catalog to match.

A `skills_hint` in a Plan task names which of these to load when the task runs.
It is a hint, not a gate — agents do NOT verify it against any installed-skill
manifest (none exists). Load the named skill directly via the `Skill` tool, or
query Context7 for the named framework.

## Failure mode (do not do this)

Naming a skill in a task file (`code.md`, `tests.md`, `review.md`, `plan.md`)
**without having called the `Skill` tool for it** is a reporting failure. The
next reviewer treats the task as not-loaded. When recording skills in a task
file, list only the skills you actually invoked the tool for — if a load step
was skipped, write `none — <step> was skipped` and explain why.

## On a failed load

If a `Skill` call errors:

- For an **authored** skill (`caw:*`) — the `caw` plugin is not enabled.
  Tell the user to enable it: `/plugin install caw@caw`.
- For a **workflow** skill — the Superpowers plugin is not enabled. Tell the user
  to enable it.
- For a **framework** topic — query Context7 instead of failing; that is the live
  docs source and needs no install.

Do not proceed with a missing authored/workflow skill — agents must not silently
fall back to generic/outdated knowledge.

## Why

Skills carry framework-specific patterns and gotchas that override an agent's
priors (TanStack Query v5 API shape, shadcn install flow, NestJS DI conventions,
leak-free jsdom test setup). Skipping the load produces code that violates
project conventions.

## Which skills each agent loads

Each agent prompt names its own required + conditional skills. This rule governs
*how* to load them; the agent prompt governs *which*.
