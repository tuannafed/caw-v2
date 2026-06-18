#!/usr/bin/env bash
set -euo pipefail

# Usage: ./sync.sh [<project-path>] [--dry-run] [--type <team-type>]
#
# Syncs the latest claude agent workflow templates into an existing project.
# Safe to run anytime — only overwrites template-owned files (agents, commands,
# rules, hooks). User content is never touched. Skills are NOT synced — run
# `/caw-setup --refresh` for those.
#
# What gets UPDATED (overwritten with latest templates):
#   .claude/agents/*.md            — 5 agent definitions
#   .claude/commands/*.md          — 7 slash commands
#   .claude/rules/<dir>/*.md       — coding rules (only subdirs already present)
#   .claude/advisories/*.md        — security advisories
#   .claude/gitleaks.toml          — gitleaks config (if already present)
#   .claude/settings.json          — hooks config (if already present)
#   .claude/hooks/*.js             — hook scripts
#   docs/caw/adr.md             — ADR format template
#   docs/caw/intake.md          — feature-intake format template
#   .claude/README.md              — caw README copy for in-project reference
#   commitlint.config.cjs          — commit rules (if already present)
#   AGENTS.md                      — Codex CLI + Antigravity rules (if already present)
#
# What is created only if MISSING (never overwritten):
#   docs/caw/conventions.md
#   docs/caw/decisions/
#   docs/caw/harness-backlog.md
#   .claudeignore
#   .github/PULL_REQUEST_TEMPLATE.md
#
# What is NEVER touched:
#   CLAUDE.md                              — user's project context
#   docs/caw/knowledge.md         — accumulated lessons
#   docs/caw/stories/               — story prose history
#   Any source code
# (Story/task state lives in the DB — harness-cli, not markdown. No overview.yaml
#  or test-matrix.md in v2.)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/template/config"
PROJECT_PATH=""
DRY_RUN=false
TEAM_TYPE=""

# ── Parse arguments ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --type)    TEAM_TYPE="$2"; shift 2 ;;
    -*) echo "Unknown flag: $1"; echo "Usage: $(basename "${BASH_SOURCE[0]}") [<project-path>] [--type <team-type>] [--dry-run]"; exit 1 ;;
    *) PROJECT_PATH="$1"; shift ;;
  esac
done

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Claude Agent Workflow (caw) — Upgrade Project   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Project path ──────────────────────────────────────────────────────────────
# Walk up from cwd looking for a directory containing .claude/ (the caw
# project marker). Lets the user run `caw sync` from any nested folder
# inside the project — e.g. `backlog/` — without typing the path.
find_caw_root() {
  local dir
  dir="$(pwd)"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.claude" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

if [[ -z "$PROJECT_PATH" ]]; then
  DEFAULT_PATH="$(find_caw_root || pwd)"
  printf "Project path [%s]: " "$DEFAULT_PATH"
  read -r input_path
  PROJECT_PATH="${input_path:-$DEFAULT_PATH}"
fi

PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "Error: Directory not found: $PROJECT_PATH"
  exit 1
fi

PROJECT_NAME="$(basename "$PROJECT_PATH")"
DOTCLAUDE="$PROJECT_PATH/.claude"
CONDUCTOR_DIR="$PROJECT_PATH/docs/caw"   # caw v2: conductor seed files flattened under docs/caw/

if [[ ! -d "$DOTCLAUDE" ]]; then
  echo "Error: No .claude/ directory found in $PROJECT_PATH"
  echo "       Run 'caw init' first."
  exit 1
fi

[[ -z "$TEAM_TYPE" ]] && TEAM_TYPE="fullstack-web"

echo "  Project : $PROJECT_NAME"
echo "  Path    : $PROJECT_PATH"
echo "  Type    : $TEAM_TYPE"
[[ "$DRY_RUN" == true ]] && echo "  Mode    : dry-run (no files changed)"
echo ""

# ── Agent + command set ────────────────────────────────────────────────────────
AGENTS="setup planner coder tester reviewer"
COMMANDS="caw-setup caw-plan caw-code caw-test caw-review caw-verify caw-status"

# ── Helper ────────────────────────────────────────────────────────────────────
UPDATED=0
SKIPPED=0

update_file() {
  local src="$1"
  local dest="$2"
  local label="$3"

  if [[ ! -f "$src" ]]; then
    echo "   ⚠️  Template not found: $label (skipped)"
    (( SKIPPED++ )) || true
    return
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "   would update: $label"
    (( UPDATED++ )) || true
    return
  fi

  cp "$src" "$dest"
  echo "   ✅ $label"
  (( UPDATED++ )) || true
}

# ── 1. Agents ──────────────────────────────────────────────────────────────────
echo "Updating agents..."
mkdir -p "$DOTCLAUDE/agents"
for agent in $AGENTS; do
  update_file \
    "$REPO_ROOT/template/agents/$agent.md" \
    "$DOTCLAUDE/agents/$agent.md" \
    ".claude/agents/$agent.md"
done

# ── 2. Commands ────────────────────────────────────────────────────────────────
echo ""
echo "Updating commands..."
mkdir -p "$DOTCLAUDE/commands"
for cmd in $COMMANDS; do
  update_file \
    "$REPO_ROOT/template/commands/$cmd.md" \
    "$DOTCLAUDE/commands/$cmd.md" \
    ".claude/commands/$cmd.md"
done

# ── 3. Skills are NOT synced by sync ────────────────────────────────────────
# Skill installation (caw-owned + hub) belongs to `/caw-setup` — it owns the
# `.agents/` ⇄ `.claude/skills/` symlink layout and the stack detection that
# decides which skills a project needs. To refresh skills after a sync, run
# `/caw-setup --refresh`. `caw sync` only syncs agents, commands, rules, hooks,
# and conductor templates.

# ── 4. Rules (sync subdirs already present in the project) ────────────────────
echo ""
echo "Updating rules..."
RULES_SRC="$REPO_ROOT/template/rules"
RULES_DEST="$DOTCLAUDE/rules"
if [[ -d "$RULES_SRC" && -d "$RULES_DEST" ]]; then
  while IFS= read -r -d '' rules_subdir; do
    subdir_name="$(basename "$rules_subdir")"
    src_subdir="$RULES_SRC/$subdir_name"
    [[ -d "$src_subdir" ]] || continue
    while IFS= read -r -d '' existing_rule; do
      rule_name="$(basename "$existing_rule")"
      update_file \
        "$src_subdir/$rule_name" \
        "$existing_rule" \
        ".claude/rules/$subdir_name/$rule_name"
    done < <(find "$rules_subdir" -maxdepth 1 -name "*.md" -print0 2>/dev/null)
  done < <(find "$RULES_DEST" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
else
  echo "   ⏭️  .claude/rules/ (not present, skipped)"
fi

# ── 5. Security advisories ─────────────────────────────────────────────────────
echo ""
echo "Updating security advisories..."
ADVISORIES_SRC="$TEMPLATE_DIR/advisories"
ADVISORIES_DEST="$PROJECT_PATH/docs/caw/advisories"
# Migrate legacy location (docs/advisories/ → docs/caw/advisories/) once.
ADVISORIES_LEGACY="$PROJECT_PATH/docs/advisories"
if [[ -d "$ADVISORIES_LEGACY" && ! -d "$ADVISORIES_DEST" ]]; then
  mkdir -p "$(dirname "$ADVISORIES_DEST")"
  mv "$ADVISORIES_LEGACY" "$ADVISORIES_DEST"
  echo "   ↪️  migrated docs/advisories/ → docs/caw/advisories/"
fi
if [[ -d "$ADVISORIES_SRC" ]]; then
  mkdir -p "$ADVISORIES_DEST"
  while IFS= read -r -d '' adv_file; do
    adv_name="$(basename "$adv_file")"
    update_file "$adv_file" "$ADVISORIES_DEST/$adv_name" "docs/caw/advisories/$adv_name"
  done < <(find "$ADVISORIES_SRC" -maxdepth 1 -name "*.md" -print0)
fi

# ── 6. Gitleaks config (sync if present, never auto-add) ──────────────────────
echo ""
echo "Updating gitleaks config..."
if [[ -f "$DOTCLAUDE/gitleaks.toml" ]]; then
  update_file \
    "$TEMPLATE_DIR/gitleaks.toml" \
    "$DOTCLAUDE/gitleaks.toml" \
    ".claude/gitleaks.toml"
else
  echo "   ⏭️  .claude/gitleaks.toml (not present, skipped)"
fi

# ── 7. Settings.json ──────────────────────────────────────────────────────────
echo ""
echo "Updating settings..."
if [[ -f "$DOTCLAUDE/settings.json" ]]; then
  update_file \
    "$TEMPLATE_DIR/settings.json" \
    "$DOTCLAUDE/settings.json" \
    ".claude/settings.json"
else
  echo "   ⏭️  .claude/settings.json (not present, skipped)"
fi

# ── 8. Hook scripts ───────────────────────────────────────────────────────────
echo ""
echo "Updating hook scripts..."
mkdir -p "$DOTCLAUDE/hooks"
for hook_file in "$REPO_ROOT/template/durable/hooks/"*.js; do
  [[ -f "$hook_file" ]] || continue
  hook_name="$(basename "$hook_file")"
  update_file "$hook_file" "$DOTCLAUDE/hooks/$hook_name" ".claude/hooks/$hook_name"
done

# ── 9. Conductor: conventions.md (create only if missing) ─────────────────────
echo ""
echo "Checking project conventions..."
PROJECT_CONVENTIONS="$CONDUCTOR_DIR/conventions.md"
mkdir -p "$CONDUCTOR_DIR"

if [[ -f "$PROJECT_CONVENTIONS" ]]; then
  echo "   ⏭️  docs/caw/conventions.md (already exists)"
else
  if [[ "$DRY_RUN" == true ]]; then
    echo "   would create: docs/caw/conventions.md"
    (( UPDATED++ )) || true
  else
    cp "$REPO_ROOT/template/conductor/conventions.md" "$PROJECT_CONVENTIONS"
    sed -i.bak "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" "$PROJECT_CONVENTIONS"
    sed -i.bak "s/{{TEAM_TYPE}}/$TEAM_TYPE/g" "$PROJECT_CONVENTIONS"
    rm "$PROJECT_CONVENTIONS.bak"
    echo "   ✅ docs/caw/conventions.md"
    (( UPDATED++ )) || true
  fi
fi

# ── 10. Conductor: harness fusion artifacts (create only if missing) ──────────
echo ""
echo "Checking harness fusion artifacts..."

# decisions/ folder + README
if [[ ! -d "$CONDUCTOR_DIR/decisions" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   would create: docs/caw/decisions/"
    (( UPDATED++ )) || true
  else
    mkdir -p "$CONDUCTOR_DIR/decisions"
    cat > "$CONDUCTOR_DIR/decisions/README.md" <<'EOF'
# Architectural Decision Records

ADRs for this project. Filename: `NNNN-<kebab-slug>.md`. Use the template
at `docs/caw/adr.md`. ADRs are usually created by planner during
`/caw-plan`, or by code-writing agents when they choose between
architecture options. See `.claude/rules/common/harness-contract.md`.
EOF
    echo "   ✅ docs/caw/decisions/ (created)"
    (( UPDATED++ )) || true
  fi
else
  echo "   ⏭️  docs/caw/decisions/ (already exists)"
fi

# Harness friction log — created only if missing (accumulates project notes).
# No test-matrix.md in v2 (coverage is the generated harness-cli query matrix).
for doc in harness-backlog.md; do
  if [[ ! -f "$CONDUCTOR_DIR/$doc" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      echo "   would create: docs/caw/$doc"
      (( UPDATED++ )) || true
    else
      cp "$REPO_ROOT/template/conductor/$doc" "$CONDUCTOR_DIR/$doc"
      echo "   ✅ docs/caw/$doc (created)"
      (( UPDATED++ )) || true
    fi
  else
    echo "   ⏭️  docs/caw/$doc (already exists, user content preserved)"
  fi
done

# Format-only templates — always sync (reference material, not user data)
for tmpl in adr.md intake.md; do
  src="$REPO_ROOT/template/conductor/$tmpl"
  dest="$CONDUCTOR_DIR/$tmpl"
  if [[ -f "$src" ]]; then
    update_file "$src" "$dest" "docs/caw/$tmpl"
  fi
done

# Migration: remove the obsolete conductor/templates/ dir from older installs
if [[ -d "$CONDUCTOR_DIR/templates" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   would remove: docs/caw/templates/ (obsolete — flattened into docs/caw/)"
  else
    rm -rf "$CONDUCTOR_DIR/templates"
    echo "   🗑️  docs/caw/templates/ (removed — flattened into docs/caw/)"
  fi
fi

# ── 11. .claudeignore (create only if missing) ────────────────────────────────
echo ""
echo "Checking .claudeignore..."
if [[ -f "$TEMPLATE_DIR/.claudeignore" ]]; then
  if [[ -f "$PROJECT_PATH/.claudeignore" ]]; then
    echo "   ⏭️  .claudeignore (already exists, user content preserved)"
  else
    if [[ "$DRY_RUN" == true ]]; then
      echo "   would create: .claudeignore"
      (( UPDATED++ )) || true
    else
      cp "$TEMPLATE_DIR/.claudeignore" "$PROJECT_PATH/.claudeignore"
      echo "   ✅ .claudeignore"
      (( UPDATED++ )) || true
    fi
  fi
fi

# ── 12. README copy ───────────────────────────────────────────────────────────
echo ""
echo "Updating README..."
if [[ -f "$REPO_ROOT/README.md" ]]; then
  update_file "$REPO_ROOT/README.md" "$DOTCLAUDE/README.md" ".claude/README.md"
fi

# ── 13. GitHub PR template (create only if missing) ───────────────────────────
echo ""
echo "Updating GitHub PR template..."
PR_TEMPLATE_SRC="$TEMPLATE_DIR/PULL_REQUEST_TEMPLATE.md"
PR_TEMPLATE_DEST="$PROJECT_PATH/.github/PULL_REQUEST_TEMPLATE.md"
if [[ -f "$PR_TEMPLATE_SRC" ]] && [[ ! -f "$PR_TEMPLATE_DEST" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   would create: .github/PULL_REQUEST_TEMPLATE.md"
    (( UPDATED++ )) || true
  else
    mkdir -p "$PROJECT_PATH/.github"
    cp "$PR_TEMPLATE_SRC" "$PR_TEMPLATE_DEST"
    echo "   ✅ .github/PULL_REQUEST_TEMPLATE.md (created)"
    (( UPDATED++ )) || true
  fi
elif [[ -f "$PR_TEMPLATE_DEST" ]]; then
  echo "   ⏭️  .github/PULL_REQUEST_TEMPLATE.md (already exists — not overwritten)"
fi

# ── 14. Commit + cross-IDE AI rules ───────────────────────────────────────────
# Strategy: for Node/JS projects, ALWAYS ensure the full set of files exists
# (auto-create missing, overwrite existing). This makes sync idempotent and
# brings older projects up to the latest cross-IDE rule set.
#
# Exception: .vscode/settings.json is never overwritten — users have personal
# settings there. We only create it if missing; otherwise print a hint.
echo ""
echo "Updating commit + cross-IDE AI rules (VS Code, Cursor, Codex, Antigravity)..."

# Helper: copy-or-create with {{PROJECT_NAME}} substitution
ensure_file() {
  local src="$1"
  local dest="$2"
  local label="$3"
  local substitute="${4:-true}"  # substitute {{PROJECT_NAME}} by default

  if [[ ! -f "$src" ]]; then
    echo "   ⚠️  Template not found: $label (skipped)"
    (( SKIPPED++ )) || true
    return
  fi

  local past="updated"
  local present="update"
  if [[ ! -f "$dest" ]]; then
    past="created"
    present="create"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "   would $present: $label"
    (( UPDATED++ )) || true
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  if [[ "$substitute" == "true" ]]; then
    perl -i -pe "s/\{\{PROJECT_NAME\}\}/$PROJECT_NAME/g;" "$dest"
  fi
  echo "   ✅ $label ($past)"
  (( UPDATED++ )) || true
}

if [[ -f "$PROJECT_PATH/package.json" ]]; then
  # commitlint config — prefer .cjs; warn if legacy .js exists
  if [[ -f "$PROJECT_PATH/commitlint.config.js" ]] && [[ ! -f "$PROJECT_PATH/commitlint.config.cjs" ]]; then
    printf "   ${C_YELLOW:-}⚠️${C_RESET:-}  commitlint.config.js detected (legacy). caw template uses .cjs.\n"
    printf "      ${C_DIM:-}Options: rename to .cjs (\`mv commitlint.config.js commitlint.config.cjs\`)\n"
    printf "      ${C_DIM:-}or manually align rules with: $TEMPLATE_DIR/commitlint.config.cjs${C_RESET:-}\n"
  fi
  ensure_file \
    "$TEMPLATE_DIR/commitlint.config.cjs" \
    "$PROJECT_PATH/commitlint.config.cjs" \
    "commitlint.config.cjs" \
    "false"

  # AGENTS.md — Codex CLI + Antigravity + cross-tool
  ensure_file \
    "$TEMPLATE_DIR/AGENTS.md" \
    "$PROJECT_PATH/AGENTS.md" \
    "AGENTS.md"
else
  echo "   ⏭️  (no package.json — commit + AI rules skipped)"
fi

# ── 15. Backlog viewer (sync source if already installed) ─────────────────────
# The viewer is opt-in at `caw init`. If a project has it, refresh the Astro/React
# source so UI fixes reach the project. node_modules/dist/.astro are excluded —
# they are gitignored local build artifacts the user re-creates with `pnpm install`.
echo ""
echo "Updating backlog viewer..."
BV_SRC="$REPO_ROOT/tools/backlog"
BV_DEST="$PROJECT_PATH/backlog"
if [[ -d "$BV_SRC" && -d "$BV_DEST" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   would update: backlog/ (Astro source, excl. node_modules)"
    (( UPDATED++ )) || true
  else
    (cd "$BV_SRC" && tar --exclude='node_modules' --exclude='dist' --exclude='.astro' --exclude='.vercel' -cf - .) \
      | (cd "$BV_DEST" && tar -xf -)
    echo "   ✅ backlog/ (Astro source synced)"
    (( UPDATED++ )) || true
  fi
else
  echo "   ⏭️  backlog/ (not installed — run \`caw init\` to opt in)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "🔍 Dry run complete — $UPDATED file(s) would be updated."
else
  echo "✨ Upgrade complete! $UPDATED file(s) updated in: $PROJECT_PATH"
fi
echo ""
echo "Not touched (your content is safe):"
echo "  CLAUDE.md"
echo "  .claudeignore (if already present)"
echo "  docs/caw/knowledge.md"
echo "  docs/caw/stories/ (story prose history)"
echo "  docs/caw/conventions.md (if already present)"
echo "  docs/caw/harness-backlog.md (if already present)"
echo "  .claude/harness.db (story/task state — never overwritten)"
echo "  docs/caw/decisions/ (existing ADRs preserved)"
echo "  .github/PULL_REQUEST_TEMPLATE.md (if already present)"
echo "  .vscode/settings.json (never overwritten — merge AI snippet manually)"
echo "  backlog/{node_modules,dist,.astro} (local build artifacts)"
