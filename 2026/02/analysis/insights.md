# Insight ledger - 2026/02 Pharmacy Sales & Profitability

**The gate that decides the Insights score.** No query, no claim.

Every figure below is reproduced by `analysis/integrity.py`, which reads the **raw workbook
only** - never `data/curated/` - so a defect in `model/build.py` cannot validate itself.

## Thesis

> **The chain has one margin number, and it is 28%. Every question the brief asks about
> *where* profit varies returns it unchanged - and the one lever anyone is actually pulling
> costs €82,709 across the two years on file and buys nothing.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | The book looks healthy and growing: €8.63M revenue, €2.42M margin, +4.43% in 2025, and a file with zero orphans, zero nulls and an identity holding at 0.00 deviation. |
| **Complication** | The growth is not growth (**I1**), and the margin rate the chain wants to optimise is the same 28% in every country, region, store type, size band and individual store - flat within categories too, so it is not mix cancelling out (**I2**). |
| **Complication** | Two of the remaining things a dashboard would headline are artefacts: the weekly cycle is a trading calendar and the seasonality the brief asks for does not exist (**I3**); "which category sells the most units" is a restatement of which category is cheapest (**I4**). |
| **Resolution** | Only two things move the margin rate. Category mix is the portfolio. **Promotion is the one lever being actively pulled, it costs €82,709, and it produces no volume lift in any of the five categories** (**I5**). |
| **Caveat carried** | 10% of rows sell products before they launched. It moves no aggregate ranking - but it makes product-lifecycle analysis impossible (**I6**). |

---

## Ledger

### I1 - 2025 revenue grew 4.43%, but same-store growth is +0.07% (p=0.72). 98.5% of the increase is eleven new shops.

**Query**
```sql
-- total
SELECT Year, SUM(RevenueEUR) FROM fact JOIN dim_date USING(DateKey) GROUP BY Year;
-- same-store: only pharmacies open before the window starts
SELECT Year, SUM(RevenueEUR) FROM fact JOIN dim_date USING(DateKey)
JOIN dim_pharmacy USING(PharmacyID)
WHERE OpenDate < DATE '2024-01-01' GROUP BY Year;
```
Significance test: Mann-Whitney on same-store *daily* revenue, 2024 vs 2025.

**Output**
```
total        2024 = 4,223,414   2025 = 4,410,563   (+4.43%)
same-store   2024 = 4,141,787   2025 = 4,144,630   (+0.07%)   n=109 stores
new stores   2024 =    81,627   2025 =   265,933   n=11
growth EUR 187,149 -> new stores 184,306 (98.5%) | same stores 2,843 (1.5%)
same-store daily revenue Mann-Whitney p = 0.7207
trading days: 2024 = 366 (leap), 2025 = 365
```

**Caveat:** 2024 is a leap year, so the raw annual comparison gives 2025 one day fewer - this
makes same-store growth *marginally* understated, not overstated, and it remains
indistinguishable from zero either way. The eleven new stores are a real commercial event; the
point is not that they don't count, it is that they are the entire story.

**So what:** the headline every BI tool would put on this dataset - "revenue up 4.4%" - is a
statement about how many shops the chain opened, not how they traded. Same-store performance is
flat. Any target, bonus or forecast built on the 4.4% is measuring the property portfolio.

---

### I2 - The margin rate is 28% everywhere. Across 120 stores the total spread is 4.61pp, and chance alone produces 5.73pp.

**Query**
```sql
SELECT <cut>, SUM(MarginEUR)/SUM(RevenueEUR)*100 AS margin_pct
FROM fact JOIN dim_pharmacy USING(PharmacyID) JOIN dim_product USING(ProductID)
GROUP BY <cut>;
```
Then a bootstrap: for each store's row count *n*, draw *n* rows from the pooled book and
recompute; 1000 replications; record the max-min spread.

**Output**
```
cut               k     margin% range      spread
StoreSizeBand     3     28.03 .. 28.06     0.03pp
PharmacyType      3     27.98 .. 28.10     0.12pp
Country           8     27.84 .. 28.16     0.32pp
Region           38     27.69 .. 28.61     0.91pp
Pharmacy        120     24.73 .. 29.33     4.61pp

bootstrap spread expected by CHANCE: mean 3.28pp, 95th pct 5.73pp, max 8.02pp
-> 4.61pp is WITHIN chance
lowest store PH0115 = 24.73% on n=16 rows (thin cell)

control: store VOLUME is genuinely heterogeneous
  chi2 = 6,911 on 119 df (ratio 58.1) vs common-rate x exposure, p ~ 0
Simpson check: OTC margin by type 29.23 / 29.42 / 29.41; Prescription 21.95 / 21.95 / 21.89
revenue mix by type differs by <1pp on every category
```

**Note on the yardstick:** the 5.73pp figure moved during G6. Three artifacts had produced
three values for it - 5.54, 5.37 and 5.75 - because `build.py` ran seven cuts off one random
generator (so Pharmacy's answer depended on how many cuts preceded it), `integrity.py`
bootstrapped only this cut, and the two passed group sizes in different orders. The finding
survived all three, since 4.61pp is below every one of them, but that is luck rather than
method. The estimator is now seeded from the cut label and sorts its group sizes, so both
implementations reproduce 5.73pp from independent code, and `test_metrics.py` asserts it.

**Caveat:** this is a null, so it needs its control - and it has two. Store *volume* differs
enormously (χ² ratio 58.1), so the file is not uniformly flat; and the rate is flat *within*
category as well as across, so it is not offsetting mix. The bootstrap holds each store's own
*n* fixed, so the comparison is like-for-like.

**So what:** four of the brief's ten questions ask where profitability varies - by country, by
region, by pharmacy, by urban/suburban/rural. The answer to all four is "it doesn't." A
league table of stores by margin rate ranks noise, and the store it would name worst has
sixteen rows. What differs between stores is how much they sell, never how profitably.

---

### I3 - The seasonality the brief asks for does not exist. The only rhythm in 731 days is the trading week, and it is a calendar, not demand.

**Query**
```sql
-- is there seasonality?
SELECT YearMonth, SUM(RevenueEUR) FROM fact JOIN dim_date USING(DateKey) GROUP BY YearMonth;
-- Kruskal-Wallis on daily transaction COUNT grouped by calendar month, then by weekday
```

**Output**
```
monthly revenue  EUR 327,319 .. 392,674 over 24 months   sd/mean = 0.0543
daily count by calendar month   KW p = 0.2098   eta2 = 0.021    <- nothing
daily count by weekday          KW p = 1.24e-56 eta2 = 0.384    <- the only signal
  weekday mean 89.8 transactions vs weekend 73.0  (-18.7%)
```

**Caveat:** the weekday effect is measured on transaction *count*, not on transaction size -
units per transaction show no weekday effect. That is the signature of a trading calendar
(fewer sales lines are written at weekends) rather than of weekend demand being weaker. This is
the 2025/12 "opening hours" shape and is labelled as such in the UI; it is not offered as a
demand insight.

**So what:** the page names seasonal demand a planning problem for inventory, staffing and
promotional timing, and the DOCX asks for seasonal patterns directly. There are none, at
p=0.21, and saying so is worth more than a smoothed line implying a cycle that is not there.
The staffing implication that *is* supported is the weekday/weekend split, which is a rota
question, not a demand-forecasting one.

---

### I4 - "Which category sells the most units" is a restatement of which category is cheapest. Category explains 98.87% of the between-product variation in units.

**Query**
```sql
SELECT Category, AVG(UnitsSold), AVG(ListPriceEUR) FROM fact JOIN dim_product USING(ProductID)
GROUP BY Category;
-- then eta^2 of product-level MEAN units, grouped by category (n=220 products)
```

**Output**
```
Category           mean units   mean list price
Medical Devices          2.30            64.65
Prescription             4.82            45.44
Wellness                 7.16            19.73
OTC                      9.15            10.42
Personal Care            9.17            14.70

eta2 of product-mean units by category = 0.9887  (n = 220 products)
within-product sd of units = 4.081 (overall sd 4.873) -> not a pure lookup
```

**Caveat:** units still vary *within* a product (sd 4.08), so `UnitsSold` is not a constant
per SKU - this is a strong structural relationship, not a literal definition. The ordering is
inverse to price with one inversion (Personal Care sells marginally more than OTC at a higher
price), so "cheap things sell in larger counts" is the shape, not an exact law.

**So what:** any chart ranking categories or brands by units is ranking them by price band. The
brief asks which categories and brands "generate the most revenue" and which the most margin -
those are answerable. "Which sells the most" is not a performance question here, and a units
league table is the single most likely thing for a competing entry to put on screen.

---

### I5 - Promotions cost 9.08 margin points and €82,709 over the two years on file, and produce no volume lift in any of the five categories.

**Query**
```sql
SELECT PromoFlag, COUNT(*), AVG(UnitsSold),
       AVG(RevenueEUR/(ListPriceEUR*UnitsSold))  AS realised_price_ratio,
       SUM(MarginEUR)/SUM(RevenueEUR)*100        AS margin_pct
FROM fact JOIN dim_product USING(ProductID) GROUP BY PromoFlag;
-- repeated within each Category for the two-way interaction
-- forgone = promo_revenue * non_promo_margin_rate - promo_margin
```

**Output**
```
POSITIVE CONTROL  realised price / list  0.9848 -> 0.8607  (-12.61%)  KW p ~ 0
THE NULL          units per transaction  7.1947 -> 7.0226  (-2.39%)   KW p = 0.031

power: n = 7,431 promo vs 54,708 non-promo, sd = 4.873
  MDE at 80% power, alpha .05 = 0.1687 units = 2.34% lift
  observed = -0.1721 units (-2.39%)

by category            unit lift%      p      margin gap
  Prescription             +0.40    0.664        9.18pp
  Wellness                 -1.41    0.582        8.67pp
  OTC                      -1.52    0.271        8.73pp
  Medical Devices          -1.66    0.836        8.92pp
  Personal Care            -4.87    0.011        8.36pp
  Bonferroni threshold for 5 tests: p < 0.01 - none survive

margin forgone vs the non-promo rate: EUR 82,709 = 3.42% of EUR 2,421,141
```

**Caveat:** the honest claim is **"no lift"**, not "promotion destroys volume." The point
estimate is -2.39% against a POOLED minimum detectable effect of 2.35%, so it sits exactly on the
detection floor; Personal Care's -4.87% at p=0.011 fails the Bonferroni threshold for five
tests. The null is readable only because of the positive control - the same flag moves realised
price by -12.61% at p≈0, so `PromoFlag` is live rather than an unused column. This dataset also
cannot see basket effects or footfall: a promotion that draws a customer who then buys
something else would be invisible here, and that is a real limit on the recommendation.

**So what:** this is the only lever in the file that the chain both controls and is actively
pulling, and it is the one that moves the margin rate most. €82,709 is 3.4% of the €2,421,141 of
margin on file - both figures span the whole 731-day window, so the annual run-rate is roughly
half of each (€41,448 forgone in 2024, €41,251 in 2025). It is spent on a discount that shifts no
units in any category. The margin cost is remarkably uniform
(8.36-9.18pp everywhere), so this is not a case of promotions working somewhere and not
elsewhere - it is flat and it is zero. Either the promotion mechanism needs to change or the
budget is recoverable.

---

### I6 - 10% of the file sells products before they existed. It changes no ranking - and it makes product-lifecycle analysis impossible.

**Query**
```sql
SELECT COUNT(*), SUM(RevenueEUR) FROM fact
JOIN dim_date USING(DateKey) JOIN dim_product USING(ProductID)
WHERE Date < LaunchDate;
-- and the two rules the README DOES state, as the control:
--   WHERE Date < OpenDate            (0 rows)
--   WHERE Date > DiscontinuedDate    (0 rows)
```

**Output**
```
rows before launch    6,221 of 62,139  (10.0114%)
revenue before launch EUR 795,899.33   (9.22%)
products affected     47 of 47 launching in-window   ZERO EXCEPTIONS
days traded early     median 344, max 719
per-product share of revenue that predates launch: min 2.2%, median 50.3%, max 100.0%
  -> 24 of 47 products have MORE THAN HALF their recorded revenue before they launched

CONTROL - the two rules the README does state:
  sales before OpenDate         0 violations  (11 stores open in-window)
  sales after DiscontinuedDate  0 violations  (35 products discontinued)

IMPACT ON RANKINGS
  category revenue order   UNCHANGED
  country revenue order    UNCHANGED
  top-10 products          10/10 overlap, no entrants, no departures
```

**Caveat:** **this does not invalidate the report's aggregates, and it must not be sold as
though it does.** Every ranking above survives removing the affected rows. The two documented
constraints are the control that makes this a real asymmetry rather than loose data throughout -
the generator applied rules exactly where it wrote them down and nowhere else.

**So what:** the aggregates are safe; the product lifecycle is not. Any "time since launch",
new-product ramp, or launch-performance analysis is computed against a date the fact table
contradicts, and for 24 of the 47 affected products most of their recorded history predates
their existence - for one, all of it. The dashboard states the defect, quantifies it, and
declines to draw the launch-curve chart that the data appears to support.

---

## Rejected

Killed claims are published, not deleted.

| Candidate | Why dropped |
|---|---|
| "The top 20% of stores drive 36% of revenue" | Not a Pareto. 36.0% for stores, 38.6% for products, against 20% under perfect uniformity. Describing this as concentration would be dressing a weak effect in a famous name. |
| "Pharmacy PH0115 is the worst performer at 24.73% margin" | **n=16.** A thin cell manufacturing an outlier - the 2025/05 trap. The whole 120-store spread is within bootstrap chance. |
| "Promotions work for Prescription (+0.40%)" | p=0.664. Would have been the one positive lift; it is noise. |
| "Promotions actively destroy volume in Personal Care (-4.87%)" | p=0.011 against a Bonferroni threshold of 0.01 for five tests. Tempting and directionally consistent with I5 - dropped because it fails the correction I declared before looking. |
| "Urban pharmacies are more profitable" | 0.12pp. And flat within category, so not even a mix story. |
| "Germany is the strongest market" | Germany leads revenue because it has 22 of 120 stores. Revenue-per-store ranks Belgium first, and margin rate is flat at 0.32pp. A store-count ranking wearing a performance label. |
| "10% of the data is wrong, so the numbers can't be trusted" | Overclaim. It changes no ranking (I6). Stating it this way would be the mirror image of the field's usual failure - a dramatic claim that the evidence does not carry. |
| "79 duplicate rows are a data-quality defect" | 77 of them are same-promo/different-units, i.e. two sales lines for the same product on the same day - benign. 2 are true duplicates. 0.33% of rows. Not worth a panel. |

## Non-obvious checklist

Worked deliberately in G3:

- [x] **two-way interactions** - promo × category, all five (I5). No rescue.
- [x] **Simpson's paradox** - margin by store type *within* category; mix by type. No reversal (I2).
- [x] **rate vs volume mismatch** - the spine of the month: volume varies, rate does not (I2).
- [x] **concentration (Pareto / Gini)** - tested, rejected. 36% / 38.6%.
- [x] **distribution vs average** - store margin bootstrap against its own *n* (I2).
- [x] **cohorts** - stores by open date; 11 in-window openings (I1).
- [x] **changepoints & anomalies** - 2024 vs 2025 daily revenue; decomposed to store count (I1).
- [ ] **funnel leakage** - no funnel in this file. One table of completed sales; no baskets, no footfall, no declined lines.
- [ ] **lead / lag** - no candidate pair. Promotion has no date-indexed campaign entity to lead or lag.
- [x] **missingness as signal** - the README's *silence* on `LaunchDate` is the finding (I6).
- [x] **survivorship** - new stores at €31.6k vs €76.0k, identical margin rate (I1, I2).
- [x] **mix vs performance decomposition** - 98.5% of growth is mix, not performance (I1).
