#!/usr/bin/env python3
"""raw -> curated star schema for 2025/06 Social Media Content Performance  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why.
  - Output parquet into data/curated/.

Modelling decisions specific to this month (evidence in ../analysis/profile.md and
../analysis/insights.md):

  * Grain is ONE ROW PER POST: 5,600 posts over 487 days (2024-01-01 -> 2025-05-01).
    A real event table, unlike May's daily summary.

  * `Post_ID` is NOT unique -- 5,000 distinct across 5,600 rows, 557 reused up to 4x.
    Second month running that the source "ID" column is not a key. It is carried as a
    degenerate attribute and NEVER counted; we mint our own `post_key`.

  * THREE OF THE FOUR HEADLINE METRICS ARE DERIVED, and the model says so:
      Impressions     = Views * U(1.1, 1.3)      -> zero independent information
      Engagement      = Engagement_Rate * Views  -> fully determined
      Engagement_Rate = drawn from a uniform band keyed to content tier -> A LABEL
    `Views` is the only free variable. The fact keeps all of them because the brief asks
    for them, but the Malloy model and the UI label which are real. Nothing in this report
    treats the rate as a measurement.

  * `Engagement_Level` disagrees with its own thresholds on 89 rows, all on Instagram (54)
    and LinkedIn (35). We DERIVE the band from the rate and keep the source label alongside
    so the disagreement stays visible rather than being silently corrected.

  * Clicks/CTR availability is a PLATFORM property with one exception: 100% TikTok/Facebook,
    0% YouTube/X.com/Instagram, and LinkedIn decided by post type (Article and Live Stream
    always, Image/Text/Video never, Carousel 25/44 and PDF 4/16 - partial and unexplained).
    It is NOT the clean rule "wherever a post can carry a link"; see insights.md I-5.
    Modelled as an explicit per-row `click_tracking_available` flag so the UI can never
    silently average over absent data and never impute a blank.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

BAND_LOW, BAND_HIGH = 0.10, 0.20

_dropped: list[tuple[str, int, str]] = []


def drop(df: pl.DataFrame, mask: pl.Expr, label: str, why: str) -> pl.DataFrame:
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
    raise SystemExit("No raw dataset folder found.")


def rate_band(col: str = "engagement_rate") -> pl.Expr:
    return (
        pl.when(pl.col(col) < BAND_LOW)
        .then(pl.lit("Low <10%"))
        .when(pl.col(col) < BAND_HIGH)
        .then(pl.lit("Medium 10-20%"))
        .otherwise(pl.lit("High 20%+"))
    )


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
    src = pl.read_excel(xlsx, sheet_id=0)["Sheet1"]
    print(f"  Sheet1: {src.height:,} rows x {src.width} cols")
    src = src.rename({c: c.lower() for c in src.columns})

    assert src.height == 5600, "row count changed - every published figure must be revisited"
    assert src["post_id"].n_unique() < src.height, (
        "post_id is now unique - the documented defect is gone, recheck DQ1"
    )
    for c in ("views", "engagement", "engagement_rate", "platform", "post_type"):
        assert src[c].null_count() == 0, f"nulls appeared in {c}"

    src = drop(src, pl.col("views") <= 0, "views<=0", "no reach, cannot compute a rate")
    src = drop(src, pl.col("engagement_rate") <= 0, "rate<=0", "impossible engagement rate")

    dim_platform = (
        src.group_by("platform")
        .agg(posts=pl.len(), posts_with_clicks=pl.col("clicks").is_not_null().sum())
        .with_columns(
            click_tracking=pl.when(pl.col("posts_with_clicks") == 0)
            .then(pl.lit("none"))
            .when(pl.col("posts_with_clicks") == pl.col("posts"))
            .then(pl.lit("full"))
            .otherwise(pl.lit("partial")),
        )
        .sort("platform")
        .with_row_index("platform_key", offset=1)
        .with_columns(pl.col("platform_key").cast(pl.Int32))
    )

    dim_format = (
        src.group_by("post_type")
        .agg(
            posts=pl.len(),
            median_views=pl.col("views").median().round(0).cast(pl.Int64),
            has_video_metric=(pl.col("video_views") > 0).any(),
            has_live_metric=(pl.col("live_stream_views") > 0).any(),
        )
        .sort("median_views", descending=True)
        .with_row_index("format_key", offset=1)
        .with_columns(
            pl.col("format_key").cast(pl.Int32),
            is_thin_sample=pl.col("posts") < 100,
        )
    )

    dim_content = (
        src.group_by(["content_category", "main_hashtag"])
        .agg(posts=pl.len(), mean_rate=pl.col("engagement_rate").mean().round(5))
        .sort(["content_category", "main_hashtag"])
        .with_row_index("content_key", offset=1)
        .with_columns(pl.col("content_key").cast(pl.Int32))
    )

    dim_region = (
        src.group_by("region")
        .agg(
            latitude=pl.col("latitude").first(),
            longitude=pl.col("longitude").first(),
            posts=pl.len(),
        )
        .sort("region")
        .with_row_index("region_key", offset=1)
        .with_columns(pl.col("region_key").cast(pl.Int32))
    )
    assert dim_region.height == 8

    dim_date = build_dim_date(src["post_date"].min(), src["post_date"].max())

    fct = (
        src.join(dim_platform.select("platform_key", "platform"), on="platform", how="left")
        .join(dim_format.select("format_key", "post_type"), on="post_type", how="left")
        .join(
            dim_content.select("content_key", "content_category", "main_hashtag"),
            on=["content_category", "main_hashtag"],
            how="left",
        )
        .join(dim_region.select("region_key", "region"), on="region", how="left")
        .join(dim_date.select("date_key", "date"), left_on="post_date", right_on="date", how="left")
        .with_columns(
            derived_band=rate_band(),
            source_level=pl.col("engagement_level"),
            click_tracking_available=pl.col("clicks").is_not_null(),
        )
        .with_columns(
            level_disagrees=pl.col("derived_band").str.slice(0, 3)
            != pl.col("source_level").str.slice(0, 3)
        )
        .select(
            pl.int_range(1, pl.len() + 1).cast(pl.Int32).alias("post_key"),
            "date_key",
            "platform_key",
            "format_key",
            "content_key",
            "region_key",
            pl.col("post_id").alias("source_post_id"),
            pl.col("post_published_at"),
            pl.col("post_date"),
            pl.col("post_hour").cast(pl.Int8),
            pl.col("content_type"),
            pl.col("views").cast(pl.Int64),
            pl.col("impressions").cast(pl.Int64),
            pl.col("engagement").cast(pl.Int64),
            pl.col("engagement_rate").cast(pl.Float64),
            pl.col("likes").cast(pl.Int64),
            pl.col("shares").cast(pl.Int64),
            pl.col("comments").cast(pl.Int64),
            pl.col("video_views").cast(pl.Int64),
            pl.col("live_stream_views").cast(pl.Int64),
            pl.col("clicks").cast(pl.Int64),
            pl.col("click_through_rate").cast(pl.Float64),
            "derived_band",
            "source_level",
            "level_disagrees",
            "click_tracking_available",
        )
        .sort("post_date")
    )

    for key in ("date_key", "platform_key", "format_key", "content_key", "region_key"):
        assert fct[key].null_count() == 0, f"orphan rows on {key}"
    assert fct.height == src.height, "fact row count changed during the join - fan-out"
    assert fct["post_key"].n_unique() == fct.height, "post_key is not unique"

    tables = {
        "dim_date": dim_date,
        "dim_platform": dim_platform,
        "dim_format": dim_format,
        "dim_content": dim_content,
        "dim_region": dim_region,
        "fct_post": fct,
    }
    for name, df in tables.items():
        df.write_parquet(CURATED / f"{name}.parquet")

    print("\nRow drop log:")
    print(
        "  none - all 5,600 source rows survive into the fact"
        if not _dropped
        else "\n".join(f"  {lbl}: {n:,} - {w}" for lbl, n, w in _dropped)
    )

    print("\nCurated output:")
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:24s} {pl.read_parquet(p).height:>6,} rows")

    print("\nReconciliation against raw:")
    print(f"  views      raw {src['views'].sum():>14,}   curated {fct['views'].sum():>14,}")
    print(
        f"  engagement raw {src['engagement'].sum():>14,}   curated {fct['engagement'].sum():>14,}"
    )
    print(f"  level disagreements carried through: {fct['level_disagrees'].sum()}")

    export_app_data(tables)


def export_app_data(tables: dict[str, pl.DataFrame]) -> None:
    """Emit the joined star as one JSON file for the browser.

    Same architecture note as 2025/05: docs/STACK.md specifies DuckDB-WASM, whose engine is
    32 MB. 5,600 rows aggregate in well under a millisecond in plain JS against a 3s
    cold-load budget. Nothing is precomputed -- the browser aggregates row-level data at
    query time -- and tools/verify_metrics.py recomputes every rendered figure from the
    PARQUET via DuckDB in Python, so the JS path is checked against a real SQL engine.
    """
    import json

    app_data = MONTH_DIR / "app" / "public" / "data"
    app_data.mkdir(parents=True, exist_ok=True)

    plat = tables["dim_platform"].select("platform_key", "platform", "click_tracking")
    fmt = tables["dim_format"].select("format_key", "post_type", "is_thin_sample")
    cont = tables["dim_content"].select("content_key", "content_category", "main_hashtag")
    reg = tables["dim_region"].select("region_key", "region")
    cal = tables["dim_date"].select("date_key", "month", "month_name", "day_name", "quarter")

    joined = (
        tables["fct_post"]
        .join(plat, on="platform_key")
        .join(fmt, on="format_key")
        .join(cont, on="content_key")
        .join(reg, on="region_key")
        .join(cal, on="date_key")
        .select(
            pl.col("post_date").cast(pl.Utf8).alias("d"),
            "platform",
            "post_type",
            "content_category",
            "main_hashtag",
            "region",
            "content_type",
            "month",
            "month_name",
            "day_name",
            "post_hour",
            "views",
            "impressions",
            "engagement",
            "engagement_rate",
            "likes",
            "shares",
            "comments",
            "video_views",
            "live_stream_views",
            "clicks",
            "click_through_rate",
            "derived_band",
            "click_tracking",
            "is_thin_sample",
            "level_disagrees",
        )
        .sort("d")
    )
    assert joined.height == tables["fct_post"].height, "export fanned out"

    dest = app_data / "posts.json"
    dest.write_text(json.dumps(joined.to_dicts(), separators=(",", ":")), encoding="utf-8")
    for name in ("fct_post", "dim_platform", "dim_format", "dim_content", "dim_region"):
        (app_data / f"{name}.parquet").write_bytes((CURATED / f"{name}.parquet").read_bytes())

    print(
        f"\nApp data: {dest.relative_to(MONTH_DIR)}  {joined.height:,} rows, "
        f"{dest.stat().st_size / 1024:.0f} KB (views {joined['views'].sum():,})"
    )


if __name__ == "__main__":
    main()
