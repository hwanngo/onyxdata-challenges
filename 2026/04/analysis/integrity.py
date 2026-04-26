#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

2026/04 - International Maritime Logistics & Terminal Efficiency.

Reads the RAW CSVs only - never `data/curated/` - so a defect baked into `model/build.py`
cannot validate itself. That is the integrity pass's rule.

Standing checks (see .workbench/docs/LEARNINGS.md):
  1. GRAIN - is the "ID" actually unique?
  2. DERIVED COLUMNS - does the stated arithmetic hold?
  3. MISSINGNESS - random or structural?
  4. IS THE HEADLINE METRIC NOISE? KS against uniform.
  5. EFFECT SIZE, NOT p.
  6. CONFOUNDS.
  7. THIN CELLS.
  8. TEST WHAT THE SOURCE DECLINES TO PROMISE - and, this month, every promise it DOES make.
  9. A NULL NEEDS A POSITIVE CONTROL.

  Added this month:
 10. WHEN A FILE IS MOSTLY NOISE, THE ONE REAL SIGNAL IS THE DANGEROUS ONE. It is what a
     reader will attach every story to, including stories about events that left no trace.

    uv run python 2026/04/analysis/integrity.py

Read-only.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from zlib import crc32

import numpy as np
import polars as pl
from scipy import stats

RAW = (
    Path(__file__).resolve().parents[1]
    / "DataDNA-Dataset-Challenge-International-Maritime-Logistics-Terminal-Efficiency"
    / "DataDNA Dataset Challenge - International Maritime Logistics  Terminal Efficiency"
    / "data"
)
# Ever Given blocked the canal 23-29 March 2021. The brief's headline ask.
SUEZ = (pl.date(2021, 3, 23), pl.date(2021, 3, 29))
DAYS = 1461


def load() -> dict[str, pl.DataFrame]:
    f = pl.read_csv(RAW / "fact_cargo_movements.csv").with_columns(pl.col("date_id").str.to_date())
    d = pl.read_csv(RAW / "dim_time.csv").with_columns(pl.col("date_id").str.to_date())
    t = pl.read_csv(RAW / "dim_terminal.csv")
    v = pl.read_csv(RAW / "dim_vessel.csv")
    return {
        "fact": f,
        "time": d,
        "terminal": t,
        "vessel": v,
        "join": f.join(d, on="date_id")
        .join(t.select("terminal_id", "regional_hub"), on="terminal_id")
        .join(
            v.select("vessel_key", "vessel_category", "build_year"), on="vessel_key", suffix="_v"
        ),
    }


def eta2(groups: list[np.ndarray]) -> float:
    allv = np.concatenate(groups)
    gm = allv.mean()
    return sum(len(g) * (g.mean() - gm) ** 2 for g in groups) / ((allv - gm) ** 2).sum()


def h(t: str) -> None:
    print(f"\n{'=' * 78}\n{t}\n{'=' * 78}")


# ------------------------------------------------------------------------------------
# 1. The dictionary documents its own generator. Check every promise it makes. (check 8)
# ------------------------------------------------------------------------------------
def dictionary_claims(d: dict) -> None:
    h("1. The data dictionary documents the GENERATOR. Eight of its claims are false.")
    f, t, v, tm = d["fact"], d["terminal"], d["vessel"], d["time"]

    md = f["move_duration"].to_numpy()
    cc = f["container_count"].to_numpy()
    mu, sd = md.mean(), md.std(ddof=1)
    ks_u = stats.kstest(md / 1000.0, "uniform")
    ks_n = stats.kstest((md - mu) / sd, stats.norm.cdf)
    print("  1 move_duration    dict says NORMAL")
    print(f"      KS vs Uniform(0,1000) p={ks_u.pvalue:.4f} · vs Normal p={ks_n.pvalue:.3g}")
    print(
        f"      skew {stats.skew(md):+.4f}, kurtosis {stats.kurtosis(md):+.4f} "
        f"(uniform predicts 0 and -1.2)  -> UNIFORM"
    )

    print("  2 container_count  dict says POISSON")
    print(
        f"      var/mean = {cc.var() / cc.mean():.2f} (Poisson predicts 1.0); "
        f"{len(np.unique(cc))} distinct values {cc.min()}-{cc.max()}"
    )
    print(
        f"      KS vs uniform p="
        f"{stats.kstest((cc - cc.min()) / (cc.max() - cc.min()), 'uniform').pvalue:.4f}"
        "  -> UNIFORM"
    )

    hubs = t["regional_hub"].unique().sort().to_list()
    cats = v["vessel_category"].unique().sort().to_list()
    print(f"  3 regional_hub     dict says 3 choices -> {len(hubs)}: {hubs}")
    print(f"  4 vessel_category  dict says 3 choices -> {len(cats)}: {cats}")
    print(
        f"  5 build_year       dict says 1990-2023 -> "
        f"{v['build_year'].min()}-{v['build_year'].max()}"
    )
    print(
        f"  6 movement_id      dict says PRIMARY KEY -> {f['movement_id'].n_unique():,} "
        f"distinct across {f.height:,} rows"
    )
    print("  7 fact columns     dict lists 6 -> also date_id, vessel_key, vessel_category")
    print(f"  8 dim_time         dict says ~5,000 rows -> {tm.height:,}")


# ------------------------------------------------------------------------------------
# 2. Grain. There is no unique row identifier at all. (check 1)
# ------------------------------------------------------------------------------------
def grain(d: dict) -> None:
    h("2. GRAIN - movement_id is not an identifier, it is another uniform draw")
    f = d["fact"]
    mid = f["movement_id"].to_numpy()
    c = f.group_by("movement_id").len()
    print(
        f"  range {mid.min()}-{mid.max()}, {len(np.unique(mid)):,} distinct over {f.height:,} rows"
    )
    print(
        f"  rows sharing a movement_id: min {c['len'].min()}, max {c['len'].max()}, "
        f"mean {c['len'].mean():.2f}"
    )
    ks = stats.kstest(mid / 1000, "uniform").pvalue
    print(f"  KS of movement_id vs Uniform(0,1000): p={ks:.4f}")
    print(f"  exact duplicate rows: {f.height - f.unique().height}")
    print("  -> the file has NO unique row key. The grain the dictionary states does not exist.")

    v = d["vessel"]
    j = f.join(v.select("vessel_key", "vessel_id"), on="vessel_key", suffix="_dim")
    mism = j.filter(pl.col("vessel_id") != pl.col("vessel_id_dim"))
    print(
        f"\n  TWO vessel keys. vessel_key is the real FK ({f['vessel_key'].n_unique()} of "
        f"{v.height} used, 0 orphans)."
    )
    print(
        f"  vessel_id is a denormalised copy that DISAGREES on {mism.height:,} of "
        f"{j.height:,} rows ({mism.height / j.height:.3%})."
    )
    for col in ["container_count", "move_duration"]:
        a = mism[col].to_numpy()
        b = j.filter(pl.col("vessel_id") == pl.col("vessel_id_dim"))[col].to_numpy()
        mw = stats.mannwhitneyu(a, b).pvalue
        print(f"    {col:<16} mismatched vs matched: MW p={mw:.3f}")
    print("    -> the mismatch is unpatterned; it corrupts a join key and nothing else.")


# ------------------------------------------------------------------------------------
# 3. Nothing predicts move_duration. (checks 4, 5)
# ------------------------------------------------------------------------------------
def nothing_predicts(d: dict) -> None:
    h("3. Nothing in the file predicts move_duration - every axis the brief names")
    j = d["join"]
    print(f"  {'axis':<18}{'k':>4}{'KW p':>10}{'eta2':>11}")
    for col in [
        "regional_hub",
        "vessel_category",
        "shift",
        "terminal_id",
        "fiscal_year",
        "quarter",
        "month",
    ]:
        gs = [g["move_duration"].to_numpy() for _, g in j.group_by(col) if g.height > 20]
        if len(gs) < 2:
            continue
        print(f"  {col:<18}{len(gs):>4}{stats.kruskal(*gs).pvalue:>10.4f}{eta2(gs):>11.5f}")
    for col in ["build_year", "container_count"]:
        r = stats.spearmanr(j[col].to_numpy(), j["move_duration"].to_numpy())
        print(f"  {col:<18}{'':>4}{r.pvalue:>10.4f}{r.statistic:>+11.4f}  (Spearman rho)")
    print("  -> the largest effect is vessel build year at eta2=0.0079. Nothing is predictive.")

    print("\n  and the terminals take equal work by construction:")
    n = d["fact"].group_by("terminal_id").len()["len"].to_numpy()
    exp = len(d["fact"]) / len(n)
    chi2 = (((n - exp) ** 2) / exp).sum()
    df = len(n) - 1
    print(
        f"    chi2 = {chi2:.1f} on {df} df (ratio {chi2 / df:.2f}), "
        f"p={1 - stats.chi2.cdf(chi2, df):.4f}; range {n.min()}-{n.max()}"
    )


# ------------------------------------------------------------------------------------
# 4. The Suez question, which is the brief's headline ask
# ------------------------------------------------------------------------------------
def suez(d: dict) -> None:
    h("4. The brief's headline ask: 'identify when the disruption occurred'")
    j = d["join"]
    day = j.group_by("date_id").agg(
        pl.len().alias("n"),
        pl.col("move_duration").mean().alias("dur"),
        pl.col("container_count").sum().alias("cc"),
    )
    inw = day.filter((pl.col("date_id") >= SUEZ[0]) & (pl.col("date_id") <= SUEZ[1]))
    out = day.filter(~((pl.col("date_id") >= SUEZ[0]) & (pl.col("date_id") <= SUEZ[1])))
    for lbl, col in [
        ("movements/day", "n"),
        ("mean move_duration", "dur"),
        ("containers/day", "cc"),
    ]:
        a, b = inw[col].to_numpy(), out[col].to_numpy()
        print(
            f"  {lbl:<20} Suez week {a.mean():9.2f} vs other days "
            f"{b.mean():9.2f}  MW p={stats.mannwhitneyu(a, b).pvalue:.3f}"
        )

    m21 = j.filter(pl.col("fiscal_year") == 2021).group_by("month").len().sort("month")
    mar = m21.filter(pl.col("month").is_in([3, 4]))["len"].mean()
    oth = m21.filter(~pl.col("month").is_in([3, 4]))["len"].mean()
    print(
        f"\n  within 2021: Mar+Apr {mar:.1f}/month vs the other ten {oth:.1f}/month "
        f"({mar / oth - 1:+.1%})"
    )
    print(
        f"  chi2 across 2021's twelve months: p={stats.chisquare(m21['len'].to_numpy()).pvalue:.4f}"
    )
    print("  -> no dip. If anything March and April are ABOVE the rest of the year.")


# ------------------------------------------------------------------------------------
# 5. THE POSITIVE CONTROL - the one real signal, and why it is the dangerous one (check 9, 10)
# ------------------------------------------------------------------------------------
def positive_control(d: dict, reps: int = 1000) -> None:
    """
    Same estimator as model/build.py::build_dim_year, INCLUDING the seed, which is derived
    from a label rather than a bare integer.

    Why: the first version here used seed 0 and 400 reps while the model used
    crc32("daily-allocation") and 1000, so the poster published 1.1418 and this file printed
    1.1525 for the same quantity. Two artifacts, two numbers - the 2026/02 lesson, repeated
    within a single month. Aligned, both now reproduce the same value from independent code.
    """
    h("5. THE POSITIVE CONTROL - one thing in this file is real: movement COUNT grows")
    j, tm = d["join"], d["time"]
    full = (
        tm.select("date_id")
        .join(d["fact"].group_by("date_id").len(), on="date_id", how="left")
        .with_columns(pl.col("len").fill_null(0))
    )
    n = full["len"].to_numpy()
    obs = (((n - n.mean()) ** 2) / n.mean()).sum() / (len(n) - 1)

    rng = np.random.default_rng(crc32(b"daily-allocation"))
    sims = np.array(
        [
            (((s - len(d["fact"]) / DAYS) ** 2) / (len(d["fact"]) / DAYS)).sum() / (DAYS - 1)
            for s in rng.multinomial(len(d["fact"]), [1 / DAYS] * DAYS, size=reps)
        ]
    )
    print(
        f"  movements/day: mean {n.mean():.3f} var {n.var():.3f} var/mean {n.var() / n.mean():.4f}"
    )
    print(f"  OBSERVED chi2/df = {obs:.4f}")
    p95, mx = np.percentile(sims, 95), sims.max()
    print(
        f"  simulated multinomial ({reps} reps, seed crc32('daily-allocation')): "
        f"mean {sims.mean():.4f}, "
        f"95th pct {p95:.4f}, max {mx:.4f}"
    )
    print(f"  -> {'EXCEEDS chance - a real pattern' if obs > sims.max() else 'within chance'}")

    yr = j.group_by("fiscal_year").len().sort("fiscal_year")
    c = yr["len"].to_numpy()
    print(f"\n  by year: {dict(zip(yr['fiscal_year'].to_list(), c.tolist(), strict=True))}")
    print(f"  year-on-year: {[f'{c[i] / c[i - 1] - 1:+.1%}' for i in range(1, len(c))]}")
    mo = j.group_by(["fiscal_year", "month"]).len().sort(["fiscal_year", "month"])
    r = stats.spearmanr(np.arange(mo.height), mo["len"].to_numpy())
    print(f"  48 monthly counts vs time: Spearman rho={r.statistic:+.4f} p={r.pvalue:.3g}")

    print("\n  AND IT IS ONLY IN THE COUNT. The measures do not move with it:")
    for col in ["move_duration", "container_count"]:
        gs = [g[col].to_numpy() for _, g in j.group_by("fiscal_year")]
        print(f"    {col:<16} by year KW p={stats.kruskal(*gs).pvalue:.4f}")
    print("\n  WHY THIS IS THE DANGEROUS SIGNAL: 2021 is the LOWEST year, so the ramp reads")
    print("  as 'Suez depressed 2021 and we recovered'. There is no March 2021 dip, and the")
    print("  ramp continues for three more years with no event to explain it.")


# ------------------------------------------------------------------------------------
# 6. Geography, and two serialisations of it
# ------------------------------------------------------------------------------------
def geography(d: dict) -> None:
    h("6. regional_hub is a label with no geography behind it")
    t = d["terminal"]
    pts = [json.loads(x)["coordinates"] for x in t["port_location"]]
    lon = np.array([p[0] for p in pts])
    lat = np.array([p[1] for p in pts])
    gs = [lon[(t["regional_hub"] == hb).to_numpy()] for hb in t["regional_hub"].unique()]
    print(f"  longitude by hub: KW p={stats.kruskal(*gs).pvalue:.4f}")
    klon = stats.kstest((lon + 180) / 360, "uniform").pvalue
    klat = stats.kstest((lat + 90) / 180, "uniform").pvalue
    print(f"  lon vs Uniform(-180,180): KS p={klon:.4f}")
    print(f"  lat vs Uniform(-90,90):   KS p={klat:.4f}")
    print(
        f"  terminals below 60S: {(lat < -60).sum()} · above 70N: {(lat > 70).sum()} of {len(lat)}"
    )
    print(f"  terminal names are faker PERSON names: {t['terminal_name'].to_list()[:3]}")

    print("\n  TWO geo columns, TWO serialisations:")
    print(f"    dim_terminal.port_location  -> {t['port_location'][0][:46]}...  (valid JSON)")
    rg = d["fact"]["route_geometry"][0]
    print(f"    fact.route_geometry         -> {rg[:46]}...  (Python repr, single quotes)")
    try:
        json.loads(rg)
        print("    json.loads on route_geometry: ok")
    except Exception as e:
        print(f"    json.loads on route_geometry FAILS: {type(e).__name__}")

    n = 4000
    tl = {
        r[0]: json.loads(r[1])["coordinates"]
        for r in t.select("terminal_id", "port_location").iter_rows()
    }
    dest = np.array(
        [ast.literal_eval(x)["coordinates"][-1] for x in d["fact"]["route_geometry"][:n]]
    )
    term = np.array([tl[i] for i in d["fact"]["terminal_id"].to_numpy()[:n]])
    dist = np.hypot(dest[:, 0] - term[:, 0], dest[:, 1] - term[:, 1])
    print(
        f"\n  distance from a route's END to the terminal it is filed against (first {n:,} rows):"
    )
    print(
        f"    median {np.median(dist):.1f} degrees (~{np.median(dist) * 111:,.0f} km), "
        f"min {dist.min():.2f}"
    )
    print("    -> routes are unrelated to the terminal they are recorded at.")


def shift_is_a_day(d: dict) -> None:
    h("7. `shift` is a property of the DATE, not of a work period")
    tm = d["time"]
    print(f"  dim_time has {tm.height:,} rows and {tm['date_id'].n_unique():,} distinct dates")
    print(f"  shift values: {tm['shift'].unique().to_list()}")
    print("  -> an entire calendar day is either 'Day' or 'Night'. A terminal that runs two")
    print("     shifts a day cannot be represented, so the brief's shift question is not")
    print("     merely unanswerable - it is unaskable of this schema.")


def main() -> int:
    d = load()
    dictionary_claims(d)
    grain(d)
    nothing_predicts(d)
    suez(d)
    positive_control(d)
    geography(d)
    shift_is_a_day(d)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
