from __future__ import annotations

import importlib.util
import stat
from pathlib import Path

FETCH_PATH = Path(__file__).with_name("fetch_dataset.py")
SPEC = importlib.util.spec_from_file_location("fetch_dataset_tool", FETCH_PATH)
assert SPEC is not None and SPEC.loader is not None
fetch_dataset = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_dataset)


def test_make_read_only_removes_write_bits_from_every_file(tmp_path: Path) -> None:
    nested = tmp_path / "nested"
    nested.mkdir()
    files = [tmp_path / "root.csv", nested / "child.json"]
    for file in files:
        file.write_text("source", encoding="utf-8")
        assert file.stat().st_mode & (stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH)

    fetch_dataset.make_read_only(tmp_path)

    for file in files:
        assert not file.stat().st_mode & (stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH)


def test_remove_raw_dir_can_replace_a_read_only_archive(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "source.csv").write_text("source", encoding="utf-8")
    fetch_dataset.make_read_only(raw)

    fetch_dataset.remove_raw_dir(raw)

    assert not raw.exists()
