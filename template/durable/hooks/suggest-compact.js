#!/usr/bin/env node
/**
 * PreToolUse Hook: Suggest /compact at strategic intervals.
 *
 * Counts tool calls per session and suggests manual compaction at threshold
 * (default 50) then every 25 calls after. Manual compact is better than
 * auto-compact because it happens at logical phase boundaries, not mid-task.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

async function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
    // If stdin is not a pipe (no data coming), resolve after short delay
    if (process.stdin.isTTY) resolve('');
  });
}

async function main() {
  const rawInput = await readStdin();
  // Pass-through: PreToolUse hooks must echo stdin back to stdout
  if (rawInput) process.stdout.write(rawInput);

  const sessionId = (process.env.CLAUDE_SESSION_ID || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  const counterFile = path.join(os.tmpdir(), `caw-tool-count-${sessionId}`);
  const rawThreshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);
  const threshold = (Number.isFinite(rawThreshold) && rawThreshold > 0 && rawThreshold <= 10000) ? rawThreshold : 50;

  let count = 1;
  try {
    const fd = fs.openSync(counterFile, 'a+');
    try {
      const buf = Buffer.alloc(64);
      const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
      if (bytesRead > 0) {
        const parsed = parseInt(buf.toString('utf8', 0, bytesRead).trim(), 10);
        count = (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000000) ? parsed + 1 : 1;
      }
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, String(count), 0);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    try { fs.writeFileSync(counterFile, String(count)); } catch { /* non-blocking */ }
  }

  if (count === threshold) {
    process.stderr.write(`[Hook] ${threshold} tool calls — consider /compact if transitioning phases\n`);
  }
  if (count > threshold && (count - threshold) % 25 === 0) {
    process.stderr.write(`[Hook] ${count} tool calls — good checkpoint for /compact if context is stale\n`);
  }

  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`[Hook:suggest-compact] Error: ${err.message}\n`);
  process.exit(0);
});
