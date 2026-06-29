import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { getProjectRoot } from '@/lib/project-root';

export const prerender = IS_STATIC;

async function countFiles(dir: string, ext = '.md'): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

// Count *.md files recursively — v2 .claude/rules has subfolders (common/, react/, …).
async function countFilesRecursive(dir: string, ext = '.md'): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const e of entries) {
      if (e.isDirectory()) {
        total += await countFilesRecursive(join(dir, e.name), ext);
      } else if (e.isFile() && e.name.endsWith(ext)) {
        total += 1;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function countDirs(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

export const GET: APIRoute = async () => {
  const root = getProjectRoot();
  const claudeDir = join(root, '.claude');

  // v2: agents/skills/commands ship in the plugin, not the project. The project's
  // .claude only has rules/, agent-memory/, settings*. So we count what actually
  // lives in a v2 project: stories, decisions, and rules.
  const [tasks, decisions, rules] = await Promise.all([
    countDirs(join(root, 'docs', 'caw', 'stories')),
    countFiles(join(root, 'docs', 'caw', 'decisions')),
    countFilesRecursive(join(claudeDir, 'rules')),
  ]);

  return new Response(JSON.stringify({ tasks, decisions, rules }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
