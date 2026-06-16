#!/usr/bin/env python3
"""
match-skills.py — deterministic stack → skill matcher for /caw-setup.

Input:  a project path (Node or Python project, optionally monorepo).
Output: JSON to stdout — every catalog skill whose `triggers` intersect with
        the project's detected deps / file patterns. No LLM judgment involved.

Why this exists: setup agent's Phase 2 was matching by LLM, which led to
missed skills (sentry-react-sdk, playwright, drizzle when in apps/*, etc.).
This script is the ground truth — agent calls it, agent installs whatever
it returns.

Usage:
  ./cli/match-skills.py <project-path>
  ./cli/match-skills.py <project-path> --pretty
  ./cli/match-skills.py <project-path> --names-only      # one skill per line

Reads META dict directly from generate-catalog.py (single source of truth for
triggers). Never parses SKILLS-CATALOG.md (auto-generated, derivative).

Exit codes:
  0 — success (JSON or names emitted)
  1 — bad arguments
  2 — project path doesn't exist or has no package.json/pyproject.toml
"""
import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path


def load_meta():
    """Import META dict from sibling generate-catalog.py."""
    here = Path(__file__).resolve().parent
    cat_py = here / "generate-catalog.py"
    if not cat_py.exists():
        sys.exit(f"❌ Missing sibling file: {cat_py}")
    spec = importlib.util.spec_from_file_location("catalog_gen", cat_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.META


def collect_package_json_deps(project_path: Path) -> set:
    """Union all deps from root package.json + apps/*/packages/*/services/*."""
    deps = set()
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
            deps.update((pkg.get(section) or {}).keys())
    return deps


def collect_python_deps(project_path: Path) -> set:
    """Best-effort extraction from pyproject.toml + requirements*.txt."""
    deps = set()
    pyproject = project_path / "pyproject.toml"
    if pyproject.is_file():
        text = pyproject.read_text(errors="ignore")
        # Match `name = "..."` style and PEP 621 dependencies list.
        for m in re.finditer(r'^\s*"([a-zA-Z0-9_.\-]+)\s*[<>=!~]', text, re.M):
            deps.add(m.group(1).lower())
        for m in re.finditer(r'^\s*([a-zA-Z0-9_.\-]+)\s*=\s*"', text, re.M):
            deps.add(m.group(1).lower())
    for req in project_path.glob("requirements*.txt"):
        try:
            for line in req.read_text(errors="ignore").splitlines():
                line = line.split("#", 1)[0].strip()
                if not line or line.startswith("-"):
                    continue
                name = re.split(r"[<>=!~\[;\s]", line, 1)[0].strip().lower()
                if name:
                    deps.add(name)
        except OSError:
            pass
    return deps


def collect_file_patterns(project_path: Path) -> set:
    """File-based triggers (e.g. `.github/workflows`, `components.json`)."""
    patterns = set()
    checks = {
        ".github/workflows": (project_path / ".github" / "workflows").is_dir(),
        "components.json":   (project_path / "components.json").is_file(),
        "turbo.json":        (project_path / "turbo.json").is_file(),
        "tsconfig.json":     (project_path / "tsconfig.json").is_file(),
    }
    for key, present in checks.items():
        if present:
            patterns.add(key)
    return patterns


def match_skills(project_path: Path, meta: dict) -> dict:
    """For each catalog skill, check if any trigger matches a detected dep or pattern."""
    pkg_deps = collect_package_json_deps(project_path)
    py_deps = collect_python_deps(project_path)
    file_patterns = collect_file_patterns(project_path)

    universe = pkg_deps | py_deps | file_patterns

    matched = []
    for skill_name, info in meta.items():
        triggers = info.get("triggers", []) or []
        if not triggers:
            continue
        hits = [t for t in triggers if t in universe]
        if hits:
            matched.append({
                "skill": skill_name,
                "domain": info.get("domain", "other"),
                "triggers_matched": hits,
            })

    return {
        "project_path": str(project_path),
        "detected": {
            "package_deps": sorted(pkg_deps),
            "python_deps": sorted(py_deps),
            "file_patterns": sorted(file_patterns),
        },
        "matched_skills": sorted(matched, key=lambda x: (x["domain"], x["skill"])),
        "summary": {
            "total_deps": len(pkg_deps) + len(py_deps),
            "total_file_patterns": len(file_patterns),
            "total_matched_skills": len(matched),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project_path", help="Absolute or relative path to the target project")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    parser.add_argument("--names-only", action="store_true", help="Print only skill names, one per line")
    args = parser.parse_args()

    project_path = Path(args.project_path).expanduser().resolve()
    if not project_path.is_dir():
        sys.exit(f"❌ Project path does not exist: {project_path}")

    has_node = (project_path / "package.json").is_file()
    has_py = (project_path / "pyproject.toml").is_file() or any(project_path.glob("requirements*.txt"))
    if not (has_node or has_py):
        sys.exit(f"❌ No package.json or pyproject.toml at {project_path}")

    meta = load_meta()
    result = match_skills(project_path, meta)

    if args.names_only:
        for entry in result["matched_skills"]:
            print(entry["skill"])
    else:
        indent = 2 if args.pretty else None
        json.dump(result, sys.stdout, indent=indent)
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()
