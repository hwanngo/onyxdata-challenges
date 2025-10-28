"""Metric assertions for 2025/10 Consumer Financial Complaints  (Gate G4).

Known-good values, asserted. These stop a silent regression in build.py from putting a
wrong number on the poster.

The two that matter most are `test_timeliness_denominator` and
`test_final_month_is_flagged_partial`. Both guard errors I actually made: I published 93.77%
timeliness by counting in-progress complaints as untimely, and a trend line that includes the
truncated final month turns a rising series into a collapse.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

N_COMPLAINTS = 62_516
N_COMPANIES = 1_081
N_IN_PROGRESS = 1_494
N_RESOLVED = 61_022
N_MONTHS = 76


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


def scalar(con, sql):
    return con.execute(sql).fetchone()[0]


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model` first"


# ---------------------------------------------------------------------------------------
# Grain and the star
# ---------------------------------------------------------------------------------------


def test_grain(con):
    assert scalar(con, "select count(*) from fct_complaint") == N_COMPLAINTS
    assert scalar(con, "select count(distinct complaint_id) from fct_complaint") == N_COMPLAINTS
    assert scalar(con, "select count(*) from dim_company") == N_COMPANIES


def test_no_orphans_either_direction(con):
    assert (
        scalar(
            con,
            """
        select count(*) from fct_complaint f
        left join dim_company d using (company_id) where d.company_id is null
    """,
        )
        == 0
    )
    assert (
        scalar(
            con,
            """
        select count(*) from dim_company d
        where not exists (select 1 from fct_complaint f where f.company_id = d.company_id)
    """,
        )
        == 0
    )


def test_company_complaint_counts_reconcile(con):
    """The dimension's shipped Complaint_Count must equal the fact. It does."""
    assert (
        scalar(
            con,
            """
        select count(*) from (
          select d.company_id from dim_company d
          join (select company_id, count(*) n from fct_complaint group by 1) a
            using (company_id)
          where d.complaints <> a.n
        )
    """,
        )
        == 0
    )
    assert scalar(con, "select sum(complaints) from dim_company") == N_COMPLAINTS


# ---------------------------------------------------------------------------------------
# THE DENOMINATOR - an error I actually published
# ---------------------------------------------------------------------------------------


def test_timeliness_denominator(con):
    """96.06% among resolved, not 93.77% over everything.

    `is_resolved` is false on exactly the in-progress complaints. A complaint still in
    progress has not failed to be timely; it has not yet been judged.
    """
    total, resolved, inprog = con.execute("""
        select count(*), count(*) filter (where is_resolved),
               count(*) filter (where not is_resolved)
        from fct_complaint
    """).fetchone()
    assert total == N_COMPLAINTS
    assert resolved == N_RESOLVED
    assert inprog == N_IN_PROGRESS

    right = scalar(
        con,
        """
        select 100.0 * avg(case when is_timely then 1.0 else 0.0 end)
        from fct_complaint where is_resolved
    """,
    )
    wrong = scalar(
        con,
        """
        select 100.0 * avg(case when is_timely then 1.0 else 0.0 end) from fct_complaint
    """,
    )
    assert right == pytest.approx(96.06, abs=0.01)
    assert wrong == pytest.approx(93.77, abs=0.01)
    assert right - wrong == pytest.approx(2.30, abs=0.02)


def test_in_progress_is_exactly_the_unresolved_set(con):
    assert (
        scalar(
            con,
            """
        select count(*) from fct_complaint
        where (outcome = 'In progress') <> (not is_resolved)
    """,
        )
        == 0
    )


# ---------------------------------------------------------------------------------------
# THE PARTIAL MONTH - the other error waiting to happen
# ---------------------------------------------------------------------------------------


def test_final_month_is_flagged_partial(con):
    assert scalar(con, "select count(*) from dim_month") == N_MONTHS
    partial = con.execute(
        "select month, complaints from dim_month where is_partial order by month"
    ).fetchall()
    assert len(partial) == 1, f"expected exactly one partial month, got {len(partial)}"
    assert str(partial[0][0]) == "2023-08-01"

    # the month BEFORE the partial one is the series maximum - which is why plotting the
    # partial month whole makes a rising series look like a collapse
    full = con.execute(
        "select month, complaints from dim_month where not is_partial order by complaints desc"
    ).fetchall()
    assert str(full[0][0]) == "2023-07-01"
    assert full[0][1] > partial[0][1] * 2


# ---------------------------------------------------------------------------------------
# THE THESIS - the company side carries no information
# ---------------------------------------------------------------------------------------


def test_shipped_kpi_is_the_size_ranking_inverted(con):
    """corr(kpi_rank, share_rank) is the whole Q6 finding."""
    rho = scalar(con, "select corr(kpi_rank, share_rank) from dim_company")
    assert rho > 0.95, f"the KPI/size coupling weakened to {rho:.4f}"


def test_complaint_volume_does_not_vary_by_size(con):
    rows = dict(
        con.execute("select size_tier, avg(complaints) from dim_company group by 1").fetchall()
    )
    assert set(rows) == {"Large", "Medium", "Small"}
    lo, hi = min(rows.values()), max(rows.values())
    assert hi - lo < 2.0, f"complaint volume now differs by {hi - lo:.1f} across tiers"


def test_the_kpi_varies_enormously_across_the_same_tiers(con):
    rows = dict(
        con.execute(
            "select size_tier, avg(kpi_per_1pct_share) from dim_company group by 1"
        ).fetchall()
    )
    assert rows["Small"] / rows["Large"] > 5, "the KPI no longer explodes for small firms"


def test_all_top_kpi_companies_are_small(con):
    tiers = [
        r[0]
        for r in con.execute("""
        select size_tier from dim_company order by kpi_per_1pct_share desc limit 10
    """).fetchall()
    ]
    assert set(tiers) == {"Small"}, f"the top-10 by shipped KPI now includes {set(tiers)}"


def test_response_time_is_a_uniform_draw(con):
    lo, hi, mean = con.execute("""
        select min(response_days), max(response_days), avg(response_days) from fct_complaint
    """).fetchone()
    assert (lo, hi) == (0, 30)
    # U(0,30) has mean 15.0
    assert mean == pytest.approx(15.0, abs=0.15), f"mean drifted to {mean:.3f}"


def test_timeliness_is_independent_of_response_time(con):
    y, n = con.execute("""
        select avg(response_days) filter (where is_timely),
               avg(response_days) filter (where not is_timely)
        from fct_complaint where is_resolved
    """).fetchone()
    assert abs(y - n) < 0.5, (
        f"timely responses now take {y:.2f} days vs {n:.2f} for untimely - "
        "`Timely response?` may have become a measurement of speed"
    )


# ---------------------------------------------------------------------------------------
# WHAT IS REAL - the consumer side
# ---------------------------------------------------------------------------------------


def test_volume_trend_is_real_and_large(con):
    first, last = con.execute("""
        select
          (select avg(complaints) from (select complaints from dim_month
             where not is_partial order by month limit 12)),
          (select avg(complaints) from (select complaints from dim_month
             where not is_partial order by month desc limit 12))
    """).fetchone()
    assert last > first * 1.4, f"the trend flattened: {first:.0f} -> {last:.0f}"


def test_product_concentration(con):
    top2 = scalar(
        con,
        """
        select 100.0 * sum(complaints) / (select sum(complaints) from dim_product)
        from (select complaints from dim_product order by complaints desc limit 2)
    """,
    )
    assert top2 == pytest.approx(65.6, abs=0.2)


# ---------------------------------------------------------------------------------------
# THE SIGNATURE CHART - exhaustive, and the verdict is the Bonferroni column
#
# The chart used to plot fourteen hand-picked tests under the caption "every association
# test in the file". These assertions make the exhaustiveness a build failure rather than
# a wording choice, and pin the three counts the caption states.
# ---------------------------------------------------------------------------------------

N_CHI_COLS = 12
N_CHI_TESTS = N_CHI_COLS + N_CHI_COLS * (N_CHI_COLS - 1) // 2  # 12 + 66 = 78


def test_chi_grid_is_the_complete_cross_product(con):
    assert scalar(con, "select count(*) from dim_chitest") == N_CHI_TESTS
    assert scalar(con, "select count(*) from dim_chitest where side = 'company'") == N_CHI_COLS
    assert scalar(con, "select count(distinct label) from dim_chitest") == N_CHI_TESTS


def test_no_company_test_carries_signal(con):
    """The load-bearing half of the thesis, as an assertion."""
    n_sig, lo, hi, min_p = con.execute("""
        select count(*) filter (where significant), min(ratio), max(ratio), min(p)
        from dim_chitest where side = 'company'
    """).fetchone()
    assert n_sig == 0, f"{n_sig} company tests now clear Bonferroni"
    assert 0.9 < lo < hi < 1.1, f"company chi2/df drifted to {lo:.4f}-{hi:.4f}"
    assert min_p > 0.25, f"strongest company evidence is now p={min_p:.4f}"


def test_every_structural_consumer_pair_carries_signal(con):
    n, n_sig = con.execute("""
        select count(*), count(*) filter (where significant)
        from dim_chitest where family = 'structural'
    """).fetchone()
    assert n == 45, f"the structural family is {n} pairs, expected 45"
    assert n_sig == n, f"only {n_sig} of {n} structural pairs clear Bonferroni"
    # ...and every failure on the consumer side is a weekday/timeliness pair, where
    # independence is what real data should show.
    assert (
        scalar(
            con,
            """
        select count(*) from dim_chitest
        where side = 'consumer' and not significant and family <> 'calendrical'
    """,
        )
        == 0
    )


def test_the_two_clouds_nearly_touch(con):
    """The old caption said 'the two groups do not overlap'. On the full grid they very
    nearly do, and the page now says so."""
    closest = scalar(
        con,
        """
        select (select min(ratio) from dim_chitest where side = 'consumer')
             / (select max(ratio) from dim_chitest where side = 'company')
    """,
    )
    assert closest == pytest.approx(1.15, abs=0.02), (
        f"closest approach moved to {closest:.4f} - the figure-note quotes it"
    )
    assert closest < 2.0, "if this ever exceeded 2 the honest caption would be too weak"


def test_chi_squared_over_df_is_not_an_effect_size(con):
    """Why the verdict is the Bonferroni column and not the height on the chart."""
    weaker = scalar(
        con,
        """
        select count(*) from dim_chitest
        where side = 'consumer'
          and "cramersV" < (select min("cramersV") from dim_chitest where side = 'company')
    """,
    )
    assert weaker > 30, (
        f"only {weaker} consumer pairs are weaker than every company test on Cramér's V - "
        "the figure-note's disclosure would need rewording"
    )


def test_definitional_pairs_are_flagged(con):
    """Five exact functional dependencies plus product x issue. A tautology is not a
    finding, and product x issue used to set the headline maximum."""
    rows = con.execute("""
        select label, "cramersV" from dim_chitest where definitional order by "cramersV"
    """).fetchall()
    assert len(rows) == 6, f"{len(rows)} definitional pairs, expected 6"
    assert rows[0][0] == "product × issue"
    assert rows[0][1] == pytest.approx(0.9467, abs=0.001)
    assert all(v == pytest.approx(1.0, abs=1e-9) for _, v in rows[1:])


# ---------------------------------------------------------------------------------------
# RIGHT-CENSORING - the defect .workbench/docs/LEARNINGS.md names for this month
# ---------------------------------------------------------------------------------------


def test_the_year_bars_must_exclude_the_censored_months(con):
    """`OUTCOME_CENSOR_FROM` was defined in data.ts and referenced by nothing, so the 2023
    bar pooled four months that are 0.65/3.63/49.34/81.87% in progress."""
    pooled, censored = con.execute("""
        select
          (select 100.0 * avg(case when is_timely then 1.0 else 0.0 end)
             from fct_complaint where is_resolved and year(month) = 2023),
          (select 100.0 * avg(case when is_timely then 1.0 else 0.0 end)
             from fct_complaint where is_resolved and year(month) = 2023
              and month < date '2023-05-01')
    """).fetchone()
    assert pooled == pytest.approx(93.16, abs=0.01)
    assert censored == pytest.approx(89.52, abs=0.01)
    assert pooled - censored > 3.0, "the censoring bias shrank - recheck the panel's wording"

    # and the mechanism: the censored months resolve at ~100% because only fast cases close
    late = con.execute("""
        select month, 100.0 * avg(case when is_timely then 1.0 else 0.0 end)
        from fct_complaint where is_resolved and month >= date '2023-05-01'
        group by 1 order by month
    """).fetchall()
    assert len(late) == 4
    assert late[-1][1] == pytest.approx(100.0, abs=1e-9)


def test_the_2021_break_is_universal_with_one_exception(con):
    """The claim "universal across product, channel and region" had no query behind it."""
    rows = con.execute("""
        with u as (
          select 'product' as cut, product as k, is_timely, year(month) as yr
          from fct_complaint where is_resolved
          union all select 'channel', channel, is_timely, year(month)
          from fct_complaint where is_resolved
          union all select 'region', region, is_timely, year(month)
          from fct_complaint where is_resolved
        ),
        g as (
          select cut, k,
                 count(*) filter (where yr <= 2020) as n_pre,
                 count(*) filter (where yr = 2021) as n_21,
                 100.0 * avg(case when is_timely then 1.0 else 0.0 end) filter (where yr <= 2020) as pre,
                 100.0 * avg(case when is_timely then 1.0 else 0.0 end) filter (where yr = 2021) as y21
          from u group by 1, 2
        )
        select cut, k, pre - y21 from g where n_pre >= 30 and n_21 >= 30
    """).fetchall()
    assert len(rows) == 16, f"{len(rows)} testable cuts, the figure-note says 16"
    holds = [r for r in rows if r[2] <= 5]
    assert len(holds) == 1 and holds[0][1] == "Mortgage"


# ---------------------------------------------------------------------------------------
# THE REGISTER IS REAL - the three claims the masthead makes
# ---------------------------------------------------------------------------------------


def test_ids_are_sequential_but_not_strictly_ordered(con):
    """'Strict date order' was false: 11.25% of adjacent pairs step backwards."""
    back = scalar(
        con,
        """
        with s as (
          select date_submitted, lag(date_submitted) over (order by complaint_id) as prev
          from fct_complaint
        )
        select 100.0 * count(*) filter (where date_submitted < prev)
                     / count(*) filter (where prev is not null)
        from s
    """,
    )
    assert back == pytest.approx(11.25, abs=0.05)
    assert back > 0, "if this ever reached zero the masthead could say 'strict' again"

    rising = scalar(
        con,
        """
        with m as (select month, median(complaint_id) as mid from fct_complaint group by 1),
             s as (select mid, lag(mid) over (order by month) as prev from m)
        select count(*) from s where prev is not null and mid > prev
    """,
    )
    assert rising == N_MONTHS - 1, "the month-grain claim in the masthead broke"


def test_the_taxonomy_is_hierarchical_not_a_tree(con):
    single, total = con.execute("""
        select count(*) filter (where n = 1), count(*)
        from (select issue, count(distinct product) as n from fct_complaint group by 1)
    """).fetchone()
    assert (single, total) == (63, 76)
    multi_pct = scalar(
        con,
        """
        select 100.0 * count(*) filter (
                 where issue in (select issue from fct_complaint
                                 group by 1 having count(distinct product) > 1))
                     / count(*)
        from fct_complaint
    """,
    )
    assert multi_pct == pytest.approx(20.93, abs=0.01), (
        "a fifth of the register sits under a multi-parent issue - 'a tree' is wrong"
    )


# ---------------------------------------------------------------------------------------
# THE REAL CLOCK - asserted in the UI for three gates and never rendered
# ---------------------------------------------------------------------------------------


def test_the_intake_lag_separates_channels_and_response_time_does_not(con):
    rows = con.execute("""
        select channel, avg(response_days) as days,
               100.0 * avg(case when intake_lag > 0 then 1.0 else 0.0 end) as delayed
        from fct_complaint group by 1 having count(*) >= 50
    """).fetchall()
    assert len(rows) == 6
    days = [r[1] for r in rows]
    delayed = [r[2] for r in rows]
    assert max(days) - min(days) < 1.0, "the fabricated clock stopped being flat"
    assert max(delayed) - min(delayed) > 60, "the real clock stopped separating channels"
    # Email is n=2 and is why the published range used to read 14.82-17.50.
    assert scalar(con, "select count(*) from fct_complaint where channel = 'Email'") == 2


def test_state_ranking_has_no_denominator(con):
    """Guards the honest caveat: nothing in the file can normalise a state ranking."""
    cols = [r[1] for r in con.execute("describe dim_state").fetchall()]
    assert not any(k in c.lower() for c in cols for k in ("pop", "capita", "household")), (
        "a population column appeared - the Q2 caveat can be retired"
    )
    top4 = [
        r[0]
        for r in con.execute(
            "select state from dim_state order by complaints desc limit 4"
        ).fetchall()
    ]
    assert top4 == ["CA", "FL", "TX", "NY"]
