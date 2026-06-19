#!/usr/bin/env bash
set -euo pipefail

# caw.sh — Claude Agent Workflow CLI
#
# Project management:
#   caw init <path>                          → scaffold core (stack auto-detected)
#   caw sync <path> [--type <type>] [--dry-run]
#   caw remove <path> [--keep-tasks] [--dry-run]

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Subcommands ───────────────────────────────────────────────────────────────

SUBCOMMAND="${1:-}"
shift || true

case "$SUBCOMMAND" in

  --version|-v|version)
    VERSION_FILE="$(dirname "$SCRIPTS_DIR")/VERSION"
    if [[ -f "$VERSION_FILE" ]]; then
      echo "caw $(cat "$VERSION_FILE")"
    else
      echo "caw (version unknown — VERSION file missing)"
    fi
    exit 0
    ;;

  init)
    exec bash "$SCRIPTS_DIR/init.sh" "$@"
    ;;

  sync)
    exec bash "$SCRIPTS_DIR/sync.sh" "$@"
    ;;

  remove)
    exec bash "$SCRIPTS_DIR/remove.sh" "$@"
    ;;

  help|-h|--help|"")
    echo ""
    echo "caw — Claude Agent Workflow"
    echo ""
    echo "Usage:"
    echo "  caw init <path>                       (stack auto-detected)"
    echo "  caw sync <path> [--type <type>] [--dry-run]"
    echo "  caw remove <path> [--keep-tasks] [--dry-run]"
    echo ""
    echo "Examples:"
    echo "  caw init ~/Projects/my-app"
    echo "  caw sync ~/Projects/my-app --dry-run"
    echo "  caw remove ~/Projects/my-app --keep-tasks"
    echo ""
    echo "Backlog (opt-in during 'caw init'):"
    echo "  cd <project>/backlog"
    echo "  pnpm install && CAW_PROJECT_ROOT=\"\$(pwd)/..\" pnpm dev"
    echo ""
    echo "Workflow commands (use inside Claude Code):"
    echo "  /caw-setup                       Detect stack, install skills, write conventions"
    echo "  /caw-plan \"<description>\"        Spec + API contract + phases + challenge"
    echo "  /caw-code <task-id> [<phase>]    Implement one phase (--all for every phase)"
    echo "  /caw-test <task-id>              Tests (mode derived from Plan's lane)"
    echo "  /caw-review <task-id>            Multi-dim review (security/perf/a11y)"
    echo "  /caw-verify <task-id>            Test + review parallel"
    echo ""
    ;;

  *)
    echo "Unknown subcommand: $SUBCOMMAND"
    echo "Run 'caw help' for usage."
    exit 1
    ;;
esac
