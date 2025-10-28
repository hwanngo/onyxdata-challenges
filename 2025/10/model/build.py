#!/usr/bin/env python3
"""raw -> curated star schema for 2025/10 Consumer Financial Complaints  (Gate G4).

Rules:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row you drop and why.
  - Output parquet into data/curated/.

THE SCHEMA ENCODES THE FINDINGS:

  1. DATES ARE CONVERTED ONCE, HERE. They arrive as Excel serial integers (epoch
     1899-12-30). Every downstream consumer gets real dates; nothing re-derives them.

  2. `is_resolved` IS A FIRST-CLASS COLUMN. `Timely response?` is null on exactly the 1,494
     in-progress complaints, so every timeliness measure must divide by resolved complaints
     and not by all of them. An early draft of brief.md published 93.77% instead of 96.06%
     by getting this wrong; the schema now makes the correct denominator the easy one.

  3. `is_partial_month` FLAGS AUGUST 2023. The extract stops on the 28th. Plotting that month
     whole turns a rising series into a collapse, so the flag travels with the data.

  4. dim_company CARRIES ITS OWN REFUTATION. The shipped Complaints_per_1pct_Share is kept -
     entrants will use it - beside `kpi_rank` and `share_rank`, so a chart can show that the
     two are the same ranking inverted.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import polars as pl

MONTH_DIR = Path(__file__).resolve().parents[1]
CURATED = MONTH_DIR / "data" / "curated"
EXCEL_EPOCH = pl.date(1899, 12, 30)
# The extract stops mid-month; see assumptions.md A-3.
LAST_FULL_MONTH = pl.date(2023, 7, 31)

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


def main() -> None:
    raw = find_raw()
    CURATED.mkdir(parents=True, exist_ok=True)
    xlsx = next(raw.rglob("*.xlsx"))
    print(f"Reading {xlsx.name}")

    sheets = pl.read_excel(xlsx, sheet_id=0)
    fact, comp, _dd = sheets["Complaints (Fact)"], sheets["Company"], sheets["Data Dictionary"]
    print(f"  fact {fact.height:,} x {fact.width}   company {comp.height:,} x {comp.width}")

    fact = drop(fact, pl.col("Complaint ID").is_null(), "null Complaint ID", "no key")
    fact = drop(fact, pl.col("Company_ID_1081").is_null(), "null company key", "cannot join")

    # ---------------------------------------------------------------------------------
    # Guard the identities the analysis rests on
    # ---------------------------------------------------------------------------------
    bad = fact.filter(
        pl.col("Response_Time_Days") != pl.col("Company_Response_Date") - pl.col("Date submitted")
    ).height
    if bad:
        raise SystemExit(
            f"Response_Time_Days no longer equals the date difference on {bad:,} rows.\n"
            "analysis/profile.md DQ0 no longer holds - revisit before building anything."
        )
    print("  identity holds: Response_Time_Days = Company_Response_Date - Date submitted")

    # ---------------------------------------------------------------------------------
    # Fact - dates converted ONCE (docstring note 1)
    # ---------------------------------------------------------------------------------
    f = (
        fact.with_columns(
            date_submitted=EXCEL_EPOCH + pl.duration(days=pl.col("Date submitted")),
            date_received=EXCEL_EPOCH + pl.duration(days=pl.col("Date received")),
            date_responded=EXCEL_EPOCH + pl.duration(days=pl.col("Company_Response_Date")),
        )
        .with_columns(
            month=pl.col("date_submitted").dt.truncate("1mo"),
            # THE DENOMINATOR (docstring note 2)
            is_resolved=pl.col("Timely response?").is_not_null(),
            is_timely=pl.col("Timely response?") == "Yes",
            got_relief=pl.col("Company response to consumer").is_in(
                ["Closed with monetary relief", "Closed with non-monetary relief"]
            ),
            got_money=pl.col("Company response to consumer") == "Closed with monetary relief",
            intake_lag=pl.col("Date received") - pl.col("Date submitted"),
            sub_issue_given=pl.col("Sub-issue").is_not_null(),
        )
        .with_columns(
            # THE PARTIAL MONTH (docstring note 3)
            is_partial_month=pl.col("month") > LAST_FULL_MONTH,
        )
        .rename(
            {
                "Complaint ID": "complaint_id",
                "Submitted via": "channel",
                "State": "state",
                "Product": "product",
                "Sub-product": "sub_product",
                "Issue": "issue",
                "Sub-issue": "sub_issue",
                "Company response to consumer": "outcome",
                "Company public response": "public_response",
                "Census_Region": "region",
                "Census_Division": "division",
                "Company_ID_1081": "company_id",
                "Response_Time_Days": "response_days",
                "State_Latitude": "latitude",
                "State_Longitude": "longitude",
            }
        )
        .select(
            "complaint_id",
            "company_id",
            "date_submitted",
            "date_received",
            "date_responded",
            "month",
            "is_partial_month",
            "channel",
            "state",
            "latitude",
            "longitude",
            "region",
            "division",
            "product",
            "sub_product",
            "issue",
            "sub_issue",
            "sub_issue_given",
            "outcome",
            "public_response",
            "response_days",
            "intake_lag",
            "is_resolved",
            "is_timely",
            "got_relief",
            "got_money",
        )
    )

    # ---------------------------------------------------------------------------------
    # dim_company - carrying its own refutation (docstring note 4)
    # ---------------------------------------------------------------------------------
    dim_company = comp.rename(
        {
            "Company_ID_1081": "company_id",
            "Market_Share_Percent": "market_share_pct",
            "Reputation_Score": "reputation",
            "Enforcement_History": "enforcement",
            "Company_Size_Tier": "size_tier",
            "Complaint_Count": "complaints",
            "Timely_Response_Rate": "timely_rate",
            "Avg_Response_Time_Days": "avg_response_days",
            "Complaints_per_1pct_Share": "kpi_per_1pct_share",
        }
    ).with_columns(
        kpi_rank=pl.col("kpi_per_1pct_share").rank("min", descending=True).cast(pl.Int32),
        share_rank=pl.col("market_share_pct").rank("min", descending=False).cast(pl.Int32),
        volume_rank=pl.col("complaints").rank("min", descending=True).cast(pl.Int32),
    )
    # The whole Q6 finding in one assertion.
    rho = np.corrcoef(dim_company["kpi_rank"].to_numpy(), dim_company["share_rank"].to_numpy())[
        0, 1
    ]
    print(f"  corr(kpi_rank, share_rank) = {rho:+.4f}  <- the shipped KPI IS the size ranking")
    if rho < 0.9:
        raise SystemExit("the KPI/share rank coupling broke - revisit profile.md DQ1.")

    # ---------------------------------------------------------------------------------
    # Conformed dimensions
    # ---------------------------------------------------------------------------------
    def dim(name: str, col: str) -> pl.DataFrame:
        return (
            f.group_by(col)
            .agg(
                complaints=pl.len(),
                default_relief=pl.col("got_relief").mean() * 100,
                money_rate=pl.col("got_money").mean() * 100,
                timely_rate=(pl.col("is_timely").filter(pl.col("is_resolved")).mean() * 100),
                avg_days=pl.col("response_days").mean(),
            )
            .sort("complaints", descending=True)
            .with_row_index(f"{name}_key")
        )

    dim_product = dim("product", "product")
    dim_issue = dim("issue", "issue")
    dim_channel = dim("channel", "channel")
    dim_outcome = dim("outcome", "outcome")
    dim_state = (
        f.group_by("state")
        .agg(
            complaints=pl.len(),
            region=pl.col("region").first(),
            division=pl.col("division").first(),
            latitude=pl.col("latitude").first(),
            longitude=pl.col("longitude").first(),
            timely_rate=(pl.col("is_timely").filter(pl.col("is_resolved")).mean() * 100),
            money_rate=pl.col("got_money").mean() * 100,
        )
        .sort("complaints", descending=True)
        .with_row_index("state_key")
    )
    dim_month = (
        f.group_by("month")
        .agg(
            complaints=pl.len(),
            is_partial=pl.col("is_partial_month").first(),
            timely_rate=(pl.col("is_timely").filter(pl.col("is_resolved")).mean() * 100),
            money_rate=pl.col("got_money").mean() * 100,
            avg_days=pl.col("response_days").mean(),
        )
        .sort("month")
        .with_row_index("month_key")
    )

    for name, df in [
        ("fct_complaint", f),
        ("dim_company", dim_company),
        ("dim_product", dim_product),
        ("dim_issue", dim_issue),
        ("dim_channel", dim_channel),
        ("dim_outcome", dim_outcome),
        ("dim_state", dim_state),
        ("dim_month", dim_month),
    ]:
        df.write_parquet(CURATED / f"{name}.parquet")

    export_app_data(f, dim_company, dim_month)

    print("\nRow drop log (copy into assumptions.md):")
    if _dropped:
        for label, n, why in _dropped:
            print(f"  {label}: {n:,} - {why}")
    else:
        print("  none. The 1,494 in-progress complaints are KEPT and excluded from the")
        print("  timeliness denominator only (assumptions.md A-1) - that distinction is")
        print("  worth 2.30pp and is the easiest wrong number to publish from this file.")

    print()
    for p in sorted(CURATED.glob("*.parquet")):
        print(f"  {p.name:24} {pl.read_parquet(p).height:>7,} rows")


def _register_evidence(f: pl.DataFrame) -> dict:
    """The positive tests that the consumer half is a real register, as scalars.

    Three legs, each replacing or repairing one the month published:

      1. ID ORDER. "Strict date order" is FALSE - sorting by complaint_id, 7,036 of 62,515
         adjacent pairs (11.25%) move backwards in date, by a median of one day. What is
         true is that the sequence is monotone at the month grain: the median complaint_id
         rises in every one of the 75 month-to-month steps, and Spearman is 0.99999.
         A jittered sequential register, not a strict one, and not a generated column.
      2. WEEKENDS. Untouched: Saturday and Sunday run at roughly a half and a third of an
         average day's volume. Multinomial draws do not produce weekends.
      3. TAXONOMY. "A tree" is an overstatement - 13 of 76 issues appear under more than
         one product and those issues carry 20.93% of the register. 63 of 76 sit under
         exactly one product, and 89.06% of the multi-parent rows still sit under their
         issue's modal product, so 2.29% of the file is genuinely off-hierarchy.
    """
    d = f.to_pandas().sort_values("complaint_id")
    sub = d.date_submitted.values.astype("datetime64[D]").astype(int)
    steps = np.diff(sub)
    med = d.groupby(d.month)["complaint_id"].median().sort_index()
    dow = d.date_submitted.dt.dayofweek.value_counts().reindex(range(7)).fillna(0)
    exp = len(d) / 7

    per_issue = d.groupby("issue")["product"].nunique()
    multi = per_issue[per_issue > 1].index
    multi_rows = int(d.issue.isin(multi).sum())
    modal = int(
        d[d.issue.isin(multi)].groupby(["issue", "product"]).size().groupby(level=0).max().sum()
    )

    ev = {
        "idBackwardsPct": float((steps < 0).mean() * 100),
        "idBackwards": int((steps < 0).sum()),
        "idPairs": len(steps),
        "idMonthSteps": int(len(med) - 1),
        "idMonthStepsRising": int((np.diff(med.values) > 0).sum()),
        "satIndex": float(dow[5] / exp),
        "sunIndex": float(dow[6] / exp),
        "issuesTotal": len(per_issue),
        "issuesSingleParent": int((per_issue == 1).sum()),
        "multiParentRowPct": float(multi_rows / len(d) * 100),
        "offHierarchyRowPct": float((multi_rows - modal) / len(d) * 100),
    }
    print(
        f"  register evidence: ids backwards {ev['idBackwards']:,}/{ev['idPairs']:,} "
        f"({ev['idBackwardsPct']:.4f}%), month-grain rising "
        f"{ev['idMonthStepsRising']}/{ev['idMonthSteps']}; "
        f"Sat {ev['satIndex']:.4f} Sun {ev['sunIndex']:.4f}; "
        f"single-parent issues {ev['issuesSingleParent']}/{ev['issuesTotal']}, "
        f"multi-parent rows {ev['multiParentRowPct']:.4f}%, "
        f"off-hierarchy {ev['offHierarchyRowPct']:.4f}%"
    )
    return ev


def export_app_data(f: pl.DataFrame, comp: pl.DataFrame, months: pl.DataFrame) -> None:
    """Columnar, dictionary-encoded payload.

    Same deviation as 2025/05 onward: DuckDB-WASM's ~32 MB engine and ~30s cold start to
    query a file that fits in a few hundred KB. 62,516 rows scan in single-digit ms in JS.
    """
    import json

    d = f.to_pandas()
    DICT = ["channel", "state", "region", "product", "issue", "outcome"]

    # The cross-column integrity break, per row. `Response_Time_Days` is measured from
    # `Date submitted` and ignores `Date received`, which is exactly what produces rows
    # answered before they arrived. Zero rows are answered before they were SUBMITTED.
    early_days = (
        (d.date_received - d.date_responded).dt.days.clip(lower=0).fillna(0).astype(int).tolist()
    )
    _n_early = sum(1 for x in early_days if x > 0)
    print(
        f"  {_n_early:,} complaints ({_n_early / len(d) * 100:.4f}%) answered before "
        f"they were received, up to {max(early_days)} days early"
    )

    # THE REAL CLOCK. `Response_Time_Days` is a uniform draw and separates nothing; the
    # INTAKE LAG (received - submitted) is real and separates channels enormously. It was
    # asserted in the UI ("the intake lag is real and separates channels enormously") and
    # never rendered, so nothing recomputed it. It now travels per row like everything else.
    lag_days = d.intake_lag.fillna(0).astype(int).tolist()
    _dl = sum(1 for x in lag_days if x > 0)
    print(
        f"  intake lag: {_dl:,} complaints ({_dl / len(d) * 100:.4f}%) reached the CFPB "
        f"later than they were submitted; mean {np.mean(lag_days):.4f} d, max {max(lag_days):,} d"
    )

    def _sparse(vals: list[int]) -> dict:
        """Both `early` and `lag` are zero on most rows (60,366 and 49,634 of 62,516).

        A dense JSON array of 62,516 mostly-zero integers costs ~125 kB each and the payload
        is already the programme's largest. Ship index/value pairs and expand once in
        `data.ts:decode()` - identical per-row access, a fifth of the bytes.
        """
        idx = [i for i, v in enumerate(vals) if v]
        return {"n": len(vals), "idx": idx, "val": [vals[i] for i in idx]}

    def enc(col: str) -> dict:
        levels = sorted(d[col].dropna().unique().tolist())
        idx = {v: i for i, v in enumerate(levels)}
        # -1 encodes NULL. Never imputed, never dropped.
        return {"levels": levels, "codes": [idx.get(v, -1) for v in d[col]]}

    # -----------------------------------------------------------------------------------
    # THE SIGNATURE CHART's data - THE COMPLETE GRID, not a selection.
    #
    # An earlier version of this build computed 14 hand-picked tests, and the chart claimed
    # to plot "every association test in the file". It plotted 14 of 78. The company side
    # was clean either way - all TWELVE possible company_id x X tests land in 0.9450-1.0181,
    # so the published band was in fact the band of all of them - but the consumer side was
    # a selection: 17 of the 66 consumer x consumer pairs fall below the 5.70 that was
    # published as the consumer floor, the lowest being state x weekday at 1.1708, which is
    # only 1.15x above the strongest company test. On the full grid the two clouds nearly
    # touch, so "no overlap" was true of the fourteen drawn and false of the file.
    #
    # This now enumerates the WHOLE cross-product of the file's twelve categorical columns
    # (12 company + C(12,2) = 66 consumer = 78 tests) and carries four things the ratio
    # alone cannot say.
    #
    #   1. `cramersV` - the EFFECT SIZE. chi2/df rewards degrees of freedom, not signal.
    #      Every company test sits at V 0.128-0.134; weekday x product has V = 0.027 and
    #      still plots 5.7x higher, purely because it has 48 df against 8,640. 46 of the 66
    #      consumer pairs have a SMALLER V than every company test. V is itself inflated on
    #      a 1,081-level axis, so neither scale settles it alone - which is why the verdict
    #      below is the Bonferroni column and not the height on the chart.
    #   2. `definitional` - V >= 0.9 means the pair restates a column. Five pairs are exact
    #      functional dependencies (V = 1.0000: outcome x monetary relief, region x
    #      division, product x sub-product, state x region, state x division) and
    #      product x issue is V = 0.9467 - the near-tautology that used to set the headline
    #      maximum at 747x, forced by the same nesting this month publishes as proof the
    #      taxonomy is hierarchical.
    #   3. `family` - which question the pair asks.
    #        company      the 12 company_id tests
    #        calendrical  the 21 consumer pairs touching `weekday` or `timeliness`, i.e. the
    #                     calendar and the label the file fabricates. Independence here is
    #                     the EXPECTED result, not a defect.
    #        structural   the 45 pairs among the ten substantive consumer columns.
    #   4. `significant` - Bonferroni over the whole grid, alpha = 0.05/78.
    #
    # The exhaustive, non-selective statement the thesis now rests on:
    #     0 of 12 company tests clear Bonferroni (weakest company p = 0.285)
    #     45 of 45 structural consumer pairs clear it   (weakest p = 6.9e-23)
    #     13 of 21 calendrical pairs clear it; all 8 failures touch weekday or timeliness.
    # -----------------------------------------------------------------------------------
    import itertools

    import pandas as pd
    from scipy import stats as _st

    dd = d.copy()
    dd["yr"] = dd.date_submitted.dt.year
    dd["dow"] = dd.date_submitted.dt.dayofweek
    # is_timely is NULL on the in-progress complaints; crosstab drops them, which is right -
    # "timeliness" is a two-level axis, not a three-level one with a "don't know yet".
    dd["is_timely"] = dd["is_timely"].astype("object").where(dd["is_resolved"], other=None)

    CHI_COLS = {
        "product": "product",
        "sub-product": "sub_product",
        "issue": "issue",
        "state": "state",
        "region": "region",
        "division": "division",
        "channel": "channel",
        "outcome": "outcome",
        "year": "yr",
        "weekday": "dow",
        "timeliness": "is_timely",
        "monetary relief": "got_money",
    }
    # Axes on which two consumer columns are EXPECTED to be independent.
    SOFT = {"weekday", "timeliness"}

    def _chi(a: str, b: str, la: str, lb: str, side: str) -> dict:
        ct = pd.crosstab(dd[a], dd[b])
        ct = ct.loc[ct.sum(axis=1) > 0, ct.sum(axis=0) > 0]
        c2, pv, dof, _ = _st.chi2_contingency(ct)
        n = int(ct.values.sum())
        v = float(np.sqrt(c2 / (n * (min(ct.shape) - 1)))) if min(ct.shape) > 1 else float("nan")
        fam = (
            "company" if side == "company" else "calendrical" if ({la, lb} & SOFT) else "structural"
        )
        return {
            "label": f"{la} × {lb}",
            "side": side,
            "family": fam,
            "chi2": float(c2),
            "df": int(dof),
            "ratio": float(c2 / dof),
            "p": float(pv),
            "cramersV": v,
            "n": n,
            "definitional": bool(v >= 0.9),
        }

    chi_tests = [
        _chi("company_id", col, "company", lbl, "company") for lbl, col in CHI_COLS.items()
    ] + [
        _chi(c1, c2, l1, l2, "consumer")
        for (l1, c1), (l2, c2) in itertools.combinations(CHI_COLS.items(), 2)
    ]
    _expected = len(CHI_COLS) + len(CHI_COLS) * (len(CHI_COLS) - 1) // 2
    if len(chi_tests) != _expected:
        raise SystemExit(f"grid is {len(chi_tests)} tests, expected {_expected} - not exhaustive")
    _alpha = 0.05 / len(chi_tests)
    for t in chi_tests:
        t["alpha"] = _alpha
        t["significant"] = bool(t["p"] < _alpha)

    def _fam(name: str) -> list[dict]:
        return [t for t in chi_tests if t["family"] == name]

    _comp, _cal, _str = _fam("company"), _fam("calendrical"), _fam("structural")
    _cons = [t for t in chi_tests if t["side"] == "consumer"]
    print(
        f"  chi-square grid: {len(chi_tests)} tests over {len(CHI_COLS)} categorical columns "
        f"({len(_comp)} company, {len(_cons)} consumer), Bonferroni alpha {_alpha:.2e}"
    )
    for nm, s in [("company", _comp), ("structural", _str), ("calendrical", _cal)]:
        print(
            f"    {nm:12} n={len(s):2}  chi2/df {min(t['ratio'] for t in s):.4f}-"
            f"{max(t['ratio'] for t in s):>10,.2f}  V {min(t['cramersV'] for t in s):.4f}-"
            f"{max(t['cramersV'] for t in s):.4f}  "
            f"{sum(t['significant'] for t in s)}/{len(s)} clear Bonferroni  "
            f"{sum(t['definitional'] for t in s)} definitional"
        )
    print(
        f"    closest approach: min consumer {min(t['ratio'] for t in _cons):.4f}x vs "
        f"max company {max(t['ratio'] for t in _comp):.4f}x = "
        f"{min(t['ratio'] for t in _cons) / max(t['ratio'] for t in _comp):.4f}x"
    )
    _sep = min(t["ratio"] for t in _str if not t["definitional"]) / max(t["ratio"] for t in _comp)
    print(f"    structural separation (non-definitional): {_sep:.4f}x")
    print(
        f"    consumer pairs with V below every company test: "
        f"{sum(1 for t in _cons if t['cramersV'] < min(c['cramersV'] for c in _comp))}"
        f"/{len(_cons)}"
    )

    # The thesis, as three assertions. Each is the claim the page makes, in code.
    if any(t["significant"] for t in _comp):
        raise SystemExit(
            "a company-identifier association test now clears Bonferroni - the "
            "'uniform random overlay' thesis no longer holds. Revisit profile.md."
        )
    if not all(t["significant"] for t in _str):
        raise SystemExit(
            "a structural consumer pair no longer clears Bonferroni - the caption's "
            "'45 of 45' is false. Recount before shipping."
        )
    _bad = [
        t["label"]
        for t in chi_tests
        if not t["significant"]
        and t["family"] != "company"
        and not ({p.strip() for p in t["label"].split("×")} & SOFT)
    ]
    if _bad:
        raise SystemExit(f"non-significant consumer pairs outside weekday/timeliness: {_bad}")

    # Persist as a table too: tools/verify_metrics.py must recompute the signature chart's
    # separation from data, not from a literal in metric_checks.yml.
    pl.DataFrame(chi_tests).write_parquet(CURATED / "dim_chitest.parquet")

    payload = {
        "n": len(d),
        "chiTests": chi_tests,
        "cols": {c: enc(c) for c in DICT},
        "month_idx": d.month.rank(method="dense").astype(int).sub(1).tolist(),
        "months": [str(m) for m in months["month"].to_list()],
        "monthPartial": [bool(x) for x in months["is_partial"].to_list()],
        "days": d.response_days.astype(int).tolist(),
        "resolved": d.is_resolved.astype(int).tolist(),
        # is_timely is NULL on the 1,494 in-progress rows. Encoded as 0 here, but the
        # "resolved" array is what gates every timeliness denominator - never sum "timely"
        # over all rows. Doing so gives 93.77% instead of 96.06% (assumptions.md A-1).
        "timely": d.is_timely.fillna(False).astype(int).tolist(),
        "money": d.got_money.astype(int).tolist(),
        "relief": d.got_relief.astype(int).tolist(),
        # Days ANSWERED BEFORE RECEIVED, 0 where the row is not impossible. Carried per row
        # so the callout that reports it responds to the cross-filter like everything else,
        # rather than being a literal typed into the prose. 2,150 rows are non-zero.
        "early": _sparse(early_days),
        # The REAL clock: days between submission and receipt. Non-uniform, and the only
        # speed measure in the file that separates anything (Kruskal epsilon^2 = 0.364).
        "lag": _sparse(lag_days),
        "companies": comp.select(
            "company_id",
            "market_share_pct",
            "reputation",
            "enforcement",
            "size_tier",
            "complaints",
            "timely_rate",
            "avg_response_days",
            "kpi_per_1pct_share",
            "kpi_rank",
            "share_rank",
            "volume_rank",
        ).to_dicts(),
        "meta": {
            "sourceRows": len(d),
            "inProgress": int((~d.is_resolved).sum()),
            "timelyDenominator": "resolved complaints only (assumptions.md A-1)",
            "partialMonth": "the final month is truncated at 2023-08-28 (A-3)",
            # ------------------------------------------------------------------------
            # THE THREE PROOFS that the consumer half is a real register.
            #
            # The masthead used to claim "the IDs are issued in strict date order" and
            # "the product-issue taxonomy is a tree". Neither survives as worded: 11.25%
            # of adjacent ID pairs step BACKWARDS in date, and 13 issues appear under more
            # than one product covering a fifth of the file. What does survive is stated
            # here, and every one of these is recomputed from the parquet by
            # tools/verify_metrics.py (model/metric_checks.yml) rather than trusted.
            #
            # Day-of-week and complaint_id are NOT shipped per row - 62,516 more integers
            # for three sentences - so these are build-time scalars in the same sense as
            # sourceRows. They are not cross-filter reactive and nothing on the page
            # implies they are.
            # ------------------------------------------------------------------------
            **_register_evidence(f),
        },
    }
    out = MONTH_DIR / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(
        f"  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB, {payload['n']:,} complaints)"
    )


if __name__ == "__main__":
    main()
