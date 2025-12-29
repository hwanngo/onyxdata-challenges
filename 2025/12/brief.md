# Brief - 2025/12

- **Title:** December 2025 DataDNA - Animal Shelter Operations
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/december-2025-datadna-animal-shelter-operations-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2025-12-december-2025-datadna-animal-shelter-operations-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2025/11/DataDNA-Dataset-Challenge-Animal-Shelter-Operations-December-2025.zip
- **sha256:** `ca22fdae65501e0ced0cfc7777c6e45c7624b9f4eefc705f09d3dc8034023d5f`

**This month is real data end to end.** Only 2025/10 drew on a real register before this, and
its company table was still synthetic; this one is the City of
Long Beach Animal Care Services intakes-and-outcomes extract, 52,343 records covering
2013-07-24 → 2025-11-26. That changes the job. There is no generator to reverse-engineer and no
"is this synthetic?" question to answer. The defects here are the ordinary defects of an
operational system that was built to run a shelter rather than to be analysed - which makes
them more consequential, not less, because a real shelter is making decisions on them.

## Scenario

Verbatim from `DataDNA Dataset Challenge - Animal Shelter Operations - December 2025.docx`:

> In this challenge, you will analyze the Animal Shelter Intakes and Outcomes dataset from the
> City of Long Beach Animal Care Services. The dataset includes detailed information about each
> animal entering or leaving the shelter, such as species, intake type, condition, outcome type,
> and length of stay.
>
> Your goal is to create a Power BI report that uncovers operational trends, improves
> understanding of live-release performance, and supports data-driven decisions related to
> shelter capacity, resource planning, and animal welfare outcomes.

## Stated objective

> Your analysis should help the shelter and community partners understand where to focus
> strategic effort, improve placement success, and manage resources more effectively.

The DOCX also lists five things the dataset "allows you to analyze": intake/outcome patterns
over time · what drives successful outcomes · which animals face longer stays or higher risk of
non-live outcomes · how intake sources and conditions influence workload · opportunities for
strategic improvement in operations and placement.

## Explicit requirements

Twelve **"Questions to Guide Your Report"**, verbatim. These become the G7 checklist. The page
adds "these questions are just starting points" and invites unexpected findings, so the list is
a floor rather than a ceiling.

- [ ] Q1 · How do intake and outcome volumes change over time (month, season, day-of-week)?
- [ ] Q2 · How has the number of pet adoptions changed over the years?
- [ ] Q3 · What is the shelter's live-release rate, and how has it trended?
- [ ] Q4 · Which types of pets are adopted most often?
- [ ] Q5 · Which species, age groups, or breed types have higher or lower live-release rates?
- [ ] Q6 · Do certain intake types or conditions lead to different outcomes?
- [ ] Q7 · What is the average length of stay, and how does it vary across animal profiles or outcome types?
- [ ] Q8 · Which animals tend to stay the longest, and what characteristics do they share?
- [ ] Q9 · Are there seasonal or day-of-week intake patterns that inform staffing or resource allocation?
- [ ] Q10 · Which intake sources contribute the largest volumes, and what does this imply for outreach or prevention?
- [ ] Q11 · Are there animals that return to the shelter more than once, and what predicts repeat intakes?
- [ ] Q12 · Which data-driven actions could most effectively improve save rates or reduce length of stay?

**Q3 is the one that matters and the one the file is worst at.** See `analysis/profile.md`.

## Submission mechanics (THIS month)

Union of the Step-2 list, the prefilled share text, and the FAQ:

- Follow **@OnyxData** on LinkedIn.
- One post on your own profile tagging **@OnyxData @ZoomCharts @SmartFramesUI
  @DataCareerJumpstart**, hashtag **`#dataDNA`**.
- **A single image.**
- Complete the submission form on the challenge page.
- Resubmissions are not permitted; AI feedback email within 30 minutes; a draft portfolio entry
  is created and scores become public only once published.

The brief says "create a Power BI report". This project builds a web dashboard, so the tool
differs; the deliverable the rules actually require - a single image and a submission form - is
unchanged. The ZoomCharts Power BI mini-challenge is **not entered**, deliberately.

## Timeline

Ran December 2025, closed. This is a portfolio build against a past month; the constraint is the
rubric, not the clock.

## Benchmark

**Eighth consecutive month with the same finding.** `/portfolio/` serves all entries in one
payload with the challenge filter applied client-side, pinned for a logged-out client to the
current challenge, and individual entries reveal their AI scores only behind an account. I do
not have one. I cannot benchmark this month's field quantitatively and will not claim to.

Qualitatively, the field's characteristic entry for a shelter dataset is predictable and this
month it is also *wrong in a specific way*: a KPI card reading "Live Release Rate 79.3%" taken
straight from the `was_outcome_alive` column, a line chart of that rate running to the end of
the series, a species donut, and a map of intake locations. The first two are the gap. The file
ships two disagreeing live/dead flags, the more optimistic one is the more obvious one, and the
series ends in a month that is 45% unresolved.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **"A statistic can be a property of the construction rather than a finding" (2025/11).** The
   first thing I checked here was not a distribution but a *definition*: whether the file's own
   `was_outcome_alive` flag means what its name says. It does not - it counts 399 animals that
   have not left the shelter yet, and 132 that were disposed of, as live releases.

2. **"Right-censoring is not missingness" (2025/10).** October's series ended in a partial month
   and I published a rising trend into it. Here the last month is **45.1% unresolved** and the
   two months before it are 23.0% and 7.8%. Any live-release trend line must stop before that or
   say loudly that it hasn't.

3. **"Refusing to rank is a result" (2025/11).** Real data has real sampling noise, and this
   file has categories with 3 records (AMPHIBIAN) sitting next to categories with 24,888 (CAT).
   Every rate comparison gets an interval before it gets a rank.
