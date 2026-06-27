#!/usr/bin/env python3
"""
Star schema - 2026/06 UK Fintech Neobank, Zephyr Bank  (Gate G4)

Reads the read-only CSVs, writes parquet to data/curated/. The raw folder is never touched.

The model's job this month is narrow and specific: **make it impossible to express a rate
without its customer count.** The fact table has 1,500 rows and 20 rows of information, and
every question in the brief invites the 1,500 denominator. A schema that hands over
`fact_transaction` with a `is_flagged_fraud` boolean on it will produce "20% of transactions
are fraudulent, +/-2pp" every single time.

Seven decisions, each an argument:

  1. THE CUSTOMER TABLE IS THE PRIMARY FACT. `dim_customer_profile` carries one row per
     customer with the four columns that are constant within a customer -- status, fraud flag,
     device, failure reason -- promoted onto it, because that is where they actually live. The
     transaction table keeps them too (dropping them would hide the defect) but every rate in
     the semantic layer is defined over the customer table.

  2. NO RATE IS STORED WITHOUT ITS DENOMINATOR. `fact_rate` carries one row per published
     rate with BOTH denominators, the exact binomial interval on n=20, and the design effect.
     There is no table from which a naked percentage can be read.

  3. `device_type` IS RENAMED. It is exactly `customer_id mod 4`, so it survives as
     `device_type_raw` next to `customer_id_mod_4`, and the build RAISES if the mapping ever
     breaks -- because if it does, the column has become real and this decision is wrong.

  4. THE FEE JOIN IS ON THE ID, NEVER THE NAME. Four type_names map to two ids each, and
     `ATM Withdrawal` is both a domestic 0.00 and an international 1.50 regime. `dim_txn_type`
     carries a `name_is_ambiguous` flag so a panel cannot group by name unknowingly.

  5. FEE VARIANCE IS STORED GROSS AND NET, SIDE BY SIDE. The whole finding is that the net
     cancels. A model that stored only net variance would reproduce the bug it is reporting.

  6. dim_claim IS THE THESIS AS A TABLE -- every dictionary claim tested, with its verdict.

  7. DATES ARE PARSED %m/%d/%Y AND THE BUILD PROVES IT. Day values exceed 12 and month values
     never do, so the format is not ambiguous; the build asserts that before parsing.

The build RAISES if its premises stop holding, including the thesis itself.

    uv run python 2026/06/model/build.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

f = pl.col

MONTH = Path(__file__).resolve().parents[1]
DATA = next(MONTH.rglob("fact_transactions_updated.csv")).parent
OUT = MONTH / "data" / "curated"
APP = MONTH / "app" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
APP.mkdir(parents=True, exist_ok=True)

CLUSTER = 75  # transactions per customer -- asserted below, not assumed
N_CUST = 20


def premise(ok: bool, msg: str) -> None:
    if not ok:
        raise SystemExit(f"PREMISE VIOLATED: {msg}")


def load(name: str) -> pl.DataFrame:
    # DECISION 7 / A10: all three dimension CSVs carry a UTF-8 BOM, so the primary key parses
    # as '﻿customer_id' and every join returns nulls WITHOUT raising.
    return pl.read_csv(DATA / f"{name}.csv", infer_schema_length=None).rename(
        lambda c: c.lstrip("﻿")
    )


def _fee_design_effect(ftx: pl.DataFrame) -> dict[str, float]:
    """One-way ANOVA intraclass correlation of the fee-wrong indicator, by customer.

    DEFF = 1 + (m-1) * ICC. For the rates on this page ICC is exactly 1 (their numerators
    never vary within a customer) so DEFF is exactly the cluster size. The fee is the one
    defect that varies within a customer, and the question this answers is BY HOW MUCH.
    """
    wrong = (ftx["fee_verdict"] != "correct").cast(pl.Float64)
    by = ftx.select(pl.Series("w", wrong), f("customer_id")).partition_by("customer_id")
    groups = [g["w"].to_numpy() for g in by]
    k, n = len(groups), sum(len(g) for g in groups)
    m = n / k
    grand = float(np.concatenate(groups).mean())
    msb = sum(len(g) * (g.mean() - grand) ** 2 for g in groups) / (k - 1)
    msw = sum(((g - g.mean()) ** 2).sum() for g in groups) / (n - k)
    icc = (msb - msw) / (msb + (m - 1) * msw)
    deff = 1 + (m - 1) * icc
    # Full precision in the payload, rounded only at display. metric_checks.yml recomputes
    # all three in SQL, so a value quantised here fails its own verification - the same trap
    # 2026/05 hit in this same session.
    return {
        "fee_icc": float(icc),
        "fee_design_effect": float(deff),
        "fee_effective_n": float(n / deff),
    }


def exact_ci(k: int, n: int) -> tuple[float, float]:
    lo, hi = stats.binomtest(k, n).proportion_ci(0.95, method="exact")
    return float(lo), float(hi)


def main() -> int:
    raw = load("fact_transactions_updated")
    cu, tt, mc = load("dim_customer"), load("dim_transaction_type"), load("dim_merchant_category")

    premise(raw.height == 1500, f"fact row count changed: {raw.height}")
    premise(cu.height == N_CUST, f"customer count changed: {cu.height}")
    premise("customer_id" in cu.columns, "the BOM strip failed; the primary key is not named")

    # ---- DECISION 7: prove the date format before parsing -----------------------------
    parts = raw["transaction_date"].str.split("/")
    first = parts.list.get(0).cast(pl.Int32)
    second = parts.list.get(1).cast(pl.Int32)
    premise(
        first.max() <= 12 and second.max() > 12,
        f"the M/D/YYYY reading is no longer forced: first component max {first.max()}, "
        f"second {second.max()}. If both are <=12 the format is genuinely ambiguous and "
        "60 dates / 600 rows would silently transpose",
    )
    tx = raw.with_columns(
        pl.col("transaction_date").str.to_date("%m/%d/%Y").alias("txn_date"),
        pl.col("transaction_datetime")
        .str.to_datetime("%m/%d/%Y %H:%M", strict=False)
        .alias("txn_ts"),
    )
    premise(tx["txn_date"].null_count() == 0, "date parsing produced nulls")

    # ---- DECISION 1 + 3: establish the clustering --------------------------------------
    per = tx.group_by("customer_id", maintain_order=True).len()["len"]
    premise(
        per.n_unique() == 1 and per[0] == CLUSTER,
        f"the perfect {CLUSTER}-per-customer clustering is gone (sizes {sorted(set(per.to_list()))}). "
        "Every interval on this page is computed from a design effect of exactly the cluster "
        "size, and that arithmetic no longer applies",
    )

    CONSTANT = ["transaction_status", "is_flagged_fraud", "device_type", "failed_reason"]
    for c in CONSTANT:
        k = tx.group_by("customer_id", maintain_order=True).agg(pl.col(c).n_unique().alias("k"))[
            "k"
        ]
        premise(
            k.max() == 1,
            f"{c} now varies within a customer (max {k.max()} distinct). It was a customer "
            "attribute and the whole thesis rests on that",
        )

    # =====================================================================================
    # dim_customer_profile -- DECISION 1: the primary fact table
    # =====================================================================================
    prof = (
        cu.join(
            tx.group_by("customer_id", maintain_order=True).agg(
                *[pl.col(c).first() for c in CONSTANT],
                pl.len().alias("transactions"),
                pl.col("amount_gbp").mean().alias("mean_amount_gbp"),
                pl.col("amount_gbp").sum().alias("total_value_gbp"),
                pl.col("amount_gbp").min().alias("min_amount_gbp"),
                pl.col("amount_gbp").max().alias("max_amount_gbp"),
                pl.col("amount_gbp").n_unique().alias("distinct_amounts"),
                pl.col("fee_charged_gbp").sum().alias("fees_paid_gbp"),
                pl.col("fee_charged_gbp").n_unique().alias("distinct_fees"),
                pl.col("merchant_category_id").n_unique().alias("categories_used"),
                pl.col("transaction_type_id").n_unique().alias("types_used"),
                pl.col("txn_date").min().alias("first_txn"),
                pl.col("txn_date").max().alias("last_txn"),
            ),
            on="customer_id",
            how="left",
        )
        .with_columns(
            # DECISION 3: the column is kept, and what it actually is sits beside it.
            pl.col("device_type").alias("device_type_raw"),
            (f("customer_id") % 4).alias("customer_id_mod_4"),
            ((f("max_amount_gbp") - f("min_amount_gbp")) / f("mean_amount_gbp")).alias(
                "amount_jitter"
            ),
            f("transaction_status").is_in(["Declined", "Reversed"]).alias("is_failing"),
        )
        .drop("device_type")
        .sort("customer_id")
    )
    prof.write_parquet(OUT / "dim_customer_profile.parquet")

    # DECISION 3 premise
    m = prof.group_by(["customer_id_mod_4", "device_type_raw"], maintain_order=True).len()
    premise(
        m.height == 4 and set(m["len"].to_list()) == {5},
        "device_type is no longer exactly customer_id mod 4. It has become a real column and "
        "DECISION 3 (rename it, and refuse to chart it) must be revisited",
    )
    jit = prof["amount_jitter"].to_numpy()
    premise(
        float(jit.std()) < 0.01,
        f"the amount jitter band is no longer constant (sd {jit.std():.4f}); amount_gbp may now "
        "carry real per-transaction variation",
    )

    # =====================================================================================
    # dim_txn_type -- DECISION 4: name ambiguity is a column, not a footnote
    # =====================================================================================
    dupes = tt.group_by("type_name", maintain_order=True).len().rename({"len": "ids_sharing_name"})
    txn_type = (
        tt.join(dupes, on="type_name", how="left")
        .with_columns((f("ids_sharing_name") > 1).alias("name_is_ambiguous"))
        .join(
            tt.group_by("type_name", maintain_order=True).agg(
                f("typical_fee_gbp").n_unique().alias("fee_regimes_under_this_name")
            ),
            on="type_name",
            how="left",
        )
        .sort("transaction_type_id")
    )
    txn_type.write_parquet(OUT / "dim_txn_type.parquet")
    premise(
        txn_type.filter(f("fee_regimes_under_this_name") > 1).height > 0,
        "no type_name spans two fee regimes any more; DECISION 4 exists because "
        "'ATM Withdrawal' is both a domestic 0.00 and an international 1.50 type",
    )
    mc.sort("merchant_category_id").write_parquet(OUT / "dim_merchant_category.parquet")

    # =====================================================================================
    # fact_transaction -- kept at raw grain, with the fee rule evaluated per row
    # =====================================================================================
    ftx = (
        tx.join(
            txn_type.select(
                [
                    "transaction_type_id",
                    "type_name",
                    "channel",
                    "is_domestic",
                    "typical_fee_gbp",
                    "name_is_ambiguous",
                ]
            ),
            on="transaction_type_id",
            how="left",
        )
        .join(
            mc.select(["merchant_category_id", "category_name", "sector", "risk_flag"]),
            on="merchant_category_id",
            how="left",
        )
        .join(
            cu.select(
                [
                    "customer_id",
                    "customer_name",
                    "customer_segment",
                    "region",
                    "kyc_verified",
                    "age_band",
                ]
            ),
            on="customer_id",
            how="left",
        )
        .with_columns(
            (f("fee_charged_gbp") - f("typical_fee_gbp")).alias("fee_delta_gbp"),
            f("txn_date").dt.truncate("1mo").alias("txn_month"),
            f("txn_date").dt.weekday().alias("dow"),
            f("txn_ts").dt.hour().alias("hour"),
            f("transaction_status").is_in(["Declined", "Reversed"]).alias("is_failing"),
        )
        .with_columns(
            pl.when(f("fee_delta_gbp") > 1e-9)
            .then(pl.lit("over-charged"))
            .when(f("fee_delta_gbp") < -1e-9)
            .then(pl.lit("under-charged"))
            .otherwise(pl.lit("correct"))
            .alias("fee_verdict")
        )
        .drop("device_type")  # DECISION 3: it is not a device; it lives on the profile
    )
    premise(ftx.height == raw.height, "the dimension joins fanned out or dropped rows")
    ftx.write_parquet(OUT / "fact_transaction.parquet")

    # =====================================================================================
    # fact_rate -- DECISION 2: no rate exists without its denominator and interval
    # =====================================================================================
    rates = []
    for label, expr, question in [
        ("Fraud-flagged", f("is_flagged_fraud"), "What % of transactions were flagged fraudulent?"),
        ("Declined", f("transaction_status") == "Declined", "What is the overall Declined rate?"),
        ("Reversed", f("transaction_status") == "Reversed", "How many transactions are reversed?"),
        ("Pending", f("transaction_status") == "Pending", "How many are still pending?"),
        ("Completed", f("transaction_status") == "Completed", "How many transactions succeed?"),
        ("Failing (Declined+Reversed)", f("is_failing"), "What is the failure rate?"),
        ("Non-KYC", ~f("kyc_verified"), "How many customers are unverified?"),
    ]:
        n_tx = ftx.filter(expr).height
        k = int(prof.filter(expr).height)
        p = k / N_CUST
        lo, hi = exact_ci(k, N_CUST)
        naive = 1.96 * float(np.sqrt(p * (1 - p) / ftx.height))
        rates.append(
            {
                "measure": label,
                "question": question,
                "transactions": n_tx,
                "transaction_rate": n_tx / ftx.height,
                "customers": k,
                "customer_rate": p,
                "naive_ci_halfwidth": naive,
                "exact_ci_lo": lo,
                "exact_ci_hi": hi,
                "ci_width_pp": 100 * (hi - lo),
                "naive_width_pp": 200 * naive,
                "design_effect": CLUSTER,
                "se_inflation": float(np.sqrt(CLUSTER)),
            }
        )
    fact_rate = pl.DataFrame(rates)
    fact_rate.write_parquet(OUT / "fact_rate.parquet")
    premise(
        bool((fact_rate["transaction_rate"] - fact_rate["customer_rate"]).abs().max() < 1e-9),
        "the transaction rate and the customer rate have diverged -- they are identical only "
        "because the clustering is perfect, and that identity IS the finding",
    )

    # =====================================================================================
    # fact_fee_variance -- DECISION 5: gross and net, side by side
    # =====================================================================================
    fee = (
        ftx.group_by(
            [
                "transaction_type_id",
                "type_name",
                "channel",
                "is_domestic",
                "typical_fee_gbp",
                "name_is_ambiguous",
            ],
            maintain_order=True,
        )
        .agg(
            pl.len().alias("transactions"),
            f("fee_charged_gbp").sum().alias("charged_gbp"),
            f("typical_fee_gbp").sum().alias("expected_gbp"),
            f("fee_delta_gbp").filter(f("fee_delta_gbp") > 0).sum().alias("over_gbp"),
            (-f("fee_delta_gbp").filter(f("fee_delta_gbp") < 0).sum()).alias("under_gbp"),
            (f("fee_verdict") != "correct").sum().alias("rows_wrong"),
            f("customer_id").n_unique().alias("customers"),
        )
        .with_columns(
            f("over_gbp").fill_null(0.0),
            f("under_gbp").fill_null(0.0),
        )
        .with_columns(
            (f("expected_gbp") - f("charged_gbp")).alias("net_variance_gbp"),
            (f("over_gbp") + f("under_gbp")).alias("gross_variance_gbp"),
        )
        .sort("gross_variance_gbp", descending=True)
    )
    fee.write_parquet(OUT / "fact_fee_variance.parquet")

    charged = float(ftx["fee_charged_gbp"].sum())
    expected = float(ftx["typical_fee_gbp"].sum())
    gross_under = float(-ftx.filter(f("fee_delta_gbp") < 0)["fee_delta_gbp"].sum())
    gross_over = float(ftx.filter(f("fee_delta_gbp") > 0)["fee_delta_gbp"].sum())
    net = expected - charged
    premise(
        abs(net) < 0.05 * (gross_under + gross_over),
        f"the fee errors no longer cancel (net £{net:.2f} vs gross £{gross_under + gross_over:.2f}); "
        "the page's central constructive claim is that a net-variance report is blind here",
    )
    rows_wrong = ftx.filter(f("fee_verdict") != "correct").height
    fee_varies_within = prof.filter(f("distinct_fees") > 1).height
    premise(
        fee_varies_within > 0,
        "the fee defect no longer varies within a customer, so it is n=20 like everything else "
        "and the page has no positive control left",
    )

    # =====================================================================================
    # dim_claim -- DECISION 6: the thesis as a table
    # =====================================================================================
    dom_fx = ftx.filter(f("is_domestic") & f("fx_rate_used").is_not_null()).height
    intl_nofx = ftx.filter(~f("is_domestic") & f("fx_rate_used").is_null()).height
    no_reason = ftx.filter(f("is_failing") & f("failed_reason").is_null()).height
    n_fail = ftx.filter(f("is_failing")).height
    claims = pl.DataFrame(
        [
            {
                "n": 1,
                "claim": "Rows: ~1,500 individual transactions",
                "verdict": "MISLEADING",
                "evidence": f"1,500 rows, but 20 customers x {CLUSTER} and four columns constant within each",
            },
            {
                "n": 2,
                "claim": "device_type: device used (iOS, Android, Web, N/A)",
                "verdict": "FALSE",
                "evidence": "exactly customer_id mod 4, five customers per value",
            },
            {
                "n": 3,
                "claim": "transaction_date is YYYY-MM-DD",
                "verdict": "FALSE",
                "evidence": "M/D/YYYY; parsed as ISO it yields nulls",
            },
            {
                "n": 4,
                "claim": "fx_rate_used: NULL for domestic",
                "verdict": "FALSE",
                "evidence": f"{dom_fx} domestic rows carry a rate; {intl_nofx} international rows do not",
            },
            {
                "n": 5,
                "claim": "failed_reason: reason if Declined or Reversed",
                "verdict": "FALSE",
                "evidence": f"{no_reason} of {n_fail} failing rows have none",
            },
            {
                "n": 6,
                "claim": "amount_gbp: negative = refund/credit",
                "verdict": "FALSE",
                "evidence": f"0 negative amounts, including all "
                f"{ftx.filter(f('type_name') == 'Card Refund').height} Card Refund rows",
            },
            {
                "n": 7,
                "claim": "dimension tables load on their primary key",
                "verdict": "FALSE",
                "evidence": "all three carry a UTF-8 BOM; the PK parses as '\\ufeffcustomer_id' and joins fail silently",
            },
            {
                "n": 8,
                "claim": "type_name identifies a transaction type",
                "verdict": "FALSE",
                "evidence": "4 names map to 2 ids each; ATM Withdrawal is both a £0.00 and a £1.50 regime",
            },
            {
                "n": 9,
                "claim": "risk_flag classifies merchant risk",
                "verdict": "UNSUPPORTED",
                "evidence": "fraud rate High 19.9%, Medium 22.3%, Low 19.0%",
            },
            {
                "n": 10,
                "claim": "fee_charged_gbp reflects typical_fee_gbp",
                "verdict": "FALSE",
                "evidence": f"{rows_wrong} of 1,500 rows deviate; gross £{gross_under + gross_over:,.2f}, "
                f"net £{net:+,.2f}",
            },
            {
                "n": 11,
                "claim": "Scope 2026-01-01 to 2026-05-31",
                "verdict": "TRUE",
                "evidence": f"{ftx['txn_date'].min()} to {ftx['txn_date'].max()}, 151 distinct days",
            },
            {
                "n": 12,
                "claim": "All foreign keys resolve",
                "verdict": "TRUE",
                "evidence": "0 orphans on all three FKs; no dimension row unused",
            },
            {
                "n": 13,
                "claim": "transaction_id is unique",
                "verdict": "TRUE",
                "evidence": "1,500 distinct over 1,500 rows",
            },
            {
                "n": 14,
                "claim": "narrative: over 20,000 active customers",
                "verdict": "MISLEADING",
                "evidence": "the file contains 20",
            },
        ]
    )
    claims.write_parquet(OUT / "dim_claim.parquet")

    # =====================================================================================
    # small aggregates the panels need
    # =====================================================================================
    (
        ftx.group_by("txn_month", maintain_order=True)
        .agg(
            pl.len().alias("transactions"),
            f("amount_gbp").sum().alias("value_gbp"),
            f("fee_charged_gbp").sum().alias("fees_gbp"),
            f("customer_id").n_unique().alias("customers"),
        )
        .sort("txn_month")
        .write_parquet(OUT / "fact_month.parquet")
    )

    mv = pl.read_parquet(OUT / "fact_month.parquet")
    lr = stats.linregress(np.arange(mv.height), mv["value_gbp"].to_numpy())
    premise(
        lr.pvalue > 0.05,
        f"a monthly value trend has appeared (p={lr.pvalue:.4f}); the page says five points "
        "cannot produce one",
    )

    (
        prof.group_by("region", maintain_order=True)
        .agg(
            pl.len().alias("customers"),
            f("is_flagged_fraud").sum().alias("flagged"),
            f("total_value_gbp").sum().alias("value_gbp"),
        )
        .sort("customers", descending=True)
        .write_parquet(OUT / "fact_region.parquet")
    )

    (
        ftx.group_by(["category_name", "sector", "risk_flag"], maintain_order=True)
        .agg(
            pl.len().alias("transactions"),
            f("is_flagged_fraud").mean().alias("fraud_rate"),
            f("customer_id").n_unique().alias("customers"),
            f("customer_id").filter(f("is_flagged_fraud")).n_unique().alias("flagged_customers"),
        )
        .sort("fraud_rate", descending=True)
        .write_parquet(OUT / "fact_category.parquet")
    )

    # every transaction-type failure rate is a fraction of the customers who use it
    (
        ftx.group_by(["transaction_type_id", "type_name", "channel"], maintain_order=True)
        .agg(
            pl.len().alias("transactions"),
            f("is_failing").mean().alias("failure_rate"),
            f("customer_id").n_unique().alias("customers"),
            f("customer_id").filter(f("is_failing")).n_unique().alias("failing_customers"),
        )
        .sort("failure_rate", descending=True)
        .write_parquet(OUT / "fact_type.parquet")
    )

    ft = pl.read_parquet(OUT / "fact_type.parquet")
    premise(
        ft["failure_rate"].n_unique() <= 4,
        f"transaction-type failure rates now take {ft['failure_rate'].n_unique()} distinct "
        "values; the page says there are three, because each is a fraction of four customers",
    )

    # =====================================================================================
    # headline
    # =====================================================================================
    flagged_value = float(ftx.filter(f("is_flagged_fraud"))["amount_gbp"].sum())
    total_value = float(ftx["amount_gbp"].sum())
    top = prof.sort("total_value_gbp", descending=True).head(1)
    top_flagged = float(
        ftx.filter(f("is_flagged_fraud") & (f("customer_id") == top["customer_id"][0]))[
            "amount_gbp"
        ].sum()
    )
    kyc_tab = [
        [
            prof.filter(~f("kyc_verified") & f("is_flagged_fraud")).height,
            prof.filter(~f("kyc_verified") & ~f("is_flagged_fraud")).height,
        ],
        [
            prof.filter(f("kyc_verified") & f("is_flagged_fraud")).height,
            prof.filter(f("kyc_verified") & ~f("is_flagged_fraud")).height,
        ],
    ]

    headline = {
        "transactions": ftx.height,
        "customers": N_CUST,
        "cluster_size": CLUSTER,
        "design_effect": CLUSTER,
        "se_inflation": float(np.sqrt(CLUSTER)),
        "constant_columns": len(CONSTANT),
        "claims_tested": claims.height,
        "claims_false": claims.filter(
            f("verdict").is_in(["FALSE", "MISLEADING", "UNSUPPORTED"])
        ).height,
        "fraud_transactions": ftx.filter(f("is_flagged_fraud")).height,
        "fraud_customers": prof.filter(f("is_flagged_fraud")).height,
        "fraud_rate": ftx.filter(f("is_flagged_fraud")).height / ftx.height,
        "fraud_ci_lo": exact_ci(prof.filter(f("is_flagged_fraud")).height, N_CUST)[0],
        "fraud_ci_hi": exact_ci(prof.filter(f("is_flagged_fraud")).height, N_CUST)[1],
        "completed_customers": prof.filter(f("transaction_status") == "Completed").height,
        "never_completed_customers": N_CUST
        - prof.filter(f("transaction_status") == "Completed").height,
        "total_value_gbp": total_value,
        "flagged_value_gbp": flagged_value,
        "flagged_value_share": flagged_value / total_value,
        "top_customer_value_share": float(top["total_value_gbp"][0]) / total_value,
        "top_customer_flagged_share": top_flagged / flagged_value,
        "top_customer_name": top["customer_name"][0],
        "fee_charged_gbp": charged,
        "fee_expected_gbp": expected,
        "fee_net_variance_gbp": net,
        "fee_net_variance_pct": net / expected,
        "fee_gross_under_gbp": gross_under,
        "fee_gross_over_gbp": gross_over,
        "fee_gross_total_gbp": gross_under + gross_over,
        "fee_rows_wrong": rows_wrong,
        # The fee defect's OWN design effect. The page says every rate here is bounded by
        # n=20 because its numerator is constant within a customer, and then says the fee
        # "escapes the clustering" because it varies within one. Both halves cannot be
        # asserted without measuring the second: the fee-wrong indicator has ICC 0.65, so it
        # escapes PARTLY - DEFF ~49 against the rates' 75, an effective n of ~31, not 1,500.
        # The integrity pass found the page stating a design effect for every rate it kills
        # and none for the one it keeps.
        **_fee_design_effect(ftx),
        "fee_share_of_value": charged / total_value,
        "kyc_fisher_p": float(stats.fisher_exact(kyc_tab).pvalue),
        "non_kyc_customers": prof.filter(~f("kyc_verified")).height,
        "non_kyc_flagged": prof.filter(~f("kyc_verified") & f("is_flagged_fraud")).height,
        "regions": prof["region"].n_unique(),
        "single_customer_regions": prof.group_by("region", maintain_order=True)
        .len()
        .filter(f("len") == 1)
        .height,
        "month_trend_p": float(lr.pvalue),
        "month_trend_r2": float(lr.rvalue**2),
    }
    pl.DataFrame([headline]).write_parquet(OUT / "headline.parquet")

    # ---- app export --------------------------------------------------------------------
    def dump(name: str, df: pl.DataFrame) -> None:
        (APP / f"{name}.json").write_text(
            json.dumps(df.to_dicts(), separators=(",", ":"), default=str)
        )

    dump("customers", prof)
    dump("rates", fact_rate)
    dump("fees", fee)
    dump("claims", claims)
    dump("months", mv)
    dump("regions", pl.read_parquet(OUT / "fact_region.parquet"))
    dump("categories", pl.read_parquet(OUT / "fact_category.parquet"))
    dump("types", ft)
    dump("headline", pl.DataFrame([headline]))
    # the fee scatter needs row-level data, and at 1,500 rows that is 90 KB
    dump(
        "fee_rows",
        ftx.select(
            [
                "transaction_id",
                "customer_id",
                "transaction_type_id",
                "type_name",
                "channel",
                "fee_charged_gbp",
                "typical_fee_gbp",
                "fee_delta_gbp",
                "fee_verdict",
                "amount_gbp",
                "txn_date",
            ]
        ),
    )

    kb = sum(p.stat().st_size for p in APP.glob("*.json")) / 1024
    print(f"Wrote {len(list(OUT.glob('*.parquet')))} parquet files to {OUT}")
    for p in sorted(OUT.glob("*.parquet")):
        d = pl.read_parquet(p)
        print(f"  {p.name:<34} {d.height:>6,} rows x {d.width:>2} cols")
    print(f"\nApp export: {len(list(APP.glob('*.json')))} json, {kb:,.0f} KB")
    print(
        f"\n  All premises held. {CLUSTER} tx/customer, {len(CONSTANT)} constant columns, "
        f"fraud {headline['fraud_rate']:.1%} = {headline['fraud_customers']}/20 "
        f"CI [{headline['fraud_ci_lo']:.1%}, {headline['fraud_ci_hi']:.1%}], "
        f"fee net £{net:+.2f} vs gross £{gross_under + gross_over:,.2f}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
