# Insight ledger - 2025/11 E-commerce Analytics

Every claim below has a query. No query, no claim. Queries run against
`data/curated/fct_event.parquet` (48,000 rows, built by `model/build.py` from the read-only XLSX)
unless stated. `reported_usd` is the file's `net_revenue_usd` as supplied; `ex_tax_usd` removes
sales tax; `net_usd` additionally zeroes refunded events.

---

## THE THESIS

> **This file's revenue column includes sales tax. Correct it and 12.02% of the money disappears -
> but the correction is a flat 12% on every cut except geography. So every chart in this dataset is
> right except the ones about *where*, and those are wrong twice over: the region revenue ranking
> flips, and the country price ranking stops existing altogether.**

By channel the correction spans 0.58 points. By month, 1.90. By product family, 4.71. **By country
it spans 17.69 points (1.65% → 19.34%), by region 15.81 and by currency 13.30** - because the tax
rate is 0% in the United States and 20% across Europe. The monthly line, the channel bar and the
product ranking are all *shaped* correctly even though every number on them is 12% too high. The
geographic charts are not, and the brief's guiding question Q9 asks for two of them by name.

The two casualties fail in different ways, which is why both are worth showing:

- **Region revenue - a total flips.** The EU leads on the file's own numbers at $13.69M (43.01%)
  against North America's $11.77M (36.98%). Corrected, **North America leads** at $11.40M (40.71%)
  against the EU's $11.10M (39.63%). A **$2.23M swing** that changes who is #1 on the single most
  commonly built chart in this competition. No sampling-noise objection is available: these are
  sums, not means.
- **Country price - a mean dissolves.** Reported revenue per event differs by country at
  **p = 6.9 × 10⁻²³**. Ex-tax it does not differ at all: **Kruskal-Wallis p = 0.862, η² = -0.0001**.
  Not "differs less" - **100% of the apparent country difference in price is sales tax.** The
  same holds for the true per-unit price (reported p = 4.8 × 10⁻⁷², ex-tax p = 0.243).

*Scope, stated precisely.* This is a **marginal-cut** claim. Nested two levels deep the spans grow
(2.45 pp by channel within country, 6.34 pp by category) on refund noise at small n. And the
uniformity itself is close to tautological: tax is a deterministic function of country - exactly
`round(rate × quantity × unit_price, 2)` at statutory rates of 0/5/10/15/20%, row-level R² of rate
on country = 0.9905 - and tax is 85.16% of the whole correction. Saying "the correction is flat
except on geography" is therefore partly a restatement of "country was assigned independently of
channel, month and product". That is stated here rather than left for a reader to notice, and it
does not weaken the practical point: **a business reading this needs to fix its geographic reporting
and can trust the rest.**

Behind that sits a second finding the brief did not anticipate: **the loyalty questions have no
answer, because this file is not a customer panel - it is a fixed pool of 48,000 events dealt out
across exactly 4,000 customers.** Mean events per customer is exactly 12.0000. Nothing predicts who
gets more.

---

## Part 1 - The money is 12% overstated, and the map is the only casualty

### C1 · The file overstates revenue by $3,825,574 (12.02%)

- **QUERY** `select sum(reported_usd), sum(tax_usd), sum(case when is_refunded then ex_tax_usd else 0 end), sum(net_usd) from ev`
- **OUTPUT** reported **$31,832,281** · sales tax **$3,257,940** · refunded (ex-tax) **$567,634** ·
  recognisable **$28,006,708**. Correction **12.02%**.
- **CAVEAT** The refund treatment is all-or-nothing because `is_refunded` is boolean and the file
  has no partial-refund amount. Zeroing the whole event is the only available treatment and is
  recorded in `assumptions.md` (A-3).
- **SO WHAT** Two of the four KPIs a conventional entry puts in its header - total revenue and AOV
  - are wrong by this margin, in this direction, before any analysis begins.

### C2 · `net_revenue_usd` is gross of tax, by the file's own arithmetic

- **QUERY** `select count(*) from ev where abs((quantity*unit_price_local - discount_local + tax_local) - net_revenue_local) > 0.01`
- **OUTPUT** **0** violations in 48,000 rows. The identity is `qty × price - discount **+ tax**`.
- **CAVEAT** None. This is the file defining its own column.
- **SO WHAT** The column named "net" is gross. Nothing about this is inferred.

### C3 · Ex-tax, price does not differ by country at all

- **QUERY** Kruskal-Wallis and one-way ANOVA on `reported_usd` and on `ex_tax_usd` across the ten
  countries; the same on `reported_usd / quantity` and `ex_tax_usd / quantity`; the same on
  `base_price_usd`. Recomputed as SQL in `model/metric_checks.yml`
  (`asp_kw_h_*`) and asserted against `scipy.stats.kruskal` in `model/test_metrics.py`.
- **OUTPUT** Per **event** - `reported_usd`: **KW H = 126.28, df = 9, p = 6.9 × 10⁻²³**
  (ANOVA F = 13.64, p ≈ 0), η² = 0.0024. `ex_tax_usd`: **KW H = 4.67, df = 9, p = 0.862**,
  ANOVA F = 1.477, p = 0.150, **η² = -0.0001**.
  Per **unit** (÷ `quantity`) - reported **H = 359.93, p = 4.8 × 10⁻⁷²**; ex-tax **H = 11.51,
  p = 0.243**, ANOVA F = 1.279, p = 0.243. Catalogue list price by country: **H = 12.19,
  p = 0.203**.
- **CAVEAT / CORRECTION - the ranks.** An earlier draft of this ledger reported an ex-tax *rank
  order* - "Canada goes 9th → 1st, the UK 6th → last" - and called it the finding. **That was the
  same error C7 exists to refuse.** Ranking ten countries on a measure that does not differ
  between them is reading noise as a league table; a bootstrap gives Canada only a 0.322
  probability of being #1. The ranks are withdrawn. The residual $53.24 ex-tax spread I
  previously published as "the real difference" is not a difference at all.
- **CAVEAT / CORRECTION - the p-value itself, and what it was computed on.** This ledger, the
  dashboard and the LinkedIn copy all published **p = 0.853** for the ex-tax test. That figure
  does not reproduce from the data this project ships. It came from **unquantised float64**
  ex-tax revenue (`net_revenue_usd - tax_local × fx`, H = 4.7758); the cent-quantised column the
  parquet and the browser payload actually hold gives **H = 4.6749, p = 0.862**. Kruskal-Wallis
  is rank-based, so quantising merges ties and moves H - and this month's own recorded lesson is
  *quantise derived values once, upstream*. It was failing on the number it is most quoted for.
  Two things were wrong and both are fixed: the statistic is now computed in the browser from
  the rows the chart draws (`app/src/stats.ts`) rather than typed, and `build.py` now quantises
  the *derived* money columns too, not merely their inputs - Polars evaluates `x / 100` as
  `x * 0.01`, which left 4,776 of 48,000 reported values one ulp away from the double the
  payload carries, enough to change the tie structure again. ANOVA is unaffected either way
  (F = 1.4769, p = 0.1499), so the two tests agreed substantively throughout.
- **CAVEAT / CORRECTION - what the measure is called.** The panel's axis read "AVERAGE SELLING
  PRICE" while every query behind it computed `avg(reported_usd)` - a mean over **events**, never
  divided by `quantity` (a seat count, mean 6.03, range 1-25). The label asserted a per-unit price
  that nothing computed. The axis now reads **REVENUE PER EVENT**, and the genuine per-unit test
  is published beside it. The conclusion is unchanged and slightly sharper per unit.
- **SO WHAT** The corrected claim is far stronger than the one it replaces. It is not that 68% of
  the country price gap is VAT - it is **100%**. Strip the tax and the ten countries are
  indistinguishable on price *both per event and per unit*, which is what you would expect from a
  catalogue that is also indistinguishable by country (p = 0.203). A country map of
  `net_revenue_usd` per order is a map of European VAT and nothing else.

### C3b · The "or currency" half of Q9 is worse, not better

- **QUERY** correction percentage and ASP by currency; count of distinct countries per currency;
  correction span by currency *within* each country.
- **OUTPUT** GBP 19.07%, EUR 18.87%, AUD 11.55%, **USD 5.77%** - a 13.30-point span. Within any
  single country the span by currency is **0.00** - currency is a pure country proxy. But it is a
  *lossy* one: **USD alone spans four countries** taxed at 0% (US), 5.2% (Canada), 15.8%
  (Philippines) and 15.7% (Brazil), and EUR spans four more.
- **CAVEAT** None; the within-country span of exactly 0.00 is definitional, since each country bills
  in one currency.
- **SO WHAT** Q9 offers "country **or** currency" as if interchangeable. They are not: currency has
  the same tax defect *plus* it averages four differently-taxed countries into one bar. Whichever
  half of Q9 an entrant picks, the chart is wrong - and picking currency is the worse choice.

### C3c · The region revenue ranking flips - EU loses first place to North America

- **QUERY** `select region, sum(reported_usd), sum(net_usd) from ev group by 1`
- **OUTPUT**

  | region | reported | share | recognisable | share |
  |---|---:|---:|---:|---:|
  | **EU** | **$13,692,544** | **43.01%** | $11,098,492 | 39.63% |
  | **North America** | $11,771,047 | 36.98% | **$11,402,495** | **40.71%** |
  | APAC | $4,875,881 | 15.32% | $4,256,148 | 15.20% |
  | LATAM | $1,492,809 | 4.69% | $1,249,574 | 4.46% |

  EU leads by **$1.92M** as shipped; North America leads by **$0.30M** once corrected - a **$2.23M
  swing**.
- **CAVEAT** These are totals, so there is no sampling-noise objection. The one judgement involved
  is the ex-tax definition (A-1); under the file's own definition the EU genuinely does lead.
- **SO WHAT** This is the sharpest consequence of the whole thesis and the easiest to act on.
  "Revenue by region" is the chart most likely to appear in every entry this month, it is also the
  chart where the blank North America label (profile issue 4) already forces a decision, and it
  reverses. An entry can get the label right and still name the wrong region as its biggest market.

### C3d · The file charges tax on the undiscounted price

- **QUERY** effective rate against the **pre-discount** base `quantity × unit_price_local` versus
  the post-discount base; then reconcile `tax_local` against `round(rate × gross, 2)`.
- **OUTPUT** On the pre-discount base the rates are exactly statutory - **0% (US), 5% (Canada),
  10% (Australia), 15% (Brazil, Philippines), 20% (Germany, France, Spain, UK, Netherlands)** -
  with within-country sd of 0.00005-0.00011, i.e. rounding alone. Max deviation of `tax_local` from
  `round(rate × gross, 2)` across all 48,000 rows: **$0.01**. On the post-discount base the same
  rates read 5.24%, 10.49%, 15.73%, 20.93%-21.03% and vary tenfold more (sd 0.004-0.016).
- **CAVEAT / CORRECTION.** `profile.md`'s first tax table used the post-discount denominator and so
  published every rate ~5% relatively too high, describing Europe as "~21%". The statutory figure
  is **20%**. Corrected there.
- **SO WHAT** This is a second, independent defect sitting on top of the tax-inclusion one. Revenue
  is computed as `gross - discount + tax(gross)`, so tax is levied on money the customer never
  paid. Real VAT applies to the discounted consideration. Across the 16,980 discounted lines the
  overcharge is **$140,187** - small against the $3.26M of tax, but it means the file's tax figure
  is not merely misplaced, it is itself wrong.

### C4 · The correction is uniform on every cut except geography

- **QUERY** per-group `100·(Σreported - Σnet)/Σreported`, min and max, for month / channel / family /
  country.
- **OUTPUT**

  | cut | min | max | span |
  |---|---:|---:|---:|
  | by channel | 11.69% | 12.27% | **0.58 pp** |
  | by month | 11.22% | 13.12% | **1.90 pp** |
  | by product family | 10.16% | 14.87% | **4.71 pp** |
  | by discount code | 3.12% | 17.11% | 13.99 pp *(see C14 - SALE15 is US-only)* |
  | **by currency** | **5.77%** | **19.07%** | **13.30 pp** |
  | **by region** | **3.13%** | **18.94%** | **15.81 pp** |
  | **by country** | **1.65%** | **19.34%** | **17.69 pp** |

- **CAVEAT** Two limits, both stated because they bound the claim. (a) Family span (4.71 pp) is
  driven by refund incidence, which is small-sample at family level; it does not reorder the top 5.
  (b) These are **marginal** cuts. Nested inside country the spans grow - 2.45 pp by channel,
  6.34 pp by category - again from refund incidence at small n. (c) The discount-code span is not a
  fourth geography; it is geography in disguise, because `SALE15` is issued only in the tax-free US
  and `LOYALTY15` only outside it (C14). (d) Tax is 85.16% of the whole correction and is a
  deterministic function of country (R² = 0.9905), so the uniformity result is partly a restatement
  of "country was assigned independently of channel, month and product". Within the United States
  alone - where tax is 0% and the correction is pure refund - every span collapses to under 2 pp.
- **SO WHAT** This is the load-bearing claim of the whole dashboard. It says precisely which of the
  field's charts are salvageable (all of them but one) and which is not. It is also *actionable*:
  a business reading this needs to fix one report, not rebuild the stack.

### C5 · Channel revenue rank is identical before and after correction

- **QUERY** rank channels by `sum(reported_usd)` and by `sum(net_usd)`.
- **OUTPUT** Website / Direct Sales / Reseller / Marketplace / Partner - ranks 1-2-3-4-5 under both.
  Per-channel cut 11.69%-12.27%.
- **CAVEAT** Marketplace and Partner are adjacent ($3.34M vs $3.25M reported) and could in principle
  swap under a different correction; they do not under this one.
- **SO WHAT** Q2 has a stable answer. Website is the largest channel at **$12.69M recognisable
  revenue, 45.3% of the total**, and that survives correction.

### C6 · No Simpson reversal by region

- **QUERY** rank channels by `net_usd` within each region.
- **OUTPUT** Website is #1 and Direct Sales #2 in **all four** regions (North America, EU, APAC,
  LATAM).
- **CAVEAT** Tested only on the channel × region pair; not an exhaustive Simpson search.
- **SO WHAT** The channel story does not hide a regional reversal. Worth checking and worth saying
  it was checked.

### C7 · Refunds concentrate nowhere

- **QUERY** refund rate with 95% Wilson intervals by channel; by category with n ≥ 300.
- **OUTPUT** Channels 2.02%-2.37%, every interval covering the overall **2.094%**. Categories
  1.28%-2.29%. The widest gap, Marketplace 2.37% [1.97, 2.83] against Reseller 2.02% [1.72, 2.38],
  overlaps heavily.
  Extending the test past channel and category: refunds are independent of **country**
  (χ² = 9.14, df 9, p = 0.424), **billing cycle** (p = 0.982), **region** (p = 0.688), **payment
  method** (p = 0.310), **currency** (p = 0.642) and **segment** (p = 0.059).
- **CAVEAT** With 1,005 refunds total, a genuine 0.5 pp difference would be hard to detect. Segment
  at p = 0.059 is the closest any cut comes, and it does not survive the eight-test family.
- **SO WHAT** Q10 asks *where* refunds happen. Answering "Marketplace, at 2.37%" would be reading a
  confidence interval as a fact. The honest answer is that refunds are a flat 2.09% tax on
  everything, worth **$567,634 ex-tax**, and the lever is the rate, not a location.

### C8 · Revenue is not concentrated - there is no whale

- **QUERY** quintile customers by total `net_usd`; share of revenue per quintile.
- **OUTPUT** Top quintile = **38.63%** of revenue (Q4 24.63%, Q3 18.02%, Q2 12.41%, Q1 6.31%).
- **CAVEAT** Quintiles of 800 customers each. The top **decile** is **22.43%** - under a Pareto
  distribution it would be roughly 65%.
- **SO WHAT** A conventional "80% of revenue comes from 20% of customers" callout is false here by a
  factor of two. This follows directly from the allocation structure in C10 - no concentration
  mechanism exists in the file, so there is no key-account story to tell.

---

## Part 2 - The loyalty questions are clock artefacts

### C9 · 3,995 of 4,000 customers are repeat buyers

- **QUERY** `select count(*) from (select customer_id from ev where is_order group by 1 having count(*)>=2)`
- **OUTPUT** **3,995** on orders alone; **4,000 of 4,000** counting all events. Median 8 orders,
  range 1-23.
- **CAVEAT** None.
- **SO WHAT** The brief asks entrants to "identify loyal customers (repeat buyers)". The literal
  answer is *everyone*. Any loyal-vs-new split is 99.9% / 0.1%, and any prettier split requires an
  invented threshold. Saying so is the honest move; the interesting question is **how many**, not
  **who**.

### C10 · This is not a customer panel - it is a fixed pool of events dealt across a closed roster

- **QUERY** total events and customers; mean and variance of events per customer and of orders per
  customer; the variance a multinomial allocation of N events over C equal cells would produce.
- **OUTPUT** **48,000 events over exactly 4,000 customers - mean exactly 12.0000.** Events per
  customer: var 12.232, **var/mean 1.019**. Orders per customer: mean 8.400, var 8.362,
  **var/mean 0.995**. A multinomial dealing 48,000 events across 4,000 equal cells predicts
  **var/mean = 1 - 1/4000 = 0.99975**.
- **CAVEAT / CORRECTION.** An earlier draft called this "a Poisson draw" and offered var/mean =
  0.995 as evidence that no latent loyalty variable exists. **The evidence does not support the
  conclusion, and is withdrawn.** var/mean ≈ 1 is *forced* by a fixed-pool allocation - it is what
  the construction produces, not a finding about customers. The tell is the mean of exactly
  12.0000, which no genuinely random process delivers. The χ² fit against a fitted Poisson is also
  only marginal (27.33 on 18 df, p = 0.073) and fails in the tail: at k = 17 it expects 13.1
  customers and observes 4. *(A reviewer proposed stratifying by exposure decile to show
  underdispersion at p = 5.5 × 10⁻⁸. I have not adopted that figure: the exposure measure it
  stratifies on is the first-to-last-event span, which is itself endogenous to the count - the same
  circularity I withdrew in C11. The multinomial argument needs no such crutch.)*
- **SO WHAT** The conclusion - that there is no latent loyalty variable - still stands, but it rests
  on C11, C13 and C17, not on this. What C10 contributes is the *reason*: the file was built by
  handing out a fixed budget of transactions, so differences in customer activity are allocation
  noise by construction. Nothing about a customer could predict their order count, because nothing
  about a customer was used to generate it.

### C11 · Nothing predicts how much a customer buys - not even how long they have been around

- **QUERY** Kruskal-Wallis on orders per customer by acquisition channel; the minimum detectable
  difference at 80% power for each channel against the rest; and the distribution of true exposure
  (first event → end of file) across customers.
- **OUTPUT** H = 2.35, k = 6, **p = 0.799**, ε² = -0.0007. Observed spread across all six channels
  = **0.171 orders**. MDE ranges **0.285** (Organic, n = 1,121) to **0.600** (Retail Media,
  n = 191), with sd = 2.892. True exposure: mean **503 days, sd 46** - and **86.9% of customers
  (3,475 of 4,000) have their first event inside the file's first 90 days.**
- **CAVEAT / CORRECTION.** An earlier draft of this ledger claimed "the one variable that does
  predict order count is elapsed transacting time, r = 0.475". **That was circular and is
  withdrawn.** The span from a customer's first to last event is *measured from the events
  themselves*, so more orders mechanically produce a wider span. Replacing it with the exogenous
  clock - first event to the end of the file - drops the correlation to +0.260, and even that is
  inflated, because drawing more events pulls a customer's first event earlier.
- **SO WHAT** The corrected picture is stronger than the wrong one. Every customer is observed for
  effectively the same window (sd of 46 days on a mean of 503, ~9%), so exposure cannot be the
  explanation either. Q3 ("which channels bring the most repeat customers") gets a bounded answer:
  **no channel differs from another by as much as 0.29 orders per customer, and the largest gap
  actually present is 0.171** - and there is no lurking exposure variable behind it.

### C12 · The percentage of sales from repeat customers reaches 100% - because the cohort is closed

- **QUERY** per month, share of `net_usd` from events after that customer's own first order.
- **OUTPUT** 4.20% (2024-04) → 34.45% → 54.51% → 73.63% → 84.30% → ... → **100.00% by 2025-07**, and
  100.00% or 99.9x% every month thereafter.
- **CAVEAT** Uses first *order* as the anchor, not `signup_date` - see C15.
- **SO WHAT** Guiding question Q4 measures nothing but elapsed time. All 4,000 customers exist from
  the start; once each has made one purchase, every subsequent sale is by definition a repeat sale.
  Plotting this ramp as a business achievement would be the single most misleading chart available
  in this dataset, and it is an obvious one to build.

### C13 · Discount-code usage carries no information about the customer

- **QUERY** P(an event carries a code) = 0.3538. Under independence the expected number of
  customers who never touch a code is `Σ_customers (1 - 0.3538)^(their event count)`.
- **OUTPUT** expected **58.2**, observed **57**, 95% Poisson interval **[44, 74]** - consistent.
  Never-users average **8.02 events**; users average **12.06**.
- **CAVEAT** Tests whether *exposure* to a code is random, which is the confound. It does not test a
  behavioural response to a code the customer has already seen - the file has no such handle.
- **SO WHAT** The naive comparison looks decisive: code users average **8.44 orders and $7,034**,
  non-users **5.72 orders and $4,764** - a 48% "loyalty lift". It is entirely backwards. You cannot
  use a code without placing an order, so more orders mechanically means more codes. Once exposure
  is accounted for, the 57 never-users are exactly the number chance predicts. **Q8's answer is
  that no code improves loyalty, including the one named `LOYALTY15`** (8.870 mean orders, **8th of
  13**, in a range of 8.654 to 9.000 across every code). *An earlier draft of this line - and the
  LinkedIn copy - said "6th of 13". The mean and the range were exact and the rank was wrong:
  EDU15 (8.8786) and SALE15 (8.8782) sit between LOYALTY15 and 6th place, separated from it by
  four thousandths of an order. The error is cosmetic against the claim, which is that a spread of
  0.35 orders across thirteen codes is nothing, but it was published.* A further check the file
  *can* support:
  within the same customer, coded and uncoded purchases carry statistically identical seat counts
  (6.028 vs 6.037, p = 0.061) - the only revenue difference is the discount arithmetic itself.

### C14 · Black Friday codes have no Black Friday - but two codes are geographically segregated

- **QUERY** χ² of `BFCM10` + `BFCM20` redemptions by calendar month against the file's own monthly
  base rate; then a full `discount_code × country` contingency table.
- **OUTPUT** Across months: **χ² = 6.10, df = 11, p = 0.867.** November + December carry **11.12%**
  of BFCM redemptions against **11.11%** of all events; the peak months are May-August (595, 587,
  626, 622). Across countries the picture is completely different: **χ² = 2,764.11, df = 108,
  p ≈ 0, Cramér's V = 0.135**, driven entirely by two codes -

  | code | events | in the US | % US |
  |---|---:|---:|---:|
  | **SALE15** | 817 | **817** | **100.00%** |
  | *(eleven other codes)* | - | - | 26.75%-38.56% |
  | **LOYALTY15** | 1,819 | **0** | **0.00%** |

- **CAVEAT / CORRECTION.** An earlier draft of this claim asserted that codes "are issued
  uniformly". That is true across time and **false across geography**, and I had written two claims
  (C13, C14) arguing the discount column was pure noise without testing the one dimension where it
  is not. Corrected.
- **SO WHAT** Two consequences, one for the brief and one for my own analysis. For the brief: the
  promotional calendar is decorative - codes carry seasonal names and are issued without a season,
  so "which promotional campaigns drive repeat purchases" has no campaign to point at. For this
  ledger: the segregation **confounds any per-code comparison**. `LOYALTY15` versus `SALE15` is a
  non-US-versus-US comparison wearing a discount label, which is also why the correction spans
  13.99 points across codes (SALE15 sits at 3.12%, in a country with no sales tax; LOYALTY15 at
  17.11%, in countries that have it). C13's conclusion survives because it is built on exposure
  counts rather than on comparing codes to each other - but the per-code table must never be read
  as a behavioural ranking.

### C15 · `signup_date` was generated independently of the transactions

- **QUERY** per customer, the fraction of events preceding their own `signup_date`; correlate that
  fraction against the signup date itself.
- **OUTPUT** **18,187 of 48,000 events (37.9%)** precede signup, affecting **3,007 of 4,000**
  customers. 993 customers are wholly unaffected, **114 have 100% of their events before signup**,
  and 2,893 have events on *both* sides of their own signup date. Correlation between the affected
  fraction and the signup timestamp is **r = 0.925**.
- **CAVEAT** None - this is a positive, directional measurement, not an absence.
- **SO WHAT** The near-perfect correlation is the mechanism: the later a customer's signup date was
  drawn, the more of their (independently drawn) events fall before it. So `signup_date` is a
  random label, not an acquisition date. Every cohort chart in the field's entries will be built on
  it. The only valid customer clock is the first *event*, which is what C12 and C16 use.

### C16 · The gap to the second order is a constant 44 days

- **QUERY** median days from first to second order, grouped by the month of the first order.
- **OUTPUT** overall median **44 days** (mean 64.19, p10 6.9, p90 147.3, max 496, n = 3,995). By
  first-order cohort: 46, 45, 43, 46, 46, 39, 48.5, 39, 49 days across the nine cohorts with
  n ≥ 47.
- **CAVEAT** Later cohorts have few customers (n < 20 from 2025-01) and are excluded from the
  stability claim.
- **SO WHAT** Q7 has a clean answer - **44 days** - and its constancy across cohorts is itself the
  finding: a memoryless waiting time, exactly what C10's Poisson process predicts. Nothing
  accelerates or decelerates repurchase.

### C17 · Loyal customers buy the same things as everyone else

- **QUERY** revenue mix by product family for the top decile of customers by order count (≥12
  orders, n = 565) against the bottom decile (≤5, n = 626); total variation distance; χ² on
  category × decile.
- **OUTPUT** TVD = **0.0752**. χ² = 12.20, df = 16, **p = 0.730**, Cramér's V = **0.029**. Both
  deciles' top five families are the same five products in near-identical shares (ChatGPT Team
  Annual 10.89% vs 8.44%; Azure AI Studio 8.41% vs 9.72%).
- **CAVEAT** Deciles by order count, not by revenue; a revenue split gives the same picture.
- **SO WHAT** Q6 ("which products are most popular with loyal customers") resolves to: the same
  ones. A 7.5% total-variation distance between the two extreme deciles is not a product strategy.

### C18 · Annual vs Monthly is a price tag, not a customer segment

- **QUERY** revenue per customer and per day of exposure by billing cycle; count of customers
  holding both.
- **OUTPUT** Annual **$6,203/customer**, **$34.73/day**; Monthly **$615/customer**, **$3.54/day** -
  a 10.1× and 9.8× gap. But **3,974 of 4,000 customers hold both** (3,987 hold Annual and, separately, 3,987 hold
  Monthly), over near-identical exposure (367 vs 368 mean days). A third cycle, One-time, covers
  841 customers at $980.51 each and is omitted from the question entirely.
- **CAVEAT** "Per day of exposure" uses first-to-last event span, which is the only defensible
  clock (C15).
- **SO WHAT** Q11 asks whether annual plans deliver higher revenue per customer. Arithmetically yes,
  by 10×. Substantively the question is malformed: it is the same customers on both cycles, and the
  ratio is the ratio of the list prices. There is no annual-versus-monthly cohort to compare.

### C19 · Add-on ownership is independent of core ownership at every grain

- **QUERY** four escalating tests. (a) baskets at customer × exact timestamp; (b) customer ×
  calendar day, against the collisions expected if dates were assigned at random; (c) the same
  "attach rate" recomputed at ±0/3/7/14/30-day windows; (d) lifetime co-ownership - the φ
  coefficient for all **696** add-on-family × core-family pairs across customer histories.
- **OUTPUT**
  - **Zero** multi-line baskets at exact timestamp. Every event carries its own timestamp, so the
    file has no simultaneous-purchase grain at all.
  - Same-day: 47,476 baskets, **517** multi-line, **113** holding an add-on with a core product.
    Under random date assignment across the 548 distinct dates, **526.4** collisions are expected.
    The 517 observed are *fewer than chance*.
  - Window sensitivity: the "attach rate" reads **4.01%** at ±0 days, 14.79% at ±3, 26.16% at ±7,
    42.68% at ±14 and **68.49% at ±30**. The analyst picks the number by picking the window.
  - Lifetime: max |φ| across 696 pairs = **0.049**, mean φ = +0.0001. 39 pairs reach p < 0.05
    against **34.8 expected by chance**, and **none survives Bonferroni** (α = 7.2 × 10⁻⁵).
    Customers owning at least one add-on: **3,000 observed against 3,013.9 expected** under
    independence.
- **CAVEAT / CORRECTION.** An earlier draft declined this question on the grounds that n = 113 is
  too small. That reasoning is refutable - anyone can widen the window to ±30 days and produce
  3,840 observations and a 68% "attach rate". The argument is now the unrefutable one: there is no
  association to measure at any grain.
- **SO WHAT** Q12 has no answer, and saying so is a stronger result than any number. Add-ons in this
  file are not attached to anything; they are drawn independently, and the observed 3,000 add-on
  owners are within 14 of what pure independence predicts. The dashboard reports the independence
  test and declines the metric.

### C20 · Quantity is a seat tier, and Enterprise buys the same as Consumer

- **QUERY** value counts of `quantity`; mean quantity by customer segment.
- **OUTPUT** Nine values with mass at 1 (16,654), 3 (9,581), 5 (7,387), 10, 15, 20, 25 and near-zero
  at 2 (180) and 4 (178). Mean by segment: Consumer 6.06, SOHO 6.01, SMB 5.89, **Enterprise 6.12**
  (n = 1,335).
- **CAVEAT** Enterprise is only 113 customers, but 1,335 events is enough to detect a real seat-count
  difference between an enterprise and a consumer.
- **SO WHAT** `segment` is a label with no purchasing consequence. The mean quantity of 6.03
  describes no purchase that exists in the file.

### C21 · Nothing happens over 19 months

- **QUERY** monthly event count, revenue, and invoice share - the latter defined as
  `count(*) filter (where event_type = 'invoice') / count(*)` per month, i.e. the share of
  **events**, not of revenue and not `payment_method`.
- **OUTPUT** 2,508-2,824 events per month (excluding the partial first and last), $1.44M-$1.70M
  recognisable, invoice share **28.35%-31.70%** every single month (all 19 months; the partials
  fall inside the same band, so nothing is hidden by excluding them).
- **CAVEAT** 2024-04 (763 events) and 2025-10 (1,798) are partial and are marked as such rather
  than dropped. **CORRECTION:** this line previously read "28.0%-31.8%", which reproduces under no
  definition - it appears to have blended the event-count floor with the net-revenue ceiling.
  `profile.md` already carried the right band (28.3%-31.7%). Neighbouring definitions, for the
  record: invoice share of `net_usd` runs 27.45%-31.81% and of `payment_method = 'Invoice'`
  23.23%-28.96%. The "flat every month" conclusion holds under all three.
- **SO WHAT** Q1's answer is that sales don't change. A flat line with its range annotated is a
  finding; a flat line presented as a trend is not.

### C22 · The catalogue's duplicate SKUs break the product ranking

- **QUERY** rank product families by `net_usd` after merging on `base_key + billing_cycle`, against
  the naive ranking by `product_id`.
- **OUTPUT** True #1 is **ChatGPT Team Annual at $2,742,575** across 4 SKUs. The naive top 5 by
  `product_id` is PROD0002 ($1,438,115), PROD0078, PROD0100, PROD0076, PROD0054 - three of which
  are the same Azure AI Studio Annual product at the same price. **The true #1 does not appear in
  the naive top 5 at all.**
- **CAVEAT** Merging is justified only for the 6 families where `base_key`, `billing_cycle` **and**
  price all match and events distribute uniformly across the SKUs (χ² p = 0.43, 0.82, 0.61, 0.99,
  0.04, 0.75). Families with genuinely different tier prices are kept separate.
- **SO WHAT** Q5 is the guiding question most likely to be answered wrongly by the field, and the
  error is invisible - the naive ranking looks perfectly reasonable.

---

## Theses considered and killed

**"Marketplace is the risky channel."** Its 2.37% refund rate is the highest of five and reads like
a finding. The Wilson interval is [1.97, 2.83] against an overall 2.094%. Killed by C7 - kept here
rather than deleted because it is the shape of claim this dataset most invites.

**"Discount codes drive a 48% loyalty lift."** Code users average 8.44 orders against 5.72 for
non-users. This is real arithmetic and completely backwards: code exposure is a function of order
count, not a cause of it. Killed by C13, which shows the 57 never-users are within the Poisson
interval [44, 74] of the 58.2 expected under pure independence.

**"AI products are what loyal customers buy."** ChatGPT Team Annual is 10.89% of top-decile revenue
against 8.44% of bottom-decile. Killed by C17 - χ² p = 0.730 across all 17 categories, V = 0.029.

**"Germany is the premium market."** Highest reported ASP at $748.57. Killed by C3 - it is third
ex-tax, and the ordering is a VAT ranking (ρ = 0.891).

**"Canada is the real premium market."** My own claim, in the first draft, from an ex-tax ranking
of revenue per event. Killed by C3: ex-tax it does not differ by country at all (KW p = 0.862), so
the ranking was noise, and a bootstrap gives Canada only a 0.322 chance of being top. This is precisely the
error C7 declines to make about Marketplace - I applied the standard in one claim and broke it in
another.

**"Orders per customer is a Poisson draw."** Also mine. Killed by C10: mean events per customer is
exactly 12.0000 across exactly 4,000 customers, so var/mean ≈ 1 is forced by a fixed-pool
allocation rather than evidence of anything.

**"The discount column is pure noise."** Mine again, spanning two claims. Killed by C14: `SALE15`
is 100% US and `LOYALTY15` is 0% US, χ² = 2,764 on 108 df.

**"Elapsed transacting time is what drives order count."** My own claim, in the first draft of this
ledger, at r = 0.475. Killed by C11: the span it correlates with is measured *from* the events, so
the relationship is definitional. Recorded here rather than quietly edited out, because it is the
same class of error as the three published numbers I got wrong in 2025/10 - a number that was
arithmetically correct and meant nothing.
