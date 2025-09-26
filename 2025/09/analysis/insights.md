# Insight ledger - 2025/09 · Credit Risk Analytics (Nova Bank)

**The gate that decides the Insights score.** No query, no claim.

> **Backfilled 2025-09-26 during audit remediation, and this note stays.** This file was left
> as the unedited template through G8, which means rule 3 of the operating brief - *every claim has a
> query* - was unmet for the whole month at ship time even though the work behind the claims
> had been done. Every entry below was **re-run against `data/curated/` on 2025-09-26** before
> being written; none was transcribed from `brief.md`, `SUBMISSION.md`, the app or the poster.
> Two published numbers did not survive that re-run and were corrected (I12, I15); a third was
> mislabelled (I12). Those corrections are noted in place.
>
> A backfilled ledger is worth less than one written at G3, because it cannot record the
> claims that were considered and dropped before anyone wrote them down. The *Rejected* table
> is therefore only as complete as `.workbench/2025/09/RETRO.md` and `integrity.py` allow, and it says so.

## Setup - the view every query below runs against

```sql
-- 2025/09/data/curated/*.parquet, loaded into DuckDB
create view book as
select f.*, g.loan_grade as grade, i.loan_intent as intent,
       h.person_home_ownership as home, e.employment_type as emp
from fct_loan f
  join dim_grade g using (grade_key)
  join dim_intent i using (intent_key)
  join dim_home  h using (home_key)
  join dim_employment e using (employment_key);
```

`fct_loan` is 32,581 rows - the raw row count, unchanged. No rows are dropped anywhere in
`model/build.py`, and that is a decision (`assumptions.md` A-5), not an omission.

Two conditions recur so often they are named once here:

```sql
-- R1
home = 'RENT' and loan_percent_income > 0.30
-- R2
grade in ('D','E','F','G') and intent = 'DEBTCONSOLIDATION' and home <> 'OWN'
```

---

## Thesis

> **Nine per cent of Nova Bank's book defaults 100% of the time - 2,988 loans, zero
> exceptions - under two conditions you can write on an index card. That is 42% of every
> loss, priced fourteen basis points above the loans beside it.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | Nova Bank asks who defaults and why. The obvious answers are all present and all available in one `group by`: grade ladder, purpose ranking, loan-to-income gradient. (I9, I8, I10) |
| **Complication** | Two boolean conditions decide 42.0371% of every default in the book with zero exceptions, and they contaminate the obvious answers - debt consolidation moves from the riskiest purpose to the second safest once they are removed, and grade D falls from 59.05% to 46.33%. (I1-I3, I8, I9) |
| **Resolution** | Find the rules before fitting anything, and price them: 2,988 loans, $41,607,350, currently carrying 13.6565 bp more than the renters just below the line. Everything the brief asks about fairness is separately unanswerable, because the book has no declined applications. (I6, I16, I19) |

---

## Ledger

### I1 - Every one of the 2,345 renters above 30% loan-to-income defaulted. Zero exceptions.

**Query**
```sql
select count(*) n, sum(loan_status) n_def, count(*) - sum(loan_status) exceptions,
       round(100.0 * avg(loan_status), 4) rate_pct, sum(loan_amnt) principal
from book where home = 'RENT' and loan_percent_income > 0.30;
```

**Output**
```
┌───────┬───────┬────────────┬──────────┬───────────┐
│   n   │ n_def │ exceptions │ rate_pct │ principal │
├───────┼───────┼────────────┼──────────┼───────────┤
│  2345 │  2345 │          0 │    100.0 │  34798700 │
└───────┴───────┴────────────┴──────────┴───────────┘
```

**Caveat:** n=2,345 is large, but this is a *lookup rule*, not a gradient, so the usual sample-
size reasoning does not apply - see I4 (the boundary is `>` and not `>=`) and I18 (the exactness
is downstream of the source column's 2-decimal rounding). The rule was found by searching this
file; no p-value quoted anywhere on the dashboard is a valid frequentist statement about it.
Almost certainly a generator artefact.

**So what:** the honest headline is *"a lookup table decides 7.2% of this book"*, not *"renters
are risky"*. Any model fitted before this is found will learn the rule, report excellent
validation metrics, and be describing the generator rather than the borrowers.

---

### I2 - A second rule, on grade and purpose, adds 741 more loans at the same 100.0000%.

**Query**
```sql
select count(*) n, sum(loan_status) n_def, count(*) - sum(loan_status) exceptions,
       round(100.0 * avg(loan_status), 4) rate_pct, sum(loan_amnt) principal
from book
where grade in ('D','E','F','G') and intent = 'DEBTCONSOLIDATION' and home <> 'OWN';
```

**Output**
```
┌───────┬───────┬────────────┬──────────┬───────────┐
│   n   │ n_def │ exceptions │ rate_pct │ principal │
├───────┼───────┼────────────┼──────────┼───────────┤
│   741 │   741 │          0 │    100.0 │   8534950 │
└───────┴───────┴────────────┴──────────┴───────────┘
```

**Caveat:** the `home <> 'OWN'` clause is the part that looks reverse-engineered, and it is -
it was found by widening the condition until an exception appeared. That is exactly the
post-selection problem named in I3. The rule is reported because it is *reproducible*, not
because it was predicted.

**So what:** the first rule alone would read as "renters at high leverage default", which a
credit officer would nod at. The second has no such story: grade D-G debt consolidation by
mortgage-holders is not a recognised certainty. Two unrelated rules with the same exact
behaviour is much stronger evidence of construction than either alone.

---

### I3 - Together they are 9.1710% of the book and 42.0371% of every default in it.

**Query**
```sql
select count(*) n, count(*) - sum(loan_status) exceptions,
       round(100.0 * avg(loan_status), 4) rate_pct, sum(loan_amnt) principal,
       round(100.0 * count(*) / (select count(*) from book), 4) pct_of_book,
       round(100.0 * sum(loan_status) / (select sum(loan_status) from book), 4) pct_of_defaults
from book
where (home = 'RENT' and loan_percent_income > 0.30)
   or (grade in ('D','E','F','G') and intent = 'DEBTCONSOLIDATION' and home <> 'OWN');

-- and the overlap between them
select count(*) overlap from book
where (home = 'RENT' and loan_percent_income > 0.30)
  and (grade in ('D','E','F','G') and intent = 'DEBTCONSOLIDATION' and home <> 'OWN');
```

**Output**
```
┌───────┬────────────┬──────────┬───────────┬─────────────┬─────────────────┐
│   n   │ exceptions │ rate_pct │ principal │ pct_of_book │ pct_of_defaults │
├───────┼────────────┼──────────┼───────────┼─────────────┼─────────────────┤
│  2988 │          0 │    100.0 │  41607350 │       9.171 │         42.0371 │
└───────┴────────────┴──────────┴───────────┴─────────────┴─────────────────┘

┌─────────┐
│ overlap │
├─────────┤
│      98 │
└─────────┘
```

2,345 + 741 - 98 = 2,988. The book has 7,108 defaults; 2,988 / 7,108 = 42.0371%.

**Caveat - the one that matters most on this page.** The dashboard quotes "if the true rate
were 99%, observing zero survivors has probability 0.99^2988 ≈ 1e-13". **That is a
post-selection probability with no correction for the search that found the rules.** Both
conditions were discovered by scanning 29 columns for exact splits; the quantity it measures is
*how exact these two conditions are*, not *how surprising it is that some exact condition exists
somewhere in 29 columns*. A correctly-corrected figure would require enumerating the search
space, which was never done. The app now says this beside the number
(`Dashboard.tsx`, `rulebox__caveat`), and `SUBMISSION.md` says it too.

**So what:** the recommendation is deliberately written to be identical whether the rules are a
generator artefact or a real underwriting policy - *find them before you model, and either cap
the exposure or price it*. That is the only claim this file can carry, and it does not depend on
resolving Q34 in `.workbench/2025/09/analysis/questions.md`.

---

### I4 - The boundary is `> 0.30`, not `>= 0.30`, and the difference is the whole finding.

**Query**
```sql
select 'gt 0.30' k, count(*) n, round(100.0*avg(loan_status),4) rate, sum(1-loan_status) survivors
from book where home = 'RENT' and loan_percent_income > 0.30
union all select 'ge 0.30', count(*), round(100.0*avg(loan_status),4), sum(1-loan_status)
from book where home = 'RENT' and loan_percent_income >= 0.30
union all select 'eq 0.30', count(*), round(100.0*avg(loan_status),4), sum(1-loan_status)
from book where home = 'RENT' and loan_percent_income = 0.30;

-- where do the apparent survivors sit?
select min(loan_percent_income) lo, max(loan_percent_income) hi, count(*) n
from book where home = 'RENT' and loan_percent_income >= 0.30 and loan_status = 0;
```

**Output**
```
┌─────────┬───────┬─────────┬───────────┐
│    k    │   n   │  rate   │ survivors │
├─────────┼───────┼─────────┼───────────┤
│ gt 0.30 │  2345 │   100.0 │         0 │
│ ge 0.30 │  2629 │ 92.2784 │       203 │
│ eq 0.30 │   284 │ 28.5211 │       203 │
└─────────┴───────┴─────────┴───────────┘

┌────────┬────────┬───────┐
│   lo   │   hi   │   n   │
├────────┼────────┼───────┤
│    0.3 │    0.3 │   203 │
└────────┴────────┴───────┘
```

All 203 apparent survivors sit at **exactly** 0.30. Not near it - at it.

**Caveat:** none. This is arithmetic, and it is pinned by
`test_the_boundary_is_STRICTLY_greater` in `model/test_metrics.py` so it cannot regress.

**So what:** an earlier draft of `integrity.py` check 10 used `>=`, saw 203 non-defaulters, and
*explicitly dismissed the lookup-rule hypothesis as refuted*. A genuine attempt to falsify the
claim failed only because it tested the boundary one bin too wide - and the failure was
double-sided: it disguised a deterministic rule as a gradient, and it reported exceptions that
do not exist. **Standing lesson, now in `.workbench/2025/09/RETRO.md`: when a threshold effect is suspected, test
the boundary at the data's own resolution.**

---

### I5 - The wall is tenure-specific. Renters turn ninety degrees at 0.30; nobody else does.

**Query**
```sql
select round(loan_percent_income, 2) lpi,
       round(100.0*avg(loan_status) filter (where home='RENT'),1)     rent,
       count(*) filter (where home='RENT')                            n_rent,
       round(100.0*avg(loan_status) filter (where home='MORTGAGE'),1) mort,
       count(*) filter (where home='MORTGAGE')                        n_mort,
       round(100.0*avg(loan_status) filter (where home='OWN'),1)      own,
       count(*) filter (where home='OWN')                             n_own
from book where loan_percent_income between 0.27 and 0.34 group by 1 order by 1;

select count(*) n, round(100.0*avg(loan_status),4) rate
from book where home = 'MORTGAGE' and loan_percent_income > 0.30;
```

**Output**
```
┌────────┬────────┬────────┬────────┬────────┬────────┬───────┐
│  lpi   │  rent  │ n_rent │  mort  │ n_mort │  own   │ n_own │
├────────┼────────┼────────┼────────┼────────┼────────┼───────┤
│   0.27 │   29.9 │    314 │   21.6 │    204 │   11.1 │    45 │
│   0.28 │   33.0 │    282 │   20.5 │    156 │   14.3 │    35 │
│   0.29 │   29.5 │    254 │   14.7 │    156 │    7.5 │    53 │
│   0.30 │   28.5 │    284 │   15.7 │    115 │   14.3 │    49 │
│   0.31 │  100.0 │    236 │   21.6 │    116 │   17.9 │    39 │  <- the wall
│   0.32 │  100.0 │    197 │   18.1 │     94 │    3.6 │    28 │
│   0.33 │  100.0 │    264 │   15.8 │    101 │   20.8 │    53 │
│   0.34 │  100.0 │    166 │   36.1 │     83 │   16.0 │    25 │
└────────┴────────┴────────┴────────┴────────┴────────┴───────┘

┌───────┬─────────┐
│   n   │  rate   │
├───────┼─────────┤
│  1047 │ 24.1643 │
└───────┴─────────┘
```

**Caveat:** the owner column is thin (25-53 per bin) and its bin-to-bin movement is noise. The
mortgage column is not thin and is the load-bearing comparison: 1,047 mortgage-holders cross
the same line and land at 24.16%, i.e. they do not move.

**So what:** this is what makes it a *rule* rather than a *risk factor*. A real leverage effect
would bend for everyone; this one is keyed on a categorical column. It also answers brief Q4 -
home ownership matters, and it matters as an interaction, not as a main effect.

---

### I6 - Nobody is charged for it: 13.6565 basis points across a step from 26% to 100%.

**Query**
```sql
select b.lo,
  count(*) filter (where loan_percent_income between b.lo and 0.30)                   n_below,
  round(100.0*avg(loan_status) filter (where loan_percent_income between b.lo and 0.30),4) def_below,
  round(avg(loan_int_rate) filter (where loan_percent_income between b.lo and 0.30),4) price_below,
  round(avg(loan_int_rate) filter (where loan_percent_income > 0.30),4)                price_above,
  round(100*(avg(loan_int_rate) filter (where loan_percent_income > 0.30)
           - avg(loan_int_rate) filter (where loan_percent_income between b.lo and 0.30)),4) gap_bp
from book, (select unnest([0.10,0.15,0.20,0.25,0.27,0.28,0.29,0.30]) lo) b
where home = 'RENT' group by b.lo order by b.lo;
```

**Output**
```
┌──────┬─────────┬───────────┬─────────────┬─────────────┬─────────┐
│  lo  │ n_below │ def_below │ price_below │ price_above │ gap_bp  │
├──────┼─────────┼───────────┼─────────────┼─────────────┼─────────┤
│ 0.10 │   10247 │   21.7527 │     11.4609 │     11.8878 │ 42.6857 │
│ 0.15 │    6846 │   24.4522 │     11.6214 │     11.8878 │ 26.6346 │
│ 0.20 │    3979 │   26.0116 │     11.7512 │     11.8878 │ 13.6565 │  <- published
│ 0.25 │    1802 │   28.5239 │     11.8085 │     11.8878 │  7.9253 │
│ 0.27 │    1134 │   30.2469 │     11.8941 │     11.8878 │ -0.6320 │
│ 0.28 │     820 │   30.3659 │     11.8873 │     11.8878 │  0.0464 │
│ 0.29 │     538 │   28.9963 │     11.6955 │     11.8878 │ 19.2297 │
│ 0.30 │     284 │   28.5211 │     11.6559 │     11.8878 │ 23.1828 │
└──────┴─────────┴───────────┴─────────────┴─────────────┴─────────┘
```

**Caveat - the audit was right to press here.** "Renters just below the line" is a *choice of
band*, and the gap is **not** stable across bands: it runs from -0.63 bp to +42.69 bp. The
published +13.66 bp is the 20-30% band (n=3,979), a mid-range choice and not a best case -
tightening to 27-30% gives -0.63 bp and the single bin at exactly 0.30 gives +23.18 bp. The band
is now **named in the UI** (`BAND_LABEL` in `app/src/data.ts`, rendered in the panel subtitle
and in the figure caption) instead of being implied by the phrase "just below".
`test_the_price_gap_is_band_dependent_and_the_band_is_published` pins it. Interest rate is
missing for 3,116 loans book-wide and is never imputed, so every price here is a mean over the
loans that carry one.

**So what:** the *finding* is not the size of the gap. It is that the price line does not move
at all across a step from a quarter of these loans defaulting to all of them, on every band
tested. A gap that collapses toward zero as the comparison tightens strengthens that, which is
why the sensitivity table is published rather than the single number.

---

### I7 - It survives inside grade A: 496 grade-A renters above the line, all of them defaulted, priced 7.53%.

**Query**
```sql
select count(*) n, round(100.0*avg(loan_status),4) rate, round(avg(loan_int_rate),4) price,
       count(loan_int_rate) priced, sum(loan_amnt) principal
from book where grade = 'A' and home = 'RENT' and loan_percent_income > 0.30;
```

**Output**
```
┌───────┬────────┬────────┬────────┬───────────┐
│   n   │  rate  │ price  │ priced │ principal │
├───────┼────────┼────────┼────────┼───────────┤
│   496 │  100.0 │ 7.5297 │    447 │   6488775 │
└───────┴────────┴────────┴────────┴───────────┘
```

**Caveat:** the 7.5297% mean is over the **447** of these 496 loans that carry an interest rate;
49 have none and are not imputed. Grade A's book-wide mean price is 7.3277%, so these loans are
priced 20 bp above their own grade - against a default rate of 100% versus grade A's 9.96%.

**So what:** this is the single strongest argument that the grade is not absorbing the rule. If
grade encoded the risk, no grade-A cell would be at 100%. It also makes the recommendation
concrete: the cap has to be applied *across* grades, not folded into the grade model.

---

### I8 - The rules invert the answer to brief Q2. Debt consolidation goes from riskiest to second safest.

**Query**
```sql
select intent, count(*) n, round(100.0*avg(loan_status),4) raw_pct,
       count(*) filter (where not R) clean_n,
       round(100.0*avg(loan_status) filter (where not R),4) clean_pct
from (select *, ((home='RENT' and loan_percent_income>0.30)
               or (grade in ('D','E','F','G') and intent='DEBTCONSOLIDATION' and home<>'OWN')) R
      from book)
group by 1 order by raw_pct desc;
```

**Output**
```
┌───────────────────┬───────┬─────────┬─────────┬───────────┐
│      intent       │   n   │ raw_pct │ clean_n │ clean_pct │
├───────────────────┼───────┼─────────┼─────────┼───────────┤
│ DEBTCONSOLIDATION │  5212 │ 28.5879 │    4134 │    9.9661 │  #1 -> #5
│ MEDICAL           │  6071 │ 26.7007 │    5567 │   20.0647 │  #2 -> #2
│ HOMEIMPROVEMENT   │  3605 │ 26.1026 │    3410 │   21.8768 │  #3 -> #1
│ PERSONAL          │  5521 │ 19.8877 │    5129 │   13.7649 │  #4 -> #3
│ EDUCATION         │  6453 │ 17.2168 │    6024 │   11.3214 │  #5 -> #4
│ VENTURE           │  5719 │ 14.8103 │    5329 │    8.5757 │  #6 -> #6
└───────────────────┴───────┴─────────┴─────────┴───────────┘
```

**Caveat:** partly circular by construction - rule 2 *is* a DEBTCONSOLIDATION condition, so
removing it must lower that row. The non-circular part is the **re-ranking of the other five**,
none of which either rule names: HOMEIMPROVEMENT rises from #3 to #1, PERSONAL from #4 to #3 and
EDUCATION from #5 to #4, purely because rule 1 removes a different share of each purpose's
renters. 1,078 of the 5,212 debt-consolidation loans are removed by the two rules.

**So what:** this is the reason the rules are worth a whole dashboard rather than a footnote.
Brief Q2 asks which purposes carry more risk; the raw answer and the de-contaminated answer
disagree about the top and the bottom of the list. Every entrant who ranks purposes on the raw
book publishes an inverted answer.

---

### I9 - Grade D is 59.05% raw and 46.33% clean. The cliff is real; the raw number is not a risk gradient.

**Query**
```sql
select grade, count(*) n, round(100.0*avg(loan_status),4) raw_pct,
       round(100.0*avg(loan_status) filter (where not R),4) clean_pct,
       round(avg(loan_int_rate),4) price
from (select *, ((home='RENT' and loan_percent_income>0.30)
               or (grade in ('D','E','F','G') and intent='DEBTCONSOLIDATION' and home<>'OWN')) R
      from book)
group by 1 order by 1;

-- clean book, same subquery
select count(*) n, round(100.0*avg(loan_status),4) rate
from (select *, ((home='RENT' and loan_percent_income>0.30)
               or (grade in ('D','E','F','G') and intent='DEBTCONSOLIDATION' and home<>'OWN')) R
      from book) where not R;
```

**Output**
```
┌───────┬───────┬─────────┬───────────┬─────────┐
│ grade │   n   │ raw_pct │ clean_pct │  price  │
├───────┼───────┼─────────┼───────────┼─────────┤
│ A     │ 10777 │  9.9564 │    5.6123 │  7.3277 │
│ B     │ 10451 │ 16.2760 │    9.0247 │ 10.9956 │
│ C     │  6458 │ 20.7340 │   14.2402 │ 13.4635 │
│ D     │  3626 │ 59.0458 │   46.3318 │ 15.3614 │
│ E     │   964 │ 64.4191 │   53.0137 │ 17.0095 │
│ F     │   241 │ 70.5394 │   60.5556 │ 18.6092 │
│ G     │    64 │ 98.4375 │   97.9167 │ 20.2515 │
└───────┴───────┴─────────┴───────────┴─────────┘

clean book: n = 29,593, default 13.9222%   (whole book 21.8164%)
```

**Caveat:** grade G is n=64 and cannot support a rate estimate to the precision shown. The C→D
step is the only one worth quoting: 20.73% → 59.05% raw, 14.24% → 46.33% clean, for +1.90pp of
interest rate.

**A correction to an adversarial proxy, kept on the record.** The decision proxy that found the
rules reported the clean-book grade D rate as **35.30%**. Independent recomputation gave
**46.33%**, and 46.33% is what shipped. Re-run on 2025-09-26 against the rebuilt parquet:
46.3318%. A confident figure is not a checked one.

**So what:** the C→D cliff answers brief Q7 and it survives de-contamination, so it is a real
finding. But **59.05% must not be published as a risk gradient** - 21% of it is the two rules.
The app names 59.05% explicitly in order to refuse it, and the figure is tagged (`ladder.D.raw`)
so that the number it refuses is itself recomputed.

---

### I10 - The file is two datasets stapled together: median effect 0.1444 against 0.0089.

**Query**
```sql
-- dim_column is built in model/build.py: one row per source column, with its measured effect
-- on loan_status (Cramér's V for categoricals, |point-biserial| for numerics) and a Bonferroni
-- flag over the 25 columns declared BEFORE testing.
select block, count(*) cols, round(max(effect_on_default),4) max_effect,
       round(median(effect_on_default),4) median_effect,
       sum(case when clears_bonferroni then 1 else 0 end) clears,
       sum(null_count) n_nulls
from dim_column group by 1;
```

**Output**
```
┌──────────┬───────┬────────────┬───────────────┬────────┬─────────┐
│  block   │ cols  │ max_effect │ median_effect │ clears │ n_nulls │
├──────────┼───────┼────────────┼───────────────┼────────┼─────────┤
│ ORIGINAL │    11 │     0.4149 │        0.1444 │     10 │    4011 │
│ APPENDED │    14 │     0.3859 │        0.0089 │      3 │       0 │
└──────────┴───────┴────────────┴───────────────┴────────┴─────────┘
```

A 16× difference in median effect. The split was **declared before testing** (`ORIGINAL` /
`APPENDED` at the top of `model/build.py` and `analysis/integrity.py`), which is what makes this
a test rather than a description.

**Caveat:** the block boundary was chosen because columns 1-13 match a widely-circulated public
credit-risk dataset (same 32,581 rows, same 21.82% default rate, same null pattern). **That
coincidence is not load-bearing** - every claim rests on measured column behaviour
(`assumptions.md` A-3). Of the 29 columns, 13 are the original block (11 predictors +
`client_ID` + `loan_status`) and 16 were appended; 25 of the 29 were declared and tested
(`client_ID`, `loan_status`, `city_latitude` and `city_longitude` are not predictors).

**So what:** it changes what "which factors matter most" (brief M2) can mean. Half the columns
on this file's own column list carry no information about the outcome, and a risk-factor chart
that puts `past_delinquencies` beside `loan_grade` as though they were comparable is half noise.

---

### I11 - Both ratios brief Q3 asks about are arithmetic on columns already present, and the richer one predicts worse.

**Query**
```sql
-- identities, checked in model/build.py which RAISES if either stops holding
select max(abs(loan_to_income_ratio - loan_amnt / person_income))                       lti_err,
       max(abs(debt_to_income_ratio - (other_debt + loan_amnt) / person_income))        dti_err,
       min(other_debt / person_income) od_lo, max(other_debt / person_income) od_hi
from book;

select column_name, block, is_derived, round(effect_on_default,4) effect
from dim_column
where column_name in ('loan_percent_income','loan_to_income_ratio','debt_to_income_ratio','other_debt')
order by effect desc;
```

**Output**
```
lti_err = 9.7e-17    dti_err = 4.4e-16    other_debt / person_income in (0.050, 0.300)

┌──────────────────────┬──────────┬────────────┬────────┐
│     column_name      │  block   │ is_derived │ effect │
├──────────────────────┼──────────┼────────────┼────────┤
│ loan_to_income_ratio │ APPENDED │ true       │ 0.3859 │
│ loan_percent_income  │ ORIGINAL │ false      │ 0.3794 │
│ debt_to_income_ratio │ APPENDED │ true       │ 0.3215 │
│ other_debt           │ APPENDED │ true       │ 0.1183 │
└──────────────────────┴──────────┴────────────┴────────┘
```

`loan_to_income_ratio` correlates **0.9989** with `loan_percent_income` - the same column at
more decimal places. `other_debt` is `person_income × U(0.05, 0.30)`, and the Data Dictionary
shipped inside the workbook calls it *"Simulated additional debt held by applicant"* in the
publisher's own words.

**Caveat:** the effect measure here is `|point-biserial|`, which is a linear summary of a
relationship that is very much not linear (I5). It is used for *comparability across 25
columns*, not as an estimate of predictive power.

**So what:** brief Q3 asks how loan-to-income *and* debt-to-income relate to repayment as though
they were two questions. They are one question. Adding simulated debt makes the ratio a strictly
worse predictor (0.3215 < 0.3859) - noise dilutes signal, which is what a generated column does.

---

### I12 - `past_delinquencies` is a Poisson draw, not a measurement.

**Query**
```sql
select past_delinquencies k, count(*) n, round(100.0*avg(loan_status),4) rate
from book group by 1 order by 1;
```
plus, in `analysis/integrity.py` check 9(a) (scipy, on the raw workbook):
```python
obs = d.past_delinquencies.value_counts().sort_index()
lam = d.past_delinquencies.mean()  # 0.5051410331174611
exp = np.array([stats.poisson.pmf(k, lam) * len(d) for k in obs.index])
exp = exp * obs.sum() / exp.sum()
gof = stats.chisquare(obs.values, exp).pvalue
```

**Output**
```
┌───────┬───────┬─────────┐        Poisson(0.505141) expected
│   k   │   n   │  rate   │        ---------------------------
├───────┼───────┼─────────┤        19,660.1
│     0 │ 19702 │ 21.7694 │         9,931.1
│     1 │  9829 │ 22.0165 │         2,508.3
│     2 │  2586 │ 21.1910 │           422.3
│     3 │   405 │ 23.2099 │            53.3
│     4 │    54 │ 22.2222 │             5.4
│     5 │     4 │ 25.0000 │             0.5
│     6 │     1 │  0.0000 │
└───────┴───────┴─────────┘

chi2 goodness-of-fit p = 0.5081     variance/mean = 1.0028
effect on loan_status  = 0.0005 (|point-biserial|), p = 0.933
chi2 of the 7x2 contingency table with loan_status: p = 0.9513, Cramér's V = 0.0070
0 vs 1+ differ by 0.12pp against an MDE of 1.31pp -- well powered, and flat
```

**Two corrections made during this backfill.**
1. `analysis/profile.md` published the goodness-of-fit as **p=0.235**. Recomputed:
   **p=0.5081** at λ=0.505141. `integrity.py` has printed 0.508 all along; only the prose was
   stale. Fixed.
2. `profile.md` DQ3 labelled *"χ² p = 0.933, Cramér's V = 0.0005"*. Those are two different
   tests conflated: **0.933 and 0.0005 are the p-value and |r| of the point-biserial**; the
   χ² contingency test gives **p = 0.9513, V = 0.0070** (which is the figure `brief.md`
   carries). Both are now labelled with the test that produced them.

**Caveat:** k≥4 is n=59 in total and k=6 is a single row, so the top of the scale cannot support
a rate estimate at all - the "0.0%" at k=6 is one loan. The Poisson fit is a *positive*
identification and does not depend on those cells (they contribute ~6 expected counts).

**So what:** this is the column a credit analyst reaches for first, and it is the one column in
the file with the least information in it (effect 0.0005, rank 25 of 25). Answering brief Q5
with it concludes that past delinquency does not predict default. In a credit file that is not
a small error.

---

### I13 - REFUTED: the 2.06× "prior default" lift is grade composition, not signal.

**Query**
```sql
select round(100.0*avg(loan_status) filter (where not prior_default),4) N,
       round(100.0*avg(loan_status) filter (where     prior_default),4) Y,
       round(avg(loan_status) filter (where prior_default)
           / avg(loan_status) filter (where not prior_default),4)       lift,
       count(*) filter (where grade in ('A','B'))                       ab_n,
       count(*) filter (where grade in ('A','B') and prior_default)     ab_priors
from book;

select grade, count(*) n, sum(case when prior_default then 1 else 0 end) priors,
       round(100.0*avg(loan_status) filter (where not prior_default),4) rate_N,
       round(100.0*avg(loan_status) filter (where     prior_default),4) rate_Y,
       round(100.0*avg(loan_status) filter (where prior_default)
           - 100.0*avg(loan_status) filter (where not prior_default),4) diff_pp
from book group by 1 order by 1;
```

**Output**
```
┌─────────┬─────────┬────────┬───────┬───────────┐
│    N    │    Y    │  lift  │ ab_n  │ ab_priors │
├─────────┼─────────┼────────┼───────┼───────────┤
│ 18.3932 │ 37.8068 │ 2.0555 │ 21228 │         0 │
└─────────┴─────────┴────────┴───────┴───────────┘

┌───────┬───────┬────────┬─────────┬─────────┬─────────┐
│ grade │   n   │ priors │ rate_N  │ rate_Y  │ diff_pp │
├───────┼───────┼────────┼─────────┼─────────┼─────────┤
│ A     │ 10777 │      0 │  9.9564 │    NULL │    NULL │
│ B     │ 10451 │      0 │ 16.2760 │    NULL │    NULL │
│ C     │  6458 │   3256 │ 21.7989 │ 19.6867 │ -2.1121 │
│ D     │  3626 │   1876 │ 57.9429 │ 60.0746 │  2.1318 │
│ E     │   964 │    465 │ 66.1323 │ 62.5806 │ -3.5516 │
│ F     │   241 │    112 │ 71.3178 │ 69.6429 │ -1.6750 │
│ G     │    64 │     36 │100.0000 │ 97.2222 │ -2.7778 │
└───────┴───────┴────────┴─────────┴─────────┴─────────┘
```

**Grades A and B contain 0 of 21,228 prior defaulters.** Within grades C-F, where both levels
exist at usable n, the largest difference in either direction is **3.55pp** (grade E), and its
sign is *negative* - prior defaulters in grade E default slightly less. Grade G is n=64 and is
excluded from that statement.

**Caveat:** this is a refutation, not a finding, and it is what the entry is for. The crude
2.06× is arithmetically true; it is the *interpretation* - "prior default doubles your risk" -
that does not survive stratification. `cb_person_default_on_file` is an **input to the grade**,
so conditioning on grade removes it almost entirely.

**So what:** brief Q5 has three candidate columns and none of them adds anything: one is a
Poisson draw (I12), one is `person_age` under another name (r=0.859), and this one is the credit
grade viewed sideways. **The file's answer to Q5 is that it has none.** This is also why the
2.06× must never appear uncaveated: `profile.md` had it under *"Can support"* until this
remediation, directly contradicting `integrity.py` check 9(b) and
`test_REJECTED_prior_default_is_grade_composition` in the same repo. It never reached the app,
the poster or `SUBMISSION.md` - verified by grep on 2025-09-26.

---

### I14 - Missingness is a risk signal. The 895 rows everyone drops default at 1.46× the book.

**Query**
```sql
select emp_length_missing, count(*) n, round(100.0*avg(loan_status),4) rate
from book group by 1 order by 1;

select int_rate_missing, count(*) n, round(100.0*avg(loan_status),4) rate
from book group by 1 order by 1;
```

**Output**
```
┌────────────────────┬───────┬─────────┐   ┌──────────────────┬───────┬─────────┐
│ emp_length_missing │   n   │  rate   │   │ int_rate_missing │   n   │  rate   │
├────────────────────┼───────┼─────────┤   ├──────────────────┼───────┼─────────┤
│ false              │ 31686 │ 21.5426 │   │ false            │ 29465 │ 21.9379 │
│ true               │   895 │ 31.5084 │   │ true             │  3116 │ 20.6675 │
└────────────────────┴───────┴─────────┘   └──────────────────┴───────┴─────────┘

emp_length missing: +9.97pp, 31.51% [28.47, 34.66] Wilson, p = 1.5e-12, lift 1.46x
int_rate   missing: -1.27pp, 20.67% [19.26, 22.13] Wilson, p = 0.11  (not significant)
```

**Caveat:** the two missingness patterns behave completely differently, and only one is a
signal. Quoting "missing data is informative" as a general claim about this file would be
wrong - `loan_int_rate`'s 3,116 nulls are not.

**So what:** the standard first move on this dataset is `dropna()`, and it throws away the
riskiest 895 applicants in the book. `model/build.py` therefore makes `emp_length_missing` a
first-class boolean on the fact table and imputes nothing (`assumptions.md` A-5). That single
null outranks every appended column in the file except the two derived ratios.

---

### I15 - 1,421 of 1,635 "Unemployed" applicants report a current job.

**Query**
```sql
select count(*) n_rows, count(person_emp_length) reported,
       count(*) filter (where person_emp_length > 0) working,
       count(*) filter (where person_emp_length = 0) zero_yrs,
       round(avg(person_emp_length),4)                                  mean_reported,
       round(avg(person_emp_length) filter (where person_emp_length>0),4) mean_working,
       median(person_income) med_income
from book where emp = 'Unemployed';

select count(*) n, median(person_income) med from book where emp = 'Full-time';
```

**Output**
```
┌────────┬──────────┬─────────┬──────────┬───────────────┬──────────────┬────────────┐
│ n_rows │ reported │ working │ zero_yrs │ mean_reported │ mean_working │ med_income │
├────────┼──────────┼─────────┼──────────┼───────────────┼──────────────┼────────────┤
│   1672 │     1635 │    1421 │      214 │        4.7297 │       5.4419 │    55016.0 │
└────────┴──────────┴─────────┴──────────┴───────────────┴──────────────┴────────────┘

Full-time: n = 19,473, median person_income = 55,400
```

**Correction made during this backfill.** The published sentence read *"1,421 of 1,635
'Unemployed' applicants report a current job averaging **4.73** years"*. **Those two numbers
have different denominators.** 4.7297 is the mean over all 1,635 who report a value - including
the 214 who correctly report **zero** years and are therefore not a contradiction at all. The
mean over the 1,421 the sentence is actually counting is **5.4419**. The page now quotes 5.44
against the 1,421 and names 4.73 separately as the all-reporters figure; both are exported by
`model/build.py`, checked against DuckDB in `model/metric_checks.yml`, and pinned by
`test_the_two_unemployed_MEANS_are_not_interchangeable`.

**Caveat:** 1,672 rows are labelled "Unemployed"; 37 have no `person_emp_length` at all and are
excluded from every figure above. "Unemployed" is a self-declared categorical from the appended
block, so the contradiction is between two *appended* columns - it says the block is internally
inconsistent, which is the claim being made, but it is not evidence about the original block.

**So what:** this is the fabrication argument made **positively**, and that matters more than
the number. Five null results (I16) are consistent with "the generator made demographics
independent" *and* with "there is genuinely no demographic effect here" - they cannot
distinguish the two, and reasoning from them is the error that killed a thesis in 2025/06 and
two claims in 2025/08. A logical contradiction inside a single row is not a p-value and no
reader can dispute it. Median income $55,016 against $55,400 for the full-time employed
(p=0.665) makes the same point a second way.

---

### I16 - Demographics predict nothing, and the honest statement is the MDE range 1.28-3.15pp, not 1.28pp.

**Query** (`analysis/integrity.py` check 8(a), on the raw workbook)
```python
# per demographic: Cramér's V of the group against loan_status, and the difference the
# largest-vs-smallest group comparison would have detected at 80% power, alpha = .05
mde = 2.8 * sqrt(p0 * (1 - p0) * (1 / n_largest + 1 / n_smallest)) * 100  # p0 = 0.21816
```

**Output**
```
  gender           V=0.0012  p=0.829   spread 0.11pp    n=16,371 vs 16,210   MDE 1.28pp =  5.9% rel
  marital_status   V=0.0033  p=0.949   spread 0.59pp    n=16,368 vs  1,647   MDE 2.99pp = 13.7% rel
  education_level  V=0.0086  p=0.491   spread 1.01pp    n=13,185 vs  1,498   MDE 3.15pp = 14.5% rel
  country          V=0.0015  p=0.964   spread 0.13pp    n=10,944 vs 10,785   MDE 1.57pp =  7.2% rel
  employment_type  V=0.0092  p=0.434   spread 1.10pp    n=19,473 vs  1,672   MDE 2.95pp = 13.5% rel
```

Country default rates: UK 21.7288% (n=10,944), USA 21.8577% (n=10,852), Canada 21.8637%
(n=10,785) - brief Q6's answer, and it is "no difference".

**Caveat, and it is the point of the entry.** `brief.md` published **1.28pp** as *the* MDE. That
is the **best case of five**, and the best case belongs to the only demographic with two
near-equal groups. The comparisons that would actually matter to a fair-lending examiner -
widowed borrowers (n=1,647), PhD holders (n=1,498) - could only have detected 2.99pp and 3.15pp,
i.e. **13.7% and 14.5% relative**. `integrity.py` has printed the full range and the sentence
*"the honest range is 5.9%-14.5% relative, NOT the 5.9% best case alone"* all along; only
`brief.md` quoted the single number. Fixed.

**So what:** "no disparity detected" is a statement about the *file*, not about the bank, and it
is only as strong as what could have been detected. Publishing 1.28pp alone overstates it by a
factor of about 2.5 for the groups a regulator would look at first.

---

### I17 - The test an examiner actually runs: does a demographic predict what the bank *did*? 0 of 20.

**Query** (`analysis/integrity.py` check 8(c))
```python
# 5 demographics x 4 bank actions (loan_grade, loan_int_rate, loan_amnt, loan_term_months)
# eta^2 for the numeric actions, Cramér's V for grade; Bonferroni alpha = 0.05/20 = 2.5e-3
```

**Output**
```
0 of 20 treatment tests clear Bonferroni (alpha = 2.5e-03);
largest effect across all of them is eta2 = 0.00029
```

**Caveat:** still a null result, with everything that implies (I16). Its value is that it is a
*wider* null than the outcome test - it says the demographics do not predict price, grade, size
**or** term either - and it is the question a regulator asks, whereas "do the groups default at
different rates" is not.

**So what:** outcome disparity is not disparate impact. This entry is what lets the dashboard
say something about brief M5 ("safer and fairer") without either fabricating a clean bill of
health or refusing to engage.

---

### I18 - The 100.0000% is downstream of the source column's rounding. On the full-precision ratio it is 97.0744%.

**Query**
```sql
-- loan_percent_income is 2dp in the source; loan_to_income_ratio is loan_amnt/person_income
-- to 1e-17. Same condition, different column:
select count(*) n, round(100.0*avg(loan_status),4) rate
from book where home = 'RENT' and loan_to_income_ratio > 0.30;
```

**Output**
```
┌───────┬─────────┐
│   n   │  rate   │
├───────┼─────────┤
│  2461 │ 97.0744 │
└───────┴─────────┘
```

**Caveat:** none - this *is* the caveat, on I1 and I3. The rule reads the rounded column, so the
exactness is a property of the rounded column. It is published in the app footer beside the
exact figure (`lti_exact.n`, `lti_exact.rate`) rather than in a note, and pinned by
`test_rule1_is_NOT_exact_on_the_full_precision_ratio`.

**So what:** it sharpens the reading of the rule rather than weakening it. Whatever wrote these
labels was reading `loan_percent_income` - the 2-decimal column - which is one more reason to
treat the pattern as a lookup rather than an economic threshold.

---

### I19 - There are no declined applications, so approval-stage fairness is untestable here whatever you believe about the data.

**Query**
```sql
-- the whole query, and its emptiness is the result
select column_name from dim_column
where lower(column_name) similar to '%(appl|decis|approv|deni|reject|status_appl)%';
```

**Output**
```
(0 rows)   -- loan_status is a performance outcome, not an application decision:
           -- select distinct loan_status from book  ->  0, 1  (25,473 / 7,108)
```

**Caveat:** none. It is a structural fact about the extract, established by enumerating all 29
columns in `integrity.py` check 8(d).

**So what:** this is the only fairness claim in the month that **needs no argument about the
generator at all**. "Fair and accessible lending" is a statement about who gets approved; a
booked-loans-only extract contains no one who was turned away, so it cannot speak to approval
rates, to who was declined, or on what basis. It survives every objection to I15 and I16, and it
alone justifies refusing to certify Nova Bank's lending as fair from this file - which is the
answer the brief's twice-named fairness question actually gets.

---

## Rejected

| Candidate | Why dropped |
|---|---|
| *"A fairness audit here returns a clean bill of health, and that answer is manufactured."* - thesis #1 | **The finding survives; the reasoning did not.** It inferred "the generator made demographics independent" from five null results, and "there genuinely is no demographic effect" predicts identical p-values. Same error as 2025/06 and 2025/08. Rebuilt on positive tests (I15) and demoted to a supporting panel. |
| *"The price ladder is smooth; the risk ladder has a cliff."* - thesis #2 | **False as written.** Price tracks grade almost perfectly (7.33 → 20.25% across A→G, I9), and the C→D cliff it named is partly rule composition (59.05% → 46.33%). |
| "Prior default on file doubles your default rate" | Grade composition, not signal - grades A and B contain 0 of 21,228 prior defaulters (I13). Arithmetically true, causally empty. It nonetheless survived in `profile.md` under *"Can support"* until 2025-09-26. |
| "Past delinquencies are a leading risk indicator" | It is a Poisson(0.505141) draw; effect 0.0005, rank 25 of 25 (I12). |
| "Debt-to-income is a stronger risk measure than loan-to-income" | It is loan-to-income plus a uniform draw and predicts *worse*, 0.3215 vs 0.3859 (I11). |
| Any geographic finding (18 cities, 9 states, 3 countries) | Cities are drawn uniformly (χ² p=0.949); country spread is 0.13pp, V=0.0015 (I16). Generator artefact, not a business signal. |
| Any employment-type, education or marital-status risk finding | Spreads of 1.10 / 1.01 / 0.59pp against MDEs of 2.95 / 3.15 / 2.99pp (I16). Underpowered *and* flat. |
| "The mean interest rate is 11.0% in every demographic group" | Too obvious once I17 is stated - it is the same null a fourth time, and it added nothing to the arc. Kept in `profile.md` as a generator fingerprint only. |
| A default-prediction model | The label is 42% decided by two boolean rules (I3). Any model reports excellent metrics and has learned the lookup table. Refusing to fit one is the finding. |
| Loan term (12/24/36/60 months) as a risk axis | effect 0.0118, p=0.033, fails Bonferroni α=2.0e-3 (I10). Brief Q7 asks; the answer is no. |

> **Completeness caveat.** This table was reconstructed on 2025-09-26 from `.workbench/2025/09/RETRO.md`,
> `integrity.py` and `brief.md`. Candidates that were considered and dropped at G3 without
> leaving a trace in those files are not recoverable and are not represented here.

## Non-obvious checklist

Worked deliberately in G3 (ticks re-verified against the ledger 2025-09-26):

- [x] **two-way interactions** - home ownership × loan-to-income *is* the thesis (I5). The main
      effect of either alone is unremarkable; the interaction is a wall.
- [x] **Simpson's paradox** - I8 and I9. Debt consolidation is the riskiest purpose overall and
      the second safest within the de-contaminated book; grade D loses 12.7pp the same way.
- [x] **rate vs volume mismatch** - I3: 9.1710% of the loans, 42.0371% of the defaults.
- [x] **concentration (Pareto / Gini)** - the same entry, stated as concentration: 2,988 rows
      carry $41,607,350 of principal and two fifths of all losses.
- [x] **distribution vs average** - I12 (a Poisson *distribution* identifies the column that its
      flat average would not) and I5 (the mean default rate for renters hides a step function).
- [ ] **cohorts** - N/A. No date column exists anywhere in the 29 (`.workbench/2025/09/analysis/questions.md` Q33).
- [ ] **changepoints & anomalies** - N/A as a *time* analysis for the same reason. The
      cross-sectional equivalent was worked and is I4: the changepoint is at 0.30 and it is
      exact to the data's own resolution.
- [ ] **funnel leakage** - N/A. There is no funnel: no application, decision or approval column
      (I19). Its absence is itself published.
- [ ] **lead / lag** - N/A, no time dimension.
- [x] **missingness as signal** - I14. 895 nulls at a 1.46× lift, kept and modelled as a boolean
      rather than dropped or imputed.
- [x] **survivorship** - I19, in the strongest available form: the entire book is survivors of
      an approval process that left no trace in the file. Also I4, where 203 apparent survivors
      of rule 1 turned out to be a boundary error rather than a population.
- [x] **mix vs performance decomposition** - I13. The 2.06× prior-default lift decomposes
      entirely into grade mix; within grade there is nothing left.
