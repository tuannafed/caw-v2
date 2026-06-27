#!/usr/bin/env python3
"""Plugin-manifest + structure validator (stdlib only).

Catches the drift classes a multi-agent audit found in this repo:
  - version skew across VERSION / plugin.json / marketplace.json
  - invalid JSON manifests
  - a skill whose frontmatter `name:` doesn't match its folder (breaks `caw:<name>`)
  - a command/agent missing required frontmatter

Run: python plugins/caw/harness/tests/validate_plugin.py
Exits non-zero with a list of problems, 0 when clean. CI runs this alongside pytest.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# this file: plugins/caw/harness/tests/validate_plugin.py
#   parents[0]=tests [1]=harness [2]=caw [3]=plugins [4]=repo-root
PLUGIN = Path(__file__).resolve().parents[2]   # plugins/caw
REPO = Path(__file__).resolve().parents[4]


def _frontmatter(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    return m.group(1) if m else ""


def _fm_field(fm: str, key: str):
    m = re.search(rf"^{key}:\s*(.+)$", fm, re.M)
    return m.group(1).strip() if m else None


def check_versions(problems):
    version = (REPO / "VERSION").read_text().strip()
    plugin = json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text())
    market = json.loads((REPO / ".claude-plugin" / "marketplace.json").read_text())
    if plugin.get("version") != version:
        problems.append(f"plugin.json version {plugin.get('version')!r} != VERSION {version!r}")
    mv = market.get("metadata", {}).get("version")
    if mv != version:
        problems.append(f"marketplace metadata version {mv!r} != VERSION {version!r}")
    for p in market.get("plugins", []):
        if p.get("name") == "caw" and p.get("version") != version:
            problems.append(f"marketplace caw entry version {p.get('version')!r} != VERSION {version!r}")


def check_json(problems):
    for rel in (".claude-plugin/marketplace.json",
                "plugins/caw/.claude-plugin/plugin.json",
                "plugins/caw/templates/project/settings.json"):
        try:
            json.loads((REPO / rel).read_text())
        except (json.JSONDecodeError, OSError) as e:
            problems.append(f"invalid JSON: {rel}: {e}")


def check_skills(problems):
    for skill in sorted((PLUGIN / "skills").glob("*/SKILL.md")):
        folder = skill.parent.name
        fm = _frontmatter(skill)
        name = _fm_field(fm, "name")
        if not name:
            problems.append(f"skill {folder}: missing frontmatter name:")
        elif name != folder:
            problems.append(f"skill {folder}: frontmatter name {name!r} != folder (breaks caw:{folder})")
        if not _fm_field(fm, "description"):
            problems.append(f"skill {folder}: missing frontmatter description:")


def check_agents_commands(problems):
    for agent in sorted((PLUGIN / "agents").glob("*.md")):
        fm = _frontmatter(agent)
        if not _fm_field(fm, "name"):
            problems.append(f"agent {agent.name}: missing frontmatter name:")
        if not _fm_field(fm, "description"):
            problems.append(f"agent {agent.name}: missing frontmatter description:")
    for cmd in sorted((PLUGIN / "commands").glob("*.md")):
        if not _frontmatter(cmd):
            problems.append(f"command {cmd.name}: missing frontmatter block")


def main():
    problems: list[str] = []
    check_versions(problems)
    check_json(problems)
    check_skills(problems)
    check_agents_commands(problems)
    if problems:
        print("✗ plugin validation failed:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("✓ plugin validation passed (versions, JSON, skill/agent/command frontmatter)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
