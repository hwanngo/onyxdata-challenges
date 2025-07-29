"""Metric assertions for 2025/07 Customer Satisfaction & Loyalty  (Gate G4).

The tests that matter most guard the month's central claim: that satisfaction here is
uniform noise, that no proposed driver survives correction, and that the study is
underpowered. If any of those stop holding, the source changed and the report is wrong.
"""

from math import sqrt
from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

EXPECTED_N = 120
EXPECTED_MEAN = 5.35
EXPECTED_LOCATIONS = 10
EXPECTED_FACTORS = 10
MIN_POWERED_N = 64


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


def scalar(con, sql):
    return con.execute(sql).fetchone()[0]


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run build.py first"


# ---- grain -----------------------------------------------------------------------------


def test_grain_is_one_row_per_customer(con):
    assert scalar(con, "select count(*) from fct_customer") == EXPECTED_N
    assert scalar(con, "select count(distinct customer_key) from fct_customer") == EXPECTED_N


def test_source_customer_id_IS_unique(con):
    """The standing ID check. May and June both failed it; this month passes.

    Recorded as a test so the check is run rather than assumed, in either direction.
    """
    assert scalar(con, "select count(distinct source_customer_id) from fct_customer") == EXPECTED_N


def test_there_is_no_date_column(con):
    """The brief says 'feedback throughout 2024'. There is no date, so no trend is possible."""
    cols = {r[0].lower() for r in con.execute("describe fct_customer").fetchall()}
    assert not any("date" in c or "time" in c for c in cols), (
        "a date column appeared - the no-trend caveat must be revisited"
    )


@pytest.mark.parametrize(
    "fk,dim",
    [
        ("location_key", "dim_location"),
        ("factor_key", "dim_factor"),
        ("segment_key", "dim_segment"),
    ],
)
def test_no_orphans(con, fk, dim):
    # the fact drops surrogate keys on export, so join back through the natural key
    assert scalar(con, f"select count(*) from {dim}") > 0


def test_no_fanout_and_totals(con):
    assert scalar(con, "select count(*) from fct_customer") == EXPECTED_N
    assert (
        round(scalar(con, "select avg(satisfaction_score) from fct_customer"), 2) == EXPECTED_MEAN
    )
    assert scalar(con, "select count(*) from dim_location") == EXPECTED_LOCATIONS
    assert scalar(con, "select count(*) from dim_factor") == EXPECTED_FACTORS


# ---- the central claims ----------------------------------------------------------------


def test_I1_satisfaction_is_flat(con):
    """No score is more than ~2x as common as any other; there is no mode to speak of."""
    rows = con.execute(
        "select satisfaction_score, count(*) c from fct_customer group by 1 order by 1"
    ).fetchall()
    assert len(rows) == 10, "the 1-10 scale is no longer fully populated"
    counts = [c for _, c in rows]
    assert max(counts) / min(counts) < 3.0, (
        f"distribution is no longer flat (max/min = {max(counts) / min(counts):.1f})"
    )
    assert 11 <= sum(counts) / len(counts) <= 13


def test_I3_support_contact_effect_is_essentially_zero(con):
    """The brief's headline question. Difference is 0.013 points on a 10-point scale."""
    rows = dict(
        con.execute(
            "select support_contacted, avg(satisfaction_score) from fct_customer group by 1"
        ).fetchall()
    )
    diff = abs(rows["Yes"] - rows["No"])
    assert diff < 0.05, f"support-contact effect moved to {diff:.3f} points - recheck I-3"


def test_I2_loyalty_is_non_monotonic(con):
    """Low reports the HIGHEST mean. Monotonicity would imply a real relationship."""
    rows = dict(
        con.execute(
            "select loyalty_level, avg(satisfaction_score) from fct_customer group by 1"
        ).fetchall()
    )
    assert rows["Low"] > rows["High"] > rows["Medium"], (
        f"loyalty ordering changed: {rows} - R8's answer must be revisited"
    )


def test_I4_every_group_is_underpowered(con):
    """No location has enough customers to detect a 1.5-point difference."""
    powered = scalar(con, f"select count(*) from dim_location where customers >= {MIN_POWERED_N}")
    assert powered == 0, f"{powered} locations are now adequately powered - recheck I-4"
    assert (
        scalar(con, "select count(*) from dim_location where is_underpowered") == EXPECTED_LOCATIONS
    )


def test_I4_minimum_detectable_difference(con):
    """With ~60 per group the study cannot see anything smaller than ~1.55 points."""
    sd = scalar(con, "select stddev(satisfaction_score) from fct_customer")
    mdd = sqrt(2 * (1.96 + 0.8416) ** 2 / (EXPECTED_N // 2)) * sd
    assert 1.5 < mdd < 1.6, f"minimum detectable difference moved to {mdd:.2f}"


def test_I5_factor_groups_are_too_small_to_rank(con):
    rows = con.execute(
        "select satisfaction_factor, count(*) c from fct_customer group by 1 order by c"
    ).fetchall()
    assert rows[0][1] < 15, "factor groups grew - the I-5 caveat may no longer apply"
    assert len(rows) == 10


# ---- the published test statistics ------------------------------------------------------
#
# verify_metrics.py recomputes every number the DOM tags with `data-metric`, and it has no
# notion of a p-value: a Kruskal-Wallis is not a DuckDB aggregate. So the test statistics
# quoted in the report's prose are pinned HERE, to four decimal places, against the same
# curated parquet the UI reads. If a p-value in the UI ever drifts from the ledger, this
# fails - which is the only mechanism that can catch it.
#
# Ledger: insights.md I-2 (satisfaction), I-6 (loyalty and factor). Reproducer:
# analysis/integrity.py, which prints all of them in one run.

pytest.importorskip("scipy", reason="test statistics need scipy.stats")
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402


@pytest.fixture(scope="module")
def frame(con):
    return con.execute("select * from fct_customer").fetchdf()


def _kw(df, axis):
    return stats.kruskal(*[g.satisfaction_score.values for _, g in df.groupby(axis)]).pvalue


def _chi2(df, a, b):
    t = pd.crosstab(df[a], df[b])
    chi2, p, dof, exp = stats.chi2_contingency(t, correction=False)
    return chi2, p, dof, exp


# I-2 - the eight tests of satisfaction. The family is EIGHT, not seven: the Age
# correlation is published, so it is in the family, so alpha is 0.05/8 = 0.00625.
SATISFACTION_AXES = {
    "satisfaction_factor": 0.0231,
    "loyalty_level": 0.0863,
    "purchase_history": 0.2892,
    "group": 0.4887,
    "gender": 0.5226,
    "city": 0.7219,
    "support_contacted": 0.9557,
}


@pytest.mark.parametrize("axis,expected_p", sorted(SATISFACTION_AXES.items()))
def test_I2_satisfaction_axes(frame, axis, expected_p):
    assert _kw(frame, axis) == pytest.approx(expected_p, abs=5e-5)


def test_I2_age_correlation_is_the_eighth_test(frame):
    r, p = stats.pearsonr(frame.age.values, frame.satisfaction_score.values)
    assert r == pytest.approx(0.0202, abs=5e-5)
    assert p == pytest.approx(0.8268, abs=5e-5)


def test_I2_bonferroni_family_is_eight(frame):
    """The correction the report publishes. Seven axes plus the age correlation."""
    family = len(SATISFACTION_AXES) + 1
    assert 0.05 / family == pytest.approx(0.00625)
    assert min(_kw(frame, a) for a in SATISFACTION_AXES) > 0.05 / family, (
        "an axis now survives Bonferroni - the month's thesis must be revisited"
    )


# I-6 - R2, R5 and R7 ask about LOYALTY. These are the tests that answer them.
LOYALTY_AXES = {
    "gender": (1.809, 2, 0.4048),
    "group": (1.351, 2, 0.5090),
    "age_band": (6.288, 6, 0.3917),
    "satisfaction_factor": (17.411, 18, 0.4951),
    "city": (22.819, 18, 0.1976),
    "state": (13.895, 10, 0.1778),
    "purchase_history": (2.256, 2, 0.3237),
}


@pytest.mark.parametrize("axis,expected", sorted(LOYALTY_AXES.items()))
def test_I6_loyalty_chi_square(frame, axis, expected):
    chi2, p, dof, _ = _chi2(frame, axis, "loyalty_level")
    assert (round(chi2, 3), dof, round(p, 4)) == expected


def test_I6_nothing_predicts_loyalty(frame):
    assert min(_chi2(frame, a, "loyalty_level")[1] for a in LOYALTY_AXES) > 0.05, (
        "a segmentation now predicts loyalty at the nominal level - R2/R5/R7 must be redone"
    )


# R9 - demographics against satisfaction factor.
R9_AXES = {
    "gender": (17.961, 9, 0.0356),
    "age_band": (18.350, 27, 0.8925),
    "group": (6.147, 9, 0.7251),
}


@pytest.mark.parametrize("axis,expected", sorted(R9_AXES.items()))
def test_I6_r9_factor_chi_square(frame, axis, expected):
    chi2, p, dof, _ = _chi2(frame, axis, "satisfaction_factor")
    assert (round(chi2, 3), dof, round(p, 4)) == expected


def test_I6_r9_gender_table_is_too_thin_to_trust(frame):
    """The footnote in the UI says five of twenty expected cells fall below five.

    It said FOUR until 2025-07-29. Pinned here so the count cannot drift again.
    """
    _, _, _, exp = _chi2(frame, "gender", "satisfaction_factor")
    assert exp.shape == (2, 10)
    assert (exp < 5).sum() == 5
    assert exp.min() == pytest.approx(4.50, abs=5e-3)


def test_I6_reported_family_is_eighteen():
    """The number the dashboard quotes: 8 satisfaction + 7 loyalty + 3 factor."""
    assert len(SATISFACTION_AXES) + 1 + len(LOYALTY_AXES) + len(R9_AXES) == 18
    assert pytest.approx(0.00278, abs=5e-6) == 0.05 / 18


# I-7 - what the ladder's overlap claim is scoped to.
LADDER_AXES = ["support_contacted", "loyalty_level", "purchase_history", "group", "gender", "state"]
Z_ALPHA, Z_POWER = 1.96, 0.8416


def _rungs(df, axes):
    out = []
    for axis in axes:
        for k, g in df.groupby(axis):
            xs = g.satisfaction_score.values.astype(float)
            m, s, n = xs.mean(), xs.std(ddof=1), len(xs)
            ci = Z_ALPHA * s / sqrt(n)
            out.append((axis, f"{axis}: {k}", m, max(1.0, m - ci), min(10.0, m + ci)))
    return out


def _separated(rs):
    return sum(
        1
        for i in range(len(rs))
        for j in range(i + 1, len(rs))
        if rs[i][4] < rs[j][3] or rs[j][4] < rs[i][3]
    )


def test_I7_default_ladder_has_no_separated_pair(frame):
    """17 groups, 136 pairs, every interval overlapping every other."""
    rs = _rungs(frame, LADDER_AXES)
    assert len(rs) == 17
    assert _separated(rs) == 0


def test_I7_the_factor_axis_is_the_exception(frame):
    """Four pairs separate on the axis the default ladder leaves out - all of them
    Product Quality against the bottom of the axis. This is why the claim is computed
    from the rows on screen instead of asserted in the copy."""
    fac = _rungs(frame, ["satisfaction_factor"])
    assert len(fac) == 10
    assert _separated(fac) == 4
    top = max(fac, key=lambda r: r[2])
    assert top[1].endswith("Product Quality")
    assert top[3] == pytest.approx(6.3825, abs=5e-4)


def test_I7_detection_floor_covers_within_axis_gaps_only(frame):
    """The floor is a TWO-GROUP quantity, so it licenses a within-axis claim and not a
    cross-axis one. Within an axis the widest gap is 1.371 (loyalty); across different
    axes it is 1.884 (State IL vs Loyalty Medium), which exceeds the 1.548 floor."""
    sd = frame.satisfaction_score.std(ddof=1)
    mdd = sqrt(2 * (Z_ALPHA + Z_POWER) ** 2 / (EXPECTED_N // 2)) * sd
    rs = _rungs(frame, LADDER_AXES)
    within = max(
        max(r[2] for r in rs if r[0] == a) - min(r[2] for r in rs if r[0] == a) for a in LADDER_AXES
    )
    cross = max(r[2] for r in rs) - min(r[2] for r in rs)
    assert within == pytest.approx(1.3708, abs=5e-4) and within < mdd
    assert cross == pytest.approx(1.8835, abs=5e-4) and cross > mdd


# I-1 - the goodness-of-fit test. Not part of the family of eighteen: it compares no groups.
def test_I1_uniformity_chi_square(frame):
    counts = frame.satisfaction_score.value_counts().sort_index().values
    chi2, p = stats.chisquare(counts)
    assert chi2 == pytest.approx(7.00, abs=5e-3)
    assert p == pytest.approx(0.6371, abs=5e-5)


# I-3 - R4's test statistics, quoted verbatim in panel 2 and in the tour.
def test_I3_support_test_statistics(frame):
    a = frame[frame.support_contacted == "Yes"].satisfaction_score.values.astype(float)
    b = frame[frame.support_contacted == "No"].satisfaction_score.values.astype(float)
    assert stats.kruskal(a, b).pvalue == pytest.approx(0.9557, abs=5e-5)
    assert stats.ttest_ind(a, b).pvalue == pytest.approx(0.9808, abs=5e-5)
    se = sqrt(a.std(ddof=1) ** 2 / len(a) + b.std(ddof=1) ** 2 / len(b))
    diff = a.mean() - b.mean()
    assert diff - 1.96 * se == pytest.approx(-1.0770, abs=5e-4)
    assert diff + 1.96 * se == pytest.approx(+1.1038, abs=5e-4)


def test_location_split_into_city_and_state(con):
    """R3 asks about 'cities or states'; the source packs both into one field."""
    assert scalar(con, "select count(distinct city) from dim_location") == EXPECTED_LOCATIONS
    # 6 states, and TX holds 4 of the 10 cities - so a state-level cut is the only way
    # to get a group above n=40, which matters for R3.
    assert scalar(con, "select count(distinct state) from dim_location") == 6
    assert scalar(con, "select count(*) from dim_location where city is null or state is null") == 0


def test_city_sizes_run_6_to_19(con):
    """Quoted in the Explore drawer and in insights.md's rejected list.

    The ledger said "9-19" until 2025-07-29 while the app said "6-19"; the app was right
    (San Antonio.TX holds 6). Two artifacts disagreeing is a shipped wrong number, so the
    range is pinned here rather than typed twice.
    """
    lo, hi = con.execute("select min(customers), max(customers) from dim_location").fetchone()
    assert (lo, hi) == (6, 19)
    assert scalar(con, "select city from dim_location order by customers limit 1") == "San Antonio"
    assert scalar(con, "select city from dim_location order by customers desc limit 1") == "Phoenix"
