# Assumptions - 2026/08

Every judgement call that could change a result. Anything retained into the dashboard must also
appear as a visible note or footnote there.

## Data provenance

| | |
|---|---|
| Source URL | https://datadna.onyxdata.co.uk/wp-content/uploads/2026/07/DataDNA-Dataset-Challenge-2026-08-African-Gig-Economy-and-Digital-Wallet-Risk.zip |
| Retrieved | 2026-09-02 |
| Onyx's file, or a substitute? | Original Onyx Data archive; no substitute |
| Expected / actual fact rows | 50,000 / 50,000 |
| Expected / actual dimension rows | channel 12/12; date 730/731; market 4/4; worker 5,000/5,000 |
| ZIP SHA-256 | `b5901787471aec55ac2ce9ea8bae294328bcf878c1aac8b539423fdb0228c75d` |

The raw folder is immutable and gitignored. G2 reads it directly; G4 transformations will write only
to `data/curated/`.

## Business semantics

| Term | Definition used | Why | Alternative reading rejected |
|---|---|---|---|
| Transaction | One row of `fact_transactions_Updated_.csv` | `transaction_id` is unique on all 50,000 rows; event flags vary within workers; all FKs resolve | Treating the worker as the grain because worker attributes repeat. The event ICCs are effectively zero, so the repeated attributes do not collapse transaction outcomes to worker seeds. |
| Fraud rate | `is_fraud_flagged=True` rows divided by all rows in scope | The field is the only explicit fraud indicator | `transaction_outcome='Disputed'` or fraud loss as the numerator. Outcome labels show no measurable association with flags; loss presence is exactly derived from the flag. |
| Fraud volume | Report three readings separately: flagged-row count, summed `fraud_loss_usd`, and summed `amount_usd` on flagged rows | The supplied “Nigeria and Kenya drive 70% of fraud volume” claim does not define volume | Choosing whichever denominator comes closest to 70%. All three are tested and all are near 50%. |
| App channel | `dim_channel.channel_type='Mobile App'` | This is the transaction's joined channel type and is the closest delivered equivalent to the supplied “app channel” wording | Worker `preferred_channel` labels such as Mobile App (iOS/Android), which describe an account preference rather than the transaction channel. |
| USSD channel | `dim_channel.channel_type='USSD'` | Exact delivered transaction-channel category | USSD Agent Assisted subtype or worker preferred channel. These answer narrower or different questions. |
| New account | Joined worker has `account_tenure_days < 90` | Matches the supplied threshold exactly | `<=90`, a tenure band, or deriving age from transaction date. No account-open date exists. |
| Market trader | `gig_segment='Market Trader'` | Exact delivered segment label | Treating Informal Vendor as a synonym. The archive names market traders explicitly and both labels exist separately. |
| Month end | `dim_date.is_month_end=True` | The delivered calendar flag agrees with the parsed date on all 731 rows | Last seven days, pay cycle or final business day. None is named by the source claim. |
| Cash-out | `transaction_type='Cash-Out'` | Exact delivered category | Agent Withdrawal or every outward transfer. Those are separate source categories. |
| Reversal | `is_reversed=True` for the supplied rate claim | The claim says reversal rate and the archive exposes a dedicated Boolean | `transaction_outcome='Reversed'`. It shows no measurable association with the flag and cannot validate it. |
| Month-end Cash-Out reversal | Reversal rate among `transaction_type='Cash-Out'`, compared between month-end and all other dates | The claim's wording permits both separate cash-out/reversal rates and their intersection; all three readings are tested | Reporting only overall reversal or only Cash-Out share. That misses the strongest delivered lead: +8.28pp within Cash-Out, p = 0.058. |
| Dispute | `is_disputed=True` for dispute-rate comparisons | Dedicated source Boolean | `transaction_outcome='Disputed'`, which agrees with the flag only at chance level. |
| Fraud loss | Source `fraud_loss_usd`, but only as a documented defect and presence switch | It is positive exactly when fraud is flagged | Treating its magnitude as economic loss. It is independent of transaction amount and exceeds the amount on 12,562 flagged rows. |
| USD amount | Source `amount_usd`, but not a converted value | It is a delivered field and can be totaled as file content | Treating it as `amount_local / usd_fx_rate`. The correlation with that conversion is +0.00207. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---:|---|
| Rows dropped at G2 | 0 of 50,000 fact rows; 0 dimension rows | G2 profiles and tests the immutable source. No cleaning or filtering occurs. |
| Unused worker retained in the source inventory | 1 of 5,000 worker rows (`val_2303`) | It is a valid dimension row with no fact exposure, not an orphaned fact. It will not appear in fact-derived measures. |
| Source `week_number` quarantined; derived `iso_week` added | 731 of 731 source values are null; 731 derived values are complete | G4 preserves the empty source as `source_week_number` and computes a separately named ISO week from the validated date. The source field is never silently overwritten. |
| Archive JSON excluded from business tables | 3 documentation JSON files | They describe schema/configuration and validation, not transaction observations. They are audited as source evidence rather than joined into the model. |
| Generated EDA excluded as metric input | Entire `EDA_REPORT.html` | It describes a stale/pre-update state and disagrees with the delivered date and fact files. |
| No replacement for merchants or fee revenue | All rows | The challenge page requests both, but the delivered schema contains neither. Inventing proxies would create unsupported measures. |

## Statistical choices

| Choice | Value | Why it could be disputed |
|---|---|---|
| Confidence level | 95% | A different interval level changes the displayed bounds but not any claim verdict. |
| Two-rate interval | Unpooled normal interval for the difference; exact binomial interval for single rates | A cluster bootstrap is possible. Worker ICCs are -0.00184 to -0.00069, so worker clustering does not inflate uncertainty here. |
| Supplied-claim threshold | Test the claim's exact magnitude/category, plus a two-sided p-value where applicable | A weaker directional effect can still be operationally interesting. Month-end Cash-Out reversal is therefore retained as an open lead even though p = 0.058 and its interval crosses zero. |
| Declared categorical screen | 20 axes × 3 event flags = 60 main-effect tests | The page and archive name these axes before results are inspected, preventing a post-hoc search. |
| Exploratory interaction screen | Every pair among 20 axes × 3 event flags = 570 tests | It searches for missed nonlinear/cross-dimensional structure, but those combinations were not prespecified and require their own correction. |
| Multiple-comparison correction | Main effects: Bonferroni α = 0.05/60 = 0.000833. Interactions: α = 0.05/570 = 0.00008772 | Bonferroni is conservative. Nominal interaction p-values are retained as follow-up leads, never promoted as findings when they fail the screen. |
| Categorical effect size | Cramér's V | With 50,000 rows, p-values alone would elevate trivial differences. |
| Continuous event association | Point-biserial correlation | It tests linear separation only. The accompanying bounded-uniform and band checks are needed before ruling out nonlinear structure. |
| Uniformity tests | KS against fixed delivered bounds: 0–1,000 or 0–100 | Estimating bounds from the sample would bias the test toward uniformity; the fixed generator-like bounds are declared before testing. |
| Positive control | `(fraud_loss_usd > 0) == is_fraud_flagged` | The loss magnitude is invalid, but its presence switch proves the analysis detects the one deterministic relationship encoded in the file. |
| “Random baseline” criterion | No corrected main-effect or interaction survivors, negligible marginal effect sizes, uniform bounded numeric fields, and daily variance matching binomial expectation | This supports “no robust predictive linkage detected,” not the stronger claim that every possible dependence is mathematically zero. |

## Known limitations

- The source is synthetic and carries no real fraud-investigation outcomes, confirmed losses,
  chargeback timestamps, control interventions or false-positive labels.
- No account-open date is present, so tenure cannot be validated against transaction date.
- There is no transaction timestamp, only a date key; intraday velocity semantics cannot be checked.
- `velocity_score` is described as transactions per hour but spans 0–1,000 and cannot be recomputed.
- No merchant, fee, corridor, recipient, originating transaction, region, device or session fields are
  delivered despite appearing in the page or configuration metadata.
- `amount_local`, `amount_usd` and `usd_fx_rate` do not reconcile; cross-market financial comparisons
  are not economically interpretable.
- `fraud_loss_usd` can exceed transaction amount and is independent of it; severity and loss-rate
  recommendations are unsupported.
- Outcome labels and dedicated dispute/reversal flags are indistinguishable from chance association.
  The archive provides no event chronology to decide which should supersede the other.
- Month-end Cash-Out reversal is based on only 132 month-end rows. Its +8.28pp difference is a
  confirmation target, not a finding; the 95% interval runs from -0.26pp to +16.81pp.
- Exploratory interactions produce nominal p-values and large-looking sparse-cell spreads by chance.
  None survives the 570-test correction, so no interaction is actionable in this file.
- The generated validation report cannot establish source quality because it passes constraints and
  relationships that do not target the delivered columns.
- All G2 findings describe this delivered synthetic file. They must not be generalized to African
  gig workers, countries, channels or real digital-wallet platforms.
