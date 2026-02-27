#!/usr/bin/env python3
"""
Star schema - 2026/02 Pharmacy Sales & Profitability  (Gate G4)

Reads the read-only XLSX, writes parquet to data/curated/. The raw folder is never touched.

The source already ships a star schema, so the work here is not reshaping - it is making the
model unable to express the four wrong answers this dataset invites.

THE SCHEMA ENCODES THE FINDINGS. Five decisions here are arguments, not plumbing:

  1. BRAND IS NOT A PEER OF CATEGORY. All 32 brands sit inside exactly one category, so a
     "brand performance" chart and a "category performance" chart are the same chart with
     different labels. dim_product carries `category` and `brand_within_category`; there is no
     top-level brand dimension for a view to group by as though it were independent evidence.
     The build RAISES if a brand ever spans two categories.

  2. EVERY ROW CARRIES `is_prelaunch`. 6,221 rows sell a product before its LaunchDate - the
     one date rule the README does not state and the generator never enforced. The flag travels
     with the fact so no lifecycle view can silently include those rows, and dim_product carries
     `prelaunch_revenue_share` so the damage is per-product and readable.

  3. STORE COHORT IS A DIMENSION, NOT A WHERE CLAUSE. dim_pharmacy carries `cohort`
     (established / opened_in_window) and `exposure_days`. 98.5% of 2025's "growth" is eleven
     new shops; modelling that as a filter someone has to remember is how the wrong number gets
     published. Same-store is a grouping, always available, never optional.

  4. dim_date CARRIES `is_weekend` AND NAMES IT A TRADING CALENDAR. The weekday effect
     (eta2=0.384) is the only time signal in 731 days, and it is measured on transaction COUNT,
     not size. The column comment says so, because the seasonality the brief asks for does not
     exist (p=0.21) and a smoothed monthly line would imply one.

  5. dim_cut IS THE THESIS AS A TABLE. One row per cut the brief asks about, carrying the
     measured margin-rate spread and the bootstrap 95th percentile for that cut's own group
     sizes. "Does profitability vary here?" is READ from the model rather than recomputed in
     a chart, so the answer cannot drift between panels.

  6. THE GEOGRAPHY HIERARCHY HAS THREE LEVELS, NOT FOUR. The README advertises
     Country -> Region -> City -> PharmacyName, but city is 1:1 with region: 38 regions,
     38 cities, 38 pairs, no region holding two cities and no city in two regions. `city` is
     kept as a display label and is NOT a drill level, because a drill step that cannot
     change the grouping is a dead click on the interaction path the brief asks for by name.
     The build RAISES if the two ever separate.

MARGIN RATE IS ALWAYS SUM(margin)/SUM(revenue), NEVER AVG(rate). Averaging a rate over groups
of wildly different size is the denominator error 2025/12 shipped twice. There is no
row-level margin_pct column in the fact table for a view to average by accident.

The build RAISES if its premises stop holding, including the thesis itself.
"""

from __future__ import annotations

from pathlib import Path
from zlib import crc32

import numpy as np
import polars as pl

f = pl.col

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"
RAW_DIR = MONTH_DIR / "DataDNA-Dataset-Challenge-Pharma-Data-20260102"
SRC = RAW_DIR / "Pharmacy_Data_Challenge_Dataset.xlsx"

WINDOW_START = pl.date(2024, 1, 1)
WINDOW_END = pl.date(2025, 12, 31)

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


def require(cond: bool, msg: str) -> None:
    if not cond:
        raise SystemExit(f"BUILD PREMISE BROKEN: {msg}")


# ---------------------------------------------------------------------------------------
# Dimensions
# ---------------------------------------------------------------------------------------
def build_dim_date(src: pl.DataFrame) -> pl.DataFrame:
    """The source date dimension plus the only time signal the file actually has."""
    d = src.with_columns(f("Date").cast(pl.Date)).rename(
        {
            "DateKey": "date_key",
            "Date": "date",
            "Year": "year",
            "Quarter": "quarter",
            "MonthNumber": "month_num",
            "MonthName": "month_name",
            "YearMonth": "year_month",
        }
    )
    d = d.with_columns(
        day_of_week=f("date").dt.weekday(),
        day_name=f("date").dt.strftime("%a"),
        # Decision 4: named for what it is. Fewer sales LINES are written at weekends; units
        # per transaction show no weekday effect. This is a trading calendar, not demand.
        is_weekend=f("date").dt.weekday() > 5,
    )
    require(d.height == 731, f"dim_date should be 731 rows, got {d.height}")
    require(d["date_key"].n_unique() == d.height, "date_key not unique")
    return d


def build_dim_pharmacy(src: pl.DataFrame) -> pl.DataFrame:
    """Decision 3: cohort and exposure are columns, so same-store is never a forgotten filter."""
    d = src.with_columns(f("OpenDate").str.to_date()).rename(
        {
            "PharmacyID": "pharmacy_key",
            "PharmacyName": "pharmacy_name",
            "Country": "country",
            "Region": "region",
            "City": "city",
            "PharmacyType": "pharmacy_type",
            "OpenDate": "open_date",
            "StoreSizeBand": "store_size_band",
            "Latitude": "latitude",
            "Longitude": "longitude",
        }
    )
    d = d.with_columns(
        cohort=pl.when(f("open_date") < WINDOW_START)
        .then(pl.lit("established"))
        .otherwise(pl.lit("opened_in_window")),
        # Days the store could have traded inside the window. A store that opened in June 2025
        # is not a weak performer, it is a short one - and a raw revenue league table cannot
        # tell the difference.
        exposure_days=(WINDOW_END - pl.max_horizontal(f("open_date"), WINDOW_START)).dt.total_days()
        + 1,
    )
    require(d["pharmacy_key"].n_unique() == d.height, "pharmacy_key not unique")
    require(d.height == 120, f"dim_pharmacy should be 120 rows, got {d.height}")
    require(
        d.filter(f("cohort") == "opened_in_window").height == 11,
        "expected exactly 11 stores opening inside the window",
    )

    # Decision 6, enforced. If city ever separates from region it becomes a real drill level
    # and both dim_cut and the drill path in the UI must gain a step.
    pairs = d.select("region", "city").unique().height
    require(
        pairs == d["region"].n_unique() == d["city"].n_unique(),
        f"city is no longer 1:1 with region ({d['region'].n_unique()} regions, "
        f"{d['city'].n_unique()} cities, {pairs} pairs) - the geography hierarchy has "
        "gained a level and the drill path must gain a step",
    )
    require(
        d.group_by("region").agg(f("country").n_unique().alias("c")).filter(f("c") > 1).height == 0,
        "a region now spans two countries - the geography hierarchy is not a tree",
    )
    return d


def build_dim_product(src: pl.DataFrame) -> pl.DataFrame:
    """Decision 1: brand is modelled INSIDE category, because that is what it is."""
    d = src.with_columns(f("LaunchDate").str.to_date(), f("DiscontinuedDate").str.to_date()).rename(
        {
            "ProductID": "product_key",
            "ProductName": "product_name",
            "Category": "category",
            "Brand": "brand",
            "IsGeneric": "is_generic_raw",
            "PackSize": "pack_size",
            "ListPriceEUR": "list_price_eur",
            "StandardCostEUR": "standard_cost_eur",
            "LaunchDate": "launch_date",
            "IsDiscontinued": "is_discontinued_raw",
            "DiscontinuedDate": "discontinued_date",
        }
    )

    # Decision 1, enforced. If this ever fires, brand has become independent evidence and the
    # model must change before any chart does.
    span = d.group_by("brand").agg(f("category").n_unique().alias("n"))
    require(
        span.filter(f("n") > 1).height == 0,
        "a brand now spans more than one category - brand is no longer nested, "
        "so dim_product must expose it as a real dimension and the UI must stop "
        "presenting category and brand as separate findings",
    )

    d = d.with_columns(
        is_generic=f("is_generic_raw") == "Yes",
        is_discontinued=f("is_discontinued_raw") == "Yes",
        # Nested label. Grouping by this cannot be mistaken for a cross-category comparison.
        brand_within_category=pl.concat_str([f("category"), pl.lit(" · "), f("brand")]),
        launches_in_window=f("launch_date") >= WINDOW_START,
    ).drop("is_generic_raw", "is_discontinued_raw")

    require(d["product_key"].n_unique() == d.height, "product_key not unique")
    require(d.height == 220, f"dim_product should be 220 rows, got {d.height}")
    require(
        d.filter(f("list_price_eur") <= f("standard_cost_eur")).height == 0,
        "a product now lists below cost - the 'no product loses money' finding has changed",
    )
    return d


# ---------------------------------------------------------------------------------------
# Fact
# ---------------------------------------------------------------------------------------
def build_fact(
    src: pl.DataFrame, dim_date: pl.DataFrame, dim_prod: pl.DataFrame, dim_pharm: pl.DataFrame
) -> pl.DataFrame:
    fct = src.rename(
        {
            "SalesID": "sales_key",
            "DateKey": "date_key",
            "PharmacyID": "pharmacy_key",
            "ProductID": "product_key",
            "UnitsSold": "units_sold",
            "RevenueEUR": "revenue_eur",
            "CostEUR": "cost_eur",
            "MarginEUR": "margin_eur",
            "PromoFlag": "promo_flag",
        }
    )

    # The identity the README states. Asserted, not assumed.
    dev = fct.with_columns(
        ((f("revenue_eur") - f("cost_eur")).round(2) - f("margin_eur")).abs().alias("e")
    )["e"].max()
    require(dev == 0.0, f"margin identity broken: max deviation {dev}")

    fct = fct.with_columns(is_promo=f("promo_flag") == "Yes").drop("promo_flag")

    # Decision 2: the pre-launch flag rides on the fact row.
    fct = (
        fct.join(dim_date.select("date_key", "date"), on="date_key", how="left")
        .join(dim_prod.select("product_key", "launch_date"), on="product_key", how="left")
        .with_columns(is_prelaunch=f("date") < f("launch_date"))
        .drop("launch_date")
    )

    require(fct["sales_key"].n_unique() == fct.height, "sales_key not unique")
    require(fct.height == 62_139, f"fact should be 62,139 rows, got {fct.height}")
    require(
        fct.filter(f("is_prelaunch")).height == 6_221,
        "the pre-launch row count has changed from 6,221 - the headline defect moved",
    )
    for key, dim in [
        ("date_key", dim_date),
        ("product_key", dim_prod),
        ("pharmacy_key", dim_pharm),
    ]:
        orphans = fct.join(dim.select(key), on=key, how="anti").height
        require(orphans == 0, f"{key} has {orphans} orphans")

    # No row-level margin_pct column, deliberately. See the module docstring.
    return fct.select(
        "sales_key",
        "date_key",
        "pharmacy_key",
        "product_key",
        "units_sold",
        "revenue_eur",
        "cost_eur",
        "margin_eur",
        "is_promo",
        "is_prelaunch",
        "date",
    )


# ---------------------------------------------------------------------------------------
# Power. A null about volume is only readable if the test could have seen a lift.
# ---------------------------------------------------------------------------------------
# z(0.975) + z(0.80) for a two-sided test at 80% power. Written out rather than imported so
# the constant is visible next to the formula that uses it.
_Z_TWO_SIDED_80 = 1.959964 + 0.841621


def _mde_pct(promo: np.ndarray, non: np.ndarray) -> float:
    """Smallest lift in units/line, as a % of the non-promo mean, detectable at 80% power."""
    n1, n0 = len(promo), len(non)
    sp = np.sqrt(((n1 - 1) * promo.var(ddof=1) + (n0 - 1) * non.var(ddof=1)) / (n1 + n0 - 2))
    return float(100 * _Z_TWO_SIDED_80 * sp * np.sqrt(1 / n1 + 1 / n0) / non.mean())


def _promo_mde_pct(fct: pl.DataFrame) -> float:
    u = fct["units_sold"].to_numpy()
    ip = fct["is_promo"].to_numpy()
    return round(_mde_pct(u[ip], u[~ip]), 2)


def _promo_mde_pct_by_category(fct: pl.DataFrame, dim_prod: pl.DataFrame) -> dict[str, float]:
    """Per-category MDE. Sorted by key so the payload is byte-stable across builds."""
    j = fct.join(dim_prod.select("product_key", "category"), on="product_key")
    out = {}
    for cat in sorted(j["category"].unique().to_list()):
        s = j.filter(f("category") == cat)
        u, ip = s["units_sold"].to_numpy(), s["is_promo"].to_numpy()
        out[cat] = round(_mde_pct(u[ip], u[~ip]), 2)
    return out


# ---------------------------------------------------------------------------------------
# Decision 5 - the thesis as a table
# ---------------------------------------------------------------------------------------
# The bootstrap replication count. ONE definition, shipped to the browser in meta so the
# caption cannot claim a different number than the build ran - it said 400 against a build
# at 1,000 until this was checked.
BOOTSTRAP_REPS = 1000


def bootstrap_spread(
    rev: np.ndarray, mar: np.ndarray, sizes: np.ndarray, label: str, reps: int = BOOTSTRAP_REPS
) -> float:
    """
    95th percentile of the max-min margin-rate spread produced by CHANCE, for a cut whose
    groups have the given sizes.

    THE SEED IS DERIVED FROM THE CUT LABEL, not from a shared counter. Running seven cuts off
    one generator makes each cut's answer depend on how many cuts precede it: dropping the
    City row moved Pharmacy's estimate from 5.54 to 5.37, and analysis/integrity.py - which
    bootstraps only this one cut - got a third number again. Two artifacts disagreeing about
    a published figure is the 2025/10 lesson; a label-derived seed makes both reproduce the
    same value from independent code.
    """
    rng = np.random.default_rng(crc32(label.encode()))
    sizes = np.sort(np.asarray(sizes, dtype=np.intp))  # order-independent by construction:
    # the statistic is a function of the SET of group sizes, but a seeded bootstrap partitions
    # one random draw across them in order, so an unsorted input makes the realised value
    # depend on how the caller happened to group. That is why this file and build.py disagreed
    # (5.75 vs 5.68) even on an identical seed.
    n_total = int(sizes.sum())
    ends = np.cumsum(sizes)
    starts = np.concatenate(([0], ends[:-1])).astype(np.intp)
    out = np.empty(reps)
    for i in range(reps):
        idx = rng.integers(0, len(rev), n_total)
        r = np.add.reduceat(rev[idx], starts)
        m = np.add.reduceat(mar[idx], starts)
        vals = m / r * 100
        out[i] = vals.max() - vals.min()
    return float(np.percentile(out, 95))


def build_dim_cut(
    fct: pl.DataFrame, dim_pharm: pl.DataFrame, dim_prod: pl.DataFrame, reps: int = BOOTSTRAP_REPS
) -> pl.DataFrame:
    """
    One row per cut the brief asks about: the measured margin-rate spread, and the spread
    chance alone produces for that cut's own group sizes.

    This is what makes "profitability does not vary" a readable fact rather than five
    separate assertions scattered across panels.
    """
    j = fct.join(dim_pharm, on="pharmacy_key").join(dim_prod, on="product_key")
    rev, mar = j["revenue_eur"].to_numpy(), j["margin_eur"].to_numpy()

    rows = []
    cuts = [
        ("Store size band", "store_size_band", "structural"),
        ("Pharmacy type", "pharmacy_type", "structural"),
        ("Country", "country", "geographic"),
        # Region only. `city` is 1:1 with it (decision 6), so a City row here would be a
        # duplicate wearing a second label - which is precisely the mistake the model exists
        # to prevent.
        ("Region", "region", "geographic"),
        ("Pharmacy", "pharmacy_key", "geographic"),
        ("Product category", "category", "assortment"),
        ("Promotion", "is_promo", "lever"),
    ]
    for label, col, family in cuts:
        g = j.group_by(col).agg(
            pl.len().alias("n"),
            (f("margin_eur").sum() / f("revenue_eur").sum() * 100).alias("m"),
        )
        obs = float(g["m"].max() - g["m"].min())
        p95 = bootstrap_spread(rev, mar, g["n"].to_numpy(), label, reps)
        rows.append(
            {
                "cut_label": label,
                "cut_family": family,
                "k_groups": g.height,
                "margin_pct_min": float(g["m"].min()),
                "margin_pct_max": float(g["m"].max()),
                "spread_pp": obs,
                "chance_spread_p95_pp": p95,
                # The verdict, computed once, in the model.
                "exceeds_chance": obs > p95,
            }
        )
    out = pl.DataFrame(rows)

    # The thesis, asserted. Geography and structure must NOT exceed chance; the two levers must.
    flat = out.filter(f("cut_family").is_in(["geographic", "structural"]))
    require(
        not flat["exceeds_chance"].any(),
        "a geographic or structural cut now exceeds chance - the thesis "
        "'profitability does not vary by where' no longer holds",
    )
    require(
        out.filter(f("cut_label") == "Product category")["exceeds_chance"][0],
        "product category no longer moves the margin rate",
    )
    require(
        out.filter(f("cut_label") == "Promotion")["exceeds_chance"][0],
        "promotion no longer moves the margin rate",
    )
    return out


def main() -> None:
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {SRC.name}")

    dim_date = build_dim_date(pl.read_excel(SRC, sheet_name="DimDate"))
    dim_pharm = build_dim_pharmacy(pl.read_excel(SRC, sheet_name="DimPharmacy"))
    dim_prod = build_dim_product(pl.read_excel(SRC, sheet_name="DimProduct"))
    fct = build_fact(pl.read_excel(SRC, sheet_name="FactSales"), dim_date, dim_prod, dim_pharm)

    # Nothing is droppable in this file: zero nulls, zero orphans, every identity holds.
    # The pre-launch rows are FLAGGED, never removed - deleting 10% of the book to make a
    # chart tidy is exactly the silent drop rule 4 forbids.
    fct = drop(fct, pl.lit(False), "none", "no row in this file is unusable")

    print("\nComputing dim_cut (bootstrap, 1000 reps, seed per cut label) ...")
    dim_cut = build_dim_cut(fct, dim_pharm, dim_prod)

    for name, df in [
        ("dim_date", dim_date),
        ("dim_pharmacy", dim_pharm),
        ("dim_product", dim_prod),
        ("dim_cut", dim_cut),
        ("fct_sales", fct),
    ]:
        df.write_parquet(CURATED / f"{name}.parquet")

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none - 0 rows dropped, 0 nulls, 0 orphans")

    print()
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name}: {pl.read_parquet(p).height:,} rows")

    print("\ndim_cut - the thesis as a table:")
    with pl.Config(tbl_rows=20, tbl_width_chars=120):
        print(dim_cut)

    write_payload(fct, dim_date, dim_pharm, dim_prod, dim_cut)


def write_payload(
    fct: pl.DataFrame,
    dim_date: pl.DataFrame,
    dim_pharm: pl.DataFrame,
    dim_prod: pl.DataFrame,
    dim_cut: pl.DataFrame,
) -> None:
    """
    Columnar payload for the browser. No DuckDB-WASM: the engine is 32MB against a payload
    measured below, which is the same measured trade 2025/05 recorded.

    MONEY TRAVELS AS INTEGER CENTS, quantised exactly once, here. 2025/11 shipped a parquet
    and a browser payload holding DIFFERENT doubles for the same cents because polars compiles
    `x / 100` to `x * 0.01`; rank tests then tied on bits and the two engines disagreed. The
    assertion below is the fix, not the comment.
    """
    import json

    ph_idx = {k: i for i, k in enumerate(dim_pharm["pharmacy_key"])}
    pr_idx = {k: i for i, k in enumerate(dim_prod["product_key"])}
    dt_idx = {k: i for i, k in enumerate(dim_date["date_key"])}

    rev_c = (fct["revenue_eur"] * 100).round().cast(pl.Int64)
    mar_c = (fct["margin_eur"] * 100).round().cast(pl.Int64)
    # Assert the round-trip, per the 2025/11 lesson. If cents and euros disagree anywhere the
    # browser and the parquet are two different datasets wearing one name.
    back = (rev_c.cast(pl.Float64) / 100).round(2)
    require(
        (back - fct["revenue_eur"].round(2)).abs().max() == 0.0,
        "revenue cents do not round-trip to the parquet euros",
    )
    require(
        int(rev_c.sum()) == 863_397_731,
        f"revenue in cents changed: {int(rev_c.sum())}",
    )

    payload = {
        "n": fct.height,
        # --- fact, columnar -----------------------------------------------------------
        "ph": [ph_idx[k] for k in fct["pharmacy_key"]],
        "pr": [pr_idx[k] for k in fct["product_key"]],
        "dt": [dt_idx[k] for k in fct["date_key"]],
        "u": fct["units_sold"].to_list(),
        "rev": rev_c.to_list(),
        "mar": mar_c.to_list(),
        "promo": [int(x) for x in fct["is_promo"]],
        "pre": [int(x) for x in fct["is_prelaunch"]],
        # --- dimensions ---------------------------------------------------------------
        "pharmacies": dim_pharm.select(
            "pharmacy_key",
            "pharmacy_name",
            "country",
            "region",
            "city",
            "pharmacy_type",
            "store_size_band",
            "cohort",
            "exposure_days",
            "latitude",
            "longitude",
        ).to_dicts(),
        "products": dim_prod.select(
            "product_key",
            "product_name",
            "category",
            "brand",
            "brand_within_category",
            "list_price_eur",
            "is_generic",
            "launches_in_window",
        ).to_dicts(),
        "dates": dim_date.select(
            "year",
            "quarter",
            "month_num",
            "month_name",
            "year_month",
            "day_of_week",
            "day_name",
            "is_weekend",
        ).to_dicts(),
        "cuts": dim_cut.to_dicts(),
        "meta": {
            "lines": fct.height,
            "stores": dim_pharm.height,
            "products": dim_prod.height,
            "countries": dim_pharm["country"].n_unique(),
            "regions": dim_pharm["region"].n_unique(),
            "first": str(dim_date["date"].min()),
            "last": str(dim_date["date"].max()),
            "newStores": int((dim_pharm["cohort"] == "opened_in_window").sum()),
            # Minimum detectable lift in units/line at 80% power, alpha .05, POOLED and then
            # WITHIN each category. The integrity pass found the page publishing the pooled
            # 2.34% beside the claim "lifted volume in none of the five categories" - a
            # per-category claim carrying pooled power. Within a category the floor is 3.5-7.0%,
            # so a real Medical Devices lift of 5% would be invisible. Both are shipped so the
            # page states the right one in the right place.
            "bootstrapReps": BOOTSTRAP_REPS,
            "promoMdePooledPct": _promo_mde_pct(fct),
            "promoMdeByCategoryPct": _promo_mde_pct_by_category(fct, dim_prod),
            # The signature's FIXED domain. Stated here so the chart cannot auto-fit it and
            # manufacture visible variation out of a 4.6pp spread.
            "gridDomain": [24.0, 34.0],
        },
    }
    out = MONTH_DIR / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"\n  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB)")


if __name__ == "__main__":
    main()
