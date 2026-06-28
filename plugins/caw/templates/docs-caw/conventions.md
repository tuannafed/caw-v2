# Project Conventions

Descriptive reference — the project **"shape"** agents read to understand and
imitate the codebase: archetype, stack, folder layout, and the commands used to
verify work.

**This file is NOT the law.** Binding rules an agent MUST obey — folder structure,
naming, mandatory/forbidden patterns, domain rules — live in
`.claude/rules/project.md` (monorepo: the per-area rule files under `.claude/rules/`).
Those carry a `paths:` frontmatter so Claude Code auto-injects them on every matching
code edit. This file *describes* the shape and **points to** the rule file for the
binding list; it does not duplicate it.

**Project:** {{PROJECT_NAME}}
**Team type:** {{TEAM_TYPE}}

---

## Selected Archetype

- Archetype ID: `custom`
- Summary: Replace this with the neutral product archetype that best matches the project.
- Primary surfaces:
  - Frontend shell: `[define if applicable]`
  - Backend style: `[define if applicable]`
  - Integration boundary: `[define if applicable]`

## Folder Contract

The descriptive map of where things live. The BINDING "code MUST go here" version is
in the rule file; this is the fuller reference. Document only paths that matter; delete
unused rows.

| Area             | Required location            | Notes                                          |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| App routes       | `app/...`                    | Keep route files thin                          |
| Feature code     | `src/features/<feature>/...` | Colocate UI, API, schemas, tests               |
| Shared UI        | `src/components/...`         | Reusable presentational components only        |
| Shared libraries | `src/lib/...`                | Typed API client, auth, permissions, utilities |
| Permissions      | `src/lib/permissions/...`    | Permission checks, capability helpers          |

## Code organisation patterns

Describe how the team structures features, hooks, components, modules — observed from
the codebase. Descriptive ("the project does X"), not imperative ("you must do X" →
that belongs in the rule file).

## Verify Commands

The coder runs these as its Step 5 self-verify gate before marking a task
`done`. Fill each line with the real command for this project. Use `n/a` only
when the tool genuinely is not configured.

| Check | Command |
| ----- | ------- |
| Type-check | `[e.g. pnpm tsc --noEmit, or the typecheck script]` |
| Lint | `[the project's actual linter — see note below]` |
| Unit test (single file) | `[e.g. pnpm exec jest <file> --maxWorkers=2 --workerIdleMemoryLimit=512MB]` |

**Lint detection** — pick from the config files actually present:

- `biome.json` / `biome.jsonc` → `pnpm exec biome lint <files>` (use `biome lint`, not `biome check`)
- `eslint.config.*` or `.eslintrc*` → `pnpm exec eslint <files>`
- a `lint` script in `package.json` → `pnpm lint` (prefer this — it encodes the team's choice)
- If the project ships **both** Biome and ESLint config, list both commands and note which paths each owns.

## Binding rules

The enforced law (folder / naming / mandatory patterns / forbidden patterns / domain
rules) lives in `.claude/rules/project.md` — monorepo: the per-area rule files. It is
auto-injected on every code edit, so agents cannot skip it. This section is only a
pointer; do not restate the rules here (no rule should appear in both files).

## Agent Resolution Rule

1. Read this file before designing architecture, code, or review feedback — it is the
   descriptive map of the project shape.
2. The binding rule file (`.claude/rules/project.md`) is auto-injected and takes
   precedence; this file never overrides it.
3. Mark non-applicable descriptive notes `not-applicable` in the task's Convention
   Resolution section.
