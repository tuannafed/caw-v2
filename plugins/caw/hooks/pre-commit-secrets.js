#!/usr/bin/env node
/**
 * PreToolUse hook — Bash (git commit)
 * Scans staged files for hardcoded secrets before committing.
 * Exits 2 (hard block) if secrets are found.
 */
const { execSync } = require('child_process');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  try {
    const input = JSON.parse(raw);
    const cmd = (input?.tool_input?.command || '').trim();

    // Only run on git commit commands
    if (!/^git\s+commit/.test(cmd)) {
      process.stdout.write(raw);
      return;
    }

    // Patterns that indicate hardcoded secrets
    const SECRET_PATTERNS = [
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{20,}["']?/i, label: 'API key' },
      { pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i, label: 'password/secret' },
      { pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI/Anthropic API key (sk-...)' },
      { pattern: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["']?[A-Z0-9\/+]{16,}["']?/i, label: 'AWS credential' },
      { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/, label: 'AWS Access Key ID' },
      { pattern: /(?:token|bearer)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}["']/i, label: 'auth token' },
      { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, label: 'private key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub personal access token' },
      { pattern: /xox[baprs]-[a-zA-Z0-9\-]{10,}/, label: 'Slack token' },
    ];

    let staged;
    try {
      staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
    } catch {
      process.stdout.write(raw);
      return;
    }

    if (!staged) {
      process.stdout.write(raw);
      return;
    }

    const files = staged.split('\n').filter(f =>
      f && !f.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/i)
    );

    const findings = [];
    for (const file of files) {
      let content;
      try {
        content = execSync(`git show :${file}`, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
      } catch {
        continue;
      }

      // Skip .env.example and test fixture files
      if (file.match(/\.env\.example$|fixtures?\//)) continue;

      for (const { pattern, label } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          findings.push(`  ${file}: possible ${label}`);
          break;
        }
      }
    }

    if (findings.length > 0) {
      console.error('[Hook] BLOCKED: Possible secrets detected in staged files:');
      findings.forEach(f => console.error(f));
      console.error('[Hook] Review and remove secrets before committing.');
      console.error('[Hook] Use environment variables instead. Add secrets to .env (gitignored).');
      process.exit(2);
    }
  } catch {}
  process.stdout.write(raw);
});
