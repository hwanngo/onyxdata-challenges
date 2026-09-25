from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

MONTH_DIR = Path(__file__).resolve().parents[1]
INTEGRITY_PATH = Path(__file__).with_name("integrity.py")
SPEC = importlib.util.spec_from_file_location("september_integrity", INTEGRITY_PATH)
assert SPEC is not None and SPEC.loader is not None
integrity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(integrity)


@pytest.fixture(scope="module")
def findings() -> dict[str, dict[str, object]]:
    facts = list(MONTH_DIR.rglob("fact_orders.csv"))
    if not facts:
        pytest.skip("raw September archive is not present")
    return integrity.analyze(facts[0].parents[1])


def test_delivered_tables_have_order_grain_and_complete_keys(
    findings: dict[str, dict[str, object]],
) -> None:
    shape = findings["shape"]
    assert shape["fact_rows"] == 5_000
    assert shape["distinct_order_ids"] == 5_000
    assert shape["date_start"] == "2023-01-01"
    assert shape["date_end"] == "2024-12-31"
    assert shape["distinct_dates"] == 731
    assert shape["date_gaps"] == 0
    assert shape["exact_duplicate_rows"] == 0
    assert shape["null_values"] == 0
    assert shape["total_fact_orphans"] == 0
    assert shape["rider_kitchen_orphans"] == 0


def test_business_measures_break_documented_ranges_and_meanings(
    findings: dict[str, dict[str, object]],
) -> None:
    quality = findings["quality"]
    assert quality["promised_outside_documented_range"] == 4_892
    assert quality["actual_over_120_minutes"] == 4_400
    assert quality["temperature_outside_0_100"] == 4_516
    assert quality["rider_speed_over_100"] == 56
    assert quality["profit_identity_failures"] == 5_000
    assert quality["negative_profit_rows"] == 0
    assert quality["profit_residual_median"] == pytest.approx(70_368.330555255)


def test_time_and_entity_dimensions_contradict_their_labels(
    findings: dict[str, dict[str, object]],
) -> None:
    dimensions = findings["dimensions"]
    assert dimensions["order_weekday_mismatches"] == 4_288
    assert dimensions["slot_weekend_contradictions"] == 21
    assert dimensions["slot_hour_label_contradictions"] == 48
    assert dimensions["orders_before_kitchen_open"] == 1_238
    assert dimensions["orders_outside_rider_base_kitchen"] == 3_736
    assert dimensions["duplicate_zone_name_rows"] == 10
    assert dimensions["duplicate_rider_name_rows"] == 54


def test_measures_are_independent_bounded_draws(
    findings: dict[str, dict[str, object]],
) -> None:
    generation = findings["generation"]
    assert generation["continuous_uniform_tests"] == 7
    assert generation["continuous_uniform_survivors"] == 7
    assert generation["minimum_continuous_uniform_p"] == pytest.approx(0.0668076547)
    assert generation["promised_uniform_p"] == pytest.approx(0.3332835843)
    assert generation["actual_uniform_p"] == pytest.approx(0.7977652167)
    assert generation["documented_normal_rejections"] == 5
    assert generation["pairwise_tests"] == 36
    assert generation["pairwise_survivors"] == 0
    assert generation["max_abs_pairwise_r"] == pytest.approx(0.0303795312)
    assert generation["promised_actual_r"] == pytest.approx(0.0115605327)
    assert generation["actual_gt_promised"] == 2_497
    assert generation["actual_equal_promised"] == 4
    assert generation["actual_lt_promised"] == 2_499


def test_network_is_fully_crossed_not_operationally_routed(
    findings: dict[str, dict[str, object]],
) -> None:
    network = findings["network"]
    assert network["kitchen_zone_pairs"] == 80
    assert network["possible_kitchen_zone_pairs"] == 80
    assert network["kitchen_rider_pairs"] == 240
    assert network["possible_kitchen_rider_pairs"] == 240
    assert network["kitchen_slot_pairs"] == 192
    assert network["possible_kitchen_slot_pairs"] == 192
    assert network["largest_corridor_orders"] == 79
    assert network["largest_corridor_share"] == pytest.approx(0.0158)
    assert network["rider_base_matches"] == 1_264
    assert network["rider_base_mismatches"] == 3_736
    assert network["rider_base_association_p"] == pytest.approx(0.3685907566)
    assert network["rider_base_cramers_v"] == pytest.approx(0.0255342386)
    assert network["minimum_key_balance_p"] == pytest.approx(0.1952114310)


def test_all_five_supplied_claims_fail(
    findings: dict[str, dict[str, object]],
) -> None:
    claims = findings["claims"]
    assert claims["rush_outer_n"] == 539
    assert claims["rush_outer_over_90"] == 496
    assert claims["rush_outer_triple_sla"] == 86
    assert claims["rush_outer_negative_profit"] == 0
    assert claims["rain_n"] == 1_166
    assert claims["rain_traffic_ratio"] == pytest.approx(1.0039286988)
    assert claims["rain_actual_diff"] == pytest.approx(6.9370075)
    assert claims["long_distance_n"] == 3_871
    assert claims["long_distance_share"] == pytest.approx(0.7742)
    assert claims["long_distance_negative_profit"] == 0
    assert claims["slow_n"] == 4_710
    assert claims["slow_cold_n"] == 203
    assert claims["slow_low_rating_n"] == 1_768
    assert claims["lekki_ikoyi_n"] == 58
    assert claims["lekki_ikoyi_negative_profit"] == 0
    assert claims["vi_zone_present"] is False
    assert claims["supported_count"] == 0


def test_analysis_result_is_json_serializable(
    findings: dict[str, dict[str, object]],
) -> None:
    json.dumps(findings)


def test_validation_report_does_not_target_the_delivered_schema(
    findings: dict[str, dict[str, object]],
) -> None:
    archive = findings["archive"]
    assert archive["validation_checks_passed"] == 10
    assert archive["configured_constraints"] == 54
    assert archive["matching_constraints"] == 0
    assert archive["configured_relationships"] == 7
    assert archive["unavailable_relationships"] == 3
