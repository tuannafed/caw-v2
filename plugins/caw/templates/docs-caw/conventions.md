# Project Conventions

Use this file to declare the neutral engineering conventions for this project.
Agents must treat it as the source of truth for architecture choices that can vary
between projects.

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

## Forbidden Patterns

- Hardcoded business/domain terminology copied from prior projects
- Global state rules that contradict the selected project pattern
- Ad-hoc folder layouts that bypass the folder contract below
- Raw API usage in components when a typed client convention exists

## Folder Contract

Document only the paths that matter for this project. Delete unused rows.

| Area             | Required location            | Notes                                          |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| App routes       | `app/...`                    | Keep route files thin                          |
| Feature code     | `src/features/<feature>/...` | Colocate UI, API, schemas, tests               |
| Shared UI        | `src/components/...`         | Reusable presentational components only        |
| Shared libraries | `src/lib/...`                | Typed API client, auth, permissions, utilities |
| Permissions      | `src/lib/permissions/...`    | Permission checks, capability helpers          |

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

## Agent Resolution Rule

1. Read this file before designing architecture, code, or review feedback.
2. Apply precedence: `Optional Overrides` → this file → skills (auto-loaded) → generic project docs.
3. Mark non-applicable rules `not-applicable` in the task's Convention Resolution section.
4. Treat `Forbidden Patterns` as review failures unless an override explicitly allows them.

## Optional Overrides

Use this section for project-specific decisions that should override a generic archetype or pattern.

### Frontend

- Data/state pattern: `[react-query-with-zustand | rtk-query | custom]`
- Feature root: `[e.g. src/features or src/modules]`
- API client entrypoint: `[e.g. src/lib/api/client.ts]`

### Backend

- Response contract strategy: `[e.g. stable DTOs mirrored to typed client]`
- Module root: `[e.g. src/modules or app/services]`

### Integrate task

- Contract verification focus: `[e.g. endpoint adapters, cache tags, invalidation rules]`

### Review

- Convention compliance priority: `[e.g. folder contract is blocking, naming is warning]`
