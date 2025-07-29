#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (G2).

Every number quoted in profile.md and insights.md is reproduced here.

    python 2025/07/analysis/integrity.py
"""

from __future__ import annotations

from math import sqrt
from pathlib import Path

import numpy as np
import pandas as pd
import polars as pl
from scipy import stats

MONTH = Path(__file__).resolve().parents[1]
CSV = next(
    d
    for d in MONTH.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
).glob("*.csv")
CSV = next(CSV)

# Every axis the brief proposes as a driver. Declared up front so the multiple-comparison
# correction is honest about how many tests were actually run.
AXES = [
    "Satisfaction_Factor",
    "Loyalty_Level",
    "Purchase_History",
    "Group",
    "Gender",
    "Location",
    "Support_Contacted",
]
SCORE = "Satisfaction_Score"


def eta_squared(df: pd.DataFrame, by: str, val: str) -> float:
    g = df[val].mean()
    tot = ((df[val] - g) ** 2).sum()
    return sum(len(x) * (x[val].mean() - g) ** 2 for _, x in df.groupby(by)) / tot


def n_per_group(d_eff: float, alpha: float = 0.05, power: float = 0.8) -> float:
    za, zb = stats.norm.ppf(1 - alpha / 2), stats.norm.ppf(power)
    return ((za + zb) ** 2 * 2) / d_eff**2


def main() -> int:
    d = pl.read_csv(CSV).to_pandas()
    n = len(d)
    print("=" * 74)
    print(f"GRAIN - {n} rows, one per customer, {d.shape[1]} columns, no date column")
    print("=" * 74)
    print(
        f"  Customer_ID unique: {d.Customer_ID.nunique()}/{n} -> "
        f"{'PASSES the standing ID check' if d.Customer_ID.nunique() == n else 'NOT A KEY'}"
    )

    print("\n" + "=" * 74)
    print("IS THE HEADLINE METRIC NOISE?")
    print("=" * 74)
    counts = d[SCORE].value_counts().sort_index()
    chi = stats.chisquare(counts.values)
    print(f"  score distribution: {dict(counts)}")
    print(f"  chi-square vs uniform(1..10): chi2={chi.statistic:.2f}, p={chi.pvalue:.4f}")
    print(
        f"  mean {d[SCORE].mean():.2f} (uniform expects 5.50) | "
        f"sd {d[SCORE].std():.2f} (expects 2.87)"
    )
    print("  -> indistinguishable from a uniform random draw.")

    print("\n" + "=" * 74)
    print(f"DOES ANYTHING EXPLAIN IT? {len(AXES)} axes, Bonferroni alpha = {0.05 / len(AXES):.4f}")
    print("=" * 74)
    alpha = 0.05 / len(AXES)
    rows = [
        (
            a,
            stats.kruskal(*[g[SCORE].values for _, g in d.groupby(a)]).pvalue,
            eta_squared(d, a, SCORE),
        )
        for a in AXES
    ]
    for a, p, e in sorted(rows, key=lambda r: r[1]):
        print(
            f"  {a:<22} p={p:.4f}  eta2={e:.4f}  {'SURVIVES' if p < alpha else 'does not survive'}"
        )
    r, pr = stats.pearsonr(d.Age, d[SCORE])
    print(f"  {'Age (Pearson)':<22} r={r:+.4f}  p={pr:.4f}")

    print("\n" + "=" * 74)
    print("R4 - THE BRIEF'S HEADLINE QUESTION: does support contact hurt satisfaction?")
    print("=" * 74)
    a = d[d.Support_Contacted == "Yes"][SCORE]
    b = d[d.Support_Contacted == "No"][SCORE]
    dd = (a.mean() - b.mean()) / sqrt((a.var() + b.var()) / 2)
    print(f"  contacted   n={len(a)}  mean={a.mean():.3f}")
    print(f"  not         n={len(b)}  mean={b.mean():.3f}")
    print(
        f"  difference {a.mean() - b.mean():+.3f} points | Cohen d={dd:+.3f} | "
        f"t-test p={stats.ttest_ind(a, b).pvalue:.4f}"
    )
    print("  -> indistinguishable from zero, not merely 'small'.")

    print("\n" + "=" * 74)
    print("R8 - LOYALTY vs SATISFACTION: non-monotonic")
    print("=" * 74)
    print(d.groupby("Loyalty_Level")[SCORE].agg(["count", "mean"]).round(2).to_string())
    print("  -> Low reports the HIGHEST mean. Order is not monotonic; this is noise.")

    print("\n" + "=" * 74)
    print("THE ONE AXIS THAT FLIRTS WITH SIGNIFICANCE - and why it is not kept")
    print("=" * 74)
    g = (
        d.groupby("Satisfaction_Factor")[SCORE]
        .agg(["count", "mean"])
        .sort_values("mean", ascending=False)
    )
    print(g.round(2).to_string())
    obs = eta_squared(d, "Satisfaction_Factor", SCORE)
    rng = np.random.default_rng(0)
    null = []
    for _ in range(4000):
        shuffled = d.assign(lab=rng.permutation(d.Satisfaction_Factor.values))
        null.append(eta_squared(shuffled, "lab", SCORE))
    null = np.array(null)
    print(
        f"\n  observed eta2 = {obs:.4f}; permutation p = {(null >= obs).mean():.4f}; "
        f"median null eta2 = {np.median(null):.4f}"
    )
    print(
        f"  smallest group n = {g['count'].min()}, mean group n = {g['count'].mean():.1f}, "
        f"groups = {len(g)}"
    )
    print("  -> 10 groups on 120 rows; does not survive correction; barely beats relabelling.")

    print("\n" + "=" * 74)
    print("POWER - what this survey could actually detect")
    print("=" * 74)
    sd = d[SCORE].std()
    per = n // 2
    for diff in (0.5, 1.0, 1.5, 2.0):
        print(
            f"  detect {diff:.1f} points (d={diff / sd:.2f}): need {n_per_group(diff / sd):.0f} "
            f"per group; have ~{per}"
        )
    mdd = sqrt(2 * (stats.norm.ppf(0.975) + stats.norm.ppf(0.8)) ** 2 / per) * sd
    print(
        f"\n  minimum detectable difference at n={per}/group: {mdd:.2f} points "
        f"(of a 10-point scale)"
    )
    print("  -> the study cannot answer the questions it was designed to ask.")

    print("\n" + "=" * 74)
    print("THIN CELLS")
    print("=" * 74)
    ct = pd.crosstab(d.Location, d.Loyalty_Level)
    print(
        f"  Location x Loyalty: {ct.size} cells, {(ct.values < 5).sum()} below 5, "
        f"min {ct.values.min()}"
    )
    print(
        f"  Location group sizes: {d.Location.value_counts().min()}"
        f"-{d.Location.value_counts().max()} customers "
        f"(smallest {d.Location.value_counts().idxmin()})"
    )

    loyalty_and_factor_tests(d)
    ladder_scope(d)
    return 0


# ---------------------------------------------------------------------------------------
# I-6 - THE OUTCOME VARIABLE IS PART OF THE ANSWER.
#
# R2, R5 and R7 ask about LOYALTY, not satisfaction. Until 2025-07-29 all three were
# answered with a Kruskal-Wallis on Satisfaction_Score: the right arithmetic on the wrong
# variable. Loyalty_Level is ordinal-categorical with three levels, so the test is a
# chi-square of independence against each segmentation. R9 asks whether demographics
# favour particular satisfaction FACTORS, which is likewise a chi-square, not a KW.
#
# Correction=False throughout: no table here is 2x2, so Yates never applies, and applying
# it to some tables and not others would make the family incomparable.
# ---------------------------------------------------------------------------------------
LOYALTY_AXES = [
    "Gender",
    "Group",
    "Age_Band",
    "Satisfaction_Factor",
    "Location",
    "State",
    "Purchase_History",
]
FACTOR_AXES = ["Gender", "Age_Band", "Group"]


def age_band(age: int) -> str:
    """Exactly the cut in model/build.py, so the test and the UI cannot drift."""
    return "25-34" if age < 35 else "35-44" if age < 45 else "45-54" if age < 55 else "55-60"


def cramers_v(chi2: float, table: pd.DataFrame) -> float:
    n = table.values.sum()
    return sqrt(chi2 / (n * (min(table.shape) - 1)))


def loyalty_and_factor_tests(d: pd.DataFrame) -> None:
    d = d.assign(Age_Band=d.Age.map(age_band), State=d.Location.str.rsplit(".", n=1).str[-1])

    print("\n" + "=" * 74)
    print("I-6 - R2 / R5 / R7 ASK ABOUT LOYALTY. Chi-square of Loyalty_Level vs each axis.")
    print("=" * 74)
    for axis in LOYALTY_AXES:
        t = pd.crosstab(d[axis], d.Loyalty_Level)
        chi2, p, dof, exp = stats.chi2_contingency(t, correction=False)
        print(
            f"  Loyalty ~ {axis:<20} chi2={chi2:7.3f} df={dof:2d} p={p:.4f} "
            f"V={cramers_v(chi2, t):.3f} min_expected={exp.min():.2f} "
            f"expected<5={(exp < 5).sum()}/{exp.size} observed<5={(t.values < 5).sum()}"
        )

    print("\n  R9 - Satisfaction_Factor vs each demographic:")
    for axis in FACTOR_AXES:
        t = pd.crosstab(d[axis], d.Satisfaction_Factor)
        chi2, p, dof, exp = stats.chi2_contingency(t, correction=False)
        print(
            f"  Factor  ~ {axis:<20} chi2={chi2:7.3f} df={dof:2d} p={p:.4f} "
            f"V={cramers_v(chi2, t):.3f} min_expected={exp.min():.2f} "
            f"expected<5={(exp < 5).sum()}/{exp.size}"
        )

    n_sat = len(AXES) + 1  # 7 declared axes + the published Age correlation
    n_all = n_sat + len(LOYALTY_AXES) + len(FACTOR_AXES)
    print(
        f"\n  FAMILY SIZE. Satisfaction tests: {n_sat} (7 axes + Age) -> "
        f"Bonferroni alpha = {0.05 / n_sat:.5f}"
    )
    print(f"  All between-group tests reported: {n_all} -> alpha = {0.05 / n_all:.4f}")
    print("  Smallest p anywhere in the report is 0.0231 (R1), so it clears neither.")


# ---------------------------------------------------------------------------------------
# I-7 - WHAT THE LADDER'S CLAIM IS SCOPED TO.
#
# The published ladder draws six axes (17 groups). "Every interval overlaps every other"
# is true of those 17 and FALSE once Satisfaction_Factor is added, so the app computes the
# sentence from the rows on screen instead of asserting it. Two spreads are reported
# because they license different claims: the detection floor is a TWO-GROUP comparison, so
# it covers two levels of one axis and not two groups cut on different axes.
# ---------------------------------------------------------------------------------------
LADDER_AXES = ["Support_Contacted", "Loyalty_Level", "Purchase_History", "Group", "Gender", "State"]
Z_ALPHA, Z_POWER = 1.96, 0.8416


def ladder_scope(d: pd.DataFrame) -> None:
    d = d.assign(State=d.Location.str.rsplit(".", n=1).str[-1])

    def rungs(axes: list[str]) -> list[dict]:
        out = []
        for axis in axes:
            for k, g in d.groupby(axis):
                xs = g[SCORE].values.astype(float)
                m, sd, nn = xs.mean(), xs.std(ddof=1), len(xs)
                ci = Z_ALPHA * sd / sqrt(nn)
                out.append(
                    {
                        "axis": axis,
                        "k": f"{axis}: {k}",
                        "n": nn,
                        "mean": m,
                        "lo": max(1, m - ci),
                        "hi": min(10, m + ci),
                    }
                )
        return out

    def separated(rs: list[dict]) -> int:
        return sum(
            1
            for i in range(len(rs))
            for j in range(i + 1, len(rs))
            if rs[i]["hi"] < rs[j]["lo"] or rs[j]["hi"] < rs[i]["lo"]
        )

    def spread(rs: list[dict]) -> tuple[float, float, str]:
        cross = max(r["mean"] for r in rs) - min(r["mean"] for r in rs)
        best, best_axis = 0.0, ""
        for axis in {r["axis"] for r in rs}:
            ms = [r["mean"] for r in rs if r["axis"] == axis]
            if max(ms) - min(ms) > best:
                best, best_axis = max(ms) - min(ms), axis
        return cross, best, best_axis

    sd = d[SCORE].std()
    mdd = sqrt(2 * (Z_ALPHA + Z_POWER) ** 2 / (len(d) // 2)) * sd

    print("\n" + "=" * 74)
    print("I-7 - LADDER SCOPE: which interval pairs actually overlap")
    print("=" * 74)
    for label, axes in (
        ("drawn by default (6 axes)", LADDER_AXES),
        ("with Satisfaction_Factor added", [*LADDER_AXES, "Satisfaction_Factor"]),
    ):
        rs = rungs(axes)
        pairs = len(rs) * (len(rs) - 1) // 2
        cross, within, waxis = spread(rs)
        print(f"  {label}: {len(rs)} groups, {pairs} pairs, {separated(rs)} separated")
        print(
            f"      widest gap within one axis {within:.4f} ({waxis}); "
            f"across different axes {cross:.4f}; detection floor {mdd:.4f}"
        )

    fac = rungs(["Satisfaction_Factor"])
    fac.sort(key=lambda r: -r["mean"])
    print("\n  Satisfaction_Factor rungs (the axis that separates):")
    for r in fac:
        print(
            f"      {r['k']:<44} n={r['n']:2d} mean={r['mean']:.3f} [{r['lo']:.3f}, {r['hi']:.3f}]"
        )
    print(f"      separated pairs within this axis: {separated(fac)}")


if __name__ == "__main__":
    raise SystemExit(main())
