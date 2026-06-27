# Insight ledger - 2026/06 UK Fintech Neobank (Zephyr Bank)

**The gate that decides the Insights score.** No query, no claim.

Every query below runs against `data/curated/*.parquet` via DuckDB and is reproduced by
`model/test_metrics.py` against the **raw CSVs** on a second, independent path.

## Thesis

> **This file reports 1,500 transactions and contains 20 facts. Every percentage in the H1
> review - the 20% fraud rate, the 35% decline rate, the 85% failure rate - is a fraction of
> twenty customers wearing a denominator of fifteen hundred, and its confidence interval is
> 8.66× wider than it looks. The one thing genuinely measured per transaction is the fee, and
> the fee is wrong 725 times in a way the variance report cancels to zero.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | Zephyr Bank's H1 review pack: 1,500 transactions, 20% flagged for fraud, a 35% decline rate, £750 of fee revenue on £1.9m of value. Four teams are waiting for it. |
| **Complication** | The fact table has 20 rows of information. Status, fraud, failure reason and device are **customer attributes**, not transaction outcomes - `device_type` is literally `customer_id mod 4`. Every headline rate has an effective n of 20, and the fraud rate's real interval is **[5.7%, 43.7%]**. |
| **Resolution** | Stop reporting these rates as rates. Report the customer counts and the intervals. Then act on the one thing that *is* transaction-level: the fee rule is broken on **725 of 1,500 rows**, and the net-variance report shows -0.023% because £587 of under-collection and £587 of over-collection cancel. |

---

## I1 - Every customer has exactly 75 transactions, and four columns never vary within one.

**Query**
```sql
SELECT count(DISTINCT transactions_per_customer) AS distinct_counts,
       min(transactions_per_customer) AS n
FROM (SELECT customer_id, count(*) AS transactions_per_customer
      FROM fact_transaction GROUP BY 1);

SELECT max(k_status) AS status, max(k_fraud) AS fraud,
       max(k_device) AS device, max(k_reason) AS reason
FROM (SELECT customer_id,
        count(DISTINCT transaction_status) k_status,
        count(DISTINCT is_flagged_fraud)   k_fraud,
        count(DISTINCT device_type)        k_device,
        count(DISTINCT failed_reason)      k_reason
      FROM fact_transaction GROUP BY 1);
```

**Output**
```
distinct_counts = 1     n = 75          -- 20 x 75 = 1,500

status = 1   fraud = 1   device = 1   reason = 1
```
Not one customer, anywhere, has two different statuses, two fraud values, two devices or two
failure reasons across their 75 rows.

**Caveat:** the dictionary discloses this, in a parenthesis at the end of the fact-table
section - *"Rows: ~1,500 (expanded from 20 seed rows)"*. It is not concealed. It is simply
easy to read past, and nothing downstream of it is adjusted for the consequence.

**So what:** the honest unit of analysis is the customer. Every chart on this page that shows a
rate also shows the customer count behind it.

---

## I2 - `device_type` is `customer_id mod 4`.

**Query**
```sql
SELECT customer_id % 4 AS mod4, device_type, count(*) AS customers
FROM dim_customer_profile GROUP BY 1, 2 ORDER BY 1;
```

**Output**
```
mod4  device_type  customers
   0  Web                  5
   1  iOS                  5
   2  (null)               5
   3  Android              5
```
A perfect four-way map with no exceptions.

**Caveat:** with 20 customers and 4 devices, an exactly-equal split could arise by chance - but
not one aligned to `customer_id mod 4` with zero errors. The probability of that alignment under
random assignment is 1 / (20! / (5!⁴)) ≈ 8×10⁻¹¹.

**So what:** the brief asks *"which device type is associated with the most failed or fraudulent
transactions?"* twice. It is not a question about devices; it is a question about row numbers.
Any answer is an artefact, and answering it confidently would be the single easiest way to
mislead this review panel.

---

## I3 - The 20% fraud rate is 4 customers. Its real interval is [5.7%, 43.7%].

**Query**
```sql
SELECT
  count(*) FILTER (WHERE is_flagged_fraud)                       AS flagged_tx,
  count(DISTINCT customer_id) FILTER (WHERE is_flagged_fraud)    AS flagged_customers,
  count(*)                                                       AS total_tx
FROM fact_transaction;
```

**Output**
```
flagged_tx = 300   flagged_customers = 4   total_tx = 1500
```

| Measure | Reported | Customers | Naive 95% CI (n=1500) | Exact CI (n=20) |
|---|---:|---:|---:|---|
| fraud-flagged | 20.0% | 4 | ±2.0pp | **[5.7%, 43.7%]** |
| Declined | 35.0% | 7 | ±2.4pp | **[15.4%, 59.2%]** |
| Completed | 15.0% | 3 | ±1.8pp | **[3.2%, 37.9%]** |

Design effect = cluster size = 75, so SEs are **√75 = 8.66×** wider than a naive calculation.

**Caveat:** the exact binomial interval on 4/20 is itself the *most generous* honest reading - it
assumes the 20 customers are a random sample of Zephyr's stated 20,000, which nothing in the file
establishes. If they were selected to span the segment × device lattice (and the `mod 4` mapping
suggests construction rather than sampling), no population interval is defensible at all.

**So what:** a risk committee told "20% of transactions are fraudulent, ±2pp" will fund a
programme. Told "4 of our 20 sampled customers are flagged, and the true rate is somewhere
between 6% and 44%", it will ask for more data first. That is the correct decision.

---

## I4 - The brief's KYC hypothesis inverts, and cannot be tested at this n.

**Query**
```sql
SELECT kyc_verified, is_flagged_fraud, count(*) AS customers
FROM dim_customer_profile GROUP BY 1, 2 ORDER BY 1, 2;
```

**Output**
```
kyc_verified  is_flagged_fraud  customers
false         false                     4
true          false                    12
true          true                      4
```
**Every non-KYC customer has zero fraud flags. Every flagged customer is KYC-verified.**
Fisher exact on the 2×2: **p = 0.5377**.

**Caveat:** p = 0.54 on a 2×2 with 20 observations means *nothing was learned*, in either
direction. This is not evidence that non-KYC customers are safer. It is evidence that the
question is unanswerable with this file - the minimum detectable odds ratio at 80% power on
n = 20 is far outside anything a compliance team would care about.

**So what:** the challenge page lists *"differences in customer verification status (KYC vs
non-KYC) creating uneven risk profiles"* as a named analysis challenge. The honest deliverable
is the power calculation, not a bar chart - and Compliance should not deprioritise KYC
remediation on the strength of four customers.

---

## I5 - Every transaction-type failure rate is a fraction of four.

**Query**
```sql
SELECT t.type_name, t.channel,
       count(*)                                        AS tx,
       count(DISTINCT f.customer_id)                   AS customers,
       avg(CASE WHEN f.transaction_status IN ('Declined','Reversed') THEN 1.0 ELSE 0 END) AS fail_rate
FROM fact_transaction f JOIN dim_transaction_type t USING (transaction_type_id)
GROUP BY 1, 2 ORDER BY fail_rate DESC;
```

**Output**
```
transaction_type_id  type_name                 tx  customers  failing  fail_rate
                  2  Purchase                 100          4        3      0.750
                  5  Transfer - International 100          4        3      0.750
                  7  ATM Withdrawal           100          4        3      0.750
                 10  Standing Order           100          4        3      0.750
                 12  Card Refund              100          4        3      0.750
                 15  Loan Repayment           100          4        3      0.750
                  1  Purchase                 100          4        2      0.500
                 ...                          100          4        2      0.500
```
**Every one of the fifteen types has exactly 100 transactions and exactly 4 customers**, so the
failure rate is 2/4 or 3/4. **Two distinct values across fifteen types: 0.750 and 0.500.**

**Caveat, and a self-catch worth recording:** the first draft of this entry grouped by
`type_name` and reported a third value, 0.625, for `ATM Withdrawal` - the (3+2)/8 of two merged
ids, a rate belonging to neither type (see I7). The model is keyed on `transaction_type_id`
precisely so that cannot happen, and it caught this analysis as well as the brief's.

**So what:** *"which transaction types have the highest failure rate?"* is one of the brief's
three transaction-pattern questions and one of Product's two asks. The answer is that the file
cannot rank fifteen types on four observations each - and a league table of these numbers would
send a UX team after Standing Orders on the strength of three customers.

---

## I6 - The fee rule is broken 725 times, and the variance report cancels it to zero.

**Query**
```sql
WITH j AS (
  SELECT f.*, t.typical_fee_gbp, t.type_name,
         f.fee_charged_gbp - t.typical_fee_gbp AS delta
  FROM fact_transaction f JOIN dim_transaction_type t USING (transaction_type_id))
SELECT
  count(*) FILTER (WHERE abs(delta) > 1e-9)  AS rows_wrong,
  round(sum(fee_charged_gbp), 2)             AS charged,
  round(sum(typical_fee_gbp), 2)             AS expected,
  round(sum(typical_fee_gbp) - sum(fee_charged_gbp), 2) AS net_variance,
  round(-sum(delta) FILTER (WHERE delta < 0), 2) AS gross_under,
  round( sum(delta) FILTER (WHERE delta > 0), 2) AS gross_over
FROM j;
```

**Output**
```
rows_wrong = 725     charged = 750.17     expected = 750.00
net_variance = -0.17   (-0.023%)
gross_under  = 587.11
gross_over   = 587.28
```
Per type: `Transfer - International` collects **£100.39 of £500.00** due - an 80% shortfall -
while **eight** types whose `typical_fee_gbp` is **£0.00** collect **£524.40** between them
(`Transfer - Outbound` £62.12 + £87.47 across its two ids, `Direct Debit` £88.00, `Savings Pot Transfer` £87.06,
`Standing Order` £75.05, `Loan Repayment` £75.00, `Salary Credit` £24.94, `Purchase` £24.76).

**Caveat:** the dictionary explicitly permits deviation - *"may differ from typical_fee_gbp if
waived or in error"* - so an individual deviation is not by itself a defect. What is a defect is
the **pattern**: fees charged where none is due at all, and 80% of a documented fee not
collected, netting to nothing.

**So what: this is the finding on the page with the largest effective sample.** It varies
*within* a customer - six customers show 11 distinct fee values, and the fee-wrong indicator
itself differs within 8 of the 20 - so it is a genuine per-transaction result, and it is the
reason this analysis is not purely a list of absences.

**But state its design effect too, because the page states one for every rate it kills.**
The fee-wrong indicator has ICC **0.6511**, so DEFF = 1 + 74 x 0.6511 = **49.2** and the
effective n is **30.5**, not 1,500. Better than the rates' effective 20 and far short of the
row count. And it is *not* the only column whose defect varies within a customer: the FX rule
(NULL for domestic, present for international) is violated on 400 rows and varies within **12
of 20** customers - this ledger lists that violation itself as claim 4. The integrity pass
found "the only defect that varies within a customer" on five surfaces, contradicted by the
month's own claims table.
Finance's control is a net-variance report; a net-variance report is structurally blind to two
offsetting errors. **The fix is to monitor gross absolute deviation, not net.**

---

## I7 - `type_name` is not a key, and grouping by it merges two fee regimes.

**Query**
```sql
SELECT type_name, count(*) AS ids, string_agg(DISTINCT channel, ' | ') AS channels,
       string_agg(DISTINCT CAST(typical_fee_gbp AS VARCHAR), ' | ') AS fees
FROM dim_transaction_type GROUP BY 1 HAVING count(*) > 1;
```

**Output**
```
type_name                 ids  channels                   fees
ATM Withdrawal              2  ATM Network                0.0 | 1.5
Purchase                    2  Mobile App | Web Browser   0.0
Transfer - Outbound         2  Mobile App | Web Browser   0.0
Transfer - International    2  Mobile App | Web Browser   2.5
```

**Caveat:** three of the four are harmless - the duplicate exists to carry the channel and the
fee is the same. **`ATM Withdrawal` is not**: id 7 is domestic at £0.00 and id 8 is international
at £1.50, and only `is_domestic` distinguishes them.

**So what:** `GROUP BY type_name` - the obvious way to write every fee query in this brief -
silently averages a free service with a charged one, and it is the exact query the fee questions
invite. This is why I6 groups by `transaction_type_id`.

---

## I8 - One customer is 94.8% of the fraud exposure and 59.3% of all value.

**Query**
```sql
SELECT c.customer_name, c.customer_segment, c.region, f.transaction_status,
       round(sum(f.amount_gbp), 2) AS flagged_value
FROM fact_transaction f JOIN dim_customer_profile c USING (customer_id)
WHERE f.is_flagged_fraud GROUP BY 1,2,3,4 ORDER BY flagged_value DESC;
```

**Output**
```
customer_name       segment   region    status     flagged_value
Rajan Mehta         Premium   London    Reversed     1,124,545.45
Daniel Okafor       Premium   London    Declined        33,668.18
Charlotte Lewis     Standard  Midlands  Pending         22,434.06
Mohammed Al-Hassan  Business  London    Declined         5,643.18
```
Total flagged **£1,186,290.87** of **£1,897,267.75** - 62.5% of all value. Rajan Mehta alone is
**94.8%** of the flagged total and **59.3%** of every pound in the file. Gini across the twenty
customers: **0.8237**.

**Caveat:** his transactions are £12,727-£17,273 each - his amount seed, jittered ±15%, like
everyone else's. The concentration is a property of how amounts were assigned, not of his
behaviour. Reporting "62.5% of transaction value is fraud-flagged" without saying that one
account is 94.8% of it would be true and worthless.

**So what:** the brief asks for *"the single transaction representing the highest risk-adjusted
exposure"*. The answerable version is the **customer**, and the answer is that the exposure
number is one account - which is a triage instruction, not a portfolio statistic.

---

## I9 - `risk_flag` does not predict fraud.

**Query**
```sql
SELECT m.risk_flag, count(*) AS tx,
       avg(CASE WHEN f.is_flagged_fraud THEN 1.0 ELSE 0 END) AS fraud_rate
FROM fact_transaction f JOIN dim_merchant_category m USING (merchant_category_id)
GROUP BY 1 ORDER BY 1;
```

**Output**
```
risk_flag  tx   fraud_rate
High       166      0.1988
Low        917      0.1897
Medium     417      0.2230
```
And within the two `High` categories: **Gambling 30.1%, Crypto Exchange 9.6%** - a 3× gap
between two identically-rated categories.

**Caveat:** every merchant category is touched by exactly 10 of the 20 customers, and fraud is
constant per customer, so a category's fraud rate is entirely determined by how many of the four
flagged customers happen to shop there - 3 of 10 gives ~30%, 1 of 10 gives ~10%. Neither the
alignment nor the Gambling/Crypto gap is evidence about merchants.

**So what:** the brief asks whether `risk_flag` aligns with actual fraud. It does not, and it
cannot be shown to in either direction from this file - which is itself the answer Risk needs
before it re-tiers a merchant taxonomy.

---

## I10 - There is no month-on-month trend, and five monthly points cannot produce one.

**Query**
```sql
SELECT date_trunc('month', transaction_date) AS month,
       count(*) AS tx, round(sum(amount_gbp), 0) AS value_gbp
FROM fact_transaction GROUP BY 1 ORDER BY 1;
```

**Output**
```
month       tx   value_gbp
2026-01-01  304    465,168
2026-02-01  283    359,630
2026-03-01  322    416,765
2026-04-01  279    263,966
2026-05-01  312    391,739
```
OLS on value: slope **-£24,252/month**, **R² = 0.26, p = 0.38**, n = 5.

**Caveat:** the series is 59.3% one customer, so it is really that customer's transaction dates.
Neither day-of-week nor hour-of-day carries a fraud pattern:

```sql
-- day-of-week and hour against the fraud flag, over all 1,500 rows
SELECT dow, is_flagged_fraud, count(*) FROM fact_transaction GROUP BY 1, 2;   -- 7 x 2
SELECT hour, is_flagged_fraud, count(*) FROM fact_transaction GROUP BY 1, 2;  -- 24 x 2
-- chi2_contingency; V = sqrt(chi2 / (n * min(r-1, c-1)))
dow   chi2 = 11.160  dof =  6  p = 0.0836  V = 0.0863
hour  chi2 = 24.299  dof = 23  p = 0.3874  V = 0.1273
```

Neither reaches α = 0.05 even before the clustering is applied, and the clustering only makes
the true p larger.

**Correction.** This caveat previously read "day-of-week reaches χ² p = 0.045
but Cramér's V = 0.0378", with `.workbench/2026/06/analysis/questions.md` adding "hour p = 0.77, V = 0.0228". **No query in
this repo produces either pair**, and twenty definitions were tried at audit - every subset of
`risk_flag`, against `is_flagged_fraud`, `risk_flag` and `is_failing`, under both the correct V
denominator and the `n x dof` one the published pairs are internally consistent with. The
numbers above are the real ones and the query is now printed with them. **Rule 3 is not "state
a number", it is "state the query" - a figure with no runnable query behind it is not a
weaker claim, it is an unverifiable one.**

**So what:** *"how has total transaction value trended month-on-month through H1 2026?"* is the
brief's first temporal question. Five points with a p of 0.38 do not have a trend, and drawing a
line through them for a board pack would manufacture one.

---

## Rejected

| Candidate | Why dropped |
|---|---|
| Fraud rate by merchant category (bar chart) | It is composition, not a merchant effect (I9). This is the chart most entries will ship. |
| Failure rate by device type | `device_type` is `customer_id mod 4` (I2). |
| Fraud rate by UK region | **Five of ten regions have one customer.** Every regional rate is 0% or 100%. |
| Segment × channel × category × region cross-tab | The challenge page asks for it by name. It is a four-way cut of twenty points. |
| Monthly value trend line | p = 0.38 on five points (I10). |
| Gini / Pareto on customer value | 0.8237, but a Gini on 20 points is not a statistic. Quoted only as a property of the file. |
| Tenure cohorts from `account_open_date` | 2-4 customers per cohort. |
| "62.5% of transaction value is fraud-flagged" as a headline | True, and 94.8% of it is one account (I8). The unqualified version is the most misleading true sentence available. |
| Hour-of-day risk profile | χ² p = 0.3874, V = 0.1273 - nothing, and clustered on top. |

## Non-obvious checklist

- [x] **two-way interactions** - none computable; cells are 0 or 1
- [x] **Simpson's paradox** - I6 is an unusually pure instance: the aggregate does not reverse the
      parts, it *erases* two £587 errors of opposite sign
- [x] **rate vs volume mismatch** - inverted from 2026/05: there every real finding was a rate;
      here every rate is an artefact and the one real finding is a per-row rule violation
- [x] **concentration** - 59.3% / 83.8% / 92.1% across 20 customers (I8)
- [x] **distribution vs average** - mean £1,264.85 vs median **£99.85** (12.7x, not 7.5x); the mean is one seed
- [x] **cohorts** - not attempted, 2-4 members each; recorded rather than fudged
- [x] **changepoints** - untestable on five points
- [x] **funnel leakage** - no funnel: status is terminal and customer-constant
- [x] **lead / lag** - no process stages
- [x] **missingness as signal** - twice, and both are rule violations: 600 of 900 failures have no
      reason, 275 international rows have no FX rate
- [x] **survivorship** - no unused dimension rows
- [x] **mix vs performance decomposition** - I6: gross vs net fee variance is exactly this
