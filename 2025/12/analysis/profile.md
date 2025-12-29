# Profile - 2025/12 Animal Shelter Operations

Source: `DataDNA Dataset Challenge - Animal Shelter Operations - December 2025.csv`,
sha256 `ca22fdae65501e0ced0cfc7777c6e45c7624b9f4eefc705f09d3dc8034023d5f`.
Raw folder is read-only; everything below is computed.

**52,343 rows × 29 columns.** One row per shelter stay. `Kennel ID` is the true primary key
(52,343 distinct); `Animal ID` is not (50,455 distinct) - **1,587 animals appear more than
once**, up to 8 times, which is guiding question Q11 answered by the key structure alone.

Intake dates span **2013-07-24 → 2025-11-26**, but the early years are stragglers: 1 record in
2013, 1 in 2014, 2 in 2016, then 7,277 in 2017. **The usable series starts 2017.**

This is real operational data from a working shelter, not a generator. So the interesting
defects are not "is this synthetic" but "what does this system record about itself that an
analyst will mistake for a fact about animals". There are three, and each one lands on a
different guiding question.

---

## Defect 1 · The live-release flag counts animals that have not left yet - and animals that were disposed of

The file ships **two disagreeing live/dead flags**. They differ on **1,007 rows**, and the
difference is entirely systematic:

| Outcome Type | rows | `was_outcome_alive` | `outcome_is_alive` | also flagged |
|---|---:|---:|---:|---|
| TRANSPORT | 645 | **1** | 0 | `outcome_is_other` |
| **DISPOSAL** | **132** | **1** | **0** | **`outcome_is_dead`** |
| MISSING | 124 | **1** | 0 | `outcome_is_other` |
| DUPLICATE | 61 | **1** | 0 | `outcome_is_other` |
| (null outcome) | 45 | **1** | 0 | - |

`was_outcome_alive` is not a measurement; it is *"not explicitly euthanasia or died"*. So
**DISPOSAL - 120 of whose 132 records carry the subtype `ACS DISPO`, i.e. body disposal - is
counted as a live release**, while the file's own `outcome_is_dead` column flags the same rows
as dead. A record cannot be both.

Headline effect: **79.26% vs 77.33%**, a 1.93-point gap on the single number guiding question
Q3 asks for.

### And it gets much worse at the end of the series

400 records have no outcome date at all - the animal is still in the shelter. **`was_outcome_alive`
counts 399 of those 400 as live releases.** Those records are not spread evenly:

| Intake month | records | unresolved | file's flag | strict |
|---|---:|---:|---:|---:|
| 2025-11 | 410 | **45.1%** | 83.41% | 79.76% |
| 2025-10 | 448 | 23.0% | 77.46% | 75.89% |
| 2025-09 | 588 | 7.8% | 73.47% | 68.20% |
| 2025-08 | 606 | 4.8% | 79.37% | 68.15% |
| 2025-07 | 594 | 1.5% | 69.87% | 61.45% |

By year the gap between the two flags is ~1.5 points from 2017 to 2024 and **7.3 points in
2025** (78.76% vs 71.43%). This is 2025/10's right-censoring lesson in a different costume: an
animal still in the kennel is not yet a save, and a trend line drawn to the end of this series
rises into a month that is nearly half unresolved.

**Consequence for Q3:** the live-release rate must be stated with its definition attached, the
trend must stop before the censored tail, and the file's own flag should be shown *as the thing
being corrected* rather than used.

---

## Defect 2 · Age is a staff estimate for 38% of animals, back-computed from the intake date

`DOB` is populated on 45,814 of 52,343 rows. **17,303 of those (37.77%) share the exact month
and day of the intake date.** If DOB and intake were independent *and uniform over the year*
that would happen about 125 times (0.27%) - and uniform is the wrong null here, because intakes
are strongly seasonal and a back-dated DOB inherits that seasonality. The seasonality-aware null
is **134**, so the excess is ~129× either way; `analysis/insights.md` C3 carries the model.

> **These are RAW counts, before the pre-2017 drop.** This document profiles the file as
> delivered (52,343 rows). Every figure downstream of `model/build.py` - insights, the
> dashboard, `metric_checks.yml` - is over the 52,339 stays from 2017 on, where the same
> collision count is **17,301 of 45,810 (37.77%)**. Four records move; the share does not.

The implied ages are whole years, and they cluster exactly where a human guess would:
1 year (4,726), 2 (3,363), 3 (2,921), 5 (1,393), 4 (1,310), 0 (607), 8 (602), 6 (572).

So for more than a third of animals, staff recorded "about two years old" and the system
back-dated a DOB by subtracting whole years from the day of intake. Two records survive as the
reductio: a reptile with DOB `1993-09-15` intaken `2023-09-15` (exactly 30.0 years) and one with
DOB `1967-11-26` intaken `2017-11-26` (exactly 50.0 years).

**235 records have a DOB *after* their intake date** - impossible, and a separate defect.

**Consequence for Q5** ("which age groups have higher or lower live-release rates"): age
buckets are 38% estimate, rounded to whole years, and derived from the intake date itself. Any
"1-year-olds have the worst outcomes" finding needs to survive being restricted to the 62% of
animals with a real DOB before it is worth stating.

---

## Defect 3 · The day-of-week pattern is the opening hours, not the demand

Intakes by weekday look like a strong operational signal - Wednesday carries **19.72%** of all
intakes against Monday's **7.78%** (χ² = 4,650 on 6 df). The pattern is stable in every year
from 2017 to 2025, so it is structural rather than an event.

It is also not about animals. Splitting by intake type separates the public counter from the
field officers:

| Intake type | n | Mon | Tue | **Wed** |
|---|---:|---:|---:|---:|
| RETURN | 585 | 2.1% | 6.8% | **22.9%** |
| OWNER SURRENDER | 4,599 | 3.7% | 4.3% | **21.4%** |
| STRAY | 36,780 | 7.0% | 6.9% | **20.7%** |
| WILDLIFE | 8,150 | 12.2% | 12.3% | 15.0% |
| WELFARE SEIZED | 938 | 14.8% | 17.8% | 18.1% |

The intake types that need a member of the public to walk through an open door collapse on
Monday and Tuesday and pile up on Wednesday. The types driven by officers - welfare seizures
and wildlife - are nearly flat. **Outcomes show the identical shape** (Mon 6.4%, Wed 19.5%),
because an adoption also needs the counter open.

**Consequence for Q9** ("are there day-of-week patterns that inform staffing?"): the pattern is
a picture of the roster the shelter already has. Recommending staff be added on Wednesday
because Wednesday is busy is circular. The series that *does* carry demand is the officer-driven
one, and it is flat.

---

## Column-level notes

**Degenerate.** `intake_is_dead` has exactly one value - `"Alive on Intake"` - across all 52,343
rows. Dead-on-arrival intakes have been filtered out of the published extract, so every
denominator here is "animals that arrived alive", and EUTHANASIA (9,600) and DIED (1,257) are
all animals that arrived alive and did not leave that way.

**Outcome distribution.** The largest outcome is **RESCUE (12,233)**, not ADOPTION (11,172).
Then EUTHANASIA (9,600), TRANSFER (7,830), RETURN TO OWNER (5,411). Any "adoption is the main
outcome" framing is wrong on the first bar. (Raw counts again - after the pre-2017 drop these
read RESCUE 12,233 · ADOPTION 11,170 · EUTHANASIA 9,599 · TRANSFER 7,829 · RTO 5,410, which is
what `insights.md` C10 and the dashboard carry. The ranking is identical.)

**Length of stay.** `intake_duration` reconciles exactly with `Outcome Date - Intake Date` - 0
mismatches, 0 negatives. Over the 51,943 rows that have one: median 5 days, **mean 19.27**, max
1,410. **14,822 of them (28.5%) are zero days**, which is a same-day outcome and worth
separating rather than averaging over. (Both the mean and the same-day share are quoted over
rows that *have* a duration. A mean of 22.5 appears if you take live releases only - a slower
population - and pairing that with an all-stays median would make the skew look larger than it
is. See `analysis/insights.md` C8.)

**Categories with real size differences.** `Animal Type` runs from CAT (24,888) to AMPHIBIAN
(3). Live-release rate by type: DOG 91.7%, CAT 77.4%, BIRD 63.8%, OTHER 41.7%, **WILD 28.9%**.
The wildlife caseload (8,150 intakes) is a different business from the pet caseload and pooling
them moves the headline.

**Confounded categories.** `Sex` has five values and the live-release spread looks dramatic -
Spayed 97.65%, Neutered 95.40%, Female 79.18%, Male 77.69%, **Unknown 48.37%**. But "Unknown" is
largely wildlife and neonates, so this is a species and condition effect wearing a sex label.

**Free text.** `Crossing` (23,646 distinct) is an intersection string; `Outcome Subtype` has 283
values with inconsistent spellings (`ILL MODERATETE`, `ILL MODERA`). `latitude`/`longitude` are
populated on every row with 13,209 distinct geopoints - genuinely geocoded, unlike the country
centroids of 2025/11, so a map is defensible here.

## What the file does not contain

- **No capacity or kennel-occupancy field**, so "shelter capacity" (named in the objective) can
  only be inferred from concurrent stays.
- **No cost, staffing or volunteer-hours data**, so the resource-planning questions can be
  answered in terms of workload counts only.
- **No breed column at all**, despite Q5 asking for "breed types". `Primary Color` and
  `Secondary Color` exist; breed does not. That question cannot be answered as posed.
