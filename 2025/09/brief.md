# Brief - 2025/09 · Credit Risk Analytics (Nova Bank)

**Gate G1 artifact.** Source of truth for what was asked. Everything downstream cites this file.

- **Title:** September 2025 DataDNA - Credit Risk Analytics
- **Challenge page:** <https://datadna.onyxdata.co.uk/challenges/september-2025-datadna-credit-risk-analytics-challenge/>
- **Playground:** <https://datadna.onyxdata.co.uk/playground/2025-09-september-2025-datadna-credit-risk-analytics-challenge/>
- **Dataset ZIP:** sha256 `d209ebed...070b` · per-file checksums in `challenges.yml`
- **Era:** 2
- **Grain:** 32,581 rows × 29 columns, one XLSX with **two sheets** - the data and a **Data Dictionary**.

**Biggest dataset of the programme so far** - 6× May's 5,600 and 16× July's 120. And the
first month where a data dictionary ships with the file.

## Scenario (verbatim, from the in-ZIP DOCX)

> In this challenge, you'll act as a credit risk analyst at Nova Bank, a financial institution
> that provides personal, medical, education, and business loans across the USA, UK, and Canada.
> Nova Bank wants to make lending **fair and accessible** while also protecting itself from
> unnecessary risk.
>
> The main challenge is finding the right balance. If Nova Bank approves too many high-risk
> loans, it loses money. If it becomes too strict, it misses out on potential customers. By
> looking at the data, your job is to help the bank understand who tends to default and why,
> and how lending decisions can be made more reliable.

## Stated objective - "What You'll Do"

| | Ask |
|---|---|
| **M1** | See which groups of borrowers are more or less likely to default |
| **M2** | Identify the factors that matter most when predicting loan outcomes |
| **M3** | Explore how loan size, income, interest rates, and repayment terms affect risk |
| **M4** | Spot early signs of financial trouble so action can be taken sooner |
| **M5** | Suggest ways the bank can adjust lending policies to be both **safer and fairer** |

**Fairness is named twice** - in the scenario and in M5. That is unusual and it is the
highest-stakes thing on this page: a disparate-impact claim, right or wrong, has consequences
no other month's finding has had.

## Explicit requirements - eight questions (verbatim, from the DOCX)

The DOCX closes with *"These questions are just starting points. You're encouraged to explore
the data in your own way and share any unexpected findings."* **Fifth month running the
requirements were inside the archive** rather than on the challenge page.

- [ ] **Q1** Which types of borrowers are more likely to default?
- [ ] **Q2** Do certain loan purposes (education, medical, personal, debt consolidation) carry more risk?
- [ ] **Q3** How do loan-to-income and debt-to-income ratios relate to repayment?
- [ ] **Q4** Does employment type or home ownership make a difference?
- [ ] **Q5** How do past defaults or longer credit histories affect loan outcomes?
- [ ] **Q6** Are there clear differences between borrowers in the USA, UK, and Canada?
- [ ] **Q7** Which loan grades or terms seem safer, and which are riskier?
- [ ] **Q8** Can groups of borrowers be identified that look "safe" versus "risky"?

## Judging criteria - stated on the page this month

September's page carries criteria the earlier months' pages did not. Recorded because they
are directly buildable and this programme already builds all four:

- Are the indicative colours in charts instinctually understandable?
- **Cross-chart filtering** - can other visuals provide relevant data as the user explores?
- **Drill down** - multi-layer exploration; can the user gain additional insight in-report?
- **Tutorial overlays** - can a new user start using the report from in-report guidance alone?

It also states the AI-feedback mechanism explicitly: *"A personalised feedback email will
arrive within 30 minutes, scoring your work across storytelling, design, technical depth, and
insights"*, and *"Once published, your AI scores are visible on your public profile and in the
portfolio gallery."* That confirms rubric A's four dimensions and explains the standing
benchmarking gap - **scores exist but only for published entries, which requires an account.**

## Structural facts established while reading the file

Full evidence at G2. These are load-bearing and they reframe every question above.

**This file is two datasets stapled together.**

Columns 1-13 match the widely-circulated public credit-risk dataset used in teaching and on
Kaggle: same 32,581 rows, same 21.82% default rate, same characteristic missingness
(`loan_int_rate` 3,116 nulls / 9.6%, `person_emp_length` 895). Columns 14-29 were generated
and appended - they have **zero nulls**, and the dictionary itself calls `other_debt`
*"Simulated additional debt held by applicant."*

Testing every column against `loan_status` (Cramér's V for categorical, |point-biserial| for
numeric; Bonferroni α = 2.0e-3 across 25 columns):

| Block | Columns | Max effect | Median effect | Clear Bonferroni |
|---|---:|---:|---:|---|
| **Original 12** | 11 tested | 0.415 (`loan_grade`) | 0.144 | **10 / 11** |
| **Appended 17** | 14 tested | 0.386 | **0.009** | **3 / 14** |

And the three appended columns that *do* predict are **exact restatements**, not new signal:

- `loan_to_income_ratio` = `loan_amnt` / `person_income`, max error **9.7e-17** - and it
  correlates **0.9989** with the original `loan_percent_income`. Same column, more decimals.
- `debt_to_income_ratio` = (`other_debt` + `loan_amnt`) / `person_income`, max error 4.4e-16,
  where `other_debt` = `person_income` × U(0.05, 0.30). It is loan-to-income plus a uniform
  draw, and its effect is *weaker* than the column it dilutes (0.322 vs 0.386).

**The column a credit analyst reaches for first is a random draw.**

| `past_delinquencies` | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|---:|
| n | 19,702 | 9,829 | 2,586 | 405 | 54 | 4 | 1 |
| default % | 21.77 | 22.02 | 21.19 | 23.21 | 22.22 | 25.0 | 0.0 |

χ² of the 7×2 contingency table against `loan_status`: **p = 0.9513**, Cramér's V = 0.0070. It
is a Poisson(λ=0.505141) draw, goodness-of-fit **p = 0.5081**. Meanwhile the *original*
credit-history column looks like it works exactly as it should: `cb_person_default_on_file`
= N → **18.39%**, Y → **37.81%**, a 2.06× crude lift.

> **G3 outcome: that 2.06× is grade composition, not signal.** Grades A and B contain **0 of
> 21,228** prior defaulters; stratify by grade and the largest difference within C-F is 3.55pp,
> in the *opposite* direction in four of five grades. `cb_person_default_on_file` is an input to
> the grade. See `analysis/insights.md` I13. Left here as the G1 reading, corrected in place so
> that no downstream file can cite it uncaveated.

**Q5 asks about "past defaults or longer credit histories" and the file offers three columns for
it - one a Poisson draw, one `person_age` at r=0.859 under another name, one the credit grade
viewed sideways.** An analyst who picks the precise-sounding one concludes that past delinquency
does not predict default; one who picks the crude lift concludes it doubles the risk. Both are
wrong. **The file's answer to Q5 is that it has none.**

## Thesis (survived G3 - after being rewritten twice)

> **Nine per cent of Nova Bank's book defaults 100% of the time - 2,988 loans, zero
> exceptions - under two conditions you can write on an index card. That is 42% of every
> loss, priced fourteen basis points above the renters in the 20-30% loan-to-income band
> beside it.**

```
RENT & loan_percent_income > 0.30          n=2,345   100.0000%   0 exceptions
grade D-G & DEBTCONSOLIDATION & not OWN    n=  741   100.0000%   0 exceptions
union                                      n=2,988   100.0000%   0 exceptions   $41.6M
```

The wall is **tenure-specific**: renters step from 28.5% to 100.0% between an LTI of 0.30
and 0.31, while mortgage-holders cross the same line at 15.7% → 21.6% and owners at
14.3% → 17.9%. And it is **not priced** - renters at 20-30% LTI default 26.01% and pay
11.75%; above the line they default 100% and pay 11.89%. Even 496 **grade-A** renters above
the line default at 100%, priced at 7.53% (a mean over the 447 of them that carry a rate at
all; 49 have none and nothing is imputed).

**The comparison band is a choice, and 20-30% is the one published.** The gap is not stable
across bands - 0.10-0.30 gives +42.69 bp, 0.25-0.30 gives +7.93 bp, 0.27-0.30 gives -0.63 bp,
and the single bin at exactly 0.30 gives +23.18 bp. Every band from 0.10 upward stays inside
±43 bp of zero while default steps from ~26% to 100%, which is the actual finding; the band is
named in the UI rather than implied by "just below". Full table: `analysis/insights.md` I6.

**And the 100.0000% is downstream of rounding.** `loan_percent_income` is 2dp in the source and
the rule reads that rounded column; re-run on the full-precision `loan_to_income_ratio` the same
condition gives **97.0744% over n=2,461** (`insights.md` I18).

**This replaced two earlier candidates**, both killed at G3 and both recorded rather than
deleted:

1. *"A fairness audit here returns a clean bill of health, and that answer is manufactured."*
   The finding survives; the **reasoning did not**. It inferred "the generator made the
   demographics independent" from five null results - and "there genuinely is no demographic
   effect in this book" predicts exactly the same p-values. That is the error that killed a
   thesis in 2025/06 and two claims in 2025/08. It is now supported by **positive** tests
   (below) and demoted to a supporting panel.
2. *"The price ladder is smooth; the risk ladder has a cliff."* **False as written** - price
   tracks grade almost perfectly. And the C→D cliff it named is partly rule composition:
   grade D falls from 59.05% to **46.33%** once the two rules are removed.

**And a correction to my own method.** An earlier draft of check 10 dismissed the lookup-rule
hypothesis because 203 of 2,629 renters above the line do not default. The boundary is
`> 0.30`, not `>= 0.30` - all 203 sit at exactly 0.30. A real attempt to falsify the claim
failed because it tested the boundary one bin too wide, and it disguised a deterministic rule
as a gradient.

## What the fabrication finding becomes

Still true, now argued **positively** rather than from nulls:

- **1,421 of 1,635 "Unemployed" applicants (86.9%) report a current job** averaging **5.4419
  years**, earning a median $55,016 against $55,400 for the full-time employed (p=0.665).
  A logical contradiction inside a single row is not a p-value. *(The mean over all 1,635 who
  report a value is 4.7297 - it is dragged down by the 214 who correctly report zero years and
  are not a contradiction. An earlier draft paired the 1,421 count with the 1,635-based mean;
  `insights.md` I15.)*
- Widowed borrowers are *younger* than single ones; PhDs earn *less* than school leavers and
  average 27.9 years old; all 18 cities are drawn uniformly (p=0.949).
- **Differential treatment**, the test a fair-lending examiner actually runs: 20 tests of
  demographic against price, grade, size and term. **0 clear Bonferroni**, largest η²=0.00029.
- **There is no application, decision or approval column.** Every row is a funded loan, so
  approval-stage fairness is untestable here **even if every demographic column were real** -
  an argument that needs no claim about the generator at all.

## Verifying the brief's own claims against the file

The June lesson.

| Brief says | File says | Verdict |
|---|---|---|
| "personal, medical, education, and business loans" | 6 intents: PERSONAL, MEDICAL, EDUCATION, VENTURE, HOMEIMPROVEMENT, DEBTCONSOLIDATION | **partial** - no "business" - VENTURE is the closest; HOMEIMPROVEMENT and DEBTCONSOLIDATION are unnamed |
| "across the USA, UK, and Canada" | 3 countries, 9 states/provinces, 18 cities | **holds** |
| "make lending fair and accessible" | demographics are independent of outcome by construction | **fails** - the file cannot evaluate this |
| Q3 loan-to-income *and* debt-to-income | one is the other plus a uniform draw | **partial** - two questions, one variable |
| Q5 past defaults | two columns; one works, one is noise | **partial** - answerable only if you pick the right one |

## Submission mechanics (THIS month)

- **Tags:** @OnyxData, @ZoomCharts, @EnterpriseDNA, @BCS (The Chartered Institute for IT),
  @SmartFramesUI, @DataCareerJumpstart
- **Hashtag:** `#dataDNA` · **single image only** · follow Onyx Data on LinkedIn
- **Resubmissions are not permitted** - stated explicitly on the page this month
- **Sponsor mini-challenge:** ZoomCharts Drill Down visuals for **Power BI** - out of scope by
  stack choice (SolidJS), not oversight

## Benchmark

Still qualitative. The page confirms AI scores exist but are visible only on *published*
portfolio entries, which requires a DataDNA account; every entry scraped so far
carried `data-score="0"`.

**What the field will predictably do here:** a default-rate breakdown by demographic, a
loan-grade risk ranking, and a "risk factors" chart that puts `past_delinquencies` next to
`loan_grade` as though they were comparable. The first manufactures a fairness verdict, the
second is real, and the third is half noise.

## Lessons applied from .workbench/docs/LEARNINGS.md

1. **Read every file, and every sheet.** The Data Dictionary is sheet 2 - and it is what
   revealed `other_debt` as "simulated" in the publisher's own words.
2. **Check every numeric column for being a deterministic function of another** - it caught
   both ratio columns immediately.
3. **Before claiming an axis explains a metric, ask whether the metric was constructed from
   it** - and its converse this month: ask whether the axis was constructed *independently* of
   the metric, which is what makes a null result meaningless as reassurance.
4. **When nothing is significant, compute what would have been detectable.** At n=32,581 the
   MDE ranges from **1.28pp to 3.15pp** on a 21.82% base rate - 5.9% to 14.5% relative -
   depending on the demographic: gender 1.28pp, country 1.57pp, employment type 2.95pp,
   marital status 2.99pp, education 3.15pp. **The single figure is the best case and belongs to
   the only demographic with two near-equal groups**; the comparisons an examiner would run
   first (widowed n=1,647, PhD n=1,498) could only have detected ~3pp. Quoting 1.28pp alone
   overstates the result by about 2.5× for those groups. That range is what turns "no
   disparity" into a real statement about the *file* - and stops it being read as a statement
   about the bank. `analysis/insights.md` I16.
5. **A bounded/odd column is worth one more question** (August). Here: two columns claim to
   measure credit history. Ask which one is real before answering Q5.
