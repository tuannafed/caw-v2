---
name: better-context
description: Using the better-context CLI for codebase intelligence: fast primitives, PageRank centrality, focus mode, token-budget optimization, and per-agent workflows (planner, coder, reviewer). Use when you need to map a codebase quickly, estimate change blast radius, or select context for a large project.
---

# Skill: better-context — Codebase Intelligence

**Used by:** planner (complexity estimate, affected files), reviewer (centrality-guided review), coder during the `integrate` phase (dependency awareness). Load when you need to understand codebase structure quickly or find the most critical files before making changes.

---

## Scope

- Fast project structure queries (no indexing required)
- Deep dependency analysis and PageRank centrality
- Ego-centric file context for focused exploration
- Token-budget-aware context selection for large codebases

---

## Fast Primitives (no scan required, ~50–200ms)

```bash
# Project overview: language, framework, package manager
better-context overview --format json
better-context overview --format human    # human-readable

# Directory structure
better-context tree --depth 2

# Entry points (CLI commands, main scripts, servers)
better-context entries

# Single file analysis: chunks, imports, exports
better-context file src/auth/jwt.py --format human

# Dependencies and dependents for a file
better-context deps src/auth/jwt.py
```

All primitives also work via `uvx` without installation:
```bash
uvx better-context overview
```

---

## Deep Analysis (requires `scan` first)

```bash
# Index codebase once (saves to .better-context/manifest.json)
better-context scan

# Top files by PageRank centrality — start here for impact analysis
better-context stats

# Ego-centric context around a specific file
# Returns: direct deps, dependents, related tests, shared types, suggested reading order
better-context focus src/auth/handler.py
better-context focus src/auth/handler.py --depth 2    # limit exploration depth

# Select optimal code chunks within a token budget
better-context optimize --budget 8000
better-context optimize -b 8000 --task "fix auth bug"
better-context optimize -b 4000 -k auth user session  # boost keywords

# Dependency graph export
better-context graph -f mermaid > deps.md
better-context graph -f json > deps.json

# Check if manifest is stale (re-scan needed?)
better-context verify
```

---

## Typical Agent Workflows

### Planner — before writing the Plan
```bash
# Quick project understanding
better-context overview
better-context tree --depth 2

# If manifest exists, find affected files
better-context stats                          # most important files by centrality
better-context focus src/<suspected-file>     # what does changing this file affect?
```

Use output to ground the Plan's phases and `## Challenge` risk estimate:
- Files with high PageRank → changing them is high blast radius (likely `risky` lane)
- Files with low centrality, few dependents → contained change

### Reviewer — before reviewing changed code
```bash
better-context stats                          # know which files matter most
better-context focus <changed-file>           # understand blast radius
```

Prioritize review effort on high-centrality files (top of `stats` output).

### Coder (`integrate` phase) — before wiring frontend ↔ backend
```bash
better-context deps src/api/routes.ts         # who imports this file?
better-context focus src/api/routes.ts        # full neighborhood
```

---

## Configuration (.ctx.json in project root)

```json
{
  "max_file_size_kb": 500,
  "chunk_max_lines": 150,
  "pagerank_damping": 0.85,
  "output_dir": ".better-context",
  "generate_agents_md": true
}
```

Add `.better-context/` to `.gitignore` if you don't want to commit the manifest.

---

## Key Concepts

| Concept | What it means |
|---------|---------------|
| **PageRank centrality** | Files imported by many important files rank higher — high score = high blast radius |
| **Focus mode** | BFS from a file outward; returns deps, dependents, tests, types, reading order |
| **Token optimizer** | Greedy/knapsack selection of chunks maximizing `PageRank × relevance / tokens` |
| **Semantic anchor** | Content-hash chunk ID that survives refactoring (stable even if file moves) |
| **Zone of Pain** | Module with I≈0, A≈0 — stable but concrete, hard to extend |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Manifest not found` | Run `better-context scan` first |
| `No files found` | Check `.ctxignore`; ensure project has Python/TS/JS files |
| `Circular dependency detected` | Informational only — safe to continue; consider refactoring |
