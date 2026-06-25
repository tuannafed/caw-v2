#!/usr/bin/env node
/**
 * PostToolUse hook — Edit / Write
 *
 * Warns when debugging leftovers are present in a just-edited file:
 *   - JS/TS: console.log / console.debug / console.warn / console.error / debugger;
 *   - Python: bare print() (use logging instead), pdb.set_trace(), breakpoint()
 *
 * Non-blocking — informational only. Heavy debug-on-purpose can be ignored,
 * but this catches forgotten lines before they reach review.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const JS_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const PY_EXT = /\.py$/;

const CONSOLE_RE = /\bconsole\.(log|debug|warn|error|trace|table)\s*\(/g;
const DEBUGGER_RE = /\bdebugger\s*;?/g;

const PY_PRINT_RE = /^\s*print\s*\(/gm;
const PY_BREAKPOINT_RE = /\b(?:pdb\.set_trace|breakpoint)\s*\(\s*\)/g;

const TEST_PATH = /(?:^|\/)(?:tests?|__tests__|spec|e2e)\//;
const SCRIPT_PATH = /(?:^|\/)scripts?\//;

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  try {
    const input = JSON.parse(raw);
    const filePath = input?.tool_input?.file_path || '';
    if (!filePath || !fs.existsSync(filePath)) {
      process.stdout.write(raw);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const findings = [];

    if (JS_EXT.test(filePath)) {
      const consoles = [...content.matchAll(CONSOLE_RE)];
      const debuggers = [...content.matchAll(DEBUGGER_RE)];
      if (consoles.length > 0) {
        const kinds = [...new Set(consoles.map(m => m[1]))].sort().join('/');
        findings.push(`${consoles.length} console.${kinds}`);
      }
      if (debuggers.length > 0) {
        findings.push(`${debuggers.length} debugger; statement(s)`);
      }
    } else if (PY_EXT.test(filePath)) {
      const isAppCode = !TEST_PATH.test(filePath) && !SCRIPT_PATH.test(filePath);
      if (isAppCode) {
        const prints = [...content.matchAll(PY_PRINT_RE)];
        if (prints.length > 0) {
          findings.push(`${prints.length} bare print() — use logging`);
        }
      }
      const breakpoints = [...content.matchAll(PY_BREAKPOINT_RE)];
      if (breakpoints.length > 0) {
        findings.push(`${breakpoints.length} breakpoint()/pdb.set_trace()`);
      }
    } else {
      process.stdout.write(raw);
      return;
    }

    if (findings.length > 0) {
      process.stderr.write(
        `[Hook] Debug leftovers in ${path.basename(filePath)}: ${findings.join(', ')} — clean up before commit\n`,
      );
    }
  } catch { /* malformed input — pass through */ }
  process.stdout.write(raw);
});
