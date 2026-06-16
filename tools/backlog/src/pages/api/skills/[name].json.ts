import type { APIRoute, GetStaticPaths } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { isDevMode, MOCK_SKILLS } from '@/lib/mock-data';
import { getProjectRoot } from '@/lib/project-root';
import { getSkill, listSkills } from '@/lib/skill-parser';

export const prerender = IS_STATIC;

// Enumerate every skill folder at build time so Astro pre-renders one
// .json file per skill. Only called when `prerender = true` (static build).
export const getStaticPaths: GetStaticPaths = async () => {
  const root = getProjectRoot();
  if (isDevMode(root)) {
    return MOCK_SKILLS.map((s) => ({ params: { name: s.folder } }));
  }
  try {
    const skills = await listSkills(root);
    return skills.map((s) => ({ params: { name: s.folder } }));
  } catch {
    return [];
  }
};

export const GET: APIRoute = async ({ params }) => {
  const name = params.name;
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return new Response(JSON.stringify({ error: 'invalid name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const root = getProjectRoot();

  if (isDevMode(root)) {
    const mock = MOCK_SKILLS.find((s) => s.folder === name);
    if (!mock) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const detail = {
      ...mock,
      content: `# ${mock.name}\n\n${mock.description}\n\n## Usage\n\nLoad this skill in your agent via the \`Skill\` tool:\n\n\`\`\`\nSkill("${mock.name}")\n\`\`\`\n\n## Details\n\nThis is mock content for local development. In a real project, this file is read from \`.claude/skills/${mock.folder}/SKILL.md\`.\n`,
      raw: '',
    };
    return new Response(JSON.stringify(detail), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const skill = await getSkill(root, name);
    if (!skill) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(skill), {
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
