# Brief - 2025/11

- **Title:** November 2025 DataDNA - E-commerce Analytics
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/november-2025-datadna-e%e2%80%91commerce-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2025-11-november-2025-datadna-e-commerce-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2025/10/DataDNA-Dataset-Challenge-E-commerce-Dataset-November-2025.zip
- **sha256:** `5a1656e8102f2813b3fddd9141b82b61f7299847e7707066f8db6a705ef97316`

**Registry said CSV; it is a single XLSX with four sheets** (Events, Products, Customers,
DataDictionary) plus a DOCX brief, a READ-ME, and two ZoomCharts PDFs. Corrected in
`challenges.yml`.

## Scenario

Verbatim from `Challenge_Brief_Ecommerce_Dataset.docx` (the DOCX is the authority; the web page
paraphrases it):

> You will analyze an e-commerce sales dataset from a global software retailer that sells
> subscriptions and add-ons across analytics, design, collaboration, and AI. Your objective is to
> identify loyal customers (repeat buyers) and determine which channels and promotional campaigns
> drive their repeat purchases.

## Stated objective

> Build an easy-to-read data visualization report that
> - Tracks sales and loyal-customer volumes over time.
> - Highlights revenue drivers and repeat-purchase patterns.
> - Shows how discounts and pricing influence sales performance.
> - Delivers clear insights that guide business strategy and stakeholder decisions.

## Explicit requirements

The DOCX carries a **"Guiding questions"** list. It is not labelled a spec, but it is the closest
thing this month has to one, and it becomes the G7 checklist. Twelve questions, verbatim:

- [ ] Q1 · How do total sales change by month?
- [ ] Q2 · Which channels bring in the most sales?
- [ ] Q3 · Which channels bring the most repeat (loyal) customers?
- [ ] Q4 · What percent of monthly sales comes from loyal customers?
- [ ] Q5 · Which products or plans sell the most?
- [ ] Q6 · Which products are most popular with loyal customers?
- [ ] Q7 · How long do customers wait before their second purchase?
- [ ] Q8 · Which discount codes are used most, and do they increase repeat purchases?
- [ ] Q9 · What is the average selling price (ASP) by country or currency?
- [ ] Q10 · Where do refunds happen most (by product or channel)?
- [ ] Q11 · Do annual plans bring higher revenue per customer than monthly plans?
- [ ] Q12 · Which add-ons are most often bought with core products (attach rate)?

The web page renders the same twelve with light rewording (it says "loyal customers" where the DOCX
says "repeat (loyal) customers", and extends Q8 with "and do they improve loyalty"). Where they
differ I follow the DOCX and note the variance.

**Several of the twelve are unanswerable or actively misleading as posed** - see
`analysis/profile.md`. That is a finding to report, not a reason to skip them. Each gets an honest
answer plus the reason the question mis-fires.

## Submission mechanics (THIS month)

Union of the Step-2 list, the prefilled share text, and the FAQ:

- Follow **@OnyxData** on LinkedIn.
- One LinkedIn post on your own profile, tagging **@OnyxData @ZoomCharts @SmartFramesUI
  @DataCareerJumpstart**, hashtag **`#dataDNA`**.
- **A single image.** Not a link, not a carousel, not a video.
- Complete the submission form. *(The READ-ME's form link is stale - it points at the **October**
  fitness-membership challenge. The web page's own form is the correct one.)*
- Resubmissions are not permitted.
- AI feedback email within 30 minutes, scoring storytelling / design / technical depth / insights.
- A draft portfolio entry is created; scores become public only once you publish it.

Optional parallel track: ZoomCharts Mini Challenge (Power BI, ≥2 Drill Down visuals). **Not
entered** - this project builds a web dashboard, and that track requires the vendor's Power BI
visuals. Noted so the omission is deliberate rather than overlooked.

## Timeline

The challenge ran November 2025 and is closed. This is a portfolio build against a past month, so
there is no live deadline; the constraint is the rubric, not the clock.

## Benchmark

**Unchanged from every prior month and re-verified today.** `/portfolio/` returns all 445 entries
in one payload with the challenge filter applied client-side, and the listing served to a logged-out
client is pinned to the *current* challenge. Individual entries render
their AI scores only behind an account. I do not have one.

**Consequence, stated plainly:** I cannot benchmark against this month's field quantitatively, and
"beats the top scorer" is not a claim I can make or check. This has now held for seven consecutive
months. The benchmark stays qualitative and is drawn from the visible titles and thumbnails across
the portfolio at large:

The field's characteristic entry is a four-KPI header (total revenue, total orders, total
customers, AOV), a monthly revenue line, a channel bar chart, and a country map - computed directly
off the columns as supplied. For this dataset that means **the headline revenue figure is wrong in
a specific, quantifiable direction**, and the country map is a VAT map. The gap I am aiming at is
not visual polish; it is that the field will publish `SUM(net_revenue_usd)` as "revenue" without
noticing it contains $3.26M of sales tax and $0.64M of refunded orders.

The second gap is the loyalty question itself. The brief asks entrants to *identify* loyal
customers. In this file 3,995 of 4,000 customers have ≥2 orders. An entry that shows a
loyal-vs-new donut is showing 99.9% vs 0.1%, and most will avoid that by silently inventing a
threshold ("loyal = 5+ orders") without saying so. Declaring that the segmentation does not exist -
and then finding the axis of variation that *does* - is the differentiator.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **"An identity check is not an integrity check" (2025/10).** Last month I certified this file's
   equivalent as sound after testing only within-row arithmetic, and missed 2,150 complaints
   answered before they were received. Here the within-row arithmetic is *perfect* - 0 violations
   on `net_local = qty×price - discount + tax` and 0 on `usd = local × fx` across all 48,000 rows.
   That is exactly the trap. So I went straight to cross-table time: **18,187 events (37.9%) occur
   before the customer's own signup date**, affecting 3,007 of 4,000 customers, by up to 490 days.

2. **"Do not infer from a null result" (2025/09, the recurring one).** Order counts per customer
   are unexplained by acquisition channel, segment, age band or region. I am *not* concluding "the
   generator made them independent". I am reporting the positive, measurable fact:
   `var/mean = 0.995` on orders per customer - a Poisson draw at a constant rate - and that the one
   thing which does predict order count is elapsed transacting time (r = 0.47).

3. **"Verify before you publish, with a second engine" (2025/08 → 2025/10).** Three published
   numbers were wrong last month, one contradicting my own integrity output. Every figure this
   month carries a `data-metric` attribute and is re-derived from parquet through DuckDB by
   `tools/verify_metrics.py` before G7 passes. The corrected totals in the thesis are the
   highest-risk numbers in the build and get checks first.
