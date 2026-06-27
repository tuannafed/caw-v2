"""Anti-drift gate — the "one fact, one store" invariant (caw v2, ADR-0001).

In v2 the durable DB is the single source of truth for STATE (story/task status,
proof results, lane). Prose files (code.md / tests.md / review.md) hold NARRATIVE
only. v1 stated this as a convention and it rotted: story status got restated in
the prose, the copies diverged, and audits had to catch it by hand.

This module makes the invariant mechanical. It scans a story's prose files for
*status declarations* — lines that assert a story/task status that now lives in
the DB — and reports them as drift. The CLI exits non-zero on findings so it can
gate a commit hook, exactly like the bounded-growth lint.

It deliberately flags only STATUS DECLARATIONS, not narrative. "Implemented the
handler" is fine; "status: done" / "task backend: done" / "all tasks complete"
is the DB's job and must not be restated here.
"""

from __future__ import annotations

import re
from pathlib import Path

# Prose files whose JOB is narrative — status must not be declared here.
PROSE_FILES = ("code.md", "tests.md", "review.md")

# DB-owned status vocabulary (story + task). Restating any of these as an
# assertion in prose is drift.
_TASK_STATUSES = ("pending", "in_progress", "in-progress", "blocked", "done")
_STORY_STATUSES = ("planned", "implemented", "changed", "retired")
_PROOF_WORDS = ("pass", "fail", "passed", "failed")

# Patterns that DECLARE state (vs merely mention it in a sentence).
# Each returns the offending fragment when matched.
_PATTERNS = [
    # `status: done`  /  `status = blocked`  (YAML/prose status assignment)
    re.compile(
        r"\bstatus\s*[:=]\s*['\"]?(" + "|".join(_TASK_STATUSES + _STORY_STATUSES) + r")\b",
        re.IGNORECASE,
    ),
    # `task backend: done`  /  `task-key db — done`  (per-task status line)
    re.compile(
        r"\btask[\s:-][\w-]+\s*[:—-]\s*['\"]?(" + "|".join(_TASK_STATUSES) + r")\b",
        re.IGNORECASE,
    ),
    # `last_verified_result: pass`  /  `verify: passed`  (proof restated)
    re.compile(
        r"\b(?:last_verified_result|verify(?:_result)?|proof)\s*[:=]\s*['\"]?("
        + "|".join(_PROOF_WORDS) + r")\b",
        re.IGNORECASE,
    ),
]

# Lines starting with these are quotes/examples, not declarations — skip them so
# a review.md that *quotes* a CLI command or shows an example isn't a false hit.
_SKIP_PREFIXES = ("> ", "    ", "\t", "```", "#", "//", "- e.g", "* e.g")


def _is_declaration(line: str):
    """Return the offending status word if `line` declares DB-owned state."""
    stripped = line.strip()
    if not stripped:
        return None
    # Skip blockquotes, code blocks, indented examples, headings.
    if any(line.startswith(p) for p in _SKIP_PREFIXES):
        return None
    # Skip lines that explicitly point at the DB (they reference, not restate).
    if "harness-cli" in stripped or "harness.db" in stripped:
        return None
    for pat in _PATTERNS:
        m = pat.search(stripped)
        if m:
            return m.group(0)
    return None


def scan_task(task_dir):
    """Scan one story folder's prose files. Returns a list of drift findings."""
    root = Path(task_dir)
    findings = []
    for fname in PROSE_FILES:
        path = root / fname
        if not path.is_file():
            continue
        try:
            lines = path.read_text(errors="replace").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            hit = _is_declaration(line)
            if hit:
                findings.append({
                    "rule": "state-in-prose",
                    "file": f"{root.name}/{fname}",
                    "line": i,
                    "detail": (
                        f"status declared in prose ('{hit}') — state lives in the "
                        f"DB (harness-cli task/story), prose must only reference it"
                    ),
                })
    return findings


def _story_dirs(stories_root):
    """Yield every story folder under <stories_root>, recursing into epics/.

    A story folder is one that holds at least one prose file (plan.md is the
    planner's marker; code/tests/review.md appear as work proceeds). This mirrors
    how the rest of caw v2 detects stories — by content, not an `<NNN>-` prefix —
    and recurses `stories/epics/<epic>/<story>/`.
    """
    markers = ("plan.md",) + PROSE_FILES
    for p in sorted(stories_root.rglob("*")):
        if p.is_dir() and any((p / m).is_file() for m in markers):
            yield p


def run(conductor_dir):
    """Scan every story under <conductor>/stories/ (incl. epics/). Returns findings.

    v2 keeps stories at `docs/caw/stories/` (the v1 `tasks/` layout is gone). The
    `tasks/` fallback is kept only so an un-migrated v1 tree still gets scanned.
    """
    root = Path(conductor_dir)
    stories = root / "stories"
    if not stories.is_dir():
        stories = root / "tasks"          # v1 fallback
        if not stories.is_dir():
            return []
        findings = []
        for story_dir in sorted(p for p in stories.iterdir() if p.is_dir()):
            findings.extend(scan_task(story_dir))
        return findings
    findings = []
    for story_dir in _story_dirs(stories):
        findings.extend(scan_task(story_dir))
    return findings


def format_findings(findings):
    if not findings:
        return "✅ state-drift: no DB-owned status restated in prose files."
    lines = [f"state-drift: {len(findings)} finding(s) — state restated in prose", ""]
    for f in findings:
        lines.append(f"  [{f['rule']}] {f['file']}:{f['line']}: {f['detail']}")
    return "\n".join(lines)
