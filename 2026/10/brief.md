# Brief - 2026/10

- **Title:** October 2026 DataDNA - Sunrise Coffee Chain Analytics
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/october-2026-datadna-sunrise-coffee-chain-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-09-october-2026-datadna-sunrise-coffee-chain-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/09/DataDNA-Dataset-Challenge-2026-10-Sunrise-Coffee-Chain.zip
- **ZIP sha256:** `b54effee60022f7b3d9734b52a9a526bc8db3337763178fd478a88673a1498aa`
- **Era:** 2
- **Status:** challenge closed (deadline 24 October 2026); this is portfolio/practice work, not a live entry

## Which brief is the brief

The challenge page and the archive disagree about what this challenge is.

- The page's **"Operational & Analytical Challenges"** block (12 bullets) is about urban food delivery:
  kitchens, delivery zones, riders, traffic, weather, food temperature, SLA breaches and orders
  over 8 km. None of those entities exists in this archive. The block appears to be carried over
  verbatim from the 2026/09 Golden Wok page.
- The archive ships `CHALLENGE_BRIEF.md` and `docs/DATA_DICTIONARY.md`, which describe a UK coffee
  chain and match the delivered tables.

**Decision:** the archive brief is the spec. The page block is recorded here as a source defect and is
**not** a requirements checklist. It is listed under *Rejected page requirements* so the G7 trace shows
it was read and deliberately excluded rather than missed. (LEARNINGS 2025/05: the spec can live in the
ZIP, not on the page.)

## Scenario

From `CHALLENGE_BRIEF.md` (verbatim):

> You are a senior commercial analyst at Sunrise Coffee Chain, reporting to the Chief Commercial
> Officer. The business operates 60 stores across the UK, spanning High-Street, Retail-Park, and
> Transport-Hub formats. You have been asked to produce a comprehensive performance review covering
> the 2023–2024 trading period, with a focus on store profitability, loyalty programme effectiveness,
> and revenue mix trends ahead of next year's expansion planning cycle.

> Sunrise Coffee Chain has grown steadily over the past five years but the commercial team suspects
> that performance is diverging sharply between store formats and regions. The Chief Commercial
> Officer wants to know which stores and formats are genuinely driving the business forward, whether
> the loyalty programme is generating measurable incremental spend, and how the revenue mix across
> espresso drinks, filter coffee, food, and retail beans is shifting over time. Your findings will
> directly inform which regions get prioritised in the 2025 site selection programme and whether the
> loyalty scheme warrants further investment.

**Decision persona:** the Chief Commercial Officer, before the 2025 site-selection and loyalty-budget
cycle.

**Decisions supported:**
1. Which regions (and formats) to prioritise for 2025 expansion.
2. Whether the loyalty programme earns further investment.
3. Which product categories to grow or deprioritise.
4. How to staff and stock for seasonal and weekly patterns.

## Stated objective

Verbatim, "Impact & Purpose":

> - Identify which store formats and regions to prioritise in the 2025 expansion programme
> - Decide whether the loyalty programme is generating a positive return on investment
> - Understand which product categories to grow or deprioritise based on revenue mix and margin
> - Anticipate seasonal trading patterns to optimise staffing and stock ordering

## Explicit requirements

The archive brief is a spec: four analysis areas, 14 guiding questions and a three-part deliverable.
Every bullet below is a G7 trace row.

### Analysis areas

- [ ] **A1 Format & region.** Compare formats on profitability, revenue/sqft and footfall; strongest and weakest regional net margins; flag review/closure candidates by `profitability_status`.
- [ ] **A2 Loyalty.** Adoption → member revenue % and ATV; do redemption costs outweigh incremental member revenue; is it more effective in certain formats/regions.
- [ ] **A3 Revenue mix.** Espresso/filter/food/retail-beans split across stores, formats and time; is food share growing; which `dim_product` categories have the highest gross margin.
- [ ] **A4 Temporal.** Day-of-week, bank holidays, seasonality 2023–2024; peak quarters; format response to seasonal demand.

### Guiding questions

- [ ] Q1 Which format delivers the highest average `net_profit_margin_pct`?
- [ ] Q2 Which regions concentrate Loss-Making / Structural-Loss status?
- [ ] Q3 Does higher rent buy higher revenue, or does rent erode profit disproportionately in some formats?
- [ ] Q4 Which stores improved / deteriorated most in `net_profit_gbp`, 2023 → 2024?
- [ ] Q5 Store-level correlation of `loyalty_adoption_rate` with `loyalty_member_revenue_pct`?
- [ ] Q6 Do members spend more per transaction than non-members (ATV relative to `loyalty_transactions`)?
- [ ] Q7 Net loyalty value per store: member revenue contribution − `loyalty_redemption_cost_gbp`.
- [ ] Q8 Does adoption vary significantly by format or region?
- [ ] Q9 Revenue split by stream, and how it differs by format.
- [ ] Q10 Which product categories carry the highest `gross_margin_pct`, and are they growing as a share of daily revenue?
- [ ] Q11 Is retail-beans share growing?
- [ ] Q12 Weekday vs weekend revenue by format.
- [ ] Q13 Do bank holidays help or hurt Transport-Hub vs High-Street?
- [ ] Q14 Highest/lowest `net_profit_gbp` months; does the pattern repeat year on year?

### Deliverables

- [ ] D1 Executive summary: 3–5 key findings with implications plus one headline recommendation to the CCO.
- [ ] D2 Detailed analysis: profitability trends, format comparisons, revenue mix; store-level breakdown with profitability status; loyalty net-value assessment.
- [ ] D3 Actionable insights: stores/regions for review; loyalty investment verdict; seasonal staffing/promo recommendations.

### Rejected page requirements

The 12 "Operational & Analytical Challenges" bullets on the challenge page (fragmented order/kitchen/zone
visibility; rush-hour outer-ring delays; Rain/Heavy-Rain friction; >8 km negative profitability; food
temperature vs ratings; kitchen-to-zone corridor losses; congestion; volume vs health; distance/traffic/
weather/temperature/rating linkage; kitchen × zone × period × weather × traffic interactions; rush-hour
seasonality; delivery-to-profit connection). **Not applicable:** no order, kitchen, zone, rider,
traffic, weather, distance, temperature or rating field exists in the archive. Excluded with this
reason; to be stated in the dashboard's methods note.

## Source-integrity posture

The archive contains three dimensions, two facts, a challenge brief and a data dictionary. The
dictionary makes strong guarantees ("always derived correctly", "always consistent"). Five G1 spot
checks already contradict the documentation or the brief's framing. All are **G2 hypotheses** to
confirm in the profile, not yet findings:

| # | Documented | Observed at G1 |
|---|---|---|
| H1 | Estate spans High-Street, Retail-Park and Transport-Hub formats | **58 High-Street, 2 Transport-Hub, 0 Retail-Park.** Every format comparison the brief asks for (A1, Q1, Q3, Q8, Q12, Q13) is n=2 against n=58 or has no comparator at all |
| H2 | `fact_daily_sales` grain is one row per store per day | 10,000 rows cover 8,910 distinct store-days (of 43,800 possible). The fact is both sparse (~20% coverage) and not unique at its stated grain |
| H3 | Monthly rent and staffing are "consistent with dim_store" | Rent and staffing differ from `dim_store` on **1,440 of 1,440** monthly rows. The internal net-profit and member-spend identities do hold (0 failures) |
| H4 | `gross_margin_pct` range 0.36–0.80; `launch_date` not nullable | Observed range 0.66–0.904; `launch_date` null on 36 of 40 products |
| H5 | `fact_daily_sales` schema as documented | Has an undocumented `avg_dwell_time_minutes` column; `product_id` is the day's *top* product, so it cannot attribute revenue to a category |

The daily-row identities (stream sum, ATV, loyalty ≤ transactions, footfall ≥ transactions) passed with
0 failures. Still to test at G2: whether daily sums reconcile with monthly totals, and whether
`profitability_status` matches its stated margin bands.

Several guiding questions cannot be answered as asked:
- **Q6** asks for member vs non-member ATV. No member-level transaction value exists. Member spend is
  monthly and member transactions are daily on a sparse sample, so the ratio is unsupported as
  specified unless the two grains reconcile.
- **Q7** asks for "incremental" loyalty value. Member revenue is not incremental revenue. No
  counterfactual exists.
- **Q10** asks whether category share is growing. Category revenue exists only as the four daily
  streams; `product_id` names one top product.

Per LEARNINGS 2026/09, an absent comparator makes a verdict *unsupported*, not contradicted.

## Submission mechanics

- Required tag union: `@OnyxData`, `@SmartFramesUI`, `@DataCareerJumpstart` (Step 2) + `@packt` (prefilled LinkedIn share text)
- `@onyxdata.co.uk` in the scraped list is a scraper artefact (email domain), not a tag
- Hashtag: `#dataDNA`
- One LinkedIn post with a single dashboard image
- Screenshot: PNG, JPG or WebP, maximum 10 MB
- One entry only; resubmissions prohibited
- Optional Power BI `.pbix` up to 50 MB or report link
- Prize pool: 2 Packt eBooks and The Data Analytics Interview Software (worth $500)

## Timeline

| | Date |
|---|---|
| Challenge begins | 1 October 2026 |
| Submission deadline | 24 October 2026 |
| Review and winner selection | 25–30 October 2026 |
| Winners announced | 31 October 2026 |

## Benchmark

At G1, `/portfolio/` lists Sunrise entries including Elice, olaomo favour, Mayomi Oluwapelumi, Darwin
Yunus, ugo nwasuruba, Gobinath R c, Walter Guerrero, Pooja Nair, Minwoo Jeong, RASHID SEIDU and others.
**No AI scores are publicly visible.** Card counters are likes/views, consistent with every prior month.
Three submission images were read in full:

| Entry | What it shows | Visible claims |
|---|---|---|
| ugo nwasuruba (Power BI, 4 pages) | Strongest of the three: cover page, maroon identity, a stated insight panel per page ("Expand where margins lead, not where revenue leads"), region margin bar + revenue/margin scatter + expansion table with Expand/Monitor/Review actions, loyalty ROI by format, stream trend lines and a month × weekday heatmap | 2024: £44.7M revenue, £8.4M profit, 18.8% margin; Northern Ireland tops margin, London tops revenue; Transport-Hub loyalty ROI £23.41 vs High-Street £17.07 |
| Mayomi Oluwapelumi (Power BI, 3 pages) | KPI strip, monthly revenue trend, net profit by region and store, loyalty member/non-member bars, stream donut, gross profit by product category, insight and recommendation text boxes | £89.69M revenue, £16.88M profit, 18.82% margin; "Transport-Hub 25.14% vs High-Street 18.59%", recommends scaling the Transport-Hub model; category gross profit charted from `product_id` |
| olaomo favour (Power BI, 3 pages) | Store drill with slicers, store table with status pills, monthly KPI cards with MoM/YoY deltas, shift-pattern revenue | Most status cells read `N/A`; one page is titled "Brewline Coffee Co" |

**What the stronger entry did:** it stated a thesis per page and turned the region table into an
action column (Expand/Monitor/Review), which is exactly the CCO's decision. It held one visual
identity across pages and used a heatmap for the temporal question. It treated revenue and margin as
different rankings, which is the most useful single framing in the field.

**What all three missed:** every format comparison treats 2 Transport-Hub stores as a peer of 58
High-Street stores, and two entries draw an expansion recommendation from that n=2 gap. None noticed
the absent Retail-Park format, the daily fact's ~20% coverage, or the rent/staffing contradiction. One
charts "gross profit by product category" from a column that names only the day's top product. Loyalty
"ROI" is reported as member revenue over redemption cost, which credits the programme with spend
members might have made anyway. Insight text is long, and no entry quantifies uncertainty.

**Where this month beats the field:** (1) Insights: denominators and sample sizes on every
comparison, with format replaced by a defensible axis such as region, location type or rent band.
(2) Technical: grain reconciliation between daily and monthly facts, a Malloy model and recomputed
numbers. (3) Accessibility, as every month. Match the strongest entry's action table and
thesis-per-panel; exceed it on evidence.

## Lessons applied from `.workbench/docs/LEARNINGS.md`

1. **Establish the grain before any metric** (2025/05, 2026/06 "a unique id is not a grain"). The daily
   fact's stated grain is already false at G1 (H2), and its `product_id` is a top-product label rather
   than a revenue key. Profile both facts' grains and test daily → monthly reconciliation before any
   revenue-mix or day-of-week claim.
2. **An absent comparator changes the verdict class** (2026/09). The format comparison has no
   Retail-Park and n=2 Transport-Hub. Member-vs-non-member ATV and "incremental" loyalty spend have no
   comparator either. These become *unsupported as specified* with the query that shows why. They are
   not converted into convenient substitute verdicts.
3. **Mechanical integrity is not semantic integrity; test every source promise** (2026/08–09). The
   internal P&L identities hold, but the dictionary's cross-table promises (rent/staffing consistency,
   ranges, nullability, formats) already fail. Each documented guarantee becomes a row in a testable
   source-contract table rather than a sentence trusted at face value.
