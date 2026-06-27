import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * In caw v2 the harness DB (`harness.db`) is the source of truth for execution
 * STATE (story status, lane), while the markdown overview.yaml is a human-readable
 * mirror that can lag. When the DB is present we overlay its status/lane onto the
 * parsed stories so the board reflects "what agents actually did", not stale prose.
 * Read-only, best-effort: any failure (no DB, old Node without node:sqlite) silently
 * falls back to the markdown values.
 */
type DbState = Map<string, { status?: string; lane?: string }>;

async function readDbState(projectRoot: string): Promise<DbState> {
  const out: DbState = new Map();
  const dbPath = join(projectRoot, 'harness.db');
  try {
    await stat(dbPath);
  } catch {
    return out; // no DB → markdown only
  }
  try {
    // node:sqlite is built in on Node 22+ but ships no TS types yet. Import via a
    // computed specifier so the type-checker doesn't try to resolve the module,
    // and lazily so envs without it (or with the DB absent) don't break the board.
    const mod = 'node:sqlite';
    const sqlite = (await import(/* @vite-ignore */ mod)) as {
      DatabaseSync: new (
        path: string,
        opts?: { readOnly?: boolean },
      ) => {
        prepare(sql: string): { all(): unknown[] };
        close(): void;
      };
    };
    const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare('SELECT id, status, risk_lane FROM story').all() as Array<{
        id: string;
        status: string;
        risk_lane: string;
      }>;
      for (const r of rows) out.set(r.id, { status: r.status, lane: r.risk_lane });
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn(
      `[task-parser] harness.db present but unreadable; using markdown state:`,
      (err as Error).message,
    );
  }
  return out;
}

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

interface TaskEntry {
  id: string;
  status?: string;
  files?: string | string[];
  depends_on?: string[];
  skills_hint?: string[];
}

interface OverviewYaml {
  id?: string;
  title?: string;
  status?: string;
  lane?: string;
  type?: string;
  // v2 renamed phase→task; accept both. `tasks`/`next_task` are canonical.
  next_task?: string;
  next_phase?: string;
  created?: string;
  updated?: string;
  created_at?: string;
  updated_at?: string;
  tasks?: TaskEntry[];
  phases?: TaskEntry[];
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

function shapeYaml(parsed: unknown): OverviewYaml {
  // Only a mapping is a valid overview; a list/scalar degrades to {}.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as OverviewYaml;
}

async function parseTask(taskDir: string): Promise<Task | null> {
  // Prefer overview.yaml (v1 + migrated projects) for structured state. In a
  // pure v2 project it may be absent — the story is still valid via plan.md, so
  // we don't bail; we fall back to folder name + plan.md content.
  const overviewPath = join(taskDir, 'overview.yaml');
  let overviewRaw = '';
  let yaml: OverviewYaml = {};
  try {
    overviewRaw = await readFile(overviewPath, 'utf8');
    try {
      yaml = shapeYaml(parseYaml(overviewRaw));
    } catch {
      // A trailing Markdown section after the YAML body trips the parser; retry
      // on the YAML head before giving up on the overview.
      try {
        yaml = shapeYaml(parseYaml(stripTrailingMarkdown(overviewRaw)));
        console.warn(`[task-parser] ${overviewPath}: ignored trailing Markdown after YAML body`);
      } catch (err) {
        console.error(`[task-parser] failed to parse ${overviewPath}:`, err);
      }
    }
  } catch {
    // No overview.yaml — v2 story carries its state in the DB + plan.md.
  }

  const id = yaml.id || basename(taskDir).replace(/\/$/, '');
  const title = yaml.title || id;
  const status = yaml.status || 'pending';
  // v2: tasks (was: phases). Accept either key.
  const phases: Phase[] = (yaml.tasks || yaml.phases || []).map((p) => ({
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
    next_phase: yaml.next_task || yaml.next_phase || '',
    created: yaml.created || yaml.created_at || '',
    updated: yaml.updated || yaml.updated_at || '',
    phases,
    sections: { plan, code, tests, review, overview: overviewRaw },
  };
}

/**
 * A directory is a caw story if it holds `plan.md` (v2) or `overview.yaml` (v1).
 * Detect by content, not by folder-name prefix — v2 story ids are `US-NNN-slug`
 * (no `story-`/`task-` prefix), so a prefix allowlist would hide every v2 story.
 */
async function isStoryDir(dir: string): Promise<boolean> {
  for (const marker of ['plan.md', 'overview.yaml']) {
    try {
      const s = await stat(join(dir, marker));
      if (s.isFile()) return true;
    } catch {
      // marker absent — keep checking
    }
  }
  return false;
}

/**
 * Collect story dirs under `docs/caw/stories/`, descending ONE level into
 * `epics/E<NN>-<theme>/<US-NNN>/` (the optional grouping layout). A flat story
 * sits directly under stories/; an epic-grouped story sits under stories/epics/.
 */
async function collectStoryDirs(storiesDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(storiesDir);
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const name of entries) {
    const full = join(storiesDir, name);
    let s: Awaited<ReturnType<typeof stat>>;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;

    if (name === 'epics') {
      // Each child is an epic dir; each grandchild is a story.
      let epics: string[];
      try {
        epics = await readdir(full);
      } catch {
        continue;
      }
      for (const epic of epics) {
        const epicDir = join(full, epic);
        try {
          if (!(await stat(epicDir)).isDirectory()) continue;
        } catch {
          continue;
        }
        for (const story of await readdir(epicDir).catch(() => [])) {
          const storyDir = join(epicDir, story);
          if (await isStoryDir(storyDir)) found.push(storyDir);
        }
      }
      continue;
    }

    if (await isStoryDir(full)) found.push(full);
  }
  return found;
}

export async function parseTasks(projectRoot: string): Promise<Task[]> {
  // caw v2: each unit of work is a story folder under docs/caw/stories/, ids like
  // `US-NNN-slug`. Stories can also be grouped under `stories/epics/E<NN>/`.
  const tasksDir = join(projectRoot, 'docs', 'caw', 'stories');
  const [taskDirsUnsorted, dbState] = await Promise.all([
    collectStoryDirs(tasksDir),
    readDbState(projectRoot),
  ]);
  const taskDirs = taskDirsUnsorted.sort();
  const parsed = await Promise.all(taskDirs.map((d) => parseTask(d)));
  const tasks = parsed.filter((t): t is Task => t !== null);

  // Overlay DB state (source of truth) where the DB knows this story.
  for (const t of tasks) {
    const db = dbState.get(t.id);
    if (db?.status) t.status = db.status;
    if (db?.lane) t.lane = db.lane;
  }
  return tasks;
}

export function getProjectName(projectRoot: string): string {
  return basename(projectRoot.replace(/\/$/, ''));
}
