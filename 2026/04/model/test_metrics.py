"""Metric assertions for 2026/04 Maritime Logistics & Terminal Efficiency  (Gate G4).

Known-good literals from analysis/integrity.py against the RAW CSVs. A test that recomputes a
number the same way build.py does proves only self-consistency - the exact failure the integrity
pass found across eight months of tooling.

THIS MONTH'S TESTS ARE MOSTLY NEGATIVE, and that is deliberate. The thesis is that nothing
predicts move_duration and that only one signal is real. So the suite pins the ABSENCES: if an
effect ever appears, or if the positive control ever disappears, the month's central claim has
changed and the build must fail rather than quietly publish something different.

Run: just test-model 2026 04
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
    assert list(CURATED.glob("*.parquet")), "run `just build-model 2026 04` first"


# --- shape -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("table", "rows"),
    [
        ("fct_movements", 15_000),
        ("dim_date", 1461),
        ("dim_terminal", 50),
        ("dim_vessel", 1000),
        ("dim_cut", 8),
        ("dim_year", 4),
    ],
)
def test_row_counts(con, table, rows):
    assert q(con, f"SELECT count(*) FROM {table}") == rows


def test_nothing_was_dropped(con):
    assert q(con, "SELECT count(*) FROM fct_movements") == 15_000


@pytest.mark.parametrize(
    ("fk", "dim"),
    [("date_key", "dim_date"), ("terminal_id", "dim_terminal"), ("vessel_key", "dim_vessel")],
)
def test_no_orphans(con, fk, dim):
    n = q(
        con,
        f"SELECT count(*) FROM fct_movements f LEFT JOIN {dim} d USING ({fk}) WHERE d.{fk} IS NULL",
    )
    assert n == 0


def test_no_nulls_anywhere(con):
    cols = [r[0] for r in con.execute("DESCRIBE fct_movements").fetchall()]
    where = " OR ".join(f'"{c}" IS NULL' for c in cols)
    assert q(con, f"SELECT count(*) FROM fct_movements WHERE {where}") == 0


# --- decision 1: there is no primary key, and the model says so -------------------------
def test_movement_id_is_not_a_key(con):
    """1,001 distinct over 15,000 rows. If this becomes unique the source has changed."""
    n = q(con, "SELECT count(DISTINCT movement_id_raw) FROM fct_movements")
    assert n == 1001
    assert n < 15_000


def test_surrogate_key_is_unique(con):
    dupes = q(
        con,
        "SELECT count(*) FROM (SELECT movement_sk FROM fct_movements "
        "GROUP BY 1 HAVING count(*) > 1)",
    )
    assert dupes == 0


def test_the_corrupt_column_is_gone_but_the_defect_is_not(con):
    cols = [r[0] for r in con.execute("DESCRIBE fct_movements").fetchall()]
    assert "vessel_id" not in cols, "the corrupt join key must not survive into curated"
    assert q(con, "SELECT count(*) FROM fct_movements WHERE vessel_id_disagrees") == 909


# --- the thesis: nothing predicts move_duration ----------------------------------------
def test_no_axis_predicts_duration(con):
    """The month's central claim, read from dim_cut rather than asserted in prose."""
    assert q(con, "SELECT count(*) FROM dim_cut WHERE is_predictive") == 0


def test_largest_effect_is_below_cohens_floor(con):
    """Cohen's floor for a 'small' effect is eta2=0.01. Nothing here reaches it.

    The max is Vessel build year at 0.00788 - 79% of the floor, NOT "under a fifth of it",
    which is what five surfaces claimed until this was checked. Asserted explicitly so the
    docstring cannot drift from the data again.
    """
    largest = q(con, "SELECT max(eta2) FROM dim_cut")
    assert largest < 0.01
    assert round(largest, 5) == 0.00788
    assert q(con, "SELECT cut_label FROM dim_cut ORDER BY eta2 DESC LIMIT 1") == "Vessel build year"


@pytest.mark.parametrize(
    ("cut", "eta2"),
    [
        ("Regional hub", 0.0001),
        ("Terminal", 0.0029),
        ("Vessel category", 0.0005),
        ("Day label (Day/Night)", 0.0002),
        ("Fiscal year", 0.0001),
    ],
)
def test_dim_cut_effect_sizes(con, cut, eta2):
    v = q(con, f"SELECT eta2 FROM dim_cut WHERE cut_label = '{cut}'")
    assert round(v, 4) == eta2


# --- the positive control: the one thing that IS real ----------------------------------
def test_movement_growth_is_monotonic(con):
    rows = con.execute("SELECT fiscal_year, movements FROM dim_year ORDER BY 1").fetchall()
    counts = [r[1] for r in rows]
    assert counts == [3000, 3750, 4050, 4200]
    assert all(counts[i] > counts[i - 1] for i in range(1, len(counts)))


def test_daily_allocation_exceeds_chance(con):
    """If this ever falls inside chance, every null in the ledger becomes unreadable."""
    obs = q(con, "SELECT DISTINCT daily_chi2_df FROM dim_year")
    mx = q(con, "SELECT DISTINCT chance_chi2_df_max FROM dim_year")
    assert obs > mx
    assert round(obs, 4) == 1.1731


def test_growth_is_only_in_the_count(con):
    """Duration does not move with volume - that is what makes the ramp a row-count fact."""
    durs = [
        r[0]
        for r in con.execute("SELECT mean_duration FROM dim_year ORDER BY fiscal_year").fetchall()
    ]
    assert max(durs) - min(durs) < 10.0, "mean duration now varies materially by year"


def test_suez_year_is_flagged(con):
    """Decision 4: the warning is a column, not a caption someone can delete."""
    assert q(con, "SELECT count(*) FROM dim_year WHERE is_suez_year") == 1
    assert q(con, "SELECT fiscal_year FROM dim_year WHERE is_suez_year") == 2021


def test_suez_week_has_no_effect(con):
    """The brief's headline ask. 7 days, and nothing in them."""
    n = q(
        con,
        "SELECT count(*) FROM fct_movements f JOIN dim_date d USING (date_key) "
        "WHERE d.in_suez_week",
    )
    assert n == 56  # 7 days x 8.0/day
    inw = q(
        con,
        "SELECT avg(move_duration) FROM fct_movements f JOIN dim_date d "
        "USING (date_key) WHERE d.in_suez_week",
    )
    out = q(
        con,
        "SELECT avg(move_duration) FROM fct_movements f JOIN dim_date d "
        "USING (date_key) WHERE NOT d.in_suez_week",
    )
    assert abs(inw - out) < 60.0, "a Suez effect has appeared"


# --- decision 5: no rate column exists anywhere ----------------------------------------
def test_no_rate_column_exists(con):
    """Every rate this file could express is noise. A model that cannot compute one
    cannot have it charted."""
    for table in ["fct_movements", "dim_terminal", "dim_vessel"]:
        cols = [r[0].lower() for r in con.execute(f"DESCRIBE {table}").fetchall()]
        bad = [c for c in cols if any(k in c for k in ("_rate", "_per_", "avg_", "mean_"))]
        assert not bad, f"{table} grew a rate column: {bad}"


# --- the documented-vs-actual defects, pinned ------------------------------------------
def test_undocumented_category_values_still_present(con):
    hubs = {r[0] for r in con.execute("SELECT DISTINCT regional_hub FROM dim_terminal").fetchall()}
    cats = {r[0] for r in con.execute("SELECT DISTINCT vessel_category FROM dim_vessel").fetchall()}
    assert "LATAM" in hubs and len(hubs) == 4, "the dictionary documents only 3 hubs"
    assert "Container" in cats and len(cats) == 4, "the dictionary documents only 3 categories"


def test_build_year_exceeds_documented_range(con):
    assert q(con, "SELECT min(build_year) FROM dim_vessel") == 1900


def test_day_label_is_not_a_shift(con):
    """One row per date, so an entire calendar day is Day or Night."""
    assert q(con, "SELECT count(*) FROM dim_date") == q(
        con, "SELECT count(DISTINCT date_key) FROM dim_date"
    )
    assert q(con, "SELECT count(DISTINCT day_label) FROM dim_date") == 2


def test_routes_are_unrelated_to_their_terminal(con):
    """Median offset ~130 degrees. If this collapses, the routes have become meaningful.

    Note what this does NOT show: route_geometry is a single constant across all 15,000 rows,
    so the offset varies only because TERMINALS vary. Asserted below.
    """
    v = q(con, "SELECT median(route_end_offset_deg) FROM fct_movements")
    assert v > 50.0, "route endpoints now sit near their terminal"
    # The trap this test exists to keep named: there is exactly ONE route in the file.
    for col in ("route_start_lon", "route_start_lat", "route_end_lon", "route_end_lat"):
        assert q(con, f"SELECT count(DISTINCT {col}) FROM fct_movements") == 1, (
            f"{col} now varies - routes have become per-movement and the 130 degree figure "
            f"would then be about routes rather than about where the terminals are"
        )
    # ...so the offset can only take as many values as there are terminals.
    assert q(con, "SELECT count(DISTINCT route_end_offset_deg) FROM fct_movements") == q(
        con, "SELECT count(DISTINCT terminal_id) FROM fct_movements"
    )
