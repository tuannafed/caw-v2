#!/usr/bin/env bash
# Regenerates SKILLS-CATALOG.md from template/skills/ + skills-lock.json
#
# Caw maintainer runs this after `npx skills add` or `npx skills update`
# to refresh the catalog that ships to scaffolded projects.
#
# The catalog is the LLM-readable index that the `setup` agent reads
# during /caw-setup to map detected stack to available caw-curated skills.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d "template/skills" ]]; then
  echo "❌ template/skills/ not found. Run from caw repo root." >&2
  exit 1
fi

if [[ ! -f "skills-lock.json" ]]; then
  echo "❌ skills-lock.json not found." >&2
  exit 1
fi

PYTHON="${PYTHON:-/usr/bin/python3}"

"$PYTHON" "$(dirname "${BASH_SOURCE[0]}")/generate-catalog.py" > SKILLS-CATALOG.md

n_skills=$(ls template/skills/ | wc -l | tr -d ' ')
echo "✅ Generated SKILLS-CATALOG.md ($n_skills skills)"
echo "   Edit triggers/domain in cli/generate-catalog.py if needed."
