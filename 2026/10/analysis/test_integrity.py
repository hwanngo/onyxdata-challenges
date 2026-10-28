"""Pin the load-bearing G2/G3 outputs against the immutable raw archive.

If any of these move, a published claim moved with it - rewrite the ledger, do not loosen the test.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("integrity_2026_10", HERE / "integrity.py")
integrity = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(integrity)


@pytest.fixture(scope="module")
def r() -> dict:
    return integrity.analyze(integrity.find_data_dir())


def test_estate_has_no_format_comparator(r):
    assert r["estate"]["format_counts"] == {"High-Street": 58, "Transport-Hub": 2}
    assert r["estate"]["retail_park_stores"] == 0
    assert r["format"]["permutation_p_two_sided"] > 0.05


def test_daily_fact_is_not_store_day_grain(r):
    g = r["daily_grain"]
    assert (g["rows"], g["distinct_store_days"]) == (10_000, 8_910)
    assert (
        g["multi_row_store_days_with_different_revenue"]
        == g["store_days_with_multiple_rows"]
        == 1_006
    )


def test_daily_fact_does_not_reconcile_to_monthly(r):
    d = r["daily_vs_monthly"]
    assert abs(d["r_avg_day_vs_month_revenue"]) < 0.1
    assert 29 < d["median_implied_days"] < 32  # same scale, no linkage


def test_contract_counts(r):
    assert r["contract_summary"] == {"tested": 24, "holds": 7, "fails": 17}
    holds = {c["id"] for c in r["contract"] if c["verdict"] == "HOLDS"}
    assert holds == {"C06", "C09", "C10", "C14", "C15", "C16", "C17"}


def test_status_label_contradicts_its_bands(r):
    assert r["status_mismatch"]["rows"] == 600
    assert r["status_mismatch"]["labelled_profitable_but_above_20pct"] == 349


def test_revenue_has_no_store_identity(r):
    s = r["store_identity"]
    # 59 / 1,439 = 0.041 is the share 60 random labels explain on 1,440 rows
    assert s["revenue"]["eta2_store"] == pytest.approx(59 / 1439, abs=0.002)
    assert s["revenue"]["kw_p_store"] > 0.05
    assert s["rent"]["eta2_store"] > 0.95
    assert abs(r["repeatability"]["revenue_2023_vs_2024_r"]) < 0.1
    assert r["repeatability"]["net_profit_2023_vs_2024_r"] > 0.6


def test_fixed_cost_explains_profit(r):
    c = r["cost_vs_revenue"]
    assert c["r2_store_profit_on_fixed_cost"] > 0.75
    assert c["r2_store_profit_on_revenue"] < 0.15
    assert r["region"]["r_region_margin_vs_fixed"] < -0.95
    assert r["region"]["revenue_kw_p"] > 0.5
    assert r["region"]["top_margin"] == r["region"]["lowest_fixed"] == "Northern-Ireland"
    assert r["region"]["bottom_margin"] == r["region"]["highest_fixed"] == "London"


def test_loyalty_buys_share_not_spend(r):
    lo = r["loyalty"]
    assert lo["r_adoption_member_share_store"] > 0.99
    assert abs(lo["r_adoption_revenue_store"]) < 0.05
    assert lo["upper_95_lift_at_mean_adoption"] < lo["revenue_needed_to_fund_redemption"]


def test_week_is_the_real_signal_and_staffing_ignores_it(r):
    w = r["week"]
    assert w["eta2_day_of_week"] > 0.15
    assert -0.26 < w["weekend_gap_pct"] < -0.23
    assert w["hours_mwu_p"] > 0.05
    assert abs(w["r_hours_revenue"]) < 0.02


def test_no_season_no_mix_shift(r):
    assert r["season"]["month_of_year_revenue_kw_p"] > 0.5
    assert all(v["p"] > 0.05 for v in r["mix"].values())


def test_loss_is_a_month_not_a_store(r):
    assert r["loss"]["stores_with_a_loss_month"] == 58
    assert r["loss"]["negative_store_ids"] == [32]
