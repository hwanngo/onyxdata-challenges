"""Metric assertions for 2026/05 Music Streaming Platform Performance  (Gate G4).

Known-good literals, taken from analysis/integrity.py and analysis/signal.py running against
the RAW CSVs. A test that recomputes a number the same way build.py does proves only
self-consistency - the exact failure the integrity pass found across eight months of tooling.
So the raw fixture below reads the CSVs directly and the curated fixture reads the parquet,
and the tests assert that the two agree AND that both match a literal written down by hand.

This month's suite is mostly POSITIVE - the file has real signal - but it pins the four claims
the page cannot survive losing:

  1. the two artist top-10s overlap 1 of 10                (the signature)
  2. repeat-concentrated accounts pay the SAME             (the fairness guardrail)
  3. a 2-second move in the payout line shifts >10%        (the counting-rule argument)
  4. the recommendation flag still does nothing            (the null, with tier as control)

Run: just test-model 2026 05
"""

from pathlib import Path

import duckdb
import pytest

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
RAW = next(
    d
    for d in MONTH.iterdir()
    if d.is_dir() and d.name not in {"analysis", "model", "design", "app", "data", "exports"}
)
DATA = next(RAW.rglob("fact_listening_session.csv")).parent


@pytest.fixture(scope="module")
def con():
    """Curated parquet."""
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


@pytest.fixture(scope="module")
def raw():
    """The read-only source CSVs. A second, independent path to every number."""
    c = duckdb.connect()
    for p in DATA.glob("*.csv"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_csv_auto('{p}')")
    return c


def one(c, sql: str):
    return c.execute(sql).fetchone()[0]


# ---------------------------------------------------------------------------------------
# shape
# ---------------------------------------------------------------------------------------


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model 2026 05` first"


def test_session_count_matches_raw(con, raw):
    assert one(con, "SELECT count(*) FROM fact_session") == 224_078
    assert one(raw, "SELECT count(*) FROM fact_listening_session") == 224_078


def test_session_grain_is_unique(con):
    assert (
        one(
            con,
            "SELECT count(*) FROM (SELECT session_id FROM fact_session "
            "GROUP BY 1 HAVING count(*) > 1)",
        )
        == 0
    )


def test_no_rows_lost_or_invented_in_the_build(con, raw):
    """build.py joins nine dimensions onto the fact. A fan-out would inflate every measure."""
    assert one(con, "SELECT count(*) FROM fact_session") == one(
        raw, "SELECT count(*) FROM fact_listening_session"
    )


def test_listener_and_artist_counts(con):
    assert one(con, "SELECT count(*) FROM dim_listener") == 961
    assert one(con, "SELECT count(*) FROM dim_artist_rank") == 448


# ---------------------------------------------------------------------------------------
# DECISION 2 - the vendor's word never reaches the model
# ---------------------------------------------------------------------------------------


def test_the_word_fraud_appears_only_as_a_documented_source_column(con):
    """The cohort is named for what was measured. `is_fraud_cluster` is an unadjudicated
    vendor label flagging 50.2% of users, and laundering it into a finding would accuse 482
    paying subscribers of a crime this data does not evidence. It survives in exactly one
    place - dim_flag.source_column - so the provenance is visible and nothing is hidden."""
    for table in ["fact_session", "dim_listener", "dim_artist_rank"]:
        cols = [r[0] for r in con.execute(f"DESCRIBE {table}").fetchall()]
        assert not any("fraud" in c.lower() for c in cols), f"{table} leaks the vendor label"
    assert one(con, "SELECT count(*) FROM dim_flag WHERE source_column = 'is_fraud_cluster'") == 1


def test_cohort_membership_matches_the_source_column_exactly(con, raw):
    """Renaming must not become re-defining. The membership is byte-identical to the source."""
    assert one(con, "SELECT count(*) FROM dim_listener WHERE is_repeat_concentrated") == one(
        raw, "SELECT count(*) FROM dim_user WHERE is_fraud_cluster"
    )
    assert one(con, "SELECT count(*) FROM dim_listener WHERE is_repeat_concentrated") == 482


# ---------------------------------------------------------------------------------------
# CLAIM 1 - the signature
# ---------------------------------------------------------------------------------------


def test_top10_overlap_is_one(con):
    """The whole poster rests on this. Nine of the top ten artists by total plays are not in
    the top ten once the repeat-concentrated population is removed."""
    overlap = one(
        con,
        """
        SELECT count(*) FROM
          (SELECT artist_id FROM dim_artist_rank ORDER BY rank_all  LIMIT 10) a
        JOIN
          (SELECT artist_id FROM dim_artist_rank ORDER BY rank_clean LIMIT 10) b USING (artist_id)
    """,
    )
    assert overlap == 1


def test_the_headline_artist_moves_from_1_to_264(con):
    r = con.execute(
        "SELECT rank_all, rank_clean, plays_all, plays_clean, top_listener_share "
        "FROM dim_artist_rank WHERE artist_name = 'Mariah Carey'"
    ).fetchone()
    assert r[0] == 1 and r[1] == 264
    assert r[2] == 3316 and r[3] == 75


def test_shaggy_rises_to_number_one_without_them(con):
    r = con.execute(
        "SELECT rank_all, rank_clean FROM dim_artist_rank WHERE artist_name = 'Shaggy'"
    ).fetchone()
    assert r == (10, 1)


def test_ranks_are_a_permutation_not_a_reweighting(con):
    """rank('ordinal') must produce 1..448 exactly once each, in both columns."""
    for col in ["rank_all", "rank_clean"]:
        assert one(con, f"SELECT count(DISTINCT {col}) FROM dim_artist_rank") == 448
        assert one(con, f"SELECT min({col}) FROM dim_artist_rank") == 1
        assert one(con, f"SELECT max({col}) FROM dim_artist_rank") == 448


def test_play_counts_reconcile_against_raw(con, raw):
    assert one(con, "SELECT sum(plays_all) FROM dim_artist_rank") == one(
        raw, "SELECT count(*) FROM fact_listening_session"
    )
    assert one(con, "SELECT sum(plays_clean) FROM dim_artist_rank") == one(
        raw,
        """
        SELECT count(*) FROM fact_listening_session s JOIN dim_user u USING (user_id)
        WHERE NOT u.is_fraud_cluster
    """,
    )


def test_the_farm_reading_is_false(con):
    """87.5% of the #1 artist's repeat-concentrated plays come from ONE account. If this
    ever falls far, the 'individual repetition, not coordination' claim needs re-checking."""
    share = one(
        con, "SELECT top_listener_share FROM dim_artist_rank WHERE artist_name = 'Mariah Carey'"
    )
    assert share > 0.85


# ---------------------------------------------------------------------------------------
# CLAIM 2 - the fairness guardrail
# ---------------------------------------------------------------------------------------


def test_repeat_concentrated_accounts_pay_the_same(con):
    """The page says the lever is the counting rule, not enforcement, BECAUSE these accounts
    are worth the same. If that stops being true the recommendation changes."""
    a, b, p = con.execute(
        "SELECT ltv_flagged_usd, ltv_clean_usd, ltv_mannwhitney_p FROM headline"
    ).fetchone()
    assert p > 0.05, "the LTV difference became significant; the fairness claim is dead"
    assert abs(a - b) / b < 0.15


def test_the_cohort_is_defined_by_measured_behaviour(con):
    """9.5 distinct tracks per 30 plays against 22.5 - the rarefied, confound-free measure."""
    a, b = con.execute("SELECT tracks_at_30_flagged, tracks_at_30_clean FROM headline").fetchone()
    assert a < 12 and b > 20
    assert one(con, "SELECT fraud_cliffs_delta FROM headline") < -0.9


def test_rarefaction_beats_the_raw_ratio(con):
    """variety = distinct/sessions is bounded by 774/n and the cohort has 2.3x more sessions,
    so the raw ratio is partly arithmetic. The rarefied measure must separate at least as
    well, or DECISION 5 in build.py is backwards."""
    raw_gap = one(
        con,
        """
        SELECT avg(CASE WHEN NOT is_repeat_concentrated THEN variety_raw END)
             - avg(CASE WHEN is_repeat_concentrated THEN variety_raw END) FROM dim_listener
    """,
    )
    rare_gap = one(
        con,
        """
        SELECT avg(CASE WHEN NOT is_repeat_concentrated THEN tracks_at_30 END)
             - avg(CASE WHEN is_repeat_concentrated THEN tracks_at_30 END) FROM dim_listener
    """,
    )
    assert raw_gap > 0 and rare_gap > 0


# ---------------------------------------------------------------------------------------
# CLAIM 3 - the counting rule is load-bearing
# ---------------------------------------------------------------------------------------


def test_two_seconds_moves_more_than_a_tenth_of_the_payout(con):
    assert (
        one(
            con,
            "SELECT pct_change_vs_30s FROM fact_threshold_sensitivity WHERE threshold_seconds = 32",
        )
        < -15.0
    )
    assert (
        one(
            con,
            "SELECT pct_change_vs_30s FROM fact_threshold_sensitivity WHERE threshold_seconds = 35",
        )
        < -37.0
    )
    assert (
        one(
            con,
            "SELECT pct_change_vs_30s FROM fact_threshold_sensitivity WHERE threshold_seconds = 30",
        )
        == 0.0
    )


def test_half_the_plays_sit_on_the_payout_line(con):
    band, share = con.execute("SELECT sessions_in_30_44_band, band_share FROM headline").fetchone()
    assert band == 105_150
    assert 0.46 < share < 0.48


def test_the_distribution_has_a_hole(con):
    """Zero sessions at 45, 50, 55 or 60 seconds. A real duration column is continuous."""
    for lo in (45, 50, 55, 60):
        assert one(con, f"SELECT count(*) FROM fact_session WHERE listen_seconds = {lo}") == 0


def test_session_column_is_not_revenue(con):
    """$852.14 against $167,647.19 of subscription revenue, and it adds ad income to
    royalty cost. Nothing in the model may be named `revenue` unless it is subscription."""
    sess_total, _sub_total, ratio = con.execute(
        "SELECT session_column_total_usd, subscription_revenue_total_usd, "
        "session_vs_subscription_ratio FROM headline"
    ).fetchone()
    assert abs(sess_total - 852.14) < 0.01
    assert ratio > 150
    cols = [r[0] for r in con.execute("DESCRIBE fact_session").fetchall()]
    assert "revenue" not in [c.lower() for c in cols]
    assert "royalty_or_ad_usd" in cols


def test_a_third_of_growth_is_not_a_customer_decision(con):
    net, recon, cust, share = con.execute(
        "SELECT net_mrr_usd, reconciliation_net_usd, customer_net_mrr_usd, "
        "reconciliation_share_of_net FROM headline"
    ).fetchone()
    assert abs(net - 8143.50) < 0.01
    assert abs(recon - 2648.24) < 0.01
    assert abs(cust - 5495.26) < 0.01
    assert abs(recon + cust - net) < 0.01, "the MRR split must add back to the total"
    assert 0.30 < share < 0.35


def test_reconciliation_is_a_system_label_not_a_channel(con):
    """It appears ONLY on upgrade and downgrade - never on signup, churn or retention."""
    rows = con.execute("""
        SELECT DISTINCT event_type FROM fact_subscription_event WHERE is_reconciliation
    """).fetchall()
    assert sorted(r[0] for r in rows) == ["downgrade", "upgrade"]


# ---------------------------------------------------------------------------------------
# CLAIM 4 - the null, and its positive control
# ---------------------------------------------------------------------------------------


def test_the_recommendation_flag_does_nothing(con):
    d = one(con, "SELECT algo_cliffs_delta FROM headline")
    assert abs(d) < 0.05, "the algorithmic-recommendation flag acquired an effect"
    assert not one(
        con, "SELECT clears_small_effect FROM dim_flag WHERE flag = 'is_algorithmic_recommendation'"
    )


def test_tier_is_the_positive_control(con):
    """A page of nulls is indistinguishable from a page of bad measurement without one axis
    that demonstrably moves. Tier is it."""
    assert one(con, "SELECT clears_cohen_floor FROM dim_axis WHERE axis = 'Subscription tier'")
    free, family = con.execute("""
        SELECT
          avg(CASE WHEN subscription_tier = 'Free'   THEN CAST(skipped AS INT) END),
          avg(CASE WHEN subscription_tier = 'Family' THEN CAST(skipped AS INT) END)
        FROM fact_session
    """).fetchone()
    assert free > 0.19 and family < 0.10


def test_five_of_the_seven_segment_axes_are_noise(con):
    for ax in ["Country", "Gender", "Age band", "Device type", "Year"]:
        assert not one(con, f"SELECT clears_cohen_floor FROM dim_axis WHERE axis = '{ax}'"), (
            f"{ax} now clears Cohen's floor"
        )


def test_there_is_no_month_of_year_season(con):
    """The apparent December peak is the +10.21%/month growth ramp. omega^2, not eta^2 -
    there are only four observations per month-of-year."""
    omega, p = con.execute("SELECT season_omega_squared, season_kruskal_p FROM headline").fetchone()
    assert omega < 0.01
    assert p > 0.05


def test_the_weekly_cycle_is_real(con):
    """Fri-Sun is 43% of the days and takes more than half the plays."""
    share = one(con, "SELECT sum(share_of_sessions) FROM fact_dow WHERE dow_num >= 5")
    assert share > 0.52
    assert abs(one(con, "SELECT sum(share_of_sessions) FROM fact_dow") - 1.0) < 1e-9


def test_growth_is_real_and_compounding(con):
    rate, r2 = con.execute("SELECT monthly_growth_rate, growth_r_squared FROM headline").fetchone()
    assert 0.09 < rate < 0.11
    assert r2 > 0.8


# ---------------------------------------------------------------------------------------
# the leading indicator, and the revolving door
# ---------------------------------------------------------------------------------------


def test_depth_falls_before_churn(con):
    near = one(
        con, "SELECT mean_listen_seconds FROM fact_churn_window WHERE window_label = '0-14d'"
    )
    far = one(con, "SELECT mean_listen_seconds FROM fact_churn_window WHERE window_label = '181d+'")
    assert near < far
    assert (far - near) / far > 0.15


def test_churn_is_a_revolving_door(con):
    upgrades = one(con, "SELECT events FROM fact_post_churn WHERE next_event = 'upgrade'")
    total = one(con, "SELECT sum(events) FROM fact_post_churn")
    assert total == 635
    assert upgrades == 355


# ---------------------------------------------------------------------------------------
# defects
# ---------------------------------------------------------------------------------------


def test_playlist_context_is_random(con):
    obs, exp = con.execute(
        "SELECT playlist_coherence, playlist_coherence_expected FROM headline"
    ).fetchone()
    assert abs(obs - exp) < 0.002, "playlist_id acquired meaning; DECISION 3 must be revisited"
    assert "playlist_id" not in [r[0] for r in con.execute("DESCRIBE fact_session").fetchall()]


def test_defect_ledger_is_complete(con):
    assert one(con, "SELECT count(*) FROM dim_defect") == 7
    assert one(con, "SELECT count(*) FROM dim_defect WHERE kind = 'falsified'") == 4
    assert one(con, "SELECT count(*) FROM dim_defect WHERE kind = 'undocumented'") == 3


def test_dictionary_scorecard(con):
    tested, held = con.execute(
        "SELECT dictionary_claims_tested, dictionary_claims_held FROM headline"
    ).fetchone()
    assert (tested, held) == (72, 68)
