#!/usr/bin/env python3
"""
check-defaults.py — verify a project installed the mandatory default skills.

Reads the canonical list from skills-defaults.yaml (single source of truth — the
setup agent must NOT hardcode it in its prompt) and checks that each default skill
exists under <project>/.agents/skills/. Mechanical pre-flight so a drifted setup
fails loudly instead of silently shipping a partial install (the dava2 lesson:
"product defaults missing → planner aborts").

Stdlib only; a tiny structured-YAML reader (the file shape is fixed, no pyyaml).

Usage:
  ./cli/check-defaults.py <project-path>
  ./cli/check-defaults.py <project-path> --list      # print the canonical list, no project check

Exit codes:
  0 — all unconditional defaults present (or --list)
  1 — bad arguments
  2 — one or more unconditional defaults missing from the project
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULTS_FILE = HERE.parent / "skills-defaults.yaml"


def load_defaults(path=DEFAULTS_FILE):
    """Parse skills-defaults.yaml into {workflow:[...], product:[...], cross_cutting:[...]}.

    Minimal reader for our fixed shape: top-level `key:` headers, `- item` bullets
    (strip trailing `# comment`), and `- name: x` blocks under cross_cutting.
    """
    if not path.is_file():
        sys.exit(f"❌ Missing canonical defaults file: {path}")
    groups = {"workflow": [], "product": [], "cross_cutting": []}
    current = None
    for raw in path.read_text().splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        # top-level group header  (no indent, ends with ':')
        if not line.startswith((" ", "-")) and line.endswith(":"):
            current = line[:-1].strip()
            continue
        if current not in groups:
            continue
        stripped = line.strip()
        if stripped.startswith("- name:"):
            name = stripped.split(":", 1)[1].strip()
            groups[current].append(_clean(name))
        elif stripped.startswith("- "):
            groups[current].append(_clean(stripped[2:]))
    return groups


def _clean(token):
    """Strip inline `# comment` and surrounding whitespace/quotes."""
    token = token.split("#", 1)[0].strip()
    return token.strip("'\"")


def unconditional(groups):
    """workflow + product — the hard floor every project must have."""
    return groups["workflow"] + groups["product"]


def check_project(project_path, groups):
    skills_dir = Path(project_path) / ".agents" / "skills"
    required = unconditional(groups)
    missing = [s for s in required if not (skills_dir / s).is_dir()]
    return required, missing


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project_path", nargs="?", help="path to the target project")
    ap.add_argument("--list", action="store_true", help="print the canonical default list and exit")
    args = ap.parse_args()

    groups = load_defaults()

    if args.list:
        for group in ("workflow", "product", "cross_cutting"):
            print(f"# {group} ({len(groups[group])})")
            for s in groups[group]:
                print(f"  {s}")
        return 0

    if not args.project_path:
        ap.error("project_path is required (or use --list)")

    project = Path(args.project_path).expanduser().resolve()
    if not project.is_dir():
        sys.exit(f"❌ Project path does not exist: {project}")

    required, missing = check_project(project, groups)
    if missing:
        print(f"❌ {len(missing)}/{len(required)} mandatory default skills MISSING from "
              f"{project}/.agents/skills/:")
        for s in missing:
            print(f"   - {s}")
        print("\nRun /caw-setup (or /caw-setup --refresh) to install the full default set.")
        return 2

    print(f"✅ all {len(required)} mandatory default skills present "
          f"({len(groups['workflow'])} workflow + {len(groups['product'])} product).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
