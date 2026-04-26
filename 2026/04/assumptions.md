# Assumptions - 2026/04 International Maritime Logistics & Terminal Efficiency

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2026/03/DataDNA-Dataset-Challenge-International-Maritime-Logistics-Terminal-Efficiency.zip` |
| Retrieved | 2026-04-26, validated by ZIP magic bytes (`PK\x03\x04`), not HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution. |
| Expected rows / actual rows | 15,000 movements, 50 terminals, 1,000 vessels, 1,461 dates - all as found. The archive's dictionary claims `dim_time ≈ 5,000 rows`; it is **1,461**, one of eleven documented defects. |
| sha256 | `98c73bc7efd6f7569546e6bf7ba29b223d5024bd089d4ca98016f3ed550566c1` (the ZIP) |
| Formats in the archive | CSV (data), MD (`CHALLENGE_BRIEF.md`, `docs/DATA_DICTIONARY.md`) |

> **This archive documents its own generator.** `DATA_DICTIONARY.md` names the mechanism for
> every column - `choice`, `faker`, `numpy distribution=normal`. That is a published null
> hypothesis and it should be a gift. **It is wrong in eleven places**, listed in `brief.md`,
> including both headline measures. Every claim on this page is tested against the *file*, never
> against the dictionary.

## Business semantics

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| **the join key for vessels** | `vessel_key` | It is the only key that resolves: 992 of 1,000 used, **0 orphans**. | The dictionary documents `fact.vessel_id → dim_vessel.vessel_id`, which is unusable - `vessel_id` has 636 distinct values across 1,000 dimension rows and disagrees with the dimension on 909 of 15,000 fact rows. |
| **"the largest effect"** | max η² across every cut the brief names, treating `build_year` as a **123-group categorical cut** as well as a correlation | A continuous column tested only as a correlation never enters the η² ranking, which is how "0.003" was published against a true 0.0079. | Restricting to the four cuts the brief lists by name gives terminal at 0.0029. Both are stated; the page leads with the true maximum. |
| **`day_label`** | a property of the **date**, not the movement | A whole calendar day is "Day" or "Night" in this file. It is not a shift and the model refuses to call it one. | Reading it as a shift is what the brief invites, and it is unaskable of this schema. |
| **the Suez window** | 2021-03-23 to 2021-03-29 | The Ever Given blockage, as dated in the brief. | A wider window (the whole of March) shows the same nothing; a narrower one has no power at all. |
| **"a route"** | there is no per-movement route | `route_geometry` holds **1 distinct value across 15,000 rows**; all four start/end lon-lat columns are constant. | The 130° median offset measures where the 50 **terminals** sit relative to one fixed point. It is not a fact about journeys. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped** | **0 of 15,000** | `build.py` reports and asserts "0 rows dropped, 0 nulls, 0 orphans". |
| `movement_id` **not** used as a key | 15,000 | It has 1,001 distinct values and is a uniform draw (KS p=0.216), so it is a measurement, not an identifier. A surrogate `movement_sk` is generated. |
| `vessel_id` kept beside `vessel_key` | 909 disagree | Dropping it would hide the defect; the disagreement is flagged per row as `vessel_id_disagrees`. |
| `route_geometry` parsed once, in the build | 15,000 | It is a Python `repr`, not JSON - `json.loads` fails on it. Parsed centrally so no consumer has to know. |
| `mean_duration` / `mean_containers` kept in the parquet, **dropped from the browser payload** | 4 year rows | A test needs them to prove the ramp is a count fact. Shipping them to the data layer contradicted its own rule that no rate column reaches the browser, and nothing rendered them. |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can reproduce.

## Statistical choices

| Choice | Value | Why it could be disputed |
|---|---|---|
| Multinomial simulation | 1,000 reps, seed `crc32("daily-allocation")` | Label-derived and matched across `build.py` and `integrity.py` - they previously used 400 @ seed 0 and 1,000 @ label-derived and published two values (1.1525, 1.1418) for one quantity. |
| Cohen's floor for "small" | η² = 0.01 | The page's whole null rests on this threshold. The largest observed effect is 0.0079 - **79% of the floor**, not an order of magnitude below it. |
| Suez test | Mann-Whitney, one 7-day window | **Underpowered by construction**: MDE ≈ ±20.4% of mean duration, and power against the observed count drop is 42.7%. A real 15% slowdown - the brief's own target - would produce this p-value. Stated here because no rendered surface says it. |

## Known limitations

- **The Suez null is not a powered null.** Seven days cannot rule out a moderate effect. What
  the page can say is that the two months in question run 5.1% *above* the rest of 2021, which
  is the opposite direction to the story the brief invites.
- **The duration nulls ARE powered.** MDE at 80% power runs η² = 0.0005-0.0030 across the cuts,
  all at least 3.4× below Cohen's floor, so "nothing predicts duration" is a measurement.
- **There is exactly one real signal, not two.** The daily χ²/df excess decomposes almost
  entirely into the between-year term; conditioned on year, daily allocation is ordinary
  multinomial noise (p = 0.238). The ramp and the daily statistic are the same fact.
- **`terminal_capacity`, queue/wait time, arrival and departure timestamps, and a per-movement
  shift do not exist**, so the VP's 15% reduction target has no lever attached to it in this
  file. That list is the deliverable.
