"""Metric and semantic-boundary assertions for 2026/09 (Gate G4)."""

import json
import math
from pathlib import Path

import duckdb
import pytest
import yaml

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
PUBLIC_DATA = MONTH / "app" / "public" / "data"
EXPECTED_TABLES = {
    "audit_release_contract",
    "dim_claim",
    "dim_collection_requirement",
    "dim_contract",
    "dim_date",
    "dim_kitchen",
    "dim_measure_contract",
    "dim_process_link",
    "dim_rider",
    "dim_time_slot",
    "dim_zone",
    "fact_corridor_allocation",
    "fct_order_allocation",
    "headline",
}
SOURCE_MEASURES = {
    "source_order_value_ngn",
    "source_delivery_distance_km",
    "source_promised_delivery_min",
    "source_actual_delivery_min",
    "source_traffic_friction_score",
    "source_food_temp_on_arrival_c",
    "source_customer_rating",
    "source_delivery_cost_ngn",
    "source_order_profit_ngn",
}


@pytest.fixture(scope="module")
def con():
    files = {path.stem: path for path in CURATED.glob("*.parquet")}
    missing = EXPECTED_TABLES - files.keys()
    assert not missing, f"run `just build-model 2026 09`; missing {sorted(missing)}"

    connection = duckdb.connect()
    for name, path in files.items():
        connection.execute(f"CREATE VIEW {name} AS SELECT * FROM read_parquet('{path}')")
    yield connection
    connection.close()


def scalar(con, sql: str):
    return con.execute(sql).fetchone()[0]


def test_curated_tables_exist():
    assert {path.stem for path in CURATED.glob("*.parquet")} == EXPECTED_TABLES


def test_curated_row_counts(con):
    expected = {
        "fct_order_allocation": 5_000,
        "fact_corridor_allocation": 80,
        "dim_date": 731,
        "dim_kitchen": 4,
        "dim_zone": 20,
        "dim_rider": 60,
        "dim_time_slot": 48,
        "dim_measure_contract": 9,
        "dim_process_link": 8,
        "dim_claim": 5,
        "dim_contract": 61,
        "dim_collection_requirement": 7,
        "audit_release_contract": 1,
        "headline": 1,
    }
    for table, rows in expected.items():
        assert scalar(con, f"SELECT count(*) FROM {table}") == rows


def test_fact_grain_and_keys_are_complete(con):
    assert scalar(con, "SELECT count(DISTINCT order_id) FROM fct_order_allocation") == 5_000
    assert (
        scalar(
            con,
            """
        SELECT count(*)
        FROM fct_order_allocation
        WHERE order_id IS NULL OR order_date IS NULL OR kitchen_id IS NULL
           OR zone_id IS NULL OR rider_id IS NULL OR time_slot_id IS NULL
        """,
        )
        == 0
    )
    assert (
        scalar(
            con,
            """
        SELECT
          (SELECT count(*) FROM fct_order_allocation f LEFT JOIN dim_date d USING (order_date)
           WHERE d.order_date IS NULL)
        + (SELECT count(*) FROM fct_order_allocation f LEFT JOIN dim_kitchen k USING (kitchen_id)
           WHERE k.kitchen_id IS NULL)
        + (SELECT count(*) FROM fct_order_allocation f LEFT JOIN dim_zone z USING (zone_id)
           WHERE z.zone_id IS NULL)
        + (SELECT count(*) FROM fct_order_allocation f LEFT JOIN dim_rider r USING (rider_id)
           WHERE r.rider_id IS NULL)
        + (SELECT count(*) FROM fct_order_allocation f LEFT JOIN dim_time_slot s USING (time_slot_id)
           WHERE s.time_slot_id IS NULL)
        """,
        )
        == 0
    )


def test_source_measures_are_quarantined_by_name(con):
    columns = {row[0] for row in con.execute("DESCRIBE fct_order_allocation").fetchall()}
    assert columns >= SOURCE_MEASURES
    assert {name.removeprefix("source_") for name in SOURCE_MEASURES}.isdisjoint(columns)


def test_known_quality_failures_are_preserved_as_audit_flags(con):
    expected_failures = {
        "promise_in_documented_range": 4_892,
        "actual_within_120_min_screen": 4_400,
        "temperature_within_0_100_screen": 4_516,
        "profit_identity_matches": 5_000,
        "date_matches_slot_weekday": 4_288,
        "order_on_or_after_kitchen_open": 1_238,
        "rider_matches_base_kitchen": 3_736,
    }
    for flag, failures in expected_failures.items():
        assert (
            scalar(
                con,
                f"SELECT count(*) FROM fct_order_allocation WHERE NOT {flag}",
            )
            == failures
        )

    assert scalar(con, "SELECT count(*) FROM dim_time_slot WHERE NOT slot_hour_consistent") == 48
    assert scalar(con, "SELECT count(*) FROM dim_time_slot WHERE NOT slot_weekend_consistent") == 21


def test_allocation_network_known_values(con):
    assert (
        scalar(
            con,
            "SELECT count(*) FROM (SELECT DISTINCT kitchen_id, zone_id FROM fct_order_allocation)",
        )
        == 80
    )
    assert (
        scalar(
            con,
            "SELECT count(*) FROM (SELECT DISTINCT kitchen_id, rider_id FROM fct_order_allocation)",
        )
        == 240
    )
    assert (
        scalar(
            con,
            "SELECT count(*) FROM (SELECT DISTINCT kitchen_id, time_slot_id FROM fct_order_allocation)",
        )
        == 192
    )
    assert (
        scalar(
            con,
            "SELECT max(orders) FROM (SELECT kitchen_id, zone_id, count(*) AS orders "
            "FROM fct_order_allocation GROUP BY 1, 2)",
        )
        == 79
    )


def test_measure_contract_blocks_operational_use(con):
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_measure_contract WHERE semantic_status = 'quarantined'",
        )
        == 9
    )
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_measure_contract WHERE safe_use <> 'source audit only'",
        )
        == 0
    )


def test_release_contract_records_validator_mismatch(con):
    row = con.execute(
        """
        SELECT validation_checks_passed, configured_constraints, matching_constraints,
               configured_relationships, unavailable_relationships
        FROM audit_release_contract
        """
    ).fetchone()
    assert row == (10, 54, 0, 7, 3)
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE kind='constraint'") == 54
    assert scalar(con, "SELECT count(*) FROM dim_contract WHERE kind='relationship'") == 7
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_contract WHERE kind='constraint' AND status='MATCH'",
        )
        == 0
    )
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_contract WHERE kind='relationship' AND status='MISSING'",
        )
        == 3
    )
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_contract WHERE kind='relationship' AND status='INVALID'",
        )
        == 1
    )


def test_process_links_and_claims_preserve_the_g3_decision(con):
    links = con.execute(
        "SELECT link_id, correlation_r, status FROM dim_process_link ORDER BY sequence"
    ).fetchall()
    assert len(links) == 8
    assert all(row[2] == "disconnected" for row in links)
    assert max(abs(row[1]) for row in links) == pytest.approx(0.0257126344)
    assert scalar(con, "SELECT count(*) FROM dim_claim WHERE verdict='REJECTED'") == 3
    assert scalar(con, "SELECT count(*) FROM dim_claim WHERE verdict='UNSUPPORTED'") == 2
    assert scalar(con, "SELECT count(*) FROM dim_claim WHERE verdict='CONFIRMED'") == 0
    assert (
        scalar(
            con,
            "SELECT count(*) FROM dim_claim WHERE claim_id='rain_delay' AND verdict='UNSUPPORTED'",
        )
        == 1
    )


def test_corridor_fact_carries_denominator_and_rank(con):
    assert scalar(con, "SELECT sum(order_rows) FROM fact_corridor_allocation") == 5_000
    assert scalar(con, "SELECT max(order_rows) FROM fact_corridor_allocation") == 79
    assert scalar(con, "SELECT round(sum(allocation_share), 10) FROM fact_corridor_allocation") == 1
    assert (
        scalar(
            con,
            "SELECT count(*) FROM fact_corridor_allocation WHERE corridor_rank_within_kitchen = 1",
        )
        >= 4
    )


def test_headline_is_a_complete_export_convenience(con):
    row = con.execute(
        """
        SELECT order_rows, calendar_dates, kitchen_zone_pairs, kitchen_rider_pairs,
               kitchen_slot_pairs, quarantined_measures, process_links_surviving_correction,
               supplied_claims_confirmed, matching_constraints
        FROM headline
        """
    ).fetchone()
    assert row == (5_000, 731, 80, 240, 192, 9, 0, 0, 0)


def test_public_exports_are_finite_json():
    expected = {
        "allocations.json",
        "claims.json",
        "collection_requirements.json",
        "contracts.json",
        "corridors.json",
        "headline.json",
        "measure_contracts.json",
        "process_links.json",
    }
    assert {path.name for path in PUBLIC_DATA.glob("*.json")} == expected
    for path in PUBLIC_DATA.glob("*.json"):
        text = path.read_text(encoding="utf-8")
        assert "NaN" not in text and "Infinity" not in text
        json.loads(text)

    allocations = json.loads((PUBLIC_DATA / "allocations.json").read_text(encoding="utf-8"))
    assert len(allocations) == 5_000
    assert set(allocations[0]) == {
        "order_id",
        "order_date",
        "kitchen_id",
        "zone_id",
        "rider_id",
        "time_slot_id",
    }


def test_load_bearing_metrics_recompute_from_raw():
    facts = list(MONTH.rglob("fact_orders.csv"))
    if not facts:
        pytest.skip("raw September archive is not present")
    connection = duckdb.connect()
    raw_path = str(facts[0]).replace("'", "''")
    connection.execute(f"CREATE VIEW raw_fact AS SELECT * FROM read_csv_auto('{raw_path}')")
    assert scalar(connection, "SELECT count(*) FROM raw_fact") == 5_000
    assert scalar(connection, "SELECT count(DISTINCT order_id) FROM raw_fact") == 5_000
    assert (
        scalar(
            connection,
            "SELECT count(*) FROM (SELECT DISTINCT kitchen_id, zone_id FROM raw_fact)",
        )
        == 80
    )
    assert scalar(connection, "SELECT count(*) FROM raw_fact WHERE order_profit_ngn < 0") == 0
    assert scalar(
        connection,
        "SELECT corr(order_value_ngn, order_profit_ngn) FROM raw_fact",
    ) == pytest.approx(0.0257126344)
    connection.close()


def test_malloy_omits_quarantined_operational_measures():
    model = (MONTH / "model" / "model.malloy").read_text(encoding="utf-8")
    assert "source: calendar is" in model
    assert "view: allocation_overview is" in model
    assert "view: process_chain is" in model
    assert "view: supplied_claim_scorecard is" in model
    for forbidden in (
        "total_profit is",
        "profit_margin is",
        "sla_rate is",
        "late_orders is",
        "average_temperature is",
        "rider_performance is",
    ):
        assert forbidden not in model


def test_metric_check_queries_execute_independently(con):
    spec = yaml.safe_load((MONTH / "model" / "metric_checks.yml").read_text(encoding="utf-8"))
    assert len(spec["metrics"]) >= 30
    for name, sql in spec["metrics"].items():
        value = scalar(con, sql)
        assert value is not None, name
        assert math.isfinite(float(value)), name

    assert len(spec["metric_sets"]) >= 4
    for name, sql in spec["metric_sets"].items():
        rows = con.execute(sql).fetchall()
        assert rows, name
        for key, measure, value in rows:
            assert key is not None and measure is not None, name
            assert math.isfinite(float(value)), name
