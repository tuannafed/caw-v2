#!/usr/bin/env bash
#
# release.sh — cut a caw plugin release.
#
# Why this exists: Claude Code's `/plugin update` compares the `version` field in
# plugin.json, NOT the git commit. Pushing changes to main without bumping the
# version means installed plugins stay on the old version and never update. This
# script bumps the version everywhere it lives, commits, and pushes — so members
# get the changes with `/plugin marketplace update caw` + `/plugin update caw@caw`.
#
# The marketplace ref tracks `main`, so a push IS the release — there is no tag or
# SHA-pin step.
#
# Usage:
#   ./release.sh patch          # 2.0.1 -> 2.0.2   (default)
#   ./release.sh minor          # 2.0.1 -> 2.1.0
#   ./release.sh major          # 2.0.1 -> 3.0.0
#   ./release.sh 2.4.0          # set an explicit version
#   ./release.sh patch --no-push  # bump + commit locally, skip the push
#
# Bumps: VERSION, plugins/caw/.claude-plugin/plugin.json,
#        .claude-plugin/marketplace.json (metadata.version + plugins[0].version).
# Stdlib + git only.

set -euo pipefail

# ── args ──────────────────────────────────────────────────────────────────────
BUMP="${1:-patch}"
PUSH=1
for arg in "${@:2}"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    *) echo "release: unknown option '$arg'" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEFAULT_BRANCH="main"

say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

VERSION_FILE="VERSION"
PLUGIN_JSON="plugins/caw/.claude-plugin/plugin.json"
MARKET_JSON=".claude-plugin/marketplace.json"

# ── 1. preflight ──────────────────────────────────────────────────────────────
say "Preflight"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "$DEFAULT_BRANCH" ]] || die "not on $DEFAULT_BRANCH (on '$BRANCH'). Switch first."
[[ -z "$(git status --porcelain)" ]] || die "working tree not clean. Commit or stash first."
for f in "$VERSION_FILE" "$PLUGIN_JSON" "$MARKET_JSON"; do
  [[ -f "$f" ]] || die "missing $f"
done
ok "clean tree on $DEFAULT_BRANCH"

# ── 2. compute the new version ────────────────────────────────────────────────
CUR="$(tr -d '[:space:]' < "$VERSION_FILE")"
[[ "$CUR" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "VERSION '$CUR' is not MAJOR.MINOR.PATCH"
IFS='.' read -r MA MI PA <<< "$CUR"

case "$BUMP" in
  patch) NEW="$MA.$MI.$((PA + 1))" ;;
  minor) NEW="$MA.$((MI + 1)).0" ;;
  major) NEW="$((MA + 1)).0.0" ;;
  *)
    [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "argument must be patch|minor|major or an explicit X.Y.Z (got '$BUMP')"
    NEW="$BUMP"
    ;;
esac
[[ "$NEW" != "$CUR" ]] || die "new version equals current ($CUR) — nothing to release"
say "Version $CUR → $NEW"

# ── 3. write the new version everywhere ───────────────────────────────────────
printf '%s\n' "$NEW" > "$VERSION_FILE"

# plugin.json + marketplace.json: rewrite only the version strings, preserving
# formatting and any // note keys (no json round-trip).
CUR="$CUR" NEW="$NEW" python3 - "$PLUGIN_JSON" "$MARKET_JSON" <<'PY'
import os, re, sys, pathlib
cur, new = os.environ["CUR"], os.environ["NEW"]
pat = re.compile(r'("version"\s*:\s*")' + re.escape(cur) + r'(")')
for f in sys.argv[1:]:
    p = pathlib.Path(f)
    text = p.read_text()
    out, n = pat.subn(lambda m: m.group(1) + new + m.group(2), text)
    if n == 0:
        sys.exit(f"release: no \"version\": \"{cur}\" found in {f}")
    p.write_text(out)
    print(f"  {f}: {n} field(s)")
PY
ok "version set to $NEW"

# ── 4. sanity: all four agree + JSON still valid ──────────────────────────────
python3 - "$VERSION_FILE" "$PLUGIN_JSON" "$MARKET_JSON" "$NEW" <<'PY'
import json, sys
vfile, pj, mj, new = sys.argv[1:5]
vals = {
    "VERSION": open(vfile).read().strip(),
    "plugin.json": json.load(open(pj))["version"],
    "marketplace.metadata": json.load(open(mj))["metadata"]["version"],
    "marketplace.plugin": json.load(open(mj))["plugins"][0]["version"],
}
bad = {k: v for k, v in vals.items() if v != new}
if bad:
    sys.exit(f"release: version mismatch after bump: {bad} (expected {new})")
print(f"  all four = {new}, JSON valid")
PY
ok "version fields consistent"

# ── 5. commit ─────────────────────────────────────────────────────────────────
say "Committing"
git add "$VERSION_FILE" "$PLUGIN_JSON" "$MARKET_JSON"
git commit -q -m "$(printf 'Release v%s\n\nBump version so /plugin update picks up the changes since v%s\n(Claude Code compares plugin.json version, not the git commit).\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>' "$NEW" "$CUR")"
ok "committed Release v$NEW"

# ── 6. push ───────────────────────────────────────────────────────────────────
if [[ "$PUSH" == 0 ]]; then
  printf '\n'
  say "Skipped push (--no-push). To finish:"
  echo "    git push origin $DEFAULT_BRANCH"
  exit 0
fi
say "Pushing $DEFAULT_BRANCH"
git push origin "$DEFAULT_BRANCH"
ok "pushed"

printf '\n'
ok "Released v$NEW"
echo "  Members update with:"
echo "    /plugin marketplace update caw"
echo "    /plugin update caw@caw"
echo "  Then restart the Claude Code session to load the new agents/commands/hooks."
