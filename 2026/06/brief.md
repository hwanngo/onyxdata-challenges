# Brief - 2026/06

- **Title:** June 2026 DataDNA - UK Fintech Neobank: Digital Transaction Health Monitor
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/june-2026-datadna-uk-fintech-neobank-digital-transaction-health-monitor-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-06-june-2026-datadna-uk-fintech-neobank-digital-transaction-health-monitor-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/05/DataDNA-Dataset-Challenge-2026-06-UK-Fintech-Neobank-Digital-Transaction-Health-Monitor.zip
- **sha256:** `9aad2ee29776d650186aad914182cbd3f38bc288a41aba4608bd7e7b4731d6f0`

## Scenario

> "Digital-first banks operating across multiple customer segments and transaction channels
> face operational, financial, and risk-related challenges. The dataset highlights critical
> areas in transaction visibility, customer behavior variations, fraud exposure, transaction
> failures, fee revenue generation, and verification status differences."

The archive's own `CHALLENGE_BRIEF.md` is far more specific and is the better statement:

> "Step into the role of a data analyst embedded within the risk and product team at **Zephyr
> Bank**, a UK-based fintech neobank... You've been provided with a dataset spanning January 2026
> to June 2026, covering **~1,500 individual customer transactions**... As part of the bank's
> **2026 H1 review (target date: 1 June 2026)**, leadership wants a consolidated view of
> transaction health. **Finance** wants to understand fee revenue and leakage. **Risk** wants to
> know which customer segments and merchant categories concentrate fraud exposure. **Product**
> wants to understand channel usage and where transactions are failing - and why."

**Persona:** the H1 2026 review panel - Risk, Finance, Product and Compliance, reading one
consolidated transaction-health pack before 1 June.

The archive brief also states the bank "has grown to serve **over 20,000 active customers**".
The file contains **20**.

## Stated objective

> "Uncover revenue opportunities, identify fraud and operational risks, and detect customer
> behaviour patterns - helping Risk, Finance, Product, and Compliance teams improve transaction
> success rates, reduce revenue leakage, strengthen fraud controls, and enhance the overall
> customer experience."

## Explicit requirements

Two lists again - **twelfth month running that the ZIP carries requirements the challenge page
does not.**

### A. Challenge page - "Analysis Challenges" (12)

- [ ] Fragmented visibility across customers, transaction types, channels, and merchant categories
- [ ] Variations in customer behaviour across segments (Starter, Standard, Premium, Business)
- [ ] Fraud exposure distributed across channels, merchant categories, and regions
- [ ] Transaction failures (Declined and Reversed transactions) with multiple causes
- [ ] Fee revenue generated across different transaction types and channels
- [ ] Differences in customer verification status (KYC vs non-KYC) creating uneven risk profiles
- [ ] High transaction volume not translating to high profitability
- [ ] Limited visibility into merchant category performance
- [ ] Lack of clear linkage between customer behaviour, transaction outcomes, and fee generation
- [ ] Cross-dimensional interactions (customer segment × channel × merchant category × region) under-analysed
- [ ] Potential fraudulent activity, transaction anomalies, and fee inconsistencies
- [ ] Difficulty connecting transaction activity to business outcomes

### B. Archive `CHALLENGE_BRIEF.md` - 3 analysis areas, 14 guiding questions

**Temporal:** month-on-month value trend · are Declined/fraud transactions clustering in
specific weeks · day-of-week or time-of-day pattern in high-risk transactions · fee revenue over
time · anomalous large-value spikes.

**Customer & segment:** which segments drive volume and value · **do non-KYC customers show
disproportionate Declined/fraud rates** · which UK regions concentrate fraud · are older account
holders behaving differently · which individual customers generate outsized risk or fee revenue.

**Transaction & merchant:** which transaction types have the highest failure rate · **which
merchant categories attract the most fraud flags, and does `risk_flag` align with actual fraud**
· international vs domestic · **which device type is associated with the most failed or
fraudulent transactions** · **merchant categories where actual fees deviate from typical -
suggesting waivers or errors**.

Named guiding questions carried into `.workbench/2026/06/analysis/questions.md`: total H1 fee revenue and its
composition · **are international transfer fees consistently applied** · fee revenue per segment
by tier · **what % of transactions were flagged fraudulent and how it varies by category** ·
**which single transaction is the highest risk-adjusted exposure** · **is Gambling or Crypto
driving disproportionate fraud** · overall Declined rate and worst channel · ATM Reversals and
international Declines as systemic signals · device split by segment.

Scoring hints, effectively requirements: lead with business impact · quantify in percentages or
currency · **use cohort and over-index analysis, not just top-N** · **distinguish signal from
noise, call out where findings are indicative vs conclusive** · specific, measurable next actions.

## The file

| Table | Rows | Notes |
|---|---|---|
| `fact_transactions_updated.csv` | 1,500 | the dictionary calls it `fact_transactions`; only table with a suffix |
| `dim_customer` | 20 | |
| `dim_merchant_category` | 18 | |
| `dim_transaction_type` | 15 | |

Referential integrity is perfect: **0 orphans on all three FKs, and no dimension row goes
unused.** The declared scope (2026-01-01 → 2026-05-31) matches exactly, across 151 distinct days.

### The unusual thing about this month

The dictionary's fact-table section closes with a parenthesis:

> *Rows: ~1,500 (expanded from 20 seed rows)*

**It is literal, and it is the month.** `analysis/integrity.py` tests 24 claims; **14 fail**.

**Every customer has exactly 75 transactions. 20 × 75 = 1,500.** And four columns are
**constant within a customer** - they never vary across any of that customer's 75 rows:

| Column | What it actually is |
|---|---|
| `transaction_status` | a property of the **customer**, not the transaction |
| `is_flagged_fraud` | a property of the **customer** |
| `device_type` | **exactly `customer_id mod 4`** - 1→iOS, 2→N/A, 3→Android, 0→Web, five customers each |
| `failed_reason` | a property of the **customer** |

`amount_gbp` is barely better: every customer has exactly **11 distinct amounts**, and the
relative spread `(max-min)/mean` is **0.3020-0.3040 for all twenty** - one seed value jittered
by a constant ±15% band. Customer means run from **£10 to £14,994**, a 1,503× spread across
twenty points.

### What that does to every rate in the H1 review

A rate whose numerator is constant within a cluster has the **cluster count** as its effective
sample size. With perfect clustering the design effect equals the cluster size, so standard
errors are **√75 = 8.66×** wider than a naive n=1,500 calculation gives.

| Measure | Reported | Actually | Naive 95% CI | Exact CI on n=20 |
|---|---:|---|---:|---|
| fraud-flagged | 300/1500 = **20.0%** | **4 of 20 customers** | ±2.0pp | **[5.7%, 43.7%]** |
| Declined | 525/1500 = **35.0%** | **7 of 20 customers** | ±2.4pp | **[15.4%, 59.2%]** |
| Reversed | 375/1500 = **25.0%** | 5 of 20 | ±2.2pp | [8.7%, 49.1%] |
| Pending | 375/1500 = **25.0%** | 5 of 20 | ±2.2pp | [8.7%, 49.1%] |
| Completed | 225/1500 = **15.0%** | **3 of 20 customers** | ±1.8pp | **[3.2%, 37.9%]** |

Only **15% of transactions complete**. Seventeen of the bank's twenty customers have *never*
completed a transaction in five months - which is not a finding about a bank, it is a
statement about how the file was built.

### The other nine falsified claims

| # | The dictionary says | The file says |
|---:|---|---|
| 1 | `transaction_date` is **YYYY-MM-DD** | **M/D/YYYY** (`3/16/2026`). Parsed as ISO it yields nulls, or transposes day and month on the **60 dates (600 rows)** where both components are ≤ 12 - 151 is the total distinct-date count, a different quantity |
| 2 | `fx_rate_used` is **NULL for domestic** | **125 domestic** transactions carry an FX rate and **275 international** ones have none - broken in both directions |
| 3 | `failed_reason` gives the reason **if Declined or Reversed** | **600 of 900** Declined/Reversed rows have none |
| 4 | `amount_gbp`: "negative = refund/credit" | **Zero negatives**, including all 100 `Card Refund` rows |
| 5 | fact table is `fact_transactions` | ships as `fact_transactions_updated.csv` |
| 6 | - | all three **dimension** CSVs carry a **UTF-8 BOM**, so the PK parses as `﻿customer_id` and every join fails *silently*. The fact table has none |
| 7 | `type_name` describes the type | **not a key** - four names map to two ids each. `ATM Withdrawal` is *both* a domestic £0.00 type and an international £1.50 type, so grouping by name merges two fee regimes |
| 8 | `risk_flag` classifies risk | it does not predict fraud: **High 19.9%, Low 19.0%, Medium 22.3%** |
| 9 | narrative: "over 20,000 active customers" | 20 |

### The one thing measured per transaction - and it is broken

`fee_charged_gbp` is the **only** column whose defect varies *within* a customer, so it is the
one finding not limited to n=20. **725 of 1,500 rows** deviate from `typical_fee_gbp`.

```
total charged   £750.17
total expected  £750.00
NET variance    £-0.17   (-0.023%)      <- a fee-variance report shows a clean bill
GROSS under-collection  £587.11
GROSS over-collection   £587.28
```

**The two errors cancel almost exactly.** Net variance is -0.023% while **£1,174.39** of fees -
156% of everything collected - sits on the wrong side of the rule. `Transfer - International`
collects £100.39 against £500.00 due (an 80% shortfall), while **eight** transaction types whose
`typical_fee_gbp` is **£0.00** collect £524.40 between them.

## What the file can and cannot answer - checked at G1

| The brief asks | The file answers |
|---|---|
| *"Do non-KYC customers show disproportionate Declined or fraud rates?"* | **No - the opposite, and it is not significant.** All 4 non-KYC customers have **zero** fraud flags; all 4 flagged customers are KYC-verified. Fisher exact on the 2×2, **p = 0.5377**, n = 20 |
| *"Which merchant categories attract the most fraud flags?"* | Pure composition. Every category is touched by exactly **10 of the 20 customers**, and fraud is constant per customer, so a category's fraud rate is just how many of the 4 flagged customers happen to shop there - 3 of 10 → ~30%, 1 of 10 → ~10%. There is no category effect to find |
| *"Does `risk_flag` align with actual fraud?"* | **No.** High 19.9% · Medium 22.3% · Low 19.0% |
| *"Is Gambling or Crypto driving disproportionate fraud?"* | Both are `High` risk. **Gambling 30.1%, Crypto Exchange 9.6%** - a 3× gap between two categories with the same rating, produced entirely by which customers were assigned to them |
| *"Which device type is associated with the most failed transactions?"* | Unaskable. `device_type` **is** `customer_id mod 4` |
| *"Which single transaction is the highest risk-adjusted exposure?"* | Customer 20 (Rajan Mehta, Premium, London) - Reversed, fraud-flagged, "Fraud Suspected", **£12,727-£17,273 per transaction**. His 75 rows are **£1,124,545 of the £1,186,291 total flagged exposure - 94.8%** |
| *"How has transaction value trended month-on-month?"* | Not detectably. Five monthly points, slope -£24,252/mo, **R² 0.26, p = 0.38**, and the series is dominated by one customer |
| *"Total fee revenue for H1 2026?"* | **£750.17** - against £1.90m of transaction value, i.e. **0.04%** |
| *"Are international transfer fees consistently applied?"* | **No** - and this is the real finding. See above |

## The G1 lead, and its risk

The candidate thesis: **this file reports 1,500 transactions and contains 20 facts.** Every
percentage the H1 review will quote is a fraction of twenty wearing a denominator of fifteen
hundred, with a confidence interval 8.66× wider than it looks. The constructive half is the fee
rule - the only thing actually measured per transaction, and it is wrong 725 times in a way the
net-variance report hides completely.

**The risk, named now:** this is 2026/04's shape again - a page whose findings are mostly
absences - and that month's own retro flagged that it risked reading as lazy rather than
rigorous. Two mitigations are already in hand and both must stay prominent: the **fee finding is
a genuine positive control** (transaction-level, actionable, quantified in pounds), and the
**design-effect arithmetic is itself a positive result** - "the interval is [5.7%, 43.7%]" is a
measurement, not a shrug.

**A second risk:** with n = 20 it is trivially easy to produce a confident-sounding statement
about any segment. Four non-KYC customers. Five customers per device. Three customers who ever
complete a transaction. Every cell in this dataset is thin, and G3 must state an interval or a
count of customers beside every rate rather than the rate alone.

## Submission mechanics (THIS month)

- @OnyxData · @SmartFramesUI · @DataCareerJumpstart
- **`@packt` is NOT on this month's list** - it was on 2026/05's. Checked, not carried over.
- Hashtag: `#dataDNA`
- **Single image only.**
- **No ZoomCharts mini-challenge** - absent from the page, and no read-me in the archive.
  Re-check at G8.

## Timeline

| | |
|---|---|
| Challenge begins | 01 June 2026 |
| Deadline for entries | 24 June 2026 |
| Entry review & winner selection | 25 June 2026 |
| Winners announced | 30 June 2026 |

**Closed.** Today is 2026-06-27, three days after the deadline. Portfolio work, not a live entry.

**Prizes (for the record):** 2 Packt eBooks, The Data Analytics Interview Software ($500).

## Benchmark

**Unchanged and structural, twelfth month.** No DataDNA account, so per-entry AI scores are
behind a login. Benchmarking is qualitative only and the Definition-of-Done line *"beats the
highest scorer on ≥2 dimensions"* cannot be checked or claimed.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **Check a ratio's denominator before believing the effect** (2026/05, third month running).
   Here the denominator *is* the finding: every rate's real denominator is 20, not 1,500.
2. **A null needs a positive control** (2025/09, 2026/02, 2026/04). The fee rule is it - and
   unlike the rates, its defect varies within a customer (in 8 of 20), so it partly survives
   the clustering: ICC 0.65, design effect 49.2, effective n 30.5 rather than 1,500. The FX
   rule varies within a customer too, in 12 of 20 - the fee is the most useful such column,
   not the only one.
3. **Ask what a column *is* before asking what it says** (2025/12). `device_type` is a row
   number. `transaction_status` is a customer attribute. Neither is visible to profiling.
4. **Compute the number, never type it** (2026/02). Every figure above comes from
   `analysis/integrity.py`.
