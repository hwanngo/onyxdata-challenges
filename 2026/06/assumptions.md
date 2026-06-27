# Assumptions - 2026/06 UK Fintech Neobank (Zephyr Bank)

Every judgement call the analysis rests on that the data does not settle. Each is footnoted in
the UI where it affects a number.

## The unit of analysis

**A1. The unit is the customer, not the transaction - n = 20, not 1,500.**
Four columns (`transaction_status`, `is_flagged_fraud`, `failed_reason`, `device_type`) are
constant across all 75 of every customer's rows, and `amount_gbp` is one seed jittered by a
constant ±15% band. Any rate built on those columns has an effective sample size of 20. Every
rate on this page is therefore shown with its customer count and an interval.

**A2. Intervals are exact binomial on n = 20, and that is the *generous* reading.**
`scipy.stats.binomtest(k, 20).proportion_ci(method="exact")` treats the 20 customers as a random
sample of the 20,000 the brief claims. Nothing in the file establishes that, and the
`device_type = customer_id mod 4` mapping suggests a constructed lattice rather than a sample -
in which case no population interval is defensible at all. The page states the interval and this
caveat together.

**A3. The design effect is taken as exactly the cluster size, 75.**
DEFF = 1 + (m-1)ρ with intra-cluster correlation ρ = 1 for a perfectly constant column. ρ is
exactly 1 here by construction, so DEFF = m = 75 and SEs are √75 = 8.66× wider. This is not an
estimate.

## Money

**A4. "Expected fee" is `typical_fee_gbp` from `dim_transaction_type`, joined on
`transaction_type_id` - never on `type_name`.**
Four names map to two ids each, and `ATM Withdrawal` is *both* a domestic £0.00 and an
international £1.50 regime. Grouping by name merges them. The model has no path that joins on
name.

**A5. A single fee deviation is not called an error; the pattern is.**
The dictionary permits deviation - *"may differ from typical_fee_gbp if waived or in error"*.
What the page asserts is the aggregate shape: 725 of 1,500 rows deviate, fees are charged on
seven types where £0.00 is due, 80% of `Transfer - International` fees are uncollected, and the
gross errors cancel to a net -0.023%. Whether any individual waiver was authorised is not
knowable from this file, and the page says so.

**A6. Gross absolute deviation, not net variance, is the recommended control.**
This is a recommendation, not a finding. It follows directly from I6 but the page labels it as
the proposed action rather than something the data proves.

## Naming and framing

**A7. The page does not call the fraud flag wrong.**
`is_flagged_fraud` records that Zephyr's engine flagged something. Whether those flags are
correct is unknowable here. The finding is about the **denominator** - that 20% is 4 of 20
customers - not about whether the four are really fraudulent.

**A8. "17 of 20 customers have never completed a transaction" is reported as a property of the
file, not of the bank.**
An 85% failure rate over five months is not a plausible operating state for a going concern; it
is a statement about how the 20 seeds were assigned. The page frames it that way explicitly.

## Method

**A9. Dates are parsed as `%m/%d/%Y`.**
The dictionary says YYYY-MM-DD; the file is M/D/YYYY. Parsed as ISO, polars returns nulls; parsed
as D/M/Y, **60 distinct dates (600 rows)** silently transpose - the days on which both
components are <= 12. (151 is the total distinct-date count, not the ambiguous subset; the two
were conflated until this was checked.) The chosen format is confirmed by the fact that day values
exceed 12 (e.g. `3/16/2026`) while month values never do.

**A10. Dimension CSVs are read with the UTF-8 BOM stripped from the header.**
All three carry one, so the primary key parses as `﻿customer_id` and every join fails
*silently* - returning nulls rather than raising. `build.py` strips it and asserts the key exists.

**A11. Effect sizes and intervals decide; p-values are reported only to show they are
uninformative.**
Fisher p = 0.5377 on the KYC 2×2 is quoted precisely because it means nothing was learned.
Day-of-week does not reach significance at all (χ² p = 0.0836, Cramér's V = 0.0863) and is
clustered on top of that, so it is reported as
not a finding.

## Scope

**A12. No four-way cross-tab is attempted.**
The challenge page names "customer segment × channel × merchant category × region". That is a
four-way cut of twenty points, with cells of 0 or 1. The page says so rather than rendering it.

**A13. This is synthetic data, and the transferable finding is structural.**
The specific customers, the £1.9m, and the exact 725 fee deviations are generator artefacts. What
transfers is the shape: a fact table whose grain is finer than its information; a rate whose
denominator is a cluster count; and a net-variance control that is blind to offsetting errors.
The page marks each finding as indicative or conclusive, per the archive brief's own scoring hint.

**A14. Benchmarking is not possible.**
No DataDNA account, so per-entry AI scores are behind a login. The Definition-of-Done line
"beats the highest scorer on ≥2 dimensions" is not checked and not claimed.
