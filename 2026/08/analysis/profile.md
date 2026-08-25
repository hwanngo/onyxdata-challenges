# Data profile - 2026/08

Source: `2026/08/DataDNA-Dataset-Challenge-2026-08-African-Gig-Economy-and-Digital-Wallet-Risk/`

> The descriptive inventory began with `tools/profile.py`. Every numerical conclusion below is
> regenerated from the immutable CSVs by `analysis/integrity.py`; the source documents are audited
> separately rather than treated as ground truth. Nothing is cleaned at G2.

## Provenance

| | |
|---|---|
| Official archive | `DataDNA-Dataset-Challenge-2026-08-African-Gig-Economy-and-Digital-Wallet-Risk.zip` |
| Retrieved | 2026-09-02 |
| ZIP SHA-256 | `b5901787471aec55ac2ce9ea8bae294328bcf878c1aac8b539423fdb0228c75d` |
| Source status | Original Onyx Data archive; no substitute |
| Raw-folder policy | Immutable and gitignored; all future transforms go to `data/curated/` |

## Archive inventory

| File | Purpose | G2 status |
|---|---|---|
| `CHALLENGE_BRIEF.md` | Role, six supplied claims, guiding questions and deliverables | Read and tested |
| `EDA_REPORT.html` | Generated descriptive profile of an earlier/pre-update state | Read; stale against delivered CSVs |
| `data/dim_channel.csv` | Twelve channel records | Profiled |
| `data/dim_date_updated.csv` | Daily calendar for 2023–2024 | Profiled |
| `data/dim_market.csv` | Four country markets | Profiled |
| `data/dim_worker.csv` | Five thousand worker accounts | Profiled |
| `data/fact_transactions_Updated_.csv` | Fifty thousand wallet-event rows | Profiled |
| `docs/DATA_DICTIONARY.md` | Reduced-schema dictionary and generator parameters | Read and audited |
| `docs/SCHEMA_BLUEPRINT.json` | Reduced five-table schema | Read and audited |
| `docs/SCHEMA_CONFIG.json` | Constraints, allowed values and nine relationships | Read and audited |
| `docs/VALIDATION_REPORT.json` | Nine checks reported as passed | Read and audited |

## Delivered tables

### `dim_channel.csv`

- **12 rows × 6 columns**; no nulls or duplicate rows.
- `channel_id` is unique and complete, but values are string labels such as `val_0`, not the
  documented integer sequence.
- Five channel types: API/Third-Party (3), POS (3), Agent (3), Mobile App (2), USSD (1).
- Seven subtypes; six records are marked digital and six non-digital.
- `avg_fraud_rate` spans **156.684–857.611** despite being documented as a rate generated uniformly
  from 0.02 to 0.15. It is on neither a proportion nor percentage scale.
- All twelve channel rows are referenced by the fact table.

### `dim_date_updated.csv`

- **731 rows × 9 columns**; no duplicate rows.
- `date_id` and `full_date` are unique and complete.
- Covers **2023-01-01 through 2024-12-31**, including leap day; the dictionary and generated EDA
  report both state 730 rows.
- `date_id`, year, month name, quarter, weekday, weekend flag and month-end flag agree with the parsed
  date on **731 of 731 rows**.
- `week_number` is null on **731 of 731 rows**, despite being documented as required and derived.
- `full_date` uses unpadded M/D/YYYY text before parsing.
- Every date is referenced by the fact table.

### `dim_market.csv`

- **4 rows × 8 columns**; no nulls or duplicate rows.
- Four unique markets: Nigeria, Kenya, Ghana and South Africa, with matching ISO and currency labels.
- `market_id` is a string `val_*` key, not the documented integer sequence.
- `market_fraud_index` spans **267.522–797.512**, not the documented 0.5–2.0 index.
- The generated EDA report describes only two unique countries, three ISO codes and one currency;
  those statements do not describe this delivered file.
- All four markets are referenced by the fact table.

### `dim_worker.csv`

- **5,000 rows × 10 columns**; no nulls or duplicate rows.
- `worker_id` is unique and complete, but string-valued rather than the documented integer sequence.
- One worker (`val_2303`) has no fact row; **4,999** workers are used.
- Fifteen gig segments are present, not the four categories in the dictionary.
- Four KYC tiers include `Tier 0 (Unverified)`; four gender values include `Non-Binary`; six preferred
  channels include Web and WhatsApp Bot. These domains exceed or replace the documented sets.
- `risk_score` spans 0.002–99.956 and is statistically compatible with a uniform 0–100 draw
  (KS p = 0.221), not the unscaled beta distribution listed in the generator metadata.
- Account tenure spans 0–1,825 days; 255 used workers with 2,503 transactions are under 90 days.
- `is_active` is 48.82% true, not the documented 88% generator weight.

### `fact_transactions_Updated_.csv`

- **50,000 rows × 15 columns**; no nulls or duplicate rows.
- `transaction_id` is unique across all 50,000 rows, supporting one delivered row per transaction.
  Values are `val_*`, not UUIDs as documented.
- All four foreign keys resolve. Every channel, market and date is used; one worker dimension row is
  unused.
- Workers have **2–25 transactions** each. Fraud, dispute and reversal vary within workers; their
  worker ICCs are -0.00184, -0.00069 and -0.00286, all effectively zero. The event grain is therefore
  transaction, not a repeated worker-level seed.
- Thirteen transaction types and eight outcomes are present, versus five and four in the dictionary.
- Event rates are nearly fair coin flips:

  | Event | True rows | Rate | Exact 95% interval |
  |---|---:|---:|---:|
  | Fraud flagged | 25,145 | 50.29% | 49.85%–50.73% |
  | Disputed flag | 25,035 | 50.07% | 49.63%–50.51% |
  | Reversed flag | 24,952 | 49.90% | 49.46%–50.34% |

  The dictionary's generator weights are 7%, 5% and 8% respectively.
- All eight transaction outcomes occur at 12.22%–12.64%, consistent with equal allocation rather
  than the documented four-level 78%/10%/8%/4% mix.
- `amount_local`, `amount_usd`, `velocity_score` and `processing_time_ms` each follow the same bounded
  0–1,000 random shape. KS tests against uniform distributions on their delivered bounds return
  p = 0.704, 0.790, 0.802 and 0.669 respectively.
- `fraud_loss_usd` is the one deterministic switch: it is positive exactly when
  `is_fraud_flagged=True`, on **50,000 of 50,000 rows**. Its positive magnitude is otherwise
  independent of transaction amount.

## Referential integrity and date checks

| Check | Result |
|---|---|
| `fact.worker_id → dim_worker.worker_id` | 0 orphans; 1 unused worker |
| `fact.channel_id → dim_channel.channel_id` | 0 orphans; all 12 channels used |
| `fact.market_id → dim_market.market_id` | 0 orphans; all 4 markets used |
| `fact.date_id → dim_date.date_id` | 0 orphans; all 731 dates used |
| Transaction ID uniqueness | 50,000 of 50,000 |
| Date-derived fields | 7 checked derivations correct on 731 of 731 rows |
| Week number | 731 nulls |

The supplied star joins mechanically. That does not validate the business semantics of the fields
being joined.

## Source-document audit

The archive contains three incompatible representations of the data:

1. **The dictionary and blueprint** describe the delivered column names but give many wrong key
   types, category sets, distributions, generator weights and ranges.
2. **`SCHEMA_CONFIG.json`** lists nine relationships and 54 constraints. Five relationships refer to
   columns absent from the delivered tables (`destination_market_id`, `originating_transaction_id`,
   worker `market_id`, `preferred_channel_id`, and `recipient_worker_id`). **Zero of its 54 declared
   `column_name` values exactly match a delivered column**, because they use prefixed names such as
   `fact_transactions_transaction_id`.
3. **The generated EDA** profiles a stale/pre-update state: 730 date rows, placeholder-derived date
   fields and positive fraud loss on every fact row. The delivered updated files contain 731 valid
   dates and set loss to zero on unflagged rows.

`VALIDATION_REPORT.json` nevertheless reports **9 of 9 checks passed, zero failures and zero
warnings**. It cannot be treated as validation of the delivered archive.

## Top 5 data quality issues shaping this analysis

1. **The delivered risk-control fields have no robust predictive linkage to outcomes.** Across 20
   declared categorical axes × three event flags, **0 of 60 main-effect tests** survive Bonferroni
   (α = 0.000833); the largest Cramér's V is **0.02156**. A further **570 exploratory two-axis tests**
   also leave zero survivors at α = 0.00008772. Their smallest nominal p is 0.0032; channel type ×
   transaction type reaches p = 0.0078, V = 0.04348, but neither survives the interaction screen.
   Across six continuous risk/value fields, the largest absolute point-biserial correlation with
   fraud is **0.00632**. Daily fraud-rate variance is **0.9927×** its independent-binomial expectation.
2. **The archive's validation chain is detached from the CSVs.** Nine checks pass despite five of
   nine configured relationships requiring missing columns, none of 54 constraint names matching a
   delivered field, and the generated EDA describing a stale 730-row calendar.
3. **Local and USD amounts are unrelated.** `amount_local` vs `amount_usd` has r = **+0.00189**;
   `amount_usd` vs `amount_local / usd_fx_rate` has r = **+0.00207**. Market-level financial value
   cannot be interpreted as a currency conversion.
4. **Fraud loss is unrelated to exposure.** On flagged rows, fraud loss vs transaction amount has
   r = **-0.00453**; loss exceeds the transaction amount on **12,562 of 25,145** rows. Total recorded
   loss is **$12,559,256.91**, or **99.74%** of flagged transaction value.
5. **Outcome labels do not validate event flags.** `transaction_outcome='Reversed'` vs
   `is_reversed` has φ = **0.00414**, p = 0.355 and 50.21% agreement; the equivalent disputed pair
   has φ = **0.00265**, p = 0.554 and 49.86% agreement. Each pair is indistinguishable from chance.

---

# Conclusions

Every figure in this section is regenerated by `analysis/integrity.py` and covered by
`analysis/test_integrity.py`.

## 1. The delivered grain is usable; the measures are not

The fact table genuinely contains 50,000 unique transaction rows. Event flags vary within workers,
all foreign keys resolve, and the calendar is correct apart from its empty week number. This is not
the repeated-seed failure seen in an earlier fintech month.

The failure occurs one layer later: transaction attributes, risk markers and event outcomes are
compatible with a mostly independent bounded-random baseline, and no tested relationship remains
robust after multiplicity control. A clean star schema can therefore produce perfectly responsive
but analytically meaningless rankings. “Independent” is a baseline diagnosis, not proof that every
possible interaction is exactly zero.

## 2. None of the six supplied findings is confirmed

| Supplied claim | Delivered result | Verdict |
|---|---|---|
| USSD fraud is 2.3× app fraud | 51.19% vs 50.33%; **1.017×**; difference +0.86pp, 95% CI [-0.98pp, +2.71pp], p = 0.358 | Rejected |
| Nigeria + Kenya drive 70% of fraud volume | 49.82% of flagged rows; 50.03% of loss; 49.84% of flagged value | Rejected under all three defensible denominators |
| Accounts under 90 days have 3× fraud | 51.06% vs 50.25%; **1.016×**; difference +0.81pp, 95% CI [-1.20pp, +2.82pp], p = 0.430 | Rejected |
| Market traders have the highest dispute rate | **10th of 15**; -0.67pp vs all other segments, 95% CI [-2.53pp, +1.19pp], p = 0.481 | Rejected |
| Velocity correlates with fraud and reversal | r = -0.00074, p = 0.868; r = +0.00267, p = 0.551 | Rejected |
| Month end spikes cash-out and reversal | Cash-out share: +0.66pp, 95% CI [-0.73pp, +2.05pp], p = 0.352. Overall reversal: +1.90pp, 95% CI [-0.61pp, +4.41pp], p = 0.137. **Within Cash-Out**, reversal is 59.09% at month end (n=132) vs 50.82% otherwise (n=3,739): +8.28pp, 95% CI [-0.26pp, +16.81pp], p = 0.058. | Not confirmed; Cash-Out reversal is the strongest open lead |

**Confirmed as stated: 0 of 6.** The first five claims are excluded at anything near their supplied
magnitude. The sixth has a materially sized but underpowered Cash-Out-specific lead whose interval
still includes no difference; it must remain open rather than be promoted or discarded.

## 3. The random structure is affirmative evidence

This is not “nothing was significant” after an unfocused search:

- the axes were declared from the page and archive before testing;
- all 60 prespecified main-effect tests were corrected together;
- 570 exploratory two-axis tests were screened separately, and none survives its own Bonferroni
  threshold; nominal interactions are retained as follow-up leads rather than called findings;
- main-effect sizes are uniformly negligible, not merely non-significant;
- daily fraud variation matches the binomial variance expected from independent coin flips;
- five continuous fields independently match uniform bounded draws;
- the `fraud_loss > 0` switch perfectly recovers the fraud flag, providing a positive control that
  proves the analysis can detect a relationship when one exists.

The candidate G3 lead is therefore positive and structural: **the delivered archive encodes
risk-control fields without robust predictive linkage to transaction outcomes.** This diagnoses the
synthetic file, not a real operating platform. Month-end Cash-Out reversal remains an explicit
confirmation target.

## 4. Financial analysis is not supportable

The archive labels both local and USD amount, supplies an FX rate, and asks for fraud-loss and
financial-performance analysis. Those measures do not reconcile. USD is not derived from local
amount and FX; loss severity is unrelated to the transaction value it supposedly affects and can
exceed it row by row.

Counts and rates can be described as properties of this synthetic file. Currency-converted value,
loss severity, market exposure and revenue-impact recommendations cannot be presented as coherent
business quantities.

## 5. What remains trustworthy enough for G3

Usable as delivered:

- row counts, unique transaction IDs and foreign-key membership;
- calendar dates and their derived labels except `week_number`;
- categorical labels as file contents, while explicitly rejecting the dictionary domains;
- event-flag counts and rates as synthetic-file measurements;
- the deterministic fraud-flag/loss-presence relationship.

Not defensible as real operational evidence:

- source-supplied risk rankings or any headline claim as a confirmed fact;
- market, channel, worker or temporal “hotspots” built from uncorrected or sparse-cell differences;
- `avg_fraud_rate`, `market_fraud_index`, `risk_score` or `velocity_score` as predictive controls;
- currency-converted value or fraud-loss severity;
- outcome labels as confirmation of dispute or reversal flags;
- causal or resource-allocation recommendations aimed at any country, channel or worker segment.

G3 should convert this into an evidence ledger and a constructive measurement specification: what a
real wallet-risk system would need to collect, reconcile and validate before controls can be
prioritised.
