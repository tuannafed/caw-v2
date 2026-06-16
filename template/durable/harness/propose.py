"""Improvement proposal generator — friction + audit drift → backlog proposals.

Ported from repository-harness (Phase 5 US-024 / IMPROVEMENT_PROTOCOL.md). Rule-
based (no model call): it scans recorded friction and audit findings, clusters
repeats, and emits structured proposals with a predicted impact. `--commit` turns
each into a `proposed` backlog row, closing the loop that caw v1 left open (where
"planner-side fix pending" items never became real work).
"""

from __future__ import annotations

import re

from . import audit

# how many times a friction phrase must repeat before it becomes a proposal
FRICTION_REPEAT_THRESHOLD = 2


_STOP = {"the", "a", "an", "to", "of", "and", "had", "was", "is", "it", "i",
         "for", "in", "on", "with", "this", "that", "so", "but", "had", "have"}


def _tokens(text):
    """Significant word set for similarity (lowercased, stopwords + short dropped)."""
    t = re.sub(r"[^a-z0-9 ]+", " ", text.lower())
    return {w for w in t.split() if len(w) > 2 and w not in _STOP}


def _similar(a, b, threshold=0.5):
    """Jaccard overlap of significant tokens — robust to tail wording changes."""
    if not a or not b:
        return False
    inter = len(a & b)
    union = len(a | b)
    return union > 0 and (inter / union) >= threshold


def _friction_proposals(conn):
    rows = conn.execute(
        """SELECT harness_friction FROM trace
            WHERE harness_friction IS NOT NULL
              AND lower(harness_friction) NOT IN ('none','')"""
    ).fetchall()

    # Greedy clustering by token-overlap: a friction joins the first cluster whose
    # representative it is similar to, else it seeds a new cluster.
    clusters = []  # each: {"items": [str], "tokens": set}
    for r in rows:
        text = r["harness_friction"].strip()
        toks = _tokens(text)
        if not toks:
            continue
        for c in clusters:
            if _similar(toks, c["tokens"]):
                c["items"].append(text)
                c["tokens"] |= toks
                break
        else:
            clusters.append({"items": [text], "tokens": set(toks)})

    proposals = []
    for c in clusters:
        items = c["items"]
        if len(items) < FRICTION_REPEAT_THRESHOLD:
            continue
        proposals.append({
            "title": f"Recurring friction: {items[0][:70]}",
            "evidence": f"Reported in {len(items)} traces",
            "current_pain": items[0],
            "predicted_impact": (
                f"Removing this friction should stop it recurring "
                f"(seen {len(items)}× already)."
            ),
            "risk": "normal",
            "source": "friction",
        })
    return proposals


def _audit_proposals(conn, conductor_dir):
    score, findings = audit.run(conn, conductor_dir=conductor_dir)
    proposals = []
    for f in findings:
        if f["count"] == 0:
            continue
        proposals.append({
            "title": f"Resolve drift: {f['label']}",
            "evidence": f"{f['count']} item(s), {f['points']} entropy pts: "
                        + "; ".join(str(d) for d in f["details"][:5]),
            "current_pain": f["label"],
            "predicted_impact": f"Closing this drops entropy by up to {f['points']} pts.",
            "risk": "tiny" if f["weight"] <= 4 else "normal",
            "source": f"audit:{f['key']}",
        })
    return proposals


def generate(conn, conductor_dir=None):
    return _friction_proposals(conn) + _audit_proposals(conn, conductor_dir)


def commit(conn, proposals):
    """Insert proposals as `proposed` backlog rows; skip exact-title duplicates."""
    inserted = 0
    for p in proposals:
        exists = conn.execute(
            "SELECT 1 FROM backlog WHERE title = ? AND status = 'proposed'",
            (p["title"],),
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """INSERT INTO backlog (title, discovered_while, current_pain,
                                    suggested_improvement, risk, status, predicted_impact)
               VALUES (?,?,?,?,?, 'proposed', ?)""",
            (p["title"], p["source"], p["current_pain"], p["evidence"],
             p["risk"], p["predicted_impact"]),
        )
        inserted += 1
    conn.commit()
    return inserted


def format_proposals(proposals):
    if not proposals:
        return "No proposals — no recurring friction and no audit drift. ✅"
    lines = [f"{len(proposals)} proposal(s):", ""]
    for i, p in enumerate(proposals, 1):
        lines += [
            f"{i}. {p['title']}  [{p['risk']}]",
            f"   source:    {p['source']}",
            f"   evidence:  {p['evidence']}",
            f"   predicted: {p['predicted_impact']}",
            "",
        ]
    lines.append("Run `propose --commit` to file these as proposed backlog items.")
    return "\n".join(lines)
