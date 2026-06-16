import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { getProjectRoot } from '@/lib/project-root';

export const prerender = IS_STATIC;

const MAX_LINES = 1200;

interface FileEntry {
  path: string; // relative to projectRoot
  exists: boolean;
  content: string;
}

interface RuleGroup {
  layer: string; // 'common' | 'typescript' | ...
  files: FileEntry[];
}

interface ProjectFilesResponse {
  conventions: FileEntry;
  knowledge: FileEntry;
  claudeMd: FileEntry;
  rules: RuleGroup[];
}

async function readEntry(root: string, relPath: string): Promise<FileEntry> {
  const abs = join(root, relPath);
  try {
    const raw = await readFile(abs, 'utf8');
    const lines = raw.replace(/\r$/gm, '').split('\n');
    if (lines.length > MAX_LINES) {
      lines.length = MAX_LINES;
      lines.push(`\n*[truncated at ${MAX_LINES} lines]*`);
    }
    return { path: relPath, exists: true, content: lines.join('\n') };
  } catch {
    return { path: relPath, exists: false, content: '' };
  }
}

// Project Info UI only surfaces these 3 rules. Other rule files (e.g.
// typescript/coding-style.md) are still read by agents directly — they're
// just not part of the viewer's "Rules" tab to keep the surface focused.
const RULES_WHITELIST = [
  'project.md', // /caw-setup writes this with stack-specific overrides
  'commit-conventions.md',
  'harness-contract.md',
];

async function readRules(root: string): Promise<RuleGroup[]> {
  const rulesDir = join(root, '.claude', 'rules');

  // 1. Root-level rule files (e.g. project.md written by /caw-setup) are
  //    surfaced as the special "project" group, listed first in the UI.
  // 2. Subfolder rule files (common/*, typescript/*, ...) come next, only
  //    files in the whitelist.
  const groups: RuleGroup[] = [];

  // Pass 1: root-level *.md
  try {
    const rootEntries = await readdir(rulesDir, { withFileTypes: true });
    const rootMds = rootEntries
      .filter((e) => e.isFile() && e.name.endsWith('.md') && RULES_WHITELIST.includes(e.name))
      .map((e) => e.name)
      .sort();

    if (rootMds.length > 0) {
      const files: FileEntry[] = [];
      for (const name of rootMds) {
        const rel = relative(root, join(rulesDir, name));
        files.push(await readEntry(root, rel));
      }
      groups.push({ layer: 'project', files });
    }

    // Pass 2: layer subfolders
    const layers = rootEntries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const layer of layers) {
      const layerDir = join(rulesDir, layer);
      let mds: string[];
      try {
        const entries = await readdir(layerDir, { withFileTypes: true });
        mds = entries
          .filter((e) => e.isFile() && e.name.endsWith('.md') && RULES_WHITELIST.includes(e.name))
          .map((e) => e.name)
          .sort();
      } catch {
        continue;
      }

      const files: FileEntry[] = [];
      for (const name of mds) {
        const rel = relative(root, join(layerDir, name));
        files.push(await readEntry(root, rel));
      }
      if (files.length > 0) groups.push({ layer, files });
    }
  } catch {
    return [];
  }

  return groups;
}

export const GET: APIRoute = async () => {
  const root = getProjectRoot();

  const { isDevMode, MOCK_PROJECT_FILES } = await import('@/lib/mock-data');
  if (isDevMode(root)) {
    return new Response(JSON.stringify(MOCK_PROJECT_FILES), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const [conventions, knowledge, claudeMd, rules] = await Promise.all([
      readEntry(root, 'docs/caw/conventions.md'),
      readEntry(root, 'docs/caw/knowledge.md'),
      readEntry(root, 'CLAUDE.md'),
      readRules(root),
    ]);

    const body: ProjectFilesResponse = { conventions, knowledge, claudeMd, rules };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
