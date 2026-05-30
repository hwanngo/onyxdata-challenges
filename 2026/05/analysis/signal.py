#!/usr/bin/env python3
"""G2 signal hunt - 2026/05 Music Streaming Platform Performance.

The dictionary's largest claim is that the data is "deliberately seeded with detectable
patterns under +/-15-20% noise". `integrity.py` shows the file keeps 68 of its 70 smaller
promises. This script tests the big one, axis by axis, and reports EFFECT SIZE, not just p.

The 2026/04 lesson runs the other way here. There, the source promised structure and the
file was uniform noise. Here the source promises structure and it is my job to find out
which axes actually carry it - because a page that reports every axis as "significant" on
224,078 rows is as dishonest as one that reports none.

Rule applied throughout: with n=224,078 a p-value is worthless. Cohen's floor for a SMALL
effect is eta^2 = 0.01. Anything below that is reported as "detectable but negligible".

    uv run python 2026/05/analysis/signal.py

Read-only.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
RAW = next(
    d
    for d in MONTH_DIR.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)
DATA = next(RAW.rglob("fact_listening_session.csv")).parent

PRICE = {"Free": 0.0, "Premium": 9.99, "Family": 14.99}
SMALL = 0.01  # Cohen's floor for a small effect


def section(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def eta_squared(groups: list[np.ndarray]) -> float:
    """Share of variance explained. The effect size, not the p-value."""
    allv = np.concatenate(groups)
    grand = allv.mean()
    ss_between = sum(len(g) * (g.mean() - grand) ** 2 for g in groups)
    ss_total = ((allv - grand) ** 2).sum()
    return float(ss_between / ss_total) if ss_total else 0.0


def axis(df: pl.DataFrame, by: str, val: str, label: str = "") -> tuple[float, float]:
    groups = [g[val].to_numpy() for _, g in df.group_by(by)]
    groups = [g for g in groups if len(g) > 1]
    if len(groups) < 2:
        return float("nan"), float("nan")
    p = stats.kruskal(*groups).pvalue
    e = eta_squared(groups)
    verdict = "REAL" if e >= SMALL else "negligible"
    print(f"  {label or by:<34} KW p={p:<11.3g} eta2={e:<9.5f} {verdict}")
    return p, e


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    """Non-parametric effect size for two groups; = 2*AUC - 1. Robust, unlike Cohen's d."""
    u = stats.mannwhitneyu(a, b, alternative="two-sided").statistic
    return float(2 * u / (len(a) * len(b)) - 1)


def load() -> dict[str, pl.DataFrame]:
    return {
        p.stem: pl.read_csv(p, try_parse_dates=True, infer_schema_length=None)
        for p in sorted(DATA.glob("*.csv"))
    }


def main() -> int:
    t = load()
    f = t["fact_listening_session"]
    e = t["fact_subscription_event"]
    u = t["dim_user"]

    f = (
        f.with_columns(
            pl.col("listen_start_ts").dt.truncate("1mo").alias("month"),
            pl.col("listen_start_ts").dt.year().alias("year"),
            pl.col("listen_start_ts").dt.month().alias("moy"),
            pl.col("listen_start_ts").dt.hour().alias("hour"),
            pl.col("listen_start_ts").dt.weekday().alias("dow"),
            pl.col("skipped").cast(pl.Int8).alias("skip_i"),
        )
        .join(
            t["dim_track"].select(["track_id", "is_algorithmic_recommendation"]),
            on="track_id",
            how="left",
        )
        .join(
            u.select(
                [
                    "user_id",
                    "age",
                    "gender",
                    "is_fraud_cluster",
                    pl.col("country_code").alias("home_country"),
                ]
            ),
            on="user_id",
            how="left",
        )
        .join(t["dim_device"].select(["device_id", "device_type"]), on="device_id", how="left")
        .join(t["dim_genre"], on="genre_id", how="left")
    )

    section("1. IS THERE A TEMPORAL TREND? (the brief's first question)")
    m = f.group_by("month").agg(pl.len().alias("sessions")).sort("month")
    x = np.arange(m.height)
    y = m["sessions"].to_numpy()
    lr = stats.linregress(x, y)
    rho = stats.spearmanr(x, y)
    print(
        f"  48 months of session volume: {y[0]:,} -> {y[-1]:,}  ({100 * (y[-1] / y[0] - 1):+.1f}%)"
    )
    print(
        f"  OLS slope {lr.slope:+.1f} sessions/month, R^2 = {lr.rvalue**2:.4f}, p = {lr.pvalue:.3g}"
    )
    print(f"  Spearman rho = {rho.statistic:+.4f} (p={rho.pvalue:.3g})  <- monotonic growth?")
    print(
        f"  min month {y.min():,} ({m['month'][int(y.argmin())]}), max {y.max():,} ({m['month'][int(y.argmax())]})"
    )

    # growth is confounded by the user base growing. Per-active-user is the honest series.
    au = f.select(["month", "user_id"]).unique().group_by("month").len().rename({"len": "active"})
    m2 = (
        m.join(au, on="month")
        .with_columns((pl.col("sessions") / pl.col("active")).alias("per_user"))
        .sort("month")
    )
    lr2 = stats.linregress(np.arange(m2.height), m2["per_user"].to_numpy())
    print(
        f"\n  CONFOUND CHECK - sessions per ACTIVE user: {m2['per_user'][0]:.1f} -> {m2['per_user'][-1]:.1f}"
    )
    print(f"  slope {lr2.slope:+.4f}/month, R^2 = {lr2.rvalue**2:.4f}, p = {lr2.pvalue:.3g}")
    print("  (if this is flat, the volume growth is entirely user acquisition, not engagement)")

    section("2. SEASONALITY + CYCLES")
    axis(f, "moy", "listen_seconds", "month-of-year -> listen_seconds")
    axis(f, "dow", "listen_seconds", "day-of-week   -> listen_seconds")
    axis(f, "hour", "listen_seconds", "hour-of-day   -> listen_seconds")

    for name, col in [("month-of-year", "moy"), ("day-of-week", "dow"), ("hour-of-day", "hour")]:
        c = f.group_by(col).len().sort(col)
        obs = c["len"].to_numpy()
        chi = stats.chisquare(obs)
        cv = np.sqrt(chi.statistic / (obs.sum() * (len(obs) - 1)))
        print(
            f"  {name:<14} VOLUME chi2={chi.statistic:>10.1f} df={len(obs) - 1:<3} "
            f"p={chi.pvalue:<10.3g} Cramer V={cv:.4f}  "
            f"range {obs.min():,}-{obs.max():,} ({100 * (obs.max() / obs.min() - 1):+.1f}%)"
        )

    print("\n  CONFOUND: raw month-of-year counts are contaminated by the growth ramp -")
    print("  Dec-2024 is the biggest month in the file, so December wins by trend, not season.")
    print("  Detrended: each month's share OF ITS OWN YEAR, averaged across the 4 years.")
    yr_tot = f.group_by("year").len().rename({"len": "yr_n"})
    shares = (
        f.group_by(["year", "moy"])
        .len()
        .join(yr_tot, on="year")
        .with_columns((pl.col("len") / pl.col("yr_n")).alias("share"))
    )
    ms = (
        shares.group_by("moy")
        .agg(
            (pl.col("share").mean() * 100).round(3).alias("mean_share_pct"),
            (pl.col("share").std() * 100).round(3).alias("sd"),
        )
        .sort("moy")
    )
    flat = 100 / 12
    print(f"  {'month':>6} {'share%':>8} {'sd':>7}  vs flat 8.333%")
    for r in ms.iter_rows(named=True):
        bar = "#" * round(r["mean_share_pct"] * 4)
        print(f"  {r['moy']:>6} {r['mean_share_pct']:>8.3f} {r['sd']:>7.3f}  {bar}")
    dev = ms["mean_share_pct"].to_numpy() - flat
    print(
        f"  max deviation from flat: {dev.max():+.3f}pp (month {int(ms['moy'][int(dev.argmax())])}), "
        f"{dev.min():+.3f}pp (month {int(ms['moy'][int(dev.argmin())])})"
    )
    print("\n  That share profile rises MONOTONICALLY Jan->Dec. A season repeats; a ramp does")
    print("  not. Within-year share is still the growth curve, sliced 4 times.")
    print("\n  chi2 of month-of-year WITHIN each year (still contains the within-year ramp):")
    for y in sorted(f["year"].unique().to_list()):
        o = f.filter(pl.col("year") == y).group_by("moy").len().sort("moy")["len"].to_numpy()
        if len(o) == 12:
            c2 = stats.chisquare(o)
            v = np.sqrt(c2.statistic / (o.sum() * 11))
            print(
                f"    {y}  chi2={c2.statistic:>9.1f} p={c2.pvalue:<11.3g} Cramer V={v:.4f}  "
                f"range {o.min():,}-{o.max():,}"
            )

    print("\n  THE HONEST TEST - fit log-linear growth to all 48 months, then ask whether")
    print("  month-of-year explains anything LEFT OVER. This is the only question that")
    print("  distinguishes a season from a trend.")
    mv = m.sort("month")
    lv = np.log(mv["sessions"].to_numpy())
    tt = np.arange(mv.height)
    fit = stats.linregress(tt, lv)
    resid = lv - (fit.intercept + fit.slope * tt)
    print(
        f"  log-linear fit: {100 * (np.exp(fit.slope) - 1):+.2f}%/month compounding, R^2={fit.rvalue**2:.4f}"
    )
    print(f"  residual sd = {resid.std():.4f} in log space (~{100 * resid.std():.1f}% of level)")
    moy_of_month = mv["month"].dt.month().to_numpy()
    yr_of_month = mv["month"].dt.year().to_numpy()

    def moy_test(mask: np.ndarray, label: str) -> None:
        r_, k_ = resid[mask], moy_of_month[mask]
        grp = [r_[k_ == q] for q in range(1, 13)]
        grp = [g for g in grp if len(g) > 1]
        kw_ = stats.kruskal(*grp)
        e_ = eta_squared(grp)
        # eta^2 is badly upward-biased at n=3-4 per group. omega^2 corrects it and CAN go
        # negative, which is the honest signal for "less structure than chance would give".
        n_, k_n = sum(len(g) for g in grp), len(grp)
        allv = np.concatenate(grp)
        ssb = sum(len(g) * (g.mean() - allv.mean()) ** 2 for g in grp)
        sst = ((allv - allv.mean()) ** 2).sum()
        msw = (sst - ssb) / (n_ - k_n)
        omega = (ssb - (k_n - 1) * msw) / (sst + msw)
        print(
            f"  {label:<22} n={n_:<3} KW p={kw_.pvalue:<8.4g} eta2={e_:.4f} "
            f"omega2={omega:+.4f}  -> {'SEASON' if kw_.pvalue < 0.05 and omega > SMALL else 'no season detectable'}"
        )

    print("  NOTE: only 4 observations per month-of-year, so eta^2 is heavily upward-biased.")
    print("  omega^2 is reported alongside; it is the unbiased form and may go negative.")
    moy_test(np.ones(len(resid), bool), "all 48 months")
    moy_test(yr_of_month >= 2022, "2022-24 (drop launch)")
    print(f"\n  Why drop 2021: it holds the launch. 2021-01 = {int(mv['sessions'][0])} sessions,")
    print(
        f"  2021-12 = {int(mv.filter(pl.col('month').dt.year() == 2021)['sessions'][-1]):,}. "
        "Log-residuals there are enormous and drown any season."
    )
    print(f"\n  {'moy':>4} {'resid 22-24':>12}  (positive = above the growth curve)")
    for k in range(1, 13):
        g = resid[(moy_of_month == k) & (yr_of_month >= 2022)]
        print(
            f"  {k:>4} {g.mean():>+12.4f}  {'+' if g.mean() > 0 else '-'}"
            f"{'*' * int(abs(g.mean()) * 60)}"
        )

    print("\n  DAY-OF-WEEK is NOT confounded by the ramp (weekdays are evenly spread over")
    print("  1,461 days), so its volume signal stands without correction:")
    dw = f.group_by(["dow", "session_weekday"]).len().sort("dow")
    tot = dw["len"].sum()
    for r in dw.iter_rows(named=True):
        print(
            f"    {r['session_weekday']:<10} {r['len']:>7,}  {100 * r['len'] / tot:>5.2f}%  "
            f"{'#' * int(300 * r['len'] / tot)}"
        )

    section("3. DOES TIER CHANGE BEHAVIOUR?")
    axis(f, "subscription_tier", "listen_seconds", "tier -> listen_seconds")
    axis(f, "subscription_tier", "skip_i", "tier -> skip rate")
    print(
        "\n  "
        + str(
            f.group_by("subscription_tier")
            .agg(
                pl.len().alias("sessions"),
                pl.col("listen_seconds").mean().round(1).alias("mean_sec"),
                pl.col("listen_seconds").median().alias("med_sec"),
                (pl.col("skip_i").mean() * 100).round(2).alias("skip_pct"),
                (pl.col("new_artist_discovered").mean() * 100).round(2).alias("discover_pct"),
            )
            .sort("sessions", descending=True)
            .to_dicts()
        )
    )

    section("4. FRAUD CLUSTER - the brief asks this directly")
    fr = f.filter(pl.col("is_fraud_cluster"))
    nf = f.filter(~pl.col("is_fraud_cluster"))
    n_fu = u.filter(pl.col("is_fraud_cluster")).height
    print(
        f"  {n_fu} of {u.height} users flagged ({100 * n_fu / u.height:.1f}%), "
        f"{fr.height:,} of {f.height:,} sessions ({100 * fr.height / f.height:.1f}%)"
    )
    for col in ["listen_seconds", "skip_i"]:
        a, bb = fr[col].to_numpy(), nf[col].to_numpy()
        mw = stats.mannwhitneyu(a, bb, alternative="two-sided")
        print(
            f"  {col:<16} fraud mean {a.mean():>8.3f} vs clean {bb.mean():>8.3f}  "
            f"MW p={mw.pvalue:<11.3g} Cliff's d={cliffs_delta(a, bb):+.4f}"
        )
    spu = f.group_by(["user_id", "is_fraud_cluster"]).len().rename({"len": "n"})
    a = spu.filter(pl.col("is_fraud_cluster"))["n"].to_numpy()
    bb = spu.filter(~pl.col("is_fraud_cluster"))["n"].to_numpy()
    print(
        f"  sessions per user  fraud mean {a.mean():>8.1f} vs clean {bb.mean():>8.1f}  "
        f"MW p={stats.mannwhitneyu(a, bb).pvalue:<11.3g} Cliff's d={cliffs_delta(a, bb):+.4f}"
    )
    # distinct tracks per session-count -- a bot replays a narrow catalogue
    div = f.group_by(["user_id", "is_fraud_cluster"]).agg(
        (pl.col("track_id").n_unique() / pl.len()).alias("variety")
    )
    a = div.filter(pl.col("is_fraud_cluster"))["variety"].to_numpy()
    bb = div.filter(~pl.col("is_fraud_cluster"))["variety"].to_numpy()
    print(
        f"  catalogue variety  fraud mean {a.mean():>8.4f} vs clean {bb.mean():>8.4f}  "
        f"MW p={stats.mannwhitneyu(a, bb).pvalue:<11.3g} Cliff's d={cliffs_delta(a, bb):+.4f}"
    )

    section("5. ALGORITHMIC RECOMMENDATION - the brief asks this directly")
    ar = f.filter(pl.col("is_algorithmic_recommendation"))
    nr = f.filter(~pl.col("is_algorithmic_recommendation"))
    n_at = t["dim_track"].filter(pl.col("is_algorithmic_recommendation")).height
    print(
        f"  {n_at} of {t['dim_track'].height} tracks flagged ({100 * n_at / t['dim_track'].height:.1f}%), "
        f"{ar.height:,} of {f.height:,} sessions ({100 * ar.height / f.height:.1f}%)"
    )
    for col in ["listen_seconds", "skip_i"]:
        a, bb = ar[col].to_numpy(), nr[col].to_numpy()
        print(
            f"  {col:<16} algo mean {a.mean():>8.3f} vs organic {bb.mean():>8.3f}  "
            f"MW p={stats.mannwhitneyu(a, bb).pvalue:<11.3g} Cliff's d={cliffs_delta(a, bb):+.4f}"
        )
    # plays per track is the fairer question: does the algorithm SURFACE them more?
    pt = (
        f.group_by("track_id")
        .len()
        .rename({"len": "plays"})
        .join(t["dim_track"].select(["track_id", "is_algorithmic_recommendation"]), on="track_id")
    )
    a = pt.filter(pl.col("is_algorithmic_recommendation"))["plays"].to_numpy()
    bb = pt.filter(~pl.col("is_algorithmic_recommendation"))["plays"].to_numpy()
    print(
        f"  plays per track  algo mean {a.mean():>8.1f} vs organic {bb.mean():>8.1f}  "
        f"MW p={stats.mannwhitneyu(a, bb).pvalue:<11.3g} Cliff's d={cliffs_delta(a, bb):+.4f}"
    )

    section("6. OTHER SEGMENT AXES (effect size ranked)")
    res = []
    for by, label in [
        ("device_type", "device_type"),
        ("genre_name", "genre"),
        ("country_code", "session country"),
        ("home_country", "user home country"),
        ("gender", "gender"),
        ("year", "year"),
    ]:
        _p, et = axis(f, by, "listen_seconds", f"{label} -> listen_seconds")
        res.append((label, et))
    age_b = f.with_columns(
        pl.when(pl.col("age") < 25)
        .then(pl.lit("18-24"))
        .when(pl.col("age") < 35)
        .then(pl.lit("25-34"))
        .when(pl.col("age") < 50)
        .then(pl.lit("35-49"))
        .otherwise(pl.lit("50+"))
        .alias("age_band")
    )
    axis(age_b, "age_band", "listen_seconds", "age band -> listen_seconds")
    r = stats.spearmanr(f["age"].to_numpy(), f["listen_seconds"].to_numpy())
    print(f"  age (continuous) vs listen_seconds  Spearman rho={r.statistic:+.4f} p={r.pvalue:.3g}")

    section("7. IS listen_seconds JUST NOISE? (distribution shape)")
    ls = f["listen_seconds"].to_numpy()
    print(
        f"  n={len(ls):,} min={ls.min()} max={ls.max()} mean={ls.mean():.1f} median={np.median(ls):.0f}"
    )
    print(
        f"  skew={stats.skew(ls):+.4f} kurtosis={stats.kurtosis(ls):+.4f}  (uniform predicts -1.2)"
    )
    scaled = (ls - ls.min()) / (ls.max() - ls.min())
    print(f"  KS vs Uniform: p={stats.kstest(scaled, 'uniform').pvalue:.4g}")
    lg = np.log(ls[ls > 0])
    print(
        f"  KS vs LogNormal(fitted): p={stats.kstest(lg, stats.norm(lg.mean(), lg.std()).cdf).pvalue:.4g}"
    )
    print(f"  var/mean = {ls.var() / ls.mean():.2f}  (Poisson predicts 1.0)")

    print("\n  Mean 92.3 but median 35 with NEGATIVE kurtosis is not one distribution.")
    print("  Decomposing by `skipped`, which is the obvious candidate for the second mode:")
    for lab, sub in [
        ("skipped", f.filter(pl.col("skipped"))),
        ("not skipped", f.filter(~pl.col("skipped"))),
    ]:
        v = sub["listen_seconds"].to_numpy()
        print(
            f"    {lab:<12} n={len(v):>7,} min={v.min():>4} max={v.max():>4} "
            f"mean={v.mean():>6.1f} median={np.median(v):>5.0f} skew={stats.skew(v):+.3f}"
        )
    print("  Histogram of listen_seconds, 20 bins across the full 5-238 range:")
    hist, edges = np.histogram(ls, bins=20)
    for i, h in enumerate(hist):
        print(f"    {edges[i]:>6.1f}-{edges[i + 1]:>6.1f} {h:>7,} {'#' * int(60 * h / hist.max())}")

    section("8. LOGNORMAL ENGAGEMENT - the dictionary claims heavy/light user variance")
    spu2 = f.group_by("user_id").len().rename({"len": "n"})["n"].to_numpy()
    print(
        f"  sessions per user: min={spu2.min()} max={spu2.max()} mean={spu2.mean():.1f} median={np.median(spu2):.0f}"
    )
    print(f"  CV = {spu2.std() / spu2.mean():.4f}   skew = {stats.skew(spu2):+.4f}")
    lg2 = np.log(spu2)
    print(
        f"  KS vs LogNormal(fitted): p={stats.kstest(lg2, stats.norm(lg2.mean(), lg2.std()).cdf).pvalue:.4g}"
    )
    print(
        f"  KS vs Normal(fitted):    p={stats.kstest(spu2, stats.norm(spu2.mean(), spu2.std()).cdf).pvalue:.4g}"
    )
    srt = np.sort(spu2)[::-1]
    for q in (0.01, 0.05, 0.10, 0.20, 0.50):
        k = max(1, int(len(srt) * q))
        print(
            f"  top {q:>5.0%} of users = {100 * srt[:k].sum() / srt.sum():>5.1f}% of all sessions"
        )

    section("9. PRE-CHURN LEADING INDICATOR - the brief asks for one explicitly")
    churn = e.filter(pl.col("event_type") == "churn").select(
        ["user_id", pl.col("event_ts").alias("churn_date")]
    )
    print(f"  {churn.height:,} churn events across {churn['user_id'].n_unique():,} users")
    fc = (
        f.select(["user_id", "listen_start_ts", "listen_seconds", "skip_i"])
        .join(churn, on="user_id", how="inner")
        .with_columns(
            (pl.col("churn_date") - pl.col("listen_start_ts").dt.date())
            .dt.total_days()
            .alias("days_before")
        )
    )
    win = [
        (0, 14, "0-14d before"),
        (15, 30, "15-30d"),
        (31, 60, "31-60d"),
        (61, 90, "61-90d"),
        (91, 180, "91-180d"),
        (181, 100000, "181d+ before"),
    ]
    print(f"  {'window':<16} {'sessions':>10} {'mean_sec':>10} {'skip%':>8}")
    series = []
    for lo, hi, lab in win:
        w = fc.filter((pl.col("days_before") >= lo) & (pl.col("days_before") <= hi))
        if w.height:
            print(
                f"  {lab:<16} {w.height:>10,} {w['listen_seconds'].mean():>10.1f} "
                f"{100 * w['skip_i'].mean():>7.2f}%"
            )
            series.append((lab, w))
    near = fc.filter((pl.col("days_before") >= 0) & (pl.col("days_before") <= 30))
    far = fc.filter(pl.col("days_before") > 90)
    if near.height and far.height:
        a, bb = near["listen_seconds"].to_numpy(), far["listen_seconds"].to_numpy()
        print(
            f"\n  last 30d vs >90d before churn - listen_seconds "
            f"MW p={stats.mannwhitneyu(a, bb).pvalue:.4g} Cliff's d={cliffs_delta(a, bb):+.4f}"
        )
        a2, b2 = near["skip_i"].to_numpy(), far["skip_i"].to_numpy()
        print(
            f"  last 30d vs >90d before churn - skip rate      "
            f"MW p={stats.mannwhitneyu(a2, b2).pvalue:.4g} Cliff's d={cliffs_delta(a2, b2):+.4f}"
        )

    # RATE, not volume: sessions/day in the run-up
    rate = []
    for lo, hi, lab in win[:5]:
        w = fc.filter((pl.col("days_before") >= lo) & (pl.col("days_before") <= hi))
        days = hi - lo + 1
        rate.append((lab, w.height / churn["user_id"].n_unique() / days))
    print("\n  sessions per churning user per day, by window:")
    for lab, r_ in rate:
        print(f"    {lab:<16} {r_:.4f}")

    section("10. DO HEAVY FREE USERS CONVERT? (the brief asks)")
    free_sess = (
        f.filter(pl.col("subscription_tier") == "Free")
        .group_by("user_id")
        .len()
        .rename({"len": "free_n"})
    )
    upg = e.filter(pl.col("event_type") == "upgrade")["user_id"].unique()
    conv = free_sess.with_columns(pl.col("user_id").is_in(upg).alias("upgraded"))
    q = conv["free_n"].quantile
    bands = [(0, q(0.25)), (q(0.25), q(0.5)), (q(0.5), q(0.75)), (q(0.75), 1e9)]
    print(f"  {'free-session band':<22} {'users':>7} {'upgraded':>9} {'rate':>8}")
    for lo, hi in bands:
        w = (
            conv.filter((pl.col("free_n") > lo) & (pl.col("free_n") <= hi))
            if lo
            else conv.filter(pl.col("free_n") <= hi)
        )
        if w.height:
            print(
                f"  {f'{int(lo) + 1}-{int(hi) if hi < 1e9 else int(conv["free_n"].max())}':<22} "
                f"{w.height:>7,} {int(w['upgraded'].sum()):>9,} {100 * w['upgraded'].mean():>7.1f}%"
            )
    a = conv.filter(pl.col("upgraded"))["free_n"].to_numpy()
    bb = conv.filter(~pl.col("upgraded"))["free_n"].to_numpy()
    print(
        f"\n  free sessions: upgraders mean {a.mean():.1f} vs non {bb.mean():.1f}  "
        f"MW p={stats.mannwhitneyu(a, bb).pvalue:.4g} Cliff's d={cliffs_delta(a, bb):+.4f}"
    )

    section("11. VERDICT ON THE '+/-15-20% SEEDED PATTERN' CLAIM")
    print("  Every eta^2 above is compared against Cohen's small-effect floor of 0.01.")
    print("  Volume/count effects (chi2, Cramer V) are reported separately from")
    print("  behavioural effects (listen_seconds, skip) because they can disagree -")
    print("  and in this file they do. See the summary written into analysis/profile.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
