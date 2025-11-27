# Profile - 2025/11 E-commerce Analytics

Source: `DataDNA Dataset Challenge - E-commerce Dataset - November 2025.xlsx`
sha256 `5a1656e8102f2813b3fddd9141b82b61f7299847e7707066f8db6a705ef97316`.
Raw folder is read-only; everything below is computed, nothing is transcribed.

Four sheets. `DataDictionary` is documentation (38 rows, 2 columns) and is not a data table.

| Sheet | Rows | Cols | Grain | PK | Unique? |
|---|---|---|---|---|---|
| Events | 48,000 | 23 | one product line on one date for one customer | `event_id` | **yes**, 0 dups |
| Products | 101 | 14 | one catalogue SKU | `product_id` | yes, 0 dups - **but see issue 3** |
| Customers | 4,000 | 10 | one customer | `customer_id` | **yes**, 0 dups |

Referential integrity is perfect in both directions: 0 events reference an unknown customer,
0 reference an unknown product. All 4,000 customers appear in Events; all 101 products are sold.

Events span **2024-04-22 → 2025-10-21** (19 calendar months, the last partial at 21 days).
Signups span 2024-01-01 → 2025-08-30.

## The arithmetic is flawless - which is the warning, not the reassurance

Every within-row identity holds exactly, across all 48,000 rows:

| Identity | Violations (tol. $0.01) |
|---|---|
| `net_revenue_local = quantity × unit_price_local - discount_local + tax_local` | **0** |
| `net_revenue_usd = net_revenue_local × fx_rate_to_usd` | **0** |
| `unit_price_local = base_price_usd ÷ fx_rate_to_usd` (vs the Products catalogue) | **0** |
| `is_refunded` ⟺ `refund_datetime` present ⟺ `refund_reason` present | **0** |
| `refund_datetime ≥ event_date` | **0** (mean lag 29.8d, max 59d) |

`fx_rate_to_usd` is a single constant per currency (USD 1.00, EUR 1.06, GBP 1.22, AUD 0.66) with no
time variation. Nothing drifts, nothing is stale, nothing is null where it should not be.

This is precisely the configuration that fooled me in 2025/10. A file can be internally consistent
row-by-row and still be impossible across tables. So the checks below are all *cross*-table or
*cross*-row.

---

## The five issues that will shape the analysis

### 1 · 37.9% of events happen before the customer exists

**18,187 of 48,000 events** carry an `event_date` earlier than that customer's own `signup_date`.
This affects **3,007 of 4,000 customers** (75.2%) and reaches **490 days** at the extreme. It splits
across both event types (12,727 orders, 5,460 invoices), so it is not an artefact of renewals being
backdated.

`signup_date` is therefore **not** an acquisition date and cannot anchor a cohort. Every
"customers by signup month", "time from signup to first purchase", and "acquisition cohort
retention" chart built on this column is measuring a relationship the file does not contain.
The consequence is not that time is unusable - it is that the **only** valid customer clock is the
customer's own first *event*, which I use throughout.

### 2 · `net_revenue_usd` is not revenue - it is revenue plus sales tax

`net_revenue_local` is defined by the file's own arithmetic as `qty × price - discount **+ tax**`.
So the column named "net" is gross of tax, and the rate varies enormously by country. The rates are
exactly statutory, applied to the **pre-discount** gross (`quantity × unit_price_local`) -
reconciling `tax_local` against `round(rate × gross, 2)` leaves a maximum deviation of **$0.01**
across all 48,000 rows, and within-country standard deviations of 0.00005-0.00011:

| Country | tax rate | | Country | tax rate |
|---|---|---|---|---|
| United States | **0%** | | Brazil, Philippines | 15% |
| Canada | 5% | | Germany, France, Spain, UK, Netherlands | **20%** |
| Australia | 10% | | | |

*(Measured against the post-discount base these read 5.24%, 10.49%, 15.73%, 20.93%-21.03% - about
5% relatively higher. An earlier version of this table used that wrong denominator and described
Europe as "~21%". It is 20%. Which base is correct is not cosmetic: the file levies tax on the
**undiscounted** price while netting the discount out of revenue, so it overcharges tax on every
discounted line - $140,187 across the 16,980 of them. See insights C3d.)*

Total across the file: **$31,832,281 reported**, of which **$3,257,940 (10.23%) is tax**.

Because the US is 44% of the row count and pays 0% tax while Europe pays 20%, this single column
choice destroys the answer to guiding question Q9 ("ASP by country or currency"):

| Country | reported ASP | ex-tax ASP |
|---|---:|---:|
| Germany | $748.57 | $619.03 |
| Spain | $731.52 | $604.91 |
| France | $731.45 | $604.70 |
| Netherlands | $723.89 | $599.27 |
| Brazil | $719.43 | $622.05 |
| United Kingdom | $693.34 | $573.59 |
| Philippines | $681.39 | $588.74 |
| Australia | $660.22 | $597.71 |
| Canada | $659.42 | $626.83 |
| United States | $582.07 | $582.07 |

Reported ASP differs by country at **Kruskal-Wallis p = 6.9 × 10⁻²³**. **Ex-tax it does not differ
at all: p = 0.862, η² = -0.0001** - and the catalogue list price does not differ by country either
(p = 0.203). So the whole of the apparent country difference in selling price is sales tax. The
ex-tax column above is printed for completeness, **not as a ranking**: an earlier version of this
document drew ▲/▼ rank-move arrows on it and called Canada the new leader, which was reading noise
as a league table. A bootstrap gives Canada a 0.322 probability of being first. Withdrawn.

Q9 as posed ("by country **or** currency") also assumes the two are interchangeable. They are not:
4 currencies cover 10 countries, and USD alone spans the US, Canada, the Philippines and Brazil -
four countries taxed at 0%, 5%, 15% and 15%. Answering "by currency" averages those together, so it
is the worse of the two options the question offers.

### 3 · The 101-row catalogue contains 36 products

`base_key` collapses the 101 SKUs to **36 product families**, 34 of which have more than one
`product_id`. Some of that is legitimate - Annual and Monthly are genuinely different plans, and
some tiers carry genuinely different prices (Notion AI Monthly: $9.88 / $10.00 / $12.40 / $14.96).

But **6 groups share the same `base_key`, the same `billing_cycle`, *and* an identical price**,
split across 2-4 different `product_id`s under names like "Power BI Pro Annual", "...Annual
Standard", "...Annual Pro", "...Annual Business" - all at $153.78. Events distribute across those
duplicate IDs **uniformly**, consistent with random assignment (χ² p = 0.43, 0.82, 0.61, 0.99,
0.04, 0.75 for the six groups).

The consequence for Q5 ("which products or plans sell the most") is severe. Grouped by
`product_name`, the top 5 by revenue reads:

```
Microsoft 365 Business Standard Annual   $1,438,115
Azure AI Studio Annual Standard            $828,457   ← same product,
Azure AI Studio Annual Pro                 $821,198   ← same price,
Azure AI Studio Annual                     $794,521   ← three rows
Datadog Pro Annual                         $788,083
```

Merged on `base_key` + `billing_cycle`, the true top 5 is:

```
ChatGPT Team Annual                      $2,742,575   ← absent from the naive top 5 entirely
Adobe Firefly Creative AI Annual         $2,532,515
Azure AI Studio Annual                   $2,444,176
Microsoft Copilot for Office Annual      $2,430,554
Power BI Pro Annual                      $1,706,905
```

*(Both tables are in recognisable revenue - ex-tax, refunds removed. An earlier version printed
them in the file's `net_revenue_usd`, i.e. the tax-inclusive figure this same document calls "not
revenue". Two currencies in one document, one of them the one being condemned.)*

**The naive #1 is not the real #1, and the real #1 does not appear in the naive list at all.**
`product_name_orig` and `base_price_usd_orig` are also present and differ from the live columns on
31 and 37 rows respectively - the sheet is shipping its own edit history.

### 4 · Region is blank for the largest market

`region` has four values: `EU` (19,040 events), `APAC` (7,306), `LATAM` (2,075), and **empty string
(19,579)**. The empty string is not missing data - it is *exactly* the United States (14,735) plus
Canada (4,844), and no country appears under two different region labels. North America is 40.8% of
all events and 40.7% of customers, and it has no label.

Any `GROUP BY region` renders the biggest region as a blank bar, and any tool that treats `""` as
null drops it. This is a labelling defect, not missingness, and it gets an explicit `North America`
label in the curated layer with the substitution recorded in `assumptions.md`.

### 5 · Refunds are flagged but never reversed

**1,005 events (2.09%)** are refunded. Not one carries a negative `net_revenue_usd`; the mean
refunded event is $632.56 against $663.83 for the rest. **$635,723 of "revenue" - 2.00% of the
total - was given back to the customer and is still counted.**

The refund flag itself is clean (perfect agreement between `is_refunded`, `refund_datetime` and
`refund_reason`; no refund precedes its event). The defect is that no compensating entry exists.

Where refunds happen (Q10) has a definite and boring answer: **nowhere in particular.**

| Channel | refund rate | 95% Wilson CI |
|---|---:|---|
| Marketplace | 2.37% | [1.97, 2.83] |
| Website | 2.08% | [1.90, 2.28] |
| Direct Sales | 2.06% | [1.80, 2.36] |
| Partner | 2.03% | [1.67, 2.46] |
| Reseller | 2.02% | [1.72, 2.38] |

Every interval covers the overall rate of 2.094%. The same holds across the 17 product categories
(1.28%-2.29%, all n ≥ 300). Q10 asks *where* refunds concentrate; the answer is that they do not.

---

## Column-level notes

**Events (23 columns).** No nulls anywhere except `refund_datetime` (46,995 null = exactly the
non-refunded rows). Eight numeric columns arrive as text from the XLSX reader but every value parses
cleanly - 0 non-numeric strings across latitude, longitude, unit_price_local, discount_local,
tax_local, net_revenue_local, fx_rate_to_usd, net_revenue_usd. `refund_reason` uses `""` rather than
null for "no refund" (46,995 rows); `discount_code` uses the literal string `"N/A"` for "no
discount" (31,020 rows, 64.6%) - both are sentinels that a naive `COUNT(DISTINCT)` reports as real
categories.

`quantity` is not continuous. It takes nine values with a strongly preferred set -
1 (16,654), 3 (9,581), 5 (7,387), 10 (5,570), 15 (4,710), 20 (2,796), 25 (944) - and near-zero mass
at 2 (180) and 4 (178). These are seat tiers, so the mean of 6.03 describes no actual purchase.
Mean quantity is flat across customer segments (Consumer 6.06, SOHO 6.01, SMB 5.89, Enterprise
6.12) - **Enterprise customers buy the same number of seats as Consumers.**

**Customers (10 columns).** No nulls. `region` carries the same blank-North-America defect as
Events. `country_latitude` / `country_longitude` are country centroids, so they are 10 distinct
points, not customer locations - a map built on them plots ten dots, and the same is true of the
`latitude` / `longitude` on Events.

**Products (14 columns).** `first_release_date` is populated; `is_subscription` is boolean with 2
one-time SKUs. `billing_cycle` is Annual (49) / Monthly (50) / One-time (2). `category` has 17
values but is not a clean taxonomy - "Productivity" and "Productivity Suite" coexist, as do
"AI Tools" and "AI Productivity", and `vendor` contains the value "AI Tools" (14 rows) alongside
real vendors, so vendor and category share a member.

## What the file does *not* contain

- **No order or basket identifier.** Each event is one product line. The closest available basket
  is customer + calendar day, and on that definition **only 1.09% of baskets (517 of 47,476) hold
  more than one line**, and only **113** contain an add-on together with a core product against
  5,607 total add-on events. Guiding question Q12 (attach rate) has almost no evidence to work
  with; publishing a headline attach rate off 113 observations would be the invented number this
  project exists to avoid.
- **No cost, margin, or list-vs-paid distinction** beyond the discount column.
- **No churn, cancellation or subscription-end field.** `event_type` is `order` (33,601) vs
  `invoice` (14,399), which the dictionary glosses as "new sale" vs "renewal/billing" - but
  **1,164 customers' first-ever event is an invoice**, a renewal with nothing to renew. The field
  does not encode a lifecycle.

## Loyalty, the brief's central variable, has no variance

Under the natural reading - a repeat buyer is a customer with more than one purchase -
**4,000 of 4,000 customers are repeat buyers** counting all events, and **3,995 of 4,000** counting
orders only. Median orders per customer is 8; the distribution runs 1 to 23.

So the brief's request to "identify loyal customers" has a literal answer of "all of them", and the
interesting question is not *who* but *how many*, and *why some more than others*. On that:

- orders per customer: mean 8.400, variance 8.362, **var/mean = 0.995** - indistinguishable from a
  Poisson process at a constant rate
- Kruskal-Wallis on orders per customer by `acquisition_channel` (H = 2.35, k = 6, p = 0.799,
  ε² = -0.0007), `segment` (p = 0.689), `age_band` (p = 0.701), `region` (p = 0.347). Under
  Bonferroni across the six tests run (α = 0.0083) nothing survives; the two smallest p-values,
  `country` (0.044) and `currency_preference` (0.033), carry ε² of 0.002 and 0.001 - effect sizes
  two orders of magnitude below anything a business would act on.
- the one variable that does predict order count is **elapsed transacting time**:
  r = 0.475 between orders and the span from a customer's first to last event.

Stated positively rather than as a null result: **how much a customer buys is a function of how
long they have been buying, and of nothing else the file records.** Q3 ("which channels bring the
most repeat customers") therefore has a measured answer - none of them do, differently - and it
comes with an effect size, not just a p-value.

## And the promotions have no season

Two of the fourteen discount codes are named for Black Friday / Cyber Monday: `BFCM10` (2,665 uses)
and `BFCM20` (2,649). Tested against the file's own monthly base rate: **χ² = 6.10 on 11 df,
p = 0.867**. November + December account for **11.12%** of BFCM redemptions against **11.11%** of
all events. The peak months for Black Friday codes are **May, June, July and August** (595, 587,
626, 622).

The codes are uniform across *time* but emphatically not across *place*: `SALE15` is redeemed 817
times and **all 817 are in the United States**, while `LOYALTY15` is redeemed 1,819 times and **none
of them are** (χ² = 2,764 on 108 df). Every other code sits near the 30% US base rate. That is the
single piece of non-random structure in the discount column, and it means no two codes can be
compared to each other without comparing two different tax regimes.

The monthly series overall is equally flat: 19 months at 2,508-2,824 events and $1.62M-$1.93M, with
the invoice share pinned between 28.3% and 31.7% every single month. There is no seasonality, no
trend, no launch, and no Black Friday. Guiding question Q1 ("how do total sales change by month")
has a real answer: **they don't** - and a flat line drawn honestly, with the range annotated, is a
finding rather than a filler chart.
