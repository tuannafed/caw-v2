#!/usr/bin/env bash
# Shared definitions sourced by init.sh and sync.sh.
# Single source of truth for the agent + command sets so the two scripts can
# never drift. Add a new agent/command here once; both init and sync pick it up.

# The 5 fixed caw agents (template/agents/<name>.md).
CAW_AGENTS="setup planner coder tester reviewer"

# The 6 caw slash commands (template/commands/caw-<name>.md).
CAW_COMMANDS="caw-setup caw-plan caw-code caw-test caw-review caw-verify"
