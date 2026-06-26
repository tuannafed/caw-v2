#!/usr/bin/env node
/**
 * Stop hook — runs when the Claude session ends.
 * Prints a structured summary of what was done this session:
 * files edited, commands run, tasks modified, token usage, and suggested next steps.
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();

  let payload = {};
  try { payload = JSON.parse(raw); } catch {}

  try {
    // ── Changed files ──────────────────────────────────────────────────────────
    let changedFiles = '';
    try {
      const staged   = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
      const unstaged = execSync('git diff --name-only',          { encoding: 'utf8' }).trim();
      const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' }).trim();
      const all = [...new Set(
        [staged, unstaged, untracked].filter(Boolean).join('\n').split('\n').filter(Boolean)
      )];
      changedFiles = all.join('\n');
    } catch {}

    // ── Recent commits ─────────────────────────────────────────────────────────
    let recentCommits = '';
    try {
      recentCommits = execSync('git log --oneline -5', { encoding: 'utf8' }).trim();
    } catch {}

      // ── Active stories ────────────────────────────────────────────────────────
    // Each story is a folder: docs/caw/stories/<story-id>/ (epics group them under
    // docs/caw/stories/epics/<epic>/<story-id>/).
    let taskSummary = '';
    try {
      const taskDirs = execSync(
        'ls -d docs/caw/stories/*/ docs/caw/stories/epics/*/*/ 2>/dev/null | grep -v "/epics/$"',
        { encoding: 'utf8' }
      ).trim();
      if (taskDirs) {
        const dirs = taskDirs.split('\n').filter(Boolean);
        const summaries = dirs.map(d => {
          try {
            const yaml = fs.readFileSync(`${d.replace(/\/$/, '')}/overview.yaml`, 'utf8');
            const taskId   = d.replace(/.*\/([^/]+)\/?$/, '$1');
            const status   = (yaml.match(/^status:\s*(.+)$/m)?.[1] || '?').trim();
            const next     = (yaml.match(/^next_task:\s*(.+)$/m)?.[1] || '?').trim();
            return `  ${taskId}: ${status} / next: ${next}`;
          } catch { return null; }
        }).filter(Boolean);
        taskSummary = summaries.join('\n');
      }
    } catch {}

    // ── Token usage ────────────────────────────────────────────────────────────
    const usage = payload.usage || payload.token_counts || null;
    const cost  = payload.cost  || null;

    let tokenSummary = '';
    if (usage) {
      const input       = usage.input_tokens               ?? 0;
      const output      = usage.output_tokens              ?? 0;
      const cacheCreate = usage.cache_creation_input_tokens ?? 0;
      const cacheRead   = usage.cache_read_input_tokens     ?? 0;
      const total       = input + output + cacheCreate + cacheRead;

      const fmt = n => n.toLocaleString('en-US');

      tokenSummary = `  Input:        ${fmt(input).padStart(9)} tokens`;
      if (cacheCreate > 0) tokenSummary += `\n  Cache write:  ${fmt(cacheCreate).padStart(9)} tokens`;
      if (cacheRead   > 0) tokenSummary += `\n  Cache read:   ${fmt(cacheRead).padStart(9)} tokens`;
      tokenSummary += `\n  Output:       ${fmt(output).padStart(9)} tokens`;
      tokenSummary += `\n  ─────────────────────────────`;
      tokenSummary += `\n  Total:        ${fmt(total).padStart(9)} tokens`;

      if (cost && typeof cost.total === 'number') {
        tokenSummary += `\n  Cost:               $${cost.total.toFixed(4)}`;
      } else if (usage) {
        // Per-million-token pricing (USD). Update as Anthropic adjusts rates.
        // Order matters: most-specific id first, then family fallback.
        const PRICING = [
          { match: /opus/i,    in: 15.00, out: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
          { match: /haiku/i,   in:  1.00, out:  5.00, cacheWrite:  1.25, cacheRead: 0.10 },
          { match: /sonnet/i,  in:  3.00, out: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
        ];
        const modelId =
          payload.model ||
          payload.model_id ||
          process.env.CLAUDE_MODEL ||
          'sonnet';
        const tier = PRICING.find(p => p.match.test(modelId)) || PRICING[2]; // default sonnet
        const estimatedCost =
          (input        / 1_000_000) * tier.in +
          (output       / 1_000_000) * tier.out +
          (cacheCreate  / 1_000_000) * tier.cacheWrite +
          (cacheRead    / 1_000_000) * tier.cacheRead;
        const tierLabel = tier.match.source.replace(/[^a-z]/gi, '');
        tokenSummary += `\n  Est. cost (${tierLabel}): ~$${estimatedCost.toFixed(4)}`;
      }
    }

    // ── Build report ───────────────────────────────────────────────────────────
    const lines = ['\n──────────────────────────────────────────'];
    lines.push('Session Summary');
    lines.push('──────────────────────────────────────────');

    if (changedFiles) {
      lines.push('\nFiles modified this session:');
      changedFiles.split('\n').forEach(f => lines.push(`  ${f}`));
    } else {
      lines.push('\nNo uncommitted file changes.');
    }

    if (recentCommits) {
      lines.push('\nRecent commits:');
      recentCommits.split('\n').forEach(c => lines.push(`  ${c}`));
    }

    if (taskSummary) {
      lines.push('\nActive tasks:');
      lines.push(taskSummary);
    }

    if (tokenSummary) {
      lines.push('\nToken usage:');
      lines.push(tokenSummary);
    }

    lines.push('\nTo resume: scripts/caw/bin/harness-cli query matrix');
    lines.push('──────────────────────────────────────────\n');

    console.error(lines.join('\n'));
  } catch {}

  process.stdout.write(raw);
});
