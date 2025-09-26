# Assumptions - 2025/09 · Credit Risk Analytics (Nova Bank)

Every judgement call a reader could reasonably dispute. Anything here that affects a headline
number also appears as a footnote in the dashboard.

Unusually, this month **ships a Data Dictionary** (sheet 2 of the workbook), so column semantics
are documented rather than inferred. That narrows this file to genuine judgement calls - and
raises the bar on the ones that remain, because I cannot plead ambiguity where the publisher
was explicit.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/09/DataDNA-Dataset-Challenge-Credit-Risk-Analytics-Dataset-September-2025.zip` |
| Retrieved | 2025-09-26, validated by ZIP magic bytes (`PK\x03\x04`), not HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution. |
| Expected rows / actual rows | not stated in the brief / **32,581** |
| sha256 (ZIP) | `d209ebed126c0eae3d858dedfa85e30b54c50a20270f1b72519d5cea2103070b` |
| sha256 (XLSX) | `ce11ff541de20656d898d896fdeb4fe49cd0e8c03f255c04c2e130dc5d41b2cb` |

Per-file checksums for all five archive members are in `challenges.yml`. The raw folder was
re-fetched once during G1 (a first attempt timed out); the XLSX checksum was identical
afterwards, confirming the re-fetch did not alter the immutable raw data.

## Business semantics

| | Term | How I defined it | Why | Alternative reading |
|---|---|---|---|---|
| **A-1** | **`loan_status`** | 1 = default, 0 = non-default, exactly as the dictionary states. | The shipped Data Dictionary is explicit: *"Loan repayment status (0 = non-default, 1 = default)."* | None. This is documented, not inferred. |
| **A-2** | **"the original block" / "the appended block"** | Columns 1-13 vs 14-29, split at `cb_person_cred_hist_length` / `gender`. | The split is **declared before testing** in `integrity.py`, not chosen after seeing which columns performed. It follows the workbook's own column order and the missingness boundary. | The split could be drawn elsewhere. It is a hypothesis about provenance and is labelled as one - see A-3. |
| **A-3** | **Provenance of columns 1-13** | Described as *"matching the widely-circulated public credit-risk dataset"* - never as "this IS the Kaggle dataset". | Row count, default rate and the two null counts all coincide, which is strong. But I cannot verify the upstream file from here, and asserting a specific origin I have not checked would be exactly the kind of unbacked claim this project exists to avoid. | The coincidence could be chance. It is not load-bearing: **every downstream claim rests on the measured column behaviour, not on where the columns came from.** |
| **A-4** | **"Default rate"** | `mean(loan_status)` over the rows in scope, i.e. an **observed** default rate on booked loans. | It is the only rate the file supports. | Not a *probability of default* and not an approval rate. This file contains no rejected applications, so **nothing here can speak to who was declined** - which bounds the fairness question further (see A-6). |
| **A-5** | **Missing `person_emp_length`** | **Kept as its own category, never imputed or dropped.** | The null carries a 1.46× default lift (31.5% vs 21.5%, p=1.5e-12) - it is one of the more informative signals in the file. | Dropping the 895 rows is the common default and would silently discard the riskiest slice of the book. Imputing to the median would erase the signal entirely. |
| **A-6** | **What a "fairness" finding can mean here** | **Differential *outcome* by demographic group, on booked loans only.** | It is what the data can express. | This is **not** a disparate-impact audit. A real one needs the applications that were *declined*, and needs to test differential **treatment** (were comparable applicants priced or graded differently?) as well as differential outcome. The file has no rejected applicants at all. Stated in the UI, not buried here. |
| **A-7** | **`other_debt`** | Treated as **not real**, and excluded from any risk conclusion. | The publisher's own dictionary calls it *"Simulated additional debt held by applicant."* | None available. Anything derived from it - notably `debt_to_income_ratio` - inherits the same status. |
| **A-8** | **`city_latitude` / `city_longitude`** | City centroids, 1:1 with `city` (18 cities). | Verified: 18 cities, 18 coordinate pairs. | Not applicant addresses. No catchment or distance analysis is possible; a map here is a locator, not a density surface. |
| **A-9** | **`loan_intent` vs the brief's wording** | Six intents as they appear in the file. | | The scenario says Nova Bank provides *"personal, medical, education, and business loans."* The file has **no "business"** category - `VENTURE` is the nearest - and carries two the scenario never mentions (`HOMEIMPROVEMENT`, `DEBTCONSOLIDATION`). Recorded in `brief.md`; the UI uses the file's labels, not the brief's. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped.** | 0 of 32,581 | The two columns with nulls keep them as a category (A-5). Dropping incomplete rows is the single most consequential silent choice available in this dataset. |
| Raw folder never written to | - | Standing rule. All transforms output to `data/curated/`. |
| `loan_grade` G (n=64), `person_home_ownership` OTHER (n=107) flagged as thin | 171 | Not excluded - flagged, and shown with intervals rather than as point estimates. |
| `past_delinquencies` ≥ 4 flagged as unusable | 59 | n=54 / 4 / 1 across values 4 / 5 / 6. The top of that scale cannot support a rate estimate and is never ranked. |

> **Log every row you lose and why.** This month the log is empty *by decision*, and the decision
> is itself a finding (A-5).

## Known limitations

- **This file is part real and part generated**, and the two halves behave completely
  differently (`integrity.py` check 4: median effect on `loan_status` is 16× higher in the
  original block). Every finding states which half it comes from.
- **No rejected applications.** The file is booked loans only, so it cannot answer who was
  declined, at what rate, or on what basis - the questions a real fairness review turns on.
- **A null result on demographics is not a clean bill of health.** See A-6. This is the
  month's central caveat and it is on the poster, not in a footnote.
- **`past_delinquencies` ≥ 4 is n=59**, so the visible "rate rises with delinquencies" shape at
  the top of that scale is noise on tiny cells even before the column's independence is
  considered.
- **No AI scores are published** for any DataDNA month except on *published* portfolio entries,
  which requires an account - confirmed by this month's challenge page. Benchmarking is
  qualitative.
- **The ZoomCharts sponsor track is out of scope** - it requires Power BI. Deliberate stack
  choice, not oversight.
- **Not deployed.** `docs/STACK.md` defers it; the deliverable is the poster PNG.
