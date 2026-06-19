#!/usr/bin/env bash
set -euo pipefail

# Usage: ./init.sh [<project-path>]
# Detects stack automatically from package.json / pyproject.toml in the project path.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/template/config"

# Shared agent/command sets (single source of truth — see cli/defs.sh).
# shellcheck source=defs.sh
source "$(dirname "${BASH_SOURCE[0]}")/defs.sh"

# ── ANSI colors (auto-disabled if NO_COLOR set or output not a TTY) ──────────
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
  C_GRAY=$'\033[90m'
  C_BRIGHT_CYAN=$'\033[96m'
  C_BRIGHT_GREEN=$'\033[92m'
  C_BRIGHT_YELLOW=$'\033[93m'
else
  C_RESET="" C_BOLD="" C_DIM="" C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_MAGENTA="" C_CYAN="" C_GRAY="" C_BRIGHT_CYAN="" C_BRIGHT_GREEN="" C_BRIGHT_YELLOW=""
fi

# Render a labeled detection row with consistent column alignment + value highlight.
# Usage: kv "Project" "direct2vet" [color]
kv() {
  local label="$1" value="$2" color="${3:-$C_BRIGHT_CYAN}"
  printf "  ${C_GRAY}%-10s${C_RESET} ${C_DIM}:${C_RESET} ${color}%s${C_RESET}\n" "$label" "$value"
}

# Status line helpers (colorized + prefix-aligned).
ok()   { printf "   ${C_GREEN}✅${C_RESET} %s\n" "$*"; }
skip() { printf "   ${C_GRAY}⏭️${C_RESET}  ${C_DIM}%s${C_RESET}\n" "$*"; }
warn() { printf "   ${C_YELLOW}⚠️${C_RESET}  %s\n" "$*"; }
err()  { printf "   ${C_RED}❌${C_RESET} ${C_BOLD}%s${C_RESET}\n" "$*"; }

# ── Pre-init DETECTED_* vars ─────────────────────────────────────────────────
# detect_from_source() sets these when --auto-detect is used; otherwise they
# must already exist so later code can read them under `set -u`.
DETECTED_LAYER=""
DETECTED_FRAMEWORK=""
DETECTED_LIBS=""
DETECTED_PROJECT_NAME=""
DETECTED_FRONTEND_STACK=""
DETECTED_BACKEND_STACK=""
DETECTED_DATABASE=""
DETECTED_AUTH=""
DETECTED_MONOREPO=""
DETECTED_WORKSPACES=""

# ── Helpers ───────────────────────────────────────────────────────────────────

# Escape replacement text for sed s/// commands.
escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

# NOTE: init.sh deliberately does NOT copy skills — it ships only agents,
# commands, rules, and hooks. Skill installation (caw-owned + hub) is the
# `/caw-setup` agent's job, which also sets up the `.agents/` ⇄ `.claude/skills/`
# symlink layout. See CLAUDE.md "Init logic".

copy_rule_directory() {
  local relative_dir="$1"
  local source_dir="$REPO_ROOT/template/rules/$relative_dir"
  local target_dir="$PROJECT_PATH/.claude/rules/$relative_dir"

  [[ -d "$source_dir" ]] || return

  mkdir -p "$target_dir"
  while IFS= read -r -d '' source_file; do
    local file_name dest_file
    file_name="$(basename "$source_file")"
    dest_file="$target_dir/$file_name"

    if [[ ! -f "$dest_file" ]]; then
      cp "$source_file" "$dest_file"
      echo "   ✅ .claude/rules/$relative_dir/$file_name"
    else
      echo "   ⏭️  .claude/rules/$relative_dir/$file_name (already exists)"
    fi
  done < <(find "$source_dir" -maxdepth 1 -name "*.md" -print0)
}

# ── Auto-detect stack from existing source files ──────────────────────────────
# Sets DETECTED_LAYER, DETECTED_FRAMEWORK, DETECTED_LIBS, DETECTED_PROJECT_NAME,
# DETECTED_FRONTEND_STACK, DETECTED_BACKEND_STACK, DETECTED_DATABASE, DETECTED_AUTH
detect_from_source() {
  local path="$1"
  DETECTED_LAYER=""
  DETECTED_FRAMEWORK=""
  DETECTED_LIBS=""
  DETECTED_PROJECT_NAME=""
  DETECTED_FRONTEND_STACK=""
  DETECTED_BACKEND_STACK=""
  DETECTED_DATABASE=""
  DETECTED_AUTH=""
  DETECTED_MONOREPO=""
  DETECTED_WORKSPACES=""

  local pkg="$path/package.json"
  local pyproject="$path/pyproject.toml"
  local requirements="$path/requirements.txt"

  # ── Project name ──────────────────────────────────────────────────────────
  if [[ -f "$pkg" ]]; then
    local npm_name
    npm_name="$(grep -m1 '"name"' "$pkg" 2>/dev/null | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
    [[ -n "$npm_name" ]] && DETECTED_PROJECT_NAME="$npm_name"
  fi
  if [[ -z "$DETECTED_PROJECT_NAME" ]] && [[ -f "$pyproject" ]]; then
    local py_name
    py_name="$(grep -m1 '^name[[:space:]]*=' "$pyproject" 2>/dev/null | sed 's/name[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/')"
    [[ -n "$py_name" ]] && DETECTED_PROJECT_NAME="$py_name"
  fi
  [[ -z "$DETECTED_PROJECT_NAME" ]] && DETECTED_PROJECT_NAME="$(basename "$path")"

  # ── Frontend detection ────────────────────────────────────────────────────
  local has_next=false has_tanstack_start=false has_react=false
  local has_nestjs=false has_fastapi=false

  if [[ -f "$pkg" ]]; then
    grep -q '"next"' "$pkg" 2>/dev/null && has_next=true
    grep -q '"@tanstack/react-start"' "$pkg" 2>/dev/null && has_tanstack_start=true
    grep -q '"react"' "$pkg" 2>/dev/null && has_react=true
    grep -q '"@nestjs/core"' "$pkg" 2>/dev/null && has_nestjs=true
  fi
  [[ -f "$path/next.config.js" || -f "$path/next.config.ts" || -f "$path/next.config.mjs" ]] && has_next=true
  [[ -f "$path/src/routes/__root.tsx" || -f "$path/src/routes/__root.ts" ]] && has_tanstack_start=true
  [[ -f "$path/nest-cli.json" ]] && has_nestjs=true

  if [[ -f "$pyproject" ]]; then
    grep -qi "fastapi" "$pyproject" 2>/dev/null && has_fastapi=true
  fi
  if [[ -f "$requirements" ]]; then
    grep -qi "fastapi" "$requirements" 2>/dev/null && has_fastapi=true
  fi

  # ── Layer + Framework ─────────────────────────────────────────────────────
  local has_frontend=false has_backend=false
  ($has_next || $has_tanstack_start || $has_react) && has_frontend=true
  ($has_nestjs || $has_fastapi) && has_backend=true

  if $has_frontend && $has_backend; then
    DETECTED_LAYER="fullstack"
  elif $has_frontend; then
    DETECTED_LAYER="frontend"
  elif $has_backend; then
    DETECTED_LAYER="backend"
  fi

  if $has_tanstack_start; then
    DETECTED_FRAMEWORK="tanstack-start"
  elif $has_next; then
    DETECTED_FRAMEWORK="nextjs"
  elif $has_nestjs; then
    DETECTED_FRAMEWORK="nestjs"
  elif $has_fastapi; then
    DETECTED_FRAMEWORK="fastapi"
  fi

  # ── Libs ──────────────────────────────────────────────────────────────────
  local detected_libs=""
  if [[ -f "$pkg" ]]; then
    grep -q '"zustand"' "$pkg" 2>/dev/null          && detected_libs+=" zustand"
    grep -q '"@tanstack/react-query"' "$pkg" 2>/dev/null && detected_libs+=" tanstack-query"
    grep -q '"@reduxjs/toolkit"' "$pkg" 2>/dev/null && detected_libs+=" rtk-query"
    grep -q '"@tanstack/react-table"' "$pkg" 2>/dev/null && detected_libs+=" tanstack-table"
    grep -q '"better-auth"' "$pkg" 2>/dev/null      && detected_libs+=" better-auth"
    grep -q '"next-auth"' "$pkg" 2>/dev/null         && detected_libs+=" authjs"
    grep -q '"zod"' "$pkg" 2>/dev/null               && detected_libs+=" zod"
    grep -q '"react-hook-form"' "$pkg" 2>/dev/null   && detected_libs+=" react-hook-form"
    grep -q '"@biomejs/biome"' "$pkg" 2>/dev/null    && detected_libs+=" biome"
  fi
  [[ -f "$path/biome.json" ]] && [[ "$detected_libs" != *"biome"* ]] && detected_libs+=" biome"
  [[ -f "$path/components.json" ]] && detected_libs+=" shadcn"
  DETECTED_LIBS="${detected_libs# }"

  # ── Database ──────────────────────────────────────────────────────────────
  if [[ -f "$pkg" ]]; then
    grep -q '"prisma"' "$pkg" 2>/dev/null            && DETECTED_DATABASE="PostgreSQL (Prisma)"
    grep -q '"drizzle-orm"' "$pkg" 2>/dev/null       && DETECTED_DATABASE="PostgreSQL (Drizzle)"
    grep -q '"typeorm"' "$pkg" 2>/dev/null           && DETECTED_DATABASE="PostgreSQL (TypeORM)"
    grep -q '"mongoose"' "$pkg" 2>/dev/null          && DETECTED_DATABASE="MongoDB (Mongoose)"
  fi
  if [[ -f "$path/prisma/schema.prisma" ]] && [[ -z "$DETECTED_DATABASE" ]]; then
    DETECTED_DATABASE="PostgreSQL (Prisma)"
  fi
  if [[ -f "$pyproject" ]]; then
    grep -qi "sqlalchemy" "$pyproject" 2>/dev/null   && DETECTED_DATABASE="PostgreSQL (SQLAlchemy)"
    grep -qi "tortoise" "$pyproject" 2>/dev/null     && DETECTED_DATABASE="PostgreSQL (Tortoise ORM)"
  fi
  [[ -z "$DETECTED_DATABASE" ]] && DETECTED_DATABASE="PostgreSQL"

  # ── Auth ──────────────────────────────────────────────────────────────────
  if [[ -f "$pkg" ]]; then
    grep -q '"better-auth"' "$pkg" 2>/dev/null       && DETECTED_AUTH="Better Auth"
    grep -q '"next-auth"' "$pkg" 2>/dev/null         && DETECTED_AUTH="Auth.js (NextAuth)"
    grep -q '"jose"' "$pkg" 2>/dev/null              && [[ -z "$DETECTED_AUTH" ]] && DETECTED_AUTH="JWT (jose)"
  fi
  [[ -z "$DETECTED_AUTH" ]] && DETECTED_AUTH="JWT + refresh tokens"

  # ── Stack display strings ─────────────────────────────────────────────────
  case "$DETECTED_FRAMEWORK" in
    nextjs)
      DETECTED_FRONTEND_STACK="Next.js 15 + React 19 + Tailwind CSS"
      [[ "$DETECTED_LIBS" == *"tanstack-query"* ]] && DETECTED_FRONTEND_STACK+=" + TanStack Query"
      [[ "$DETECTED_LIBS" == *"zustand"* ]]        && DETECTED_FRONTEND_STACK+=" + Zustand"
      [[ "$DETECTED_LIBS" == *"rtk-query"* ]]      && DETECTED_FRONTEND_STACK+=" + RTK Query"
      ;;
    tanstack-start)
      DETECTED_FRONTEND_STACK="TanStack Start + Vite + React"
      [[ "$DETECTED_LIBS" == *"tanstack-query"* ]] && DETECTED_FRONTEND_STACK+=" + TanStack Query"
      [[ "$DETECTED_LIBS" == *"zustand"* ]]        && DETECTED_FRONTEND_STACK+=" + Zustand"
      [[ "$DETECTED_LIBS" == *"tanstack-table"* ]] && DETECTED_FRONTEND_STACK+=" + TanStack Table"
      ;;
    nestjs)
      DETECTED_BACKEND_STACK="NestJS + TypeScript"
      ;;
    fastapi)
      DETECTED_BACKEND_STACK="FastAPI + Python"
      ;;
  esac
  if [[ "$DETECTED_LAYER" == "fullstack" ]]; then
    [[ -z "$DETECTED_BACKEND_STACK" ]] && DETECTED_BACKEND_STACK="NestJS + TypeScript"
  fi

  # ── Monorepo detection ────────────────────────────────────────────────────
  if [[ -f "$path/turbo.json" ]]; then
    DETECTED_MONOREPO="turborepo"
  fi
  if [[ -f "$path/pnpm-workspace.yaml" ]]; then
    local ws_list=""
    if [[ -d "$path/apps" ]]; then
      local apps_list
      apps_list="$(ls "$path/apps" 2>/dev/null | tr '\n' ',' | sed 's/,$//')"
      ws_list="$apps_list"
    fi
    if [[ -d "$path/packages" ]]; then
      local pkgs_list
      pkgs_list="$(ls "$path/packages" 2>/dev/null | tr '\n' ',' | sed 's/,$//')"
      ws_list="${ws_list:+$ws_list,}$pkgs_list"
    fi
    DETECTED_WORKSPACES="$ws_list"
  fi

  # ── Monorepo workspace scanning (when root pkg.json has no framework) ─────
  # In a Turborepo monorepo the root package.json has no framework deps.
  # Scan apps/*/package.json and apps/*/next.config.* to detect frameworks.
  if [[ -n "$DETECTED_MONOREPO" ]] && [[ -z "$DETECTED_FRAMEWORK" ]] && [[ -d "$path/apps" ]]; then
    local mono_has_next=false mono_has_tanstack=false mono_has_nestjs=false mono_has_fastapi=false

    for app_pkg in "$path/apps"/*/package.json; do
      [[ -f "$app_pkg" ]] || continue
      grep -q '"next"' "$app_pkg" 2>/dev/null             && mono_has_next=true
      grep -q '"@tanstack/react-start"' "$app_pkg" 2>/dev/null && mono_has_tanstack=true
      grep -q '"@nestjs/core"' "$app_pkg" 2>/dev/null     && mono_has_nestjs=true
    done
    # Also check config files inside app directories
    for app_dir in "$path/apps"/*/; do
      [[ -d "$app_dir" ]] || continue
      [[ -f "$app_dir/next.config.js" || -f "$app_dir/next.config.ts" || -f "$app_dir/next.config.mjs" ]] && mono_has_next=true
      [[ -f "$app_dir/nest-cli.json" ]] && mono_has_nestjs=true
      [[ -f "$app_dir/pyproject.toml" ]] && grep -qi "fastapi" "$app_dir/pyproject.toml" 2>/dev/null && mono_has_fastapi=true
    done

    if $mono_has_tanstack; then
      DETECTED_FRAMEWORK="tanstack-start"
    elif $mono_has_next; then
      DETECTED_FRAMEWORK="nextjs"
    elif $mono_has_nestjs; then
      DETECTED_FRAMEWORK="nestjs"
    elif $mono_has_fastapi; then
      DETECTED_FRAMEWORK="fastapi"
    fi

    # Determine layer from workspace apps
    local mono_has_frontend=false mono_has_backend=false
    ($mono_has_next || $mono_has_tanstack) && mono_has_frontend=true
    ($mono_has_nestjs || $mono_has_fastapi) && mono_has_backend=true

    # Override layer based on workspace contents (monorepo scan is authoritative)
    if $mono_has_frontend && $mono_has_backend; then
      DETECTED_LAYER="fullstack"
    elif $mono_has_frontend; then
      DETECTED_LAYER="frontend"
    elif $mono_has_backend; then
      DETECTED_LAYER="backend"
    fi

    # Rebuild display strings for monorepo-detected framework
    case "$DETECTED_FRAMEWORK" in
      nextjs)
        DETECTED_FRONTEND_STACK="Next.js 15 + React 19 + Tailwind CSS"
        ;;
      tanstack-start)
        DETECTED_FRONTEND_STACK="TanStack Start + Vite + React"
        ;;
      nestjs)
        DETECTED_BACKEND_STACK="NestJS + TypeScript"
        ;;
      fastapi)
        DETECTED_BACKEND_STACK="FastAPI + Python"
        ;;
    esac
  fi
}

# ── Parse arguments ───────────────────────────────────────────────────────────
PROJECT_PATH=""
PROJECT_NAME=""
LAYER=""
FRAMEWORK=""
SELECTED_LIBS=""
TEAM_TYPE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -*) echo "Unknown flag: $1"; echo "Usage: $(basename "${BASH_SOURCE[0]}") [<project-path>]"; exit 1 ;;
    *) PROJECT_PATH="$1"; shift ;;
  esac
done

# ── Interactive mode ───────────────────────────────────────────────────────────
echo ""
printf "${C_BRIGHT_CYAN}${C_BOLD}╔════════════════════════════════════════════════╗${C_RESET}\n"
printf "${C_BRIGHT_CYAN}${C_BOLD}║${C_RESET}   ${C_BOLD}Claude Agent Workflow${C_RESET} ${C_DIM}(caw)${C_RESET} ${C_GRAY}—${C_RESET} ${C_BRIGHT_GREEN}Init Project${C_RESET}   ${C_BRIGHT_CYAN}${C_BOLD}║${C_RESET}\n"
printf "${C_BRIGHT_CYAN}${C_BOLD}╚════════════════════════════════════════════════╝${C_RESET}\n"
echo ""

# Step 1: Project path
if [[ -z "$PROJECT_PATH" ]]; then
  DEFAULT_PATH="$(pwd)"
  printf "${C_BOLD}Project path${C_RESET} ${C_GRAY}[%s]${C_RESET}: " "$DEFAULT_PATH"
  read -r input_path
  PROJECT_PATH="${input_path:-$DEFAULT_PATH}"
fi
PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

# ── Auto-detect from existing source code ─────────────────────────────────────
AUTO_DETECT_MODE=false
if [[ -f "$PROJECT_PATH/package.json" || -f "$PROJECT_PATH/pyproject.toml" ]]; then
  detect_from_source "$PROJECT_PATH"
  AUTO_DETECT_MODE=true

  PROJECT_NAME="$DETECTED_PROJECT_NAME"
  LAYER="${DETECTED_LAYER:-fullstack}"
  FRAMEWORK="${DETECTED_FRAMEWORK:-nextjs}"
  SELECTED_LIBS="$DETECTED_LIBS"

  echo ""
  printf "${C_BRIGHT_YELLOW}🔍${C_RESET} ${C_BOLD}Auto-detected stack${C_RESET}\n"
  kv "Project"   "$PROJECT_NAME"
  kv "Layer"     "$LAYER"                          "$C_MAGENTA"
  kv "Framework" "$FRAMEWORK"                      "$C_GREEN"
  [[ -n "$DETECTED_FRONTEND_STACK" ]] && kv "Frontend"  "$DETECTED_FRONTEND_STACK"
  [[ -n "$DETECTED_BACKEND_STACK" ]]  && kv "Backend"   "$DETECTED_BACKEND_STACK"
  kv "Database"  "$DETECTED_DATABASE"              "$C_BLUE"
  [[ -n "$DETECTED_MONOREPO" ]]       && kv "Monorepo"  "$DETECTED_MONOREPO"  "$C_YELLOW"
else
  echo ""
  printf "${C_RED}⚠️  No package.json or pyproject.toml found in:${C_RESET} ${C_BOLD}%s${C_RESET}\n" "$PROJECT_PATH"
  printf "${C_DIM}   Run caw init from inside an existing project directory.${C_RESET}\n"
  exit 1
fi

# Derive TEAM_TYPE from detected LAYER
case "$LAYER" in
  frontend) TEAM_TYPE="frontend-only" ;;
  backend)  TEAM_TYPE="api-only" ;;
  *)        TEAM_TYPE="fullstack-web" ;;
esac

# Auto-include default libs for Next.js / TanStack Start frontends
FRONTEND_DEFAULT_LIBS=""
case "$FRAMEWORK" in
  nextjs|tanstack-start)
    FRONTEND_DEFAULT_LIBS="zod react-hook-form typescript biome shadcn"
    ;;
esac
if [[ -n "$FRONTEND_DEFAULT_LIBS" ]]; then
  for lib in $FRONTEND_DEFAULT_LIBS; do
    if [[ " $SELECTED_LIBS " != *" $lib "* ]]; then
      SELECTED_LIBS="${SELECTED_LIBS:+$SELECTED_LIBS }$lib"
    fi
  done
fi

ESCAPED_PROJECT_NAME="$(escape_sed_replacement "$PROJECT_NAME")"

echo ""
printf "${C_GRAY}─────────────────────────────────────────${C_RESET}\n"
kv "Project"   "$PROJECT_NAME"
kv "Type"      "$TEAM_TYPE"            "$C_MAGENTA"
kv "Layer"     "$LAYER"                "$C_MAGENTA"
kv "Framework" "$FRAMEWORK"            "$C_GREEN"
[[ -n "$SELECTED_LIBS" ]] && kv "Libs" "$SELECTED_LIBS"  "$C_YELLOW"
printf "${C_GRAY}─────────────────────────────────────────${C_RESET}\n"
echo ""
if [[ -t 0 ]]; then
  printf "${C_BOLD}Proceed?${C_RESET} ${C_GRAY}[Y/n]${C_RESET}: "
  read -r confirm
  [[ "$confirm" =~ ^[Nn]$ ]] && { printf "${C_RED}Aborted.${C_RESET}\n"; exit 0; }
fi
echo ""

printf "${C_BRIGHT_GREEN}🚀${C_RESET} ${C_BOLD}Initializing claude agent workflow for:${C_RESET} ${C_BRIGHT_CYAN}%s${C_RESET}\n" "$PROJECT_NAME"
echo ""

mkdir -p "$PROJECT_PATH"

# 0. Policy docs (docs/caw/*.md) — harness operating model the agents reference.
# Scoped under docs/caw/ so project docs (which can be numerous) never collide
# with harness policy docs. Created if missing (users may tailor per project).
if [[ -d "$REPO_ROOT/template/docs" ]]; then
  printf "${C_BLUE}📄${C_RESET} ${C_BOLD}Copying${C_RESET} ${C_DIM}policy docs (docs/caw/)...${C_RESET}\n"
  mkdir -p "$PROJECT_PATH/docs/caw"
  for doc in "$REPO_ROOT/template/docs/"*.md; do
    [[ -f "$doc" ]] || continue
    doc_name="$(basename "$doc")"
    if [[ ! -f "$PROJECT_PATH/docs/caw/$doc_name" ]]; then
      cp "$doc" "$PROJECT_PATH/docs/caw/$doc_name"
      echo "   ✅ docs/caw/$doc_name"
    else
      echo "   ⏭️  docs/caw/$doc_name (already exists, skipped)"
    fi
  done
fi

# 1. Conductor seed files — flattened directly under docs/caw/ (no conductor/ level).
printf "${C_BLUE}📁${C_RESET} ${C_BOLD}Creating${C_RESET} docs/caw/ ${C_DIM}structure...${C_RESET}\n"
mkdir -p "$PROJECT_PATH/docs/caw/stories"

# knowledge.md is prose project memory (kept). backlog.md is NOT scaffolded in v2 —
# the task registry lives in the DB (harness-cli query matrix / query task).
for template in knowledge.md; do
  if [[ ! -f "$PROJECT_PATH/docs/caw/$template" ]]; then
    cp "$REPO_ROOT/template/conductor/$template" "$PROJECT_PATH/docs/caw/$template"
    dest="$PROJECT_PATH/docs/caw/$template"

    perl -i -pe "s/\{\{PROJECT_NAME\}\}/$ESCAPED_PROJECT_NAME/g;" "$dest"
    echo "   ✅ docs/caw/$template"
  else
    echo "   ⏭️  docs/caw/$template (already exists, skipped)"
  fi
done

if [[ ! -f "$PROJECT_PATH/docs/caw/conventions.md" ]]; then
  TARGET_CONVENTIONS="$PROJECT_PATH/docs/caw/conventions.md"
  cp "$REPO_ROOT/template/conductor/conventions.md" "$TARGET_CONVENTIONS"
  sed -i.bak "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" "$TARGET_CONVENTIONS"
  sed -i.bak "s/{{TEAM_TYPE}}/$TEAM_TYPE/g" "$TARGET_CONVENTIONS"
  rm -f "$TARGET_CONVENTIONS.bak"
  echo "   ✅ docs/caw/conventions.md"
else
  echo "   ⏭️  docs/caw/conventions.md (already exists, skipped)"
fi

# Harness artifacts: ADR folder (decision records) + harness-backlog (friction).
# No test-matrix.md / task-test-matrix.md in v2 — coverage is the generated
# `harness-cli query matrix` view; behavior detail is prose in each task's tests.md.
mkdir -p "$PROJECT_PATH/docs/caw/decisions"
if [[ ! -f "$PROJECT_PATH/docs/caw/decisions/README.md" ]]; then
  cat > "$PROJECT_PATH/docs/caw/decisions/README.md" <<'EOF'
# Architectural Decision Records

This folder holds ADRs for this project. Each ADR captures a non-obvious
architecture or product choice that will outlive the task that produced it.

Use the ADR template at `docs/caw/templates/adr.md` when adding a new ADR.

## Filename Format

`NNNN-<kebab-slug>.md` where `NNNN` is the highest existing number + 1.

## Created By

ADRs are usually created by the planner agent during `/caw-plan`,
or by the coder agent during a task when it must choose between architecture
options. See `.claude/rules/common/harness-contract.md` for the trigger rules.
EOF
  echo "   ✅ docs/caw/decisions/README.md"
else
  echo "   ⏭️  docs/caw/decisions/README.md (already exists, skipped)"
fi

# Format-only templates — agents read these to learn the ADR / intake structure.
# Grouped under docs/caw/templates/ (like repository-harness docs/templates/) so
# they don't clutter the guide docs at docs/caw/ root. Always synced (reference
# material, not state).
mkdir -p "$PROJECT_PATH/docs/caw/templates"
for tmpl in adr.md intake.md; do
  cp "$REPO_ROOT/template/conductor/$tmpl" "$PROJECT_PATH/docs/caw/templates/$tmpl"
  echo "   ✅ docs/caw/templates/$tmpl"
done

# Harness friction log — self-improvement feedback loop (prose, not state).
# Created only if missing (it accumulates project notes, never overwrite).
if [[ ! -f "$PROJECT_PATH/docs/caw/harness-backlog.md" ]]; then
  cp "$REPO_ROOT/template/conductor/harness-backlog.md" "$PROJECT_PATH/docs/caw/harness-backlog.md"
  echo "   ✅ docs/caw/harness-backlog.md"
else
  echo "   ⏭️  docs/caw/harness-backlog.md (already exists, skipped)"
fi

# 2. .claudeignore (root-level, skip if user already customized)
if [[ -f "$TEMPLATE_DIR/.claudeignore" ]]; then
  if [[ ! -f "$PROJECT_PATH/.claudeignore" ]]; then
    cp "$TEMPLATE_DIR/.claudeignore" "$PROJECT_PATH/.claudeignore"
    echo "   ✅ .claudeignore"
  else
    echo "   ⏭️  .claudeignore (already exists, skipped)"
  fi
fi

# 2b. .gitignore — append caw-specific entries (idempotent)
# Caw scaffolds skill files into .agents/ and .claude/ which are project-local
# (regenerated via /caw-setup). Lockfile tracks pulled hub skills.
GITIGNORE="$PROJECT_PATH/.gitignore"
CAW_IGNORE_BLOCK_START="# CAW-V2"

if [[ ! -f "$GITIGNORE" ]] || ! grep -qF "$CAW_IGNORE_BLOCK_START" "$GITIGNORE"; then
  {
    [[ -f "$GITIGNORE" ]] && echo ""
    echo "$CAW_IGNORE_BLOCK_START"
    echo "### Skills"
    echo ".agents/"
    echo ".claude/"
    echo "skills-lock.json"
    echo "### Script"
    echo "harness.db"
    echo "harness.db-wal"
    echo "harness.db-shm"
    echo "scripts/caw/harness/__pycache__/"
  } >> "$GITIGNORE"
  echo "   ✅ .gitignore (added caw entries)"
else
  echo "   ⏭️  .gitignore (caw entries already present)"
fi

# 3. Commands + agents
echo ""
printf "${C_CYAN}🔧${C_RESET} ${C_BOLD}Setting up${C_RESET} .claude/ ${C_DIM}(commands + agents + hooks)...${C_RESET}\n"
mkdir -p "$PROJECT_PATH/.claude/commands"
mkdir -p "$PROJECT_PATH/.claude/agents"

# Commands — CAW_COMMANDS is defined in cli/defs.sh (sourced at top).
for cmd in $CAW_COMMANDS; do
  cmd_file="$REPO_ROOT/template/commands/$cmd.md"
  [[ -f "$cmd_file" ]] || continue
  if [[ ! -f "$PROJECT_PATH/.claude/commands/$cmd.md" ]]; then
    cp "$cmd_file" "$PROJECT_PATH/.claude/commands/$cmd.md"
    echo "   ✅ .claude/commands/$cmd.md"
  else
    echo "   ⏭️  .claude/commands/$cmd.md (already exists)"
  fi
done

if [[ ! -f "$PROJECT_PATH/.claude/settings.json" ]]; then
  cp "$TEMPLATE_DIR/settings.json" "$PROJECT_PATH/.claude/settings.json"
  echo "   ✅ .claude/settings.json (hooks)"
else
  echo "   ⏭️  .claude/settings.json (already exists)"
fi

# Copy all hook scripts (including shared utilities like hook-flags.js, resolve-formatter.js)
mkdir -p "$PROJECT_PATH/.claude/hooks"
for hook_file in "$REPO_ROOT/template/durable/hooks/"*.js; do
  [[ -f "$hook_file" ]] || continue
  hook_name="$(basename "$hook_file")"
  dest_hook="$PROJECT_PATH/.claude/hooks/$hook_name"
  if [[ ! -f "$dest_hook" ]]; then
    cp "$hook_file" "$dest_hook"
    echo "   ✅ .claude/hooks/$hook_name"
  else
    echo "   ⏭️  .claude/hooks/$hook_name (already exists)"
  fi
done

# ── Durable layer (caw v2) — SQLite schema + Python CLI ───────────────────────
# Operational state agents produce/query lives in harness.db (gitignored).
# The schema is version-controlled; the CLI is stdlib-only Python (no toolchain).
echo ""
printf "${C_CYAN}🗄️${C_RESET}  ${C_BOLD}Setting up${C_RESET} ${C_DIM}durable layer (harness-cli + SQLite)...${C_RESET}\n"
if [[ -d "$REPO_ROOT/template/durable/harness" && -d "$REPO_ROOT/template/durable/schema" ]]; then
  # Copy CONTENTS into the dest dir (cp -r src dest nests when dest already
  # exists — e.g. a project that already has scripts/caw/schema/ → .../schema/schema).
  # Scoped under scripts/caw/ so caw scripts never collide with project scripts.
  mkdir -p "$PROJECT_PATH/scripts/caw/bin" "$PROJECT_PATH/scripts/caw/schema" "$PROJECT_PATH/scripts/caw/harness"
  cp -r "$REPO_ROOT/template/durable/schema/." "$PROJECT_PATH/scripts/caw/schema/"
  cp -r "$REPO_ROOT/template/durable/harness/." "$PROJECT_PATH/scripts/caw/harness/"
  cp "$REPO_ROOT/template/durable/bin/harness-cli" "$PROJECT_PATH/scripts/caw/bin/harness-cli"
  chmod +x "$PROJECT_PATH/scripts/caw/bin/harness-cli"
  # Drop pyc cache so we never ship build artifacts (dava2 lesson).
  find "$PROJECT_PATH/scripts/caw" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
  echo "   ✅ scripts/caw/ (schema + harness + harness-cli)"
  if command -v python3 >/dev/null 2>&1; then
    ( cd "$PROJECT_PATH" && python3 scripts/caw/bin/harness-cli init ) \
      && echo "   ✅ harness.db initialized" \
      || echo "   ⚠️  harness.db init failed (run 'scripts/caw/bin/harness-cli init' manually)"
  else
    echo "   ⚠️  python3 not found — run 'scripts/caw/bin/harness-cli init' once python3 is available"
  fi
else
  echo "   ⏭️  durable layer not present in caw source (skipping)"
fi

echo ""
printf "${C_BRIGHT_YELLOW}🔐${C_RESET} ${C_BOLD}Setting up secret scanning${C_RESET} ${C_DIM}(gitleaks)${C_RESET} — ${C_RED}mandatory${C_RESET}\n"

GITLEAKS_BLOCK_MARKER='# claude-agent-team:gitleaks-start'

build_gitleaks_block() {
  cat <<'GLBLOCK'
# claude-agent-team:gitleaks-start
# Block commits containing secrets. Skips gracefully if gitleaks not installed.
{
  CONFIG="$(git rev-parse --show-toplevel)/.claude/gitleaks.toml"
  WARNED="$(git rev-parse --show-toplevel)/.git/.gitleaks-warned"
  if ! command -v gitleaks >/dev/null 2>&1; then
    if [ ! -f "$WARNED" ]; then
      echo "[gitleaks] Not installed — secret scanning DISABLED."
      echo "[gitleaks] Install:  brew install gitleaks   (macOS)"
      echo "[gitleaks]           https://github.com/gitleaks/gitleaks#installing"
      touch "$WARNED"
    fi
  elif [ ! -f "$CONFIG" ]; then
    echo "[gitleaks] Config missing: $CONFIG — run 'caw sync .' to restore."
  else
    gitleaks protect --staged --redact --config "$CONFIG" || {
      echo ""
      echo "[gitleaks] Commit blocked: secrets detected above."
      echo "[gitleaks] False positive? Edit .claude/gitleaks.toml allowlist."
      exit 1
    }
  fi
}
# claude-agent-team:gitleaks-end
GLBLOCK
}

# Step 1 (MANDATORY) — ensure project is a git repo
if [[ ! -d "$PROJECT_PATH/.git" ]]; then
  warn "Project is not a git repository."
  if [[ -t 0 ]]; then
    read -r -p "   Initialize git repository here? [Y/n]: " git_init_answer
    git_init_answer="${git_init_answer:-Y}"
    if [[ ! "$git_init_answer" =~ ^[Yy]$ ]]; then
      echo ""
      err "Cannot proceed: gitleaks pre-commit hook requires a git repository."
      printf "      ${C_DIM}Run 'git init' in the project directory and re-run 'caw init'.${C_RESET}\n"
      exit 1
    fi
  else
    printf "   ${C_DIM}(non-interactive mode: auto-initializing git)${C_RESET}\n"
  fi
  (cd "$PROJECT_PATH" && git init -q)
  ok "git initialized"
fi

# Step 2 (MANDATORY) — ensure gitleaks binary is installed
if ! command -v gitleaks >/dev/null 2>&1; then
  echo ""
  err "gitleaks is not installed — required for caw init."
  echo ""
  printf "      ${C_BOLD}Install one of these ways, then re-run 'caw init':${C_RESET}\n"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    printf "        ${C_BRIGHT_YELLOW}brew install gitleaks${C_RESET}\n"
  fi
  printf "        ${C_GRAY}Linux:${C_RESET}    https://github.com/gitleaks/gitleaks#installing\n"
  printf "        ${C_GRAY}Docker:${C_RESET}   docker pull zricethezav/gitleaks:latest\n"
  printf "        ${C_GRAY}Manual:${C_RESET}   download binary from https://github.com/gitleaks/gitleaks/releases\n"
  echo ""
  exit 1
fi
gitleaks_version="$(gitleaks version 2>/dev/null | head -1 || echo unknown)"
ok "gitleaks detected: ${C_BRIGHT_CYAN}v${gitleaks_version}${C_RESET}"

# Step 3 — copy gitleaks config (per-project, version-controlled)
if [[ ! -f "$PROJECT_PATH/.claude/gitleaks.toml" ]]; then
  cp "$TEMPLATE_DIR/gitleaks.toml" "$PROJECT_PATH/.claude/gitleaks.toml"
  ok ".claude/gitleaks.toml ${C_DIM}(rules copied)${C_RESET}"
else
  skip ".claude/gitleaks.toml (already exists, kept)"
fi

# Step 4 — install pre-commit hook (husky preferred, fall back to .git/hooks)
uses_husky=false
if [[ -d "$PROJECT_PATH/.husky" ]] && [[ -f "$PROJECT_PATH/package.json" ]]; then
  if grep -q '"husky"' "$PROJECT_PATH/package.json" 2>/dev/null; then
    uses_husky=true
  fi
fi

if [[ "$uses_husky" == true ]]; then
  husky_hook="$PROJECT_PATH/.husky/pre-commit"
  if [[ -f "$husky_hook" ]] && grep -q "$GITLEAKS_BLOCK_MARKER" "$husky_hook" 2>/dev/null; then
    skip ".husky/pre-commit (gitleaks block already present)"
  else
    if [[ ! -f "$husky_hook" ]]; then
      printf '%s\n' "$(build_gitleaks_block)" > "$husky_hook"
    else
      printf '\n%s\n' "$(build_gitleaks_block)" >> "$husky_hook"
    fi
    chmod +x "$husky_hook"
    ok ".husky/pre-commit ${C_DIM}(husky detected, gitleaks block added)${C_RESET}"
  fi
else
  raw_hook="$PROJECT_PATH/.git/hooks/pre-commit"
  if [[ -f "$raw_hook" ]] && ! grep -q "$GITLEAKS_BLOCK_MARKER" "$raw_hook" 2>/dev/null; then
    warn ".git/hooks/pre-commit exists (not from caw)"
    printf "      ${C_DIM}To enable gitleaks, add this line to it manually:${C_RESET}\n"
    printf "      ${C_BRIGHT_YELLOW}gitleaks protect --staged --redact --config .claude/gitleaks.toml || exit 1${C_RESET}\n"
  else
    {
      echo '#!/usr/bin/env bash'
      echo 'set -e'
      build_gitleaks_block
    } > "$raw_hook"
    chmod +x "$raw_hook"
    ok ".git/hooks/pre-commit ${C_DIM}(no husky detected, raw git hook installed)${C_RESET}"
  fi
fi

printf "   ${C_BRIGHT_GREEN}🛡️${C_RESET}  ${C_BOLD}Secret scanning enabled${C_RESET} — ${C_DIM}commits with leaked secrets will be blocked${C_RESET}\n"

# 4. Skills — skip on init, /caw-setup will populate based on detected stack
#
# Skills are NOT copied at init time. They are pulled by /caw-setup after init
# (init already ships a harness CLAUDE.md; the user may still run /init to enrich it).
#
# init time: skip skills entirely
# /caw-setup: detect stack, copy caw-curated skills from <CAW_HOME>/template/skills/,
#             ask user before pulling hub skills

# 4b. Rules — load based on detected tech stack
# Note: project-specific rules (.claude/rules/project.md) are generated by
# /caw-setup after stack detection, not copied here.
echo ""
printf "${C_MAGENTA}📏${C_RESET} ${C_BOLD}Copying${C_RESET} ${C_DIM}rules...${C_RESET}\n"
mkdir -p "$PROJECT_PATH/.claude/rules"

# common/ — always
copy_rule_directory "common"

# typescript/ — all non-Python projects
if [[ "$FRAMEWORK" != "fastapi" ]]; then
  copy_rule_directory "typescript"
fi

# react/ — only when the detected frontend stack uses React
if [[ "$DETECTED_FRONTEND_STACK" == *"React"* ]]; then
  copy_rule_directory "react"
fi

# 5. Agents — 5 generic agents (setup, planner, coder, tester, reviewer)
# Domain knowledge lives in skills (loaded via Skill tool) — agents are workflow primitives.
# TEAM_TYPE doesn't change agent set; all projects get the same 5 agents.
# CAW_AGENTS is defined in cli/defs.sh (sourced at top).
for agent in $CAW_AGENTS; do
  SRC="$REPO_ROOT/template/agents/$agent.md"
  DEST="$PROJECT_PATH/.claude/agents/$agent.md"
  if [[ -f "$SRC" ]]; then
    if [[ ! -f "$DEST" ]]; then
      cp "$SRC" "$DEST"
      echo "   ✅ .claude/agents/$agent.md"
    else
      echo "   ⏭️  .claude/agents/$agent.md (already exists)"
    fi
  else
    echo "   ⚠️  Agent template not found: $agent.md"
  fi
done

# 6. Security advisories
echo ""
printf "${C_RED}🔒${C_RESET} ${C_BOLD}Copying${C_RESET} ${C_DIM}security advisories...${C_RESET}\n"
ADVISORIES_SRC="$TEMPLATE_DIR/advisories"
ADVISORIES_DEST="$PROJECT_PATH/docs/caw/advisories"
if [[ -d "$ADVISORIES_SRC" ]]; then
  mkdir -p "$ADVISORIES_DEST"
  # Always overwrite advisories — they are authoritative from template hub
  cp -r "$ADVISORIES_SRC/." "$ADVISORIES_DEST/"
  echo "   ✅ docs/caw/advisories/ ($(ls "$ADVISORIES_SRC"/*.md 2>/dev/null | wc -l | tr -d ' ') files)"
fi

# 7. README
echo ""
printf "${C_BLUE}📖${C_RESET} ${C_BOLD}Copying${C_RESET} ${C_DIM}README...${C_RESET}\n"
if [[ -f "$REPO_ROOT/README.md" ]]; then
  cp "$REPO_ROOT/README.md" "$PROJECT_PATH/.claude/README.md"
  echo "   ✅ .claude/README.md (claude agent workflow usage reference)"
fi

# 8. Cross-IDE AI rules (AGENTS.md)
# Targets: VS Code Copilot, Cursor AI, OpenAI Codex CLI, Google Antigravity.
echo ""
printf "${C_BRIGHT_CYAN}📝${C_RESET} ${C_BOLD}Setting up${C_RESET} ${C_DIM}cross-IDE AI rules (VS Code, Cursor, Codex, Antigravity)...${C_RESET}\n"

# AGENTS.md (cross-tool: Codex CLI, Antigravity, other AGENTS.md consumers)
AGENTS_SRC="$TEMPLATE_DIR/AGENTS.md"
AGENTS_DEST="$PROJECT_PATH/AGENTS.md"
if [[ -f "$AGENTS_SRC" ]]; then
  if [[ ! -f "$AGENTS_DEST" ]]; then
    cp "$AGENTS_SRC" "$AGENTS_DEST"
    perl -i -pe "s/\{\{PROJECT_NAME\}\}/$ESCAPED_PROJECT_NAME/g;" "$AGENTS_DEST"
    echo "   ✅ AGENTS.md ${C_DIM}(Codex CLI + Antigravity + cross-tool)${C_RESET}"
  else
    echo "   ⏭️  AGENTS.md (already exists, kept)"
  fi
fi

# CLAUDE.md (Claude Code: @-imports AGENTS.md + harness context at load time).
# Skip if the project already has one — users may have run /init or hand-written it.
CLAUDE_SRC="$TEMPLATE_DIR/CLAUDE.md"
CLAUDE_DEST="$PROJECT_PATH/CLAUDE.md"
if [[ -f "$CLAUDE_SRC" ]]; then
  if [[ ! -f "$CLAUDE_DEST" ]]; then
    cp "$CLAUDE_SRC" "$CLAUDE_DEST"
    perl -i -pe "s/\{\{PROJECT_NAME\}\}/$ESCAPED_PROJECT_NAME/g;" "$CLAUDE_DEST"
    echo "   ✅ CLAUDE.md ${C_DIM}(Claude Code harness context)${C_RESET}"
  else
    echo "   ⏭️  CLAUDE.md (already exists, kept)"
  fi
fi

echo ""

# ── Persist caw repo path for agents to read ────────────────────────────────────
# Two persistence layers (both written, agents prefer #1 over #2):
#   1. <project>/.claude/caw.config.json — project-local, no env var dependency
#      (agent reads this directly, no need for CAW_HOME or shell rc)
#   2. CAW_HOME export in shell rc — fallback for CLI use outside Claude Code
#
# The project-local file is the primary mechanism — it survives shell switches,
# works in CI, and doesn't require sourcing rc files. Path is detected here in
# init.sh (which knows REPO_ROOT for sure) and written into the project.

CAW_CONFIG="$PROJECT_PATH/.claude/caw.config.json"
mkdir -p "$(dirname "$CAW_CONFIG")"

# Write project-local config (overwrite — always reflects the current init's repo path)
cat > "$CAW_CONFIG" <<EOF
{
  "caw_home": "$REPO_ROOT",
  "init_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
printf "${C_BRIGHT_GREEN}📍${C_RESET} ${C_BOLD}.claude/caw.config.json${C_RESET} ${C_DIM}(caw_home: $REPO_ROOT)${C_RESET}\n"

# Best-effort shell rc export (idempotent) — used by CLI invocations outside Claude Code
RC_FILE=""
if [[ -n "${ZSH_VERSION:-}" ]] || [[ "${SHELL:-}" == */zsh ]]; then
  RC_FILE="$HOME/.zshrc"
elif [[ -n "${BASH_VERSION:-}" ]] || [[ "${SHELL:-}" == */bash ]]; then
  RC_FILE="$HOME/.bashrc"
fi

if [[ -n "$RC_FILE" ]] && [[ -f "$RC_FILE" ]]; then
  if ! grep -q "^export CAW_HOME=" "$RC_FILE" 2>/dev/null; then
    {
      echo ""
      echo "export CAW_HOME=\"$REPO_ROOT\""
    } >> "$RC_FILE"
    printf "${C_DIM}   + CAW_HOME exported to $RC_FILE${C_RESET}\n"
  fi
fi

# ── Optional: backlog (Astro + React + shadcn UI) ───────────────────────────
# The viewer renders docs/caw/stories/ as a Kanban board served by a
# local Astro dev server. Opt-in because it adds a node_modules folder and is
# only useful for projects that actively use the caw task workflow.
# Installed at the project root (./backlog/) alongside docs/ and scripts/.
BV_SRC="$REPO_ROOT/tools/backlog"
BV_DEST="$PROJECT_PATH/backlog"

if [[ -d "$BV_SRC" ]] && [[ ! -d "$BV_DEST" ]]; then
  echo ""
  printf "${C_BRIGHT_CYAN}📋${C_RESET} ${C_BOLD}Backlog${C_RESET}\n"
  install_bv=true
  if [[ -t 0 ]]; then
    read -r -p "   Do you want to use backlog view? [Y/n]: " bv_answer
    bv_answer="${bv_answer:-Y}"
    [[ ! "$bv_answer" =~ ^[Yy]$ ]] && install_bv=false
  else
    printf "   ${C_DIM}(non-interactive mode: skipping — re-run interactively to opt in)${C_RESET}\n"
    install_bv=false
  fi

  if [[ "$install_bv" == true ]]; then
    mkdir -p "$BV_DEST"
    # rsync would be cleaner but isn't universal — use tar pipe, excluding build artifacts.
    (cd "$BV_SRC" && tar --exclude='node_modules' --exclude='dist' --exclude='.astro' --exclude='.vercel' -cf - .) \
      | (cd "$BV_DEST" && tar -xf -)
    ok "backlog/ (Astro source copied)"

    # Add gitignore entry for node_modules etc. inside backlog/.
    if ! grep -qF "backlog/node_modules" "$GITIGNORE" 2>/dev/null; then
      {
        echo ""
        echo "### Backlog"
        echo "backlog/node_modules/"
        echo "backlog/dist/"
        echo "backlog/.astro/"
        echo "backlog/.vercel/"
      } >> "$GITIGNORE"
      printf "${C_DIM}   + .gitignore: backlog/{node_modules,dist,.astro,.vercel}${C_RESET}\n"
    fi
    printf "   ${C_DIM}To run:  cd backlog && pnpm install \\\&\\\& CAW_PROJECT_ROOT=\"\$PWD/..\" pnpm dev${C_RESET}\n"

    # ── Optional: Vercel deploy of the backlog viewer ─────────────────────────
    # The viewer can also ship as a static snapshot on Vercel — task data is
    # frozen at build time, rebuilt on each git push. Useful when sharing the
    # board with non-dev teammates.
    setup_vercel=false
    if [[ -t 0 ]]; then
      echo ""
      printf "${C_BRIGHT_CYAN}▲${C_RESET} ${C_BOLD}Deploy backlog viewer to Vercel?${C_RESET}\n"
      printf "   ${C_DIM}Creates ./vercel.json at project root. Vercel rebuilds the static${C_RESET}\n"
      printf "   ${C_DIM}snapshot on each push — no auth, public read.${C_RESET}\n"
      read -r -p "   Add Vercel deploy config? [y/N]: " vc_answer
      vc_answer="${vc_answer:-N}"
      [[ "$vc_answer" =~ ^[Yy]$ ]] && setup_vercel=true
    fi

    if [[ "$setup_vercel" == true ]]; then
      VERCEL_JSON="$PROJECT_PATH/vercel.json"
      if [[ -e "$VERCEL_JSON" ]]; then
        skip "vercel.json (already exists at project root, kept)"
      else
        cat > "$VERCEL_JSON" <<'VERCELJSON'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "corepack enable && cd backlog && pnpm install --frozen-lockfile --ignore-scripts && pnpm build:vercel",
  "installCommand": "echo skip-root-install",
  "framework": null
}
VERCELJSON
        ok "vercel.json (Vercel deploy config at project root)"
      fi

      # gitignore the build output that build-vercel.mjs writes to project root.
      if ! grep -qF "^.vercel/$" "$GITIGNORE" 2>/dev/null && ! grep -qE "^\.vercel/?$" "$GITIGNORE" 2>/dev/null; then
        {
          echo ""
          echo "# Vercel build output (generated by backlog/build:vercel)"
          echo ".vercel/"
        } >> "$GITIGNORE"
        printf "${C_DIM}   + .gitignore: .vercel/${C_RESET}\n"
      fi

      echo ""
      printf "   ${C_BOLD}Vercel setup next steps:${C_RESET}\n"
      printf "   ${C_DIM}1.${C_RESET} Push project to GitHub\n"
      printf "   ${C_DIM}2.${C_RESET} New Project on vercel.com → import repo → Root Directory = repo root\n"
      printf "   ${C_DIM}3.${C_RESET} Framework Preset = Other; leave Build/Install/Output blank\n"
      printf "   ${C_DIM}4.${C_RESET} Deploy. ${C_DIM}(vercel.json drives everything.)${C_RESET}\n"
    fi
  else
    skip "backlog/ (skipped — \`caw view\` is opt-in)"
  fi
elif [[ -d "$BV_DEST" ]]; then
  skip "backlog/ (already exists, kept)"
fi

echo ""
printf "${C_BRIGHT_GREEN}${C_BOLD}✨ Done!${C_RESET} ${C_BOLD}Project initialized at:${C_RESET} ${C_BRIGHT_CYAN}%s${C_RESET}\n" "$PROJECT_PATH"
echo ""
printf "${C_BOLD}Next steps:${C_RESET}\n"
printf "  ${C_GREEN}1.${C_RESET} Open Claude Code in: ${C_CYAN}%s${C_RESET}\n" "$PROJECT_PATH"
printf "  ${C_GREEN}2.${C_RESET} Run: ${C_BRIGHT_YELLOW}/caw-setup${C_RESET}    ${C_GRAY}← detects stack, copies skills, writes conventions.md${C_RESET}\n"
printf "  ${C_GREEN}3.${C_RESET} Run: ${C_BRIGHT_YELLOW}/caw-plan \"<feature description>\"${C_RESET}\n"
printf "${C_DIM}  (CLAUDE.md + AGENTS.md harness context already scaffolded. Optionally run ${C_RESET}${C_BRIGHT_YELLOW}/init${C_RESET}${C_DIM} to enrich CLAUDE.md with codebase notes.)${C_RESET}\n"
echo ""
printf "${C_DIM}Workflow: /caw-plan → /caw-code → /caw-test → /caw-review (or /caw-verify for parallel)${C_RESET}\n"
echo ""
