# Requirements trace — 2026/09 Golden Wok

Gate G7 disposition of every challenge bullet. **Answered** means the release supports a bounded,
descriptive answer. **Contradicted** means the supplied statement conflicts with its own delivered
fields. **Unsupported** means the requested operational conclusion cannot be made from this release.

The visible decision boundary is consistent throughout the app: the allocation lattice is descriptive;
all nine business measures are source-audit only; SLA, weather, quality, routing and profit actions are
blocked until the seven missing collection requirements are supplied.

## Explicit requirements

| # | Challenge requirement | Visible element | Query evidence | G7 disposition |
|---:|---|---|---|---|
| 1 | Diagnose causes of late delivery and inefficiency | **Nine dials. No defensible delivery chain.**; **Expected linear links are near zero.**; Block Now | `analysis/insights.md` I3; Promise→Actual `r=0.01156`, Traffic→Actual `r=-0.00272`; 4,892 promise-range and 4,400 actual-time screen failures | **Unsupported.** The release does not contain a coherent clock or measurable delay chain. |
| 2 | Identify routes, zones and conditions associated with weak service | **Every cell is filled. That is the warning.**; corridor drawer; Block Now | I2; all 80 kitchen-zone pairs contain 41–79 rows; largest share 1.58%; route identity is absent | **Answered for allocation; unsupported for service.** No corridor performance ranking is exposed. |
| 3 | Identify routes, zones and conditions associated with weak profitability | Profit dial; Distance→Profit and Cost→Profit rows; Block Now | I3/I4; all 5,000 rows fail the profit identity; Distance→Profit `r=-0.00002`, Cost→Profit `r=0.01179` | **Unsupported.** Supplied profit is not defensible unit economics. |
| 4 | Assess traffic, weather, distance and delivery-time effects on food quality and ratings | Process-link ruler; rain and slow/cold claim rows | I3/I4; Traffic→Time `-0.00272`, Distance→Time `0.01112`, Time→Temperature `-0.00836`, Time→Rating `-0.01546` | **Unsupported operationally.** The raw associations are tested and shown, but the fields fail semantics. |
| 5 | Recommend priorities for operational improvement and route planning | Decision stamp; **Count allocation. Repair measurement. Do not optimise.** | Decision and collection specification in `analysis/insights.md` | **Answered.** Preserve stable-ID counts; collect route and service-event evidence before rerouting. |
| 6 | Recommend priorities for SLA management and corridor profitability | Block Now; Collect Next | `dim_collection_requirement`: service timestamps and reconciled unit economics are missing | **Answered.** Do not set SLA or corridor-profit policy from this release. |
| 7 | Reconcile visibility across orders, kitchens, zones, riders, traffic and customer outcomes | Diagnostic rail; lattice; coverage rail; dials; process links | I1–I3; 5,000 unique orders, zero key orphans, complete entity-pair coverage, disconnected measures | **Answered as a source audit.** Entity allocation is visible; outcome attribution is unavailable. |
| 8 | Examine rush-hour and outer-zone SLA pressure | Rush + outer claim row and drawer | I4; `n=539`, 496 above 90 raw minutes, 86 at least 3× promise, zero below NGN -500 | **Contradicted as supplied; unsupported operationally.** |
| 9 | Examine rain and heavy-rain delivery performance | Rain claim row; Weather and Traffic dials | I4; Clear is absent; alternative rain-vs-other contrast is `1.00393×` traffic and `+6.94` raw minutes | **Unsupported as specified.** Static slot weather and invalid time block policy. |
| 10 | Examine long-distance economics, including 8 km | Above-8-km claim row; Distance/Cost/Profit dials | I4; `n=3,871`, zero negative supplied-profit rows; Distance→Cost `r=0.01641` | **Contradicted under the supplied field; defensible economics unsupported.** |
| 11 | Examine food temperature and ratings as duration increases | Slow/cold claim row; Time→Temperature and Time→Rating rows | I4; among 4,710 raw >60-minute rows, 203 are below 45°C and 1,768 below 2.5 | **Contradicted as a threshold claim; quality inference unsupported.** |
| 12 | Compare kitchen-to-zone corridors | Allocation matrix, kitchen/zone filters, corridor table and drawer | `fact_corridor_allocation`; all 80 counts, selection shares and within-kitchen source ranks | **Answered for row allocation only.** Performance and profitability comparisons remain blocked. |
| 13 | Examine congestion effects on both delay and cost | Traffic, Actual and Cost dials; process-link panel; Block Now | G7 closure query below: Traffic→Actual `r=-0.00272`; Traffic→Cost `r=-0.00699` | **Tested; unsupported operationally.** Neither raw linear link is material, and all three fields are quarantined. |
| 14 | Test whether high order volume corresponds to healthy financial performance | Allocation matrix beside Profit quarantine; Block Now | G7 closure query below: across 80 corridors, row count→mean supplied profit `r=0.10607`; supplied profit fails its identity on every row | **Tested; unsupported.** Volume cannot validate an invalid financial outcome. |
| 15 | Examine seasonal, daily and rush-hour demand patterns | Date range, Month filter and selected-row count; Block Now | G7 closure query below; monthly allocation counts 192–213, weekday counts 710–720, daily counts 1–7; slot hour/weekday semantics fail | **Answered descriptively for dated allocation; rush-hour demand unsupported.** No seasonal performance claim is made. |
| 16 | Test kitchen × zone × time × weather × traffic interactions | Lattice and coverage rail for safe structural pairs; dials; Block/Collect ledger | G7 closure query below; 4,288/5,000 date-slot weekday mismatches, 48/48 slot-hour mismatches and weather is static slot metadata | **Unsupported.** A five-way operational interaction would combine invalid time/weather/traffic semantics and no defensible outcome. |

## Archive hypotheses

| Supplied hypothesis | Visible element | Result | Disposition |
|---|---|---|---|
| Rush-hour outer-zone orders triple SLA and average below NGN -500 | `rush_outer_loss` claim | Raw predicate partly counts large times, but zero rows have profit below -500 | **Contradicted** |
| Rain creates 1.8× traffic and adds 28 minutes versus Clear | `rain_delay` claim | Clear absent; alternate ratio 1.00393× and raw difference +6.94 | **Unsupported as specified** |
| Deliveries above 8 km are structurally unprofitable | `distance_loss` claim | 3,871 rows; zero negative supplied-profit rows | **Contradicted** |
| Deliveries above 60 minutes arrive below 45°C with ratings below 2.5 | `slow_cold_low_rating` claim | Cold share 4.31%; raw time links are near zero | **Contradicted** |
| Lekki serving VI and Ikoyi is consistently unprofitable | `lekki_vi_ikoyi_loss` claim | VI absent, route identity absent, zero negative supplied-profit rows in Lekki × Ikoyi | **Unsupported as named** |

The Claim Scorecard and guided tour summarize the current verdicts as **three contradicted, two
unsupported, zero confirmed**. The curated model retains `REJECTED` as the machine verdict for the
three field-level contradictions; the reader-facing label is `CONTRADICTED`.

## Guiding-question families

| Family | Element and answer |
|---|---|
| Temporal | Date range and Month filter expose dated allocation. The closure query shows deliberately narrow monthly and weekday counts. Rush-hour, seasonal performance, changepoints and lead/lag effects remain blocked by incoherent slot time. |
| Entity | Kitchen/zone/rider filters, matrix and coverage rail answer activity and common-pair questions. No performance ranking is exposed. |
| Transaction | Diagnostic counts, dials, 36 pairwise tests, five claim tests and 61 release contracts answer volume, correlation and anomaly questions as a source audit. The archive contains one order fact and no transaction-type field. |
| Cross-dimensional | Matrix and coverage rail answer safe two-way allocation combinations. Higher-order service interactions are explicitly unsupported until timestamps, observed weather, route identity and reconciled outcomes exist. |

## G7 closure queries for requirements 13–16

These queries close bullets that are not dedicated poster panels. They run against curated Parquet and
preserve the same semantic boundary as the UI.

```sql
-- Congestion/traffic versus cost: raw association only; both fields are quarantined.
SELECT corr(source_traffic_friction_score, source_delivery_cost_ngn)
FROM fct_order_allocation;
-- -0.0069935832

-- Does a higher-volume corridor have healthier supplied profit?
WITH corridor AS (
  SELECT kitchen_id, zone_id,
         count(*)::DOUBLE AS order_rows,
         avg(source_order_profit_ngn) AS mean_supplied_profit
  FROM fct_order_allocation
  GROUP BY 1, 2
)
SELECT corr(order_rows, mean_supplied_profit),
       min(order_rows), max(order_rows)
FROM corridor;
-- 0.1060704903; 41 to 79 rows. Profit remains invalid on all 5,000 facts.

-- Safe dated-allocation summaries. These are counts, not demand-performance effects.
SELECT strftime(order_date, '%Y-%m') AS year_month, count(*) AS rows
FROM fct_order_allocation
GROUP BY 1 ORDER BY 1;
-- 24 months; 192 to 213 rows per month.

SELECT dayname(order_date) AS weekday, count(*) AS rows
FROM fct_order_allocation
GROUP BY 1 ORDER BY 1;
-- 710 to 720 rows per weekday.

WITH daily AS (
  SELECT order_date, count(*) AS rows
  FROM fct_order_allocation
  GROUP BY 1
)
SELECT min(rows), max(rows), count(*) FROM daily;
-- 1 to 7 rows across 731 dates.

-- Why the requested five-way operational interaction is fail-closed.
SELECT count(*) FILTER (WHERE NOT date_matches_slot_weekday) AS date_slot_failures
FROM fct_order_allocation;
-- 4,288

SELECT count(*) FILTER (WHERE NOT slot_hour_consistent) AS slot_hour_failures,
       count(*) FILTER (WHERE NOT slot_weekend_consistent) AS weekend_failures
FROM dim_time_slot;
-- 48 and 21 of 48 slots.
```

## Verification trace

- Release-level numbers: `model/metric_checks.yml` → `tools/verify_metrics.py`.
- Filtered selection numbers: `model/verify_selection.py` checks default, kitchen, zone, rider, month
  and a real zero-row state directly against curated Parquet.
- Interaction coverage: `app/interact.mjs` covers every filter, every drill, clear-all, browser Back,
  deep link, empty state, guided-tour focus behavior, poster mode and mobile mode.
- Claim and semantic assertions: `analysis/test_integrity.py` and `model/test_metrics.py`.
