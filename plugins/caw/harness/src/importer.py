"""harness-cli import — migrate caw v1 markdown state into harness.db.

caw v1 kept state in markdown: stories/<id>/overview.yaml, decisions/NNNN.md,
harness-backlog.md. This one-time importer reads them and writes the equivalent
DB rows so a v1 project (e.g. dava2, 80 stories) stops depending on markdown state.

Idempotent: skips rows that already exist (by id). Never deletes markdown.
No external YAML dependency — a minimal field-scanner reads the flat keys we need
(overview.yaml is shallow: top-level keys + a `tasks:` list of `- id:`/`status:`).
"""

from __future__ import annotations

import re
from pathlib import Path

# caw v1 lane → v2 lane
LANE_MAP = {"tiny": "tiny", "standard": "normal", "risky": "high_risk",
            "normal": "normal", "high_risk": "high_risk"}
# v1 story status strings → v2 story status
STORY_STATUS_MAP = {
    "pending": "planned", "plan-done": "planned", "coding": "in_progress",
    "code-done": "in_progress", "testing": "in_progress", "tests-done": "in_progress",
    "tests-skipped": "in_progress", "reviewing": "in_progress",
    "review-done": "implemented", "needs-rework": "in_progress",
    "blocked": "in_progress", "done": "implemented",
}
TASK_STATUS_MAP = {
    "pending": "pending", "done": "done", "needs-rework": "blocked",
    "blocked": "blocked", "in-progress": "in_progress", "skipped": "done",
}
DECISION_STATUS_MAP = {
    "proposed": "proposed", "accepted": "accepted",
    "superseded": "superseded", "rejected": "rejected",
}


def _top_key(text, key):
    """First top-level `key: value` (no indentation) in a flat YAML-ish doc."""
    m = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", text, re.MULTILINE)
    if not m:
        return None
    return m.group(1).strip().strip("'\"")


def _parse_overview(text):
    """Return (story_dict, [task_dict]) from an overview.yaml's flat structure."""
    story = {
        "id": _top_key(text, "id"),
        "title": _top_key(text, "title"),
        "status": _top_key(text, "status"),
        "lane": _top_key(text, "lane"),
    }
    # tasks: a list of `  - id: X` blocks each possibly with a `status:`
    tasks = []
    in_tasks = False
    cur = None
    for line in text.splitlines():
        if re.match(r"^tasks:\s*$", line):
            in_tasks = True
            continue
        if in_tasks:
            if re.match(r"^\S", line):  # left the tasks block (no indent)
                break
            m = re.match(r"^\s*-\s*id:\s*(.+?)\s*$", line)
            if m:
                if cur:
                    tasks.append(cur)
                cur = {"id": m.group(1).strip().strip("'\""), "status": None}
                continue
            m = re.match(r"^\s+status:\s*(.+?)\s*$", line)
            if m and cur:
                cur["status"] = m.group(1).strip().strip("'\"")
    if cur:
        tasks.append(cur)
    return story, tasks


def _import_stories(conn, conductor, report):
    stories_dir = Path(conductor) / "tasks"
    if not stories_dir.is_dir():
        return
    for d in sorted(p for p in stories_dir.iterdir() if p.is_dir()):
        ov = d / "overview.yaml"
        if not ov.is_file():
            continue
        story, tasks = _parse_overview(ov.read_text(errors="replace"))
        if not story["id"]:
            continue
        if conn.execute("SELECT 1 FROM story WHERE id=?", (story["id"],)).fetchone():
            report["stories_skipped"] += 1
            continue
        lane = LANE_MAP.get(story["lane"] or "", "normal")
        status = STORY_STATUS_MAP.get(story["status"] or "", "planned")
        plan = d / "plan.md"
        conn.execute(
            "INSERT INTO story (id,title,risk_lane,status,contract_doc) VALUES (?,?,?,?,?)",
            (story["id"], story["title"] or story["id"], lane, status,
             str(plan) if plan.is_file() else None),
        )
        report["stories"] += 1
        for tk in tasks:
            if not tk["id"]:
                continue
            conn.execute(
                "INSERT OR IGNORE INTO task (story_id,task_key,status) VALUES (?,?,?)",
                (story["id"], tk["id"], TASK_STATUS_MAP.get(tk["status"] or "", "pending")),
            )
            report["tasks"] += 1


def _import_decisions(conn, conductor, report):
    dec_dir = Path(conductor) / "decisions"
    if not dec_dir.is_dir():
        return
    for f in sorted(dec_dir.glob("[0-9]*.md")):
        did = f.name.split("-", 1)[0]
        if conn.execute("SELECT 1 FROM decision WHERE id=?", (did,)).fetchone():
            report["decisions_skipped"] += 1
            continue
        text = f.read_text(errors="replace")
        # title from first `# NNNN Title`; status from `## Status\n\n<word>`
        title_m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        status_m = re.search(r"##\s+Status\s*\n+\s*([A-Za-z]+)", text)
        status = DECISION_STATUS_MAP.get(
            (status_m.group(1).lower() if status_m else "proposed"), "proposed")
        conn.execute(
            "INSERT INTO decision (id,title,status,doc_path) VALUES (?,?,?,?)",
            (did, title_m.group(1).strip() if title_m else did, status, str(f)),
        )
        report["decisions"] += 1


def _import_backlog(conn, conductor, report):
    bl = Path(conductor) / "harness-backlog.md"
    if not bl.is_file():
        return
    text = bl.read_text(errors="replace")
    # Open items live under the `## Items` HEADING as `### <title>` blocks, up to
    # the `## Resolved` HEADING. Both must be matched as real headings (line-start),
    # not prose mentions — dava2's file mentions "## Resolved" inside instructions
    # long before the actual heading, which naive split() truncated.
    items_h = re.search(r"^##\s+Items\s*$", text, re.MULTILINE)
    if not items_h:
        return
    after = text[items_h.end():]
    resolved_h = re.search(r"^##\s+Resolved\s*$", after, re.MULTILINE)
    block = after[: resolved_h.start()] if resolved_h else after
    for title in re.findall(r"^###\s+(.+)$", block, re.MULTILINE):
        title = title.strip()
        # skip the template placeholder if present
        if title.startswith("<") and title.endswith(">"):
            continue
        if conn.execute("SELECT 1 FROM backlog WHERE title=?", (title,)).fetchone():
            report["backlog_skipped"] += 1
            continue
        conn.execute(
            "INSERT INTO backlog (title,risk,status,discovered_while) VALUES (?,?,?,?)",
            (title[:200], "normal", "proposed", "imported from harness-backlog.md"),
        )
        report["backlog"] += 1


def run(conn, conductor, dry_run=False):
    report = {k: 0 for k in (
        "stories", "tasks", "decisions", "backlog",
        "stories_skipped", "decisions_skipped", "backlog_skipped")}
    if dry_run:
        # Count what WOULD import without writing: use a throwaway in-memory copy.
        import sqlite3
        mem = sqlite3.connect(":memory:")
        mem.row_factory = sqlite3.Row
        for line in conn.iterdump():
            mem.execute(line) if line.strip() and not line.startswith("COMMIT") else None
        mem.commit()
        _import_stories(mem, conductor, report)
        _import_decisions(mem, conductor, report)
        _import_backlog(mem, conductor, report)
        mem.close()
    else:
        _import_stories(conn, conductor, report)
        _import_decisions(conn, conductor, report)
        _import_backlog(conn, conductor, report)
        conn.commit()
    return report


def format_report(report, dry_run):
    head = "import (dry-run) — would write:" if dry_run else "import complete:"
    return "\n".join([
        head,
        f"  stories:   +{report['stories']}  (skipped {report['stories_skipped']} existing)",
        f"  tasks:     +{report['tasks']}",
        f"  decisions: +{report['decisions']}  (skipped {report['decisions_skipped']})",
        f"  backlog:   +{report['backlog']}  (skipped {report['backlog_skipped']})",
    ])
