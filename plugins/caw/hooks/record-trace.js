#!/usr/bin/env node
/**
 * Stop hook — mechanically record an execution `trace` row when the session
 * ends, so the observability/evolution layer (audit / propose / maturity) has
 * data without depending on an agent remembering to call `harness-cli trace`.
 *
 * It records ONLY when there is real signal, to avoid polluting the trace table
 * on chat/no-op sessions:
 *   - the project harness CLI wrapper exists and runs, AND
 *   - some story is `in_progress`, AND
 *   - files changed in the working tree this session.
 * Otherwise it is a silent no-op.
 *
 * The trace it writes is intentionally coarse (outcome=completed, the changed
 * file list, a derived summary, agent=stop-hook). Agents that call `trace`
 * themselves still write richer rows — both coexist.
 *
 * Gated by CAW_HOOK_PROFILE via run-with-flags.js (standard,strict).
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  try { recordTrace(); } catch { /* never block the Stop pipeline */ }
  process.stdout.write(raw);
});

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function harnessCli() {
  // Prefer the project wrapper /caw:setup writes; it resolves the plugin binary
  // and points the DB at the project root.
  const wrapper = 'scripts/caw/bin/harness-cli';
  if (fs.existsSync(wrapper)) return `"${wrapper}"`;
  // Fallback: the plugin binary directly (DB still resolves to CWD).
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && fs.existsSync(`${root}/harness/bin/harness-cli`)) {
    return `python3 "${root}/harness/bin/harness-cli"`;
  }
  return null;
}

function recordTrace() {
  const cli = harnessCli();
  if (!cli) return;                       // no harness → nothing to record into

  // 1. Is a story in progress? (no DB / no rows / parse error → no-op)
  let stories;
  try {
    stories = JSON.parse(sh(`${cli} query story --json`) || '[]');
  } catch { return; }
  if (!Array.isArray(stories) || stories.length === 0) return;
  const active = stories.find(s => s && s.status === 'in_progress');
  if (!active) return;                    // nothing actively being worked → skip

  // 2. What changed this session? Exclude harness internals (DB + the wrapper)
  //    and any path with a comma (the CLI splits --files-changed on commas).
  let changed = [];
  try {
    const out = [
      sh('git diff --cached --name-only'),
      sh('git diff --name-only'),
      sh('git ls-files --others --exclude-standard'),
    ].filter(Boolean).join('\n');
    changed = [...new Set(out.split('\n').filter(Boolean))]
      .filter(f => f !== 'harness.db' && !f.startsWith('scripts/caw/') && !f.includes(','));
  } catch { /* not a git repo → leave empty */ }
  if (changed.length === 0) return;       // no file signal → don't record a trace

  // 3. Record one coarse trace. --files-changed is a comma-separated list (the
  //    CLI re-serializes it to a JSON array), so join with commas, not JSON.
  const summary = `session edits on ${active.id}: ${changed.length} file(s) changed`;
  const args = [
    `--summary ${shq(summary)}`,
    `--outcome completed`,
    `--story-id ${shq(active.id)}`,
    `--agent stop-hook`,
    `--files-changed ${shq(changed.join(','))}`,
  ].join(' ');

  try {
    sh(`${cli} trace ${args}`);
    console.error(`[caw] trace recorded for ${active.id} (${changed.length} files)`);
  } catch { /* trace is best-effort; never fail the Stop hook */ }
}

// POSIX single-quote shell-escape.
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
