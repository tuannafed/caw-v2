# Changelog

All notable changes to the **caw** plugin are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/), and the project
adheres to [Semantic Versioning](https://semver.org/). Versions are released by pushing
to `main` (the marketplace `ref` tracks `main`); members pull them via
`/plugin marketplace update`.

## [2.4.7] — 2026-06-28

### Fixed
- **`/caw:setup --refresh` now re-syncs the HARNESS block in existing `CLAUDE.md` and
  `AGENTS.md`.** Previously setup only *appended* the marker-delimited block when it was
  missing and left an existing block untouched — so any template change to that block
  (e.g. the v2.4.6 "caw owns where work goes" guard) never reached a project that had
  already run setup. Setup now replaces the content between `<!-- HARNESS:BEGIN -->` and
  `<!-- HARNESS:END -->` with the installed template's version on every run, leaving the
  member's own prose before/after the markers untouched. Existing projects pick up
  harness-block fixes simply by re-running `/caw:setup --refresh`.

## [2.4.6] — 2026-06-28

### Changed
- **Project rules are now the single source of truth — `conventions.md` and `project.yaml`
  removed.** `/caw:setup` generated three overlapping project files (`project.yaml`,
  `conventions.md`, `.claude/rules/project.md`) that duplicated each other and the project's
  own `README.md`. Now there is **one** file, `.claude/rules/project.md`:
  - It carries `paths:` frontmatter so Claude Code **auto-injects it on every matching code
    edit** — agents can't skip the project's folder/naming/pattern/forbidden/domain LAW.
  - It is **generated dynamically from a real codebase scan**: rule groups are chosen by the
    detected stack (FE / NestJS / FastAPI / …) and contents come from patterns observed
    repeated in the code, not canned templates. Monorepos get one rule file per area.
  - It also folds in the **verify commands** (the coder's self-verify gate) and the
    **Context7 library names** that previously lived in `conventions.md`.
  - `project.yaml` was an orphan (generated every setup, read by nobody) — removed entirely,
    along with its schema template.

### Fixed
- **Setup no longer leaks the `{{PROJECT_NAME}}` placeholder.** `AGENTS.md` and
  `knowledge.md` are copied raw (not Write-rendered), so their title placeholder survived.
  Setup now substitutes the detected project name (from `package.json` / `pyproject.toml` /
  dir name) into both.
- **Superpowers skills no longer write specs/plans outside the harness.** Running `/caw:plan`
  could land a spec at `docs/superpowers/specs/<date>-design.md` — outside `docs/caw/`,
  invisible to the harness — because `brainstorming` / `writing-plans` hard-code their own
  output paths (and Superpowers auto-loads `brainstorming` even uninvited). The CLAUDE.md +
  AGENTS.md templates and the planner now assert caw's directory contract as a
  precedence-winning project instruction: specs/plans → `docs/caw/stories/<id>/plan.md`,
  decisions → `docs/caw/decisions/`, state → `harness.db`; no `docs/superpowers/`, no
  auto-commit, no approval pause.

## [2.4.5] — 2026-06-28

### Fixed
- **Context7 key — corrected to a literal value in a gitignored `.mcp.json`.** User testing
  disproved the v2.4.3/2.4.4 guidance: a key in `settings.json`/`settings.local.json` `env`
  is not passed to MCP subprocesses, and `${CONTEXT7_API_KEY}` expansion in `.mcp.json` is
  unreliable (a GUI/VSCode launch doesn't load `~/.zshrc`, so the var is empty). The only
  reliable place is a **literal** key in `.mcp.json` → `mcpServers.context7.env`. `/caw:setup`
  now ships `.mcp.json` with an empty literal key and **gitignores it** (it holds a secret);
  the setup report + README + CLAUDE.md + settings note all point to that single path.
  Removed the dead `CONTEXT7_API_KEY` slot from the settings.json env template.

## [2.4.4] — 2026-06-27

### Changed
- **Context7 key onboarding made explicit.** Real-world use surfaced that the key path
  wasn't obvious — a key in `settings.json` `env` never reaches the MCP server. The
  `/caw:setup` report now prints how to add a key (free tier is fine; `export
  CONTEXT7_API_KEY` in `~/.zshrc` → restart) and checks the live shell env. README /
  CLAUDE.md / `.mcp.json` / `settings.json` notes corrected: the key lives in the shell
  env (read by `.mcp.json`), never a top-level settings env (ignored by MCP).

## [2.4.3] — 2026-06-27

### Fixed
- **Context7 API key now actually reaches the server.** The key is consumed by the
  context7 MCP server, and a top-level `settings.json` `env` is not documented to
  propagate into MCP subprocesses — so the old "put the key in settings.json env" guidance
  likely left every project on the anonymous tier. `/caw:setup` now scaffolds a project
  `.mcp.json` that overrides the plugin's context7 server with
  `"env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY:}" }` (committable — a `${VAR}` ref,
  never the key; empty default → anonymous fallback). Provide the real key via the shell
  (`export CONTEXT7_API_KEY=…`) or `.claude/settings.local.json`. README/CLAUDE/settings
  notes rewritten; the plugin validator now JSON-checks the `.mcp.json` template.

## [2.4.2] — 2026-06-27

Found by a real-world end-to-end verification on a throwaway sample project.

### Fixed
- **CLI flag consistency** — `story add` / `story update` now accept `--story-id` (the
  same flag `task`, `intake`, and `gate` already use); `--id` kept as a back-compat alias.
  Removes a foot-gun where following one example then another would fail. Docs updated to
  `--story-id`; a stale `--lane` → `--risk-lane` fixed in the HARNESS.md template
  (154 → 157 tests).

### Verified (no change — confirmed working on a real project)
- DB resolves to the project root (no scattered `harness.db`); the lane vocabulary rejects
  the old `risky`/`standard` tokens; the proof gate blocks (exit 2) until a task's verify
  command actually passes; state-drift + audit scan `docs/caw/stories/` (incl. `epics/`).

## [2.4.1] — 2026-06-27

Score-upgrade pass (coverage + CI + onboarding). Doc/test/CI only — no behavior change.

### Added
- **README quickstart** — a copy-paste "5 minutes" block: marketplace add → install caw
  + the 3 companion plugins → `/caw:setup` → plan/code/verify one story.
- **CI coverage gate** — the pytest job now runs under `coverage` and fails the build
  below `--fail-under=85`, so test coverage can't erode silently. `coverage==7.6.10`
  pinned in `requirements-dev.txt`; `.coverage` artifacts gitignored.
- **+19 tests** — `test_db.py` for `find_project_root`/`resolve_db_path` (the DB-location
  logic; `db.py` 72→100%), plus branch coverage for `audit.format_report`/`interpret`
  (80→98%) and every lane×phase rule in `context_score` (80→95%).

### Changed
- Harness test coverage **85% → 90%** (135 → 154 tests).

## [2.4.0] — 2026-06-27

Score-upgrade pass driven by a multi-agent codebase review — hardening, validation, and
an end-to-end gate.

### Added
- **Dependency-degradation contract** — the skill-loading rule now defines exactly how an
  agent degrades when a companion plugin is missing: a missing `caw` plugin is the only
  hard stop; a missing Superpowers/Context7 degrades the *quality* of a step (announce +
  apply intent from first principles / fall back) but must never break the pipeline.
- **Plugin validator + CI gate** — `validate_plugin.py` (stdlib) checks version sync
  across `VERSION`/`plugin.json`/`marketplace.json`, valid JSON manifests, and every
  skill's frontmatter `name` matching its folder. Wired as a second CI job + a pytest
  wrapper. Guards against the drift classes the audit found.
- **End-to-end binary test** — `test_e2e_binary.py` runs the shipped `bin/harness-cli` via
  subprocess through the full story lifecycle (init → intake → story → task → gate FAILS
  unverified → task verify → gate PASSES → query json), exercising the proof gate over the
  wire (135 tests).
- **NOTICE** — root attribution file crediting `addyosmani/agent-skills` (MIT) for the
  five adapted skills + the `source-driven` rule.

### Changed
- Removed inert `paths:` frontmatter from four explicit-Read rules (`test-tiers`,
  `spec-traceability`, `runtime-smoke-test`, `feedback-traceability`) — plugin rules don't
  lazy-load, so the `paths:` was dead and misleading.
- Fleshed out the thin `context-engineering` skill with a worked drift example + a recovery
  checklist.
- `docs/CONCEPT.md` authored (was referenced but missing); README hook-profile section and
  marketplace description corrected.

## [2.3.1] — 2026-06-27

Bug-fix release — three integration-seam defects a multi-agent review surfaced (all
verified against the code before fixing).

### Fixed
- **Planner self-block (CRITICAL)** — Step 0 mandated loading 7 product/BA skills
  (`business-analyst`, `prd-development`, …) that exist in **no** plugin, while the
  skill-loading contract forbids proceeding on a failed load — so the lead agent blocked on
  its first instruction. Now loads the real Superpowers planning skills (`brainstorming`,
  `writing-plans`) when relevant and never blocks on a missing skill.
- **Lane vocabulary mismatch (HIGH)** — prose said `lane: tiny|standard|risky` but the DB
  field is `risk_lane` with `tiny|normal|high_risk` (CHECK-constrained; CLI flag is
  `--risk-lane`). Aligned all prose to the DB tokens across 5 commands + 4 agents + the
  intake template + the doubt-check skill. Fixed a stale "all 6 dimensions" → 7.
- **State-drift + audit no-op (HIGH)** — `state_drift` and `audit` scanned the v1 `tasks/`
  directory; v2 keeps stories at `docs/caw/stories/`, so the anti-drift commit gate and the
  plandone/spec-mandate audit checks were silent no-ops on every real project. Both now scan
  `stories/` (recursing `epics/`), key off `plan.md` instead of the retired `overview.yaml`,
  and keep a v1 `tasks/` fallback (105 → 108 tests).
- Hook never-block guarantee — `run-with-flags` legacy path exited non-zero on
  spawn-error/timeout/signal, which could *deny* a PreToolUse call; an infra failure now
  exits 0 (a real block is still a deliberate exit 2).

## [2.3.0] — 2026-06-27

### Added
- **Cherry-picked quality skills from `addyosmani/agent-skills` (MIT)** — adapted, not
  copied wholesale:
  - `caw:doubt-check` — in-flight adversarial self-check before a non-trivial decision
    ships. Orchestrator-only (spawns a fresh-context reviewer), so `/caw:code` runs it in
    the main session for `high_risk` non-trivial tasks; hard-gated so trivial work and
    `tiny`/`normal` lanes never pay the cost.
  - `caw:security-hardening`, `caw:performance-optimization`, `caw:observability` —
    load-when-relevant quality skills (via a task's `skills_hint`).
  - `caw:context-engineering` — context-budget discipline for long sessions / monorepos.
  - `source-driven` rule — query Context7 docs before framework-specific code; don't
    implement an API from memory.
- Authored skills count **4 → 9**.

## [2.2.0] — 2026-06-27

Tier C of the master plan — evolution, constitution, and canonical specs.

### Added
- **`/caw:spec <capability>`** — folds a capability's implemented stories into a canonical
  `docs/caw/specs/<capability>.md` ("current truth"; prose-only, dedupe + reconcile, a
  `retired` story = removed behaviour). Planner gained an optional `**Capability:**` field;
  setup scaffolds `docs/caw/specs/`.
- **Event-driven evolution snapshot** — the reviewer runs `audit` + `maturity` at story
  close (clean approval) and nudges `/caw:maintain` when entropy is rising. The
  heartbeat that complements the manual deep pass.
- **Constitution at review time** — the reviewer adds a Constitution dimension, flagging
  code that violates `.claude/rules/project.md` invariants (lock-ins / forbidden patterns /
  domain rules). Constitution is now enforced at both ends: planner at plan time, reviewer
  at review (7 review dimensions).

## [2.1.0] — 2026-06-27

### Added
- **Parallel coders in isolated git worktrees** — `/caw:code --all` runs each parallel
  task group in its own `isolation: "worktree"` checkout and merges back, so parallel edits
  can't clobber each other. The settings template sets `worktree.baseRef: "head"` (fork from
  the current branch); the planner now requires `parallelization_groups` to be file-disjoint.

### Changed
- Merged the updated master action plan (`docs/PLAN-IMPROVE-V1.md`) — added the C3/C4 and
  C1 event-driven items, expanded the Tier D scope.

---

For 2.0.x history, see the git log (`git log --oneline`). The 2.0 line covered the
shell-hub → plugin migration, the durable harness, agent project-memory, the gitleaks +
`@-import` setup fixes, story/task model standardization, and project-root DB resolution.

[2.4.1]: https://github.com/tuannafed/caw-v2/releases/tag/v2.4.1
[2.4.0]: https://github.com/tuannafed/caw-v2/releases/tag/v2.4.0
[2.3.1]: https://github.com/tuannafed/caw-v2/releases/tag/v2.3.1
[2.3.0]: https://github.com/tuannafed/caw-v2/releases/tag/v2.3.0
[2.2.0]: https://github.com/tuannafed/caw-v2/releases/tag/v2.2.0
[2.1.0]: https://github.com/tuannafed/caw-v2/releases/tag/v2.1.0
