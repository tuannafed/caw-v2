#!/usr/bin/env node
/**
 * PreToolUse hook — warn (never block) when an agent edits code while a story is
 * `in_progress` but hasn't read task state this session.
 *
 * The harness only cures "agent forgot the task" if agents actually pull state
 * before acting. The prompts tell them to; this hook surfaces the miss when they
 * don't, mechanically, instead of trusting discipline.
 *
 * Two roles, dispatched on tool_name:
 *   - Bash: if the command runs `harness-cli query ...`, mark this session as
 *     "task state read" (a session-scoped flag file).
 *   - Edit/Write: if a story is `in_progress` AND the flag is absent, print a
 *     warning to stderr. It does NOT block — editing docs/config mid-task is
 *     legitimate, so a hard block would false-fire.
 *
 * Gated to the `strict` profile via run-with-flags.js (opt-in; noisy otherwise).
 * Never alters the tool call — always passes stdin through untouched.
 */
'use strict';

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  try { gate(raw); } catch { /* never break the PreToolUse pipeline */ }
  process.stdout.write(raw);
});

function flagFile() {
  const seed = process.env.CLAUDE_SESSION_ID ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const id = seed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `caw-task-read-${id}`);
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function harnessCli() {
  if (fs.existsSync('scripts/caw/bin/harness-cli')) return '"scripts/caw/bin/harness-cli"';
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && fs.existsSync(`${root}/harness/bin/harness-cli`)) {
    return `python3 "${root}/harness/bin/harness-cli"`;
  }
  return null;
}

function gate(raw) {
  let payload = {};
  try { payload = JSON.parse(raw); } catch { return; }
  const tool = payload.tool_name || '';
  const input = payload.tool_input || {};

  // Role 1 — Bash: detect a task-state read and set the session flag.
  if (tool === 'Bash') {
    const cmd = String(input.command || '');
    if (/harness-cli\s+query\b/.test(cmd) || /harness-cli\s+matrix\b/.test(cmd)) {
      try { fs.writeFileSync(flagFile(), '1'); } catch {}
    }
    return;
  }

  // Role 2 — Edit/Write: warn if a story is in progress and state was not read.
  if (tool !== 'Edit' && tool !== 'Write') return;
  if (fs.existsSync(flagFile())) return;          // already read this session → fine

  const cli = harnessCli();
  if (!cli) return;                               // no harness → not a caw project
  let stories;
  try { stories = JSON.parse(sh(`${cli} query story --json`) || '[]'); } catch { return; }
  if (!Array.isArray(stories)) return;
  const active = stories.find(s => s && s.status === 'in_progress');
  if (!active) return;                            // no active task → no expectation

  console.error(
    `[caw] ⚠ story ${active.id} is in progress but task state hasn't been read ` +
    `this session. Run \`harness-cli query story|task|matrix\` before editing so ` +
    `you act on current state (this is a warning, not a block).`
  );
  // Set the flag so the warning fires once per session, not on every edit.
  try { fs.writeFileSync(flagFile(), '1'); } catch {}
}
