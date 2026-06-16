#!/usr/bin/env python3
"""
Generate SKILLS-CATALOG.md from template/skills/ + skills-lock.json.

Output: machine-readable catalog used by the `setup` agent during /caw-setup
to map detected tech stack -> available caw-curated skills.

Maintainer should review the META dict below when new skills are added —
the `triggers` field is what tells the LLM which package.json deps activate
each skill.
"""
import json
import os
import re
import sys

# Manually curated metadata: triggers + domain per skill.
# When adding a new skill, append an entry here.
META = {
    # === Backend ===
    "nestjs-best-practices":           {"triggers": ["@nestjs/core", "@nestjs/common"], "domain": "backend"},
    "prisma-client-api":               {"triggers": ["@prisma/client", "prisma"], "domain": "backend"},
    "prisma-postgres":                 {"triggers": ["@prisma/client", "prisma", "pg"], "domain": "backend"},
    "redis-development":               {"triggers": ["ioredis", "redis", "@keyv/redis"], "domain": "backend"},
    "stripe-best-practices":           {"triggers": ["stripe"], "domain": "backend"},
    "stripe-projects":                 {"triggers": ["stripe"], "domain": "backend"},
    "supabase":                        {"triggers": ["@supabase/supabase-js", "@supabase/ssr"], "domain": "backend"},
    "supabase-postgres-best-practices": {"triggers": ["@supabase/supabase-js", "pg"], "domain": "backend"},
    "websocket-engineer":              {"triggers": ["socket.io", "@nestjs/websockets", "ws"], "domain": "backend"},
    "drizzle-best-practices":          {"triggers": ["drizzle-orm", "drizzle-kit"], "domain": "backend"},

    # === Frontend ===
    "next-best-practices":             {"triggers": ["next"], "domain": "frontend"},
    "next-cache-components":           {"triggers": ["next"], "domain": "frontend"},
    "vercel-react-best-practices":     {"triggers": ["react", "next"], "domain": "frontend"},
    "vercel-composition-patterns":     {"triggers": ["react"], "domain": "frontend"},
    "shadcn":                          {"triggers": ["components.json", "@radix-ui/react-slot"], "domain": "frontend"},
    "tailwind-design-system":          {"triggers": ["tailwindcss", "class-variance-authority"], "domain": "frontend"},
    "auth0-nextjs":                    {"triggers": ["@auth0/nextjs-auth0"], "domain": "frontend"},
    "auth0-react":                     {"triggers": ["@auth0/auth0-react"], "domain": "frontend"},
    "authjs-skills":                   {"triggers": ["next-auth", "@auth/core"], "domain": "frontend"},
    "tanstack-query":                  {"triggers": ["@tanstack/react-query"], "domain": "frontend"},
    "tanstack-router":                 {"triggers": ["@tanstack/react-router"], "domain": "frontend"},
    "tanstack-start":                  {"triggers": ["@tanstack/react-start"], "domain": "frontend"},
    "tanstack-table":                  {"triggers": ["@tanstack/react-table"], "domain": "frontend"},

    # === Mobile ===
    "building-native-ui":              {"triggers": ["expo-router", "expo"], "domain": "mobile"},
    "native-data-fetching":            {"triggers": ["expo-router", "@tanstack/react-query"], "domain": "mobile"},
    "expo-deployment":                 {"triggers": ["expo", "eas-cli"], "domain": "mobile"},
    "expo-tailwind-setup":             {"triggers": ["expo", "nativewind"], "domain": "mobile"},
    "eas-update-insights":             {"triggers": ["expo-updates"], "domain": "mobile"},
    "react-native-best-practices":     {"triggers": ["react-native", "expo"], "domain": "mobile"},
    "vercel-react-native-skills":      {"triggers": ["react-native", "expo"], "domain": "mobile"},
    "auth0-expo":                      {"triggers": ["react-native-auth0", "expo"], "domain": "mobile"},
    "auth0-react-native":              {"triggers": ["react-native-auth0"], "domain": "mobile"},

    # === Edge / Serverless ===
    "cloudflare":                      {"triggers": ["wrangler", "@cloudflare/workers-types"], "domain": "edge"},
    "workers-best-practices":          {"triggers": ["wrangler"], "domain": "edge"},
    "wrangler":                        {"triggers": ["wrangler"], "domain": "edge"},
    "durable-objects":                 {"triggers": ["@cloudflare/workers-types"], "domain": "edge"},
    "agents-sdk":                      {"triggers": ["@cloudflare/agents"], "domain": "edge"},

    # === Product / BA / PM (planner-domain) ===
    "prd-development":                 {"triggers": [], "domain": "product"},
    "user-story":                      {"triggers": [], "domain": "product"},
    "user-story-splitting":            {"triggers": [], "domain": "product"},
    "prioritization-advisor":          {"triggers": [], "domain": "product"},
    "roadmap-planning":                {"triggers": [], "domain": "product"},
    "business-analyst":                {"triggers": [], "domain": "product"},
    "create-specification":            {"triggers": [], "domain": "product"},

    # === Workflow (always relevant) ===
    "to-prd":                          {"triggers": [], "domain": "workflow"},
    "webapp-testing":                  {"triggers": ["playwright"], "domain": "workflow"},
    "javascript-testing-patterns":     {"triggers": ["jest", "vitest", "@testing-library/react"], "domain": "workflow"},
    "code-review-excellence":          {"triggers": [], "domain": "workflow"},
    "performance":                     {"triggers": [], "domain": "workflow"},
    "accessibility":                   {"triggers": [], "domain": "workflow"},
    "refactor":                        {"triggers": [], "domain": "workflow"},
    "systematic-debugging":            {"triggers": [], "domain": "workflow"},
    "typescript-advanced-types":       {"triggers": ["typescript"], "domain": "workflow"},
    "find-skills":                     {"triggers": [], "domain": "workflow"},
    "validate-skills":                 {"triggers": [], "domain": "workflow"},
    "test-driven-development":         {"triggers": ["jest", "vitest", "@testing-library/react", "playwright"], "domain": "workflow"},
    "verification-before-completion":  {"triggers": [], "domain": "workflow"},
    "playwright-best-practices":       {"triggers": ["playwright", "@playwright/test"], "domain": "workflow"},
    "improve-codebase-architecture":   {"triggers": [], "domain": "workflow"},

    # === DevOps / Monitoring ===
    "github":                          {"triggers": [], "domain": "devops"},
    "github-actions":                  {"triggers": [".github/workflows"], "domain": "devops"},
    "turborepo":                       {"triggers": ["turbo", "turbo.json"], "domain": "devops"},
    "sentry-sdk-setup":                {"triggers": ["@sentry/node", "@sentry/react", "@sentry/browser", "@sentry/nextjs"], "domain": "devops"},
    "sentry-react-sdk":                {"triggers": ["@sentry/react"], "domain": "devops"},
    "sentry-workflow":                 {"triggers": ["@sentry/node", "@sentry/react", "@sentry/browser"], "domain": "devops"},
}

# Domains to render (in order)
DOMAIN_ORDER = ["product", "backend", "frontend", "mobile", "edge", "workflow", "devops", "other"]


def parse_frontmatter(content):
    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        return ""
    fm = fm_match.group(1)
    desc_match = re.search(
        r"^description:\s*(.+?)(?:\n[a-z]|\n---|\Z)",
        fm,
        re.DOTALL | re.MULTILINE,
    )
    if not desc_match:
        return ""
    desc = desc_match.group(1).strip()
    desc = desc.split("\n")[0][:180]
    return desc.strip("\"\\>|- ")


def main():
    with open("skills-lock.json") as f:
        lock = json.load(f)

    skills_dir = "template/skills"
    entries = []

    for name in sorted(os.listdir(skills_dir)):
        skill_path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.exists(skill_path):
            continue

        with open(skill_path) as f:
            content = f.read()

        description = parse_frontmatter(content)
        source = lock["skills"].get(name, {}).get("source", "unknown")
        meta = META.get(name, {"triggers": [], "domain": "other"})

        entries.append({
            "name": name,
            "source": source,
            "domain": meta["domain"],
            "triggers": meta["triggers"],
            "description": description,
        })

    # Group by domain
    domains = {}
    for e in entries:
        domains.setdefault(e["domain"], []).append(e)

    # Warn if any skill has no META entry
    missing = [e["name"] for e in entries if e["name"] not in META]
    if missing:
        print("# WARNING: skills missing META entry (using default domain=other):", file=sys.stderr)
        for n in missing:
            print("#   - " + n, file=sys.stderr)

    # Render
    out = []
    out.append("# Caw Skills Catalog")
    out.append("")
    out.append("Auto-generated from `template/skills/` via `cli/generate-catalog.sh`. Do not edit manually.")
    out.append("")
    out.append("**Total:** " + str(len(entries)) + " skills")
    out.append("")
    out.append("## Format")
    out.append("")
    out.append("LLM (`setup` agent) parses the YAML block below to map detected stack → available skill.")
    out.append("Each entry has:")
    out.append("- `name` — skill folder name in `template/skills/<name>/`")
    out.append("- `source` — origin GitHub repo (for provenance)")
    out.append("- `triggers` — npm/pip dep names or file patterns that should activate this skill")
    out.append("- `domain` — product / backend / frontend / mobile / edge / workflow / devops")
    out.append("- `description` — one-line summary from SKILL.md frontmatter")
    out.append("")
    out.append("## Catalog")
    out.append("")
    out.append("```yaml")
    out.append("skills:")
    for domain in DOMAIN_ORDER:
        if domain not in domains:
            continue
        out.append("")
        out.append("  # === " + domain + " ===")
        for e in domains[domain]:
            safe_desc = e["description"].replace("\"", "\\\"")
            out.append("  - name: " + e["name"])
            out.append("    source: " + e["source"])
            out.append("    domain: " + e["domain"])
            if e["triggers"]:
                triggers_yaml = ", ".join(["\"" + t + "\"" for t in e["triggers"]])
                out.append("    triggers: [" + triggers_yaml + "]")
            else:
                out.append("    triggers: []")
            out.append("    description: \"" + safe_desc + "\"")
    out.append("```")

    print("\n".join(out))


if __name__ == "__main__":
    main()
