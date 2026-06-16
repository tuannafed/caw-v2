#!/usr/bin/env python3
"""
generate-project-meta.py — write `<project>/.claude/project.yaml` from package.json
metadata + caw conventions. Deterministic (no LLM judgment).

Why this exists: the backlog viewer (and any external tool) needs structured
project metadata — name, archetype, stack tech+version, tags. Parsing this out
of conventions.md is fragile because the setup agent generates that markdown in
slightly different shapes per project (`## Stack` vs `## Stack (detected …)`,
H3 sub-headings vs flat bullets, `- **Label:** Value` vs table layout). One
script + one schema fixes the format drift permanently.

Inputs:
  - Project path (root)
  - <project>/package.json (root) + apps/*/packages/*/services/* (monorepo)
  - <project>/docs/caw/conventions.md (for name + archetype)
  - <project>/CLAUDE.md (fallback for name + description)

Output: <project>/.claude/project.yaml (overwrites)

Usage:
  ./cli/generate-project-meta.py <project-path>
  ./cli/generate-project-meta.py <project-path> --dry-run
  ./cli/generate-project-meta.py <project-path> --stdout

Exit codes:
  0 — success
  1 — bad arguments
  2 — project path doesn't exist or has no package.json/pyproject.toml
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Stack rules: dep name → (role, display name, icon slug) ──────────────────
# Ordered: first match in this list wins for icon. Used to pick a single
# representative entry per role (Backend, Database, Cache, etc).
#
# Triggers are exact npm/pip dep names. When a project has multiple deps in
# the same role (e.g. drizzle-orm + pg), the first matching rule wins.

STACK_RULES = [
    # === Backend frameworks ===
    {"deps": ["fastify"],                     "role": "Backend",   "name": "Fastify",         "icon": "generic"},
    {"deps": ["@nestjs/core"],                "role": "Backend",   "name": "NestJS",          "icon": "nestjs"},
    {"deps": ["express"],                     "role": "Backend",   "name": "Express",         "icon": "generic"},
    {"deps": ["hono"],                        "role": "Backend",   "name": "Hono",            "icon": "generic"},
    {"deps": ["fastapi"],                     "role": "Backend",   "name": "FastAPI",         "icon": "generic"},
    {"deps": ["django"],                      "role": "Backend",   "name": "Django",          "icon": "generic"},

    # === Frontend frameworks ===
    {"deps": ["next"],                        "role": "Frontend",  "name": "Next.js",         "icon": "nextjs"},
    {"deps": ["@tanstack/react-start"],       "role": "Frontend",  "name": "TanStack Start",  "icon": "react"},
    {"deps": ["react"],                       "role": "Frontend",  "name": "React",           "icon": "react"},
    {"deps": ["vue"],                         "role": "Frontend",  "name": "Vue",             "icon": "generic"},
    {"deps": ["svelte"],                      "role": "Frontend",  "name": "Svelte",          "icon": "generic"},
    {"deps": ["solid-js"],                    "role": "Frontend",  "name": "Solid",           "icon": "generic"},

    # === ORM / DB clients ===
    {"deps": ["drizzle-orm"],                 "role": "ORM",       "name": "Drizzle",         "icon": "generic"},
    {"deps": ["prisma", "@prisma/client"],    "role": "ORM",       "name": "Prisma",          "icon": "prisma"},
    {"deps": ["typeorm"],                     "role": "ORM",       "name": "TypeORM",         "icon": "generic"},
    {"deps": ["mongoose"],                    "role": "ORM",       "name": "Mongoose",        "icon": "mongodb"},
    {"deps": ["sqlalchemy"],                  "role": "ORM",       "name": "SQLAlchemy",      "icon": "generic"},

    # === Databases (driver libs) ===
    # Driver lib version != server version, so we deliberately omit version
    # here. The Database row appears even without ORM; for the server version,
    # users should edit conventions.md prose.
    {"deps": ["postgres", "pg"],              "role": "Database",  "name": "PostgreSQL",      "icon": "postgresql", "omit_version": True},
    {"deps": ["mysql2", "mysql"],             "role": "Database",  "name": "MySQL",           "icon": "mysql",      "omit_version": True},
    {"deps": ["mongodb"],                     "role": "Database",  "name": "MongoDB",         "icon": "mongodb",    "omit_version": True},
    {"deps": ["@supabase/supabase-js"],       "role": "Database",  "name": "Supabase",        "icon": "postgresql", "omit_version": True},

    # === Cache / queue ===
    {"deps": ["redis", "ioredis", "@keyv/redis"], "role": "Cache", "name": "Redis",           "icon": "redis"},
    {"deps": ["bullmq"],                      "role": "Queue",     "name": "BullMQ",          "icon": "redis"},

    # === Payments / 3rd party ===
    {"deps": ["stripe"],                      "role": "Payments",  "name": "Stripe",          "icon": "stripe"},

    # === Monitoring ===
    {"deps": ["@sentry/node", "@sentry/react", "@sentry/browser", "@sentry/nextjs"],
                                              "role": "Monitoring","name": "Sentry",          "icon": "generic"},

    # === Edge / serverless ===
    {"deps": ["wrangler"],                    "role": "Edge",      "name": "Cloudflare Workers", "icon": "generic"},

    # === UI ===
    {"deps": ["@radix-ui/react-slot"],        "role": "UI",        "name": "shadcn/ui",       "icon": "generic"},
    {"deps": ["tailwindcss"],                 "role": "Styling",   "name": "Tailwind",        "icon": "tailwind"},

    # === State / data fetching ===
    {"deps": ["@tanstack/react-query"],       "role": "Data",      "name": "TanStack Query",  "icon": "react"},
    {"deps": ["@reduxjs/toolkit"],            "role": "State",     "name": "Redux Toolkit",   "icon": "generic"},
    {"deps": ["zustand"],                     "role": "State",     "name": "Zustand",         "icon": "generic"},

    # === Testing ===
    {"deps": ["vitest"],                      "role": "Testing",   "name": "Vitest",          "icon": "generic"},
    {"deps": ["jest"],                        "role": "Testing",   "name": "Jest",            "icon": "jest"},
    {"deps": ["@playwright/test", "playwright"], "role": "E2E",    "name": "Playwright",      "icon": "generic"},

    # === Build / monorepo ===
    {"deps": ["turbo"],                       "role": "Monorepo",  "name": "Turborepo",       "icon": "generic"},
    {"deps": ["nx"],                          "role": "Monorepo",  "name": "Nx",              "icon": "generic"},

    # === Language (last, lowest priority — only as fallback) ===
    {"deps": ["typescript"],                  "role": "Language",  "name": "TypeScript",      "icon": "typescript"},
]


def collect_package_json(project_path: Path) -> dict:
    """Return dict: dep_name → version (string). Union across root + apps/* + packages/* + services/*."""
    deps: dict[str, str] = {}
    candidates = [project_path / "package.json"]
    for ws in ("apps", "packages", "services"):
        ws_dir = project_path / ws
        if ws_dir.is_dir():
            for sub in ws_dir.iterdir():
                pkg = sub / "package.json"
                if pkg.is_file():
                    candidates.append(pkg)

    for pkg_file in candidates:
        if not pkg_file.is_file():
            continue
        try:
            with open(pkg_file) as f:
                pkg = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for section in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
            for name, version in (pkg.get(section) or {}).items():
                # First seen wins; later workspaces don't overwrite the root version
                # (which is usually pinned in the workspace that owns it).
                if name not in deps:
                    deps[name] = clean_version(str(version))
    return deps


def clean_version(v: str) -> str:
    """Strip caret/tilde/range/workspace marker. '^5.8.4' → '5.8.4', 'workspace:^' → ''."""
    if not v or v.startswith("workspace:") or v.startswith("file:") or v.startswith("link:"):
        return ""
    return v.lstrip("^~>=<").split(" ")[0].strip()


def build_stack(deps: dict[str, str], max_items: int = 6) -> list[dict]:
    """Apply STACK_RULES in order. Dedup by role: keep first match per role."""
    seen_roles: set[str] = set()
    stack: list[dict] = []
    for rule in STACK_RULES:
        for dep_name in rule["deps"]:
            if dep_name in deps:
                if rule["role"] in seen_roles:
                    break
                version = "" if rule.get("omit_version") else deps[dep_name]
                stack.append({
                    "role": rule["role"],
                    "name": rule["name"],
                    "version": version,
                    "icon": rule["icon"],
                })
                seen_roles.add(rule["role"])
                break
        if len(stack) >= max_items:
            break
    return stack


def derive_tags(stack: list[dict], archetype_id: str) -> list[str]:
    """Up to 6 free-form tags from archetype + stack names."""
    tags: list[str] = []
    seen: set[str] = set()

    def add(label: str):
        if label and label not in seen:
            seen.add(label)
            tags.append(label)

    # Archetype-derived tags
    if archetype_id:
        for piece in archetype_id.split("-"):
            cap = piece.capitalize()
            if cap in ("Api", "Rest", "Monolith", "Microservice"):
                add("Backend API" if cap == "Api" else cap)
            elif cap == "Saas":
                add("SaaS")

    # Stack-derived tags
    for item in stack[:5]:
        add(item["name"].split(" ")[0])

    return tags[:6]


def parse_project_name(project_path: Path, conventions: str, claude_md: str) -> str:
    """Mirror viewer logic: conventions H1 trail → CLAUDE.md H1 → folder name."""
    m = re.search(r"^#\s+(.+?)\s*$", conventions, re.M)
    if m:
        cleaned = re.sub(r"^Project Conventions\s*[—\-:]\s*", "", m.group(1), flags=re.I)
        cleaned = re.sub(r"^Conventions\s*[—\-:]\s*", "", cleaned, flags=re.I).strip()
        if cleaned and cleaned.lower() != "project conventions":
            return cleaned
    m = re.search(r"^#\s+(.+?)\s*$", claude_md, re.M)
    if m:
        cleaned = re.sub(r"\s*[—\-:].*$", "", m.group(1)).strip()
        if cleaned and cleaned.upper() != "CLAUDE.MD":
            return cleaned
    return project_path.name


def parse_archetype(conventions: str) -> tuple[str, str]:
    """Extract (id, summary) from `## Archetype` section in conventions.md.
    id: derived from first **bold** phrase or h2 heading; summary: same line minus the bold.
    Returns ("", "") if not found.
    """
    section = re.search(r"##\s+Archetype\s*\n([\s\S]*?)(?:\n##\s|\n---|$)", conventions)
    if not section:
        return "", ""
    body = section.group(1).strip()
    # Try inline **Name** — summary pattern
    inline = re.match(r"\*\*([^*]+)\*\*\s*—\s*(.+)", body.split("\n")[0])
    if inline:
        slug = slugify(inline.group(1))
        summary = inline.group(2).strip().rstrip(".").strip()
        return slug, summary
    # Try "Archetype ID: `slug`" pattern
    id_m = re.search(r"Archetype ID:\s*`?([a-z0-9-]+)`?", body, re.I)
    summary_m = re.search(r"Summary:\s*(.+)", body, re.I)
    return (id_m.group(1) if id_m else "", summary_m.group(1).strip() if summary_m else "")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    return re.sub(r"\s+", "-", s)[:60]


def extract_description(claude_md: str) -> str:
    """First non-boilerplate, non-markup paragraph from CLAUDE.md.
    Skipped: headings, blockquotes, HR, bold-led lines (**...**), bullets,
    and the `/init` boilerplate. Trimmed to the first sentence."""
    paragraph: list[str] = []
    for raw in claude_md.split("\n"):
        line = raw.strip()
        if not line:
            if paragraph:
                break
            continue
        if line.startswith(("#", ">", "---", "**", "- ", "* ", "1.", "```")):
            if paragraph:
                break
            continue
        if re.search(r"this file provides guidance to claude code", line, re.I):
            continue
        paragraph.append(line)
    text = " ".join(paragraph).strip()
    # Cut to first sentence to keep card tight; fall back to whole text if no period.
    sentence_end = re.search(r"(?<=\.)\s+(?=[A-Z])", text)
    if sentence_end:
        return text[: sentence_end.start()].strip()
    return text


def to_yaml(meta: dict) -> str:
    """Manual YAML emitter — avoids pyyaml dependency. Handles only our schema shape."""

    def esc(s: str) -> str:
        # Minimal YAML string quoting — wrap in double quotes, escape internal quotes.
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

    lines = [
        f"# Generated by cli/generate-project-meta.py at {meta['generated_at']}",
        "# DO NOT EDIT manually — re-run `/caw-setup --refresh` to regenerate.",
        "# This file is the machine-readable source of truth for project metadata.",
        "# conventions.md is the human-readable counterpart (free prose).",
        "",
        f"name: {esc(meta['name'])}",
        f"description: {esc(meta['description'])}",
        f"team: {esc(meta['team'])}",
        "",
        "archetype:",
        f"  id: {esc(meta['archetype']['id'])}",
        f"  summary: {esc(meta['archetype']['summary'])}",
        "",
        f"generated_at: {esc(meta['generated_at'])}",
        f"generated_by: {esc(meta['generated_by'])}",
        f"last_updated: {esc(meta['last_updated'])}",
        "",
        "stack:",
    ]
    for item in meta["stack"]:
        lines.append(f"  - role: {esc(item['role'])}")
        lines.append(f"    name: {esc(item['name'])}")
        lines.append(f"    version: {esc(item['version'])}")
        lines.append(f"    icon: {esc(item['icon'])}")
    lines.append("")
    lines.append("tags:")
    for tag in meta["tags"]:
        lines.append(f"  - {esc(tag)}")
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project_path", help="Absolute or relative path to the target project")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be written; do not write the file")
    parser.add_argument("--stdout", action="store_true", help="Write YAML to stdout instead of .claude/project.yaml")
    args = parser.parse_args()

    project_path = Path(args.project_path).expanduser().resolve()
    if not project_path.is_dir():
        sys.exit(f"❌ Project path does not exist: {project_path}")

    has_node = (project_path / "package.json").is_file()
    has_py = (project_path / "pyproject.toml").is_file()
    if not (has_node or has_py):
        sys.exit(f"❌ No package.json or pyproject.toml at {project_path}")

    conventions_path = project_path / "docs" / "caw" / "conventions.md"
    claude_md_path = project_path / "CLAUDE.md"

    conventions = conventions_path.read_text(errors="ignore") if conventions_path.is_file() else ""
    claude_md = claude_md_path.read_text(errors="ignore") if claude_md_path.is_file() else ""

    deps = collect_package_json(project_path) if has_node else {}

    name = parse_project_name(project_path, conventions, claude_md)
    archetype_id, archetype_summary = parse_archetype(conventions)
    # Prefer the archetype summary (product description) over CLAUDE.md prose
    # (which is usually instructions, not product description). Only fall back to
    # CLAUDE.md if no archetype summary was found in conventions.md.
    description = archetype_summary or extract_description(claude_md) or ""
    stack = build_stack(deps)
    tags = derive_tags(stack, archetype_id)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    meta = {
        "name": name,
        "description": description,
        "team": name,                       # default team = project name
        "archetype": {"id": archetype_id, "summary": archetype_summary},
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "generated_by": "cli/generate-project-meta.py",
        "last_updated": now.strftime("%Y-%m-%d"),
        "stack": stack,
        "tags": tags,
    }

    yaml_text = to_yaml(meta)

    if args.stdout or args.dry_run:
        sys.stdout.write(yaml_text)
        if args.dry_run:
            sys.stderr.write(f"\n[dry-run] would write to: {project_path / '.claude' / 'project.yaml'}\n")
        return

    out_path = project_path / ".claude" / "project.yaml"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(yaml_text)
    print(f"✅ {out_path}  ({len(stack)} stack items, {len(tags)} tags)")


if __name__ == "__main__":
    main()
