# Assumptions - 2026/10 Sunrise Coffee Chain

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number also appears as a footnote in the dashboard's methods drawer.

## Data provenance

| | |
|---|---|
| Source URL | https://datadna.onyxdata.co.uk/wp-content/uploads/2026/09/DataDNA-Dataset-Challenge-2026-10-Sunrise-Coffee-Chain.zip |
| Retrieved | 2026-11-01, via `just fetch 2026 10` |
| Onyx's file, or a substitute? | Onyx's file. No substitution. |
| Expected rows / actual rows | Dictionary: 730 / 60 / 40 / 10,000 / 1,440. Delivered: 730 / 60 / 40 / 10,000 / 1,440 (counts match; grains do not - see `analysis/profile.md` C02) |
| sha256 | `b54effee60022f7b3d9734b52a9a526bc8db3337763178fd478a88673a1498aa` |

## Business semantics

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| Spec | `CHALLENGE_BRIEF.md` inside the ZIP | It matches the delivered tables; the page's 12 bullets describe food delivery (carried over from 2026/09) | Treat the page bullets as requirements - impossible: none of their fields exist |
| Net profit, margin | `net_profit_gbp`, and Σ net profit / Σ revenue for any group (pooled) | The P&L identity closes on every row (C09); pooling weights months by revenue, which a CFO would | Mean of row margins (`net_profit_margin_pct`): High-Street 14.34% vs pooled 18.59% because a few low-revenue months carry margins down to −339%. Shown only where the brief names the column (Q1) |
| Fixed cost | Monthly `monthly_rent_gbp + monthly_staffing_cost_gbp` from the P&L fact | It is what the P&L identity closes on | `dim_store` contract values - they differ on 1,440 of 1,440 rows (C07/C08) and would not reconcile to net profit |
| Profitability status | **Re-derived** from `net_profit_margin_pct` with the dictionary's bands (>20%, 8-20%, −2-8%, −15-−2%, <−15%; upper bound of each band inclusive of nothing below it) | The supplied label disagrees with its own definition on 600 rows (C11) | Trust the supplied label. Kept as `source_status` and shown in the audit panel only |
| Rent band | Re-derived from monthly rent with the documented thresholds; a store-month attribute | The supplied band disagrees on 119 rows (C12); 23 stores change band across months | Store-level band from `dim_store` rent |
| Format | `store_format` as supplied, always shown with n | The brief asks for it | Infer format from store name - 11 High-Street stores are named "Station" or "Hub"; not done, because it would be my label, not the business's |
| Loyalty value | Detectable revenue lift per store from adoption (store-level regression), compared with redemption cost ÷ gross margin | Member revenue is not incremental revenue; redemption is a cash cost | "Member spend − redemption cost" (the brief's Q7 wording) - reported, but labelled as attribution, not value |
| Seasonal pattern | Month-of-year differences in the monthly P&L | Brief Q14 | Day-of-week pattern - which is the one that exists, reported separately (I4) |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| No row dropped from any table | 0 of 12,270 | Every row passes its own arithmetic (C09, C10, C14-C17). Asserted in `model/build.py` (row counts in = out) |
| Daily fact kept as a **sample**, never summed into money totals or joined to the P&L | 10,000 of 10,000 rows | Does not reconcile to the monthly fact (store-month r = 0.0307, C23); covers 20.3% of store-days |
| Daily store-days with several rows kept as separate observations | 2,096 rows on 1,006 store-days | Their revenues differ, so they are not duplicates; nothing says which is "the" day. Every daily statistic is a per-row mean |
| `profitability_status` replaced by derived status; original kept as `source_status` | 600 of 1,440 rows change | C11 |
| `rent_band` replaced by derived band; original kept as `source_rent_band` | 119 of 1,440 rows change | C12 |
| `month_id` added to the date dimension | 730 rows | Documented but absent (C04) |
| Undocumented daily `avg_dwell_time_minutes` carried, not used | 10,000 rows | No definition; not needed |

## Statistical choices

| Choice | Value | Why it could be disputed |
|---|---|---|
| Unit of analysis for store questions | store (n = 60), averaging its 24 months | Row-level tests on 1,440 rows would overstate certainty: months within a store are not independent draws of the store |
| Variance share | η² (between-group SS / total SS), compared with the null expectation (k−1)/(n−1) | With 60 groups, η² is biased upward; the null benchmark (0.041) is shown next to it so the reader sees the bias |
| Format gap test | permutation test of mean store margin, 20,000 draws, seed 20261001 | With n = 2, any test is weak; reported to show the gap is not distinguishable, not to prove it absent |
| Loyalty lift interval | OLS slope of store revenue on adoption, ±1.96 SE | Cross-sectional and observational; a confounder could hide a lift. The decision uses the **upper** bound, which is the reading most favourable to the programme |
| Break-even revenue | redemption per store-month ÷ estate gross margin (62.1%) | Treats redemption as the only loyalty cost (app, marketing are unknown), which again favours the programme |
| Weekend surplus hours | weekend revenue ÷ weekday revenue-per-hour, vs weekend hours | Assumes weekday productivity is achievable at weekends; no wage rate is linkable, so no £ figure is claimed |
| Noise band for 2023→2024 change | mean within-store monthly SD × √24 | Assumes months are independent within store; the observed SD matching it is consistent with, not proof of, pure noise |

## Known limitations

- **No demand data that discriminates stores.** Expansion is screened on cost because revenue in this
  release carries no store signal. A real site programme needs catchment, footfall counter and
  transaction-level data.
- **No line-item sales.** Category growth and category margin contribution cannot be measured; only the
  price list's margins exist.
- **No loyalty counterfactual.** A holdout (redemptions switched off in matched stores) is required to
  measure incremental spend.
- **No wage rate linkable to daily hours.** The staffing finding is in hours and revenue per hour, not £.
- The release behaves like a generator that draws revenue independently per store-month; the dashboard
  says "no reproducible difference is detectable", not "stores are identical".
