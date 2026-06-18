# CAW v2 — Folder Layout Refactor

Reorganize the CAW repo so the root makes the two kinds of content obvious:
what gets **copied into a project** (`template/`) vs what is **CAW's own tooling**
(`cli/`). The root drops from ~17 top-level entries to ~10.

## Why

The repo mixes two unrelated concerns at the root, which reads as clutter:

- **Template** — copied into a project on `caw init`: `agents/`, `commands/`,
  `rules/`, `conductor/`, `templates/`, `.agents/skills/`, plus the durable layer
  (`scripts/harness`, `scripts/schema`, `scripts/bin`) and `scripts/hooks`.
- **Tooling** — runs CAW itself, never copied: the `*.sh` scripts, the
  generator/matcher Python (`generate-catalog.py`, `match-skills.py`,
  `check-defaults.py`, `generate-project-meta.py`), `tests/`, `setup.sh`.

A reader can't tell which is which. This refactor separates them.

## Target layout

```
caw/
├── template/                 # everything copied into a project on `caw init`
│   ├── agents/               (← agents/)
│   ├── commands/             (← commands/)
│   ├── rules/                (← rules/)
│   ├── conductor/            (← conductor/)
│   ├── config/               (← templates/  — gitleaks, commitlint, AGENTS.md…)
│   ├── skills/               (← .agents/skills/)
│   └── durable/              # the harness durable layer (kept together)
│       ├── bin/harness-cli   (← scripts/bin/)
│       ├── harness/          (← scripts/harness/)
│       ├── schema/           (← scripts/schema/)
│       └── hooks/            (← scripts/hooks/)
│
├── cli/                      # CAW's own tooling (NOT copied)
│   ├── caw.sh init.sh upgrade.sh remove.sh   (← scripts/ + setup.sh)
│   ├── generate-catalog.py generate-catalog.sh
│   ├── match-skills.py check-defaults.py generate-project-meta.py
│   └── tests/                (← scripts/tests/)
│
├── docs/                     # CAW development docs
│   (+ SKILLS-CATALOG.md, SKILLS-CHECKLIST.md moved in)
│
├── tools/backlog-viewer/     # unchanged (standalone app)
│
├── README.md CHANGELOG.md VERSION
├── skills-defaults.yaml skills-lock.json
└── .gitignore .npmrc .nvmrc requirements-dev.txt setup.sh*
```

(*`setup.sh` stays at root — it's the install entrypoint users run first.)

## HARD CONSTRAINTS (Python path coupling — do not break these)

These are sibling/parent relationships the code resolves at runtime. Moving must
preserve them:

1. **`bin/harness-cli` imports `harness/`** via `Path(__file__).parent.parent`.
   → `bin/` and `harness/` MUST stay siblings (same parent). Met by
   `template/durable/{bin,harness}`.
2. **`harness/db.py` finds `schema/`** via `parent.parent / "schema"`.
   → `harness/` and `schema/` MUST stay siblings. Met by
   `template/durable/{harness,schema}`.
3. **`match-skills.py` imports `generate-catalog.py`** as a sibling
   (`Path(__file__).parent / "generate-catalog.py"`).
   → both MUST stay siblings. Met by keeping both in `cli/`.
4. **`check-defaults.py` reads `skills-defaults.yaml`** via
   `Path(__file__).parent.parent / "skills-defaults.yaml"`.
   → `skills-defaults.yaml` must be the PARENT of `check-defaults.py`'s dir.
   Moving check-defaults.py to `cli/` means parent = repo root → the YAML stays
   at root. ✅ (or update the path constant).
5. **`tests/` import paths** (`SCRIPTS_DIR = parent.parent`) — must be updated to
   the new `cli/` and `template/durable/` locations.

## Files that reference paths and MUST be updated

| Mover | Update |
| --- | --- |
| `agents/ commands/ rules/ conductor/ templates/` → `template/` | `cli/init.sh`, `cli/upgrade.sh`, `cli/remove.sh` (`$REPO_ROOT/<dir>` → `$REPO_ROOT/template/<dir>`) |
| `.agents/skills/` → `template/skills/` | init.sh, **setup.md** agent prompt (`cp -R $CAW_HOME/.agents/skills`), `match-skills.py`/`generate-catalog.py` (`.agents/skills` → `template/skills`), `skills-lock.json` skillPath refs, `.gitignore` |
| `scripts/{harness,schema,bin,hooks}` → `template/durable/` | init.sh; harness-cli `sys.path`; db.py is fine (siblings preserved); tests |
| `scripts/*.sh` + generator/matcher `.py` + `tests/` → `cli/` | `setup.sh` (alias `$SCRIPTS_DIR/caw.sh` → `$REPO_ROOT/cli/caw.sh`), `caw.sh` internal refs, `caw.config.json` writer, CI workflow `paths:` filter |
| `SKILLS-CATALOG.md SKILLS-CHECKLIST.md` → `docs/` | `generate-catalog.sh` output path; any agent/doc citing them |

## Execution order (safest first)

1. Move root stragglers into `docs/` (SKILLS-CATALOG, SKILLS-CHECKLIST) — low risk.
2. Build `template/` for the markdown dirs (agents/commands/rules/conductor/templates) + fix the 3 shell scripts.
3. Build `cli/` for the shell + generator Python + tests; fix `setup.sh`/`caw.sh`.
4. Move the durable layer into `template/durable/`; fix harness-cli `sys.path` + tests (the trickiest — Python imports).
5. Fix agent prompts + skill-path references.
6. Verify after EACH step: `bash -n` the scripts, run the 100 tests, `init.sh` dry-run, grep for dead paths.

## Risk note

This is a large, path-heavy refactor (~10 files + Python imports + an agent
prompt). Do it incrementally with verification between steps; never move
everything then fix. Git tracks the renames, so it is revertible per step.
