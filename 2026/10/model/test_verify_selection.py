"""Filter / drill verification contract for the October dashboard (pure SQL side, no browser)."""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import pytest

MONTH = Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location(
        "verify_selection", MONTH / "model" / "verify_selection.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def v():
    return load_module()


@pytest.fixture(scope="module")
def con(v):
    c = v.open_curated(MONTH)
    yield c
    c.close()


def test_cases_cover_every_filter_a_drill_and_a_real_zero_row_state(v, con):
    cases = v.build_cases(con)
    assert [c.name for c in cases] == [
        "default",
        "region",
        "location",
        "cost-half",
        "year",
        "both-years",
        "drill",
        "zero-row",
    ]
    zero = cases[-1]
    assert v.selected_ids(con, zero) == []
    assert v.recompute(con, zero) == {}


def test_default_state_equals_the_whole_estate(v, con):
    out = v.recompute(con, v.Case("default"))
    assert out["selected.stores"] == 60
    assert out["selected.revenue"] == pytest.approx(89_685_989.18, abs=0.01)
    assert out["selected.net_profit"] == pytest.approx(16_879_504.07, abs=0.01)
    assert not any(k.startswith(("selected.week", "selected.cups", "drill.")) for k in out)


def test_cost_halves_split_sixty_stores_thirty_thirty(v, con):
    lower = v.selected_ids(con, v.Case("x", half=("Lower-cost half",)))
    upper = v.selected_ids(con, v.Case("x", half=("Higher-cost half",)))
    assert len(lower) == len(upper) == 30
    assert not set(lower) & set(upper)


def test_both_years_is_not_a_year_filter_but_still_namespaces_the_week(v, con):
    both = v.recompute(con, v.Case("both", year=(2023, 2024)))
    assert "selected.cups.1.rev" not in both
    assert both["selected.week.gap"] == pytest.approx(-0.24371779504824764, rel=1e-9)


def test_drill_is_24_months_regardless_of_year(v, con):
    out = v.recompute(con, v.Case("drill", year=(2024,), store=32))
    assert (
        sum(1 for k in out if k.startswith("drill.") and k.endswith(".rev") and k.count(".") == 2)
        == 24
    )
    assert out["drill.margin_rank"] == 60
    assert out["drill.net_profit_pm"] < 0


def test_selection_matches_the_app_bundle_arithmetic(v, con):
    """Independent cross-check against the JSON the browser loads (Python, not DuckDB)."""
    stores = json.loads((MONTH / "app/public/data/stores.json").read_text())
    months = json.loads((MONTH / "app/public/data/store_months.json").read_text())
    region = sorted({s["region"] for s in stores})[0]
    ids = {s["id"] for s in stores if s["region"] == region}
    rows = [m for m in months if m["s"] in ids and m["m"].startswith("2023")]
    out = v.recompute(con, v.Case("x", region=(region,), year=(2023,)))
    assert out["selected.revenue"] == pytest.approx(sum(r["rev"] for r in rows), rel=1e-9)
    assert out["selected.loss_months"] == sum(r["np"] < 0 for r in rows)
    assert math.isclose(
        out["selected.margin"],
        sum(r["np"] for r in rows) / sum(r["rev"] for r in rows),
        rel_tol=1e-9,
    )
