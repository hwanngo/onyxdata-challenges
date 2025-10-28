# Insight ledger - 2025/10 · Consumer Financial Complaints (CFPB)

**The gate that decides the Insights score.** No query, no claim.

> **Backfilled 2025-10-28 during the audit remediation.** This file shipped as an unmodified
> template while the month published roughly forty quantitative claims - a direct breach of
> the operating brief's rule 3. Every entry below was recomputed from `data/curated/*.parquet` (or, where
> the claim is about the raw file, from the source XLSX) while writing it; nothing was copied
> from `brief.md`, `profile.md` or the dashboard. Three published claims did **not** survive
> the recomputation and are recorded in **Rejected** with what replaced them.
>
> Run any SQL block against the curated layer with:
> `duckdb -c "create view fct_complaint as select * from read_parquet('2025/10/data/curated/fct_complaint.parquet'); ..."`
> or, more simply, `uv run python tools/verify_metrics.py 2025 10 --url ...`, which runs the
> `model/metric_checks.yml` versions of most of them and asserts them against the DOM.

## Thesis

> **This file is two datasets stapled together, and only one of them is a record of anything.**
> The 62,516 complaints are a real register; the 1,081 companies attached to them are a uniform
> random overlay. So the file supports supervision *priorities* and answers nothing about
> supervision *targets*.

## Narrative arc

| | Insight |
|---|---|
| Situation | A regulator has 62,516 complaints, 1,081 companies, and a brief that asks which companies are worst (Q6, Q7). |
| Complication | Every association test involving the company identifier lands on χ² = df - exactly what chance predicts - and none of the twelve clears Bonferroni. The two questions the file appears to answer best are computed entirely from the fabricated half. Meanwhile the half that *is* real has a regime break in 2021 that the pooled headline hides, and a 2023 recovery that is a censoring artefact. |
| Resolution | Send examiners at **product-issue pairs**, not at firms. Five pairs carry 65.36% of all monetary relief on 42.22% of complaints. Ask the data owner for an attributable register before ranking anybody. |

---

## Ledger

### I1 - Not one of the 78 association tests involving the company identifier carries signal; 45 of the 45 structural consumer pairs do

**Query** - the complete cross-product of the file's twelve categorical columns, 12 company
tests plus C(12,2)=66 consumer pairs, computed in `model/build.py` and persisted to
`dim_chitest.parquet` so it can be re-read rather than re-trusted.

```sql
select family,
       count(*)                          as n,
       count(*) filter (where significant) as clears_bonferroni,
       min(ratio) as min_chi2_df, max(ratio) as max_chi2_df,
       min("cramersV") as min_v, max("cramersV") as max_v
from dim_chitest
group by 1 order by 1;

-- and the eight consumer pairs that fail
select label, ratio, "cramersV", p
from dim_chitest where side = 'consumer' and not significant order by ratio;
```

**Output**

```
family        n   clears   min χ²/df    max χ²/df      min V     max V
calendrical  21       13      1.1708       443.750     0.0113    0.2089
company      12        0      0.9450         1.018     0.1278    0.1342
structural   45       45      3.3167    15,629.000     0.0310    1.0000

consumer pairs that do NOT clear Bonferroni (α = 0.05/78 = 6.410e-4)
  state × weekday             1.1708   V=0.0306   p=0.0222
  division × weekday          1.2061   V=0.0124   p=0.1551
  state × timeliness          1.3555   V=0.0333   p=0.0478
  region × weekday            1.5397   V=0.0122   p=0.0665
  weekday × timeliness        2.3597   V=0.0152   p=0.0279
  region × timeliness         2.6012   V=0.0113   p=0.0502
  division × timeliness       2.6602   V=0.0187   p=0.0064
  weekday × monetary relief   2.9513   V=0.0168   p=0.0070
```

Weakest company evidence: `company × state`, p = 0.2853. Weakest structural evidence:
`region × monetary relief`, p = 6.9e-23.

**Caveat.** χ²/df is a valid null benchmark and **not** an effect scale - it rewards degrees of
freedom. 46 of the 66 consumer pairs have a smaller Cramér's V than *every* company test and
still plot above them; `weekday × product` has V = 0.0270 against the company band's
0.1278-0.1342 and plots 5.7× higher purely on 48 df against 8,640. Cramér's V is in turn
inflated on a 1,081-level axis, so neither scale settles it alone. **Every one of the eight
consumer failures touches `weekday` or `timeliness`** - the calendar, and the label the file
fabricates - which is what real data should look like, not a defect. The clean statement is the
p-value partition, and it is exhaustive: 0/12 versus 45/45.

**So what.** Do not rank companies from this file and do not use the shipped
`Complaints_per_1pct_Share`. Ask the data owner for an attributable register. Drawn as
`fig-diagonal`; asserted in `build.py` (which refuses to emit a grid that is not the full
cross-product) and in `test_metrics.py::test_chi_grid_is_the_complete_cross_product`.

---

### I2 - A null is not evidence of a draw: complaint counts positively fit an equal-share multinomial at χ²/df = 1.0395

**Query** (`analysis/integrity.py` §7 - the positive test the company thesis owed)

```python
obs = co.Complaint_Count.values.astype(float)
exp = obs.sum() / len(obs)
chi2 = ((obs - exp) ** 2 / exp).sum()
dof = len(obs) - 1
p = stats.chi2.sf(chi2, dof)
```

**Output**

```
chi2 = 1,122.6   df = 1,080   chi2/df = 1.0395   p = 0.1789
mean 57.83   variance 60.11   (multinomial expectation 57.83)
```

Alongside it, from the same section: observed / expected sd of company timeliness = **1.0051**
(observed 0.03199, binomial expectation at n≈58 of 0.03183), and the minimum detectable effects
at 80% power - **0.69-0.92pp** on the timely rate between trait groups, **ρ = 0.085** on any
Spearman over 1,081 companies.

**Caveat.** The p-value is not extreme in *either* tail, which is the point: the counts are
neither over- nor under-dispersed. A single goodness-of-fit test cannot exclude every
alternative generating process, only ones that would show up as dispersion or as association.

**So what.** The company-side claim is a measurement, not an absence of evidence. Stating that
distinction in the published text is what separates "we found nothing" from "we established
that there is nothing to find", and it is worth more to a regulator than either.

---

### I3 - Five product-issue pairs carry 65.36% of all monetary relief on 42.22% of complaints

**Query**

```sql
with p as (
  select product, issue, count(*) as n,
         sum(case when got_money then 1 else 0 end) as relieved
  from fct_complaint group by 1, 2
)
select product, issue, n, relieved,
       100.0 * relieved / n                                  as relief_rate,
       100.0 * relieved / (select sum(relieved) from p)      as share_of_relief
from p order by relieved desc limit 5;
```

**Output**

```
Checking or savings account · Managing an account                       n=15,109  rel=5,206  34.46%  35.42%
Credit card or prepaid card · Problem with a purchase shown on statement n= 4,415  rel=1,811  41.02%  12.32%
Checking or savings account · Problem with a lender/other company charging n= 2,493  rel=  978  39.23%   6.65%
Checking or savings account · Closing an account                        n= 2,953  rel=  889  30.10%   6.05%
Credit card or prepaid card · Fees or interest                          n= 1,422  rel=  722  50.77%   4.91%

top-5 share of all relief   65.3603%      (total relief 14,697)
top-5 share of all volume   42.2164%
```

Across the 29 issues with n≥300 the monetary relief rate runs **0.8621% to 50.7736%** - a 59×
spread, Cramér's V = 0.346 for issue → relief - an order of magnitude larger than anything on
the company side.

**Caveat.** Monetary relief rate is a **proxy for severity**, not a measure of harm: the file
has no severity, no amount and no complainant-outcome column (assumptions A-5). A pair can be
high-relief because the harm is large or because the remedy is cheap and automatic. The largest
pair is also the largest by volume, so this is partly a "where the complaints are" list - which
is why both the relief share and the volume share are published together.

**So what.** This is the deliverable: a priority list with a denominator, derived from the half
of the file that is real. Drawn as `fig-pairs`; verified as `top5_relief_share`,
`top5_volume_share` and the `pair.*` metric set.

---

### I4 - Timeliness broke in 2021 and the break is not compositional: 15 of the 16 testable cuts fall

**Query**

```sql
with u as (
  select 'product' as cut, product as k, is_timely, year(month) as yr
  from fct_complaint where is_resolved
  union all select 'channel', channel, is_timely, year(month) from fct_complaint where is_resolved
  union all select 'region',  region,  is_timely, year(month) from fct_complaint where is_resolved
),
g as (
  select cut, k,
         count(*) filter (where yr <= 2020) as n_pre,
         count(*) filter (where yr  = 2021) as n_21,
         100.0*avg(case when is_timely then 1.0 else 0.0 end) filter (where yr <= 2020) as pre,
         100.0*avg(case when is_timely then 1.0 else 0.0 end) filter (where yr  = 2021) as y21
  from u group by 1, 2
)
select cut, k, n_pre, n_21, pre, y21, pre - y21 as drop_pp
from g where n_pre >= 30 and n_21 >= 30 order by drop_pp desc;
```

**Output** - 16 testable cuts, 15 fall by more than 5pp, 4 cuts too thin to test
(Student loan, Email, Fax, Web Referral):

```
product Debt collection                      1,360 /   671   99.78 -> 80.48   19.30pp
product Credit reporting ...                   2,898 / 1,642   99.76 -> 81.43   18.33pp
channel Postal mail                            996 /   104   99.70 -> 83.65   16.04pp
product Credit card or prepaid card          7,270 / 3,084   99.48 -> 87.39   12.09pp
region  West                                 9,270 / 4,009   99.64 -> 88.25   11.39pp
channel Web                                 19,254 / 8,074   99.71 -> 88.36   11.35pp
product Vehicle loan or lease                  292 /   113   99.66 -> 88.50   11.16pp
region  Northeast                            5,896 / 2,338   99.71 -> 89.09   10.62pp
region  South                               11,069 / 3,829   99.71 -> 89.45   10.26pp
product Money transfer / virtual currency    1,212 /   599   99.67 -> 89.65   10.02pp
region  Midwest                              3,048 /   973   99.74 -> 90.34    9.40pp
channel Phone                                1,890 /   897   99.79 -> 90.75    9.04pp
channel Referral                             6,919 / 2,063   99.62 -> 91.08    8.54pp
product Payday / title / personal loan         170 /    76  100.00 -> 92.11    7.89pp
product Checking or savings account         11,537 / 4,006   99.74 -> 92.16    7.58pp
product Mortgage                             4,515 /   953   99.84 -> 99.58    0.26pp   <- the exception
```

By year, on the resolved denominator and excluding right-censored months (see I5):
99.83 / 99.85 / 99.90 / 99.31 / **89.02** / 95.62 / 89.52.

**Caveat.** The thresholds (n≥30 each side, >5pp) are mine and were fixed before looking; they
are exported as `BREAK_MIN_N` and `BREAK_MIN_DROP` from `app/src/data.ts` so the UI, the SQL and
this ledger cannot drift apart. Cuts are tested one at a time, not jointly, so this rules out a
*single-cut* compositional explanation, not every interaction. Mortgage's 2021 cell is n=953,
comfortably powered. Whether the break is an operational change, a definitional change to
"timely", or a generator artefact is **not** determinable from this file - nothing in it records
policy.

**So what.** "Investigate what changed in 2021" is a real recommendation because the break is
everywhere at once, which is what a policy or system change looks like and not what a shift in
complaint mix looks like. Drawn as `fig-timely`; verified as `break_tested` / `break_falling`.

---

### I5 - The 2023 recovery is a censoring artefact: 93.16% pooled, 89.52% on the uncensored window

**Query**

```sql
select month,
       count(*)                                                          as n,
       100.0 * avg(case when is_resolved then 0.0 else 1.0 end)          as in_progress_pct,
       100.0 * avg(case when is_timely then 1.0 else 0.0 end)
              filter (where is_resolved)                                 as timely_among_resolved
from fct_complaint where month >= date '2023-05-01' group by 1 order by 1;

select (select 100.0*avg(case when is_timely then 1.0 else 0.0 end)
          from fct_complaint where is_resolved and year(month) = 2023)                    as pooled,
       (select 100.0*avg(case when is_timely then 1.0 else 0.0 end)
          from fct_complaint where is_resolved and year(month) = 2023
           and month < date '2023-05-01')                                                 as censored;
```

**Output**

```
2023-05  n=1,085  in progress  0.65%   timely among resolved   96.38%
2023-06  n=1,018  in progress  3.63%   timely among resolved   99.49%
2023-07  n=1,749  in progress 49.34%   timely among resolved  100.00%
2023-08  n=  717  in progress 81.87%   timely among resolved  100.00%

2023 pooled   93.1649%  (n resolved 7,637)
2023 censored 89.5221%  (n resolved 4,562, Jan-Apr)   -> 3.64pp of apparent recovery
3,075 resolved complaints held out
overall headline moves 96.0621% -> 95.9290%
```

**Caveat.** The bias runs *against* this month's own story - 2023 looks better than it is - which
is exactly why it survived review for three gates. The cutoff (2023-05) is a judgement: 2023-05
is only 0.65% in progress and could defensibly be kept. It is excluded because the *mechanism*
(only fast cases have closed) begins wherever resolution is incomplete, and a rule with a
principled boundary is safer than one tuned to a threshold. The censored months are shown, not
dropped: the accessible table carries censored and pooled side by side.

**So what.** Any outcome measure on this file needs a cutoff, and writing the cutoff down is not
the same as applying it. `OUTCOME_CENSOR_FROM` existed in `data.ts` for three gates and was
referenced by no component while the footnote beneath the bar warned about exactly what the bar
pooled. Now enforced in `timelyByYear()` and asserted in
`test_metrics.py::test_the_year_bars_must_exclude_the_censored_months`.

---

### I6 - Two clocks: the one the file advertises is a uniform draw, the one it does not is real (ε² = 0.364)

**Query**

```sql
-- the fabricated clock, and the real one, on the same rows
select channel,
       count(*)                                                        as n,
       avg(response_days)                                              as fabricated_clock,
       100.0*avg(case when intake_lag > 0 then 1.0 else 0.0 end)       as pct_delayed_at_intake,
       avg(intake_lag)                                                 as mean_lag
from fct_complaint group by 1 having count(*) >= 50 order by n desc;
```

Effect size, tie-corrected Kruskal-Wallis (79% of rows have a lag of exactly zero, so the tie
correction is not optional) - computed independently in DuckDB SQL (`lag_eps2` in
`metric_checks.yml`), in JavaScript (`lagEffectSize()` in `data.ts`) and by `scipy.stats.kruskal`
in `integrity.py`. All three agree.

**Output**

```
channel        n        response_days   % delayed   mean lag
Web           45,423        15.0678        7.78%     0.679
Referral      10,766        15.1365       75.59%     3.298
Phone          4,684        15.1909       20.05%     1.787
Postal mail    1,318        14.9825       14.49%     1.272
Fax              233        15.5150       13.30%     0.485
Web Referral      90        14.8222       53.33%     0.978
(Email n=2 excluded)

Response_Time_Days pooled: U(0,30), chi2 p = 0.0711, mean 15.0885 vs 15.000
  ...and uniform WITHIN every group of n>=500 across channel, product, region and outcome:
  19 group tests, 0 rejections
Timely response? is independent of Response_Time_Days (Mann-Whitney p = 0.831)

intake lag by channel:  Kruskal H = 22,781.48, k = 6, n = 62,514  ->  epsilon^2 = 0.3644
intake lag by COMPANY:  Kruskal p = 0.347   (the company thesis, on a fresh column)
```

**Caveat.** The published range "flat across every channel (14.82-17.50)" was wrong to include
**Email at n=2**: two rows contributed 2.0 of the quoted 2.68-day spread. The six reportable
channels span **14.822-15.515**, and the caption now states the exclusion and its n. ε² is a
variance-explained analogue for a rank test, not R²; and "delayed at intake" is a rate, so a
channel with a long tail on few rows (Web Referral, n=90) can look extreme.

**So what.** Q5 ("how fast are responses?") has no answer from `Response_Time_Days` and a good
answer from the intake lag, and Q8 ("do channels differ?") is answered by the same column. The
effect size was asserted in the UI for three gates and rendered nowhere; both clocks are now
drawn on the same rows in `fig-channels`, and every value carries a `data-metric`.

---

### I7 - Every stated identity holds and the table is still logically inconsistent: 2,150 complaints were answered before they arrived

**Query**

```sql
select count(*) filter (where date_responded < date_received)          as answered_before_received,
       100.0*count(*) filter (where date_responded < date_received)/count(*) as pct,
       max(datediff('day', date_responded, date_received))             as max_days_early,
       count(*) filter (where date_responded < date_submitted)         as answered_before_submitted,
       count(*) filter (where not is_resolved)                         as in_progress
from fct_complaint;
```

**Output**

```
answered_before_received  2,150   (3.4391%)   max 259 days early
answered_before_submitted     0
in_progress               1,494   - all of them carrying a response date and a response time
```

**Caveat.** The precise column pair is what makes the diagnosis rather than the observation:
**zero** rows are answered before they were *submitted*, and `Response_Time_Days` is the only
date arithmetic in the file that ignores `Date received`. So the defect is a generator that
computed the response date from the submission date and drew the receipt date separately - not
a data-entry problem, and not something a real intake system produces.

**So what.** An identity check is not an integrity check: verifying `a = f(b, c)` says nothing
about whether `a`, `b` and `c` can coexist. Rendered as the callout in `fig-channels`' panel,
cross-filter-reactive, and tagged `early_n` / `early_pct` / `early_max` / `in_progress`.

---

### I8 - The shipped Q6 metric is arithmetically exact and ranks firms by how small they are

**Query**

```sql
select corr(kpi_rank, share_rank) from dim_company;         -- 0.9894

select size_tier, count(*) as firms,
       avg(market_share_pct)  as mean_share,
       avg(complaints)        as mean_complaints,
       avg(kpi_per_1pct_share) as mean_kpi
from dim_company group by 1;

select size_tier, market_share_pct from dim_company
order by kpi_per_1pct_share desc limit 10;
```

**Output**

```
corr(kpi_rank, share_rank) = +0.9894
Spearman(1/market_share, shipped KPI) = +0.9903
Spearman(complaint_count, shipped KPI) = +0.1765   <- it barely tracks its own numerator

tier      firms   mean share   mean complaints   mean KPI
Large       108     0.3021%             57.08      203.6
Medium      216     0.1502%             58.03      400.2
Small       757     0.0461%             57.88    2,244.1

Kruskal, complaint_count by tier: p = 0.5569  (volume is flat)
KPI ratio Small / Large = 11.0x            (entirely the denominator)
Top 10 by shipped KPI: all Small, every one at the minimum 0.0099% share
```

**Caveat.** The metric is not *wrong*; `Complaints_per_1pct_Share = Complaint_Count /
Market_Share_Percent` reconciles to 5e-05. It is a correct answer to a question nobody should
ask of a file where the numerator is a random deal (I2). In a real register, normalising by
exposure is the right instinct - the failure here is specific to this data.

**So what.** This is what every other entry will publish, so the dashboard shows it *and* shows
what it is. Drawn as `fig-tiers`, tagged `kpi_rank_corr` and the `tier.*` metric set.

---

### I9 - The consumer half is real, but two of the three proofs had to be weakened to be true

**Query**

```sql
-- 1. ID order
with s as (select date_submitted, lag(date_submitted) over (order by complaint_id) as prev
           from fct_complaint)
select 100.0*count(*) filter (where date_submitted < prev)
             /count(*) filter (where prev is not null) as pct_backwards from s;

with m as (select month, median(complaint_id) as mid from fct_complaint group by 1),
     s as (select mid, lag(mid) over (order by month) as prev from m)
select count(*) from s where prev is not null and mid > prev;      -- month-grain steps rising

-- 2. weekends
select 7.0*count(*) filter (where dayofweek(date_submitted) = 0)/count(*) as sunday_index,
       7.0*count(*) filter (where dayofweek(date_submitted) = 6)/count(*) as saturday_index
from fct_complaint;

-- 3. taxonomy
select count(*) filter (where n = 1), count(*)
from (select issue, count(distinct product) as n from fct_complaint group by 1);

select 100.0*count(*) filter (
         where issue in (select issue from fct_complaint
                         group by 1 having count(distinct product) > 1))/count(*)
from fct_complaint;
```

**Output**

```
1. Spearman(complaint_id, date_submitted) = 0.9999878
   adjacent pairs stepping BACKWARDS in date: 7,036 / 62,515 = 11.2549%, median 1 day, worst 182
   month-grain: the median complaint_id rises in 75 of 75 steps
2. Saturday 0.5189x, Sunday 0.3708x of an average day; chi2 p < 1e-300
3. 111 of 684 Product x Issue cells populated (16.23%)
   63 of 76 issues sit under exactly one product
   13 issues span up to 7 products, carrying 13,085 rows = 20.9306% of the register
   of those, 89.06% still sit under their issue's MODAL product
   -> 2.2890% of the file is genuinely off-hierarchy
```

**Caveat.** Only the weekend test survived as originally published. "Strict date order" was a
*monotonicity* test (`rho > 0.999`) described as a strictness claim; strict means zero
violations and there are 7,036. "A genuine tree" was a *sparsity* test
(`cells < 25% of possible`), which any non-tree passes easily. Both weakened claims are still
decisive - nothing that generates a company dimension by random deal also produces weekends and
a 75-of-75 monotone ID sequence - but the wording had outrun the evidence, and the tests behind
the wording were testing something else.

**So what.** The masthead now states the three claims in the form the tests support, and the
refutations of the old wording are asserted in `integrity.py` §9 so they cannot quietly return.
Tagged `id_month_steps_rising`, `id_backwards_pct`, `sun_index`, `issues_single_parent`,
`multi_parent_row_pct`, `off_hierarchy_row_pct`.

---

### I10 - The company dimension ships the timeliness denominator this analysis rejects

**Query**

```python
all_rows = f.groupby("Company_ID_1081")["Timely response?"].apply(
    lambda s: (s == "Yes").sum() / len(s)
)  # in-progress counted as untimely
resolved = f.groupby("Company_ID_1081")["Timely response?"].apply(
    lambda s: (s == "Yes").sum() / s.notna().sum()
)  # the denominator this month adopts
m = co.set_index("Company_ID_1081")
(m.Timely_Response_Rate - all_rows).abs().max()
(m.Timely_Response_Rate - resolved).abs()
(m.Timely_Response_Rate * m.Complaint_Count).sum() / m.Complaint_Count.sum()
```

**Output**

```
ALL-ROWS denominator : exact (<1e-9) on 1,081/1,081   max error 0.0
RESOLVED denominator : exact on   266/1,081, FAILS on 815   max error 0.1040, mean 0.0229
                       corr(stored, resolved-recomputed) = 0.7953
count-weighted mean of the shipped column = 93.7664%
all-rows timeliness of the fact table     = 93.7664%   <- identical
correct (resolved) timeliness             = 96.0621%   gap 2.2957pp
```

**Caveat.** Neither number is an error in itself; they are different measures. The dictionary
does not state which denominator it uses, so "the identity holds" was never a well-formed claim
without naming one. `integrity.py` computed the resolved version, joined it, and then asserted
on the other four identities only - so the fifth was reported as verified without being tested.

**So what.** Nothing downstream reads `timely_rate` from `dim_company`; every timeliness figure
divides by resolved complaints and the schema makes that the easy path. The interesting part is
that the file's own dimension ships the definition this month calls the single easiest wrong
number to publish from it - a stronger version of the same finding, arrived at by accident.

---

## Rejected

| Candidate | Why dropped |
|---|---|
| "Every association test in the file lands in one of two non-overlapping clusters" | **Refuted by my own recomputation.** True of the 14 tests drawn, false of the 78 in the file: the nearest consumer pair is 1.15× the strongest company test. Replaced by the exhaustive grid and the Bonferroni partition (I1). |
| "The IDs are issued in strict date order" | **Refuted.** 11.25% of adjacent pairs step backwards. Replaced by the month-grain monotonicity claim (I9). |
| "The product-issue taxonomy is a genuine tree" | **Refuted.** 13 issues span products, covering 20.93% of rows. Replaced by "63 of 76 issues under exactly one product" (I9). |
| "The three company traits are two uniforms and a coin flip" | **Refuted on two of three.** `Market_Share_Percent` is right-skewed (KS p<1e-10), `Enforcement_History` is 19.52% Yes (binomial p=1.8e-95). The conclusion it supported survives; the description did not. Replaced by the multinomial fit (I2). |
| "Which states are complaint hotspots?" (brief Q2) | Answerable only as raw volume, which ranks population: the top four states are CA, FL, TX, NY. **No population or per-capita column exists in the file.** This is why the dashboard has no map - asserted in `test_metrics.py::test_state_ranking_has_no_denominator`. |
| "Company reputation predicts outcomes" (brief Q7) | 0 of 12 trait→outcome tests clear Bonferroni, with MDEs of 0.69-0.92pp attached. Kept as the *null with a power statement*, not as a finding. |
| "Response time by product/region" | `Response_Time_Days` is U(0,30) within every group of n≥500 across four axes - 19 tests, 0 rejections. Any cut of it is a picture of a random number generator. |
| "Volume roughly triples over the span" | Fragile and wrong: **1.7117×** on full months. The trend is real (+8.7010/month, r=0.7969, p=1.2e-17); the multiplier was overstated. |
| "The 8 outcomes / 7 channels breakdown" | Too obvious - a domain expert would say "of course". Kept only as context-strip counts. `Closed` (n=8) and `Email` (n=2) are noted where they distort a range. |

## Non-obvious checklist

Worked deliberately in G3:

- [x] two-way interactions - the full 78-cell association grid (I1)
- [x] Simpson's paradox - complaint volume is flat across size tiers while the shipped KPI varies 11× on the same rows (I8)
- [x] rate vs volume mismatch - top-5 pairs are 65.36% of relief on 42.22% of volume; relief *rate* peaks on a pair that is 1,422 rows (I3)
- [x] concentration (Pareto / Gini) - 5 of 111 populated product-issue cells carry two thirds of relief (I3)
- [x] distribution vs average - `Response_Time_Days` has the right mean for a real SLA and is U(0,30) (I6)
- [x] cohorts - timeliness by year, and by year × cut (I4)
- [x] changepoints & anomalies - the 2021 regime break; 2,150 impossible rows (I4, I7)
- [ ] funnel leakage - no funnel in this file; submission → receipt → response is 3 timestamps, not stages with drop-off
- [x] lead / lag - the intake lag is the whole of I6
- [x] missingness as signal - `Timely response?` null ⟺ In progress, and that is right-censoring rather than structural missingness (I5)
- [x] survivorship - the 2023 recovery is survivorship: only the fast cases have closed (I5)
- [x] mix vs performance decomposition - the 2021 break is tested cut by cut to rule out a mix explanation (I4)
