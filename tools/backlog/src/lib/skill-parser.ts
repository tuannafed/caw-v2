import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface SkillSummary {
  name: string;
  folder: string; // folder name on disk (may differ from frontmatter.name)
  description: string;
  metadata: Record<string, string>; // free-form: author, version, allowed-tools, ...
  path: string; // relative path from project root, e.g. .claude/skills/foo/SKILL.md
}

export interface SkillDetail extends SkillSummary {
  content: string; // markdown body (without frontmatter)
  raw: string; // full SKILL.md text
}

// Parse YAML-ish frontmatter at the top of a markdown file. We don't need a
// full YAML parser — SKILL.md frontmatter uses simple `key: value` pairs plus
// occasional `metadata:` nested block.
function parseFrontmatter(raw: string): {
  fm: Record<string, string>;
  metadata: Record<string, string>;
  body: string;
} {
  const fm: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  if (!raw.startsWith('---')) return { fm, metadata, body: raw };

  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { fm, metadata, body: raw };

  const fmBlock = raw.slice(3, end).replace(/^\n/, '');
  const body = raw.slice(end + 4).replace(/^\n/, '');

  let inMetadata = false;
  for (const line of fmBlock.split('\n')) {
    if (!line.trim()) continue;
    // Metadata block: lines starting with two-space indent inside `metadata:`
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^\s{2}/.test(line)) {
      const m = line.match(/^\s+([\w-]+):\s*(.*)$/);
      if (m) metadata[m[1]] = stripQuotes(m[2]);
      continue;
    }
    inMetadata = false;
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) fm[m[1]] = stripQuotes(m[2]);
  }
  return { fm, metadata, body };
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

const MAX_LINES = 1200;

async function readSkillFile(skillPath: string): Promise<{ raw: string; truncated: boolean }> {
  const raw = await readFile(skillPath, 'utf8');
  const lines = raw.replace(/\r$/gm, '').split('\n');
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES;
    lines.push(`\n*[truncated at ${MAX_LINES} lines]*`);
    return { raw: lines.join('\n'), truncated: true };
  }
  return { raw: lines.join('\n'), truncated: false };
}

function makeRelPath(projectRoot: string, abs: string): string {
  return abs.startsWith(projectRoot + '/') ? abs.slice(projectRoot.length + 1) : abs;
}

export async function listSkills(projectRoot: string): Promise<SkillSummary[]> {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }

  const summaries: SkillSummary[] = [];
  for (const folderName of entries.sort()) {
    const skillFolder = join(skillsDir, folderName);
    let folderStat;
    try {
      folderStat = await stat(skillFolder); // follows symlinks
    } catch {
      continue;
    }
    if (!folderStat.isDirectory()) continue;

    const skillFile = join(skillFolder, 'SKILL.md');
    let raw: string;
    try {
      raw = await readFile(skillFile, 'utf8');
    } catch {
      continue;
    }

    const { fm, metadata } = parseFrontmatter(raw);
    summaries.push({
      name: fm.name || folderName,
      folder: folderName,
      description: fm.description || '',
      metadata,
      path: makeRelPath(projectRoot, skillFile),
    });
  }

  return summaries;
}

export async function getSkill(projectRoot: string, folder: string): Promise<SkillDetail | null> {
  // Whitelist by checking against listSkills folder names — prevents path traversal.
  const summaries = await listSkills(projectRoot);
  const summary = summaries.find((s) => s.folder === folder);
  if (!summary) return null;

  const skillFile = join(projectRoot, summary.path);
  const { raw } = await readSkillFile(skillFile);
  const { body } = parseFrontmatter(raw);
  return { ...summary, content: body, raw };
}
