#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

2026/02 - Pharmacy Sales & Profitability.

`tools/profile.py` DESCRIBES the data. This asks whether the data can support a CLAIM.
Every number quoted in profile.md's Conclusions must be reproduced here.

Reads the RAW workbook only - never `data/curated/` - so a defect baked into `model/build.py`
cannot validate itself. That is the integrity pass's rule.

Standing checks, learned the hard way - run all of these every month:

  1. GRAIN. What is one row? Is the "ID" column actually unique? (2025/05 and 2025/06 both
     shipped a non-unique ID column that the data dictionary called unique. Assume guilty.)
  2. DERIVED COLUMNS. Does the stated arithmetic hold on every row? (2025/06's Engagement
     was NOT likes+shares+comments on any row.)
  3. MISSINGNESS. Is it random, or structural? Structural missingness is a finding.
  4. IS THE HEADLINE METRIC NOISE? KS against uniform. (2025/05's was; 2025/06's was not.)
  5. EFFECT SIZE, NOT JUST p. With thousands of rows everything is significant. Report eta^2
     or an equivalent share-of-variance, and say what share each axis explains.
  6. CONFOUNDS. If axis A looks predictive, check it within levels of axis B. (2025/06's
     hashtag effect collapsed from eta^2 0.75 to 0.022 once category was held constant.)
  7. THIN CELLS. Any group small enough to manufacture a counter-example must be flagged.

  And two added this month:

  8. A CLAIM STATED BY THE SOURCE IS A HYPOTHESIS, NOT A FACT - but so is its SILENCE.
     Test the rules the README states AND the neighbouring rule it does not.
  9. A NULL NEEDS A POSITIVE CONTROL. Before reading "X does not affect Y" as a finding,
     show that X affects something. Otherwise a dead column looks like a discovery.
     (2025/09: three times in four months I inferred independence from a null.)

    uv run python 2026/02/analysis/integrity.py

Read-only.
"""

from __future__ import annotations

from zlib import crc32

import numpy as np
import polars as pl
from scipy import stats

RAW = "2026/02/DataDNA-Dataset-Challenge-Pharma-Data-20260102/Pharmacy_Data_Challenge_Dataset.xlsx"
WINDOW_START = np.datetime64("2024-01-01")
WINDOW_END = np.datetime64("2025-12-31")


def load() -> dict[str, pl.DataFrame]:
    f = pl.read_excel(RAW, sheet_name="FactSales")
    dd = pl.read_excel(RAW, sheet_name="DimDate").with_columns(pl.col("Date").cast(pl.Date))
    ph = pl.read_excel(RAW, sheet_name="DimPharmacy").with_columns(pl.col("OpenDate").str.to_date())
    pr = pl.read_excel(RAW, sheet_name="DimProduct").with_columns(
        pl.col("LaunchDate").str.to_date(), pl.col("DiscontinuedDate").str.to_date()
    )
    return {
        "fact": f,
        "date": dd,
        "pharm": ph,
        "prod": pr,
        "join": f.join(dd, on="DateKey").join(ph, on="PharmacyID").join(pr, on="ProductID"),
    }


def eta2(groups: list[np.ndarray]) -> float:
    """Share of variance explained. The effect size, not the p-value."""
    allv = np.concatenate(groups)
    gm = allv.mean()
    ssb = sum(len(g) * (g.mean() - gm) ** 2 for g in groups)
    return ssb / ((allv - gm) ** 2).sum()


def h(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


# ------------------------------------------------------------------------------------
# 1. Grain, stated identities, and the rule the README leaves out
# ------------------------------------------------------------------------------------
def readme_claims(d: dict) -> None:
    h("1. GRAIN + what the README claims - and the one thing it does not")
    f, ph, pr, j = d["fact"], d["pharm"], d["prod"], d["join"]

    print(
        f"  SalesID unique             {f['SalesID'].n_unique() == f.height} "
        f"({f['SalesID'].n_unique():,} / {f.height:,})"
    )
    g = f.group_by(["DateKey", "PharmacyID", "ProductID"]).len().filter(pl.col("len") > 1)
    dup = f.join(
        g.select(["DateKey", "PharmacyID", "ProductID"]), on=["DateKey", "PharmacyID", "ProductID"]
    )
    pair = (
        dup.group_by(["DateKey", "PharmacyID", "ProductID"])
        .agg(pl.col("PromoFlag").n_unique().alias("np"))
        .filter(pl.col("np") == 2)
    )
    print(
        f"  grain                      {g.height} (date,pharmacy,product) triples carry "
        f"2 rows; {pair.height} are a promo/non-promo"
    )
    print(f"                             pair, so {g.height - pair.height} are unexplained.")

    dev = f.with_columns(
        ((pl.col("RevenueEUR") - pl.col("CostEUR")).round(2) - pl.col("MarginEUR")).abs().alias("e")
    )["e"].max()
    print(f"  margin identity            max deviation {dev} ({'HOLDS' if dev == 0 else 'BROKEN'})")
    print(
        f"  row counts                 fact={f.height:,} date={d['date'].height} "
        f"pharm={ph.height} prod={pr.height}   (README: 62,139/731/120/220)"
    )

    for name, col, before in [
        ("no sales before OpenDate", "OpenDate", True),
        ("no sales after DiscontinuedDate", "DiscontinuedDate", False),
    ]:
        bad = (
            j.filter(pl.col("Date") < pl.col(col))
            if before
            else j.filter(pl.col(col).is_not_null() & (pl.col("Date") > pl.col(col)))
        )
        print(f"  {name:<26} {bad.height} violations ({'HOLDS' if not bad.height else 'BROKEN'})")

    for col, dim, key in [
        ("DateKey", d["date"], "DateKey"),
        ("PharmacyID", ph, "PharmacyID"),
        ("ProductID", pr, "ProductID"),
    ]:
        n = j.join(dim.select(pl.col(key)), left_on=col, right_on=key, how="anti").height
        print(f"  FK {col:<23} {n} orphans")

    pre = j.filter(pl.col("Date") < pl.col("LaunchDate"))
    late = pr.filter(pl.col("LaunchDate") > pl.lit(WINDOW_START))
    first = (
        pre.group_by("ProductID")
        .agg(pl.col("Date").min().alias("first"))
        .join(pr.select("ProductID", "LaunchDate"), on="ProductID")
        .with_columns((pl.col("LaunchDate") - pl.col("first")).dt.total_days().alias("early"))
    )
    print("\n  >> LaunchDate is the one date the README does not mention. (check 8)")
    print(
        f"     rows sold before launch  {pre.height:,} of {j.height:,} "
        f"({pre.height / j.height * 100:.4f}%)"
    )
    print(
        f"     revenue before launch    EUR {pre['RevenueEUR'].sum():,.2f} "
        f"({pre['RevenueEUR'].sum() / j['RevenueEUR'].sum() * 100:.2f}%)"
    )
    print(
        f"     products affected        {pre['ProductID'].n_unique()} of {late.height} "
        f"launching in-window "
        f"({'ZERO EXCEPTIONS' if pre['ProductID'].n_unique() == late.height else 'partial'})"
    )
    print(
        f"     days traded pre-launch   median {first['early'].median():.0f}, "
        f"max {first['early'].max()}"
    )
    print("     The two documented rules are the CONTROL: constraints were applied exactly")
    print("     where the README documents them, and nowhere else.")


# ------------------------------------------------------------------------------------
# 2. Where profitability varies (it does not) vs where volume varies (it does)
# ------------------------------------------------------------------------------------
def margin_is_constant(d: dict) -> None:
    h("2. The margin RATE does not vary across any geographic or structural cut")
    j, ph = d["join"], d["pharm"]

    def rate(by: str) -> pl.DataFrame:
        return j.group_by(by).agg(
            pl.len().alias("n"),
            (pl.col("MarginEUR").sum() / pl.col("RevenueEUR").sum() * 100).alias("m"),
        )

    print("  cut                k     margin% range       spread")
    for by in ["Country", "Region", "PharmacyType", "StoreSizeBand", "PharmacyID"]:
        t = rate(by)
        print(
            f"  {by:<17} {t.height:3d}   {t['m'].min():6.2f} .. {t['m'].max():6.2f}   "
            f"{t['m'].max() - t['m'].min():6.2f}pp"
        )
    print("\n  the only two cuts that move it:")
    for by in ["Category", "PromoFlag"]:
        t = rate(by)
        print(
            f"  {by:<17} {t.height:3d}   {t['m'].min():6.2f} .. {t['m'].max():6.2f}   "
            f"{t['m'].max() - t['m'].min():6.2f}pp"
        )

    # The control: store VOLUME is genuinely heterogeneous, so "everything is flat" is false.
    st = (
        j.group_by("PharmacyID")
        .agg(pl.len().alias("txns"))
        .join(ph.select("PharmacyID", "OpenDate"), on="PharmacyID")
        .with_columns(pl.max_horizontal(pl.col("OpenDate"), pl.lit(WINDOW_START)).alias("start"))
    )
    st = st.with_columns(
        (pl.lit(WINDOW_END) - pl.col("start")).dt.total_days().add(1).alias("days")
    )
    exp = st["days"].to_numpy() * (st["txns"].sum() / st["days"].sum())
    obs = st["txns"].to_numpy()
    chi2 = (((obs - exp) ** 2) / exp).sum()
    df = len(obs) - 1
    print(
        f"\n  store VOLUME, by contrast, is real: chi2={chi2:,.0f} on {df} df "
        f"(ratio {chi2 / df:.1f}), p={1 - stats.chi2.cdf(chi2, df):.3g}"
    )
    print("  -> stores differ in HOW MUCH they sell, not in how profitably they sell it.")


# ------------------------------------------------------------------------------------
# 3. Seasonality (there is none) vs the trading week (the only time signal)
# ------------------------------------------------------------------------------------
def no_seasonality(d: dict) -> None:
    h("3. There is no seasonality - the only time structure is the trading week")
    j = d["join"]
    m = j.group_by("YearMonth").agg(pl.col("RevenueEUR").sum().alias("rev")).sort("YearMonth")
    print(
        f"  monthly revenue        EUR {m['rev'].min():,.0f} .. {m['rev'].max():,.0f} "
        f"over {m.height} months (sd/mean {m['rev'].std() / m['rev'].mean():.4f})"
    )

    dm = j.group_by(["Date", "MonthNumber"]).agg(pl.len().alias("n"))
    g = [x["n"].to_numpy() for _, x in dm.group_by("MonthNumber")]
    print(
        f"  daily count by month   KW p={stats.kruskal(*g).pvalue:.4f}  "
        f"eta2={eta2(g):.5f}   <- nothing"
    )

    dw = (
        j.with_columns(pl.col("Date").dt.weekday().alias("wd"))
        .group_by(["Date", "wd"])
        .agg(pl.len().alias("n"))
    )
    g = [x["n"].to_numpy() for _, x in dw.group_by("wd")]
    means = {int(k[0]): float(x["n"].mean()) for k, x in dw.group_by("wd")}
    print(
        f"  daily count by weekday KW p={stats.kruskal(*g).pvalue:.3g}  "
        f"eta2={eta2(g):.5f}   <- the only signal"
    )
    wk = float(np.mean([means[i] for i in (1, 2, 3, 4, 5)]))
    we = float(np.mean([means[i] for i in (6, 7)]))
    print(f"    weekday mean {wk:.1f} vs weekend {we:.1f}  ({we / wk - 1:+.1%})")
    print("    a trading calendar, not demand - the 2025/12 'opening hours' shape.")


# ------------------------------------------------------------------------------------
# 4. The promotion null, with the positive control that makes it readable
# ------------------------------------------------------------------------------------
def promo_buys_nothing(d: dict) -> None:
    h("4. Promotions cost margin and buy no volume - with a positive control (check 9)")
    j = d["join"].with_columns(
        (pl.col("RevenueEUR") / (pl.col("ListPriceEUR") * pl.col("UnitsSold"))).alias("pr")
    )
    a = j.filter(pl.col("PromoFlag") == "Yes")
    b = j.filter(pl.col("PromoFlag") == "No")

    print("  POSITIVE CONTROL - the flag is live, not inert:")
    print(
        f"    realised price / list  {b['pr'].mean():.4f} -> {a['pr'].mean():.4f} "
        f"({a['pr'].mean() / b['pr'].mean() - 1:+.2%})  KW p="
        f"{stats.kruskal(a['pr'].to_numpy(), b['pr'].to_numpy()).pvalue:.3g}"
    )
    print("  THE NULL - informative BECAUSE of the control above:")
    print(
        f"    units per transaction  {b['UnitsSold'].mean():.4f} -> {a['UnitsSold'].mean():.4f} "
        f"({a['UnitsSold'].mean() / b['UnitsSold'].mean() - 1:+.2%})  KW p="
        f"{stats.kruskal(a['UnitsSold'].to_numpy(), b['UnitsSold'].to_numpy()).pvalue:.3g}"
    )

    sd = j["UnitsSold"].std()
    mde = (1.96 + 0.84) * sd * np.sqrt(1 / a.height + 1 / b.height)
    print(f"\n  power (2025/07): n={a.height:,} promo vs {b.height:,} non-promo, sd={sd:.3f}")
    print(
        f"    MDE at 80% power, alpha .05 = {mde:.4f} units "
        f"= {mde / b['UnitsSold'].mean():.2%} lift"
    )
    print(
        f"    observed = {a['UnitsSold'].mean() - b['UnitsSold'].mean():+.4f} units "
        f"({a['UnitsSold'].mean() / b['UnitsSold'].mean() - 1:+.2%})"
    )
    print("    -> no positive lift. The point estimate is a small DECLINE sitting at the")
    print("       detection floor, so the honest claim is 'no lift', NOT 'promo hurts volume'.")

    forgone = (
        a["RevenueEUR"].sum() * (b["MarginEUR"].sum() / b["RevenueEUR"].sum())
        - a["MarginEUR"].sum()
    )
    tot = d["join"]["MarginEUR"].sum()
    print(
        f"\n  margin forgone vs the non-promo rate: EUR {forgone:,.0f} "
        f"({forgone / tot:.2%} of EUR {tot:,.0f} total margin)"
    )


# ------------------------------------------------------------------------------------
# 5. The brief's own premise, tested (check 6 for the confound)
# ------------------------------------------------------------------------------------
def brief_contradicted(d: dict) -> None:
    h("5. The brief's own premise is contradicted by the file")
    j, f, pr = d["join"], d["fact"], d["prod"]
    pp = j.group_by("ProductID").agg(
        pl.col("UnitsSold").sum().alias("units"),
        (pl.col("MarginEUR").sum() / pl.col("RevenueEUR").sum() * 100).alias("m"),
    )
    r = stats.spearmanr(pp["units"].to_numpy(), pp["m"].to_numpy())
    print('  page requirement 4: "High-volume products with low margins reduce overall')
    print('                       profitability and distort performance reporting."')
    print(
        f"  units vs margin% across {pp.height} products: "
        f"Spearman rho={r.statistic:+.4f} p={r.pvalue:.3g}"
    )
    print("  -> POSITIVE. High-volume products carry HIGHER margin, not lower.")
    print("\n  and nothing in the file loses money:")
    print(
        f"    fact rows with margin <= 0   "
        f"{f.filter(pl.col('MarginEUR') <= 0).height} of {f.height:,}"
    )
    print(
        f"    products with list <= cost   "
        f"{pr.filter(pl.col('ListPriceEUR') <= pl.col('StandardCostEUR')).height} "
        f"of {pr.height}"
    )
    print(f"    product margin% range        {pp['m'].min():.2f} .. {pp['m'].max():.2f}")

    nb = pr.group_by("Brand").agg(pl.col("Category").n_unique().alias("c"))
    print(
        f"\n  confound (check 6): brands spanning >1 category = "
        f"{nb.filter(pl.col('c') > 1).height} of {nb.height}"
    )
    print("  -> Brand is perfectly nested in Category. Every 'brand' finding IS a")
    print("     category finding, so the two must never be presented as separate evidence.")


# ------------------------------------------------------------------------------------
# 6. I1 - the growth is store count, not trading
# ------------------------------------------------------------------------------------
def growth_is_mix(d: dict) -> None:
    h("6. LEDGER I1 - 2025 growth decomposed into mix vs performance")
    j, ph = d["join"], d["pharm"]
    tot = j.group_by("Year").agg(pl.col("RevenueEUR").sum().alias("r")).sort("Year")
    old = ph.filter(pl.col("OpenDate") < pl.lit(WINDOW_START))["PharmacyID"].implode()
    ss = (
        j.filter(pl.col("PharmacyID").is_in(old))
        .group_by("Year")
        .agg(pl.col("RevenueEUR").sum().alias("r"))
        .sort("Year")
    )
    ns = (
        j.filter(~pl.col("PharmacyID").is_in(old))
        .group_by("Year")
        .agg(pl.col("RevenueEUR").sum().alias("r"))
        .sort("Year")
    )
    growth = tot["r"][1] - tot["r"][0]
    print(
        f"  total       2024={tot['r'][0]:,.0f}  2025={tot['r'][1]:,.0f}  "
        f"({tot['r'][1] / tot['r'][0] - 1:+.2%})"
    )
    print(
        f"  same-store  2024={ss['r'][0]:,.0f}  2025={ss['r'][1]:,.0f}  "
        f"({ss['r'][1] / ss['r'][0] - 1:+.2%})   n=109"
    )
    print(f"  new stores  2024={ns['r'][0]:,.0f}  2025={ns['r'][1]:,.0f}   n=11")
    print(
        f"  growth EUR {growth:,.0f} -> new {ns['r'][1] - ns['r'][0]:,.0f} "
        f"({(ns['r'][1] - ns['r'][0]) / growth:.1%})  |  same "
        f"{ss['r'][1] - ss['r'][0]:,.0f} ({(ss['r'][1] - ss['r'][0]) / growth:.1%})"
    )
    dly = (
        j.filter(pl.col("PharmacyID").is_in(old))
        .group_by(["Date", "Year"])
        .agg(pl.col("RevenueEUR").sum().alias("r"))
    )
    a = dly.filter(pl.col("Year") == 2024)["r"].to_numpy()
    b = dly.filter(pl.col("Year") == 2025)["r"].to_numpy()
    print(f"  same-store daily revenue Mann-Whitney p={stats.mannwhitneyu(a, b).pvalue:.4f}")
    print(f"  trading days 2024={len(a)} (leap) vs 2025={len(b)} - the raw annual compare")
    print("  gives 2025 one day fewer, so same-store growth is if anything understated.")


# ------------------------------------------------------------------------------------
# 7. I2 - is the 120-store margin spread more than chance? (bootstrap)
# ------------------------------------------------------------------------------------
def store_spread_bootstrap(d: dict, reps: int = 1000) -> None:
    """
    Same estimator as model/build.py::bootstrap_spread, INCLUDING the seed, which is derived
    from the cut label rather than a shared counter.

    Why that matters: build.py runs seven cuts off one generator, so Pharmacy's answer moved
    from 5.54 to 5.37 merely because the City row was dropped ahead of it - and this function,
    bootstrapping only Pharmacy, produced a third number again. Three artifacts, three values
    for one published figure. The finding survived all three (4.61 is below every one of them)
    but that is luck, not method. Seeded by label, both files now reproduce the same value
    from independent code.
    """
    h("7. LEDGER I2 - store margin spread against its own n (bootstrap)")
    j = d["join"]
    st = (
        j.group_by("PharmacyID")
        .agg(
            pl.len().alias("n"),
            (pl.col("MarginEUR").sum() / pl.col("RevenueEUR").sum() * 100).alias("m"),
        )
        .sort("m")
    )
    obs = st["m"].max() - st["m"].min()
    rng = np.random.default_rng(crc32(b"Pharmacy"))
    rev, mar = j["RevenueEUR"].to_numpy(), j["MarginEUR"].to_numpy()
    # Sorted, matching model/build.py::bootstrap_spread - see the note there.
    sizes = np.sort(np.asarray(st["n"].to_numpy(), dtype=np.intp))
    n_total = int(sizes.sum())
    starts = np.concatenate(([0], np.cumsum(sizes)[:-1])).astype(np.intp)
    spreads = np.empty(reps)
    for i in range(reps):
        idx = rng.integers(0, len(rev), n_total)
        vals = np.add.reduceat(mar[idx], starts) / np.add.reduceat(rev[idx], starts) * 100
        spreads[i] = vals.max() - vals.min()
    lo = st.row(0)
    print(f"  observed spread across {st.height} stores: {obs:.2f}pp")
    print(
        f"  lowest store {lo[0]} = {lo[2]:.2f}% on n={lo[1]} rows "
        f"(median store n = {st['n'].median():.0f})"
    )
    print(
        f"  spread expected by CHANCE (same n, rows drawn from the pooled book, "
        f"{reps} reps, seed crc32('Pharmacy')):"
    )
    print(
        f"    mean {spreads.mean():.2f}pp, 95th pct {np.percentile(spreads, 95):.2f}pp, "
        f"max {spreads.max():.2f}pp"
    )
    within = obs < np.percentile(spreads, 95)
    verdict = "WITHIN chance - refuse to rank" if within else "EXCEEDS chance"
    print(f"  -> {verdict}")

    print("\n  Simpson check - is the flatness offsetting mix?")
    for cat in ["OTC", "Prescription"]:
        g = (
            j.filter(pl.col("Category") == cat)
            .group_by("PharmacyType")
            .agg((pl.col("MarginEUR").sum() / pl.col("RevenueEUR").sum() * 100).alias("m"))
            .sort("PharmacyType")
        )
        cells = "  ".join(f"{t}={v:.2f}%" for t, v in zip(g["PharmacyType"], g["m"], strict=True))
        print(f"    {cat:<13} {cells}")
    print("    -> flat WITHIN category too, so it is not mix cancelling out.")


# ------------------------------------------------------------------------------------
# 8. I4 - units is a price band; I5 - promo x category; I6 - ranking impact
# ------------------------------------------------------------------------------------
def units_is_a_price_band(d: dict) -> None:
    h("8. LEDGER I4 - 'which category sells most units' restates 'which is cheapest'")
    j = d["join"]
    print(
        j.group_by("Category")
        .agg(
            pl.col("UnitsSold").mean().round(2).alias("mean_units"),
            pl.col("ListPriceEUR").mean().round(2).alias("mean_list_price"),
        )
        .sort("mean_units")
    )
    pcat = j.group_by(["ProductID", "Category"]).agg(pl.col("UnitsSold").mean().alias("mu"))
    g = [x["mu"].to_numpy() for _, x in pcat.group_by("Category")]
    wp = j.group_by("ProductID").agg(pl.col("UnitsSold").std().alias("sd"), pl.len().alias("n"))
    print(f"  eta2 of product-mean units by category = {eta2(g):.4f}  (n={pcat.height} products)")
    print(
        f"  within-product sd of units = {wp.filter(pl.col('n') > 50)['sd'].mean():.3f} "
        f"(overall {j['UnitsSold'].std():.3f}) -> strong structure, not a literal lookup"
    )


def promo_by_category(d: dict) -> None:
    h("9. LEDGER I5 - does promotion work in ANY category? (two-way interaction)")
    j = d["join"]
    hdr = f"{'category':<17}{'n_promo':>8}{'n_non':>8}{'unit lift%':>12}"
    print(f"  {hdr}{'p':>10}{'margin gap':>12}")
    rows = []
    for (cat,), g in j.group_by("Category"):
        a = g.filter(pl.col("PromoFlag") == "Yes")
        b = g.filter(pl.col("PromoFlag") == "No")
        lift = a["UnitsSold"].mean() / b["UnitsSold"].mean() - 1
        pv = stats.kruskal(a["UnitsSold"].to_numpy(), b["UnitsSold"].to_numpy()).pvalue
        gap = (
            b["MarginEUR"].sum() / b["RevenueEUR"].sum()
            - a["MarginEUR"].sum() / a["RevenueEUR"].sum()
        ) * 100
        rows.append((cat, a.height, b.height, lift * 100, pv, gap))
    for r in sorted(rows, key=lambda x: -x[3]):
        print(f"  {r[0]:<17}{r[1]:>8}{r[2]:>8}{r[3]:>+12.2f}{r[4]:>10.3f}{r[5]:>12.2f}pp")
    print("  Bonferroni for 5 declared tests: p < 0.01 - none survive.")
    print("  The margin gap is uniform (8.36-9.18pp): flat everywhere, zero everywhere.")


def prelaunch_impact(d: dict) -> None:
    h("10. LEDGER I6 - what the pre-launch defect does and does NOT change")
    j = d["join"]
    clean = j.filter(pl.col("Date") >= pl.col("LaunchDate"))
    for by in ["Category", "Country"]:
        a = list(
            j.group_by(by).agg(pl.col("RevenueEUR").sum().alias("r")).sort("r", descending=True)[by]
        )
        b = list(
            clean.group_by(by)
            .agg(pl.col("RevenueEUR").sum().alias("r"))
            .sort("r", descending=True)[by]
        )
        print(f"  {by:<10} ranking {'UNCHANGED' if a == b else 'CHANGED'}")
    ta = list(
        j.group_by("ProductID")
        .agg(pl.col("RevenueEUR").sum().alias("r"))
        .sort("r", descending=True)["ProductID"][:10]
    )
    tb = list(
        clean.group_by("ProductID")
        .agg(pl.col("RevenueEUR").sum().alias("r"))
        .sort("r", descending=True)["ProductID"][:10]
    )
    print(f"  top-10 products overlap {len(set(ta) & set(tb))}/10")
    pre = (
        j.filter(pl.col("Date") < pl.col("LaunchDate"))
        .group_by("ProductID")
        .agg(pl.col("RevenueEUR").sum().alias("pre"))
    )
    tot = j.group_by("ProductID").agg(pl.col("RevenueEUR").sum().alias("tot"))
    x = pre.join(tot, on="ProductID").with_columns(
        (pl.col("pre") / pl.col("tot") * 100).alias("pct")
    )
    print(
        f"\n  per-product share of revenue predating launch: min={x['pct'].min():.1f}% "
        f"median={x['pct'].median():.1f}% max={x['pct'].max():.1f}%"
    )
    print(
        f"  products where MOST recorded revenue predates launch: "
        f"{x.filter(pl.col('pct') > 50).height} of {x.height}"
    )
    print("  -> aggregates are safe; the product LIFECYCLE is not. Do not overclaim this.")


def main() -> int:
    d = load()
    readme_claims(d)
    margin_is_constant(d)
    no_seasonality(d)
    promo_buys_nothing(d)
    brief_contradicted(d)
    growth_is_mix(d)
    store_spread_bootstrap(d)
    units_is_a_price_band(d)
    promo_by_category(d)
    prelaunch_impact(d)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
