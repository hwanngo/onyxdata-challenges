"""
Structural assertions on the 2025/11 star schema  (Gate G4).

These are not the rendered-figure checks - `tools/verify_metrics.py` does those against the DOM.
These assert what the *schema* claims, so that if the source file is ever swapped or the build
refactored, the claims in analysis/insights.md break loudly instead of quietly.

Every test corresponds to a claim in the ledger. Where a claim was withdrawn during G3 there is
a test pinning the *correction*, so the wrong version cannot come back.
"""

from __future__ import annotations

import math
from pathlib import Path

import duckdb
import polars as pl
import pytest
from scipy import stats

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    c = duckdb.connect()
    for t in ["fct_event", "dim_customer", "dim_product", "dim_geo", "dim_month", "dim_correction"]:
        c.execute(f"create view {t} as select * from '{CURATED / (t + '.parquet')}'")
    return c


@pytest.fixture(scope="module")
def fact() -> pl.DataFrame:
    return pl.read_parquet(CURATED / "fct_event.parquet")


# ---------------------------------------------------------------------------------------
# Grain and integrity
# ---------------------------------------------------------------------------------------


def test_grain_is_one_row_per_event(con):
    n, uniq = con.execute("select count(*), count(distinct event_id) from fct_event").fetchone()
    assert n == 48_000
    assert uniq == n, "event_id is not unique - the fact grain is wrong"


def test_no_orphans_in_either_direction(con):
    assert (
        con.execute(
            "select count(*) from fct_event e left join dim_customer c using (customer_id)"
            " where c.customer_id is null"
        ).fetchone()[0]
        == 0
    )
    assert (
        con.execute(
            "select count(*) from fct_event e left join dim_product p using (product_id)"
            " where p.product_id is null"
        ).fetchone()[0]
        == 0
    )


def test_every_customer_appears_in_the_fact(con):
    assert con.execute("select count(*) from dim_customer").fetchone()[0] == 4_000
    assert (
        con.execute(
            "select count(*) from dim_customer where customer_id not in"
            " (select customer_id from fct_event)"
        ).fetchone()[0]
        == 0
    )


# ---------------------------------------------------------------------------------------
# Rule 1 - the three revenue columns
# ---------------------------------------------------------------------------------------


def test_the_three_revenue_columns_are_ordered(fact):
    """net <= ex_tax <= reported on every row. If this fails, a measure is lying."""
    assert (fact["net_usd"] <= fact["ex_tax_usd"] + 1e-9).all()
    assert (fact["ex_tax_usd"] <= fact["reported_usd"] + 1e-9).all()


def test_the_correction_is_12_percent(con):
    rep, net = con.execute("select sum(reported_usd), sum(net_usd) from fct_event").fetchone()
    assert rep == pytest.approx(31_832_281, abs=1)
    assert net == pytest.approx(28_006_708, abs=1)
    assert 100 * (rep - net) / rep == pytest.approx(12.02, abs=0.01)


def test_tax_is_the_bulk_of_the_correction(con):
    """C4's tautology caveat rests on this: tax is 85% of the correction, refunds the rest."""
    tax, refunded = con.execute(
        "select sum(tax_usd), sum(ex_tax_usd) filter (where is_refunded) from fct_event"
    ).fetchone()
    assert tax / (tax + refunded) == pytest.approx(0.8516, abs=0.001)


def test_refunded_events_contribute_exactly_zero(con):
    q = "select count(*) from fct_event where is_refunded and net_usd <> 0"
    assert con.execute(q).fetchone()[0] == 0


# ---------------------------------------------------------------------------------------
# THE THESIS - the correction is flat except on geography
# ---------------------------------------------------------------------------------------


def test_geographic_cuts_separate_from_every_other_cut(con):
    """The load-bearing claim. Not a literal - recomputed from dim_correction."""
    worst_non_geo, best_geo = con.execute("""
        select (select max(span) from dim_correction
                where cut not in ('country','region','currency','discount_code')),
               (select min(span) from dim_correction
                where cut in ('country','region','currency'))
    """).fetchone()
    assert worst_non_geo < 5.0, "a non-geographic cut has become large"
    assert best_geo > 13.0, "a geographic cut has become small"
    assert best_geo - worst_non_geo > 8.0, "the separation has collapsed"


def test_discount_code_span_is_geography_in_disguise(con):
    """C14. The 13.99pp discount-code span is not a fourth geography - it is SALE15 being
    US-only (0% tax) and LOYALTY15 non-US-only. Pinned so the caveat cannot rot."""
    sale_us, loyal_us = con.execute("""
        select (select 100.0 * count(*) filter (where country = 'United States') / count(*)
                from fct_event where discount_code = 'SALE15'),
               (select 100.0 * count(*) filter (where country = 'United States') / count(*)
                from fct_event where discount_code = 'LOYALTY15')
    """).fetchone()
    assert sale_us == 100.0
    assert loyal_us == 0.0


def test_the_region_ranking_flips(con):
    """C3c - the strongest single consequence of the thesis."""
    rep = con.execute(
        "select region from fct_event group by 1 order by sum(reported_usd) desc limit 1"
    ).fetchone()[0]
    net = con.execute(
        "select region from fct_event group by 1 order by sum(net_usd) desc limit 1"
    ).fetchone()[0]
    assert rep == "EU"
    assert net == "North America"


def test_ex_tax_asp_does_not_differ_by_country(fact):
    """C3, the corrected version. An earlier draft ranked countries on this measure and named
    Canada the leader. Kruskal-Wallis says there is nothing to rank."""
    rep = [g["reported_usd"].to_numpy() for _, g in fact.group_by("country")]
    ex = [g["ex_tax_usd"].to_numpy() for _, g in fact.group_by("country")]
    assert stats.kruskal(*rep).pvalue < 1e-20, "reported ASP should differ sharply by country"
    assert stats.kruskal(*ex).pvalue > 0.05, "ex-tax ASP should NOT differ by country"


# ---------------------------------------------------------------------------------------
# C3 - the published test statistics, and the quantisation they depend on.
#
# The integrity pass found that the headline p = 0.853 did not reproduce from the shipped
# parquet at all: it had been computed on unquantised float64 revenue. Kruskal-Wallis is a
# rank test, so the tie structure IS the statistic, and the tie structure is decided by which
# doubles the money columns hold. These tests pin all three layers together - the SQL in
# metric_checks.yml, scipy, and the integer cents the browser receives - so the number cannot
# drift away from the data again without something here going red.
# ---------------------------------------------------------------------------------------


def _metric_sql(name: str) -> str:
    import yaml

    spec = yaml.safe_load((Path(__file__).resolve().parent / "metric_checks.yml").read_text())
    return spec["metrics"][name]


def _kw_h(fact: pl.DataFrame, expr) -> float:
    groups = [expr(g).to_numpy() for _, g in fact.group_by("country")]
    return float(stats.kruskal(*groups).statistic)


@pytest.mark.parametrize(
    ("metric", "column"),
    [
        ("asp_kw_h_reported", lambda g: g["reported_usd"]),
        ("asp_kw_h_ex_tax", lambda g: g["ex_tax_usd"]),
        ("asp_kw_h_per_unit_reported", lambda g: g["reported_usd"] / g["quantity"]),
        ("asp_kw_h_per_unit_ex_tax", lambda g: g["ex_tax_usd"] / g["quantity"]),
    ],
)
def test_kruskal_wallis_sql_matches_scipy(con, fact, metric, column):
    """The tie-corrected H in metric_checks.yml is real Kruskal-Wallis, not an approximation.

    verify_metrics.py trusts that SQL to police the browser's own implementation, so if the
    SQL were subtly wrong the whole check would be theatre."""
    assert con.execute(_metric_sql(metric)).fetchone()[0] == pytest.approx(
        _kw_h(fact, column), rel=1e-9
    )


def test_the_published_p_values_are_what_the_data_says(con, fact):
    """The four figures the report prints, to the precision it prints them at.

    p is derived from H by the chi-square survival function - app/src/stats.ts implements the
    same incomplete gamma in TypeScript because DuckDB has no chi-square CDF. df is
    countries - 1, and `countries` is itself asserted by metric_checks.yml."""
    df = con.execute("select count(*) - 1 from dim_geo").fetchone()[0]
    assert df == 9

    p = {
        m: stats.chi2.sf(con.execute(_metric_sql(m)).fetchone()[0], df)
        for m in (
            "asp_kw_h_reported",
            "asp_kw_h_ex_tax",
            "asp_kw_h_per_unit_reported",
            "asp_kw_h_per_unit_ex_tax",
        )
    }

    # Reported revenue per event differs sharply; ex-tax it does not differ at all.
    assert p["asp_kw_h_reported"] == pytest.approx(6.9e-23, rel=5e-2)
    assert p["asp_kw_h_ex_tax"] == pytest.approx(0.862, abs=5e-4)
    # The same conclusion on the true per-unit price, which is a sharper contrast both ways.
    assert p["asp_kw_h_per_unit_reported"] < 1e-70
    assert p["asp_kw_h_per_unit_ex_tax"] == pytest.approx(0.243, abs=5e-4)
    # The one that must never come back: 0.853 was computed on data the app does not ship.
    assert abs(p["asp_kw_h_ex_tax"] - 0.853) > 1e-3


def test_money_columns_are_the_same_doubles_the_browser_receives(fact):
    """THE INVARIANT BEHIND THE ABOVE, and this month's own stated lesson.

    app/src/data.json transports integer cents; the parquet holds dollars. If those two
    disagree by even one unit in the last place, a rank test run in the browser and the same
    test run in SQL tie differently and produce different p-values - which is exactly what
    happened here (H = 4.6749 against 4.6639). Polars evaluates `x / 100` as `x * 0.01`, so
    `(x*100).round()/100` alone does NOT land on the nearest double to k/100; build.py's
    `_cents()` adds the `.round(2)` that fixes it. This test is what stops that regressing."""
    import json

    payload = json.loads((Path(__file__).resolve().parents[1] / "app/src/data.json").read_text())
    cents = {"reported_usd": payload["reported"], "tax_usd": payload["tax"]}
    for col, ints in cents.items():
        shipped = [c / 100 for c in ints]
        assert fact[col].to_list() == shipped, f"{col} differs from the payload's integer cents"

    # ...and the DERIVED columns too, subtracted in cents on both sides.
    ex = [(r - t) / 100 for r, t in zip(payload["reported"], payload["tax"], strict=True)]
    assert fact["ex_tax_usd"].to_list() == ex
    net = [0.0 if f else v for v, f in zip(ex, payload["isRefunded"], strict=True)]
    assert fact["net_usd"].to_list() == net


def test_black_friday_codes_have_no_black_friday(con, fact):
    """C14. Chi-square against the file's own base rate, binned by CALENDAR month (df = 11)."""
    chi2 = con.execute(_metric_sql("bfcm_month_chi2")).fetchone()[0]
    f2 = fact.with_columns(cm=pl.col("event_date").dt.month())
    grouped = f2.group_by("cm").agg(
        n=pl.len(), o=pl.col("discount_code").is_in(["BFCM10", "BFCM20"]).sum()
    )
    rate = grouped["o"].sum() / grouped["n"].sum()
    expected = grouped["n"].to_numpy() * rate
    want = float((((grouped["o"].to_numpy() - expected) ** 2) / expected).sum())
    assert chi2 == pytest.approx(want, rel=1e-9)
    assert stats.chi2.sf(chi2, 11) == pytest.approx(0.867, abs=5e-4)


def test_the_asp_axis_measures_revenue_per_event_not_per_unit(fact):
    """M-2. The two are not interchangeable, which is why the axis had to be renamed: quantity
    is a seat tier, so dividing by it changes the measure and every figure derived from it."""
    assert fact["quantity"].mean() == pytest.approx(6.0265, abs=1e-3)
    assert fact["quantity"].min() == 1
    assert fact["quantity"].max() == 25
    per_event = fact.group_by("country").agg(a=pl.col("reported_usd").mean())["a"]
    per_unit = fact.group_by("country").agg(a=(pl.col("reported_usd") / pl.col("quantity")).mean())[
        "a"
    ]
    assert per_event.min() > 500 and per_unit.max() < 200, (
        "per-event and per-unit are different measures on different scales; a label that names"
        " one while the query computes the other is the defect M-2 recorded"
    )


# ---------------------------------------------------------------------------------------
# Rule 2 - geography is one dimension wearing three names
# ---------------------------------------------------------------------------------------


def test_region_and_currency_are_functionally_dependent_on_country(con):
    assert (
        con.execute(
            "select count(*) from (select country from fct_event group by 1"
            " having count(distinct region) > 1 or count(distinct currency) > 1)"
        ).fetchone()[0]
        == 0
    )


def test_the_blank_region_is_exactly_north_america(con):
    rows = con.execute(
        "select country from fct_event where region = 'North America' group by 1 order by 1"
    ).fetchall()
    assert [r[0] for r in rows] == ["Canada", "United States"]


def test_tax_rates_are_statutory_on_the_undiscounted_price(con):
    """C3d. Rates are 0/5/10/15/20% against the PRE-discount gross. Against the post-discount
    base they are not round numbers - which is how profile.md got it wrong the first time."""
    q = "select distinct tax_rate_statutory from dim_geo order by 1"
    rates = [r[0] for r in con.execute(q).fetchall()]
    assert [round(x, 2) for x in rates] == [0.0, 0.05, 0.10, 0.15, 0.20]
    worst = con.execute("""
        select max(abs(tax_local - round(tax_rate_statutory * quantity * unit_price_local, 2)))
        from fct_event
    """).fetchone()[0]
    # 0.011 not 0.01: the true max deviation is one cent of rounding, and comparing a float
    # sum against a literal 0.01 fails on representation error alone (0.010000000000047748).
    assert worst <= 0.011, "tax is not round(rate x undiscounted gross, 2)"


# ---------------------------------------------------------------------------------------
# Rule 3 - the customer clock
# ---------------------------------------------------------------------------------------


def test_signup_date_is_not_an_acquisition_date(con):
    n, custs = con.execute(
        "select count(*), count(distinct customer_id) from fct_event where before_signup"
    ).fetchone()
    assert n == 18_187
    assert custs == 3_007


def test_there_is_no_cohort_dimension(con):
    """Deliberate absence (build.py decision 3). If someone adds one, this fails and they have
    to argue for it in the ledger first."""
    assert not (CURATED / "dim_cohort.parquet").exists()


# ---------------------------------------------------------------------------------------
# Loyalty has no variance - and the reason is structural
# ---------------------------------------------------------------------------------------


def test_almost_every_customer_is_a_repeat_buyer(con):
    q = "select count(*) from dim_customer where is_repeat_buyer"
    assert con.execute(q).fetchone()[0] == 3_995


def test_events_per_customer_is_exactly_twelve(con):
    """C10, the corrected claim. 48,000 events over exactly 4,000 customers. This is the tell
    that the file is a fixed pool dealt out, not a sample - which is why var/mean is ~1 and why
    the earlier 'Poisson draw' reading was withdrawn."""
    mean = con.execute("select avg(events) from dim_customer").fetchone()[0]
    assert mean == 12.0, "the exact-12.0 allocation is the basis of C10"


def test_var_over_mean_is_what_a_fixed_pool_forces(con):
    """Pins the correction: var/mean near 1 is NOT evidence of a Poisson process here, because a
    multinomial allocation of N events over C cells forces it toward 1 - 1/C."""
    mean, var = con.execute("select avg(events), var_samp(events) from dim_customer").fetchone()
    assert abs(var / mean - 1) < 0.05
    assert math.isclose(1 - 1 / 4000, 0.99975, abs_tol=1e-5)


# ---------------------------------------------------------------------------------------
# The catalogue merge
# ---------------------------------------------------------------------------------------


def test_the_merge_changes_the_top_product(con):
    """C22. Grouped by family the #1 is ChatGPT Team Annual; grouped by the file's own key it
    does not appear in the top five at all."""
    top_family = con.execute(
        "select family_name from fct_event group by 1 order by sum(net_usd) desc limit 1"
    ).fetchone()[0]
    assert top_family == "ChatGPT Team Annual"
    naive_top5 = [
        r[0]
        for r in con.execute(
            "select family_name from fct_event group by product_id, family_name"
            " order by sum(net_usd) desc limit 5"
        ).fetchall()
    ]
    assert "ChatGPT Team Annual" not in naive_top5


def test_pure_duplicate_families_share_one_price(con):
    assert (
        con.execute(
            "select count(*) from (select family from dim_product where is_pure_dup group by 1"
            " having count(distinct base_price_usd) > 1)"
        ).fetchone()[0]
        == 0
    )
    q = "select count(distinct family) from dim_product where is_pure_dup"
    assert con.execute(q).fetchone()[0] == 6


# ---------------------------------------------------------------------------------------
# Refunds concentrate nowhere
# ---------------------------------------------------------------------------------------


def test_refund_rate_is_flat_across_every_dimension(fact):
    for col in ["channel", "category", "country", "region", "billing_cycle", "payment_method"]:
        tab = (
            fact.group_by(col, "is_refunded")
            .len()
            .pivot(on="is_refunded", index=col, values="len")
            .fill_null(0)
        )
        _, p, _, _ = stats.chi2_contingency(tab.drop(col).to_numpy())
        assert p > 0.05, f"refunds are no longer independent of {col} (p={p:.4f})"
