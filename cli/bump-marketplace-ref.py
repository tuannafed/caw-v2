#!/usr/bin/env python3
"""Keep the marketplace SHA pin in the project settings templates current.

The `extraKnownMarketplaces.caw.source.ref` field in the scaffolded project
settings pins the caw marketplace to a commit SHA. It must be bumped on every
release, or members install a stale plugin. This script checks or rewrites it.

The settings files contain non-standard `// note` comment keys, so we do NOT
round-trip through json.dumps (that would drop them and reorder). Instead we
read the value with a tolerant parse and rewrite ONLY the `ref` line in place,
preserving byte-for-byte formatting elsewhere.

Usage:
  bump-marketplace-ref.py --check            # exit 2 if any ref != target SHA
  bump-marketplace-ref.py --write            # rewrite ref to target SHA
  bump-marketplace-ref.py --check --sha <X>  # compare against an explicit SHA
  bump-marketplace-ref.py --write --sha <X>  # write an explicit SHA
  bump-marketplace-ref.py --check --sha <X> --allow-parent
                                             # also accept <X>'s parent commit

Default target SHA = `git rev-parse HEAD`. Stdlib only.

Release flow & --allow-parent: the normal flow is `--write` → commit → tag the
bump commit. The bump commit's SHA is not knowable before it exists, so the pin
written into it points at its PARENT (the pre-bump HEAD). The release gate runs
`--check --sha <tag-commit> --allow-parent`, which passes when the pin equals
either the tagged commit or its parent — covering this off-by-one without any
amend/force-tag dance.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Every file that carries the marketplace ref pin. Keep these in sync.
PIN_FILES = [
    REPO_ROOT / "plugins" / "caw" / "templates" / "project" / "settings.json",
    REPO_ROOT / "plugins" / "caw" / "project.settings.json",
]

# Matches the ref line:  "ref": "<40-hex or branch>"  — capturing the value.
REF_RE = re.compile(r'("ref"\s*:\s*")([^"]*)(")')

SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")


def _git(*args) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True
    )


def head_sha() -> str:
    out = _git("rev-parse", "HEAD")
    if out.returncode != 0:
        sys.exit(f"error: `git rev-parse HEAD` failed: {out.stderr.strip()}")
    return out.stdout.strip()


def parent_sha(sha: str) -> str | None:
    """Full SHA of `sha`'s first parent, or None if it has none / git fails."""
    out = _git("rev-parse", "--verify", "--quiet", f"{sha}^")
    sha = out.stdout.strip()
    return sha or None


def read_ref(path: Path) -> str | None:
    """Return the current ref value, or None if the file has no ref line."""
    m = REF_RE.search(path.read_text())
    return m.group(2) if m else None


def write_ref(path: Path, sha: str) -> bool:
    """Rewrite the ref line to `sha`. Returns True if the file changed."""
    text = path.read_text()
    new, n = REF_RE.subn(lambda m: m.group(1) + sha + m.group(3), text)
    if n == 0:
        sys.exit(f"error: no \"ref\" field found in {path}")
    if n > 1:
        sys.exit(f"error: multiple \"ref\" fields in {path}; refusing to guess")
    if new != text:
        path.write_text(new)
        return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description="Check/bump the marketplace SHA pin.")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true",
                      help="fail (exit 2) if any pinned ref != target SHA")
    mode.add_argument("--write", action="store_true",
                      help="rewrite each pinned ref to the target SHA")
    ap.add_argument("--sha", help="target SHA (default: git HEAD)")
    ap.add_argument("--allow-parent", action="store_true",
                    help="with --check: also accept the target SHA's parent "
                         "(covers the bump-commit off-by-one at release time)")
    args = ap.parse_args()

    target = args.sha or head_sha()
    accepted = {target}
    if args.allow_parent:
        p = parent_sha(target)
        if p:
            accepted.add(p)
    if not SHA_RE.match(target):
        # A branch name is a valid ref too, but for release pinning we expect a SHA.
        print(f"warning: target ref '{target}' is not a commit SHA", file=sys.stderr)

    missing = [p for p in PIN_FILES if not p.exists()]
    if missing:
        for p in missing:
            print(f"error: pin file not found: {p}", file=sys.stderr)
        return 1

    if args.check:
        stale = []
        for p in PIN_FILES:
            cur = read_ref(p)
            rel = p.relative_to(REPO_ROOT)
            if cur is None:
                print(f"error: no \"ref\" field in {rel}", file=sys.stderr)
                return 1
            if cur not in accepted:
                stale.append((rel, cur))
        if stale:
            print("✗ marketplace ref is STALE — bump before releasing:", file=sys.stderr)
            for rel, cur in stale:
                print(f"    {rel}", file=sys.stderr)
                print(f"      have: {cur}", file=sys.stderr)
                print(f"      want: {target}", file=sys.stderr)
            print("  Fix: cli/bump-marketplace-ref.py --write", file=sys.stderr)
            return 2
        print(f"✓ marketplace ref matches {target} in all {len(PIN_FILES)} pin file(s)")
        return 0

    # --write
    changed = []
    for p in PIN_FILES:
        if write_ref(p, target):
            changed.append(p.relative_to(REPO_ROOT))
    if changed:
        print(f"✓ bumped marketplace ref to {target}:")
        for rel in changed:
            print(f"    {rel}")
    else:
        print(f"✓ marketplace ref already {target} — no change")
    return 0


if __name__ == "__main__":
    sys.exit(main())
