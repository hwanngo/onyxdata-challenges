# Insight ledger - 2026/08 African Gig-Economy and Digital Wallet Risk

**The gate that decides the Insights score. No query, no claim.**

The statistical queries below execute against the immutable CSVs through
`analysis/integrity.py`. G4 duplicates every published metric against curated Parquet and asserts
load-bearing figures independently from the raw files.

## Thesis

> **Connected tables. Disconnected risk.** The archive's 50,000 transactions form a clean,
> responsive star schema, but the evidence chain breaks at four connectors: risk controls do not
> predict event flags, flags do not reconcile with outcomes, losses do not reconcile with exposure,
> and the validator does not test the delivered files. The result can produce a convincing dashboard,
> but not defensible risk prioritisation.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | The archive looks production-ready: 50,000 unique transactions, four resolving foreign keys, a complete two-year calendar, worker/channel/market dimensions, three event flags and multiple risk controls. A polished interactive dashboard is mechanically easy to build. |
| **Complication** | Mechanical integrity is masking semantic failure. Controls → flags has 0 corrected relationships; flags → outcomes agrees at chance; exposure → loss is unrelated and sometimes impossible; the validator certifies constraints and relationships that do not target the delivered schema. Five supplied findings fail, while one month-end Cash-Out reversal lead remains just short of confirmation. |
| **Resolution** | Pause country-, channel- and worker-based control reallocation. Rebuild one transaction-level evidence chain with reconciled event chronology, confirmed outcomes, bounded loss and enforced currency identities. Make validation fail on absent contracts, then preregister and retest the +8.28pp month-end Cash-Out reversal lead on a later holdout period. |

---

## I1 - The file passes the dashboard smell test. That is the trap.

**Query**

```python
from analysis.integrity import analyze

r = analyze(DATA)["shape"]
print(r)
```

The executable implementation is `analysis/integrity.py::analyze`; it checks raw primary keys,
foreign keys, worker-level repetition and event ICCs before any insight test runs.

**Output**

```text
fact_rows                    50,000
distinct_transaction_ids     50,000
worker_rows                    5,000
used_workers                   4,999
transactions_per_worker         2-25
worker fraud ICC             -0.00184
worker dispute ICC           -0.00069
worker reversal ICC          -0.00286
foreign-key orphans                  0
```

The date dimension also agrees with its parsed date on all 731 rows for date ID, year, month,
quarter, weekday, weekend and month-end. Only `week_number` is empty.

**Caveat:** this proves delivered transaction grain and joinability, not business validity. A valid
key says records connect; it says nothing about whether the connected measures describe the same
event.

**So what:** do not open with “bad data.” Open with the stronger operational warning: **a dashboard
can pass every mechanical build check and still be semantically unusable.** That is why the false
confidence is dangerous.

---

## I2 - The risk-control circuit is present, but carries no robust signal.

**Query**

```python
r = analyze(DATA)["risk_screen"]
print(
    r["categorical_tests"],
    r["bonferroni_survivors"],
    r["max_cramers_v"],
    r["interaction_tests"],
    r["interaction_survivors"],
    r["max_abs_continuous_r"],
    r["daily_variance_ratio"],
    r["fraud_loss_flag_alignment"],
)
```

`analysis/integrity.py` declares 20 challenge-derived axes before testing, crosses each with fraud,
dispute and reversal, then screens every two-axis interaction separately. Point-biserial checks cover
velocity, worker risk, channel historical fraud, market fraud index, processing time and amount.

**Output**

```text
prespecified main-effect tests       60
Bonferroni alpha               0.000833
survivors                             0
max Cramér's V                  0.02156

exploratory two-axis tests           570
Bonferroni alpha               0.00008772
survivors                              0
smallest nominal p              0.00323
channel type × transaction type p=0.00781, V=0.04348  [not corrected]

max |continuous r|              0.00632
daily fraud variance / binomial 0.9927
positive control alignment       50,000 / 50,000
```

The positive control is `(fraud_loss_usd > 0) == is_fraud_flagged`. It succeeds on every row, proving
the instrument detects the one designed relationship that exists.

**Caveat:** “no corrected relationship detected” is not proof that every possible dependence equals
zero. Nominal interactions exist, as a 570-test search guarantees; none survives its own search
budget. The conclusion diagnoses this delivered synthetic archive, not a real wallet platform.

**So what:** a weighted vulnerability index built from `risk_score`, `velocity_score`,
`avg_fraud_rate` and `market_fraud_index` would combine disconnected dials, not create signal. Pause
segment/channel prioritisation until controls are calibrated against confirmed outcomes on a holdout
period.

---

## I3 - Five supplied findings fail; one month-end lead is amber, not green.

**Query**

```python
c = analyze(DATA)["claims"]
for key in (
    "ussd_app_fraud_ratio",
    "nigeria_kenya_fraud_count_share",
    "new_account_fraud_ratio",
    "market_trader_dispute_rank",
    "velocity_fraud_r",
    "velocity_reversal_r",
    "month_end_cashout_reversal_rate",
    "other_cashout_reversal_rate",
    "month_end_cashout_reversal_diff",
    "month_end_cashout_reversal_pvalue",
    "supported_count",
):
    print(key, c[key])
```

**Output**

| Supplied finding | Delivered result | Verdict |
|---|---|---|
| USSD fraud is 2.3× app fraud | **1.017×**; +0.86pp, 95% CI [-0.98pp, +2.71pp], p=0.358 | Rejected |
| Nigeria + Kenya drive 70% of fraud | 49.82% of flags · 50.03% of loss · 49.84% of flagged value | Rejected under all defensible denominators |
| Accounts under 90 days have 3× fraud | **1.016×**; +0.81pp, 95% CI [-1.20pp, +2.82pp], p=0.430 | Rejected |
| Market Traders lead disputes | **10th of 15**; -0.67pp vs others, p=0.481 | Rejected |
| Velocity correlates with fraud/reversal | r=-0.00074 / +0.00267; p=0.868 / 0.551 | Rejected |
| Month end spikes Cash-Out/reversal | Overall readings not significant. **Within Cash-Out:** 59.09% month end (n=132) vs 50.82% otherwise (n=3,739), **+8.28pp**, 95% CI [-0.26pp, +16.81pp], p=0.058 | **Open confirmation target** |

**Confirmed as stated: 0 of 6.**

**Caveat:** the Cash-Out result is the one place where the denominator changes the decision. Its
point estimate is materially sized but the month-end cell is only 132 rows and the interval includes
zero. It is a lead in the `is_reversed` flag, not proof of operational reversals:
`transaction_outcome='Reversed'` agrees with that flag only at chance.

**So what:** do neither extreme. Do not deploy a month-end control on p=0.058, and do not discard an
+8.28pp lead as “no effect.” Preregister the denominator and operational materiality threshold, then
retest on a later holdout period.

---

## I4 - Even a confirmed fraud event could not be valued from these fields.

**Query**

```sql
WITH f AS (
  SELECT * FROM read_csv_auto('data/fact_transactions_Updated_.csv')
), m AS (
  SELECT * FROM read_csv_auto('data/dim_market.csv')
), j AS (
  SELECT f.*, m.usd_fx_rate
  FROM f JOIN m USING (market_id)
)
SELECT corr(amount_local, amount_usd) AS local_usd_r,
       corr(amount_usd, amount_local / usd_fx_rate) AS usd_fx_r,
       corr(fraud_loss_usd, amount_usd) FILTER (WHERE is_fraud_flagged) AS loss_amount_r,
       count(*) FILTER (
         WHERE is_fraud_flagged AND fraud_loss_usd > amount_usd
       ) AS loss_exceeds_amount,
       sum(fraud_loss_usd) FILTER (WHERE is_fraud_flagged)
         / sum(amount_usd) FILTER (WHERE is_fraud_flagged) AS loss_to_flagged_value
FROM j;
```

**Output**

```text
amount_local vs amount_usd                    r = +0.00189
amount_usd vs amount_local / usd_fx_rate      r = +0.00207
fraud_loss_usd vs flagged transaction amount  r = -0.00453
loss exceeds transaction amount                   12,562 rows
fraud loss / flagged transaction value              99.74%
```

Totals are $12,559,256.91 recorded loss against $12,592,238.49 flagged value. Their near equality is
not reconciliation; both magnitudes are unrelated bounded draws.

**Caveat:** the source labels these units USD, but no defensible conversion or exposure identity
exists. Counts and flag rates can describe this file. The monetary values cannot be generalized or
used as operational loss.

**So what:** reject loss-weighted hotspot maps, exposure rankings, revenue impact and control ROI.
Enforce `amount_local ÷ FX = amount_usd` and require adjudicated loss to be bounded by recoverable
exposure before any financially weighted prioritisation is allowed.

---

## I5 - The validator passed a schema the delivered files do not implement.

**Query**

```python
from pathlib import Path
import json

config = json.loads(Path("docs/SCHEMA_CONFIG.json").read_text())
validation = json.loads(Path("docs/VALIDATION_REPORT.json").read_text())
actual = {table: set(frame.columns) for table, frame in actual_tables.items()}

unavailable = sum(
    rel["from_column"] not in actual.get(rel["from_table"], set())
    or rel["to_column"] not in actual.get(rel["to_table"], set())
    for rel in config["relationship_rules"].values()
)
matching_constraints = sum(
    rule["column_name"] in set().union(*actual.values())
    for rule in config["column_constraints"].values()
)
print(validation["summary"], unavailable, matching_constraints)
```

The complete executable version also parses the generated EDA in
`analysis/integrity.py::audit_archive`.

**Output**

```text
VALIDATION_REPORT                 9 passed / 9 total / 0 warnings
configured relationships          9
relationships requiring absent columns  5
configured constraint names      54
constraint names matching delivered columns  0
EDA calendar rows               730
delivered calendar rows         731
```

**Caveat:** the delivered five-table schema itself is mechanically joinable. The defect is not that
every relationship is broken; it is that the report claiming “passed” did not validate the schema
actually delivered.

**So what:** make validation fail closed. A declared column, relationship, range or identity missing
from the delivered files must stop release. That single operating control would have caught the
three earlier breaks before a dashboard could certify them by appearance.

---

## The constructive recommendation

> **Pause channel-, country- and worker-based control reallocation. Rebuild one transaction-level
> evidence chain keyed by transaction and originating-event IDs, with event timestamps, control
> decisions, confirmed fraud/dispute/reversal outcomes, reasons, false positives, recoveries and
> adjudicated loss. Enforce local amount ÷ FX = USD, bound confirmed loss by exposure, and fail
> validation whenever a declared contract is absent. Once those contracts pass, preregister the
> month-end Cash-Out denominator and materiality threshold, then retest the +8.28pp reversal-flag
> lead on a later holdout period. Deploy only if it repeats and its interval clears the threshold.**

## Rejected

| Candidate | Why dropped |
|---|---|
| “0 of 6 findings confirmed” as the headline | Useful evidence, but reads as fact-checking rather than a decision-grade mechanism. |
| Generic “bad data” / missing-data story | The file is mechanically excellent. The tension between structural and semantic integrity is the insight. |
| Country fraud hotspot map | Four near-equal markets; any rank magnifies random differences. |
| Channel-risk league table | USSD/App is 1.017×, and no channel effect survives correction. |
| Worker or gig-segment top-N | Typical worker has ~10 rows; segment differences are tiny or uncorrected. |
| Vulnerability/composite index | Weighting disconnected controls cannot create predictive validity. |
| Channel × transaction type heatmap | Nominal p=0.0078, V=0.04348; fails the 570-test correction. |
| Confirmed month-end spike | p=0.058 and CI crosses zero on n=132. It is amber, not green. |
| “No month-end effect” | The +8.28pp Cash-Out lead is too material to erase; retain it for holdout confirmation. |
| Loss-severity / market-exposure ranking | Currency and loss magnitudes do not reconcile. |
| Reversal/dispute funnel | Outcome labels and Boolean flags agree only at chance, so the sequence is not defined. |
| Merchant or fee proxy | Neither field exists; inventing one would violate provenance. |
| Generalisation to African markets or gig workers | All conclusions diagnose the delivered synthetic archive only. |

## Non-obvious checklist

Worked deliberately in G3:

- [x] **two-way interactions** — 570 tests, zero corrected survivors
- [x] **Simpson's paradox / denominator reversal** — month-end checked overall and within Cash-Out
- [x] **rate vs volume mismatch** — Nigeria/Kenya tested as count, loss and flagged value
- [x] **concentration** — worker extremes rejected as thin-denominator noise
- [x] **distribution vs average** — bounded-uniform signatures replace misleading means
- [x] **cohorts** — under-90-day tenure cohort tested and rejected
- [x] **changepoints & anomalies** — month-end Cash-Out reversal retained as one open lead
- [x] **funnel leakage** — outcome labels and event flags fail to form a coherent lifecycle
- [x] **lead / lag** — unsupported because transaction timestamps and event chronology are absent
- [x] **missingness as signal** — week number is structurally absent, not behavioural
- [x] **survivorship** — one unused worker, zero fact orphans
- [x] **mix vs performance decomposition** — main effects and pairwise interactions screened separately
