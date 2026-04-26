# Insight ledger - 2026/04 Maritime Logistics & Terminal Efficiency

**The gate that decides the Insights score.** No query, no claim.

Every figure below is reproduced by `analysis/integrity.py`, which reads the **raw CSVs only**
- never `data/curated/` - so a defect in `model/build.py` cannot validate itself.

## Thesis

> **This dataset has exactly one real number in it, and it is the one that will get you fired.
> Cargo movements grow every year - and because 2021 is the lowest, that ramp reads as
> "the Suez disruption hurt us and we recovered". There was no disruption. There is no
> recovery. There is nothing else in the file at all.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | A VP asks three questions: where are the bottlenecks, which terminals and vessels underperform, and how do we cut movement times 15%? The file looks equal to the task - a clean star schema, 15,000 movements, zero nulls, zero orphans, and a data dictionary. |
| **Complication** | Nothing in it predicts movement time. Not the terminal, the hub, the vessel, its age, the shift, the year or the cargo size - the largest effect is η²=0.0079 (**I1**). The two headline measures are Uniform(0,1000), which the dictionary itself gets wrong (**I2**). And the Suez disruption the brief is built around left no trace whatsoever (**I3**). |
| **Complication** | The schema cannot hold the answers either: there is no unique row key, one join key is corrupt on 6% of rows, `shift` is a property of the *date*, and `regional_hub` has no geography behind it (**I4**). |
| **Resolution** | One thing is real: movement **count** grows monotonically, and it exceeds the maximum of 1,000 simulated multinomials. It is the only signal - and because 2021 is the lowest year, it is the one a reader will hand to the Suez story (**I5**). |
| **So what** | The honest deliverable is not a dashboard of terminal rankings. It is the specification of what would have to be collected before any of the VP's three questions could be answered (**I6**). |

---

## Ledger

### I1 - Nothing in this file predicts how long a cargo move takes. The largest effect is η² = 0.0079.

**Query**
```sql
-- for each axis the brief names, Kruskal-Wallis on move_duration + eta-squared
SELECT <axis>, move_duration FROM fact
JOIN dim_time USING(date_id) JOIN dim_terminal USING(terminal_id)
JOIN dim_vessel USING(vessel_key);
-- and Spearman for the two continuous candidates
```

**Output**
```
axis                 k      KW p       eta2
regional_hub         4    0.7115    0.00009
vessel_category      4    0.0683    0.00048
shift                2    0.0601    0.00024
terminal_id         50    0.7154    0.00287
fiscal_year          4    0.7123    0.00009
quarter              4    0.4398    0.00018
month               12    0.1341    0.00108
build_year         123    0.5739    0.00788   <- the largest effect in the file
build_year (as a correlation, not a cut)      rho=+0.0058
container_count           0.9146    rho=-0.0009

terminals also take equal WORK: chi2=41.0 on 49 df (ratio 0.84), p=0.7832, range 262-329
```

**Correction.** This block originally tested `build_year` only as a Spearman
correlation (ρ=+0.0058) and therefore never entered it into the η² ranking, which is how
"terminal, 0.00287" was published as "the largest effect in the file" on five surfaces while
`dim_cut`, the app's KPI tile and `interact.mjs` all carried the true maximum of **0.00788**.
Recomputed independently at audit: k=124 (the model drops one null-year group), η²=0.007892,
KW p=0.5913 - the same conclusion by a wider margin. **A continuous column tested only as a
correlation is not exempt from the categorical ranking**; test it both ways or say which one the
headline refers to.

**Caveat:** with n=15,000 this is well powered - a real effect of even η²=0.005 would show.
This is not "we could not detect it"; it is "there is nothing of that size to detect". Note that
the true maximum, 0.00788, is 79% of Cohen's 0.01 floor rather than the "under a fifth of it"
the first draft claimed - the finding is *below the floor*, not an order of magnitude below it.

**So what:** the brief asks *"which factors most strongly predict longer movement times?"* and
names four candidates. The answer is none of them, and the ranking a dashboard would print
would be a ranking of noise. The 15% reduction target has no lever attached to it in this data.

---

### I2 - Both headline measures are Uniform(0,1000). The dictionary says normal and Poisson.

**Query**
```sql
SELECT move_duration, container_count FROM fact;
-- KS against Uniform(0,1000) and against Normal(mu, sd); skew, kurtosis; var/mean
```

**Output**
```
move_duration    KS vs Uniform(0,1000) p=0.6129   vs Normal p=4.77e-48
                 mean 501.240  sd 289.136  skew -0.0117  kurtosis -1.2065
                 Uniform(0,1000) predicts sd 288.675, skew 0, kurtosis -1.2
container_count  var/mean = 164.86   (Poisson predicts 1.0)
                 1,001 distinct values 0-1000; KS vs uniform p=0.7590
```

**Caveat:** the dictionary documents *generators*, not semantics - so this is a documentation
defect on top of a data one. Both matter: a reader who trusts "normal" will look for outliers
in the tails, and a uniform has no tails.

**So what:** mean `move_duration` is **501 hours - 20.9 days to move one cargo load**, max 41.7
days, min 1.6 minutes, all equally likely. `container_count` runs 0-1,000 uniformly, so a
movement of *exactly zero containers* is as likely as any other. No operational reading of
these columns survives.

---

### I3 - The Suez disruption the brief is built around is not in the data.

**Query**
```sql
-- Ever Given blocked the canal 23-29 March 2021
SELECT date_id, count(*) n, avg(move_duration) dur, sum(container_count) cc
FROM fact GROUP BY date_id;
-- Mann-Whitney: Suez week vs every other day. Then chi-square across 2021's twelve months.
```

**Output**
```
movements/day        Suez week      8.00  vs other days     10.28   MW p=0.056
mean move_duration   Suez week    549.81  vs other days    500.12   MW p=0.504
containers/day       Suez week   4113.86  vs other days   5152.15   MW p=0.135

within 2021: Mar+Apr 260.5/month vs the other ten 247.9/month  (+5.1%)
chi2 across 2021's twelve months: p=0.1200
```

**Caveat:** the Suez week is seven days, so this test is not powerful against a *small* effect
- but the brief does not ask about a small effect. It asks the analyst to "identify when the
disruption occurred", which presumes something findable. Nothing is findable, and the two
months in question run *above* the rest of the year.

**So what:** an analyst under pressure to deliver the brief's headline will find a way to draw
this. The honest answer is that the event left no trace, and saying so is the finding.

---

### I4 - The schema cannot hold the answers either.

**Query**
```sql
SELECT count(*), count(DISTINCT movement_id) FROM fact;          -- 15,000 vs 1,001
SELECT count(*) FROM fact JOIN dim_vessel USING(vessel_key)
  WHERE fact.vessel_id <> dim_vessel.vessel_id;                  -- 909
SELECT count(*), count(DISTINCT date_id) FROM dim_time;          -- 1,461 vs 1,461
```

**Output**
```
movement_id     1,001 distinct over 15,000 rows; 5-26 rows share each value
                KS vs Uniform(0,1000) p=0.2160  -> it is a uniform draw, not an identifier
                exact duplicate rows: 0
two vessel keys vessel_key is the real FK (992 of 1,000 used, 0 orphans)
                vessel_id disagrees with the dimension on 909 of 15,000 rows (6.060%)
                unpatterned: container_count MW p=0.164, move_duration p=0.457
shift           lives on dim_time, which has ONE row per date
regional_hub    longitude by hub KW p=0.1899; lon/lat uniform over the globe
                (KS p=0.5227 / p=0.4126); 7 terminals below 60S, 4 above 70N
route_geometry  a Python repr, not JSON - json.loads fails. dim_terminal.port_location
                IS valid JSON. Two geo columns, two serialisations.
                AND IT IS CONSTANT: 1 distinct value over all 15,000 rows. Start and end
                lon/lat each take exactly one value, so no row has its own route.
                the fixed endpoint sits a median 130 degrees (~14,433 km) from a terminal -
                a statement about where the 50 TERMINALS are, not about any route
```

**Caveat:** referential integrity is otherwise perfect - 0 orphans on every FK, 0 nulls
anywhere. The defects are specific, not general sloppiness, which is why each is worth naming.

**So what:** these are not cosmetic. No unique row key means a movement cannot be corrected or
deduplicated. A 6% corrupt join key means any vessel-level analysis is silently wrong for one
row in sixteen. `shift` on the date dimension means a terminal running two shifts a day cannot
be represented at all - the brief's shift question is not merely unanswerable, it is
*unaskable* of this schema.

---

### I5 - One number in this file is real. It is also the one that will be misread.

**Query**
```sql
SELECT fiscal_year, count(*) FROM fact JOIN dim_time USING(date_id) GROUP BY 1;
-- then: chi2/df of daily counts vs 1,000 simulated multinomials of 15,000 over 1,461 days
```

**Output**
```
2021 = 3,000    2022 = 3,750 (+25.0%)    2023 = 4,050 (+8.0%)    2024 = 4,200 (+3.7%)
48 monthly counts vs time: Spearman rho = +0.8271, p = 4.35e-13

daily chi2/df           OBSERVED 1.1731
simulated multinomial   mean 0.9980, 95th pct 1.0581, MAX 1.1418
                        (1000 reps, seed crc32('daily-allocation'))
-> exceeds the maximum of 1,000 simulations. Not allocation noise.

CONDITIONED ON YEAR, though, the daily allocation is ordinary:
  global   chi2/df  1.1731
    between-year   75.1896 on 3 df   <- this is the ramp, and it is the whole of the excess
    within-year     1.0207 on 1457 df
  year-conditional multinomial, 2000 reps: mean 0.9999, 95th 1.0618, P(sim >= obs) = 0.238

AND ONLY IN THE COUNT:
  move_duration   by year KW p=0.7123
  container_count by year KW p=0.1748
```

**Correction: this is ONE fact, not two.** The ledger presented the daily
chi2/df as evidence *additional* to the yearly ramp. It is not. The excess decomposes almost
entirely into the between-year term, and once each year's total is conditioned on, daily
allocation is indistinguishable from a uniform multinomial (p = 0.238). The month's thesis is
unchanged and slightly stronger for it - there is exactly **one** real signal in this file, the
yearly count ramp, and the daily statistic is that signal wearing a different denominator.
**Before offering a statistic as a second piece of evidence, condition on the first.**

**Note on the yardstick:** this figure moved during G6. `integrity.py` used seed 0 and 400
replications while `model/build.py` used a label-derived seed and 1,000, so the poster
published 1.1418 and the ledger printed 1.1525 for the same quantity - two artifacts, two
numbers, which is the lesson 2026/02 paid for, repeated within a single month. Both now use the
label-derived seed and 1,000 reps and reproduce 1.1418 from independent code; `test_metrics.py`
pins it. The finding is unaffected: 1.1731 exceeds both.

**Caveat:** "movements grow" is a statement about how many *rows* the generator wrote per year.
Whether that represents real commercial growth is not knowable from the file - but it is
genuinely structured, which is exactly what makes it the positive control for I1 and I3. Every
other test in this ledger returns a null; this one does not, so the nulls mean something.

**So what:** 2021 is the lowest year. Put a volume trend on a slide next to a brief about the
2021 Suez disruption and the reader will connect them - and they will be wrong twice over,
because there is no March dip (I3) and the ramp continues through 2024 with no event. **This
chart is the single most dangerous object that can be drawn from this dataset,** which is why
the report draws it with the Suez week marked and empty.

---

### I6 - What would have to be true for the VP's questions to be answerable.

**Query** - not a query. A specification derived from I1-I5, each line traceable to the check
that shows it is missing.

**Output**
```
to answer "where are the bottlenecks":     terminal_capacity  (absent; the brief concedes it)
                                            queue/wait time    (absent - one duration only)
to answer "which terminals underperform":  a unique movement key (movement_id is not one)
                                            arrival + departure timestamps, not a scalar
to answer "do night shifts differ":        shift on the MOVEMENT, not on the date
to answer "which hub was affected":        a hub label tied to geography (it is not)
to answer anything about vessels:          one vessel key, not two disagreeing on 6% of rows
to detect a disruption at all:             a duration that varies with anything (eta2 max 0.0079)
```

**Caveat:** this is the deliverable most likely to be read as an excuse. It is only defensible
because I5 exists - the file *can* carry a real signal, and does carry exactly one, so "nothing
is here" is a measurement rather than a failure to look.

**So what:** the VP asked for a 15% reduction in movement times. The correct answer is that
this data cannot locate a single hour of it, and the cheapest next step is instrumentation, not
analysis. Seven specific columns, listed above, would make the same three questions answerable.

---

## Rejected

Killed claims are published, not deleted.

| Candidate | Why dropped |
|---|---|
| "Suez cut movements 22% during the blockage week" | 8.00/day vs 10.28 looks dramatic and is **p=0.056 on seven days**. A week of a uniform process produces this routinely. The single most tempting claim available, and the one a competing entry will make. |
| "Terminal 34 is the worst performer" | Terminal explains η²=0.0029 of duration and χ²/df across terminals is **0.84** - below chance. Every terminal ranking here is a ranking of noise. |
| "Passenger vessels take longest" | vessel_category p=0.0683, η²=0.00048. Fails at α=0.05 before any correction, and would fail Bonferroni across the seven axes tested regardless. |
| "Night shifts run 2% slower" | p=0.0601, η²=0.00024 - and `shift` is a property of the calendar day, so the quantity being compared is not a shift. |
| "Older vessels are slower" | ρ=+0.0058, p=0.4771. |
| "Volumes recovered strongly after 2021" | True as arithmetic, false as inference. It is a monotonic ramp through 2024 with no event; calling it recovery imports a cause the data does not contain. **This is I5's whole point** and it is recorded here as well because the sentence is so easy to write. |
| "The 909 mismatched vessel rows are a data-quality signal" | Tested against container_count (p=0.164) and move_duration (p=0.457). Unpatterned. It corrupts a join and means nothing else. |
| "Zero nulls means the data is high quality" | Inverted. Real operational data has gaps; a file with no missingness anywhere is evidence of generation, not of rigour. |

## Non-obvious checklist

- [x] two-way interactions - category × terminal, hub × year, shift × category: all noise
- [ ] Simpson's paradox - no aggregate effect exists to reverse
- [x] rate vs volume mismatch - **the spine**: volume is real, every rate is not
- [x] concentration - tested and absent by construction (χ²/df 0.84)
- [x] distribution vs average - the averages are honest, the distributions are uniform
- [x] cohorts - vessels by build_year, no effect
- [x] changepoints - tested at the one date the brief names
- [ ] funnel leakage - no process stages in the schema
- [ ] lead / lag - no candidate pair
- [x] missingness as signal - zero nulls anywhere, which is itself the tell
- [x] survivorship - 8 of 1,000 vessels never move; immaterial
- [x] mix vs performance - the growth is entirely in row count, not in any measure
