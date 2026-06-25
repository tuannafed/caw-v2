"""harness-lint — enforce the bounded-growth rules caw states but couldn't enforce.

dava2 proved a markdown rule ("collapse Resolved to one line") doesn't hold itself;
the backlog grew to 487 lines. This lint makes the rule mechanical: it flags
project-wide files that exceed their line budget and Resolved items that span more
than one line. Returns findings; the CLI exits non-zero when any exist so it can
gate a commit hook.
"""

from __future__ import annotations

from pathlib import Path

# file -> max lines (project-wide files that must stay bounded)
FILE_LIMITS = {
    "harness-backlog.md": 250,
    "test-matrix.md": 300,
}


def _read(path):
    try:
        return path.read_text(errors="replace")
    except OSError:
        return ""


def _resolved_multiline_items(text):
    """In a harness-backlog.md, items under `## Resolved` must be one line each.

    Returns the bullet lines that are followed by non-blank, non-bullet content
    (i.e. an un-collapsed multi-line resolved item).
    """
    lines = text.splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if l.strip().lower() == "## resolved")
    except StopIteration:
        return []

    offenders = []
    i = start + 1
    while i < len(lines):
        line = lines[i]
        if line.startswith("## "):  # next section
            break
        if line.lstrip().startswith("- "):
            # look ahead: the next non-blank line should be another bullet or a heading
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            if j < len(lines):
                nxt = lines[j]
                if not nxt.lstrip().startswith("- ") and not nxt.startswith("## "):
                    offenders.append(line.strip()[:70])
        i += 1
    return offenders


def run(conductor_dir):
    findings = []
    root = Path(conductor_dir)
    if not root.is_dir():
        return findings

    for fname, limit in FILE_LIMITS.items():
        path = root / fname
        if not path.is_file():
            continue
        text = _read(path)
        n = len(text.splitlines())
        if n > limit:
            findings.append({
                "rule": "file-too-long",
                "file": fname,
                "detail": f"{n} lines (limit {limit}) — prune Resolved / move detail "
                          f"into task folders",
            })
        if fname == "harness-backlog.md":
            for item in _resolved_multiline_items(text):
                findings.append({
                    "rule": "resolved-not-collapsed",
                    "file": fname,
                    "detail": f"Resolved item spans multiple lines: {item}",
                })

    return findings


def format_findings(findings):
    if not findings:
        return "✅ harness-lint: bounded-growth rules satisfied."
    lines = [f"harness-lint: {len(findings)} finding(s)", ""]
    for f in findings:
        lines.append(f"  [{f['rule']}] {f['file']}: {f['detail']}")
    return "\n".join(lines)
