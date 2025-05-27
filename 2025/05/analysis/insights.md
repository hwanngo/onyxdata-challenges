# Insight ledger - 2025/05 · Mobile Phone Sales

**The gate that decides the Insights score. No query, no claim.**
Queries run against `Fact_Sales` registered as `f` - see `questions.sql.py` and `integrity.py`.

## Thesis

> **This is not a volume business, it is a price-ladder business. Winning the unit race everyone is
> scoring buys you third place in revenue - and below first place the race cannot even be scored.
> Revenue is decided by which rung of the ladder each market buys on, and one phone in nineteen
> carries an eighth of it.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | $14.53M across 5 brands, 19 models, 4 countries. The obvious read - and the one every published entry took - is a volume race that OnePlus wins on 4,395 units. |
| **Complication** | That race is real for exactly one place and unrankable below it (**I-1**: OnePlus's 23.70% survives a permutation null at p=0.002; the other four brands do not separate). And winning it is worth nothing - rank by revenue and the table inverts (**I-2**: Samsung +6.46pp, Xiaomi -6.50pp, and the unit leader lands third). |
| **Resolution** | Revenue is made on the price ladder (**I-3**: one model = 11.6% of revenue from 5.7% of days; **I-5**: premium is 25% of units, 40% of money), and markets differ only by which rung they buy - **not** by what they are charged (**I-4**). |

---

## Ledger

### I-1 - The unit race is real for first place only, and unrankable below it

One brand separates from the null and the rest do not. OnePlus's **23.70%** unit share sits outside a
20,000-draw permutation null (**p=0.002**, Bonferroni-corrected 0.009); Apple, Xiaomi, Samsung and
Google all sit inside theirs. So "OnePlus leads volume" is supportable and *every other* volume
ranking in this dataset - 2nd vs 3rd vs 4th vs 5th, and every best-selling model / colour / storage
claim - is not.

> **Correction, 2025-05-27.** This entry previously claimed all five shares were "statistically
> indistinguishable", on two wrong tests. Both are replaced below; see the Caveat.

**Query**
```sql
-- (1) the shares themselves
select Brand, sum(Units_Sold) units,
       round(100.0*sum(Units_Sold)/sum(sum(Units_Sold)) over (), 2) unit_share_pct
from f group by 1 order by units desc;

-- (2) how many day-rows each brand was allocated (is the share an artifact of coverage?)
select Brand, count(*) day_rows from f group by 1;
```
```python
# analysis/integrity.py - between-brand test, the one the claim actually needs
scipy.stats.kruskal(*[g.Units_Sold.values for _, g in fact.groupby("Brand")])

# permutation null for a share, which is a ratio of sums, not a proportion
rng = np.random.default_rng(0)  # seed 0, 20,000 draws
null = [100 * u[rng.permutation(brand) == b].sum() / u.sum() for _ in range(20_000)]
# two-sided p = P(|null - mean(null)| >= |observed - mean(null)|), +1/+1 smoothed

# pooled marginal only - shape of Units_Sold, NOT a between-brand test
scipy.stats.kstest((Units_Sold - 1) / 98, "uniform")

# is the day-row allocation itself even?
scipy.stats.chisquare([83, 74, 71, 70, 68])
```

**Output**
```
Brand     units   share    permutation null 95%   two-sided p   Bonferroni x5
OnePlus   4,395   23.70%   [18.00, 22.39]           0.0017         0.0085   <- outside
Apple     4,226   22.78%   [20.38, 24.98]           0.9271         1.0000
Xiaomi    3,529   19.03%   [16.97, 21.27]           0.9192         1.0000
Samsung   3,246   17.50%   [17.22, 21.54]           0.0865         0.4327
Google    3,152   16.99%   [16.44, 20.71]           0.1428         0.7142

Kruskal-Wallis, Units_Sold per day by brand:  H = 11.789,  df = 4,  p = 0.0190
  (means/day: OnePlus 59.4 | Apple 50.9 | Xiaomi 50.4 | Google 46.4 | Samsung 45.7)

KS(Units_Sold vs Uniform(1,99)):  D = 0.0444,  p = 0.4521   <- POOLED MARGINAL ONLY
  mean 50.68 (uniform expects 50.0) | sample variance 733.5 (expects 800)

Day-row allocation 83/74/71/70/68:  chi2 = 1.896, df = 4, p = 0.7548
  -> coverage is even, so OnePlus's share is not an artifact of getting more days
```

**Caveat:** two things this entry previously got wrong, both now corrected.
1. **The KS test was answering a different question.** `kstest` on `Units_Sold` tests the *pooled
   marginal* - whether the per-day quantity looks uniform overall. It cannot detect a between-brand
   difference, because it never sees the brand label. The between-group test is Kruskal-Wallis, and
   it returns **p=0.0190**: the brands do differ. The pooled marginal genuinely is uniform-looking
   (p=0.45); that fact is retained above because it is why the *magnitudes* are so noisy, but it is
   no longer offered as evidence about brands.
2. **The "±4.36pp binomial 95% CI" was the wrong interval.** A unit share here is a ratio of sums
   over 366 day-rows, not a proportion of 366 Bernoulli trials, so a binomial CI does not apply to
   it - the identical mistake corrected for channel ASP below. The permutation null replaces it and
   is narrower, which is why one brand now separates where none did before.

What survives unchanged: effective n is **366 daily rows**, not 18,548 units. Sizing significance off
18K is still the field's core error, and it is what makes the field's full 1-to-5 brand ranking
unsupportable.

**So what:** the honest statement is one-sided. It licenses *"OnePlus sells the most phones"* and
forbids *"Xiaomi outsells Google"* - and the effect it licenses is small enough (23.70% against a
null topping out at 22.39%) to be worth nothing commercially, because first place in units is third
place in money (**I-2**). Shelf space and buying decisions made on positions 2-5 of the unit table
are being made on noise.

---

### I-2 - Rank by revenue and the league table inverts

The brand selling the most units earns the third-most revenue; the brand third in units earns the
least.

**Query**
```sql
select Brand,
       round(100.0*sum(Units_Sold)   /sum(sum(Units_Sold))    over (),2) unit_share,
       round(100.0*sum(Total_Revenue)/sum(sum(Total_Revenue)) over (),2) rev_share,
       round(100.0*sum(Total_Revenue)/sum(sum(Total_Revenue)) over ()
           -  100.0*sum(Units_Sold)  /sum(sum(Units_Sold))    over (),2) gap_pp
from f group by 1 order by gap_pp desc;
```

**Output**
```
Brand     unit_share  rev_share   gap_pp    units rank -> revenue rank
Samsung      17.50%     23.97%    +6.46       4  ->  2
Apple        22.78%     25.08%    +2.30       2  ->  1
Google       16.99%     17.58%    +0.59       5  ->  4
OnePlus      23.70%     20.84%    -2.85       1  ->  3
Xiaomi       19.03%     12.53%    -6.50       3  ->  5
```

**Caveat:** the *unit* half of each share is unrankable below first place (I-1). What makes this
robust is that the revenue gap is driven by price, which is not noise - price is model-determined to
~3% (median within-model CV 0.032) and brand price separation is overwhelming (**ANOVA
F=34.83, p ≈ 1.3e-24**). The direction and size of the conversion gap are structural even though the
unit ranking is not.

**So what:** manage brands on revenue conversion, not share of shelf. Xiaomi occupies a fifth of the
units for an eighth of the money - a portfolio problem, not a sales-execution one.

---

### I-3 - One phone in nineteen carries an eighth of the business

The Samsung Z Fold 6 produces 11.58% of all revenue from 5.74% of trading days. Samsung owns both
the best *and* worst revenue model in the catalogue - the widest price spread of any brand.

**Query**
```sql
select round(100.0*sum(Total_Revenue) filter (where Mobile_Model='Z Fold 6')/sum(Total_Revenue),2) pct_rev,
       round(100.0*count(*)           filter (where Mobile_Model='Z Fold 6')/count(*),2)           pct_days,
       round(100.0*sum(Units_Sold)    filter (where Mobile_Model='Z Fold 6')/sum(Units_Sold),2)    pct_units
from f;

select Mobile_Model, round(avg(Price),0) price, sum(Total_Revenue) rev,
       round(100.0*sum(Total_Revenue)/(select sum(Total_Revenue) from f),2) pct_all_rev
from f where Brand='Samsung' group by 1 order by rev desc;
```

**Output**
```
Z Fold 6:  11.58% of revenue  |  5.74% of days  |  4.92% of units
The five highest-revenue days of the year are ALL Z Fold 6 (top: 2024-06-12, $183,150).

Samsung barbell            price      revenue    % of ALL revenue   rank of 19
  Z Fold 6                $1,844   $1,681,917         11.58%             1
  Galaxy S25 Ultra        $1,249   $1,277,620          8.80%             2
  Galaxy A55                $447     $308,156          2.12%            17
  Galaxy M15                $347     $213,328          1.47%            19

Brand price spread (dearest / cheapest model):
  Samsung 5.3x | Xiaomi 2.6x | Apple 2.5x | Google 2.0x | OnePlus 1.5x
```

**Caveat:** *which* model tops the table is partly luck - 21 Z Fold 6 days at uniform-random units
each. What is not luck is that the top revenue model is the most expensive one; that follows from
the price ladder. Read as "the flagship carries the business", not "the Z Fold 6 is irreplaceable".

**So what:** concentration risk - a supply interruption or delisting on one flagship removes ~an
eighth of revenue. It also names the growth lever, and the lever is *having a top rung at all*, not
the width of the spread:

```sql
select p.brand,
       count(distinct p.mobile_model) filter (where f.price_band='Premium $1000+') premium_models,
       round(max(p.list_price)*1.0/min(p.list_price),2) spread
from fct_daily_sales f join dim_product p using(product_key) group by 1;
```
```
Brand     premium models   price spread   conversion gap (I-2)
Samsung          2             5.31x          +6.46pp
Apple            2             2.53x          +2.30pp
Google           1             1.98x          +0.59pp
Xiaomi           0             2.55x          -6.50pp   <- worst converter
OnePlus          0             1.52x          -2.85pp
```

**The two brands with no model in the top price band - Xiaomi and OnePlus - are exactly the two
whose revenue share falls below their unit share.** Nothing else in the table separates the winners
from the losers: Xiaomi's 2.55× spread is wider than Apple's 2.53×, and Apple gains 2.30pp while
Xiaomi loses 6.50.

> **Correction, 2025-05-27.** This paragraph previously read "OnePlus ... converts units to revenue
> worst of the four Android brands". That is wrong, and it contradicted the I-2 table on this same
> page. OnePlus is **-2.85pp, fourth of five and second-worst of the four Android brands**; the worst
> converter is **Xiaomi at -6.50pp**. The corrected structural claim is the premium-band one above,
> which holds for both.

---

### I-4 - Markets differ by which rung they buy, not by what they are charged

Country ASP differences are **almost entirely product mix, not pricing**. The same phone costs the
same everywhere; the pricing effect for the two markets with enough trading days to test is under
**$1** each way on a **$21.31** ASP gap.

**Query**
```sql
select Mobile_Model,
       round(avg(case when Country='India'      then Price end),0) india,
       round(avg(case when Country='Turkey'     then Price end),0) turkey,
       round(avg(case when Country='Bangladesh' then Price end),0) bangladesh
from f group by 1;

select Country,
       round(100.0*sum(Units_Sold) filter (where Price>=1000)/sum(Units_Sold),1) pct_units_premium,
       round(sum(Total_Revenue)*1.0/sum(Units_Sold),0)                           asp
from f group by 1 order by asp desc;
```
```python
# analysis/integrity.py - model-level price/mix decomposition of each country's ASP.
#   w_ci = country c's unit weight on model i          p_ci = c's realised price for model i
#   w_gi = global unit weight on model i               p_gi = global realised price for model i
#   BASELINE = global unit-weighted ASP = sum(revenue)/sum(units) = $783.13
#
#   price effect = sum_i  w_gi * (p_ci - p_gi)     <- global mix held fixed, own prices  ("what
#                                                     it costs here")
#   mix effect   = sum_i  (w_ci - w_gi) * p_gi     <- global prices held fixed, own mix   ("what
#                                                     they buy here")
#   interaction  = sum_i  (w_ci - w_gi)*(p_ci - p_gi)
#   price + mix + interaction == ASP_c - BASELINE   (exact, asserted)
# Models a country never sold carry p_ci := p_gi, so absence contributes 0 to the price effect.
```

**Output**
```
Like-for-like price by country -- flat:
  Model              India   Turkey  Bangladesh
  Z Fold 6          $1,844   $1,840     $1,852
  Galaxy S25 Ultra  $1,253   $1,244        --
  iPhone 15 Pro     $1,148   $1,142     $1,133
  Pixel 9 Pro       $1,051   $1,042     $1,052
  Redmi Note 13       $326     $328       $330

ASP tracks premium mix monotonically:
  Country       premium(>$1000) unit share   budget(<$400) share    ASP
  India                 30.1%                     15.0%            $809
  Turkey                21.6%                      9.9%            $788
  Bangladesh            19.3%                     11.8%            $700
  Pakistan              15.9%                     18.8%            $690

Price / mix decomposition, baseline = global unit-weighted ASP $783.13:

  Country      ASP     gap vs base   PRICE effect   MIX effect   interaction   days
  India      $809.26     +$26.13        +$0.57       +$23.26        +$2.31      169
  Turkey     $787.95      +$4.82        -$0.46        +$6.02        -$0.74      136
  Bangladesh $700.49     -$82.64       -$11.16       -$76.06        +$4.58       51
  Pakistan   $690.09     -$93.04        -$0.72       -$92.91        +$0.59       10

  India vs Turkey: $21.31 ASP gap = $1.03 price + $17.24 mix + $3.05 interaction
                   -> mix 80.9%, interaction 14.3%, price 4.8%.
```

**Caveat - what "100% mix" is and is not.** Mix dominates but is not the whole of it, and the
baseline has to be stated or the numbers cannot be reproduced.

> **Correction, 2025-05-27.** This entry previously read *"Counterfactual (own prices, GLOBAL mix):
> Turkey $788 actual → $785, i.e. a $3 pricing effect against a $41 raw gap."* Two defects:
> 1. **The label was backwards.** `actual - (own prices, global mix)` = `Σ(w_c - w_g)·p_c`. The
>    prices cancel; only the *weights* differ. That quantity is the **mix** effect evaluated at the
>    country's own prices - never the price effect. The price effect is the complementary
>    contrast, `Σ w_g·(p_c - p_g)`, and it is the column now published above.
> 2. **The baseline was unstated.** The "$41 raw gap" was measured against the *unweighted mean of
>    the four country ASPs*, **$746.94** - not against the global unit-weighted ASP of $783.13 that
>    every other figure in this report uses. Two baselines on one line. The table above uses one
>    baseline throughout and the three components sum to the gap exactly.
>
> The corrected price effects are **India +$0.57** and **Turkey -$0.46**, so the direction of the
> original conclusion survives and its magnitude gets stronger, not weaker.

Pakistan is **10 days** and Bangladesh 51 - the bottom two rungs are directional only. India vs
Turkey (169 and 136 days) carries the claim, and there the price effect is **$1.03 of a $21.31 gap
(4.8%)**.
Bangladesh's -$11.16 price effect is the largest in the table and is *not* dismissible as zero; it is
traceable to thin cells (see below) rather than to a pricing policy, which is why the claim is
restricted to India and Turkey in the UI.

One apparent exception, surfaced by `test_I4_like_for_like_prices_are_flat_across_countries`:
OnePlus 11R's mean price is **12.6% lower in Bangladesh ($604.50) than in Turkey ($692.00)**. That
cell is **n=2**, against ~3% within-model price jitter (the model's observed range is $601-$699), so
two low draws produce it - and those two draws are most of Bangladesh's -$11.16. Restricting to
country cells with n≥3, the worst like-for-like spread in the entire catalogue is **5.7%** (Poco X6
Pro, $356.71 vs $377.00) - inside the jitter. The exception is an instance of the thin-sample
problem, not a counter-example to the claim.

> **Correction, 2025-05-27.** This exception was previously stated as "14.5% cheaper in Bangladesh
> than Turkey". 14.47% is `(692.00 - 604.50)/604.50`, which is how much *dearer Turkey is than
> Bangladesh*. "Cheaper than Turkey" takes Turkey as the denominator:
> `(692.00 - 604.50)/692.00 = 12.64%`.

**So what:** this inverts the natural assumption that lower-ASP markets are price-sensitive and need
discounting. They are not charged less - they buy cheaper phones. The lever is **mix migration**
(financing, trade-in, flagship availability), not price cuts, which would destroy margin without
touching the cause.

---

### I-5 - A quarter of the volume, two-fifths of the money

**Query**
```sql
select case when Price< 400 then '1 Budget <$400'  when Price< 700 then '2 Mid $400-699'
            when Price<1000 then '3 High $700-999' else '4 Premium $1000+' end band,
       round(100.0*sum(Units_Sold)   /sum(sum(Units_Sold))    over (),1) unit_pct,
       round(100.0*sum(Total_Revenue)/sum(sum(Total_Revenue)) over (),1) rev_pct
from f group by 1 order by 1;
```

**Output**
```
Band                unit share   revenue share   leverage
Budget   <$400         12.8%          5.7%        0.44x
Mid      $400-699      32.5%         22.7%        0.70x
High     $700-999      29.7%         31.2%        1.05x
Premium  $1000+        25.1%         40.4%        1.61x

6 of 19 models carry 50% of revenue; 12 carry 80%.
```

**Caveat:** band boundaries are mine, not the brief's (`assumptions.md`). The pattern is insensitive
to them - it is arithmetic on a real price ladder, not a threshold artifact.

**So what:** gives the ladder a shape a buyer can act on, and sizes I-4's prize - moving one unit
from Budget to Premium is worth **3.63×** its revenue ($348.22 → $1,263.65 realised revenue per
unit; identically, leverage 1.61× ÷ 0.44×).

> **Correction, 2025-05-27.** This read "~5.3×". 5.31× is **Samsung's dearest-to-cheapest price
> spread** from I-3, a different quantity that happens to sit two sections above; it was copied into
> the wrong sentence. The Budget→Premium ratio is 1263.65/348.22 = **3.63**.

---

## Rejected

| # | Candidate | Why dropped |
|---|---|---|
| **IR-1** | **"Brand leadership is hyper-local"** - India→Samsung, Turkey→OnePlus, Bangladesh→Apple, Pakistan→Xiaomi | Looks like a textbook Simpson's paradox and would make a great map. `Brand`×`Country` is **independent (χ²=17.73, df=12, p=0.124)** and Pakistan is 10 rows. This is what four random draws look like. |
| **IR-2** | "Best-selling model / colour / storage / brands 2nd-5th" | `Units_Sold` ~ Uniform(1,99), KS p=0.452, and only OnePlus's brand share clears its permutation null (**I-1**). Every volume ranking below first place is noise. |
| **IR-3** | "Sales dipped 20% in Sep, rebounded 32% in Oct" | True arithmetic, no signal: monthly CV **0.11**, Dec ($1.30M) ≈ Jan ($1.41M). Reported as "flat, and that is itself notable" - never as a trend with a cause. |
| **IR-4** | **"82 variants never sold - dead stock to clear"** | The most seductive false insight in the file. 274 `Dim_Products` variants × 366 draws predicts **71.9** unsold (sd 8.5); observed 82. Inside noise, not an assortment signal. |
| **IR-5**-**IR-9** | The five Explore-panel cuts - payment, age, storage, colour, OS | Each has its own entry with query and output below; each is quoted verbatim as a verdict in the UI. |
| - | Anything per customer - repeat rate, CLV, RFM | **No customer identifier exists.** `Transaction_ID` is not even unique (303 distinct over 366 rows; 54 ids repeat, one 4×). One published benchmark entry shipped an RFM segmentation built on this. |

### IR-5 - Payment type does not segment anything

**QUERY** `select payment_type, sum(total_revenue) from f group by 1` and
`scipy.stats.chi2_contingency(crosstab(payment_type, customer_age_group))`.
**OUTPUT** EMI **$3,891,415** · Credit Card **$3,837,970** · Cash **$3,640,154** · UPI
**$3,155,874** - a span of **$3.16M-$3.89M**, 23% between best and worst. `Payment_Type` ×
`Customer_Age_Group`: **χ²=11.460, df=15, p=0.7193**, min expected cell 8.31.
**CAVEAT** n=366 day-rows; the χ² is on row counts, not on revenue, so it tests *who pays how*,
not *how much*. The revenue span is descriptive and untested.
**SO WHAT** EMI leads and the ordering is stable, but there is no age story behind it and no
recommendation follows. Shipped as a descriptive drill-down with the p-value on the face of it.

### IR-6 - Age group has no monotonic revenue pattern

**QUERY** `select customer_age_group, sum(total_revenue)/sum(units_sold) asp from f group by 1`
and `chi2_contingency(crosstab(brand, customer_age_group))`.
**OUTPUT** unit-weighted ASP by age: 18-25 **$764.82** · 26-33 **$804.12** · 34-41 **$753.49** ·
42-49 **$819.65** · 50-57 **$777.44** · 58-65 **$762.72** - a **$753-$820** span with no trend
(it goes down, up, down, up). `Brand` × `Customer_Age_Group`: **χ²=26.892, df=20, p=0.1383**.
**CAVEAT** the brief (R3/R9) expects "younger customers prefer certain brands". It is not there.
Cell counts are 38-82 day-rows, so a weak true effect could hide; the honest report is "not
supported", not "does not exist".
**SO WHAT** the brief's expected finding is answered in the negative, in the UI, with its test.

### IR-7 - Storage size is independent of brand

**QUERY** `select storage_size, sum(total_revenue)/sum(units_sold) asp from f group by 1` and
`chi2_contingency(crosstab(storage_size, brand))`.
**OUTPUT** 128GB **$863.86** · 256GB **$747.99** · 64GB **$743.44**. `Storage_Size` × `Brand`:
**χ²=4.857, df=8, p=0.7728**, min expected cell 22.11 - the best-powered cross-tab in the file
and the flattest.
**CAVEAT** the ASP ordering is the price ladder showing through (which phones happen to ship at
128GB), not a storage preference; 128GB is not "worth $120 more".
**SO WHAT** R2 answered in the negative. The panel says so rather than ranking the three.

### IR-8 - Colour is independent of brand and of age

**QUERY** `select color, sum(total_revenue)/sum(units_sold) asp from f group by 1` and
`chi2_contingency` against both `brand` and `customer_age_group`.
**OUTPUT** White **$837.47** · Red **$809.94** · Green **$804.45** · Black **$749.40** · Blue
**$722.10**. `Color` × `Brand`: **χ²=22.656, df=16, p=0.1232**. `Color` × `Customer_Age_Group`:
**χ²=21.692, df=20, p=0.3575**.
**CAVEAT** "White commands the highest ASP" is the single most quotable false insight in this
dataset. It is which phones happened to be white, and it does not survive either test.
**SO WHAT** R2 answered in the negative, and the seductive version is named and refused in the UI.

### IR-9 - `Operating_System` is a function of `Brand`, not a dimension

**QUERY** `select brand, operating_system, count(*) from f group by 1,2` - asserted by
`test_operating_system_is_determined_by_brand`.
**OUTPUT** Apple → iOS on all **83** of its rows; Google (68), OnePlus (74), Samsung (71) and
Xiaomi (70) → Android on all of theirs. **Zero** brand maps to two operating systems.
**CAVEAT** this is a structural fact about the schema - a functional dependency, not a measured
effect - so it has no p-value and needs none. It is exact, not probabilistic.
**SO WHAT** "Android outsells iOS 3:1" is the Apple-vs-everyone-else split re-plotted with fewer
categories. Charting both double-counts one fact, so the OS panel is shipped labelled as such.

**Kept out of the arc but retained in the UI:** `Sales_Channel`×`Customer_Age_Group` is the one
cross-tab clearly surviving Bonferroni (χ²=28.79, **p=0.0013** vs α=0.0045) - Retail Store
over-indexes on 18-25 (24.0% vs 16.4% online), Partner on 34-41 (26.4%). Partner is 53 rows total,
min expected cell 5.5. Too fragile for a recommendation; exposed as an exploratory drill-down.

**Correction (channel ASP).** The Explore panel and Q10 originally read "ASP is flat across all
three channels ($771-$792)". That interval is `mean(Price)` - the definition `assumptions.md`
declares *wrong* - while the table rendered directly beneath the sentence prints the unit-weighted
ASP the app actually computes. The two disagreed on one screen.

- **QUERY** `select channel, sum(total_revenue)/sum(units_sold) asp from fact group by 1`; spread
  tested by permuting the channel label 20,000 times (seed 0) and comparing max-min ASP.
- **OUTPUT** Online **$805.98**, Partner **$758.86**, Retail Store **$743.05**. Observed spread
  **$62.93**; permutation p=**0.5165**, null 95th percentile **$138.70**. Kruskal-Wallis on `Price`
  by channel H=0.4424, p=0.8015.
- **CAVEAT** ASP here is a ratio of sums over 366 day-rows, not a per-transaction price; the
  permutation test is the right null for it because a proportion CI is not.
- **SO WHAT** The conclusion - channel does not change what people buy - is unchanged and now
  rests on a test rather than on the wrong statistic. The published range is the unit-weighted one,
  so the sentence and the table beneath it now agree.

## So what - three recommendations

1. **Retire unit share as a performance metric; manage brands on revenue conversion.**
   OnePlus genuinely leads volume (23.70%, p=0.002) and still earns only the third-most money.
   Xiaomi holds 19.0% of units for 12.5% of revenue (-6.50pp); Samsung turns 17.5% into 24.0%
   (+6.46pp). Positions 2-5 of the unit table are not rankable at all. → *I-1, I-2*
2. **Treat flagship availability as the largest single revenue risk.** One model is 11.6% of revenue
   from 5.7% of trading days, and the five best days of the year are all the same phone. The two
   brands with no model in the Premium $1000+ band - Xiaomi and OnePlus - are exactly the two that
   convert units to revenue below par (-6.50pp and -2.85pp). → *I-3*
3. **Move markets up the ladder rather than discounting them; act on India and Turkey.** Every
   market pays the same list prices for the same phones - the India-Turkey ASP gap is 4.8% price and
   95.2% mix + interaction. Turkey buys 21.6% premium against India's 30.1%. Financing and flagship
   availability move ASP; price cuts only move margin. **Bangladesh (51 days) and Pakistan (10) are
   directional only** and must not carry a recommendation. → *I-4, I-5*

## Non-obvious checklist

Worked deliberately in G3:

- [x] two-way interactions - 11 cross-tabs, Bonferroni corrected; only Channel×Age survives (IR-5...IR-8)
- [x] Simpson's paradox - tested and **rejected** (IR-1); brand rank flips are noise
- [x] rate vs volume mismatch - **I-2**, the hinge of the story
- [x] concentration (Pareto / Gini) - **I-3, I-5**; 6 of 19 models = 50% of revenue
- [x] distribution vs average - **I-1**; a permutation null on the share, not a CI on the mean
- [x] cohorts - n/a, no customer or join-date entity exists
- [x] changepoints & anomalies - top-5 revenue days all one model (I-3); no regime shift
- [x] funnel leakage - n/a, no multi-step process in the data
- [x] lead / lag - quarterly and monthly tested; no trend (IR-3)
- [x] missingness as signal - **zero nulls anywhere**; the signal is in the *coverage* skew (I-4 caveat)
- [x] survivorship - 82 unsold variants tested against random expectation and **rejected** (IR-4)
- [x] mix vs performance decomposition - **I-4**, the strongest finding
