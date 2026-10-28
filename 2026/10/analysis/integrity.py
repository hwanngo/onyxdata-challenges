#!/usr/bin/env python3
"""Read-only G2/G3 integrity and hypothesis audit for the October 2026 Sunrise Coffee archive.

Reads the immutable raw CSVs only. Writes `analysis/integrity.json` next to this file so the
profile and ledger can quote one reproducible source. `analysis/test_integrity.py` pins the
load-bearing outputs; G4 re-derives the published ones independently from curated Parquet.

    uv run python 2026/10/analysis/integrity.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
OUT = Path(__file__).with_name("integrity.json")

# Documented thresholds, transcribed from docs/DATA_DICTIONARY.md
STATUS_BANDS = (  # label, lower bound inclusive (margin), per the dictionary
    ("Highly-Profitable", 0.20),
    ("Profitable", 0.08),
    ("Break-Even", -0.02),
    ("Loss-Making", -0.15),
    ("Structural-Loss", -math.inf),
)
RENT_BANDS = (("Low", 5_000), ("Medium", 9_000), ("High", 16_000), ("Premium", math.inf))
STREAMS = ("espresso", "filter", "food", "retail_beans")


def find_data_dir(month_dir: Path = MONTH_DIR) -> Path:
    hit = next(month_dir.rglob("fact_store_monthly_profitability.csv"), None)
    if hit is None:
        raise SystemExit("Raw archive not found. Run `just fetch 2026 10`.")
    return hit.parent


def load(data_dir: Path) -> dict[str, pd.DataFrame]:
    names = (
        "dim_date",
        "dim_store",
        "dim_product",
        "fact_daily_sales",
        "fact_store_monthly_profitability",
    )
    return {n: pd.read_csv(data_dir / f"{n}.csv") for n in names}


def status_band(margin: float) -> str:
    # The dictionary's ranges: Highly-Profitable (>20%), Profitable (8-20%), Break-Even (-2-8%),
    # Loss-Making (-15--2%), Structural-Loss (<-15%). Boundary inclusivity is not stated; no row
    # sits within 1e-4 of a boundary (asserted in the contract row), so the choice is immaterial.
    for label, lo in STATUS_BANDS:
        if margin > lo or (lo == -math.inf):
            return label
    return "Structural-Loss"


def rent_band(rent: float) -> str:
    for label, hi in RENT_BANDS:
        if rent < hi:
            return label
    return "Premium"


def eta2(df: pd.DataFrame, y: str, g: str) -> float:
    grand = df[y].mean()
    group_mean = df.groupby(g)[y].transform("mean")
    return float(((group_mean - grand) ** 2).sum() / ((df[y] - grand) ** 2).sum())


def kw_p(df: pd.DataFrame, y: str, g: str) -> float:
    return float(stats.kruskal(*[v[y].to_numpy() for _, v in df.groupby(g)]).pvalue)


def r2(y: np.ndarray, x: np.ndarray) -> float:
    return float(stats.pearsonr(x, y).statistic ** 2)


def rnd(v: float, k: int = 6) -> float:
    return float(round(float(v), k))


def analyze(data_dir: Path) -> dict:
    t = load(data_dir)
    dd, st, pr, ds, mo = (
        t["dim_date"],
        t["dim_store"],
        t["dim_product"],
        t["fact_daily_sales"],
        t["fact_store_monthly_profitability"],
    )
    dd["full_date"] = pd.to_datetime(dd["full_date"])
    out: dict = {}

    # ------------------------------------------------------------------ calendar
    real = dd["full_date"]
    out["calendar"] = {
        "rows": len(dd),
        "start": real.min().date().isoformat(),
        "end": real.max().date().isoformat(),
        "has_2024_02_29": bool((real == "2024-02-29").any()),
        "missing_2024_12_31": not bool((real == "2024-12-31").any()),
        "weekday_mismatch": int((real.dt.day_name() != dd["day_of_week"]).sum()),
        "weekend_mismatch": int(((real.dt.dayofweek >= 5) != dd["is_weekend"]).sum()),
        "iso_week_mismatch": int(
            (real.dt.isocalendar().week.astype(int) != dd["week_number"]).sum()
        ),
        "bank_holidays": int(dd["is_uk_bank_holiday"].sum()),
        "trading_calendar_values": sorted(dd["uk_trading_calendar"].unique().tolist()),
        "school_holiday_days": int((dd["uk_trading_calendar"] == "School-Holiday").sum()),
        "has_month_id_column": "month_id" in dd.columns,
    }

    # ------------------------------------------------------------------ estate shape
    out["estate"] = {
        "stores": len(st),
        "format_counts": st["store_format"].value_counts().to_dict(),
        "location_counts": st["location_type"].value_counts().to_dict(),
        "region_counts": st["region"].value_counts().to_dict(),
        "status_counts": st["store_status"].value_counts().to_dict(),
        "retail_park_stores": int((st["store_format"] == "Retail-Park").sum()),
        "station_or_hub_named_high_street": int(
            (
                st["store_name"].str.contains("Station|Hub") & (st["store_format"] == "High-Street")
            ).sum()
        ),
        "seating_nulls": int(st["seating_capacity"].isna().sum()),
    }

    # ------------------------------------------------------------------ daily grain
    per_day = ds.groupby(["store_id", "date_id"]).size()
    multi = ds.groupby(["store_id", "date_id"])["total_revenue_gbp"].nunique()
    out["daily_grain"] = {
        "rows": len(ds),
        "distinct_store_days": int(per_day.size),
        "possible_store_days": int(len(st) * len(dd)),
        "coverage": rnd(per_day.size / (len(st) * len(dd)), 4),
        "store_days_with_multiple_rows": int((per_day > 1).sum()),
        "max_rows_per_store_day": int(per_day.max()),
        "multi_row_store_days_with_different_revenue": int((multi[per_day > 1] > 1).sum()),
        "rows_per_store_min": int(ds.groupby("store_id").size().min()),
        "rows_per_store_max": int(ds.groupby("store_id").size().max()),
        "undocumented_columns": sorted(
            set(ds.columns)
            - {
                "daily_sale_id",
                "store_id",
                "date_id",
                "product_id",
                "total_revenue_gbp",
                "total_transactions",
                "avg_transaction_value_gbp",
                "loyalty_transactions",
                "loyalty_redemption_cost_gbp",
                "footfall",
                "espresso_revenue_gbp",
                "filter_revenue_gbp",
                "food_revenue_gbp",
                "retail_beans_revenue_gbp",
                "daily_gross_profit_gbp",
                "shift_pattern",
                "staff_count",
                "total_staff_hours",
            }
        ),
    }

    # ------------------------------------------------------------------ daily -> monthly
    dj = ds.merge(dd[["date_id", "full_date"]], on="date_id")
    dj["month_id"] = dj["full_date"].dt.strftime("%Y-%m")
    dm = (
        dj.groupby(["store_id", "month_id"])
        .agg(
            d_rev=("total_revenue_gbp", "sum"),
            d_rows=("daily_sale_id", "size"),
            d_avg=("total_revenue_gbp", "mean"),
        )
        .reset_index()
    )
    rec = dm.merge(mo, on=["store_id", "month_id"])
    store_daily = ds.groupby("store_id")["total_revenue_gbp"].mean()
    store_month = mo.groupby("store_id")["total_monthly_revenue_gbp"].mean()
    out["daily_vs_monthly"] = {
        "store_months_compared": len(rec),
        "median_implied_days": rnd((rec["total_monthly_revenue_gbp"] / rec["d_avg"]).median(), 3),
        "r_avg_day_vs_month_revenue": rnd(
            stats.pearsonr(rec["d_avg"], rec["total_monthly_revenue_gbp"]).statistic, 4
        ),
        "r_store_level": rnd(
            stats.pearsonr(store_daily, store_month.loc[store_daily.index]).statistic, 4
        ),
        "daily_gross_margin_mean": rnd(
            (ds["daily_gross_profit_gbp"] / ds["total_revenue_gbp"]).mean(), 4
        ),
        "monthly_gross_margin": rnd(
            1 - mo["total_monthly_cogs_gbp"].sum() / mo["total_monthly_revenue_gbp"].sum(), 4
        ),
    }

    # ------------------------------------------------------------------ source contract
    m = mo.merge(st, on="store_id", suffixes=("", "_dim"))
    np_resid = (
        m["net_profit_gbp"]
        - (
            m["total_monthly_revenue_gbp"]
            - m["total_monthly_cogs_gbp"]
            - m["monthly_rent_gbp"]
            - m["monthly_staffing_cost_gbp"]
            - m["loyalty_redemption_cost_gbp"]
        )
    ).abs()
    derived_status = m["net_profit_margin_pct"].map(status_band)
    near_boundary = m["net_profit_margin_pct"].apply(
        lambda x: any(abs(x - lo) < 1e-4 for _, lo in STATUS_BANDS if lo != -math.inf)
    )
    stream_sum = sum(ds[f"{s}_revenue_gbp"] for s in STREAMS)
    prod_margin = (pr["unit_price_gbp"] - pr["unit_cost_gbp"]) / pr["unit_price_gbp"]
    contract = [
        (
            "C01",
            "Estate spans High-Street, Retail-Park and Transport-Hub",
            "format count",
            f"{out['estate']['format_counts']}",
            out["estate"]["retail_park_stores"] > 0,
        ),
        (
            "C02",
            "fact_daily_sales is one row per store per day",
            "rows vs distinct store-days",
            f"{len(ds):,} rows / {per_day.size:,} store-days",
            per_day.size == len(ds),
        ),
        (
            "C03",
            "dim_date covers 2023-01-01 to 2024-12-31",
            "max date",
            out["calendar"]["end"],
            out["calendar"]["end"] == "2024-12-31",
        ),
        (
            "C04",
            "dim_date carries month_id",
            "column present",
            str(out["calendar"]["has_month_id_column"]),
            out["calendar"]["has_month_id_column"],
        ),
        (
            "C05",
            "uk_trading_calendar has 3 values",
            "distinct values",
            ", ".join(out["calendar"]["trading_calendar_values"]),
            len(out["calendar"]["trading_calendar_values"]) == 3,
        ),
        (
            "C06",
            "Weekday, weekend, ISO week flags derive from full_date",
            "mismatching rows",
            str(
                out["calendar"]["weekday_mismatch"]
                + out["calendar"]["weekend_mismatch"]
                + out["calendar"]["iso_week_mismatch"]
            ),
            out["calendar"]["weekday_mismatch"]
            + out["calendar"]["weekend_mismatch"]
            + out["calendar"]["iso_week_mismatch"]
            == 0,
        ),
        (
            "C07",
            "Monthly rent consistent with dim_store",
            "rows differing > £0.01",
            str(int(((m["monthly_rent_gbp"] - m["monthly_rent_gbp_dim"]).abs() > 0.01).sum())),
            bool(((m["monthly_rent_gbp"] - m["monthly_rent_gbp_dim"]).abs() <= 0.01).all()),
        ),
        (
            "C08",
            "Monthly staffing consistent with dim_store",
            "rows differing > £0.01",
            str(
                int(
                    (
                        (m["monthly_staffing_cost_gbp"] - m["monthly_staffing_cost_gbp_dim"]).abs()
                        > 0.01
                    ).sum()
                )
            ),
            bool(
                (
                    (m["monthly_staffing_cost_gbp"] - m["monthly_staffing_cost_gbp_dim"]).abs()
                    <= 0.01
                ).all()
            ),
        ),
        (
            "C09",
            "net_profit = revenue − COGS − rent − staffing − redemption",  # noqa: RUF001 - reader-facing typography in the source audit
            "rows off by > £0.02",
            str(int((np_resid > 0.02).sum())),
            bool((np_resid <= 0.02).all()),
        ),
        (
            "C10",
            "member + non-member spend = revenue",
            "rows off by > £0.02",
            str(
                int(
                    (
                        (
                            m["loyalty_member_spend_gbp"]
                            + m["non_member_spend_gbp"]
                            - m["total_monthly_revenue_gbp"]
                        ).abs()
                        > 0.02
                    ).sum()
                )
            ),
            bool(
                (
                    (
                        m["loyalty_member_spend_gbp"]
                        + m["non_member_spend_gbp"]
                        - m["total_monthly_revenue_gbp"]
                    ).abs()
                    <= 0.02
                ).all()
            ),
        ),
        (
            "C11",
            "profitability_status derives from documented margin bands",
            "rows disagreeing",
            str(int((derived_status != m["profitability_status"]).sum())),
            bool((derived_status == m["profitability_status"]).all())
            and not bool(near_boundary.any()),
        ),
        (
            "C12",
            "rent_band derives from documented rent thresholds",
            "rows disagreeing",
            str(int((m["monthly_rent_gbp"].map(rent_band) != m["rent_band"]).sum())),
            bool((m["monthly_rent_gbp"].map(rent_band) == m["rent_band"]).all()),
        ),
        (
            "C13",
            "net_profit_margin_pct within −1.0 to 0.6",  # noqa: RUF001 - reader-facing typography in the source audit
            "observed min",
            f"{m['net_profit_margin_pct'].min():.4f}",
            bool(m["net_profit_margin_pct"].between(-1.0, 0.6).all()),
        ),
        (
            "C14",
            "Four streams sum to daily revenue",
            "rows off by > £0.02",
            str(int(((stream_sum - ds["total_revenue_gbp"]).abs() > 0.02).sum())),
            bool(((stream_sum - ds["total_revenue_gbp"]).abs() <= 0.02).all()),
        ),
        (
            "C15",
            "ATV = revenue / transactions",
            "rows off by > £0.006",
            str(
                int(
                    (
                        (
                            ds["avg_transaction_value_gbp"]
                            - ds["total_revenue_gbp"] / ds["total_transactions"]
                        ).abs()
                        > 0.006
                    ).sum()
                )
            ),
            bool(
                (
                    (
                        ds["avg_transaction_value_gbp"]
                        - ds["total_revenue_gbp"] / ds["total_transactions"]
                    ).abs()
                    <= 0.006
                ).all()
            ),
        ),
        (
            "C16",
            "loyalty_transactions ≤ transactions ≤ footfall",
            "violating rows",
            str(
                int(
                    (
                        (ds["loyalty_transactions"] > ds["total_transactions"])
                        | (ds["footfall"] < ds["total_transactions"])
                    ).sum()
                )
            ),
            bool(
                (
                    (ds["loyalty_transactions"] <= ds["total_transactions"])
                    & (ds["footfall"] >= ds["total_transactions"])
                ).all()
            ),
        ),
        (
            "C17",
            "gross_margin_pct = (price − cost) / price",  # noqa: RUF001 - reader-facing typography in the source audit
            "rows off by > 0.001",
            str(int(((prod_margin - pr["gross_margin_pct"]).abs() > 0.001).sum())),
            bool(((prod_margin - pr["gross_margin_pct"]).abs() <= 0.001).all()),
        ),
        (
            "C18",
            "gross_margin_pct range 0.36–0.80",  # noqa: RUF001 - reader-facing typography in the source audit
            "observed range",
            f"{pr['gross_margin_pct'].min():.3f}–{pr['gross_margin_pct'].max():.3f}",  # noqa: RUF001 - reader-facing typography in the source audit
            bool(pr["gross_margin_pct"].between(0.36, 0.80).all()),
        ),
        (
            "C19",
            "launch_date is not nullable",
            "null rows",
            str(int(pr["launch_date"].isna().sum())),
            bool(pr["launch_date"].notna().all()),
        ),
        (
            "C20",
            "Catalogue margins can produce the P&L gross margin",
            "lowest product margin vs blended",
            f"{pr['gross_margin_pct'].min():.3f} vs {out['daily_vs_monthly']['monthly_gross_margin']:.3f}",
            bool(out["daily_vs_monthly"]["monthly_gross_margin"] >= pr["gross_margin_pct"].min()),
        ),
        (
            "C21",
            "seating_capacity null for some Transport-Hub stores",
            "null rows",
            str(out["estate"]["seating_nulls"]),
            out["estate"]["seating_nulls"] > 0,
        ),
        (
            "C22",
            "loyalty_member_revenue_pct / avg_daily_footfall contain nulls",
            "null rows",
            str(
                int(
                    mo["loyalty_member_revenue_pct"].isna().sum()
                    + mo["avg_daily_footfall"].isna().sum()
                )
            ),
            int(
                mo["loyalty_member_revenue_pct"].isna().sum()
                + mo["avg_daily_footfall"].isna().sum()
            )
            > 0,
        ),
        (
            "C23",
            "Daily fact reconciles to monthly P&L",
            "store-month r(avg day, month)",
            f"{out['daily_vs_monthly']['r_avg_day_vs_month_revenue']:.4f}",
            out["daily_vs_monthly"]["r_avg_day_vs_month_revenue"] > 0.5,
        ),
        (
            "C24",
            "fact_daily_sales schema as documented",
            "undocumented columns",
            ", ".join(out["daily_grain"]["undocumented_columns"]) or "none",
            not out["daily_grain"]["undocumented_columns"],
        ),
    ]
    out["contract"] = [
        {"id": i, "promise": p, "test": tst, "observed": obs, "verdict": "HOLDS" if ok else "FAILS"}
        for i, p, tst, obs, ok in contract
    ]
    out["contract_summary"] = {
        "tested": len(contract),
        "holds": sum(1 for *_, ok in contract if ok),
        "fails": sum(1 for *_, ok in contract if not ok),
    }
    xt = pd.crosstab(m["profitability_status"], derived_status)
    out["status_mismatch"] = {
        "rows": int((derived_status != m["profitability_status"]).sum()),
        "labelled_profitable_but_above_20pct": int(
            xt.loc["Profitable"].get("Highly-Profitable", 0)
        ),
        "labelled_break_even_but_8_to_20pct": int(xt.loc["Break-Even"].get("Profitable", 0)),
        "labelled_loss_making_but_below_minus_15pct": int(
            xt.loc["Loss-Making"].get("Structural-Loss", 0)
        ),
        "labelled_break_even_but_below_minus_2pct": int(xt.loc["Break-Even"].get("Loss-Making", 0)),
        "near_boundary_rows": int(near_boundary.sum()),
        "stores_changing_rent_band": int(
            (
                m.groupby("store_id")["monthly_rent_gbp"].apply(
                    lambda v: v.map(rent_band).nunique()
                )
                > 1
            ).sum()
        ),
    }

    # ------------------------------------------------------------------ what varies by store
    measures = {
        "revenue": "total_monthly_revenue_gbp",
        "cogs": "total_monthly_cogs_gbp",
        "footfall": "avg_daily_footfall",
        "rent": "monthly_rent_gbp",
        "staffing": "monthly_staffing_cost_gbp",
        "member_share": "loyalty_member_revenue_pct",
        "net_profit": "net_profit_gbp",
        "net_margin": "net_profit_margin_pct",
    }
    out["store_identity"] = {
        k: {
            "eta2_store": rnd(eta2(m, c, "store_id"), 4),
            "kw_p_store": float(f"{kw_p(m, c, 'store_id'):.3g}"),
            "eta2_month": rnd(eta2(m, c, "month_id"), 4),
        }
        for k, c in measures.items()
    }
    m["year"] = m["month_id"].str[:4]
    m["odd"] = m["month_id"].str[-2:].astype(int) % 2
    by_year = m.pivot_table(
        index="store_id",
        columns="year",
        values=[
            "total_monthly_revenue_gbp",
            "net_profit_gbp",
            "monthly_rent_gbp",
            "monthly_staffing_cost_gbp",
        ],
        aggfunc="mean",
    )
    by_half = m.pivot_table(
        index="store_id", columns="odd", values="total_monthly_revenue_gbp", aggfunc="mean"
    )

    def yr_r(col: str) -> float:
        return rnd(stats.pearsonr(by_year[(col, "2023")], by_year[(col, "2024")]).statistic, 4)

    out["repeatability"] = {
        "revenue_2023_vs_2024_r": yr_r("total_monthly_revenue_gbp"),
        "revenue_2023_vs_2024_p": rnd(
            stats.pearsonr(
                by_year[("total_monthly_revenue_gbp", "2023")],
                by_year[("total_monthly_revenue_gbp", "2024")],
            ).pvalue,
            4,
        ),
        "net_profit_2023_vs_2024_r": yr_r("net_profit_gbp"),
        "fixed_cost_2023_vs_2024_r": rnd(
            stats.pearsonr(
                by_year[("monthly_rent_gbp", "2023")]
                + by_year[("monthly_staffing_cost_gbp", "2023")],
                by_year[("monthly_rent_gbp", "2024")]
                + by_year[("monthly_staffing_cost_gbp", "2024")],
            ).statistic,
            4,
        ),
        "revenue_odd_vs_even_month_r": rnd(stats.pearsonr(by_half[0], by_half[1]).statistic, 4),
    }

    # ------------------------------------------------------------------ cost explains profit
    s = m.groupby("store_id").agg(
        revenue=("total_monthly_revenue_gbp", "mean"),
        rent=("monthly_rent_gbp", "mean"),
        staffing=("monthly_staffing_cost_gbp", "mean"),
        net_profit=("net_profit_gbp", "mean"),
        margin_rows=("net_profit_margin_pct", "mean"),
        adoption=("loyalty_adoption_rate", "first"),
        redemption=("loyalty_redemption_cost_gbp", "mean"),
        region=("region", "first"),
        fmt=("store_format", "first"),
        loc=("location_type", "first"),
        headcount=("staff_headcount", "first"),
        loss_months=("net_profit_gbp", lambda v: int((v < 0).sum())),
        total_profit=("net_profit_gbp", "sum"),
    )
    s["fixed"] = s["rent"] + s["staffing"]
    s["margin"] = s["net_profit"] / s["revenue"]
    out["cost_vs_revenue"] = {
        "r2_store_profit_on_fixed_cost": rnd(
            r2(s["net_profit"].to_numpy(), s["fixed"].to_numpy()), 4
        ),
        "r2_store_profit_on_revenue": rnd(
            r2(s["net_profit"].to_numpy(), s["revenue"].to_numpy()), 4
        ),
        "r_store_profit_fixed": rnd(stats.pearsonr(s["fixed"], s["net_profit"]).statistic, 4),
        "fixed_cost_share_of_revenue": rnd(
            (m["monthly_rent_gbp"] + m["monthly_staffing_cost_gbp"]).sum()
            / m["total_monthly_revenue_gbp"].sum(),
            4,
        ),
        "estate_margin": rnd(m["net_profit_gbp"].sum() / m["total_monthly_revenue_gbp"].sum(), 4),
        "store_revenue_min": rnd(s["revenue"].min(), 2),
        "store_revenue_max": rnd(s["revenue"].max(), 2),
        "store_fixed_min": rnd(s["fixed"].min(), 2),
        "store_fixed_max": rnd(s["fixed"].max(), 2),
        "headcount_vs_staffing_r": rnd(stats.pearsonr(s["headcount"], s["staffing"]).statistic, 4),
    }
    reg = s.groupby("region").agg(
        stores=("revenue", "size"),
        revenue=("revenue", "mean"),
        fixed=("fixed", "mean"),
        net_profit=("net_profit", "mean"),
    )
    reg["margin"] = reg["net_profit"] / reg["revenue"]
    out["region"] = {
        "revenue_kw_p": float(f"{kw_p(m, 'total_monthly_revenue_gbp', 'region'):.3g}"),
        "margin_kw_p": float(f"{kw_p(m, 'net_profit_margin_pct', 'region'):.3g}"),
        "r_region_margin_vs_fixed": rnd(stats.pearsonr(reg["fixed"], reg["margin"]).statistic, 4),
        "r_region_margin_vs_revenue": rnd(
            stats.pearsonr(reg["revenue"], reg["margin"]).statistic, 4
        ),
        "top_margin": reg["margin"].idxmax(),
        "bottom_margin": reg["margin"].idxmin(),
        "lowest_fixed": reg["fixed"].idxmin(),
        "highest_fixed": reg["fixed"].idxmax(),
        "revenue_spread_pct": rnd(
            (reg["revenue"].max() - reg["revenue"].min()) / reg["revenue"].mean(), 4
        ),
        "fixed_spread_pct": rnd((reg["fixed"].max() - reg["fixed"].min()) / reg["fixed"].mean(), 4),
    }

    # ------------------------------------------------------------------ format (n=2)
    th = s[s["fmt"] == "Transport-Hub"]["margin"]
    rng = np.random.default_rng(20261001)
    obs = th.mean() - s[s["fmt"] == "High-Street"]["margin"].mean()
    perm = []
    margins = s["margin"].to_numpy()
    for _ in range(20_000):
        idx = rng.choice(len(margins), size=len(th), replace=False)
        mask = np.zeros(len(margins), bool)
        mask[idx] = True
        perm.append(margins[mask].mean() - margins[~mask].mean())
    out["format"] = {
        "transport_hub_stores": len(th),
        "high_street_stores": int((s["fmt"] == "High-Street").sum()),
        "margin_gap_pp": rnd(obs * 100, 2),
        "permutation_p_two_sided": rnd(float(np.mean(np.abs(perm) >= abs(obs))), 4),
        "permutations": 20_000,
        "seed": 20261001,
        "hub_fixed_mean": rnd(s[s["fmt"] == "Transport-Hub"]["fixed"].mean(), 2),
        "street_fixed_mean": rnd(s[s["fmt"] == "High-Street"]["fixed"].mean(), 2),
    }

    # ------------------------------------------------------------------ loyalty
    lr = stats.linregress(s["adoption"], s["revenue"])
    mean_adoption = s["adoption"].mean()
    gross_margin = 1 - mo["total_monthly_cogs_gbp"].sum() / mo["total_monthly_revenue_gbp"].sum()
    redemption_per_store_month = s["redemption"].mean()
    needed = redemption_per_store_month / gross_margin
    upper_lift = (lr.slope + 1.96 * lr.stderr) * mean_adoption
    dl = ds.merge(st[["store_id", "loyalty_adoption_rate"]], on="store_id")
    dl["loyalty_share"] = dl["loyalty_transactions"] / dl["total_transactions"]
    sd = dl.groupby("store_id").agg(
        atv=("avg_transaction_value_gbp", "mean"),
        share=("loyalty_share", "mean"),
        adoption=("loyalty_adoption_rate", "first"),
    )
    out["loyalty"] = {
        "r_adoption_member_share_store": rnd(
            stats.pearsonr(
                s["adoption"], m.groupby("store_id")["loyalty_member_revenue_pct"].mean()
            ).statistic,
            4,
        ),
        "r_adoption_daily_loyalty_txn_share_store": rnd(
            stats.pearsonr(sd["adoption"], sd["share"]).statistic, 4
        ),
        "r_adoption_revenue_store": rnd(stats.pearsonr(s["adoption"], s["revenue"]).statistic, 4),
        "r_adoption_net_profit_store": rnd(
            stats.pearsonr(s["adoption"], s["net_profit"]).statistic, 4
        ),
        "r_adoption_atv_store": rnd(stats.pearsonr(sd["adoption"], sd["atv"]).statistic, 4),
        "r_loyalty_share_atv_daily": rnd(
            stats.pearsonr(dl["loyalty_share"], dl["avg_transaction_value_gbp"]).statistic, 4
        ),
        "revenue_per_10pp_adoption": rnd(lr.slope * 0.1, 2),
        "revenue_per_10pp_ci_low": rnd((lr.slope - 1.96 * lr.stderr) * 0.1, 2),
        "revenue_per_10pp_ci_high": rnd((lr.slope + 1.96 * lr.stderr) * 0.1, 2),
        "mean_adoption": rnd(mean_adoption, 4),
        "redemption_per_store_month": rnd(redemption_per_store_month, 2),
        "revenue_needed_to_fund_redemption": rnd(needed, 2),
        "upper_95_lift_at_mean_adoption": rnd(upper_lift, 2),
        "redemption_2023": rnd(m[m["year"] == "2023"]["loyalty_redemption_cost_gbp"].sum(), 2),
        "redemption_2024": rnd(m[m["year"] == "2024"]["loyalty_redemption_cost_gbp"].sum(), 2),
        "redemption_total": rnd(m["loyalty_redemption_cost_gbp"].sum(), 2),
        "adoption_by_format": s.groupby("fmt")["adoption"].mean().round(4).to_dict(),
        "adoption_region_kw_p": float(
            f"{stats.kruskal(*[v['adoption'].to_numpy() for _, v in s.groupby('region')]).pvalue:.3g}"
        ),
    }

    # ------------------------------------------------------------------ the week (daily fact)
    x = ds.merge(dd, on="date_id").merge(st[["store_id", "store_format"]], on="store_id")
    wk = x.groupby("is_weekend").agg(
        rev=("total_revenue_gbp", "mean"),
        hrs=("total_staff_hours", "mean"),
        txn=("total_transactions", "mean"),
        atv=("avg_transaction_value_gbp", "mean"),
        n=("daily_sale_id", "size"),
    )
    weekday_rph = wk.loc[False, "rev"] / wk.loc[False, "hrs"]
    weekend_rph = wk.loc[True, "rev"] / wk.loc[True, "hrs"]
    hours_needed = wk.loc[True, "rev"] / weekday_rph
    bh = x.groupby("is_uk_bank_holiday")["total_revenue_gbp"].mean()
    bhf = x.groupby(["store_format", "is_uk_bank_holiday"])["total_revenue_gbp"].agg(
        ["mean", "size"]
    )
    out["week"] = {
        "eta2_day_of_week": rnd(eta2(x, "total_revenue_gbp", "day_of_week"), 4),
        "eta2_store": rnd(eta2(x, "total_revenue_gbp", "store_id"), 4),
        "eta2_month": rnd(eta2(x, "total_revenue_gbp", "month_number"), 4),
        "weekday_revenue": rnd(wk.loc[False, "rev"], 2),
        "weekend_revenue": rnd(wk.loc[True, "rev"], 2),
        "weekend_gap_pct": rnd(wk.loc[True, "rev"] / wk.loc[False, "rev"] - 1, 4),
        "weekday_hours": rnd(wk.loc[False, "hrs"], 2),
        "weekend_hours": rnd(wk.loc[True, "hrs"], 2),
        "hours_mwu_p": rnd(
            stats.mannwhitneyu(
                x[x["is_weekend"]]["total_staff_hours"], x[~x["is_weekend"]]["total_staff_hours"]
            ).pvalue,
            4,
        ),
        "weekday_revenue_per_hour": rnd(weekday_rph, 2),
        "weekend_revenue_per_hour": rnd(weekend_rph, 2),
        "weekend_hours_at_weekday_productivity": rnd(hours_needed, 2),
        "weekend_excess_hours_share": rnd(1 - hours_needed / wk.loc[True, "hrs"], 4),
        "weekday_atv": rnd(wk.loc[False, "atv"], 4),
        "weekend_atv": rnd(wk.loc[True, "atv"], 4),
        "r_hours_revenue": rnd(
            stats.pearsonr(x["total_staff_hours"], x["total_revenue_gbp"]).statistic, 4
        ),
        "eta2_shift_pattern": rnd(eta2(x, "total_revenue_gbp", "shift_pattern"), 4),
        "bank_holiday_revenue": rnd(bh.loc[True], 2),
        "non_holiday_revenue": rnd(bh.loc[False], 2),
        "bank_holiday_gap_pct": rnd(bh.loc[True] / bh.loc[False] - 1, 4),
        "bank_holiday_rows": int(x["is_uk_bank_holiday"].sum()),
        "bh_hub_rows": int(bhf.loc[("Transport-Hub", True), "size"]),
        "bh_hub_gap_pct": rnd(
            bhf.loc[("Transport-Hub", True), "mean"] / bhf.loc[("Transport-Hub", False), "mean"]
            - 1,
            4,
        ),
        "bh_street_gap_pct": rnd(
            bhf.loc[("High-Street", True), "mean"] / bhf.loc[("High-Street", False), "mean"] - 1, 4
        ),
        "dow_mean": x.groupby("day_of_week")["total_revenue_gbp"].mean().round(2).to_dict(),
    }

    # ------------------------------------------------------------------ mix & season
    x["ym"] = x["full_date"].dt.strftime("%Y-%m")
    tm = x.groupby("ym")[[f"{s_}_revenue_gbp" for s_ in STREAMS] + ["total_revenue_gbp"]].sum()
    mix = {}
    for s_ in STREAMS:
        share = tm[f"{s_}_revenue_gbp"] / tm["total_revenue_gbp"]
        fit = stats.linregress(np.arange(len(share)), share)
        mix[s_] = {
            "share": rnd(x[f"{s_}_revenue_gbp"].sum() / x["total_revenue_gbp"].sum(), 4),
            "slope_pp_per_year": rnd(fit.slope * 12 * 100, 3),
            "p": rnd(fit.pvalue, 4),
        }
    out["mix"] = mix
    out["mix_by_format"] = {
        f: {
            s_: rnd(g[f"{s_}_revenue_gbp"].sum() / g["total_revenue_gbp"].sum(), 4)
            for s_ in STREAMS
        }
        for f, g in x.groupby("store_format")
    }
    out["product"] = {
        "category_margin": pr.groupby("product_category")["gross_margin_pct"]
        .mean()
        .round(4)
        .to_dict(),
        "r_row_gross_margin_vs_top_product_margin": rnd(
            stats.pearsonr(
                ds["daily_gross_profit_gbp"] / ds["total_revenue_gbp"],
                ds.merge(pr, on="product_id")["gross_margin_pct"],
            ).statistic,
            4,
        ),
    }
    est = m.groupby("month_id")["net_profit_gbp"].sum()
    moy = m.assign(moy=m["month_id"].str[-2:])
    out["season"] = {
        "month_of_year_revenue_kw_p": rnd(kw_p(moy, "total_monthly_revenue_gbp", "moy"), 4),
        "month_of_year_profit_kw_p": rnd(kw_p(moy, "net_profit_gbp", "moy"), 4),
        "best_month": est.idxmax(),
        "worst_month": est.idxmin(),
        "best_month_profit": rnd(est.max(), 2),
        "worst_month_profit": rnd(est.min(), 2),
        "yoy_month_pattern_r": rnd(
            stats.pearsonr(est.iloc[:12].to_numpy(), est.iloc[12:].to_numpy()).statistic, 4
        ),
        "yoy_month_pattern_p": rnd(
            stats.pearsonr(est.iloc[:12].to_numpy(), est.iloc[12:].to_numpy()).pvalue, 4
        ),
        "quarter_revenue": m.assign(q=pd.to_datetime(m["month_id"]).dt.quarter)
        .groupby("q")["total_monthly_revenue_gbp"]
        .sum()
        .round(2)
        .to_dict(),
    }

    # ------------------------------------------------------------------ status as a store trait
    out["loss"] = {
        "loss_months": int((m["net_profit_gbp"] < 0).sum()),
        "stores_with_a_loss_month": int((s["loss_months"] > 0).sum()),
        "stores_negative_over_24m": int((s["total_profit"] < 0).sum()),
        "negative_store_ids": s.index[s["total_profit"] < 0].tolist(),
        "max_loss_months_one_store": int(s["loss_months"].max()),
    }
    # ------------------------------------------------------------------ brief question answers
    m["derived_status"] = derived_status
    loss_like = m["derived_status"].isin(["Loss-Making", "Structural-Loss"])
    reg_loss = m.assign(loss=loss_like).groupby("region")["loss"].agg(["sum", "mean", "size"])
    chg = s.join(by_year[("net_profit_gbp", "2024")].rename("np24")).join(
        by_year[("net_profit_gbp", "2023")].rename("np23")
    )
    chg["delta"] = (chg["np24"] - chg["np23"]) * 12
    # Under "no store change", a store's annual delta is the difference of two 12-month sums of
    # independent monthly draws. Its noise SD is the within-store monthly SD × sqrt(24).
    within_sd = m.groupby("store_id")["net_profit_gbp"].std().mean()
    wf = x.groupby(["store_format", "is_weekend"])["total_revenue_gbp"].mean()
    out["brief"] = {
        "q1_margin_by_format_row_mean": m.groupby("store_format")["net_profit_margin_pct"]
        .mean()
        .round(4)
        .to_dict(),
        "q1_margin_by_format_pooled": (
            m.groupby("store_format")["net_profit_gbp"].sum()
            / m.groupby("store_format")["total_monthly_revenue_gbp"].sum()
        )
        .round(4)
        .to_dict(),
        "q2_loss_share_by_region": reg_loss["mean"].round(4).sort_values(ascending=False).to_dict(),
        "q2_loss_months_by_region": reg_loss["sum"].astype(int).to_dict(),
        "q2_region_loss_chi2_p": rnd(
            stats.chi2_contingency(pd.crosstab(m["region"], loss_like)).pvalue, 6
        ),
        "q3_r_rent_revenue_store": rnd(stats.pearsonr(s["rent"], s["revenue"]).statistic, 4),
        "q3_r_rent_margin_store": rnd(stats.pearsonr(s["rent"], s["margin"]).statistic, 4),
        "q4_top_improvers": chg["delta"].nlargest(3).round(2).to_dict(),
        "q4_top_decliners": chg["delta"].nsmallest(3).round(2).to_dict(),
        "q4_noise_sd_annual_delta": rnd(within_sd * math.sqrt(24), 2),
        "q4_observed_sd_annual_delta": rnd(chg["delta"].std(), 2),
        "q4_stores_beyond_2sd_noise": int(
            (chg["delta"].abs() > 2 * within_sd * math.sqrt(24)).sum()
        ),
        "q12_weekend_gap_by_format": {
            f: rnd(wf.loc[(f, True)] / wf.loc[(f, False)] - 1, 4)
            for f in ("High-Street", "Transport-Hub")
        },
        "store_status_revenue_kw_p": rnd(kw_p(m, "total_monthly_revenue_gbp", "store_status"), 4),
        "store_status_margin_kw_p": rnd(kw_p(m, "net_profit_margin_pct", "store_status"), 4),
        "ni_revenue_rank_of_12": int(reg["revenue"].rank(ascending=False).loc["Northern-Ireland"]),
        "fixed_cost_median_store": rnd(s["fixed"].median(), 2),
        "margin_below_median_fixed": rnd(
            s[s["fixed"] <= s["fixed"].median()]["net_profit"].sum()
            / s[s["fixed"] <= s["fixed"].median()]["revenue"].sum(),
            4,
        ),
        "margin_above_median_fixed": rnd(
            s[s["fixed"] > s["fixed"].median()]["net_profit"].sum()
            / s[s["fixed"] > s["fixed"].median()]["revenue"].sum(),
            4,
        ),
        "revenue_below_median_fixed": rnd(
            s[s["fixed"] <= s["fixed"].median()]["revenue"].mean(), 2
        ),
        "revenue_above_median_fixed": rnd(s[s["fixed"] > s["fixed"].median()]["revenue"].mean(), 2),
        "derived_status_counts": m["derived_status"].value_counts().to_dict(),
        "supplied_status_counts": m["profitability_status"].value_counts().to_dict(),
    }
    return out


def main() -> int:
    res = analyze(find_data_dir())
    OUT.write_text(json.dumps(res, indent=2, default=str) + "\n", encoding="utf-8")
    cs = res["contract_summary"]
    print(
        f"Wrote {OUT.relative_to(MONTH_DIR.parents[1])}  - contract {cs['holds']}/{cs['tested']} hold, {cs['fails']} fail"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
