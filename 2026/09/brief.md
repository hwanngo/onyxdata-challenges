# Brief - 2026/09

- **Title:** September 2026 DataDNA - Golden Wok Food Delivery Analytics
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/september-2026-datadna-golden-wok-food-delivery-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-09-september-2026-datadna-golden-wok-food-delivery-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/08/DataDNA-Dataset-Challenge-2026-09-Golden-Wok-Food-Delivery.zip
- **ZIP sha256:** `4e5e032e1b0782284865ab6c5989efd220304529535490ae60336a21622f050d`
- **Era:** 2
- **Status:** challenge closed; this is portfolio/practice work, not a live entry

## Scenario

The public challenge frames Golden Wok as an urban food-delivery operation whose leadership needs to
understand delivery performance, SLA adherence, traffic, weather, distance, profitability, food
temperature, ratings, kitchen performance and delivery-zone performance across 2023-2024.

The archive assigns the role directly:

> "Step into the role of a data analyst investigating golden wok delivery radius and urban traffic
> friction matrix."

**Decision persona:** Golden Wok operations leadership deciding where to change kitchen allocation,
routing, SLA policy and corridor economics.

**Decision supported:** which kitchen x zone x time x weather x rider combinations merit operational
intervention, and which supplied patterns cannot support a decision because the delivered measures or
dimensions are invalid.

## Stated objective

The public page asks the analyst to identify causes of delay and inefficiency, find vulnerable routes,
zones and operating conditions, connect service performance to profitability and customer outcomes,
and recommend priorities for routing, SLA management and corridor-level profitability.

## Explicit requirements

Every item must be answered, tested or explicitly marked unsupported at G7.

- [ ] Diagnose the main causes of late delivery and operational inefficiency.
- [ ] Identify routes, zones and conditions associated with weak service performance.
- [ ] Identify routes, zones and conditions associated with weak profitability.
- [ ] Assess traffic, weather, distance and delivery-time effects on food quality and ratings.
- [ ] Recommend priorities for operational improvement and route planning.
- [ ] Recommend priorities for SLA management and corridor profitability.
- [ ] Reconcile visibility across orders, kitchens, zones, riders, traffic and customer outcomes.
- [ ] Examine rush-hour and outer-zone SLA pressure.
- [ ] Examine rain and heavy-rain delivery performance.
- [ ] Examine long-distance delivery economics, including the stated 8 km threshold.
- [ ] Examine food temperature and ratings as delivery duration increases.
- [ ] Compare kitchen-to-zone corridors.
- [ ] Examine congestion effects on both delay and cost.
- [ ] Test whether high order volume corresponds to healthy financial performance.
- [ ] Examine seasonal, daily and rush-hour demand patterns.
- [ ] Test cross-dimensional interactions among kitchen, zone, time, weather and traffic.

## Archive hypotheses

The archive presents five statements as analysis areas. They are hypotheses, not accepted findings:

- [ ] Rush-hour orders to outer zones exceed 90 minutes, triple the promised SLA and average below
      NGN -500 profit.
- [ ] Rain or heavy rain produces 1.8x traffic friction and roughly 28 additional delivery minutes
      versus clear conditions.
- [ ] Deliveries above 8 km are structurally unprofitable regardless of order value.
- [ ] Deliveries above 60 minutes arrive below 45 Celsius and correlate with ratings below 2.5.
- [ ] The Lekki kitchen serving VI and Ikoyi is consistently unprofitable because of named congestion
      corridors.

G2 already establishes that these cannot be repeated at face value: the delivered profit field has no
negative values, the time and weather dimension contradicts its own labels, and several measures sit
far outside their documented domains. G3 must test defensible reconstructions and state when no such
reconstruction exists.

## Archive guiding questions

The archive adds four families of questions:

- **Temporal:** changes over time, seasonality, peaks and conditions associated with changes.
- **Entity:** activity drivers, segment performance, distinguishing characteristics and hotspots.
- **Transaction:** common volumes, distributions, correlations and anomalies.
- **Cross-dimensional:** interactions, common combinations, entity-pair relationships and associations.

## Source-integrity posture

The archive contains one 5,000-row order fact, four dimensions, a data dictionary, two incompatible
schema specifications and a validation report. All foreign keys resolve and the calendar covers every
day from 2023-01-01 through 2024-12-31, but mechanical integrity does not make the business measures
valid.

The delivered files contradict their documentation in ranges, category domains, temporal labels and
financial semantics. The supplied validation report says 10/10 checks passed, while none of 54
configured column constraints names a delivered table-column pair and three of seven configured
relationships require missing fields. Source documentation and supplied claims are therefore evidence
to audit, not contracts to trust.

## Submission mechanics

- Required tag union: `@OnyxData`, `@SmartFramesUI`, `@DataCareerJumpstart`, `@packt`
- Hashtag: `#dataDNA`
- One LinkedIn post with one dashboard or visualisation image
- Screenshot format: PNG, JPG or WebP; maximum 10 MB
- One entry only; resubmissions prohibited
- Optional Power BI `.pbix` up to 50 MB or report link
- Sponsors shown: Packt, Data Career Jumpstart and Smart Frames UI
- No separate sponsor mini-challenge was described

## Timeline

| | Date |
|---|---|
| Challenge begins | 1 September 2026 |
| Submission deadline | 24 September 2026 |
| Review and winner selection | 25-30 September 2026 |
| Winners announced | 30 September 2026 |

## Benchmark

No September portfolio entries were visible on the public challenge content at G1. Public score-based
benchmarking is therefore unavailable. The comparison target remains the recurring field baseline:
descriptive KPI grids, accepted source narratives, small poster text and unexplained composite scores.

This month should differentiate through an explicit measurement audit, defensible denominators, one
coherent thesis, independently recomputed metrics, useful cross-filtering, a real drill path and a
standalone 2560x1440 poster.

## Lessons applied from `.workbench/docs/LEARNINGS.md`

1. **Mechanical integrity is not semantic integrity.** Test each service evidence connector after the
   keys resolve: conditions -> time, time -> temperature/rating, and revenue/cost -> profit.
2. **Test every source promise.** The five supplied patterns, dictionary ranges and validation report
   remain hypotheses until checked against the delivered files.
3. **Establish grain and denominator before effects.** A unique order ID does not validate dimensions
   whose weekday, weekend, hour and weather labels contradict one another.
