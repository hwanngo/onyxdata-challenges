#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` DESCRIBES the data. This asks whether the data can support a CLAIM.

October looked, at first pass, like the first month in the programme where nothing was
broken: every identity the Data Dictionary states appeared to hold exactly, no orphans, market
share sums to 100%. That conclusion was wrong twice over. It came from testing only
WITHIN-column identities -- cross-column logic breaks in two places, and both are fingerprints
of the fabricated half of the file -- and one of the five within-column identities was
computed here and never asserted on, so "all five hold" was itself an untested claim.

The file is two datasets stapled together, and only one is a record of anything.

The checks, in order:

  1. GRAIN. Complaint ID unique; a genuine two-table star with no orphans.
  2. IDENTITIES. Four of the five the dictionary asserts hold exactly on any reading. THE
     FIFTH -- `Timely_Response_Rate` -- was computed here and never asserted on, so "every
     identity holds exactly" was printed as verified while being untested. It does hold,
     exactly, on the ALL-ROWS denominator: the file's own company dimension ships the
     93.77% definition this month rejects. On the resolved denominator it fails on 815 of
     1,081 companies. AND THE TABLE IS STILL LOGICALLY INCONSISTENT: 2,150 complaints were
     answered before they were received, and every in-progress complaint carries a response
     date. An earlier draft concluded "nothing is broken" -- it had only tested
     within-column identities.
  3. MISSINGNESS. `Timely response?` is null on exactly the in-progress complaints, but that
     is RIGHT-CENSORING confined to the last four months (2023-07 is 49% in progress,
     2023-08 is 82%), not clean structural missingness. Outcome measures must censor.
  4. IS THE HEADLINE METRIC NOISE? Response_Time_Days is U(0,30) globally AND within every
     channel, product and region (the June lesson).
  5. EFFECT SIZE OVER p. Pre-declared axes against the outcomes the brief asks about.
  6. CONFOUNDS / NORMALISATION. The shipped Q6 metric is arithmetically correct and ranks
     companies by 1/market_share. This is the month's thesis.
  7. THIN CELLS and POWER. Q7's null is only worth publishing with an MDE attached -- and
     with a POSITIVE test beside it: the counts fit an equal-share multinomial at
     chi2/df = 1.0395. "Two uniforms and a coin flip" is tested here too, and is wrong on
     two of the three columns even though the conclusion it supported is right.
  8. WHAT IS REAL. The consumer side: a genuine 1.71x volume trend on FULL months only,
     product concentration, geographic concentration.
  9. THE REGISTER IS REAL. Three positive tests, two of which had to be rewritten: IDs are
     NOT in strict date order (11.25% of adjacent pairs step backwards) and the taxonomy is
     NOT a tree (13 issues span products, covering 20.93% of rows).
 12. THE 2021 BREAK is universal on 15 of 16 testable cuts, and the 2023 figure is a
     censoring artefact unless the months from 2023-05 are held out.

    python 2025/10/analysis/integrity.py

Read-only.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import polars as pl
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = next(
    d
    for d in MONTH_DIR.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)
XLSX = next(RAW_DIR.rglob("*.xlsx"))

N_FACT = 62_516
N_COMPANY = 1_081
N_INPROGRESS = 1_494
EXCEL_EPOCH = np.datetime64("1899-12-30")

# Pre-declared BEFORE testing.
FACT_AXES = ["Submitted via", "Product", "Census_Region", "Company response to consumer"]
COMPANY_TRAITS = ["Company_Size_Tier", "Enforcement_History"]
COMPANY_NUMERIC = ["Market_Share_Percent", "Reputation_Score"]
COMPANY_OUTCOMES = ["Timely_Response_Rate", "Avg_Response_Time_Days", "Complaint_Count"]

fails: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if not ok:
        fails.append(msg)


def h(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    s = pl.read_excel(XLSX, sheet_id=0)
    f = s["Complaints (Fact)"].to_pandas()
    co = s["Company"].to_pandas()
    dd = s["Data Dictionary"].to_pandas()
    # Excel serials -> real dates. Kept as a derived column; the raw stays untouched.
    for c in ["Date submitted", "Date received", "Company_Response_Date"]:
        f[c + "_d"] = EXCEL_EPOCH + f[c].values.astype("timedelta64[D]")
    return f, co, dd


def eta_squared(groups: list[np.ndarray]) -> float:
    allv = np.concatenate(groups)
    gm = allv.mean()
    sst = ((allv - gm) ** 2).sum()
    return float(sum(len(g) * (g.mean() - gm) ** 2 for g in groups) / sst) if sst else 0.0


# ---------------------------------------------------------------------------------------
# 1. GRAIN
# ---------------------------------------------------------------------------------------
def check_grain(f: pd.DataFrame, co: pd.DataFrame, dd: pd.DataFrame) -> None:
    h("1. GRAIN - a genuine two-table star, and the ID is unique")
    check(len(f) == N_FACT, f"fact is {len(f):,} rows (expected {N_FACT:,})")
    check(len(co) == N_COMPANY, f"company dimension is {len(co):,} rows")
    check(
        f["Complaint ID"].nunique() == len(f),
        f"Complaint ID is unique: {f['Complaint ID'].nunique():,} over {len(f):,}",
    )
    print("        Standing scoreboard: NOT unique in May or June, unique in July, ABSENT in")
    print("        August, unique in September and October. Three of six.")
    check(len(f) - len(f.drop_duplicates()) == 0, "no duplicate rows")

    orphans = int((~f.Company_ID_1081.isin(co.Company_ID_1081)).sum())
    check(orphans == 0, f"no orphan company keys ({orphans})")
    unused = int((~co.Company_ID_1081.isin(f.Company_ID_1081)).sum())
    check(unused == 0, f"every company in the dimension appears in the fact ({unused} unused)")
    check(len(dd) == 28, f"the Data Dictionary documents {len(dd)} columns across both tables")


# ---------------------------------------------------------------------------------------
# 2. THE STATED IDENTITIES
# ---------------------------------------------------------------------------------------
def check_identities(f: pd.DataFrame, co: pd.DataFrame) -> None:
    h("2. IDENTITIES HOLD - AND THE TABLE IS STILL LOGICALLY INCONSISTENT")

    diff = f.Company_Response_Date - f["Date submitted"]
    check(
        int((f.Response_Time_Days != diff).sum()) == 0,
        f"Response_Time_Days = Company_Response_Date - Date submitted on all {len(f):,} rows",
    )

    agg = f.groupby("Company_ID_1081").agg(
        n=("Complaint ID", "size"),
        timely=(
            "Timely response?",
            lambda s: (s == "Yes").sum() / s.notna().sum() if s.notna().sum() else np.nan,
        ),
        avg=("Response_Time_Days", "mean"),
    )
    m = co.set_index("Company_ID_1081").join(agg)
    check(
        int((m.Complaint_Count != m.n).sum()) == 0,
        f"Complaint_Count matches the fact for all {len(m):,} companies "
        f"(total {int(m.Complaint_Count.sum()):,})",
    )
    check(
        float((m.Avg_Response_Time_Days - m.avg).abs().max()) < 1e-9,
        "Avg_Response_Time_Days matches the fact exactly",
    )
    kpi_err = float(
        (m.Complaints_per_1pct_Share - m.Complaint_Count / m.Market_Share_Percent).abs().max()
    )
    check(
        kpi_err < 1e-3,
        f"Complaints_per_1pct_Share = Complaint_Count / Market_Share_Percent "
        f"(max error {kpi_err:.1e})",
    )
    check(
        abs(co.Market_Share_Percent.sum() - 100) < 0.01,
        f"market share sums to {co.Market_Share_Percent.sum():.4f}%",
    )
    print("        Timely_Response_Rate is stored as a FRACTION (0.81-1.00) although the")
    print("        dictionary calls it a 'Percentage'. Reading it as documented would")
    print("        understate every company 100-fold -- so one identity is DOCUMENTED WRONG.")

    # THE FIFTH IDENTITY, WHICH THIS FUNCTION USED TO COMPUTE AND NEVER ASSERT ON.
    # `m.timely` above is the RESOLVED-denominator rate. Four check() calls followed and none
    # of them covered it, so "every identity the dictionary states holds exactly" was printed
    # as verified while being untested -- 4 of 5, not 5 of 5.
    #
    # It does hold. Exactly, on 1,081 of 1,081 companies -- but on the ALL-ROWS denominator,
    # i.e. counting the 1,494 in-progress complaints as untimely. That is precisely the
    # 93.77% definition this month rejects in assumptions.md A-1 and enforces in build.py,
    # data.ts and metric_checks.yml. The file's own company dimension ships the denominator
    # the analysis calls the single easiest wrong number to publish from it.
    all_rows = f.groupby("Company_ID_1081")["Timely response?"].apply(
        lambda s: (s == "Yes").sum() / len(s)
    )
    err_all = (m.Timely_Response_Rate - all_rows).abs()
    err_res = (m.Timely_Response_Rate - m.timely).abs()
    check(
        int((err_all < 1e-9).sum()) == len(m),
        f"Timely_Response_Rate = timely / ALL complaints on {int((err_all < 1e-9).sum()):,}/"
        f"{len(m):,} companies (max error {err_all.max():.1e}) -- the identity holds, on the "
        "denominator this month rejects",
    )
    check(
        int((err_res >= 1e-9).sum()) > 0,
        f"...and FAILS on the resolved denominator for {int((err_res >= 1e-9).sum()):,} of "
        f"{len(m):,} companies (max error {err_res.max():.4f}, mean {err_res.mean():.4f}) -- "
        "so the dashboard's 96.06% and the dimension's column are not the same measure",
    )
    w = float((m.Timely_Response_Rate * m.Complaint_Count).sum() / m.Complaint_Count.sum() * 100)
    naive = float((f["Timely response?"] == "Yes").mean() * 100)
    check(
        abs(w - naive) < 1e-6,
        f"count-weighting the shipped column reproduces the WRONG headline exactly: "
        f"{w:.4f}% against the all-rows {naive:.4f}%",
    )

    # EVERY STATED IDENTITY HOLDS AND THE TABLE IS STILL LOGICALLY INCONSISTENT.
    # An earlier draft of this check concluded "nothing is broken". That was wrong: it only
    # tested WITHIN-column identities and never cross-column logic. Two violations, and both
    # are fingerprints of the fabricated date pair.
    early = int((f.Company_Response_Date < f["Date received"]).sum())
    check(
        early > 0,
        f"DEFECT CONFIRMED: {early:,} complaints ({early / len(f) * 100:.2f}%) were ANSWERED BEFORE THEY WERE "
        f"RECEIVED -- up to {int((f['Date received'] - f.Company_Response_Date).max())} days early",
    )
    inprog = f["Company response to consumer"] == "In progress"
    with_date = int(f.loc[inprog, "Company_Response_Date"].notna().sum())
    check(
        with_date == N_INPROGRESS,
        f"DEFECT CONFIRMED: all {with_date:,} 'In progress' complaints carry a response date and a "
        "response time -- you cannot be in progress and have responded",
    )
    print("        Response_Time_Days is the only date arithmetic in the file that ignores")
    print("        `Date received`, which is exactly what generates these rows.")


# ---------------------------------------------------------------------------------------
# 3. MISSINGNESS - and a number I published wrong
# ---------------------------------------------------------------------------------------
def check_missingness(f: pd.DataFrame) -> None:
    h("3. MISSINGNESS - right-censored, not structural, and it moves the headline")
    nulls = f[[c for c in f.columns if not c.endswith("_d")]].isna().sum()
    for c, n in nulls[nulls > 0].items():
        print(f"        {c:32} {n:6,}  ({n / len(f) * 100:.1f}%)")

    inprog = f["Company response to consumer"] == "In progress"
    check(int(inprog.sum()) == N_INPROGRESS, f"{int(inprog.sum()):,} complaints are In progress")
    check(
        int((f["Timely response?"].isna() != inprog).sum()) == 0,
        "`Timely response?` is null on EXACTLY the in-progress complaints and nowhere else",
    )

    # ...but that is NOT clean structural missingness. It is RIGHT-CENSORING confined to the
    # last four months. An earlier draft called it "perfectly structural" and excluded the
    # nulls, which silently makes the newest months look perfect: only the fast ones have
    # resolved yet.
    by_m = (
        f.assign(m=f["Date submitted_d"].values.astype("datetime64[M]"))
        .groupby("m")
        .agg(
            n=("Complaint ID", "size"), inprog=("Timely response?", lambda s: s.isna().mean() * 100)
        )
    )
    tail = by_m.tail(5)
    print("\n        In-progress share by month -- this is CENSORING, not missingness:")
    for m, r in tail.iterrows():
        print(f"          {str(m)[:7]}  n={int(r.n):5,}  in progress {r.inprog:5.2f}%")
    check(
        tail.inprog.iloc[-1] > 50,
        f"the final month is {tail.inprog.iloc[-1]:.1f}% in progress and the one before it "
        f"{tail.inprog.iloc[-2]:.1f}% -- any OUTCOME measure must censor from 2023-05, not "
        "merely drop the nulls",
    )

    naive = (f["Timely response?"] == "Yes").mean() * 100
    correct = (f.loc[f["Timely response?"].notna(), "Timely response?"] == "Yes").mean() * 100
    print(f"\n        timeliness counting In-progress as UNTIMELY : {naive:.2f}%")
    print(f"        timeliness excluding In-progress (correct)   : {correct:.2f}%")
    check(
        correct - naive > 2,
        f"the denominator is worth {correct - naive:.2f}pp -- an earlier draft of brief.md "
        f"published {naive:.2f}% and has been corrected to {correct:.2f}%",
    )
    print("        A complaint still in progress has not failed to be timely; it has not yet")
    print("        been judged. Putting it in the denominator as a failure is the single")
    print("        easiest wrong number to publish from this file.")


# ---------------------------------------------------------------------------------------
# 4. IS THE HEADLINE METRIC NOISE?
# ---------------------------------------------------------------------------------------
def check_noise(f: pd.DataFrame) -> None:
    h("4. NOISE - response time is a uniform draw, and 'timely' is unrelated to it")

    rt = f.Response_Time_Days.values
    cnt = np.bincount(rt, minlength=31)
    p = stats.chisquare(cnt).pvalue
    check(
        p > 0.05,
        f"Response_Time_Days is U(0,30): chi2 p={p:.4f}, mean {rt.mean():.3f} "
        f"(uniform 15.000), sd {rt.std(ddof=1):.3f} (uniform 8.944)",
    )

    print("\n        And uniform WITHIN every group, not just pooled (the June lesson):")
    for col in FACT_AXES:
        ps = []
        for _k, g in f.groupby(col):
            if len(g) < 500:
                continue
            ps.append(
                stats.chisquare(np.bincount(g.Response_Time_Days.values, minlength=31)).pvalue
            )
        if ps:
            print(
                f"          {col:32} {len(ps):2} groups, "
                f"p range {min(ps):.3f}-{max(ps):.3f}, rejecting {sum(1 for x in ps if x < 0.05)}"
            )
            check(
                sum(1 for x in ps if x < 0.05) == 0, f"no group within {col} departs from uniform"
            )

    resolved = f[f["Timely response?"].notna()]
    y = resolved.loc[resolved["Timely response?"] == "Yes", "Response_Time_Days"]
    n = resolved.loc[resolved["Timely response?"] == "No", "Response_Time_Days"]
    pv = stats.mannwhitneyu(y, n).pvalue
    print(f"\n        'Yes' took {y.mean():.2f} days on average; 'No' took {n.mean():.2f}.")
    check(
        pv > 0.05,
        f"`Timely response?` is INDEPENDENT of how long the response took (p={pv:.3f}) -- "
        "it is a label, not a measurement of speed",
    )
    print("        Both span the full 0-30 range. A 'timely' response takes exactly as long")
    print("        as an untimely one, so brief Q5's 'how fast' has no answer in this file.")


# ---------------------------------------------------------------------------------------
# 5 + 6. THE NORMALISATION TRAP - this month's thesis
# ---------------------------------------------------------------------------------------
def check_normalisation(co: pd.DataFrame) -> None:
    h("5+6. THE Q6 METRIC IS CORRECT ARITHMETIC AND A WRONG ANSWER")

    r_share, p_share = stats.spearmanr(co.Market_Share_Percent, co.Complaint_Count)
    r_inv, _ = stats.spearmanr(1 / co.Market_Share_Percent, co.Complaints_per_1pct_Share)
    r_num, _ = stats.spearmanr(co.Complaint_Count, co.Complaints_per_1pct_Share)
    check(
        p_share > 0.05,
        f"complaint volume does NOT track market share: Spearman {r_share:+.4f} (p={p_share:.3f})",
    )
    check(r_inv > 0.95, f"the shipped KPI tracks 1/market_share at Spearman {r_inv:+.4f}")
    check(r_num < 0.3, f"...and tracks the numerator it is meant to normalise at only {r_num:+.4f}")

    print("\n        Complaint volume is flat across size, while the KPI is not:\n")
    print(f"        {'tier':8}{'n':>6}{'mean share':>13}{'mean complaints':>18}{'mean KPI':>12}")
    for tier in ["Large", "Medium", "Small"]:
        s = co[co.Company_Size_Tier == tier]
        if not len(s):
            continue
        print(
            f"        {tier:8}{len(s):6,}{s.Market_Share_Percent.mean():12.4f}%"
            f"{s.Complaint_Count.mean():18.1f}{s.Complaints_per_1pct_Share.mean():12.1f}"
        )
    g = [x.Complaint_Count.values for _, x in co.groupby("Company_Size_Tier")]
    pv = stats.kruskal(*g).pvalue
    check(pv > 0.05, f"complaint count does not differ by size tier (Kruskal p={pv:.3f})")
    ratio = (
        co[co.Company_Size_Tier == "Small"].Complaints_per_1pct_Share.mean()
        / co[co.Company_Size_Tier == "Large"].Complaints_per_1pct_Share.mean()
    )
    check(
        ratio > 5,
        f"yet the KPI is {ratio:.1f}x higher for Small than Large -- entirely the denominator",
    )

    top = co.nlargest(10, "Complaints_per_1pct_Share")
    check(
        (top.Company_Size_Tier == "Small").all(),
        f"all 10 'worst offenders' by the shipped metric are Small-tier, "
        f"every one at the minimum {top.Market_Share_Percent.min():.4f}% share",
    )
    print("        A regulator ranking on this column targets small companies for being small.")

    # Is timeliness a real differentiator between companies, or sampling noise?
    print("\n        And company timeliness carries no real between-company variation:")
    p_bar = co.Timely_Response_Rate.mean()
    n_bar = co.Complaint_Count.mean()
    expected_sd = np.sqrt(p_bar * (1 - p_bar) / n_bar)
    obs_sd = co.Timely_Response_Rate.std()
    print(
        f"          observed sd {obs_sd:.4f}   binomial expectation at n~{n_bar:.0f}: {expected_sd:.4f}"
    )
    check(
        abs(obs_sd / expected_sd - 1) < 0.15,
        f"observed/expected sd = {obs_sd / expected_sd:.3f} -- the spread in company timeliness "
        "is SAMPLING NOISE, so ranking companies on it ranks nothing",
    )


# ---------------------------------------------------------------------------------------
# 7. Q7's NULL, WITH POWER
# ---------------------------------------------------------------------------------------
def check_traits_and_power(co: pd.DataFrame) -> None:
    h("7. Q7 - company traits correlate with nothing, and here is what we could have seen")

    # WHAT THE TRAITS ACTUALLY ARE. brief.md's thesis paragraph called them "two uniforms
    # and a coin flip". That is wrong on two of the three, and the sentence sat inside the
    # claim the whole month rests on, so it is tested here rather than asserted there.
    print("  The distributional characterisation, tested rather than asserted:\n")
    rep = co.Reputation_Score
    rc = rep.value_counts().sort_index()
    p_rep = stats.chisquare(rc.values).pvalue
    check(
        p_rep > 0.05,
        f"Reputation_Score IS uniform: integers {int(rep.min())}-{int(rep.max())}, "
        f"{len(rc)} levels, chi2 p={p_rep:.4f}, mean {rep.mean():.3f} vs "
        f"{(rep.min() + rep.max()) / 2:.3f} expected",
    )
    ms = co.Market_Share_Percent.values
    ks = stats.kstest(ms, "uniform", args=(ms.min(), ms.max() - ms.min()))
    check(
        ks.pvalue < 1e-6,
        f"Market_Share_Percent is NOT uniform: KS D={ks.statistic:.4f}, p={ks.pvalue:.2e}; "
        f"mean {ms.mean():.4f} against a uniform midpoint of {(ms.min() + ms.max()) / 2:.4f}, "
        f"skew {stats.skew(ms):+.3f}. Right-skewed, which is what real market shares are.",
    )
    yes = int((co.Enforcement_History == "Yes").sum())
    p_bin = stats.binomtest(yes, len(co), 0.5).pvalue
    check(
        p_bin < 1e-6,
        f"Enforcement_History is NOT a coin flip: {yes}/{len(co)} = "
        f"{yes / len(co) * 100:.2f}% Yes, binomial p vs 0.5 = {p_bin:.2e}",
    )
    print(
        f"        Company_Size_Tier is {dict(co.Company_Size_Tier.value_counts())} -- also neither."
    )
    print("        The CONCLUSION the sentence supported survives untouched: none of these")
    print("        columns carries information about any outcome. Only the description of")
    print("        their shapes was wrong, and it was wrong inside the thesis paragraph.\n")

    n_tests = len(COMPANY_TRAITS + COMPANY_NUMERIC) * len(COMPANY_OUTCOMES)
    alpha = 0.05 / n_tests
    print(f"  {n_tests} pre-declared tests, Bonferroni alpha = {alpha:.2e}\n")
    n_sig = 0
    for t in COMPANY_NUMERIC:
        for o in COMPANY_OUTCOMES:
            rho, pv = stats.spearmanr(co[t], co[o])
            n_sig += pv < alpha
            print(f"    {t:22} -> {o:24} rho={rho:+.4f}  p={pv:.4f}")
    for t in COMPANY_TRAITS:
        for o in COMPANY_OUTCOMES:
            g = [x[o].values for _, x in co.groupby(t)]
            pv = stats.kruskal(*g).pvalue
            n_sig += pv < alpha
            print(f"    {t:22} -> {o:24} KW p={pv:.4f}  eta2={eta_squared(g):.5f}")
    check(n_sig == 0, f"0 of {n_tests} trait-outcome tests clear Bonferroni")

    print("\n  What WOULD have been detectable (80% power, alpha=0.05):")
    co.Timely_Response_Rate.mean()
    for t in COMPANY_TRAITS:
        vc = co[t].value_counts()
        n1, n2 = int(vc.iloc[0]), int(vc.iloc[-1])
        # each company's rate is itself measured on ~58 complaints, so the between-company
        # variance is the binomial one; the MDE below is on the COMPANY-LEVEL mean rate
        sd = co.Timely_Response_Rate.std()
        mde = 2.8 * sd * np.sqrt(1 / n1 + 1 / n2)
        print(f"    {t:22} n={n1:5,} vs {n2:5,}  MDE on timely rate = {mde * 100:.2f}pp")
    for t in COMPANY_NUMERIC:
        # Spearman detectable at 80% power, two-sided
        rho_min = 2.8 / np.sqrt(len(co) - 3)
        print(f"    {t:22} n={len(co):5,}          MDE on Spearman rho = {rho_min:.3f}")
    print("  Every observed effect is far below these. The null is a measurement.")

    # A NULL IS NOT EVIDENCE OF A DRAW. This is the positive test the company thesis owed:
    # if the 62,516 complaints were dealt to 1,081 companies by an equal-share multinomial,
    # the counts would fit one. They do -- chi2/df ~ 1.00 and a p-value that is not extreme
    # in EITHER tail, so the counts are neither over- nor under-dispersed.
    obs = co.Complaint_Count.values.astype(float)
    exp = obs.sum() / len(obs)
    c2 = float(((obs - exp) ** 2 / exp).sum())
    dof = len(obs) - 1
    pv = float(stats.chi2.sf(c2, dof))
    print("\n  POSITIVE test - complaint counts vs an equal-share multinomial:")
    print(
        f"    chi2={c2:,.1f}  df={dof:,}  chi2/df={c2 / dof:.4f}  p={pv:.4f}  "
        f"(mean {obs.mean():.2f}, variance {obs.var(ddof=1):.2f})"
    )
    check(
        0.01 < pv < 0.99,
        f"complaint counts FIT an equal-share multinomial at chi2/df={c2 / dof:.4f} "
        f"(p={pv:.4f}) -- the overlay is not merely 'not significant', it is the shape "
        "a random deal produces",
    )


# ---------------------------------------------------------------------------------------
# 8. WHAT IS REAL
# ---------------------------------------------------------------------------------------
def check_what_is_real(f: pd.DataFrame) -> None:
    h("8. WHAT IS REAL - the consumer side carries genuine structure")

    # FULL MONTHS ONLY. This function used to fit all 76 and print +8.25/month, which is the
    # figure brief.md records as an ERROR ("the +8.25 figure included the known-partial final
    # month, which the same brief says must never be used"). The script that certifies the
    # brief was still computing the number the brief disowns.
    m_all = f.groupby(f["Date submitted_d"].values.astype("datetime64[M]")).size()
    m = m_all.iloc[:-1]
    sl, _ic, rr, pv, _se = stats.linregress(np.arange(len(m)), m.values)
    sl_all = stats.linregress(np.arange(len(m_all)), m_all.values).slope
    check(
        pv < 1e-6,
        f"complaint volume trends {sl:+.4f}/month over {len(m)} FULL months "
        f"(r={rr:.4f}, p={pv:.1e}) -- volume grows "
        f"{m.values[-12:].mean() / m.values[:12].mean():.4f}x over the span, not 'triples'",
    )
    print(
        f"        {m_all.index[0]} .. {m_all.index[-1]}   min {m_all.min():,}  max {m_all.max():,}"
    )
    print(f"        Including the partial final month gives {sl_all:+.4f}/month - the figure")
    print("        brief.md records as an error. The final month stops 2023-08-28 and must")
    print("        not be drawn as a fall; the month before it is the series maximum.")

    print("\n        Concentration - real, and the thing a regulator can act on:")
    for col in ["Product", "State", "Issue"]:
        vc = f[col].value_counts()
        top = vc.head(3).sum() / len(f) * 100
        print(
            f"          {col:10} {vc.size:3} values, top 3 = {top:5.1f}% of all complaints "
            f"({', '.join(vc.head(2).index.astype(str))})"
        )
    check(
        f.Product.value_counts().head(2).sum() / len(f) > 0.6,
        "the top two products are "
        f"{f.Product.value_counts().head(2).sum() / len(f) * 100:.1f}% of every complaint",
    )

    print("\n        But state 'hotspots' have NO denominator in this file:")
    cols = [c for c in f.columns if any(k in c.lower() for k in ("pop", "capita", "household"))]
    check(cols == [], f"no population or per-capita column exists ({cols or 'none'})")
    vc = f.State.value_counts()
    print(
        f"          top 4 states = {vc.head(4).sum() / len(f) * 100:.1f}% of complaints "
        f"({', '.join(vc.head(4).index)})"
    )
    print("          which is the four most populous states. Ranking states by raw volume")
    print("          ranks them by population, and brief Q2 asks for 'hotspots'.")


# ---------------------------------------------------------------------------------------
# 9. THE REGISTER IS REAL - positive evidence for the consumer half
#
# An earlier draft asserted "the consumer side is real" and gave it a free pass it had
# denied the company side. These are the positive tests it owed - and two of the three it
# published did not survive being written down properly:
#
#   "IDs in STRICT date order"  -> false. rho = 0.9999878, but 7,036 of 62,515 adjacent
#                                  pairs (11.25%) step BACKWARDS. Strict means zero. The
#                                  test actually run (rho > 0.999) is a monotonicity test.
#   "the taxonomy is a TREE"    -> overstated. 13 of 76 issues appear under more than one
#                                  product and those issues carry 20.93% of the register.
#                                  The test actually run (cells < 25% of possible) is a
#                                  SPARSITY test, which a non-tree passes easily.
#
# Both are replaced below by the strongest claim the data actually supports, and the
# refutation of the old wording is asserted alongside it so it cannot quietly come back.
# ---------------------------------------------------------------------------------------
def check_register_is_real(f: pd.DataFrame) -> None:
    h("9. THE CONSUMER SIDE IS A REAL REGISTER - positive tests, not a free pass")

    o = f.sort_values("Complaint ID")
    rho = stats.spearmanr(f["Complaint ID"], f["Date submitted"]).statistic
    steps = np.diff(o["Date submitted"].values)
    back = int((steps < 0).sum())
    check(
        rho > 0.999,
        f"Complaint ID tracks submission date at Spearman {rho:.7f} "
        f"(range {f['Complaint ID'].min():,}-{f['Complaint ID'].max():,}, "
        f"{len(f) / (f['Complaint ID'].max() - f['Complaint ID'].min()) * 100:.1f}% dense)",
    )
    check(
        back > 0,
        f"...but NOT in strict date order: {back:,} of {len(steps):,} adjacent pairs "
        f"({back / len(steps) * 100:.2f}%) move backwards, by a median of "
        f"{abs(np.median(steps[steps < 0])):.0f} day(s), worst {abs(steps.min()):,}. "
        "'Strict' means zero, and the published masthead said strict.",
    )
    med = o.groupby(o["Date submitted_d"].values.astype("datetime64[M]"))["Complaint ID"].median()
    rising = int((np.diff(med.values) > 0).sum())
    check(
        rising == len(med) - 1,
        f"WHAT DOES HOLD: the median Complaint ID rises in every one of the "
        f"{len(med) - 1} month-to-month steps. A sequential issuing register with "
        "day-scale jitter, which is what a real intake queue looks like.",
    )

    wd = f["Date submitted_d"].dt.dayofweek.value_counts().sort_index()
    exp = len(f) / 7
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    print("\n        Day-of-week, observed / expected:")
    print("          " + "   ".join(f"{names[i]} {wd[i] / exp:.2f}" for i in range(7)))
    pv = stats.chisquare(wd.values).pvalue
    check(
        wd[5] / exp < 0.7 and wd[6] / exp < 0.7,
        f"weekends collapse (Sat {wd[5] / exp:.4f}, Sun {wd[6] / exp:.4f}) -- chi2 p={pv:.1e}. "
        "Multinomial draws do not produce weekends.",
    )

    # The taxonomy is HIERARCHICAL. It is not a tree, and the sparsity test never said it was.
    cells = f.groupby(["Product", "Issue"]).size()
    possible = f.Product.nunique() * f.Issue.nunique()
    per_issue = f.groupby("Issue").Product.nunique()
    multi = per_issue[per_issue > 1].index
    multi_rows = int(f.Issue.isin(multi).sum())
    modal = int(
        f[f.Issue.isin(multi)].groupby(["Issue", "Product"]).size().groupby(level=0).max().sum()
    )
    check(
        len(cells) < possible * 0.25,
        f"the taxonomy is SPARSE: {len(cells)} of {possible} Product x Issue cells are "
        f"populated ({len(cells) / possible * 100:.2f}%)",
    )
    check(
        int((per_issue == 1).sum()) / len(per_issue) > 0.75,
        f"and strongly HIERARCHICAL: {int((per_issue == 1).sum())} of {len(per_issue)} issues "
        "sit under exactly one product",
    )
    check(
        len(multi) > 0,
        f"...but it is NOT a tree: {len(multi)} issues appear under up to "
        f"{int(per_issue.max())} products and carry {multi_rows:,} rows = "
        f"{multi_rows / len(f) * 100:.2f}% of the register. Of those, "
        f"{(multi_rows - modal) / len(f) * 100:.2f}% of the file sits outside its issue's "
        "modal product -- so 'a genuine tree' was an overstatement, not a small one.",
    )


# ---------------------------------------------------------------------------------------
# 10. WHERE THE MONEY IS - the affirmative finding (brief Q3 + Q4)
#
# Q4 asks which issues are "most severe". There is no severity column, so monetary relief
# rate is used AS A PROXY and labelled as one throughout. An earlier draft skipped this
# question entirely and left the file's largest effect on the table.
# ---------------------------------------------------------------------------------------
def check_where_the_money_is(f: pd.DataFrame) -> None:
    h("10. WHERE THE MONEY IS - relief concentration (Q3 + Q4)")

    g = (
        f.groupby("Issue")
        .agg(
            n=("Complaint ID", "size"),
            money=(
                "Company response to consumer",
                lambda s: (s == "Closed with monetary relief").mean() * 100,
            ),
        )
        .query("n >= 300")
        .sort_values("money", ascending=False)
    )
    print(
        f"        {len(g)} issues with n>=300; monetary relief rate "
        f"{g.money.min():.2f}% .. {g.money.max():.2f}%\n"
    )
    print(f"        {'issue':52}{'n':>7}{'relief %':>10}")
    for k, r in list(g.head(4).iterrows()) + list(g.tail(3).iterrows()):
        print(f"        {k[:50]:52}{int(r.n):7,}{r.money:9.2f}%")
    check(
        g.money.max() / max(g.money.min(), 0.01) > 20,
        f"the spread is {g.money.max() / g.money.min():.0f}x across issues -- an order of "
        "magnitude larger than anything on the company side",
    )

    # Chi-square with effect size, on the pre-declared axes.
    for col in ["Issue", "Product"]:
        sub = f[f.groupby(col)["Complaint ID"].transform("size") >= 300]
        ct = pd.crosstab(
            sub[col], sub["Company response to consumer"] == "Closed with monetary relief"
        )
        chi2, pv, _, _ = stats.chi2_contingency(ct)
        v = np.sqrt(chi2 / (ct.values.sum() * (min(ct.shape) - 1)))
        check(
            pv < 1e-6, f"{col} -> monetary relief: Cramer V={v:.3f}, chi2={chi2:,.0f}, p={pv:.1e}"
        )

    # The supervision priority list: where relief actually concentrates.
    pair = (
        f.assign(money=f["Company response to consumer"] == "Closed with monetary relief")
        .groupby(["Product", "Issue"])
        .agg(n=("money", "size"), relieved=("money", "sum"))
    )
    pair = pair.sort_values("relieved", ascending=False)
    top5 = pair.head(5)
    share = top5.relieved.sum() / pair.relieved.sum() * 100
    vol = top5.n.sum() / pair.n.sum() * 100
    print(
        f"\n        Top 5 product-issue pairs = {share:.1f}% of ALL monetary relief "
        f"on {vol:.1f}% of complaints:"
    )
    for (prod, iss), r in top5.iterrows():
        print(
            f"          {str(prod)[:28]:30} {str(iss)[:34]:36} "
            f"n={int(r.n):6,}  relieved={int(r.relieved):5,}"
        )
    check(share > 50, f"relief is concentrated: {share:.1f}% of it sits in five pairs")


# ---------------------------------------------------------------------------------------
# 11. THE TWO CLOCKS - one fabricated, one real (brief Q5 + Q8)
#
# An earlier draft declared Q5 unanswerable after finding Response_Time_Days uniform. It
# was looking at the fabricated date pair. `Date received - Date submitted` is the intake
# lag, it is NOT uniform, and it separates channels enormously.
# ---------------------------------------------------------------------------------------
def check_two_clocks(f: pd.DataFrame) -> None:
    h("11. TWO CLOCKS - Response_Time_Days is fabricated; the intake lag is real")

    lag = f["Date received"] - f["Date submitted"]
    print(
        f"        intake lag: median {lag.median():.0f}, mean {lag.mean():.3f}, "
        f"p99 {lag.quantile(0.99):.0f}, max {lag.max():,}"
    )
    print(f"\n        {'channel':16}{'n':>8}{'mean lag':>11}{'% delayed':>12}")
    groups = []
    for ch, g in f.assign(lag=lag).groupby("Submitted via"):
        if len(g) < 50:
            continue
        groups.append(g.lag.values)
        print(f"        {ch:16}{len(g):8,}{g.lag.mean():11.3f}{(g.lag > 0).mean() * 100:11.1f}%")
    H = stats.kruskal(*groups)
    n = sum(len(x) for x in groups)
    eps2 = (H.statistic - len(groups) + 1) / (n - len(groups))
    check(
        eps2 > 0.2,
        f"channel explains the intake lag: Kruskal H={H.statistic:,.0f}, epsilon^2={eps2:.3f} "
        "-- Referral is delayed on three quarters of complaints, Web on eight per cent",
    )
    print("        This is the only speed measure in the file that is not fabricated, and it")
    print("        answers Q5's 'how fast' and Q8's 'do channels differ' at the same time.")

    # ...and it is null by COMPANY, which confirms the company thesis on a fresh column.
    by_co = [g.values for _, g in f.assign(lag=lag).groupby("Company_ID_1081").lag if len(g) > 20]
    pv = stats.kruskal(*by_co).pvalue
    check(
        pv > 0.05,
        f"but the intake lag does NOT vary by company (Kruskal p={pv:.3f}) -- the company "
        "thesis holds on a column it was never tested on",
    )


# ---------------------------------------------------------------------------------------
# 12. TIMELINESS BROKE IN 2021 (brief Q5)
# ---------------------------------------------------------------------------------------
def check_timeliness_break(f: pd.DataFrame) -> None:
    h("12. TIMELINESS BROKE IN 2021 - the answer 96.06% hides")

    f = f.assign(yr=f["Date submitted_d"].dt.year)
    res = f[f["Timely response?"].notna()]
    print(f"        {'year':>6}{'n resolved':>12}{'timely %':>11}{'untimely':>10}")
    rows = []
    for yr, g in res.groupby("yr"):
        t = (g["Timely response?"] == "Yes").mean() * 100
        rows.append((yr, len(g), t))
        print(
            f"        {yr:>6}{len(g):>12,}{t:>10.2f}%{int((g['Timely response?'] == 'No').sum()):>10,}"
        )
    pre = np.mean([r[2] for r in rows if r[0] <= 2020])
    post = min(r[2] for r in rows if r[0] >= 2021)
    check(
        pre - post > 8,
        f"timeliness runs {pre:.2f}% through 2020 then falls to {post:.2f}% -- a regime "
        "break, not a drift, and pooling to one 96.06% figure hides it",
    )

    # Is it compositional, or universal?
    #
    # The dashboard published "the break is universal across product, channel and region"
    # with no query behind it: this function tested Mortgage and nothing else, which is a
    # counter-example, not a universality test. THIS is the query. A cut is TESTABLE with
    # >= 30 resolved complaints on each side of the boundary and FALLS when its 2021 rate is
    # more than 5pp below its pre-2021 rate -- the same rule as `breakUniversality()` in
    # app/src/data.ts and `break_tested` / `break_falling` in model/metric_checks.yml.
    mort = res[res.Product == "Mortgage"]
    m21 = (mort[mort.yr == 2021]["Timely response?"] == "Yes").mean() * 100
    check(
        m21 > 99,
        f"Mortgage holds at {m21:.2f}% in 2021 while everything else breaks -- "
        f"the one product that never fails (n={len(mort[mort.yr == 2021]):,})",
    )

    MIN_N, MIN_DROP = 30, 5.0
    print(f"\n        Universality, all cuts with n>={MIN_N} either side of the boundary:")
    print(
        f"        {'cut':9}{'value':46}{'n pre':>7}{'n 2021':>8}{'pre %':>9}"
        f"{'2021 %':>9}{'drop':>8}"
    )
    tested = falling = skipped = 0
    for cut, col in [
        ("product", "Product"),
        ("channel", "Submitted via"),
        ("region", "Census_Region"),
    ]:
        for k, g in res.groupby(col):
            a = g[g.yr <= 2020]
            b = g[g.yr == 2021]
            if len(a) < MIN_N or len(b) < MIN_N:
                skipped += 1
                continue
            ra = (a["Timely response?"] == "Yes").mean() * 100
            rb = (b["Timely response?"] == "Yes").mean() * 100
            tested += 1
            falling += ra - rb > MIN_DROP
            print(
                f"        {cut:9}{str(k)[:44]:46}{len(a):7,}{len(b):8,}{ra:8.2f}%"
                f"{rb:8.2f}%{ra - rb:7.2f}pp"
            )
    check(
        falling == tested - 1,
        f"the break is universal with exactly ONE exception: {falling} of {tested} testable "
        f"cuts fall by more than {MIN_DROP:.0f}pp ({skipped} cuts too thin to test)",
    )

    # ...and the 2023 bar is a CENSORING artefact unless the censored months are held out.
    # .workbench/docs/LEARNINGS.md records this trap for this month: excluding a partial
    # period from a warning is not excluding it from a figure. The shipped app pooled them
    # anyway.
    m = f.assign(mo=f["Date submitted_d"].values.astype("datetime64[M]"))
    cutoff = np.datetime64("2023-05")
    r23 = res.assign(mo=res["Date submitted_d"].values.astype("datetime64[M]"))
    r23 = r23[r23.yr == 2023]
    pooled = (r23["Timely response?"] == "Yes").mean() * 100
    early = r23[r23.mo < cutoff]
    cens = (early["Timely response?"] == "Yes").mean() * 100
    print("\n        Right-censoring, month by month, from the boundary:")
    for mo, g in m[m.mo >= cutoff].groupby("mo"):
        done = g[g["Timely response?"].notna()]
        print(
            f"          {str(mo)[:7]}  n={len(g):5,}  in progress "
            f"{g['Timely response?'].isna().mean() * 100:5.2f}%  "
            f"timely among resolved {(done['Timely response?'] == 'Yes').mean() * 100:6.2f}%"
        )
    check(
        pooled - cens > 3,
        f"the 2023 bar is {pooled:.4f}% pooled and {cens:.4f}% on the uncensored window "
        f"(Jan-Apr, n={len(early):,}) -- {pooled - cens:.2f}pp of apparent recovery is "
        f"{len(r23) - len(early):,} fast cases closing first",
    )


def main() -> int:
    f, co, dd = load()
    print(
        f"Loaded {len(f):,} complaints x {f.shape[1]} cols, {len(co):,} companies, "
        f"{len(dd)}-row dictionary"
    )
    check_grain(f, co, dd)
    check_identities(f, co)
    check_missingness(f)
    check_noise(f)
    check_normalisation(co)
    check_traits_and_power(co)
    check_what_is_real(f)
    check_register_is_real(f)
    check_where_the_money_is(f)
    check_two_clocks(f)
    check_timeliness_break(f)

    h("RESULT")
    if fails:
        print(f"{len(fails)} CHECK(S) FAILED - the source data changed. Revisit profile.md.")
        for x in fails:
            print(f"  - {x}")
        return 1
    print("All checks pass. The conclusions in analysis/profile.md are reproduced above.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
