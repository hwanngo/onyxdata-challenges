# Insight ledger - 2025/07 · Customer Satisfaction & Loyalty

**No query, no claim.** Every figure reproduced by `analysis/integrity.py`.

## Thesis

> **This survey cannot answer the questions it was designed to ask.** Satisfaction here is
> indistinguishable from a uniform random draw, not one of seven candidate drivers survives
> correction, and with 120 customers the smallest difference detectable at 80% power is **1.55
> points on a 10-point scale**. The finding is not "customers are satisfied" or "support hurts" -
> it is that OmniRetail needs a bigger sample before any of this is answerable.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | 120 customers, nine confident questions, each presupposing a driver of satisfaction. |
| **Complication** | Satisfaction is uniform noise (**I-1**), and every proposed driver - including the brief's headline one - measures essentially zero (**I-2**, **I-3**). |
| **Resolution** | The study is underpowered by design (**I-4**): it could not have detected a real effect smaller than 1.55 points. The deliverable is a measurement design, not a satisfaction dashboard (**I-5**). |

---

## I-1 - Satisfaction is a uniform random draw

**Query**
```python
counts = df.Satisfaction_Score.value_counts().sort_index()
scipy.stats.chisquare(counts.values)  # H0: uniform over 1..10
```

**Output**
```
score:  1   2   3   4   5   6   7   8   9  10
count: 16  14   8  12  13  13  11   6  12  15

chi-square vs uniform(1..10): chi2 = 7.00 (9 df), p = 0.637
mean 5.35 (uniform expects 5.50)   sd 3.03 (expects 2.87)
```

**Caveat:** failing to reject uniformity is not proof of uniformity - but with a flat histogram, no
mode, no skew and n=120, there is nothing here that any model could latch onto.

**So what:** there is no "satisfied majority" and no "detractor cluster". Every segment average in
this report is an average of ten to seventy coin flips.

---

## I-2 - Not one proposed driver survives correction

**Query**
```python
for axis in AXES:  # 7 axes, declared before testing
    scipy.stats.kruskal(*[g.Satisfaction_Score for _, g in df.groupby(axis)])
scipy.stats.pearsonr(df.Age, df.Satisfaction_Score)  # the 8th, also published
# Bonferroni alpha = 0.05 / 8 = 0.00625
```

**Output**
```
axis                   p        eta^2     verdict
Satisfaction_Factor    0.0231   0.1540    does not survive
Loyalty_Level          0.0863   0.0399    does not survive
Purchase_History       0.2892   0.0111    does not survive
Group                  0.4887   0.0037    does not survive
Gender                 0.5226   0.0032    does not survive
Location               0.7219   0.0514    does not survive
Support_Contacted      0.9557   0.0000    does not survive
Age (Pearson)          r = +0.020, p = 0.827

family = 8 tests (7 declared axes + the published Age correlation)
Bonferroni alpha = 0.05 / 8 = 0.00625        smallest observed p = 0.0231
```

**Correction, 2025-07-29.** This entry originally declared a family of **seven** and quoted
α=0.0071, while also publishing the Age correlation - an eighth test of the same outcome on the
same 120 rows. A test you publish is a test you ran, so the family is eight and α is **0.00625**.
The conclusion does not move: the smallest p is 0.0231, which cleared neither threshold. Every
artifact that quoted 0.0071 has been updated.

**Caveat:** absence of evidence at n=120 is not evidence of absence - which is exactly why I-4
exists. The correct statement is "this data cannot show it", not "it does not exist".

**So what:** requirements R1, R3, R6 and R8 have the same answer, and it is not the one the brief
expects. R2, R5, R7 and R9 ask about a *different outcome variable* and are answered separately in
**I-6** - these Kruskal-Wallis results are about satisfaction and cannot answer a question about
loyalty.

---

## I-3 - The brief's headline question measures 0.013 points

R4 asks: *does contacting customer support negatively impact satisfaction?*

**Query**
```sql
select Support_Contacted, count(*), avg(Satisfaction_Score) from f group by 1;
-- plus Cohen's d and a two-sample t-test
```

**Output**
```
Support_Contacted   n    mean satisfaction
Yes                56          5.357
No                 64          5.344

difference  +0.013 points on a 10-point scale
Cohen's d   +0.004        t-test p = 0.981
```

**Caveat:** none needed - this is as close to a zero effect as a real sample produces.

**So what:** if OmniRetail is holding a belief that support contact damages satisfaction, this data
neither supports nor refutes it; the measurement is too coarse to tell. Acting on it either way
would be acting on nothing.

---

## I-4 - The study is underpowered by design

**Query**
```python
n_per_group = ((z(0.975) + z(0.80)) ** 2 * 2) / d**2  # d = diff / sd, sd = 3.03
```

**Output**
```
to detect            need per group     have
0.5 points                   575         ~60
1.0 points                   144         ~60
1.5 points                    64         ~60
2.0 points                    36         ~60

minimum detectable difference at n=60/group: 1.55 points
```

**Caveat:** assumes a two-group comparison at α=0.05, 80% power, and the observed sd of 3.03. Nine
of the brief's questions involve finer splits than two groups, so the true requirement is higher.

**So what:** **this is the report's actual recommendation.** A support experience costing a full
point of satisfaction - a serious problem - would be invisible in this survey. To answer R4 alone
OmniRetail needs ~144 customers per group; to answer R3 across ten cities, several hundred.

---

## I-5 - The one axis that flirts with significance, and why it is not a finding

`Satisfaction_Factor` reaches p=0.023, η²=0.154 - Product Quality 7.55 down to Ease of Use 4.07.
It is the finding this dataset most invites, and it does not hold.

**Query**
```python
observed = eta_squared(df, "Satisfaction_Factor", "Satisfaction_Score")
null = [
    eta_squared(df.assign(lab=rng.permutation(df.Satisfaction_Factor)), "lab", ...)
    for _ in range(4000)
]  # relabel at random, 4000 times
```

**Output**
```
observed eta^2 = 0.1540
permutation p  = 0.025     median null eta^2 = 0.0701
10 groups, mean group n = 12, smallest n = 10
Bonferroni alpha across the 8 satisfaction tests = 0.00625      (see I-2)
```

**Monte-Carlo caveat on that p:** 0.0250 is `integrity.py` at seed 0 and is exactly reproducible.
Re-running with five other seeds gives 0.0257-0.0312 (4,000 draws → ±0.003 at this level), so the
honest reading is "about one time in thirty-five to forty", not a p of 0.025 to three places.

**Caveat:** this is the closest thing to a result in the file, and a reader may reasonably want it
shown. It is shown - with the permutation p, the group sizes and the correction threshold attached.

**So what:** shuffling the factor labels at random produces an effect this large about one time in
forty. Splitting 120 customers ten ways will manufacture a spread whether or not one exists.

---

## I-6 - R2, R5, R7 and R9 ask about a different outcome, and are now tested on it

Three of the brief's nine questions ask about **loyalty**, not satisfaction:

| | Question | Outcome the question names |
|---|---|---|
| R2 | *Are some customer segments more loyal than others?* | `Loyalty_Level` |
| R5 | *Do Price / Product Variety influence loyalty?* | `Loyalty_Level` |
| R7 | *Are there regional clusters of loyal or dissatisfied customers?* | `Loyalty_Level` |
| R9 | *Do demographics favour particular satisfaction factors?* | `Satisfaction_Factor` |

Until 2025-07-29 all four were answered with a Kruskal-Wallis on `Satisfaction_Score` - the right
arithmetic on the wrong variable. `Loyalty_Level` is a three-level categorical, so the test is a
chi-square of independence, not a rank test on a score nobody asked about.

**Query**
```python
for axis in [
    "Gender",
    "Group",
    "Age_Band",
    "Satisfaction_Factor",
    "Location",
    "State",
    "Purchase_History",
]:
    scipy.stats.chi2_contingency(pd.crosstab(df[axis], df.Loyalty_Level), correction=False)
for axis in ["Gender", "Age_Band", "Group"]:  # R9
    scipy.stats.chi2_contingency(pd.crosstab(df[axis], df.Satisfaction_Factor), correction=False)
```
`correction=False` throughout: no table here is 2×2, so Yates never applies, and applying it to
part of a family would make the family incomparable. `Age_Band` uses exactly the cut in
`model/build.py`, so the test and the UI cannot drift.

**Output** (`analysis/integrity.py`, section I-6)
```
Loyalty ~ Gender               chi2= 1.809 df= 2 p=0.4048 V=0.123 min_expected=16.65
Loyalty ~ Group                chi2= 1.351 df= 2 p=0.5090 V=0.106 min_expected=14.80
Loyalty ~ Age_Band             chi2= 6.288 df= 6 p=0.3917 V=0.162 min_expected= 7.71
Loyalty ~ Satisfaction_Factor  chi2=17.411 df=18 p=0.4951 V=0.269 min_expected= 3.08   (27/30 exp<5)
Loyalty ~ Location             chi2=22.819 df=18 p=0.1976 V=0.308 min_expected= 1.85   (24/30 exp<5)
Loyalty ~ State                chi2=13.895 df=10 p=0.1778 V=0.241 min_expected= 2.77   ( 8/18 exp<5)
Loyalty ~ Purchase_History     chi2= 2.256 df= 2 p=0.3237 V=0.137 min_expected=15.72

R9:
Factor  ~ Gender               chi2=17.961 df= 9 p=0.0356 V=0.387 min_expected= 4.50   ( 5/20 exp<5)
Factor  ~ Age_Band             chi2=18.350 df=27 p=0.8925 V=0.226 min_expected= 2.08   (40/40 exp<5)
Factor  ~ Group                chi2= 6.147 df= 9 p=0.7251 V=0.226 min_expected= 4.00   ( 7/20 exp<5)
```

**The reported family, in full - 18 between-group tests.** This is the number the dashboard
quotes, and it is the count of tests actually run and published:

| Outcome | Tests | Axes |
|---|---:|---|
| Satisfaction (I-2) | 8 | Satisfaction_Factor, Loyalty_Level, Purchase_History, Group, Gender, Location, Support_Contacted, Age (Pearson) |
| Loyalty (this entry) | 7 | Gender, Group, Age_Band, Satisfaction_Factor, Location, State, Purchase_History |
| Satisfaction factor (R9) | 3 | Gender, Age_Band, Group |
| **Total** | **18** | Bonferroni α = 0.05/18 = **0.0028** |

Two further figures are reported and are deliberately *not* counted in this family: the goodness-
of-fit χ² against uniform (I-1) is not a between-group comparison, and R4's t-test is a second
method on a comparison already counted (Support_Contacted).

**Caveat:** four of these tables are too thin for the χ² approximation. `Loyalty ~ Location` has a
smallest expected cell of 1.85 and `Factor ~ Age_Band` has every expected cell below 5, so those
p-values are indicative at best. That is itself the finding - the data will not support the test
the question requires, which is the same conclusion I-4 reaches by power.

**So what:** the conclusion is unchanged - nothing is detectable on either outcome - but "9 of 9
answered, each with its test" is now literally true rather than nearly true. The nominal p=0.0356
on `Factor ~ Gender` is the only value under 0.05 besides R1, and it sits on a 2×10 table with
**five of twenty expected cells below five**; it clears neither Bonferroni threshold. It is
published so that the count of tests reported equals the count of tests run.

---

## I-7 - What the ladder's overlap claim is scoped to

The uncertainty ladder draws **six** axes - Support contacted, Loyalty, Repeat buyer, Gender,
Group, State - which is 17 groups. The published caption asserted *"every confidence interval
overlaps every other, and every observed difference sits inside the band this study could not have
detected."* Both halves are true of what is drawn, and both are false once you widen the frame.

**Query** (`analysis/integrity.py`, section I-7)
```python
rungs   = mean ± 1.96·sd/√n for every level of every ladder axis, clipped to [1, 10]
separated = pairs where hi_i < lo_j
within  = max(mean) - min(mean) within a single axis
cross   = max(mean) - min(mean) across all rungs regardless of axis
```

**Output**
```
drawn by default (6 axes):        17 groups, 136 pairs,  0 separated
    widest gap within one axis 1.3708 (Loyalty); across different axes 1.8835
with Satisfaction_Factor added:   27 groups, 351 pairs, 16 separated
    widest gap within one axis 3.4740 (Factor);  across different axes 3.4740
detection floor (MDD at n=60/group): 1.5476

Satisfaction_Factor rungs:
    Product Quality       n=11  7.545  [6.382, 8.708]
    Packaging             n=15  7.000  [5.470, 8.530]
    Product Variety       n=10  6.100  [4.410, 7.790]
    Customer Service      n=11  5.909  [4.335, 7.483]
    Delivery Speed        n=12  5.167  [3.663, 6.670]
    Brand Reputation      n=14  4.786  [3.219, 6.353]
    Support Availability  n=11  4.455  [2.542, 6.367]
    Price                 n=10  4.400  [2.133, 6.667]
    Features              n=12  4.083  [2.647, 5.520]
    Ease of Use           n=14  4.071  [2.435, 5.708]
  separated pairs within this axis: 4
    Product Quality vs Ease of Use / Features / Support Availability / Brand Reputation
```

**Two corrections, 2025-07-29.**

1. **"All seventeen groups, every interval overlaps every other" omitted the axis with the lowest
   p.** `Satisfaction_Factor` was left off the ladder because ten groups of ~12 crowd it - a
   legitimate design decision - but the claim was then stated as though it covered the study. It
   does not: adding that axis separates four pairs, all of them Product Quality against the bottom
   of the axis. The app now (a) offers the axis behind a toggle and (b) *computes* the sentence
   from the rows on screen, so it re-states itself under every filter and every toggle. A claim
   that recomputes cannot go stale.
2. **"Every observed difference sits inside the detection floor" was true only within an axis.**
   The floor is ±1.5476, a **two-group** quantity. The widest gap between two levels of one axis is
   1.3708 (Loyalty: Low 5.844 - Medium 4.474), which is inside it. The widest gap between any two
   rungs regardless of axis is 1.8835 (State: IL 6.357 - Loyalty: Medium 4.474), which is not -
   but IL-vs-Medium-loyalty is two different cuts of the same customers and was never a comparison
   the study proposed. The caption now names the within-axis gap and the axis it belongs to.

**Caveat:** the four separated factor pairs are not evidence of a factor effect. R1's η²=0.154
fails Bonferroni at either threshold and barely beats relabelling (I-5); ten groups of ~12 will
manufacture one high rung whether or not an effect exists. The separation is why the axis is worth
*showing*, not why it would be worth *believing*.

**So what:** the ladder's headline is now a computed count, not an assertion - and the one
exception is a button the reader can press rather than a caveat they have to take on trust.

---

## Rejected

| Candidate | Why |
|---|---|
| "Product Quality drives satisfaction" | I-5 - 10 groups of ~12, fails correction, barely beats relabelling |
| "Low-loyalty customers are the most satisfied" | True in the table (Low 5.84 > High 5.65 > Medium 4.47) and **non-monotonic**, which is the signature of noise, not a paradox worth reporting |
| "Phoenix is the unhappiest city" | `Location` p=0.72; 19 of 30 Location×Loyalty cells hold fewer than 5 customers, one is empty |
| "Repeat purchasers are more satisfied" (R6) | p=0.29, η²=0.011 |
| "Women are more satisfied than men" (R2) | p=0.52, η²=0.003 |
| "Older customers are more satisfied" | r=+0.020, p=0.83 |
| Any regional cluster (R7) | 10 cities, **6-19** customers each (San Antonio.TX n=6, Phoenix.AZ n=19); χ² of loyalty against city p=0.20 on a table with 19 of 30 cells below n=5 and one empty - no spatial structure to test |

## So what - three recommendations

1. **Do not act on any segment difference in this survey.** Not one survives correction, and the
   largest apparent effect is reproducible by shuffling labels. → *I-2, I-5*
2. **Re-run the survey at ~150 responses per comparison group before asking R4 again.** The current
   design cannot see anything smaller than 1.55 points; a one-point effect needs 144 per group. → *I-4*
3. **Collect a date and an order value.** There is no time column despite "feedback throughout
   2024" and no spend, so satisfaction cannot be tied to behaviour or trend - the two things that
   would make this dataset actionable at any sample size. → *grain*

## Non-obvious checklist

- [x] two-way interactions - Location×Loyalty attempted; 19/30 cells below n=5, abandoned as unpowered
- [x] Simpson's paradox - checked in the loyalty ordering; the non-monotonicity is noise, not reversal
- [x] rate vs volume - n/a, no volume measure
- [x] concentration - n/a
- [x] distribution vs average - **the central check**: the distribution is flat (I-1)
- [x] cohorts - n/a, no dates
- [x] changepoints - n/a, no dates
- [x] funnel leakage - n/a
- [x] lead / lag - n/a, no dates
- [x] missingness as signal - **zero nulls anywhere**; the gap is whole columns (date, spend), not values
- [x] survivorship - n/a
- [x] mix vs performance - attempted on Satisfaction_Factor; rejected (I-5)
- [x] **statistical power** - added to the checklist this month; it is what turned a null into a deliverable
