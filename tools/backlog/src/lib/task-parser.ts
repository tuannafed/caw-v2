import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface Phase {
  id: string;
  status: string;
  files: string;
  depends_on?: string[];
  skills_hint?: string[];
}

export interface Task {
  id: string;
  title: string;
  status: string;
  lane: string;
  type: string;
  next_phase: string;
  created: string;
  updated: string;
  phases: Phase[];
  sections: {
    plan: string;
    code: string;
    tests: string;
    review: string;
    overview: string; // raw overview.yaml content
  };
}

const MAX_LINES = 600;

async function readContent(path: string): Promise<string> {
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw.replace(/\r$/gm, '').split('\n');
    if (lines.length > MAX_LINES) {
      lines.length = MAX_LINES;
      lines.push(`\n*[truncated at ${MAX_LINES} lines]*`);
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

interface OverviewYaml {
  id?: string;
  title?: string;
  status?: string;
  lane?: string;
  type?: string;
  next_phase?: string;
  created?: string;
  updated?: string;
  created_at?: string;
  updated_at?: string;
  phases?: Array<{
    id: string;
    status?: string;
    files?: string | string[];
    depends_on?: string[];
    skills_hint?: string[];
  }>;
}

function normalizeFiles(files: string | string[] | undefined): string {
  if (!files) return '';
  if (Array.isArray(files)) return files.join(', ');
  return files;
}

/**
 * overview.yaml is meant to be pure YAML, but some caw agents append a
 * Markdown `## Verify` section after the YAML body. A bare `**Tests:** ...`
 * line trips the YAML parser ("implicit map key needs a value"), which would
 * otherwise drop the whole task from the board. Strip everything from the
 * first top-level Markdown heading onward so the valid YAML head still parses.
 */
function stripTrailingMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const headingIdx = lines.findIndex((l) => /^#{1,6}\s/.test(l));
  return headingIdx === -1 ? raw : lines.slice(0, headingIdx).join('\n');
}

async function parseTask(taskDir: string): Promise<Task | null> {
  const overviewPath = join(taskDir, 'overview.yaml');
  let overviewRaw: string;
  try {
    overviewRaw = await readFile(overviewPath, 'utf8');
  } catch {
    // No overview.yaml → not a valid caw task; skip.
    return null;
  }

  let yaml: OverviewYaml = {};
  try {
    yaml = parseYaml(overviewRaw) || {};
  } catch {
    // Likely a trailing Markdown section appended after the YAML body.
    // Retry against just the YAML head before giving up on the task.
    try {
      yaml = parseYaml(stripTrailingMarkdown(overviewRaw)) || {};
      console.warn(`[task-parser] ${overviewPath}: ignored trailing Markdown after YAML body`);
    } catch (err) {
      console.error(`[task-parser] failed to parse ${overviewPath}:`, err);
      return null;
    }
  }

  const id = yaml.id || basename(taskDir).replace(/\/$/, '');
  const title = yaml.title || id;
  const status = yaml.status || 'pending';
  const phases: Phase[] = (yaml.phases || []).map((p) => ({
    id: p.id,
    status: p.status || 'pending',
    files: normalizeFiles(p.files),
    depends_on: p.depends_on,
    skills_hint: p.skills_hint,
  }));

  const [plan, code, tests, review] = await Promise.all([
    readContent(join(taskDir, 'plan.md')),
    readContent(join(taskDir, 'code.md')),
    readContent(join(taskDir, 'tests.md')),
    readContent(join(taskDir, 'review.md')),
  ]);

  return {
    id,
    title,
    status,
    lane: yaml.lane || '',
    type: yaml.type || '',
    next_phase: yaml.next_phase || '',
    created: yaml.created || yaml.created_at || '',
    updated: yaml.updated || yaml.updated_at || '',
    phases,
    sections: { plan, code, tests, review, overview: overviewRaw },
  };
}

export async function parseTasks(projectRoot: string): Promise<Task[]> {
  // caw v2: each unit of work is a story folder under docs/caw/stories/.
  // Accept both `story-` (v2) and `task-` (legacy) prefixes for back-compat.
  const tasksDir = join(projectRoot, 'docs', 'caw', 'stories');
  let entries: string[];
  try {
    entries = await readdir(tasksDir);
  } catch {
    return [];
  }

  const taskDirs: string[] = [];
  for (const name of entries) {
    if (!name.startsWith('story-') && !name.startsWith('task-')) continue;
    const full = join(tasksDir, name);
    try {
      const s = await stat(full);
      if (s.isDirectory()) taskDirs.push(full);
    } catch {
      // ignore
    }
  }

  taskDirs.sort();
  const tasks = await Promise.all(taskDirs.map((d) => parseTask(d)));
  return tasks.filter((t): t is Task => t !== null);
}

export function getProjectName(projectRoot: string): string {
  return basename(projectRoot.replace(/\/$/, ''));
}
