# Brief - 2026/07

- **Title:** July 2026 DataDNA - Global AI Adoption & Workforce Displacement Index
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/july-2026-datadna-global-ai-adoption-workforce-displacement-index-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-07-july-2026-datadna-global-ai-adoption-workforce-displacement-index-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/06/DataDNA-Dataset-Challenge-2026-07-Global-AI-Adoption-Workforce-Displacement-Index.zip
- **sha256:** `dd6227b409fde8dba039ee0d071e608e9dabbe56fe90dec045d193fd579d9c5b`
- **The last ungated month.** Everything remaining after this is Era 1, behind a login.

## Scenario

> "Analyze a global labour market dataset tracking AI adoption, workforce displacement, job
> creation, and reskilling investment across countries, industries, and skill categories from
> 2021-2024."

The archive's own `CHALLENGE_BRIEF.md` is far more specific, and names the stakes:

> "You are a **labour market analyst at a global think tank** advising governments and employers...
> Your think tank has been commissioned by an **international policy coalition** to produce a
> briefing on AI-driven workforce displacement and reskilling needs... **Your findings will
> directly inform funding allocations for national reskilling programmes due to be announced
> later this year.**"

**Persona:** the policy coalition deciding where national reskilling money goes.

That last sentence is the reason this month's deliverable is what it is. The question is not
"what does the data say" but **"what can this file support a funding decision on"**.

The archive brief also states, in bold, that **"Data is synthetic"** - the first month in this
programme where the source says so upfront. It is worth taking at its word and testing what the
synthesis actually encodes.

## Stated objective

> "Uncover how artificial intelligence is reshaping the global workforce, identify industries and
> skills most vulnerable to AI-driven disruption, evaluate whether reskilling investment is
> keeping pace with workforce displacement, and highlight where governments and policymakers
> should prioritise intervention."

## Explicit requirements

Two lists again - **thirteenth month running that the ZIP carries requirements the challenge page
does not.**

### A. Challenge page - "Challenges & Analysis Directions" (12)

- [ ] Fragmented visibility across countries, industries, skill categories, and time periods
- [ ] Variations in AI adoption between developed and emerging economies
- [ ] Workforce displacement risk differs significantly across industries and skill categories
- [ ] AI adoption acceleration since generative AI emergence
- [ ] Misalignment between job displacement and job creation rates
- [ ] Uneven reskilling investment across countries and industries
- [ ] High AI adoption doesn't guarantee positive workforce outcomes
- [ ] Uneven AI adoption patterns due to infrastructure and talent disparities
- [ ] Limited visibility into relationships between adoption, displacement, reskilling, and outcomes
- [ ] Complex cross-dimensional interactions remain under-analysed
- [ ] Data confidence and reporting quality variations across regions
- [ ] Disconnect between AI trends and broader economic outcomes

### B. Archive `CHALLENGE_BRIEF.md` - 4 analysis areas, 11 guiding questions

**Temporal:** how has `ai_adoption_rate` changed quarter over quarter since the generative AI era
began · is displacement accelerating or stabilising across 2023-24 · which quarters show the
steepest rise in `ai_tool_usage_hours_per_week`.

**Industry & skill:** which industries combine high `automation_susceptibility` with low
`avg_ai_investment_pct_revenue` · which skill categories show the largest gap between
`ai_replaceability_score` and `median_reskilling_duration_months` · **are creative and
interpersonal skills more resilient than administrative or manual ones**.

**Country:** how does `displacement_risk_index` correlate with `digital_infrastructure_score` and
`stem_graduates_per_100k` · do countries with mature `ai_policy_maturity` show better
creation-to-displacement ratios · which regions show the widest developed/emerging gap.

**Reskilling:** is `reskilling_investment_usd` keeping pace with `jobs_displaced_count` · which
country × industry shows the largest shortfall between displacement risk and reskilling spend.

## The file

| Table | Rows |
|---|---|
| `fact_workforce_ai_index` | 300 |
| `dim_country` | 30 |
| `dim_industry` | 25 |
| `dim_date` | 16 (2021-Q1 → 2024-Q4) |
| `dim_skill_category` | 8 |

All four foreign keys resolve with **0 orphans**, and every dimension row is used. `index_id` is
unique across all 300 rows.

`analysis/integrity.py` tests **30 claims. 19 fail.**

### There is no panel

30 countries × 25 industries × 8 skills × 16 quarters is **96,000 cells**. 300 are filled -
**0.31%**. And they are spread, not clustered: there are **292 distinct (country, industry,
skill) segments across 300 rows**. Eight segments appear twice; none appears three times.

**A quarter-over-quarter change is computable for 8 of 292 segments.** The brief's three named
Temporal Trends questions are all *population*-level, so all three are answerable and all three
are answered below. What no question on this page can be given is a **segment**-level trend: any
per-segment "trend" here is a comparison of *different segments* observed at different times.

One thing that is *not* wrong: the rows per quarter are stable (12-26, slope -0.14/qtr,
p = 0.564), so an aggregate over time is at least not confounded by a shifting sample size.

### The one real signal - and it is a step, not a trend

Mean `ai_adoption_rate` by quarter:

```
2021-Q1  19.2   2022-Q1  16.7   2023-Q1  34.2   2024-Q1  45.7
2021-Q2  22.4   2022-Q2  19.6   2023-Q2  38.8   2024-Q2  37.3
2021-Q3  21.2   2022-Q3  22.5   2023-Q3  38.2   2024-Q3  33.3
2021-Q4  20.2   2022-Q4  40.2   2023-Q4  38.6   2024-Q4  39.9
                         ^^^^ generative_ai_era = True from here
```

Fit a line and you get **+1.69pp/quarter, R² = 0.676, p = 0.0001** - significant, and a
misdescription. A **step at 2022-Q4 fits 3.61× better** (residual SS 128.9 vs 465.2), and within
each era the slope is **-0.001pp/qtr (p = 0.997)** before and **+0.013pp/qtr (p = 0.980)** after.
Both are indistinguishable from perfectly flat.

**What happens is: 20.24% for seven quarters, then 38.47% for nine. One jump of +18.23pp.**
Row-level Mann-Whitney p = 1.1e-21, Cliff's d = **-0.644** - large, and real.

That is the **positive control**: the instrument works, so everything below is a measurement
rather than a failure to look. But it also cannot answer the question it appears to. The step
lands exactly on the `generative_ai_era` flag, which is a *column of the date dimension*. The
data does not discover the date; it was built around it. And "is displacement accelerating across
2023-24?" has an answer: no - nothing has moved for eight quarters.

### Nothing else predicts anything

| The brief / page asks | Result |
|---|---|
| Do developed and emerging economies adopt differently? | **30.98% vs 30.22%, Kruskal p = 0.823** |
| Does adoption track GDP per capita? | ρ = -0.031, p = 0.599 |
| ...digital infrastructure? | ρ = -0.061, p = 0.292 |
| ...internet penetration? | ρ = -0.017, p = 0.777 |
| ...STEM graduates? | ρ = +0.008, p = 0.886 |
| Does `displacement_risk_index` track `automation_susceptibility`? | ρ = **-0.018**, p = 0.761 |
| ...`ai_replaceability_score`? | ρ = **+0.014**, p = 0.814 |
| ...`digital_infrastructure_score` / `stem_graduates_per_100k`? | ρ = -0.066 / -0.079 |
| Does displacement risk differ by skill category? | **Kruskal p = 0.770, η² = 0.007** |
| Is reskilling investment keeping pace with displacement? | ρ = **+0.107**, p = 0.065 |
| Does `data_confidence_score` separate anything? | adoption p = 0.311, risk p = 0.224 |

`displacement_risk_index` is documented as *"a composite 0-10 score estimating a segment's
exposure to AI-driven job displacement"*. It is uncorrelated with every attribute in the file
that describes exposure. Its only strong relationships are with `jobs_displaced_count` (ρ = 0.38)
and `jobs_created_count` (ρ = 0.35) - and those two are the same number twice, see below.

Concretely: **Manual Skilled Trades** has the highest `ai_replaceability_score` in the file
(79.6) and the *fourth* highest observed risk (4.26). **Cognitive & Analytical** has the lowest
replaceability (20.9) and the *sixth* (4.20). The spread across all eight categories is 3.96-4.56.

### `jobs_created` is not an independent measurement

```
jobs_created = 0.4157 × jobs_displaced + 174.7      R² = 0.807,  Spearman ρ = +0.956
ratio created/displaced:  min 0.201   max 0.899   - never once above 1
```

**0 of 300 rows have created > displaced.** Net across the file: **-290,430 jobs.** The challenge
page names *"misalignment between job displacement and job creation rates"* as an analysis
direction, and the archive brief asks *"where is job creation offsetting displacement?"* The
answer is nowhere, and it is nowhere **by construction** rather than by measurement.

### And the reskilling number that matters

Total reskilling investment **$61,651,485** against **586,785** displaced jobs.

**$105.07 per displaced worker.**

### Four more defects

| # | Defect |
|---:|---|
| 1 | **`gdp_per_capita_usd` is ~500× too large** - range $4.13m to $42.27m, median $18.47m. Germany ($42.27m) outranks the United States ($33.59m). Real-world GDP per capita tops out near $130,000. |
| 2 | **`ai_policy_maturity` for the United States is `Nascent`**, the lowest of four levels. |
| 3 | 9 nulls each in `avg_wage_change_pct` and `ai_tool_usage_hours_per_week`, and **no row is null in both** - so 18 distinct rows (6%) are affected. Undocumented, and spread over 7 quarters and 8 countries with no concentration. |
| 4 | `data_confidence_score` spans 0.34-1.00 and separates nothing (p = 0.31 / 0.22), though the challenge page lists reporting-quality variation as an analysis direction. |

## The G1 lead, and its risk

The candidate thesis: **this file knows one date and nothing else.** The only real signal is a
single +18.23pp level shift that lands exactly on a flag the date dimension already carries, and
is perfectly flat for the seven quarters before and the eight after. Every other question the
coalition would need answered - which countries, which industries, which skills, whether
reskilling is keeping pace - returns nothing measurable. And the file cannot even be asked about
change over time, because 284 of its 292 segments are observed once and the other 8 only twice.

The constructive half writes itself, because the brief names the decision: this cannot allocate
reskilling funding, here is the proof, and here is what would have to be collected instead.

**The risk, named now:** this is the third month in this programme whose findings are mostly
absences (2026/04, 2026/06, now this), and 2026/04's retro flagged that shape as reading lazy
rather than rigorous. Three mitigations are already in hand: the **step is real and large**
(d = -0.644, 3.61× better fit than a ramp) so the nulls are demonstrably measurements;
**$105.07 per displaced worker** is a concrete, quotable, policy-relevant number that needs no
inference; and the **step-vs-ramp distinction is itself a positive finding** - "adoption rose
1.7pp per quarter and is accelerating" and "adoption moved once, two years ago, and has been flat
since" imply opposite funding decisions.

## Submission mechanics (THIS month)

- @OnyxData · @SmartFramesUI · @DataCareerJumpstart
- **`@packt` is not on this month's list** (nor June's; it was on May's). Checked, not carried.
- Hashtag: `#dataDNA`
- **Single image only.**
- **No ZoomCharts mini-challenge** - absent from the page, no read-me in the archive. Re-check G8.

## Timeline

| | |
|---|---|
| Challenge begins | 01 July 2026 |
| Deadline for entries | 24 July 2026 |
| Entry review begins | 25 July 2026 |
| Winners announced | 31 July 2026 |

**Closed three days ago.** Today is 2026-07-27; winners are announced in four days. This is the
most recently closed month in the programme, and still portfolio work rather than a live entry.

**Prizes (for the record):** 2 Packt eBooks, The Data Analytics Interview Software ($500).

## Benchmark

**Unchanged and structural, thirteenth month.** No DataDNA account. Benchmarking is qualitative
only and the Definition-of-Done line *"beats the highest scorer on ≥2 dimensions"* cannot be
checked or claimed. **After this month it becomes the binding constraint on the whole programme**,
because Era 1 is all that remains and every one of its 52 datasets is gated.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **A trend is not a step** (new, this month; the sibling of 2026/05's "a trend is not a
   season"). Fitting a line to a level shift returns a significant slope and misdescribes the
   dynamics - and here the two readings imply opposite funding decisions.
2. **A unique id is not a grain** (2026/06). `index_id` is unique across 300 rows and the file
   still has no panel: check which columns vary within the candidate cluster, not whether the key
   is unique.
3. **A null needs a positive control** (2025/09, 2026/02, 2026/04). The step is it, and it is
   large.
4. **Compute the number, never type it** (2026/02). Every figure above comes from
   `analysis/integrity.py`.
