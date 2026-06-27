"""Metric assertions for 2026/06 UK Fintech Neobank  (Gate G4).

Known-good literals, taken from analysis/integrity.py running against the RAW CSVs. A test
that recomputes a number the same way build.py does proves only self-consistency - the exact
failure the integrity pass found across eight months of tooling. So the `raw` fixture reads the
CSVs directly and `con` reads the curated parquet, and the tests assert that the two agree AND
that both match a literal written down by hand.

This month's suite pins four things the page cannot survive losing:

  1. the clustering is perfect - 20 customers x 75, four columns constant within each
  2. device_type is exactly customer_id mod 4
  3. the fee defect DOES vary within a customer (the only positive control)
  4. the fee errors cancel - gross ~£1,174 against a net of ~£0

Run: just test-model 2026 06
"""

from pathlib import Path

import duckdb
import pytest

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
DATA = next(MONTH.rglob("fact_transactions_updated.csv")).parent


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


@pytest.fixture(scope="module")
def raw():
    """The read-only source CSVs. A second, independent path to every number.

    `normalize_names` strips the UTF-8 BOM the three dimension files carry; without it the
    primary key parses as '\\ufeffcustomer_id' and every join below returns nulls silently."""
    c = duckdb.connect()
    for p in DATA.glob("*.csv"):
        c.execute(
            f"CREATE VIEW {p.stem} AS SELECT * FROM read_csv_auto('{p}', normalize_names=true)"
        )
    return c


def one(c, sql: str):
    return c.execute(sql).fetchone()[0]


# ---------------------------------------------------------------------------------------
# shape
# ---------------------------------------------------------------------------------------


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model 2026 06` first"


def test_row_counts_match_raw(con, raw):
    assert one(con, "SELECT count(*) FROM fact_transaction") == 1500
    assert one(raw, "SELECT count(*) FROM fact_transactions_updated") == 1500
    assert one(con, "SELECT count(*) FROM dim_customer_profile") == 20


def test_no_rows_lost_or_invented_in_the_build(con, raw):
    """build.py joins three dimensions onto the fact. A fan-out would inflate every measure."""
    assert one(con, "SELECT count(*) FROM fact_transaction") == one(
        raw, "SELECT count(*) FROM fact_transactions_updated"
    )


def test_transaction_id_is_unique(con):
    assert one(con, "SELECT count(DISTINCT transaction_id) FROM fact_transaction") == 1500


def test_the_bom_is_stripped(con):
    """All three dimension CSVs carry a UTF-8 BOM. If the strip regressed, the primary key
    would be named '\\ufeffcustomer_id' and every join would return nulls without raising."""
    cols = [r[0] for r in con.execute("DESCRIBE dim_customer_profile").fetchall()]
    assert "customer_id" in cols
    assert not any(c.startswith("﻿") for c in cols)
    assert one(con, "SELECT count(*) FROM dim_customer_profile WHERE customer_id IS NULL") == 0


# ---------------------------------------------------------------------------------------
# CLAIM 1 - the clustering
# ---------------------------------------------------------------------------------------


def test_every_customer_has_exactly_75_transactions(con):
    sizes = [
        r[0]
        for r in con.execute(
            "SELECT count(*) FROM fact_transaction GROUP BY customer_id"
        ).fetchall()
    ]
    assert set(sizes) == {75}
    assert len(sizes) == 20


def test_four_columns_never_vary_within_a_customer(con):
    """This is the thesis. If any of these starts varying, the effective n is no longer 20 and
    every interval on the page is wrong."""
    r = con.execute("""
        SELECT max(k_status), max(k_fraud), max(k_reason) FROM (
          SELECT customer_id,
                 count(DISTINCT transaction_status) k_status,
                 count(DISTINCT is_flagged_fraud)   k_fraud,
                 count(DISTINCT failed_reason)      k_reason
          FROM fact_transaction GROUP BY 1)
    """).fetchone()
    assert r == (1, 1, 1)
    # device_type is the fourth, and it is asserted separately because build.py moves it off
    # the fact table entirely (it is a customer attribute, not a transaction one).
    assert (
        one(
            con,
            """
        SELECT max(k) FROM (SELECT customer_id, count(DISTINCT device_type_raw) k
                            FROM dim_customer_profile GROUP BY 1)
    """,
        )
        == 1
    )


def test_the_transaction_rate_equals_the_customer_rate(con):
    """They are identical ONLY because the clustering is perfect. That identity is the finding."""
    rows = con.execute("SELECT measure, transaction_rate, customer_rate FROM fact_rate").fetchall()
    assert rows
    for measure, tx, cust in rows:
        assert abs(tx - cust) < 1e-9, f"{measure} diverged: {tx} vs {cust}"


def test_the_design_effect_is_the_cluster_size(con):
    deff, infl = con.execute("SELECT design_effect, se_inflation FROM headline").fetchone()
    assert deff == 75
    assert abs(infl - 75**0.5) < 1e-9


def test_fraud_is_four_customers_with_a_wide_interval(con):
    tx, cust, lo, hi = con.execute(
        "SELECT fraud_transactions, fraud_customers, fraud_ci_lo, fraud_ci_hi FROM headline"
    ).fetchone()
    assert (tx, cust) == (300, 4)
    assert abs(lo - 0.05733) < 1e-4 and abs(hi - 0.43664) < 1e-4
    assert (hi - lo) > 0.35, "the interval is the whole point; it must stay wide"


def test_seventeen_of_twenty_customers_never_complete_a_transaction(con):
    assert one(con, "SELECT never_completed_customers FROM headline") == 17
    assert one(con, "SELECT completed_customers FROM headline") == 3


# ---------------------------------------------------------------------------------------
# CLAIM 2 - device_type is a row number
# ---------------------------------------------------------------------------------------


def test_device_type_is_customer_id_mod_4(con):
    rows = con.execute("""
        SELECT customer_id_mod_4, device_type_raw, count(*)
        FROM dim_customer_profile GROUP BY 1, 2 ORDER BY 1
    """).fetchall()
    assert len(rows) == 4, "device_type is no longer a clean four-way map"
    assert {r[2] for r in rows} == {5}


def test_device_type_is_not_on_the_transaction_table(con):
    """It is a customer attribute masquerading as a transaction one. Leaving it on the fact
    table invites `GROUP BY device_type` over 1,500 rows."""
    cols = [r[0] for r in con.execute("DESCRIBE fact_transaction").fetchall()]
    assert "device_type" not in cols


# ---------------------------------------------------------------------------------------
# CLAIM 3 + 4 - the fee rule, the only positive control
# ---------------------------------------------------------------------------------------


def test_the_fee_defect_varies_within_a_customer(con):
    """If this stops being true, the fee finding is n=20 like everything else and the page has
    no positive control left."""
    assert one(con, "SELECT count(*) FROM dim_customer_profile WHERE distinct_fees > 1") == 6


def test_725_rows_break_the_fee_rule(con, raw):
    assert one(con, "SELECT fee_rows_wrong FROM headline") == 725
    assert one(con, "SELECT count(*) FROM fact_transaction WHERE fee_verdict != 'correct'") == 725
    # independently, from the raw CSVs
    assert (
        one(
            raw,
            """
        SELECT count(*) FROM fact_transactions_updated f
        JOIN dim_transaction_type t USING (transaction_type_id)
        WHERE abs(f.fee_charged_gbp - t.typical_fee_gbp) > 1e-9
    """,
        )
        == 725
    )


def test_the_fee_errors_cancel(con):
    """The central constructive claim: a net-variance report is structurally blind here."""
    net, under, over, gross = con.execute(
        "SELECT fee_net_variance_gbp, fee_gross_under_gbp, fee_gross_over_gbp, "
        "fee_gross_total_gbp FROM headline"
    ).fetchone()
    assert abs(under - 587.11) < 0.01
    assert abs(over - 587.28) < 0.01
    assert abs(gross - 1174.39) < 0.01
    assert abs(net + 0.17) < 0.01
    assert abs(net) < 0.001 * gross, "the errors no longer cancel"


def test_total_fee_revenue(con, raw):
    charged = one(con, "SELECT fee_charged_gbp FROM headline")
    assert abs(charged - 750.17) < 0.01
    assert (
        abs(charged - one(raw, "SELECT sum(fee_charged_gbp) FROM fact_transactions_updated")) < 0.01
    )


def test_international_transfer_under_collects(con):
    r = con.execute("""
        SELECT sum(charged_gbp), sum(expected_gbp) FROM fact_fee_variance
        WHERE type_name = 'Transfer - International'
    """).fetchone()
    assert abs(r[0] - 100.39) < 0.01 and abs(r[1] - 500.00) < 0.01


def test_zero_fee_types_collect_fees(con):
    """Eight transaction types whose typical fee is GBP0.00 collect money anyway.

    Counted by transaction_type_id, never by name: grouping by name merges the two
    `Transfer - Outbound` ids and reports seven. That is the I7 trap, and it caught the
    first draft of this very test."""
    n, total = con.execute("""
        SELECT count(*), sum(charged_gbp) FROM fact_fee_variance
        WHERE typical_fee_gbp = 0 AND charged_gbp > 0
    """).fetchone()
    assert n == 8
    assert abs(total - 524.40) < 0.01


# ---------------------------------------------------------------------------------------
# the other falsified claims
# ---------------------------------------------------------------------------------------


def test_type_name_is_not_a_key(con):
    assert (
        one(
            con,
            """
        SELECT count(*) FROM (SELECT type_name FROM dim_txn_type
                              GROUP BY 1 HAVING count(*) > 1)
    """,
        )
        == 4
    )
    # and one of them spans two fee regimes
    assert (
        one(
            con,
            """
        SELECT count(*) FROM dim_txn_type WHERE fee_regimes_under_this_name > 1
    """,
        )
        > 0
    )


def test_five_regions_hold_one_customer(con):
    assert one(con, "SELECT single_customer_regions FROM headline") == 5
    assert one(con, "SELECT regions FROM headline") == 10


def test_the_kyc_hypothesis_inverts_and_is_not_significant(con):
    nk, nkf, p = con.execute(
        "SELECT non_kyc_customers, non_kyc_flagged, kyc_fisher_p FROM headline"
    ).fetchone()
    assert (nk, nkf) == (4, 0), "every non-KYC customer had zero fraud flags"
    assert p > 0.5, "the 2x2 must remain uninformative; p=0.54 is the finding"


def test_no_monthly_trend(con):
    p, _r2 = con.execute("SELECT month_trend_p, month_trend_r2 FROM headline").fetchone()
    assert p > 0.05
    assert one(con, "SELECT count(*) FROM fact_month") == 5


def test_every_type_failure_rate_is_a_fraction_of_four(con):
    """All 15 types have exactly 100 transactions and exactly 4 customers, so the failure rate
    is 2/4 or 3/4 and nothing else.

    Grouping by type_name instead returns 0.625 for `ATM Withdrawal` -- the (3+2)/8 of two
    merged ids -- a rate belonging to neither type. That is I7, and it is why fact_type is
    keyed on transaction_type_id."""
    rates = sorted(
        {round(r[0], 4) for r in con.execute("SELECT failure_rate FROM fact_type").fetchall()}
    )
    assert rates == [0.5, 0.75]
    assert {r[0] for r in con.execute("SELECT customers FROM fact_type").fetchall()} == {4}


def test_one_customer_dominates(con):
    v, fl = con.execute(
        "SELECT top_customer_value_share, top_customer_flagged_share FROM headline"
    ).fetchone()
    assert v > 0.55
    assert fl > 0.94


def test_dictionary_scorecard(con):
    tested, false = con.execute("SELECT claims_tested, claims_false FROM headline").fetchone()
    assert tested == 14
    assert false == 11  # 8 FALSE + 2 MISLEADING + 1 UNSUPPORTED
