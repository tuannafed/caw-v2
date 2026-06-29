---
model: claude-sonnet-4-6
---

Scaffold the caw backlog viewer into this project: $ARGUMENTS

## Instructions

`/caw:backlog` copies the **backlog viewer** (an Astro + React Kanban UI that renders
this project's `docs/caw/stories/` + `harness.db`) into `<project>/backlog/` as
**source only** — no `node_modules`, no build output. The member then installs and runs
it locally. The viewer is NOT part of the plugin (the plugin ships markdown/shell/python
only and has no build step), so it can't be resolved via `${CLAUDE_PLUGIN_ROOT}`; it
lives in the **marketplace repo clone** and is scaffolded on demand by this command.

`$ARGUMENTS` (optional):
- (no args) → scaffold if absent; if `backlog/` already exists, refresh the **source**
  files (overwrites `src/`, configs, lockfile) but never touches `backlog/node_modules`,
  `backlog/.env`, or `backlog/dist`. This is the normal way to pull a newer viewer.

### Run this block

```bash
set -euo pipefail

# 1. Resolve the viewer SOURCE from the marketplace clone. `${CLAUDE_PLUGIN_ROOT}`
#    points at the PLUGIN cache (plugins/caw only) which does NOT contain tools/backlog;
#    the full repo is cloned under ~/.claude/plugins/marketplaces/<name>/ when the team
#    runs `/plugin marketplace add`. Find tools/backlog there (any marketplace name).
PLUGINS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins"
SRC="$(find "$PLUGINS_DIR/marketplaces" -maxdepth 3 -type d -path '*/tools/backlog' 2>/dev/null | head -1)"

# Dev fallback: if you're working INSIDE the caw-v2 repo, use the local tools/backlog.
if [[ -z "${SRC:-}" && -d "tools/backlog/src" ]]; then SRC="$(pwd)/tools/backlog"; fi

if [[ -z "${SRC:-}" || ! -d "$SRC/src" ]]; then
  echo "❌ backlog viewer source not found." >&2
  echo "   Expected it under ~/.claude/plugins/marketplaces/<name>/tools/backlog." >&2
  echo "   Run '/plugin marketplace add tuannafed/caw-v2' first (it clones the repo)," >&2
  echo "   or '/plugin marketplace update caw' to refresh the clone." >&2
  exit 1
fi
echo "✓ viewer source: $SRC"

DEST="backlog"
mkdir -p "$DEST"

# 2. Copy SOURCE files only. Skip node_modules / build output / local env / VCS noise.
#    pnpm-lock.yaml + pnpm-workspace.yaml ARE copied: the lockfile pins the tested deps
#    (reproducible install) and the workspace marker stops pnpm from climbing into the
#    member's own workspace at the repo root.
COPY=(src scripts package.json pnpm-lock.yaml pnpm-workspace.yaml \
      astro.config.mjs biome.json tsconfig.json components.json \
      .npmrc .gitignore .env.example README.md)
for item in "${COPY[@]}"; do
  if [[ -e "$SRC/$item" ]]; then
    rm -rf "$DEST/$item"                       # refresh: replace source wholesale
    cp -R "$SRC/$item" "$DEST/$item"
  fi
done
echo "✓ source scaffolded into ./$DEST (node_modules / dist / .env NOT copied)"

# 3. Seed a local .env from the example if the member doesn't have one yet (never clobber).
if [[ ! -e "$DEST/.env" && -e "$DEST/.env.example" ]]; then
  cp "$DEST/.env.example" "$DEST/.env"
  echo "✓ ./$DEST/.env seeded from .env.example (edit PUBLIC_AUTH_* before deploying)"
fi

echo ""
echo "Next:"
echo "  cd $DEST"
echo "  pnpm install        # installs ~360MB into ./$DEST/node_modules (gitignored)"
echo "  pnpm dev            # viewer at http://localhost:4321 — auto-detects this project"
echo ""
echo "The viewer walks up from ./$DEST to find docs/caw/, so it reads THIS project's"
echo "stories + harness.db with no extra config. To point elsewhere: CAW_PROJECT_ROOT=…"
```

### After scaffolding

The `backlog/` folder is committed with the team (its own `.gitignore` excludes
`node_modules/`, `dist/`, `.astro/`, `.vercel/`, `.env`). Teammates who pull the repo
just run `cd backlog && pnpm install && pnpm dev` — no re-scaffold needed. Re-run
`/caw:backlog` only to pull a newer viewer version after `/plugin marketplace update caw`.
