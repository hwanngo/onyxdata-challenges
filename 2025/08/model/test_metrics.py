"""Metric assertions for 2025/08 Fitness Membership Analytics  (Gate G4).

Known-good values, asserted. These stop a silent regression in build.py from putting a
wrong number on the poster.

The tests that matter most guard the month's central claims: that the price family is a
LOOKUP from three labels, that access_hours is an IDENTITY on membership_type, and that
last_visit_date is CENSORED at 60 days so churn cannot exist. If any of those stop
holding, the source file changed and the whole report must be revisited.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

EXPECTED_MEMBERS = 1_998
EXPECTED_MEMBER_DAYS = 5_347  # bridge fan-out, 2.68x
EXPECTED_TIERS = 4
EXPECTED_LOCATIONS = 10
EXPECTED_MODELS = 3
EXPECTED_DISCOUNTS = 4
EXPECTED_MINORS = 274
EXPECTED_12_TO_15 = 176
WINDOW_DAYS = 59  # max(days_since_visit); the censoring window

TIER_PRICE = {"Basic": 20, "Standard": 30, "Premium": 50, "Elite": 70}
TIER_ACCESS = {
    "Basic": "Off-peak only",
    "Standard": "Weekdays only",
    "Premium": "All hours",
    "Elite": "All hours + Priority access",
}
MODEL_FACTOR = {"Monthly": 1.00, "Quarterly": 0.90, "Early Bird (Annual)": 0.75}
DISCOUNT_RATE = {"None": 0.00, "Promo": 0.05, "Loyalty": 0.10, "Student": 0.15}


@pytest.fixture(scope="module")
def con():
    c = duckdb.connect()
    for p in CURATED.glob("*.parquet"):
        c.execute(f"CREATE VIEW {p.stem} AS SELECT * FROM read_parquet('{p}')")
    return c


def scalar(con, sql):
    return con.execute(sql).fetchone()[0]


def test_curated_exists():
    assert list(CURATED.glob("*.parquet")), "run `just build-model` first"


# ---------------------------------------------------------------------------------------
# Grain and keys
# ---------------------------------------------------------------------------------------


def test_grain_is_one_row_per_member(con):
    assert scalar(con, "select count(*) from fct_member") == EXPECTED_MEMBERS
    assert scalar(con, "select count(distinct member_key) from fct_member") == EXPECTED_MEMBERS


def test_source_has_NO_id_column_at_all(con):
    """Regression guard on a documented absence - the standing ID check has nothing to check.

    May's Transaction_ID and June's Post_ID were non-unique; July's Customer_ID was unique.
    August ships no candidate key at all, so `member_key` is a surrogate WE minted and the
    member grain is an assumption (assumptions.md A-2), not a verified fact. If a real ID
    column ever appears in the source, this fails and A-2 can be retired.
    """
    import polars as pl

    raw_dir = next(
        d for d in CURATED.parents[1].iterdir() if d.is_dir() and d.name.startswith("DataDNA-")
    )
    cols = pl.read_csv(raw_dir / "Fitness_Membership_Analytics_Dataset.csv", n_rows=1).columns
    id_like = [c for c in cols if c.lower() == "id" or c.lower().endswith("_id")]
    assert id_like == [], f"an ID column appeared in the source: {id_like} - revisit A-2"


@pytest.mark.parametrize(
    "fk,dim",
    [
        ("tier_key", "dim_tier"),
        ("model_key", "dim_model"),
        ("discount_key", "dim_discount"),
        ("location_key", "dim_location"),
        ("gender_key", "dim_gender"),
    ],
)
def test_no_orphan_foreign_keys(con, fk, dim):
    assert (
        scalar(
            con,
            f"select count(*) from fct_member f left join {dim} d using ({fk}) "
            f"where d.{fk} is null",
        )
        == 0
    )


def test_star_join_does_not_fan_out(con):
    assert (
        scalar(
            con,
            """
        select count(*) from fct_member f
          join dim_tier     t using (tier_key)
          join dim_model    m using (model_key)
          join dim_discount c using (discount_key)
          join dim_location l using (location_key)
          join dim_gender   g using (gender_key)
    """,
        )
        == EXPECTED_MEMBERS
    )


def test_bridge_fans_out_and_reconciles(con):
    """The day bridge is 2.68x the fact. Joining it to a member count without a DISTINCT
    is the single easiest way to publish a wrong number this month."""
    assert scalar(con, "select count(*) from bri_member_day") == EXPECTED_MEMBER_DAYS
    assert scalar(con, "select count(distinct member_key) from bri_member_day") == EXPECTED_MEMBERS
    # every member's bridge row count equals their stated visit frequency
    assert (
        scalar(
            con,
            """
        select count(*) from (
          -- `days` is a DuckDB reserved word; so are `rows`, `second`, `month` and `yes`.
          select b.member_key, count(*) n_days, any_value(f.visit_per_week) v
          from bri_member_day b join fct_member f using (member_key)
          group by 1
        ) where n_days <> v
    """,
        )
        == 0
    )


def test_dimension_cardinalities(con):
    assert scalar(con, "select count(*) from dim_tier") == EXPECTED_TIERS
    assert scalar(con, "select count(*) from dim_location") == EXPECTED_LOCATIONS
    assert scalar(con, "select count(*) from dim_model") == EXPECTED_MODELS
    assert scalar(con, "select count(*) from dim_discount") == EXPECTED_DISCOUNTS


# ---------------------------------------------------------------------------------------
# THE CENTRAL CLAIM - price is a lookup from three labels
# ---------------------------------------------------------------------------------------


@pytest.mark.parametrize("tier,price", TIER_PRICE.items())
def test_I1_tier_determines_price(con, tier, price):
    rows = con.execute(
        "select distinct list_price_monthly from dim_tier where membership_type = ?", [tier]
    ).fetchall()
    assert rows == [(price,)], f"{tier} no longer prices at {price}"


@pytest.mark.parametrize("model,factor", MODEL_FACTOR.items())
def test_I1_model_determines_factor(con, model, factor):
    got = (
        scalar(
            con,
            "select price_factor from dim_model where subscription_model = ?",
        )
        if False
        else con.execute(
            "select price_factor from dim_model where subscription_model = ?", [model]
        ).fetchone()[0]
    )
    assert got == pytest.approx(factor)


@pytest.mark.parametrize("dtype,rate", DISCOUNT_RATE.items())
def test_I1_discount_type_determines_rate(con, dtype, rate):
    got = con.execute(
        "select discount_rate from dim_discount where discount_type = ?", [dtype]
    ).fetchone()[0]
    assert got == pytest.approx(rate)


def test_I1_price_is_reconstructible_from_three_labels(con):
    """final_price = tier_price x model_factor x (1 - discount_rate), exactly.

    This is the month's thesis in one assertion. If it ever fails, there is a pricing
    residual to analyse and the entire framing changes.
    """
    worst = scalar(
        con,
        """
        select max(abs(f.final_price_monthly
                       - t.list_price_monthly * m.price_factor * (1 - c.discount_rate)))
        from fct_member f
          join dim_tier t     using (tier_key)
          join dim_model m    using (model_key)
          join dim_discount c using (discount_key)
    """,
    )
    assert worst < 1e-9, f"price is no longer a pure lookup (max error {worst})"


def test_I1_distinct_prices_are_fewer_than_label_combinations(con):
    combos = scalar(
        con,
        """
        select count(*) from (
          select distinct tier_key, model_key, discount_key from fct_member
        )
    """,
    )
    prices = scalar(con, "select count(distinct final_price_monthly) from fct_member")
    assert combos == 47
    assert prices == 43
    assert prices < combos, "prices now outnumber label combos - a residual appeared"


# ---------------------------------------------------------------------------------------
# THE SECOND CLAIM - access_hours is an identity; behaviour is independent of it
# ("not enforced" was KILLED at G3 - guarded by test_I4_... below)
# ---------------------------------------------------------------------------------------


@pytest.mark.parametrize("tier,access", TIER_ACCESS.items())
def test_I2_access_hours_is_an_identity_on_tier(con, tier, access):
    got = con.execute(
        "select access_hours from dim_tier where membership_type = ?", [tier]
    ).fetchall()
    assert got == [(access,)], f"{tier} no longer maps to '{access}' - Q7 and Q1 may differ now"


def test_I2_access_is_1to1_in_both_directions(con):
    assert (
        scalar(
            con,
            """
        select count(*) from (
          select access_hours from dim_tier group by 1 having count(*) > 1
        )
    """,
        )
        == 0
    )


def test_I4_entitlement_behaviour_is_a_NULL_not_a_finding(con):
    """Guards a REJECTED claim, so it cannot creep back into the UI.

    An earlier draft asserted "the entitlement is not enforced". It is a null result, not
    a finding (see insights.md Correction): Weekdays-only members list a weekend day LESS
    often than everyone else, and off-peak members use peak hours at the same rate. What
    the file actually lacks is any column that could record enforcement.
    """
    wknd_in, wknd_out, peak_in, peak_out = con.execute("""
        select
          100.0 * avg(case when f.trains_weekend  then 1 else 0 end)
            filter (where t.access_hours =  'Weekdays only'),
          100.0 * avg(case when f.trains_weekend  then 1 else 0 end)
            filter (where t.access_hours <> 'Weekdays only'),
          100.0 * avg(case when f.uses_peak_hours then 1 else 0 end)
            filter (where t.access_hours =  'Off-peak only'),
          100.0 * avg(case when f.uses_peak_hours then 1 else 0 end)
            filter (where t.access_hours <> 'Off-peak only')
        from fct_member f join dim_tier t using (tier_key)
    """).fetchone()
    assert wknd_in == pytest.approx(58.5, abs=0.2)
    assert wknd_in < wknd_out, "weekday-only members now DO train weekends more - recheck I-4"
    assert abs(peak_in - peak_out) < 3.0, "an off-peak effect appeared - the null no longer holds"


# ---------------------------------------------------------------------------------------
# THE THIRD CLAIM - churn cannot exist
# ---------------------------------------------------------------------------------------


def test_I1_last_visit_is_join_date_rank_rescaled(con):
    """THE THESIS, as an assertion. If this ever fails, the whole report is void.

    last_visit_date is a monotone remap of join_date, so the file's recency column is its
    tenure column with the sign flipped.
    """
    r = scalar(con, "select corr(tenure_days, days_since_visit) from fct_member")
    assert r > 0.999, f"the coupling weakened to r={r:.6f} - I-1 no longer holds"
    one_to_one = scalar(
        con,
        """
        select count(*) from (
          select join_date from fct_member group by 1
          having count(distinct last_visit_date) = 1
        )
    """,
    )
    assert one_to_one == 874
    # tenure bands per last_visit_date descend monotonically - a rank map, not a behaviour
    maxima = [
        r[0]
        for r in con.execute("""
        select max(tenure_days) from fct_member group by last_visit_date order by last_visit_date
    """).fetchall()
    ]
    assert maxima == sorted(maxima, reverse=True), "the tenure bands are no longer monotone"


def test_I1_the_churn_list_IS_the_loyalty_list(con):
    """The decision consequence: a 30-day lapse rule selects the longest-tenured members."""
    n_lapsed, overlap = con.execute("""
        with lapsed as (select * from fct_member where days_since_visit > 30),
             kth as (select tenure_days t from fct_member order by tenure_days desc
                     limit 1 offset (select count(*) - 1 from lapsed))
        select count(*), count(*) filter (where tenure_days >= (select t from kth))
        from lapsed
    """).fetchone()
    assert n_lapsed == 982
    assert overlap == n_lapsed, f"overlap fell to {overlap}/{n_lapsed} - recheck I-1"

    # The tie-free form of the claim: the lapse rule is a tenure cut. Asserted separately
    # because it does not depend on how the boundary tie is broken at all.
    lo, hi = con.execute("""
        select min(tenure_days) filter (where days_since_visit >  30),
               max(tenure_days) filter (where days_since_visit <= 30)
        from fct_member
    """).fetchone()
    assert lo == 549 and hi == 549, f"the cut moved to [{lo}, {hi}]"
    band = scalar(con, f"select count(*) from fct_member where tenure_days between {lo} and {hi}")
    assert band <= 5, f"{band} members now straddle the cut - the tenure-cut claim weakens"
    lapsed_t, active_t = con.execute("""
        select avg(tenure_days) filter (where days_since_visit >  30),
               avg(tenure_days) filter (where days_since_visit <= 30)
        from fct_member
    """).fetchone()
    assert lapsed_t > active_t * 2, "the inversion vanished - the thesis needs revisiting"


def test_I1_last_visit_is_censored_at_60_days(con):
    lo, hi, n = con.execute(
        "select min(last_visit_date), max(last_visit_date), count(distinct last_visit_date) "
        "from fct_member"
    ).fetchone()
    assert str(lo) == "2025-05-24"
    assert str(hi) == "2025-07-22"
    assert n == 60, f"the window is no longer 60 distinct days ({n})"


def test_I1_nobody_has_churned(con):
    assert scalar(con, "select max(days_since_visit) from fct_member") == WINDOW_DAYS
    assert scalar(con, "select count(*) from fct_member where days_since_visit > 60") == 0


def test_I1_the_window_is_uniform_across_every_tier(con):
    """max_days_inactive is 59 in EVERY cut. That is what makes it a censoring window
    rather than a behaviour: no segment reaches further back than any other."""
    rows = con.execute("""
        select t.membership_type, max(f.days_since_visit)
        from fct_member f join dim_tier t using (tier_key) group by 1
    """).fetchall()
    assert {r[1] for r in rows} == {WINDOW_DAYS}, f"the window now varies by tier: {rows}"


def test_I1_tenure_IS_real_even_though_retention_is_not(con):
    """join_date spans three years and is genuinely variable - the two must not be conflated."""
    lo, hi = con.execute("select min(join_date), max(join_date) from fct_member").fetchone()
    assert str(lo) == "2022-07-24"
    assert str(hi) == "2025-06-19"
    assert scalar(con, "select count(distinct join_date) from fct_member") == 890
    assert scalar(con, "select min(tenure_days) from fct_member") >= 0


# ---------------------------------------------------------------------------------------
# THE ONE REAL BEHAVIOURAL EFFECT, and the nulls around it
# ---------------------------------------------------------------------------------------


def test_I3_duration_varies_by_location(con):
    rows = con.execute("""
        select l.city, avg(f.duration_in_gym_minutes) m
        from fct_member f join dim_location l using (location_key)
        group by 1 order by m desc
    """).fetchall()
    assert rows[0][0] == "Anaheim", "Anaheim is no longer the longest-session location"
    assert rows[-1][0] == "San Diego", "San Diego is no longer the shortest"
    spread = rows[0][1] - rows[-1][1]
    assert spread == pytest.approx(20.5, abs=0.5), f"the spread moved to {spread:.1f} min"


def test_I5_tier_does_NOT_explain_visit_frequency(con):
    """The null that is a finding: 80% power to detect 0.22 visits/week, and we see ~0.24
    between the extremes of a four-way split - i.e. nothing that clears correction."""
    rows = con.execute("""
        select t.membership_type, avg(f.visit_per_week) v
        from fct_member f join dim_tier t using (tier_key) group by 1 order by v
    """).fetchall()
    spread = rows[-1][1] - rows[0][1]
    assert spread < 0.30, f"tier now separates visit frequency by {spread:.2f} - revisit I-4"


def test_supporting_standard_tier_attends_fewer_group_classes(con):
    rows = dict(
        con.execute("""
        select t.membership_type, 100.0 * avg(case when f.attend_group_lesson then 1 else 0 end)
        from fct_member f join dim_tier t using (tier_key) group by 1
    """).fetchall()
    )
    assert rows["Standard"] == pytest.approx(40.6, abs=0.2)
    for other in ("Basic", "Premium", "Elite"):
        assert rows[other] > 50, f"{other} fell below 50% - the single-deviant-cell story changed"


def test_REJECTED_student_discount_dollar_figure_is_base_rate(con):
    """Guards a DEMOTED claim. An earlier draft called $17,872/yr of student pricing
    'misallocated to over-25s'. 64.5% of ALL members are over 25, so an age-blind
    assignment already sends $16,454 there; the excess attributable to the age skew is
    ~$1,418. The dollar figure must never reappear in the UI."""
    total, to_over25, base = con.execute("""
        select
          sum(f.final_price_monthly / (1 - c.discount_rate) - f.final_price_monthly) * 12,
          sum(case when f.age > 25
                   then f.final_price_monthly / (1 - c.discount_rate) - f.final_price_monthly
                   else 0 end) * 12,
          (select avg(case when age > 25 then 1.0 else 0.0 end) from fct_member)
        from fct_member f join dim_discount c using (discount_key)
        where c.discount_type = 'Student'
    """).fetchone()
    assert total == pytest.approx(25_504, abs=5)
    assert to_over25 == pytest.approx(17_872, abs=5)
    excess = to_over25 - total * base
    assert excess < 2_000, f"excess over base rate is ${excess:,.0f} - was it ever a finding?"


def test_REJECTED_amenities_are_independent_of_minor_status(con):
    """Guards a KILLED claim. '176 children with sauna access' is 0.51 x 176. Every
    amenity flag is independent of age; if that ever stops being true, revisit insights.md."""
    assert scalar(con, "select count(*) from fct_member where is_minor") == EXPECTED_MINORS
    assert scalar(con, "select count(*) from fct_member where age < 16") == EXPECTED_12_TO_15
    for flag in ("uses_sauna", "attend_group_lesson", "has_drink_subscription"):
        minor, adult = con.execute(f"""
            select avg(case when {flag} then 1.0 else 0.0 end) filter (where is_minor),
                   avg(case when {flag} then 1.0 else 0.0 end) filter (where not is_minor)
            from fct_member
        """).fetchone()
        assert abs(minor - adult) < 0.05, f"{flag} now differs by age - recheck the refutation"
    # the schema note that DOES survive: no entitlement is age-gated
    assert (
        scalar(
            con,
            """
        select count(distinct t.access_hours)
        from fct_member f join dim_tier t using (tier_key) where f.is_minor
    """,
        )
        == EXPECTED_TIERS
    )


# ---------------------------------------------------------------------------------------
# The revenue unit
# ---------------------------------------------------------------------------------------


def test_revenue_readings_fork_by_1_43x(con):
    """sum(final_price) mixes three billing periods. Both annualisations are asserted so
    the UI's 'two readings' panel can never drift from the model."""
    monthly = scalar(con, "select sum(final_price_monthly) * 12 from fct_member")
    # Annualising the per-period reading needs PERIODS PER YEAR (12 / commit_months),
    # not the commitment length. Multiplying by commit_months annualises nothing.
    per_period = scalar(
        con,
        """
        select sum(f.final_price_monthly * (12.0 / m.commit_months))
        from fct_member f join dim_model m using (model_key)
    """,
    )
    assert monthly == pytest.approx(826_486, abs=1)
    assert per_period == pytest.approx(579_098, abs=1)
    assert monthly / per_period == pytest.approx(1.43, abs=0.01)


def test_I2_the_1_67x_belongs_to_the_LADDER_not_to_Early_Bird(con):
    """Guards a CORRECTED attribution (audit 2025-08-31, insights.md I-2).

    insights.md and brief.md both read "the Early Bird annual factor costs 1.67x what all
    four discount types cost combined". $84,954 is the WHOLE plan-factor ladder. Early Bird
    alone is $75,750 -- a 1.486x ratio, not 1.667x. The app and poster were always correct
    ("commitment ladder" / "plan-factor leak"), so the defect was prose-only; this test
    makes the split a fact the build checks rather than a sentence someone has to reread.
    """
    ladder, discounts = con.execute("""
        select
          (select sum(t.list_price_monthly * (1 - m.price_factor)) * 12
             from fct_member f join dim_tier t using (tier_key)
                              join dim_model m using (model_key)),
          (select sum(f.final_price_monthly / (1 - d.discount_rate) - f.final_price_monthly) * 12
             from fct_member f join dim_discount d using (discount_key))
    """).fetchone()
    assert ladder == pytest.approx(84_954, abs=1)
    assert discounts == pytest.approx(50_960, abs=1)
    assert ladder / discounts == pytest.approx(1.667, abs=0.002)

    by_rung = dict(
        con.execute("""
        select m.subscription_model,
               sum(t.list_price_monthly * (1 - m.price_factor)) * 12
        from fct_member f join dim_tier t using (tier_key)
                         join dim_model m using (model_key)
        group by 1
    """).fetchall()
    )
    assert by_rung["Early Bird (Annual)"] == pytest.approx(75_750, abs=1)
    assert by_rung["Quarterly"] == pytest.approx(9_204, abs=1)
    assert by_rung["Monthly"] == pytest.approx(0, abs=1e-6)
    assert sum(by_rung.values()) == pytest.approx(ladder, abs=1)

    early_bird_ratio = by_rung["Early Bird (Annual)"] / discounts
    assert early_bird_ratio == pytest.approx(1.486, abs=0.002), (
        "the Early Bird rung is 1.486x the discounts, NOT 1.67x -- if this moved, "
        "recheck every document that quotes the ratio"
    )


def test_I3_the_drop_both_extremes_refit_does_NOT_clear_alpha(con):
    """Guards a REQUALIFIED claim (audit 2025-08-31, insights.md I-3 standards table).

    The refit was published as "robust ... still holds" at p=0.00145 while other claims
    were killed for failing the SAME alpha=5.68e-4 at p=0.00111 and p=0.00150. One
    standard now applies to all of them. This test asserts the arithmetic the requalifying
    rests on -- that eta2 really does attenuate by ~35% once both extremes are dropped --
    so nobody can quietly restore the word "robust" without the number moving first.
    """

    def eta2(where: str) -> float:
        return scalar(
            con,
            f"""
            with d as (
              select l.city, f.duration_in_gym_minutes v
              from fct_member f join dim_location l using (location_key) {where}
            ), g as (
              select city, count(*) n, avg(v) m from d group by 1
            )
            select (select sum(n * pow(m - (select avg(v) from d), 2)) from g)
                 / (select sum(pow(v - (select avg(v) from d), 2)) from d)
        """,
        )

    full = eta2("")
    assert full == pytest.approx(0.0231, abs=0.0005)

    hi, lo = con.execute("""
        select l.city from fct_member f join dim_location l using (location_key)
        group by 1 order by avg(f.duration_in_gym_minutes) desc
    """).fetchall()[:: len(con.execute("select distinct location_key from fct_member").fetchall()) - 1]
    assert {hi[0], lo[0]} == {"Anaheim", "San Diego"}

    refit = eta2(f"where l.city not in ('{hi[0]}', '{lo[0]}')")
    assert refit == pytest.approx(0.0151, abs=0.0005)
    attenuation = 1 - refit / full
    assert attenuation == pytest.approx(0.349, abs=0.02), (
        f"eta2 attenuates {attenuation:.1%} on dropping both extremes; the ledger says ~35%"
    )
