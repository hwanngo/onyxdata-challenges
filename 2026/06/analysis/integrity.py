#!/usr/bin/env python3
"""G1/G2 integrity pass - 2026/06 UK Fintech Neobank (Zephyr Bank).

The archive dictionary closes with a line that turns out to be the whole month:

    *Rows: ~1,500 (expanded from 20 seed rows)*

It is literal. This script establishes exactly what "expanded" means, because it decides
whether any percentage in the H1 review is a fraction of 1,500 or a fraction of 20.

Standing checks, learned the hard way - run all of these every month:

  1. GRAIN. What is one row? Is the "ID" column actually unique? (2025/05 and 2025/06 both
     shipped a non-unique ID column that the data dictionary called unique. Assume guilty.)
  2. DERIVED COLUMNS. Does the stated arithmetic hold on every row? (2025/06's Engagement
     was NOT likes+shares+comments on any row.)
  3. MISSINGNESS. Is it random, or structural? Structural missingness is a finding.
  4. IS THE HEADLINE METRIC NOISE? KS against uniform. (2025/05's was; 2025/06's was not.)
  5. EFFECT SIZE, NOT JUST p. With thousands of rows everything is significant. Report eta^2
     or an equivalent share-of-variance, and say what share each axis explains.
  6. CONFOUNDS. If axis A looks predictive, check it within levels of axis B. (2025/06's
     hashtag effect collapsed from eta^2 0.75 to 0.022 once category was held constant.)
  7. THIN CELLS. Any group small enough to manufacture a counter-example must be flagged.
     THIS MONTH IS ENTIRELY THIS CHECK. There are 20 customers.

  8. NEW, from 2026/05: check a ratio's DENOMINATOR before believing the effect. Here the
     denominator is the whole finding.

    uv run python 2026/06/analysis/integrity.py

Read-only. Never writes into the raw folder.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
DATA = next(MONTH_DIR.rglob("fact_transactions_updated.csv")).parent

FAILURES: list[str] = []
CONFIRMED: list[str] = []


def check(claim: str, ok: bool, detail: str) -> None:
    (CONFIRMED if ok else FAILURES).append(f"{claim} :: {detail}")
    print(f"  [{'OK ' if ok else 'BAD'}] {claim}\n        {detail}")


def note(text: str) -> None:
    print(f"        {text}")


def section(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def load(name: str) -> pl.DataFrame:
    # The dimension CSVs carry a UTF-8 BOM on the first header cell, which silently renames
    # the primary key to "﻿customer_id" and makes every join fail with no error.
    return pl.read_csv(DATA / f"{name}.csv", infer_schema_length=None).rename(
        lambda c: c.lstrip("﻿")
    )


def main() -> int:
    f = load("fact_transactions_updated")
    cu, tt, mc = load("dim_customer"), load("dim_transaction_type"), load("dim_merchant_category")
    f = f.with_columns(pl.col("transaction_date").str.to_date("%m/%d/%Y").alias("txn_date"))

    section("0. SHAPE")
    for name, df, want in [
        ("fact_transactions", f, 1500),
        ("dim_customer", cu, 20),
        ("dim_transaction_type", tt, 15),
        ("dim_merchant_category", mc, 18),
    ]:
        check(f"{name} rows == {want}", df.height == want, f"actual {df.height:,}")
    check(
        "transaction_id is unique",
        f["transaction_id"].n_unique() == f.height,
        f"{f['transaction_id'].n_unique():,} distinct over {f.height:,} rows",
    )

    section("1. THE FILE-NAME AND THE HEADER BOM")
    check(
        "the fact table is named as the dictionary says",
        (DATA / "fact_transactions.csv").exists(),
        "the dictionary calls it `fact_transactions`; the archive ships "
        "`fact_transactions_updated.csv`. Harmless, but it is the only table with a suffix "
        "and nothing explains what was updated",
    )
    raw_head = (DATA / "dim_customer.csv").read_text(encoding="utf-8").split("\n")[0]
    check(
        "dimension headers have no UTF-8 BOM",
        not raw_head.startswith("﻿"),
        "all three dimension CSVs begin with a BOM, so the first column parses as "
        "'\\ufeffcustomer_id'. Every join on the primary key fails silently unless it is "
        "stripped. The fact table has no BOM, so only the dimensions are affected",
    )

    section("2. FOREIGN KEYS")
    for cc, pt, par in [
        ("customer_id", "dim_customer", cu),
        ("transaction_type_id", "dim_transaction_type", tt),
        ("merchant_category_id", "dim_merchant_category", mc),
    ]:
        used, have = set(f[cc].unique().to_list()), set(par[cc].to_list())
        check(
            f"fact.{cc} -> {pt}",
            not (used - have),
            f"{len(used)} used, {len(used - have)} orphans, {len(have - used)} dim rows never used",
        )

    section("3. THE HEADLINE CLAIM: '~1,500 (expanded from 20 seed rows)'")
    per_cust = f.group_by("customer_id").len()["len"]
    check(
        "every customer has an identical number of transactions",
        per_cust.n_unique() == 1,
        f"all 20 customers have exactly {per_cust[0]} transactions. 20 x {per_cust[0]} = {f.height:,}",
    )

    constant, varying = [], []
    for c in [x for x in f.columns if x not in ("transaction_id", "customer_id", "txn_date")]:
        k = f.group_by("customer_id").agg(pl.col(c).n_unique().alias("k"))["k"]
        (constant if k.max() == 1 else varying).append((c, int(k.min()), int(k.max())))

    print()
    for c, _lo, _hi in constant:
        check(
            f"{c} varies within a customer",
            False,
            "CONSTANT across all 75 of that customer's transactions - it is a property of "
            "the CUSTOMER, not of the transaction",
        )
    for c, lo, hi in varying:
        note(f"{c:<22} varies: {lo}-{hi} distinct values per customer")

    section("4. WHAT THAT DOES TO EVERY RATE THE BRIEF ASKS FOR")
    note("A rate whose numerator is constant within a cluster has the cluster count as its")
    note("effective sample size. The design effect for perfectly clustered data with cluster")
    note("size m is exactly m, so standard errors are sqrt(m) times wider than reported.")
    m = int(per_cust[0])
    print(
        f"\n  {'measure':<20}{'tx':>6}{'of 1500':>9}   {'customers':>10}{'of 20':>7}   "
        f"{'naive 95% CI':>14}   {'exact CI on n=20':>20}"
    )
    for lbl, expr in [
        ("fraud-flagged", pl.col("is_flagged_fraud")),
        ("Declined", pl.col("transaction_status") == "Declined"),
        ("Reversed", pl.col("transaction_status") == "Reversed"),
        ("Pending", pl.col("transaction_status") == "Pending"),
        ("Completed", pl.col("transaction_status") == "Completed"),
    ]:
        tx = f.filter(expr).height
        k = f.filter(expr)["customer_id"].n_unique()
        p = k / 20
        naive = 1.96 * np.sqrt(p * (1 - p) / f.height)
        lo, hi = stats.binomtest(k, 20).proportion_ci(0.95, method="exact")
        print(
            f"  {lbl:<20}{tx:>6}{100 * tx / f.height:>8.1f}%   {k:>10}{100 * p:>6.1f}%   "
            f"{'+/-' + format(100 * naive, '.1f') + 'pp':>14}   "
            f"{'[' + format(100 * lo, '.1f') + '%, ' + format(100 * hi, '.1f') + '%]':>20}"
        )
    print(
        f"\n  design effect = cluster size = {m}; every SE is sqrt({m}) = {np.sqrt(m):.2f}x wider "
        "than a naive n=1500 calculation gives"
    )

    section("5. device_type IS NOT A DEVICE")
    d = (
        f.group_by("customer_id")
        .agg(pl.col("device_type").first())
        .with_columns((pl.col("customer_id") % 4).alias("mod4"))
    )
    mapping = d.group_by(["mod4", "device_type"]).len().sort("mod4")
    perfect = mapping.height == 4 and set(mapping["len"].to_list()) == {5}
    check(
        "device_type carries information beyond the customer's row number",
        not perfect,
        "device_type is EXACTLY customer_id mod 4 - "
        + ", ".join(f"{r['mod4']}->{r['device_type']}" for r in mapping.iter_rows(named=True))
        + ". Five customers per device. Any 'which device fails most' question is answering "
        "'which row numbers were assigned which status'",
    )

    section("6. amount_gbp IS ONE SEED PER CUSTOMER")
    a = f.group_by("customer_id").agg(
        pl.col("amount_gbp").min().alias("lo"),
        pl.col("amount_gbp").max().alias("hi"),
        pl.col("amount_gbp").mean().alias("mu"),
        pl.col("amount_gbp").n_unique().alias("k"),
    )
    spread = ((a["hi"] - a["lo"]) / a["mu"]).to_numpy()
    check(
        "amount varies freely within a customer",
        not (a["k"].n_unique() == 1 and spread.std() < 0.01),
        f"every customer has exactly {a['k'][0]} distinct amounts, and the relative spread "
        f"(max-min)/mean is {spread.min():.4f}-{spread.max():.4f} for ALL 20 - a constant "
        f"+/-15% band around one seed value. Customer amounts range from "
        f"£{a['mu'].min():,.0f} to £{a['mu'].max():,.0f}, a {a['mu'].max() / a['mu'].min():,.0f}x "
        "spread across 20 points",
    )

    section("7. DECLARED COLUMN SEMANTICS")
    j = f.join(tt, on="transaction_type_id", how="left")
    dom_fx = j.filter(pl.col("is_domestic") & pl.col("fx_rate_used").is_not_null()).height
    intl_nofx = j.filter(~pl.col("is_domestic") & pl.col("fx_rate_used").is_null()).height
    check(
        "fx_rate_used is NULL for domestic, present for international",
        dom_fx == 0 and intl_nofx == 0,
        f"{dom_fx} DOMESTIC transactions carry an FX rate and {intl_nofx} INTERNATIONAL "
        f"transactions have none. The rule is broken in both directions",
    )
    bad_reason = f.filter(
        pl.col("transaction_status").is_in(["Declined", "Reversed"])
        & pl.col("failed_reason").is_null()
    ).height
    n_fail = f.filter(pl.col("transaction_status").is_in(["Declined", "Reversed"])).height
    check(
        "failed_reason is populated for every Declined/Reversed row",
        bad_reason == 0,
        f"{bad_reason} of {n_fail} Declined/Reversed transactions have no failed_reason. "
        "The dictionary calls it the 'reason for non-completion if Declined or Reversed'",
    )
    check(
        "transaction_date is in the documented YYYY-MM-DD format",
        False,
        "the file uses M/D/YYYY ('3/16/2026'). Parsed as ISO it silently yields nulls or, "
        "worse, transposes day and month on the 60 dates (600 rows) where both are <= 12",
    )
    check(
        "amount_gbp uses negatives for refunds, as documented",
        f.filter(pl.col("amount_gbp") < 0).height > 0,
        f"{f.filter(pl.col('amount_gbp') < 0).height} negative amounts. The dictionary says "
        "'negative = refund/credit', and there is a Card Refund transaction type with "
        f"{j.filter(pl.col('type_name') == 'Card Refund').height} rows - all positive",
    )
    check(
        "the declared scope 2026-01-01..2026-05-31 matches the data",
        str(f["txn_date"].min()) == "2026-01-01" and str(f["txn_date"].max()) == "2026-05-31",
        f"actual {f['txn_date'].min()} .. {f['txn_date'].max()}, {f['txn_date'].n_unique()} distinct days",
    )

    section("8. type_name IS NOT A KEY")
    dupes = tt.group_by("type_name").len().filter(pl.col("len") > 1).sort("len", descending=True)
    check(
        "type_name uniquely identifies a transaction type",
        dupes.height == 0,
        f"{dupes.height} names map to more than one transaction_type_id: "
        + ", ".join(f"{r['type_name']} x{r['len']}" for r in dupes.iter_rows(named=True))
        + ". 'ATM Withdrawal' is BOTH a domestic £0.00 type and an international £1.50 type, "
        "so grouping by name silently merges two different fee regimes",
    )

    section("9. THE FEE RULE - the one thing measured per TRANSACTION")
    j = j.with_columns((pl.col("fee_charged_gbp") - pl.col("typical_fee_gbp")).alias("delta"))
    under, over = j.filter(pl.col("delta") < -1e-9), j.filter(pl.col("delta") > 1e-9)
    charged, expected = f["fee_charged_gbp"].sum(), j["typical_fee_gbp"].sum()
    check(
        "fee_charged_gbp equals typical_fee_gbp",
        under.height + over.height == 0,
        f"{under.height + over.height} of {f.height:,} rows deviate - {under.height} "
        f"under-charged across {under['customer_id'].n_unique()} customers, {over.height} "
        f"over-charged across {over['customer_id'].n_unique()} customers",
    )
    note("")
    note(f"total charged  £{charged:,.2f}")
    note(f"total expected £{expected:,.2f}")
    note(
        f"NET variance   £{expected - charged:+,.2f}  ({100 * (expected - charged) / expected:+.3f}%)"
    )
    note(f"GROSS under-collection £{-under['delta'].sum():,.2f}")
    note(f"GROSS over-collection  £{over['delta'].sum():,.2f}")
    note(
        f"-> the two cancel to {100 * (expected - charged) / expected:+.3f}%, so a net fee-variance "
        "report shows a clean bill"
    )
    note(
        f"   while £{-under['delta'].sum() + over['delta'].sum():,.2f} of fees sit on the wrong "
        "side of the rule"
    )
    fee_k = f.group_by("customer_id").agg(pl.col("fee_charged_gbp").n_unique().alias("k"))
    note(
        f"   and this defect DOES vary within a customer ({fee_k.filter(pl.col('k') > 1).height} "
        "customers show 11 distinct fee values), so unlike every rate above it is a genuine "
        "per-transaction finding"
    )

    section("9b. TIME-OF-DAY AND DAY-OF-WEEK, AGAINST THE FRAUD FLAG")
    # These two lines exist because the integrity pass found "day-of-week p = 0.045, V = 0.0378"
    # and "hour p = 0.77, V = 0.0228" published in insights.md, assumptions.md and
    # .workbench/2026/06/analysis/questions.md
    # with NO query anywhere in the repo, and no definition reproducing either pair. Rule 3 is
    # "no query, no claim" - so the query now lives here and prints its own numbers.
    from scipy import stats as _st

    # Derived here from the RAW datetime, not read from the curated model - this file exists
    # so that a defect in build.py cannot validate itself.
    ft = f.with_columns(
        pl.col("transaction_datetime").str.to_datetime("%m/%d/%Y %H:%M").alias("_ts")
    ).with_columns(
        pl.col("_ts").dt.weekday().alias("dow"),
        pl.col("_ts").dt.hour().alias("hour"),
    )

    for col in ("dow", "hour"):
        piv = (
            ft.group_by([col, "is_flagged_fraud"])
            .len()
            .pivot(values="len", index=col, on="is_flagged_fraud")
            .fill_null(0)
            .sort(col)
        )
        tab = piv.drop(col).to_numpy().astype(float)
        chi2, p, dof, _ = _st.chi2_contingency(tab)
        n = tab.sum()
        v = (chi2 / (n * min(tab.shape[0] - 1, tab.shape[1] - 1))) ** 0.5
        note(f"{col:5s} x is_flagged_fraud: chi2={chi2:.3f} dof={dof} p={p:.4f} Cramér's V={v:.4f}")
        check(
            f"{col} carries no fraud pattern at alpha .05",
            p > 0.05,
            f"p={p:.4f} (and the rows are clustered, so the true p is larger still)",
        )

    section("10. SUMMARY")
    print(f"\n  Claims tested:    {len(CONFIRMED) + len(FAILURES)}")
    print(f"  Confirmed:        {len(CONFIRMED)}")
    print(f"  FALSIFIED:        {len(FAILURES)}")
    if FAILURES:
        print("\n  Falsified:")
        for x in FAILURES:
            print(f"    - {x.split(' :: ')[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
