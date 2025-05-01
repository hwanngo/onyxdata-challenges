#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` DESCRIBES the data. This asks whether the data can support a CLAIM.
Every number quoted in profile.md's Conclusions must be reproduced here.

Standing checks, learned the hard way - run all of these every month:

  1. GRAIN. What is one row? Is the "ID" column actually unique? (two months both
     shipped a non-unique ID column that the data dictionary called unique. Assume guilty.)
  2. DERIVED COLUMNS. Does the stated arithmetic hold on every row? (one month's Engagement
     was NOT likes+shares+comments on any row.)
  3. MISSINGNESS. Is it random, or structural? Structural missingness is a finding.
  4. IS THE HEADLINE METRIC NOISE? KS against uniform. (one month's was; the next month's was not.)
  5. EFFECT SIZE, NOT JUST p. With thousands of rows everything is significant. Report eta^2
     or an equivalent share-of-variance, and say what share each axis explains.
  6. CONFOUNDS. If axis A looks predictive, check it within levels of axis B. (one month's
     hashtag effect collapsed from eta^2 0.75 to 0.022 once category was held constant.)
  7. THIN CELLS. Any group small enough to manufacture a counter-example must be flagged.

    python <YYYY>/<MM>/analysis/integrity.py

Read-only.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from scipy.stats import kruskal, kstest

ROOT = Path(__file__).resolve().parents[3]
MONTH_DIR = Path(__file__).resolve().parents[1]
RAW = next(
    d
    for d in MONTH_DIR.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)


def eta_squared(df: pd.DataFrame, by: str, val: str) -> float:
    """Share of variance in `val` explained by `by`. The effect size, not the p-value."""
    grand = df[val].mean()
    ss_total = ((df[val] - grand) ** 2).sum()
    ss_between = sum(len(g) * (g[val].mean() - grand) ** 2 for _, g in df.groupby(by))
    return ss_between / ss_total


def uniform_check(series: pd.Series, label: str) -> None:
    lo, hi = series.min(), series.max()
    ks = kstest((series - lo) / (hi - lo), "uniform")
    verdict = "INDISTINGUISHABLE FROM NOISE" if ks.pvalue > 0.05 else "carries real signal"
    print(f"  {label:<24} KS p={ks.pvalue:.3g}  -> {verdict}")


def variance_table(df: pd.DataFrame, axes: list[str], val: str) -> None:
    print(f"  {'axis':<22} {'Kruskal p':>12} {'eta^2':>8}   share")
    rows = [
        (a, kruskal(*[g[val].values for _, g in df.groupby(a)]).pvalue, eta_squared(df, a, val))
        for a in axes
    ]
    for a, p, e in sorted(rows, key=lambda r: -r[2]):
        print(f"  {a:<22} {p:>12.4f} {e:>8.4f}   {100 * e:>5.1f}%")


def main() -> int:
    raise SystemExit("Fill this in for the month. Keep the standing checks above.")


if __name__ == "__main__":
    raise SystemExit(main())
