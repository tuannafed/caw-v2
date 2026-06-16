#!/usr/bin/env node
/**
 * PreToolUse hook — Bash
 * Blocks destructive commands that could cause irreversible data loss.
 * Exits 2 (hard block) to prevent the command from running.
 */
'use strict';
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  try {
    const input = JSON.parse(raw);
    const cmd = (input?.tool_input?.command || '').trim();

    const BLOCKED = [
      // Filesystem
      { pattern: /\brm\s+-rf?\s+\/(?!\s*tmp)/, label: 'rm -rf on root or critical path' },
      { pattern: /\brm\s+-rf?\s+~/, label: 'rm -rf on home directory' },
      { pattern: /\bsudo\s+rm\b/, label: 'sudo rm (use without sudo and verify path)' },
      { pattern: /\bfind\b[^|;]*\s-delete\b/, label: 'find ... -delete (review query first)' },
      { pattern: /\bchmod\s+-R\s+777/, label: 'chmod -R 777 (insecure permissions)' },
      { pattern: /\bchown\s+-R\s+(?!\$|\${)\S+\s+\//, label: 'chown -R on root path' },

      // Disk / device
      { pattern: /\bdd\s+(if=|of=)/, label: 'dd if=/of= (raw disk write — extreme caution)' },
      { pattern: />\s*\/dev\/(sd[a-z]|nvme|disk\d)/, label: 'redirect to raw block device' },
      { pattern: /\bmkfs\b/, label: 'mkfs (formats a filesystem — irreversible)' },

      // Git
      { pattern: /\bgit\s+push\s+(?:--force(?!-with-lease)|-f)(?:\s|$)/, label: 'git push --force (use --force-with-lease)' },
      { pattern: /\bgit\s+push\s+\S+\s+:/, label: 'git push delete remote branch (refspec :branch)' },
      { pattern: /\bgit\s+reset\s+--hard\b/, label: 'git reset --hard (uncommitted changes lost)' },
      { pattern: /\bgit\s+clean\s+(?:-[a-z]*f|--force)\b/, label: 'git clean -f (untracked files deleted)' },
      { pattern: /\bgit\s+checkout\s+--\s+\./, label: 'git checkout -- . (discards working tree)' },
      { pattern: /\bgit\s+restore\s+\.(?!\S)/, label: 'git restore . (discards working tree)' },
      { pattern: /\bgit\s+branch\s+-D\b/, label: 'git branch -D (force delete local branch)' },
      { pattern: /\bgit\s+update-ref\s+-d\b/, label: 'git update-ref -d (delete ref)' },

      // Database
      { pattern: /\bdrop\s+table\b/i, label: 'DROP TABLE (irreversible)' },
      { pattern: /\bdrop\s+database\b/i, label: 'DROP DATABASE (irreversible)' },
      { pattern: /\btruncate\s+table\b/i, label: 'TRUNCATE TABLE (confirm intent)' },
      { pattern: /\bdelete\s+from\s+\w+\s*;\s*$/i, label: 'DELETE FROM <table> without WHERE' },

      // Container / orchestration
      { pattern: /\bdocker\s+system\s+prune\s+.*-a/, label: 'docker system prune -a (removes ALL unused images)' },
      { pattern: /\bdocker\s+volume\s+rm\b/, label: 'docker volume rm (data loss)' },
      { pattern: /\bkubectl\s+delete\s+(?:namespace|ns)\b/, label: 'kubectl delete namespace (cascades)' },
      { pattern: /\bkubectl\s+delete\s+.*--all\b/, label: 'kubectl delete --all (mass delete)' },
      { pattern: /\bhelm\s+uninstall\b/, label: 'helm uninstall (removes release)' },

      // Package publishing — accidental release
      { pattern: /\bnpm\s+publish\b(?!.*--dry-run)/, label: 'npm publish (publishes to registry)' },
      { pattern: /\bpnpm\s+publish\b(?!.*--dry-run)/, label: 'pnpm publish (publishes to registry)' },
      { pattern: /\byarn\s+publish\b(?!.*--dry-run)/, label: 'yarn publish (publishes to registry)' },
      { pattern: /\btwine\s+upload\b(?!.*--repository\s+testpypi)/, label: 'twine upload to PyPI' },
    ];

    for (const { pattern, label } of BLOCKED) {
      if (pattern.test(cmd)) {
        process.stderr.write(`[Hook] BLOCKED: ${label}\n`);
        process.stderr.write(`[Hook] Command: ${cmd.slice(0, 160)}\n`);
        process.stderr.write('[Hook] If intentional, run this manually in your terminal.\n');
        process.exit(2);
      }
    }
  } catch {}
  process.stdout.write(raw);
});
