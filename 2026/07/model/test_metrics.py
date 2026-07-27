"""Metric assertions for 2026/07 Global AI Adoption & Workforce Displacement  (Gate G4).

Known-good literals from analysis/integrity.py running against the RAW CSVs. A test that
recomputes a number the same way build.py does proves only self-consistency - the failure the
2026-07 audit found across eight months of tooling. So `raw` reads the CSVs directly and `con`
reads the curated parquet, and the tests assert both agree AND match a hand-written literal.

Four claims the page cannot survive losing:

  1. a STEP fits better than a line, and both within-era slopes are flat
  2. the step is real and large (the positive control)
  3. the risk index correlates with none of its eight candidate drivers
  4. jobs_created is jobs_displaced rescaled, and nothing ever nets positive

Run: just test-model 2026 07
"""

from pathlib import Path

import duckdb
import pytest

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
DATA = next(MONTH.rglob("fact_workforce_ai_index.csv")).parent


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


@pytest.fixture(scope="module")
def raw():
    c = duckdb.connect()
    for p in DATA.glob("*.csv"):
        c.execute(
            f"CREATE VIEW {p.stem} AS SELECT * FROM read_csv_auto('{p}', normalize_names=true)"
        )
    return c


def one(c, sql):
    return c.execute(sql).fetchone()[0]


# ---------------------------------------------------------------------------------------
# shape
# ---------------------------------------------------------------------------------------


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model 2026 07` first"


def test_row_counts_match_raw(con, raw):
    assert one(con, "SELECT count(*) FROM fact_index") == 300
    assert one(raw, "SELECT count(*) FROM fact_workforce_ai_index") == 300


def test_no_rows_lost_or_invented(con, raw):
    """build.py joins four dimensions onto the fact. A fan-out would inflate every measure."""
    assert one(con, "SELECT count(*) FROM fact_index") == one(
        raw, "SELECT count(*) FROM fact_workforce_ai_index"
    )


def test_index_id_unique(con):
    assert one(con, "SELECT count(DISTINCT index_id) FROM fact_index") == 300


# ---------------------------------------------------------------------------------------
# CLAIM 1 + 2 - the step
# ---------------------------------------------------------------------------------------


def test_the_step_beats_the_line(con):
    step, lin, ratio = con.execute(
        "SELECT ss_step, ss_linear, step_beats_line_by FROM headline"
    ).fetchone()
    assert step < lin
    assert ratio > 3.0, "the step must remain the better description"
    assert abs(ratio - 3.61) < 0.05


def test_both_within_era_slopes_are_flat(con):
    """If either era acquires a slope, 'one step and nothing since' is no longer true."""
    p_pre, p_post = con.execute("SELECT pre_slope_p, post_slope_p FROM headline").fetchone()
    assert p_pre > 0.5 and p_post > 0.5


def test_the_line_would_have_been_significant(con):
    """The trap only matters because the wrong fit looks convincing."""
    slope, r2, p = con.execute("SELECT linear_slope, linear_r2, linear_p FROM headline").fetchone()
    assert p < 0.001
    assert r2 > 0.6
    assert 1.6 < slope < 1.8


def test_the_step_is_real_and_large(con):
    """The positive control. Without it, every null on the page is indistinguishable from
    not having looked."""
    d, p, size = con.execute(
        "SELECT era_cliffs_delta, era_mw_p, step_size_pp FROM headline"
    ).fetchone()
    assert abs(d) > 0.5
    assert p < 1e-15
    assert 18.0 < size < 18.5


def test_the_step_lands_on_the_flag(con):
    """The first generative_ai_era quarter is the one where the level changes."""
    rows = con.execute("""
        SELECT date_id, generative_ai_era, mean_adoption FROM fact_quarter ORDER BY date_id
    """).fetchall()
    first_era = min(r[0] for r in rows if r[1])
    assert first_era == 8
    before = [r[2] for r in rows if r[0] < 8]
    after = [r[2] for r in rows if r[0] >= 8]
    assert max(before) < min(after), "the two eras must not overlap in level"


def test_both_fits_are_stored(con):
    """A model storing only the series would let a panel draw a regression line through it."""
    cols = [r[0] for r in con.execute("DESCRIBE fact_quarter").fetchall()]
    assert "step_fit" in cols and "linear_fit" in cols


# ---------------------------------------------------------------------------------------
# CLAIM 3 - the risk index measures nothing
# ---------------------------------------------------------------------------------------


def test_no_driver_predicts_the_risk_index(con):
    n, related, maxrho = con.execute(
        "SELECT risk_drivers_tested, risk_drivers_related, risk_max_abs_rho FROM headline"
    ).fetchone()
    assert n == 8
    assert related == 0
    assert maxrho < 0.10


def test_risk_does_not_differ_by_skill(con):
    p, eta = con.execute("SELECT skill_kruskal_p, skill_eta2 FROM headline").fetchone()
    assert p > 0.5
    assert eta < 0.01


def test_the_dimension_own_score_does_not_rank_risk(con):
    """Manual Skilled Trades has the highest replaceability and is not the highest risk."""
    top_replace = con.execute(
        "SELECT skill_category_name FROM fact_skill ORDER BY ai_replaceability_score DESC LIMIT 1"
    ).fetchone()[0]
    top_risk = con.execute(
        "SELECT skill_category_name FROM fact_skill ORDER BY mean_risk DESC LIMIT 1"
    ).fetchone()[0]
    assert top_replace != top_risk


# ---------------------------------------------------------------------------------------
# CLAIM 4 - jobs_created is not a measurement
# ---------------------------------------------------------------------------------------


def test_jobs_created_is_displaced_rescaled(con, raw):
    slope, r2 = con.execute("SELECT jobs_created_slope, jobs_created_r2 FROM headline").fetchone()
    assert 0.40 < slope < 0.43
    assert r2 > 0.8
    # independently from the raw CSV
    assert (
        one(
            raw,
            """
        SELECT regr_r2(jobs_created_count, jobs_displaced_count)
        FROM fact_workforce_ai_index
    """,
        )
        > 0.8
    )


def test_nothing_ever_nets_positive(con, raw):
    assert one(con, "SELECT rows_net_positive FROM headline") == 0
    assert (
        one(
            raw,
            """
        SELECT count(*) FROM fact_workforce_ai_index
        WHERE jobs_created_count > jobs_displaced_count
    """,
        )
        == 0
    )
    assert one(con, "SELECT net_jobs FROM headline") < -250_000


def test_there_is_no_net_jobs_measure(con):
    """DECISION 4: a net-jobs total would rank countries by displacement under another name."""
    cols = [r[0] for r in con.execute("DESCRIBE fact_index").fetchall()]
    assert "net_jobs" not in cols
    assert "jobs_created_residual" in cols


# ---------------------------------------------------------------------------------------
# the panel, the headline, the defects
# ---------------------------------------------------------------------------------------


def test_there_is_no_panel(con):
    segs, twice = con.execute("SELECT segments, segments_seen_twice FROM headline").fetchone()
    assert segs == 292
    assert twice == 8
    assert one(con, "SELECT max(observations) FROM dim_segment") == 2


def test_cube_is_almost_empty(con):
    cells, pct = con.execute("SELECT cube_cells, cube_fill_pct FROM headline").fetchone()
    assert cells == 96_000
    assert pct < 0.35


def test_the_reskilling_headline(con, raw):
    per, total, disp = con.execute(
        "SELECT reskilling_per_displaced_worker, reskilling_total_usd, jobs_displaced_total "
        "FROM headline"
    ).fetchone()
    assert abs(per - 105.07) < 0.01
    assert disp == 586_785
    assert (
        abs(total - one(raw, "SELECT sum(reskilling_investment_usd) FROM fact_workforce_ai_index"))
        < 1
    )


def test_reskilling_tracks_nothing(con):
    rho, p = con.execute("SELECT reskilling_rho, reskilling_p FROM headline").fetchone()
    assert abs(rho) < 0.2
    assert p > 0.05


def test_development_tier_does_not_separate(con, raw):
    p = one(con, "SELECT tier_kruskal_p FROM headline")
    assert p > 0.5

    # ...and the same test recomputed from the RAW CSVs, on scipy rather than on the stored
    # scalar. `tier_kruskal_p` is one of only two figures in metric_checks.yml that reads
    # `headline`, so without this it would be verified against itself.
    from scipy import stats

    groups = [
        [
            r[0]
            for r in raw.execute(
                "SELECT f.ai_adoption_rate FROM fact_workforce_ai_index f "
                "JOIN dim_country c USING (country_id) WHERE c.development_tier = ?",
                [tier],
            ).fetchall()
        ]
        for (tier,) in raw.execute(
            "SELECT DISTINCT development_tier FROM dim_country ORDER BY 1"
        ).fetchall()
    ]
    assert abs(float(stats.kruskal(*groups).pvalue) - p) < 1e-9


def test_no_country_attribute_predicts_adoption(con, raw):
    """The footer prints "no country attribute reaches |rho| = X" and omits the world map on
    that basis. X is recomputed here from the RAW CSVs by scipy, against the curated value -
    metric_checks.yml gets it a third way, as a rank correlation in SQL."""
    from scipy import stats

    rows = raw.execute("""
        SELECT c.digital_infrastructure_score, c.internet_penetration_pct,
               c.stem_graduates_per_100k, f.ai_adoption_rate
        FROM fact_workforce_ai_index f JOIN dim_country c USING (country_id)
    """).fetchall()
    adopt = [r[3] for r in rows]
    rs = [stats.spearmanr([r[i] for r in rows], adopt) for i in range(3)]

    assert max(abs(r.statistic) for r in rs) < 0.10, "a country attribute now predicts adoption"
    assert min(r.pvalue for r in rs) > 0.05

    assert (
        abs(
            one(con, "SELECT country_max_abs_rho FROM headline") - max(abs(r.statistic) for r in rs)
        )
        < 1e-9
    )
    assert abs(one(con, "SELECT country_min_p FROM headline") - min(r.pvalue for r in rs)) < 1e-9

    # gdp_per_capita_usd is deliberately NOT in that list: DECISION 5 drops it before any
    # correlation can be taken, so the claim is about the three attributes that survive.
    cols = [r[0] for r in con.execute("DESCRIBE fact_index").fetchall()]
    assert "gdp_per_capita_usd" not in cols


def test_the_broken_gdp_column_is_gone(con):
    """It is ~500x too large with an implausible ordering, so it is unusable even as a rank
    proxy. It survives only in the defect ledger."""
    cols = [r[0] for r in con.execute("DESCRIBE fact_index").fetchall()]
    assert "gdp_per_capita_usd" not in cols
    assert one(con, "SELECT count(*) FROM dim_defect WHERE column_name = 'gdp_per_capita_usd'") == 1


def test_question_ledger(con):
    asked, answerable = con.execute(
        "SELECT questions_asked, questions_answerable FROM headline"
    ).fetchone()
    assert asked == 10
    assert answerable == 1, "exactly one of the ten questions has a real answer"


def test_defect_ledger(con):
    assert one(con, "SELECT count(*) FROM dim_defect") == 7
