#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` describes the data. This asks whether the data can support a claim.
Every number quoted in profile.md's Conclusions is reproduced here.

    python 2025/06/analysis/integrity.py

Read-only.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import polars as pl
from scipy.stats import kruskal

ROOT = Path(__file__).resolve().parents[3]
XLSX = next(
    (
        ROOT
        / "2025/06/Onyx-Data-DataDNA-Dataset-Challenge-Social-Media-Content-Performance-Dataset-June-2025"
    ).glob("*.xlsx")
)

# Every categorical axis the brief points at, plus the one it treats as metadata.
AXES = [
    "Platform",
    "Region",
    "Content_Type",
    "Post_Type",
    "Post_Hour",
    "Main_Hashtag",
    "Content_Category",
]


def eta_squared(df: pd.DataFrame, by: str, val: str) -> float:
    """Share of variance in `val` explained by `by`. The effect size, not the p-value."""
    grand = df[val].mean()
    ss_total = ((df[val] - grand) ** 2).sum()
    ss_between = sum(len(g) * (g[val].mean() - grand) ** 2 for _, g in df.groupby(by))
    return ss_between / ss_total


def main() -> int:
    df = pl.read_excel(XLSX, sheet_id=0)["Sheet1"].to_pandas()
    n = len(df)

    print("=" * 78)
    print("GRAIN AND KEYS")
    print("=" * 78)
    print(f"  rows                          : {n:,}")
    print(f"  distinct Post_ID              : {df.Post_ID.nunique():,}")
    reused = (df.Post_ID.value_counts() > 1).sum()
    print(f"  Post_IDs reused               : {reused}  (max {df.Post_ID.value_counts().max()}x)")
    print(f"  fully duplicate rows          : {df.duplicated().sum()}")
    print(f"  duplicate rows ignoring ID    : {df.drop(columns=['Post_ID']).duplicated().sum()}")
    print("  -> Post_ID is NOT a key, but the rows it labels are genuinely distinct.")
    print(
        f"  date span                     : {df.Post_Date.min()} -> {df.Post_Date.max()} "
        f"({df.Post_Date.nunique()} distinct days)"
    )
    print(f"  rows per day                  : {n / df.Post_Date.nunique():.1f}")

    print("\n" + "=" * 78)
    print("BRIEF vs DATA")
    print("=" * 78)
    print(
        f"  brief names 4 platforms; data has {df.Platform.nunique()}: "
        f"{sorted(df.Platform.unique())}"
    )
    print("  brief says 'a 2024 dataset'; data runs into 2025-05-01")

    print("\n" + "=" * 78)
    print("DERIVED COLUMNS - what is actually computed from what")
    print("=" * 78)
    er_calc = df.Engagement / df.Views
    print(
        f"  max |Engagement_Rate - Engagement/Views| : {(er_calc - df.Engagement_Rate).abs().max():.2e}"
    )
    print("  -> Engagement_Rate IS Engagement/Views (stored rounded to ~4dp).")
    lsc = df.Likes + df.Shares + df.Comments
    print(
        f"  rows where Engagement == Likes+Shares+Comments : "
        f"{int((df.Engagement == lsc).sum())} of {n}"
    )
    print(
        f"  mean Engagement / (L+S+C)     : {(df.Engagement / lsc).mean():.4f} "
        f"(range {(df.Engagement / lsc).min():.2f}-{(df.Engagement / lsc).max():.2f})"
    )
    print("  -> Engagement is NOT the sum of its components. Never present it as one.")

    ctr_calc = df.dropna(subset=["Clicks", "Click_Through_Rate"])
    print(
        f"  corr(CTR, Clicks/Impressions) : "
        f"{(ctr_calc.Clicks / ctr_calc.Impressions).corr(ctr_calc.Click_Through_Rate):.4f}"
    )

    print("\n  Engagement_Level vs Engagement_Rate thresholds:")
    print(
        df.groupby("Engagement_Level")
        .Engagement_Rate.agg(["min", "max", "count"])
        .round(5)
        .to_string()
    )
    bad = df[(df.Engagement_Rate < 0.10) & (df.Engagement_Level == "Medium")]
    print(
        f"  rows below the 0.10 boundary labelled Medium : {len(bad)} "
        f"({100 * len(bad) / n:.1f}%)  <- mislabelled"
    )

    print("\n" + "=" * 78)
    print("CTR MISSINGNESS IS STRUCTURAL, NOT RANDOM")
    print("=" * 78)
    cov = df.assign(has=df.Click_Through_Rate.notna()).groupby("Platform").has.agg(["sum", "size"])
    cov["pct"] = (100 * cov["sum"] / cov["size"]).round(1)
    print(cov.to_string())
    li = df[df.Platform == "LinkedIn"].assign(has=lambda d: d.Click_Through_Rate.notna())
    print("\n  LinkedIn, by post type:")
    print(pd.crosstab(li.Post_Type, li.has).to_string())
    part = (
        df.assign(has=df.Click_Through_Rate.notna())
        .groupby(["Platform", "Post_Type"])
        .has.agg(["sum", "size"])
    )
    part = part[(part["sum"] > 0) & (part["sum"] < part["size"])]
    print("\n  cells that are neither all nor nothing (the rule's exceptions):")
    print(part.to_string() if len(part) else "    none")
    print("  -> availability is a PLATFORM property with LinkedIn as the exception, and")
    print("     inside LinkedIn it is by post type EXCEPT for the two cells above.")
    print("     NOT 'wherever a post can carry a link' - see insights.md I-5.")
    print("     A third of the brief's click questions (R5, R6) are unanswerable.")

    print("\n" + "=" * 78)
    print("THE MAIN EVENT - what actually explains engagement rate")
    print("=" * 78)
    print(f"  {'axis':<20} {'Kruskal p':>12} {'eta^2':>8}   share of variance")
    rows = []
    for axis in AXES:
        k = kruskal(*[g.Engagement_Rate.values for _, g in df.groupby(axis)])
        e2 = eta_squared(df, axis, "Engagement_Rate")
        rows.append((axis, k.pvalue, e2))
    for axis, p, e2 in sorted(rows, key=lambda r: -r[2]):
        print(f"  {axis:<20} {p:>12.4f} {e2:>8.4f}   {100 * e2:>5.1f}%")
    print("  -> Content_Category explains ~79% of the variance. Platform explains 0.5%,")
    print("     Region 0.2%, and publishing hour and organic-vs-sponsored nothing at all.")

    print("\n  Engagement rate by content category:")
    print(
        df.groupby("Content_Category")
        .Engagement_Rate.agg(["mean", "min", "max", "count"])
        .sort_values("mean", ascending=False)
        .round(4)
        .to_string()
    )

    print("\n" + "=" * 78)
    print("THE HASHTAG MIRAGE")
    print("=" * 78)
    print(
        f"  Main_Hashtag eta^2 overall            : {eta_squared(df, 'Main_Hashtag', 'Engagement_Rate'):.4f}"
    )
    within = []
    for cat, g in df.groupby("Content_Category"):
        if g.Main_Hashtag.nunique() > 1:
            within.append((cat, eta_squared(g, "Main_Hashtag", "Engagement_Rate"), len(g)))
    wavg = sum(e * n_ for _, e, n_ in within) / sum(n_ for _, _, n_ in within)
    for cat, e, n_ in sorted(within, key=lambda r: -r[2]):
        print(f"    within {cat:<20} eta^2 = {e:.4f}   (n={n_})")
    print(f"  weighted mean WITHIN-category eta^2   : {wavg:.4f}")
    print("  -> The hashtag effect is inherited from the category it sits in. Controlling")
    print("     for category, hashtag explains almost nothing. R6 has no positive answer.")

    print("\n" + "=" * 78)
    print("TIMING - the brief's R4")
    print("=" * 78)
    print(f"  hours present                 : {sorted(df.Post_Hour.unique())}")
    hourly = (
        df.groupby("Post_Hour")
        .agg(n=("Engagement_Rate", "size"), er=("Engagement_Rate", "mean"))
        .round(5)
    )
    print(hourly.to_string())
    print(
        f"  Kruskal, ER by hour           : p={kruskal(*[g.Engagement_Rate.values for _, g in df.groupby('Post_Hour')]).pvalue:.4f}"
    )
    dow = df.assign(dow=pd.to_datetime(df.Post_Date).dt.day_name())
    print(
        f"  Kruskal, ER by day of week    : p={kruskal(*[g.Engagement_Rate.values for _, g in dow.groupby('dow')]).pvalue:.4f}"
    )
    print("  -> No time of day and no day of week outperforms. R4 has no positive answer.")

    print("\n" + "=" * 78)
    print("HEADLINE METRICS (ours)")
    print("=" * 78)
    print(f"  posts                         : {n:,}")
    print(f"  impressions                   : {df.Impressions.sum():,}")
    print(f"  engagement                    : {df.Engagement.sum():,}")
    print(f"  mean engagement rate          : {df.Engagement_Rate.mean():.5f}")
    print(
        f"  posts with a measurable CTR   : {df.Click_Through_Rate.notna().sum():,} "
        f"({100 * df.Click_Through_Rate.notna().mean():.1f}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
