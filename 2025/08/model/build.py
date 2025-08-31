#!/usr/bin/env python3
"""raw -> curated star schema for 2025/08 Fitness Membership Analytics  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why. Silent drops produce numbers nobody can reproduce.
  - Output parquet into data/curated/.

THE SCHEMA ENCODES THE FINDINGS. Three modelling decisions carry the month's analysis:

  1. `access_hours` does NOT get its own dimension. It is 1:1 with `membership_type`
     (verified in analysis/integrity.py check 6), so it is an attribute OF dim_tier. A
     separate dim_access would let the UI offer two filters that are secretly one cut --
     which is the mistake the brief's Q7-vs-Q1 split invites. The star refuses to model
     a distinction the data does not contain.

  2. `subscription_price`, `adjusted_price` and `discount_rate` are NOT copied onto the
     fact. They are lookups from dim_tier / dim_model / dim_discount and live there. Only
     `final_price_monthly` lands on the fact, renamed to carry its unit (assumptions A-1).

  3. `days_per_week` is multi-valued, so it becomes a proper BRIDGE table
     (bri_member_day, one row per member-weekday). Storing it as a delimited string would
     make every weekday question a string-matching exercise; storing it as 7 booleans
     would make "which day is busiest" un-queryable. The bridge fans out on purpose and
     the fan-out is asserted in test_metrics.py rather than left as a trap.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

# The file's own as-of date: max(last_visit_date). See assumptions.md A-5.
AS_OF = pl.date(2025, 7, 22)

# Billing-period multipliers, verified exact in integrity.py check 2.
MODEL_FACTOR = {"Monthly": 1.00, "Quarterly": 0.90, "Early Bird (Annual)": 0.75}
# Nominal commitment length in months -- carried as an ATTRIBUTE so the UI can show the
# alternative revenue reading (assumptions A-1) instead of hiding the 1.43x fork.
MODEL_MONTHS = {"Monthly": 1, "Quarterly": 3, "Early Bird (Annual)": 12}
DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

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
    return (
        pl.DataFrame({"date": pl.date_range(lo, hi, "1d", eager=True)})
        .with_columns(
            year=pl.col("date").dt.year(),
            quarter=pl.col("date").dt.quarter(),
            month_num=pl.col("date").dt.month(),
            month_name=pl.col("date").dt.strftime("%b"),
            year_month=pl.col("date").dt.strftime("%Y-%m"),
            day_of_week=pl.col("date").dt.weekday(),
            day_name=pl.col("date").dt.strftime("%a"),
            is_weekend=pl.col("date").dt.weekday() > 5,
            iso_week=pl.col("date").dt.week(),
        )
        .with_row_index("date_key")
    )


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {raw.name}/")

    src = pl.read_csv(raw / "Fitness_Membership_Analytics_Dataset.csv")
    print(f"  {src.height:,} rows x {src.width} columns")

    # No rows are dropped this month: zero nulls, zero malformed values. The call is kept
    # so the drop log is a real check rather than an omission.
    src = drop(src, pl.col("age").is_null(), "null age", "unusable for any age cut")
    src = drop(
        src,
        pl.col("last_visit_date").str.to_date() < pl.col("join_date").str.to_date(),
        "last_visit before join",
        "impossible tenure",
    )

    src = src.with_columns(
        join_date=pl.col("join_date").str.to_date(),
        last_visit_date=pl.col("last_visit_date").str.to_date(),
    )

    # ---------------------------------------------------------------------------------
    # Dimensions
    # ---------------------------------------------------------------------------------

    # dim_tier absorbs access_hours and subscription_price. See docstring note 1.
    dim_tier = (
        src.group_by("membership_type")
        .agg(
            list_price_monthly=pl.col("subscription_price").first(),
            access_hours=pl.col("access_hours").first(),
            members=pl.len(),
            # asserted here so a source change breaks the BUILD, not a chart
            n_prices=pl.col("subscription_price").n_unique(),
            n_access=pl.col("access_hours").n_unique(),
        )
        .sort("list_price_monthly")
        .with_row_index("tier_key")
    )
    bad = dim_tier.filter((pl.col("n_prices") > 1) | (pl.col("n_access") > 1))
    if bad.height:
        raise SystemExit(
            f"membership_type is no longer 1:1 with price/access:\n{bad}\n"
            "The whole analysis rests on this identity - revisit analysis/profile.md DQ2/DQ4."
        )
    dim_tier = dim_tier.drop("n_prices", "n_access").with_columns(
        tier_rank=pl.col("list_price_monthly").rank("dense").cast(pl.Int32)
    )

    dim_model = (
        src.group_by("subscription_model")
        .agg(members=pl.len())
        .with_columns(
            price_factor=pl.col("subscription_model").replace_strict(MODEL_FACTOR),
            commit_months=pl.col("subscription_model").replace_strict(MODEL_MONTHS),
        )
        .sort("price_factor", descending=True)
        .with_row_index("model_key")
    )

    dim_discount = (
        src.group_by("discount_type")
        .agg(
            discount_rate=pl.col("discount_rate").first(),
            members=pl.len(),
            n_rates=pl.col("discount_rate").n_unique(),
        )
        .sort("discount_rate")
        .with_row_index("discount_key")
    )
    if dim_discount.filter(pl.col("n_rates") > 1).height:
        raise SystemExit("discount_type is no longer 1:1 with discount_rate - see DQ2.")
    dim_discount = dim_discount.drop("n_rates")

    # lat/lon are city centroids, 1:1 with the city name (assumptions A-8).
    dim_location = (
        src.group_by("home_gym_location")
        .agg(
            latitude=pl.col("latitude").first(),
            longitude=pl.col("longitude").first(),
            members=pl.len(),
            n_coords=pl.struct("latitude", "longitude").n_unique(),
        )
        .sort("members", descending=True)
        .with_row_index("location_key")
    )
    if dim_location.filter(pl.col("n_coords") > 1).height:
        raise SystemExit("a city now has more than one coordinate - A-8 no longer holds.")
    dim_location = dim_location.drop("n_coords").with_columns(
        city=pl.col("home_gym_location").str.replace(", CA$", "")
    )

    dim_gender = (
        src.group_by("self_identified_gender")
        .agg(members=pl.len())
        .sort("members", descending=True)
        .with_row_index("gender_key")
    )

    lo = min(src["join_date"].min(), src["last_visit_date"].min())
    hi = max(src["join_date"].max(), src["last_visit_date"].max())
    dim_date = build_dim_date(lo, hi)

    # ---------------------------------------------------------------------------------
    # Fact
    # ---------------------------------------------------------------------------------
    fct = (
        src.with_row_index("member_key")
        .join(dim_tier.select("tier_key", "membership_type"), on="membership_type")
        .join(dim_model.select("model_key", "subscription_model"), on="subscription_model")
        .join(dim_discount.select("discount_key", "discount_type"), on="discount_type")
        .join(dim_location.select("location_key", "home_gym_location"), on="home_gym_location")
        .join(
            dim_gender.select("gender_key", "self_identified_gender"), on="self_identified_gender"
        )
        .join(
            dim_date.select(join_date_key="date_key", date="date"),
            left_on="join_date",
            right_on="date",
        )
        .join(
            dim_date.select(last_visit_date_key="date_key", date="date"),
            left_on="last_visit_date",
            right_on="date",
        )
        .with_columns(
            # The unit is IN THE NAME. assumptions.md A-1: this is an effective monthly rate,
            # and `sum(final_price)` across mixed billing periods is a category error.
            final_price_monthly=pl.col("final_price"),
            tenure_days=(pl.col("last_visit_date") - pl.col("join_date")).dt.total_days(),
            days_since_visit=(AS_OF - pl.col("last_visit_date")).dt.total_days(),
            checkin_minutes=(
                pl.col("avg_time_check_in").str.slice(0, 2).cast(pl.Int32) * 60
                + pl.col("avg_time_check_in").str.slice(3, 2).cast(pl.Int32)
            ),
            checkout_minutes=(
                pl.col("avg_time_check_out").str.slice(0, 2).cast(pl.Int32) * 60
                + pl.col("avg_time_check_out").str.slice(3, 2).cast(pl.Int32)
            ),
            is_minor=pl.col("age") < 18,
            trains_weekend=pl.col("days_per_week").str.contains("Sat|Sun"),
        )
        .with_columns(
            # Peak = 17:00-20:00, the window a gym's "off-peak" tier is meant to exclude.
            uses_peak_hours=(pl.col("checkin_minutes") >= 17 * 60)
            & (pl.col("checkin_minutes") < 20 * 60),
        )
        .select(
            "member_key",
            "tier_key",
            "model_key",
            "discount_key",
            "location_key",
            "gender_key",
            "join_date_key",
            "last_visit_date_key",
            "age",
            "is_minor",
            "visit_per_week",
            "duration_in_gym_minutes",
            "checkin_minutes",
            "checkout_minutes",
            "attend_group_lesson",
            "personal_training",
            "personal_training_hours",
            "uses_sauna",
            "has_drink_subscription",
            "multi_location_access",
            "final_price_monthly",
            "tenure_days",
            "days_since_visit",
            "trains_weekend",
            "uses_peak_hours",
            "join_date",
            "last_visit_date",
        )
    )

    # Bridge: one row per member-weekday. See docstring note 3.
    bridge = (
        src.with_row_index("member_key")
        .select("member_key", "days_per_week", "visit_per_week")
        .with_columns(day_name=pl.col("days_per_week").str.split(", "))
        .explode("day_name")
        .with_columns(
            day_order=pl.col("day_name").replace_strict(
                {d: i for i, d in enumerate(DAY_ORDER)}, return_dtype=pl.Int32
            ),
            is_weekend=pl.col("day_name").is_in(["Sat", "Sun"]),
        )
        .select("member_key", "day_name", "day_order", "is_weekend")
    )
    fanout = bridge.height / fct.height
    print(
        f"  bridge fans out {fct.height:,} members -> {bridge.height:,} member-days "
        f"({fanout:.2f}x). Never join this to a member count without a distinct."
    )

    # ---------------------------------------------------------------------------------
    # Write
    # ---------------------------------------------------------------------------------
    for name, df in [
        ("dim_tier", dim_tier),
        ("dim_model", dim_model),
        ("dim_discount", dim_discount),
        ("dim_location", dim_location),
        ("dim_gender", dim_gender),
        ("dim_date", dim_date),
        ("fct_member", fct),
        ("bri_member_day", bridge),
    ]:
        df.write_parquet(CURATED / f"{name}.parquet")

    export_app_data(fct, dim_tier, dim_model, dim_discount, dim_location, bridge)

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none - zero nulls and zero malformed values in the source")

    print()
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:24} {pl.read_parquet(p).height:>7,} rows")


def export_app_data(fct, dim_tier, dim_model, dim_discount, dim_location, bridge) -> None:
    """Emit the app's data payload as JSON.

    DELIBERATE STACK DEVIATION, carried over from 2025/05 with the same reasoning and the
    same measurement: DuckDB-WASM costs a ~30s cold start and a CORS configuration to query
    a dataset that fits in well under 1 MB of JSON. The rule adopted in May stands -- the
    stack is a default, not a mandate, but a deviation needs a measured number attached.
    All aggregation happens in-browser over plain arrays; the parquet star above remains
    the source of truth that tools/verify_metrics.py checks the rendered DOM against.
    """
    import json

    joined = (
        fct.join(
            dim_tier.select(
                "tier_key", "membership_type", "access_hours", "list_price_monthly", "tier_rank"
            ),
            on="tier_key",
        )
        .join(dim_model.select("model_key", "subscription_model", "commit_months"), on="model_key")
        .join(
            dim_discount.select("discount_key", "discount_type", "discount_rate"), on="discount_key"
        )
        .join(
            dim_location.select("location_key", "city", "latitude", "longitude"), on="location_key"
        )
    )
    # Sort ONCE, here. Everything downstream (members columns, dayMask) is emitted in this
    # exact row order, so the app can zip them by index without carrying a key.
    joined = joined.sort("city", "membership_type", "member_key")

    members = joined.select(
        "membership_type",
        "access_hours",
        "list_price_monthly",
        "subscription_model",
        "commit_months",
        "discount_type",
        "discount_rate",
        "city",
        "age",
        "visit_per_week",
        "duration_in_gym_minutes",
        "checkin_minutes",
        "checkout_minutes",
        "attend_group_lesson",
        "personal_training",
        "personal_training_hours",
        "uses_sauna",
        "has_drink_subscription",
        "multi_location_access",
        "final_price_monthly",
        "tenure_days",
        "days_since_visit",
        "trains_weekend",
        "uses_peak_hours",
    )

    # COLUMNAR, not row-of-objects. 24 key names repeated 1,998 times was 1.2 MB of the
    # 1.6 MB payload -- pure overhead for a file the browser parses on every cold load.
    # Low-cardinality strings are additionally dictionary-encoded: the column ships as an
    # index array plus a levels array, which the app expands once at startup.
    DICT_COLS = {"membership_type", "access_hours", "subscription_model", "discount_type", "city"}

    def encode(df: pl.DataFrame) -> dict:
        out: dict = {}
        for name in df.columns:
            s = df[name]
            if name in DICT_COLS:
                levels = s.unique(maintain_order=True).to_list()
                idx = {v: i for i, v in enumerate(levels)}
                out[name] = {"levels": levels, "codes": [idx[v] for v in s.to_list()]}
            elif s.dtype == pl.Boolean:
                out[name] = [int(v) for v in s.to_list()]  # 1/0 beats true/false
            else:
                out[name] = s.to_list()
        return out

    payload = {
        "n": members.height,
        "members": encode(members),
        # The bridge only needs the per-member day sets; ship them as 7-bit masks rather
        # than 5,347 objects. Bit i is DAY_ORDER[i].
        "dayMask": (
            joined.select("member_key")
            .with_row_index("ord")
            .join(
                bridge.with_columns(bit=pl.lit(2).pow(pl.col("day_order")).cast(pl.Int32))
                .group_by("member_key")
                .agg(mask=pl.col("bit").sum()),
                on="member_key",
                how="left",
            )
            .sort("ord")["mask"]
            .to_list()
        ),
        "dayOrder": DAY_ORDER,
        "cityCoords": {
            r["city"]: [r["latitude"], r["longitude"]]
            for r in dim_location.select("city", "latitude", "longitude").to_dicts()
        },
        "meta": {
            "asOf": "2025-07-22",
            "priceUnit": "effective monthly rate (assumptions.md A-1)",
            "windowDays": 60,
            "sourceRows": 1998,
        },
    }
    out = MONTH_DIR / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"  wrote app/src/data.json  ({kb:,.0f} KB, {payload['n']:,} members, columnar)")


if __name__ == "__main__":
    main()
