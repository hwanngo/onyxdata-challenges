"""Metric assertions for the 2026/10 curated model (Gate G4).

Independent path: DuckDB SQL over data/curated/*.parquet, compared against
  (a) hand-pinned values from the G3 ledger, and
  (b) analysis/integrity.json, which pandas computed from the RAW CSVs.
Two engines, two inputs, one answer - or the test fails.
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pytest

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
AUDIT = json.loads((MONTH / "analysis" / "integrity.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for pq in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {pq.stem} AS SELECT * FROM read_parquet('{pq}')")
    return c


def one(con, sql):
    return con.execute(sql).fetchone()[0]


# ------------------------------------------------------------------ grain and lineage
def test_no_rows_dropped(con):
    assert one(con, "SELECT count(*) FROM fct_store_month") == 1440
    assert one(con, "SELECT count(*) FROM fct_daily_sample") == 10_000
    assert one(con, "SELECT count(*) FROM dim_store") == 60
    assert one(con, "SELECT count(*) FROM dim_date") == 730
    assert one(con, "SELECT count(*) FROM mart_store") == 60


def test_store_month_is_unique(con):
    assert (
        one(con, "SELECT count(*) FROM (SELECT DISTINCT store_id, month_id FROM fct_store_month)")
        == 1440
    )


def test_pnl_identity(con):
    resid = one(
        con,
        """SELECT max(abs(net_profit_gbp - (gross_profit_gbp - fixed_cost_gbp
                         - loyalty_redemption_cost_gbp))) FROM fct_store_month""",
    )
    assert resid < 0.02


def test_mart_reconciles_to_fact(con):
    diff = one(
        con,
        """SELECT max(abs(m.net_profit_gbp - f.np)) FROM mart_store m
                       JOIN (SELECT store_id, sum(net_profit_gbp) np FROM fct_store_month GROUP BY 1) f
                       USING (store_id)""",
    )
    assert diff < 1e-6


# ------------------------------------------------------------------ estate KPIs
def test_estate_kpis(con):
    rev, np_, red = con.execute(
        "SELECT sum(total_monthly_revenue_gbp), sum(net_profit_gbp), sum(loyalty_redemption_cost_gbp) FROM fct_store_month"
    ).fetchone()
    assert rev == pytest.approx(89_685_989.18, abs=0.01)
    assert np_ == pytest.approx(16_879_504.07, abs=0.01)
    assert np_ / rev == pytest.approx(AUDIT["cost_vs_revenue"]["estate_margin"], abs=5e-5)
    assert red == pytest.approx(AUDIT["loyalty"]["redemption_total"], abs=0.01)


# ------------------------------------------------------------------ derived labels
def test_status_rederived(con):
    assert one(con, "SELECT count(*) FROM fct_store_month WHERE NOT status_matches_source") == 600
    assert one(con, "SELECT count(*) FROM fct_store_month WHERE status = 'Structural-Loss'") == 76
    assert (
        one(con, "SELECT count(*) FROM fct_store_month WHERE source_status = 'Structural-Loss'")
        == 17
    )


def test_rent_band_rederived(con):
    assert (
        one(con, "SELECT count(*) FROM fct_store_month WHERE rent_band <> source_rent_band") == 119
    )


# ------------------------------------------------------------------ I1 cost league
def test_region_margin_tracks_fixed_cost(con):
    r_fixed, r_rev = con.execute("""
        WITH r AS (SELECT s.region, sum(net_profit_gbp)/sum(total_monthly_revenue_gbp) margin,
                          avg(fixed_cost_gbp) fixed, avg(total_monthly_revenue_gbp) rev
                   FROM fct_store_month f JOIN dim_store s USING (store_id) GROUP BY 1)
        SELECT corr(fixed, margin), corr(rev, margin) FROM r""").fetchone()
    assert r_fixed == pytest.approx(AUDIT["region"]["r_region_margin_vs_fixed"], abs=5e-5)
    assert r_rev == pytest.approx(AUDIT["region"]["r_region_margin_vs_revenue"], abs=5e-5)


def test_store_profit_r2(con):
    r2_fixed, r2_rev = con.execute(
        "SELECT power(corr(fixed_pm, net_profit_pm), 2), power(corr(revenue_pm, net_profit_pm), 2) FROM mart_store"
    ).fetchone()
    assert r2_fixed == pytest.approx(
        AUDIT["cost_vs_revenue"]["r2_store_profit_on_fixed_cost"], abs=5e-5
    )
    assert r2_rev == pytest.approx(AUDIT["cost_vs_revenue"]["r2_store_profit_on_revenue"], abs=5e-5)


def test_cost_half_screen(con):
    rows = dict(
        con.execute(
            """SELECT cost_half, sum(net_profit_gbp)/sum(revenue_gbp) FROM mart_store GROUP BY 1"""
        ).fetchall()
    )
    assert rows["Lower-cost half"] == pytest.approx(
        AUDIT["brief"]["margin_below_median_fixed"], abs=5e-5
    )
    assert rows["Higher-cost half"] == pytest.approx(
        AUDIT["brief"]["margin_above_median_fixed"], abs=5e-5
    )
    assert one(con, "SELECT count(*) FROM mart_store WHERE cost_half = 'Lower-cost half'") == 30


# ------------------------------------------------------------------ I2 repeatability
def test_revenue_does_not_repeat(con):
    r_rev, r_np = con.execute(
        "SELECT corr(revenue_2023, revenue_2024), corr(net_profit_2023, net_profit_2024) FROM mart_store"
    ).fetchone()
    assert r_rev == pytest.approx(AUDIT["repeatability"]["revenue_2023_vs_2024_r"], abs=5e-5)
    assert r_np == pytest.approx(AUDIT["repeatability"]["net_profit_2023_vs_2024_r"], abs=5e-5)


# ------------------------------------------------------------------ I3 loyalty
def test_loyalty(con):
    r_share, r_rev, slope = con.execute(
        "SELECT corr(loyalty_adoption_rate, member_share), corr(loyalty_adoption_rate, revenue_pm), regr_slope(revenue_pm, loyalty_adoption_rate) FROM mart_store"
    ).fetchone()
    assert r_share == pytest.approx(
        0.9984, abs=1e-3
    )  # pooled vs row-mean share differ in the 4th place
    assert r_rev == pytest.approx(AUDIT["loyalty"]["r_adoption_revenue_store"], abs=5e-5)
    assert slope * 0.1 == pytest.approx(AUDIT["loyalty"]["revenue_per_10pp_adoption"], abs=0.01)


# ------------------------------------------------------------------ I4 the week
def test_week(con):
    rows = {
        r[0]: r[1:]
        for r in con.execute("""
        SELECT is_weekend, avg(total_revenue_gbp), avg(total_staff_hours), sum(total_revenue_gbp)/sum(total_staff_hours)
        FROM fct_daily_sample GROUP BY 1""").fetchall()
    }
    assert rows[True][0] / rows[False][0] - 1 == pytest.approx(
        AUDIT["week"]["weekend_gap_pct"], abs=5e-5
    )
    assert rows[True][1] == pytest.approx(AUDIT["week"]["weekend_hours"], abs=0.005)
    assert rows[False][2] == pytest.approx(AUDIT["week"]["weekday_revenue_per_hour"], abs=0.005)


def test_daily_sample_is_not_joined_to_pnl(con):
    cols = {r[0] for r in con.execute("DESCRIBE fct_daily_sample").fetchall()}
    assert not cols & {"net_profit_gbp", "total_monthly_revenue_gbp", "fixed_cost_gbp"}


# ------------------------------------------------------------------ I5 contract
def test_contract(con):
    holds, fails = con.execute(
        "SELECT count(*) FILTER (WHERE verdict='HOLDS'), count(*) FILTER (WHERE verdict='FAILS') FROM dim_contract"
    ).fetchone()
    assert (holds, fails) == (7, 17)


def test_loss_is_a_month_not_a_store(con):
    any_loss, neg = con.execute(
        "SELECT count(*) FILTER (WHERE loss_months > 0), count(*) FILTER (WHERE net_profit_gbp < 0) FROM mart_store"
    ).fetchone()
    assert (any_loss, neg) == (58, 1)
