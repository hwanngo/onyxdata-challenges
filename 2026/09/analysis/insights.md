# Insight ledger - 2026/09 Golden Wok Food Delivery Analytics

**The gate that decides the Insights score. No query, no claim.**

The executable analysis is `analysis/integrity.py::analyze`. Its load-bearing outputs are constrained
against the immutable raw CSVs by `analysis/test_integrity.py`. G4 must independently reproduce every
published metric from curated Parquet and the Malloy model.

## Thesis

> **Every route. No journey.** The archive fills all 80 kitchen-zone corridors and all 240
> rider-kitchen pairings, but its nine business measures behave as disconnected bounded draws—so it
> can count allocated rows, not explain delivery performance, food quality or profit.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | The release looks production-ready: 5,000 unique orders, a complete 731-day calendar, no nulls or duplicate rows, and every foreign key resolves. Every kitchen ID is paired with every zone ID, and every rider ID appears against every kitchen ID. |
| **Complication** | The completeness resembles synthetic breadth, not an observed delivery process. Kitchen, zone, rider and slot allocations are statistically consistent with uniform assignment; the expected traffic → time → temperature/rating → profit chain has correlations between -0.0155 and +0.0257; none of 36 pairwise measure tests survives correction. Five supplied findings fail under their own fields. |
| **Resolution** | Use this release only to describe row allocation by stable IDs and to specify the missing measurement contract. Do not change radius, SLA, routing, kitchen allocation or corridor policy until event timestamps, route identity, observed weather, service milestones and reconciled unit economics are collected. |

## Question storm

These questions were declared before selecting the final narrative. Answers come from
`analysis/integrity.py`; unsupported questions remain visible rather than being silently omitted.

| # | Question | Answer / disposition |
|---:|---|---|
| 1 | Is one row one order? | Yes: 5,000 rows and 5,000 complete unique order IDs. |
| 2 | Do all fact keys resolve? | Yes: zero kitchen, zone, rider or slot orphans. |
| 3 | Is calendar coverage complete? | Yes: all 731 dates from 2023-01-01 through 2024-12-31. |
| 4 | Are display names safe entity keys? | No: 10 zone rows and 54 rider rows share a displayed name with another ID. |
| 5 | Is kitchen volume concentrated? | No: 1,215-1,273 orders per kitchen; uniform-allocation p=0.678. |
| 6 | Is zone volume concentrated? | No severe hotspot: 209-279 orders per zone; p=0.404. |
| 7 | Is rider volume concentrated? | No: 64-99 orders per rider; p=0.443. |
| 8 | Is slot volume concentrated? | No: 82-130 orders per slot; p=0.195. |
| 9 | Do only selected kitchen-zone corridors operate? | No: all 80 of 80 possible pairs occur. |
| 10 | Do riders stay with selected kitchens? | No: all 240 of 240 rider × fact-kitchen pairs occur. |
| 11 | Does the fact kitchen match the rider's base? | Only 1,264 rows match; 3,736 do not. Association p=0.369, V=0.0255. |
| 12 | Are kitchen-slot combinations operationally constrained? | No: all 192 of 192 pairs occur. |
| 13 | Does date agree with slot weekday? | No: 4,288 of 5,000 orders disagree. |
| 14 | Does slot hour agree with slot label? | No: 48 of 48 disagree. |
| 15 | Does weekend agree with weekday? | No: 21 of 48 slots contradict themselves. |
| 16 | Do orders occur only after a kitchen opens? | No: 1,238 orders predate the joined kitchen opening date. |
| 17 | Do continuous measures follow their documented distributions? | Five documented normals are rejected at machine precision. |
| 18 | What shape do the delivered measures follow? | Seven continuous fields fit broad uniform supports; both minute fields fit equal 0-1,000 bins. |
| 19 | Does promised time predict actual time? | No: r=+0.0116; 2,497 late, 2,499 early and 4 equal. |
| 20 | Does traffic predict actual time? | No: r=-0.00272. |
| 21 | Does distance predict actual time? | No: r=+0.0111. |
| 22 | Does actual time predict food temperature? | No: r=-0.00836. |
| 23 | Does actual time predict rating? | No: r=-0.0155. |
| 24 | Does distance predict delivery cost? | No: r=+0.0164. |
| 25 | Does distance predict profit? | No: r=-0.000018. |
| 26 | Does order value predict profit? | No robust link: r=+0.0257. |
| 27 | Does delivery cost predict profit? | No: r=+0.0118. |
| 28 | Does the supplied profit reconcile? | No: 5,000 of 5,000 rows fail value - cost = profit; median absolute residual NGN 70,368.33. |
| 29 | Are deliveries above 8 km structurally unprofitable? | No under the supplied field: 3,871 rows, zero negative profits. |
| 30 | Does rain produce 1.8× traffic and +28 minutes versus Clear? | Unsupported as specified: Clear is absent. An alternative rain-versus-all-other-conditions contrast gives 1.00393× traffic and +6.94 raw minutes; both time and weather semantics are invalid. |
| 31 | Do slow deliveries arrive cold and poorly rated? | Unsupported: 4,710 rows exceed 60 raw minutes, but only 203 are below 45°C; both fields are invalid. |
| 32 | Can the Lekki-VI-Ikoyi claim be tested? | No: VI/Victoria Island is absent, route fields are absent and profit is invalid. |
| 33 | Does the validator certify this release? | No: it says 10/10 passed while 0 of 54 constraints matches a delivered table-column pair. |
| 34 | Is there a defensible operational hotspot? | No. The largest corridor is 79 orders, 1.58% of the file, and performance measures are unusable. |

---

## I1 - The star schema is clean enough to create false confidence.

**Query**

```sql
WITH fact AS (
  SELECT * FROM read_csv_auto('data/fact_orders.csv')
)
SELECT count(*) AS fact_rows,
       count(DISTINCT order_id) AS distinct_orders,
       count(DISTINCT strptime(order_date, '%m/%d/%Y')) AS distinct_dates,
       min(strptime(order_date, '%m/%d/%Y')) AS date_start,
       max(strptime(order_date, '%m/%d/%Y')) AS date_end
FROM fact;
```

`analysis/integrity.py::analyze` additionally anti-joins every foreign key to its dimension and checks
rider base-kitchen keys.

**Output**

```text
fact rows / distinct order IDs     5,000 / 5,000
calendar coverage                  2023-01-01 to 2024-12-31
calendar dates                     731 of 731
fact foreign-key orphans           0
rider base-kitchen orphans         0
exact duplicate rows               0
null values                        0
```

**Caveat:** this establishes grain, coverage and joinability only. A key resolving proves membership;
it does not prove that the connected attributes describe the same real event.

**So what:** the failure mode is not an obviously broken import. Golden Wok could build a polished,
fast dashboard whose numbers reconcile to source and still make indefensible operational decisions.
Semantic checks must follow mechanical checks.

---

## I2 - The fully crossed network does not evidence operational routing.

**Query**

```sql
WITH f AS (SELECT * FROM read_csv_auto('data/fact_orders.csv'))
SELECT
  count(DISTINCT kitchen_id || '|' || zone_id) AS kitchen_zone_pairs,
  count(DISTINCT kitchen_id || '|' || rider_id) AS kitchen_rider_pairs,
  count(DISTINCT kitchen_id || '|' || time_slot_id) AS kitchen_slot_pairs
FROM f;
```

The rider-base association and allocation tests execute in `analysis/integrity.py::analyze` with
chi-square and Cramér's V.

**Output**

```text
kitchen × zone pairs              80 / 80 possible
fact kitchen × rider pairs       240 / 240 possible
kitchen × slot pairs             192 / 192 possible
zone × slot pairs                956 / 960 possible
smallest / largest corridor       41 / 79 orders
largest corridor share                 1.58%

fact kitchen = rider base       1,264 orders
fact kitchen != rider base      3,736 orders  (74.72%)
base-kitchen association        p=0.369, Cramér's V=0.0255

uniform-allocation p-values
  kitchen 0.678 · zone 0.404 · rider 0.443 · slot 0.195
```

**Caveat:** a real unconstrained dispatch operation could populate every pair. Full crossing alone does
not prove the generator mechanism. The inference comes from full crossing plus balanced allocation,
near-zero base-kitchen association, absent route identity and disconnected service measures.

**So what:** a corridor matrix can show where rows were allocated, but it cannot identify a route
strategy, capacity bottleneck or preferred dispatch pattern. Use high-volume cells to prioritise future
instrumentation, not to reroute current operations.

---

## I3 - Nine business measures are separate dials, not one delivery process.

**Query**

```python
r = analyze(ARCHIVE)["generation"]
print(r["continuous_uniform_pvalues"])
print(r["promised_uniform_p"], r["actual_uniform_p"])
print(r["documented_normal_d"])
print(r["pairwise_tests"], r["pairwise_survivors"], r["max_abs_pairwise_r"])
print(r["expected_chain_r"])
```

Seven continuous fields are tested against apparent round-number bounded-uniform supports. Promised and
actual minutes are tested as ten equal-width bins over 0-1,000. Five fields documented as normal are
tested against the dictionary's stated mean and standard deviation. All 36 measure pairs are screened
with Pearson correlation at Bonferroni alpha 0.001389.

**Output**

```text
continuous fields fitting broad uniform supports       7 of 7
minimum uniform-fit p                                  0.0668
promised-minute equal-bin p                            0.3333
actual-minute equal-bin p                              0.7978
five documented normal distributions rejected          5 of 5
KS D against documented normals                    0.417-0.935

pairwise measure tests                                     36
Bonferroni survivors                                        0
maximum |r|                                            0.03038
strongest pair                    promised minutes ↔ rating
strongest nominal p                                    0.0317

traffic → actual time                                -0.00272
distance → actual time                               +0.01112
actual time → temperature                            -0.00836
actual time → rating                                 -0.01546
distance → delivery cost                             +0.01641
distance → profit                                    -0.00002
order value → profit                                 +0.02571
delivery cost → profit                               +0.01179

actual > promised / equal / actual < promised    2,497 / 4 / 2,499
promised ↔ actual r                                  +0.01156
```

**Caveat:** the broad uniform supports were identified from obvious round endpoints in the delivered
values, so the fit tests are diagnostic rather than proof of the private generator implementation. The
stronger evidence is convergent: documented normals fail severely, both clocks spread evenly over
0-1,000, and every expected process link is near zero.

**So what:** do not interpret a marginal average as an operational effect. Traffic, distance, time,
temperature, rating, value, cost and profit do not form a measurable service chain in this release.
The page should render them as quarantined source fields, not KPIs.

---

## I4 - All five supplied findings fail; their plausible wording is the main risk.

**Query**

```python
c = analyze(ARCHIVE)["claims"]
print(c)
```

The rush/outer claim is tested as `is_rush_hour = 'Yes'` intersecting the delivered outer-zone tier.
Rain means Light Rain or Heavy Rain because no Clear category exists; it is compared with every other
condition. The 8 km and 60 minute thresholds use the source's own operators. The named corridor uses
the kitchen name containing Lekki and the zone name Ikoyi; VI is checked separately.

**Output**

| Supplied finding | Delivered result | Verdict |
|---|---|---|
| Rush-hour outer-zone orders exceed 90 minutes, triple SLA and average below NGN -500 | n=539; 496 exceed 90 raw minutes; 86 are at least 3× promise; **0** are below NGN -500; mean supplied profit NGN 486.37 | Rejected: time invalid and loss impossible |
| Rain/heavy rain produces 1.8× traffic and +28 minutes versus Clear | Clear absent; alternative n=1,166 versus 3,834 other-condition rows gives traffic **1.00393×** and actual-time difference **+6.94** raw minutes | Unsupported as specified; alternative contrast conflicts with the claimed magnitude |
| Distance above 8 km is structurally unprofitable | 3,871 orders (**77.42%**); **0 negative profits**; mean supplied profit NGN 498.45 vs NGN 495.14 nearer | Rejected |
| Above 60 minutes means below 45°C and rating below 2.5 | n=4,710; only 203 below 45°C; 1,768 below 2.5; time → temperature r=-0.00836; time → rating r=-0.01546 | Rejected and semantically unsupported |
| Lekki serving VI and Ikoyi is consistently unprofitable | Ikoyi cell n=58, **0 negative profits**, mean NGN 465.43; **VI is absent**; no route/bridge field exists | Unsupported as named |

**Confirmed as stated: 0 of 5.**

**Caveat:** some raw predicates return large counts because the minute fields are uniform over
0-1,000. For example, a high share exceeding 90 minutes is a property of that support, not evidence of
a late-delivery problem. The table reports source-field results to refute the claims, not to legitimise
the fields.

**So what:** the most dangerous false story is also the most intuitive one: “rainy outer-zone orders
are slow, cold, poorly rated and unprofitable, so shrink the delivery radius and close the Lekki
corridor.” This release cannot support any link in that recommendation.

---

## I5 - The validator passed contracts for a different release.

**Query**

```python
config = json.loads((ARCHIVE / "docs/SCHEMA_CONFIG.json").read_text())
report = json.loads((ARCHIVE / "docs/VALIDATION_REPORT.json").read_text())

matching = sum(
    spec["table_name"] in tables and spec["column_name"] in tables[spec["table_name"]].columns
    for spec in config["column_constraints"].values()
)
```

`analysis/integrity.py::analyze` also checks whether both fields named by every configured relationship
exist in the delivered tables.

**Output**

```text
supplied validation report          10 / 10 passed
configured column constraints              54
constraints matching delivered fields       0
configured relationships                    7
relationships requiring absent fields       3
```

A fourth configured relationship connects `fact_orders.kitchen_id` to
`dim_time_slot.time_slot_id`. Both names exist, but the relationship is semantically nonsensical.

**Caveat:** the report contains only aggregate counts, not check-level evidence, so the ten passed
checks cannot be reconstructed or mapped to source rows.

**So what:** validation must fail closed when a named table, field or relationship is absent from the
exact release artifact. Store contracts as rows with target identity, executed query, population and
result; never accept a pass count without the tested contract.

---

## Decision and collection specification

### Safe now

- Count source rows by stable kitchen, zone, rider and slot IDs.
- Identify high-volume ID combinations for targeted re-instrumentation.
- Audit release contracts, domains and referential integrity.
- Preserve supplied measures under explicit `source_*_unreconciled` names for forensic comparison.

### Block now

- SLA performance or breach rates.
- Rush-hour, weekday, weather or seasonal effects.
- Temperature degradation or customer-rating causality.
- Corridor, kitchen, zone or distance profitability.
- Radius reduction, rerouting, kitchen closure or rider reassignment based on this release.

### Collect before retesting

1. Order-created, promised-by, accepted, pickup-ready, pickup and delivered timestamps.
2. Origin and destination coordinates plus route/corridor identifier and distance method.
3. Observed weather joined by event timestamp and location, not a static slot label.
4. Order status, cancellations, retries and reassignment history.
5. Delivery fee, food revenue, rider payment, fuel/third-party cost and an enforced profit formula.
6. Temperature measurement timestamp, method and unit.
7. Rider assignment history and the rule permitting or prohibiting cross-kitchen dispatch.

## Rejected candidates

| Candidate | Why dropped |
|---|---|
| Outer zones are slower | Invalid time field; Tier 4 raw mean does not establish an effect. |
| Heavy Rain versus Sunny proves a rain penalty | The comparator is cherry-picked; the all-condition difference is 6.94 raw minutes, weather is static slot metadata and time is invalid. |
| 77.42% of orders exceed 8 km, so radius is the problem | A distribution is not an effect; distance links to neither time, cost nor profit. |
| High volume means healthy financial performance | Kitchen volumes are nearly balanced and supplied profit is unrelated to value or cost. |
| 2024 deteriorated versus 2023 | Outcome fields are invalid, so a year comparison cannot establish operational deterioration. |
| Use value - cost as reconstructed profit | No delivery-fee or food-cost semantics establish that this difference is accounting contribution. |
| Group by rider or zone name | Names are duplicated; only IDs are stable. |
| Treat no nulls as high quality | The dominant defects are semantic and cross-field, not missingness. |
| Treat every nominal correlation as a lead | The strongest of 36 has abs(r)=0.03038 and none survives correction. |
| Build another broken-circuit visual | August already used that signature; September's distinctive evidence is full crossing plus independent dials. |

## Non-obvious checklist

- [x] **Two-way interactions:** kitchen × zone, kitchen × rider, kitchen × slot and zone × slot.
- [x] **Simpson's paradox:** no valid outcome relationship exists to decompose; raw subgroup stories were
      rejected rather than promoted.
- [x] **Rate vs volume mismatch:** large raw late/cold predicates arise from broad supports, not process
      rates; corridor volume does not imply performance.
- [x] **Concentration:** largest corridor is only 1.58%; all 80 are populated.
- [x] **Distribution vs average:** uniform-support tests replace misleading marginal means.
- [x] **Cohorts:** no defensible operational cohort exists without coherent event time or assignment
      history; this is an explicit collection gap.
- [x] **Changepoints and anomalies:** calendar exists, but invalid outcomes make trend/changepoint claims
      unsupported.
- [x] **Funnel leakage:** no order-status or service-milestone funnel is delivered.
- [x] **Lead / lag:** no coherent event timestamps exist.
- [x] **Missingness as signal:** zero nulls; semantic corruption demonstrates why completeness is not
      validity.
- [x] **Survivorship:** current `is_active` flags have no effective dates and cannot be applied
      historically.
- [x] **Mix vs performance decomposition:** allocation mix is measurable; performance is not.
