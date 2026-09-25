# Assumptions - 2026/09

Every judgement call that could affect a headline number must also appear as a dashboard footnote.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2026/08/DataDNA-Dataset-Challenge-2026-09-Golden-Wok-Food-Delivery.zip` |
| Retrieved | 2026-09-25 |
| Onyx's file, or a substitute? | Onyx's direct challenge-page archive; no substitute |
| Expected rows / actual rows | fact 5,000 / 5,000; kitchens 4 / 4; zones 20 / 20; riders 60 / 60; time slots 48 / 48 |
| sha256 | `4e5e032e1b0782284865ab6c5989efd220304529535490ae60336a21622f050d` |

The extracted source folder is read-only. No source file was renamed, rewritten or cleaned in place.

## Business semantics

| Term | Current definition | Why | Alternative reading not taken |
|---|---|---|---|
| Order grain | One delivered row per `order_id` | 5,000 rows and 5,000 complete unique IDs | Treating repeated dates, riders or slots as duplicate orders |
| Promised / actual delivery minutes | Quarantined from operational analysis | 4,892 promises fall outside the documented 25-45 range, 4,400 actuals exceed 120 minutes and the two fields have r=0.0116 | Accepting 0-1,000 as literal operational minutes |
| Food temperature | Quarantined from quality analysis | 4,516 of 5,000 values lie above 100 Celsius and actual time has r=-0.00836 with temperature | Treating the 0.58-999.91 field as doorstep Celsius |
| Rider speed | Quarantined from rider-performance analysis | 56 of 60 rider averages exceed 100 km/h | Treating values up to 992.4 as urban rider speed |
| Order profit | Not treated as revenue minus delivery cost | Every row fails that identity; median absolute residual is NGN 70,368.33 and no row is negative | Repeating the source label as a defensible accounting measure |
| Time slot | A source category, not a reliable event timestamp | All 48 `hour_of_day` values disagree with `slot_label`; weekday disagrees with order date on 4,288 orders | Using slot labels as temporally coherent observations |
| Weather | A time-slot attribute whose operational meaning is unverified | Weather is fixed on 48 internally inconsistent slots rather than recorded at order-event grain | Treating it as observed weather for each order date |
| Zone | Keyed by `zone_id`, never by name alone | Five names each map to two IDs with potentially different attributes | Grouping by the 15 displayed names and collapsing 20 source entities |
| Rider | Keyed by `rider_id`, never by name | 54 of 60 rider rows use a name shared with another ID | Treating repeated names as one person |

## Data handling

No source row has been dropped or changed through G4. Profiling and `analysis/integrity.py` are
read-only; `model/build.py` writes only generated Parquet to `data/curated/` and finite JSON to
`app/public/data/`.

| Decision | Rows affected | Rationale |
|---|---:|---|
| Preserve every raw fact row | 5,000 of 5,000 | Data-quality defects are evidence and must remain auditable |
| Rebuild the calendar from `order_date` | 731 dates | The source slot weekday, hour and weekend fields contradict one another and cannot serve as calendar truth |
| Retain stable IDs as the analytical keys | 5,000 fact rows and all dimensions | Displayed rider and zone names are duplicated |
| Rename all nine business measures with a `source_` prefix | 5,000 fact rows | The values remain available for source auditing but are not promoted as operational measures |
| Add seven row-level semantic audit flags | 5,000 fact rows | Known defects remain countable without deleting otherwise valid allocation keys |
| Materialise corridor allocation | 80 kitchen-zone rows | Counts and shares are safe descriptive evidence when their 5,000-row denominator travels with them |
| Materialise evidence ledgers | 9 measures, 8 process links, 5 claims, 61 contracts, 7 collection requirements | The semantic boundary must be queryable rather than buried in prose |
| Reject unsupported reconstructed business measures | 0 reconstructed | Profit, SLA and quality reconstructions require semantics the release does not provide |

## Statistical choices

| Choice | Value | Why it could be disputed |
|---|---|---|
| Plausibility ceiling for food temperature | 100 Celsius for the G2 anomaly count | A production threshold should be lower, but 100 is a conservative physical screen |
| Plausibility ceiling for average rider speed | 100 km/h for the G2 anomaly count | Even 100 is implausibly high for Lagos food delivery; it avoids relying on a narrower policy assumption |
| Long-delivery screen | Over 120 minutes | The archive claims 90 minutes is extreme; 120 is used only to show how severe the delivered range is, not as an SLA definition |
| Profit identity tolerance | NGN 0.01 | The three fields are continuous floats; one kobo is sufficient to distinguish rounding from unrelated values |

## Known limitations

- The source provides no order timestamp that coherently agrees with slot hour, weekday and weekend.
- The delivered profit field cannot support corridor profitability, loss or margin decisions as labelled.
- The supplied weather and rush-hour claims cannot be interpreted causally because those attributes are
  properties of an internally inconsistent 48-row slot dimension.
- No direct route, bridge, road, delivery-fee or order-status field is delivered.
- The supplied schema configuration describes a different release: 0 of 54 configured constraints
  exactly matches a delivered table-column pair.
