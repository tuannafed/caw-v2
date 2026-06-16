#!/usr/bin/env bash
set -euo pipefail

# Usage: ./remove.sh [<project-path>] [--keep-tasks] [--dry-run]
# Removes claude agent workflow files from a project.
#
# What gets removed:
#   docs/caw/                 — conventions.md, knowledge.md, backlog.md, adr.md, intake.md,
#                                task-test-matrix.md, test-matrix.md, harness-backlog.md,
#                                decisions/ (and tasks/ unless --keep-tasks)
#   .claude/commands/         — caw-*.md (caw-setup, caw-plan, caw-code,
#                                caw-test, caw-review, caw-verify, caw-status)
#                                + legacy: caw.md, checkpoint.md, learn.md, create.md
#   .claude/agents/           — all agent .md files
#   .claude/skills/           — skill symlinks (created by /caw-setup)
#   .agents/                  — real skill folders (caw-owned + hub)
#   .claude/rules/            — all rule files
#   .claude/hooks/            — hook scripts + lib/
#   .claude/advisories/       — security advisory files
#   .claude/README.md         — claude agent workflow usage reference
#   .claude/settings.json     — hooks config
#   .claude/caw.config.json   — caw home pointer
#   .claude/skill-map.yaml    — stack→skill map (from /caw-setup)
#   skills-lock.json          — npx-skills CLI lockfile at project root (if caw added skills)
#   .claude/gitleaks.toml     — secret-scan config
#   .github/PULL_REQUEST_TEMPLATE.md — PR template
#   .claudeignore             — caw-owned (init only creates it when absent)
#   commitlint.config.cjs     — caw-owned commit-lint config
#   AGENTS.md                 — Codex CLI + Antigravity cross-tool rules
#   .cursorrules              — Cursor AI rules
#   .github/copilot-instructions.md — GitHub Copilot rules
#   CLAUDE.md                 — project context file (prompts for confirmation)
#   backlog/                  — Astro UI source (prompts for confirmation)
#
# Also reverted (marker/line-scoped, only the caw-written parts):
#   .gitignore                — the "# >>> caw ... <<<" block added by init
#   ~/.zshrc or ~/.bashrc     — the "export CAW_HOME=..." line added by init
#   .husky/ or .git/hooks/ pre-commit — the gitleaks block (whole hook if caw-only)
#   .vscode/settings.json     — removed only if caw is its sole author
#
# What is NEVER removed:
#   .claude/ itself (may contain user's own files)
#   Any source code files (src/, app/, etc.)
#
# Flags:
#   --keep-tasks   Keep docs/caw/stories/ (preserve story history)
#   --dry-run       Show what would be removed without deleting anything

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
PROJECT_PATH=""
KEEP_TASKS=false
DRY_RUN=false

# ── Parse arguments ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --keep-tasks) KEEP_TASKS=true; shift ;;
    --dry-run)     DRY_RUN=true; shift ;;
    -*) echo "Unknown flag: $1"; echo "Usage: $SCRIPT_NAME [<project-path>] [--keep-tasks] [--dry-run]"; exit 1 ;;
    *) PROJECT_PATH="$1"; shift ;;
  esac
done

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Claude Agent Workflow (caw) — Remove from Project ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Project path ──────────────────────────────────────────────────────────────
# Walk up from cwd looking for a directory containing .claude/ — lets the
# user invoke `caw remove` from a nested subfolder (e.g. backlog/).
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

# Expand ~
PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "Error: Directory not found: $PROJECT_PATH"
  exit 1
fi

PROJECT_NAME="$(basename "$PROJECT_PATH")"

echo "  Project : $PROJECT_NAME"
echo "  Path    : $PROJECT_PATH"
[[ "$KEEP_TASKS" == true ]] && echo "  Mode    : keep task history"
[[ "$DRY_RUN" == true ]]     && echo "  Mode    : dry-run (no files deleted)"
echo ""

# ── Build removal list ─────────────────────────────────────────────────────────
DOTCLAUDE="$PROJECT_PATH/.claude"
# caw v2 layout: conductor/advisories under docs/, durable layer + db at root
CONDUCTOR_DIR="$PROJECT_PATH/docs/caw"
ADVISORIES_DIR="$PROJECT_PATH/docs/advisories"
SCRIPTS_DIR_PROJ="$PROJECT_PATH/scripts"

declare -a TO_REMOVE=()
declare -a TO_REMOVE_LABELS=()

# docs/caw/ (entire dir, or just excluding tasks/)
if [[ -d "$CONDUCTOR_DIR" ]]; then
  if [[ "$KEEP_TASKS" == true ]]; then
    # Remove individual files but keep tasks/
    for f in conventions.md knowledge.md backlog.md checkpoints.log \
             adr.md intake.md task-test-matrix.md test-matrix.md harness-backlog.md; do
      fp="$CONDUCTOR_DIR/$f"
      if [[ -f "$fp" ]]; then
        TO_REMOVE+=("$fp")
        TO_REMOVE_LABELS+=("docs/caw/$f")
      fi
    done
    # `templates` is legacy — older installs nested templates under conductor/
    for d in decisions templates; do
      dp="$CONDUCTOR_DIR/$d"
      if [[ -d "$dp" ]]; then
        TO_REMOVE+=("$dp")
        TO_REMOVE_LABELS+=("docs/caw/$d/")
      fi
    done
  else
    TO_REMOVE+=("$CONDUCTOR_DIR")
    TO_REMOVE_LABELS+=("docs/caw/")
  fi
fi

# .claude/commands/ — only remove claude agent workflow commands, not user's own commands
# Match caw-*.md (caw-setup, caw-plan, caw-code, caw-test, caw-review, caw-verify, caw-status)
# plus legacy single-word names (caw, checkpoint, learn, create) for back-compat.
if [[ -d "$DOTCLAUDE/commands" ]]; then
  while IFS= read -r -d '' f; do
    rel=".claude/commands/$(basename "$f")"
    TO_REMOVE+=("$f")
    TO_REMOVE_LABELS+=("$rel")
  done < <(find "$DOTCLAUDE/commands" -maxdepth 1 -name "caw-*.md" -print0 2>/dev/null)
fi
for cmd in caw checkpoint learn create; do
  fp="$DOTCLAUDE/commands/$cmd.md"
  if [[ -f "$fp" ]]; then
    TO_REMOVE+=("$fp")
    TO_REMOVE_LABELS+=(".claude/commands/$cmd.md")
  fi
done

# .claude/caw.config.json — caw home pointer written by init
if [[ -f "$DOTCLAUDE/caw.config.json" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/caw.config.json")
  TO_REMOVE_LABELS+=(".claude/caw.config.json")
fi

# .claude/skill-map.yaml — caw's record of installed skills (written by /caw-setup)
if [[ -f "$DOTCLAUDE/skill-map.yaml" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/skill-map.yaml")
  TO_REMOVE_LABELS+=(".claude/skill-map.yaml")
fi

# skills-lock.json — written at the project root by the `npx skills` CLI when
# /caw-setup installs hub skills. Remove only when caw also created `.agents/`
# (i.e. caw is what brought skills into this project).
if [[ -f "$PROJECT_PATH/skills-lock.json" ]] && [[ -d "$PROJECT_PATH/.agents" ]]; then
  TO_REMOVE+=("$PROJECT_PATH/skills-lock.json")
  TO_REMOVE_LABELS+=("skills-lock.json")
fi

# .claude/gitleaks.toml — secret-scan config written by init
if [[ -f "$DOTCLAUDE/gitleaks.toml" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/gitleaks.toml")
  TO_REMOVE_LABELS+=(".claude/gitleaks.toml")
fi

# .claude/agents/ — only .md files (agent definitions)
if [[ -d "$DOTCLAUDE/agents" ]]; then
  while IFS= read -r -d '' f; do
    rel=".claude/agents/$(basename "$f")"
    TO_REMOVE+=("$f")
    TO_REMOVE_LABELS+=("$rel")
  done < <(find "$DOTCLAUDE/agents" -maxdepth 1 -name "*.md" -print0 2>/dev/null)
fi

# .claude/skills/ — symlinks into .agents/skills/ (created by /caw-setup)
if [[ -d "$DOTCLAUDE/skills" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/skills")
  TO_REMOVE_LABELS+=(".claude/skills/")
fi

# .agents/skills/ — real skill folders (caw-owned + hub, installed by /caw-setup)
if [[ -d "$PROJECT_PATH/.agents" ]]; then
  TO_REMOVE+=("$PROJECT_PATH/.agents")
  TO_REMOVE_LABELS+=(".agents/")
fi

# .claude/rules/ — entire directory
if [[ -d "$DOTCLAUDE/rules" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/rules")
  TO_REMOVE_LABELS+=(".claude/rules/")
fi

# .claude/hooks/ — entire directory
if [[ -d "$DOTCLAUDE/hooks" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/hooks")
  TO_REMOVE_LABELS+=(".claude/hooks/")
fi

# docs/advisories/ — entire directory
if [[ -d "$ADVISORIES_DIR" ]]; then
  TO_REMOVE+=("$ADVISORIES_DIR")
  TO_REMOVE_LABELS+=("docs/advisories/")
fi

# Durable layer under scripts/caw/ (caw-owned only — never the whole scripts/).
for sub in bin/harness-cli harness schema; do
  if [[ -e "$SCRIPTS_DIR_PROJ/caw/$sub" ]]; then
    TO_REMOVE+=("$SCRIPTS_DIR_PROJ/caw/$sub")
    TO_REMOVE_LABELS+=("scripts/caw/$sub")
  fi
done
for db in harness.db harness.db-wal harness.db-shm; do
  if [[ -f "$PROJECT_PATH/$db" ]]; then
    TO_REMOVE+=("$PROJECT_PATH/$db")
    TO_REMOVE_LABELS+=("$db")
  fi
done

# .claude/README.md
if [[ -f "$DOTCLAUDE/README.md" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/README.md")
  TO_REMOVE_LABELS+=(".claude/README.md")
fi

# .claude/settings.json — hooks config
if [[ -f "$DOTCLAUDE/settings.json" ]]; then
  TO_REMOVE+=("$DOTCLAUDE/settings.json")
  TO_REMOVE_LABELS+=(".claude/settings.json")
fi

# .github/PULL_REQUEST_TEMPLATE.md
if [[ -f "$PROJECT_PATH/.github/PULL_REQUEST_TEMPLATE.md" ]]; then
  TO_REMOVE+=("$PROJECT_PATH/.github/PULL_REQUEST_TEMPLATE.md")
  TO_REMOVE_LABELS+=(".github/PULL_REQUEST_TEMPLATE.md")
fi

# Caw-owned cross-IDE / tooling files at project root (init copies these only
# when absent, never overwriting user files — so removing them is symmetric).
for rel in .claudeignore commitlint.config.cjs AGENTS.md .cursorrules \
           .github/copilot-instructions.md; do
  if [[ -f "$PROJECT_PATH/$rel" ]]; then
    TO_REMOVE+=("$PROJECT_PATH/$rel")
    TO_REMOVE_LABELS+=("$rel")
  fi
done

# ── Preview ────────────────────────────────────────────────────────────────────
if [[ ${#TO_REMOVE[@]} -eq 0 ]] && [[ ! -f "$PROJECT_PATH/CLAUDE.md" ]]; then
  echo "ℹ️  No claude agent workflow files found in: $PROJECT_PATH"
  echo "   (Nothing to remove)"
  exit 0
fi

echo "The following will be removed:"
echo ""
for label in "${TO_REMOVE_LABELS[@]}"; do
  echo "   🗑️  $label"
done

# Handle CLAUDE.md separately — ask user (skip prompt in dry-run)
REMOVE_CLAUDE_MD=false
if [[ -f "$PROJECT_PATH/CLAUDE.md" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   🗑️  CLAUDE.md (would prompt)"
  else
    echo ""
    printf "   Remove CLAUDE.md? (may contain your customizations) [y/N]: "
    read -r ans
    [[ "$ans" =~ ^[Yy]$ ]] && REMOVE_CLAUDE_MD=true
  fi
fi

# Handle backlog/ separately — ask user (skip prompt in dry-run)
# Confirm because it may contain user customizations + node_modules (slow rm).
REMOVE_BACKLOG_VIEWER=false
if [[ -d "$PROJECT_PATH/backlog" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "   🗑️  backlog/ (would prompt)"
  else
    echo ""
    printf "   Remove backlog/? (Astro UI + node_modules) [y/N]: "
    read -r ans
    [[ "$ans" =~ ^[Yy]$ ]] && REMOVE_BACKLOG_VIEWER=true
  fi
fi

echo ""

# ── Dry run output ─────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
  echo "🔍 Dry run — no files were deleted."
  exit 0
fi

# ── Confirm ────────────────────────────────────────────────────────────────────
printf "Proceed with removal? [y/N]: "
read -r confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo ""
echo "🗑️  Removing claude agent workflow files..."
echo ""

# ── Execute removal ────────────────────────────────────────────────────────────
REMOVED=0
FAILED=0

for i in "${!TO_REMOVE[@]}"; do
  target="${TO_REMOVE[$i]}"
  label="${TO_REMOVE_LABELS[$i]}"

  if [[ -d "$target" ]]; then
    if rm -rf "$target"; then echo "   ✅ $label"; REMOVED=$((REMOVED+1)); else echo "   ❌ Failed: $label"; FAILED=$((FAILED+1)); fi
  elif [[ -f "$target" ]]; then
    if rm -f "$target"; then echo "   ✅ $label"; REMOVED=$((REMOVED+1)); else echo "   ❌ Failed: $label"; FAILED=$((FAILED+1)); fi
  fi
done

# Remove CLAUDE.md if confirmed
if [[ "$REMOVE_CLAUDE_MD" == true ]]; then
  if rm -f "$PROJECT_PATH/CLAUDE.md"; then echo "   ✅ CLAUDE.md"; REMOVED=$((REMOVED+1)); else echo "   ❌ Failed: CLAUDE.md"; FAILED=$((FAILED+1)); fi
fi

# Remove backlog/ if confirmed
if [[ "$REMOVE_BACKLOG_VIEWER" == true ]]; then
  if rm -rf "$PROJECT_PATH/backlog"; then
    echo "   ✅ backlog/"
    REMOVED=$((REMOVED+1))
  else
    echo "   ❌ Failed: backlog/"
    FAILED=$((FAILED+1))
  fi
fi

# Clean up empty caw dirs — subdirs first, then .claude/ itself if nothing
# else lives there (a user with their own .claude/ files keeps the dir).
for dir in "$DOTCLAUDE/commands" "$DOTCLAUDE/agents" "$CONDUCTOR_DIR" \
           "$DOTCLAUDE/skills" "$SCRIPTS_DIR_PROJ/caw/bin" "$SCRIPTS_DIR_PROJ/caw"; do
  if [[ -d "$dir" ]] && [[ -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
    rmdir "$dir" && echo "   ✅ ${dir#"$PROJECT_PATH"/} (empty, removed)"
  fi
done
if [[ -d "$DOTCLAUDE" ]] && [[ -z "$(ls -A "$DOTCLAUDE" 2>/dev/null)" ]]; then
  rmdir "$DOTCLAUDE" && echo "   ✅ .claude/ (empty, removed)"
fi
# Drop .github/ if caw emptied it
if [[ -d "$PROJECT_PATH/.github" ]] && [[ -z "$(ls -A "$PROJECT_PATH/.github" 2>/dev/null)" ]]; then
  rmdir "$PROJECT_PATH/.github" && echo "   ✅ .github/ (empty, removed)"
fi

# Remove the caw block from the project .gitignore (marker-delimited, written by init)
GITIGNORE="$PROJECT_PATH/.gitignore"
if [[ -f "$GITIGNORE" ]] && grep -qF "# >>> caw (claude-agent-team) >>>" "$GITIGNORE"; then
  tmp_gi="$(mktemp)"
  # Delete the marker block (inclusive), then collapse any doubled blank lines.
  sed '/^# >>> caw (claude-agent-team) >>>$/,/^# <<< caw (claude-agent-team) <<<$/d' "$GITIGNORE" \
    | awk 'NF{blank=0} !NF{blank++} blank<2' > "$tmp_gi"
  mv "$tmp_gi" "$GITIGNORE"
  echo "   ✅ .gitignore (caw block removed)"
fi

# Remove the CAW_HOME export from the user's shell rc (written by init)
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  if [[ -f "$rc" ]] && grep -q "^export CAW_HOME=" "$rc"; then
    tmp_rc="$(mktemp)"
    grep -v "^export CAW_HOME=" "$rc" > "$tmp_rc" && mv "$tmp_rc" "$rc"
    echo "   ✅ $(basename "$rc") (CAW_HOME export removed)"
  fi
done

# Strip the caw gitleaks block from the pre-commit hook (marker-delimited).
# init appends it to .husky/pre-commit, or writes a standalone .git/hooks/pre-commit.
for hook in "$PROJECT_PATH/.husky/pre-commit" "$PROJECT_PATH/.git/hooks/pre-commit"; do
  [[ -f "$hook" ]] || continue
  grep -q "# claude-agent-team:gitleaks-start" "$hook" || continue
  # Count non-blank lines outside the caw block — if none, the hook is caw-only.
  # `|| true` keeps `set -e` happy when grep finds no remaining lines.
  other="$(sed '/# claude-agent-team:gitleaks-start/,/# claude-agent-team:gitleaks-end/d' "$hook" \
            | { grep -vEc '^\s*$|^#!|^set -e$' || true; })"
  rel="${hook#"$PROJECT_PATH"/}"
  if [[ "$other" -eq 0 ]]; then
    rm -f "$hook" && echo "   ✅ $rel (caw-only hook removed)"
  else
    tmp_h="$(mktemp)"
    sed '/# claude-agent-team:gitleaks-start/,/# claude-agent-team:gitleaks-end/d' "$hook" \
      | awk 'NF{blank=0} !NF{blank++} blank<2' > "$tmp_h"
    mv "$tmp_h" "$hook" && chmod +x "$hook"
    echo "   ✅ $rel (caw gitleaks block removed, user hook kept)"
  fi
done

# Remove .vscode/settings.json only if it is the caw-generated one.
# caw's file contains exclusively `github.copilot.chat.*` top-level keys
# (2-space indent). If any other top-level key exists, the user has edited it —
# leave it and hint at manual cleanup.
VSCODE_SETTINGS="$PROJECT_PATH/.vscode/settings.json"
if [[ -f "$VSCODE_SETTINGS" ]] && grep -q "github.copilot.chat.commitMessageGeneration" "$VSCODE_SETTINGS"; then
  foreign="$({ grep -E '^  "' "$VSCODE_SETTINGS" | grep -vc '^  "github\.copilot\.chat\.' || true; })"
  [[ -n "$foreign" ]] || foreign=0
  if [[ "$foreign" -eq 0 ]]; then
    rm -f "$VSCODE_SETTINGS" && echo "   ✅ .vscode/settings.json (caw-generated, removed)"
    rmdir "$PROJECT_PATH/.vscode" 2>/dev/null && echo "   ✅ .vscode/ (empty, removed)" || true
  else
    echo "   ⏭️  .vscode/settings.json (has user keys — remove the Copilot block manually)"
  fi
fi

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "✨ Done! Removed $REMOVED item(s) from: $PROJECT_PATH"
  [[ "$KEEP_TASKS" == true ]] && echo "   Story history preserved in: docs/caw/stories/"
else
  echo "⚠️  Completed with $FAILED error(s). $REMOVED item(s) removed."
fi
echo ""
