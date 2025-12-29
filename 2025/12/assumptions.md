# Assumptions - 2025/12 Animal Shelter Operations

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/11/DataDNA-Dataset-Challenge-Animal-Shelter-Operations-December-2025.zip` |
| Retrieved | 2025-12-29, direct ZIP (Era 2 route A), validated by `PK\x03\x04` magic bytes |
| Onyx's file, or a substitute? | **Onyx's file.** No substitution. |
| Expected rows / actual rows | 52,343 raw → **52,339** after the pre-2017 drop below |
| sha256 | `ca22fdae65501e0ced0cfc7777c6e45c7624b9f4eefc705f09d3dc8034023d5f` |

This is real operational data - the City of Long Beach Animal Care Services intakes-and-outcomes
extract - not a generated set. Its defects are the ordinary defects of a system built to run a
shelter, which is why so much of this month is spent on them.

## Business semantics

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| **live-release rate** | `live / (live + dead)`. Administrative dispositions and animals still in the shelter are in **neither** numerator nor denominator. | An animal that is still in the kennel is not yet a save, and TRANSPORT/MISSING/DUPLICATE/NULL are not outcomes for the animal at all. Excluding them from both sides is the only treatment that does not assert something the file cannot support. | The file's own `was_outcome_alive` over **all** stays - 79.26% against my 78.49%. Published side by side throughout, never silently. Or `live / (live + dead + other)`, which counts non-outcomes as failures; an early draft of the sterilisation block used it and was corrected. |
| **live outcome** | Not in `{EUTHANASIA, DIED, DISPOSAL}`, not in `{TRANSPORT, MISSING, DUPLICATE, NULL}`, and not `STILL IN SHELTER`. | DISPOSAL is the contested one: 120 of its 132 records carry subtype `ACS DISPO` (body disposal), and the file's **own** `outcome_is_dead` column flags all 132 as dead while `was_outcome_alive` calls them live releases. One record, two columns, opposite answers - I follow `outcome_is_dead`. | Treat DISPOSAL as unknown and drop it. Costs 132 rows and changes the headline by 0.25pp; the decomposition in `insights.md` C1b prices exactly this. |
| **"still in shelter"** | An **outcome value**, not a null. 400 stays have a null `Outcome Date` because the animal has not left. | Modelling it as missing invites it to be dropped - or, worse, counted as a save, which is what the source flag does to 399 of the 400. | Drop unresolved stays entirely. Then the censoring in C2 becomes invisible instead of measured. |
| **intake channel** | `WELFARE SEIZED`, `WILDLIFE`, `CONFISCATE`, `QUARANTINE` = *officer-driven*; everything else = *public counter*. | These four are the intake types that do **not** require a member of the public to walk through an open door, so they are the control group for the weekday claim. The split is asserted in `dim_intake_type`/`channel`, not in a chart's WHERE clause. | `QUARANTINE` is arguable - some quarantines begin at the counter. Moving it to the public side would *strengthen* the contrast (public spread 14.1pp vs officer 3.1pp), so the assignment is conservative. |
| **repeat intake** | A property of the **animal** (`Animal ID` with 2+ stays), applied down to its stays. | The fact grain is the stay; "repeat" is not. Confusing the two is how 1,587 animals become 3,475 stays and back again. | `Animal ID` is the only link between stays, so an animal re-registered under a new ID is undercounted. **1,587 is a floor.** |
| **age** | Two columns. `age_years` uses every usable DOB; `age_trusted` is null wherever the DOB is a staff estimate or impossible. | 17,301 of the 45,810 DOBs present (37.77%) share the intake date's month *and* day - a 129× excess over a seasonality-aware null. Those are back-dated guesses, not dates. A view that wants an honest age effect uses the second column and takes the smaller n. | Use `age_years` throughout, as the file invites. That produces the "senior animals do worse" finding, which C3 kills. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **Dropped intakes before 2017** (`FIRST_YEAR = 2017` in `model/build.py`) | **4** (0.008%): 1 in 2013, 1 in 2014, 2 in 2016 - then 7,277 in 2017 | Four records across three and a half years is not a series; it is a straggler tail that makes any "since 2013" framing dishonest. Every figure downstream is over the resulting **52,339** stays. `analysis/profile.md` profiles the file *as delivered* (52,343) and says so at the point where the counts differ. |
| **Marked months >1% unresolved as censored** rather than plotting them (`CENSOR_THRESHOLD = 0.01`) | **6 months** - 2025-05 (1.02%) and 2025-07 → 2025-11 (1.52%, 4.79%, 7.82%, 22.99%, 45.12%); the series stops at the last settled month, **2025-06** (0.65%) | A month whose stays are still resolving cannot be compared with a finished one. Drawing a live-release trend into 2025-11 produces the 3.74-point 2025 "collapse" that is really just censoring. The threshold is a judgement: 1% is where the tail separates. Note 2025-05 crosses it while 2025-06 does not - the tail is *nearly* contiguous, and `build.py` **raises** if more than one settled month ever sits inside it, so a single cut-off can never be silently wrong. |
| **`age_trusted` set to null where the DOB is estimated or impossible** | 17,301 estimated + 235 impossible (DOB *after* intake) → 28,274 trusted of 45,575 computable | See "age" above. The rows are not deleted - they are still in every count and every rate - only the *age* claim about them is withheld. |
| **Non-outcomes excluded from live-release denominators** | 848 stays (TRANSPORT 645, MISSING 124, DUPLICATE 61, NULL 18) + 400 unresolved | The denominator rule. They are counted, charted and named; they are just not treated as answered questions. |
| **DISPOSAL reclassified from live to dead** | 132 stays | The file's own `outcome_is_dead` column agrees with me. Worth **0.25pp** of the 0.76pp headline gap; the other 0.51pp is the denominator. |
| Coordinates snapped to a ~220m grid for the browser payload | all 52,339 | Per-row 5dp coordinates cost 1.6MB for precision no city map can use. Analysis runs on the parquet, not the payload. |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can reproduce.

## Known limitations

- **`Breed` does not exist.** Guiding question Q5 asks for live-release by breed type. The column
  is not in the file and no proxy is defensible. Answered as unanswerable rather than approximated.
- **Intake condition is assessed by staff at intake**, so its very strong association with survival
  (Cramér's V = 0.530) is partly a prediction of the outcome rather than an independent cause of it.
  It is still the best-ranked predictor *available at the door*, which is what makes it actionable.
- **The opening-hours mechanism is an inference.** The file records no opening hours. The
  public-versus-officer contrast is the only mechanism I can find that explains why public-facing
  intakes collapse Monday-Tuesday and officer-driven ones do not - but it is not observed.
- **Restricting to real DOBs is not a random subsample.** It selects for animals somebody knew,
  i.e. owned pets. The trusted-DOB live rates are therefore an upper bound per bucket; the
  *comparison between buckets* is the claim, not the levels.
- **The DOB chance model is a model.** The published null (134 expected collisions) assumes DOB
  month-days are drawn independently from a seasonal distribution estimated from the non-matching
  rows. A flat 1/365 null gives 125. The observed excess is ~129× under either, so the finding
  does not turn on the choice - but the choice is named on the page rather than assumed.
- **The gap decomposition is order-dependent by 0.006pp.** Both orders are published (C1b).
- **`intake_is_dead` is degenerate** - every row reads "Alive on Intake". Dead-on-arrival intakes
  were filtered out of the published extract, so every denominator here means "animals that
  arrived alive". `build.py` raises if that ever stops being true.
