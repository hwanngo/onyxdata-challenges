"""Metric assertions for 2025/06 Social Media Content Performance  (Gate G4).

Known-good values, asserted. These stop a silent regression in build.py from putting a
wrong number on the poster.

The tests that matter most here are the ones guarding the month's central claim: that
three of the four headline metrics are DERIVED and the engagement rate is a LABEL. If any
of those stop holding, the source file changed and the whole report must be revisited.
"""

from pathlib import Path

import duckdb
import pytest

CURATED = Path(__file__).resolve().parents[1] / "data" / "curated"

EXPECTED_POSTS = 5_600
EXPECTED_VIEWS = 4_806_275_234
EXPECTED_ENGAGEMENT = 646_491_442
EXPECTED_PLATFORMS = 6  # the brief says 4
EXPECTED_REGIONS = 8
EXPECTED_FORMATS = 7
EXPECTED_CTR_POSTS = 1_860  # 33.2%
EXPECTED_DISAGREEMENTS = 89


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


# ---------------------------------------------------------------------------------------
# Grain and keys
# ---------------------------------------------------------------------------------------


def test_grain_is_one_row_per_post(con):
    assert scalar(con, "select count(*) from fct_post") == EXPECTED_POSTS
    assert scalar(con, "select count(distinct post_key) from fct_post") == EXPECTED_POSTS


def test_source_post_id_is_NOT_unique(con):
    """Regression guard on a documented defect - the second month running.

    May's Transaction_ID and June's Post_ID are both non-unique despite being presented as
    identifiers. If this ever passes as unique the source changed; recheck DQ1.
    """
    distinct = scalar(con, "select count(distinct source_post_id) from fct_post")
    assert distinct == 5_000
    assert distinct < EXPECTED_POSTS


def test_date_span_is_17_months_not_2024(con):
    """The brief calls this 'a 2024 dataset'. It is not."""
    lo, hi = con.execute("select min(post_date), max(post_date) from fct_post").fetchone()
    assert str(lo) == "2024-01-01"
    assert str(hi) == "2025-05-01"


def test_six_platforms_not_four(con):
    """The brief names TikTok, Instagram, LinkedIn and X.com. Facebook and YouTube exist too."""
    names = {r[0] for r in con.execute("select platform from dim_platform").fetchall()}
    assert len(names) == EXPECTED_PLATFORMS
    assert {"Facebook", "YouTube"} <= names
    # YouTube is in fact the LARGEST platform in the file
    top = scalar(con, "select platform from dim_platform order by posts desc limit 1")
    assert top == "YouTube"


# ---------------------------------------------------------------------------------------
# No fan-out, no orphans
# ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fk,dim",
    [
        ("date_key", "dim_date"),
        ("platform_key", "dim_platform"),
        ("format_key", "dim_format"),
        ("content_key", "dim_content"),
        ("region_key", "dim_region"),
    ],
)
def test_no_orphan_foreign_keys(con, fk, dim):
    assert (
        scalar(
            con,
            f"select count(*) from fct_post f left join {dim} d using ({fk}) where d.{fk} is null",
        )
        == 0
    )


def test_star_join_does_not_fan_out(con):
    assert (
        scalar(
            con,
            """
        select count(*) from fct_post f
          join dim_date c using (date_key)     join dim_platform p using (platform_key)
          join dim_format t using (format_key) join dim_content n using (content_key)
          join dim_region r using (region_key)
    """,
        )
        == EXPECTED_POSTS
    )


def test_totals(con):
    assert scalar(con, "select sum(views) from fct_post") == EXPECTED_VIEWS
    assert scalar(con, "select sum(engagement) from fct_post") == EXPECTED_ENGAGEMENT
    assert scalar(con, "select count(*) from dim_region") == EXPECTED_REGIONS
    assert scalar(con, "select count(*) from dim_format") == EXPECTED_FORMATS


# ---------------------------------------------------------------------------------------
# THE CENTRAL CLAIM - three of four headline metrics are derived
# ---------------------------------------------------------------------------------------


def test_I4_impressions_are_views_times_a_uniform_factor(con):
    """Impressions carry zero information beyond Views."""
    lo, hi = con.execute(
        "select min(impressions::double/views), max(impressions::double/views) from fct_post"
    ).fetchone()
    assert 1.0999 < lo < 1.1002, f"lower bound moved to {lo}"
    assert 1.2998 < hi < 1.3001, f"upper bound moved to {hi}"
    r = scalar(con, "select corr(views, impressions) from fct_post")
    assert r > 0.99, f"impressions decoupled from views (r={r})"


def test_I4_engagement_is_rate_times_views(con):
    """Engagement is fully determined by rate x views.

    `engagement_rate` is stored rounded to ~4dp, so the reconstruction error is
    proportionally largest on the smallest engagement values - the worst case is ~0.8%
    while the median is ~6e-06. The median is the statistic that shows determinism; the
    max is bounded to confirm the residual is rounding and not a second data source.
    """
    med, worst = con.execute("""
        select median(abs(engagement - engagement_rate*views) / engagement),
               max(   abs(engagement - engagement_rate*views) / engagement)
        from fct_post
    """).fetchone()
    assert med < 1e-4, f"engagement is no longer rate*views (median rel. dev {med})"
    assert worst < 0.02, f"residual too large to be 4dp rounding (max rel. dev {worst})"


def test_I3_engagement_rate_is_a_banded_label(con):
    """Every rate sits inside a round-number band keyed to content tier."""
    bands = {
        ("#FunContent", "#MemeMonday", "#JustForFun"): (0.05, 0.10),
        ("#ProductDemo", "#FeatureHighlight", "#SaaSLaunch", "#NewRelease"): (0.08, 0.15),
        ("#EventRecap", "#WebinarReplay", "#EventSummary", "#BehindTheScenes"): (0.10, 0.18),
        ("#SuccessStory", "#CustomerStory", "#Testimonial", "#CustomerSuccess"): (0.15, 0.25),
    }
    covered = 0
    for tags, (lo, hi) in bands.items():
        lit = ", ".join(f"'{t}'" for t in tags)
        n, outside = con.execute(f"""
            select count(*), count(*) filter (
                where f.engagement_rate < {lo} - 1e-9 or f.engagement_rate > {hi} + 1e-9)
            from fct_post f join dim_content c using (content_key)
            where c.main_hashtag in ({lit})
        """).fetchone()
        assert outside == 0, f"band [{lo},{hi}] has {outside} rows outside it"
        covered += n
    assert covered / EXPECTED_POSTS > 0.88, "band coverage dropped below 88%"


# ---------------------------------------------------------------------------------------
# Ledger claims
# ---------------------------------------------------------------------------------------


def test_I1_video_out_views_image_by_about_3x(con):
    rows = con.execute("""
        select t.post_type, median(f.views) med, count(*) n
        from fct_post f join dim_format t using (format_key)
        group by 1 order by med desc
    """).fetchall()
    med = {r[0]: r[1] for r in rows}
    assert rows[0][0] == "Video", "Video is no longer the top format by median views"
    assert rows[-1][0] == "Live Stream", "Live Stream is no longer the worst format"
    ratio = med["Video"] / med["Image"]
    assert 3.2 < ratio < 3.5, f"video/image view ratio moved to {ratio:.2f}"


def test_I1_video_share_of_views_exceeds_share_of_posts(con):
    vs, ps = con.execute("""
        select 100.0 * sum(f.views) filter (where t.post_type='Video') / sum(f.views),
               100.0 * count(*)     filter (where t.post_type='Video') / count(*)
        from fct_post f join dim_format t using (format_key)
    """).fetchone()
    assert vs == pytest.approx(75.8, abs=0.1)
    assert ps == pytest.approx(52.6, abs=0.1)


def test_I2_platforms_are_within_4pct_of_each_other(con):
    rows = con.execute("""
        select p.platform, median(f.views) med
        from fct_post f join dim_platform p using (platform_key)
        group by 1 order by med desc
    """).fetchall()
    spread = rows[0][1] / rows[-1][1] - 1
    assert spread < 0.04, f"platform spread widened to {spread:.1%} - I-2 needs revisiting"


def test_I5_click_tracking_is_structural(con):
    cov = dict(
        con.execute("""
        select p.platform, round(100.0 * count(f.clicks) / count(*), 1)
        from fct_post f join dim_platform p using (platform_key) group by 1
    """).fetchall()
    )
    assert cov["TikTok"] == 100.0
    assert cov["Facebook"] == 100.0
    assert cov["YouTube"] == 0.0
    assert cov["X.com"] == 0.0
    assert cov["Instagram"] == 0.0
    assert 57 < cov["LinkedIn"] < 59
    assert scalar(con, "select count(clicks) from fct_post") == EXPECTED_CTR_POSTS


def test_I5_video_and_live_metrics_are_format_bound(con):
    bad = scalar(
        con,
        """
        select count(*) from fct_post f join dim_format t using (format_key)
        where (f.video_views > 0       and t.post_type <> 'Video')
           or (f.live_stream_views > 0 and t.post_type <> 'Live Stream')
    """,
    )
    assert bad == 0, "video/live view columns are no longer format-bound"


def test_DQ4_label_disagreements_are_preserved_not_corrected(con):
    """89 rows where the source Engagement_Level contradicts its own thresholds."""
    assert (
        scalar(con, "select count(*) from fct_post where level_disagrees") == EXPECTED_DISAGREEMENTS
    )
    plats = dict(
        con.execute("""
        select p.platform, count(*) from fct_post f join dim_platform p using (platform_key)
        where f.level_disagrees group by 1 order by 2 desc
    """).fetchall()
    )
    # every disagreement is on Instagram or LinkedIn - not undifferentiated noise
    assert set(plats) == {"Instagram", "LinkedIn"}
    assert plats["Instagram"] == 54
    assert plats["LinkedIn"] == 35
