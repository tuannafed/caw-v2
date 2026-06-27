#!/usr/bin/env bash
#
# caw status line — surfaces the project's current harness state (source of truth)
# in the Claude Code status bar: the in-progress story, its lane, and counts.
#
# Wire it via .claude/settings.json:
#   "statusLine": { "type": "command",
#     "command": "bash ${CLAUDE_PLUGIN_ROOT}/statusline/caw-statusline.sh" }
#
# Claude Code pipes a JSON blob on stdin (we ignore it) and renders our stdout line.
# Read-only + best-effort: any failure prints nothing (status bar stays clean).
set -uo pipefail

# Resolve the harness CLI: prefer the project wrapper /caw:setup writes (it walks
# up to the project DB), else the plugin binary, else give up silently.
cli=""
if [[ -x scripts/caw/bin/harness-cli ]]; then
  cli="scripts/caw/bin/harness-cli"
elif [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -f "$CLAUDE_PLUGIN_ROOT/harness/bin/harness-cli" ]]; then
  cli="python3 $CLAUDE_PLUGIN_ROOT/harness/bin/harness-cli"
fi
[[ -z "$cli" ]] && exit 0

json="$($cli query story --json 2>/dev/null)" || exit 0
[[ -z "$json" || "$json" == "[]" ]] && exit 0

# Pick the in-progress story (else the most recently relevant) and summarize.
printf '%s' "$json" | python3 -c '
import json, sys
try:
    rows = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if not rows:
    sys.exit(0)
inprog = [r for r in rows if r.get("status") == "in_progress"]
cur = inprog[0] if inprog else None
done = sum(1 for r in rows if r.get("status") in ("implemented", "retired"))
total = len(rows)
if cur:
    sid = cur.get("id", "?")
    lane = cur.get("risk_lane", "?")
    print(f"caw  ▶ {sid}  ·  lane:{lane}  ·  {done}/{total} done")
else:
    print(f"caw  ·  {done}/{total} stories done  ·  none in progress")
' 2>/dev/null || exit 0
