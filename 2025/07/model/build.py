#!/usr/bin/env python3
"""raw -> curated star schema for 2025/07 Customer Satisfaction & Loyalty  (Gate G4).

The raw folder is READ-ONLY. Log every dropped row. Output parquet to data/curated/.

Modelling decisions (evidence in ../analysis/profile.md and ../analysis/insights.md):

  * Grain is ONE ROW PER CUSTOMER: 120 rows. `Customer_ID` IS unique here (120/120) -- the
    first month the standing ID check passes, after May's Transaction_ID and June's Post_ID
    both failed it. We still mint a surrogate key, but the source ID is a real identifier.

  * There is NO DATE COLUMN despite the brief describing "feedback throughout 2024", and no
    order value. So there is no date dimension this month -- building an empty one would
    imply a time analysis the data cannot support.

  * `Satisfaction_Score` is indistinguishable from uniform over 1-10 (chi2 p=0.637). The
    model therefore carries `n` alongside every mean, and a `is_underpowered` flag on any
    grouping whose smallest cell falls below the threshold needed to detect a 1.5-point
    difference. A mean without its n is misleading on this dataset.

  * `Location` is "City.ST" in one field. Split into city and state so the brief's R3
    ("cities or states") can be answered at both levels -- and so the thin-cell problem is
    visible at the level the reader chooses.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

# Below this many customers a group cannot detect a 1.5-point difference at 80% power
# (see insights.md I-4). Groups under it are flagged, never silently averaged.
MIN_POWERED_N = 64

_dropped: list[tuple[str, int, str]] = []


def find_raw() -> Path:
    known = {"analysis", "model", "design", "app", "data", "exports"}
    for d in MONTH_DIR.iterdir():
        if d.is_dir() and d.name not in known and not d.name.startswith("."):
            return d
    raise SystemExit("No raw dataset folder found.")


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    src = pl.read_csv(next(raw.glob("*.csv")))
    print(f"Reading {raw.name}/  ->  {src.height} rows x {src.width} cols")
    src = src.rename({c: c.lower() for c in src.columns})

    assert src.height == 120, "row count changed - every published figure must be revisited"
    assert src["customer_id"].n_unique() == src.height, (
        "customer_id is no longer unique - the standing ID check now FAILS, recheck the grain"
    )
    assert sum(src.null_count().row(0)) == 0, "nulls appeared"

    # ---- dim_location: split "City.ST" so R3 can be answered at either level -----------
    dim_location = (
        src.with_columns(
            city=pl.col("location").str.split(".").list.first(),
            state=pl.col("location").str.split(".").list.last(),
        )
        .group_by(["location", "city", "state"])
        .agg(
            customers=pl.len(),
            latitude=pl.col("latitude").first(),
            longitude=pl.col("longitude").first(),
        )
        .sort("location")
        .with_row_index("location_key", offset=1)
        .with_columns(
            pl.col("location_key").cast(pl.Int32),
            is_underpowered=pl.col("customers") < MIN_POWERED_N,
        )
    )

    dim_factor = (
        src.group_by("satisfaction_factor")
        .agg(customers=pl.len(), mean_score=pl.col("satisfaction_score").mean().round(3))
        .sort("mean_score", descending=True)
        .with_row_index("factor_key", offset=1)
        .with_columns(
            pl.col("factor_key").cast(pl.Int32), is_underpowered=pl.col("customers") < MIN_POWERED_N
        )
    )

    dim_segment = (
        src.group_by(["group", "gender", "loyalty_level", "purchase_history", "support_contacted"])
        .agg(customers=pl.len())
        .sort(["group", "gender", "loyalty_level"])
        .with_row_index("segment_key", offset=1)
        .with_columns(pl.col("segment_key").cast(pl.Int32))
    )

    fct = (
        src.join(
            dim_location.select("location_key", "location", "city", "state"),
            on="location",
            how="left",
        )
        .join(
            dim_factor.select("factor_key", "satisfaction_factor"),
            on="satisfaction_factor",
            how="left",
        )
        .join(
            dim_segment.select(
                "segment_key",
                "group",
                "gender",
                "loyalty_level",
                "purchase_history",
                "support_contacted",
            ),
            on=["group", "gender", "loyalty_level", "purchase_history", "support_contacted"],
            how="left",
        )
        .select(
            pl.int_range(1, pl.len() + 1).cast(pl.Int32).alias("customer_key"),
            pl.col("customer_id").alias("source_customer_id"),
            "location_key",
            "factor_key",
            "segment_key",
            pl.col("satisfaction_score").cast(pl.Int8),
            pl.col("age").cast(pl.Int16),
            "gender",
            "group",
            "loyalty_level",
            "purchase_history",
            "support_contacted",
            "satisfaction_factor",
            "city",
            "state",
            "location",
            pl.col("latitude"),
            pl.col("longitude"),
            # age band, declared here so UI and tests cannot drift
            age_band=pl.when(pl.col("age") < 35)
            .then(pl.lit("25-34"))
            .when(pl.col("age") < 45)
            .then(pl.lit("35-44"))
            .when(pl.col("age") < 55)
            .then(pl.lit("45-54"))
            .otherwise(pl.lit("55-60")),
        )
        .sort("customer_key")
    )

    for k in ("location_key", "factor_key", "segment_key"):
        assert fct[k].null_count() == 0, f"orphan rows on {k}"
    assert fct.height == src.height, "fan-out during the join"

    tables = {
        "fct_customer": fct,
        "dim_location": dim_location,
        "dim_factor": dim_factor,
        "dim_segment": dim_segment,
    }
    for name, df in tables.items():
        df.write_parquet(CURATED / f"{name}.parquet")

    print("\nRow drop log:")
    print(
        "  none - all 120 source rows survive into the fact"
        if not _dropped
        else "\n".join(f"  {a}: {b} - {c}" for a, b, c in _dropped)
    )
    print("\nCurated output:")
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:22s} {pl.read_parquet(p).height:>5,} rows")
    print(
        f"\nReconciliation: mean satisfaction raw {src['satisfaction_score'].mean():.4f}"
        f"  curated {fct['satisfaction_score'].mean():.4f}"
    )
    print(
        f"  underpowered locations: {dim_location['is_underpowered'].sum()}/{dim_location.height}"
    )

    export_app_data(tables)


def export_app_data(tables: dict[str, pl.DataFrame]) -> None:
    """Emit the fact as JSON for the browser. 120 rows - trivially small."""
    import json

    app = MONTH_DIR / "app" / "public" / "data"
    app.mkdir(parents=True, exist_ok=True)
    rows = tables["fct_customer"].drop("location_key", "factor_key", "segment_key")
    dest = app / "customers.json"
    dest.write_text(json.dumps(rows.to_dicts(), separators=(",", ":")), encoding="utf-8")
    for name in tables:
        (app / f"{name}.parquet").write_bytes((CURATED / f"{name}.parquet").read_bytes())
    print(
        f"\nApp data: {dest.relative_to(MONTH_DIR)}  {rows.height} rows, "
        f"{dest.stat().st_size / 1024:.0f} KB"
    )


if __name__ == "__main__":
    main()
