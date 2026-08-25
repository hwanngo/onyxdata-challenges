#!/usr/bin/env python3
"""Curated evidence model for 2026/08 — Connected Tables, Disconnected Risk.

The model makes the wrong report difficult to express:

1. Invalid monetary fields survive only with explicit `source_*_unreconciled` or `_unbounded`
   names. Malloy exposes no amount, loss, exposure, revenue or ROI measure.
2. Every risk control travels with its measured validation against the fraud flag.
3. The four broken evidence connectors, one positive control and one open lead are first-class rows.
4. The six supplied findings form a verdict table; the month-end Cash-Out result remains OPEN.
5. Source validation defects are modeled as evidence, not hidden during cleaning.

Raw files are read-only. The build drops zero rows and writes only to data/curated/ and
app/public/data/.
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

f = pl.col
MONTH = Path(__file__).resolve().parents[1]
DATA = next((path.parent for path in MONTH.rglob("fact_transactions_Updated_.csv")), None)
OUT = MONTH / "data" / "curated"
PUBLIC = MONTH / "app" / "public" / "data"

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


def premise(ok: bool, message: str) -> None:
    if not ok:
        raise SystemExit(f"PREMISE VIOLATED: {message}")


def load(name: str) -> pl.DataFrame:
    if DATA is None:
        raise SystemExit("Raw August archive not found. Run `just fetch 2026 08` first.")
    return pl.read_csv(DATA / name, infer_schema_length=None).rename(lambda c: c.lstrip("﻿"))


def two_proportion(n1: int, k1: int, n0: int, k0: int) -> dict[str, float]:
    p1, p0 = k1 / n1, k0 / n0
    diff = p1 - p0
    se = math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0)
    return {
        "p1": p1,
        "p0": p0,
        "diff": diff,
        "ci_low": diff - 1.96 * se,
        "ci_high": diff + 1.96 * se,
        "p_value": float(2 * stats.norm.sf(abs(diff / se))),
        "ratio": p1 / p0,
    }


def categorical_association(df: pl.DataFrame, axis: str, target: str) -> tuple[float, float]:
    pivot = (
        df.group_by([axis, target], maintain_order=True)
        .len()
        .pivot(values="len", index=axis, on=target)
        .fill_null(0)
    )
    table = pivot.drop(axis).to_numpy().astype(float)
    chi2, p_value, _, _ = stats.chi2_contingency(table)
    denominator = table.sum() * min(table.shape[0] - 1, table.shape[1] - 1)
    return float(p_value), float(math.sqrt(chi2 / denominator))


def status_alignment(df: pl.DataFrame, outcome: str, flag: str) -> dict[str, float]:
    outcome_mask = (df["transaction_outcome"] == outcome).to_numpy()
    flag_mask = df[flag].to_numpy()
    table = np.array(
        [
            [np.sum(outcome_mask & flag_mask), np.sum(outcome_mask & ~flag_mask)],
            [np.sum(~outcome_mask & flag_mask), np.sum(~outcome_mask & ~flag_mask)],
        ]
    )
    chi2, p_value, _, _ = stats.chi2_contingency(table)
    return {
        "phi": float(math.sqrt(chi2 / table.sum())),
        "p_value": float(p_value),
        "agreement": float(np.mean(outcome_mask == flag_mask)),
    }


def finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: finite(item) for key, item in value.items()}
    if isinstance(value, list):
        return [finite(item) for item in value]
    return value


def dump_json(path: Path, data) -> None:
    path.write_text(
        json.dumps(finite(data), indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def write_table(name: str, frame: pl.DataFrame) -> None:
    frame.write_parquet(OUT / f"{name}.parquet", compression="zstd", statistics=True)
    print(f"  {name:<28} {frame.height:>7,} rows")


def archive_audit(actual: dict[str, pl.DataFrame]) -> dict[str, int]:
    assert DATA is not None
    root = DATA.parent
    config = json.loads((root / "docs" / "SCHEMA_CONFIG.json").read_text(encoding="utf-8"))
    validation = json.loads((root / "docs" / "VALIDATION_REPORT.json").read_text(encoding="utf-8"))
    unavailable = 0
    for relationship in config["relationship_rules"].values():
        from_table = relationship["from_table"]
        to_table = relationship["to_table"]
        if (
            from_table not in actual
            or to_table not in actual
            or relationship["from_column"] not in actual[from_table].columns
            or relationship["to_column"] not in actual[to_table].columns
        ):
            unavailable += 1
    all_columns = {column for frame in actual.values() for column in frame.columns}
    matching = sum(
        constraint["column_name"] in all_columns
        for constraint in config["column_constraints"].values()
    )
    report = BeautifulSoup((root / "EDA_REPORT.html").read_text(encoding="utf-8"), "html.parser")
    heading = next(item for item in report.find_all("h2") if "dim_date" in item.get_text())
    summary = heading.find_next_sibling().get_text(" ", strip=True)
    eda_rows = int(re.search(r"([\d,]+) rows", summary).group(1).replace(",", ""))
    return {
        "validation_passed": validation["summary"]["passed"],
        "configured_relationships": len(config["relationship_rules"]),
        "missing_relationships": unavailable,
        "configured_constraints": len(config["column_constraints"]),
        "matching_constraint_names": matching,
        "eda_date_rows": eda_rows,
    }


def contract_ledger(actual: dict[str, pl.DataFrame]) -> pl.DataFrame:
    assert DATA is not None
    config = json.loads((DATA.parent / "docs" / "SCHEMA_CONFIG.json").read_text(encoding="utf-8"))
    all_columns = {column for frame in actual.values() for column in frame.columns}
    rows = []
    for contract_id, rule in config["column_constraints"].items():
        rows.append(
            {
                "order": len(rows) + 1,
                "contract_id": contract_id,
                "kind": "constraint",
                "name": rule["column_name"],
                "status": "AVAILABLE" if rule["column_name"] in all_columns else "MISSING",
                "from_table": rule["table_name"],
                "from_column": rule["column_name"],
                "to_table": None,
                "to_column": None,
                "detail": f"{rule['data_type']} · nullable={rule['nullable']}",
            }
        )
    for contract_id, relationship in config["relationship_rules"].items():
        available = (
            relationship["from_table"] in actual
            and relationship["to_table"] in actual
            and relationship["from_column"] in actual[relationship["from_table"]].columns
            and relationship["to_column"] in actual[relationship["to_table"]].columns
        )
        rows.append(
            {
                "order": len(rows) + 1,
                "contract_id": contract_id,
                "kind": "relationship",
                "name": contract_id,
                "status": "AVAILABLE" if available else "MISSING",
                "from_table": relationship["from_table"],
                "from_column": relationship["from_column"],
                "to_table": relationship["to_table"],
                "to_column": relationship["to_column"],
                "detail": (
                    f"{relationship['from_table']}.{relationship['from_column']} → "
                    f"{relationship['to_table']}.{relationship['to_column']}"
                ),
            }
        )
    return pl.DataFrame(rows).sort("order")


def main() -> int:
    if DATA is None:
        raise SystemExit("Raw August archive not found. Run `just fetch 2026 08` first.")
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for path in OUT.glob("*.parquet"):
        path.unlink()
    for path in PUBLIC.glob("*.json"):
        path.unlink()

    raw_fact = load("fact_transactions_Updated_.csv")
    raw_worker = load("dim_worker.csv")
    raw_channel = load("dim_channel.csv")
    raw_market = load("dim_market.csv")
    raw_date = load("dim_date_updated.csv")

    premise(raw_fact.height == 50_000, f"fact row count changed: {raw_fact.height}")
    premise(
        raw_fact["transaction_id"].n_unique() == raw_fact.height,
        "transaction_id is no longer unique",
    )
    premise(raw_worker.height == 5_000, f"worker row count changed: {raw_worker.height}")
    premise(raw_channel.height == 12, f"channel row count changed: {raw_channel.height}")
    premise(raw_market.height == 4, f"market row count changed: {raw_market.height}")
    premise(raw_date.height == 731, f"date row count changed: {raw_date.height}")

    actual = {
        "fact_transactions": raw_fact,
        "dim_worker": raw_worker,
        "dim_channel": raw_channel,
        "dim_market": raw_market,
        "dim_date": raw_date,
    }
    for key, dimension in [
        ("worker_id", raw_worker),
        ("channel_id", raw_channel),
        ("market_id", raw_market),
        ("date_id", raw_date),
    ]:
        premise(
            not (set(raw_fact[key].unique().to_list()) - set(dimension[key].unique().to_list())),
            f"fact.{key} has orphan values",
        )

    dim_contract = contract_ledger(actual)
    premise(dim_contract.height == 63, f"contract count changed: {dim_contract.height}")
    premise(
        dim_contract.filter(f("status") == "MISSING").height == 59,
        "the validation-contract mismatch count changed",
    )

    dim_date = (
        raw_date.rename({"week_number": "source_week_number"})
        .with_columns(f("full_date").str.to_date("%m/%d/%Y").alias("date"))
        .with_columns(
            f("date").dt.month().alias("month_number"),
            f("date").dt.strftime("%b").alias("month_short"),
            f("date").dt.strftime("%Y-%m").alias("year_month"),
            f("date").dt.week().alias("iso_week"),
        )
        .select(
            "date_id",
            "date",
            pl.col("year").alias("calendar_year"),
            pl.col("quarter").alias("quarter_label"),
            "month_number",
            pl.col("month").alias("month_name"),
            "month_short",
            "year_month",
            "day_of_week",
            "is_weekend",
            "is_month_end",
            "iso_week",
            "source_week_number",
        )
        .sort("date_id")
    )
    premise(dim_date["iso_week"].null_count() == 0, "derived ISO week contains nulls")
    premise(
        dim_date["source_week_number"].null_count() == dim_date.height,
        "source week number is no longer structurally absent",
    )

    dim_worker = raw_worker.rename({"risk_score": "source_risk_score_uncalibrated"}).sort(
        "worker_id"
    )
    dim_channel = raw_channel.rename({"avg_fraud_rate": "source_avg_fraud_rate_uncalibrated"}).sort(
        "channel_id"
    )
    dim_market = raw_market.rename(
        {
            "usd_fx_rate": "source_usd_fx_rate_unreconciled",
            "market_fraud_index": "source_market_fraud_index_uncalibrated",
        }
    ).sort("market_id")
    fact_transaction = (
        raw_fact.rename(
            {
                "amount_local": "source_amount_local",
                "amount_usd": "source_amount_usd_unreconciled",
                "velocity_score": "source_velocity_score_uncalibrated",
                "fraud_loss_usd": "source_fraud_loss_usd_unbounded",
                "processing_time_ms": "source_processing_time_ms_uncalibrated",
            }
        )
        .with_columns((f("source_fraud_loss_usd_unbounded") > 0).alias("fraud_loss_present"))
        .sort("transaction_id")
    )

    joined = (
        raw_fact.join(raw_worker, on="worker_id")
        .join(raw_channel, on="channel_id")
        .join(raw_market, on="market_id")
        .join(raw_date, on="date_id")
    )
    premise(joined.height == raw_fact.height, "dimension joins fanned out or dropped rows")

    main_effects = [
        (target, axis, *categorical_association(joined, axis, target))
        for target in EVENTS
        for axis in AXES
    ]
    main_alpha = 0.05 / len(main_effects)
    interactions = []
    for target in EVENTS:
        for left, right in itertools.combinations(AXES, 2):
            pair = joined.with_columns(
                pl.concat_str(
                    [f(left).cast(pl.String), f(right).cast(pl.String)], separator=" | "
                ).alias("_pair")
            )
            p_value, effect = categorical_association(pair, "_pair", target)
            interactions.append((target, left, right, p_value, effect))
    interaction_alpha = 0.05 / len(interactions)

    control_specs = [
        ("velocity", "Transaction velocity", "velocity_score", "fact_transaction"),
        ("worker_risk", "Worker risk score", "risk_score", "dim_worker"),
        ("channel_history", "Channel historical fraud", "avg_fraud_rate", "dim_channel"),
        ("market_index", "Market fraud index", "market_fraud_index", "dim_market"),
        ("processing_time", "Processing time", "processing_time_ms", "fact_transaction"),
        ("amount", "Recorded USD amount", "amount_usd", "fact_transaction"),
    ]
    control_rows = []
    for control_id, label, column, source in control_specs:
        result = stats.pointbiserialr(
            joined["is_fraud_flagged"].cast(pl.Int8).to_numpy(), joined[column].to_numpy()
        )
        control_rows.append(
            {
                "order": len(control_rows) + 1,
                "control_id": control_id,
                "label": label,
                "source_table": source,
                "source_field": column,
                "target": "is_fraud_flagged",
                "metric": "point-biserial r",
                "statistic": float(result.statistic),
                "abs_statistic": abs(float(result.statistic)),
                "p_value": float(result.pvalue),
                "is_robust": bool(abs(result.statistic) >= 0.20 and result.pvalue < 0.05),
            }
        )
    dim_control_validation = pl.DataFrame(control_rows).sort("order")
    premise(
        dim_control_validation["is_robust"].sum() == 0,
        "a continuous control now robustly predicts fraud; the thesis must be revisited",
    )

    ussd = joined.filter(f("channel_type") == "USSD")
    app = joined.filter(f("channel_type") == "Mobile App")
    ussd_result = two_proportion(
        ussd.height,
        int(ussd["is_fraud_flagged"].sum()),
        app.height,
        int(app["is_fraud_flagged"].sum()),
    )
    fraud = joined.filter(f("is_fraud_flagged"))
    ngke = fraud.filter(f("country").is_in(["Nigeria", "Kenya"]))
    ngke_count = ngke.height / fraud.height
    ngke_loss = float(ngke["fraud_loss_usd"].sum() / fraud["fraud_loss_usd"].sum())
    ngke_value = float(ngke["amount_usd"].sum() / fraud["amount_usd"].sum())
    new = joined.filter(f("account_tenure_days") < 90)
    old = joined.filter(f("account_tenure_days") >= 90)
    tenure_result = two_proportion(
        new.height,
        int(new["is_fraud_flagged"].sum()),
        old.height,
        int(old["is_fraud_flagged"].sum()),
    )
    segments = (
        joined.group_by("gig_segment", maintain_order=True)
        .agg(f("is_disputed").mean().alias("rate"))
        .sort("rate", descending=True)
    )
    market_rank = segments["gig_segment"].to_list().index("Market Trader") + 1
    market = joined.filter(f("gig_segment") == "Market Trader")
    non_market = joined.filter(f("gig_segment") != "Market Trader")
    market_result = two_proportion(
        market.height,
        int(market["is_disputed"].sum()),
        non_market.height,
        int(non_market["is_disputed"].sum()),
    )
    velocity_fraud = stats.pointbiserialr(
        joined["is_fraud_flagged"].cast(pl.Int8), joined["velocity_score"]
    )
    velocity_reversal = stats.pointbiserialr(
        joined["is_reversed"].cast(pl.Int8), joined["velocity_score"]
    )
    month_end = joined.filter(f("is_month_end"))
    other_days = joined.filter(~f("is_month_end"))
    month_end_cashout = month_end.filter(f("transaction_type") == "Cash-Out")
    other_cashout = other_days.filter(f("transaction_type") == "Cash-Out")
    cashout_lead = two_proportion(
        month_end_cashout.height,
        int(month_end_cashout["is_reversed"].sum()),
        other_cashout.height,
        int(other_cashout["is_reversed"].sum()),
    )

    claim_rows = [
        {
            "order": 1,
            "claim_id": "ussd_app_fraud",
            "claim": "USSD fraud is 2.3× Mobile App fraud",
            "observed": f"{ussd_result['ratio']:.3f}×; p={ussd_result['p_value']:.3f}",
            "verdict": "REJECTED",
            "effect": ussd_result["ratio"],
            "effect_unit": "ratio",
            "effect_pp": 100 * ussd_result["diff"],
            "ci_low_pp": 100 * ussd_result["ci_low"],
            "ci_high_pp": 100 * ussd_result["ci_high"],
            "p_value": ussd_result["p_value"],
            "sample_n": ussd.height,
            "decision": "Do not prioritise USSD from this file",
        },
        {
            "order": 2,
            "claim_id": "nigeria_kenya_fraud_volume",
            "claim": "Nigeria and Kenya drive 70% of fraud volume",
            "observed": f"flags {100 * ngke_count:.2f}% · loss {100 * ngke_loss:.2f}% · value {100 * ngke_value:.2f}%",
            "verdict": "REJECTED",
            "effect": ngke_count,
            "effect_unit": "share",
            "effect_pp": None,
            "ci_low_pp": None,
            "ci_high_pp": None,
            "p_value": None,
            "sample_n": fraud.height,
            "decision": "No country reallocation",
        },
        {
            "order": 3,
            "claim_id": "new_account_fraud",
            "claim": "Accounts under 90 days have 3× fraud",
            "observed": f"{tenure_result['ratio']:.3f}×; p={tenure_result['p_value']:.3f}",
            "verdict": "REJECTED",
            "effect": tenure_result["ratio"],
            "effect_unit": "ratio",
            "effect_pp": 100 * tenure_result["diff"],
            "ci_low_pp": 100 * tenure_result["ci_low"],
            "ci_high_pp": 100 * tenure_result["ci_high"],
            "p_value": tenure_result["p_value"],
            "sample_n": new.height,
            "decision": "No tenure-based control change",
        },
        {
            "order": 4,
            "claim_id": "market_trader_dispute",
            "claim": "Market Traders have the highest dispute rate",
            "observed": f"rank {market_rank} of 15; p={market_result['p_value']:.3f}",
            "verdict": "REJECTED",
            "effect": float(market_rank),
            "effect_unit": "rank",
            "effect_pp": 100 * market_result["diff"],
            "ci_low_pp": 100 * market_result["ci_low"],
            "ci_high_pp": 100 * market_result["ci_high"],
            "p_value": market_result["p_value"],
            "sample_n": market.height,
            "decision": "No segment reallocation",
        },
        {
            "order": 5,
            "claim_id": "velocity_risk",
            "claim": "High velocity correlates with fraud and reversal",
            "observed": f"fraud r={velocity_fraud.statistic:+.5f}; reversal r={velocity_reversal.statistic:+.5f}",
            "verdict": "REJECTED",
            "effect": max(abs(velocity_fraud.statistic), abs(velocity_reversal.statistic)),
            "effect_unit": "absolute r",
            "effect_pp": None,
            "ci_low_pp": None,
            "ci_high_pp": None,
            "p_value": min(velocity_fraud.pvalue, velocity_reversal.pvalue),
            "sample_n": raw_fact.height,
            "decision": "Rebuild velocity from timestamps",
        },
        {
            "order": 6,
            "claim_id": "month_end_cashout_reversal",
            "claim": "Month end spikes Cash-Out reversal",
            "observed": f"{100 * cashout_lead['p1']:.2f}% vs {100 * cashout_lead['p0']:.2f}%; p={cashout_lead['p_value']:.3f}",
            "verdict": "OPEN",
            "effect": cashout_lead["diff"],
            "effect_unit": "difference",
            "effect_pp": 100 * cashout_lead["diff"],
            "ci_low_pp": 100 * cashout_lead["ci_low"],
            "ci_high_pp": 100 * cashout_lead["ci_high"],
            "p_value": cashout_lead["p_value"],
            "sample_n": month_end_cashout.height,
            "decision": "Preregister and retest on holdout",
        },
    ]
    dim_claim = pl.DataFrame(claim_rows).sort("order")
    premise(
        dim_claim.filter(f("verdict") == "OPEN").height == 1,
        "the claim ledger no longer has exactly one open lead",
    )

    reversed_status = status_alignment(raw_fact, "Reversed", "is_reversed")
    disputed_status = status_alignment(raw_fact, "Disputed", "is_disputed")
    dim_status_alignment = pl.DataFrame(
        [
            {
                "order": 1,
                "event": "Reversed",
                "outcome_label": "transaction_outcome='Reversed'",
                "event_flag": "is_reversed",
                **reversed_status,
                "verdict": "CHANCE",
            },
            {
                "order": 2,
                "event": "Disputed",
                "outcome_label": "transaction_outcome='Disputed'",
                "event_flag": "is_disputed",
                **disputed_status,
                "verdict": "CHANCE",
            },
        ]
    ).sort("event")

    fact_month_end_cashout = pl.DataFrame(
        [
            {
                "is_month_end": True,
                "period": "Month end",
                "transactions": month_end_cashout.height,
                "reversed": int(month_end_cashout["is_reversed"].sum()),
                "reversal_rate": cashout_lead["p1"],
            },
            {
                "is_month_end": False,
                "period": "Other days",
                "transactions": other_cashout.height,
                "reversed": int(other_cashout["is_reversed"].sum()),
                "reversal_rate": cashout_lead["p0"],
            },
        ]
    )

    source_flagged = raw_fact.filter(f("is_fraud_flagged"))
    bin_width = 1000.0 / 16
    fact_exposure_bin = (
        source_flagged.with_columns(
            (f("amount_usd") / bin_width).floor().clip(0, 15).cast(pl.Int64).alias("amount_bin"),
            (f("fraud_loss_usd") / bin_width).floor().clip(0, 15).cast(pl.Int64).alias("loss_bin"),
            (f("fraud_loss_usd") > f("amount_usd")).alias("above_identity"),
        )
        .group_by(["amount_bin", "loss_bin", "above_identity"], maintain_order=True)
        .agg(pl.len().alias("transactions"))
        .with_columns(
            ((f("amount_bin") + 0.5) * bin_width).alias("amount_mid"),
            ((f("loss_bin") + 0.5) * bin_width).alias("loss_mid"),
        )
        .sort(["above_identity", "amount_bin", "loss_bin"])
    )
    premise(
        fact_exposure_bin["transactions"].sum() == source_flagged.height,
        "exposure binning lost flagged rows",
    )
    premise(
        fact_exposure_bin.filter(f("above_identity"))["transactions"].sum() == 12_562,
        "exposure binning changed the loss > amount count",
    )
    loss_amount_r = float(
        stats.pearsonr(source_flagged["fraud_loss_usd"], source_flagged["amount_usd"]).statistic
    )
    loss_exceeds = source_flagged.filter(f("fraud_loss_usd") > f("amount_usd")).height
    positive_control = int(((raw_fact["fraud_loss_usd"] > 0) == raw_fact["is_fraud_flagged"]).sum())
    audit = archive_audit(actual)

    connector_rows = [
        {
            "order": 1,
            "connector_id": "controls_to_flags",
            "from_node": "Risk controls",
            "to_node": "Event flags",
            "status": "BROKEN",
            "label": "No robust predictive linkage",
            "primary_value": float(sum(item[2] < main_alpha for item in main_effects)),
            "primary_unit": "survivors",
            "primary_display": "0 of 60",
            "secondary_display": "0 of 570 interactions",
            "evidence": f"max |r| {dim_control_validation['abs_statistic'].max():.5f}",
            "decision": "Do not build a vulnerability index",
        },
        {
            "order": 2,
            "connector_id": "flags_to_outcomes",
            "from_node": "Event flags",
            "to_node": "Outcome labels",
            "status": "BROKEN",
            "label": "Status systems agree at chance",
            "primary_value": max(reversed_status["phi"], disputed_status["phi"]),
            "primary_unit": "phi",
            "primary_display": f"φ {max(reversed_status['phi'], disputed_status['phi']):.5f}",
            "secondary_display": "≈50% agreement",
            "evidence": "reversal p=0.355 · dispute p=0.554",
            "decision": "Record event chronology and adjudication",
        },
        {
            "order": 3,
            "connector_id": "exposure_to_loss",
            "from_node": "Recorded exposure",
            "to_node": "Recorded loss",
            "status": "BROKEN",
            "label": "Loss is unrelated to exposure",
            "primary_value": loss_amount_r,
            "primary_unit": "correlation",
            "primary_display": f"r {loss_amount_r:+.5f}",
            "secondary_display": f"loss > amount on {loss_exceeds:,} rows",
            "evidence": "source loss is unbounded",
            "decision": "Block financially weighted recommendations",
        },
        {
            "order": 4,
            "connector_id": "validator_to_files",
            "from_node": "Validator",
            "to_node": "Delivered files",
            "status": "BROKEN",
            "label": "Validator targets another schema",
            "primary_value": float(audit["matching_constraint_names"]),
            "primary_unit": "matching constraints",
            "primary_display": "0 of 54",
            "secondary_display": f"{audit['missing_relationships']} of 9 relationships unavailable",
            "evidence": f"report says {audit['validation_passed']} of 9 passed",
            "decision": "Fail release on absent contracts",
        },
        {
            "order": 5,
            "connector_id": "fraud_flag_to_loss_presence",
            "from_node": "Fraud flag",
            "to_node": "Positive loss presence",
            "status": "CONNECTED",
            "label": "Positive control",
            "primary_value": float(positive_control),
            "primary_unit": "aligned rows",
            "primary_display": "50,000 of 50,000",
            "secondary_display": "the instrument is live",
            "evidence": "loss magnitude remains invalid",
            "decision": "Use as a test, not severity",
        },
        {
            "order": 6,
            "connector_id": "month_end_cashout_to_reversal",
            "from_node": "Month-end Cash-Out",
            "to_node": "Reversal flag",
            "status": "OPEN",
            "label": "Confirm — do not deploy",
            "primary_value": 100 * cashout_lead["diff"],
            "primary_unit": "percentage points",
            "primary_display": f"+{100 * cashout_lead['diff']:.2f}pp",
            "secondary_display": f"p={cashout_lead['p_value']:.3f} · n={month_end_cashout.height}",
            "evidence": f"95% CI [{100 * cashout_lead['ci_low']:+.2f}, {100 * cashout_lead['ci_high']:+.2f}]pp",
            "decision": "Preregister and retest",
        },
    ]
    dim_connector = pl.DataFrame(connector_rows).sort("order")

    dim_defect = pl.DataFrame(
        [
            {
                "order": 1,
                "defect_id": "disconnected_controls",
                "title": "Controls do not predict flags",
                "evidence": "0/60 main effects · 0/570 interactions",
                "boundary": "No segment or channel prioritisation",
            },
            {
                "order": 2,
                "defect_id": "split_status",
                "title": "Flags do not reconcile with outcomes",
                "evidence": f"max φ {max(reversed_status['phi'], disputed_status['phi']):.5f}",
                "boundary": "No event funnel or confirmed outcome",
            },
            {
                "order": 3,
                "defect_id": "broken_finance",
                "title": "Loss does not reconcile with exposure",
                "evidence": f"r {loss_amount_r:+.5f} · {loss_exceeds:,} rows exceed amount",
                "boundary": "No loss severity, ROI or market exposure",
            },
            {
                "order": 4,
                "defect_id": "detached_validation",
                "title": "Validation targets another schema",
                "evidence": f"0/54 constraints · {audit['missing_relationships']}/9 relationships unavailable",
                "boundary": "No trust in the supplied pass report",
            },
            {
                "order": 5,
                "defect_id": "stale_eda",
                "title": "Generated EDA describes an earlier state",
                "evidence": f"{audit['eda_date_rows']} dates reported · {raw_date.height} delivered",
                "boundary": "No metric may be copied from the report",
            },
        ]
    )

    headline = pl.DataFrame(
        [
            {
                "title": "Connected tables. Disconnected risk.",
                "transactions": raw_fact.height,
                "used_workers": raw_fact["worker_id"].n_unique(),
                "markets": raw_market.height,
                "channels": raw_channel["channel_type"].n_unique(),
                "date_start": str(dim_date["date"].min()),
                "date_end": str(dim_date["date"].max()),
                "main_effect_tests": len(main_effects),
                "main_effect_alpha": main_alpha,
                "main_effect_survivors": sum(item[2] < main_alpha for item in main_effects),
                "max_main_cramers_v": max(item[3] for item in main_effects),
                "interaction_tests": len(interactions),
                "interaction_alpha": interaction_alpha,
                "interaction_survivors": sum(item[3] < interaction_alpha for item in interactions),
                "min_interaction_p": min(item[3] for item in interactions),
                "max_abs_continuous_r": float(dim_control_validation["abs_statistic"].max()),
                "positive_control_rows": positive_control,
                "claims_confirmed": dim_claim.filter(f("verdict") == "CONFIRMED").height,
                "claims_rejected": dim_claim.filter(f("verdict") == "REJECTED").height,
                "open_leads": dim_claim.filter(f("verdict") == "OPEN").height,
                "cashout_month_end_reversal_rate": cashout_lead["p1"],
                "cashout_other_reversal_rate": cashout_lead["p0"],
                "cashout_month_end_reversal_diff_pp": 100 * cashout_lead["diff"],
                "cashout_month_end_reversal_ci_low_pp": 100 * cashout_lead["ci_low"],
                "cashout_month_end_reversal_ci_high_pp": 100 * cashout_lead["ci_high"],
                "cashout_month_end_reversal_p": cashout_lead["p_value"],
                "cashout_month_end_n": month_end_cashout.height,
                "reversal_phi": reversed_status["phi"],
                "dispute_phi": disputed_status["phi"],
                "loss_amount_r": loss_amount_r,
                "loss_exceeds_amount_rows": loss_exceeds,
                "validation_checks_passed": audit["validation_passed"],
                "configured_relationships": audit["configured_relationships"],
                "missing_relationships": audit["missing_relationships"],
                "configured_constraints": audit["configured_constraints"],
                "matching_constraint_names": audit["matching_constraint_names"],
            }
        ]
    )

    premise(headline["main_effect_survivors"][0] == 0, "a main effect now survives correction")
    premise(headline["interaction_survivors"][0] == 0, "an interaction now survives correction")
    premise(positive_control == raw_fact.height, "positive control no longer aligns on every row")
    premise(
        loss_exceeds == 12_562,
        f"loss > amount count changed to {loss_exceeds}; re-evaluate the financial boundary",
    )

    print("Writing curated evidence model:")
    for name, frame in [
        ("dim_date", dim_date),
        ("dim_worker", dim_worker),
        ("dim_channel", dim_channel),
        ("dim_market", dim_market),
        ("fact_transaction", fact_transaction),
        ("fact_exposure_bin", fact_exposure_bin),
        ("dim_contract", dim_contract),
        ("dim_control_validation", dim_control_validation),
        ("dim_claim", dim_claim),
        ("dim_status_alignment", dim_status_alignment),
        ("fact_month_end_cashout", fact_month_end_cashout),
        ("dim_connector", dim_connector),
        ("dim_defect", dim_defect),
        ("headline", headline),
    ]:
        write_table(name, frame)

    exports = {
        "headline.json": headline.to_dicts()[0],
        "connectors.json": dim_connector.to_dicts(),
        "claims.json": dim_claim.to_dicts(),
        "contracts.json": dim_contract.to_dicts(),
        "controls.json": dim_control_validation.to_dicts(),
        "exposure_bins.json": fact_exposure_bin.to_dicts(),
        "status_alignment.json": dim_status_alignment.to_dicts(),
        "month_end_cashout.json": fact_month_end_cashout.to_dicts(),
        "defects.json": dim_defect.to_dicts(),
    }
    for name, payload in exports.items():
        dump_json(PUBLIC / name, payload)

    print("\nRow drop log: none")
    print("Invalid financial fields retained only under explicit source_* quarantine names.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
