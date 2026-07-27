#!/usr/bin/env python3
"""
Star schema - 2026/07 Global AI Adoption & Workforce Displacement Index  (Gate G4)

Reads the read-only CSVs, writes parquet to data/curated/. The raw folder is never touched.

The model's job is to make the WRONG report inexpressible. The brief's audience is a policy
coalition allocating reskilling money, and the file offers three ways to hand them a confident
answer that is not there: a trend line through a step, a top-N ranking on an index that encodes
nothing, and a net-jobs league table built from a column that is another column rescaled.

Six decisions, each an argument:

  1. THE TIME SERIES IS STORED WITH BOTH FITS. `fact_quarter` carries the step fit AND the
     linear fit AND their residual sums of squares, side by side. A model that stored only the
     series would let a panel draw a regression line through it; storing the comparison makes
     the step the default reading and the line an explicit, labelled alternative.

  2. THERE IS NO SEGMENT-LEVEL TIME SERIES, BECAUSE THERE IS NO PANEL. `dim_segment` records
     that 284 of 292 segments are observed once (8 twice) and carries the observation count, so any
     attempt to trend a segment meets the number 1.

  3. THE RISK INDEX IS STORED WITH ITS VALIDATION. `dim_risk_validation` holds every attribute
     the index should track and the measured correlation with each. "Is this index any good?"
     is READ from the model, not re-derived in a panel.

  4. jobs_created IS CARRIED WITH ITS OWN REGRESSION. `fact_index.jobs_created_fitted` is
     0.4157 x displaced + 174.7, so the residual is visible next to the value. There is no
     `net_jobs` measure anywhere: it would rank countries by displacement wearing another label.

  5. gdp_per_capita_usd IS DROPPED FROM EVERY MEASURE. ~500x too large with an implausible
     ordering. It survives only in dim_defect.

  6. THE RESKILLING RATIO IS THE ONE HEADLINE. $105.07 per displaced worker is computed once,
     here, and every panel reads it.

The build RAISES if its premises stop holding, including the thesis itself.

    uv run python 2026/07/model/build.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

f = pl.col

MONTH = Path(__file__).resolve().parents[1]
DATA = next(MONTH.rglob("fact_workforce_ai_index.csv")).parent
OUT = MONTH / "data" / "curated"
APP = MONTH / "app" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
APP.mkdir(parents=True, exist_ok=True)

ERA_START = 8  # date_id of 2022-Q4, the first generative_ai_era quarter
SMALL_RHO = 0.20  # below this a correlation is reported as "no relationship"


def premise(ok: bool, msg: str) -> None:
    if not ok:
        raise SystemExit(f"PREMISE VIOLATED: {msg}")


def load(name: str) -> pl.DataFrame:
    return pl.read_csv(DATA / f"{name}.csv", infer_schema_length=None).rename(
        lambda c: c.lstrip("﻿")
    )


def main() -> int:
    raw = load("fact_workforce_ai_index")
    co, dt = load("dim_country"), load("dim_date")
    ind, sk = load("dim_industry"), load("dim_skill_category")

    premise(raw.height == 300, f"fact row count changed: {raw.height}")
    premise(raw["index_id"].n_unique() == raw.height, "index_id is no longer unique")
    premise(
        dt.filter(f("generative_ai_era")).sort("date_id")["date_id"][0] == ERA_START,
        "the generative_ai_era flag no longer starts at date_id 8; every era comparison in "
        "this model is anchored to that boundary",
    )

    # ---- DECISION 2: establish that there is no panel ---------------------------------
    seg = (
        raw.group_by(["country_id", "industry_id", "skill_category_id"], maintain_order=True)
        .len()
        .rename({"len": "observations"})
    )
    premise(
        seg.filter(f("observations") > 1).height < seg.height * 0.1,
        f"segments are now repeatedly observed ({seg.filter(f('observations') > 1).height} of "
        f"{seg.height}); the page's central structural claim is that they are not",
    )

    # =====================================================================================
    # fact_index - row grain, with the derived columns the analysis needs
    # =====================================================================================
    d = raw["jobs_displaced_count"].to_numpy().astype(float)
    c_ = raw["jobs_created_count"].to_numpy().astype(float)
    lr_jobs = stats.linregress(d, c_)
    premise(
        lr_jobs.rvalue**2 > 0.5,
        f"jobs_created is no longer a rescaling of jobs_displaced (R2={lr_jobs.rvalue**2:.3f}); "
        "DECISION 4 exists because it is",
    )

    fi = (
        raw.join(co.drop("gdp_per_capita_usd"), on="country_id", how="left")  # DECISION 5
        .join(dt, on="date_id", how="left")
        .join(ind, on="industry_id", how="left")
        .join(sk, on="skill_category_id", how="left")
        .with_columns(
            # DECISION 4: the fitted value travels with the observed one
            (lr_jobs.slope * f("jobs_displaced_count") + lr_jobs.intercept).alias(
                "jobs_created_fitted"
            ),
            pl.when(f("generative_ai_era"))
            .then(pl.lit("Generative-AI era (2022-Q4 →)"))
            .otherwise(pl.lit("Before (2021-Q1 - 2022-Q3)"))
            .alias("era"),
        )
        .with_columns(
            (f("jobs_created_count") - f("jobs_created_fitted")).alias("jobs_created_residual"),
            # Five records report zero displaced AND zero created. 0/0 is undefined, not 1
            # and not 0 - so it is stored as null rather than papered over, and every claim
            # about the ratio below is scoped to the rows where it exists.
            pl.when(f("jobs_displaced_count") > 0)
            .then(f("jobs_created_count") / f("jobs_displaced_count"))
            .otherwise(None)
            .alias("creation_ratio"),
        )
    )
    premise(fi.height == raw.height, "the dimension joins fanned out or dropped rows")
    premise("gdp_per_capita_usd" not in fi.columns, "DECISION 5: the broken GDP column leaked")
    premise(
        "net_jobs" not in fi.columns,
        "DECISION 4: a net_jobs measure appeared. It would rank countries by displacement "
        "wearing another label",
    )
    fi.write_parquet(OUT / "fact_index.parquet")

    # =====================================================================================
    # fact_quarter - DECISION 1: the series, and BOTH fits, side by side
    # =====================================================================================
    q = (
        fi.group_by(["date_id", "year_quarter_label", "generative_ai_era"], maintain_order=True)
        .agg(
            pl.len().alias("rows"),
            f("ai_adoption_rate").mean().alias("mean_adoption"),
            f("ai_tool_usage_hours_per_week").mean().alias("mean_tool_hours"),
            f("displacement_risk_index").mean().alias("mean_risk"),
            f("jobs_displaced_count").sum().alias("jobs_displaced"),
            f("reskilling_investment_usd").sum().alias("reskilling_usd"),
        )
        .sort("date_id")
    )
    y = q["mean_adoption"].to_numpy()
    x = q["date_id"].to_numpy().astype(float)
    lin = stats.linregress(x, y)
    pre, post = y[: ERA_START - 1], y[ERA_START - 1 :]
    step_fit = np.concatenate([np.full(len(pre), pre.mean()), np.full(len(post), post.mean())])
    lin_fit = lin.intercept + lin.slope * x
    ss_step = float(((y - step_fit) ** 2).sum())
    ss_lin = float(((y - lin_fit) ** 2).sum())
    lr_pre = stats.linregress(x[: ERA_START - 1], pre)
    lr_post = stats.linregress(x[ERA_START - 1 :], post)

    q = q.with_columns(
        pl.Series("step_fit", step_fit),
        pl.Series("linear_fit", lin_fit),
    )
    q.write_parquet(OUT / "fact_quarter.parquet")

    premise(
        ss_step < ss_lin,
        f"the LINE now fits better than the step (SS {ss_lin:.1f} vs {ss_step:.1f}); the "
        "signature claims the opposite",
    )
    premise(
        lr_pre.pvalue > 0.05 and lr_post.pvalue > 0.05,
        f"a within-era slope has become significant (pre p={lr_pre.pvalue:.3f}, post "
        f"p={lr_post.pvalue:.3f}); the page says both eras are flat",
    )

    # =====================================================================================
    # dim_segment - DECISION 2: the panel that is not there
    # =====================================================================================
    seg_named = (
        seg.join(co.select(["country_id", "country_name"]), on="country_id", how="left")
        .join(ind.select(["industry_id", "industry_name"]), on="industry_id", how="left")
        .join(
            sk.select(["skill_category_id", "skill_category_name"]),
            on="skill_category_id",
            how="left",
        )
        .sort("observations", descending=True)
    )
    seg_named.write_parquet(OUT / "dim_segment.parquet")

    # =====================================================================================
    # dim_risk_validation - DECISION 3: the index, and whether it works
    # =====================================================================================
    checks = []
    for col, src, why in [
        ("automation_susceptibility", "dim_industry", "how automatable the industry is"),
        ("ai_replaceability_score", "dim_skill_category", "how replaceable the skill is"),
        ("ai_augmentation_potential", "dim_skill_category", "how augmentable the skill is"),
        ("digital_infrastructure_score", "dim_country", "the country's digital readiness"),
        ("stem_graduates_per_100k", "dim_country", "the country's talent supply"),
        ("internet_penetration_pct", "dim_country", "the country's connectivity"),
        ("avg_ai_investment_pct_revenue", "dim_industry", "the industry's AI spend"),
        ("median_reskilling_duration_months", "dim_skill_category", "how long retraining takes"),
    ]:
        r = stats.spearmanr(fi["displacement_risk_index"].to_numpy(), fi[col].to_numpy())
        checks.append(
            {
                "driver": col,
                "source": src,
                "what_it_describes": why,
                "spearman_rho": float(r.statistic),
                "p_value": float(r.pvalue),
                "is_related": bool(abs(r.statistic) >= SMALL_RHO and r.pvalue < 0.05),
            }
        )
    rv = pl.DataFrame(checks).sort("spearman_rho", descending=True)
    rv.write_parquet(OUT / "dim_risk_validation.parquet")
    premise(
        rv["is_related"].sum() == 0,
        f"{rv['is_related'].sum()} driver(s) now predict the risk index; the page claims none do",
    )

    # =====================================================================================
    # dim_question - every question the two briefs ask, with its verdict
    # =====================================================================================
    def sp(a: str, b: str) -> tuple[float, float]:
        r = stats.spearmanr(fi[a].to_numpy(), fi[b].to_numpy())
        return float(r.statistic), float(r.pvalue)

    # maintain_order=True is load-bearing, not cosmetic. polars does not promise a group order,
    # and float summation is not associative, so an unordered group_by made eta_skill and the
    # Kruskal p-value differ in their last bits between builds - the parquet and the browser
    # payload were byte-unstable for identical input. Found by the 2026-07 audit rebuild.
    tier = [
        x["ai_adoption_rate"].to_numpy()
        for _, x in fi.group_by("development_tier", maintain_order=True)
    ]
    p_tier = float(stats.kruskal(*tier).pvalue)
    skl = [
        x["displacement_risk_index"].to_numpy()
        for _, x in fi.group_by("skill_category_name", maintain_order=True)
    ]
    allv = np.concatenate(skl)
    eta_skill = float(
        sum(len(v) * (v.mean() - allv.mean()) ** 2 for v in skl) / ((allv - allv.mean()) ** 2).sum()
    )
    p_skill = float(stats.kruskal(*skl).pvalue)
    lo = fi.filter(f("data_confidence_score") < 0.6)["ai_adoption_rate"].to_numpy()
    hi = fi.filter(f("data_confidence_score") >= 0.9)["ai_adoption_rate"].to_numpy()
    p_conf = float(stats.mannwhitneyu(lo, hi).pvalue)
    r_resk, p_resk = sp("reskilling_investment_usd", "jobs_displaced_count")

    # The country-level attributes a policy pack would reach for first. X and Y are COMPUTED
    # here rather than typed, because a sentence typed once does not move when the data does.
    #
    # They are phrased as "largest / smallest", NOT as "all < X, every p > Y". X *is* the
    # observed maximum, so a strict inequality against it is refuted by the very row it came
    # from - 0.061046 does reach 0.061, and the 2026-07 audit found that sentence on four
    # surfaces. A bound and a maximum are different claims; print the one you computed.
    # gdp_per_capita_usd is NOT in this list, and its absence is DECISION 5 working: it was
    # dropped from `fi` before this point, so it cannot be correlated with anything here even
    # by accident. It is described in dim_defect instead.
    COUNTRY_DRIVERS = [
        "digital_infrastructure_score",
        "internet_penetration_pct",
        "stem_graduates_per_100k",
    ]
    country_rs = [sp(c, "ai_adoption_rate") for c in COUNTRY_DRIVERS]
    country_max_abs_rho = max(abs(r) for r, _ in country_rs)
    country_min_p = min(p for _, p in country_rs)

    questions = pl.DataFrame(
        [
            {
                "n": 1,
                "asked_by": "archive",
                "question": "How has adoption changed quarter over quarter?",
                "answer": "ANSWERED - it has not. One step at 2022-Q4, flat either side",
                "statistic": f"step fits {ss_lin / ss_step:.2f}x better; within-era slopes p={lr_pre.pvalue:.3f}, p={lr_post.pvalue:.3f}",
                "verdict": "REAL",
            },
            {
                "n": 2,
                "asked_by": "archive",
                "question": "Is displacement accelerating across 2023-24?",
                "answer": "NO - nothing has moved for eight quarters",
                "statistic": f"post-era slope {lr_post.slope:+.3f}pp/qtr, p={lr_post.pvalue:.3f}",
                "verdict": "NULL",
            },
            {
                "n": 3,
                "asked_by": "page",
                "question": "Do developed and emerging economies adopt differently?",
                "answer": "NO",
                "statistic": f"Kruskal p={p_tier:.4f}",
                "verdict": "NULL",
            },
            {
                "n": 4,
                "asked_by": "page",
                "question": "Is adoption driven by infrastructure and talent?",
                "answer": "NO",
                "statistic": f"largest |rho| {country_max_abs_rho:.3f}, smallest p {country_min_p:.3f}",
                "verdict": "NULL",
            },
            {
                "n": 5,
                "asked_by": "page",
                "question": "Does displacement risk differ by skill category?",
                "answer": "NO",
                "statistic": f"Kruskal p={p_skill:.4f}, eta2={eta_skill:.5f}",
                "verdict": "NULL",
            },
            {
                "n": 6,
                "asked_by": "archive",
                "question": "Does the risk index track its own drivers?",
                "answer": "NO - none of eight",
                "statistic": f"max |rho| = {rv['spearman_rho'].abs().max():.4f}",
                "verdict": "NULL",
            },
            {
                "n": 7,
                "asked_by": "page",
                "question": "Where is job creation offsetting displacement?",
                "answer": "NOWHERE, and by construction",
                "statistic": f"created = {lr_jobs.slope:.4f} x displaced + {lr_jobs.intercept:.1f}, "
                f"R2={lr_jobs.rvalue**2:.3f}; 0 of 300 rows net positive",
                "verdict": "ARTEFACT",
            },
            {
                "n": 8,
                "asked_by": "archive",
                "question": "Is reskilling investment keeping pace?",
                "answer": "NO - it tracks nothing",
                "statistic": f"rho={r_resk:+.4f}, p={p_resk:.4f}",
                "verdict": "NULL",
            },
            {
                "n": 9,
                "asked_by": "page",
                "question": "Does data confidence vary meaningfully?",
                "answer": "NOT DETECTABLY",
                "statistic": f"MW p={p_conf:.4f} on 25 low-confidence rows",
                "verdict": "UNDERPOWERED",
            },
            {
                "n": 10,
                "asked_by": "archive",
                "question": "Which segments need urgent investment?",
                "answer": "UNANSWERABLE - 284 of 292 segments observed once, 8 twice",
                "statistic": f"{seg.filter(f('observations') > 1).height} segments seen twice",
                "verdict": "NO DATA",
            },
        ]
    )
    questions.write_parquet(OUT / "dim_question.parquet")

    # =====================================================================================
    # dim_defect
    # =====================================================================================
    gdp = co["gdp_per_capita_usd"]
    de = co.filter(f("country_name") == "Germany")["gdp_per_capita_usd"][0]
    us = co.filter(f("country_name") == "United States")["gdp_per_capita_usd"][0]
    nulls = {c: int(raw[c].null_count()) for c in raw.columns if raw[c].null_count()}
    both = raw.filter(
        f("avg_wage_change_pct").is_null() & f("ai_tool_usage_hours_per_week").is_null()
    ).height
    defects = pl.DataFrame(
        [
            {
                "n": 1,
                "column_name": "the fact table",
                "defect": "no panel",
                "detail": f"{seg.height} segments across {raw.height} rows; "
                f"{seg.filter(f('observations') > 1).height} observed twice, none more",
            },
            {
                "n": 2,
                "column_name": "displacement_risk_index",
                "defect": "does not track its own drivers",
                "detail": f"max |rho| across eight candidate drivers = {rv['spearman_rho'].abs().max():.4f}",
            },
            {
                "n": 3,
                "column_name": "jobs_created_count",
                "defect": "a rescaling of jobs_displaced_count",
                "detail": f"created = {lr_jobs.slope:.4f} x displaced + {lr_jobs.intercept:.1f}, "
                f"R2={lr_jobs.rvalue**2:.3f}; the ratio never reaches 1 on any of the "
                f"{int((raw['jobs_displaced_count'] > 0).sum())} rows where it is defined",
            },
            {
                "n": 4,
                "column_name": "gdp_per_capita_usd",
                "defect": "~500x too large, and mis-ordered",
                "detail": f"${gdp.min():,.0f}-${gdp.max():,.0f}; Germany ${de:,.0f} above the "
                f"United States ${us:,.0f}",
            },
            {
                "n": 5,
                "column_name": "ai_policy_maturity",
                "defect": "implausible value",
                "detail": "the United States is 'Nascent', the lowest of four levels",
            },
            {
                "n": 6,
                "column_name": "avg_wage_change_pct / ai_tool_usage_hours_per_week",
                "defect": "undocumented nulls",
                "detail": f"{nulls} - in {sum(nulls.values()) - both} distinct rows; "
                f"{both} rows are null in both",
            },
            {
                "n": 7,
                "column_name": "data_confidence_score",
                "defect": "separates nothing",
                "detail": f"low (<0.6, n={len(lo)}) vs high (>=0.9, n={len(hi)}): MW p={p_conf:.4f}",
            },
        ]
    )
    defects.write_parquet(OUT / "dim_defect.parquet")

    # small aggregates the panels need
    (
        fi.group_by(["skill_category_name", "ai_replaceability_score"], maintain_order=True)
        .agg(
            pl.len().alias("rows"),
            f("displacement_risk_index").mean().alias("mean_risk"),
            f("jobs_displaced_count").sum().alias("jobs_displaced"),
            f("reskilling_investment_usd").sum().alias("reskilling_usd"),
        )
        .sort("ai_replaceability_score", descending=True)
        .write_parquet(OUT / "fact_skill.parquet")
    )

    (
        fi.group_by(["country_name", "development_tier", "region"], maintain_order=True)
        .agg(
            pl.len().alias("rows"),
            f("ai_adoption_rate").mean().alias("mean_adoption"),
            f("displacement_risk_index").mean().alias("mean_risk"),
        )
        .sort("mean_adoption", descending=True)
        .write_parquet(OUT / "fact_country.parquet")
    )

    # =====================================================================================
    # headline
    # =====================================================================================
    total_inv = float(fi["reskilling_investment_usd"].sum())
    total_disp = int(fi["jobs_displaced_count"].sum())
    a = fi.filter(~f("generative_ai_era"))["ai_adoption_rate"].to_numpy()
    b = fi.filter(f("generative_ai_era"))["ai_adoption_rate"].to_numpy()
    mw = stats.mannwhitneyu(a, b)

    headline = {
        "rows": fi.height,
        "countries": co.height,
        "industries": ind.height,
        "skills": sk.height,
        "quarters": dt.height,
        "cube_cells": co.height * ind.height * sk.height * dt.height,
        "cube_fill_pct": 100 * fi.height / (co.height * ind.height * sk.height * dt.height),
        "segments": seg.height,
        "segments_seen_twice": seg.filter(f("observations") > 1).height,
        "pre_mean": float(pre.mean()),
        "post_mean": float(post.mean()),
        "step_size_pp": float(post.mean() - pre.mean()),
        "ss_step": ss_step,
        "ss_linear": ss_lin,
        "step_beats_line_by": ss_lin / ss_step,
        "linear_slope": float(lin.slope),
        "linear_r2": float(lin.rvalue**2),
        "linear_p": float(lin.pvalue),
        "pre_slope": float(lr_pre.slope),
        "pre_slope_p": float(lr_pre.pvalue),
        "post_slope": float(lr_post.slope),
        "post_slope_p": float(lr_post.pvalue),
        "era_cliffs_delta": float(2 * mw.statistic / (len(a) * len(b)) - 1),
        "era_mw_p": float(mw.pvalue),
        "reskilling_total_usd": total_inv,
        "jobs_displaced_total": total_disp,
        "reskilling_per_displaced_worker": total_inv / total_disp,
        "jobs_created_slope": float(lr_jobs.slope),
        "jobs_created_r2": float(lr_jobs.rvalue**2),
        "rows_net_positive": int((c_ > d).sum()),
        "net_jobs": int((c_ - d).sum()),
        "risk_max_abs_rho": float(rv["spearman_rho"].abs().max()),
        "risk_drivers_tested": rv.height,
        "risk_drivers_related": int(rv["is_related"].sum()),
        "tier_kruskal_p": p_tier,
        "country_max_abs_rho": country_max_abs_rho,
        "country_min_p": country_min_p,
        "skill_kruskal_p": p_skill,
        "skill_eta2": eta_skill,
        "reskilling_rho": r_resk,
        "reskilling_p": p_resk,
        "questions_asked": questions.height,
        "questions_answerable": int(questions.filter(f("verdict") == "REAL").height),
        "defects": defects.height,
    }
    pl.DataFrame([headline]).write_parquet(OUT / "headline.parquet")

    def dump(name: str, df: pl.DataFrame) -> None:
        """NaN and Infinity are Python's json output, not JSON. `JSON.parse` rejects the
        whole file, so one undefined ratio in one row blanks the entire dashboard - which is
        exactly how this month's first build failed. They become null on the way out."""
        rows = df.to_dicts()
        for r in rows:
            for k, v in r.items():
                if isinstance(v, float) and not math.isfinite(v):
                    r[k] = None
        text = json.dumps(rows, separators=(",", ":"), default=str, allow_nan=False)
        (APP / f"{name}.json").write_text(text)

    dump("quarters", q)
    dump("questions", questions)
    dump("risk_validation", rv)
    dump("defects", defects)
    dump("skills", pl.read_parquet(OUT / "fact_skill.parquet"))
    dump("countries", pl.read_parquet(OUT / "fact_country.parquet"))
    dump("headline", pl.DataFrame([headline]))
    dump(
        "jobs",
        fi.select(
            [
                "index_id",
                "jobs_displaced_count",
                "jobs_created_count",
                "jobs_created_fitted",
                "creation_ratio",
                "country_name",
                "industry_name",
                "skill_category_name",
            ]
        ),
    )
    dump("segments", seg_named.head(40))

    kb = sum(p.stat().st_size for p in APP.glob("*.json")) / 1024
    print(f"Wrote {len(list(OUT.glob('*.parquet')))} parquet files to {OUT}")
    for p in sorted(OUT.glob("*.parquet")):
        dd = pl.read_parquet(p)
        print(f"  {p.name:<32} {dd.height:>5} rows x {dd.width:>2} cols")
    print(f"\nApp export: {len(list(APP.glob('*.json')))} json, {kb:,.0f} KB")
    print(
        f"\n  All premises held. step {pre.mean():.2f} -> {post.mean():.2f} "
        f"({post.mean() - pre.mean():+.2f}pp) fits {ss_lin / ss_step:.2f}x better than a line; "
        f"within-era p={lr_pre.pvalue:.3f}/{lr_post.pvalue:.3f}; "
        f"0 of {rv.height} risk drivers related; ${total_inv / total_disp:.2f}/displaced worker."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
