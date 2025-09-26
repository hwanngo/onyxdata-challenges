"""Metric assertions for 2025/09 Credit Risk Analytics  (Gate G4).

Known-good values, asserted. These stop a silent regression in build.py from putting a
wrong number on the poster.

The tests that matter most guard the two RULES. They are exact - 2,988 loans, zero
exceptions - and an exact claim is the easiest kind to break silently. Note especially
`test_the_boundary_is_STRICTLY_greater`: an earlier draft of the analysis used >= 0.30 and
turned a deterministic rule into an apparent gradient. That off-by-one-bin error is now a
test rather than a memory.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

EXPECTED_LOANS = 32_581
EXPECTED_DEFAULTS = 7_108
RULE1_N = 2_345  # RENT & loan_percent_income > 0.30
RULE2_N = 741  # grade D-G & DEBTCONSOLIDATION & not OWN
UNION_N = 2_988
UNION_PRINCIPAL = 41_607_350


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    c.execute("""
        CREATE VIEW book AS
        SELECT f.*, g.loan_grade, i.loan_intent, h.person_home_ownership AS home
        FROM fct_loan f
          JOIN dim_grade g  USING (grade_key)
          JOIN dim_intent i USING (intent_key)
          JOIN dim_home h   USING (home_key)
    """)
    return c


def scalar(con, sql):
    return con.execute(sql).fetchone()[0]


RULE1 = "home = 'RENT' AND loan_percent_income > 0.30"
RULE2 = "loan_grade IN ('D','E','F','G') AND loan_intent = 'DEBTCONSOLIDATION' AND home <> 'OWN'"
UNION = f"(({RULE1}) OR ({RULE2}))"


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model` first"


# ---------------------------------------------------------------------------------------
# Grain and keys
# ---------------------------------------------------------------------------------------


def test_grain_is_one_row_per_loan(con):
    assert scalar(con, "select count(*) from fct_loan") == EXPECTED_LOANS
    assert scalar(con, "select count(distinct client_ID) from fct_loan") == EXPECTED_LOANS


def test_client_id_IS_unique_this_month(con):
    """Standing scoreboard: NOT unique in May or June, unique in July, ABSENT in August."""
    assert scalar(con, "select count(distinct client_ID) from fct_loan") == EXPECTED_LOANS


def test_star_join_does_not_fan_out(con):
    assert scalar(con, "select count(*) from book") == EXPECTED_LOANS


@pytest.mark.parametrize(
    "fk,dim",
    [
        ("grade_key", "dim_grade"),
        ("intent_key", "dim_intent"),
        ("home_key", "dim_home"),
        ("gender_key", "dim_gender"),
        ("education_key", "dim_education"),
        ("employment_key", "dim_employment"),
        ("geo_key", "dim_geo"),
    ],
)
def test_no_orphan_foreign_keys(con, fk, dim):
    assert (
        scalar(
            con,
            f"select count(*) from fct_loan f left join {dim} d using ({fk}) where d.{fk} is null",
        )
        == 0
    )


def test_totals(con):
    assert scalar(con, "select sum(loan_status) from fct_loan") == EXPECTED_DEFAULTS
    assert scalar(con, "select round(100.0*avg(loan_status), 2) from fct_loan") == 21.82


# ---------------------------------------------------------------------------------------
# THE RULES - exact, and therefore easy to break silently
# ---------------------------------------------------------------------------------------


def test_rule1_renters_above_30pct(con):
    n, d = con.execute(f"select count(*), sum(loan_status) from book where {RULE1}").fetchone()
    assert n == RULE1_N
    assert d == RULE1_N, f"{n - d} renter loans above the line did NOT default"


def test_rule2_subprime_debt_consolidation(con):
    n, d = con.execute(f"select count(*), sum(loan_status) from book where {RULE2}").fetchone()
    assert n == RULE2_N
    assert d == RULE2_N


def test_union_has_zero_exceptions(con):
    n, d, p = con.execute(
        f"select count(*), sum(loan_status), sum(loan_amnt) from book where {UNION}"
    ).fetchone()
    assert n == UNION_N
    assert n - d == 0, f"{n - d} exceptions appeared - the rules are no longer exact"
    assert p == UNION_PRINCIPAL


def test_union_carries_42pct_of_all_losses(con):
    share = scalar(
        con,
        f"""
        select 100.0 * sum(case when {UNION} then loan_status else 0 end) / sum(loan_status)
        from book
    """,
    )
    assert share == pytest.approx(42.04, abs=0.05)


def test_the_boundary_is_STRICTLY_greater(con):
    """The off-by-one-bin error, as a test.

    At exactly 0.30 renters default at 28.5%; past it, at 100%. An earlier draft of the
    analysis used >= 0.30, swept 284 loans with a 28.5% rate into the group, and reported
    a "steep probabilistic structure" with 203 apparent exceptions. There are none.
    """
    at = con.execute(
        "select count(*), 100.0*avg(loan_status) from book "
        "where home = 'RENT' and loan_percent_income = 0.30"
    ).fetchone()
    assert at[0] == 284
    assert 25 < at[1] < 32, f"the 0.30 bin moved to {at[1]:.1f}%"

    ge = con.execute(
        "select count(*), count(*) filter (where loan_status = 0) from book "
        "where home = 'RENT' and loan_percent_income >= 0.30"
    ).fetchone()
    assert ge[1] == 203, "the >= boundary should still show exactly 203 non-defaulters"
    assert ge[1] > 0, "and every one of them sits AT 0.30, not above it"


def test_the_wall_is_tenure_specific(con):
    """Mortgage-holders and owners cross the same line and do not move."""
    rows = dict(
        con.execute("""
        select home, 100.0*avg(loan_status) from book
        where loan_percent_income > 0.30 group by 1
    """).fetchall()
    )
    assert rows["RENT"] == 100.0
    assert rows["MORTGAGE"] < 30, (
        f"mortgage-holders above the line moved to {rows['MORTGAGE']:.1f}%"
    )
    assert rows["OWN"] < 30


def test_the_wall_is_not_priced(con):
    below, above = con.execute("""
        select
          avg(loan_int_rate) filter (where loan_percent_income between 0.20 and 0.30),
          avg(loan_int_rate) filter (where loan_percent_income > 0.30)
        from book where home = 'RENT'
    """).fetchone()
    gap_bp = (above - below) * 100
    assert 0 < gap_bp < 30, f"the price gap moved to {gap_bp:.0f} bp"


def test_grade_A_renters_above_the_line(con):
    n, rate, dflt = con.execute(f"""
        select count(*), avg(loan_int_rate), 100.0*avg(loan_status) from book
        where loan_grade = 'A' and {RULE1}
    """).fetchone()
    assert n == 496
    assert dflt == 100.0
    assert rate == pytest.approx(7.53, abs=0.01), "the bank's best rate, on certain defaults"


# ---------------------------------------------------------------------------------------
# CONTAMINATION - the rules re-order the brief's own answers
# ---------------------------------------------------------------------------------------


def test_debt_consolidation_flips_from_riskiest_to_second_safest(con):
    raw = con.execute("""
        select loan_intent, 100.0*avg(loan_status) r from book group by 1 order by r desc
    """).fetchall()
    clean = con.execute(f"""
        select loan_intent, 100.0*avg(loan_status) r from book where not {UNION}
        group by 1 order by r desc
    """).fetchall()
    assert raw[0][0] == "DEBTCONSOLIDATION", "it is no longer the riskiest on the raw book"
    clean_names = [c[0] for c in clean]
    assert clean_names.index("DEBTCONSOLIDATION") == 4, "it should fall to 5th of 6 (2nd safest)"
    assert clean[clean_names.index("DEBTCONSOLIDATION")][1] == pytest.approx(9.97, abs=0.05)


def test_grade_D_is_partly_rule_composition(con):
    raw = scalar(con, "select 100.0*avg(loan_status) from book where loan_grade = 'D'")
    clean = scalar(
        con, f"select 100.0*avg(loan_status) from book where loan_grade='D' and not {UNION}"
    )
    assert raw == pytest.approx(59.05, abs=0.05)
    assert clean == pytest.approx(46.33, abs=0.05)
    assert clean < raw, "publishing 59.05% as a risk gradient is the trap this guards"


# ---------------------------------------------------------------------------------------
# THE TWO HALVES - provenance carried as data
# ---------------------------------------------------------------------------------------


def test_dim_column_splits_the_file(con):
    rows = dict(
        con.execute("""
        select block, median(effect_on_default) from dim_column group by 1
    """).fetchall()
    )
    assert rows["ORIGINAL"] > 10 * rows["APPENDED"], (
        f"the blocks converged: {rows['ORIGINAL']:.4f} vs {rows['APPENDED']:.4f}"
    )


def test_only_derived_appended_columns_predict_anything(con):
    names = {
        r[0]
        for r in con.execute("""
        select column_name from dim_column where block='APPENDED' and clears_bonferroni
    """).fetchall()
    }
    assert names <= {"loan_to_income_ratio", "debt_to_income_ratio", "other_debt"}


def test_appended_block_has_no_nulls(con):
    assert scalar(con, "select sum(null_count) from dim_column where block='APPENDED'") == 0
    assert scalar(con, "select sum(null_count) from dim_column where block='ORIGINAL'") == 4011


def test_REJECTED_prior_default_is_grade_composition(con):
    """Guards a refuted contrast. cb_person_default_on_file shows a 2.06x CRUDE lift, but
    grades A and B contain ZERO prior defaulters - it is an input to the grade."""
    ab = scalar(
        con,
        """
        select count(*) from book
        where loan_grade in ('A','B') and cb_person_default_on_file = 'Y'
    """,
    )
    assert ab == 0, "prior defaulters appeared in grades A/B - recheck check 9"
    worst = max(
        abs(y - n)
        for n, y in con.execute("""
            select 100.0*avg(loan_status) filter (where cb_person_default_on_file='N'),
                   100.0*avg(loan_status) filter (where cb_person_default_on_file='Y')
            from book where loan_grade in ('C','D','E','F') group by loan_grade
        """).fetchall()
    )
    assert worst < 5, f"within-grade difference grew to {worst:.2f}pp"


def test_the_two_unemployed_MEANS_are_not_interchangeable(con):
    """Guards the pairing the integrity pass caught.

    "1,421 of 1,635 'Unemployed' applicants report a current job averaging 4.73 years"
    pairs a count over the 1,421 with a mean over all 1,635 - which includes 214 who
    correctly report no job at all and drag the mean down. The page now quotes 5.44 years
    against the 1,421, and names 4.73 separately as the all-reporters figure.
    """
    n_reported, n_working, n_zero, m_reported, m_working = con.execute("""
        select count(*) filter (where person_emp_length is not null),
               count(*) filter (where person_emp_length > 0),
               count(*) filter (where person_emp_length = 0),
               avg(person_emp_length),
               avg(person_emp_length) filter (where person_emp_length > 0)
        from fct_loan f join dim_employment e using (employment_key)
        where e.employment_type = 'Unemployed'
    """).fetchone()
    assert (n_reported, n_working, n_zero) == (1635, 1421, 214)
    assert n_working + n_zero == n_reported
    assert m_reported == pytest.approx(4.7297, abs=0.0005)
    assert m_working == pytest.approx(5.4419, abs=0.0005)
    assert m_working > m_reported, "the zeros must still be dragging the all-reporters mean"


def test_rule1_is_NOT_exact_on_the_full_precision_ratio(con):
    """The 100.0000% label is downstream of the source's 2-decimal rounding.

    On loan_to_income_ratio the same condition selects a different, larger set and is no
    longer exact. Publishing the exact rate without this number overstates the rule.
    """
    n, rate = con.execute("""
        select count(*), 100.0*avg(loan_status) from book
        where home = 'RENT' and loan_to_income_ratio > 0.30
    """).fetchone()
    assert n == 2461
    assert rate == pytest.approx(97.07, abs=0.01)
    assert rate < 100.0, "the rounding no longer matters - recheck the forensic claim"


def test_the_price_gap_is_band_dependent_and_the_band_is_published(con):
    """The +14 bp figure is a 20-30% comparison band, and the page says so.

    The audit was right to press on this: the gap is NOT stable across bands. What is
    stable is that it stays within a few tens of basis points of zero while the default
    rate steps from ~26% to 100% - so a tighter band strengthens the finding rather than
    weakening it. This test pins the published band and the direction of the sensitivity.
    """

    def gap(lo):
        below, above = con.execute(f"""
            select
              avg(loan_int_rate) filter (where loan_percent_income between {lo} and 0.30),
              avg(loan_int_rate) filter (where loan_percent_income > 0.30)
            from book where home = 'RENT'
        """).fetchone()
        return (above - below) * 100

    assert gap(0.20) == pytest.approx(13.66, abs=0.05), "the published band moved"
    assert abs(gap(0.27)) < 5, "the tightest bands should be near zero, not larger"
    assert all(abs(gap(lo)) < 50 for lo in (0.10, 0.15, 0.20, 0.25, 0.27, 0.28, 0.29)), (
        "price is supposed to be flat across the wall on EVERY band"
    )


def test_missing_employment_length_is_a_risk_signal(con):
    miss, have = con.execute("""
        select 100.0*avg(loan_status) filter (where emp_length_missing),
               100.0*avg(loan_status) filter (where not emp_length_missing)
        from fct_loan
    """).fetchone()
    assert miss == pytest.approx(31.51, abs=0.05)
    assert miss > have * 1.3, "the null stopped carrying signal - revisit assumptions A-5"
    assert scalar(con, "select count(*) from fct_loan where emp_length_missing") == 895
