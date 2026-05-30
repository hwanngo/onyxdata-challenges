#!/usr/bin/env python3
"""
Star schema - 2026/05 Music Streaming Platform Performance  (Gate G4)

Reads the read-only CSVs, writes parquet to data/curated/. The raw folder is never touched.

This month the model's job is the inverse of last month's. 2026/04's source was uniform noise, so
its schema existed to make the wrong analysis inexpressible. Here 68 of 72 dictionary claims are
TRUE, the signals are real, and the schema exists to make the right analysis *unavoidable* -
specifically, to make it impossible to compute a content ranking without also computing what that
ranking looks like with the repeat-concentrated population removed.

Seven decisions, each an argument:

  1. EVERY ARTIST RANKING IS STORED TWICE, OR NOT AT ALL. `dim_artist_rank` carries rank_all AND
     rank_clean side by side, plus the delta. There is no table in this model from which a naked
     top-10 by total plays can be read. The single most likely competing entry is a top-10 artist
     bar chart, and it is wrong: the two top-10s overlap 1 of 10.

  2. THE COHORT IS NEVER CALLED FRAUD. The source column is `is_fraud_cluster` and it flags 50.2%
     of users - a prevalence no real fraud population has. It is an unadjudicated vendor label, and
     laundering it into a finding would accuse 482 paying subscribers of a crime the data does not
     evidence. The modelled column is `is_repeat_concentrated`, which is what was actually
     measured: 9.5 distinct tracks per 30 plays against 22.5. The source name survives verbatim in
     `dim_defect` so nothing is hidden.

  3. `playlist_id` IS DEMOTED TO ONE BOOLEAN. It is random with respect to the track played
     (3.649% coherence vs 3.680% expected at random), so a `playlist_id` column in a fact table
     invites a join that means nothing. What survives is `playlist_is_public`, the one bit that
     does carry signal. The build RAISES if coherence ever rises above 2x chance.

  4. THERE IS NO COLUMN CALLED `revenue`. `estimated_revenue_usd` is 0.508% of the business and
     mixes ad income with royalty cost. It is carried as `royalty_or_ad_usd` - a name that cannot
     be summed into a slide labelled revenue - plus `is_royalty_qualifying`. Subscription revenue
     lives in a separate table, `fact_mrr_month`, computed from the event log.

  5. `variety` IS NEVER STORED AS distinct/sessions. That ratio is bounded by 774/n and
     repeat-concentrated users have 2.3x more sessions, so it is partly arithmetic. `dim_listener`
     stores `tracks_at_30` - distinct tracks in a fixed 30-play rarefied sample, seeded - which is
     the confound-free form. `variety_raw` sits beside it so the difference is itself readable.

  6. dim_axis IS THE THESIS AS A TABLE. Every axis the brief names, with its measured effect and
     verdict against Cohen's floor. "Does tier matter? Does country?" is READ from the model, so
     no panel can answer it differently. The build raises if a verdict flips.

  7. SEASONALITY IS ONLY EXPRESSIBLE AS A RESIDUAL. `fact_month` carries the fitted growth curve
     and the residual alongside the raw count, because the raw month-of-year count IS the growth
     ramp and charting it is the trap. There is no month-of-year table.

The build RAISES if its premises stop holding, including the thesis itself.

    uv run python 2026/05/model/build.py
"""

from __future__ import annotations

from pathlib import Path
from zlib import crc32

import numpy as np
import polars as pl
from scipy import stats

f = pl.col

MONTH = Path(__file__).resolve().parents[1]
RAW = next(
    d
    for d in MONTH.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)
DATA = next(RAW.rglob("fact_listening_session.csv")).parent
OUT = MONTH / "data" / "curated"
OUT.mkdir(parents=True, exist_ok=True)

SMALL = 0.01  # Cohen's floor for a small effect size
SMALL_DELTA = 0.147  # Cliff's delta equivalent of "small"
RAREFY_K = 30  # fixed sample size for the confound-free variety measure
SEED = crc32(b"2026-05-music-streaming")  # label-derived: reproducible, not a magic number
ROYALTY_PER_PLAY = 0.004
PRICE = {"Free": 0.0, "Premium": 9.99, "Family": 14.99}


def premise(ok: bool, msg: str) -> None:
    """A premise of the model. If it stops holding the model is wrong, so the build stops."""
    if not ok:
        raise SystemExit(f"PREMISE VIOLATED: {msg}")


def load(name: str) -> pl.DataFrame:
    return pl.read_csv(DATA / f"{name}.csv", try_parse_dates=True, infer_schema_length=None)


def eta_squared(groups: list[np.ndarray]) -> float:
    allv = np.concatenate(groups)
    grand = allv.mean()
    ssb = sum(len(g) * (g.mean() - grand) ** 2 for g in groups)
    sst = ((allv - grand) ** 2).sum()
    return float(ssb / sst) if sst else 0.0


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    u = stats.mannwhitneyu(a, b, alternative="two-sided").statistic
    return float(2 * u / (len(a) * len(b)) - 1)


def _ltv_interval(a: np.ndarray, b: np.ndarray) -> dict[str, float]:
    """How wide the LTV null is, as a % of the comparison group's mean.

    A p-value says whether we can reject; these say what we could have seen and what the data
    still allows. Both are required before a null may be described in words.
    """
    n1, n0 = len(a), len(b)
    sp = np.sqrt(((n1 - 1) * a.var(ddof=1) + (n0 - 1) * b.var(ddof=1)) / (n1 + n0 - 2))
    se = sp * np.sqrt(1 / n1 + 1 / n0)
    diff = a.mean() - b.mean()
    return {
        # Smallest gap detectable at 80% power, two-sided alpha .05.
        # Rounded to 6dp, NOT to the 1dp the page displays: metric_checks.yml recomputes
        # these in SQL at full precision, so a value quantised for display would fail its
        # own verification. Quantise once, at the point of display.
        "ltv_mde_pct": round(float(100 * (1.959964 + 0.841621) * se / b.mean()), 6),
        "ltv_diff_ci_lo_pct": round(float(100 * (diff - 1.959964 * se) / b.mean()), 6),
        "ltv_diff_ci_hi_pct": round(float(100 * (diff + 1.959964 * se) / b.mean()), 6),
        "ltv_total_flagged_usd": round(float(a.sum()), 2),
        "ltv_total_clean_usd": round(float(b.sum()), 2),
    }


def main() -> int:
    t = {
        n: load(n)
        for n in [
            "fact_listening_session",
            "fact_subscription_event",
            "bridge_playlist_track",
            "dim_user",
            "dim_track",
            "dim_artist",
            "dim_genre",
            "dim_playlist",
            "dim_device",
            "dim_country",
            "dim_date",
            "dim_subscription_plan",
        ]
    }
    sess, ev = t["fact_listening_session"], t["fact_subscription_event"]

    # ---- premises inherited from G1 ------------------------------------------------
    premise(sess.height == 224_078, f"session count changed: {sess.height:,}")
    premise(sess["session_id"].n_unique() == sess.height, "session_id is no longer unique")
    premise(ev.height == 3_640, f"event count changed: {ev.height:,}")
    premise(
        dict(
            zip(
                t["dim_subscription_plan"]["plan_name"],
                t["dim_subscription_plan"]["monthly_price_usd"],
                strict=False,
            )
        )
        == PRICE,
        "the plan price catalogue changed; every MRR figure in this model assumes it",
    )

    # ---- DECISION 3: establish that playlist_id is random ---------------------------
    bridge = t["bridge_playlist_track"]
    pairs = set(zip(bridge["playlist_id"].to_list(), bridge["track_id"].to_list(), strict=False))
    hits = sum(
        (p, k) in pairs
        for p, k in zip(sess["playlist_id"].to_list(), sess["track_id"].to_list(), strict=False)
    )
    holders = dict(
        zip(
            *bridge.group_by("track_id", maintain_order=True)
            .len()
            .select(["track_id", "len"])
            .to_dict(as_series=False)
            .values(),
            strict=False,
        )
    )
    n_pl = t["dim_playlist"].height
    expected = sum(holders.get(k, 0) / n_pl for k in sess["track_id"].to_list()) / sess.height
    coherence = hits / sess.height
    premise(
        coherence < 2 * expected,
        f"playlist_id coherence is now {100 * coherence:.3f}% vs {100 * expected:.3f}% at random - "
        "it carries real signal and DECISION 3 (demote it to one boolean) must be revisited",
    )

    # =================================================================================
    # fact_session - grain is user x track x device x timestamp
    # =================================================================================
    fs = (
        sess.join(
            t["dim_user"].select(
                [
                    "user_id",
                    "age",
                    "gender",
                    # DECISION 2: the vendor label is renamed to what was measured
                    f("is_fraud_cluster").alias("is_repeat_concentrated"),
                    f("country_code").alias("home_country_code"),
                    f("subscription_tier").alias("current_tier"),
                ]
            ),
            on="user_id",
            how="left",
        )
        .join(
            t["dim_track"].select(
                ["track_id", "title", "is_algorithmic_recommendation", "release_date"]
            ),
            on="track_id",
            how="left",
        )
        .join(t["dim_artist"].select(["artist_id", "artist_name"]), on="artist_id", how="left")
        .join(t["dim_genre"], on="genre_id", how="left")
        .join(
            t["dim_device"].select(["device_id", "device_type", "os_name"]),
            on="device_id",
            how="left",
        )
        .join(
            t["dim_country"].select(["country_code", "country_name", "region", "continent"]),
            on="country_code",
            how="left",
        )
        # DECISION 3: playlist survives as one bit only
        .join(
            t["dim_playlist"].select(["playlist_id", f("is_public").alias("playlist_is_public")]),
            on="playlist_id",
            how="left",
        )
        .with_columns(
            f("listen_start_ts").dt.date().alias("session_date"),
            f("listen_start_ts").dt.truncate("1mo").alias("session_month"),
            f("listen_start_ts").dt.year().alias("session_year"),
            f("listen_start_ts").dt.hour().alias("session_hour"),
            f("listen_start_ts").dt.weekday().alias("dow_num"),
            # DECISION 4: the money column is named what it actually is
            f("estimated_revenue_usd").alias("royalty_or_ad_usd"),
            ((f("subscription_tier") != "Free") & (f("listen_seconds") >= 30)).alias(
                "is_royalty_qualifying"
            ),
            (f("subscription_tier") == "Free").alias("is_ad_supported"),
            pl.when(f("age") < 25)
            .then(pl.lit("18-24"))
            .when(f("age") < 35)
            .then(pl.lit("25-34"))
            .when(f("age") < 50)
            .then(pl.lit("35-49"))
            .otherwise(pl.lit("50+"))
            .alias("age_band"),
        )
        # Fri/Sat/Sun is the block that carries the effect, and the name must not mislead:
        # dow_num 5,6,7 = Fri,Sat,Sun under polars' Mon=1 convention.
        .with_columns((f("dow_num") >= 5).alias("is_weekend_block"))
        .drop(["estimated_revenue_usd", "playlist_id", "is_fraud_cluster"], strict=False)
    )
    premise("estimated_revenue_usd" not in fs.columns, "DECISION 4: the raw revenue name leaked")
    premise("playlist_id" not in fs.columns, "DECISION 3: playlist_id leaked into the fact table")
    premise("is_fraud_cluster" not in fs.columns, "DECISION 2: the vendor 'fraud' name leaked")
    fs.write_parquet(OUT / "fact_session.parquet")

    # =================================================================================
    # dim_listener - one row per user, with the CONFOUND-FREE variety measure
    # =================================================================================
    # SEED PER USER, not once for the whole loop.
    #
    # A single generator consumed across users makes every user's draw depend on how many
    # users preceded it, so the rarefied sample - and therefore this month's load-bearing
    # measure - is a function of group iteration order. polars does not promise that order,
    # so the build was not reproducible: `top10_overlap_rarefied` came out 3 on one run and
    # 2 on the next. 2026/02 paid for exactly this with its bootstrap and the rule is already
    # in LEARNINGS: seed from the thing being measured. `maintain_order=True` makes the order
    # stable; seeding per user makes the value independent of order at all.
    def _user_rng(uid: int) -> np.random.Generator:
        return np.random.default_rng(SEED ^ crc32(str(uid).encode()))

    tracks_by_user = {
        int(uid): g["track_id"].to_numpy()
        for (uid,), g in sess.select(["user_id", "track_id"]).group_by(
            "user_id", maintain_order=True
        )
    }
    rare = pl.DataFrame(
        [
            {
                "user_id": uid,
                "sessions": len(arr := tracks_by_user[uid]),
                "distinct_tracks": len(np.unique(arr)),
                # DECISION 5: rarefied to a fixed n, so session count cannot drive it
                "tracks_at_30": len(np.unique(_user_rng(uid).choice(arr, RAREFY_K, replace=False)))
                if len(arr) >= RAREFY_K
                else None,
            }
            for uid in sorted(tracks_by_user)
        ]
    )

    hhi = (
        sess.group_by(["user_id", "track_id"], maintain_order=True)
        .len()
        .with_columns((f("len") / f("len").sum().over("user_id")).alias("share"))
        .group_by("user_id", maintain_order=True)
        .agg((f("share") ** 2).sum().alias("repeat_concentration"))
    )
    behav = sess.group_by("user_id", maintain_order=True).agg(
        f("listen_seconds").mean().alias("mean_listen_seconds"),
        f("listen_seconds").sum().alias("total_listen_seconds"),
        f("skipped").mean().alias("skip_rate"),
        f("listen_start_ts").min().dt.date().alias("first_session"),
        f("listen_start_ts").max().dt.date().alias("last_session"),
        f("artist_id").n_unique().alias("distinct_artists"),
    )

    # lifetime value from the event log: price of each tier x months held at that tier
    span = (
        ev.sort(["user_id", "event_ts", "event_id"])
        .with_columns(f("event_ts").shift(-1).over("user_id").alias("next_ts"))
        .with_columns(f("next_ts").fill_null(pl.date(2024, 12, 31)))
        .with_columns(
            ((f("next_ts") - f("event_ts")).dt.total_days() / 30.44).alias("months_held"),
            f("to_tier").replace_strict(PRICE).alias("tier_price"),
        )
    )
    ltv = (
        span.with_columns((f("months_held") * f("tier_price")).alias("rev"))
        .group_by("user_id", maintain_order=True)
        .agg(f("rev").sum().alias("lifetime_value_usd"))
    )
    churn_n = (
        ev.filter(f("event_type") == "churn")
        .group_by("user_id", maintain_order=True)
        .len()
        .rename({"len": "churn_events"})
    )

    dl = (
        t["dim_user"]
        .rename({"is_fraud_cluster": "is_repeat_concentrated"})
        .join(rare, on="user_id", how="left")
        .join(hhi, on="user_id", how="left")
        .join(behav, on="user_id", how="left")
        .join(ltv, on="user_id", how="left")
        .join(churn_n, on="user_id", how="left")
        .join(
            t["dim_country"].select(["country_code", "country_name", "region"]),
            on="country_code",
            how="left",
        )
        .with_columns(
            f("churn_events").fill_null(0),
            (f("distinct_tracks") / f("sessions")).alias("variety_raw"),
            pl.when(f("age") < 25)
            .then(pl.lit("18-24"))
            .when(f("age") < 35)
            .then(pl.lit("25-34"))
            .when(f("age") < 50)
            .then(pl.lit("35-49"))
            .otherwise(pl.lit("50+"))
            .alias("age_band"),
            f("family_account_id").is_not_null().alias("is_family_member"),
        )
    )
    dl.write_parquet(OUT / "dim_listener.parquet")

    # DECISION 5 premise: the rarefied measure must separate at least as well as the raw one.
    a = dl.filter(f("is_repeat_concentrated") & f("tracks_at_30").is_not_null())[
        "tracks_at_30"
    ].to_numpy()
    b = dl.filter(~f("is_repeat_concentrated") & f("tracks_at_30").is_not_null())[
        "tracks_at_30"
    ].to_numpy()
    d_rare = cliffs_delta(a, b)
    d_raw = cliffs_delta(
        dl.filter(f("is_repeat_concentrated"))["variety_raw"].to_numpy(),
        dl.filter(~f("is_repeat_concentrated"))["variety_raw"].to_numpy(),
    )
    premise(
        d_rare < -0.9,
        f"the rarefied separation collapsed to {d_rare:+.4f}; the whole spine rests on it",
    )
    premise(
        abs(d_rare) >= abs(d_raw),
        f"rarefaction WEAKENED the effect ({d_rare:+.4f} vs raw {d_raw:+.4f}) - if the raw ratio is "
        "the stronger measure then DECISION 5 is backwards and the page must say so",
    )
    # LTV equivalence is the fairness guardrail: it must stay NOT significant.
    ltv_a = dl.filter(f("is_repeat_concentrated"))["lifetime_value_usd"].to_numpy()
    ltv_b = dl.filter(~f("is_repeat_concentrated"))["lifetime_value_usd"].to_numpy()
    ltv_p = float(stats.mannwhitneyu(ltv_a, ltv_b, alternative="two-sided").pvalue)
    premise(
        ltv_p > 0.05,
        f"repeat-concentrated accounts now differ in lifetime value (p={ltv_p:.4g}); the page's "
        "central fairness claim is that they pay the same, and it would no longer be true",
    )

    # =================================================================================
    # dim_artist_rank - DECISION 1: no ranking without its clean counterpart
    # =================================================================================
    flagged = sorted(dl.filter(f("is_repeat_concentrated"))["user_id"].to_list())
    ss = sess.with_columns(
        f("user_id").is_in(pl.lit(pl.Series(flagged)).implode()).alias("by_flagged")
    )
    all_p = ss.group_by("artist_id", maintain_order=True).len().rename({"len": "plays_all"})
    cln_p = (
        ss.filter(~f("by_flagged"))
        .group_by("artist_id", maintain_order=True)
        .len()
        .rename({"len": "plays_clean"})
    )

    # Two further bases for the signature's robustness toggle. The claim the toggle makes is
    # "the braid stays braided however you correct for repetition", and that claim is only
    # honest if all three columns are really computed. They are.
    #
    #   rarefied - sample exactly 30 plays from every listener with >= 30, so no listener can
    #              contribute more than any other. Removes volume entirely, keeps everyone.
    #   capped   - each listener contributes at most 50 plays to any ONE artist. Keeps the
    #              cohort and its volume; bounds only its repetition. This is the basis that
    #              corresponds to the actual recommendation in the report.
    # Per-user seeding again, for the same reason as dim_listener above.
    rare_rows = []
    for (uid,), g in sess.select(["user_id", "artist_id"]).group_by("user_id", maintain_order=True):
        arr = g["artist_id"].to_numpy()
        rare_rows.append(
            _user_rng(int(uid)).choice(arr, RAREFY_K, replace=False)
            if len(arr) >= RAREFY_K
            else arr
        )
    rare_p = (
        pl.DataFrame({"artist_id": np.concatenate(rare_rows)})
        .group_by("artist_id", maintain_order=True)
        .len()
        .rename({"len": "plays_rarefied"})
    )
    CAP = 50
    cap_p = (
        sess.group_by(["user_id", "artist_id"], maintain_order=True)
        .len()
        .with_columns(pl.min_horizontal(f("len"), pl.lit(CAP)).alias("capped"))
        .group_by("artist_id", maintain_order=True)
        .agg(f("capped").sum().alias("plays_capped"))
    )
    top_one = (
        ss.filter(f("by_flagged"))
        .group_by(["artist_id", "user_id"], maintain_order=True)
        .len()
        .group_by("artist_id", maintain_order=True)
        .agg(
            f("len").max().alias("top_flagged_user_plays"),
            f("len").sum().alias("_chk"),
            pl.len().alias("flagged_listeners"),
        )
        .with_columns((f("top_flagged_user_plays") / f("_chk")).alias("top_listener_share"))
        .drop("_chk")
    )
    ar = (
        t["dim_artist"]
        .join(all_p, on="artist_id", how="left")
        .join(cln_p, on="artist_id", how="left")
        .join(t["dim_genre"], on="genre_id", how="left")
        .join(top_one, on="artist_id", how="left")
        .join(rare_p, on="artist_id", how="left")
        .join(cap_p, on="artist_id", how="left")
        .with_columns(
            f("plays_all").fill_null(0),
            f("plays_clean").fill_null(0),
            f("plays_rarefied").fill_null(0),
            f("plays_capped").fill_null(0),
        )
        .with_columns((f("plays_all") - f("plays_clean")).alias("plays_flagged"))
        .with_columns(
            f("plays_all").rank("ordinal", descending=True).cast(pl.Int32).alias("rank_all"),
            f("plays_clean").rank("ordinal", descending=True).cast(pl.Int32).alias("rank_clean"),
            f("plays_rarefied")
            .rank("ordinal", descending=True)
            .cast(pl.Int32)
            .alias("rank_rarefied"),
            f("plays_capped").rank("ordinal", descending=True).cast(pl.Int32).alias("rank_capped"),
        )
        .with_columns(
            (f("rank_all") - f("rank_clean")).alias("rank_delta"),
            pl.when(f("plays_all") > 0)
            .then(f("plays_flagged") / f("plays_all"))
            .otherwise(None)
            .alias("flagged_share"),
        )
        .sort("rank_all")
    )
    ar.write_parquet(OUT / "dim_artist_rank.parquet")

    def top10(col: str) -> set:
        return set(ar.sort(col).head(10)["artist_id"])

    overlap = len(top10("rank_all") & top10("rank_clean"))
    overlap_rarefied = len(top10("rank_all") & top10("rank_rarefied"))
    overlap_capped = len(top10("rank_all") & top10("rank_capped"))
    premise(
        overlap_rarefied <= 4 and overlap_capped <= 6,
        f"the signature's basis toggle claims the braid stays braided under every correction, "
        f"but overlaps are now clean={overlap}, rarefied={overlap_rarefied}, capped={overlap_capped}",
    )
    premise(
        overlap <= 3,
        f"the two top-10s now overlap {overlap}/10; the signature chart claims the league table is "
        "an artefact of the repeat-concentrated population, and at this overlap it is not",
    )
    rank_rho = float(
        stats.spearmanr(
            ar.filter(f("plays_all") > 0)["plays_all"], ar.filter(f("plays_all") > 0)["plays_clean"]
        ).statistic
    )

    # =================================================================================
    # fact_mrr_month - DECISION 4: subscription revenue, separate from the session column
    # =================================================================================
    evm = ev.with_columns(
        f("event_ts").dt.truncate("1mo").alias("event_month"),
        (f("trigger_context") == "reconciliation").alias("is_reconciliation"),
    )
    evm.write_parquet(OUT / "fact_subscription_event.parquet")

    mrows = []
    for mth in pl.date_range(pl.date(2021, 1, 1), pl.date(2024, 12, 1), "1mo", eager=True):
        eom = pl.select(pl.lit(mth).dt.month_end()).item()
        tiers = (
            ev.filter(f("event_ts") <= eom)
            .sort(["user_id", "event_ts", "event_id"])
            .group_by("user_id", maintain_order=True)
            .agg(f("to_tier").last())["to_tier"]
            .to_list()
        )
        wm = evm.filter(f("event_month") == mth)
        mrows.append(
            {
                "month": mth,
                "mrr_usd": round(sum(PRICE[x] for x in tiers), 2),
                "users_ever_signed_up": len(tiers),
                "paying_users": sum(1 for x in tiers if x != "Free"),
                "expansion_usd": round(
                    wm.filter(f("mrr_change_usd") > 0)["mrr_change_usd"].sum(), 2
                ),
                "contraction_usd": round(
                    wm.filter(f("mrr_change_usd") < 0)["mrr_change_usd"].sum(), 2
                ),
                "reconciliation_net_usd": round(
                    wm.filter(f("is_reconciliation"))["mrr_change_usd"].sum(), 2
                ),
                "customer_net_usd": round(
                    wm.filter(~f("is_reconciliation"))["mrr_change_usd"].sum(), 2
                ),
                "churn_events": wm.filter(f("event_type") == "churn").height,
                "signup_events": wm.filter(f("event_type") == "signup").height,
            }
        )
    mrr = pl.DataFrame(mrows).with_columns(
        (f("expansion_usd") + f("contraction_usd")).alias("net_usd")
    )
    mrr.write_parquet(OUT / "fact_mrr_month.parquet")

    recon_share = float(mrr["reconciliation_net_usd"].sum() / mrr["net_usd"].sum())
    premise(
        recon_share > 0.2,
        f"reconciliation is now only {100 * recon_share:.1f}% of net MRR; the page claims a third "
        "of reported growth is not a customer decision",
    )

    # =================================================================================
    # fact_month - DECISION 7: seasonality is only expressible as a residual
    # =================================================================================
    mv = (
        fs.group_by("session_month", maintain_order=True)
        .agg(
            pl.len().alias("sessions"),
            f("user_id").n_unique().alias("active_users"),
            f("listen_seconds").mean().alias("mean_listen_seconds"),
            f("skipped").mean().alias("skip_rate"),
            f("royalty_or_ad_usd").sum().alias("royalty_or_ad_usd"),
        )
        .sort("session_month")
    )
    lv = np.log(mv["sessions"].to_numpy())
    tt = np.arange(mv.height)
    fit = stats.linregress(tt, lv)
    mv = mv.with_columns(
        pl.Series("fitted_sessions", np.exp(fit.intercept + fit.slope * tt)),
        pl.Series("log_residual", lv - (fit.intercept + fit.slope * tt)),
        (f("sessions") / f("active_users")).alias("sessions_per_active_user"),
    )
    mv.write_parquet(OUT / "fact_month.parquet")
    monthly_growth = float(np.exp(fit.slope) - 1)
    premise(fit.rvalue**2 > 0.7, f"the growth curve no longer fits (R2={fit.rvalue**2:.3f})")

    # month-of-year on the residuals: the honest season test. omega^2, because n=4 per group.
    moy = mv["session_month"].dt.month().to_numpy()
    res = mv["log_residual"].to_numpy()
    grp = [res[moy == k] for k in range(1, 13)]
    allv = np.concatenate(grp)
    ssb = sum(len(g) * (g.mean() - allv.mean()) ** 2 for g in grp)
    sst = ((allv - allv.mean()) ** 2).sum()
    msw = (sst - ssb) / (len(allv) - 12)
    omega2_season = float((ssb - 11 * msw) / (sst + msw))
    kw_season = float(stats.kruskal(*grp).pvalue)
    premise(
        omega2_season < SMALL or kw_season > 0.05,
        f"a month-of-year season is now detectable (omega2={omega2_season:.4f}, p={kw_season:.4g}); "
        "the page claims the December peak is entirely the growth ramp",
    )

    # =================================================================================
    # dim_axis - DECISION 6: the thesis as a table
    # =================================================================================
    axes = []
    for col, label, question in [
        ("session_hour", "Hour of day", "When do people listen deeply?"),
        ("subscription_tier", "Subscription tier", "Do tiers behave differently?"),
        ("genre_name", "Genre", "Does genre drive engagement?"),
        ("device_type", "Device type", "Does device matter?"),
        ("country_name", "Country", "Are there geographic hotspots?"),
        ("age_band", "Age band", "Do age cohorts differ?"),
        ("gender", "Gender", "Does gender differ?"),
        ("session_year", "Year", "Is engagement depth changing?"),
        ("dow_num", "Day of week", "Is there a weekly cycle in depth?"),
    ]:
        groups = [g["listen_seconds"].to_numpy() for _, g in fs.group_by(col, maintain_order=True)]
        groups = [g for g in groups if len(g) > 1]
        e = eta_squared(groups)
        axes.append(
            {
                "axis": label,
                "measure": "listen_seconds",
                "eta_squared": e,
                "kruskal_p": float(stats.kruskal(*groups).pvalue),
                "levels": len(groups),
                "clears_cohen_floor": e >= SMALL,
                "verdict": "real" if e >= SMALL else "below Cohen's small-effect floor",
                "question": question,
            }
        )
    ax = pl.DataFrame(axes).sort("eta_squared", descending=True)
    ax.write_parquet(OUT / "dim_axis.parquet")

    premise(
        not ax.filter(f("axis") == "Country")["clears_cohen_floor"][0],
        "country now clears Cohen's floor; the page says five of seven segment axes are noise",
    )
    premise(
        ax.filter(f("axis") == "Subscription tier")["clears_cohen_floor"][0],
        "tier no longer clears Cohen's floor; it is a positive control for the nulls",
    )

    # =================================================================================
    # dim_flag - the two boolean flags the brief names, side by side
    # =================================================================================
    algo_a = fs.filter(f("is_algorithmic_recommendation"))["listen_seconds"].to_numpy()
    algo_b = fs.filter(~f("is_algorithmic_recommendation"))["listen_seconds"].to_numpy()
    fl = pl.DataFrame(
        [
            {
                "flag": "is_repeat_concentrated",
                "source_column": "is_fraud_cluster",
                "measure": f"distinct tracks in {RAREFY_K} plays (rarefied)",
                "group_a_mean": float(a.mean()),
                "group_b_mean": float(b.mean()),
                "cliffs_delta": d_rare,
                "mannwhitney_p": float(stats.mannwhitneyu(a, b, alternative="two-sided").pvalue),
                "n_flagged": len(a),
                "n_clean": len(b),
            },
            {
                "flag": "is_algorithmic_recommendation",
                "source_column": "is_algorithmic_recommendation",
                "measure": "listen_seconds",
                "group_a_mean": float(algo_a.mean()),
                "group_b_mean": float(algo_b.mean()),
                "cliffs_delta": cliffs_delta(algo_a, algo_b),
                "mannwhitney_p": float(
                    stats.mannwhitneyu(algo_a, algo_b, alternative="two-sided").pvalue
                ),
                "n_flagged": len(algo_a),
                "n_clean": len(algo_b),
            },
        ]
    ).with_columns(
        f("cliffs_delta").abs().alias("effect_magnitude"),
        (f("cliffs_delta").abs() >= SMALL_DELTA).alias("clears_small_effect"),
    )
    fl.write_parquet(OUT / "dim_flag.parquet")
    algo_d = float(fl.filter(f("flag") == "is_algorithmic_recommendation")["cliffs_delta"][0])
    premise(
        abs(algo_d) < 0.11,
        "the algorithmic-recommendation flag now has an effect; the page says it has none",
    )

    # =================================================================================
    # fact_duration_bin + threshold sensitivity - the 30-second cliff, and the hole
    # =================================================================================
    (
        fs.with_columns(((f("listen_seconds") // 5) * 5).alias("bin_start"))
        .group_by(["bin_start", "skipped"], maintain_order=True)
        .agg(pl.len().alias("sessions"))
        .sort(["bin_start", "skipped"])
        .write_parquet(OUT / "fact_duration_bin.parquet")
    )
    paid = fs.filter(f("subscription_tier") != "Free")
    base_q = paid.filter(f("listen_seconds") >= 30).height
    sens = pl.DataFrame(
        [
            {
                "threshold_seconds": th,
                "qualifying_plays": (n := paid.filter(f("listen_seconds") >= th).height),
                "royalty_usd": round(ROYALTY_PER_PLAY * n, 2),
                "pct_change_vs_30s": round(100 * (n / base_q - 1), 2),
            }
            for th in [20, 25, 28, 30, 32, 35, 40, 45, 60]
        ]
    )
    sens.write_parquet(OUT / "fact_threshold_sensitivity.parquet")
    premise(
        sens.filter(f("threshold_seconds") == 32)["pct_change_vs_30s"][0] < -10,
        "the 30-second cliff has flattened; the page claims a 2-second shift moves >10% of payout",
    )

    # =================================================================================
    # fact_churn_window - the leading indicator
    # =================================================================================
    churn = ev.filter(f("event_type") == "churn").select(
        ["user_id", f("event_ts").alias("churn_date")]
    )
    order = {"0-14d": 0, "15-30d": 1, "31-60d": 2, "61-90d": 3, "91-180d": 4, "181d+": 5}
    win = (
        fs.select(["user_id", "session_date", "listen_seconds", "skipped"])
        .join(churn, on="user_id", how="inner")
        .with_columns((f("churn_date") - f("session_date")).dt.total_days().alias("days_before"))
        .filter(f("days_before") >= 0)
        .with_columns(
            pl.when(f("days_before") <= 14)
            .then(pl.lit("0-14d"))
            .when(f("days_before") <= 30)
            .then(pl.lit("15-30d"))
            .when(f("days_before") <= 60)
            .then(pl.lit("31-60d"))
            .when(f("days_before") <= 90)
            .then(pl.lit("61-90d"))
            .when(f("days_before") <= 180)
            .then(pl.lit("91-180d"))
            .otherwise(pl.lit("181d+"))
            .alias("window_label")
        )
        .group_by("window_label", maintain_order=True)
        .agg(
            pl.len().alias("sessions"),
            f("listen_seconds").mean().alias("mean_listen_seconds"),
            f("skipped").mean().alias("skip_rate"),
            f("user_id").n_unique().alias("users"),
        )
        .with_columns(f("window_label").replace_strict(order).alias("sort_key"))
        .sort("sort_key")
    )
    win.write_parquet(OUT / "fact_churn_window.parquet")
    premise(
        win.filter(f("window_label") == "0-14d")["mean_listen_seconds"][0]
        < win.filter(f("window_label") == "181d+")["mean_listen_seconds"][0],
        "session depth no longer falls before churn; the leading indicator is gone",
    )

    # what follows a churn event - the revolving door
    nxt = (
        ev.sort(["user_id", "event_ts", "event_id"])
        .with_columns(f("event_type").shift(-1).over("user_id").alias("next_event"))
        .filter(f("event_type") == "churn")
        .with_columns(f("next_event").fill_null("(none - still lapsed)"))
        .group_by("next_event", maintain_order=True)
        .agg(pl.len().alias("events"))
        .sort("events", descending=True)
    )
    nxt.write_parquet(OUT / "fact_post_churn.parquet")

    # =================================================================================
    # fact_dow / fact_genre_country - the two real cycles
    # =================================================================================
    dow = (
        fs.group_by(["dow_num", "session_weekday"], maintain_order=True)
        .agg(
            pl.len().alias("sessions"),
            f("listen_seconds").mean().alias("mean_listen_seconds"),
            f("skipped").mean().alias("skip_rate"),
        )
        .with_columns((f("sessions") / f("sessions").sum()).alias("share_of_sessions"))
        .sort("dow_num")
    )
    dow.write_parquet(OUT / "fact_dow.parquet")
    wknd = float(dow.filter(f("dow_num") >= 5)["share_of_sessions"].sum())
    premise(wknd > 0.45, f"the Fri-Sun concentration fell to {100 * wknd:.1f}%")

    N = fs.height
    gc = (
        fs.group_by(["genre_name", "country_name"], maintain_order=True)
        .agg(pl.len().alias("sessions"))
        .join(
            fs.group_by("genre_name", maintain_order=True).agg(pl.len().alias("genre_total")),
            on="genre_name",
        )
        .join(
            fs.group_by("country_name", maintain_order=True).agg(pl.len().alias("country_total")),
            on="country_name",
        )
        .with_columns(
            (f("sessions") / (f("genre_total") * f("country_total") / N)).alias("over_index")
        )
        .sort("over_index", descending=True)
    )
    gc.write_parquet(OUT / "fact_genre_country.parquet")
    premise(
        gc["sessions"].min() >= 100,
        f"a genre x country cell has only {gc['sessions'].min()} rows - thin cells manufacture "
        "over-indexes, and the page presents this matrix as trustworthy",
    )

    # =================================================================================
    # dim_defect - the four falsified claims and three undocumented defects
    # =================================================================================
    free = fs.filter(f("subscription_tier") == "Free")
    exact_free = float((free["listen_seconds"].sum() / 60) * 0.003)
    rounding_gain = float(free["royalty_or_ad_usd"].sum() - exact_free)
    dupes = (
        ev.group_by(
            ["user_id", "event_type", "event_ts", "from_tier", "to_tier"], maintain_order=True
        )
        .len()
        .filter(f("len") > 1)
    )
    fd = fs.sort(["user_id", "listen_start_ts", "session_id"]).with_columns(
        (pl.int_range(pl.len()).over(["user_id", "artist_id"]) == 0).alias("truly_first")
    )
    disc_agree = fd.filter(f("truly_first") == f("new_artist_discovered")).height

    defects = pl.DataFrame(
        [
            {
                "n": 1,
                "kind": "falsified",
                "column": "estimated_revenue_usd",
                "documented": "(listen_seconds/60)*0.003 on Free",
                "actual": f"correct, then rounded to 4dp; rounding adds ${rounding_gain:.2f}",
                "rows_affected": fs.filter(
                    (f("subscription_tier") == "Free")
                    & ((f("royalty_or_ad_usd") - (f("listen_seconds") / 60 * 0.003)).abs() > 1e-9)
                ).height,
            },
            {
                "n": 2,
                "kind": "falsified",
                "column": "gender",
                "documented": "Male / Female / Non-binary / Prefer not to say",
                "actual": "five values - 'Other' is undocumented",
                "rows_affected": dl.filter(f("gender") == "Other").height,
            },
            {
                "n": 3,
                "kind": "falsified",
                "column": "playlist_id",
                "documented": "the context of the play",
                "actual": f"random - {100 * coherence:.3f}% of sessions play a track in the named "
                f"playlist vs {100 * expected:.3f}% expected at random",
                "rows_affected": sess.height - hits,
            },
            {
                "n": 4,
                "kind": "falsified",
                "column": "new_artist_discovered",
                "documented": "first play of this artist by this user",
                "actual": f"{100 * disc_agree / fs.height:.2f}% agreement with true first-plays",
                "rows_affected": fs.height - disc_agree,
            },
            {
                "n": 5,
                "kind": "undocumented",
                "column": "bridge_playlist_track.added_date",
                "documented": "scope is 2021-01-01 to 2024-12-31",
                "actual": f"runs to {bridge['added_date'].max()}",
                "rows_affected": bridge.filter(f("added_date") > pl.date(2024, 12, 31)).height,
            },
            {
                "n": 6,
                "kind": "undocumented",
                "column": "fact_subscription_event",
                "documented": "one row per lifecycle event",
                "actual": "a duplicated Premium->Family upgrade for user 828, self-labelled "
                "trigger_context='reconciliation'; breaks the MRR chain by $5.00",
                "rows_affected": int(dupes["len"].sum() - dupes.height) if dupes.height else 0,
            },
            {
                "n": 7,
                "kind": "undocumented",
                "column": "listen_seconds",
                "documented": "duration actually listened",
                "actual": "a two-component mixture with a hole - zero sessions at 45/50/55/60s",
                "rows_affected": fs.filter(f("listen_seconds").is_between(45, 115)).height,
            },
        ]
    )
    defects.write_parquet(OUT / "dim_defect.parquet")
    premise(defects.height == 7, "the defect ledger changed size")
    premise(dupes.height == 1, f"{dupes.height} duplicated event groups now, expected exactly 1")

    # =================================================================================
    # headline - every scalar the UI is allowed to show, computed once, here
    # =================================================================================
    sub_rev_total = float(mrr["mrr_usd"].sum())
    sess_rev_total = float(fs["royalty_or_ad_usd"].sum())
    end_mrr = float(mrr["mrr_usd"][-1])
    payers = int(mrr["paying_users"][-1])
    qual_all = fs.filter(f("is_royalty_qualifying")).height
    qual_flagged = fs.filter(f("is_royalty_qualifying") & f("is_repeat_concentrated")).height
    band = fs.filter(f("listen_seconds").is_between(30, 44)).height

    pl.DataFrame(
        [
            {
                "sessions": fs.height,
                "users": dl.height,
                "artists": ar.height,
                "tracks": t["dim_track"].height,
                # 2 of the 774 catalogue tracks are never played. The provenance strip quotes the
                # number that is verifiable end-to-end from the fact table, not the catalogue size.
                "tracks_played": fs["track_id"].n_unique(),
                "markets": t["dim_country"].height,
                "months": mrr.height,
                "ending_mrr_usd": round(end_mrr, 2),
                "paying_users": payers,
                "arpu_usd": round(end_mrr / dl.height, 2),
                "arppu_usd": round(end_mrr / payers, 2),
                "subscription_revenue_total_usd": round(sub_rev_total, 2),
                "session_column_total_usd": round(sess_rev_total, 2),
                "session_vs_subscription_ratio": round(sub_rev_total / sess_rev_total, 1),
                "net_mrr_usd": round(float(mrr["net_usd"].sum()), 2),
                "reconciliation_net_usd": round(float(mrr["reconciliation_net_usd"].sum()), 2),
                "reconciliation_share_of_net": recon_share,
                "customer_net_mrr_usd": round(float(mrr["customer_net_usd"].sum()), 2),
                "repeat_concentrated_users": len(flagged),
                "repeat_concentrated_user_share": len(flagged) / dl.height,
                "repeat_concentrated_session_share": fs.filter(f("is_repeat_concentrated")).height
                / fs.height,
                "tracks_at_30_flagged": round(float(a.mean()), 1),
                "tracks_at_30_clean": round(float(b.mean()), 1),
                "hhi_flagged": round(
                    float(dl.filter(f("is_repeat_concentrated"))["repeat_concentration"].mean()), 4
                ),
                "hhi_clean": round(
                    float(dl.filter(~f("is_repeat_concentrated"))["repeat_concentration"].mean()), 4
                ),
                "ltv_flagged_usd": round(float(ltv_a.mean()), 2),
                "ltv_clean_usd": round(float(ltv_b.mean()), 2),
                "ltv_mannwhitney_p": round(ltv_p, 4),
                # p = 0.19 is NOT "worth the same". It is "we could not tell", and how much we could
                # not tell by is the result. The integrity pass found this null read as equivalence on
                # five surfaces with no power stated anywhere: at n=482/479 the smallest detectable
                # gap is 16.5% of the clean mean, and the observed interval runs from 21% worse to
                # 2% better. The rule: a null is a measurement when you can say how wide it is.
                **_ltv_interval(ltv_a, ltv_b),
                "royalty_qualifying_plays": qual_all,
                "royalty_usd": round(ROYALTY_PER_PLAY * qual_all, 2),
                "royalty_on_flagged_usd": round(ROYALTY_PER_PLAY * qual_flagged, 2),
                "royalty_flagged_share": qual_flagged / qual_all,
                "sessions_in_30_44_band": band,
                "band_share": band / fs.height,
                "threshold_32s_pct_change": float(
                    sens.filter(f("threshold_seconds") == 32)["pct_change_vs_30s"][0]
                ),
                "threshold_35s_pct_change": float(
                    sens.filter(f("threshold_seconds") == 35)["pct_change_vs_30s"][0]
                ),
                "top10_overlap": overlap,
                "top10_overlap_rarefied": overlap_rarefied,
                "top10_overlap_capped": overlap_capped,
                "rank_spearman": round(rank_rho, 4),
                "fraud_cliffs_delta": round(d_rare, 4),
                "algo_cliffs_delta": algo_d,
                "monthly_growth_rate": round(monthly_growth, 4),
                "growth_r_squared": round(float(fit.rvalue**2), 4),
                "season_omega_squared": round(omega2_season, 4),
                "season_kruskal_p": round(kw_season, 4),
                "weekend_share": wknd,
                "playlist_coherence": round(coherence, 5),
                "playlist_coherence_expected": round(expected, 5),
                "dictionary_claims_tested": 72,
                "dictionary_claims_held": 68,
            }
        ]
    ).write_parquet(OUT / "headline.parquet")

    # =================================================================================
    # APP EXPORT
    # ---------------------------------------------------------------------------------
    # docs/STACK.md specifies DuckDB-WASM in the browser, and at 224,078 rows this is the
    # first month whose data would genuinely justify it. It is still the wrong call: the
    # engine is a ~32 MB download, which blows the <3s cold-load budget on its own, and
    # cross-origin isolation for the threaded build breaks the Playwright poster capture.
    #
    # Instead the fact table is exported as a CUBE over exactly the six dimensions that
    # cross-filter, with additive measures. Every panel figure is then an exact SUM over a
    # subset of cube cells - not a sample, not an approximation - so the browser reproduces
    # the parquet to the cent. 8,400 possible cells, and the real count is printed below.
    #
    # Dimensions deliberately NOT in the cube: device_type (eta2 0.0032), age_band (0.0016),
    # gender (0.0003), year (0.0003). Filtering by a null axis is an affordance that invites
    # the reader to look for something the model says is not there.
    # =================================================================================
    import json

    APP = MONTH / "app" / "public" / "data"
    APP.mkdir(parents=True, exist_ok=True)

    cube = fs.group_by(
        [
            "is_repeat_concentrated",
            "subscription_tier",
            "genre_name",
            "country_name",
            "dow_num",
            "is_algorithmic_recommendation",
        ],
        maintain_order=True,
    ).agg(
        pl.len().alias("plays"),
        f("listen_seconds").sum().alias("secs"),
        f("skipped").sum().alias("skips"),
        f("is_royalty_qualifying").sum().alias("qual"),
        f("royalty_or_ad_usd").sum().alias("usd"),
        (f("listen_seconds").is_between(30, 44)).sum().alias("band"),
        f("new_artist_discovered").sum().alias("disc"),
    )
    premise(
        cube["plays"].sum() == fs.height,
        "the cube lost rows; every panel figure is a sum over it and would silently shrink",
    )

    def dump(name: str, df: pl.DataFrame) -> None:
        (APP / f"{name}.json").write_text(
            json.dumps(df.to_dicts(), separators=(",", ":"), default=str)
        )

    dump("cube", cube)
    dump(
        "artists",
        ar.select(
            [
                "artist_id",
                "artist_name",
                "genre_name",
                "rank_all",
                "rank_clean",
                "rank_rarefied",
                "rank_capped",
                "rank_delta",
                "plays_all",
                "plays_clean",
                "plays_rarefied",
                "plays_capped",
                "plays_flagged",
                "top_listener_share",
                "flagged_listeners",
            ]
        ),
    )
    dump("mrr", mrr)
    dump("months", mv)
    dump(
        "duration",
        (
            fs.with_columns(((f("listen_seconds") // 5) * 5).alias("bin_start"))
            .group_by(["bin_start", "skipped"], maintain_order=True)
            .agg(pl.len().alias("sessions"))
            .sort(["bin_start", "skipped"])
        ),
    )
    dump("threshold", sens)
    dump("churn", win)
    dump("post_churn", nxt)
    dump("axes", ax)
    dump("flags", fl)
    dump("defects", defects)
    dump("genre_country", gc)
    dump("dow", dow)
    dump(
        "hours",
        fs.group_by("session_hour", maintain_order=True)
        .agg(pl.len().alias("plays"), f("listen_seconds").mean().alias("mean_secs"))
        .sort("session_hour"),
    )
    dump(
        "cohort",
        dl.group_by("is_repeat_concentrated", maintain_order=True).agg(
            pl.len().alias("people"),
            f("tracks_at_30").mean().alias("tracks_at_30"),
            f("repeat_concentration").mean().alias("hhi"),
            f("variety_raw").mean().alias("variety_raw"),
            f("sessions").mean().alias("mean_sessions"),
            f("lifetime_value_usd").mean().alias("mean_ltv"),
            f("lifetime_value_usd").sum().alias("total_ltv"),
        ),
    )
    dump("headline", pl.read_parquet(OUT / "headline.parquet"))

    kb = sum(p.stat().st_size for p in APP.glob("*.json")) / 1024
    print(
        f"App export: {len(list(APP.glob('*.json')))} json files, {kb:,.0f} KB total "
        f"(cube {cube.height:,} cells covering {cube['plays'].sum():,} plays)"
    )

    print(f"Wrote {len(list(OUT.glob('*.parquet')))} parquet files to {OUT}")
    for p in sorted(OUT.glob("*.parquet")):
        d = pl.read_parquet(p)
        print(f"  {p.name:<38} {d.height:>7,} rows x {d.width:>2} cols")
    print(
        f"\n  All premises held. rarefied d={d_rare:+.4f} (raw {d_raw:+.4f}), LTV p={ltv_p:.4f}, "
        f"top-10 overlap {overlap}/10, season omega2={omega2_season:+.4f}, "
        f"reconciliation {100 * recon_share:.1f}% of net MRR, algo d={algo_d:+.4f}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
