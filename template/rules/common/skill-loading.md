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
  `Skills active for task=backend: nestjs-best-practices, prisma-client-api`.

## Failure mode (do not do this)

Naming a skill in a task file (`code.md`, `tests.md`, `review.md`, `plan.md`)
**without having called the `Skill` tool for it** is a reporting failure. The
next reviewer treats the task as not-loaded. When recording skills in a task
file, list only the skills you actually invoked the tool for — if a load step
was skipped, write `none — <step> was skipped` and explain why.

## On a failed load

If a `Skill` call errors (skill not installed), **abort** the current step with:

```
❌ Skill `<name>` referenced but not installed. Run /caw-setup --add <name>.
```

Do not proceed with a missing skill — agents must not silently fall back to
generic/outdated knowledge. Do not auto-install; the user runs `/caw-setup --add`.

## Why

Skills carry framework-specific patterns and gotchas that override an agent's
priors (TanStack Query v5 API shape, shadcn install flow, NestJS DI conventions,
leak-free jsdom test setup). Skipping the load produces code that violates
project conventions.

## Which skills each agent loads

Each agent prompt names its own required + conditional skills. This rule governs
*how* to load them; the agent prompt governs *which*.
