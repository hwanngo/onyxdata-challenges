#!/usr/bin/env python3
"""Fail if a month still contains template scaffolding.

    uv run python tools/check_scaffold.py 2026 07
    uv run python tools/check_scaffold.py --all

WHY THIS EXISTS

`templates/_month/` is copied to start every month, and the copy reports success whether or not
anyone edited it. That is not hypothetical:

  - Two months shipped `assumptions.md` verbatim - provenance blank, and an example
    row reporting "dropped rows with null `region` | 412 (0.3%)" for a column neither dataset
    has. A fabricated statistic, published, in the file whose job is to disclose judgement calls.
  - All five 2026 months shipped `profile.md`'s "Top 5 data quality issues" as five literal
    TODOs. One audit caught two of them; the other three were found only by running
    this check.
  - Three months shipped `app/interact.mjs` byte-identical to the template,
    asserting phone-sales revenue against apps with no such metric - and all three SCORECARDs
    counted the passes. That one is guarded in-file by SCAFFOLD_REWRITTEN; this tool covers
    the documents.

The rule this encodes, from .workbench/docs/LEARNINGS.md: **a scaffolded file that was
never edited is worse than a missing one, because it reports success.** A missing file is
visible. This is not.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Marker -> why it must not survive into a month.
MARKERS: dict[str, str] = {
    "TEMPLATE-UNEDITED": "the file still carries its own delete-me sentinel",
    "<YYYY>/<MM>": "an unsubstituted month placeholder",
    "Fill this in yourself": "a template instruction to the author, addressed to nobody",
    "e.g. dropped rows with null": "the template's FABRICATED example row",
}
# A line that is exactly a numbered TODO, e.g. "3. TODO".
TODO_PREFIXES = tuple(f"{i}. TODO" for i in range(1, 10))

SKIP_DIRS = {"node_modules", "dist", ".git", "__pycache__", "exports", "data"}
SCAN_SUFFIXES = {".md", ".py", ".ts", ".tsx", ".mjs", ".malloy", ".yml"}


def months() -> list[Path]:
    out = []
    for year in sorted(ROOT.glob("20[0-9][0-9]")):
        out += [m for m in sorted(year.iterdir()) if m.is_dir()]
    return out


def scan(month: Path) -> list[str]:
    hits: list[str] = []
    for path in sorted(month.rglob("*")):
        if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
            continue
        if SKIP_DIRS & set(path.relative_to(month).parts):
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(ROOT)
        for n, line in enumerate(lines, 1):
            for marker, why in MARKERS.items():
                if marker in line:
                    hits.append(f"{rel}:{n}  {why}  ({marker})")
            if line.strip().startswith(TODO_PREFIXES):
                hits.append(f"{rel}:{n}  an unfilled numbered TODO  ({line.strip()[:40]})")
    return hits


def main() -> int:
    argv = sys.argv[1:]
    if argv == ["--all"]:
        targets = months()
    elif len(argv) == 2:
        targets = [ROOT / argv[0] / argv[1]]
    else:
        print(__doc__)
        return 2

    total = 0
    for month in targets:
        if not month.is_dir():
            print(f"{month.relative_to(ROOT)}  does not exist")
            return 2
        hits = scan(month)
        label = f"{month.parent.name}/{month.name}"
        if hits:
            total += len(hits)
            print(f"\n{label}  {len(hits)} scaffold marker(s):")
            for h in hits:
                print(f"  {h}")
        else:
            print(f"{label}  clean")

    if total:
        print(
            f"\n{total} scaffold marker(s) left in place.\n"
            "A template file that was never edited reports success. Fill it or delete it."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
