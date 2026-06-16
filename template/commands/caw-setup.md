---
model: claude-sonnet-4-6
---

Run the project setup workflow: $ARGUMENTS

## Instructions

Parse `$ARGUMENTS` for flags:

- No flag → first-time setup (detect stack, install caw skills, ask re hub skills, generate conventions)
- `--refresh` → re-detect stack, sync skills, regenerate conventions
- `--add <skill>` → install a single skill referenced by Plan but missing

### Prerequisite check

Before delegating, verify `CLAUDE.md` exists in project root. If not:

```
❌ CLAUDE.md not found. Run /init first to generate project documentation.
```

### Delegate to setup agent

Spawn the **setup** agent: `"Run the setup flow with arguments: <args>"`

Setup agent will:
1. Read CLAUDE.md (project intent) + SKILLS-CATALOG.md (caw repo)
2. Detect tech stack (package.json + file scan)
3. Map stack to caw-curated skills (priority 1: copy from caw repo)
4. Ask user before pulling hub skills (priority 2: external installs)
5. Generate `.agents/skills/`, `.claude/skills/` symlinks, `.claude/skill-map.yaml`, `docs/caw/conventions.md`, `.claude/rules/project.md` (the `npx skills` CLI maintains its own `skills-lock.json` at the project root for hub skills)

After setup completes, the project is ready for `/caw-plan`.
