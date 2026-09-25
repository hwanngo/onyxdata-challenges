"""Filtered DOM-to-Parquet verification contract for the September dashboard."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

MONTH = Path(__file__).resolve().parents[1]
MODULE_PATH = MONTH / "model" / "verify_selection.py"


def load_module():
    spec = importlib.util.spec_from_file_location("verify_selection", MODULE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def verifier():
    return load_module()


@pytest.fixture(scope="module")
def con(verifier):
    connection = verifier.open_curated(MONTH)
    yield connection
    connection.close()


def test_cases_cover_each_filter_and_a_real_zero_row_combination(verifier, con):
    cases = verifier.build_cases(con)

    assert [case.name for case in cases] == [
        "default",
        "kitchen",
        "zone",
        "rider",
        "month",
        "zero-row",
    ]
    assert [case.filters[0]["field"] for case in cases[1:5]] == [
        "kitchen_id",
        "zone_id",
        "rider_id",
        "year_month",
    ]
    assert verifier.recompute_selection(con, cases[-1].filters)["selected.order_rows"] == 0


def test_recompute_selection_matches_filtered_fact_and_complete_corridor_grid(verifier, con):
    kitchen_id = con.execute("SELECT min(kitchen_id) FROM fct_order_allocation").fetchone()[0]
    filters = [{"field": "kitchen_id", "values": [kitchen_id]}]

    metrics = verifier.recompute_selection(con, filters)
    expected_rows = con.execute(
        "SELECT count(*) FROM fct_order_allocation WHERE kitchen_id = ?",
        [kitchen_id],
    ).fetchone()[0]

    assert metrics["selected.order_rows"] == expected_rows
    assert metrics["selected.kitchen_zone_pairs"] == 20
    assert metrics["selected.kitchen_rider_pairs"] == 60
    assert len([name for name in metrics if name.endswith(".orders")]) == 80
    assert len([name for name in metrics if name.endswith(".share")]) == 80
    assert (
        sum(value for name, value in metrics.items() if name.endswith(".orders")) == expected_rows
    )
    assert sum(
        value for name, value in metrics.items() if name.endswith(".share")
    ) == pytest.approx(1.0)


def test_zero_row_recompute_keeps_all_corridors_with_zero_values(verifier, con):
    zero_case = verifier.build_cases(con)[-1]
    metrics = verifier.recompute_selection(con, zero_case.filters)

    assert metrics["selected.order_rows"] == 0
    assert metrics["selected.kitchen_zone_pairs"] == 0
    assert metrics["selected.kitchen_rider_pairs"] == 0
    assert len(metrics) == 163
    assert all(value == 0 for value in metrics.values())
