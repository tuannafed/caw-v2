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

caw v2 ships as the **`caw` plugin**. There is no `/caw:setup --add`, no
`skill-map.yaml`, and no symlinked vendored skills. Skills come from three places,
all available the moment the relevant plugins are enabled:

- **Authored (caw)** — the 9 skills bundled in this plugin, namespaced. Archetype:
  `caw:api-contract`, `caw:error-handling-patterns`, `caw:nextjs-feature`,
  `caw:react-component-testing`, `caw:doubt-check`. Quality (load when the task
  warrants): `caw:security-hardening`, `caw:performance-optimization`,
  `caw:observability`, `caw:context-engineering`. Always present.
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

## On a failed load — the degradation contract

A `Skill` call can fail because a companion plugin isn't enabled. caw depends on three
external plugins (Superpowers, Context7, Frontend Design); this is the documented
trade-off (no vendored catalog to maintain). When a load fails, **degrade in a defined
way — never crash mid-task, never silently substitute guessed knowledge.** Match the
source:

| Missing skill | What it means | What the agent does |
|---|---|---|
| **Authored `caw:*`** | the `caw` plugin itself isn't enabled — nothing works | **Hard stop.** Tell the user `/plugin install caw@caw` and abort the step. This is unrecoverable, not a degrade. |
| **Workflow (Superpowers)** | Superpowers not enabled | **Announce the gap, then proceed degraded.** State one line: `⚠️ <skill> unavailable (Superpowers not enabled) — proceeding without it; quality reduced`. Apply the skill's intent from first principles (e.g. still write tests first for a `high_risk` lane even without the TDD skill). Note it in the task file so the reviewer knows. Do **not** loop or fail the pipeline. |
| **Framework (Context7)** | Context7 not enabled / rate-limited / offline | **Fall back, don't fail.** Try the library's own docs via WebFetch; if unreachable, implement conservatively and flag every framework-specific call as `unverified — Context7 unavailable` so the reviewer scrutinizes it. The `source-driven` rule's "don't guess an API" still holds — flag, don't fabricate. |

The principle: a missing **companion** degrades the *quality* of a step, but must not
break the *pipeline*. A missing **caw plugin** is the only hard stop. Always surface the
degradation in the task file — an unannounced degrade is a reporting failure (above).

## Why

Skills carry framework-specific patterns and gotchas that override an agent's
priors (TanStack Query v5 API shape, shadcn install flow, NestJS DI conventions,
leak-free jsdom test setup). Skipping the load produces code that violates
project conventions.

## Which skills each agent loads

Each agent prompt names its own required + conditional skills. This rule governs
*how* to load them; the agent prompt governs *which*.
