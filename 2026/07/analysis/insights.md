# Insight ledger - 2026/07 Global AI Adoption & Workforce Displacement Index

**The gate that decides the Insights score.** No query, no claim.

Every query runs against `data/curated/*.parquet` via DuckDB and is reproduced by
`model/test_metrics.py` against the **raw CSVs** on a second, independent path.

## Thesis

> **This file knows one date and nothing else. The only real signal in it is a single +18.23
> point jump in AI adoption that lands exactly on a flag the date dimension already carries, and
> is perfectly flat for the seven quarters before and the eight after. Every other question the
> coalition needs answered - which countries, which industries, which skills, whether reskilling
> is keeping pace - returns nothing. It cannot allocate a reskilling budget, and $105.07 per
> displaced worker is what it says the world is currently spending.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | A policy coalition is about to allocate national reskilling funding. It has 300 records covering 30 countries, 25 industries, 8 skill categories and 16 quarters, and a brief asking which segments are most exposed. |
| **Complication** | There is effectively no panel - 284 of 292 segments are observed once and the other 8 twice, so no usable change over time is measurable for any of them. The one thing that does move is a step, not a trend, and it sits on a flag the file already contained. Every attribute that should predict exposure predicts nothing: the risk index correlates -0.018 with automation susceptibility and +0.014 with skill replaceability. |
| **Resolution** | Do not allocate on this. Report the step as a level shift rather than an acceleration - the two readings imply opposite decisions. Then collect the four things that would make the question answerable: repeated measures, an independent job-creation count, a risk index validated against its own drivers, and reskilling spend recorded against the displacement it responds to. |

---

## I1 - There is no panel. 284 of 292 segments are observed once, and 8 twice.

**Query**
```sql
SELECT count(*) AS segments,
       count(*) FILTER (WHERE n > 1) AS seen_twice,
       max(n)   AS most_observations
FROM (SELECT country_id, industry_id, skill_category_id, count(*) AS n
      FROM fact_index GROUP BY 1,2,3);
```

**Output**
```
segments = 292    seen_twice = 8    most_observations = 2
```
300 rows fill **0.31%** of the 30 × 25 × 8 × 16 = 96,000-cell cube.

**Caveat:** the row count per quarter is *stable* (12-26, slope -0.14/qtr, p = 0.564), so an
aggregate across quarters is not confounded by a shifting sample size. That is a real strength
and it is why the step in I2 can be trusted at all. What cannot be done is anything at segment
level.

**So what:** the brief's Temporal Trends section is three questions long, and all three are
*population*-level, so all three ARE answerable - and answered, at questions 5, 9 and 10:
adoption steps once at 2022-Q4 and is flat either side, displacement is not accelerating
(+0.013pp/qtr, p = 0.980), and the steepest rise in tool-usage hours is 2022-Q4 at +3.44h, the
same step in the same place. What is *not* computable is anything at segment level, which is
what the coalition's own questions about "which segments need urgent investment" require. That
distinction is the first thing to tell them, because it bounds everything else on the page.

*(This paragraph previously read "all three ask for a change within a segment. None is
computable" - false on both counts, and contradicted by this month's own question ledger three
entries later. Corrected by the 2026-07 audit. **A limitation is a claim and needs a query like
any other; "unanswerable" is the easiest thing on a page to assert and never test.**)*

---

## I2 - The one real signal is a step, not a trend - and the difference is a funding decision.

**Query**
```sql
SELECT d.year_quarter_label, d.generative_ai_era,
       round(avg(f.ai_adoption_rate), 2) AS mean_adoption, count(*) AS n
FROM fact_index f JOIN dim_quarter d USING (date_id)
GROUP BY 1,2 ORDER BY 1;
```

**Output**
```
2021-Q1 19.15   2022-Q1 16.68   2023-Q1 34.19   2024-Q1 45.70
2021-Q2 22.35   2022-Q2 19.59   2023-Q2 38.76   2024-Q2 37.35
2021-Q3 21.20   2022-Q3 22.48   2023-Q3 38.15   2024-Q3 33.28
2021-Q4 20.20   2022-Q4 40.23*  2023-Q4 38.64   2024-Q4 39.93
                        * generative_ai_era = True from here
```

| Fit | Residual SS |
|---|---:|
| Linear: **+1.69pp/qtr, R² 0.676, p 0.0001** | 465.2 |
| **Step at 2022-Q4: 20.24% → 38.47%** | **128.9** |

The step fits **3.61× better**. Within each era the slope is **-0.001pp/qtr (p = 0.997)** before
and **+0.013pp/qtr (p = 0.980)** after. Row-level: Cliff's d = **-0.644**, MW p = 1.1e-21.

**Caveat, and it is the important one:** the step lands *exactly* on `generative_ai_era`, which
is a column of `dim_date`. The file did not discover a date; it was generated around one. So this
establishes that **something real is encoded** - it is the positive control that makes every null
below a measurement - but it is not evidence about generative AI's effect on labour markets. It
is evidence that the synthesiser was told to put a step there.

**So what:** "adoption is rising 1.7 points a quarter and accelerating" and "adoption moved once,
two years ago, and has been flat for eight quarters" imply **opposite** funding decisions - the
first argues for scaling a programme, the second for asking why nothing has moved since. A linear
fit to this series is significant at p = 0.0001 and would produce the first.

---

## I3 - The displacement risk index does not correlate with displacement risk.

**Query**
```sql
SELECT 'automation_susceptibility' AS driver,
       corr(f.displacement_risk_index, i.automation_susceptibility) AS pearson
FROM fact_index f JOIN dim_industry i USING (industry_id)
UNION ALL SELECT 'ai_replaceability_score',
       corr(f.displacement_risk_index, s.ai_replaceability_score)
FROM fact_index f JOIN dim_skill s USING (skill_category_id);
```
(Spearman, computed in `analysis/integrity.py`, is reported below.)

**Output**
```
driver                          Spearman rho     p
automation_susceptibility            -0.0176   0.761
ai_replaceability_score              +0.0137   0.814
ai_augmentation_potential            -0.0349   0.547
digital_infrastructure_score         -0.0660   0.254
stem_graduates_per_100k              -0.0792   0.171

by skill category:  Kruskal p = 0.7695,  eta2 = 0.00699,  spread 3.96-4.56
```

The dictionary's entry, verbatim, is *"0-10 composite score of displacement risk for this
segment"*. (It was quoted here as *"a composite 0-10 score estimating a segment's exposure to
AI-driven job displacement"* - a fair paraphrase, but inside quotation marks, which makes it a
misquotation of a source this whole insight is auditing. Corrected by the 2026-07 audit.
**Quotation marks are a claim about the source, not about the meaning.**) Concretely: **Manual Skilled Trades** has the highest `ai_replaceability_score`
in the file (79.6) and the **4th** highest observed risk; **Cognitive & Analytical** has the
lowest (20.9) and the **6th**.

**Caveat:** the index *is* correlated with `jobs_displaced_count` (ρ = 0.38) and
`jobs_created_count` (ρ = 0.35) - but those two are the same number twice (I4), so that is one
relationship, not two, and it is with an outcome rather than a driver. Under Bonferroni across
the 19 candidates tested, only those two clear.

**So what:** the coalition's natural move is to rank segments by this index and fund the top of
the list. The index does not encode what it says it encodes, so that ranking is arbitrary - and
"arbitrary" is worse than "unavailable", because it looks like a decision.

---

## I4 - `jobs_created` is `jobs_displaced` rescaled. Nothing ever nets positive.

**Query**
```sql
SELECT round(regr_slope(jobs_created_count, jobs_displaced_count), 4)     AS slope,
       round(regr_intercept(jobs_created_count, jobs_displaced_count), 1) AS intercept,
       round(regr_r2(jobs_created_count, jobs_displaced_count), 4)        AS r2,
       count(*) FILTER (WHERE jobs_created_count > jobs_displaced_count)  AS net_positive_rows,
       sum(jobs_created_count) - sum(jobs_displaced_count)                AS net_jobs
FROM fact_index;
```

**Output**
```
slope = 0.4157   intercept = 174.7   r2 = 0.8070   (Spearman +0.9562)
net_positive_rows = 0   net_jobs = -290,430
ratio created/displaced:  min 0.201   max 0.899   -- never once above 1
                          defined on 295 of 300 rows
```

**Caveat:** the ratio does vary (0.20-0.90), so this is not a constant multiplier - there is
noise around the relationship. But the ceiling at 1.0 is never approached from above in 300
draws, which a genuinely independent count would do somewhere.

**Second caveat, found at G6:** five records report **zero displaced and zero created**, so the
ratio is 0/0 - undefined, not 1 and not 0. The `min`/`max` above are over the 295 rows where it
exists; `creation_ratio` is stored null on the other five rather than coerced. It does not touch
`net_positive_rows`, since 0 > 0 is false either way. Found because the undefined value reached
the browser as a literal `NaN` token and `JSON.parse` rejected the entire file - a division that
is undefined in the data is undefined in the export, and the export format said so before any
test did.

**So what:** the challenge page names *"misalignment between job displacement and job creation
rates"* as an analysis direction, and the archive brief asks where creation offsets displacement.
Both are answered by construction rather than by measurement. A chart of net jobs by country
would rank countries by how many jobs they displaced, wearing a different label.

---

## I5 - Reskilling investment is unrelated to displacement, and amounts to $105.07 per worker.

**Query**
```sql
SELECT round(sum(reskilling_investment_usd), 0)                     AS total_investment,
       sum(jobs_displaced_count)                                    AS total_displaced,
       round(sum(reskilling_investment_usd)
             / sum(jobs_displaced_count), 2)                        AS usd_per_displaced_worker
FROM fact_index;
```

**Output**
```
total_investment = 61,651,485    total_displaced = 586,785
usd_per_displaced_worker = 105.07

Spearman(reskilling_investment_usd, jobs_displaced_count) = +0.1067, p = 0.0649
```

**Caveat:** these are the file's own units and it is synthetic, so $105.07 is not a claim about
the real world. What is structural, and does transfer, is the **absence of a relationship**:
whatever allocated this money did not look at how many jobs were displaced.

**So what:** this is the one number on the page a policy audience can hold without any statistical
caveat attached, and it is the reason the report has a headline rather than only a warning.
"Is reskilling investment keeping pace?" - ρ = 0.107, p = 0.065. It is not keeping pace with
anything, because it is not tracking anything.

---

## I6 - Nothing about a country predicts its AI adoption.

**Query**
```sql
SELECT c.development_tier, count(*) AS rows,
       round(avg(f.ai_adoption_rate), 2) AS mean_adoption
FROM fact_index f JOIN dim_country c USING (country_id) GROUP BY 1;
```

**Output**
```
development_tier   rows   mean_adoption
Developed           168           30.98
Emerging            132           30.22
                      Kruskal p = 0.8228

ai_adoption_rate vs   gdp_per_capita_usd            rho = -0.0305  p = 0.599
                      digital_infrastructure_score  rho = -0.0610  p = 0.292
                      internet_penetration_pct      rho = -0.0165  p = 0.777
                      stem_graduates_per_100k       rho = +0.0083  p = 0.886
```

**Caveat:** `gdp_per_capita_usd` is itself broken (I7), so its null is uninformative. The other
three are clean columns with plausible ranges, and they are equally flat.

**So what:** the challenge page names *"variations in AI adoption between developed and emerging
economies"* and *"uneven AI adoption patterns due to infrastructure and talent disparities"* as
two separate analysis directions. Both are absent at p = 0.82 and |ρ| < 0.07. A world map shaded
by adoption would render noise at country resolution - which is why this page does not draw one.

---

## I7 - The country dimension is not describing this planet.

**Query**
```sql
SELECT country_name, round(gdp_per_capita_usd) AS gdp_per_capita, ai_policy_maturity
FROM dim_country ORDER BY gdp_per_capita_usd DESC LIMIT 4;
```

**Output**
```
country_name            gdp_per_capita   ai_policy_maturity
Germany                     42,266,885   ...
Canada                      40,026,686   ...
United Arab Emirates        39,190,676   ...
Spain                       38,799,167   ...
...
United States               33,586,747   Nascent
```
Range **$4.13m-$42.27m**, median **$18.47m**. Real-world GDP per capita tops out near $130,000,
so these are roughly **500× too large** - and the ordering is wrong too: Germany above the
United States, Spain above the US.

**Caveat:** a uniform 500× scaling error would be harmless for *rank* correlations, which is why
I6 tests Spearman. The ordering being implausible is the separate, worse problem, and it means
the column cannot be used even as a proxy.

**So what:** any figure that joins to `gdp_per_capita_usd` inherits this. The curated model drops
it from every measure and carries it only in the defect ledger.

---

## I8 - Data confidence is recorded and means nothing.

**Query**
```sql
SELECT CASE WHEN data_confidence_score < 0.6 THEN 'low (<0.6)'
            WHEN data_confidence_score >= 0.9 THEN 'high (>=0.9)' END AS band,
       count(*) AS rows,
       round(avg(ai_adoption_rate), 2)        AS mean_adoption,
       round(avg(displacement_risk_index), 2) AS mean_risk
FROM fact_index WHERE data_confidence_score < 0.6 OR data_confidence_score >= 0.9
GROUP BY 1;
```

**Output**
```
band            rows   mean_adoption   mean_risk
low (<0.6)        25           32.66        3.88
high (>=0.9)      63           29.79        4.32
                        MW p = 0.311        p = 0.224
```

**Caveat:** with 25 low-confidence rows this test is underpowered - it establishes that no *large*
difference exists, not that none does.

**So what:** the challenge page lists *"data confidence and reporting quality variations across
regions"* as an analysis direction. The column exists, spans 0.34-1.00, and does not distinguish
anything measured. Weighting by it - the obvious use - would change no conclusion.

---

## Rejected

| Candidate | Why dropped |
|---|---|
| A world map of adoption by country | Country explains nothing (I6); the map would render noise at high resolution. Reason printed in the footer. |
| Quarter-over-quarter adoption trend line | It is a step, and a line misdescribes it in a decision-relevant direction (I2). |
| Top-N segments by displacement risk | The index does not encode risk (I3). This is the chart most entries will ship, and it is a ranking of noise. |
| Net jobs by country / industry | `created` is `displaced` rescaled (I4), so it ranks by displacement wearing another label. |
| Skill-category resilience ranking | Kruskal p = 0.770, η² = 0.007 (I3). |
| Industry susceptibility × investment quadrant | Computable, but susceptibility vs observed risk is ρ = -0.099, p = 0.640 on n = 25. |
| Cross-dimensional country × industry heatmap | 292 segments seen once: every cell is 0 or 1 observations. |
| Reskilling shortfall by country × industry | The brief asks for it by name; it needs both a valid risk index and repeated measures, and has neither. |
| Anything weighted by `data_confidence_score` | Changes no conclusion (I8). |

## Non-obvious checklist

- [x] **two-way interactions** - not computable; every segment cell holds 0 or 1 rows
- [x] **Simpson's paradox** - nothing to reverse; no aggregate effect exists on any axis but time
- [x] **rate vs volume** - a third shape again: the only real finding is a difference of two
      means across one date, and every rate, ratio and correlation in the file is flat
- [x] **concentration** - not meaningful across 292 singly-observed segments
- [x] **distribution vs average** - the risk index is 0-10, mean 4.26, and structureless; a
      segment's value implies a precision it does not have
- [x] **cohorts** - impossible without repeated measures; recorded rather than fudged
- [x] **changepoints** - **exactly one, and finding it is the month** (I2)
- [x] **funnel leakage** - no process stages
- [x] **lead / lag** - no lagged relationship computable without a panel
- [x] **missingness as signal** - 9 nulls in each of two columns, 18 distinct rows, no
      concentration by country, industry or quarter
- [x] **survivorship** - no unused dimension rows; nothing missing from the join
- [x] **mix vs performance decomposition** - attempted and abandoned: with one observation per
      segment, mix and performance are not separable
