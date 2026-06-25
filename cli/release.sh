#!/usr/bin/env bash
#
# release.sh — cut a caw plugin release.
#
# Does the whole tag-release flow in the correct order so the marketplace SHA
# pin lands in the *tagged* commit (the off-by-one that bit us once: bump must
# be the LAST commit before the tag, never followed by more commits):
#
#   1. Verify a clean tree on the default branch.
#   2. Set the version in VERSION, marketplace.json, plugin.json.
#   3. Bump the marketplace pin to the about-to-be-tagged commit, commit it.
#   4. Dry-run the release gate (same check the CI workflow runs).
#   5. Create an annotated tag on that bump commit.
#   6. Push branch + tag (unless --no-push) → CI release-pin-check verifies it.
#
# Usage:
#   cli/release.sh v2.1.0              # full release: commit, tag, push
#   cli/release.sh v2.1.0 --no-push    # do everything locally, skip the push
#   cli/release.sh v2.1.0 --force      # allow overwriting an existing tag
#
# Stdlib + git only. Run from anywhere inside the repo.

set -euo pipefail

# ── args ──────────────────────────────────────────────────────────────────────
VERSION_TAG="${1:-}"
PUSH=1
FORCE=0
for arg in "${@:2}"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    --force)   FORCE=1 ;;
    *) echo "release: unknown option '$arg'" >&2; exit 1 ;;
  esac
done

if [[ -z "$VERSION_TAG" ]]; then
  echo "usage: cli/release.sh <vX.Y.Z> [--no-push] [--force]" >&2
  exit 1
fi
if [[ ! "$VERSION_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.]+)?$ ]]; then
  echo "release: tag '$VERSION_TAG' must look like vMAJOR.MINOR.PATCH" >&2
  exit 1
fi
VERSION="${VERSION_TAG#v}"   # strip leading 'v' for the version fields

# ── locate repo root ──────────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEFAULT_BRANCH="main"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

say()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. preflight ──────────────────────────────────────────────────────────────
say "Preflight"
[[ "$BRANCH" == "$DEFAULT_BRANCH" ]] || die "not on $DEFAULT_BRANCH (on '$BRANCH'). Switch first."
[[ -z "$(git status --porcelain)" ]] || die "working tree not clean. Commit or stash first."

if git rev-parse -q --verify "refs/tags/$VERSION_TAG" >/dev/null; then
  [[ "$FORCE" == 1 ]] || die "tag $VERSION_TAG already exists. Use --force to overwrite (avoid for published tags)."
  say "tag $VERSION_TAG exists — will overwrite (--force)"
fi
ok "clean tree on $DEFAULT_BRANCH"

# ── 2. set version everywhere ─────────────────────────────────────────────────
say "Setting version → $VERSION"
printf '%s\n' "$VERSION" > VERSION

# Update the two JSON files with a tiny stdlib helper (preserves the files'
# // note keys by only touching version strings via targeted replacement).
python3 - "$VERSION" <<'PY'
import re, sys, pathlib
version = sys.argv[1]
files = [
    pathlib.Path(".claude-plugin/marketplace.json"),
    pathlib.Path("plugins/caw/.claude-plugin/plugin.json"),
]
ver_re = re.compile(r'("version"\s*:\s*")[^"]*(")')
for p in files:
    text = p.read_text()
    new = ver_re.sub(lambda m: m.group(1) + version + m.group(2), text)
    if new != text:
        p.write_text(new)
        print(f"  updated {p}")
PY
ok "version fields set to $VERSION"

# ── 3. bump pin + commit (this commit is the one we tag) ──────────────────────
say "Bumping marketplace pin to the release commit"
# Stage version changes first so the bump commit carries them too.
git add VERSION .claude-plugin/marketplace.json plugins/caw/.claude-plugin/plugin.json
# Pin to the about-to-be-created commit: we bump to HEAD, commit, and the gate's
# --allow-parent accepts the pin (== the new commit's parent).
python3 cli/bump-marketplace-ref.py --write >/dev/null
git add plugins/caw/templates/project/settings.json plugins/caw/project.settings.json

if git diff --cached --quiet; then
  die "nothing to commit — is the version already released?"
fi
git commit -q -m "release: $VERSION_TAG"
RELEASE_SHA="$(git rev-parse HEAD)"
ok "release commit $RELEASE_SHA"

# ── 4. dry-run the gate the CI will run ───────────────────────────────────────
say "Verifying release gate (same check as CI release-pin-check)"
if ! python3 cli/bump-marketplace-ref.py --check --sha "$RELEASE_SHA" --allow-parent; then
  die "release gate failed locally — aborting before tag. The pin does not match."
fi
ok "release gate passes"

# ── 5. tag ────────────────────────────────────────────────────────────────────
say "Tagging $VERSION_TAG"
TAG_FLAGS=(-a "$VERSION_TAG" -m "caw $VERSION_TAG")
[[ "$FORCE" == 1 ]] && TAG_FLAGS=(-f "${TAG_FLAGS[@]}")
git tag "${TAG_FLAGS[@]}" "$RELEASE_SHA"
ok "tag $VERSION_TAG → $RELEASE_SHA"

# ── 6. push ───────────────────────────────────────────────────────────────────
if [[ "$PUSH" == 0 ]]; then
  push_tag_hint="git push origin $VERSION_TAG"
  [[ "$FORCE" == 1 ]] && push_tag_hint+=" --force"
  printf '\n'
  say "Skipped push (--no-push). To finish, run:"
  echo "    git push origin $DEFAULT_BRANCH"
  echo "    $push_tag_hint"
  exit 0
fi

say "Pushing branch + tag"
git push origin "$DEFAULT_BRANCH"
if [[ "$FORCE" == 1 ]]; then
  git push origin "$VERSION_TAG" --force
else
  git push origin "$VERSION_TAG"
fi
ok "pushed $DEFAULT_BRANCH + $VERSION_TAG"

printf '\n'
ok "Released $VERSION_TAG"
echo "  CI 'release-pin-check' will now verify the pin on the tag."
echo "  Members: set ref to \"$VERSION_TAG\" (or $RELEASE_SHA), then:"
echo "    /plugin marketplace update caw"
echo "    /plugin update caw@caw"
