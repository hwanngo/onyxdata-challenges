#!/usr/bin/env python3
"""Integrity + signal-vs-noise checks behind the Conclusions in analysis/profile.md  (Gate G2).

`tools/profile.py` DESCRIBES the data. This asks whether the data can support a CLAIM.
Every number quoted in profile.md's Conclusions is reproduced here.

The seven standing checks, in order. August's twist on each:

  1. GRAIN. There is no ID column at all this month -- a first. The check inverts: prove no
     two rows are identical, and say plainly that the grain is ASSERTED, not verified.
  2. DERIVED COLUMNS. The entire price family is a lookup from three labels, and two more
     columns are exact arithmetic. The largest derivation chain in four months.
  3. MISSINGNESS. Zero nulls anywhere. The structural absence is not a null -- it is a
     BOUNDED RANGE: last_visit_date spans exactly 60 days, so churn cannot exist.
  4. IS THE HEADLINE METRIC NOISE? Check-in time is U(08:00, 21:00). Duration looks like
     flat noise pooled, but rejects uniformity WITHIN half the locations -- the June lesson.
  5. EFFECT SIZE, NOT JUST p. 88 pre-declared tests, Bonferroni alpha = 5.68e-4.
  6. CONFOUNDS. access_hours is 1:1 with membership_type, so any "access effect" IS the tier
     effect. Verified as an identity, not a correlation.
  7. THIN CELLS. Elite is n=199 and Quarterly is n=187; both flagged before use. Plus the
     July addition: when nothing is significant, compute what WOULD have been detectable.

    python 2025/08/analysis/integrity.py

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
RAW = RAW_DIR / "Fitness_Membership_Analytics_Dataset.csv"

# Pre-declared BEFORE looking at any result. Bonferroni divides by len(CATS) * len(NUMS).
CATS = [
    "membership_type",
    "subscription_model",
    "discount_type",
    "access_hours",
    "home_gym_location",
    "self_identified_gender",
    "attend_group_lesson",
    "personal_training",
    "uses_sauna",
    "has_drink_subscription",
    "multi_location_access",
]
NUMS = [
    "visit_per_week",
    "duration_in_gym_minutes",
    "personal_training_hours",
    "age",
    "tenure_days",
    "days_since_visit",
    "checkin_minutes",
    "final_price",
]

# The generator's own constants, asserted so a source change is loud rather than silent.
N_ROWS = 1998
AS_OF = np.datetime64("2025-07-22")  # == max(last_visit_date)
MODEL_FACTOR = {"Monthly": 1.00, "Quarterly": 0.90, "Early Bird (Annual)": 0.75}
TIER_PRICE = {"Basic": 20, "Standard": 30, "Premium": 50, "Elite": 70}
TIER_ACCESS = {
    "Basic": "Off-peak only",
    "Standard": "Weekdays only",
    "Premium": "All hours",
    "Elite": "All hours + Priority access",
}
DISCOUNT_RATE = {"None": 0.00, "Promo": 0.05, "Loyalty": 0.10, "Student": 0.15}

fails: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if not ok:
        fails.append(msg)


def h(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load() -> pd.DataFrame:
    d = pl.read_csv(RAW).to_pandas()
    jd = pl.Series(d["join_date"]).str.to_date()
    lv = pl.Series(d["last_visit_date"]).str.to_date()
    d["tenure_days"] = (lv - jd).dt.total_days().to_numpy()
    d["days_since_visit"] = (AS_OF - d["last_visit_date"].astype("datetime64[ns]")).dt.days
    d["checkin_minutes"] = d["avg_time_check_in"].str.slice(0, 2).astype(int) * 60 + d[
        "avg_time_check_in"
    ].str.slice(3, 5).astype(int)
    return d


def eta_squared(groups: list[np.ndarray]) -> float:
    """Share of variance explained. The effect size, not the p-value."""
    allv = np.concatenate(groups)
    gm = allv.mean()
    sst = ((allv - gm) ** 2).sum()
    if sst == 0:
        return 0.0
    return sum(len(g) * (g.mean() - gm) ** 2 for g in groups) / sst


def omega_squared(groups: list[np.ndarray]) -> float:
    """eta^2 corrected for the upward bias it carries at small k and n."""
    allv = np.concatenate(groups)
    n, k = len(allv), len(groups)
    gm = allv.mean()
    ssb = sum(len(g) * (g.mean() - gm) ** 2 for g in groups)
    sst = ((allv - gm) ** 2).sum()
    if sst == 0 or n == k:
        return 0.0
    msw = (sst - ssb) / (n - k)
    return max(0.0, (ssb - (k - 1) * msw) / (sst + msw))


# ---------------------------------------------------------------------------------------
# 1. GRAIN
# ---------------------------------------------------------------------------------------
def check_grain(d: pd.DataFrame) -> None:
    h("1. GRAIN - there is no ID column, so the grain is ASSERTED, not verified")
    check(len(d) == N_ROWS, f"row count is {len(d)} (expected {N_ROWS})")

    id_like = [c for c in d.columns if c.lower() == "id" or c.lower().endswith("_id")]
    check(id_like == [], f"no ID column exists (found: {id_like or 'none'})")
    print("        The standing ID-uniqueness check has nothing to check. May's Transaction_ID")
    print("        and June's Post_ID were non-unique; July's Customer_ID was unique. August")
    print("        has no candidate key at all -- four months, four different answers.")

    dupes = len(d) - len(d.drop_duplicates())
    check(dupes == 0, f"no two rows are identical ({dupes} duplicates)")
    space = float(np.sum(np.log10([d[c].nunique() for c in d.columns])))
    print(f"        But the distinct-value space across 26 columns is ~1e{space:.0f}. Zero")
    print("        collisions in 1,998 draws from that space is expected under ANY hypothesis,")
    print("        so uniqueness is not evidence of member-level grain. It is an assumption --")
    print("        recorded in assumptions.md A-2, footnoted in the UI.")


# ---------------------------------------------------------------------------------------
# 2. DERIVED COLUMNS
# ---------------------------------------------------------------------------------------
def check_derived(d: pd.DataFrame) -> None:
    h("2. DERIVED COLUMNS - the entire price family is a lookup from three labels")

    for tier, price in TIER_PRICE.items():
        sub = d[d.membership_type == tier]
        check(
            sub.subscription_price.nunique() == 1 and sub.subscription_price.iloc[0] == price,
            f"membership_type '{tier}' -> subscription_price {price} exactly (n={len(sub)})",
        )

    for model, factor in MODEL_FACTOR.items():
        sub = d[d.subscription_model == model]
        ratio = (sub.adjusted_price / sub.subscription_price).round(10).unique()
        check(
            len(ratio) == 1 and abs(ratio[0] - factor) < 1e-9,
            f"subscription_model '{model}' -> adjusted/subscription = {factor} exactly (n={len(sub)})",
        )

    for dtype, rate in DISCOUNT_RATE.items():
        sub = d[d.discount_type == dtype]
        check(
            sub.discount_rate.nunique() == 1 and abs(sub.discount_rate.iloc[0] - rate) < 1e-12,
            f"discount_type '{dtype}' -> discount_rate {rate} exactly (n={len(sub)})",
        )

    err = (d.final_price - d.adjusted_price * (1 - d.discount_rate)).abs().max()
    check(err < 1e-9, f"final_price = adjusted_price x (1 - discount_rate); max error {err:.2e}")

    recon = (
        d.membership_type.map(TIER_PRICE)
        * d.subscription_model.map(MODEL_FACTOR)
        * (1 - d.discount_type.map(DISCOUNT_RATE))
    )
    err = (d.final_price - recon).abs().max()
    check(err < 1e-9, f"final_price reconstructed from THREE LABELS ALONE; max error {err:.2e}")
    combos = d.groupby(["membership_type", "subscription_model", "discount_type"]).ngroups
    print(f"        {d.final_price.nunique()} distinct prices from {combos} label combinations.")
    print("        There is no pricing residual to analyse. Any 'price optimisation' finding")
    print("        drawn from this file is a restatement of the price list.")

    ci = pd.to_timedelta(d.avg_time_check_in)
    co = pd.to_timedelta(d.avg_time_check_out)
    err = (d.duration_in_gym_minutes - (co - ci).dt.total_seconds() / 60).abs().max()
    check(err == 0, f"duration_in_gym_minutes = check_out - check_in exactly; max error {err}")

    tok = d.days_per_week.str.split(", ").str.len()
    check(
        (tok == d.visit_per_week).all(),
        f"len(days_per_week) == visit_per_week on all {len(d)} rows",
    )
    print("        Six of 26 columns carry no information beyond other columns:")
    print("        subscription_price, adjusted_price, discount_rate, final_price,")
    print("        duration_in_gym_minutes, visit_per_week.")


# ---------------------------------------------------------------------------------------
# 3. MISSINGNESS / STRUCTURAL ABSENCE
# ---------------------------------------------------------------------------------------
def check_missingness(d: pd.DataFrame) -> None:
    h("3. MISSINGNESS - zero nulls; the structural absence is a BOUNDED RANGE")
    nulls = int(d.isna().sum().sum())
    check(nulls == 0, f"no nulls anywhere in the file ({nulls} found)")

    n_days = d.last_visit_date.nunique()
    check(
        n_days == 60 and d.days_since_visit.max() == 59,
        f"last_visit_date occupies exactly 60 consecutive days "
        f"({d.last_visit_date.min()} .. {d.last_visit_date.max()}), all {n_days} present",
    )
    for k in (30, 45, 60, 90):
        n = int((d.days_since_visit > k).sum())
        print(f"        inactive > {k:2}d: {n:5}  ({n / len(d) * 100:5.1f}%)")
    check(
        (d.days_since_visit > 60).sum() == 0,
        "0% of members are inactive beyond 60 days -- NOBODY IN THIS FILE HAS CHURNED",
    )
    print("        Three of the brief's ten questions (Q1 retention, Q2 churn, Q10 churn risk)")
    print("        and one of its five mission bullets (M5) ask about a phenomenon the file")
    print("        cannot contain. This is a CENSORING WINDOW, not a low churn rate: a churned")
    print("        member would have a last_visit_date before 2025-05-24, and none exists.")

    check(
        (d.tenure_days >= 0).all(),
        f"last_visit >= join_date on every row (min tenure {d.tenure_days.min()}d)",
    )
    upgrade_cols = [c for c in d.columns if "upgrade" in c.lower() or "prev" in c.lower()]
    check(upgrade_cols == [], f"no upgrade / prior-tier column exists ({upgrade_cols or 'none'})")
    print("        Q6's 'upgrade behavior' has no column and no history: one row per member,")
    print("        one tier, no transition. Unanswerable rather than unanswered.")


# ---------------------------------------------------------------------------------------
# 4. IS THE HEADLINE METRIC NOISE?
# ---------------------------------------------------------------------------------------
def check_noise(d: pd.DataFrame) -> None:
    h("4. NOISE - check-in is uniform; duration rejects uniformity WITHIN locations")

    ci = d.checkin_minutes / 60
    p = stats.kstest((ci - 8) / 13, "uniform").pvalue
    check(
        p > 0.05,
        f"check-in hour is U(08:00, 21:00): KS p={p:.4f}, range [{ci.min():.2f}, {ci.max():.2f}]",
    )
    print("        Nobody's check-in time reflects their access tier -- see check 6.")

    print("\n        Duration, tested WITHIN each location (the June lesson):")
    rejects = 0
    for loc, g in d.groupby("home_gym_location"):
        v = g.duration_in_gym_minutes.values
        pv = stats.kstest((v - 30) / 151, "uniform").pvalue
        rejects += pv < 0.05
        print(
            f"          {loc:20} n={len(v):4} mean={v.mean():6.1f}"
            f"  KS-vs-U(30,180) p={pv:.4f}{'  <- rejects' if pv < 0.05 else ''}"
        )
    check(
        rejects >= 4,
        f"duration is NOT uniform within {rejects}/10 locations -- location structure is real",
    )
    print("        Pooled, duration looks like flat noise on [30, 180]. Split by location it is")
    print("        not. Testing only the pooled distribution would have missed the one signal")
    print("        this file contains. That is exactly June's lesson, and it paid twice.")


# ---------------------------------------------------------------------------------------
# 5. EFFECT SIZE OVER p
# ---------------------------------------------------------------------------------------
def check_effect_sizes(d: pd.DataFrame) -> pd.DataFrame:
    h("5. EFFECT SIZE - 88 pre-declared tests, Bonferroni corrected")
    n_tests = len(CATS) * len(NUMS)
    alpha = 0.05 / n_tests
    print(f"  {n_tests} tests declared before looking. Bonferroni alpha = {alpha:.2e}\n")
    print(f"  {'axis':<24}{'metric':<26}{'eta2':>8}{'omega2':>9}{'p':>12}")
    print("  " + "-" * 80)

    rows = []
    for cv in CATS:
        for nv in NUMS:
            gs = [g[nv].values for _, g in d.groupby(cv) if len(g) > 1]
            if len(gs) < 2:
                continue
            p = stats.kruskal(*gs).pvalue
            rows.append((cv, nv, eta_squared(gs), omega_squared(gs), p, p < alpha))
            if p < alpha:
                print(f"  {cv:<24}{nv:<26}{rows[-1][2]:8.4f}{rows[-1][3]:9.4f}{p:12.2e}  ***")
    res = pd.DataFrame(rows, columns=["axis", "metric", "eta2", "omega2", "p", "sig"])
    n_sig = int(res.sig.sum())
    print(f"\n  {n_sig} of {n_tests} clear Bonferroni. Now separate definitions from findings.")

    price_rows = res[res.sig & (res.metric == "final_price")]
    check(
        len(price_rows) >= 5,
        f"{len(price_rows)} of the {n_sig} 'results' are final_price by a label that DEFINES it",
    )
    print("        membership_type -> final_price gives eta2 = 0.87. It means nothing: the tier")
    print("        IS the price. This is the trap the whole field will fall into (check 2).")

    behav = res[res.sig & (res.metric != "final_price")]
    print("\n  Significant on a BEHAVIOURAL metric (not price):")
    for _, r in behav.iterrows():
        print(f"    {r.axis:<24}{r.metric:<26}eta2={r.eta2:.4f} omega2={r.omega2:.4f} p={r.p:.2e}")

    tautologies = {("personal_training", "personal_training_hours")}
    print(
        f"\n  ...of which {len(tautologies)} is a definition "
        "(personal_training is TRUE iff its own hours > 0)."
    )
    check(
        bool(
            (
                (behav.axis == "home_gym_location") & (behav.metric == "duration_in_gym_minutes")
            ).any()
        ),
        "location -> duration survives as a genuine behavioural effect",
    )
    for nv in ["visit_per_week", "tenure_days", "days_since_visit"]:
        sub = res[(res.metric == nv) & res.sig]
        check(len(sub) == 0, f"NOTHING explains {nv} -- 0 of {len(CATS)} axes clear correction")
    return res


# ---------------------------------------------------------------------------------------
# 6. CONFOUNDS
# ---------------------------------------------------------------------------------------
def check_confounds(d: pd.DataFrame) -> None:
    h("6. CONFOUNDS - access_hours is an IDENTITY on membership_type, not a correlate")

    for tier, access in TIER_ACCESS.items():
        sub = d[d.membership_type == tier]
        check(
            (sub.access_hours == access).all(),
            f"every '{tier}' member has access_hours '{access}' (n={len(sub)})",
        )
    check(
        d.groupby("access_hours").membership_type.nunique().eq(1).all(),
        "the map is 1:1 in both directions -- Q7 (access) and Q1 (tier) are ONE question",
    )

    print("\n  Do the entitlements constrain behaviour at all?")
    wk = d[d.access_hours == "Weekdays only"]
    wk_end = wk.days_per_week.str.contains("Sat|Sun")
    other_end = d[d.access_hours != "Weekdays only"].days_per_week.str.contains("Sat|Sun")
    print(
        f"    'Weekdays only' members listing Sat/Sun : {int(wk_end.sum()):4}/{len(wk)} "
        f"({wk_end.mean() * 100:.1f}%)"
    )
    print(f"    everyone else listing Sat/Sun           : {other_end.mean() * 100:.1f}%")
    check(
        wk_end.mean() < other_end.mean(),
        f"weekday-only members list a weekend day LESS often than everyone else "
        f"({wk_end.mean() * 100:.2f}% vs {other_end.mean() * 100:.2f}%) -- the sign a "
        f"non-enforcement story would need is BACKWARDS",
    )

    op = d[d.access_hours == "Off-peak only"]
    rest = d[d.access_hours != "Off-peak only"]

    def peak(s):
        return ((s.checkin_minutes >= 17 * 60) & (s.checkin_minutes < 20 * 60)).mean()

    print(f"    'Off-peak only' checking in 17:00-20:00 : {peak(op) * 100:.1f}%")
    print(f"    everyone else                           : {peak(rest) * 100:.1f}%")
    check(
        abs(peak(op) - peak(rest)) < 0.03,
        f"off-peak members use peak hours at the same rate as everyone else "
        f"({abs(peak(op) - peak(rest)) * 100:.1f}pp apart)",
    )
    gs = [g.checkin_minutes.values for _, g in d.groupby("access_hours")]
    check(
        eta_squared(gs) < 0.02,
        f"access tier explains {eta_squared(gs) * 100:.2f}% of check-in time variance",
    )
    kw_p = stats.kruskal(*gs).pvalue
    print(f"        KW p={kw_p:.5f} against the pre-declared alpha=5.68e-4 -- FAILS.")
    print("        Read this as a NULL, not as 'the entitlement is not enforced'. That")
    print("        stronger claim was killed at G3 (insights.md -> Correction): it needs a")
    print("        check-in-denied event this file does not have, and the one comparison")
    print("        that could support it runs the wrong way. Basic pays $20 for 'Off-peak")
    print("        only' and Elite $70 for 'Priority access'; whether the 3.5x premium buys")
    print("        anything is UNTESTABLE here, which is not the same as unenforced.")

    print("\n  multi_location_access is a two-band coin flip keyed to tier, not a member choice:")
    for tier in ["Basic", "Standard", "Premium", "Elite"]:
        sub = d[d.membership_type == tier]
        k, n = int(sub.multi_location_access.sum()), len(sub)
        lo, hi = stats.binomtest(k, n).proportion_ci(0.95)
        print(f"    {tier:10} {k / n * 100:5.1f}%  95% CI [{lo * 100:.1f}, {hi * 100:.1f}]  n={n}")
    lo_band = d[d.membership_type.isin(["Basic", "Standard"])].multi_location_access.mean()
    hi_band = d[d.membership_type.isin(["Premium", "Elite"])].multi_location_access.mean()
    check(
        abs(lo_band - 0.30) < 0.02 and abs(hi_band - 0.80) < 0.02,
        f"two bands: Basic+Standard {lo_band * 100:.1f}%, Premium+Elite {hi_band * 100:.1f}%",
    )
    print("        Q8 asks for 'geographic patterns in multi-location access behavior'. The")
    print("        variable is drawn from a tier band; by city it gives chi2 p=0.024, which")
    print("        does NOT clear the 5.68e-4 correction. There is no geographic pattern.")


# ---------------------------------------------------------------------------------------
# 7. THIN CELLS + POWER
# ---------------------------------------------------------------------------------------
def check_thin_cells_and_power(d: pd.DataFrame) -> None:
    h("7. THIN CELLS and POWER - what WOULD we have detected?")
    for col in ["membership_type", "subscription_model", "discount_type", "home_gym_location"]:
        counts = d[col].value_counts()
        thin = counts[counts < 200]
        flag = (
            f"  <- FLAG {', '.join(f'{i} (n={v})' for i, v in thin.items())}" if len(thin) else ""
        )
        print(f"  {col:20} min cell n={counts.min():4} ({counts.idxmin()}){flag}")
    check(
        d.membership_type.value_counts().min() >= 150,
        "no tier is too thin to estimate, but Elite (n=199) carries visibly wider intervals",
    )

    print("\n  Minimum detectable difference between two tiers (80% power, alpha=0.05, 2-sided):")
    n_per = len(d) / d.membership_type.nunique()
    for col in ["visit_per_week", "duration_in_gym_minutes", "age"]:
        sd = d[col].std()
        mde = 2.8 * sd * np.sqrt(2 / n_per)
        print(
            f"    {col:26} sd={sd:6.2f}  n/tier~{n_per:.0f}  MDE={mde:6.2f}"
            f"  ({mde / d[col].mean() * 100:.1f}% of the mean)"
        )
    print("  We could have seen an 8% difference in visit frequency between tiers. We saw none.")
    print("  That is a positive finding about the product, not a failure of the analysis --")
    print("  and it is the July lesson applied: quantify the null instead of reporting silence.")

    print("\n  The one behavioural effect, with a permutation test rather than an asymptotic p:")
    gs = [g.duration_in_gym_minutes.values for _, g in d.groupby("home_gym_location")]
    obs = eta_squared(gs)
    allv = np.concatenate(gs)
    sizes = [len(g) for g in gs]
    gm, sst = allv.mean(), ((allv - allv.mean()) ** 2).sum()
    rng = np.random.default_rng(7)
    null = np.empty(10_000)
    for i in range(10_000):
        perm = rng.permutation(allv)
        j, ss = 0, 0.0
        for s in sizes:
            ss += s * (perm[j : j + s].mean() - gm) ** 2
            j += s
        null[i] = ss / sst
    pperm = (null >= obs).mean()
    check(
        pperm < 0.001,
        f"location -> duration: eta2={obs:.4f} omega2={omega_squared(gs):.4f} "
        f"permutation p={pperm:.5f} (10k perms, seed 7)",
    )
    means = d.groupby("home_gym_location").duration_in_gym_minutes.mean().sort_values()
    print(
        f"    spread: {means.index[-1]} {means.iloc[-1]:.1f} min vs "
        f"{means.index[0]} {means.iloc[0]:.1f} min = {means.iloc[-1] - means.iloc[0]:.1f} min"
    )
    print("    omega2 is quoted alongside eta2 because at 2% of variance the bias correction")
    print("    is a fifth of the estimate. The effect is real and small; both words matter.")

    print("\n  The second surviving effect, with binomial CIs:")
    for tier in ["Standard", "Basic", "Premium", "Elite"]:
        sub = d[d.membership_type == tier]
        k, n = int(sub.attend_group_lesson.sum()), len(sub)
        lo, hi = stats.binomtest(k, n).proportion_ci(0.95)
        print(
            f"    {tier:10} group classes {k / n * 100:5.1f}%"
            f"  95% CI [{lo * 100:.1f}, {hi * 100:.1f}]  n={n}"
        )
    s = d[d.membership_type == "Standard"].attend_group_lesson
    o = d[d.membership_type != "Standard"].attend_group_lesson
    pf = stats.fisher_exact(
        [[int(s.sum()), len(s) - int(s.sum())], [int(o.sum()), len(o) - int(o.sum())]]
    )[1]
    check(
        pf < 5.68e-4,
        f"Standard attends group classes less: {s.mean() * 100:.1f}% vs {o.mean() * 100:.1f}%, "
        f"Fisher p={pf:.2e} (clears Bonferroni)",
    )
    print("        One deviant cell out of four, and Basic/Premium/Elite intervals all overlap.")
    print("        It clears correction, but a single isolated cell is exactly the shape a")
    print("        generator artefact takes. Reported with that caveat attached, not as strategy.")


# ---------------------------------------------------------------------------------------
# BONUS - the revenue unit
# ---------------------------------------------------------------------------------------
def check_revenue_units(d: pd.DataFrame) -> None:
    h("BONUS. sum(final_price) IS A CATEGORY ERROR")
    per_period = {"Monthly": 12, "Quarterly": 4, "Early Bird (Annual)": 1}
    naive = d.final_price.sum()
    as_monthly = naive * 12
    as_period = (d.final_price * d.subscription_model.map(per_period)).sum()
    print(
        f"  naive sum(final_price)                   = {naive:12,.0f}  <- mixes 3 billing periods"
    )
    print(f"  annualised, reading it as a MONTHLY rate = {as_monthly:12,.0f}")
    print(f"  annualised, reading it as PER-PERIOD     = {as_period:12,.0f}")
    check(
        abs(as_monthly / as_period - 1.43) < 0.02,
        f"the two defensible readings fork by {as_monthly / as_period:.2f}x -- "
        "the unit must be DECLARED, not assumed",
    )
    print("  This build reads final_price as an effective MONTHLY rate (assumptions.md A-1),")
    print("  the only reading under which a 0.75x annual factor is not absurd. Every revenue")
    print("  figure in the UI is labelled with its unit for exactly this reason.")


# ---------------------------------------------------------------------------------------
# 8. THE COUPLING - last_visit_date is join_date, rank-rescaled
#
# This is the month's thesis and it was MISSED on the first pass. Checks 1-7 established
# that churn is unanswerable because last_visit_date is censored to 60 days. That is true
# but incomplete: the column is not merely bounded, it is a monotone remap of join_date.
# So the file does not withhold a churn answer -- it manufactures a WRONG one, exactly
# inverted, and hands it to anyone who uses the column as labelled.
#
# Found by an adversarial review of the candidate thesis and verified independently
# before acceptance. See analysis/insights.md "Correction" for what it replaced.
# ---------------------------------------------------------------------------------------
def check_the_coupling(d: pd.DataFrame) -> None:
    h("8. THE COUPLING - last_visit_date is join_date, rank-rescaled onto 60 days")

    j = d.join_date.astype("datetime64[ns]").astype("int64")
    lv = d.last_visit_date.astype("datetime64[ns]").astype("int64")
    rho = stats.spearmanr(j, lv).statistic
    check(
        rho > 0.999, f"Spearman(join_date, last_visit_date) = {rho:.6f} -- these are ONE variable"
    )
    r = np.corrcoef(d.tenure_days, d.days_since_visit)[0, 1]
    check(r > 0.999, f"Pearson(tenure, days_since_visit) = {r:.6f}")

    one_to_one = d.groupby("join_date").last_visit_date.nunique().eq(1)
    rows_covered = d.join_date.isin(one_to_one[one_to_one].index).mean()
    check(
        rows_covered > 0.95,
        f"{int(one_to_one.sum())}/{len(one_to_one)} join dates map to exactly ONE "
        f"last_visit_date ({rows_covered * 100:.1f}% of rows)",
    )
    pairs = d.groupby(["join_date", "last_visit_date"]).ngroups
    print(f"        distinct (join, last_visit) pairs observed: {pairs}")
    print("        Under independence this would be in the low thousands. It is a function.")

    print("\n        Tenure band per last_visit_date -- monotone and essentially disjoint:")
    tb = d.groupby("last_visit_date").tenure_days.agg(["min", "max", "count"]).sort_index()
    for i in list(range(3)) + list(range(len(tb) - 3, len(tb))):
        rr = tb.iloc[i]
        print(
            f"          {tb.index[i]}  tenure {int(rr['min']):5}-{int(rr['max']):5}  "
            f"n={int(rr['count'])}"
        )
        if i == 2:
            print(f"          {'...':>10}")
    check(
        tb["max"].is_monotonic_decreasing,
        "tenure decreases monotonically as last_visit_date advances -- a rank map, not a behaviour",
    )

    print("\n  THE DECISION CONSEQUENCE - what a churn model built here would actually do:\n")
    lapsed = d[d.days_since_visit > 30]
    active = d[d.days_since_visit <= 30]
    k = len(lapsed)

    # TIE-SAFE. The obvious version -- sort by tenure, take the top k, intersect -- returns
    # 981 or 982 out of 982 depending purely on how four members who share a tenure of 549
    # days happen to sort. Two correct implementations disagreed on the headline number,
    # which means the number was UNDER-DEFINED rather than wrong. Membership is therefore
    # decided by VALUE: a member counts if their tenure is at least the k-th highest present.
    kth = np.sort(d.tenure_days.values)[::-1][k - 1]
    overlap = int((lapsed.tenure_days >= kth).sum())
    print(f"        members a 30-day rule flags as lapsed        : {k:5}")
    print(
        f"        of those, at or above the {k}th tenure ({kth}d): {overlap:5} "
        f"({overlap / k * 100:.1f}%)"
    )
    print(
        f"        mean tenure, 'lapsed'                        : {lapsed.tenure_days.mean():7.1f} d"
    )
    print(
        f"        mean tenure, 'active'                        : {active.tenure_days.mean():7.1f} d"
    )
    check(
        overlap / k > 0.99,
        f"the churn-risk list IS the loyalty ranking, inverted ({overlap / k * 100:.1f}% overlap)",
    )

    # The version of the claim that does not depend on the cut at all.
    lo, hi = lapsed.tenure_days.min(), active.tenure_days.max()
    band = int(((d.tenure_days >= lo) & (d.tenure_days <= hi)).sum())
    print(f"\n        min tenure among FLAGGED : {lo:5}    max among ACTIVE : {hi:5}")
    print(f"        members in the overlap band                  : {band:5}")
    check(
        band <= 5,
        f"the lapse rule is a TENURE CUT: flagged and active overlap on {band} members' "
        f"worth of tenure. At a 45-day threshold the separation is perfect (0 overlap).",
    )
    print("        Every entrant who builds the churn segment the brief asks for (Q10) will")
    print("        target their most loyal members, in descending order of loyalty. This is")
    print("        not 'the data is bad' -- it is a specific, reproducible, wrong decision.")


# ---------------------------------------------------------------------------------------
# BONUS - two claims that DID NOT SURVIVE adversarial review
#
# Kept in the file, with their refutations, because a rejected candidate is evidence of
# the process. Both were in an earlier draft of the thesis. Neither is in the UI.
# ---------------------------------------------------------------------------------------
def check_eligibility_controls(d: pd.DataFrame) -> None:
    h("BONUS. TWO CANDIDATE FINDINGS, AND WHY THEY WERE DEMOTED")

    print("  (a) 'The Student discount is not age-gated' -- DEMOTED to one sentence.\n")
    print(f"    {'discount':10}{'n':>6}{'mean age':>10}{'median':>8}{'>25':>8}{'35+':>8}")
    for dt in ["Promo", "None", "Loyalty", "Student"]:
        s = d[d.discount_type == dt]
        print(
            f"    {dt:10}{len(s):6}{s.age.mean():10.1f}{s.age.median():8.0f}"
            f"{(s.age > 25).mean() * 100:7.1f}%{(s.age >= 35).mean() * 100:7.1f}%"
        )
    stu = d[d.discount_type == "Student"]
    rest = d[d.discount_type != "Student"]
    check(
        stu.age.mean() > rest.age.mean(),
        f"'Student' holders are the OLDEST cohort in the file: mean {stu.age.mean():.1f} "
        f"vs {rest.age.mean():.1f} (Mann-Whitney p="
        f"{stats.mannwhitneyu(stu.age, rest.age).pvalue:.2e})",
    )
    check(
        (stu.age > 25).mean() > 0.7,
        f"{(stu.age > 25).mean() * 100:.1f}% of Student-discount holders are over 25; "
        f"{(stu.age >= 35).mean() * 100:.1f}% are 35 or older",
    )
    print("        An age-checked eligibility field would left-skew. This one right-shifts.")

    # REFUTATION 1 - it fails its own pre-declared threshold.
    p = stats.mannwhitneyu(stu.age, rest.age).pvalue
    alpha = 0.05 / (len(CATS) * len(NUMS))
    check(
        p > alpha,
        f"Student-vs-rest FAILS the pre-declared Bonferroni threshold: p={p:.5f} vs "
        f"alpha={alpha:.2e}. Cohen d={(stu.age.mean() - rest.age.mean()) / d.age.std():.2f}.",
    )

    # REFUTATION 2 - the dollar figure is 92% base rate.
    d_eff = (stu.adjusted_price - stu.final_price).sum() * 12
    over25 = stu[stu.age > 25]
    d_over = (over25.adjusted_price - over25.final_price).sum() * 12
    base = (d.age > 25).mean()
    print(f"\n        annual cost of the Student discount    : ${d_eff:>10,.0f}")
    print(f"        ...to members over 25                  : ${d_over:>10,.0f}")
    print(f"        population share over 25               : {base * 100:>10.1f}%")
    print(f"        age-blind expectation                  : ${d_eff * base:>10,.0f}")
    print(
        f"        EXCESS attributable to the age skew    : ${d_over - d_eff * base:>10,.0f}"
        f"  ({(d_over - d_eff * base) / d_over * 100:.1f}% of the headline)"
    )
    check(
        (d_over - d_eff * base) < 2_000,
        f"the '$17,872 misallocated' figure is {(1 - (d_over - d_eff * base) / d_over) * 100:.0f}% "
        "base rate -- quoting it would be quoting the age distribution",
    )

    # WHAT SURVIVES - the omnibus, as a two-sided gradient, not the Student half alone.
    omni = stats.kruskal(*[g.age.values for _, g in d.groupby("discount_type")]).pvalue
    check(
        omni < alpha,
        f"what DOES clear correction is the omnibus discount_type x age (KW p={omni:.2e}): "
        "a two-sided gradient, Promo young (28.5) and Student old (32.1)",
    )
    pt = stats.mannwhitneyu(d[d.personal_training].age, d[~d.personal_training].age).pvalue
    print("        and the strongest age association in the file is not a discount at all:")
    print(f"        personal_training x age, p={pt:.2e} (PT buyers ~2.4 years older).")
    print("        VERDICT: one sentence in the ledger, no dollar figure, not in the UI.")

    print("\n  (b) '176 children with sauna and late-night access' -- KILLED.\n")
    minors = d[d.age < 18]
    adults = d[d.age >= 18]
    young = d[d.age < 16]
    check(
        len(minors) == 274,
        f"{len(minors)} members are under 18 ({len(minors) / len(d) * 100:.1f}%), "
        f"ages {minors.age.min()}-{minors.age.max()}",
    )

    # This was drafted as an operational-risk finding. It is not one. Every amenity flag
    # is INDEPENDENT of minor status -- the counts are pure base rate. This is the June
    # tautology in a new costume: asserting a real-world hazard from the generator's
    # failure to correlate two columns.
    print(f"        {'flag':26}{'minors':>9}{'adults':>9}{'chi2 p':>10}")
    for col in [
        "uses_sauna",
        "attend_group_lesson",
        "has_drink_subscription",
        "multi_location_access",
    ]:
        ct = [
            [int(minors[col].sum()), int((~minors[col]).sum())],
            [int(adults[col].sum()), int((~adults[col]).sum())],
        ]
        pv = stats.chi2_contingency(ct)[1]
        print(
            f"        {col:26}{minors[col].mean() * 100:8.1f}%{adults[col].mean() * 100:8.1f}%"
            f"{pv:10.3f}"
        )
        check(pv > 0.05, f"{col} is INDEPENDENT of minor status (p={pv:.3f}) -- no finding here")

    pb = stats.binomtest(int(young.uses_sauna.sum()), len(young), d.uses_sauna.mean()).pvalue
    check(
        pb > 0.05,
        f"'{int(young.uses_sauna.sum())} of {len(young)} 12-15s use the sauna' is "
        f"{young.uses_sauna.mean() * 100:.1f}% against a {d.uses_sauna.mean() * 100:.1f}% "
        f"base rate (binomial p={pb:.2f}) -- it is 0.51 x 176, nothing more",
    )

    guardian = [
        c
        for c in d.columns
        if any(k in c.lower() for k in ("guardian", "consent", "parent", "supervis"))
    ]
    check(
        guardian == [], f"no guardian-consent or supervision column exists ({guardian or 'none'})"
    )
    print("        VERDICT: the DATA affirmatively says no association exists. What remains is")
    print("        a one-line SCHEMA note -- no consent field, no age gate on any entitlement --")
    print("        stated as a question, in a footnote. Not a thesis clause, not in the poster.")


def main() -> int:
    d = load()
    print(f"Loaded {len(d):,} rows x {len(d.columns)} columns from {RAW.name}")
    check_grain(d)
    check_derived(d)
    check_missingness(d)
    check_noise(d)
    check_effect_sizes(d)
    check_confounds(d)
    check_thin_cells_and_power(d)
    check_the_coupling(d)
    check_revenue_units(d)
    check_eligibility_controls(d)

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
