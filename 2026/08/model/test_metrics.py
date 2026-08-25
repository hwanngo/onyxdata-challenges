"""Metric and domain-contract assertions for 2026/08 (Gate G4)."""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pytest

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
PUBLIC_DATA = MONTH / "app" / "public" / "data"
EXPECTED_TABLES = {
    "dim_channel",
    "dim_claim",
    "dim_connector",
    "dim_contract",
    "dim_control_validation",
    "dim_date",
    "dim_defect",
    "dim_market",
    "dim_status_alignment",
    "dim_worker",
    "fact_exposure_bin",
    "fact_month_end_cashout",
    "fact_transaction",
    "headline",
}


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect()
    for path in CURATED.glob("*.parquet"):
        sql_path = str(path).replace("'", "''")
        connection.execute(
            f"CREATE VIEW \"{path.stem}\" AS SELECT * FROM read_parquet('{sql_path}')"
        )
    return connection


def scalar(con: duckdb.DuckDBPyConnection, sql: str):
    return con.execute(sql).fetchone()[0]


def test_curated_contract_is_complete() -> None:
    assert {path.stem for path in CURATED.glob("*.parquet")} == EXPECTED_TABLES


def test_transaction_grain_and_foreign_keys(con: duckdb.DuckDBPyConnection) -> None:
    assert scalar(con, "SELECT count(*) FROM fact_transaction") == 50_000
    assert scalar(con, "SELECT count(DISTINCT transaction_id) FROM fact_transaction") == 50_000
    for key, dimension in [
        ("worker_id", "dim_worker"),
        ("channel_id", "dim_channel"),
        ("market_id", "dim_market"),
        ("date_id", "dim_date"),
    ]:
        assert (
            scalar(
                con,
                f"SELECT count(*) FROM fact_transaction f LEFT JOIN {dimension} d USING ({key}) "
                f"WHERE d.{key} IS NULL",
            )
            == 0
        )


def test_invalid_financial_fields_are_explicitly_quarantined(
    con: duckdb.DuckDBPyConnection,
) -> None:
    columns = {row[1] for row in con.execute("PRAGMA table_info('fact_transaction')").fetchall()}
    assert "amount_usd" not in columns
    assert "fraud_loss_usd" not in columns
    assert "source_amount_usd_unreconciled" in columns
    assert "source_fraud_loss_usd_unbounded" in columns
    market_columns = {row[1] for row in con.execute("PRAGMA table_info('dim_market')").fetchall()}
    assert "usd_fx_rate" not in market_columns
    assert "source_usd_fx_rate_unreconciled" in market_columns


def test_headline_reproduces_the_g3_decision(con: duckdb.DuckDBPyConnection) -> None:
    row = con.execute("SELECT * FROM headline").fetchdf().iloc[0].to_dict()
    assert row["transactions"] == 50_000
    assert row["used_workers"] == 4_999
    assert row["main_effect_tests"] == 60
    assert row["main_effect_survivors"] == 0
    assert row["interaction_tests"] == 570
    assert row["interaction_survivors"] == 0
    assert row["max_main_cramers_v"] == pytest.approx(0.0215589831)
    assert row["max_abs_continuous_r"] == pytest.approx(0.0063228545)
    assert row["positive_control_rows"] == 50_000
    assert row["claims_confirmed"] == 0
    assert row["open_leads"] == 1
    assert row["cashout_month_end_reversal_diff_pp"] == pytest.approx(8.2751829609)
    assert row["cashout_month_end_reversal_p"] == pytest.approx(0.0575158879)
    assert row["loss_exceeds_amount_rows"] == 12_562
    assert row["configured_relationships"] == 9
    assert row["missing_relationships"] == 5
    assert row["configured_constraints"] == 54
    assert row["matching_constraint_names"] == 0


def test_claim_ledger_has_five_rejections_and_one_open_lead(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert scalar(con, "SELECT count(*) FROM dim_claim") == 6
    assert scalar(con, "SELECT count(*) FROM dim_claim WHERE verdict='REJECTED'") == 5
    assert scalar(con, "SELECT count(*) FROM dim_claim WHERE verdict='OPEN'") == 1
    open_claim = con.execute(
        "SELECT claim_id, effect_pp, p_value, sample_n FROM dim_claim WHERE verdict='OPEN'"
    ).fetchone()
    assert open_claim[0] == "month_end_cashout_reversal"
    assert open_claim[1] == pytest.approx(8.2751829609)
    assert open_claim[2] == pytest.approx(0.0575158879)
    assert open_claim[3] == 132


def test_broken_circuit_has_four_breaks_one_control_and_one_lead(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert scalar(con, "SELECT count(*) FROM dim_connector") == 6
    assert scalar(con, "SELECT count(*) FROM dim_connector WHERE status='BROKEN'") == 4
    assert scalar(con, "SELECT count(*) FROM dim_connector WHERE status='CONNECTED'") == 1
    assert scalar(con, "SELECT count(*) FROM dim_connector WHERE status='OPEN'") == 1
    assert (
        scalar(
            con,
            "SELECT primary_value FROM dim_connector WHERE connector_id='controls_to_flags'",
        )
        == 0
    )


def test_control_validation_carries_every_continuous_control(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert scalar(con, "SELECT count(*) FROM dim_control_validation") == 6
    assert scalar(con, "SELECT count(*) FROM dim_control_validation WHERE is_robust") == 0
    assert scalar(con, "SELECT max(abs(statistic)) FROM dim_control_validation") == pytest.approx(
        0.0063228545
    )


def test_status_alignment_and_open_lead_tables(con: duckdb.DuckDBPyConnection) -> None:
    status = con.execute(
        "SELECT event, phi, p_value, agreement FROM dim_status_alignment ORDER BY event"
    ).fetchall()
    assert [row[0] for row in status] == ["Disputed", "Reversed"]
    for actual, expected in zip(
        [row[1:] for row in status],
        [
            (0.0026455605, 0.5541417146, 0.49858),
            (0.0041362279, 0.3550238188, 0.50210),
        ],
        strict=True,
    ):
        assert actual == pytest.approx(expected)
    lead = con.execute(
        "SELECT period, transactions, reversed, reversal_rate "
        "FROM fact_month_end_cashout ORDER BY is_month_end DESC"
    ).fetchall()
    assert [row[0] for row in lead] == ["Month end", "Other days"]
    for actual, expected in zip(
        [row[1:] for row in lead],
        [
            (132, 78, 0.5909090909),
            (3739, 1900, 0.5081572613),
        ],
        strict=True,
    ):
        assert actual == pytest.approx(expected)


def test_calendar_repairs_week_without_overwriting_source(con: duckdb.DuckDBPyConnection) -> None:
    assert scalar(con, "SELECT count(*) FROM dim_date") == 731
    assert scalar(con, "SELECT count(*) FROM dim_date WHERE iso_week IS NULL") == 0
    assert scalar(con, "SELECT count(*) FROM dim_date WHERE source_week_number IS NOT NULL") == 0
    columns = {row[1] for row in con.execute("PRAGMA table_info('dim_date')").fetchall()}
    assert "quarter" not in columns
    assert "quarter_label" in columns
    assert "year" not in columns
    assert "calendar_year" in columns


def test_exposure_bins_preserve_the_identity_violation_counts(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert scalar(con, "SELECT sum(transactions) FROM fact_exposure_bin") == 25_145
    assert (
        scalar(
            con,
            "SELECT sum(transactions) FROM fact_exposure_bin WHERE above_identity",
        )
        == 12_562
    )
    assert scalar(con, "SELECT count(*) FROM fact_exposure_bin") <= 512


def test_contract_ledger_names_every_configured_check(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert scalar(con, "SELECT count(*) FROM dim_contract") == 63
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE kind='constraint'") == 54
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE kind='relationship'") == 9
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE status='MISSING'") == 59
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE status='AVAILABLE'") == 4


def test_malloy_avoids_reserved_and_path_order_names() -> None:
    model = (MONTH / "model" / "model.malloy").read_text(encoding="utf-8")
    assert "source: date is" not in model
    assert "source: calendar is" in model
    assert "order_by: market.country" not in model
    assert "order_by: channel.channel_type" not in model
    assert "order_by: worker.gig_segment" not in model
    assert "transactions is sum(transactions)" not in model
    assert "reversed is sum(reversed)" not in model
    assert "transaction_count is sum(transactions)" in model


def test_public_exports_are_finite_json() -> None:
    expected = {
        "claims.json",
        "connectors.json",
        "contracts.json",
        "controls.json",
        "defects.json",
        "exposure_bins.json",
        "headline.json",
        "month_end_cashout.json",
        "status_alignment.json",
    }
    assert {path.name for path in PUBLIC_DATA.glob("*.json")} == expected
    for path in PUBLIC_DATA.glob("*.json"):
        text = path.read_text(encoding="utf-8")
        assert "NaN" not in text and "Infinity" not in text
        json.loads(text)


def test_load_bearing_metrics_recompute_from_raw() -> None:
    facts = list(MONTH.rglob("fact_transactions_Updated_.csv"))
    if not facts:
        pytest.skip("raw August archive is not present")
    data = facts[0].parent
    connection = duckdb.connect()
    fact_path = str(facts[0]).replace("'", "''")
    date_path = str(data / "dim_date_updated.csv").replace("'", "''")
    connection.execute(f"CREATE VIEW raw_fact AS SELECT * FROM read_csv_auto('{fact_path}')")
    connection.execute(f"CREATE VIEW raw_date AS SELECT * FROM read_csv_auto('{date_path}')")
    loss_rows = scalar(
        connection,
        "SELECT count(*) FROM raw_fact WHERE is_fraud_flagged AND fraud_loss_usd > amount_usd",
    )
    assert loss_rows == 12_562
    lead = connection.execute(
        "SELECT d.is_month_end, count(*) n, sum(CAST(f.is_reversed AS INTEGER)) reversed "
        "FROM raw_fact f JOIN raw_date d USING (date_id) "
        "WHERE f.transaction_type='Cash-Out' GROUP BY 1 ORDER BY 1 DESC"
    ).fetchall()
    assert lead == [(True, 132, 78), (False, 3739, 1900)]
