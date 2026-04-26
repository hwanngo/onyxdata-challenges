# Brief - 2026/04

- **Title:** Mar-Apr 2026 DataDNA - International Maritime Logistics & Terminal Efficiency
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/march-april-2026-datadna-international-maritime-logistics-terminal-efficiency-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-04-march-april-2026-datadna-international-maritime-logistics-terminal-efficiency-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/03/DataDNA-Dataset-Challenge-International-Maritime-Logistics-Terminal-Efficiency.zip
- **sha256:** `98c73bc7efd6f7569546e6bf7ba29b223d5024bd089d4ca98016f3ed550566c1`
- **Two-month challenge** (Mar-Apr 2026), filed under the later month per the operating brief.

## Scenario

> "Global maritime logistics operations across multiple international terminals face ongoing
> operational and strategic challenges..."

The archive's own `CHALLENGE_BRIEF.md` is far more specific, and is the better statement:

> "You're a **Senior Operations Analyst at Global Maritime Solutions**, reporting to the **VP of
> Terminal Operations**. Following the 2021 Suez Canal disruption, your company has seen
> inconsistent cargo handling times across terminal locations... the company needs to identify
> operational inefficiencies and optimize terminal allocation to **reduce cargo movement times
> by 15%**."

**Persona:** the VP of Terminal Operations, preparing a Q1 2025 operational review.

## Stated objective

> "Identify the impact of the 2021 Suez disruption, uncover infrastructure bottlenecks, and
> detect efficiency anomalies - helping leadership reduce cargo movement times by 15% through
> data-driven terminal optimization."

## Explicit requirements

Two lists again. Both are requirements; neither is the other.

### A. Challenge page - "Operational & Analytical Challenges" (10)

- [ ] Fragmented visibility across regional hubs (EMEA, APAC, AMER) obscures true operational performance
- [ ] Variations in cargo movement times between terminals hide efficiency levels
- [ ] 2021 Suez disruption introduced volatility complicating trend analysis and capacity planning
- [ ] High container volumes may mask inefficiencies in move duration and resource allocation
- [ ] Limited visibility into terminal utilization versus capacity hampers expansion decisions
- [ ] Certain vessel categories may create congestion without clear identification
- [ ] Lack of regional-to-terminal drill-down limits accountability and local optimization
- [ ] Operational differences across shifts (day vs night) remain unanalyzed
- [ ] Vessel characteristics like age and category may influence movement duration without evaluation
- [ ] Difficulty linking terminal-level efficiency to overall movement time reduction weakens decision-making

### B. Archive `CHALLENGE_BRIEF.md` - three themes, 12 questions

**Tenth month running that the ZIP carries requirements the challenge page does not.** This one
goes further: it ships its own brief *and* a data dictionary, both as markdown.

1. **Suez effect** - when did the disruption occur? Did volumes spike before/after? Which hub
   was most affected? How long to return to normal?
2. **Infrastructure bottleneck** - which terminals handle the most movements? Is utilisation
   correlated with duration? Do certain vessel categories congest specific terminals? Which
   terminals should expand?
3. **Efficiency anomalies** - baseline per vessel category? Which factors predict longer
   movements (vessel age, terminal, shift, hub)? Outliers? Do night shifts take longer?

The archive brief flags two of its own metrics as missing: `terminal_capacity` **"(should be
added)"** and `shift` **"(if added correctly)"**. `terminal_capacity` does not exist.

## The file

| Table | Rows | Notes |
|---|---|---|
| `fact_cargo_movements` | 15,000 | grain stated as one row per movement |
| `dim_time` | 1,461 | 2021-01-01 → 2024-12-31, one row per day |
| `dim_vessel` | 1,000 | |
| `dim_terminal` | 50 | |

Referential integrity is perfect: **0 orphans** on `terminal_id`, `vessel_key` and `date_id`,
and **0 nulls anywhere**.

### The unusual thing about this month

**The archive ships a data dictionary that documents the generator for every column** - not the
meaning, the *mechanism*: `choice`, `faker`, `numpy distribution=normal`, `sequence`. It is, in
effect, a published null hypothesis.

That would be a gift. The problem is that **it is wrong in eleven places**, all verified below.

| # | The dictionary says | The file says |
|---:|---|---|
| 1 | `move_duration` ~ **normal** | **Uniform(0, 1000)**. KS vs uniform p=0.61; vs normal p=4.8e-48. Skew -0.012, kurtosis **-1.207** (uniform predicts -1.2) |
| 2 | `container_count` ~ **Poisson** | **Uniform(0, 1000)**. var/mean = **164.86** (Poisson predicts 1.0); 1,001 distinct values 0-1000; KS vs uniform p=0.76 |
| 3 | `regional_hub` ∈ {EMEA, APAC, AMER} | **Four values** - `LATAM` (9 terminals) is undocumented |
| 4 | `vessel_category` ∈ {Tanker, Cargo, Passenger} | **Four values** - `Container` (240 vessels) is undocumented |
| 5 | `build_year` ~ uniform(1990, 2023) | Range is **1900-2023** |
| 6 | `movement_id` is the **Primary Key** | **1,001 distinct values across 15,000 rows.** The same table also marks it `Unique: No` - the dictionary contradicts itself |
| 7 | fact columns: `movement_id, vessel_id, terminal_id, container_count, move_duration, route_geometry` | Also carries `date_id`, `vessel_key`, and a denormalised `vessel_category` |
| 8 | `dim_time` ≈ 5,000 rows | 1,461 |
| 9 | `dim_vessel` **Primary Key: `vessel_id`** | **636 distinct values across 1,000 rows.** Same defect as #6, in a second table |
| 10 | `dim_vessel.vessel_id` is `Unique: No` *and* the declared primary key | The dictionary contradicts itself here exactly as it does at #6 |
| 11 | the only documented join is `fact.vessel_id → dim_vessel.vessel_id` | That path is unusable (see #9). The real foreign key is **`vessel_key`, which the dictionary never mentions - 0 occurrences in the file** |

*(Rows 9-11 were added on review. The original count of "eight" stopped at the
columns the dictionary describes and never checked the keys and relationships it declares -
which is the same reading error as #6, repeated in a table I had already found the defect in.
**When you find a defect, look for it in every other table before publishing the count.**)*

**And a twelfth, which is a data defect rather than a documentation one:** the fact table carries
*two* vessel keys. `vessel_key` is the real foreign key (992 of 1,000 used, 0 orphans);
`vessel_id` is a denormalised copy that **disagrees with the dimension on 909 of 15,000 rows**.
The denormalised `vessel_category`, by contrast, agrees on all 15,000.

### What that means for the brief's questions

Checked at G1 because the framing depends on it. Every row below is a stated requirement.

| The brief asks | The file answers |
|---|---|
| *"Can you identify when the disruption occurred?"* | **No.** Suez week (23-29 Mar 2021) vs every other day: move_duration Mann-Whitney **p=0.504**, movements/day p=0.056, containers/day p=0.135. Quarterly mean duration spans 485.7-517.0 across all 16 quarters with no trend |
| *"Which factors most strongly predict longer movement times?"* | **None.** regional_hub η²=0.00009 · vessel_category η²=0.00048 · shift η²=0.00024 · terminal η²=0.00287 · vessel age ρ=+0.006 (p=0.48) · container_count ρ=-0.001 (p=0.91) |
| *"Do night shifts take longer than day shifts?"* | **No** (p=0.060, η²=0.00024) - and `shift` is a column on **`dim_time`**, one value per *date*, so an entire day is "Day" or "Night". Shift cannot vary within a day, which is not how a terminal works |
| *"Which terminals handle the most cargo movements?"* | **All of them, equally.** χ²=41.0 on 49 df (ratio 0.84, p=0.78) against equal allocation. Range 262-329 |
| *"Is there a correlation between utilisation and duration?"* | Not answerable - `terminal_capacity` does not exist, as the archive brief itself concedes |
| *"Which regional hubs were most affected?"* | The hub label is **not geographic**: longitude by hub KW p=0.199, and terminal coordinates are uniform over the globe (lon KS p=0.52, lat KS p=0.41) - 7 terminals sit south of 60°S and 4 north of 70°N. Terminal *names* are faker person-names ("Shannon Gray", "Deborah Perez") |

**Operational sanity:** mean `move_duration` is **501 hours - 20.9 days** to move one cargo
load, max 41.7 days, min 1.6 minutes. `container_count` runs 0-1,000 uniformly, so a movement
of exactly zero containers is as likely as any other.

**This is not a dataset with a weak signal. It is uniform noise in the shape of a star schema,
with a document attached that says so - and gets the details wrong.**

### The G1 lead, and its risk

The candidate thesis is that the honest deliverable here is **the audit**: a report that answers
the VP's three questions with "the data cannot support this, here is the proof, and here is what
you would need to collect instead." 2025/07 did something adjacent - when nothing was
significant it computed what *would* have been detectable, and made that the deliverable.

**The risk, named now:** a report that says "everything is noise" can be true and still useless,
and it is one short step from the trap this programme has recorded three times - inferring a
finding from a null. What made 2026/02 work was a *positive control*, something that
demonstrably moves. G2/G3 must find whatever in this file is real, or state plainly that
nothing is. Current candidates for "genuinely structured": the uniform allocation across 50
terminals, the perfect referential integrity, and the `vessel_id` mismatch on exactly 909 rows.

## Submission mechanics (THIS month)

Three lists, disagreeing again though less than usual:

- @OnyxData
- @SmartFramesUI
- @DataCareerJumpstart
- @packt  *(prefilled share text only; absent from the Step 2 list)*
- Hashtag: `#dataDNA`
- **Single image only.**
- **No ZoomCharts mini-challenge this month** - the sponsor is absent from the page and there is
  no read-me in the archive. Re-check at G8 before writing the submission.

## Timeline

| | |
|---|---|
| Challenge begins | 02 March 2026 |
| Deadline for entries | 20 April 2026 |
| Entry review & winner selection | 21 April 2026 |
| Winners announced | 28 April 2026 |

**Closed.** Today is 2026-04-26, six days after the deadline. Portfolio work, not a live
entry.

**Prizes (for the record):** 2 Packt eBooks, The Data Analytics Interview Software ($500).

## Benchmark

**Unchanged and structural, tenth month.** `/portfolio/` serves every entry in one payload with
the challenge filter applied client-side and per-entry AI scores behind a login; there is no
DataDNA account. Benchmarking is qualitative only, and the
Definition-of-Done line *"beats the highest scorer on ≥2 dimensions"* cannot be checked or
claimed for this month.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **Test what the source declines to promise** (2026/02). Here the source promises a great
   deal - a generator per column - so the useful move is the inverse: check every promise it
   *does* make. Eight are false, and that is the month's opening finding rather than a footnote.
2. **A null needs a positive control** (2025/09, 2026/02). This file will produce nulls
   everywhere. Without something demonstrably real alongside them, "no signal" is
   indistinguishable from "I did not look properly" - the failure mode recorded three times in
   this programme.
3. **Ask what a column *is* before asking what it says** (2025/12). `shift` sits on the date
   dimension, so it is a property of the *day*, not of a work period. `regional_hub` is a label
   with no geography behind it. `movement_id` is called a primary key and is not one. None of
   that is visible to profiling.

Carried as method: **compute the number, never type it.** 2026/02 published four figures it had
not computed, and every one was caught by luck rather than by design.
