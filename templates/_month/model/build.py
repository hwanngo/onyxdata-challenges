#!/usr/bin/env python3
"""raw -> curated star schema for <YYYY>/<MM>  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why. Silent drops produce numbers nobody can reproduce.
  - Output parquet into data/curated/.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

_dropped: list[tuple[str, int, str]] = []


def drop(df: pl.DataFrame, mask: pl.Expr, label: str, why: str) -> pl.DataFrame:
    """Drop rows, loudly."""
    before = df.height
    out = df.filter(~mask)
    n = before - out.height
    if n:
        _dropped.append((label, n, why))
        print(f"  dropped {n:,} rows - {label}: {why}")
    return out


def find_raw() -> Path:
    known = {"analysis", "model", "design", "app", "data", "exports"}
    for d in MONTH_DIR.iterdir():
        if d.is_dir() and d.name not in known and not d.name.startswith("."):
            return d
    raise SystemExit("No raw dataset folder found. Run `just fetch YYYY MM` first.")


def build_dim_date(lo, hi) -> pl.DataFrame:
    return pl.DataFrame({"date": pl.date_range(lo, hi, "1d", eager=True)}).with_columns(
        year=pl.col("date").dt.year(),
        quarter=pl.col("date").dt.quarter(),
        month=pl.col("date").dt.month(),
        month_name=pl.col("date").dt.strftime("%b"),
        day_of_week=pl.col("date").dt.weekday(),
        day_name=pl.col("date").dt.strftime("%a"),
        is_weekend=pl.col("date").dt.weekday() > 5,
        iso_week=pl.col("date").dt.week(),
    )


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {raw.name}/")

    # TODO: load raw tables
    # src = pl.read_csv(raw / "....csv")

    # TODO: canonicalise categories, fix types, resolve the grain
    # TODO: drop() anything unusable, with a reason

    # TODO: write conformed dimensions and the fact table
    # dim_date.write_parquet(CURATED / "dim_date.parquet")
    # fct_x.write_parquet(CURATED / "fct_x.parquet")

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none")

    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name}: {pl.read_parquet(p).height:,} rows")


if __name__ == "__main__":
    main()
