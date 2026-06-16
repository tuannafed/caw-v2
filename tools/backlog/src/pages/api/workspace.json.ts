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

  const [agents, tasks, skills, commands, rules] = await Promise.all([
    countFiles(join(claudeDir, 'agents')),
    countDirs(join(claudeDir, 'conductor', 'tasks')),
    countDirs(join(claudeDir, 'skills')),
    countFiles(join(claudeDir, 'commands')),
    countFiles(join(claudeDir, 'rules')),
  ]);

  return new Response(JSON.stringify({ agents, tasks, skills, commands, rules }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
