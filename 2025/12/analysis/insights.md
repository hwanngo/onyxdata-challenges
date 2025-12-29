# Insight ledger - 2025/12 Animal Shelter Operations

Every claim has a query. Queries run against `data/curated/fct_stay.parquet` (52,339 stays,
2017-2025; the four records before 2017 are dropped as stragglers and the drop is recorded).

---

## THE THESIS

> **Three of the brief's twelve questions ask this file about the shelter's paperwork rather
> than about its animals - and the file answers confidently every time. The fourth pattern
> everyone measures is real, and it is the one that should drive decisions.**

- **The live-release rate** the file publishes counts 399 animals that have not left the
  shelter, and 132 that were disposed of, as saved.
- **Age** is a staff guess for 38% of animals, back-computed from the intake date - and the
  apparent "older animals do worse" finding is mostly an artefact of *who gets guessed at*.
- **The day-of-week pattern** is the opening hours. Staffing on it would be circular.
- **The month-of-year pattern is real demand**, visible in the officer-driven series that owes
  nothing to public opening hours. That is the one to plan against.

Underneath the corrections there is a working shelter with a genuine story: intake *condition*
predicts survival far better than species, age or anything else (Cramér's V = 0.53); the
outcome the shelter most wants is the slowest one it does; and a "repeat intake" is usually not
a failure at all.

---

## Part 1 - What the file measures about itself

### C1 · The live-release rate is 78.49%, not the 79.26% the file reports

- **QUERY** `select avg(was_outcome_alive), sum(is_live)/(sum(is_live)+sum(is_dead)) from s`
- **OUTPUT** File flag **79.26%**. Corrected **78.49%** (40,103 live / 10,988 dead, with 848
  non-outcomes and 400 unresolved stays excluded from both).
- **CAVEAT** "Corrected" is a choice: it excludes TRANSPORT, MISSING, DUPLICATE and animals
  still in the shelter from the denominator rather than counting them either way. Both figures
  are published side by side throughout.
- **SO WHAT** `was_outcome_alive` is not a measurement - it is *"not explicitly euthanasia or
  died"*. Its most indefensible member is **DISPOSAL**: 132 stays, 120 of them subtype
  `ACS DISPO` (body disposal), which the file's **own** `outcome_is_dead` column flags as dead.
  One record, two columns, opposite answers.

### C1b · The 0.763-point gap is two different mistakes, and only one of them is the flag

- **QUERY** `metric_checks.yml :: gap_denominator_pp`, `gap_flag_pp`, and the same pair taken in
  the opposite order (`*_flag_first`). Two corrections separate the file's 79.256% from the
  measured 78.493%: **(a)** restrict the population from all 52,339 stays to the 51,091 that are
  live or dead, and **(b)** stop counting the 132 DISPOSAL records as live releases.
- **OUTPUT** Denominator first, then flag: **0.505 pp** denominator + **0.258 pp** flag.
  Flag first, then denominator: **0.252 pp** flag + **0.511 pp** denominator. Either way the two
  sum to **0.763 pp** exactly, and the flag term is just 132 ÷ the denominator in force
  (132/51,091 = 0.258; 132/52,339 = 0.252).
- **CAVEAT** The split is **order-dependent by 0.006 pp**, because the two corrections are not
  independent. Neither order is privileged; both are published on the page rather than one being
  chosen quietly. A third framing - correcting the flag *fully* on the file's own all-stay
  denominator - is not used, because live/all-stays (76.62%) is not a rate anybody claims.
- **SO WHAT** This month's argument is about a denominator, so quoting the headline gap whole
  would hide the denominator's share of it. **Two thirds of the overstatement is the
  denominator**, not the misfiled DISPOSAL records - which means a shelter that fixed only the
  132 obviously-wrong rows would keep 0.5 of the 0.76 points. The fix is definitional, not
  janitorial.

### C2 · At the end of the series the gap is 3.7 points, because 45% of November has not happened yet

- **QUERY** per intake month, share unresolved and both rates.
- **OUTPUT** 2017-2024 the two flags differ by 0.08-0.87 points. **2025: 78.76% vs 75.02%.**
  Unresolved share by month: **2025-11 45.1%**, 2025-10 23.0%, 2025-09 7.8%, 2025-08 4.8%.
  399 of the 400 unresolved stays are counted as live releases by the file's flag.
- **CAVEAT** Unresolved is inferred from a null `Outcome Date`; 27 rows also carry
  `outcome_is_current`.
- **SO WHAT** This is 2025/10's lesson in a different costume. An animal still in the kennel is
  not yet a save. Any live-release trend drawn to the right-hand edge of this data rises into a
  month that is half unfinished - so the series stops at **2025-06** and the censored tail is
  drawn explicitly as censored rather than omitted.

### C3 · Age is a staff estimate for 38% of animals, and the age effect largely dissolves without it

- **QUERY** count DOBs sharing the exact month+day of intake; then live-release by age bucket,
  all records versus records with a non-estimated DOB. The chance model is
  `metric_checks.yml :: dob_match_expected_seasonal` - the collision probability of two
  independent draws from the shelter's *own* month-day distributions.
- **OUTPUT** **17,301 of 45,810 DOBs (37.77%)** share the intake date's month and day, against
  **134 expected by chance** - a **129×** excess. Implied ages are whole years:
  1y (4,726), 2y (3,363), 3y (2,920).

  | Age at intake | live, all records | live, real DOB only | shift |
  |---|---:|---:|---:|
  | under 6 months | 79.86% | 80.78% | +0.9 |
  | 6-12 months | 81.82% | **91.16%** | +9.3 |
  | 1-3 years | 87.33% | **93.32%** | +6.0 |
  | 3-7 years | 81.92% | **90.12%** | +8.2 |
  | 7-12 years | 79.93% | **87.92%** | +8.0 |
  | 12 years + | 77.46% | **87.73%** | +10.3 |

- **CAVEAT ON THE NULL** A flat 1/365 null gives **125**, and that null is wrong: intakes here
  are strongly seasonal (May-June carry 2.3× December), and a DOB back-dated from the intake day
  inherits that seasonality, so month-day collisions beat uniform chance. The published null
  therefore uses the intake month-day distribution against a DOB month-day distribution
  estimated from the **non-matching** rows only, so the effect being tested does not build its
  own null. That gives 134. The excess is ~129× under either model, so the finding does not
  depend on the choice - but the choice is named rather than assumed.
- **CAVEAT** Restricting to real DOBs is not a random subsample - it selects for animals someone
  knew, i.e. owned pets. The corrected figures are therefore an upper bound for each bucket.
  The *comparison between buckets* is the claim, not the levels.
- **SO WHAT** Guiding question Q5 asks which age groups have worse live-release rates. Using the
  column as supplied, the answer looks like "the very young and the very old". Using only real
  dates, **every adult bucket sits between 87.7% and 93.3%** and the apparent senior penalty
  mostly disappears. The estimated ages are attached to strays, wildlife and ferals - the
  animals with poor outcomes for reasons that have nothing to do with age. The age column is
  partly a record of *how much the shelter knew about the animal*.

### C4 · The day-of-week pattern is the opening hours

- **QUERY** intakes by weekday overall, then split by intake type; the same for outcomes.
- **OUTPUT** Wednesday **19.72%** of intakes against Monday **7.78%** (χ² = 4,650, df 6), stable
  in every year 2017-2025. Split by who brings the animal in:

  | Intake type | n | Mon | Tue | Wed |
  |---|---:|---:|---:|---:|
  | RETURN | 585 | 2.1% | 6.8% | **22.9%** |
  | OWNER SURRENDER | 4,599 | 3.7% | 4.3% | **21.4%** |
  | STRAY | 36,776 | 7.0% | 6.9% | **20.7%** |
  | WILDLIFE *(officer)* | 8,150 | 12.2% | 12.3% | 15.0% |
  | WELFARE SEIZED *(officer)* | 938 | 14.8% | 17.8% | 18.1% |

  Outcomes show the same shape (Mon 6.4%, Wed 19.5%).
- **CAVEAT** The file does not record opening hours, so "the counter is shut Monday and Tuesday"
  is an inference - but it is the only mechanism that explains why public-facing intakes
  collapse and officer-driven ones do not.
- **SO WHAT** Q9 asks whether day-of-week patterns should inform staffing. This one should not:
  it is a picture of the roster the shelter already runs. Adding Wednesday staff because
  Wednesday is busy is circular.

### C5 · The month-of-year pattern, by contrast, is real

- **QUERY** intakes by calendar month, split by intake channel.
- **OUTPUT** Public-counter intakes peak in **May-June (4,824 / 4,826)** and trough in
  **December (2,087)** - a 2.3× swing. The officer-driven series, which owes nothing to public
  opening hours, has the **same shape**: May 1,218 and June 1,149 against December 427.
- **CAVEAT** Nine years pooled; the shape is consistent year to year.
- **SO WHAT** This is the control that makes C4 a finding rather than a guess. Seasonality
  survives the test that the weekday pattern fails, so **the month is the axis to plan
  against** - and the peak is kitten season, which is also when the hardest-to-place animals
  arrive.

---

## Part 2 - What the file measures about animals, which is real

### C6 · Intake condition predicts survival better than anything else in the file

- **QUERY** χ² of live/dead against intake condition and against animal type, with Cramér's V.
- **OUTPUT** `intake_condition` × live: χ² = 14,361, df 16, **V = 0.530**. `animal_type` × live:
  χ² = 7,447, df 9, **V = 0.382**. Live-release by condition: **NORMAL 95.18%**, FRACTIOUS
  90.45%, INJURED MILD 81.03%, ILL MILD 77.61%, UNDER AGE/WEIGHT 74.82%, INJURED MODERATE
  64.58%, ILL MODERATE 56.93%, INJURED SEVERE 30.07%, **ILL SEVERE 20.80%**.
- **CAVEAT** Condition is assessed at intake by staff, so it is partly a prediction of the
  outcome rather than an independent cause of it.
- **SO WHAT** A 74-point spread on a variable recorded at the door. Q6 has a clear answer, and
  it points at where intervention money goes: the difference between "ill moderate" (56.9%) and
  "ill mild" (77.6%) is 20 points of survival on 4,002 animals.

### C7 · Dogs and cats are different businesses, and so is wildlife

- **QUERY** live-release by animal type with 95% Wilson intervals.
- **OUTPUT** **DOG 92.30%** [91.88, 92.69] · **CAT 78.41%** [77.89, 78.92] · RABBIT 83.00%
  [80.54, 85.21] · BIRD 67.06% [65.50, 68.58] · OTHER 43.05% · **WILD 29.85%** [28.05, 31.72].
- **CAVEAT** AMPHIBIAN (n = 3, [43.85, 100]) and LIVESTOCK (n = 16) are reported with their
  intervals and excluded from any ranking. This is 2025/11's lesson applied.
- **SO WHAT** The 14-point dog/cat gap is far outside sampling noise and is the single biggest
  structural fact about the caseload. Pooling the 8,150 wildlife intakes into a headline
  live-release rate drags it down by several points while describing a service - wildlife
  rescue - that is not trying to rehome anything.

### C8 · The outcome the shelter most wants is the slowest one it does

- **QUERY** median length of stay by live outcome type, with each type's share of live outcomes.
- **OUTPUT** **ADOPTION: median 25 days**, p90 113, and 28.1% of live outcomes. RESCUE: median
  **5 days**, 30.8%. TRANSFER: 4 days, 19.7%. RETURN TO OWNER: **1 day**, 13.6%.
- **CAVEAT** Median, not mean - the adoption distribution has a long tail (max 1,410 days).
  Where the page contrasts the two, **both are over the same population**: all 51,939 resolved
  stays, median **5 days** against mean **19.27**. An earlier draft paired this median with a
  mean of 22.5, which is live releases *only* - a slower population - so part of the gap between
  the two numbers was the subsetting rather than the skew. `median_los_overall` and
  `mean_los_overall` in `metric_checks.yml` are now defined over identical rows.
- **SO WHAT** Q12 asks which actions would most reduce length of stay *and* improve save rates.
  Those two goals pull in opposite directions here: the fastest live outcomes are the ones that
  hand the animal to somebody else, and the slowest is the one the shelter is actually for.
  Any "reduce average length of stay" target that does not exclude adoptions rewards
  transferring animals out.

### C9 · A repeat intake is usually not a failure - it is a lost dog coming home

- **QUERY** stays belonging to animals with 2+ visits versus 1 visit; repeat rate by species.
- **OUTPUT** 1,587 animals return, 3,475 stays. Compared with single-visit stays, repeat stays
  are **64.7% dogs** (vs 29.8%), **31.8% return-to-owner** (vs 8.8%) and **95.07% live** (vs
  **77.30%**). By species, the share of animals that ever return: **DOG 6.43%**, RABBIT 2.47%,
  **CAT 2.28%**, everything else below 0.2%.
- **CAVEAT** `Animal ID` is the only link between stays; an animal re-registered under a new ID
  would be undercounted, so 1,587 is a floor.
- **SO WHAT** Q11 asks what predicts repeat intakes, with the clear implication that they are a
  problem. They are mostly owned dogs that escape and are reclaimed - an outcome 18 points
  *more* live than the average stay. The prevention story is real but small; the operational
  story is that the return-to-owner pathway works and takes one day.

### C10 · The largest outcome is not adoption

- **QUERY** count by outcome type.
- **OUTPUT** **RESCUE 12,233** · ADOPTION 11,170 · EUTHANASIA 9,599 · TRANSFER 7,829 ·
  RETURN TO OWNER 5,410.
- **CAVEAT** None.
- **SO WHAT** The shelter's biggest single outcome is handing the animal to a rescue partner.
  Q4 asks which pets are adopted most often, which quietly assumes adoption is the main road.
  It is second, and the gap between it and rescue has swung: adoptions went 733 (2017) →
  **2,073 (2023)** while rescues went 1,604 → 1,585.

---

## Theses considered and killed

**"Senior animals face much worse outcomes."** 12y+ animals show 77.46% live release against
87.33% for 1-3 year olds - a 10-point senior penalty. Killed by C3: restricted to animals with a
real date of birth, 12y+ is 87.73% and 1-3y is 93.32%, and most of the apparent gap was the
estimated-age population, not age.

**"Wednesday is the shelter's busiest day and needs more staff."** True on the face of it -
19.72% of all intakes. Killed by C4: the officer-driven intake types are flat across the week,
so the spike is the public counter's opening hours.

**"Unspayed and unneutered animals have far worse outcomes."** Spayed 97.65% and neutered 95.40%
live release against 77.69% male and 79.18% female. Not tested further here and **not published**
as a finding: "Unknown" sex is 48.37% and is overwhelmingly wildlife and neonates, so the sex
column is carrying species and condition. It would need those controlled before it means anything.
(All five rates obey the denominator rule - live / (live + dead). An earlier draft of this block
used live / (live + dead + other), which is the denominator this month exists to argue against,
and truncated 96.98 to 96.9. The method panel names the killed claim, so those two numbers are on
the page and are now specified in `metric_checks.yml` and asserted against the DOM like any other.)
