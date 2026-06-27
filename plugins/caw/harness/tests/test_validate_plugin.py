"""Run the plugin-manifest validator as part of pytest, so local `pytest` catches
version skew / frontmatter drift too — not just CI."""

import sys
from pathlib import Path

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(Path(__file__).resolve().parent))  # tests/

import validate_plugin  # noqa: E402


def test_plugin_manifests_and_structure_are_valid():
    problems: list[str] = []
    validate_plugin.check_versions(problems)
    validate_plugin.check_json(problems)
    validate_plugin.check_skills(problems)
    validate_plugin.check_agents_commands(problems)
    assert problems == [], "plugin validation problems:\n" + "\n".join(problems)
