#!/usr/bin/env python3
"""raw -> curated star schema for 2025/09 Credit Risk Analytics (Nova Bank)  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why. Silent drops produce numbers nobody can reproduce.
  - Output parquet into data/curated/.

THE SCHEMA ENCODES THE FINDINGS. Four modelling decisions carry the month's analysis:

  1. PROVENANCE IS A COLUMN PROPERTY, so it is recorded in a dimension. dim_column carries
     one row per source column with its block (ORIGINAL / APPENDED), its measured effect on
     loan_status, and whether it is derived. The UI reads its "is this real?" answer from
     the model rather than from a hardcoded list in a component.

  2. NOTHING IS DROPPED AND NOTHING IS IMPUTED. The 895 missing person_emp_length values
     carry a 1.46x default lift (integrity.py check 3), so `emp_length_missing` is a
     first-class boolean on the fact. Imputing it would erase one of the more useful
     signals in the file; dropping it would discard the riskiest slice of the book.

  3. THE DERIVED RATIOS DO NOT GET SEPARATE HOMES. loan_to_income_ratio is loan_amnt /
     person_income to 1e-17 and debt_to_income_ratio is that plus a uniform draw. Both land
     on the fact next to the original loan_percent_income with names that say what they are,
     and build.py RAISES if either identity stops holding.

  4. IMPOSSIBLE VALUES ARE FLAGGED, NOT FIXED. person_age reaches 144 and person_emp_length
     reaches 123. Seven rows. They are marked with `has_impossible_value` and kept, because
     "this extract contains impossible values" is a finding about the file.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"

ORIGINAL = [
    "person_age",
    "person_income",
    "person_home_ownership",
    "person_emp_length",
    "loan_intent",
    "loan_grade",
    "loan_amnt",
    "loan_int_rate",
    "loan_percent_income",
    "cb_person_default_on_file",
    "cb_person_cred_hist_length",
]
APPENDED = [
    "gender",
    "marital_status",
    "education_level",
    "country",
    "state",
    "city",
    "employment_type",
    "loan_term_months",
    "loan_to_income_ratio",
    "other_debt",
    "debt_to_income_ratio",
    "open_accounts",
    "credit_utilization_ratio",
    "past_delinquencies",
]
CATEGORICAL = {
    "person_home_ownership",
    "loan_intent",
    "loan_grade",
    "cb_person_default_on_file",
    "gender",
    "marital_status",
    "education_level",
    "country",
    "state",
    "city",
    "employment_type",
}
# Columns whose values are arithmetic on other columns. Recorded, not silently kept.
DERIVED = {"loan_to_income_ratio", "debt_to_income_ratio", "other_debt"}

_dropped: list[tuple[str, int, str]] = []


def drop(df: pl.DataFrame, mask: pl.Expr, label: str, why: str) -> pl.DataFrame:
    before = df.height
    out = df.filter(~mask)
    n = before - out.height
    if n:
        _dropped.append((label, n, why))
        print(f"  dropped {n:,} rows - {label}: {why}")
    return out


def find_raw() -> Path:
    known = {"analysis", "model", "design", "app", "data", "exports"}
    for d in MONTH_DIR.iterdir():
        if d.is_dir() and d.name not in known and not d.name.startswith("."):
            return d
    raise SystemExit("No raw dataset folder found. Run `just fetch YYYY MM` first.")


def cramers_v(x: np.ndarray, y: np.ndarray) -> float:
    from scipy import stats

    ax, ay = np.unique(x), np.unique(y)
    ct = np.array([[int(((x == a) & (y == b)).sum()) for b in ay] for a in ax])
    chi2 = stats.chi2_contingency(ct)[0]
    return float(np.sqrt(chi2 / (ct.sum() * (min(ct.shape) - 1))))


def effect_on_default(pdf, col: str) -> tuple[float, float]:
    """Comparable [0,1] effect: Cramér's V for categoricals, |point-biserial| for numerics."""
    from scipy import stats

    y = pdf.loan_status.astype(float).values
    s = pdf[col]
    m = s.notna().values
    if col in CATEGORICAL:
        from scipy.stats import chi2_contingency

        ax, ay = np.unique(s[m].astype(str).values), np.unique(y[m])
        ct = np.array(
            [[int(((s[m].astype(str).values == a) & (y[m] == b)).sum()) for b in ay] for a in ax]
        )
        chi2, p, _, _ = chi2_contingency(ct)
        return float(np.sqrt(chi2 / (ct.sum() * (min(ct.shape) - 1)))), float(p)
    r, p = stats.pointbiserialr(y[m], s[m].astype(float).values)
    return abs(float(r)), float(p)


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    print(f"Reading {raw.name}/")

    sheets = pl.read_excel(raw / "Credit_Risk_Dataset_Onyx_Data_September_25.xlsx", sheet_id=0)
    src = sheets["Credit Risk Data"]
    dictionary = sheets["Data Dictionary"]
    print(f"  {src.height:,} rows x {src.width} columns  (+ a {dictionary.height}-row dictionary)")

    # No rows are dropped. Both calls are kept so the drop log is a real check.
    src = drop(src, pl.col("client_ID").is_null(), "null client_ID", "no key")
    src = drop(src, pl.col("loan_status").is_null(), "null loan_status", "no outcome to model")

    # ---------------------------------------------------------------------------------
    # Guard the identities the whole analysis rests on
    # ---------------------------------------------------------------------------------
    chk = src.select(
        lti_err=(pl.col("loan_to_income_ratio") - pl.col("loan_amnt") / pl.col("person_income"))
        .abs()
        .max(),
        dti_err=(
            pl.col("debt_to_income_ratio")
            - (pl.col("other_debt") + pl.col("loan_amnt")) / pl.col("person_income")
        )
        .abs()
        .max(),
        od_lo=(pl.col("other_debt") / pl.col("person_income")).min(),
        od_hi=(pl.col("other_debt") / pl.col("person_income")).max(),
    ).row(0)
    if chk[0] > 1e-12 or chk[1] > 1e-12:
        raise SystemExit(
            f"A derived-ratio identity broke (lti err {chk[0]:.2e}, dti err {chk[1]:.2e}).\n"
            "analysis/profile.md DQ2 no longer holds - revisit before building anything."
        )
    print(
        f"  identities hold: loan_to_income err {chk[0]:.1e}, debt_to_income err {chk[1]:.1e}, "
        f"other_debt = income x U({chk[2]:.3f}, {chk[3]:.3f})"
    )

    pdf = src.to_pandas()

    # ---------------------------------------------------------------------------------
    # dim_column - provenance as data (see docstring note 1)
    # ---------------------------------------------------------------------------------
    rows = []
    for col in ORIGINAL + APPENDED:
        e, p = effect_on_default(pdf, col)
        rows.append(
            {
                "column_name": col,
                "block": "ORIGINAL" if col in ORIGINAL else "APPENDED",
                "is_derived": col in DERIVED,
                "is_categorical": col in CATEGORICAL,
                "null_count": int(pdf[col].isna().sum()),
                "effect_on_default": e,
                "p_value": p,
                # Bonferroni over the 25 pre-declared columns
                "clears_bonferroni": bool(p < 0.05 / (len(ORIGINAL) + len(APPENDED))),
            }
        )
    dim_column = (
        pl.DataFrame(rows)
        .join(
            dictionary.rename(
                {dictionary.columns[0]: "column_name", dictionary.columns[1]: "description"}
            ),
            on="column_name",
            how="left",
        )
        .sort("effect_on_default", descending=True)
        .with_row_index("column_key")
    )

    # ---------------------------------------------------------------------------------
    # Conformed dimensions
    # ---------------------------------------------------------------------------------
    def dim(name: str, col: str, order_by: str = "loans") -> pl.DataFrame:
        return (
            src.group_by(col)
            .agg(
                loans=pl.len(),
                default_rate=pl.col("loan_status").mean() * 100,
                avg_int_rate=pl.col("loan_int_rate").mean(),
                avg_amount=pl.col("loan_amnt").mean(),
            )
            # DETERMINISTIC TIE-BREAK. `loans` ties (Glasgow and San Francisco are both 1,841),
            # and polars does not promise a stable order for equal keys, so two runs of this
            # file could assign the surrogate keys either way round. The parquet then differs
            # byte-for-byte between runs for no reason, which makes "is the curated layer
            # consistent with build.py?" unanswerable by diff. The label column is unique
            # within each dimension, so appending it makes the sort total.
            .sort([order_by, col], descending=[order_by == "loans", False])
            .with_row_index(f"{name}_key")
        )

    dim_grade = dim("grade", "loan_grade", order_by="loan_grade")
    dim_intent = dim("intent", "loan_intent")
    dim_home = dim("home", "person_home_ownership")
    dim_gender = dim("gender", "gender")
    dim_marital = dim("marital", "marital_status")
    dim_education = dim("education", "education_level")
    dim_employment = dim("employment", "employment_type")

    # geography: city is the grain; state and country are attributes (a proper hierarchy)
    dim_geo = (
        src.group_by("city")
        .agg(
            state=pl.col("state").first(),
            country=pl.col("country").first(),
            latitude=pl.col("city_latitude").first(),
            longitude=pl.col("city_longitude").first(),
            loans=pl.len(),
            default_rate=pl.col("loan_status").mean() * 100,
            n_coords=pl.struct("city_latitude", "city_longitude").n_unique(),
        )
        # Same deterministic tie-break as dim(): Glasgow and San Francisco both have 1,841
        # loans, so without `city` as a secondary key their geo_keys swap between runs.
        .sort(["loans", "city"], descending=[True, False])
        .with_row_index("geo_key")
    )
    if dim_geo.filter(pl.col("n_coords") > 1).height:
        raise SystemExit("a city now has more than one coordinate - assumptions A-8 broke.")
    dim_geo = dim_geo.drop("n_coords")

    # ---------------------------------------------------------------------------------
    # Fact
    # ---------------------------------------------------------------------------------
    fct = (
        src.join(dim_grade.select("grade_key", "loan_grade"), on="loan_grade")
        .join(dim_intent.select("intent_key", "loan_intent"), on="loan_intent")
        .join(dim_home.select("home_key", "person_home_ownership"), on="person_home_ownership")
        .join(dim_gender.select("gender_key", "gender"), on="gender")
        .join(dim_marital.select("marital_key", "marital_status"), on="marital_status")
        .join(dim_education.select("education_key", "education_level"), on="education_level")
        .join(dim_employment.select("employment_key", "employment_type"), on="employment_type")
        .join(dim_geo.select("geo_key", "city"), on="city")
        .with_columns(
            # THE NULL IS A SIGNAL, not a gap to be filled (docstring note 2).
            emp_length_missing=pl.col("person_emp_length").is_null(),
            int_rate_missing=pl.col("loan_int_rate").is_null(),
            # Impossible values are FLAGGED, not fixed (docstring note 4).
            has_impossible_value=(pl.col("person_age") > 100) | (pl.col("person_emp_length") > 60),
            prior_default=pl.col("cb_person_default_on_file") == "Y",
            defaulted=pl.col("loan_status") == 1,
            # The risk cliff sits between grades C and D - 2.85x default for +1.9pp price.
            below_cliff=pl.col("loan_grade").is_in(["D", "E", "F", "G"]),
        )
        .select(
            "client_ID",
            "grade_key",
            "intent_key",
            "home_key",
            "gender_key",
            "marital_key",
            "education_key",
            "employment_key",
            "geo_key",
            "loan_status",
            "defaulted",
            "person_age",
            "person_income",
            "person_emp_length",
            "emp_length_missing",
            "loan_amnt",
            "loan_int_rate",
            "int_rate_missing",
            "loan_percent_income",
            "cb_person_default_on_file",
            "prior_default",
            "cb_person_cred_hist_length",
            "loan_term_months",
            "loan_to_income_ratio",
            "other_debt",
            "debt_to_income_ratio",
            "open_accounts",
            "credit_utilization_ratio",
            "past_delinquencies",
            "has_impossible_value",
            "below_cliff",
        )
    )

    for name, df in [
        ("dim_column", dim_column),
        ("dim_grade", dim_grade),
        ("dim_intent", dim_intent),
        ("dim_home", dim_home),
        ("dim_gender", dim_gender),
        ("dim_marital", dim_marital),
        ("dim_education", dim_education),
        ("dim_employment", dim_employment),
        ("dim_geo", dim_geo),
        ("fct_loan", fct),
    ]:
        df.write_parquet(CURATED / f"{name}.parquet")

    export_app_data(src, dim_column)

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none - and that is a DECISION, not an omission (assumptions.md A-5).")
        print("  The 895 rows with a missing person_emp_length default at 1.46x the rest of")
        print("  the book. Dropping them is the standard first move and it is wrong here.")

    print()
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:24} {pl.read_parquet(p).height:>7,} rows")


def _unemployed_block(d) -> dict:
    """The logical contradiction, as numbers rather than as a sentence.

    TWO MEANS, and they are not interchangeable. `meanYearsReported` averages
    person_emp_length over all 1,635 self-declared "Unemployed" applicants who report a
    value at all -- 214 of whom report 0 years and are therefore NOT a contradiction.
    `meanYearsWorking` averages over the 1,421 who report a current job, which is the
    population the "1,421 of 1,635" count names. an integrity pass found the page pairing
    the 1,421 count with the 1,635-based mean. They are now exported separately and the
    page quotes the one that matches its own count.
    """
    u = d[d.employment_type == "Unemployed"]
    emp = u.person_emp_length.dropna()
    working = emp[emp > 0]
    ft = d[d.employment_type == "Full-time"]
    return {
        "rows": len(u),
        "reported": len(emp),
        "working": len(working),
        "zeroYears": int((emp == 0).sum()),
        "meanYearsReported": float(emp.mean()),
        "meanYearsWorking": float(working.mean()),
        "medianIncome": float(u.person_income.median()),
        "ftMedianIncome": float(ft.person_income.median()),
    }


def _lti_exact_block(d) -> dict:
    """Rule 1 re-run on the FULL-PRECISION ratio instead of the source's 2dp column.

    The 100.0000% label is downstream of the rounding in loan_percent_income; on
    loan_to_income_ratio the same condition is no longer exact. Publishing the exact rate
    without this number would overstate what the rule is.
    """
    m = (d.person_home_ownership == "RENT") & (d.loan_to_income_ratio > 0.30)
    return {"n": int(m.sum()), "defaultRate": float(d[m].loan_status.mean() * 100)}


def export_app_data(src: pl.DataFrame, dim_column: pl.DataFrame) -> None:
    """Emit the app's data payload as columnar, dictionary-encoded, quantised JSON.

    DELIBERATE STACK DEVIATION, carried from 2025/05 with the same reasoning: DuckDB-WASM
    ships a ~32 MB engine and costs a ~30s cold start. This month's book is 32,581 rows --
    the largest of the programme -- but eleven quantised columns of it still fit in a few
    hundred KB, and aggregating 32k rows in JS is a sub-10ms operation. The parquet star
    above remains the source of truth that tools/verify_metrics.py checks the DOM against.

    QUANTISATION, and why each choice is lossless where it matters:
      * loan_percent_income -> integer percent (0-83). It is ALREADY 2dp in the source, and
        the wall rule reads that rounded column, so integer percent is exact, not lossy.
      * loan_int_rate -> basis points. The headline is a 14 bp difference; bp is the unit
        the finding is quoted in.
      * loan_amnt -> whole dollars; person_income -> whole dollars / 100.
    """
    import json

    d = src.to_pandas()
    DICT_COLS = [
        "loan_grade",
        "loan_intent",
        "person_home_ownership",
        "gender",
        "education_level",
        "employment_type",
        "country",
    ]

    def encode_dict(col):
        levels = sorted(d[col].dropna().unique().tolist())
        idx = {v: i for i, v in enumerate(levels)}
        return {"levels": levels, "codes": [idx[v] for v in d[col]]}

    lpi = (d.loan_percent_income * 100).round().astype(int)
    # int rate has 3,116 nulls -- encoded as -1, never imputed (assumptions A-5 discipline)
    rate = d.loan_int_rate.mul(100).round().fillna(-1).astype(int)

    payload = {
        "n": len(d),
        "cols": {c: encode_dict(c) for c in DICT_COLS},
        "lpi_pct": lpi.tolist(),
        "rate_bp": rate.tolist(),
        "amnt": d.loan_amnt.astype(int).tolist(),
        "income_h": (d.person_income / 100).round().astype(int).tolist(),
        "age": d.person_age.astype(int).tolist(),
        "status": d.loan_status.astype(int).tolist(),
        "prior_default": (d.cb_person_default_on_file == "Y").astype(int).tolist(),
        "emp_missing": d.person_emp_length.isna().astype(int).tolist(),
        "past_delinq": d.past_delinquencies.astype(int).tolist(),
        # Provenance, straight from dim_column so the UI cannot drift from the model.
        "provenance": dim_column.select(
            "column_name",
            "block",
            "is_derived",
            "effect_on_default",
            "clears_bonferroni",
            "null_count",
            "description",
        ).to_dicts(),
        "meta": {
            "sourceRows": len(d),
            "baseDefaultRate": float(d.loan_status.mean()),
            "rateUnit": "basis points (loan_int_rate x 100); -1 = missing, never imputed",
            "lpiUnit": "integer percent of income; the source column is already 2dp and the "
            "wall rule reads that rounded value",
            # ---------------------------------------------------------------------------
            # AGGREGATES THE QUANTISED COLUMNS CANNOT REBUILD.
            #
            # The page states three things the eleven exported columns cannot recompute:
            # the "Unemployed" contradiction (person_emp_length in YEARS is not shipped --
            # only the missingness flag is), and the full-precision restatement of rule 1
            # (loan_to_income_ratio is not shipped either). They were prose literals until
            # The integrity pass; they are now computed here and each one has a matching
            # SQL expression in model/metric_checks.yml, so the DOM is diffed against an
            # independent DuckDB path exactly like every other figure on the page.
            # ---------------------------------------------------------------------------
            "unemployed": _unemployed_block(d),
            "ltiExact": _lti_exact_block(d),
        },
    }
    out = MONTH_DIR / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(
        f"  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB, "
        f"{payload['n']:,} loans, columnar+quantised)"
    )


if __name__ == "__main__":
    main()
