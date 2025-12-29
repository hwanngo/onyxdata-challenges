"""
Star schema - 2025/12 Animal Shelter Operations  (Gate G4)

Reads the read-only CSV, writes parquet to data/curated/. The raw folder is never touched.

THE SCHEMA ENCODES THE FINDINGS. Five decisions here are arguments, not plumbing:

  1. THE OUTCOME DIMENSION CARRIES BOTH VERDICTS. dim_outcome has `is_live` (mine) next to
     `file_says_alive` (the source's `was_outcome_alive`) for every outcome type, so the
     disagreement is a row you can read rather than a claim you have to trust. They differ on
     DISPOSAL, TRANSPORT, MISSING, DUPLICATE and NULL.

  2. "STILL IN SHELTER" IS AN OUTCOME VALUE, NOT A NULL. 400 stays have no outcome date
     because the animal has not left. Modelling that as missing invites it to be dropped or,
     worse, counted as a save - which is exactly what the source flag does to 399 of them.

  3. dim_month CARRIES `is_censored`. A month whose stays are still resolving cannot be
     compared with a finished one. The flag travels with the data so no view can forget.

  4. AGE CARRIES `age_trusted` SEPARATELY FROM `age_years`. 37.77% of DOBs are back-computed
     from the intake date in whole years, so `age_years` exists but `age_trusted` is null for
     those rows. A view that wants an honest age effect uses the second column and takes the
     smaller n.

  5. dim_intake_type CARRIES `channel` - public counter versus field officer. That split is
     what turns the weekday spike from an operational signal into an artefact of opening
     hours, so it belongs in the model rather than in a chart's WHERE clause.

The build RAISES if its premises stop holding, including the thesis itself.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

f = pl.col

ROOT = Path(__file__).resolve().parents[1]
SRC = (
    ROOT
    / "DataDNA-Dataset-Challenge-Animal-Shelter-Operations-December-2025"
    / "DataDNA Dataset Challenge - Animal Shelter Operations - December 2025.csv"
)
OUT = ROOT / "data" / "curated"

# 2013-2016 hold 4 records between them; the operational series starts in 2017.
FIRST_YEAR = 2017
# A month is censored while its stays are still resolving. 2025-07 onward exceeds 1%.
CENSOR_THRESHOLD = 0.01

# Outcomes where the animal did not leave alive. DISPOSAL is here because 120 of its 132
# records carry subtype ACS DISPO (body disposal) and the source's own outcome_is_dead
# column flags all 132 as dead - while was_outcome_alive calls them live releases.
DEAD = ["EUTHANASIA", "DIED", "DISPOSAL"]
# Not an outcome for the animal: an administrative disposition or a data-quality marker.
OTHER = ["TRANSPORT", "MISSING", "DUPLICATE", "NULL"]
STILL_IN = "STILL IN SHELTER"
# Intake types driven by field officers rather than by a member of the public at the counter.
OFFICER = ["WELFARE SEIZED", "WILDLIFE", "CONFISCATE", "QUARANTINE"]


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(f"build premise violated: {message}")


def load() -> pl.DataFrame:
    df = pl.read_csv(SRC, infer_schema_length=20000, ignore_errors=True)
    df = df.with_columns(
        [
            f(c).str.to_date("%Y-%m-%d", strict=False).alias(c)
            for c in ["Intake Date", "Outcome Date", "DOB"]
        ]
    )
    df = df.rename({c: c.lower().replace(" ", "_") for c in df.columns})
    _require(df["kennel_id"].n_unique() == df.height, "kennel_id is not unique")
    _require(
        df["intake_is_dead"].n_unique() == 1,
        "intake_is_dead is no longer constant - the extract now includes dead-on-arrival "
        "intakes and every denominator in this model changes meaning",
    )
    return df.filter(f("intake_date").dt.year() >= FIRST_YEAR)


def build_stay(df: pl.DataFrame) -> pl.DataFrame:
    df = df.with_columns(
        unresolved=f("outcome_date").is_null(),
        outcome=pl.when(f("outcome_date").is_null())
        .then(pl.lit(STILL_IN))
        .when(f("outcome_type").is_null())
        .then(pl.lit("NULL"))
        .otherwise(f("outcome_type")),
    )
    df = df.with_columns(
        is_dead=f("outcome").is_in(DEAD),
        is_other=f("outcome").is_in(OTHER),
    )
    df = df.with_columns(
        is_live=~(f("is_dead") | f("is_other") | (f("outcome") == STILL_IN)),
        # decision 5
        channel=pl.when(f("intake_type").is_in(OFFICER))
        .then(pl.lit("Officer-driven"))
        .otherwise(pl.lit("Public counter")),
        intake_month=f("intake_date").dt.truncate("1mo").dt.date(),
        intake_year=f("intake_date").dt.year(),
        intake_dow=f("intake_date").dt.weekday(),
        los=f("intake_duration"),
    )
    # decision 4 - the age columns
    df = df.with_columns(
        dob_estimated=(f("dob").dt.month() == f("intake_date").dt.month())
        & (f("dob").dt.day() == f("intake_date").dt.day()),
        dob_impossible=f("dob") > f("intake_date"),
    )
    df = df.with_columns(
        age_years=pl.when(f("dob").is_null() | f("dob_impossible"))
        .then(None)
        .otherwise((f("intake_date") - f("dob")).dt.total_days() / 365.25)
    )
    df = df.with_columns(
        age_trusted=pl.when(f("dob_estimated") | f("dob_impossible"))
        .then(None)
        .otherwise(f("age_years"))
    )

    _require(df.filter(f("is_live") & f("is_dead")).height == 0, "a stay is both live and dead")
    _require(df.filter(f("los") < 0).height == 0, "negative length of stay")
    _require(
        df.filter(f("unresolved") & f("is_live")).height == 0,
        "an unresolved stay is being counted as a live release - the defect this model exists "
        "to correct",
    )
    return df


def build_outcome_dim(df: pl.DataFrame) -> pl.DataFrame:
    """Decision 1: my verdict and the file's, side by side, one row per outcome type."""
    dim = df.group_by("outcome").agg(
        pl.len().alias("stays"),
        f("is_live").first(),
        f("is_dead").first(),
        f("is_other").first(),
        f("was_outcome_alive").mean().alias("file_says_alive"),
        f("outcome_is_dead").mean().alias("file_says_dead"),
        pl.median("los").alias("median_los"),
    )
    dim = dim.with_columns(
        disagrees=(f("is_live") != (f("file_says_alive") > 0.5)),
    ).sort("stays", descending=True)
    dis = dim.filter("disagrees")
    _require(
        set(dis["outcome"]) == set(OTHER) | {"DISPOSAL"} | {STILL_IN},
        f"the set of outcomes where the file disagrees has changed: {sorted(dis['outcome'])}",
    )
    return dim


def build_month_dim(df: pl.DataFrame) -> pl.DataFrame:
    """Decision 3: censorship is a column, not a footnote."""
    dim = (
        df.group_by("intake_month")
        .agg(
            pl.len().alias("intakes"),
            f("unresolved").mean().alias("pct_unresolved"),
            f("is_live").sum().alias("live"),
            f("is_dead").sum().alias("dead"),
        )
        .sort("intake_month")
    )
    dim = dim.with_columns(
        is_censored=f("pct_unresolved") > CENSOR_THRESHOLD,
        live_release_rate=100 * f("live") / (f("live") + f("dead")),
    )
    # censorship must be a tail, not scattered - otherwise "stop the series here" is wrong
    cens = dim.filter("is_censored").sort("intake_month")
    if cens.height:
        first = cens["intake_month"][0]
        _require(
            dim.filter((f("intake_month") >= first) & ~f("is_censored")).height <= 1,
            "censored months are not a contiguous tail; a single cut-off would be wrong",
        )
    return dim


def build_animal_dim(df: pl.DataFrame) -> pl.DataFrame:
    """One row per animal. This is where C9 lives: repeat visits are a property of the ANIMAL,
    and the fact table's grain is the STAY, so the two must not be confused."""
    dim = df.group_by("animal_id").agg(
        pl.len().alias("visits"),
        f("animal_type").first(),
        f("is_live").mean().alias("live_share"),
        (f("outcome") == "RETURN TO OWNER").any().alias("ever_returned_to_owner"),
        pl.min("intake_date").alias("first_intake"),
        pl.max("intake_date").alias("last_intake"),
    )
    return dim.with_columns(is_repeat=f("visits") > 1)


def build_condition_dim(df: pl.DataFrame) -> pl.DataFrame:
    dim = df.group_by("intake_condition").agg(
        pl.len().alias("stays"),
        (100 * f("is_live").sum() / (f("is_live").sum() + f("is_dead").sum())).alias("live_rate"),
        pl.median("los").alias("median_los"),
    )
    return dim.sort("live_rate")


def build_dow_dim(df: pl.DataFrame) -> pl.DataFrame:
    """THE WEEKDAY THESIS, persisted. If the public/officer contrast ever collapses, the
    claim that the spike is opening hours stops being supportable and the build says so."""
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    dim = (
        df.group_by("channel", "intake_dow")
        .agg(pl.len().alias("intakes"))
        .with_columns(
            dow_name=f("intake_dow").replace_strict(
                dict(enumerate(names, start=1)), return_dtype=pl.String
            )
        )
    )
    dim = dim.with_columns(share=100 * f("intakes") / f("intakes").sum().over("channel")).sort(
        "channel", "intake_dow"
    )

    def spread(ch: str) -> float:
        s = dim.filter(f("channel") == ch)["share"]
        return float(s.max() - s.min())

    public, officer = spread("Public counter"), spread("Officer-driven")
    _require(
        public > 2 * officer,
        f"the weekday thesis fails: public spread {public:.1f}pp is no longer far above "
        f"officer-driven {officer:.1f}pp",
    )
    return dim


def export_app_data(
    stay: pl.DataFrame,
    outcome: pl.DataFrame,
    month: pl.DataFrame,
    condition: pl.DataFrame,
    animal: pl.DataFrame,
    dow: pl.DataFrame,
) -> None:
    """Payload for the browser. The fact table is 52,339 rows and the page needs cross-filtering,
    so categoricals are dictionary-encoded and only the columns the UI actually reads travel."""
    import json

    cat_cols = ["animal_type", "intake_type", "intake_condition", "outcome", "channel", "sex"]
    cols: dict[str, dict] = {}
    for c in cat_cols:
        levels = sorted(stay[c].drop_nulls().unique().to_list())
        idx = {v: i for i, v in enumerate(levels)}
        cols[c] = {"levels": levels, "codes": [(-1 if v is None else idx[v]) for v in stay[c]]}

    months = [str(m) for m in month["intake_month"].to_list()]
    midx = {m: i for i, m in enumerate(months)}
    repeat_ids = set(animal.filter(f("is_repeat"))["animal_id"].to_list())

    grid = stay.with_columns(
        glat=(f("latitude") * 500).round() / 500, glon=(f("longitude") * 500).round() / 500
    )
    counts = grid.group_by("glat", "glon").agg(pl.len().alias("n")).sort("n", descending=True)
    cells = [((r["glat"], r["glon"]), r["n"]) for r in counts.iter_rows(named=True)]
    cpos = {k: i for i, (k, _) in enumerate(cells)}
    cell_idx = [cpos[(la, lo)] for la, lo in zip(grid["glat"], grid["glon"], strict=False)]

    payload = {
        "n": stay.height,
        "months": months,
        "monthCensored": month["is_censored"].to_list(),
        "monthUnresolved": [round(x, 5) for x in month["pct_unresolved"].to_list()],
        "cols": cols,
        "month_idx": [midx[str(m)] for m in stay["intake_month"].to_list()],
        "year": stay["intake_year"].to_list(),
        "dow": stay["intake_dow"].to_list(),
        "los": [(-1 if v is None else int(v)) for v in stay["los"].to_list()],
        "isLive": [int(x) for x in stay["is_live"].to_list()],
        "isDead": [int(x) for x in stay["is_dead"].to_list()],
        "unresolved": [int(x) for x in stay["unresolved"].to_list()],
        "filedAlive": [int(x) for x in stay["was_outcome_alive"].to_list()],
        # Ages travel as integer MONTHS. "2.345" is six characters of false precision on a
        # column that is a staff estimate 38% of the time.
        "ageMo": [(-1 if v is None else round(v * 12)) for v in stay["age_years"].to_list()],
        "ageMoTrusted": [
            (-1 if v is None else round(v * 12)) for v in stay["age_trusted"].to_list()
        ],
        "isRepeat": [int(a in repeat_ids) for a in stay["animal_id"].to_list()],
        # Per-row coordinates at 5dp cost 1.6MB of the payload for precision no city map can
        # use. Snapping to a ~220m grid and shipping a cell INDEX keeps the map cross-filterable
        # at a fraction of the size.
        "cells": cell_idx,
        "cellDim": [{"lat": la, "lon": lo, "n": n} for (la, lo), n in cells],
        "outcomeDim": outcome.to_dicts(),
        "conditionDim": condition.to_dicts(),
        "dowDim": dow.to_dicts(),
        "meta": {
            "stays": stay.height,
            "animals": animal.height,
            "repeats": int(animal["is_repeat"].sum()),
            "first": str(stay["intake_date"].min()),
            "last": str(stay["intake_date"].max()),
            "lastSettled": str(month.filter(~f("is_censored"))["intake_month"].max()),
        },
    }
    out = ROOT / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    raw = load()
    stay = build_stay(raw)
    outcome = build_outcome_dim(stay)
    month = build_month_dim(stay)
    animal = build_animal_dim(stay)
    condition = build_condition_dim(stay)
    dow = build_dow_dim(stay)

    stay.write_parquet(OUT / "fct_stay.parquet")
    outcome.write_parquet(OUT / "dim_outcome.parquet")
    month.write_parquet(OUT / "dim_month.parquet")
    animal.write_parquet(OUT / "dim_animal.parquet")
    condition.write_parquet(OUT / "dim_condition.parquet")
    dow.write_parquet(OUT / "dim_dow.parquet")
    export_app_data(stay, outcome, month, condition, animal, dow)

    live, dead = int(stay["is_live"].sum()), int(stay["is_dead"].sum())
    print(f"fct_stay      {stay.height:>7,} x {stay.width}")
    print(
        f"dim_animal    {animal.height:>7,} ({int(animal['is_repeat'].sum())} repeat) | "
        f"dim_outcome {outcome.height} | dim_month {month.height} | "
        f"dim_condition {condition.height}"
    )
    print(
        f"live-release  corrected {100 * live / (live + dead):.2f}%   "
        f"file flag {100 * stay['was_outcome_alive'].mean():.2f}%"
    )
    print(
        f"unresolved    {int(stay['unresolved'].sum())} stays, "
        f"{int(month.filter('is_censored').height)} censored months"
    )
    print(
        f"age           {stay['age_trusted'].drop_nulls().len():,} trusted of "
        f"{stay['age_years'].drop_nulls().len():,} computable"
    )
    print("\nweekday share by channel (the thesis):")
    for ch in ["Public counter", "Officer-driven"]:
        row = dow.filter(f("channel") == ch).sort("intake_dow")
        print(
            f"  {ch:16s} "
            + "  ".join(f"{r['dow_name']} {r['share']:5.1f}" for r in row.iter_rows(named=True))
        )


if __name__ == "__main__":
    main()
