# Brief - 2025/05 · Mobile Phone Sales

**Era 2.** Everything below is scraped or transcribed from a primary source. Sources are named per
section. Verified 27 May 2025.

- **Title:** May 2025 DataDNA - Mobile Phone Sales
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/may-2025-datadna-mobile-phone-sales/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2025-05-may-2025-datadna-mobile-phone-sales/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2025/04/Onyx-Data-DataDNA-Dataset-Challenge-Mobile-Phone-Sales-Dataset-May-2025.zip
  *(confirmed live - the `Download Dataset` anchor still resolves to this exact href)*
- **Raw folder:** `Onyx-Data-DataDNA-Dataset-Challenge-Mobile-Phone-Sales-Dataset-May-2025/` - already on disk
- **Status:** challenge closed. Building for practice and portfolio, not submission.

### Primary sources used

| Source | What it gave |
|---|---|
| Challenge page (scraped) | scenario, objective, tags, timeline, prize pool, AI rubric |
| `Brief Onyx Data May 2025.docx` (in the ZIP) | **the nine key questions** - not on the web page |
| `READ ME BEFORE PARTICIPATING.txt` (in the ZIP) | entry mechanics, ZoomCharts mini-challenge |

---

## Scenario

*Verbatim, challenge page - identical to the DOCX.*

> You are a data analyst for a major mobile phone retailer operating across multiple countries.
> You've been given a 2024 sales dataset, containing detailed records of mobile phone transactions,
> customer demographics, product specifications, and geographic locations. The dataset combines
> information about the models sold, their prices, storage sizes, colors, operating systems, and
> customer demographics like age group and gender. It also captures where and how the sales were
> made - online, through partners, or in-store, and the type of payment used.

## Stated objective

*Verbatim.*

> Your goal is to build a report that tells the story of mobile sales across different regions,
> highlights best-selling products and trends, and helps the business understand customer behavior
> better.

## Explicit requirements - the nine key questions

**A requirements list does exist, but not where the playbook expects it.** The challenge page carries
no bulleted list (I checked the rendered DOM - there is no "Key questions" string on it). The list is
in `Brief Onyx Data May 2025.docx`, shipped *inside the dataset ZIP*, under the heading
"Key questions to answer in your analysis". Verbatim, all nine:

- [ ] **R1** Which mobile brands and models are the top sellers overall and in specific countries or cities?
- [ ] **R2** How do sales numbers vary by storage size, color, or operating system (Android vs. iOS)?
- [ ] **R3** What is the typical customer profile - age group, gender - for different brands or models?
- [ ] **R4** How do sales and revenues break down across different sales channels (online, partner, in-store) and payment types?
- [ ] **R5** Are there noticeable differences in pricing and sales volume between regions or cities?
- [ ] **R6** Which countries or cities generate the highest total revenue and units sold?
- [ ] **R7** Are there patterns in customer demographics based on mobile brand, model, or price range?
- [ ] **R8** How does sales performance change month over month in 2024?
- [ ] **R9** Are there correlations between customer age groups and the type of devices they purchase (for example, younger customers preferring certain brands)?

**This is the G7 checklist.** Every bullet must trace to a specific element in the dashboard.

> **Lesson for the program:** the ZIP is a primary source, not just data. Unpack and read every
> DOCX/PDF/TXT at G1, before G2 - not only in Era 1. → carry into `.workbench/docs/LEARNINGS.md` at G8.

Note these are *questions*, not gaps to close, and they are almost entirely descriptive. Answering
all nine earns competence, not distinction - the whole field answered them. Distinction comes from
the analysis layered on top (see Benchmark).

---

## Submission mechanics (THIS month)

The three lists contradict each other exactly as the playbook warns. **Union = 7 tags.**

| Source | Tags named |
|---|---|
| Step 2 on the page | @OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart |
| Prefilled share text | @OnyxData **@packt** @SmartFramesUI @DataCareerJumpstart |
| DOCX "How to Enter" | @OnyxData @ZoomCharts @Enterprise DNA @BCS @Smart Frames UI @Data Career Jumpstart |

**Union to use:**
`@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt`

- Hashtag: `#dataDNA`
- **Single image only.**
- Follow Onyx Data on LinkedIn; complete the submission form. Resubmissions not permitted.

**Prize pool (May 2025):** BCS Membership · 2 Packt eBooks · The Data Analytics Interview Software
(worth $500) · 3 months free EnterpriseDNA access.

**Sponsor mini-challenge - ZoomCharts, $300 Amazon voucher.** Power BI only: requires ≥2 ZoomCharts
Drill Down visuals in a .pbix. **Not addressable by our stack** - we are not building Power BI. Its
judging criteria are worth reading anyway, because they are pure interaction design and echo the
main rubric's heaviest line:

> 1) Overall user experience and intuitiveness. 2) Navigation and user-flow of the report.
> 3) Implementation of drill down interactions and cross-chart filtering in data storytelling.
> 4) Visual clarity and readability.

## Scoring - confirmed live

The page states, in "What happens after you submit":

> Your work is scored across **storytelling, design, technical depth, and insights**.

That is **AI rubric A**, confirmed as the rubric that actually ran for this challenge. Rubric B
(Data Story / Design / Interactivity / Visual Appeal / Accessibility) is the homepage's newer
version. `.workbench/docs/RUBRIC.md` says build to the union - that still stands, and accessibility remains
the cheapest differentiator, but for *this* month Technical and Insights are the confirmed live
dimensions.

## Timeline

| | Date |
|---|---|
| Opens | 01 May 2025 |
| Deadline | 24 May 2025 |
| Judging | 25-29 May 2025 |
| Announced | 31 May 2025 |

---

## Benchmark

**24 published entries** for this exact challenge, pulled from `/portfolio/` by crawling all 50
pages and filtering on the `data-challenge` attribute (`may-2025-datadna-mobile-phone-sales`).
Tooling: 21 Power BI, 3 Tableau. Only 2 used ZoomCharts despite the mini-challenge.

### ⚠ No AI scores are publicly visible - for any month

Every one of the 445 portfolio entries site-wide carries `data-score="0"` and an empty `data-tier`.
The scoring UI ships (`portfolio-scores.css` is loaded on every detail page) but renders no values,
logged out. So the premise that "the portfolio shows published entries *with their AI score
visible*" - **does not hold as of 27 May 2025**, and the `?filter=top_rated` view is inert.

**Consequence:** the Definition-of-Done line *"beats the highest scorer on ≥2 dimensions"* is not
mechanically checkable this month. I benchmarked qualitatively instead - read all 24 descriptions
and inspected the poster images directly. Either that DoD line needs rewording to a qualitative
claim, or it needs a logged-in account to see scores. **Unresolved.**

### Numbers the field agrees on

Four independent entries report the same headline figures, which gives us a strong prior to
validate against at G2 - **as a check, not as a source. We compute our own.**

| Metric | Consensus |
|---|---|
| Total revenue | **$14.53M** |
| Units sold | **18,548** (shown as "19K") |
| Average selling price | **$784.73** |
| Distinct customers | **303** |
| Transactions | **366** |
| Brands / models | **5 / 19** |
| Countries | **4** - India, Turkey, Bangladesh, Pakistan |
| Top brand by units | **OnePlus** (Apple leads revenue) |

Two things in that table are suspicious and go straight onto the G2 list. **366 transactions is
exactly the number of days in 2024** (a leap year) - almost certainly a distinct-count of dates
mislabelled as transactions, in which case several entries have the wrong grain. And 18,548 units
across 303 customers is ~61 phones per customer, which is not a retail consumer grain. **Do not
inherit either number. Establish the true grain at G2 before any metric is defined.**

### What the high scorers did

The strongest entries separate on *structure*, not charts. Two built genuine multi-page reports
with a persistent nav - one with four themed tabs (Customer Demography / Geographical / Mobile
Features / Periodic), the other with an eight-page icon-driven "Explore Insights" rail repeated
on every page. Both keep a filter panel pinned in the
same position throughout, so the report reads as one application rather than a pile of pages, and
both reach for a chart form beyond the Power BI default palette when the data earns it: a Sankey
for revenue country→brand, an alluvial for colour preference across age bands, and a calendar
heatmap grid for all twelve months. A third entry is the only one doing anything
that resembles narrative: every chart carries a **question** as its subtitle ("Which brand generated
the highest revenue and quantity?", "Are high transaction country also high Revenue?"), plus the
only genuinely analytical content in the field - an RFM segmentation and a what-if scenario page.
It is also the only visually distinctive poster: a restrained lilac/grey identity with real
whitespace, KPI tiles carrying vs-prior-quarter deltas, and a tidy left nav.

### What the low scorers missed - and where our opening is

The floor is low and the ceiling is not high. Nine of 24 entries are titled some variant of
"Mobile Phone Sales Analysis"; five have no description at all beyond "Skills & Tools Used: Power
BI". The modal entry is a single dark-background page of KPI cards plus a donut, a bar-by-brand,
and a monthly line - two of them are near-identical in structure
despite different palettes. **Not one entry in 24 states a thesis.** Every chart title in the field
names a field ("Revenue by Brand", "Units Sold by City") rather than a finding, the one
question-subtitled entry being the sole exception. Not one has a "so what" panel, a recommendation, an annotated chart, an
onboarding tour, or any accessibility provision whatsoever - and colour is decorative throughout,
with rainbow categorical ramps and red/green used for non-semantic categories in several entries.

Analytically the entire field stops at description: top brand, top city, month-over-month line.
Nobody segments, nobody decomposes mix versus performance, nobody tests whether the aggregate trend
survives a split. That is precisely the §8 list, and it is completely unclaimed territory.

**The most useful finding is a cautionary one.** The best-looking report in the field
reports **Revenue $8.67bn and Quantity 10.36M**, roughly 600× the consensus, alongside an ASP-by-brand
panel reading "$149K" for Apple and a colour-preference table containing values like 836%, -100%,
and 957%. The numbers are broken, almost certainly a fan-out join or a mis-scoped percentage measure,
and it appears nobody caught it. Meanwhile another entry's Executive Summary shows $14.53M revenue against a
"Device Specification Analysis" page showing $4.71M with no stated filter to explain the gap. **A
polished dashboard with wrong numbers is the field's characteristic failure.** `tools/verify_metrics.py`
with zero tolerance is therefore not hygiene this month - it is a genuine differentiator, and it is
worth *saying so on the poster*.

### How we beat this field

Ranked by cost-to-value, given the above:

1. **State a thesis.** Nobody has one. Cheapest Storytelling win on the board.
2. **Finding-first chart titles.** One-line change per chart, and no competitor does it.
3. **A "so what" recommendation panel.** Separates a 3 from a 4 on Insights; field-wide gap.
4. **Non-obvious insight from the §8 list** - segment interaction, mix-vs-performance, concentration.
5. **Accessibility with evidence.** Zero competitors. Scored in rubric B and a 30-pt award.
6. **Verified numbers, stated on the poster.** Directly attacks the field's characteristic failure.
7. **Real cross-filter + drill + tour.** The 14-point line; the field has slicers, not interaction.

---

## Lessons applied from .workbench/docs/LEARNINGS.md

**`.workbench/docs/LEARNINGS.md` is empty - 2025/05 is the first month, so there is nothing to carry forward.**
Stating that rather than inventing three lessons. In its place, the three commitments this month
takes from the benchmark above:

1. **Establish the grain before defining a single metric.** The field's agreed numbers contain at
   least one grain error (366 "transactions" = days in 2024). Inheriting consensus figures is how
   you inherit consensus mistakes.
2. **Verify every rendered number against a recomputation, and say on the poster that we did.** The
   best-looking entry in the field is wrong by ~600× and nobody noticed.
3. **Spend the effort on thesis, "so what", and accessibility - not on more charts.** All three are
   completely unclaimed across 24 entries; additional charts are the field's saturated dimension.
