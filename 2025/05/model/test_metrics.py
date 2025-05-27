"""Metric assertions for 2025/05 Mobile Phone Sales  (Gate G4).

Known-good values, asserted. These are the tests that stop a silent regression in
build.py from putting a wrong number on the poster.

Every figure here is independently reproducible from the raw workbook via
../analysis/integrity.py and ../analysis/questions.sql.py, and via the Malloy model
with `node tools/run_malloy.mjs 2025 05`.

The structural tests (grain, orphans, no-fan-out, revenue arithmetic) are the ones that
matter most: the benchmark field's characteristic failure this month was a polished
dashboard whose headline revenue was wrong by ~600x, almost certainly a join fan-out.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

# ---- known-good headline values, from the raw workbook ---------------------------------
EXPECTED_ROWS = 366  # one per calendar day of 2024 (leap year)
EXPECTED_UNITS = 18_548
EXPECTED_REVENUE = 14_525_413
EXPECTED_ASP = 783.13  # unit-weighted: revenue / units
EXPECTED_MEAN_PRICE = 784.73  # unweighted mean of the price column -- NOT the ASP
EXPECTED_MODELS = 19
EXPECTED_BRANDS = 5
EXPECTED_CITIES = 25
EXPECTED_COUNTRIES = 4


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


def scalar(con, sql):
    return con.execute(sql).fetchone()[0]


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `python 2025/05/model/build.py` first"


# ---------------------------------------------------------------------------------------
# Grain. The single most consequential fact about this dataset.
# ---------------------------------------------------------------------------------------


def test_fact_row_count(con):
    assert scalar(con, "select count(*) from fct_daily_sales") == EXPECTED_ROWS


def test_grain_is_one_row_per_day(con):
    assert (
        scalar(con, "select count(distinct transaction_date) from fct_daily_sales") == EXPECTED_ROWS
    )


def test_date_coverage_is_complete_2024(con):
    lo, hi = con.execute(
        "select min(transaction_date), max(transaction_date) from fct_daily_sales"
    ).fetchone()
    assert str(lo) == "2024-01-01"
    assert str(hi) == "2024-12-31"


def test_source_transaction_id_is_NOT_unique(con):
    """Regression guard on a documented data defect.

    The shipped data dictionary calls Transaction_ID a "Unique transaction ID". It is not:
    303 distinct values across 366 rows. If this ever starts passing as unique, the source
    file changed and every count in the report must be revisited.
    """
    distinct = scalar(con, "select count(distinct source_transaction_id) from fct_daily_sales")
    assert distinct == 303
    assert distinct < EXPECTED_ROWS


# ---------------------------------------------------------------------------------------
# No fan-out, no orphans. This is the class of bug that broke the benchmark field.
# ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fk,dim,pk",
    [
        ("date_key", "dim_date", "date_key"),
        ("product_key", "dim_product", "product_key"),
        ("geography_key", "dim_geography", "geography_key"),
        ("segment_key", "dim_customer_segment", "segment_key"),
    ],
)
def test_no_orphan_foreign_keys(con, fk, dim, pk):
    orphans = scalar(
        con,
        f"select count(*) from fct_daily_sales f "
        f"left join {dim} d on f.{fk} = d.{pk} where d.{pk} is null",
    )
    assert orphans == 0


@pytest.mark.parametrize(
    "dim,pk",
    [
        ("dim_date", "date_key"),
        ("dim_product", "product_key"),
        ("dim_geography", "geography_key"),
        ("dim_customer_segment", "segment_key"),
    ],
)
def test_dimension_keys_are_unique(con, dim, pk):
    assert scalar(con, f"select count(*) - count(distinct {pk}) from {dim}") == 0


def test_star_join_does_not_fan_out(con):
    """Joining every dimension must not change the fact row count."""
    joined = scalar(
        con,
        """
        select count(*) from fct_daily_sales f
          join dim_date             c using (date_key)
          join dim_product          p using (product_key)
          join dim_geography        g using (geography_key)
          join dim_customer_segment s using (segment_key)
        """,
    )
    assert joined == EXPECTED_ROWS


# ---------------------------------------------------------------------------------------
# Headline measures
# ---------------------------------------------------------------------------------------


def test_total_units(con):
    assert scalar(con, "select sum(units_sold) from fct_daily_sales") == EXPECTED_UNITS


def test_total_revenue(con):
    assert scalar(con, "select sum(total_revenue) from fct_daily_sales") == EXPECTED_REVENUE


def test_revenue_arithmetic_reconciles_on_every_row(con):
    bad = scalar(
        con, "select count(*) from fct_daily_sales where total_revenue <> price * units_sold"
    )
    assert bad == 0


def test_asp_is_unit_weighted_not_mean_of_price(con):
    """The two differ by $1.61. The published field reports the unweighted one."""
    asp = scalar(con, "select sum(total_revenue)::double / sum(units_sold) from fct_daily_sales")
    mean_price = scalar(con, "select avg(price) from fct_daily_sales")
    assert round(asp, 2) == EXPECTED_ASP
    assert round(mean_price, 2) == EXPECTED_MEAN_PRICE
    assert round(mean_price - asp, 2) == 1.61


# ---------------------------------------------------------------------------------------
# Dimension cardinality
# ---------------------------------------------------------------------------------------


def test_dimension_cardinality(con):
    assert scalar(con, "select count(*) from dim_product") == EXPECTED_MODELS
    assert scalar(con, "select count(distinct brand) from dim_product") == EXPECTED_BRANDS
    assert scalar(con, "select count(*) from dim_geography") == EXPECTED_CITIES
    assert scalar(con, "select count(distinct country) from dim_geography") == EXPECTED_COUNTRIES
    assert scalar(con, "select count(*) from dim_date") == EXPECTED_ROWS


def test_operating_system_is_determined_by_brand(con):
    """Apple<->iOS, everything else Android. R2's "Android vs iOS" is Apple vs rest."""
    worst = scalar(
        con,
        "select max(n) from (select count(distinct operating_system) n from dim_product group by brand)",
    )
    assert worst == 1


# ---------------------------------------------------------------------------------------
# The five ledger claims. If any of these move, insights.md is wrong.
# ---------------------------------------------------------------------------------------


def test_I2_brand_conversion_gap(con):
    """Samsung +6.46pp, Xiaomi -6.50pp; units leader is not the revenue leader."""
    rows = con.execute(
        """
        select p.brand,
               round(100.0 * sum(f.total_revenue) / sum(sum(f.total_revenue)) over ()
                   -  100.0 * sum(f.units_sold)   / sum(sum(f.units_sold))    over (), 2) gap_pp
        from fct_daily_sales f join dim_product p using (product_key)
        group by 1 order by gap_pp desc
        """
    ).fetchall()
    gaps = dict(rows)
    assert gaps["Samsung"] == pytest.approx(6.46, abs=0.01)
    assert gaps["Xiaomi"] == pytest.approx(-6.50, abs=0.01)
    assert rows[0][0] == "Samsung"
    assert rows[-1][0] == "Xiaomi"

    # the inversion itself: OnePlus leads units, Apple leads revenue
    units_leader = scalar(
        con,
        "select p.brand from fct_daily_sales f join dim_product p using (product_key) "
        "group by 1 order by sum(f.units_sold) desc limit 1",
    )
    revenue_leader = scalar(
        con,
        "select p.brand from fct_daily_sales f join dim_product p using (product_key) "
        "group by 1 order by sum(f.total_revenue) desc limit 1",
    )
    assert units_leader == "OnePlus"
    assert revenue_leader == "Apple"
    assert units_leader != revenue_leader


def test_I3_flagship_concentration(con):
    """Z Fold 6: 11.58% of revenue from 5.74% of trading days."""
    pct_rev, pct_days = con.execute(
        """
        select round(100.0 * sum(f.total_revenue) filter (where p.mobile_model = 'Z Fold 6')
                   / sum(f.total_revenue), 2),
               round(100.0 * count(*) filter (where p.mobile_model = 'Z Fold 6')
                   / count(*), 2)
        from fct_daily_sales f join dim_product p using (product_key)
        """
    ).fetchone()
    assert pct_rev == pytest.approx(11.58, abs=0.01)
    assert pct_days == pytest.approx(5.74, abs=0.01)
    assert pct_rev > 2 * pct_days  # the concentration claim


def test_I3_samsung_owns_best_and_worst_model(con):
    ranked = con.execute(
        """
        select p.mobile_model, p.brand
        from fct_daily_sales f join dim_product p using (product_key)
        group by 1, 2 order by sum(f.total_revenue) desc
        """
    ).fetchall()
    assert ranked[0] == ("Z Fold 6", "Samsung")
    assert ranked[-1] == ("Galaxy M15", "Samsung")


def test_I3_samsung_has_widest_price_ladder(con):
    rows = con.execute(
        "select brand, round(max(list_price)::double / min(list_price), 1) spread "
        "from dim_product group by 1 order by spread desc"
    ).fetchall()
    assert rows[0][0] == "Samsung"
    assert rows[0][1] == pytest.approx(5.3, abs=0.1)
    assert rows[-1][0] == "OnePlus"
    assert rows[-1][1] == pytest.approx(1.5, abs=0.1)


def test_I4_like_for_like_prices_are_flat_across_countries(con):
    """The clincher: same model, same price everywhere => ASP gaps are mix, not pricing.

    Cells with fewer than 3 observations are excluded. That is not a convenience: price
    carries ~3% within-model jitter (range ~$98 on OnePlus 11R), so a 2-observation cell
    can land 14% from the mean by chance alone -- which is exactly what OnePlus 11R in
    Bangladesh (n=2, $605 vs Turkey's n=7, $692) does. Comparing thin cells is the error
    this whole report is about; the test must not commit it.
    """
    sql = """
        with m as (
          select p.mobile_model, g.country, avg(f.price) ap, count(*) n
          from fct_daily_sales f
            join dim_product p using (product_key)
            join dim_geography g using (geography_key)
          group by 1, 2 {having}
        )
        select max(pct) from (
          select mobile_model, (max(ap) - min(ap)) / min(ap) * 100 pct
          from m group by 1 having count(*) > 1
        )
    """
    adequate = scalar(con, sql.format(having="having count(*) >= 3"))
    assert adequate < 8.0, (
        f"a model's price varies {adequate:.1f}% by country on adequate samples - I-4 is invalid"
    )

    # And the documented cause of the apparent exception, so it cannot silently change.
    all_cells = scalar(con, sql.format(having=""))
    assert all_cells > adequate, "thin cells no longer inflate the spread - recheck the caveat"
    worst_thin = con.execute(
        """
        with m as (
          select p.mobile_model, g.country, avg(f.price) ap, count(*) n
          from fct_daily_sales f
            join dim_product p using (product_key)
            join dim_geography g using (geography_key)
          group by 1, 2
        )
        select mobile_model, min(n) from m group by 1
        having (max(ap) - min(ap)) / min(ap) * 100 = (
          select max(pct) from (
            select mobile_model, (max(ap) - min(ap)) / min(ap) * 100 pct
            from m group by 1 having count(*) > 1))
        """
    ).fetchone()
    assert worst_thin[0] == "OnePlus 11R"
    assert worst_thin[1] <= 2, "the worst apparent price gap is no longer driven by a thin cell"


def test_I4_asp_ladder_tracks_premium_mix_monotonically(con):
    rows = con.execute(
        """
        select g.country,
               round(100.0 * sum(f.units_sold) filter (where f.price >= 1000)
                   / sum(f.units_sold), 1) premium_pct,
               round(sum(f.total_revenue)::double / sum(f.units_sold), 0) asp
        from fct_daily_sales f join dim_geography g using (geography_key)
        group by 1 order by asp desc
        """
    ).fetchall()
    assert [r[0] for r in rows] == ["India", "Turkey", "Bangladesh", "Pakistan"]
    premium = [r[1] for r in rows]
    assert premium == sorted(premium, reverse=True), "premium mix no longer tracks ASP"
    assert premium[0] == pytest.approx(30.1, abs=0.1)
    assert premium[-1] == pytest.approx(15.9, abs=0.1)


def test_I5_price_band_leverage(con):
    rows = con.execute(
        """
        select price_band,
               round(100.0 * sum(units_sold)    / sum(sum(units_sold))    over (), 1) unit_pct,
               round(100.0 * sum(total_revenue) / sum(sum(total_revenue)) over (), 1) rev_pct,
               min(price_band_sort) srt
        from fct_daily_sales group by 1 order by srt
        """
    ).fetchall()
    by_band = {r[0]: (r[1], r[2]) for r in rows}
    assert by_band["Premium $1000+"] == (pytest.approx(25.1, abs=0.1), pytest.approx(40.4, abs=0.1))
    assert by_band["Budget <$400"] == (pytest.approx(12.8, abs=0.1), pytest.approx(5.7, abs=0.1))
    # leverage is monotonic across the ladder
    leverage = [r[2] / r[1] for r in rows]
    assert leverage == sorted(leverage), "band leverage is no longer monotonic in price"


def test_I5_six_models_carry_half_the_revenue(con):
    n = scalar(
        con,
        """
        with m as (select product_key, sum(total_revenue) rev from fct_daily_sales group by 1),
             c as (select rev, sum(rev) over (order by rev desc) / sum(rev) over () cum,
                          row_number() over (order by rev desc) rn from m)
        select min(rn) from c where cum >= 0.5
        """,
    )
    assert n == 6


# ---------------------------------------------------------------------------------------
# Coverage guards -- these keep the UI honest about thin samples
# ---------------------------------------------------------------------------------------


def test_thin_sample_flag_catches_pakistan(con):
    thin = con.execute(
        "select city, days_traded from dim_geography where is_thin_sample order by days_traded"
    ).fetchall()
    cities = {c for c, _ in thin}
    # Pakistan's cities are all 1-3 days and must be flagged
    assert {"Multan", "Rawalpindi", "Lahore", "Karachi", "Islamabad"} <= cities
    assert scalar(con, "select min(days_traded) from dim_geography") == 1


def test_pakistan_is_ten_days(con):
    n = scalar(
        con,
        "select count(*) from fct_daily_sales f join dim_geography g using (geography_key) "
        "where g.country = 'Pakistan'",
    )
    assert n == 10, (
        "Pakistan sample size changed - every country comparison caveat must be revisited"
    )


# ---------------------------------------------------------------------------------------
# Corrections locked in on 2025-05-27. Each of the three assertions below replaces a claim
# that was published wrong and that nothing was recomputing. They exist so the *corrected*
# statement is the one that breaks the build if the data ever moves.
# ---------------------------------------------------------------------------------------


def test_I3_the_two_brands_without_a_premium_model_are_the_two_that_convert_below_par(con):
    """The corrected I-3 lever.

    The report used to say OnePlus "converts worst of the four Android brands". It does not:
    OnePlus is -2.85pp, fourth of five; Xiaomi is worst at -6.50pp. The claim that IS true --
    and that is what the So-what panel now ships -- is the premium-band one asserted here.
    """
    rows = con.execute(
        """
        select p.brand,
               count(distinct p.mobile_model)
                   filter (where f.price_band = 'Premium $1000+')          premium_models,
               round(100.0 * sum(f.total_revenue) / sum(sum(f.total_revenue)) over ()
                   -  100.0 * sum(f.units_sold)   / sum(sum(f.units_sold))   over (), 2) gap_pp
        from fct_daily_sales f join dim_product p using (product_key)
        group by 1
        """
    ).fetchall()
    no_premium = {b for b, n, _ in rows if n == 0}
    below_par = {b for b, _, g in rows if g < 0}
    assert no_premium == below_par == {"Xiaomi", "OnePlus"}

    gaps = {b: g for b, _, g in rows}
    assert gaps["Xiaomi"] == pytest.approx(-6.50, abs=0.01)  # the worst converter
    assert gaps["OnePlus"] == pytest.approx(-2.85, abs=0.01)  # fourth of five, NOT worst
    android = {b: g for b, g in gaps.items() if b != "Apple"}
    assert min(android, key=android.get) == "Xiaomi"


def test_I5_budget_to_premium_is_3_63x_not_5_3x(con):
    """5.3x was Samsung's price spread from I-3 copied into the wrong sentence."""
    budget, premium = con.execute(
        """
        select sum(total_revenue) filter (where price_band = 'Budget <$400')::double
                   / sum(units_sold) filter (where price_band = 'Budget <$400'),
               sum(total_revenue) filter (where price_band = 'Premium $1000+')::double
                   / sum(units_sold) filter (where price_band = 'Premium $1000+')
        from fct_daily_sales
        """
    ).fetchone()
    assert budget == pytest.approx(348.22, abs=0.01)
    assert premium == pytest.approx(1263.65, abs=0.01)
    assert premium / budget == pytest.approx(3.63, abs=0.01)


def test_I4_price_effect_is_the_global_mix_contrast_not_the_actual_minus_it(con):
    """I-4's decomposition, with the two effects the right way round.

    price effect = sum_i  w_gi * (p_ci - p_gi)      global mix, own prices
    mix   effect = sum_i (w_ci - w_gi) * p_gi       global prices, own mix
    and the three components sum EXACTLY to ASP_c - global unit-weighted ASP.

    The published text used to label `actual - (own prices, global mix)` the "pricing
    effect". That quantity is sum_i (w_ci - w_gi) * p_ci -- the prices cancel, so it is a
    MIX effect. Asserted here in the corrected orientation.
    """
    rows = con.execute(
        """
        with fp as (
            select g.country, p.mobile_model, sum(f.units_sold) u, sum(f.total_revenue) r
            from fct_daily_sales f
            join dim_product p using (product_key)
            join dim_geography g using (geography_key)
            group by 1, 2
        ),
        gl as (
            select mobile_model, sum(u) gu, sum(r)::double / sum(u) gp from fp group by 1
        ),
        tot as (select sum(gu) tu, sum(gu * gp) / sum(gu) base from gl),
        cty as (select country, sum(u) cu from fp group by 1)
        select c.country,
               sum(c2.r) / sum(c2.u)                                          as asp,
               sum((gl.gu / (select tu from tot))
                   * (coalesce(c2.r / nullif(c2.u, 0), gl.gp) - gl.gp))       as price_eff,
               sum((coalesce(c2.u, 0) / c.cu - gl.gu / (select tu from tot))
                   * gl.gp)                                                   as mix_eff,
               sum((coalesce(c2.u, 0) / c.cu - gl.gu / (select tu from tot))
                   * (coalesce(c2.r / nullif(c2.u, 0), gl.gp) - gl.gp))       as inter
        from cty c
        cross join gl
        left join fp c2 on c2.country = c.country and c2.mobile_model = gl.mobile_model
        group by 1
        """
    ).fetchall()
    by_country = {r[0]: r[1:] for r in rows}
    base = scalar(con, "select sum(total_revenue)::double / sum(units_sold) from fct_daily_sales")
    assert base == pytest.approx(783.13, abs=0.01)

    for country, (asp, price_eff, mix_eff, inter) in by_country.items():
        assert price_eff + mix_eff + inter == pytest.approx(asp - base, abs=1e-6), (
            f"{country}: the decomposition no longer closes on the baseline"
        )
        assert abs(mix_eff) > abs(price_eff), f"{country}: price now outweighs mix"

    # the two markets with enough trading days to carry the claim
    assert by_country["India"][1] == pytest.approx(0.57, abs=0.01)
    assert by_country["Turkey"][1] == pytest.approx(-0.46, abs=0.01)
    assert by_country["India"][2] == pytest.approx(23.26, abs=0.01)
    assert by_country["Turkey"][2] == pytest.approx(6.02, abs=0.01)

    # ... and the mislabelled quantity, shown to be a mix effect: prices cancel out of it
    assert by_country["Turkey"][0] - (base + by_country["Turkey"][1]) == pytest.approx(
        by_country["Turkey"][2] + by_country["Turkey"][3], abs=1e-6
    )


def test_I4_the_thin_cell_exception_is_12_6_percent_not_14_5(con):
    """'X% cheaper in A than B' takes B as the denominator."""
    bd, tr = con.execute(
        """
        select avg(f.price) filter (where g.country = 'Bangladesh'),
               avg(f.price) filter (where g.country = 'Turkey')
        from fct_daily_sales f
        join dim_product p using (product_key)
        join dim_geography g using (geography_key)
        where p.mobile_model = 'OnePlus 11R'
        """
    ).fetchone()
    assert bd == pytest.approx(604.50, abs=0.01)
    assert tr == pytest.approx(692.00, abs=0.01)
    assert 100 * (tr - bd) / tr == pytest.approx(12.64, abs=0.01)  # cheaper than Turkey
    assert 100 * (tr - bd) / bd == pytest.approx(14.47, abs=0.01)  # the wrong denominator
