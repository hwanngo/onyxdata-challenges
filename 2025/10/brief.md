# Brief - 2025/10 · Consumer Financial Complaints (CFPB)

**Gate G1 artifact.** Source of truth for what was asked. Everything downstream cites this file.

- **Title:** October 2025 DataDNA - Consumer Financial Complaints Analytics
- **Challenge page:** <https://datadna.onyxdata.co.uk/challenges/october-2025-datadna-consumer-financial-complaints-analytics-challenge/>
- **Dataset ZIP:** sha256 `73a60d72...c384` · per-file checksums in `challenges.yml`
- **Era:** 2
- **Grain:** **62,516 complaints × 19 columns**, plus a **1,081-row Company dimension** and a
  Data Dictionary - three sheets.

**The programme's largest fact table** (62,516, vs September's 32,581) and its **first genuine
two-table star** rather than one flat file.

## Scenario (verbatim, from the in-ZIP DOCX)

> Step into the role of a data analyst at the Consumer Financial Protection Bureau (CFPB), a
> U.S. government agency ensuring fairness and accountability in the financial sector.
>
> The CFPB collects complaints from consumers across the United States regarding financial
> products and services. Each complaint is tracked from submission through company response.
>
> You've been provided with a dataset of consumer complaints spanning multiple financial
> categories, locations, and companies. Your mission is to create an analytical report that
> identifies patterns in complaints, evaluates company responses, and highlights areas of
> concern for regulators and consumers.

> Your insights could help regulators strengthen consumer protection policies, support
> journalists in highlighting financial fairness issues, and provide consumers with more
> transparency about financial institutions.

## Explicit requirements - eight questions (verbatim)

**Sixth month running the requirements were inside the archive.** The page and the DOCX agree.

- [ ] **Q1** When do complaints rise or fall over time?
- [ ] **Q2** Which states and regions are hotspots?
- [ ] **Q3** Which products and sub-products drive the most complaints?
- [ ] **Q4** Which issues and sub-issues are most common or most severe?
- [ ] **Q5** How fast, and how timely are company responses to complaints?
- [ ] **Q6** Which companies show the highest complaint rates **relative to market share**?
- [ ] **Q7** Do company traits (size tier, reputation, enforcement history) correlate with outcomes?
- [ ] **Q8** Do submission channels differ in response speed or outcomes?

## Verifying the brief's own claims against the file

The June lesson, and it pays immediately.

| Brief says | File says | Verdict |
|---|---|---|
| "complaints ... across the United States" | 51 states, 4 census regions, 9 divisions | **holds** |
| "multiple financial categories" | 9 products, 76 issues | **holds** |
| "tracked from submission through company response" | submit → receive → respond, all present | **holds** |
| "...help **Nova Bank** lend more responsibly" | **September's brief text, left in by copy-paste** | **fails** - the closing note is from the wrong month |
| Q7's "size tier, reputation, enforcement history" | all three exist - and none correlates with anything | **partial** - see below |

## Structural facts established at G1

**This is the first month in the programme where everything reconciles** - with one asterisk
that turned out to matter. Four of the five identities the Data Dictionary states hold exactly
on any reading. The fifth holds only on the denominator this month rejects:

| Stated identity | Result |
|---|---|
| `Response_Time_Days` = `Company_Response_Date` - `Date submitted` | **62,516 / 62,516** exact |
| `Complaint_Count` = count from the fact table | **1,081 / 1,081** exact; totals 62,516 |
| `Timely_Response_Rate` = share of `Timely response? = Yes` | **exact on 1,081 / 1,081 - over ALL rows.** On the resolved denominator it fails on **815 / 1,081**, max error 0.1040. See below. |
| `Avg_Response_Time_Days` = mean of the fact | exact |
| `Complaints_per_1pct_Share` = `Complaint_Count` / `Market_Share_Percent` | exact to 5e-05 |

> **Correction.** An earlier draft of this table said "exact" for `Timely_Response_Rate` and
> `analysis/integrity.py` computed the rate and then never asserted on it - so the identity was
> printed as verified while being untested. It *does* hold, exactly, but only when the 1,494
> in-progress complaints are counted as untimely. Count-weighting the shipped column reproduces
> **93.7664%** - the very figure this brief records below as the wrong headline. The file's own
> company dimension ships the denominator the analysis calls the easiest wrong number to
> publish from it. Asserted in `integrity.py` §2 as of the audit remediation.

No orphan foreign keys. All 1,081 companies appear in the fact. Market share sums to 99.9955%.
**There is no data-quality thesis available here** - which is the right kind of problem to have,
and forces an affirmative analysis.

### The finding is not a defect. It is correct arithmetic producing a wrong conclusion.

**Q6 asks which companies have the highest complaint rate relative to market share, and the
dataset ships the answer as a column.** That column is arithmetically perfect and analytically
empty:

| | |
|---|---|
| corr(`Market_Share_Percent`, `Complaint_Count`) | **-0.048** Spearman (p = 0.11) - *no relationship* |
| corr(1 / `Market_Share_Percent`, `Complaints_per_1pct_Share`) | **+0.990** Spearman |
| corr(`Complaint_Count`, `Complaints_per_1pct_Share`) | **+0.177** Spearman |

Every company receives about the same number of complaints regardless of its size:

| Size tier | n | Mean market share | **Mean complaints** | Mean KPI |
|---|---:|---:|---:|---:|
| Large | 108 | 0.3021% | **57.1** | 203.6 |
| Medium | 216 | 0.1502% | **58.0** | 400.2 |
| Small | 757 | 0.0461% | **57.9** | 2,244.1 |

Complaint count does not vary by tier (Kruskal **p = 0.557**), while the KPI varies **11-fold**
- entirely through the denominator. The ten "worst offenders" by the shipped metric are ten of
the smallest firms in the file, every one sitting at the minimum share of 0.0099%.

**A regulator who ranks on this column targets small companies for being small.**

### Q7 has a clean null

Reputation score, enforcement history and size tier correlate with nothing:

| Trait | → timely rate | → complaint count |
|---|---|---|
| `Reputation_Score` | ρ=-0.019, p=0.53 | ρ=+0.031, p=0.30 |
| `Enforcement_History` | KW p=0.559 | KW p=0.389 |
| `Company_Size_Tier` | KW p=0.209 | KW p=0.557 |

To be reported with a power calculation at G2, per the July rule - a null is only worth
publishing alongside what would have been detectable.

### What is real, and where the analysis lives

The **fact table** carries genuine structure and is where Q1-Q5 and Q8 are answerable:

- **96.06%** timely response *among resolved complaints*. **Correction:** an earlier draft of
  this brief published **93.77%**, which counts the 1,494 still-in-progress complaints as
  untimely. `Timely response?` is null on exactly those 1,494 rows and nowhere else - perfect
  structural missingness - so they belong out of the denominator, not in it as failures.
- Products skew hard: Checking/savings **24,814** (39.7%), Credit card **16,197** (25.9%)
- Outcomes: Closed with explanation 41,044 (65.7%), monetary relief 14,697 (23.5%)
- Channels: Web 45,423 (72.7%), Referral 10,766, Phone 4,684, Postal 1,318, Fax 233
- Regions: South 23,152, West 20,027, Northeast 12,674, Midwest 6,663
- Dates span **2017-05-01 → 2023-08-28** across 76 months, with a real trend of **+8.70
  complaints/month** (r=0.797) - volume grows **1.71×**, not "roughly triples"

  > **Correction.** An earlier draft of this brief said "+8.25/month" and "roughly triples".
  > The +8.25 figure included the known-partial final month, which the same brief says must
  > never be used; full months only give +8.70. And 1.71× is not "triples" - `integrity.py`
  > printed 1.7× while this file claimed triples, so my own artifacts contradicted each other.
- Response times are bounded 0-30 days **and are a uniform random draw** (χ² p=0.071, mean
  15.088 against 15.000 expected), uniform *within* every channel, product and region too

## Thesis (survived G3 - after two rewrites)

> **This file is two datasets stapled together, and only one of them is a record of anything.**
> The consumer side is a real complaint register: complaint IDs advance with the calendar in
> every one of the 75 month-to-month steps (ρ=0.99999), it has weekends (Sat 0.52, Sun 0.37 of
> expected), its product/issue taxonomy is strongly hierarchical (63 of 76 issues under exactly
> one product), and its channel mix migrates from paper to web across six years. The company
> side is a **uniform random overlay** - complaint counts fit an equal-share multinomial at
> χ²/df = 1.0395 (p=0.179), response time is U(0,30), and no company-identifier association
> test clears Bonferroni. **So the file supports supervision *priorities* and answers nothing
> about supervision *targets*** - and the two questions it appears to answer best, Q6's shipped
> KPI and Q5's response time, are the two computed entirely from the fabricated half.

> **Two corrections inside the thesis paragraph**, both found by the integrity pass and both
> asserted in `integrity.py` rather than merely reworded.
>
> 1. *"IDs issued in strict date order."* **False as worded.** ρ = 0.9999878 is right, but
>    sorting by `Complaint ID` and walking the sequence, **7,036 of 62,515 adjacent pairs
>    (11.25%) move backwards in date**, by a median of one day. "Strict" means zero. What
>    survives - and is what a real intake queue looks like - is that the sequence is monotone
>    at the month grain: the median ID rises in all 75 steps.
> 2. *"The three traits are two uniforms and a coin flip."* **Wrong on two of the three.**
>    `Reputation_Score` is uniform (χ² p=0.421). `Market_Share_Percent` is **not** (KS p<1e-10;
>    mean 0.0925 against a uniform midpoint of 0.3246, skew +1.95). `Enforcement_History` is
>    **211/1,081 = 19.52% Yes**, not a coin flip (binomial p = 1.8e-95). The *conclusion* the
>    sentence supported is untouched: 0 of 12 trait→outcome tests clear Bonferroni. Only the
>    description of the shapes was wrong - inside the paragraph the whole month rests on.
>    "Uniform random overlay" is now defended by the multinomial fit, which is a positive test,
>    rather than by a distributional description that does not hold.

**Two earlier candidates were killed at G3**, both recorded rather than deleted:

1. *"The Q6 metric ranks companies by how small they are."* True, verified, and **one-ninth of
   the story**. It survives as a supporting panel - it is what every other entrant will publish.
2. *"Every company-side signal is noise; every consumer-side signal is real."* Half-true in the
   wrong direction on both halves. It **understated** the company side (a uniform overlay is a
   far stronger claim than "noise") and gave the consumer side **a free pass it had denied the
   company side** - three of the numbers I published from it were wrong.

**And "nothing is broken" was false.** I tested only *within-column* identities. Four hold on
any reading and the fifth on a denominator I reject elsewhere,
and the table is still logically inconsistent: **2,150 complaints (3.44%) were answered before
they were received** (up to 259 days early), and **all 1,494 "In progress" complaints carry a
response date**. `Response_Time_Days` is the only date arithmetic in the file that ignores
`Date received`, which is exactly what generates those rows.

## Notes for later gates

- **Dates arrive as Excel serial integers**, not dates (`Date submitted` 42856-45166). Every
  entrant will hit this; it belongs in `assumptions.md` and the build.
- `Date received` equals `Date submitted` on 49,634 of 62,516 rows (79.4%) - the 20.6% that
  differ need a look at G2.
- **Reserved-word list grew again:** `days` and `share` both collided in DuckDB this month.
  Running total: `rows`, `second`, `month`, `date`, `yes`, `days`, `share`.

## Benchmark

The October page states the scoring explicitly: **1-5 across Storytelling, Design, Technical and
Insights**, and - usefully - *"A score of 3 represents solid, competent work. Scores of 4-5
require exceptional evidence in that dimension."* That is a calibration I should apply to my own
scorecards, which have been generous.

**What the field will predictably do:** rank companies by `Complaints_per_1pct_Share` and
publish a "worst offenders" table of small firms.
