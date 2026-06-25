#!/usr/bin/env node
/**
 * Stop Hook: Batch format and typecheck all edited JS/TS/Python files this session.
 *
 * Reads the accumulator written by post-edit-accumulator.js and processes all
 * edited files in one pass:
 *   - JS/TS: runs Biome or Prettier (auto-detected per project root)
 *   - TS/TSX: runs tsc --noEmit (filtered to edited files' errors)
 *   - Python: runs ruff format (if available)
 */

'use strict';

const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { findProjectRoot, detectFormatter, resolveFormatterBin } = require('./resolve-formatter');

const MAX_STDIN = 1024 * 1024;
const TOTAL_BUDGET_MS = 120_000; // 2 min total for all batches
const UNSAFE_PATH_CHARS = /[&|<>^%!\s()]/;

function getAccumFile() {
  const raw = process.env.CLAUDE_SESSION_ID ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const sessionId = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `caw-edited-${sessionId}.txt`);
}

function parseAccumulator(raw) {
  return [...new Set(raw.split('\n').map(l => l.trim()).filter(Boolean))];
}

function formatBatch(projectRoot, files, timeoutMs) {
  const formatter = detectFormatter(projectRoot);
  if (!formatter) return;
  const resolved = resolveFormatterBin(projectRoot, formatter);
  if (!resolved) return;

  const existingFiles = files.filter(f => fs.existsSync(f));
  if (existingFiles.length === 0) return;

  const fileArgs = formatter === 'biome'
    ? [...resolved.prefix, 'check', '--write', ...existingFiles]
    : [...resolved.prefix, '--write', ...existingFiles];

  try {
    if (process.platform === 'win32' && resolved.bin.endsWith('.cmd')) {
      if (existingFiles.some(f => UNSAFE_PATH_CHARS.test(f))) return;
      spawnSync(resolved.bin, fileArgs, { cwd: projectRoot, shell: true, stdio: 'pipe', timeout: timeoutMs });
    } else {
      execFileSync(resolved.bin, fileArgs, { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs });
    }
  } catch { /* formatter not installed or failed — non-blocking */ }
}

function findTsConfigDir(filePath) {
  let dir = path.dirname(filePath);
  const fsRoot = path.parse(dir).root;
  let depth = 0;
  while (dir !== fsRoot && depth < 20) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json'))) return dir;
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}

function typecheckBatch(tsConfigDir, editedFiles, timeoutMs) {
  const isWin = process.platform === 'win32';
  const npxBin = isWin ? 'npx.cmd' : 'npx';
  const args = ['tsc', '--noEmit', '--pretty', 'false'];
  let stdout = '', stderr = '', failed = false;
  try {
    if (isWin) {
      const result = spawnSync(npxBin, args, { cwd: tsConfigDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs, shell: true });
      if (result.error) return;
      if (result.status !== 0) { stdout = result.stdout || ''; stderr = result.stderr || ''; failed = true; }
    } else {
      execFileSync(npxBin, args, { cwd: tsConfigDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs });
    }
  } catch (err) { stdout = err.stdout || ''; stderr = err.stderr || ''; failed = true; }

  if (!failed) return;
  const lines = (stdout + stderr).split('\n');
  for (const filePath of editedFiles) {
    const relPath = path.relative(tsConfigDir, filePath);
    const candidates = new Set([filePath, relPath]);
    const relevantLines = lines.filter(line => { for (const c of candidates) { if (line.includes(c)) return true; } return false; }).slice(0, 10);
    if (relevantLines.length > 0) {
      process.stderr.write(`[Hook] TypeScript errors in ${path.basename(filePath)}:\n`);
      relevantLines.forEach(line => process.stderr.write(line + '\n'));
    }
  }
}

function formatPythonBatch(files, timeoutMs) {
  const existingFiles = files.filter(f => fs.existsSync(f));
  if (existingFiles.length === 0) return;
  try {
    execFileSync('ruff', ['format', ...existingFiles], { stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs });
  } catch { /* ruff not installed — non-blocking */ }
}

function main() {
  const accumFile = getAccumFile();
  let raw;
  try { raw = fs.readFileSync(accumFile, 'utf8'); } catch { return; }
  try { fs.unlinkSync(accumFile); } catch { /* best-effort */ }

  const files = parseAccumulator(raw);
  if (files.length === 0) return;

  const byProjectRoot = new Map();
  const byTsConfigDir = new Map();
  const pythonFiles = [];

  for (const filePath of files) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) continue;

    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      const root = findProjectRoot(path.dirname(resolved));
      if (!byProjectRoot.has(root)) byProjectRoot.set(root, []);
      byProjectRoot.get(root).push(resolved);
    }
    if (/\.(ts|tsx)$/.test(filePath)) {
      const tsDir = findTsConfigDir(resolved);
      if (tsDir) {
        if (!byTsConfigDir.has(tsDir)) byTsConfigDir.set(tsDir, []);
        byTsConfigDir.get(tsDir).push(resolved);
      }
    }
    if (/\.py$/.test(filePath)) {
      pythonFiles.push(resolved);
    }
  }

  const totalBatches = byProjectRoot.size + byTsConfigDir.size + (pythonFiles.length > 0 ? 1 : 0);
  const perBatchMs = totalBatches > 0 ? Math.floor(TOTAL_BUDGET_MS / totalBatches) : 30_000;

  for (const [root, batch] of byProjectRoot) formatBatch(root, batch, perBatchMs);
  for (const [tsDir, batch] of byTsConfigDir) typecheckBatch(tsDir, batch, perBatchMs);
  if (pythonFiles.length > 0) formatPythonBatch(pythonFiles, perBatchMs);
}

function run(rawInput) {
  try { main(); } catch (err) { process.stderr.write(`[Hook] stop-format-typecheck error: ${err.message}\n`); }
  return rawInput;
}

if (require.main === module) {
  let stdinData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { if (stdinData.length < MAX_STDIN) stdinData += chunk.substring(0, MAX_STDIN - stdinData.length); });
  process.stdin.on('end', () => { process.stdout.write(run(stdinData)); process.exit(0); });
}

module.exports = { run, parseAccumulator };
