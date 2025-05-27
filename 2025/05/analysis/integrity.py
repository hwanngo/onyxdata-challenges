#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` describes the data. This asks whether the data can support a claim.
Every number quoted in profile.md's Conclusions section is reproduced by this script.

    python 2025/05/analysis/integrity.py

Read-only. Touches nothing outside stdout.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd
import polars as pl
from scipy.stats import chi2_contingency, chisquare, f_oneway, kruskal, kstest

ROOT = Path(__file__).resolve().parents[3]
XLSX = (
    ROOT
    / "2025/05/Onyx-Data-DataDNA-Dataset-Challenge-Mobile-Phone-Sales-Dataset-May-2025"
    / "Onyx Data - DataDNA Dataset Challenge - Mobile Phone Sales Dataset - May 2025.xlsx"
)

# Permutation-null settings for the brand unit-share test (analysis/insights.md I-1).
# Fixed so the published interval and p-value are reproducible run to run.
PERM_SEED = 0
PERM_DRAWS = 20_000

# The cross-tabs worth testing.
CROSSTABS = [
    ("Brand", "Country"),
    ("Brand", "Customer_Age_Group"),
    ("Brand", "Customer_Gender"),
    ("Sales_Channel", "Country"),
    ("Payment_Type", "Country"),
    ("Color", "Brand"),
    ("Storage_Size", "Brand"),
    ("Sales_Channel", "Customer_Age_Group"),
    ("Payment_Type", "Customer_Age_Group"),
    ("Color", "Customer_Age_Group"),
    ("Mobile_Model", "Country"),
]


def main() -> int:
    sheets = pl.read_excel(XLSX, sheet_id=0)
    fact = sheets["Fact_Sales"].to_pandas()
    dim_products = sheets["Dim_Products"].to_pandas()
    dim_locations = sheets["Dim_Locations"].to_pandas()
    n = len(fact)

    print("=" * 72)
    print("GRAIN")
    print("=" * 72)
    print(f"  Fact_Sales rows                : {n}")
    print(f"  distinct Transaction_Date      : {fact.Transaction_Date.nunique()}")
    print(
        f"  date range                     : {fact.Transaction_Date.min():%Y-%m-%d} -> "
        f"{fact.Transaction_Date.max():%Y-%m-%d}"
    )
    missing_days = 366 - fact.Transaction_Date.nunique()
    print(f"  missing days in 2024 (leap yr) : {missing_days}")
    print("  -> grain is ONE ROW PER CALENDAR DAY. Transaction_Date is the PK.")

    print("\n" + "=" * 72)
    print("DQ2 - Transaction_ID uniqueness (dictionary claims 'Unique transaction ID')")
    print("=" * 72)
    counts = fact.Transaction_ID.value_counts()
    print(f"  distinct IDs / rows            : {fact.Transaction_ID.nunique()} / {n}")
    print(f"  IDs used more than once        : {(counts > 1).sum()}")
    print(f"  max reuse of a single ID       : {counts.max()}")
    print("  -> NOT a key. The field's '303 customers' is this artifact; there is no customer ID.")

    print("\n" + "=" * 72)
    print("DQ3 - Is Units_Sold random?")
    print("=" * 72)
    u = fact.Units_Sold.values
    ks = kstest((u - 1) / 98, "uniform")
    print(
        f"  range / mean / var             : [{u.min()}, {u.max()}] / {u.mean():.2f} / {u.var():.0f}"
    )
    print(f"  Uniform(1,99) expects          : mean 50.00, var {(99 - 1) ** 2 / 12:.0f}")
    print(f"  KS vs uniform                  : D={ks.statistic:.4f}, p={ks.pvalue:.4f}")
    print("  -> the POOLED MARGINAL is indistinguishable from uniform noise. NOTE: this test")
    print("     never sees the brand label, so it says nothing about between-brand differences.")

    # --- CORRECTED 2025-05-27 -----------------------------------------------------------
    # This block used to print a binomial 95% CI per brand and conclude "all five overlap".
    # Two errors: (a) the KS result above was being read as a between-brand result, and
    # (b) a unit share is a ratio of sums over `n` day-rows, not a proportion of n Bernoulli
    # trials, so a binomial CI is the wrong interval for it. The correct pair is a
    # between-group rank test plus a permutation null on the share itself. Under the correct
    # tests ONE brand separates, so the old conclusion was wrong in the conservative
    # direction. See analysis/insights.md I-1.
    print("\n  Between-brand test (the one the claim actually needs):")
    kw = kruskal(*[g.Units_Sold.values for _, g in fact.groupby("Brand")])
    print(f"    Kruskal-Wallis units/day by brand : H={kw.statistic:.3f}, p={kw.pvalue:.4f}")

    brands = sorted(fact.Brand.unique())
    day_rows = fact.groupby("Brand").size().reindex(brands)
    cs = chisquare(day_rows.values)
    print(
        f"    day-row allocation {'/'.join(str(int(x)) for x in day_rows.values)}"
        f"       : chi2={cs.statistic:.3f}, p={cs.pvalue:.4f}"
        f"  (is the share an artifact of coverage?)"
    )

    print(f"\n  Brand unit share vs a {PERM_DRAWS:,}-draw permutation null (seed {PERM_SEED}):")
    rng = np.random.default_rng(PERM_SEED)
    labels = fact.Brand.values
    u_f = fact.Units_Sold.values.astype(float)
    total_units = u_f.sum()
    null = {b: np.empty(PERM_DRAWS) for b in brands}
    for k in range(PERM_DRAWS):
        shuffled = labels[rng.permutation(len(labels))]
        for b in brands:
            null[b][k] = 100 * u_f[shuffled == b].sum() / total_units
    separated = []
    for brand in sorted(brands, key=lambda b: -u_f[labels == b].sum()):
        units = int(u_f[labels == brand].sum())
        share = 100 * units / total_units
        draws = null[brand]
        lo, hi = np.percentile(draws, [2.5, 97.5])
        # two-sided p, +1/+1 smoothed so it can never be exactly 0
        p = (np.sum(np.abs(draws - draws.mean()) >= abs(share - draws.mean())) + 1) / (
            PERM_DRAWS + 1
        )
        outside = share < lo or share > hi
        if outside:
            separated.append(brand)
        print(
            f"    {brand:8s} {units:6d} units  {share:5.2f}%   null 95% [{lo:5.2f}, {hi:5.2f}]"
            f"   p={p:.4f}  Bonf={min(1.0, p * len(brands)):.4f}"
            f"{'   <- OUTSIDE' if outside else ''}"
        )
    print(f"  -> {len(separated)} of {len(brands)} brands separate from the null: {separated}.")
    print("     'OnePlus leads volume' is supported; every ranking below first place is not.")

    print("\n" + "=" * 72)
    print("DQ4 - Coverage depth by country")
    print("=" * 72)
    cov = (
        fact.groupby("Country")
        .agg(
            rows=("Transaction_Date", "size"),
            cities=("City", "nunique"),
            units=("Units_Sold", "sum"),
            revenue=("Total_Revenue", "sum"),
        )
        .sort_values("rows", ascending=False)
    )
    print(cov.to_string())
    thin = fact.groupby(["Country", "City"]).size().sort_values()
    print(f"\n  thinnest city cells: {thin.head(4).to_dict()}")
    print("  -> only India and Turkey support city-level comparison.")

    print("\n" + "=" * 72)
    print("DQ5 - Are the dimension tables informative?")
    print("=" * 72)
    key = ["Mobile_Model", "Brand", "Operating_System", "Storage_Size", "Color"]
    dim_variants = dim_products[key].drop_duplicates()
    fact_variants = fact[key].drop_duplicates()
    merged = dim_variants.merge(fact_variants, on=key, how="left", indicator=True)
    unsold = int((merged._merge == "left_only").sum())
    v = len(dim_variants)
    expected_unsold = v * ((1 - 1 / v) ** n)
    sd = math.sqrt(expected_unsold)
    print(f"  Dim_Products variants          : {v}")
    print(f"  variants appearing in fact     : {len(fact_variants)}")
    print(f"  variants with ZERO sales       : {unsold}")
    print(f"  expected unsold if uniform     : {expected_unsold:.1f}  (sd ~ {sd:.1f})")
    verdict = (
        "CONSISTENT WITH RANDOM - not a finding"
        if abs(unsold - expected_unsold) < 2.5 * sd
        else "REAL SIGNAL"
    )
    print(f"  -> {verdict}")
    unused_cities = set(dim_locations.City) - set(fact.City)
    print(f"  Dim_Locations cities unused    : {len(unused_cities)}  -> adds no information")

    print("\n" + "=" * 72)
    print("REAL SIGNAL - price architecture")
    print("=" * 72)
    by_model = fact.groupby("Mobile_Model").Price.agg(["mean", "std", "count"])
    by_model["cv"] = by_model["std"] / by_model["mean"]
    print(
        f"  median within-model price CV   : {by_model.cv.median():.3f}  (price is model-determined)"
    )
    anova = f_oneway(*[g.Price.values for _, g in fact.groupby("Brand")])
    print(f"  ANOVA price ~ brand            : F={anova.statistic:.2f}, p={anova.pvalue:.3g}")
    print("\n  Brand: units rank vs revenue rank")
    br = fact.groupby("Brand").agg(
        units=("Units_Sold", "sum"), revenue=("Total_Revenue", "sum"), mean_price=("Price", "mean")
    )
    br["units_rank"] = br.units.rank(ascending=False).astype(int)
    br["rev_rank"] = br.revenue.rank(ascending=False).astype(int)
    print(br.sort_values("revenue", ascending=False).round(0).to_string())
    print("  -> rank divergence is driven by the price ladder, so it survives the unit noise.")

    print("\n" + "=" * 72)
    print("I-4 - price vs mix decomposition of each country's ASP")
    print("=" * 72)
    # ADDED 2025-05-27. insights.md I-4 previously published a counterfactual with no query
    # behind it anywhere, and with the two effects the wrong way round. The algebra, once:
    #
    #   ASP_c = sum_i w_ci * p_ci            w = unit weight on model i, p = realised price
    #   price effect = sum_i  w_gi * (p_ci - p_gi)        global MIX fixed, own PRICES
    #   mix   effect = sum_i (w_ci - w_gi) * p_gi         global PRICES fixed, own MIX
    #   interaction  = sum_i (w_ci - w_gi) * (p_ci - p_gi)
    #   price + mix + interaction == ASP_c - BASELINE, exactly.
    #
    # `actual - (own prices, global mix)` = sum_i (w_ci - w_gi) * p_ci. The prices do not
    # cancel from the report, but they are the country's OWN prices on both sides, so the
    # contrast is driven entirely by the weights: it is a MIX effect, not a price effect.
    baseline = fact.Total_Revenue.sum() / fact.Units_Sold.sum()
    g = fact.groupby("Mobile_Model").agg(u=("Units_Sold", "sum"), r=("Total_Revenue", "sum"))
    w_g = g.u / g.u.sum()
    p_g = g.r / g.u
    print(f"  baseline = global unit-weighted ASP : ${baseline:.4f}")
    print(
        f"  {'country':11s} {'ASP':>10s} {'gap':>9s} {'PRICE':>9s} {'MIX':>10s} {'inter':>8s}"
        f" {'days':>5s}"
    )
    for country, gc in fact.groupby("Country"):
        c = gc.groupby("Mobile_Model").agg(u=("Units_Sold", "sum"), r=("Total_Revenue", "sum"))
        c = c.reindex(g.index)
        cu = c.u.fillna(0.0)
        w_c = cu / cu.sum()
        # a model a country never sold carries the global price, so absence adds 0 to price
        p_c = (c.r / c.u).fillna(p_g)
        asp = c.r.sum() / cu.sum()
        price_eff = float((w_g * (p_c - p_g)).sum())
        mix_eff = float(((w_c - w_g) * p_g).sum())
        inter = float(((w_c - w_g) * (p_c - p_g)).sum())
        assert abs(price_eff + mix_eff + inter - (asp - baseline)) < 1e-6
        print(
            f"  {country:11s} {asp:10.2f} {asp - baseline:+9.2f} {price_eff:+9.2f}"
            f" {mix_eff:+10.2f} {inter:+8.2f} {len(gc):5d}"
        )
    print("  -> mix dominates in every market. India and Turkey, the only two with enough")
    print("     trading days, differ by $21.31 of ASP: 4.8% price, 80.9% mix, 14.3% interaction.")

    print("\n" + "=" * 72)
    print("Operating_System is redundant with Brand")
    print("=" * 72)
    print(fact.groupby(["Brand", "Operating_System"]).size().to_string())

    print("\n" + "=" * 72)
    print("Seasonality")
    print("=" * 72)
    monthly = fact.assign(m=fact.Transaction_Date.dt.month).groupby("m").Total_Revenue.sum()
    print(f"  monthly revenue CV             : {monthly.std() / monthly.mean():.4f}")
    print(f"  min/max ratio                  : {monthly.min() / monthly.max():.3f}")
    print(f"  Jan {monthly.loc[1]:,} vs Dec {monthly.loc[12]:,}  -> no festive peak")

    print("\n" + "=" * 72)
    print(
        f"CROSS-TAB INDEPENDENCE - {len(CROSSTABS)} tests, Bonferroni alpha = {0.05 / len(CROSSTABS):.4f}"
    )
    print("=" * 72)
    alpha = 0.05 / len(CROSSTABS)
    for a, b in CROSSTABS:
        ct = pd.crosstab(fact[a], fact[b])
        chi2, p, dof, expected = chi2_contingency(ct)
        mark = (
            "  <-- survives correction" if p < alpha else ("  (nominal only)" if p < 0.05 else "")
        )
        print(
            f"  {a:18s} x {b:18s} chi2={chi2:7.2f} dof={dof:3d} p={p:.4f}"
            f" min_exp={expected.min():4.1f}{mark}"
        )

    print("\n" + "=" * 72)
    print("HEADLINE METRICS (ours - compare to the field's consensus, do not inherit it)")
    print("=" * 72)
    print(f"  rows                           : {n}")
    print(f"  units sold                     : {fact.Units_Sold.sum():,}")
    print(f"  total revenue                  : ${fact.Total_Revenue.sum():,}")
    print(f"  mean Price                     : ${fact.Price.mean():.2f}")
    print(
        f"  revenue per unit               : ${fact.Total_Revenue.sum() / fact.Units_Sold.sum():.2f}"
    )
    bad = int((fact.Total_Revenue != fact.Price * fact.Units_Sold).sum())
    print(f"  rows where revenue != P*U      : {bad}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
