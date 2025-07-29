# Brief - 2025/07 · Customer Satisfaction & Loyalty

**Era 2.** Scraped or transcribed from a primary source. Verified 29 Jul 2025.

- **Title:** July 2025 DataDNA - Customer Satisfaction and Loyalty Analytics Challenge
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/july-2025-datadna-customer-satisfaction-and-loyalty-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2025/06/DataDNA-Dataset-Challenge-Customer-Satisfaction-Dataset-July-2025.zip
- **Raw folder:** `DataDNA-Dataset-Challenge-Customer-Satisfaction-Dataset-July-2025/` - downloaded
  2025-07-29, ZIP magic bytes verified, 5 files, checksums in `challenges.yml`
- **Status:** closed 24 Jul 2025. Practice and portfolio.

### Primary sources

| Source | What it gave |
|---|---|
| Challenge page | scenario, mission, tags, timeline, prize pool, AI rubric |
| **`Onyx Data July 2025 - Brief.docx`** (in the ZIP) | **the nine "key questions"** |
| `READ ME BEFORE PARTICIPATING.txt` | entry mechanics |

## Scenario

*Verbatim, identical on the page and in the DOCX.*

> Step into the role of a data analyst at OmniRetail, a U.S. retail chain selling electronics and
> smart home products through both online and physical stores. To improve customer satisfaction and
> retention, the company has collected feedback throughout 2024.
>
> You've been provided with a customer satisfaction dataset combining satisfaction scores,
> purchasing behavior, demographics, support history, and location data.

## Mission

> Your mission is to create an analytical report that identifies the key factors influencing
> customer satisfaction and loyalty across different regions, customer demographics, and support
> experiences.

## Explicit requirements - the nine key questions

**Third month running, the requirements list is inside the ZIP** (DOCX this time), not on the
challenge page. This is now a standing pipeline step, not a lesson.

- [ ] **R1** What are the main factors contributing to high vs. low satisfaction scores?
- [ ] **R2** Are certain customer segments (by age, gender, group) more loyal than others?
- [ ] **R3** Which locations (cities or states) report consistently high or low satisfaction scores?
- [ ] **R4** Does contacting customer support negatively impact satisfaction?
- [ ] **R5** How do factors like "Price" or "Product Variety" influence customer loyalty?
- [ ] **R6** Do repeat purchasers report higher satisfaction compared to one-time buyers?
- [ ] **R7** Are there regional clusters of highly loyal or dissatisfied customers based on location data?
- [ ] **R8** What is the relationship between loyalty level and satisfaction score?
- [ ] **R9** Do specific demographic groups favor certain satisfaction factors (e.g., Packaging vs. Price)?

The DOCX adds: *"Use these questions as a springboard - don't hesitate to explore deeper
relationships."*

**This is the G7 checklist.** Note every question presupposes that a relationship exists. G2
establishes that none of them does.

## The dataset is 120 rows

12 columns, one row per customer, no dates despite "feedback throughout 2024". That is smaller than
any month so far - May was 366, June 5,600 - and it is the single most important fact about this
challenge. See `analysis/profile.md`.

## Submission mechanics

Union of the Step-2 list, the prefilled share text and the README - identical to May and June:

`@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt` · `#dataDNA`

Single image only · resubmissions not permitted · prize pool BCS Membership, 2 Packt eBooks,
Data Analytics Interview Software ($500), 3 months EDNA · ZoomCharts mini-challenge (Power BI only,
not addressable by this stack).

**Scoring:** the page states *"scored across storytelling, design, technical depth, and insights"* -
AI rubric A, as in May and June.

## Timeline

| | Date |
|---|---|
| Opens | 01 Jul 2025 · Deadline | 24 Jul 2025 |
| Judging | 25-29 Jul 2025 · Announced | 31 Jul 2025 |

---

## Benchmark

**10 published entries** (8 Power BI, 2 Tableau), all `data-score="0"` - no AI scores visible for
any month, so this is qualitative.

The field is thin and homogeneous: **six of ten** are titled some variant of "Customer Satisfaction
and Loyalty Analytics"; one is "DataDNA July Challenge". Two entries name the fictional company
(OmniRetail), which is the only sign of anyone framing a scenario.

Crucially, **every entry treats the nine questions as answerable.** Given what G2 establishes -
that satisfaction in this file is a uniform random draw and not one of seven candidate drivers
survives correction - the field is reporting differences between groups of ten to fifteen
customers as findings. That is the same failure as May (ranking on noise), but with a much smaller
n and a much more confident brief.

### Where the opening is

1. **Report that the questions have no answer, and prove it.** Zero of seven axes survive
   Bonferroni; support contact moves satisfaction by 0.013 points on a 10-point scale.
2. **Turn the null into a design recommendation.** With 120 customers the smallest detectable
   difference is 1.55 points. That is the actionable finding: the survey cannot answer its own
   questions, and the fix is sample size, not analysis.
3. Thesis, "so what" panel, accessibility - all still unclaimed across the field.

## Lessons applied from .workbench/docs/LEARNINGS.md

1. **"Read every file in the ZIP at G1."** Applied - the nine questions were in the DOCX again.
   Now promoted from lesson to standing step.
2. **"Treat every ID column as guilty until tested."** Tested: `Customer_ID` **is** unique here,
   120/120 - the first month where it is. Worth recording that the check is not always a hit.
3. **"Test whether a finding survives its own noise, and correct for multiple comparisons."**
   Pre-registered before looking at any cross-tab. Seven axes tested, none survive.
   **Corrected 2025-07-29:** the published report also carries an age correlation on the same
   outcome, so the family is eight and the threshold is α=0.00625, not the α=0.0071 written
   here at G2. A test you publish is a test you ran. See `analysis/insights.md` I-2.
