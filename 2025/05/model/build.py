#!/usr/bin/env python3
"""raw -> curated star schema for 2025/05 Mobile Phone Sales  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why. Silent drops produce numbers nobody can reproduce.
  - Output parquet into data/curated/.

Modelling decisions specific to this month (evidence in ../analysis/profile.md):

  * The grain is ONE ROW PER CALENDAR DAY of 2024 -- 366 rows, not 18,548 transactions.
    `Transaction_Date` is the only unique-and-complete column and is the real primary key.
    We name the fact `fct_daily_sales` so the grain is impossible to misread downstream.

  * `Transaction_ID` is NOT unique (303 distinct over 366 rows, 54 reused, one 4x) despite
    the data dictionary calling it "Unique transaction ID". It is carried through as a
    degenerate attribute for traceability but is never counted. There is no customer entity.

  * The shipped `Dim_Products` / `Dim_Locations` sheets are fully redundant with the fact --
    every column already present, 0 orphans both directions. We do NOT inherit them. We build
    conformed dimensions with real surrogate keys instead, so the star is genuine rather than
    decorative, and so `dim_product` can carry the price-ladder attributes the analysis needs.

  * `Operating_System` is 100% determined by `Brand` (Apple<->iOS). Kept on dim_product because
    the brief asks for it (R2), but asserted in build so nobody treats it as independent.

  * Price bands are OUR definition, not the brief's -- declared here once so the UI and the
    tests cannot disagree. See ../assumptions.md.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

# Price bands. Defined once, here, so build/tests/UI cannot drift apart.
BAND_BUDGET, BAND_MID, BAND_PREMIUM = 400, 700, 1000

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


def price_band(col: str = "price") -> pl.Expr:
    return (
        pl.when(pl.col(col) < BAND_BUDGET)
        .then(pl.lit("Budget <$400"))
        .when(pl.col(col) < BAND_MID)
        .then(pl.lit("Mid $400-699"))
        .when(pl.col(col) < BAND_PREMIUM)
        .then(pl.lit("High $700-999"))
        .otherwise(pl.lit("Premium $1000+"))
    )


def band_sort(col: str = "price") -> pl.Expr:
    return (
        pl.when(pl.col(col) < BAND_BUDGET)
        .then(1)
        .when(pl.col(col) < BAND_MID)
        .then(2)
        .when(pl.col(col) < BAND_PREMIUM)
        .then(3)
        .otherwise(4)
    ).cast(pl.Int8)


def build_dim_date(lo, hi) -> pl.DataFrame:
    return pl.DataFrame({"date": pl.date_range(lo, hi, "1d", eager=True)}).with_columns(
        date_key=pl.col("date").dt.strftime("%Y%m%d").cast(pl.Int32),
        year=pl.col("date").dt.year(),
        quarter=pl.col("date").dt.quarter(),
        month=pl.col("date").dt.month(),
        month_name=pl.col("date").dt.strftime("%b"),
        month_start=pl.col("date").dt.truncate("1mo"),
        day_of_week=pl.col("date").dt.weekday(),
        day_name=pl.col("date").dt.strftime("%a"),
        is_weekend=pl.col("date").dt.weekday() > 5,
        iso_week=pl.col("date").dt.week(),
    )


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {raw.name}/")

    xlsx = next(raw.glob("*.xlsx"))
    sheets = pl.read_excel(xlsx, sheet_id=0)
    src = sheets["Fact_Sales"]
    print(f"  Fact_Sales: {src.height:,} rows x {src.width} cols")

    src = src.rename({c: c.lower().replace(" ", "_") for c in src.columns})

    # ---- integrity gates. Assertions, not cleaning. ------------------------------------
    assert src["transaction_date"].n_unique() == src.height, "grain broke: date no longer unique"
    assert sum(src.null_count().row(0)) == 0, "nulls appeared in the raw fact"

    src = drop(src, pl.col("units_sold") <= 0, "units_sold<=0", "not a sale")
    src = drop(src, pl.col("price") <= 0, "price<=0", "impossible price")
    src = drop(
        src,
        pl.col("total_revenue") != pl.col("price") * pl.col("units_sold"),
        "revenue != price*units",
        "arithmetic does not reconcile",
    )

    # ---- dim_product: conformed, carrying the price-ladder attributes ------------------
    # Grain = model. Price varies ~3% within a model (jitter), so list_price is the mean.
    dim_product = (
        src.group_by("mobile_model")
        .agg(
            brand=pl.col("brand").first(),
            operating_system=pl.col("operating_system").first(),
            list_price=pl.col("price").mean().round(0).cast(pl.Int32),
            min_price=pl.col("price").min(),
            max_price=pl.col("price").max(),
            days_traded=pl.len(),
        )
        .with_columns(price_band=price_band("list_price"), price_band_sort=band_sort("list_price"))
        .sort("list_price", descending=True)
        .with_row_index("product_key", offset=1)
        .with_columns(pl.col("product_key").cast(pl.Int32))
        .with_columns(
            # each brand's own ladder, precomputed so the UI never re-derives it
            price_rank_in_brand=pl.col("list_price")
            .rank("dense", descending=True)
            .over("brand")
            .cast(pl.Int8),
            models_in_brand=pl.len().over("brand").cast(pl.Int8),
        )
    )
    assert dim_product["mobile_model"].n_unique() == dim_product.height
    os_per_brand = dim_product.group_by("brand").agg(
        pl.col("operating_system").n_unique().alias("n")
    )
    assert os_per_brand["n"].max() == 1, "Operating_System is no longer determined by Brand"

    # ---- dim_geography: grain = city ---------------------------------------------------
    dim_geography = (
        src.group_by("city")
        .agg(
            country=pl.col("country").first(),
            latitude=pl.col("latitude").first(),
            longitude=pl.col("longitude").first(),
            days_traded=pl.len(),
        )
        .sort(["country", "city"])
        .with_row_index("geography_key", offset=1)
        .with_columns(
            pl.col("geography_key").cast(pl.Int32),
            # below this, city-level comparison is not defensible (profile.md DQ4)
            is_thin_sample=pl.col("days_traded") < 10,
        )
    )
    assert dim_geography["city"].n_unique() == dim_geography.height

    # ---- dim_customer_segment: grain = age_group x gender ------------------------------
    # NOT a customer dimension -- there is no customer entity. Named for what it is.
    dim_customer_segment = (
        src.group_by(["customer_age_group", "customer_gender"])
        .agg(days_traded=pl.len())
        .sort(["customer_age_group", "customer_gender"])
        .with_row_index("segment_key", offset=1)
        .with_columns(pl.col("segment_key").cast(pl.Int32))
    )

    dim_date = build_dim_date(src["transaction_date"].min(), src["transaction_date"].max())

    # ---- fct_daily_sales ----------------------------------------------------------------
    fct = (
        src.join(dim_product.select("product_key", "mobile_model"), on="mobile_model", how="left")
        .join(dim_geography.select("geography_key", "city"), on="city", how="left")
        .join(
            dim_customer_segment.select("segment_key", "customer_age_group", "customer_gender"),
            on=["customer_age_group", "customer_gender"],
            how="left",
        )
        .join(
            dim_date.select("date_key", "date"),
            left_on="transaction_date",
            right_on="date",
            how="left",
        )
        .select(
            "date_key",
            "product_key",
            "geography_key",
            "segment_key",
            pl.col("transaction_date"),
            # degenerate attribute -- carried for traceability, NEVER counted (not unique)
            pl.col("transaction_id").alias("source_transaction_id"),
            pl.col("storage_size"),
            pl.col("color"),
            pl.col("sales_channel"),
            pl.col("payment_type"),
            pl.col("customer_age"),
            pl.col("price").cast(pl.Int32),
            pl.col("units_sold").cast(pl.Int32),
            pl.col("total_revenue").cast(pl.Int64),
        )
        .with_columns(price_band=price_band("price"), price_band_sort=band_sort("price"))
        .sort("transaction_date")
    )

    for key in ("date_key", "product_key", "geography_key", "segment_key"):
        assert fct[key].null_count() == 0, f"orphan rows on {key}"
    assert fct.height == src.height, "fact row count changed during the join - fan-out"

    tables = {
        "dim_date": dim_date,
        "dim_product": dim_product,
        "dim_geography": dim_geography,
        "dim_customer_segment": dim_customer_segment,
        "fct_daily_sales": fct,
    }
    for name, df in tables.items():
        df.write_parquet(CURATED / f"{name}.parquet")

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none - all 366 source rows survive into the fact")

    print("\nCurated output:")
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:30s} {pl.read_parquet(p).height:>6,} rows")

    print("\nReconciliation against raw:")
    print(f"  units   raw {src['units_sold'].sum():>12,}   curated {fct['units_sold'].sum():>12,}")
    print(
        f"  revenue raw {src['total_revenue'].sum():>12,}   curated {fct['total_revenue'].sum():>12,}"
    )

    export_app_data(tables)


def export_app_data(tables: dict[str, pl.DataFrame]) -> None:
    """Emit the joined star as one JSON file for the browser.

    ARCHITECTURE NOTE - a deliberate deviation from docs/STACK.md, recorded in
    .workbench/2025/05/RETRO.md.

    The stack specifies DuckDB-WASM in the browser, chosen so that cross-filtering and
    drill-down stay fast on large data. This month's fact table is 366 rows / 19 KB.
    DuckDB-WASM ships a 32 MB WebAssembly engine, which would blow the stated cold-load
    budget (<3s) by an order of magnitude to query less data than the engine's own symbol
    table. Every aggregate in this report is a group-by over 366 rows -- microseconds in
    plain JavaScript.

    So this month ships the fact table itself and aggregates in memory. Nothing is
    precomputed and nothing is hardcoded: the browser still computes every figure from
    the row-level data at query time, which is what rule 2 requires. The DuckDB-WASM
    client stays in packages/dna-kit for months whose data actually needs it.

    tools/verify_metrics.py independently recomputes every rendered figure from the
    PARQUET via DuckDB in Python, so the JS aggregation path is checked against a real
    SQL engine rather than trusted.
    """
    import json

    app_data = MONTH_DIR / "app" / "public" / "data"
    app_data.mkdir(parents=True, exist_ok=True)

    # Select only what the UI needs from each dimension, so the join cannot collide.
    prod = tables["dim_product"].select(
        "product_key",
        "mobile_model",
        "brand",
        "operating_system",
        "list_price",
        pl.col("price_band").alias("model_band"),
        pl.col("price_band_sort").alias("model_band_sort"),
    )
    geo = tables["dim_geography"].select("geography_key", "city", "country", "is_thin_sample")
    seg = tables["dim_customer_segment"].select(
        "segment_key", "customer_age_group", "customer_gender"
    )
    cal = tables["dim_date"].select("date_key", "month", "month_name", "quarter")

    joined = (
        tables["fct_daily_sales"]
        .join(prod, on="product_key")
        .join(geo, on="geography_key")
        .join(seg, on="segment_key")
        .join(cal, on="date_key")
        .select(
            pl.col("transaction_date").cast(pl.Utf8).alias("d"),
            "mobile_model",
            "brand",
            "operating_system",
            "list_price",
            "model_band",
            "model_band_sort",
            "city",
            "country",
            "is_thin_sample",
            "customer_age_group",
            "customer_gender",
            "month",
            "month_name",
            "quarter",
            "storage_size",
            "color",
            "sales_channel",
            "payment_type",
            "customer_age",
            "price",
            "units_sold",
            "total_revenue",
            "price_band",
            "price_band_sort",
        )
        .sort("d")
    )
    assert joined.height == tables["fct_daily_sales"].height, "export fanned out"

    dest = app_data / "sales.json"
    dest.write_text(json.dumps(joined.to_dicts(), separators=(",", ":")), encoding="utf-8")

    # parquet is still copied over: it is what verify_metrics.py recomputes against
    for name in ("fct_daily_sales", "dim_product", "dim_geography"):
        (app_data / f"{name}.parquet").write_bytes((CURATED / f"{name}.parquet").read_bytes())

    print(
        f"\nApp data: {dest.relative_to(MONTH_DIR)}  "
        f"{joined.height} rows, {dest.stat().st_size / 1024:.0f} KB "
        f"(revenue {joined['total_revenue'].sum():,}, units {joined['units_sold'].sum():,})"
    )


if __name__ == "__main__":
    main()
