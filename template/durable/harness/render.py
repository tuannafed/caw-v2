"""Output rendering for agents and humans.

Three shapes, all chosen so an agent can consume cheaply:
  - json     : machine-readable, full rows
  - summary  : one compact line per row (avoids dumping JSON into the model)
  - table    : aligned columns for human terminal reading
"""

from __future__ import annotations

import json


def _row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def as_json(rows):
    return json.dumps([_row_to_dict(r) for r in rows], indent=2, ensure_ascii=False)


def as_summary(rows, fields):
    """One line per row: `field=value · field=value`, only the given fields."""
    lines = []
    for r in rows:
        d = _row_to_dict(r)
        parts = [f"{f}={d.get(f)}" for f in fields if f in d]
        lines.append(" · ".join(parts))
    return "\n".join(lines) if lines else "(no rows)"


def as_table(rows, fields):
    if not rows:
        return "(no rows)"
    dicts = [_row_to_dict(r) for r in rows]
    widths = {f: len(f) for f in fields}
    for d in dicts:
        for f in fields:
            widths[f] = max(widths[f], len(str(d.get(f, ""))))
    header = "  ".join(f.ljust(widths[f]) for f in fields)
    sep = "  ".join("-" * widths[f] for f in fields)
    body = "\n".join(
        "  ".join(str(d.get(f, "")).ljust(widths[f]) for f in fields) for d in dicts
    )
    return f"{header}\n{sep}\n{body}"


def emit(rows, fmt, fields):
    if fmt == "json":
        return as_json(rows)
    if fmt == "summary":
        return as_summary(rows, fields)
    return as_table(rows, fields)
