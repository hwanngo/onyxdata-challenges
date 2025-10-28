# Assumptions - 2025/10 · Consumer Financial Complaints (CFPB)

Every judgement call a reader could reasonably dispute. Anything affecting a headline number
also appears as a footnote in the dashboard.

This month ships a **Data Dictionary** and four of the five identities it states are exact on
any reading, so most column semantics are documented rather than inferred. That narrows this
file to genuine judgement calls - and raises the bar on the ones that remain.

> **The fifth identity is a judgement call in disguise.** `Timely_Response_Rate` reconciles
> exactly on all 1,081 companies **only over the all-rows denominator**, i.e. counting the
> 1,494 in-progress complaints as untimely. On the resolved denominator this file adopts (A-1)
> it disagrees on 815 of 1,081 companies, max error 0.1040. Both the dashboard's 96.06% and the
> dimension's column are internally correct; they are not the same measure, and the file ships
> the one the analysis rejects. Nothing downstream reads `timely_rate` from `dim_company` for
> that reason. Asserted in `analysis/integrity.py` §2.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/09/DataDNA-Dataset-Challenge-Consumer-Financial-Complaints-Dataset-October-2025.zip` |
| Retrieved | 2025-10-28, validated by ZIP magic bytes (`PK\x03\x04`), not HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution. |
| Expected rows / actual rows | not stated in the brief / **62,516** complaints, **1,081** companies |
| sha256 (ZIP) | `73a60d72294e37387ea747c5eeee3567e81354a389d0d8133f3c7c008bdbc384` |

Per-file checksums for all five archive members are in `challenges.yml`.

## Business semantics

| | Term | How I defined it | Why | Alternative reading |
|---|---|---|---|---|
| **A-1** | **Timeliness denominator** | **Resolved complaints only.** `Timely response?` is null on exactly the 1,494 in-progress complaints and nowhere else, so they are excluded. **96.06%.** | A complaint still in progress has not failed to be timely - it has not yet been judged. | Counting in-progress as untimely gives **93.77%**. I published that in an early draft of `brief.md` and corrected it; the correction is recorded, not hidden. Worth 2.30pp. |
| **A-2** | **Dates** | Excel serial integers converted with epoch **1899-12-30**. | The columns arrive as `Int64` (42856-45166), not dates. Every entrant hits this. | Epoch 1900-01-01 shifts everything two days and is the classic Excel off-by-two. Verified against the stated range 2017-05-01 → 2023-08-28. |
| **A-3** | **The final month is partial** | August 2023 is truncated at the 28th and is **excluded from any trend line**, or drawn explicitly as partial. | Plotting it whole makes a rising series appear to collapse. The month before it is the series maximum (1,749). | Including it silently is the single most likely way to publish a false "complaints are falling" story. |
| **A-4** | **`Timely_Response_Rate`** | A **fraction** (0.815-1.000), not a percentage. | Verified against the fact table; matches exactly as a fraction. | Reading it as a percent understates every company 100-fold. The dictionary does not say which. |
| **A-5** | **"Severity"** (brief Q4) | **Not defined from response outcome without saying so.** Any severity proxy is stated as a proxy. | The file has no severity, harm or dollar-amount column. | Monetary-relief rate is the only candidate and it is an *outcome*, not a measure of harm - a company choosing to pay is not the same as a consumer being hurt more. |
| **A-6** | **"Hotspot"** (brief Q2) | **Raw complaint volume, and labelled as such.** | It is what the file supports. | There is **no population, household or per-capita column**, so a state ranking is a population ranking. The top four (CA, FL, TX, NY) are the four most populous states. Any per-capita claim would require importing outside data, which this project does not do silently. |
| **A-7** | **`Complaints_per_1pct_Share`** | Reported, and reported as **misleading**. | It is arithmetically exact (verified to 5.0e-05). | It tracks 1/market-share at ρ=0.990 and its own numerator at 0.177. The dashboard shows it *because* entrants will use it, next to what it actually ranks. |
| **A-8** | **Company identity** | `Company_ID_1081` is an opaque key; **no company is named.** | The file carries no company names. | This is a real constraint on the brief's "transparency about financial institutions" framing - the dataset is anonymised, so no institution can be named or held to account from it. |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped.** | 0 of 62,516 | Nulls are structural and kept as categories. |
| In-progress complaints kept, excluded from timeliness only | 1,494 | They are real complaints; they simply have no timeliness verdict yet (A-1). |
| `Sub-issue` nulls kept as "not specified" | 10,858 (17.4%) | Dropping them would silently remove a sixth of the book from any issue cut. |
| `Company public response` nulls kept | 2,175 (3.5%) | Same. |
| August 2023 excluded from trend fitting | 717 | Partial month (A-3). Shown, but marked. |

> **Log every row you lose and why.** The log is empty by decision, and the decision matters.

## Known limitations

- **The company side carries no information.** Complaint volume does not differ by size tier
  (Kruskal p=0.557), response time is U(0,30) globally and within every subgroup, timeliness is
  independent of response time (p=0.831), between-company timeliness variation is
  indistinguishable from sampling noise (observed/expected sd = 1.005), and **0 of 12**
  pre-declared trait→outcome tests clear Bonferroni. Nothing here can rank a company.
- **No severity measure** (A-5) and **no denominator for geography** (A-6).
- **No company names** (A-8), so the brief's transparency framing cannot be fully served.
- The final month is partial (A-3).
- **No AI scores are published** except on portfolio entries requiring an account, so
  benchmarking is qualitative. October's page states the calibration: *"A score of 3 represents
  solid, competent work. Scores of 4-5 require exceptional evidence."*
- **Not deployed.** `docs/STACK.md` defers it; the deliverable is the poster PNG.
