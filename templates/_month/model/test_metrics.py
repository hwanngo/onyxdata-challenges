"""Metric assertions for <YYYY>/<MM>  (Gate G4).

Known-good values, asserted. These are the tests that stop a silent regression in
build.py from putting a wrong number on the poster.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model` first"


# def test_fact_grain_is_unique(con):
#     dupes = con.execute(
#         "SELECT count(*) FROM (SELECT tx_id FROM fct_main GROUP BY 1 HAVING count(*) > 1)"
#     ).fetchone()[0]
#     assert dupes == 0

# def test_no_orphan_dates(con):
#     orphans = con.execute(
#         "SELECT count(*) FROM fct_main f LEFT JOIN dim_date d ON f.event_date = d.date "
#         "WHERE d.date IS NULL"
#     ).fetchone()[0]
#     assert orphans == 0

# def test_total_revenue_known_value(con):
#     assert con.execute("SELECT round(sum(revenue), 2) FROM fct_main").fetchone()[0] == 0.00
