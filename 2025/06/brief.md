# Brief - 2025/06 · Social Media Content Performance

**Era 2.** Scraped or transcribed from a primary source; sources named per section.
Verified 30 Jun 2025.

- **Title:** June 2025 DataDNA - Social Media Content Performance
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/june-2025-datadna-social-media-content-performance/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2025-06-june-2025-datadna-social-media-content-performance/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2025/05/Onyx-Data-DataDNA-Dataset-Challenge-Social-Media-Content-Performance-Dataset-June-2025.zip
  *(scraped from the page anchor; the upload folder is 2025/**05**, the previous month - as warned)*
- **Raw folder:** `Onyx-Data-DataDNA-Dataset-Challenge-Social-Media-Content-Performance-Dataset-June-2025/`
  - downloaded 2025-06-30, ZIP magic bytes verified, 5 files, checksums in `challenges.yml`
- **Status:** challenge closed 24 Jun 2025. Practice and portfolio.

### Primary sources used

| Source | What it gave |
|---|---|
| Challenge page (scraped) | scenario, objective, Step-2 tags, share text, timeline, prize pool, AI rubric |
| **`Onyx Data DataDNA Challenge - June 2025.pdf`** (in the ZIP) | **the nine "Analysis Direction" questions - not on the web page** |
| `READ ME BEFORE PARTICIPATING.txt` (in the ZIP) | entry mechanics, ZoomCharts mini-challenge |

---

## Scenario

*Verbatim, challenge page - identical to the PDF's CONTEXT page.*

> You've been given a 2024 dataset capturing detailed records of post-level performance metrics,
> platform details, content types, and geographic reach.
>
> The dataset consolidates information about various posts published across TikTok, Instagram,
> LinkedIn, and X.com. It includes metadata such as post type (video, carousel, text), content
> category (product promotion, educational, entertainment), publishing times, and associated
> hashtags. It also tracks performance indicators like engagement, views, impressions, clicks,
> click-through rates, and post reach across countries and regions.

## Stated objective

*Verbatim.*

> Your goal is to build a report that reveals what makes content successful on different platforms,
> explains regional trends in engagement, and informs better content and platform strategy decisions.

## ⚠ The brief misdescribes its own dataset - two verified contradictions

Checked directly against the workbook before writing anything downstream.

| The brief says | The data actually contains |
|---|---|
| "published across **TikTok, Instagram, LinkedIn, and X.com**" - four platforms | **Six**: Facebook, Instagram, LinkedIn, TikTok, X.com, **YouTube** |
| "a **2024** dataset" | **2024-01-01 → 2025-05-01** - seventeen months, not twelve |

```
>>> f['Platform'].unique()
['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'X.com', 'YouTube']
>>> f['Post_Date'].min(), f['Post_Date'].max()
(2024-01-01, 2025-05-01)
```

Neither is subtle - both are plainly in the file. Facebook and YouTube are a third of the platforms
and cannot be silently dropped, and a report titled "2024" would misstate a 17-month window.
**Decision: report what the data contains, and footnote the discrepancy.** Recorded in
`assumptions.md`. It also means any comparison against the field must account for entrants who
followed the brief rather than the file.

## Explicit requirements - the nine "Analysis Direction" questions

**Same pattern as May 2025, now confirmed as recurring: the requirements list ships inside the ZIP,
not on the challenge page.** I searched the rendered page for "Analysis Direction", "Which platforms
and post types" and "ideal days and hours" - none present. The list is page 6 of
`Onyx Data DataDNA Challenge - June 2025.pdf`. Verbatim:

- [ ] **R1** Which platforms and post types generate the highest engagement or views?
- [ ] **R2** What content categories (e.g., product promotion, educational) drive the best performance across different regions?
- [ ] **R3** How do performance metrics vary by platform, post format, or hashtag usage?
- [ ] **R4** What are the ideal days and hours to publish content for maximum engagement?
- [ ] **R5** Are there regional differences in engagement and click-through performance?
- [ ] **R6** What hashtags are most effective in increasing impressions or clicks?
- [ ] **R7** Which countries or regions consistently show high video view counts or live stream interest?
- [ ] **R8** Are there correlations between engagement levels and content categories or publishing time?
- [ ] **R9** How do organic vs. promoted content types compare in terms of reach and performance?

**This is the G7 checklist.** R4 and R8 both hinge on publishing time and R1/R3 overlap heavily -
the list is looser than May's nine. As in May, these are descriptive prompts: answering them earns
competence, not distinction.

---

## Submission mechanics (THIS month)

| Source | Tags named |
|---|---|
| Step 2 on the page | @OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart |
| Prefilled share text | @OnyxData **@packt** @SmartFramesUI @DataCareerJumpstart |
| PDF page 3 / README | @OnyxData @ZoomCharts @Enterprise DNA @BCS @Smart Frames UI @Data Career Jumpstart |

**Union to use - 7, identical to May 2025:**
`@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt`

- Hashtag: `#dataDNA` · **single image only** · resubmissions not permitted
- Prize pool: BCS Membership · 2 Packt eBooks · Data Analytics Interview Software ($500) · 3 months EDNA
- **ZoomCharts mini-challenge** ($300 Amazon voucher): Power BI only, ≥2 Drill Down visuals -
  not addressable by this stack. Its criteria are again pure interaction design: UX and
  intuitiveness, navigation and user flow, drill-down and cross-chart filtering, visual clarity.
  The PDF's mini-challenge tag list differs from the README's - another internal contradiction.

## Scoring - confirmed live

The page states: *"scored across storytelling, design, technical depth, and insights"* - **AI rubric
A**, same as May. Build to the union with rubric B per `.workbench/docs/RUBRIC.md`; accessibility remains the
cheapest differentiator.

## Timeline

| | Date |
|---|---|
| Opens | 01 Jun 2025 |
| Webinar | 11 Jun 2025 |
| Deadline | 24 Jun 2025 |
| Judging | 25-29 Jun 2025 *(the page reads "between 25-29 April" - a stale copy-paste on Onyx's part)* |
| Announced | 30 Jun 2025 |

---

## Benchmark

**12 published entries**, filtered on `data-challenge=june-2025-datadna-social-media-content-performance`.
Tooling: 11 Power BI, 1 Tableau. **All carry `data-score="0"`** - as established last month, no AI
scores are publicly visible for any month, so this is a qualitative benchmark.

### The field

Thinner and weaker than May's 24. **Five of twelve share the title "Social Media Content
Performance"**; two are titled with the entrant's own name rather than the subject; four
have no description beyond "Skills & Tools Used: Power BI". One entry pastes
Onyx's nine Analysis Direction questions verbatim as its portfolio description - which at least
confirms the PDF is where entrants found them too.

**The strongest entry is the single Tableau one.** It has genuine navigation - three
named views (Summary / Regional & Content Strategy / Publishing Optimization) in a persistent top
bar - a metric selector, an explicit "you are currently viewing data for May 2024" state indicator,
and a bump chart ranking the six platforms month over month, the only chart in the field that
compares over time rather than totalling bars.

Its platform summary table is also where the field's weakness shows. It leaves **CTR blank for
Instagram, X.com and YouTube** while showing 6.11% / 6.00% / 22.03% for Facebook, LinkedIn and
TikTok - an unexplained gap presented without comment. Either CTR is genuinely absent for half the
platforms (a missingness signal worth a finding of its own) or the measure is broken. Its "Avg.
Engagement" column is also suspiciously flat - 15.18%-15.85% across all six platforms, 15.28% for
the grand total. **That is the May pattern again: a metric that looks like a finding but may be a
uniform generator artifact.** Testing it is the first thing G3 does.

### What the field missed, and where the opening is

Same shape as May, so the same levers apply - plus two new ones:

1. **Nobody flagged that the brief contradicts the data.** Every entry either silently includes six
   platforms while the brief says four, or silently accepts "2024" for a 17-month window. Stating it
   plainly, with evidence, is free credibility.
2. **Nobody addressed the CTR gap.** A blank cell in a summary table is either a finding or a bug;
   naming which is worth more than pretending it isn't there.
3. No thesis. No entry states one.
4. No "so what" panel, no annotated charts, no accessibility provision - zero, as in May.
5. Engagement-rate uniformity untested by anyone.

### How we beat this field

Carrying forward what worked in May, in cost-to-value order:

1. **State a thesis.** Still unclaimed.
2. **Test whether the headline metrics are noise before building on them** - the flat ~15%
   engagement rate is the immediate suspect.
3. **Report the brief-vs-data contradictions**, with the query that proves each.
4. **Treat the CTR missingness as a finding**, not a blank cell.
5. **Accessibility with evidence.** Zero competitors, and the harness is now in `tools/qa/`.
6. **Finding-first chart titles**, a so-what panel, real cross-filter + drill + tour.

---

## Lessons applied from .workbench/docs/LEARNINGS.md

The file now has one entry (2025/05). The three I am applying, and what each has already changed:

1. **"Read every file in the ZIP at G1."** Applied immediately - the nine requirements were in the
   PDF and invisible on the challenge page. Without it I would again have written "no requirements
   list exists". **Now confirmed as a recurring pattern rather than a one-off, and worth promoting
   from a lesson to a pipeline step in `.workbench/docs/PLAYBOOK.md`.**
2. **"Establish the grain before defining any metric, and verify the brief's own claims."** Applied
   before writing this file: platform count and date range are both wrong in the brief. Full grain
   work follows at G2 - 5,600 rows × 24 columns; `Post_ID` is the obvious PK candidate and will be
   tested, not assumed.
3. **"Test whether a finding survives its own noise."** Pre-registered as the first G3 task, aimed at
   `Engagement_Rate` and `Click_Through_Rate`, because the benchmark's own numbers already look
   uniform. May's dataset was uniform-random on its headline volume metric; the prior is high.
