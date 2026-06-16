# Changelog

All notable changes to Claude Agent Workflow (caw) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **`skills-lock.json` is no longer hand-written by caw.** The `setup` agent
  previously authored its own `skills-lock.json` (and 0.2.0 moved it under
  `.claude/`). But the `npx skills` CLI *already* maintains a `skills-lock.json`
  at the **project root** whenever it installs a hub skill — so every project
  ended up with two competing lockfiles in different formats. caw now keeps
  none of its own: `skill-map.yaml` is the single caw-owned record of installed
  skills, and the root `skills-lock.json` is left to the `npx skills` CLI that
  owns it. `caw init` re-adds `skills-lock.json` to the project `.gitignore`
  (it sits at the root, so the `.claude/` ignore entry does not cover it —
  this reverses the 0.2.0 note that called that line redundant). `caw remove`
  deletes the root `skills-lock.json` when caw is what introduced skills.

- **Old `CAT` branding purged from the hook system.** `CAT` (the project's former name, "Claude Agent Team") survived in: env vars `CAT_HOOK_PROFILE`, `CAT_DISABLED_HOOKS`, `CAT_PLUGIN_ROOT`, `CAT_HOOK_INPUT_*`; a `[CAT]` stderr log prefix; and the session temp-file names `cat-edited-*` / `cat-tool-count-*`. All renamed to `CAW_*` / `caw-*` (the `[CAT]` log lines aligned to the `[Hook]` prefix the other hooks already use). Docs updated to match. **If you set `CAT_HOOK_PROFILE` / `CAT_DISABLED_HOOKS` in your environment, rename them to `CAW_HOOK_PROFILE` / `CAW_DISABLED_HOOKS`.**

### Changed

- **Harness files are now bounded so they don't grow into thousand-line files.**
  `test-matrix.md` was append-only and read whole by the tester, reviewer, and
  `/caw-status` on every run — a real D2V-BE project hit 122 lines after only 3
  tasks (~10 behavior rows/task), heading for 1.000+ lines (and ~30K tokens of
  load) at 100 tasks. It is now **split**: behavior-level rows live in each
  task's own folder (`tasks/<id>/test-matrix.md`), and `conductor/test-matrix.md`
  becomes a project-wide **index** with one row per task. Agents load the small
  index for the overview and open only the relevant task's matrix when working
  on it. New format template `conductor/task-test-matrix.md` (synced like
  `adr.md` / `intake.md`). `harness-backlog.md` is now treated as a **queue**:
  `## Items` holds only open (`proposed`/`accepted`) friction; items that reach
  `implemented`/`rejected` are pruned to a one-line `## Resolved` entry. ADRs
  were already one-file-per-decision under `decisions/` — left as-is. The
  harness contract gains an explicit **bounded-growth rule**.

  **Migration for existing projects:** `caw upgrade` does not overwrite an
  existing `conductor/test-matrix.md` (it is project state). A project already
  on the old single-file format keeps working — but to get the split, move each
  task's behavior rows into `tasks/<id>/test-matrix.md` and collapse
  `conductor/test-matrix.md` to the new one-row-per-task index. The next tester
  run on a task will create that task's matrix file going forward.

- **Tester scopes every run to the task's own spec files, and fixes localized
  failures in-agent.** Two slowdowns surfaced from real D2V-BE tasks: (1) the
  tester ran whole modules (`jest src/modules/tickets`) so a 12-scenario task
  dragged 400+ unrelated tests through *every* fix round, often via bare
  `npx jest` with no `--maxWorkers`; (2) every failing test cold-started a fresh
  `coder` agent, which reloads conventions.md + CLAUDE.md + plan.md + skills
  before fixing one line. Tester now: runs jest/vitest **by explicit spec path
  only** (never a directory or broad `--testPathPatterns`), scopes coverage to
  the changed files, re-runs only the failing file during the fix loop, and
  **fixes test-side and localized production bugs itself** (it already holds
  `Edit`) — looping to the coder only for structural bugs (new file, API-contract
  change, out-of-scope code). The in-agent fix loop is capped at ~3 rounds. A
  tester source fix re-runs type-check + lint on the touched files.

### Fixed

- **Type-check / lint now actually gate a phase.** No agent in the `/caw-verify`
  flow ran a type checker or linter — `tester` only ran the test runner,
  `reviewer` reviewed by reading. Type-check happened *only* in the
  `stop-format-typecheck.js` Stop hook, which is profile-gated, session-scoped,
  and never blocks. So `/caw-verify` could report "✅ ready to commit" on code
  that does not compile. The `coder` agent's Step 5 "self-verify (lightweight)"
  — worded as optional ("if cheap") — is now a **hard gate**: type-check always
  runs, lint runs whenever a linter is configured, and a phase cannot reach
  `status: done` until both pass. A genuinely unfixable check sets the phase to
  `status: blocked` instead. `/caw-code --all` stops on the first blocked phase;
  `/caw-verify` aborts if any phase is `blocked`. Phase-status enum gains
  `blocked` (documented separately from the task-level `status` enum in
  `planner.md`). The lint step detects Biome (`biome.json[c]`) and ESLint (flat
  `eslint.config.*` + legacy `.eslintrc*`) by config file, prefers the
  `package.json` `lint` script when present, uses `biome lint` (not `biome
  check`, which also enforces formatting), and runs **both** linters when a
  project ships config for both (migration case). `/caw-setup` now records the
  detected type-check / lint / test commands in a `## Verify Commands` section
  of `conventions.md`, and the coder runs those project-specific commands first.
- **caw repo's own `.claude/` untracked.** `.claude/settings.json` (committed) held machine-local dev permissions — absolute paths to one developer's checkout and `/tmp/test-proj` test commands — useless to anyone who clones the repo. It and the `.claude/skills/find-skills` dev symlink are now untracked; `.gitignore` ignores the whole `.claude/` working dir (caw's *templates* for projects live in `templates/` and `conductor/`, not here).
- **Default-skill count corrected in `docs/CONCEPT.md`** — it listed 10 workflow defaults / minimum 17 (missing `react-component-testing`); the `setup` agent installs 11 workflow + 7 product = minimum 18.
- **`CLAUDE.md` Repository Structure corrected** — it omitted the top-level `conductor/` directory entirely and `SKILLS-CHECKLIST.md`; `.agents/skills/` said "50+" (actual: 57). Also fixed the "Adding a New Agent" steps (`init.sh` has no `COMMANDS=` list — it globs `commands/*.md`) and added `SKILLS-CHECKLIST.md` to the "Adding a New Skill" commit checklist.
- **`.DS_Store` untracked** — a committed macOS junk file; now in `.gitignore`.
- **`overview.yaml` no longer drops tasks from the backlog board when it
  contains stray Markdown.** Some agents appended a `## Verify` Markdown section
  to `overview.yaml` (which must be pure YAML) — a bare line like `**Tests:**
  5/5` makes the YAML parser throw `implicit map key needs a value`, and the
  viewer's `task-parser` then returned `null`, dropping the whole task. The
  parser now retries against just the YAML body (everything before the first
  Markdown heading) and logs a warning instead of dropping the task. The root
  cause is also fixed upstream — see the agent-prompt change under _Changed_.
- **Backlog board status mapping completed.** Real task statuses
  (`review-approved`, `review-blocked`, `approved`, `ready-to-commit`,
  `verified`, `in-progress`) were missing from `STATUS_TO_STAGE`, so every task
  with one of them fell through to the **Pending** column. They now map to the
  correct stage (Done / Blocked / Coding).

### Changed

- **`overview.yaml` is documented and enforced as pure YAML.** `planner.md`
  gains an explicit rule (no Markdown headings, no `---`, no bold, no prose;
  multi-line values must use a YAML block scalar). `reviewer.md` Step 7 is
  rewritten so the `review:` summary is added as a top-level YAML key, not an
  appended Markdown section. `tester.md` warns against appending `## Verify`.
  The harness contract gains a "File format rule" in its Push table. This stops
  agents from corrupting `overview.yaml` at the source.
- **`caw upgrade` now syncs the backlog viewer.** Previously the Astro/React
  viewer was copied only at `caw init` (opt-in) and `upgrade.sh` never touched
  it — so UI fixes never reached an already-scaffolded project. `caw upgrade`
  now refreshes `.claude/backlog-viewer/` source whenever the project already
  has it, excluding `node_modules` / `dist` / `.astro` (gitignored local build
  artifacts the user re-creates with `pnpm install`).

### Added

- **Backlog board: List / Board layout toggle.** The board view gains a
  ClickUp-style toggle in the header. **List** renders each lifecycle stage as a
  collapsible group with task rows in a table (Name · Progress · Lane · Type ·
  Updated); **Board** keeps the kanban columns. The choice persists in
  `localStorage`.
- **Richer task cards and a task-detail Overview panel.** Cards now show the
  task `type` badge, a phase-count meta row, and a colored status pill with the
  last-updated date in the footer. The task dialog's Overview tab gains a
  summary panel (status, lane, type, next phase, progress, phase counts,
  created / updated) above a widened phases table.

---

## [0.2.0] — 2026-05-20

A consistency + simplification pass over the workflow, plus completion of the
CAW × Harness fusion. Contains breaking changes — see **Changed** and **Removed**
(`tdd_mode` dropped, `/caw-code-all` merged into `/caw-code --all`, `conductor/`
layout flattened).

### Added

- **Security advisory ADV-2026-003** — TanStack "Mini Shai-Hulud" supply chain attack incident response guide (`templates/advisories/tanstack-mini-shai-hulud-incident-response.md`). 80+ TanStack npm packages trojanized during 2026-05-11 19:20–19:26 UTC; malware persists into `.claude/` and `.vscode/` directories.
- **Rule:** `rules/common/package-manager.md` — non-overridable policy mandating pnpm 11+ (via corepack), `packageManager` pin in `package.json`, and `.npmrc` with `ignore-scripts=true` + `min-release-age=3d` for every Node.js project. Direct mitigation for active npm supply-chain advisories.
- **Rule:** `rules/common/skill-loading.md` — the Skill Loading Contract. Defines once how every agent invokes the `Skill` tool, what counts as a load failure, and how to abort on a missing skill. All five agent prompts now reference it instead of repeating the instruction.
- **Harness contract wired into agents** — completes the CAW × Harness fusion
  (`CAW_HARNESS_FUSION_DESIGN.md` shipped ADR + risk-lane but left the test
  matrix and harness backlog as unwired files). `test-matrix.md` and
  `harness-backlog.md` are now live:
  - `tester` writes coverage rows (`Status` + `Last validated`) on every run.
  - `reviewer` verifies ADR coverage, fills missing matrix rows, advances
    `Status` on approval, and blocks an architecture change shipped without an ADR.
  - `planner` and `coder` create ADRs when a harness-contract trigger fires.
  - Any agent appends to the harness backlog on hitting process friction.
  - `/caw-status` shows per-task coverage rows from the test matrix.

### Changed

- **`tdd_mode` removed — `lane` is now the single task-sizing field.** `tdd_mode` and `lane` were a 1:1 mapping; the tester/coder now derive test behavior directly from `lane` (`tiny`→skip, `standard`→backend-only, `risky`→all). `overview.yaml` no longer carries a `tdd_mode` key.
- **`/caw-code-all` merged into `/caw-code --all`.** All-phases execution is now a flag on `/caw-code` rather than a separate command. Command count: 8 → 7.
- **Task file naming corrected across all docs.** `CLAUDE.md` and `planner.md` previously disagreed with the agents — the canonical set is `overview.yaml` + `plan.md` + `code.md` + `tests.md` + `review.md`. The stale `_index.md` / `01-plan.md` / `02-code.md` names are gone.
- **`rules/common/harness-contract.md` rewritten** for the current 5-agent model and the `overview.yaml` + `plan.md` task file set. Defines pull/push duties, ADR triggers, lane-gated pull depth, and severity for missing artifacts (was still describing the pre-5-agent architecture).
- **Harness templates rewritten caw-flavored** — the test matrix (adds a `Last validated` column to surface coverage rot) and harness backlog were verbatim Harness v0 copies; now match the caw 5-agent model.
- **`conductor/templates/` flattened into `conductor/`.** The nested `templates/` subdir mixed format-only templates (`adr.md`, `intake.md`) with files that are also project seeds (`test-matrix.md`, `harness-backlog.md`), and the two seed files were copied into projects twice (once live, once as a dead "reference" copy). All four now sit at `conductor/` root. `caw upgrade` removes the obsolete `.claude/conductor/templates/` dir from older installs.
- **Project `skills-lock.json` moved into `.claude/`.** The `setup` agent previously wrote it to the project **root**, where it sat exposed next to `package.json` / `tsconfig.json` — every other caw artifact lives under `.claude/`. It is now `.claude/skills-lock.json`. setup.md clarifies its role: `skills-lock.json` = install provenance (audit trail), `skill-map.yaml` = stack→skill routing (what agents read to verify `skills_hint`). The two are no longer conflated. (The caw **repo's own** `skills-lock.json` stays at root — that one is the `skills.sh` CLI lockfile.)
- **Token reduction in agent prompts.** Deduplicated repeated Skill-tool instructions, moved jsdom leak-hygiene examples from `tester.md` into the `react-component-testing` skill, and compressed the caw-home locator block in `setup.md`.

### Removed

- **`/caw-code-all` command** (`commands/caw-code-all.md`) — superseded by `/caw-code <id> --all`.
- **`conductor/task-template/`** (10 files: `01-ba.md`…`07-e2e.md`, `_index.md`) — dead per-role task format from the pre-5-agent architecture. Not scaffolded by `init.sh`, not referenced by any agent.
- **`docs/design/`** (`figma-design-rules-for-ai.md`, `test-tokens.json`) — dead docs from an abandoned Figma-to-code direction. Caw is spec-driven; nothing references these files.

### Fixed

- Hook inventory in `CLAUDE.md` now matches the actual files in `scripts/hooks/` (was listing non-existent `check-dev-server`, `warn-console-log`, `pre-compact`).
- Removed the `convention-presets/` reference from `CLAUDE.md` — the directory does not exist.
- `/caw-setup` install pattern doc in `CLAUDE.md` corrected: caw-curated skills use `cp -R` + symlink, only hub skills use `npx skills add` (previously claimed `npx skills add` for everything).
- Caw-owned skill count corrected to 5 (was documented as 4 — `react-component-testing` was uncounted).
- `conductor/intake.md` lane values corrected (`normal` → `standard`) to match the lane vocabulary the agents actually use; fixed lowercase "task Plan" / "task ID" headings.
- Duplicate "Resource-aware test execution" section heading in `tester.md` corrected to "Test file layout by stack" (was a copy-paste artifact).
- `caw remove --keep-tasks` now also cleans `adr.md`, `intake.md`, `test-matrix.md`, `harness-backlog.md`, and `decisions/` (previously left them orphaned).
- `SKILLS-CHECKLIST.md` corrected — was claiming 4 caw-owned / 50 hub skills (actual: 5 / 57), missing the `deanpeters/product-manager-skills` source and the Product/PM coverage section. Added a pointer to the auto-generated `SKILLS-CATALOG.md`.
- `.better-context/manifest.json` regenerated — the committed copy was 50 days stale and referenced deleted files. Added `.ctxignore` so the scan indexes only caw source (73 files), not the 800+ vendored hub-skill docs.
- `/caw-code` and `setup.md` skill-discovery doc now verify `skills_hint` against `.claude/skill-map.yaml` (was inconsistently pointing at `skills-lock.json`, which agents never actually read).
- `caw init` no longer adds a redundant `skills-lock.json` line to the project `.gitignore` — the existing `.claude/` entry already covers it.
- **Backlog viewer migrated off the pre-5-agent task format.** `tools/backlog-viewer/` still carried `tdd_mode` (parser field + a `tdd · …` badge that always rendered empty) and a README describing `_index.md` + "5 stage files". Dropped `tdd_mode`; README and `status.ts` now describe `overview.yaml` + the four stage files the parser actually reads.
- **Old agent names purged from caw-owned skills.** `api-contract` and `better-context` skills still referenced `BA agent` / `Backend agent` / `Frontend agent` / `code-reviewer` / `integrator` — the pre-5-agent roster. Remapped to `planner` / `coder` / `reviewer`. Also fixed `conductor/intake.md` ("BA classified" → "planner classified"), `SKILLS-CHECKLIST.md`, and `/caw setup` → `/caw-setup` in `CLAUDE.md`.
- **Old agent names purged from rules.** `code-review.md`, `coding-standards.md`, `commit-conventions.md`, `typescript/coding-style.md`, and the `error-handling-patterns` skill all had `**Used by:**` lines listing the pre-5-agent roster (`Backend` / `Frontend` / `Integrator` / `Code Reviewer`). Remapped to `coder` / `reviewer`.
- **Dead conductor pieces removed.** `conductor/backlog.md` Lanes comment no longer mentions the removed `tdd_mode` (`TDD: skip/backend-only/all`); `conductor/conventions.md` dropped the `{{CONVENTION_PRESET}}` placeholder (the `convention-presets/` dir was already gone) and renamed its `### Integrator` override section to `### Integrate phase`.
- **Phantom CLI flags removed from help text.** `caw.sh` and `setup.sh` advertised `caw init --layer/--framework/--libs`, `caw upgrade --convention-preset`, and a `caw run` subcommand — none of which exist (`init` auto-detects the stack; there is no `run` subcommand). Help text now matches what the scripts actually parse.
- **`session-summary.js` migrated to the folder-based task format.** The Stop hook listed active tasks by globbing `.claude/conductor/tasks/*.md` and parsing `**Status:**` / `**Current Phase:**` markdown — the pre-5-agent layout. Tasks are now folders (`task-NNN-<slug>/overview.yaml`); the hook reads `status` + `next_phase` from each `overview.yaml`. Previously it always reported zero tasks.
- **`settings.json` SessionStart banner** now points at `/caw-status` (was the dashless `/caw status`).
- **`caw.config.json` no longer carries a dead `version` field.** `init.sh` derived it from `cat $REPO_ROOT/package.json`, but the caw repo has no `package.json` — the value was always `unknown`, and no agent reads the field anyway. The file now holds just `caw_home` + `init_at`.
- **`caw upgrade` no longer syncs skills.** `upgrade.sh` copied caw-owned skills into `.claude/skills/` while `init.sh` did not (its `copy_all_skills` function was dead code) — and CLAUDE.md states skills are `/caw-setup`'s responsibility. Skill management is now consistently owned by `/caw-setup`; `caw upgrade` syncs only agents, commands, rules, hooks, and conductor templates. Run `/caw-setup --refresh` to update skills.
- **Dead functions removed from `init.sh`** — `lib_to_skill()` (every branch returned an empty string; referenced a nonexistent `copy_skill_directory` and gone `patterns/` / `framework/` dirs) and `copy_all_skills()` / `copy_skill_folder()` (never called).
- **`caw remove` now cleans up everything `caw init` created.** A full `init` ↔ `remove` audit found seven orphans the old `remove.sh` left behind:
  - whole files: `.agents/`, `.claude/skills-lock.json`, `.claude/skill-map.yaml`, `.claudeignore`, `commitlint.config.cjs`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`
  - marker/line-scoped reverts: the `# >>> caw <<<` block in the project `.gitignore`, the `export CAW_HOME=` line in the shell rc, the gitleaks block in `.husky/`/`.git/hooks/` pre-commit (the whole hook if caw was its sole author, else just the block), and `.vscode/settings.json` (only when caw is its sole author — a hand-merged file is left with a manual-cleanup hint).
  `caw init` and `caw remove` are now symmetric — verified end-to-end with a full `init → upgrade → remove` cycle on a scratch project.
- **`remove.sh` `set -e` / `pipefail` crash fixed.** The pre-commit cleanup pipeline aborted the whole script when its `grep` filtered out every line (exit 1 under `pipefail`), so pre-commit and `.vscode/settings.json` cleanup never ran. The grep counts are now wrapped to tolerate no-match.
- **`remove.sh` `.vscode/settings.json` detection fixed.** It counted every quoted line (including nested `"file"` keys) and so always saw "user keys". It now inspects only top-level keys and removes the file when they are all `github.copilot.chat.*`.
- **`remove.sh` now removes the emptied `.claude/` and `.github/` directories** once their last caw file is gone (kept if the user has their own files there).

First tagged release of the skill-first agent pipeline.

### Architecture

- **5 agents:** `setup`, `planner`, `coder`, `tester`, `reviewer` — generic primitives that load domain knowledge from skills
- **8 commands:** `/caw-setup`, `/caw-plan`, `/caw-code`, `/caw-code-all`, `/caw-test`, `/caw-review`, `/caw-verify`, `/caw-status`
- **Pipeline:** `Plan → Code → Test → Review` with TDD strategy chosen by lane (`tiny` / `standard` / `risky`)
- **Plan as living document:** reviewer may amend with `## Revisions` audit trail
- **Severity-based review:** CRITICAL/HIGH block commit, MEDIUM/LOW create follow-up tasks

### Skills

- **57 hub skills** curated from official sources (Anthropic, Vercel, Prisma, Stripe, Cloudflare, TanStack, Auth0, Expo, Software Mansion, Callstack, GitHub, Addy Osmani, Matt Pocock, deanpeters product-manager-skills, aj-geddes BMAD)
- **4 caw-owned skills:** `api-contract`, `error-handling-patterns`, `nextjs-feature`, `better-context`
- **7 product/PM defaults** always installed (planner depends on these): `prd-development`, `user-story`, `user-story-splitting`, `prioritization-advisor`, `business-analyst`, `create-specification`, `roadmap-planning`
- **10 workflow defaults** always installed: `to-prd`, `webapp-testing`, `javascript-testing-patterns`, `code-review-excellence`, `performance`, `accessibility`, `refactor`, `systematic-debugging`, `find-skills`, `validate-skills`

### Tooling

- `caw init <project>` — scaffold core files into a project
- `caw upgrade <project>` — sync latest agents/commands/skills/hooks into an existing project (idempotent; user content preserved)
- `caw remove <project>` — unscaffold (preserves task files unless `--keep-tasks=false`)
- `caw view <project>` — Kanban backlog viewer (Preact + bash + Python http.server, zero npm runtime deps)
- `scripts/generate-catalog.sh` — regenerate `SKILLS-CATALOG.md` from `.agents/skills/` + `skills-lock.json`

### Hooks

- Pre-commit gitleaks secret scanning (mandatory)
- Profile-gated optional hooks via `CAT_HOOK_PROFILE` env var (`minimal` / `standard` / `strict`)

### Documentation

- [README.md](README.md) — quick start + architecture overview
- [CLAUDE.md](CLAUDE.md) — caw repo's own Claude Code context
- [docs/CONCEPT.md](docs/CONCEPT.md) — full architecture design doc
- [SKILLS-CATALOG.md](SKILLS-CATALOG.md) — auto-generated skill index
- [SKILLS-CHECKLIST.md](SKILLS-CHECKLIST.md) — skill source breakdown
