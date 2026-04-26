#!/usr/bin/env python3
"""
Star schema - 2026/04 International Maritime Logistics & Terminal Efficiency  (Gate G4)

Reads the read-only CSVs, writes parquet to data/curated/. The raw folder is never touched.

This month the model has an unusual job. The source is uniform noise dressed as a star schema,
so the schema's task is not to make analysis convenient - it is to make the WRONG analysis
impossible to express. Five decisions, each an argument:

  1. THERE IS NO PRIMARY KEY, SO THE MODEL DOES NOT PRETEND THERE IS ONE. `movement_id` is a
     uniform draw over 0-1000 with 5-26 rows sharing each value; the dictionary calls it the
     primary key and marks it `Unique: No` in the same table. It is carried as
     `movement_id_raw` - a name that cannot be mistaken for a key - and a real surrogate
     `movement_sk` is generated. The build RAISES if `movement_id_raw` ever becomes unique,
     because then the source has changed and this decision must be revisited.

  2. THE CORRUPT JOIN KEY IS DROPPED, LOUDLY. The fact carries two vessel keys. `vessel_key`
     is the real FK; `vessel_id` is a copy that disagrees with the dimension on 909 of 15,000
     rows. Keeping both invites a join on the wrong one. `vessel_id_disagrees` survives as a
     BOOLEAN so the defect is still countable, and the bad column itself does not.

  3. dim_cut IS THE THESIS AS A TABLE - every axis the brief names, with its measured effect
     on move_duration and the verdict. "Does this predict anything?" is READ from the model,
     so no panel can answer it differently. The build raises if any axis becomes predictive.

  4. dim_year CARRIES THE ONE REAL SIGNAL AND ITS OWN WARNING. Movement count grows
     monotonically and it is the only structured thing here. `is_suez_year` marks 2021 so the
     chart that will be misread is forced to carry the marker that stops the misreading.

  5. NO RATE COLUMN EXISTS ANYWHERE. Not mean duration per terminal, not movements per
     capacity. Every rate this file could express is noise, and a model that cannot compute
     one cannot have it charted. Durations are exposed only as distributions.

The build RAISES if its premises stop holding, including the thesis itself.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from zlib import crc32

import numpy as np
import polars as pl
from scipy import stats

f = pl.col

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"
RAW = (
    MONTH_DIR
    / "DataDNA-Dataset-Challenge-International-Maritime-Logistics-Terminal-Efficiency"
    / "DataDNA Dataset Challenge - International Maritime Logistics  Terminal Efficiency"
    / "data"
)
SUEZ_START, SUEZ_END = "2021-03-23", "2021-03-29"
DAYS = 1461

_dropped: list[tuple[str, int, str]] = []


def drop(df: pl.DataFrame, mask: pl.Expr, label: str, why: str) -> pl.DataFrame:
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


def eta2(groups: list[np.ndarray]) -> float:
    allv = np.concatenate(groups)
    gm = allv.mean()
    return sum(len(g) * (g.mean() - gm) ** 2 for g in groups) / ((allv - gm) ** 2).sum()


# ---------------------------------------------------------------------------------------
# Dimensions
# ---------------------------------------------------------------------------------------
def build_dim_date(src: pl.DataFrame) -> pl.DataFrame:
    d = src.with_columns(f("date_id").str.to_date()).rename({"date_id": "date"})
    d = d.with_columns(
        date_key=f("date").dt.strftime("%Y%m%d").cast(pl.Int32),
        day_of_week=f("date").dt.weekday(),
        # Decision 4: the marker travels with the data so the chart cannot omit it.
        in_suez_week=(f("date") >= pl.lit(SUEZ_START).str.to_date())
        & (f("date") <= pl.lit(SUEZ_END).str.to_date()),
    )
    require(d.height == DAYS, f"dim_date should be {DAYS} rows, got {d.height}")
    require(d["date"].n_unique() == d.height, "date not unique")
    # `shift` is a property of the DAY, not of a work period. Renamed so no view can read it
    # as an operational shift.
    d = d.rename({"shift": "day_label"})
    require(
        set(d["day_label"].unique()) == {"Day", "Night"},
        "day_label values changed",
    )
    return d


def build_dim_terminal(src: pl.DataFrame) -> pl.DataFrame:
    d = src.rename({"terminal_name": "terminal_label"})
    coords = [json.loads(x)["coordinates"] for x in d["port_location"]]
    d = d.with_columns(
        longitude=pl.Series([c[0] for c in coords]),
        latitude=pl.Series([c[1] for c in coords]),
    ).drop("port_location")
    require(d["terminal_id"].n_unique() == d.height, "terminal_id not unique")
    require(d.height == 50, f"dim_terminal should be 50 rows, got {d.height}")
    # The hub label is not geographic - asserted, because a map would imply otherwise.
    gs = [
        d.filter(f("regional_hub") == hb)["longitude"].to_numpy()
        for hb in d["regional_hub"].unique()
    ]
    p = stats.kruskal(*gs).pvalue
    require(
        p > 0.05,
        f"regional_hub now predicts longitude (KW p={p:.4f}) - the hub label has become "
        "geographic and the map may be drawn",
    )
    d = d.with_columns(hub_is_geographic=pl.lit(False))
    return d


def build_dim_vessel(src: pl.DataFrame) -> pl.DataFrame:
    d = src.rename({"vessel_name": "vessel_label", "vessel_id": "vessel_id_dim"})
    require(d["vessel_key"].n_unique() == d.height, "vessel_key not unique")
    require(d.height == 1000, f"dim_vessel should be 1000 rows, got {d.height}")
    d = d.with_columns(vessel_age_2024=2024 - f("build_year"))
    return d


# ---------------------------------------------------------------------------------------
# Fact
# ---------------------------------------------------------------------------------------
def build_fact(
    src: pl.DataFrame, dim_date: pl.DataFrame, dim_v: pl.DataFrame, dim_t: pl.DataFrame
) -> pl.DataFrame:
    fct = src.with_columns(f("date_id").str.to_date().alias("date"))

    # Decision 1. Not a key, and named so nobody can treat it as one.
    require(
        fct["movement_id"].n_unique() < fct.height,
        "movement_id is now unique - the source has changed and decision 1 must be revisited",
    )
    fct = fct.rename({"movement_id": "movement_id_raw"})

    # Decision 2. Keep the DEFECT, drop the corrupt column.
    fct = fct.join(dim_v.select("vessel_key", "vessel_id_dim"), on="vessel_key", how="left")
    fct = fct.with_columns(vessel_id_disagrees=f("vessel_id") != f("vessel_id_dim"))
    n_bad = int(fct["vessel_id_disagrees"].sum())
    require(n_bad == 909, f"vessel_id mismatch count changed from 909 to {n_bad}")
    fct = fct.drop("vessel_id", "vessel_id_dim")

    # The denormalised category DOES agree everywhere; asserted, then dropped as redundant.
    chk = fct.join(dim_v.select("vessel_key", "vessel_category"), on="vessel_key", suffix="_dim")
    require(
        chk.filter(f("vessel_category") != f("vessel_category_dim")).height == 0,
        "the denormalised vessel_category no longer agrees with the dimension",
    )
    fct = fct.drop("vessel_category")

    # route_geometry is a Python repr, not JSON. Parsed once, here, so no consumer has to
    # discover that json.loads fails on it.
    routes = [ast.literal_eval(x)["coordinates"] for x in fct["route_geometry"]]
    fct = fct.with_columns(
        route_start_lon=pl.Series([r[0][0] for r in routes]),
        route_start_lat=pl.Series([r[0][1] for r in routes]),
        route_end_lon=pl.Series([r[-1][0] for r in routes]),
        route_end_lat=pl.Series([r[-1][1] for r in routes]),
    ).drop("route_geometry")

    fct = fct.join(dim_date.select("date", "date_key"), on="date", how="left")
    fct = fct.join(
        dim_t.select("terminal_id", "longitude", "latitude"), on="terminal_id", how="left"
    )
    fct = fct.with_columns(
        # How far a route's end is from the terminal it is filed against. Degrees, because
        # calling it kilometres would imply a precision the coordinates do not have.
        route_end_offset_deg=(
            (f("route_end_lon") - f("longitude")) ** 2 + (f("route_end_lat") - f("latitude")) ** 2
        ).sqrt()
    ).drop("longitude", "latitude")

    # Decision 1: a real surrogate key, stable under rebuild because it is derived from the
    # row's own content rather than from row order.
    fct = fct.with_columns(
        movement_sk=pl.concat_str(
            [f("date_key"), f("terminal_id"), f("vessel_key"), f("movement_id_raw")],
            separator="-",
        )
    )
    require(
        fct["movement_sk"].n_unique() == fct.height,
        "the surrogate key is not unique - content collision, widen it",
    )

    for key, dim, col in [
        ("date_key", dim_date, "date_key"),
        ("terminal_id", dim_t, "terminal_id"),
        ("vessel_key", dim_v, "vessel_key"),
    ]:
        orph = fct.join(dim.select(col), on=key, how="anti").height
        require(orph == 0, f"{key} has {orph} orphans")

    require(fct.height == 15_000, f"fact should be 15,000 rows, got {fct.height}")
    require(
        fct.null_count().sum_horizontal().item() == 0,
        "nulls have appeared in the fact table",
    )
    # Decision 5: no rate column. Durations travel raw.
    return fct.select(
        "movement_sk",
        "movement_id_raw",
        "date_key",
        "date",
        "terminal_id",
        "vessel_key",
        "container_count",
        "move_duration",
        "vessel_id_disagrees",
        "route_end_offset_deg",
        "route_start_lon",
        "route_start_lat",
        "route_end_lon",
        "route_end_lat",
    )


# ---------------------------------------------------------------------------------------
# Decision 3 - the thesis as a table
# ---------------------------------------------------------------------------------------
def build_dim_cut(
    fct: pl.DataFrame, dim_date: pl.DataFrame, dim_t: pl.DataFrame, dim_v: pl.DataFrame
) -> pl.DataFrame:
    j = (
        fct.join(dim_date, on="date_key")
        .join(dim_t.select("terminal_id", "regional_hub"), on="terminal_id")
        .join(dim_v.select("vessel_key", "vessel_category", "build_year"), on="vessel_key")
    )
    rows = []
    for label, col, family in [
        ("Regional hub", "regional_hub", "geography"),
        ("Terminal", "terminal_id", "geography"),
        ("Vessel category", "vessel_category", "vessel"),
        ("Vessel build year", "build_year", "vessel"),
        ("Day label (Day/Night)", "day_label", "time"),
        ("Fiscal year", "fiscal_year", "time"),
        ("Quarter", "quarter", "time"),
        ("Month", "month", "time"),
    ]:
        gs = [
            g["move_duration"].to_numpy()
            for _, g in j.group_by(col, maintain_order=True)
            if g.height > 20
        ]
        rows.append(
            {
                "cut_label": label,
                "cut_family": family,
                "k_groups": len(gs),
                "kw_p": float(stats.kruskal(*gs).pvalue),
                "eta2": float(eta2(gs)),
                # A cut is only "predictive" if it clears BOTH a p-value and a real effect size.
                # eta2 >= 0.01 is Cohen's floor for "small"; nothing here reaches it (max 0.0079).
                "is_predictive": bool(stats.kruskal(*gs).pvalue < 0.05 and eta2(gs) >= 0.01),
            }
        )
    out = pl.DataFrame(rows)
    require(
        not out["is_predictive"].any(),
        "an axis now predicts move_duration - the month's central claim has changed",
    )
    require(
        out["eta2"].max() < 0.01,
        f"largest eta2 is now {out['eta2'].max():.4f}, at or above Cohen's small-effect floor",
    )
    return out


# ---------------------------------------------------------------------------------------
# Decision 4 - the one real signal, carrying its own warning
# ---------------------------------------------------------------------------------------
def build_dim_year(fct: pl.DataFrame, dim_date: pl.DataFrame, reps: int = 1000) -> pl.DataFrame:
    j = fct.join(dim_date, on="date_key")
    yr = (
        j.group_by("fiscal_year", maintain_order=True)
        .agg(
            pl.len().alias("movements"),
            pl.col("move_duration").mean().alias("mean_duration"),
            pl.col("container_count").mean().alias("mean_containers"),
        )
        .sort("fiscal_year")
    )

    # Is the daily allocation more variable than a multinomial? Seeded from a label, so this
    # reproduces from independent code (the lesson 2026/02 paid for).
    day = (
        dim_date.select("date_key")
        .join(fct.group_by("date_key", maintain_order=True).len(), on="date_key", how="left")
        .with_columns(pl.col("len").fill_null(0))
    )
    n = day["len"].to_numpy()
    obs = float((((n - n.mean()) ** 2) / n.mean()).sum() / (len(n) - 1))
    rng = np.random.default_rng(crc32(b"daily-allocation"))
    exp = fct.height / DAYS
    sims = np.array(
        [
            (((s - exp) ** 2) / exp).sum() / (DAYS - 1)
            for s in rng.multinomial(fct.height, [1 / DAYS] * DAYS, size=reps)
        ]
    )
    require(
        obs > sims.max(),
        f"the daily allocation no longer exceeds chance (obs {obs:.4f} vs max {sims.max():.4f}) "
        "- the month's positive control has gone, and every null in the ledger becomes "
        "unreadable",
    )
    r = stats.spearmanr(np.arange(yr.height), yr["movements"].to_numpy())
    require(r.pvalue < 0.01, f"movement growth is no longer monotonic (p={r.pvalue:.4g})")

    return yr.with_columns(
        # Decision 4: the warning is a column, not a caption someone can delete.
        is_suez_year=f("fiscal_year") == 2021,
        yoy_pct=(f("movements") / f("movements").shift(1) - 1) * 100,
        daily_chi2_df=pl.lit(obs),
        chance_chi2_df_max=pl.lit(float(sims.max())),
    )


def main() -> None:
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {RAW.parent.name}/data/")

    dim_date = build_dim_date(pl.read_csv(RAW / "dim_time.csv"))
    dim_t = build_dim_terminal(pl.read_csv(RAW / "dim_terminal.csv"))
    dim_v = build_dim_vessel(pl.read_csv(RAW / "dim_vessel.csv"))
    fct = build_fact(pl.read_csv(RAW / "fact_cargo_movements.csv"), dim_date, dim_v, dim_t)

    # Nothing is droppable: 0 nulls, 0 orphans, 0 duplicate rows. The defects here are in
    # what the columns MEAN, not in which rows exist, so removing rows would hide them.
    fct = drop(fct, pl.lit(False), "none", "no row in this file is unusable")

    print("\nComputing dim_cut and dim_year ...")
    dim_cut = build_dim_cut(fct, dim_date, dim_t, dim_v)
    dim_year = build_dim_year(fct, dim_date)

    for name, df in [
        ("dim_date", dim_date),
        ("dim_terminal", dim_t),
        ("dim_vessel", dim_v),
        ("dim_cut", dim_cut),
        ("dim_year", dim_year),
        ("fct_movements", fct),
    ]:
        df.write_parquet(CURATED / f"{name}.parquet")

    print("\nRow drop log (copy into assumptions.md):")
    print("  none - 0 rows dropped, 0 nulls, 0 orphans" if not _dropped else "")
    for label, n, why in _dropped:
        print(f"  {label}: {n:,} - {why}")

    print()
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name}: {pl.read_parquet(p).height:,} rows")

    with pl.Config(tbl_rows=20, tbl_width_chars=130):
        print("\ndim_cut - every axis the brief names, and what it explains:")
        print(dim_cut)
        print("\ndim_year - the one real signal:")
        print(
            dim_year.select("fiscal_year", "movements", "yoy_pct", "mean_duration", "is_suez_year")
        )

    write_payload(fct, dim_date, dim_t, dim_v, dim_cut, dim_year)


def write_payload(fct, dim_date, dim_t, dim_v, dim_cut, dim_year) -> None:
    """Columnar payload for the browser. 15,000 rows; DuckDB-WASM would be 32MB of engine."""
    t_idx = {k: i for i, k in enumerate(dim_t["terminal_id"])}
    v_idx = {k: i for i, k in enumerate(dim_v["vessel_key"])}
    d_idx = {k: i for i, k in enumerate(dim_date["date_key"])}

    payload = {
        "n": fct.height,
        "t": [t_idx[k] for k in fct["terminal_id"]],
        "v": [v_idx[k] for k in fct["vessel_key"]],
        "d": [d_idx[k] for k in fct["date_key"]],
        # Durations are quantised to whole minutes ONCE, here. Six decimal places of an hour
        # is false precision on a column that is a uniform draw.
        "dur": [round(x * 60) for x in fct["move_duration"]],
        "cc": fct["container_count"].to_list(),
        "bad": [int(x) for x in fct["vessel_id_disagrees"]],
        "off": [round(x, 2) for x in fct["route_end_offset_deg"]],
        "terminals": dim_t.select(
            "terminal_id", "terminal_label", "regional_hub", "longitude", "latitude"
        ).to_dicts(),
        "vessels": dim_v.select(
            "vessel_key", "vessel_label", "vessel_category", "build_year", "vessel_age_2024"
        ).to_dicts(),
        "dates": dim_date.select(
            "date_key",
            "fiscal_year",
            "quarter",
            "month",
            "week",
            "day_label",
            "day_of_week",
            "in_suez_week",
        )
        .with_columns(f("date_key").cast(pl.Int64))
        .to_dicts(),
        "cuts": dim_cut.to_dicts(),
        # The BROWSER gets no rate column. mean_duration / mean_containers stay in the
        # parquet because test_growth_is_only_in_the_count needs them to prove the ramp is a
        # count fact - but shipping them to the data layer contradicted its own RULE 1, and
        # nothing rendered them. A payload field nothing draws is a rate waiting to be drawn.
        "years": dim_year.drop("mean_duration", "mean_containers").to_dicts(),
        "meta": {
            "movements": fct.height,
            "terminals": dim_t.height,
            "vessels": dim_v.height,
            "days": dim_date.height,
            "first": str(dim_date["date"].min()),
            "last": str(dim_date["date"].max()),
            "suezStart": SUEZ_START,
            "suezEnd": SUEZ_END,
            "badVesselRows": int(fct["vessel_id_disagrees"].sum()),
            "movementIdDistinct": fct["movement_id_raw"].n_unique(),
            # The uniform domain both measures actually occupy. Fixed, from the model.
            "durationDomainHours": [0, 1000],
            "containerDomain": [0, 1000],
        },
    }
    out = MONTH_DIR / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"\n  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB)")


if __name__ == "__main__":
    main()
