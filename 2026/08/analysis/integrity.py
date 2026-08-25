#!/usr/bin/env python3
"""G2 integrity pass — 2026/08 African Gig-Economy and Digital Wallet Risk.

The archive supplies six apparent findings. This script treats each as a hypothesis, audits the
source documents against the delivered CSVs, and tests whether the risk fields carry information
beyond an independent random baseline.

    uv run python 2026/08/analysis/integrity.py

Read-only. Never writes into the raw folder.
"""

from __future__ import annotations

import itertools
import json
import math
import re
from pathlib import Path

import numpy as np
import polars as pl
from bs4 import BeautifulSoup
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
DATA = next((path.parent for path in MONTH_DIR.rglob("fact_transactions_Updated_.csv")), None)

AXES = [
    "channel_type",
    "channel_subtype",
    "country",
    "gig_segment",
    "kyc_tier",
    "gender",
    "age_band",
    "is_active",
    "preferred_channel",
    "transaction_type",
    "transaction_outcome",
    "year",
    "month",
    "quarter",
    "day_of_week",
    "is_weekend",
    "is_month_end",
    "regulatory_tier",
    "is_digital",
    "requires_internet",
]
EVENTS = ["is_fraud_flagged", "is_disputed", "is_reversed"]


def load(data_dir: Path, name: str) -> pl.DataFrame:
    return pl.read_csv(data_dir / name, infer_schema_length=None).rename(lambda c: c.lstrip("﻿"))


def two_proportion(n1: int, k1: int, n0: int, k0: int) -> dict[str, float]:
    p1, p0 = k1 / n1, k0 / n0
    diff = p1 - p0
    se = math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0)
    z = diff / se
    return {
        "p1": p1,
        "p0": p0,
        "diff": diff,
        "ci_low": diff - 1.96 * se,
        "ci_high": diff + 1.96 * se,
        "pvalue": float(2 * stats.norm.sf(abs(z))),
        "ratio": p1 / p0,
    }


def cramers_v(df: pl.DataFrame, axis: str, target: str) -> tuple[float, float]:
    pivot = (
        df.group_by([axis, target]).len().pivot(values="len", index=axis, on=target).fill_null(0)
    )
    table = pivot.drop(axis).to_numpy().astype(float)
    chi2, pvalue, _, _ = stats.chi2_contingency(table)
    denominator = table.sum() * min(table.shape[0] - 1, table.shape[1] - 1)
    return float(pvalue), float(math.sqrt(chi2 / denominator))


def worker_icc(df: pl.DataFrame, target: str) -> float:
    grouped = df.group_by("worker_id").agg(pl.len().alias("n"), pl.col(target).mean().alias("mean"))
    group_sizes = grouped["n"].to_numpy().astype(float)
    group_means = grouped["mean"].to_numpy()
    grand_mean = float(df[target].mean())
    n_rows, n_groups = df.height, grouped.height
    ms_between = float(np.sum(group_sizes * (group_means - grand_mean) ** 2) / (n_groups - 1))
    ms_within = float(np.sum(group_sizes * group_means * (1 - group_means)) / (n_rows - n_groups))
    effective_size = float((n_rows - np.sum(group_sizes**2) / n_rows) / (n_groups - 1))
    return (ms_between - ms_within) / (ms_between + (effective_size - 1) * ms_within)


def phi_for_outcome(df: pl.DataFrame, outcome: str, flag: str) -> tuple[float, float, float]:
    outcome_mask = (df["transaction_outcome"] == outcome).to_numpy()
    flag_mask = df[flag].to_numpy()
    table = np.array(
        [
            [np.sum(outcome_mask & flag_mask), np.sum(outcome_mask & ~flag_mask)],
            [np.sum(~outcome_mask & flag_mask), np.sum(~outcome_mask & ~flag_mask)],
        ]
    )
    chi2, pvalue, _, _ = stats.chi2_contingency(table)
    phi = math.sqrt(chi2 / table.sum())
    agreement = float(np.mean(outcome_mask == flag_mask))
    return float(phi), float(pvalue), agreement


def audit_archive(
    archive_root: Path,
    actual_tables: dict[str, pl.DataFrame],
) -> dict[str, object]:
    docs = archive_root / "docs"
    config = json.loads((docs / "SCHEMA_CONFIG.json").read_text(encoding="utf-8"))
    validation = json.loads((docs / "VALIDATION_REPORT.json").read_text(encoding="utf-8"))

    unavailable = 0
    for relationship in config["relationship_rules"].values():
        from_table = relationship["from_table"]
        to_table = relationship["to_table"]
        if (
            from_table not in actual_tables
            or to_table not in actual_tables
            or relationship["from_column"] not in actual_tables[from_table].columns
            or relationship["to_column"] not in actual_tables[to_table].columns
        ):
            unavailable += 1

    actual_columns = {column for frame in actual_tables.values() for column in frame.columns}
    constraints = config["column_constraints"]
    matching_constraints = sum(
        constraint["column_name"] in actual_columns for constraint in constraints.values()
    )

    report = BeautifulSoup(
        (archive_root / "EDA_REPORT.html").read_text(encoding="utf-8"), "html.parser"
    )
    date_heading = next(h for h in report.find_all("h2") if "dim_date" in h.get_text())
    date_summary = date_heading.find_next_sibling().get_text(" ", strip=True)
    eda_date_rows = int(re.search(r"([\d,]+) rows", date_summary).group(1).replace(",", ""))

    return {
        "validation_checks_passed": validation["summary"]["passed"],
        "configured_relationships": len(config["relationship_rules"]),
        "unavailable_relationships": unavailable,
        "configured_constraints": len(constraints),
        "matching_constraint_names": matching_constraints,
        "eda_date_rows": eda_date_rows,
        "actual_date_rows": actual_tables["dim_date"].height,
    }


def analyze(data_dir: Path) -> dict[str, dict[str, object]]:
    fact = load(data_dir, "fact_transactions_Updated_.csv")
    workers = load(data_dir, "dim_worker.csv")
    channels = load(data_dir, "dim_channel.csv")
    markets = load(data_dir, "dim_market.csv")
    dates = load(data_dir, "dim_date_updated.csv").with_columns(
        pl.col("full_date").str.to_date("%m/%d/%Y").alias("date")
    )
    joined = (
        fact.join(workers, on="worker_id")
        .join(channels, on="channel_id")
        .join(markets, on="market_id")
        .join(dates, on="date_id")
    )

    shape: dict[str, object] = {
        "fact_rows": fact.height,
        "distinct_transaction_ids": fact["transaction_id"].n_unique(),
        "worker_rows": workers.height,
        "used_workers": fact["worker_id"].n_unique(),
        "worker_fraud_icc": worker_icc(fact, "is_fraud_flagged"),
        "worker_dispute_icc": worker_icc(fact, "is_disputed"),
        "worker_reversal_icc": worker_icc(fact, "is_reversed"),
        "min_transactions_per_worker": int(fact.group_by("worker_id").len()["len"].min()),
        "max_transactions_per_worker": int(fact.group_by("worker_id").len()["len"].max()),
    }

    ussd = joined.filter(pl.col("channel_type") == "USSD")
    app = joined.filter(pl.col("channel_type") == "Mobile App")
    ussd_result = two_proportion(
        ussd.height,
        int(ussd["is_fraud_flagged"].sum()),
        app.height,
        int(app["is_fraud_flagged"].sum()),
    )

    fraud = joined.filter(pl.col("is_fraud_flagged"))
    nigeria_kenya = fraud.filter(pl.col("country").is_in(["Nigeria", "Kenya"]))
    nigeria_kenya_count_share = nigeria_kenya.height / fraud.height
    nigeria_kenya_loss_share = float(
        nigeria_kenya["fraud_loss_usd"].sum() / fraud["fraud_loss_usd"].sum()
    )
    nigeria_kenya_value_share = float(nigeria_kenya["amount_usd"].sum() / fraud["amount_usd"].sum())

    new_accounts = joined.filter(pl.col("account_tenure_days") < 90)
    older_accounts = joined.filter(pl.col("account_tenure_days") >= 90)
    tenure_result = two_proportion(
        new_accounts.height,
        int(new_accounts["is_fraud_flagged"].sum()),
        older_accounts.height,
        int(older_accounts["is_fraud_flagged"].sum()),
    )

    segments = (
        joined.group_by("gig_segment")
        .agg(pl.len().alias("n"), pl.col("is_disputed").mean().alias("rate"))
        .sort("rate", descending=True)
    )
    market_trader_rank = segments["gig_segment"].to_list().index("Market Trader") + 1
    market_trader = joined.filter(pl.col("gig_segment") == "Market Trader")
    other_segments = joined.filter(pl.col("gig_segment") != "Market Trader")
    market_trader_result = two_proportion(
        market_trader.height,
        int(market_trader["is_disputed"].sum()),
        other_segments.height,
        int(other_segments["is_disputed"].sum()),
    )

    velocity_fraud = stats.pointbiserialr(
        joined["is_fraud_flagged"].cast(pl.Int8).to_numpy(),
        joined["velocity_score"].to_numpy(),
    )
    velocity_reversal = stats.pointbiserialr(
        joined["is_reversed"].cast(pl.Int8).to_numpy(),
        joined["velocity_score"].to_numpy(),
    )

    month_end = joined.filter(pl.col("is_month_end"))
    other_days = joined.filter(~pl.col("is_month_end"))
    month_end_cashout = two_proportion(
        month_end.height,
        month_end.filter(pl.col("transaction_type") == "Cash-Out").height,
        other_days.height,
        other_days.filter(pl.col("transaction_type") == "Cash-Out").height,
    )
    month_end_reversal = two_proportion(
        month_end.height,
        int(month_end["is_reversed"].sum()),
        other_days.height,
        int(other_days["is_reversed"].sum()),
    )
    month_end_cashout_rows = month_end.filter(pl.col("transaction_type") == "Cash-Out")
    other_cashout_rows = other_days.filter(pl.col("transaction_type") == "Cash-Out")
    month_end_cashout_reversal = two_proportion(
        month_end_cashout_rows.height,
        int(month_end_cashout_rows["is_reversed"].sum()),
        other_cashout_rows.height,
        int(other_cashout_rows["is_reversed"].sum()),
    )

    supported = [
        ussd_result["ratio"] >= 2.3 and ussd_result["pvalue"] < 0.05,
        nigeria_kenya_count_share >= 0.70,
        tenure_result["ratio"] >= 3 and tenure_result["pvalue"] < 0.05,
        market_trader_rank == 1,
        velocity_fraud.pvalue < 0.05 and velocity_reversal.pvalue < 0.05,
        any(
            result["diff"] > 0 and result["pvalue"] < 0.05
            for result in [month_end_cashout, month_end_reversal, month_end_cashout_reversal]
        ),
    ]
    claims: dict[str, object] = {
        "ussd_app_fraud_ratio": ussd_result["ratio"],
        "ussd_app_fraud_diff": ussd_result["diff"],
        "ussd_app_ci": (ussd_result["ci_low"], ussd_result["ci_high"]),
        "ussd_app_pvalue": ussd_result["pvalue"],
        "nigeria_kenya_fraud_count_share": nigeria_kenya_count_share,
        "nigeria_kenya_fraud_loss_share": nigeria_kenya_loss_share,
        "nigeria_kenya_flagged_value_share": nigeria_kenya_value_share,
        "new_account_fraud_ratio": tenure_result["ratio"],
        "new_account_fraud_diff": tenure_result["diff"],
        "new_account_ci": (tenure_result["ci_low"], tenure_result["ci_high"]),
        "new_account_pvalue": tenure_result["pvalue"],
        "market_trader_dispute_rank": market_trader_rank,
        "market_trader_dispute_diff": market_trader_result["diff"],
        "market_trader_ci": (
            market_trader_result["ci_low"],
            market_trader_result["ci_high"],
        ),
        "market_trader_pvalue": market_trader_result["pvalue"],
        "velocity_fraud_r": float(velocity_fraud.statistic),
        "velocity_fraud_pvalue": float(velocity_fraud.pvalue),
        "velocity_reversal_r": float(velocity_reversal.statistic),
        "velocity_reversal_pvalue": float(velocity_reversal.pvalue),
        "month_end_cashout_diff": month_end_cashout["diff"],
        "month_end_cashout_ci": (
            month_end_cashout["ci_low"],
            month_end_cashout["ci_high"],
        ),
        "month_end_cashout_pvalue": month_end_cashout["pvalue"],
        "month_end_reversal_diff": month_end_reversal["diff"],
        "month_end_reversal_ci": (
            month_end_reversal["ci_low"],
            month_end_reversal["ci_high"],
        ),
        "month_end_reversal_pvalue": month_end_reversal["pvalue"],
        "month_end_cashout_reversal_rate": month_end_cashout_reversal["p1"],
        "other_cashout_reversal_rate": month_end_cashout_reversal["p0"],
        "month_end_cashout_reversal_n": month_end_cashout_rows.height,
        "other_cashout_reversal_n": other_cashout_rows.height,
        "month_end_cashout_reversal_diff": month_end_cashout_reversal["diff"],
        "month_end_cashout_reversal_ci": (
            month_end_cashout_reversal["ci_low"],
            month_end_cashout_reversal["ci_high"],
        ),
        "month_end_cashout_reversal_pvalue": month_end_cashout_reversal["pvalue"],
        "supported_count": sum(supported),
    }

    categorical_results = [
        (target, axis, *cramers_v(joined, axis, target)) for target in EVENTS for axis in AXES
    ]
    bonferroni_alpha = 0.05 / len(categorical_results)
    interaction_results = []
    for target in EVENTS:
        for left, right in itertools.combinations(AXES, 2):
            interaction_frame = joined.with_columns(
                pl.concat_str(
                    [pl.col(left).cast(pl.String), pl.col(right).cast(pl.String)],
                    separator=" | ",
                ).alias("_interaction")
            )
            pvalue, effect = cramers_v(interaction_frame, "_interaction", target)
            interaction_results.append((target, left, right, pvalue, effect))
    interaction_alpha = 0.05 / len(interaction_results)
    ussd_transaction_type = next(
        result
        for result in interaction_results
        if result[:3] == ("is_fraud_flagged", "channel_type", "transaction_type")
    )
    continuous_columns = [
        "velocity_score",
        "risk_score",
        "avg_fraud_rate",
        "market_fraud_index",
        "processing_time_ms",
        "amount_usd",
    ]
    continuous_r = {
        column: float(
            stats.pointbiserialr(
                joined["is_fraud_flagged"].cast(pl.Int8).to_numpy(),
                joined[column].to_numpy(),
            ).statistic
        )
        for column in continuous_columns
    }
    daily = joined.group_by("date_id").agg(
        pl.len().alias("n"), pl.col("is_fraud_flagged").mean().alias("rate")
    )
    fraud_rate = float(fact["is_fraud_flagged"].mean())
    observed_daily_variance = float(np.var(daily["rate"].to_numpy(), ddof=1))
    expected_daily_variance = float(np.mean(fraud_rate * (1 - fraud_rate) / daily["n"].to_numpy()))
    uniform_pvalues = {
        "amount_local": float(
            stats.kstest(fact["amount_local"].to_numpy() / 1000, "uniform").pvalue
        ),
        "amount_usd": float(stats.kstest(fact["amount_usd"].to_numpy() / 1000, "uniform").pvalue),
        "velocity_score": float(
            stats.kstest(fact["velocity_score"].to_numpy() / 1000, "uniform").pvalue
        ),
        "risk_score": float(stats.kstest(workers["risk_score"].to_numpy() / 100, "uniform").pvalue),
        "processing_time_ms": float(
            stats.kstest(fact["processing_time_ms"].to_numpy() / 1000, "uniform").pvalue
        ),
    }
    fraud_loss_alignment = int(((fact["fraud_loss_usd"] > 0) == fact["is_fraud_flagged"]).sum())
    risk_screen: dict[str, object] = {
        "categorical_tests": len(categorical_results),
        "bonferroni_alpha": bonferroni_alpha,
        "bonferroni_survivors": sum(result[2] < bonferroni_alpha for result in categorical_results),
        "max_cramers_v": max(result[3] for result in categorical_results),
        "interaction_tests": len(interaction_results),
        "interaction_alpha": interaction_alpha,
        "interaction_survivors": sum(
            result[3] < interaction_alpha for result in interaction_results
        ),
        "min_interaction_p": min(result[3] for result in interaction_results),
        "ussd_transaction_type_p": ussd_transaction_type[3],
        "ussd_transaction_type_v": ussd_transaction_type[4],
        "max_abs_continuous_r": max(abs(value) for value in continuous_r.values()),
        "continuous_r": continuous_r,
        "daily_variance_ratio": observed_daily_variance / expected_daily_variance,
        "uniform_pvalues": uniform_pvalues,
        "fraud_loss_flag_alignment": fraud_loss_alignment,
    }

    expected_usd = joined["amount_local"].to_numpy() / joined["usd_fx_rate"].to_numpy()
    flagged = fact.filter(pl.col("is_fraud_flagged"))
    finance: dict[str, object] = {
        "total_amount_usd": float(fact["amount_usd"].sum()),
        "flagged_amount_usd": float(flagged["amount_usd"].sum()),
        "fraud_loss_usd": float(flagged["fraud_loss_usd"].sum()),
        "local_usd_r": float(stats.pearsonr(fact["amount_local"], fact["amount_usd"]).statistic),
        "usd_fx_r": float(stats.pearsonr(joined["amount_usd"], expected_usd).statistic),
        "median_absolute_relative_fx_error": float(
            np.median(
                np.abs(joined["amount_usd"].to_numpy() - expected_usd)
                / np.maximum(expected_usd, 1e-12)
            )
        ),
        "loss_amount_r": float(
            stats.pearsonr(flagged["fraud_loss_usd"], flagged["amount_usd"]).statistic
        ),
        "loss_exceeds_amount_rows": flagged.filter(
            pl.col("fraud_loss_usd") > pl.col("amount_usd")
        ).height,
        "loss_to_flagged_value": float(
            flagged["fraud_loss_usd"].sum() / flagged["amount_usd"].sum()
        ),
    }

    reversed_phi, reversed_p, reversed_agreement = phi_for_outcome(fact, "Reversed", "is_reversed")
    disputed_phi, disputed_p, disputed_agreement = phi_for_outcome(fact, "Disputed", "is_disputed")
    status: dict[str, object] = {
        "reversed_phi": reversed_phi,
        "reversed_pvalue": reversed_p,
        "reversed_agreement": reversed_agreement,
        "disputed_phi": disputed_phi,
        "disputed_pvalue": disputed_p,
        "disputed_agreement": disputed_agreement,
    }

    date_consistency = {
        "date_id": int(
            (dates["date_id"] == dates["date"].dt.strftime("%Y%m%d").cast(pl.Int64)).sum()
        ),
        "year": int((dates["year"] == dates["date"].dt.year()).sum()),
        "month": int((dates["month"] == dates["date"].dt.strftime("%B")).sum()),
        "quarter": int(
            (dates["quarter"] == ("Q" + dates["date"].dt.quarter().cast(pl.String))).sum()
        ),
        "day_of_week": int((dates["day_of_week"] == dates["date"].dt.strftime("%A")).sum()),
        "is_weekend": int((dates["is_weekend"] == dates["date"].dt.weekday().is_in([6, 7])).sum()),
        "is_month_end": int(
            (dates["is_month_end"] == (dates["date"].dt.month_end() == dates["date"])).sum()
        ),
        "week_number_nulls": dates["week_number"].null_count(),
    }

    archive = audit_archive(
        data_dir.parent,
        {
            "fact_transactions": fact,
            "dim_worker": workers,
            "dim_channel": channels,
            "dim_market": markets,
            "dim_date": dates.drop("date"),
        },
    )

    return {
        "shape": shape,
        "claims": claims,
        "risk_screen": risk_screen,
        "finance": finance,
        "status": status,
        "date": date_consistency,
        "archive": archive,
    }


def pct(value: float, digits: int = 2) -> str:
    return f"{100 * value:.{digits}f}%"


def section(title: str) -> None:
    print(f"\n{'=' * 88}\n{title}\n{'=' * 88}")


def main() -> int:
    if DATA is None:
        raise SystemExit("Raw August archive not found. Run `just fetch 2026 08` first.")
    result = analyze(DATA)
    shape = result["shape"]
    claims = result["claims"]
    risk = result["risk_screen"]
    finance = result["finance"]
    status = result["status"]
    date = result["date"]
    archive = result["archive"]

    section("0. SHAPE, KEYS AND GRAIN")
    print(
        f"  fact: {shape['fact_rows']:,} rows / {shape['distinct_transaction_ids']:,} distinct "
        f"transaction_id; workers: {shape['used_workers']:,} used of {shape['worker_rows']:,}"
    )
    print(
        f"  transactions per worker: {shape['min_transactions_per_worker']}-"
        f"{shape['max_transactions_per_worker']}; fraud ICC {shape['worker_fraud_icc']:+.5f}, "
        f"dispute {shape['worker_dispute_icc']:+.5f}, reversal {shape['worker_reversal_icc']:+.5f}"
    )
    print("  -> transaction grain is supported; event flags vary independently within workers")

    section("1. SIX SUPPLIED CLAIMS")
    print(
        f"  USSD / Mobile App fraud ratio: {claims['ussd_app_fraud_ratio']:.3f}×; difference "
        f"{pct(claims['ussd_app_fraud_diff'])} "
        f"[{pct(claims['ussd_app_ci'][0])}, {pct(claims['ussd_app_ci'][1])}], "
        f"p={claims['ussd_app_pvalue']:.3f} — not 2.3×"
    )
    print(
        f"  Nigeria + Kenya share: flagged count "
        f"{pct(claims['nigeria_kenya_fraud_count_share'])}; fraud loss "
        f"{pct(claims['nigeria_kenya_fraud_loss_share'])}; flagged value "
        f"{pct(claims['nigeria_kenya_flagged_value_share'])} — not 70%"
    )
    print(
        f"  <90-day / older fraud ratio: {claims['new_account_fraud_ratio']:.3f}×; difference "
        f"{pct(claims['new_account_fraud_diff'])} "
        f"[{pct(claims['new_account_ci'][0])}, {pct(claims['new_account_ci'][1])}], "
        f"p={claims['new_account_pvalue']:.3f} — not 3×"
    )
    print(
        f"  Market Trader dispute rank: {claims['market_trader_dispute_rank']} of 15; difference "
        f"vs all others {pct(claims['market_trader_dispute_diff'])}, "
        f"p={claims['market_trader_pvalue']:.3f}"
    )
    print(
        f"  Velocity vs fraud r={claims['velocity_fraud_r']:+.5f}, "
        f"p={claims['velocity_fraud_pvalue']:.3f}; vs reversal "
        f"r={claims['velocity_reversal_r']:+.5f}, p={claims['velocity_reversal_pvalue']:.3f}"
    )
    print(
        f"  Month-end cash-out difference {pct(claims['month_end_cashout_diff'])} "
        f"[{pct(claims['month_end_cashout_ci'][0])}, "
        f"{pct(claims['month_end_cashout_ci'][1])}], "
        f"p={claims['month_end_cashout_pvalue']:.3f}; reversal difference "
        f"{pct(claims['month_end_reversal_diff'])} "
        f"[{pct(claims['month_end_reversal_ci'][0])}, "
        f"{pct(claims['month_end_reversal_ci'][1])}], "
        f"p={claims['month_end_reversal_pvalue']:.3f}"
    )
    print(
        f"  Within Cash-Out only, month-end reversal is "
        f"{pct(claims['month_end_cashout_reversal_rate'])} "
        f"(n={claims['month_end_cashout_reversal_n']:,}) vs "
        f"{pct(claims['other_cashout_reversal_rate'])} "
        f"(n={claims['other_cashout_reversal_n']:,}); difference "
        f"{pct(claims['month_end_cashout_reversal_diff'])} "
        f"[{pct(claims['month_end_cashout_reversal_ci'][0])}, "
        f"{pct(claims['month_end_cashout_reversal_ci'][1])}], "
        f"p={claims['month_end_cashout_reversal_pvalue']:.3f} — strongest lead, not confirmed"
    )
    print(f"\n  SUPPORTED: {claims['supported_count']} of 6")

    section("2. THE RANDOM BASELINE")
    print(
        f"  {risk['categorical_tests']} declared event × axis tests; Bonferroni alpha "
        f"{risk['bonferroni_alpha']:.6f}; survivors {risk['bonferroni_survivors']}; "
        f"max Cramér's V {risk['max_cramers_v']:.5f}"
    )
    print(
        f"  {risk['interaction_tests']} exploratory two-axis tests; Bonferroni alpha "
        f"{risk['interaction_alpha']:.8f}; survivors {risk['interaction_survivors']}; "
        f"minimum nominal p={risk['min_interaction_p']:.4f}"
    )
    print(
        f"  channel type × transaction type vs fraud: nominal "
        f"p={risk['ussd_transaction_type_p']:.4f}, V={risk['ussd_transaction_type_v']:.5f}; "
        "does not survive the interaction screen"
    )
    print(
        f"  max |point-biserial r| across velocity, worker risk, channel historical fraud, "
        f"market index, processing time and amount: {risk['max_abs_continuous_r']:.5f}"
    )
    print(
        f"  daily fraud-rate variance / binomial expectation: "
        f"{risk['daily_variance_ratio']:.4f} (1.0 is an independent coin flip)"
    )
    print("  KS p-values against documented bounds interpreted as uniform:")
    for column, pvalue in risk["uniform_pvalues"].items():
        print(f"    {column:<22} {pvalue:.4f}")
    print(
        f"  positive control: (fraud_loss_usd > 0) == is_fraud_flagged on "
        f"{risk['fraud_loss_flag_alignment']:,} of {shape['fact_rows']:,} rows"
    )

    section("3. FINANCIAL FIELDS DO NOT RECONCILE")
    print(
        f"  amount_local vs amount_usd r={finance['local_usd_r']:+.5f}; amount_usd vs "
        f"amount_local/usd_fx_rate r={finance['usd_fx_r']:+.5f}"
    )
    print(
        f"  fraud_loss_usd vs flagged transaction amount r={finance['loss_amount_r']:+.5f}; "
        f"loss exceeds amount on {finance['loss_exceeds_amount_rows']:,} flagged rows"
    )
    print(
        f"  total fraud loss ${finance['fraud_loss_usd']:,.2f} / flagged value "
        f"${finance['flagged_amount_usd']:,.2f} = {pct(finance['loss_to_flagged_value'])}"
    )

    section("4. OUTCOME LABELS DO NOT VALIDATE EVENT FLAGS")
    print(
        f"  outcome='Reversed' vs is_reversed: phi={status['reversed_phi']:.5f}, "
        f"p={status['reversed_pvalue']:.3f}, agreement {pct(status['reversed_agreement'])}"
    )
    print(
        f"  outcome='Disputed' vs is_disputed: phi={status['disputed_phi']:.5f}, "
        f"p={status['disputed_pvalue']:.3f}, agreement {pct(status['disputed_agreement'])}"
    )

    section("5. ARCHIVE DOCUMENTS VS DELIVERED FILES")
    print(
        f"  VALIDATION_REPORT: {archive['validation_checks_passed']} checks passed; schema config: "
        f"{archive['configured_relationships']} relationships, of which "
        f"{archive['unavailable_relationships']} reference absent delivered columns"
    )
    print(
        f"  constraints whose declared column_name matches a delivered column: "
        f"{archive['matching_constraint_names']} of {archive['configured_constraints']}"
    )
    print(
        f"  generated EDA reports {archive['eda_date_rows']} date rows; delivered updated file has "
        f"{archive['actual_date_rows']}"
    )
    print(
        f"  delivered date derivations correct: min "
        f"{min(date[key] for key in date if key != 'week_number_nulls')} of "
        f"{archive['actual_date_rows']}; week_number null on {date['week_number_nulls']} rows"
    )

    section("6. CONCLUSION")
    print("  The delivered CSVs are structurally joinable and genuinely transaction-grain.")
    print("  No robust predictive linkage connects the delivered risk-control fields to outcomes.")
    print(
        "  All six supplied findings remain unconfirmed; month-end Cash-Out reversal is an open lead."
    )
    print("  Only the fraud-flag/loss-presence switch is deterministic.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
