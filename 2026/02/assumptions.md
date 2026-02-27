# Assumptions - 2026/02 Pharmacy Sales & Profitability

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2026/01/DataDNA-Dataset-Challenge-Pharma-Data-20260102.zip` |
| Retrieved | 2026-02-27, validated by ZIP magic bytes (`PK\x03\x04`), not HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution. |
| Expected rows / actual rows | README states 62,139 sales lines; the file has **62,139**. 731 days, 120 shops, 220 products - all four counts hold exactly. |
| sha256 | `2a4e1cf724aca1e10bed5443a667a0a5aa710b59d6ba1162578718838448c6cd` (the ZIP) |
| Formats in the archive | XLSX (data), DOCX (brief), TXT (read-me), PDF ×2 (sponsor) |

## Business semantics

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| **margin rate** | `sum(MarginEUR) / sum(RevenueEUR)`, i.e. value-weighted | It is the rate the chain actually realises. | Mean of per-shop rates - which would let a 16-row shop weigh as much as a 900-row one, and that is exactly what makes a store league table look meaningful when it is not. |
| **"the spread"** | `max - min` of the margin rate across a cut's groups | Directly comparable to the bootstrap yardstick, which is also a max-min. | An IQR or SD is more robust but does not mean what "no shop trades better than another" means to a reader. |
| **same-store** | Shops with `OpenDate` before 2024-01-01 (109 of 120) | Isolates trading from estate growth. | Including all 120 gives +4.43%, the number a BI tool prints and the one this page argues against. |
| **promotion cost** | `promo revenue × non-promo margin rate - promo margin` | Margin forgone against the rate the same goods earn unpromoted. | A list-price counterfactual would be larger and less defensible: it assumes the volume would exist at full price. |
| **the observation window** | 2024-01-01 to 2025-12-31, **731 days** | Every euro total on the page is a sum over this whole window. | - |

> **Every euro figure on this page is a 24-month total, not an annual one.** The €82,709
> promotion cost is €41,448 (2024) + €41,251 (2025). The page reads "over the 2 years on file"
> and computes the "2" from the date rows. It was published as "a year" until this was checked.

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped** | **0 of 62,139** | `build.py` reports and asserts "0 rows dropped, 0 nulls, 0 orphans". There is nothing to log. |
| `PromoFlag` "Yes"/"No" → boolean `is_promo` | 62,139 | Two values only, verified. A string flag invites a `= 'yes'` typo. |
| Brand modelled **inside** category, not beside it | 220 products | All 32 brands sit in exactly one category, so a brand chart and a category chart are the same chart relabelled. `build.py` raises if a brand ever spans two. |
| `LaunchDate` violations flagged, **not** dropped | 6,221 (10.01%) | They are the finding (I6). Dropping them would remove 10% of revenue and conceal it. |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can reproduce.

## Statistical choices

| Choice | Value | Why it could be disputed |
|---|---|---|
| Bootstrap replications | **1,000** | At 1,000 the yardstick is 5.73pp. A 20-seed sweep spans **5.34-5.70** and 40,000 reps converges to ≈**5.50**. The finding survives every one of them - 4.61pp is below all - but the published 5.73 is the highest of the seeds tried, so it flatters the claim by roughly 4%. |
| Bootstrap seed | `crc32("Pharmacy")` | Label-derived, so it is reproducible and was not chosen after seeing the answer. It is still *one* draw; the sweep above is the honest range. |
| Promotion-lift MDE | pooled **2.35%**, per-category **3.46-7.01%** | The five-category claim rests on the pooled test. Within a category the floor is far higher, so "no lift in any of the five" is one powered pooled result, not five powered ones. Both are computed in `build.py` and both appear on the page. |
| Multiple comparisons | Bonferroni at 5 tests, p < 0.01 | Declared before the p-values were inspected. |

## Known limitations

- **No basket or footfall data.** "Recover the €82,709" assumes zero cross-sell elasticity - a
  promotion that draws a customer who then buys something else is invisible here. This is the
  largest unverifiable assumption behind the page's strongest recommendation.
- **The chance yardstick is bootstrapped from the unfiltered book.** It does not follow a
  cross-filter, and a filtered subset has fewer lines per shop and so a *wider* chance band. The
  page suspends the comparison while a filter is active rather than restating it.
- **`LaunchDate` is unusable**, so no product-lifecycle question can be answered.
- **Seasonality cannot be tested beyond 24 months** - two observations per calendar month.
