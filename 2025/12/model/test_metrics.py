"""
Structural assertions on the 2025/12 star schema  (Gate G4).

These assert what the SCHEMA claims. Where a claim in analysis/insights.md depends on a
modelling choice, there is a test pinning the choice, so a future refactor breaks loudly
instead of quietly changing an answer.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl
import pytest
from scipy import stats

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"
TABLES = ["fct_stay", "dim_outcome", "dim_month", "dim_animal", "dim_condition", "dim_dow"]


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    c = duckdb.connect()
    for t in TABLES:
        c.execute(f"create view {t} as select * from '{CURATED / (t + '.parquet')}'")
    return c


@pytest.fixture(scope="module")
def stay() -> pl.DataFrame:
    return pl.read_parquet(CURATED / "fct_stay.parquet")


# ------------------------------------------------------------------ grain and integrity


def test_grain_is_one_row_per_stay(con):
    n, uniq = con.execute("select count(*), count(distinct kennel_id) from fct_stay").fetchone()
    assert n == uniq, "kennel_id is not unique - the fact grain is wrong"


def test_animal_id_is_not_the_key(con):
    """C9 depends on this: repeat visits exist because the animal is not the grain."""
    stays, animals = con.execute(
        "select count(*), count(distinct animal_id) from fct_stay"
    ).fetchone()
    assert stays > animals
    assert con.execute("select count(*) from dim_animal where is_repeat").fetchone()[0] == 1_587


def test_the_extract_only_contains_animals_that_arrived_alive(con):
    """Every denominator in this model means 'arrived alive'. If the extract ever includes
    dead-on-arrival intakes, that changes and build.py raises - this pins the same premise."""
    assert con.execute("select count(distinct intake_is_dead) from fct_stay").fetchone()[0] == 1


# ------------------------------------------------------------------ rule 1: two verdicts


def test_no_stay_is_both_live_and_dead(con):
    assert con.execute("select count(*) from fct_stay where is_live and is_dead").fetchone()[0] == 0


def test_the_file_disagrees_on_exactly_six_outcomes(con):
    """C1. DISPOSAL, TRANSPORT, MISSING, DUPLICATE, NULL and STILL IN SHELTER."""
    rows = [
        r[0]
        for r in con.execute(
            "select outcome from dim_outcome where disagrees order by outcome"
        ).fetchall()
    ]
    assert rows == ["DISPOSAL", "DUPLICATE", "MISSING", "NULL", "STILL IN SHELTER", "TRANSPORT"]


def test_disposal_is_dead_and_the_file_says_alive(con):
    """The single most indefensible row: the source's own outcome_is_dead flags these 132
    stays as dead while was_outcome_alive counts them as live releases."""
    live, filed, dead_flag, n = con.execute(
        "select is_live, file_says_alive, file_says_dead, stays"
        " from dim_outcome where outcome = 'DISPOSAL'"
    ).fetchone()
    assert n == 132
    assert live is False
    assert filed == 1.0
    assert dead_flag == 1.0


def test_unresolved_stays_are_never_counted_as_live(con):
    assert (
        con.execute("select count(*) from fct_stay where unresolved and is_live").fetchone()[0] == 0
    )
    # ...but the source counts 399 of the 400 that way, which is why the model exists
    assert (
        con.execute(
            "select count(*) from fct_stay where unresolved and was_outcome_alive = 1"
        ).fetchone()[0]
        == 399
    )


def test_the_corrected_rate_is_lower_than_the_filed_one(con):
    corrected, filed = con.execute("""
        select 100.0 * count(*) filter (where is_live)
             / count(*) filter (where is_live or is_dead),
               100.0 * avg(was_outcome_alive)
        from fct_stay
    """).fetchone()
    assert corrected == pytest.approx(78.49, abs=0.01)
    assert filed == pytest.approx(79.26, abs=0.01)
    assert filed > corrected


# ------------------------------------------------------------------ rule 2: censorship


def test_censored_months_are_a_contiguous_tail(con):
    """A single cut-off is only defensible if censorship is a tail. build.py raises otherwise;
    this pins the resulting cut-off so a chart cannot silently extend past it."""
    last = con.execute("select max(intake_month) from dim_month where not is_censored").fetchone()[
        0
    ]
    assert str(last) == "2025-06-01"
    assert con.execute("select count(*) from dim_month where is_censored").fetchone()[0] == 6


def test_the_worst_month_is_nearly_half_unresolved(con):
    worst = con.execute("select 100.0 * max(pct_unresolved) from dim_month").fetchone()[0]
    assert worst == pytest.approx(45.12, abs=0.01)


def test_the_2025_gap_is_five_times_the_pooled_gap(con):
    pooled, y2025 = con.execute("""
        select (select 100.0 * avg(was_outcome_alive)
                     - 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead) from fct_stay),
               (select 100.0 * avg(was_outcome_alive)
                     - 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead)
                from fct_stay where intake_year = 2025)
    """).fetchone()
    assert y2025 > 4 * pooled


# ------------------------------------------------------------------ rule 3: age


def test_more_than_a_third_of_dobs_are_estimated(con):
    share = con.execute("""
        select 100.0 * count(*) filter (where dob_estimated)
             / count(*) filter (where dob is not null) from fct_stay
    """).fetchone()[0]
    assert share == pytest.approx(37.77, abs=0.01)


def test_estimated_dobs_are_not_chance(stay):
    """17,301 DOBs share the intake date's month and day. Under independence the expected
    count is n/365.25."""
    dob = stay.filter(pl.col("dob").is_not_null())
    observed = int(dob["dob_estimated"].sum())
    expected = dob.height / 365.25
    assert observed > 100 * expected
    # and the implied ages are whole years, not a smooth distribution
    # Whole calendar years are NOT whole multiples of 365.25 days - two years is 730 or 731
    # depending on leap years - so this needs a tolerance rather than equality. An earlier
    # version of this test compared to round() exactly and failed on correct data.
    ages = dob.filter("dob_estimated").select(
        ((pl.col("intake_date") - pl.col("dob")).dt.total_days() / 365.25).alias("y")
    )["y"]
    whole = float(((ages - ages.round(0)).abs() < 0.01).mean())
    assert whole > 0.95, "estimated ages should land on whole calendar years"


def test_the_senior_penalty_mostly_disappears_on_trusted_dobs(con):
    """C3, the month's largest analytical finding. Pinned so the wrong version cannot return."""
    all_dob, trusted = con.execute("""
        select (select 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead)
                from fct_stay where age_years >= 12),
               (select 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead)
                from fct_stay where age_trusted >= 12)
    """).fetchone()
    assert all_dob == pytest.approx(77.46, abs=0.01)
    assert trusted == pytest.approx(87.73, abs=0.01)
    assert trusted - all_dob > 10


# ------------------------------------------------------------------ the weekday claim


def test_the_weekday_spike_is_the_public_counter(con):
    """C4. The claim is a CONTRAST, so both halves are asserted."""
    public, officer = con.execute("""
        select (select max(share) - min(share) from dim_dow where channel = 'Public counter'),
               (select max(share) - min(share) from dim_dow where channel = 'Officer-driven')
    """).fetchone()
    assert public == pytest.approx(14.14, abs=0.05)
    assert officer == pytest.approx(3.13, abs=0.05)
    assert public > 4 * officer


def test_seasonality_survives_in_the_officer_series(con):
    """C5 - the control that turns C4 from a guess into a finding. If the summer peak were
    also an opening-hours artefact it would vanish here."""
    peak, trough = con.execute("""
        select max(n), min(n) from (
          select count(*) n from fct_stay where channel = 'Officer-driven'
          group by month(intake_date))
    """).fetchone()
    assert peak / trough > 2.5


# ------------------------------------------------------------------ what is real


def test_condition_beats_species_as_a_predictor(stay):
    """C6. Both are real; condition is stronger, and the model should not imply otherwise."""
    res = stay.filter(pl.col("is_live") | pl.col("is_dead"))

    def cramers_v(col: str) -> float:
        tab = (
            res.group_by(col, "is_live")
            .len()
            .pivot(on="is_live", index=col, values="len")
            .fill_null(0)
        )
        arr = tab.drop(col).to_numpy()
        chi = stats.chi2_contingency(arr)[0]
        return (chi / arr.sum()) ** 0.5

    assert cramers_v("intake_condition") == pytest.approx(0.530, abs=0.01)
    assert cramers_v("animal_type") == pytest.approx(0.382, abs=0.01)
    assert cramers_v("intake_condition") > cramers_v("animal_type")


def test_the_largest_outcome_is_not_adoption(con):
    top = con.execute("select outcome from dim_outcome order by stays desc limit 1").fetchone()[0]
    assert top == "RESCUE"


def test_adoption_is_the_slowest_live_outcome(con):
    """C8. Q12 asks to cut length of stay AND raise save rates; this is why those conflict."""
    rows = con.execute("""
        select outcome, median_los from dim_outcome
        where is_live and stays >= 300 order by median_los desc
    """).fetchall()
    assert rows[0][0] == "ADOPTION"
    adoption = dict(rows)["ADOPTION"]
    assert adoption > 4 * dict(rows)["RESCUE"]


def test_small_species_are_not_rankable(stay):
    """C7 / 2025/11's lesson. AMPHIBIAN has three records; a rate on it is not a rank."""
    small = stay.filter(pl.col("animal_type") == "AMPHIBIAN").height
    assert small < 10


# ------------------------------------------------------------------ the gap, decomposed


def test_the_gap_decomposes_exactly_in_both_orders(con):
    """C1b. The 0.763pp overstatement is TWO corrections - restricting the population to
    live+dead, and un-flagging the 132 DISPOSAL records. The page publishes the split, so the
    split has to be exact and its order-dependence has to be known rather than discovered."""
    gap, den, flag, den_ff, flag_ff = con.execute("""
        select (select 100.0 * avg(was_outcome_alive)
                     - 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead) from fct_stay),
               (select 100.0 * avg(was_outcome_alive) from fct_stay)
             - (select 100.0 * avg(was_outcome_alive) from fct_stay where is_live or is_dead),
               (select 100.0 * avg(was_outcome_alive) from fct_stay where is_live or is_dead)
             - (select 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead) from fct_stay),
               (select 100.0 * count(*) filter (where was_outcome_alive = 1 and not is_dead)
                     / count(*) from fct_stay)
             - (select 100.0 * count(*) filter (where is_live)
                     / count(*) filter (where is_live or is_dead) from fct_stay),
               (select 100.0 * avg(was_outcome_alive) from fct_stay)
             - (select 100.0 * count(*) filter (where was_outcome_alive = 1 and not is_dead)
                     / count(*) from fct_stay)
    """).fetchone()
    assert den + flag == pytest.approx(gap, abs=1e-9)
    assert den_ff + flag_ff == pytest.approx(gap, abs=1e-9)
    # the flag term IS the 132 disposals over whichever denominator is in force
    assert flag == pytest.approx(100.0 * 132 / 51_091, abs=1e-9)
    assert flag_ff == pytest.approx(100.0 * 132 / 52_339, abs=1e-9)
    # the order-dependence is real but small, and the denominator dominates either way
    assert abs(flag - flag_ff) == pytest.approx(0.0062, abs=0.0005)
    assert den > 1.9 * flag and den_ff > 2.0 * flag_ff


def test_the_dob_null_survives_taking_seasonality_seriously(con):
    """C3. A flat 1/365 null flatters the finding, because intakes are seasonal and a
    back-dated DOB inherits that seasonality. The published null is the seasonality-aware one;
    this pins BOTH so a future edit cannot quietly swap back to the more flattering number."""
    n, observed = con.execute("""
        select count(*) filter (where dob is not null),
               count(*) filter (where dob_estimated) from fct_stay
    """).fetchone()
    uniform = n / 365.0
    seasonal = con.execute("""
        with d as (
          select strftime(intake_date, '%m-%d') imd, strftime(dob, '%m-%d') dmd
          from fct_stay where dob is not null),
        pi as (select imd md, count(*)::double / (select count(*) from d) p from d group by imd),
        pd as (select dmd md, count(*)::double / (select count(*) from d where imd <> dmd) p
               from d where imd <> dmd group by dmd)
        select (select count(*) from d) * sum(pi.p * pd.p) from pi join pd using (md)
    """).fetchone()[0]
    assert uniform == pytest.approx(125.5, abs=0.5)
    assert seasonal == pytest.approx(134.4, abs=0.5)
    # seasonality matters - but nowhere near enough to explain the effect
    assert seasonal > uniform
    assert observed / seasonal == pytest.approx(128.7, abs=0.5)
    assert observed / seasonal > 100


def test_the_published_mean_and_median_share_a_population(con):
    """The mean is only a foil for the median if both are over the same rows. An earlier draft
    put an all-stays median beside a live-releases-only mean of 22.5 days, so part of the gap
    between them was the subsetting rather than the skew."""
    mean_all, median_all, mean_live = con.execute("""
        select (select avg(los) from fct_stay where los is not null),
               (select median(los) from fct_stay where los is not null),
               (select avg(los) from fct_stay where los is not null and is_live)
    """).fetchone()
    assert median_all == 5.0
    assert mean_all == pytest.approx(19.27, abs=0.01)
    # the number that must NOT be paired with the all-stays median
    assert mean_live == pytest.approx(22.54, abs=0.01)
    assert mean_all < mean_live
