import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { isDevMode, MOCK_SKILLS } from '@/lib/mock-data';
import { getProjectRoot } from '@/lib/project-root';
import { listSkills } from '@/lib/skill-parser';

export const prerender = IS_STATIC;

export const GET: APIRoute = async () => {
  const root = getProjectRoot();
  if (isDevMode(root)) {
    return new Response(JSON.stringify(MOCK_SKILLS), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const skills = await listSkills(root);
    return new Response(JSON.stringify(skills), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
