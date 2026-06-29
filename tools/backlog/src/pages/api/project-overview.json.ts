import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { readProjectMeta } from '@/lib/project-meta';
import { getProjectRoot } from '@/lib/project-root';
import { getProjectName } from '@/lib/task-parser';

export const prerender = IS_STATIC;

export interface StackItem {
  name: string;
  version: string;
  role: string;
  icon: string; // slug for known icons, or 'generic'
}

export interface ProjectOverview {
  name: string;
  description: string;
  team: string;
  archetype: string;
  generatedAt: string;
  lastUpdated: string;
  tags: string[];
  stack: StackItem[];
}

// Known tech → icon slug mapping
const ICON_MAP: Record<string, string> = {
  typescript: 'typescript',
  nestjs: 'nestjs',
  postgresql: 'postgresql',
  postgres: 'postgresql',
  redis: 'redis',
  'socket.io': 'socketio',
  aws: 'aws',
  s3: 'aws',
  stripe: 'stripe',
  prisma: 'prisma',
  jest: 'jest',
  docker: 'docker',
  react: 'react',
  nextjs: 'nextjs',
  next: 'nextjs',
  tailwind: 'tailwind',
  graphql: 'graphql',
  mongodb: 'mongodb',
  mysql: 'mysql',
};

function iconSlug(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(ICON_MAP)) {
    if (key.includes(k)) return v;
  }
  return 'generic';
}

// Strip surrounding markdown emphasis/code marks from a raw value:
//   "**`turborepo-x`**" → "turborepo-x",  "`nestjs-rest`" → "nestjs-rest"
function cleanValue(s: string): string {
  return s
    .trim()
    .replace(/^[*`_\s]+/, '')
    .replace(/[*`_\s]+$/, '')
    .trim();
}

// Parse key/value lines in any of these shapes:
//   "**Label:** value"   "**Label**: value"   "- **Label:** value"   "Label: value"
function parseKV(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/^[-*]\s+/, '').trim();
    // Key is everything up to the first colon; emphasis marks may wrap the
    // key, the "key:" pair, or neither — so strip all `*` before splitting.
    const m = line.match(/^\*{0,2}([A-Za-z][\w\s/-]*?)\*{0,2}:\*{0,2}\s*(.+?)\s*$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      if (key && !map[key]) map[key] = cleanValue(m[2]);
    }
  }
  return map;
}

// Pull "name" + "version" out of a free-form value string.
// "TypeScript 5.9" → {name:"TypeScript", version:"5.9"}
// "NestJS 11 + Express" → {name:"NestJS", version:"11"}
function splitNameVersion(raw: string): { name: string; version: string } | null {
  const value = cleanValue(raw).split(/[,+(]/)[0].trim();
  const m = value.match(/^([a-zA-Z][a-zA-Z0-9.\s/-]*?)(?:\s+v?(\d[\d.x+]*))?(?:\s.*)?$/);
  if (!m) return null;
  return { name: m[1].trim(), version: m[2] ?? '' };
}

// Extract stack items. Supports three layouts:
//   A) "## Stack" with bullets:  - **Label:** Value
//   B) "## Stack Summary" with a markdown table: | Layer | Technology | Version | … |
//   C) "## Stack (anything)" with H3 sub-headings as roles:
//        ### Backend
//        - **Framework:** Fastify 5.8.4
//        - **Database:** PostgreSQL (Supabase) + Drizzle ORM 0.45.2
//      Each H3 = a role; each bullet beneath = one tech item (role = H3 + bullet label).
function parseStack(content: string): StackItem[] {
  // Relaxed regex: accept "## Stack", "## Stack Summary", "## Stack (anything)"
  const section = content.match(/##\s+Stack\b[^\n]*\n([\s\S]*?)(?:\n##\s|\n---|$)/);
  if (!section) return [];

  const items: StackItem[] = [];
  const lines = section[1].split('\n');
  let currentH3: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Layout C — H3 sub-heading sets the current role group
    const h3Match = trimmed.match(/^###\s+(.+?)\s*$/);
    if (h3Match) {
      currentH3 = h3Match[1].trim();
      continue;
    }

    // Layout B — markdown table row. Skip header + separator rows.
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((_, i, a) => i > 0 && i < a.length - 1);
      if (cells.length < 2) continue;
      const role = cleanValue(cells[0]);
      if (!role || /^layer$/i.test(role) || /^[-:\s]+$/.test(role)) continue;
      // Prefer an explicit Version column (3rd cell) when present.
      const tech = splitNameVersion(cells[1]);
      if (!tech) continue;
      const version =
        cells[2] && /\d/.test(cells[2]) ? cleanValue(cells[2]).split(/[\s/]/)[0] : tech.version;
      items.push({ name: tech.name, version, role, icon: iconSlug(tech.name) });
      continue;
    }

    // Layout A — bullet "- **Label:** Value"
    const m = trimmed.match(/^[-*]\s+\*{0,2}([^*:]+)\*{0,2}:\*{0,2}\s+(.+)$/);
    if (!m) continue;
    const bulletLabel = m[1].trim();
    const tech = splitNameVersion(m[2]);
    if (!tech) continue;
    // Layout C: role = "<H3> · <bullet label>" (e.g. "Backend · Framework").
    // Layout A: no H3 → role = bullet label.
    const role = currentH3 ? `${currentH3} · ${bulletLabel}` : bulletLabel;
    items.push({ name: tech.name, version: tech.version, role, icon: iconSlug(tech.name) });
  }

  return items.slice(0, 6); // cap at 6 for display
}

// Pull a meaningful first paragraph from CLAUDE.md. Skips:
//   - Markdown headings
//   - Blockquotes / HR lines
//   - The `/init` boilerplate "This file provides guidance to Claude Code..."
//   - Empty lines
// Returns the first non-skipped paragraph (joined consecutive lines).
function extractDescription(claudeMd: string): string {
  const lines = claudeMd.split('\n');
  const paragraph: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (line.startsWith('#') || line.startsWith('>') || line.startsWith('---')) {
      if (paragraph.length) break;
      continue;
    }
    // Skip the Claude Code init boilerplate (case-insensitive substring match).
    if (/this file provides guidance to claude code/i.test(line)) {
      continue;
    }
    paragraph.push(line);
  }
  return paragraph.join(' ').trim();
}

// Pull the archetype tagline from conventions.md. Looks for the first paragraph
// directly under "## Archetype" and strips the "**Name**" emphasis prefix.
function extractArchetypeTagline(conventions: string): string {
  const section = conventions.match(/##\s+Archetype\s*\n([\s\S]*?)(?:\n##\s|\n---|$)/);
  if (!section) return '';
  for (const raw of section[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-') || line.startsWith('*')) continue;
    return line.replace(/\*\*([^*]+)\*\*\s*—\s*/, '$1 — ').trim();
  }
  return '';
}

// Resolve display project name with this precedence:
//   1. KV "Project:" / "Team:" in conventions.md (explicit user override)
//   2. conventions.md H1 trailing text — "# Project Conventions — dava2" → "dava2"
//   3. CLAUDE.md H1 — "# dava2" → "dava2"
//   4. basename(projectRoot) — fragile on Vercel where the build dir may be
//      the repo name (e.g. "path0"), not the caw project name
function resolveProjectName(
  kv: Record<string, string>,
  conventionsRaw: string,
  claudeMdRaw: string,
  root: string,
): string {
  if (kv['project']) return kv['project'];
  if (kv['team']) return kv['team'];

  // conventions.md H1: strip "Project Conventions" + leading dash/em-dash/colon
  const convH1 = conventionsRaw.match(/^#\s+(.+?)\s*$/m);
  if (convH1) {
    const cleaned = convH1[1]
      .replace(/^Project Conventions\s*[—\-:]\s*/i, '')
      .replace(/^Conventions\s*[—\-:]\s*/i, '')
      .trim();
    if (cleaned && cleaned.toLowerCase() !== 'project conventions') return cleaned;
  }

  // CLAUDE.md H1: take first heading word, strip common boilerplate
  const claudeH1 = claudeMdRaw.match(/^#\s+(.+?)\s*$/m);
  if (claudeH1) {
    const cleaned = claudeH1[1].replace(/\s*[—\-:].*$/, '').trim();
    if (cleaned && cleaned.toUpperCase() !== 'CLAUDE.MD') return cleaned;
  }

  return getProjectName(root);
}

// Archetype lives either as an inline "**Archetype:** `x`" KV pair, or under a
// "## Archetype" section as "**Selected:** `x` …".
function parseArchetype(content: string, kv: Record<string, string>): string {
  if (kv['archetype']) return kv['archetype'];

  const section = content.match(/##\s+Archetype\s*\n([\s\S]*?)(?:\n##\s|\n---|$)/);
  if (section) {
    const sel = section[1].match(/\*{0,2}Selected\*{0,2}:\*{0,2}\s*`?([a-z0-9-]+)`?/i);
    if (sel) return sel[1];
  }
  return '';
}

// Derive tags from stack names + archetype
function deriveTags(stack: StackItem[], archetype: string): string[] {
  const tags = new Set<string>();
  const archetypeParts = archetype.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  for (const p of archetypeParts) {
    if (['Api', 'Rest', 'Monolith', 'Microservice'].includes(p))
      tags.add(p === 'Api' ? 'Backend API' : p);
  }
  for (const s of stack.slice(0, 5)) {
    tags.add(s.name.split(' ')[0]);
  }
  return [...tags].slice(0, 6);
}

// ── caw v2 source of truth: .claude/rules/project.md ─────────────────────────
// In v2 there is no project.yaml and no conventions.md. The single project
// source of truth is .claude/rules/project.md, generated by /caw:setup. Its
// structure (verified against the setup agent template):
//   - YAML frontmatter with a `description:` line (may wrap across lines)
//   - H1: "# Project Rules — <name>  (THE LAW — …)"  → name = <name>
//   - "## Context7 libraries" bullet list → the stack (one lib per bullet)

// Split a frontmatter block off the top of the file. Returns { frontmatter, body }.
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: content };
  return { frontmatter: m[1], body: m[2] };
}

// Pull the `description:` value out of YAML frontmatter. YAML allows the value
// to wrap onto indented continuation lines, so we join those until the next
// top-level key or end of block.
function parseFrontmatterDescription(frontmatter: string): string {
  const lines = frontmatter.split('\n');
  const idx = lines.findIndex((l) => /^description\s*:/.test(l));
  if (idx === -1) return '';
  const first = lines[idx].replace(/^description\s*:\s*/, '').trim();
  const parts = first ? [first] : [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i];
    // Continuation lines are indented; a new top-level key starts at column 0.
    if (/^\S/.test(l)) break;
    const t = l.trim();
    if (!t) break;
    parts.push(t);
  }
  return parts
    .join(' ')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// Extract the project name from the H1: "# Project Rules — <name>  (THE LAW …)".
// Strips the leading "Project Rules —/-/:" prefix and any trailing "(…)" note.
function parseProjectMdName(body: string): string {
  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  if (!h1) return '';
  let name = h1[1]
    .replace(/^Project\s+Rules\s*[—\-:]\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '') // drop trailing "(THE LAW …)" parenthetical
    .trim();
  // Strip emphasis/code marks if the name was wrapped.
  name = cleanValue(name);
  if (!name || /^project rules$/i.test(name)) return '';
  return name;
}

// Parse the "## Context7 libraries" bullet list into stack items. Each bullet is
// "- <Name> <version?>" where the version is a trailing token like "16", "v5",
// "4". Comment lines (<!-- … -->) and blanks are skipped.
function parseContext7Stack(body: string): StackItem[] {
  const section = body.match(/##\s+Context7 libraries\b[^\n]*\n([\s\S]*?)(?:\n##\s|\n---|$)/);
  if (!section) return [];
  const items: StackItem[] = [];
  for (const raw of section[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    const bullet = line.match(/^[-*]\s+(.+?)\s*$/);
    if (!bullet) continue;
    // Drop any trailing parenthetical / comma clause, then split name + version.
    const value = cleanValue(bullet[1])
      .split(/\s*[,(]/)[0]
      .trim();
    // Trailing version token: "v5", "16", "4.1", "v8" — keep the rest as the name.
    const vm = value.match(/^(.*?)\s+(v?\d[\d.]*)$/);
    const name = (vm ? vm[1] : value).trim();
    const version = vm ? vm[2] : '';
    if (!name) continue;
    items.push({ name, version, role: '', icon: iconSlug(name) });
  }
  return items.slice(0, 12);
}

// Build a ProjectOverview from .claude/rules/project.md. Returns null when the
// file is absent or has neither a usable name nor any stack libraries.
async function readProjectMd(root: string): Promise<ProjectOverview | null> {
  const path = join(root, '.claude', 'rules', 'project.md');
  const raw = await readFile(path, 'utf8').catch(() => '');
  if (!raw) return null;

  const { frontmatter, body } = splitFrontmatter(raw);
  const name = parseProjectMdName(body) || (await resolveNameFromClaude(root));
  const stack = parseContext7Stack(body);
  const description = parseFrontmatterDescription(frontmatter);

  // If we found nothing usable, signal "no v2 source" so callers fall through.
  if (!name && stack.length === 0) return null;

  return {
    name: name || getProjectName(root),
    description,
    team: '', // not present in project.md — don't fabricate
    archetype: '', // not derivable from project.md
    generatedAt: '',
    lastUpdated: '',
    tags: [], // don't fabricate
    stack,
  };
}

// Name fallback for the v2 path: CLAUDE.md H1 → dir name.
async function resolveNameFromClaude(root: string): Promise<string> {
  const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf8').catch(() => '');
  const h1 = claudeMd.match(/^#\s+(.+?)\s*$/m);
  if (h1) {
    const cleaned = h1[1].replace(/\s*[—\-:].*$/, '').trim();
    if (cleaned && cleaned.toUpperCase() !== 'CLAUDE.MD') return cleaned;
  }
  return getProjectName(root);
}

export const GET: APIRoute = async () => {
  const root = getProjectRoot();

  const { isDevMode, MOCK_OVERVIEW } = await import('@/lib/mock-data');
  if (isDevMode(root)) {
    return new Response(JSON.stringify(MOCK_OVERVIEW), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // PRIMARY PATH (caw v2): .claude/rules/project.md — the single source of truth.
  // Populates name + stack (from "## Context7 libraries") + description (from the
  // frontmatter). Older projects without project.md fall through to the legacy
  // sources below.
  const v2 = await readProjectMd(root);
  if (v2) {
    return new Response(JSON.stringify(v2), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // LEGACY PATH 1: structured project.yaml if a project still ships one
  // (deterministic, generated by an older /caw-setup). Returns null in caw v2.
  const meta = await readProjectMeta(root);
  if (meta) {
    const overview: ProjectOverview = {
      name: meta.name,
      description: meta.description,
      team: meta.team,
      archetype: meta.archetype.id,
      generatedAt: meta.generated_at,
      lastUpdated: meta.last_updated,
      tags: meta.tags,
      stack: meta.stack,
    };
    return new Response(JSON.stringify(overview), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // LEGACY PATH 2: parse docs/caw/conventions.md (removed in caw v2, so these
  // reads no-op via .catch(() => '') — name then falls back to CLAUDE.md / dir).
  try {
    const conventionsPath = join(root, 'docs', 'caw', 'conventions.md');
    const claudeMdPath = join(root, 'CLAUDE.md');

    const [conventionsRaw, claudeMdRaw] = await Promise.all([
      readFile(conventionsPath, 'utf8').catch(() => ''),
      readFile(claudeMdPath, 'utf8').catch(() => ''),
    ]);

    const kv = parseKV(conventionsRaw);
    const stack = parseStack(conventionsRaw);

    // Extract generated date from the "Generated by /caw-setup at <date>" header.
    // Date may be ISO ("2026-05-12T19:33:00Z") or bare ("2026-05-20.").
    const genMatch = conventionsRaw.match(/Generated by[^\n]*?\bat\s+([0-9T:\-Z.]+)/);
    const generatedAt = genMatch
      ? genMatch[1].replace(/\.$/, '').replace('T', ' ').replace('Z', ' UTC').trim()
      : '';

    // Description: first non-heading paragraph from CLAUDE.md that is not a
    // boilerplate header (the "This file provides guidance to Claude Code..." line
    // generated by `/init` carries no project-specific info). Fall back to the
    // archetype tagline in conventions.md if CLAUDE.md has nothing else.
    const description = extractDescription(claudeMdRaw) || extractArchetypeTagline(conventionsRaw);

    const archetype = parseArchetype(conventionsRaw, kv);
    const projectName = resolveProjectName(kv, conventionsRaw, claudeMdRaw, root);
    const team = kv['team type'] ?? projectName;
    const tags = deriveTags(stack, archetype);

    // No explicit "Last Updated" field in either format → fall back to the
    // generated date so the card never shows a bare dash.
    const lastUpdated = kv['last updated'] ?? generatedAt;

    const overview: ProjectOverview = {
      name: projectName,
      description,
      team,
      archetype,
      generatedAt,
      lastUpdated,
      tags,
      stack,
    };

    return new Response(JSON.stringify(overview), {
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
