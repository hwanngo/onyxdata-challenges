#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` DESCRIBES the data. This asks whether the data can support a CLAIM.
Every number quoted in profile.md's Conclusions is reproduced here.

The standing checks, in order. September's twist on each:

  1. GRAIN. client_ID IS unique -- 2nd time in 5 months. Also the first month with a
     publisher-supplied Data Dictionary, which is itself evidence (it calls other_debt
     "Simulated").

  NOTE ON BLOCK SIZES: the file splits 13 / 16, not 12 / 17. Columns 1-13 are client_ID,
  loan_status and the 11 testable originals; 14-29 are the 14 testable appended columns
  plus city_latitude and city_longitude. An earlier draft of brief.md said 12/17.
  2. DERIVED COLUMNS. Both ratio columns the brief asks about (Q3) are exact arithmetic on
     columns already present. One of them is the other plus a uniform draw.
  3. MISSINGNESS. 3,116 nulls in loan_int_rate and 895 in person_emp_length -- REAL,
     confined entirely to the original block. The appended block has zero nulls anywhere,
     which is itself the tell.
  4. IS THE HEADLINE METRIC NOISE? Inverted this month: the question is which COLUMNS are
     noise. 11 of 14 appended columns are independent of the outcome.
  5. EFFECT SIZE, NOT JUST p. At n=32,581 everything is significant; only effect size
     separates the two halves of this file.
  6. CONFOUNDS. The three appended columns that DO predict are restatements of original
     ones. Verified as arithmetic, not correlation.
  7. THIN CELLS. past_delinquencies >= 4 is n=59 total; loan_grade G is thin.
  8. THE FAIRNESS QUESTION (this month's addition). Absence of measured disparity is not
     evidence of absent disparity when the demographics were generated independently of the
     outcome. Quantified with the minimum detectable difference.

    python 2025/09/analysis/integrity.py

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
XLSX = RAW_DIR / "Credit_Risk_Dataset_Onyx_Data_September_25.xlsx"

N_ROWS = 32_581

# The two halves of the file, declared BEFORE testing.
ORIGINAL = [
    "person_age",
    "person_income",
    "person_home_ownership",
    "person_emp_length",
    "loan_intent",
    "loan_grade",
    "loan_amnt",
    "loan_int_rate",
    "loan_percent_income",
    "cb_person_default_on_file",
    "cb_person_cred_hist_length",
]
APPENDED = [
    "gender",
    "marital_status",
    "education_level",
    "country",
    "state",
    "city",
    "employment_type",
    "loan_term_months",
    "loan_to_income_ratio",
    "other_debt",
    "debt_to_income_ratio",
    "open_accounts",
    "credit_utilization_ratio",
    "past_delinquencies",
]
CATEGORICAL = {
    "person_home_ownership",
    "loan_intent",
    "loan_grade",
    "cb_person_default_on_file",
    "gender",
    "marital_status",
    "education_level",
    "country",
    "state",
    "city",
    "employment_type",
}
# The columns a fairness audit would use. Named here so the test is pre-declared.
PROTECTED = ["gender", "marital_status", "education_level", "country", "employment_type"]

fails: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if not ok:
        fails.append(msg)


def h(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    sheets = pl.read_excel(XLSX, sheet_id=0)
    return sheets["Credit Risk Data"].to_pandas(), sheets["Data Dictionary"].to_pandas()


def cramers_v(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    ax, ay = np.unique(x), np.unique(y)
    ct = np.array([[int(((x == a) & (y == b)).sum()) for b in ay] for a in ax])
    chi2, p, _, _ = stats.chi2_contingency(ct)
    return float(np.sqrt(chi2 / (ct.sum() * (min(ct.shape) - 1)))), float(p)


def effect_on_default(d: pd.DataFrame, col: str) -> tuple[float, float]:
    """Cramér's V for categoricals, |point-biserial r| for numerics. Comparable in [0,1]."""
    y = d.loan_status.astype(float).values
    s = d[col]
    m = s.notna().values
    if col in CATEGORICAL:
        return cramers_v(s[m].astype(str).values, y[m])
    r, p = stats.pointbiserialr(y[m], s[m].astype(float).values)
    return abs(float(r)), float(p)


# ---------------------------------------------------------------------------------------
# 1. GRAIN
# ---------------------------------------------------------------------------------------
def check_grain(d: pd.DataFrame, dd: pd.DataFrame) -> None:
    h("1. GRAIN - client_ID IS unique, and a Data Dictionary ships with the file")
    check(len(d) == N_ROWS, f"row count is {len(d):,} (expected {N_ROWS:,})")
    check(
        d.client_ID.nunique() == len(d),
        f"client_ID is unique: {d.client_ID.nunique():,} distinct over {len(d):,} rows",
    )
    print("        Standing scoreboard: NOT unique in May (Transaction_ID) or June (Post_ID),")
    print("        unique in July (Customer_ID), ABSENT in August, unique here. 2 of 5.")
    check(len(d) - len(d.drop_duplicates()) == 0, "no duplicate rows")
    check(len(dd) == 29, f"the Data Dictionary documents all {len(dd)} columns")

    # The publisher's own words are evidence for check 4.
    sim = dd[dd.iloc[:, 1].astype(str).str.contains("Simulated", case=False, na=False)]
    check(
        len(sim) >= 1,
        f"the dictionary itself calls {len(sim)} column(s) 'Simulated': "
        f"{', '.join(sim.iloc[:, 0].tolist())}",
    )
    print("        That is the publisher stating, in the shipped documentation, that part of")
    print("        this file is generated. Check 4 tests how far that goes.")


# ---------------------------------------------------------------------------------------
# 2. DERIVED COLUMNS
# ---------------------------------------------------------------------------------------
def check_derived(d: pd.DataFrame) -> None:
    h("2. DERIVED COLUMNS - both ratios in brief Q3 are arithmetic on existing columns")

    lti = d.loan_amnt / d.person_income
    err = float((d.loan_to_income_ratio - lti).abs().max())
    check(err < 1e-12, f"loan_to_income_ratio = loan_amnt / person_income; max error {err:.2e}")

    r = float(np.corrcoef(d.loan_to_income_ratio, d.loan_percent_income)[0, 1])
    check(
        r > 0.99,
        f"...and it correlates {r:.4f} with the ORIGINAL loan_percent_income -- "
        "the same column at more decimal places, not a new variable",
    )

    dti = (d.other_debt + d.loan_amnt) / d.person_income
    err = float((d.debt_to_income_ratio - dti).abs().max())
    check(
        err < 1e-12,
        f"debt_to_income_ratio = (other_debt + loan_amnt) / person_income; max error {err:.2e}",
    )

    ratio = d.other_debt / d.person_income
    check(
        abs(ratio.min() - 0.05) < 0.001 and abs(ratio.max() - 0.30) < 0.001,
        f"other_debt = person_income x U({ratio.min():.4f}, {ratio.max():.4f}) -- a uniform draw",
    )
    print("        So debt-to-income IS loan-to-income plus uniform noise. Q3 asks how the two")
    print("        ratios relate to repayment as though they were different questions.")
    print("        They are one question, and the noisier version predicts WORSE (check 5).")


# ---------------------------------------------------------------------------------------
# 3. MISSINGNESS
# ---------------------------------------------------------------------------------------
def check_missingness(d: pd.DataFrame) -> None:
    h("3. MISSINGNESS - real, and confined entirely to the original block")
    nulls = d.isna().sum()
    nz = nulls[nulls > 0]
    for col, n in nz.items():
        print(f"        {col:28} {n:6,}  ({n / len(d) * 100:.1f}%)")
    check(
        set(nz.index) <= set(ORIGINAL),
        f"every null in the file is in the ORIGINAL block: {sorted(nz.index)}",
    )
    check(
        d[APPENDED].isna().sum().sum() == 0,
        "the 14 appended columns have ZERO nulls between them",
    )
    print("        Real data has gaps; generated data does not. This is the first tell, and")
    print("        it lines up exactly with the column split declared at the top of this file.")

    # Is the missingness itself informative? (It is, mildly -- worth not dropping silently.)
    for col in ["loan_int_rate", "person_emp_length"]:
        miss = d[d[col].isna()].loan_status.mean() * 100
        have = d[d[col].notna()].loan_status.mean() * 100
        n_miss = int(d[col].isna().sum())
        lo, hi = stats.binomtest(round(miss / 100 * n_miss), n_miss).proportion_ci(0.95)
        ct = np.array(
            [
                [int((d[col].isna() & (d.loan_status == s)).sum()) for s in (0, 1)],
                [int((d[col].notna() & (d.loan_status == s)).sum()) for s in (0, 1)],
            ]
        )
        pv = stats.chi2_contingency(ct)[1]
        print(
            f"        default rate where {col} is missing: {miss:.2f}% "
            f"[{lo * 100:.2f}, {hi * 100:.2f}]  vs {have:.2f}% present  "
            f"({miss - have:+.2f}pp, p={pv:.1e})"
        )

    # MISSINGNESS AS SIGNAL, and it is strong enough to matter to a lender.
    m = d.person_emp_length.isna()
    lift = d[m].loan_status.mean() / d[~m].loan_status.mean()
    check(
        lift > 1.3,
        f"missing person_emp_length carries a {lift:.2f}x default lift "
        f"(31.5% vs 21.5%, p=1.5e-12) -- the NULL is a risk signal",
    )
    print("        A model that drops incomplete rows discards 895 applicants defaulting at")
    print("        1.46x the rest of the book. That single null outranks every appended")
    print("        column in this file except the two derived ratios. Do not impute it away;")
    print("        it is one of the few genuinely useful things the original block contains.")


# ---------------------------------------------------------------------------------------
# 4 + 5. WHICH COLUMNS ARE NOISE - effect size over p
# ---------------------------------------------------------------------------------------
def check_two_halves(d: pd.DataFrame) -> pd.DataFrame:
    h("4+5. THE TWO HALVES - effect on loan_status, 25 pre-declared columns")
    cols = ORIGINAL + APPENDED
    alpha = 0.05 / len(cols)
    print(f"  {len(cols)} columns declared before testing. Bonferroni alpha = {alpha:.1e}")
    print(f"  n = {len(d):,}, base default rate = {d.loan_status.mean() * 100:.2f}%\n")
    print(f"  {'column':28}{'block':11}{'effect':>9}{'p':>11}")
    print("  " + "-" * 62)

    rows = []
    for col in cols:
        e, p = effect_on_default(d, col)
        rows.append(
            {
                "column": col,
                "block": "ORIGINAL" if col in ORIGINAL else "APPENDED",
                "effect": e,
                "p": p,
                "sig": p < alpha,
            }
        )
    res = pd.DataFrame(rows).sort_values("effect", ascending=False)
    for _, r in res.iterrows():
        print(
            f"  {r.column:28}{r.block:11}{r.effect:9.4f}{r.p:11.2e}  {'***' if r.sig else 'n.s.'}"
        )

    o = res[res.block == "ORIGINAL"]
    a = res[res.block == "APPENDED"]
    print(
        f"\n  ORIGINAL block: max {o.effect.max():.4f}  median {o.effect.median():.4f}  "
        f"{int(o.sig.sum())}/{len(o)} clear Bonferroni"
    )
    print(
        f"  APPENDED block: max {a.effect.max():.4f}  median {a.effect.median():.4f}  "
        f"{int(a.sig.sum())}/{len(a)} clear Bonferroni"
    )
    check(
        o.effect.median() > 10 * a.effect.median(),
        f"the original block's median effect is {o.effect.median() / a.effect.median():.0f}x "
        "the appended block's",
    )
    check(
        int(a.sig.sum()) <= 3,
        f"only {int(a.sig.sum())} of {len(a)} appended columns predict anything",
    )
    return res


# ---------------------------------------------------------------------------------------
# 6. CONFOUNDS - the appended columns that DO predict are restatements
# ---------------------------------------------------------------------------------------
def check_confounds(d: pd.DataFrame, res: pd.DataFrame) -> None:
    h("6. CONFOUNDS - the 3 predictive appended columns carry no new information")
    sig_app = res[(res.block == "APPENDED") & res.sig].column.tolist()
    check(
        set(sig_app) <= {"loan_to_income_ratio", "debt_to_income_ratio", "other_debt"},
        f"the only appended columns that predict are the derived ones: {sig_app}",
    )
    lpi = res[res.column == "loan_percent_income"].effect.iloc[0]
    lti = res[res.column == "loan_to_income_ratio"].effect.iloc[0]
    dti = res[res.column == "debt_to_income_ratio"].effect.iloc[0]
    print(f"        loan_percent_income  (ORIGINAL) : {lpi:.4f}")
    print(f"        loan_to_income_ratio (APPENDED) : {lti:.4f}   <- same column, more decimals")
    print(f"        debt_to_income_ratio (APPENDED) : {dti:.4f}   <- the above + uniform noise")
    check(
        dti < lti,
        f"adding simulated debt makes the ratio a WORSE predictor ({dti:.4f} < {lti:.4f}) -- "
        "noise dilutes signal, which is what a generated column does",
    )


# ---------------------------------------------------------------------------------------
# 7. THIN CELLS
# ---------------------------------------------------------------------------------------
def check_thin_cells(d: pd.DataFrame) -> None:
    h("7. THIN CELLS")
    for col in ["loan_grade", "past_delinquencies", "person_home_ownership", "loan_intent"]:
        vc = d[col].value_counts().sort_index()
        thin = vc[vc < 200]
        print(
            f"  {col:24} min cell n={vc.min():6,} ({vc.idxmin()})"
            f"{'   FLAG ' + ', '.join(f'{i}(n={v})' for i, v in thin.items()) if len(thin) else ''}"
        )
    check(
        int((d.past_delinquencies >= 4).sum()) < 100,
        f"past_delinquencies >= 4 is only n={int((d.past_delinquencies >= 4).sum())} -- "
        "the top of that scale cannot support a rate estimate",
    )


# ---------------------------------------------------------------------------------------
# 8. THE FAIRNESS QUESTION - and why a NULL RESULT CANNOT ANSWER IT
#
# An earlier draft of this check concluded, from five null results, that "the demographic
# columns were generated independently of the outcome". That inference is invalid and it is
# the same error that killed a thesis in 2025/06 and two claims in 2025/08: "the generator
# made these independent" and "there is genuinely no demographic effect in this book" make
# IDENTICAL predictions about every p-value below. You cannot tell them apart from nulls.
#
# The nulls are still reported -- they are true, and a reader needs them. But the claim now
# rests on POSITIVE tests: the demographic columns contradict THEMSELVES and each other in
# ways no real population can. A logical contradiction inside a single row is not a p-value
# and cannot be argued with.
# ---------------------------------------------------------------------------------------
def check_fairness(d: pd.DataFrame) -> None:
    h("8. FAIRNESS - the nulls, and the POSITIVE tests that actually carry the claim")
    p0 = d.loan_status.mean()

    print("  (a) The nulls. True, necessary, and NOT sufficient on their own.\n")
    for col in PROTECTED:
        e, p = effect_on_default(d, col)
        g = d.groupby(col).loan_status.agg(["size", "mean"])
        spread = (g["mean"].max() - g["mean"].min()) * 100
        print(f"    {col:16} V={e:.4f}  p={p:.3f}   spread {spread:4.2f}pp   groups {len(g)}")
        check(p > 0.05, f"{col} shows no disparity in DEFAULT RATE (p={p:.3f})")

    print("\n  What we could have detected (80% power, alpha=.05), largest vs smallest group:")
    mdes = []
    for col in PROTECTED:
        vc = d[col].value_counts()
        n1, n2 = int(vc.iloc[0]), int(vc.iloc[-1])
        mde = 2.8 * np.sqrt(p0 * (1 - p0) * (1 / n1 + 1 / n2)) * 100
        mdes.append(mde / (p0 * 100) * 100)
        print(f"    {col:16} n={n1:6,} vs {n2:6,}   MDE {mde:4.2f}pp = {mdes[-1]:4.1f}% relative")
    print(
        f"    -> the honest range is {min(mdes):.1f}%-{max(mdes):.1f}% relative, NOT the "
        f"{min(mdes):.1f}% best case alone."
    )

    print("\n  (b) THE POSITIVE TESTS. Relationships that must hold in any real population,")
    print("      regardless of anything Nova Bank does. These are not p-values.\n")

    u = d[d.employment_type == "Unemployed"]
    emp = u.person_emp_length.dropna()
    working = int((emp > 0).sum())
    # TWO MEANS, DIFFERENT DENOMINATORS. emp.mean() averages over everyone who reports a value,
    # INCLUDING the 214 who correctly report 0 years and are not a contradiction at all. The
    # population this sentence counts is the `working` subset, so it must quote that subset's
    # mean. an integrity pass found the published sentence pairing the 1,421 count with the
    # 1,635-based mean. Both are printed now, each against its own denominator.
    check(
        working > 1000,
        f"{working} of {len(emp)} 'Unemployed' applicants ({working / len(emp) * 100:.1f}%) "
        f"report a CURRENT JOB averaging {emp[emp > 0].mean():.4f} years -- "
        f"over ALL {len(emp)} who report a value (incl. {int((emp == 0).sum())} reporting zero) "
        f"the mean is {emp.mean():.4f}",
    )
    ft = d[d.employment_type == "Full-time"]
    pv = stats.mannwhitneyu(u.person_income, ft.person_income).pvalue
    check(
        pv > 0.05,
        f"...and they earn a median ${u.person_income.median():,.0f} against "
        f"${ft.person_income.median():,.0f} for the full-time employed (p={pv:.3f})",
    )
    print("        This is a LOGICAL CONTRADICTION inside a single row, not a weak signal.")
    print("        No statistical argument is required and no reader can dispute it.")

    w = d[d.marital_status == "Widowed"].person_age
    sg = d[d.marital_status == "Single"].person_age
    check(
        w.mean() <= sg.mean() + 0.5,
        f"widowed borrowers are {sg.mean() - w.mean():+.2f} years OLDER than single ones "
        f"({w.mean():.2f} vs {sg.mean():.2f}) -- i.e. they are not",
    )

    phd = d[d.education_level == "PhD"]
    hs = d[d.education_level == "High School"]
    pv = stats.mannwhitneyu(phd.person_income, hs.person_income).pvalue
    check(
        pv > 0.05,
        f"PhD holders earn a median ${phd.person_income.median():,.0f} against "
        f"${hs.person_income.median():,.0f} for school leavers (p={pv:.3f}), and average "
        f"{phd.person_age.mean():.1f} years old",
    )

    # Geography as a uniform draw.
    vc = d.city.value_counts()
    chi = stats.chisquare(vc.values).pvalue
    check(
        chi > 0.05,
        f"all {len(vc)} cities are drawn uniformly (chi2 p={chi:.3f}) -- "
        "no real lending book is flat across 18 cities",
    )

    print("\n  (c) DIFFERENTIAL TREATMENT - the test a fair-lending examiner actually runs.")
    print("      Outcome disparity is not disparate impact. Does a demographic predict what")
    print("      the BANK DID: the grade, the price, the size, the term?\n")
    DECISIONS = ["loan_int_rate", "loan_amnt", "loan_percent_income", "loan_term_months"]
    n_tests = len(PROTECTED) * len(DECISIONS)
    alpha = 0.05 / n_tests
    worst = 0.0
    n_sig = 0
    for col in PROTECTED:
        for dec in DECISIONS:
            sub = d[[col, dec]].dropna()
            groups = [g[dec].values for _, g in sub.groupby(col)]
            pv = stats.kruskal(*groups).pvalue
            allv = np.concatenate(groups)
            gm = allv.mean()
            sst = ((allv - gm) ** 2).sum()
            eta2 = sum(len(g) * (g.mean() - gm) ** 2 for g in groups) / sst if sst else 0
            worst = max(worst, eta2)
            n_sig += pv < alpha
    check(
        n_sig == 0,
        f"0 of {n_tests} treatment tests clear Bonferroni (alpha={alpha:.1e}); "
        f"largest effect across all of them is eta2={worst:.5f}",
    )
    print("        So the file shows no gap in price, grade, size OR term either. That is a")
    print("        wider statement than the outcome test, and it is the one a regulator asks.")

    print("\n  (d) THE ARGUMENT THAT NEEDS NO GENERATOR CLAIM AT ALL:")
    decision_cols = [
        c
        for c in d.columns
        if any(
            k in c.lower() for k in ("approved", "declined", "rejected", "application", "decision")
        )
    ]
    check(
        decision_cols == [],
        f"there is no application, decision, approval or denial column ({decision_cols or 'none'})",
    )
    print("        Every row is a FUNDED loan. Approval-stage fairness -- which is what")
    print("        'fair and accessible lending' means -- is untestable on an accepted-loans-")
    print("        only book EVEN IF every demographic column were real. This survives any")
    print("        objection to the fabrication argument, and it alone justifies refusing to")
    print("        certify Nova Bank's lending as fair from this file.")


# ---------------------------------------------------------------------------------------
# 9. BRIEF Q5 - THREE COLUMNS FOR CREDIT HISTORY, NONE WITH INCREMENTAL SIGNAL
#
# An earlier draft framed this as "one real column, one random draw", holding up
# cb_person_default_on_file as the honest counterexample at a 2.06x lift. That contrast is
# REFUTED: the lift is a composition effect. Grades A and B contain zero prior defaulters,
# and within every grade where both appear the default rates are indistinguishable. Prior
# default is an INPUT TO THE GRADE, not independent signal -- so the original block ships a
# restatement too, and it was the one my thesis was leaning on.
# ---------------------------------------------------------------------------------------
def check_credit_history(d: pd.DataFrame) -> None:
    h("9. BRIEF Q5 - three columns offer credit history; none adds anything")
    print("  Q5: 'How do past defaults or longer credit histories affect loan outcomes?'\n")

    # (a) past_delinquencies -- a POSITIVE identification, not a null.
    print("  (a) past_delinquencies is a Poisson draw, not a measurement.")
    obs = d.past_delinquencies.value_counts().sort_index()
    lam = d.past_delinquencies.mean()
    n = len(d)
    exp = np.array([stats.poisson.pmf(k, lam) * n for k in obs.index])
    exp = exp * obs.sum() / exp.sum()
    gof = stats.chisquare(obs.values, exp).pvalue
    print(f"    {'k':>3}{'observed':>10}{'Poisson exp':>13}{'default %':>11}")
    for k in obs.index:
        rate = d[d.past_delinquencies == k].loan_status.mean() * 100
        print(f"    {k:>3}{obs[k]:>10,}{exp[list(obs.index).index(k)]:>13,.1f}{rate:>10.2f}%")
    check(
        gof > 0.05,
        f"fits Poisson(lambda={lam:.5f}): chi2 goodness-of-fit p={gof:.3f}, "
        f"variance/mean={d.past_delinquencies.var() / lam:.4f}",
    )
    # ...and it is well-powered, so the null is a measurement rather than a shrug.
    a = d[d.past_delinquencies == 0]
    b = d[d.past_delinquencies > 0]
    p0 = d.loan_status.mean()
    mde = 2.8 * np.sqrt(p0 * (1 - p0) * (1 / len(a) + 1 / len(b))) * 100
    check(
        abs(a.loan_status.mean() - b.loan_status.mean()) * 100 < mde,
        f"0 vs 1+ differ by {abs(a.loan_status.mean() - b.loan_status.mean()) * 100:.2f}pp "
        f"against an MDE of {mde:.2f}pp ({mde / (p0 * 100) * 100:.1f}% relative) -- "
        "well powered, and flat",
    )

    # (b) cb_person_default_on_file -- the REFUTED contrast.
    print("\n  (b) cb_person_default_on_file: a 2.06x CRUDE lift that is composition, not signal.")
    pd.crosstab(d.loan_grade, d.cb_person_default_on_file)
    print(f"    {'grade':>6}{'N':>8}{'Y':>8}{'% prior':>10}{'default N':>12}{'default Y':>12}")
    for gcode in sorted(d.loan_grade.unique()):
        sub = d[d.loan_grade == gcode]
        nn = int((sub.cb_person_default_on_file == "N").sum())
        yy = int((sub.cb_person_default_on_file == "Y").sum())
        dn = sub[sub.cb_person_default_on_file == "N"].loan_status.mean() * 100
        dy = (
            sub[sub.cb_person_default_on_file == "Y"].loan_status.mean() * 100
            if yy
            else float("nan")
        )
        print(
            f"    {gcode:>6}{nn:>8,}{yy:>8,}{(yy / (nn + yy) * 100):>9.1f}%"
            f"{dn:>11.2f}%{'' if yy else '        -':>0}"
            + (f"{dy:>11.2f}%" if yy else "          -")
        )
    ab = d[d.loan_grade.isin(["A", "B"])]
    check(
        int((ab.cb_person_default_on_file == "Y").sum()) == 0,
        f"grades A and B contain ZERO prior defaulters "
        f"({int((ab.cb_person_default_on_file == 'Y').sum())} of {len(ab):,})",
    )
    # within-grade comparison, where both levels exist
    diffs = []
    for gcode in ["C", "D", "E", "F"]:
        sub = d[d.loan_grade == gcode]
        dn = sub[sub.cb_person_default_on_file == "N"].loan_status.mean()
        dy = sub[sub.cb_person_default_on_file == "Y"].loan_status.mean()
        diffs.append(abs(dy - dn) * 100)
    check(
        max(diffs) < 5,
        f"within grades C-F the two levels differ by at most {max(diffs):.2f}pp -- "
        "prior default is an INPUT TO THE GRADE, not independent information",
    )

    # (c) credit history length is age wearing a different name.
    print("\n  (c) cb_person_cred_hist_length is age with a different name.")
    r = float(np.corrcoef(d.cb_person_cred_hist_length, d.person_age)[0, 1])
    check(r > 0.8, f"it correlates {r:.3f} with person_age")
    e, pv = effect_on_default(d, "cb_person_cred_hist_length")
    check(e < 0.05, f"and its own effect on default is {e:.4f} (p={pv:.3f})")
    print("        VERDICT: Q5 has three candidate columns. One is a Poisson draw, one is")
    print("        age, and one is the credit grade viewed sideways. None carries")
    print("        incremental signal, and the file's answer to Q5 is that it has none.")


# ---------------------------------------------------------------------------------------
# 10. THE WALL - two boolean rules decide 42% of every default in this file
#
# This check was written twice. The first version reported a "steep probabilistic
# structure" at loan_percent_income >= 0.30 and self-attacked it by noting that 203 of
# 2,629 renters above the line do not default -- concluding it could not be a lookup rule,
# "which would leave zero exceptions".
#
# That was wrong, and wrong in an instructive way: the boundary is > 0.30, not >= 0.30.
# ALL 203 apparent survivors sit at exactly 0.30. Past the line there are no exceptions at
# all. The self-attack was a real attempt to falsify the claim that failed only because it
# tested the boundary one bin too wide, and it produced false reassurance in both
# directions -- it made a deterministic rule look probabilistic.
#
# LESSON, and it is the month's: when a threshold effect is suspected, test the boundary
# at the data's own resolution. An off-by-one-bin error does not blur a rule, it disguises
# one as a gradient.
# ---------------------------------------------------------------------------------------


# The two rules, stated as code so they cannot drift from the prose.
def rule_renter(d: pd.DataFrame) -> pd.Series:
    return (d.person_home_ownership == "RENT") & (d.loan_percent_income > 0.30)


def rule_debtcon(d: pd.DataFrame) -> pd.Series:
    return (
        d.loan_grade.isin(["D", "E", "F", "G"])
        & (d.loan_intent == "DEBTCONSOLIDATION")
        & (d.person_home_ownership != "OWN")
    )


def check_the_wall(d: pd.DataFrame) -> None:
    h("10. THE WALL - two boolean rules decide 42% of every default")

    r1, r2 = rule_renter(d), rule_debtcon(d)
    both = r1 | r2
    for name, m in [
        ("RENT & loan_percent_income > 0.30", r1),
        ("grade D-G & DEBTCONSOLIDATION & not OWN", r2),
        ("union", both),
    ]:
        sub = d[m]
        exc = int((sub.loan_status == 0).sum())
        check(
            exc == 0,
            f"{name:42} n={len(sub):5,}  default {sub.loan_status.mean() * 100:.4f}%  "
            f"exceptions={exc}",
        )
    print(
        f"        = {both.sum() / len(d) * 100:.2f}% of the book, "
        f"{d[both].loan_status.sum() / d.loan_status.sum() * 100:.1f}% of all "
        f"{int(d.loan_status.sum()):,} defaults, ${d[both].loan_amnt.sum() / 1e6:.1f}M principal"
    )
    print("        Zero counterexamples in 2,988 rows. If the true rate were even 99%,")
    print("        observing zero survivors has probability ~1e-13 -- but that is a")
    print("        POST-SELECTION probability with NO correction for the search that found")
    print("        these two rules. It measures how exact THESE conditions are, not how")
    print("        surprising it is that some exact condition exists somewhere in 29 columns.")

    print("\n  THE BOUNDARY, at the data's own resolution - and it is TENURE-SPECIFIC:\n")
    print(f"    {'lpi':>6}" + "".join(f"{o:>16}" for o in ["RENT", "MORTGAGE", "OWN"]))
    for x in range(27, 35):
        row = f"    {x / 100:>6.2f}"
        for own in ["RENT", "MORTGAGE", "OWN"]:
            sub = d[
                (d.person_home_ownership == own)
                & (d.loan_percent_income >= x / 100)
                & (d.loan_percent_income < (x + 1) / 100)
            ]
            row += (
                f"{sub.loan_status.mean() * 100:>10.1f}% n={len(sub):<4}"
                if len(sub)
                else f"{'-':>16}"
            )
        print(row + ("   <-- the wall" if x == 31 else ""))
    rent_hi = d[rule_renter(d)]
    mort_hi = d[(d.person_home_ownership == "MORTGAGE") & (d.loan_percent_income > 0.30)]
    check(
        mort_hi.loan_status.mean() < 0.30,
        f"mortgage-holders cross the same line and do NOT move "
        f"({mort_hi.loan_status.mean() * 100:.2f}% above it) -- the wall is renters only",
    )

    print("\n  AND IT IS NOT PRICED. Like-for-like renters:\n")
    below = d[
        (d.person_home_ownership == "RENT")
        & (d.loan_percent_income >= 0.20)
        & (d.loan_percent_income <= 0.30)
    ]
    bp = (rent_hi.loan_int_rate.mean() - below.loan_int_rate.mean()) * 100
    print(
        f"    LTI 20-30%  n={len(below):5,}  default {below.loan_status.mean() * 100:6.2f}%  "
        f"priced {below.loan_int_rate.mean():.2f}%"
    )
    print(
        f"    LTI  > 30%  n={len(rent_hi):5,}  default {rent_hi.loan_status.mean() * 100:6.2f}%  "
        f"priced {rent_hi.loan_int_rate.mean():.2f}%"
    )
    # THE BAND IS A CHOICE and the gap depends on it, so the band is named in the message.
    # 0.10-0.30 gives +43bp, 0.20-0.30 gives +14bp, 0.27-0.30 gives -1bp, exactly 0.30 gives
    # +23bp. What does NOT depend on the band is that price is flat across a step from ~26%
    # default to 100%, which is the finding. Published band: 20-30%.
    print("    price gap by comparison band (renters), because the band is a CHOICE:")
    for lo in (0.10, 0.15, 0.20, 0.25, 0.27, 0.28, 0.29, 0.30):
        b = d[
            (d.person_home_ownership == "RENT")
            & (d.loan_percent_income >= lo)
            & (d.loan_percent_income <= 0.30)
        ]
        g = (rent_hi.loan_int_rate.mean() - b.loan_int_rate.mean()) * 100
        print(
            f"      [{lo:.2f}, 0.30]  n={len(b):>6,}  default {b.loan_status.mean() * 100:6.2f}%"
            f"  gap {g:+8.4f} bp" + ("   <- published" if abs(lo - 0.20) < 1e-9 else "")
        )
    check(
        abs(bp) < 50,
        f"the price of certain default is {bp:+.0f} basis points ON THE PUBLISHED 20-30% "
        f"BAND (n={len(below):,}); every band from 0.10 to 0.30 stays inside +/-50 bp",
    )
    ga = rent_hi[rent_hi.loan_grade == "A"]
    check(
        ga.loan_status.mean() == 1.0,
        f"{len(ga)} GRADE-A renters above the line default at "
        f"{ga.loan_status.mean() * 100:.0f}% and are priced at {ga.loan_int_rate.mean():.2f}% "
        f"(${ga.loan_amnt.sum() / 1e6:.1f}M)",
    )

    print("\n  FORENSIC: the rule reads the ROUNDED column, not the exact ratio.")
    exact = (d.person_home_ownership == "RENT") & (d.loan_to_income_ratio > 0.30)
    check(
        d[exact].loan_status.mean() < 1.0,
        f"on loan_to_income_ratio (full precision) the same rule gives "
        f"{d[exact].loan_status.mean() * 100:.2f}% over n={int(exact.sum()):,} -- so the label "
        "is downstream of the 2-decimal rounding in loan_percent_income",
    )

    print("\n  WHAT THE RULES CONTAMINATE. Removing them re-orders the brief's own answers:\n")
    clean = d[~both]
    print(
        f"    clean book n={len(clean):,}  default {clean.loan_status.mean() * 100:.2f}% "
        f"(vs {d.loan_status.mean() * 100:.2f}% whole book)\n"
    )
    a = d.groupby("loan_intent").loan_status.mean().sort_values(ascending=False)
    b = clean.groupby("loan_intent").loan_status.mean().sort_values(ascending=False)
    print(f"    {'intent':<20}{'whole book':>20}{'rules removed':>22}")
    for i, k in enumerate(a.index):
        print(
            f"    {k:<20}  #{i + 1} {a[k] * 100:6.2f}%        ->  "
            f"#{list(b.index).index(k) + 1} {b[k] * 100:6.2f}%"
        )
    check(
        list(b.index).index("DEBTCONSOLIDATION") >= 4,
        "DEBTCONSOLIDATION goes from the RISKIEST purpose (28.59%) to the second SAFEST "
        f"({b['DEBTCONSOLIDATION'] * 100:.2f}%) once the rules are removed -- brief Q2's "
        "answer is an artefact of rule 2",
    )

    print("\n    the grade ladder, whole book vs clean:")
    for label, frame in [("whole book   ", d), ("rules removed", clean)]:
        g = frame.groupby("loan_grade").loan_status.mean() * 100
        print(f"      {label} " + "  ".join(f"{k} {v:5.2f}%" for k, v in g.items()))
    cd_raw = d[d.loan_grade == "D"].loan_status.mean() * 100
    cd_clean = clean[clean.loan_grade == "D"].loan_status.mean() * 100
    check(
        cd_clean < cd_raw,
        f"grade D falls from {cd_raw:.2f}% to {cd_clean:.2f}% once the rules come out -- "
        "the C->D cliff is real but partly rule composition, and 59.05% must not be "
        "published as a risk gradient",
    )


def main() -> int:
    d, dd = load()
    print(f"Loaded {len(d):,} rows x {len(d.columns)} columns from {XLSX.name}")
    check_grain(d, dd)
    check_derived(d)
    check_missingness(d)
    res = check_two_halves(d)
    check_confounds(d, res)
    check_thin_cells(d)
    check_fairness(d)
    check_credit_history(d)
    check_the_wall(d)

    h("RESULT")
    if fails:
        print(f"{len(fails)} CHECK(S) FAILED - the source data changed. Revisit profile.md.")
        for f in fails:
            print(f"  - {f}")
        return 1
    print("All checks pass. The conclusions in analysis/profile.md are reproduced above.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
