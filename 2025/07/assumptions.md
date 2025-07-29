# Assumptions - 2025/07 · Customer Satisfaction & Loyalty

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/06/DataDNA-Dataset-Challenge-Customer-Satisfaction-Dataset-July-2025.zip` |
| Challenge page | `https://datadna.onyxdata.co.uk/challenges/july-2025-datadna-customer-satisfaction-and-loyalty-analytics-challenge/` |
| Retrieved | 2025-07-29 - direct ZIP (Era 2, no login wall), validated by `PK\x03\x04` magic bytes rather than HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution, so G1 benchmarking against published entries is valid. |
| Expected rows / actual rows | 120 / **120**. All 120 survive into `fct_customer`; the row-drop log is empty and `build.py` asserts it. |
| sha256 (ZIP) | `c02364e7313f98d133628ca5208d22a697f883d65276b753551f4f6551ad75b0` |
| Files in the archive | 1 CSV (the data), 1 DOCX (the brief - **carries the nine questions, which the challenge page does not**), 1 TXT, 2 PDFs (ZoomCharts material, unused) |

## Business semantics

The brief asks nine questions and defines none of its terms. Everything below is my reading. Each
one that changes what the reader sees is also stated in the UI at the point of use.

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| `Satisfaction_Score` | An **interval** score on 1-10, so means and confidence intervals are meaningful | The report is built out of means with intervals; on a fully-populated 10-point scale with a flat distribution this is the conventional treatment | Treat it as **ordinal**, which licenses only medians and rank tests. Mitigated rather than argued: every published p-value is a Kruskal-Wallis, a rank test. The means are descriptive; no inference in the report depends on the interval reading. |
| `Loyalty_Level` (Low / Medium / High) | A **nominal** three-level category | The observed ordering against satisfaction is non-monotonic - Low 5.84 > High 5.65 > Medium 4.47 - so an ordinal test would impose structure the data contradicts | Treat it as ordinal and use a trend test. That would report a *stronger* result off an ordering the data does not show; the nominal χ² is the conservative choice. |
| "Loyal" (R2, R5, R7) | `Loyalty_Level` - **not** satisfaction, and not `Purchase_History` | The file has a column literally called loyalty. Answering a loyalty question with a satisfaction test is what the first revision of this report did, and it was wrong (**I-6**) | `Purchase_History = Yes` as a behavioural proxy. Both are reported: repeat buying is tested against loyalty (χ² p=0.32) and against satisfaction (KW p=0.29). |
| "Location" (R3, R7) | Both grains - **city** (10 values, from the raw `City.ST` field) and **state** (6 values, split out) | R3 says "cities or states", and the thin-cell problem is visible at whichever level the reader picks | City only. That is the raw field, but it puts 19 of 30 city×loyalty cells below n=5 and leaves one empty. |
| Age bands | 25-34 / 35-44 / 45-54 / 55-60 | Ten-year bands, declared once in `model/build.py` so the tests and the UI cannot drift. The observed range is exactly 25-60. | Quartiles of the observed distribution. Rejected: cuts chosen after seeing the data are a forking path. Age is also tested **continuously** (Pearson r=+0.020, p=0.827), so the banding is not load-bearing. |
| "Underpowered" (the ⚑ flag) | Any group with **n < 64** | 64 is the n per group needed to detect a 1.5-point difference at α=0.05 and 80% power, given the observed sd of 3.03 (**I-4**) | A different reference difference moves the threshold - 1.0 point would flag everything below n=144. 1.5 was chosen because it is roughly the study's own detection floor, so the flag reads "cannot see a difference even the size of what this study could barely see". |
| The multiple-comparison family | **8** tests of satisfaction (α=0.00625) and **18** between-group tests in all (α=0.0028) | A test you publish is a test you ran. The first revision declared a family of seven while publishing an eighth (the age correlation) | Count only the pre-registered seven (α=0.0071), or count every figure including the goodness-of-fit test and R4's t-test (α=0.0025). **All four thresholds give the same verdict** - the smallest p anywhere is 0.0231. Because the conclusion does not depend on where the family is drawn, the UI states both defensible boundaries rather than quietly picking one. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| No rows dropped | **0 of 120** | Zero nulls in any column, zero duplicate rows, `Customer_ID` unique 120/120. The row-drop log in `build.py` is empty. |
| `Location` split into `city` + `state` | 120 (all) | The source packs `City.ST` into one field. Split so R3 can be answered at either grain; the raw `location` column is carried through unmodified alongside. |
| No date dimension built | n/a | There is **no date column**, despite the brief describing "feedback throughout 2024". An empty date dimension would imply a time analysis the data cannot support. `test_there_is_no_date_column` fails if one ever appears. |
| `Latitude` / `Longitude` carried, not analysed | 120 | Both are 1:1 with `Location` - 10 distinct values each for 10 cities. They are a lookup, not a measurement. No map is drawn: with 10 points and no detectable spatial effect, a choropleth would be decoration implying a finding. |
| Scale treated as complete 1-10 | 120 | All ten scale points are populated. `test_I1_satisfaction_is_flat` fails if that stops being true. |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can
> reproduce. Nothing was lost this month.

## Known limitations

- **n=120 is the finding, and it also limits the finding.** Absence of evidence at this sample size
  is not evidence of absence. Every "no detectable difference" here means *this data cannot show
  it*, never *it does not exist*. The colophon says so and I-2's caveat says so.
- **Four of the eighteen χ² tables are too thin for the approximation.** `Loyalty ~ Location` has a
  smallest expected cell of 1.85; `Factor ~ Age_Band` has every expected cell below 5; `Factor ~
  Gender` has five of twenty below 5. Those p-values are indicative at best, and each is stated
  with its expected-cell count in I-6 and in the Explore drawer.
- **The permutation p in I-5 is a Monte-Carlo estimate.** 0.0250 is `integrity.py` at seed 0 and is
  exactly reproducible; five other seeds give 0.0257-0.0312 at 4,000 draws. "About one time in
  forty" is the right precision to publish it at.
- **Test statistics in the UI are frozen at the whole-study value** and deliberately do not respond
  to the cross-filter - re-running a hypothesis test against a subset the reader assembled by
  clicking is a garden of forking paths, not evidence. Every such figure carries an "all 120" badge
  at its point of use; every mean, n, interval and required sample size beside it *is* reactive and
  does move.
- **No spend, no order value, no timestamp.** Satisfaction cannot be tied to behaviour or to trend
  at any sample size. That is recommendation 3, and it is a limitation of the file rather than of
  the analysis.
- **Not deployed.** `docs/STACK.md` defers deployment; the deliverable is the local app plus the
  2560×1440 poster.
