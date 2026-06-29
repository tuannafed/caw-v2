// project-meta.ts — read `.claude/project.yaml` if a project still ships one,
// returning structured project metadata for the Overview tab.
//
// Note (caw v2): project.yaml and docs/caw/conventions.md were both removed in
// v2 — the single project source of truth is now `.claude/rules/project.md`.
// The v2 Overview reader lives in `project-overview.json.ts` (readProjectMd),
// where it can reuse the ICON_MAP / iconSlug() stack-icon helpers. In a pure-v2
// project this readProjectMeta() returns null (no project.yaml) and the caller
// uses the project.md path instead.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface StackItem {
  role: string;
  name: string;
  version: string;
  icon: string;
}

export interface ProjectMeta {
  name: string;
  description: string;
  team: string;
  archetype: { id: string; summary: string };
  generated_at: string;
  generated_by: string;
  last_updated: string;
  stack: StackItem[];
  tags: string[];
}

// Read and parse <root>/.claude/project.yaml. Returns null if the file is
// missing or malformed (the common case in caw v2, where project.yaml no longer
// exists) — callers then derive the project name from CLAUDE.md instead.
export async function readProjectMeta(root: string): Promise<ProjectMeta | null> {
  const path = join(root, '.claude', 'project.yaml');
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Light shape validation — bail out if required fields are missing.
    if (typeof parsed.name !== 'string') return null;
    return {
      name: parsed.name ?? '',
      description: parsed.description ?? '',
      team: parsed.team ?? parsed.name ?? '',
      archetype: {
        id: parsed.archetype?.id ?? '',
        summary: parsed.archetype?.summary ?? '',
      },
      generated_at: parsed.generated_at ?? '',
      generated_by: parsed.generated_by ?? '',
      last_updated: parsed.last_updated ?? '',
      stack: Array.isArray(parsed.stack)
        ? parsed.stack.map((s: Record<string, unknown>) => ({
            role: String(s.role ?? ''),
            name: String(s.name ?? ''),
            version: String(s.version ?? ''),
            icon: String(s.icon ?? 'generic'),
          }))
        : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch {
    return null;
  }
}
