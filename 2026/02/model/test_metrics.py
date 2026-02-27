"""Metric assertions for 2026/02 Pharmacy Sales & Profitability  (Gate G4).

Known-good values, asserted. These are the tests that stop a silent regression in build.py
from putting a wrong number on the poster.

TWO KINDS OF TEST, deliberately:

  * LITERALS. Every headline figure is written out by hand, from `analysis/integrity.py`
    against the RAW workbook. A test that recomputes the number the same way build.py does
    proves only that the code is self-consistent - which is exactly what the integrity pass
    found eight months of tooling doing.

  * PREMISES. The claims the model is built on - brand nested in category, city 1:1 with
    region, no product below cost, geography flat and the two levers not - asserted here as
    well as in build.py, so a rebuild that silently relaxes a `require` still fails.

Run: just test-model 2026 02
(Not plain `pytest` across two months - the module-name collision is a known repo trap.)
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


def q(con, sql):
    return con.execute(sql).fetchone()[0]


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model 2026 02` first"


# ---------------------------------------------------------------------------------------
# Shape and grain
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("table", "rows"),
    [
        ("fct_sales", 62_139),
        ("dim_date", 731),
        ("dim_pharmacy", 120),
        ("dim_product", 220),
        ("dim_cut", 7),
    ],
)
def test_row_counts(con, table, rows):
    assert q(con, f"SELECT count(*) FROM {table}") == rows


def test_sales_key_is_unique(con):
    dupes = q(
        con,
        "SELECT count(*) FROM (SELECT sales_key FROM fct_sales GROUP BY 1 HAVING count(*) > 1)",
    )
    assert dupes == 0


@pytest.mark.parametrize(
    ("fk", "dim"),
    [("date_key", "dim_date"), ("pharmacy_key", "dim_pharmacy"), ("product_key", "dim_product")],
)
def test_no_orphans(con, fk, dim):
    orphans = q(
        con,
        f"SELECT count(*) FROM fct_sales f LEFT JOIN {dim} d USING ({fk}) WHERE d.{fk} IS NULL",
    )
    assert orphans == 0


def test_nothing_was_dropped(con):
    """The raw fact has 62,139 rows and none of them is unusable. A drop here is a bug."""
    assert q(con, "SELECT count(*) FROM fct_sales") == 62_139


def test_margin_identity_holds_on_every_row(con):
    bad = q(
        con,
        "SELECT count(*) FROM fct_sales "
        "WHERE abs(round(revenue_eur - cost_eur, 2) - margin_eur) > 0.0001",
    )
    assert bad == 0


# ---------------------------------------------------------------------------------------
# Headline literals - from integrity.py against the RAW workbook
# ---------------------------------------------------------------------------------------
def test_total_revenue(con):
    assert q(con, "SELECT round(sum(revenue_eur), 2) FROM fct_sales") == 8_633_977.31


def test_total_margin(con):
    assert q(con, "SELECT round(sum(margin_eur), 2) FROM fct_sales") == 2_421_141.07


def test_overall_margin_pct(con):
    """28.04%. The number the whole month is about."""
    v = q(con, "SELECT sum(margin_eur) / sum(revenue_eur) * 100 FROM fct_sales")
    assert round(v, 2) == 28.04


def test_total_units(con):
    assert q(con, "SELECT sum(units_sold) FROM fct_sales") == 445_793


# --- I6, the pre-launch defect ---------------------------------------------------------
def test_prelaunch_line_count(con):
    assert q(con, "SELECT count(*) FROM fct_sales WHERE is_prelaunch") == 6_221


def test_prelaunch_revenue(con):
    v = q(con, "SELECT round(sum(revenue_eur), 2) FROM fct_sales WHERE is_prelaunch")
    assert v == 795_899.33


def test_prelaunch_affects_every_in_window_product(con):
    """47 of 47, zero exceptions. The asymmetry that makes it a finding."""
    in_window = q(con, "SELECT count(*) FROM dim_product WHERE launches_in_window")
    affected = q(con, "SELECT count(DISTINCT product_key) FROM fct_sales WHERE is_prelaunch")
    assert in_window == 47
    assert affected == 47


def test_prelaunch_changes_no_category_ranking(con):
    """The bounding claim. If this ever fails, I6's 'so what' must be rewritten."""
    as_reported = [
        r[0]
        for r in con.execute(
            "SELECT category FROM fct_sales JOIN dim_product USING (product_key) "
            "GROUP BY 1 ORDER BY sum(revenue_eur) DESC"
        ).fetchall()
    ]
    ex_prelaunch = [
        r[0]
        for r in con.execute(
            "SELECT category FROM fct_sales JOIN dim_product USING (product_key) "
            "WHERE NOT is_prelaunch GROUP BY 1 ORDER BY sum(revenue_eur) DESC"
        ).fetchall()
    ]
    assert as_reported == ex_prelaunch


# --- I1, the growth is store count -----------------------------------------------------
def test_same_store_growth_is_essentially_zero(con):
    rows = con.execute(
        "SELECT d.year, sum(f.revenue_eur) FROM fct_sales f "
        "JOIN dim_date d USING (date_key) JOIN dim_pharmacy p USING (pharmacy_key) "
        "WHERE p.cohort = 'established' GROUP BY 1 ORDER BY 1"
    ).fetchall()
    y2024, y2025 = rows[0][1], rows[1][1]
    assert round((y2025 / y2024 - 1) * 100, 2) == 0.07


def test_total_growth_is_4_43_pct(con):
    rows = con.execute(
        "SELECT d.year, sum(f.revenue_eur) FROM fct_sales f JOIN dim_date d USING (date_key) "
        "GROUP BY 1 ORDER BY 1"
    ).fetchall()
    assert round((rows[1][1] / rows[0][1] - 1) * 100, 2) == 4.43


def test_new_stores_are_985_pct_of_growth(con):
    def by_year(where):
        return con.execute(
            "SELECT d.year, sum(f.revenue_eur) FROM fct_sales f "
            "JOIN dim_date d USING (date_key) JOIN dim_pharmacy p USING (pharmacy_key) "
            f"WHERE {where} GROUP BY 1 ORDER BY 1"
        ).fetchall()

    tot = by_year("1=1")
    new = by_year("p.cohort = 'opened_in_window'")
    growth = tot[1][1] - tot[0][1]
    assert round((new[1][1] - new[0][1]) / growth * 100, 1) == 98.5


def test_eleven_stores_opened_in_window(con):
    assert q(con, "SELECT count(*) FROM dim_pharmacy WHERE cohort = 'opened_in_window'") == 11


# --- I5, the lever ---------------------------------------------------------------------
def test_promo_margin_gap_is_9_08pp(con):
    v = q(
        con,
        "SELECT (sum(margin_eur) FILTER (WHERE NOT is_promo) "
        "      / sum(revenue_eur) FILTER (WHERE NOT is_promo) "
        "     - sum(margin_eur) FILTER (WHERE is_promo) "
        "      / sum(revenue_eur) FILTER (WHERE is_promo)) * 100 FROM fct_sales",
    )
    assert round(v, 2) == 9.08


def test_promo_margin_forgone_is_82709(con):
    v = q(
        con,
        "SELECT sum(revenue_eur) FILTER (WHERE is_promo) "
        "     * (sum(margin_eur) FILTER (WHERE NOT is_promo) "
        "      / sum(revenue_eur) FILTER (WHERE NOT is_promo)) "
        "     - sum(margin_eur) FILTER (WHERE is_promo) FROM fct_sales",
    )
    assert round(v) == 82_709


def test_promo_buys_no_units(con):
    """The null. Promo units per line must stay at or below non-promo."""
    promo = q(
        con,
        "SELECT sum(units_sold) FILTER (WHERE is_promo)::DOUBLE "
        "/ count(*) FILTER (WHERE is_promo) FROM fct_sales",
    )
    non = q(
        con,
        "SELECT sum(units_sold) FILTER (WHERE NOT is_promo)::DOUBLE "
        "/ count(*) FILTER (WHERE NOT is_promo) FROM fct_sales",
    )
    assert round(promo, 4) == 7.0226
    assert round(non, 4) == 7.1947
    assert promo < non


def test_promo_line_share(con):
    assert q(con, "SELECT count(*) FROM fct_sales WHERE is_promo") == 7_431


# ---------------------------------------------------------------------------------------
# Premises - asserted here as well as in build.py, so a relaxed `require` still fails
# ---------------------------------------------------------------------------------------
def test_brand_is_nested_in_category(con):
    """If this fails, brand becomes independent evidence and the UI must change."""
    spanning = q(
        con,
        "SELECT count(*) FROM (SELECT brand FROM dim_product GROUP BY 1 "
        "HAVING count(DISTINCT category) > 1)",
    )
    assert spanning == 0
    assert q(con, "SELECT count(DISTINCT brand) FROM dim_product") == 32


def test_city_is_one_to_one_with_region(con):
    """The geography hierarchy is three levels, not the four the README advertises."""
    regions = q(con, "SELECT count(DISTINCT region) FROM dim_pharmacy")
    cities = q(con, "SELECT count(DISTINCT city) FROM dim_pharmacy")
    pairs = q(con, "SELECT count(*) FROM (SELECT DISTINCT region, city FROM dim_pharmacy)")
    assert regions == cities == pairs == 38


def test_region_sits_in_exactly_one_country(con):
    spanning = q(
        con,
        "SELECT count(*) FROM (SELECT region FROM dim_pharmacy GROUP BY 1 "
        "HAVING count(DISTINCT country) > 1)",
    )
    assert spanning == 0


def test_nothing_in_the_file_loses_money(con):
    assert q(con, "SELECT count(*) FROM fct_sales WHERE margin_eur <= 0") == 0
    assert q(con, "SELECT count(*) FROM dim_product WHERE list_price_eur <= standard_cost_eur") == 0


def test_fact_has_no_row_level_margin_pct(con):
    """Rule 1. If someone adds this column, a view will eventually average it."""
    cols = [r[0] for r in con.execute("DESCRIBE fct_sales").fetchall()]
    assert "margin_pct" not in cols


# --- I2, the thesis, read from dim_cut -------------------------------------------------
def test_no_geographic_or_structural_cut_exceeds_chance(con):
    """The month's central claim, as a table row rather than an assertion in prose."""
    n = q(
        con,
        "SELECT count(*) FROM dim_cut "
        "WHERE cut_family IN ('geographic', 'structural') AND exceeds_chance",
    )
    assert n == 0


def test_both_levers_exceed_chance(con):
    """The control. If these were flat too, the file would just be noise throughout."""
    rows = dict(
        con.execute(
            "SELECT cut_label, exceeds_chance FROM dim_cut "
            "WHERE cut_family IN ('assortment', 'lever')"
        ).fetchall()
    )
    assert rows == {"Product category": True, "Promotion": True}


@pytest.mark.parametrize(
    ("cut", "spread"),
    [
        ("Store size band", 0.03),
        ("Pharmacy type", 0.12),
        ("Country", 0.32),
        ("Region", 0.91),
        ("Pharmacy", 4.61),
        ("Product category", 11.66),
        ("Promotion", 9.08),
    ],
)
def test_dim_cut_spreads(con, cut, spread):
    v = q(con, f"SELECT spread_pp FROM dim_cut WHERE cut_label = '{cut}'")
    assert round(v, 2) == spread


def test_bootstrap_yardstick_is_pinned(con):
    """
    The chance spread every "is this real?" claim leans on. Pinned because three artifacts
    once produced three values for it (5.54 / 5.37 / 5.75) purely from RNG stream position
    and group ordering. analysis/integrity.py reproduces this independently from the raw file.
    """
    v = q(con, "SELECT chance_spread_p95_pp FROM dim_cut WHERE cut_label = 'Pharmacy'")
    assert round(v, 2) == 5.73


def test_dim_cut_has_no_city_row(con):
    """City is 1:1 with region; a City row would be a duplicate wearing a second label."""
    assert q(con, "SELECT count(*) FROM dim_cut WHERE cut_label = 'City'") == 0


# --- I3, no seasonality ----------------------------------------------------------------
def test_monthly_revenue_is_flat(con):
    """sd/mean 0.054 across 24 months. Not seasonality by any reading.

    stddev_samp, NOT stddev_pop. duckdb defaults to the population form and polars' .std()
    to the sample form, so the two engines gave 0.0532 and 0.0543 for the same quantity and
    this test caught it. Both are defensible; what is not defensible is the ledger and the
    dashboard quoting different ones. The published figure is the sample sd.
    """
    v = q(
        con,
        "SELECT stddev_samp(r) / avg(r) FROM (SELECT sum(revenue_eur) AS r FROM fct_sales "
        "JOIN dim_date USING (date_key) GROUP BY year_month)",
    )
    assert round(v, 3) == 0.054


def test_weekend_is_the_only_time_signal(con):
    """~18.7% fewer sales LINES at weekends, and no difference in line size."""
    rows = dict(
        con.execute(
            "SELECT is_weekend, avg(n) FROM (SELECT d.is_weekend, d.date_key, count(*) AS n "
            "FROM fct_sales f JOIN dim_date d USING (date_key) GROUP BY 1, 2) GROUP BY 1"
        ).fetchall()
    )
    assert round((rows[True] / rows[False] - 1) * 100, 1) == -18.7
