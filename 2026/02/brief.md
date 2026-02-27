# Brief - 2026/02

- **Title:** Jan-Feb 2026 DataDNA - Pharmacy Sales & Profitability
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/january-february-2026-datadna-pharmacy-sales-profitability-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-02-january-february-2026-datadna-pharmacy-sales-profitability-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/01/DataDNA-Dataset-Challenge-Pharma-Data-20260102.zip
- **sha256:** `2a4e1cf724aca1e10bed5443a667a0a5aa710b59d6ba1162578718838448c6cd`
- **Two-month challenge** (Jan-Feb 2026), filed under the later month per the operating brief.

## Scenario

> "Pharmacy chains operating across multiple countries face ongoing commercial and
> operational challenges..."

The DOCX inside the archive is more specific than the page, and it is the better statement
of the scenario:

> "In this challenge, you will analyze a dataset representing a **European pharmacy chain
> distributor** operating across multiple European countries. The dataset includes daily
> sales transactions by pharmacy and product, with supporting dimensions for time,
> geography, and product hierarchy."

**Persona:** pharmacy leaders - commercial and operations decision-makers at the chain, not
individual store managers. The DOCX names the three things they want to understand: how
sales and profitability vary across countries/regions/pharmacies, how categories and brands
perform by location, and how regional performance rolls up to the whole business.

## Stated objective

> "Your report should address these gaps by uncovering trends, drivers, and outliers that
> help pharmacy leaders improve profitability, optimise operations, and make more informed
> commercial decisions."

## Explicit requirements

Two lists exist and they are **not the same list**. Both are requirements.

### A. Challenge page - "Operational & Analytical Challenges" (10)

The page states the report *should address these gaps*, so this is a de facto spec and a G7
checklist.

- [ ] Fragmented visibility across countries and regions makes it difficult to understand true business performance.
- [ ] Variations in sales and profitability between pharmacies obscure which locations are truly driving value.
- [ ] Seasonal demand fluctuations complicate inventory planning, staffing, and promotional timing.
- [ ] High-volume products with low margins reduce overall profitability and distort performance reporting.
- [ ] Limited insight into the effectiveness of promotions makes it hard to justify discounting strategies.
- [ ] Differences between urban, suburban, and rural pharmacy performance are often poorly understood.
- [ ] Inconsistent product and brand performance across regions complicates assortment and pricing decisions.
- [ ] Lack of clear drill-down from country to pharmacy level limits accountability and local optimisation.
- [ ] Geographic patterns in sales and margin are not always visible, leading to missed regional opportunities.
- [ ] Difficulty linking regional performance to overall results weakens strategic decision-making.

### B. Archive DOCX - "Key Questions" (10)

**Ninth month running that the ZIP carries requirements the challenge page does not.**
This is a pipeline step, not a surprise.

- [ ] How do revenue, units sold, and margin change over time, and are there clear seasonal patterns?
- [ ] Which countries and regions contribute the most to total revenue and margin?
- [ ] How does performance vary when drilling down from country → region → pharmacy?
- [ ] Which pharmacies outperform or underperform compared to others in the same region?
- [ ] How do Urban, Suburban, and Rural pharmacies differ in sales volume and profitability?
- [ ] Which product categories and brands generate the most revenue, and which generate the most margin?
- [ ] Are there products with high volume but low margin, or low volume but high margin?
- [ ] How do promoted sales compare to non-promoted sales in terms of volume and margin?
- [ ] How does regional performance contribute to overall business results?
- [ ] Are there visible geographic patterns in sales or profitability when viewed on a map?

The DOCX adds, and it is an explicit invitation to do what this programme does anyway:

> "These questions are starting points. Participants are encouraged to explore the dataset
> further and **highlight patterns or comparisons that are not immediately obvious**, as long
> as they are supported by the data."

## The file

A real star schema. Only 2025/10 had one before this; every other month was a flat file.

| Table | Rows | Grain / key |
|---|---|---|
| `FactSales` | 62,139 | PK `SalesID`; FKs `DateKey`, `PharmacyID`, `ProductID` |
| `DimDate` | 731 | `DateKey`, 2024-01-01 → 2025-12-31 |
| `DimPharmacy` | 120 | `PharmacyID`; Country → Region → City → PharmacyName |
| `DimProduct` | 220 | `ProductID`; Category → Brand → ProductName |

Also in the archive: a data dictionary sheet (39 rows), a README sheet, a read-me TXT with the
submission mechanics, and two ZoomCharts sponsor PDFs (Power BI only - not applicable to us).

### What the README claims, and what is actually true

Checked at G1 because this programme has been burned by trusting a brief's own factual
claims (2025/06) and by mistaking an identity check for an integrity check (2025/10).

| README claim | Verdict |
|---|---|
| Every stated row count (731 / 120 / 220 / 62,139) | **holds exactly** |
| `MarginEUR = RevenueEUR - CostEUR` rounded to 2dp | **holds - max deviation 0.00, zero violations** |
| "pharmacies ... have no sales before OpenDate" | **holds - 0 rows**, across 11 stores opening in-window |
| "products ... have no sales after DiscontinuedDate" | **holds - 0 rows**, across 35 discontinued products |
| referential integrity, nulls | **0 orphans on all three FKs, 0 nulls in the fact** |

Standing check: `SalesID` **is** unique (62,139/62,139). Scoreboard now **4 of 7**.

### The claim the README does not make

`DimProduct.LaunchDate` is the one date the README says nothing about, and it is the one the
generator never enforced.

- **6,221 fact rows - 10.01% of the file - sell a product before its `LaunchDate`.**
- **€795,899 of revenue (9.22%)** is booked before the product existed.
- **47 of 47** products launching inside the data window are affected. *Zero exceptions.*
- Median **344 days** of trading before launch; max 719. For 22 of the 47, sales begin on the
  very first day of the window.

The two documented rules are the **control**: the generator applied constraints exactly where
it documented them and nowhere else, so this is a real asymmetry rather than data that is
loosely built throughout. That control is what turns this from a complaint into a finding -
the shape 2025/12 established.

Not yet a thesis; it is the strongest G1 lead and G3 will decide whether it survives. It bears
directly on requirement B1 (trends over time) and B6/B7 (category and brand performance),
because "time since launch" and any new-product ramp are computed from a column the fact table
contradicts.

**Also open for G2:** 103 `(DateKey, PharmacyID, ProductID)` triples carry two rows each; only
24 are a promo/non-promo pair, so 79 are same-day, same-store, same-product, same-promo
near-duplicates. Grain is *not* one row per product per store per day, and the README does not
say what it is.

## Submission mechanics (THIS month)

Four tag lists exist and **no two agree** - the page's Step 2, its prefilled share text, its
FAQ, and the archive read-me. Union, per the standing rule:

- @OnyxData
- @ZoomCharts
- @SmartFramesUI  *(read-me writes it "@Smart Frames UI")*
- @DataCareerJumpstart  *(read-me writes it "@Data Career Jumpstart")*
- @packt
- Hashtag: `#dataDNA`
- **Single image only.**
- Submission form: https://datadna.onyxdata.co.uk/challenges/20260102-datadna-pharma-data-challenge
- Resubmissions are **not** permitted.

**ZoomCharts mini-challenge is Power BI-only** (requires ≥2 Drill Down Visuals). Not available
to this entry; the $300 voucher is out of scope. Noted so it is a decision, not an oversight.

## Timeline

| | |
|---|---|
| Challenge begins | 05 January 2026 |
| Deadline for entries | 20 February 2026 |
| Entry review & winner selection | 21 February 2026 |
| Winners announced | 28 February 2026 |

**Closed.** Today is 2026-02-27, a week after the deadline - as with every month in this
programme, this is portfolio work, not a live entry.

**Prizes (for the record):** 2 Packt eBooks, The Data Analytics Interview Software ($500), plus
the ZoomCharts $300 Amazon voucher mini-challenge.

## Benchmark

**Unchanged and structural, now nine months running.** `/portfolio/` serves every entry in one
payload with the challenge filter applied client-side, pinned for a logged-out client to the
*current* challenge, and individual AI scores render only behind a login. There is no DataDNA
account.

Consequences, stated plainly rather than left implied:
- Benchmarking is qualitative only.
- The Definition-of-Done line *"beats the highest scorer on ≥2 dimensions"* **cannot be checked**
  for this month. It is not claimed in `.workbench/2026/02/SCORECARD.md`.

What the field's failure mode reliably is, from seven months of looking: a polished dashboard
with unverified numbers. The May-2025 sweep found the best-looking entry reporting revenue ~600×
too high. Verification discipline remains the differentiator, and on this dataset the
pre-launch defect is precisely the kind of thing a polished entry will render without noticing.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **An identity check is not an integrity check** (2025/10). Every identity the README states
   holds perfectly - and cross-column logic still breaks, in the one place the README makes no
   promise. Applied at G1 rather than discovered at G4; it is already the leading finding.
2. **Ask what a column *is* before asking what it says** (2025/12). `LaunchDate` reads as a
   product fact but does not constrain the fact table; `PharmacyType`, `StoreSizeBand` and
   `PromoFlag` all need the same interrogation before any of the brief's questions are answered
   with them. None of this is visible to profiling.
3. **Flawlessness is the warning, not the reassurance** (2025/11). Zero nulls, zero orphans,
   exact row counts and an identity holding at 0.00 deviation is the configuration that fooled
   me in 2025/10 - and the pre-launch defect is what was hiding behind it. Ask what each summary
   statistic would read if the data came from the dumbest mechanism that fits.

Carried as method rather than listed: an artefact claim needs a control (2025/12), and the
control is already in hand here - `OpenDate` and `DiscontinuedDate` are enforced, `LaunchDate`
is not.
