#!/usr/bin/env python3
"""raw -> curated star schema for 2026/10 Sunrise Coffee Chain  (Gate G4).

Rules kept from the template:
  - The raw folder is READ-ONLY. Never write into it.
  - Log every row dropped and why. This month drops none; the assertion below proves it.
  - Output parquet into data/curated/ and the app's JSON into app/public/data/.

Modelling decisions (all in assumptions.md):
  - fct_store_month is the P&L of record. profitability_status and rent_band are RE-DERIVED from
    the documented bands; the supplied labels survive as source_status / source_rent_band.
  - fct_daily_sample is a sample, not a ledger. It does not reconcile to the P&L (C23), so it is
    never joined to fct_store_month and never summed into money totals.
  - dim_contract is the 24-row source contract from analysis/integrity.py.
"""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import polars as pl

MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
PUBLIC = MONTH / "app" / "public" / "data"

STATUS_ORDER = ["Highly-Profitable", "Profitable", "Break-Even", "Loss-Making", "Structural-Loss"]
STREAMS = ["espresso", "filter", "food", "retail_beans"]
DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def premise(ok: bool, message: str) -> None:
    if not ok:
        raise SystemExit(f"PREMISE FAILED: {message}")


def find_data_dir() -> Path:
    hit = next(MONTH.rglob("fact_store_monthly_profitability.csv"), None)
    premise(hit is not None, "raw archive missing - run `just fetch 2026 10`")
    return hit.parent  # type: ignore[union-attr]


def load_integrity():
    spec = importlib.util.spec_from_file_location(
        "integrity_2026_10", MONTH / "analysis" / "integrity.py"
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def finite(v):
    if isinstance(v, float):
        premise(math.isfinite(v), f"non-finite value {v} in export")
        return v
    if isinstance(v, dict):
        return {k: finite(x) for k, x in v.items()}
    if isinstance(v, list):
        return [finite(x) for x in v]
    return v


def dump_json(name: str, data) -> None:
    (PUBLIC / name).write_text(
        json.dumps(finite(data), separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
    )


def write(name: str, frame: pl.DataFrame) -> None:
    frame.write_parquet(CURATED / f"{name}.parquet", compression="zstd", statistics=True)
    print(f"  {name:<22} {frame.height:>6,} rows")


def status_expr(col: str) -> pl.Expr:
    m = pl.col(col)
    return (
        pl.when(m > 0.20)
        .then(pl.lit("Highly-Profitable"))
        .when(m > 0.08)
        .then(pl.lit("Profitable"))
        .when(m > -0.02)
        .then(pl.lit("Break-Even"))
        .when(m > -0.15)
        .then(pl.lit("Loss-Making"))
        .otherwise(pl.lit("Structural-Loss"))
    )


def rent_band_expr(col: str) -> pl.Expr:
    r = pl.col(col)
    return (
        pl.when(r < 5_000)
        .then(pl.lit("Low"))
        .when(r < 9_000)
        .then(pl.lit("Medium"))
        .when(r < 16_000)
        .then(pl.lit("High"))
        .otherwise(pl.lit("Premium"))
    )


def main() -> int:
    raw = find_data_dir()
    CURATED.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    read = lambda n: pl.read_csv(raw / f"{n}.csv", infer_schema_length=None)  # noqa: E731
    d_date, d_store, d_prod, f_day, f_mon = (
        read("dim_date"),
        read("dim_store"),
        read("dim_product"),
        read("fact_daily_sales"),
        read("fact_store_monthly_profitability"),
    )
    rows_in = sum(t.height for t in (d_date, d_store, d_prod, f_day, f_mon))

    # premises the model relies on - fail loudly if a re-download changes them
    premise(d_store["store_id"].is_unique().all(), "store_id unique")
    premise(
        f_mon.select(pl.struct("store_id", "month_id").is_unique().all()).item(),
        "store-month unique",
    )
    premise(f_mon.height == 60 * 24, "60 stores x 24 months")
    premise(f_day["daily_sale_id"].is_unique().all(), "daily_sale_id unique")

    # ---------------------------------------------------------------- dim_date
    dim_date = d_date.with_columns(
        pl.col("full_date").str.to_date(),
    ).with_columns(
        month_id=pl.col("full_date").dt.strftime("%Y-%m"),
        dow_index=pl.col("full_date").dt.weekday(),  # 1 = Monday
    )

    # ---------------------------------------------------------------- dim_store
    dim_store = d_store.rename(
        {
            "monthly_rent_gbp": "contract_rent_gbp",
            "monthly_staffing_cost_gbp": "contract_staffing_gbp",
        }
    ).with_columns(
        name_suggests_transit=pl.col("store_name").str.contains("Station|Hub"),
        short_name=pl.col("store_name").str.replace("^Sunrise Coffee ", ""),
    )

    # ---------------------------------------------------------------- fct_store_month (P&L)
    fct = (
        f_mon.rename(
            {
                "profitability_status": "source_status",
                "rent_band": "source_rent_band",
            }
        )
        .with_columns(
            fixed_cost_gbp=pl.col("monthly_rent_gbp") + pl.col("monthly_staffing_cost_gbp"),
            gross_profit_gbp=pl.col("total_monthly_revenue_gbp") - pl.col("total_monthly_cogs_gbp"),
            year=pl.col("month_id").str.slice(0, 4).cast(pl.Int32),
            month_number=pl.col("month_id").str.slice(5, 2).cast(pl.Int32),
            status=status_expr("net_profit_margin_pct"),
            rent_band=rent_band_expr("monthly_rent_gbp"),
        )
        .with_columns(
            quarter=((pl.col("month_number") - 1) // 3 + 1).cast(pl.Int32),
            status_matches_source=pl.col("status") == pl.col("source_status"),
        )
    )
    resid = (
        (
            fct["net_profit_gbp"]
            - (fct["gross_profit_gbp"] - fct["fixed_cost_gbp"] - fct["loyalty_redemption_cost_gbp"])
        )
        .abs()
        .max()
    )
    premise(resid < 0.02, f"P&L identity residual {resid}")

    # store-level mart: the unit of analysis for every store question
    store_mart = (
        fct.group_by("store_id")
        .agg(
            months=pl.len(),
            revenue_gbp=pl.col("total_monthly_revenue_gbp").sum(),
            cogs_gbp=pl.col("total_monthly_cogs_gbp").sum(),
            fixed_cost_gbp=pl.col("fixed_cost_gbp").sum(),
            redemption_gbp=pl.col("loyalty_redemption_cost_gbp").sum(),
            net_profit_gbp=pl.col("net_profit_gbp").sum(),
            member_spend_gbp=pl.col("loyalty_member_spend_gbp").sum(),
            revenue_2023=pl.col("total_monthly_revenue_gbp").filter(pl.col("year") == 2023).sum(),
            revenue_2024=pl.col("total_monthly_revenue_gbp").filter(pl.col("year") == 2024).sum(),
            net_profit_2023=pl.col("net_profit_gbp").filter(pl.col("year") == 2023).sum(),
            net_profit_2024=pl.col("net_profit_gbp").filter(pl.col("year") == 2024).sum(),
            loss_months=(pl.col("net_profit_gbp") < 0).sum(),
            source_status_mismatches=(~pl.col("status_matches_source")).sum(),
            monthly_profit_sd=pl.col("net_profit_gbp").std(),
        )
        .join(dim_store, on="store_id")
        .with_columns(
            margin=pl.col("net_profit_gbp") / pl.col("revenue_gbp"),
            revenue_pm=pl.col("revenue_gbp") / pl.col("months"),
            fixed_pm=pl.col("fixed_cost_gbp") / pl.col("months"),
            net_profit_pm=pl.col("net_profit_gbp") / pl.col("months"),
            redemption_pm=pl.col("redemption_gbp") / pl.col("months"),
            member_share=pl.col("member_spend_gbp") / pl.col("revenue_gbp"),
            profit_change=pl.col("net_profit_2024") - pl.col("net_profit_2023"),
        )
        .sort("store_id")
    )
    median_fixed = store_mart["fixed_pm"].median()
    store_mart = store_mart.with_columns(
        cost_half=pl.when(pl.col("fixed_pm") <= median_fixed)
        .then(pl.lit("Lower-cost half"))
        .otherwise(pl.lit("Higher-cost half")),
        status=status_expr("margin"),
    )

    # ---------------------------------------------------------------- fct_daily_sample
    daily = f_day.join(
        dim_date.select(
            "date_id",
            "full_date",
            "day_of_week",
            "dow_index",
            "is_weekend",
            "is_uk_bank_holiday",
            "uk_trading_calendar",
            "month_id",
        ),
        on="date_id",
    ).with_columns(
        rows_on_store_day=pl.len().over(["store_id", "date_id"]),
    )
    premise(daily.height == f_day.height, "daily join lost rows")

    # ---------------------------------------------------------------- contract
    integrity = load_integrity()
    audit = integrity.analyze(raw)
    dim_contract = pl.DataFrame(audit["contract"])

    rows_out = dim_date.height + dim_store.height + d_prod.height + daily.height + fct.height
    premise(rows_in == rows_out, f"rows in {rows_in} != rows out {rows_out}")
    print(f"rows in {rows_in:,} = rows out {rows_out:,}; dropped 0")

    for name, frame in {
        "dim_date": dim_date,
        "dim_store": dim_store,
        "dim_product": d_prod,
        "fct_store_month": fct,
        "fct_daily_sample": daily,
        "mart_store": store_mart,
        "dim_contract": dim_contract,
        "dim_evidence": pl.DataFrame(
            [
                {"stat": "region_revenue_kw_p", "value": float(audit["region"]["revenue_kw_p"])},
                {
                    "stat": "store_revenue_kw_p",
                    "value": float(audit["store_identity"]["revenue"]["kw_p_store"]),
                },
                {
                    "stat": "season_revenue_kw_p",
                    "value": float(audit["season"]["month_of_year_revenue_kw_p"]),
                },
                {
                    "stat": "format_permutation_p",
                    "value": float(audit["format"]["permutation_p_two_sided"]),
                },
                {"stat": "weekend_hours_mwu_p", "value": float(audit["week"]["hours_mwu_p"])},
                {
                    "stat": "daily_monthly_r",
                    "value": float(audit["daily_vs_monthly"]["r_avg_day_vs_month_revenue"]),
                },
                {
                    "stat": "noise_sd_annual_delta",
                    "value": float(audit["brief"]["q4_noise_sd_annual_delta"]),
                },
            ]
        ),
    }.items():
        write(name, frame)

    # ---------------------------------------------------------------- app exports
    for old in PUBLIC.glob("*.json"):
        old.unlink()
    r6 = lambda v: round(float(v), 6)  # noqa: E731
    dump_json(
        "stores.json",
        [
            {
                "id": r["store_id"],
                "name": r["short_name"],
                "region": r["region"],
                "loc": r["location_type"],
                "format": r["store_format"],
                "status_store": r["store_status"],
                "adoption": r6(r["loyalty_adoption_rate"]),
                "opened": r["opening_year"],
                "transitName": r["name_suggests_transit"],
            }
            for r in store_mart.iter_rows(named=True)
        ],
    )
    dump_json(
        "store_months.json",
        [
            {
                "s": r["store_id"],
                "m": r["month_id"],
                "rev": r6(r["total_monthly_revenue_gbp"]),
                "cogs": r6(r["total_monthly_cogs_gbp"]),
                "rent": r6(r["monthly_rent_gbp"]),
                "staff": r6(r["monthly_staffing_cost_gbp"]),
                "red": r6(r["loyalty_redemption_cost_gbp"]),
                "np": r6(r["net_profit_gbp"]),
                "mem": r6(r["loyalty_member_spend_gbp"]),
                "st": STATUS_ORDER.index(r["status"]),
                "src": STATUS_ORDER.index(r["source_status"]),
            }
            for r in fct.sort("store_id", "month_id").iter_rows(named=True)
        ],
    )
    # daily sample, pre-aggregated to store x weekday x bank-holiday: sums and counts only, so any
    # filtered mean the browser computes is an exact ratio of sums (no averaging of averages)
    week = (
        daily.with_columns(year=pl.col("full_date").dt.year())
        .group_by("store_id", "year", "dow_index", "is_uk_bank_holiday")
        .agg(
            n=pl.len(),
            rev=pl.col("total_revenue_gbp").sum(),
            hrs=pl.col("total_staff_hours").sum(),
            txn=pl.col("total_transactions").sum(),
            **{s: pl.col(f"{s}_revenue_gbp").sum() for s in STREAMS},
        )
        .sort("store_id", "year", "dow_index", "is_uk_bank_holiday")
    )
    dump_json(
        "week.json",
        [
            {
                "s": r["store_id"],
                "y": r["year"],
                "d": r["dow_index"],
                "bh": r["is_uk_bank_holiday"],
                "n": r["n"],
                "rev": r6(r["rev"]),
                "hrs": r6(r["hrs"]),
                "txn": r["txn"],
                **{s: r6(r[s]) for s in STREAMS},
            }
            for r in week.iter_rows(named=True)
        ],
    )
    dump_json("contract.json", audit["contract"])
    lo, wk, cv, rg, rp, fm, br, sm = (
        audit[k]
        for k in (
            "loyalty",
            "week",
            "cost_vs_revenue",
            "region",
            "repeatability",
            "format",
            "brief",
            "status_mismatch",
        )
    )
    dump_json(
        "evidence.json",
        {
            "r2_fixed": cv["r2_store_profit_on_fixed_cost"],
            "r2_revenue": cv["r2_store_profit_on_revenue"],
            "r_region_fixed": rg["r_region_margin_vs_fixed"],
            "r_region_revenue": rg["r_region_margin_vs_revenue"],
            "region_revenue_p": rg["revenue_kw_p"],
            "eta2_store_revenue": audit["store_identity"]["revenue"]["eta2_store"],
            "eta2_null": round(59 / 1439, 6),
            "r_rev_yoy": rp["revenue_2023_vs_2024_r"],
            "r_np_yoy": rp["net_profit_2023_vs_2024_r"],
            "noise_sd": br["q4_noise_sd_annual_delta"],
            "observed_sd": br["q4_observed_sd_annual_delta"],
            "loy_r_share": lo["r_adoption_member_share_store"],
            "loy_r_rev": lo["r_adoption_revenue_store"],
            "loy_lift10": lo["revenue_per_10pp_adoption"],
            "loy_lo10": lo["revenue_per_10pp_ci_low"],
            "loy_hi10": lo["revenue_per_10pp_ci_high"],
            "loy_upper": lo["upper_95_lift_at_mean_adoption"],
            "loy_needed": lo["revenue_needed_to_fund_redemption"],
            "loy_redemption_pm": lo["redemption_per_store_month"],
            "loy_mean_adoption": lo["mean_adoption"],
            "wk_eta2": wk["eta2_day_of_week"],
            "wk_surplus": wk["weekend_excess_hours_share"],
            "wk_hours_p": wk["hours_mwu_p"],
            "season_p": audit["season"]["month_of_year_revenue_kw_p"],
            "format_p": fm["permutation_p_two_sided"],
            "format_gap_pp": fm["margin_gap_pp"],
            "status_mismatch": sm["rows"],
            "contract_holds": audit["contract_summary"]["holds"],
            "contract_tested": audit["contract_summary"]["tested"],
            "daily_r": audit["daily_vs_monthly"]["r_avg_day_vs_month_revenue"],
            "daily_coverage": audit["daily_grain"]["coverage"],
            "median_fixed": r6(median_fixed),
            "mix_p": {k: v["p"] for k, v in audit["mix"].items()},
        },
    )
    print(f"exported {len(list(PUBLIC.glob('*.json')))} JSON files to app/public/data/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
