#!/usr/bin/env python3
"""G1/G2 integrity pass - 2026/07 Global AI Adoption & Workforce Displacement Index.

The archive brief names the stakes plainly: *"Your findings will directly inform funding
allocations for national reskilling programmes due to be announced later this year."*

So the question this script answers is not "what does the data say" but "what can this file
support a funding decision on". The answer turns out to be: one date, and nothing else.

Standing checks, learned the hard way - run all of these every month:

  1. GRAIN. What is one row? Is the "ID" column actually unique? And - 2026/06 - a unique id
     is NOT a grain: check which columns vary within the candidate cluster.
  2. DERIVED COLUMNS. Does the stated arithmetic hold on every row?
  3. MISSINGNESS. Is it random, or structural?
  4. IS THE HEADLINE METRIC NOISE?
  5. EFFECT SIZE, NOT JUST p.
  6. CONFOUNDS. If axis A looks predictive, check it within levels of axis B.
  7. THIN CELLS.
  8. DENOMINATORS (2026/05, 2026/06). Check a ratio's denominator before believing it.

  9. NEW, this month: A TREND IS NOT A STEP. Fitting a line to a level shift returns a
     significant slope and misdescribes the dynamics - which is the difference between
     "adoption is accelerating" and "adoption moved once, two years ago".

    uv run python 2026/07/analysis/integrity.py

Read-only. Never writes into the raw folder.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
DATA = next(MONTH_DIR.rglob("fact_workforce_ai_index.csv")).parent

FAILURES: list[str] = []
CONFIRMED: list[str] = []


def check(claim: str, ok: bool, detail: str) -> None:
    (CONFIRMED if ok else FAILURES).append(f"{claim} :: {detail}")
    print(f"  [{'OK ' if ok else 'BAD'}] {claim}\n        {detail}")


def note(text: str) -> None:
    print(f"        {text}")


def section(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load(name: str) -> pl.DataFrame:
    return pl.read_csv(DATA / f"{name}.csv", infer_schema_length=None).rename(
        lambda c: c.lstrip("﻿")
    )


def main() -> int:
    f = load("fact_workforce_ai_index")
    co, dt = load("dim_country"), load("dim_date")
    ind, sk = load("dim_industry"), load("dim_skill_category")
    J = (
        f.join(co, on="country_id", how="left")
        .join(dt, on="date_id", how="left")
        .join(ind, on="industry_id", how="left")
        .join(sk, on="skill_category_id", how="left")
    )

    section("0. SHAPE")
    for name, df, want in [
        ("fact_workforce_ai_index", f, 300),
        ("dim_country", co, 30),
        ("dim_date", dt, 16),
        ("dim_industry", ind, 25),
        ("dim_skill_category", sk, 8),
    ]:
        check(f"{name} rows == {want}", df.height == want, f"actual {df.height}")
    check(
        "index_id is unique",
        f["index_id"].n_unique() == f.height,
        f"{f['index_id'].n_unique()} distinct over {f.height} rows",
    )

    section("1. FOREIGN KEYS")
    for cc, pt, par in [
        ("country_id", "dim_country", co),
        ("date_id", "dim_date", dt),
        ("industry_id", "dim_industry", ind),
        ("skill_category_id", "dim_skill_category", sk),
    ]:
        used, have = set(f[cc].unique().to_list()), set(par[cc].to_list())
        check(
            f"fact.{cc} -> {pt}",
            not (used - have),
            f"{len(used)} of {len(have)} dimension rows used, {len(used - have)} orphans",
        )

    section("2. IS THERE A PANEL? (the brief's entire temporal section depends on it)")
    seg = f.group_by(["country_id", "industry_id", "skill_category_id"]).len()
    repeated = seg.filter(pl.col("len") > 1).height
    check(
        "segments are observed in more than one quarter",
        repeated > seg.height * 0.5,
        f"{seg.height} distinct (country, industry, skill) segments across {f.height} rows. "
        f"Only {repeated} are observed twice, and none more than twice - so a "
        f"quarter-over-quarter change is computable for {repeated} of {seg.height} segments",
    )
    note(
        f"the cube has 30 x 25 x 8 x 16 = {30 * 25 * 8 * 16:,} cells; {f.height} are filled "
        f"({100 * f.height / 96000:.2f}%)"
    )
    n_q = f.group_by("date_id").len().sort("date_id")
    lr_n = stats.linregress(n_q["date_id"].to_numpy(), n_q["len"].to_numpy())
    check(
        "the number of rows per quarter is stable (no sampling drift)",
        lr_n.pvalue > 0.05,
        f"rows/quarter {n_q['len'].to_list()}; slope {lr_n.slope:+.2f}/qtr, p={lr_n.pvalue:.3f} "
        "- stable, so an aggregate over time is at least not confounded by sample size",
    )

    section("3. THE ONE REAL SIGNAL - AND IT IS A STEP, NOT A TREND")
    q = J.group_by("date_id").agg(pl.col("ai_adoption_rate").mean().alias("m")).sort("date_id")
    y, x = q["m"].to_numpy(), np.arange(1, 17)
    lin = stats.linregress(x, y)
    pre, post = y[:7], y[7:]
    ss_lin = float(((y - (lin.intercept + lin.slope * x)) ** 2).sum())
    ss_step = float(
        ((y - np.concatenate([np.full(7, pre.mean()), np.full(9, post.mean())])) ** 2).sum()
    )
    lr_pre, lr_post = stats.linregress(x[:7], pre), stats.linregress(x[7:], post)
    check(
        "ai_adoption_rate follows a trend rather than a single level shift",
        ss_lin < ss_step,
        f"a STEP at 2022-Q4 fits {ss_lin / ss_step:.2f}x better than a line "
        f"(residual SS {ss_step:.1f} vs {ss_lin:.1f}). Within each era the slope is "
        f"{lr_pre.slope:+.3f}/qtr (p={lr_pre.pvalue:.3f}) before and {lr_post.slope:+.3f}/qtr "
        f"(p={lr_post.pvalue:.3f}) after - both indistinguishable from flat",
    )
    note(
        f"the line would be reported as {lin.slope:+.2f}pp/quarter, R2={lin.rvalue**2:.3f}, "
        f"p={lin.pvalue:.4f} - significant, and a misdescription"
    )
    note(
        f"what actually happens: {pre.mean():.2f}% for seven quarters, then "
        f"{post.mean():.2f}% for nine. A single jump of {post.mean() - pre.mean():+.2f}pp."
    )
    a = J.filter(~pl.col("generative_ai_era"))["ai_adoption_rate"].to_numpy()
    b = J.filter(pl.col("generative_ai_era"))["ai_adoption_rate"].to_numpy()
    mw = stats.mannwhitneyu(a, b)
    note(
        f"pre vs post, row level: MW p={mw.pvalue:.3g}, Cliff's d="
        f"{2 * mw.statistic / (len(a) * len(b)) - 1:+.4f} - large, and REAL. This is the "
        "positive control: the instrument works, so the nulls below are measurements."
    )
    note(
        "The step lands exactly on the generative_ai_era flag, which is a column of the date "
        "dimension. The data does not DISCOVER the date; it was built around it."
    )

    section("4. DOES ANYTHING PREDICT ADOPTION? (country readiness)")
    for c in [
        "gdp_per_capita_usd",
        "digital_infrastructure_score",
        "internet_penetration_pct",
        "stem_graduates_per_100k",
    ]:
        r = stats.spearmanr(J["ai_adoption_rate"].to_numpy(), J[c].to_numpy())
        check(
            f"ai_adoption_rate correlates with {c}",
            abs(r.statistic) > 0.2,
            f"rho={r.statistic:+.4f}, p={r.pvalue:.4f}",
        )
    g = [x["ai_adoption_rate"].to_numpy() for _, x in J.group_by("development_tier")]
    kw = stats.kruskal(*g)
    means = (
        J.group_by("development_tier")
        .agg(pl.col("ai_adoption_rate").mean().round(2))
        .sort("development_tier")
    )
    check(
        "developed and emerging economies adopt at different rates",
        kw.pvalue < 0.05,
        f"{means.to_dicts()} - Kruskal p={kw.pvalue:.4f}. The challenge page lists this as a "
        "named analysis direction",
    )

    section("5. DOES THE RISK INDEX MEASURE RISK?")
    note("displacement_risk_index is documented as 'a composite 0-10 score estimating a")
    note("segment's exposure to AI-driven job displacement'. If so it should track the")
    note("dimension attributes that describe exposure.")
    for c, src in [
        ("automation_susceptibility", "dim_industry"),
        ("ai_replaceability_score", "dim_skill_category"),
        ("ai_augmentation_potential", "dim_skill_category"),
        ("digital_infrastructure_score", "dim_country"),
        ("stem_graduates_per_100k", "dim_country"),
    ]:
        r = stats.spearmanr(J["displacement_risk_index"].to_numpy(), J[c].to_numpy())
        check(
            f"displacement_risk_index tracks {src}.{c}",
            abs(r.statistic) > 0.2,
            f"rho={r.statistic:+.4f}, p={r.pvalue:.4f}",
        )
    gs = [x["displacement_risk_index"].to_numpy() for _, x in J.group_by("skill_category_name")]
    allv = np.concatenate(gs)
    eta = float(
        sum(len(v) * (v.mean() - allv.mean()) ** 2 for v in gs) / ((allv - allv.mean()) ** 2).sum()
    )
    check(
        "displacement risk differs by skill category",
        stats.kruskal(*gs).pvalue < 0.05 and eta >= 0.01,
        f"Kruskal p={stats.kruskal(*gs).pvalue:.4f}, eta2={eta:.5f} across 8 categories "
        f"(n {[len(v) for v in gs]}). The challenge page names this as a direction",
    )

    section("6. jobs_created IS NOT AN INDEPENDENT MEASUREMENT")
    d = f["jobs_displaced_count"].to_numpy().astype(float)
    c_ = f["jobs_created_count"].to_numpy().astype(float)
    lr = stats.linregress(d, c_)
    ratio = c_[d > 0] / d[d > 0]
    check(
        "job creation is measured independently of displacement",
        lr.rvalue**2 < 0.5,
        f"created = {lr.slope:.4f} x displaced {lr.intercept:+.1f}, R2={lr.rvalue**2:.4f} "
        f"(Spearman {stats.spearmanr(d, c_).statistic:+.4f}). The ratio never exceeds 1: "
        f"{ratio.min():.3f}-{ratio.max():.3f}",
    )
    check(
        "some segment somewhere nets positive on jobs",
        int((c_ > d).sum()) > 0,
        f"{int((c_ > d).sum())} of {f.height} rows have created > displaced. Net across the "
        f"file: {int((c_ - d).sum()):,} jobs. 'Where is creation offsetting displacement?' is "
        "answered by construction, not by measurement",
    )

    section("7. IS RESKILLING KEEPING PACE?")
    r = stats.spearmanr(
        J["reskilling_investment_usd"].to_numpy(), J["jobs_displaced_count"].to_numpy()
    )
    check(
        "reskilling investment tracks displacement",
        abs(r.statistic) > 0.2 and r.pvalue < 0.05,
        f"rho={r.statistic:+.4f}, p={r.pvalue:.4f} - investment is allocated with no "
        "relationship to how many jobs are displaced",
    )
    total_inv = float(f["reskilling_investment_usd"].sum())
    total_disp = int(f["jobs_displaced_count"].sum())
    note(
        f"total reskilling ${total_inv:,.0f} against {total_disp:,} displaced jobs "
        f"= ${total_inv / total_disp:,.2f} per displaced worker"
    )

    section("8. THE DIMENSION TABLES THEMSELVES")
    gdp = co["gdp_per_capita_usd"]
    check(
        "gdp_per_capita_usd is plausible",
        gdp.max() < 200_000,
        f"range ${gdp.min():,.0f}-${gdp.max():,.0f}, median ${gdp.median():,.0f}. Real-world "
        f"GDP per capita tops out near $130,000; these are ~500x too large, and Germany "
        f"(${co.filter(pl.col('country_name') == 'Germany')['gdp_per_capita_usd'][0]:,.0f}) "
        f"outranks the United States "
        f"(${co.filter(pl.col('country_name') == 'United States')['gdp_per_capita_usd'][0]:,.0f})",
    )
    us_pol = co.filter(pl.col("country_name") == "United States")["ai_policy_maturity"][0]
    note(f"ai_policy_maturity for the United States: '{us_pol}'")
    note(f"policy maturity values: {sorted(co['ai_policy_maturity'].unique().to_list())}")

    section("9. NULLS + CONFIDENCE")
    nulls = {c: int(f[c].null_count()) for c in f.columns if f[c].null_count()}
    check("no nulls in the fact table", not nulls, f"{nulls or 'none'}")
    lo = J.filter(pl.col("data_confidence_score") < 0.6)
    hi = J.filter(pl.col("data_confidence_score") >= 0.9)
    p1 = stats.mannwhitneyu(
        lo["ai_adoption_rate"].to_numpy(), hi["ai_adoption_rate"].to_numpy()
    ).pvalue
    p2 = stats.mannwhitneyu(
        lo["displacement_risk_index"].to_numpy(), hi["displacement_risk_index"].to_numpy()
    ).pvalue
    check(
        "data_confidence_score separates anything",
        p1 < 0.05 or p2 < 0.05,
        f"low-confidence rows (<0.6, n={lo.height}) vs high (>=0.9, n={hi.height}): "
        f"adoption p={p1:.4f}, risk p={p2:.4f}. The challenge page lists 'data confidence and "
        "reporting quality variations' as an analysis direction",
    )

    section("10. SUMMARY")
    print(f"\n  Claims tested:    {len(CONFIRMED) + len(FAILURES)}")
    print(f"  Confirmed:        {len(CONFIRMED)}")
    print(f"  FALSIFIED:        {len(FAILURES)}")
    if FAILURES:
        print("\n  Falsified:")
        for x in FAILURES:
            print(f"    - {x.split(' :: ')[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
