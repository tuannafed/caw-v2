#!/usr/bin/env bash
set -euo pipefail

# setup.sh — Install caw (Claude Agent Workflow) globally
#
# Adds shell aliases so you can run from any directory:
#   caw init    <path>                  → scaffold new project (stack auto-detected)
#   caw sync <path> [--type <type>] [--dry-run] → sync latest templates
#   caw remove  <path> [--keep-tasks] [--dry-run]  → remove from project
#
# Usage:
#   ./setup.sh              → install
#   ./setup.sh --uninstall  → remove aliases

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$REPO_DIR/cli"

MARKER_START="# >>> claude-agent-team >>>"
MARKER_END="# <<< claude-agent-team <<<"

# ── Detect shell config file ──────────────────────────────────────────────────
detect_shell_rc() {
  if [[ -n "${ZDOTDIR:-}" ]] && [[ -f "$ZDOTDIR/.zshrc" ]]; then
    echo "$ZDOTDIR/.zshrc"
  elif [[ -f "$HOME/.zshrc" ]]; then
    echo "$HOME/.zshrc"
  elif [[ -f "$HOME/.bashrc" ]]; then
    echo "$HOME/.bashrc"
  elif [[ -f "$HOME/.bash_profile" ]]; then
    echo "$HOME/.bash_profile"
  else
    echo "$HOME/.profile"
  fi
}

# ── Uninstall ─────────────────────────────────────────────────────────────────
uninstall() {
  local rc_file
  rc_file="$(detect_shell_rc)"

  if ! grep -q "$MARKER_START" "$rc_file" 2>/dev/null; then
    echo "ℹ️  claude-agent-team is not installed in $rc_file"
    exit 0
  fi

  # Remove lines between markers (inclusive)
  local tmp
  tmp="$(mktemp)"
  awk "/$MARKER_START/{found=1} !found{print} /$MARKER_END/{found=0}" "$rc_file" > "$tmp"
  mv "$tmp" "$rc_file"

  echo "✅ Uninstalled from $rc_file"
  echo "   Run: source $rc_file"
}

# ── Inject Behavioral Guidelines into ~/.claude/CLAUDE.md ────────────────────
setup_global_claude_md() {
  local claude_md="$HOME/.claude/CLAUDE.md"
  local marker="<!-- caw:behavioral-guidelines -->"

  # Already injected — skip
  if grep -q "$marker" "$claude_md" 2>/dev/null; then
    echo "   ⏭️  ~/.claude/CLAUDE.md (behavioral guidelines already present)"
    return
  fi

  mkdir -p "$HOME/.claude"

  cat >> "$claude_md" <<'GUIDELINES'

<!-- caw:behavioral-guidelines -->
## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
GUIDELINES

  echo "   ✅ ~/.claude/CLAUDE.md (behavioral guidelines added)"
}

# ── Install ───────────────────────────────────────────────────────────────────
install() {
  local rc_file
  rc_file="$(detect_shell_rc)"

  echo "🚀 Installing claude-agent-team"
  echo "   Repo: $REPO_DIR"
  echo "   Shell config: $rc_file"
  echo ""

  # Check if already installed
  if grep -q "$MARKER_START" "$rc_file" 2>/dev/null; then
    echo "⚠️  Already installed in $rc_file"
    echo ""
    setup_global_claude_md
    echo ""
    echo "To reinstall: ./setup.sh --uninstall && ./setup.sh"
    echo "To remove:    ./setup.sh --uninstall"
    exit 0
  fi

  # Make scripts executable
  chmod +x "$SCRIPTS_DIR/init.sh"
  chmod +x "$SCRIPTS_DIR/remove.sh"
  chmod +x "$SCRIPTS_DIR/sync.sh"
  chmod +x "$SCRIPTS_DIR/caw.sh"

  # Append block to shell rc
  cat >> "$rc_file" <<EOF

$MARKER_START
# claude-agent-team — AI agent workflow framework
export CAW_HOME="$REPO_DIR"

# caw (Claude Agent Workflow) — unified CLI
alias caw="$SCRIPTS_DIR/caw.sh"
$MARKER_END
EOF

  echo "✅ Installed! Alias added to $rc_file"
  echo ""

  # Inject behavioral guidelines into ~/.claude/CLAUDE.md
  setup_global_claude_md

  echo ""
  echo "Commands:"
  echo "  caw init    <path>                     — scaffold claude agent workflow into existing project"
  echo "  caw sync <path> [--dry-run]            — sync latest templates"
  echo "  caw remove  <path> [--keep-tasks]     — remove claude agent workflow files"
  echo ""
  echo "Reload your shell:"
  echo "  source $rc_file"
}

# ── Main ──────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --uninstall|-u) uninstall ;;
  --help|-h)
    echo "Usage: ./setup.sh [--uninstall]"
    echo ""
    echo "  ./setup.sh             Install caw alias globally"
    echo "  ./setup.sh --uninstall Remove alias"
    echo ""
    echo "After install:"
    echo "  caw init    <path>              Scaffold claude agent workflow into existing project"
    echo "  caw sync <path> [--dry-run]  Sync latest templates"
    echo "  caw remove  <path>              Remove claude agent workflow from project"
    ;;
  "") install ;;
  *) echo "Unknown option: $1"; echo "Usage: ./setup.sh [--uninstall]"; exit 1 ;;
esac
