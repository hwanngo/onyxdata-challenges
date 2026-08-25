from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

PROFILE_PATH = Path(__file__).with_name("profile.py")
SPEC = importlib.util.spec_from_file_location("profile_tool", PROFILE_PATH)
assert SPEC is not None and SPEC.loader is not None
profile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(profile)


def test_profile_ignores_unrelated_nested_json_during_key_checks(
    tmp_path: Path, monkeypatch
) -> None:
    month = tmp_path / "2026" / "08"
    raw = month / "raw"
    raw.mkdir(parents=True)
    (raw / "left.csv").write_text("id,label\n1,a\n2,b\n", encoding="utf-8")
    (raw / "right.csv").write_text("id,value\n1,10\n", encoding="utf-8")
    (raw / "schema.json").write_text(
        json.dumps({"schema_version": "1.0", "metadata": {"empty": {}}}),
        encoding="utf-8",
    )

    monkeypatch.setattr(profile, "ROOT", tmp_path)
    monkeypatch.setattr(sys, "argv", ["profile.py", "2026", "08"])

    assert profile.main() == 0
    report = (month / "analysis" / "profile.md").read_text(encoding="utf-8")
    assert "`id` appears in: `left`, `right`" in report
    assert "rows in `left` with no match in `right`: **1**" in report
