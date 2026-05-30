#!/usr/bin/env python3
"""G1/G2 integrity pass - 2026/05 Music Streaming Platform Performance.

The archive ships a data dictionary that makes ~30 falsifiable promises, plus one very
large one: the data is "deliberately seeded with detectable patterns under +/-15-20% noise".

2026/04 shipped the same generator family's dictionary and it was wrong in EIGHT places.
So nothing here is assumed. Every promise the dictionary makes is tested against the file.

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

    uv run python 2026/05/analysis/integrity.py

Read-only. Never writes into the raw folder.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
RAW = next(
    d
    for d in MONTH_DIR.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)
DATA = next(RAW.rglob("fact_listening_session.csv")).parent

FAILURES: list[str] = []
CONFIRMED: list[str] = []


def check(claim: str, ok: bool, detail: str) -> None:
    (CONFIRMED if ok else FAILURES).append(f"{claim} :: {detail}")
    print(f"  [{'OK ' if ok else 'BAD'}] {claim}\n        {detail}")


def note(text: str) -> None:
    print(f"        {text}")


def section(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load() -> dict[str, pl.DataFrame]:
    return {
        p.stem: pl.read_csv(p, try_parse_dates=True, infer_schema_length=None)
        for p in sorted(DATA.glob("*.csv"))
    }


def main() -> int:
    t = load()

    section("0. SHAPE - documented rows vs actual")
    documented = {
        "dim_genre": 10,
        "dim_artist": 448,
        "dim_track": 774,
        "dim_user": 961,
        "dim_device": 366,
        "dim_playlist": 767,
        "dim_subscription_plan": 3,
        "dim_country": 10,
        "dim_date": 1461,
        "bridge_playlist_track": 21192,
    }
    for name, want in documented.items():
        got = t[name].height
        check(f"{name} rows == {want:,}", got == want, f"actual {got:,}")
    for name, lo, hi, label in [
        ("fact_listening_session", 223_000, 225_000, "~224,000"),
        ("fact_subscription_event", 3_500, 3_700, "~3,600"),
    ]:
        check(f"{name} {label}", lo <= t[name].height <= hi, f"actual {t[name].height:,}")

    section("1. PRIMARY KEYS - 'All primary keys are unique'")
    pks = {
        "dim_genre": "genre_id",
        "dim_artist": "artist_id",
        "dim_track": "track_id",
        "dim_user": "user_id",
        "dim_device": "device_id",
        "dim_playlist": "playlist_id",
        "dim_subscription_plan": "plan_id",
        "dim_country": "country_code",
        "dim_date": "date_key",
        "fact_listening_session": "session_id",
        "fact_subscription_event": "event_id",
    }
    for tbl, pk in pks.items():
        n, d = t[tbl].height, t[tbl][pk].n_unique()
        check(f"{tbl}.{pk} unique", n == d, f"{d:,} distinct over {n:,} rows")

    b = t["bridge_playlist_track"]
    d = b.select(["playlist_id", "track_id"]).unique().height
    check(
        "bridge composite PK (playlist_id, track_id) unique",
        d == b.height,
        f"{d:,} distinct pairs over {b.height:,} rows",
    )

    section("2. FOREIGN KEYS - 'All foreign keys resolve'")
    fks = [
        ("dim_artist", "genre_id", "dim_genre", "genre_id"),
        ("dim_track", "artist_id", "dim_artist", "artist_id"),
        ("dim_track", "genre_id", "dim_genre", "genre_id"),
        ("dim_user", "country_code", "dim_country", "country_code"),
        ("dim_user", "plan_id", "dim_subscription_plan", "plan_id"),
        ("dim_user", "family_account_id", "dim_user", "user_id"),
        ("dim_playlist", "creator_user_id", "dim_user", "user_id"),
        ("bridge_playlist_track", "playlist_id", "dim_playlist", "playlist_id"),
        ("bridge_playlist_track", "track_id", "dim_track", "track_id"),
        ("fact_listening_session", "user_id", "dim_user", "user_id"),
        ("fact_listening_session", "track_id", "dim_track", "track_id"),
        ("fact_listening_session", "artist_id", "dim_artist", "artist_id"),
        ("fact_listening_session", "genre_id", "dim_genre", "genre_id"),
        ("fact_listening_session", "playlist_id", "dim_playlist", "playlist_id"),
        ("fact_listening_session", "device_id", "dim_device", "device_id"),
        ("fact_listening_session", "country_code", "dim_country", "country_code"),
        ("fact_subscription_event", "user_id", "dim_user", "user_id"),
        ("fact_subscription_event", "country_code", "dim_country", "country_code"),
    ]
    for ct, cc, pt, pc in fks:
        vals = t[ct][cc].drop_nulls().unique().to_list()
        parent = set(t[pt][pc].to_list())
        orphans = [
            v
            for v in vals
            if v not in parent and (not isinstance(v, float) or int(v) not in parent)
        ]
        check(
            f"{ct}.{cc} -> {pt}.{pc}",
            not orphans,
            f"{len(orphans)} orphan value(s) over {len(vals):,} distinct"
            + (f", e.g. {orphans[:5]}" if orphans else ""),
        )

    section("3. NULLS - where, and is it structural?")
    for name, df in t.items():
        nulls = {c: int(df[c].null_count()) for c in df.columns if df[c].null_count()}
        note(f"{name:<24} {nulls if nulls else 'no nulls'}")

    section("4. DECLARED INVARIANTS")

    j = t["dim_track"].join(
        t["dim_artist"].select(["artist_id", pl.col("genre_id").alias("artist_genre")]),
        on="artist_id",
        how="left",
    )
    mism = j.filter(pl.col("genre_id") != pl.col("artist_genre")).height
    check(
        "dim_track.genre_id 'always matches the artist's genre'",
        mism == 0,
        f"{mism:,} of {j.height:,} disagree",
    )

    j2 = (
        t["dim_track"]
        .join(t["dim_artist"].select(["artist_id", "debuts_year"]), on="artist_id", how="left")
        .with_columns(pl.col("release_date").dt.year().alias("rel_year"))
    )
    bad = j2.filter(pl.col("rel_year") < pl.col("debuts_year"))
    check(
        "dim_track.release_date >= artist's debut year",
        bad.height == 0,
        f"{bad.height:,} of {j2.height:,} released before their artist debuted"
        + (
            f"; worst gap {int((bad['debuts_year'] - bad['rel_year']).max())} years"
            if bad.height
            else ""
        ),
    )

    cnt = b.group_by("playlist_id").len().rename({"len": "bridge_n"})
    j3 = (
        t["dim_playlist"]
        .join(cnt, on="playlist_id", how="left")
        .with_columns(pl.col("bridge_n").fill_null(0))
    )
    mism3 = j3.filter(pl.col("num_tracks") != pl.col("bridge_n"))
    check(
        "dim_playlist.num_tracks 'matches bridge_playlist_track rows'",
        mism3.height == 0,
        f"{mism3.height:,} of {j3.height:,} disagree; declared total "
        f"{int(j3['num_tracks'].sum()):,} vs bridge {int(j3['bridge_n'].sum()):,}",
    )
    if mism3.height:
        diff = (j3["num_tracks"] - j3["bridge_n"]).abs()
        note(f"|num_tracks - bridge_n|: mean {diff.mean():.2f}, max {int(diff.max())}")

    f = t["fact_listening_session"]
    j4 = f.join(
        t["dim_track"].select(
            ["track_id", pl.col("artist_id").alias("t_artist"), pl.col("genre_id").alias("t_genre")]
        ),
        on="track_id",
        how="left",
    )
    ma = j4.filter(pl.col("artist_id") != pl.col("t_artist")).height
    mg = j4.filter(pl.col("genre_id") != pl.col("t_genre")).height
    check(
        "fact.artist_id == dim_track.artist_id (denormalised)",
        ma == 0,
        f"{ma:,} of {f.height:,} disagree",
    )
    check(
        "fact.genre_id == dim_track.genre_id (denormalised)",
        mg == 0,
        f"{mg:,} of {f.height:,} disagree",
    )

    wd = (
        f.with_columns(pl.col("listen_start_ts").dt.to_string("%A").alias("derived"))
        .filter(pl.col("session_weekday") != pl.col("derived"))
        .height
    )
    check("fact.session_weekday is derived from listen_start_ts", wd == 0, f"{wd:,} disagree")

    # "playlist_id (FK) -> dim_playlist (context of the play)". If the playlist is the CONTEXT
    # of the play, the track played must be in that playlist. Test it against the bridge.
    pairs = set(zip(b["playlist_id"].to_list(), b["track_id"].to_list(), strict=False))
    hits = sum(
        (p, k) in pairs
        for p, k in zip(f["playlist_id"].to_list(), f["track_id"].to_list(), strict=False)
    )
    holders = dict(
        zip(
            *b.group_by("track_id")
            .len()
            .select(["track_id", "len"])
            .to_dict(as_series=False)
            .values(),
            strict=False,
        )
    )
    n_pl = t["dim_playlist"].height
    expected = sum(holders.get(k, 0) / n_pl for k in f["track_id"].to_list()) / f.height
    z = (hits - f.height * expected) / (f.height * expected * (1 - expected)) ** 0.5
    check(
        "fact.playlist_id is the 'context of the play' (track is IN that playlist)",
        abs(z) > 3 and hits / f.height > 2 * expected,
        f"only {hits:,} of {f.height:,} ({100 * hits / f.height:.3f}%) sessions play a track that is "
        f"actually in the named playlist; random assignment predicts {100 * expected:.3f}% (z={z:+.2f})",
    )

    # "new_artist_discovered: First play of this artist by this user"
    fd = f.sort(["user_id", "listen_start_ts", "session_id"]).with_columns(
        (pl.int_range(pl.len()).over(["user_id", "artist_id"]) == 0).alias("truly_first")
    )
    agree = fd.filter(pl.col("truly_first") == pl.col("new_artist_discovered")).height
    tp = fd.filter(pl.col("truly_first") & pl.col("new_artist_discovered")).height
    n_first = int(fd["truly_first"].sum())
    n_flag = int(f["new_artist_discovered"].sum())
    check(
        "new_artist_discovered == first play of this artist by this user",
        agree == f.height,
        f"{f.height - agree:,} of {f.height:,} disagree ({100 * agree / f.height:.2f}% agreement). "
        f"{n_first:,} true first-plays, {n_flag:,} flagged: precision {100 * tp / n_flag:.1f}%, "
        f"recall {100 * tp / n_first:.1f}% (a random flag at this base rate scores "
        f"{100 * n_first / f.height:.1f}% precision, so the flag is correlated but not the definition)",
    )

    section("5. REVENUE FORMULA - the dictionary states it exactly")
    note("Free -> (listen_seconds/60)*0.003   Paid -> 0.004 per qualifying play (>=30s)")
    rev = f.with_columns(
        pl.when(pl.col("subscription_tier") == "Free")
        .then((pl.col("listen_seconds") / 60) * 0.003)
        .otherwise(pl.when(pl.col("listen_seconds") >= 30).then(0.004).otherwise(0.0))
        .alias("expected")
    ).with_columns((pl.col("estimated_revenue_usd") - pl.col("expected")).abs().alias("err"))
    off = rev.filter(pl.col("err") > 1e-9)
    check(
        "estimated_revenue_usd matches the documented formula",
        off.height == 0,
        f"{off.height:,} of {f.height:,} rows deviate; max abs err {rev['err'].max():.6f}",
    )
    if off.height:
        note(
            f"deviating rows by tier: {off.group_by('subscription_tier').len().sort('len', descending=True).to_dicts()}"
        )
        note(
            "sample: "
            + str(
                off.select(
                    ["subscription_tier", "listen_seconds", "estimated_revenue_usd", "expected"]
                )
                .head(4)
                .to_dicts()
            )
        )

    section("6. MRR ARITHMETIC + EVENT SEMANTICS")
    e = t["fact_subscription_event"]
    dmrr = e.with_columns(
        (pl.col("mrr_after_usd") - pl.col("mrr_before_usd") - pl.col("mrr_change_usd"))
        .abs()
        .alias("d")
    )
    n_bad = dmrr.filter(pl.col("d") > 1e-9).height
    check(
        "mrr_change_usd == mrr_after - mrr_before",
        n_bad == 0,
        f"{n_bad:,} of {e.height:,} disagree; max deviation {dmrr['d'].max():.6f}",
    )

    price = dict(
        zip(
            t["dim_subscription_plan"]["plan_name"],
            t["dim_subscription_plan"]["monthly_price_usd"],
            strict=False,
        )
    )
    note(f"plan prices: {price}")
    e2 = e.with_columns(pl.col("to_tier").replace_strict(price, default=None).alias("to_price"))
    bad_after = e2.filter((pl.col("to_price") - pl.col("mrr_after_usd")).abs() > 1e-9)
    check(
        "mrr_after_usd == catalogue price of to_tier",
        bad_after.height == 0,
        f"{bad_after.height:,} of {e.height:,} disagree",
    )

    note(
        f"event_type counts: {e.group_by('event_type').len().sort('len', descending=True).to_dicts()}"
    )
    for et, rule, viol in [
        ("upgrade", "mrr_change > 0", pl.col("mrr_change_usd") <= 0),
        ("downgrade", "mrr_change < 0", pl.col("mrr_change_usd") >= 0),
        ("churn", "to_tier == 'Free'", pl.col("to_tier") != "Free"),
        ("retention", "from_tier == to_tier", pl.col("from_tier") != pl.col("to_tier")),
    ]:
        sub = e.filter(pl.col("event_type") == et)
        v = sub.filter(viol).height
        check(f"event '{et}': {rule}", v == 0, f"{v:,} of {sub.height:,} violate")

    sig = e.filter(pl.col("event_type") == "signup")
    check(
        "event 'signup': from_tier is null",
        sig["from_tier"].null_count() == sig.height,
        f"{sig['from_tier'].null_count():,} of {sig.height:,} are null",
    )

    last = (
        e.sort(["user_id", "event_ts", "event_id"])
        .group_by("user_id")
        .agg(pl.col("to_tier").last().alias("last_tier"))
    )
    j5 = t["dim_user"].join(last, on="user_id", how="left")
    no_event = j5.filter(pl.col("last_tier").is_null()).height
    mism5 = j5.filter(
        pl.col("last_tier").is_not_null() & (pl.col("last_tier") != pl.col("subscription_tier"))
    ).height
    check(
        "'GUARANTEED': last event to_tier == dim_user.subscription_tier",
        mism5 == 0 and no_event == 0,
        f"{mism5:,} of {j5.height:,} users disagree; {no_event:,} users have no event at all",
    )

    section("7. CATEGORY DOMAINS - documented value lists")
    for tbl, col, doc in [
        ("dim_user", "gender", {"Male", "Female", "Non-binary", "Prefer not to say"}),
        ("dim_user", "subscription_tier", {"Free", "Premium", "Family"}),
        ("dim_subscription_plan", "plan_name", {"Free", "Premium", "Family"}),
        ("fact_listening_session", "subscription_tier", {"Free", "Premium", "Family"}),
        (
            "fact_subscription_event",
            "event_type",
            {"signup", "upgrade", "downgrade", "churn", "retention"},
        ),
        ("fact_subscription_event", "to_tier", {"Free", "Premium", "Family"}),
    ]:
        actual = set(t[tbl][col].drop_nulls().unique().to_list())
        extra, unused = actual - doc, doc - actual
        check(
            f"{tbl}.{col} domain matches the dictionary",
            not extra,
            f"undocumented={sorted(extra) or 'none'}  documented-but-unused={sorted(unused) or 'none'}",
        )

    for tbl, col in [
        ("dim_device", "device_type"),
        ("dim_device", "os_name"),
        ("dim_user", "device_os"),
        ("dim_genre", "genre_name"),
        ("dim_country", "continent"),
        ("dim_country", "region"),
        ("fact_subscription_event", "trigger_context"),
    ]:
        vals = sorted(map(str, t[tbl][col].drop_nulls().unique().to_list()))
        note(f"{tbl}.{col} ({len(vals)}): {vals[:12]}{' ...' if len(vals) > 12 else ''}")

    section("8. DATE COVERAGE + SCOPE")
    dd = t["dim_date"]
    span = pl.date_range(pl.date(2021, 1, 1), pl.date(2024, 12, 31), "1d", eager=True).to_list()
    have = set(dd["full_date"].to_list())
    missing_days = [x for x in span if x not in have]
    check(
        "dim_date covers 2021-01-01..2024-12-31 with no gaps",
        not missing_days,
        f"{len(missing_days)} missing day(s); actual span "
        f"{dd['full_date'].min()} .. {dd['full_date'].max()}",
    )
    wk = (
        dd.with_columns((pl.col("full_date").dt.weekday() >= 6).alias("calc"))
        .filter(pl.col("is_weekend") != pl.col("calc"))
        .height
    )
    check("dim_date.is_weekend is correct", wk == 0, f"{wk} wrong")

    for tbl, col in [
        ("fact_listening_session", "listen_start_ts"),
        ("fact_subscription_event", "event_ts"),
        ("dim_user", "account_created"),
        ("dim_playlist", "created_date"),
        ("bridge_playlist_track", "added_date"),
        ("dim_track", "release_date"),
    ]:
        c = t[tbl][col]
        note(f"{tbl}.{col}: {c.min()} .. {c.max()}")

    section("9. TEMPORAL COHERENCE - does the file respect its own timeline?")
    j6 = f.join(t["dim_user"].select(["user_id", "account_created"]), on="user_id", how="left")
    early = j6.filter(pl.col("listen_start_ts").dt.date() < pl.col("account_created")).height
    check(
        "no session precedes the listener's account_created",
        early == 0,
        f"{early:,} of {f.height:,} sessions ({100 * early / f.height:.2f}%) predate the account",
    )

    j7 = f.join(t["dim_track"].select(["track_id", "release_date"]), on="track_id", how="left")
    pre = j7.filter(pl.col("listen_start_ts").dt.date() < pl.col("release_date")).height
    check(
        "no track is played before its release_date",
        pre == 0,
        f"{pre:,} of {f.height:,} sessions ({100 * pre / f.height:.2f}%) predate release",
    )

    first = (
        e.sort(["user_id", "event_ts", "event_id"])
        .group_by("user_id")
        .agg(pl.col("event_type").first().alias("first_type"))
    )
    ns = first.filter(pl.col("first_type") != "signup").height
    check(
        "signup is each user's first event",
        ns == 0,
        f"{ns:,} of {first.height:,} users begin with something else",
    )

    sd = sig.join(t["dim_user"].select(["user_id", "account_created"]), on="user_id", how="left")
    sdm = sd.filter(pl.col("event_ts") != pl.col("account_created")).height
    check(
        "signup event_ts == dim_user.account_created",
        sdm == 0,
        f"{sdm:,} of {sd.height:,} disagree",
    )

    bd = b.join(
        t["dim_playlist"].select(["playlist_id", "created_date"]), on="playlist_id", how="left"
    )
    bad_add = bd.filter(pl.col("added_date") < pl.col("created_date")).height
    check(
        "no track added to a playlist before the playlist existed",
        bad_add == 0,
        f"{bad_add:,} of {b.height:,} bridge rows predate their playlist",
    )

    section("10. SUMMARY")
    print(f"\n  Claims tested:    {len(CONFIRMED) + len(FAILURES)}")
    print(f"  Confirmed:        {len(CONFIRMED)}")
    print(f"  FALSIFIED:        {len(FAILURES)}")
    if FAILURES:
        print("\n  Falsified claims:")
        for x in FAILURES:
            print(f"    - {x}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
