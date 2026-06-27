---
model: claude-sonnet-4-6
---

Run the project setup workflow: $ARGUMENTS

## Instructions

Parse `$ARGUMENTS` for flags:

- No flag → first-time setup (detect stack, verify harness, generate conventions + project.yaml + project rules)
- `--refresh` → re-detect stack, regenerate conventions + project.yaml + project rules

> caw v2 ships as the `caw` plugin. There is **no skill install step** — the
> 9 authored skills are bundled in the plugin (always available), framework docs
> come from Context7, and workflow skills from Superpowers. So there is no
> `--add <skill>` flag and no symlinking.

### Prerequisite check

Before delegating, verify `CLAUDE.md` exists in project root. If not:

```
❌ CLAUDE.md not found. Run /init first to generate project documentation.
```

### Delegate to setup agent

Spawn the **setup** agent: `"Run the setup flow with arguments: <args>"`

Setup agent will:
1. Read CLAUDE.md (project intent)
2. Detect tech stack (package.json + file scan)
3. Verify the durable harness (`${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli`) — DB resolves to the project root
4. Generate `docs/caw/conventions.md`, `.claude/project.yaml`, `.claude/rules/project.md`

After setup completes, the project is ready for `/caw:plan`.
