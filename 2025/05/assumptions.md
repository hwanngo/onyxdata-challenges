# Assumptions - 2025/05 · Mobile Phone Sales

Every judgement call a reader could reasonably dispute. Anything here that affects a headline number
must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | https://datadna.onyxdata.co.uk/wp-content/uploads/2025/04/Onyx-Data-DataDNA-Dataset-Challenge-Mobile-Phone-Sales-Dataset-May-2025.zip |
| Retrieved | already on disk before this program began; URL re-verified live 2025-05-27 |
| Onyx's file, or a substitute? | **Onyx's file.** Era 2, ungated. Not a substitute - G1 benchmarking is valid. |
| Expected rows / actual rows | no published expectation; **actual `Fact_Sales` = 366** |
| sha256 | per-file, recorded in `challenges.yml` (5 files) |
| Raw folder modified? | **No.** A macOS `.DS_Store` exists inside it but no dataset file was touched. |

Our headline figures reconcile with the published field's consensus, which is a useful cross-check
on the read path: revenue **$14,525,413** ($14.53M), units **18,548**, mean price **$784.73**.

## Business semantics

Nothing here was answered by the brief, so each is a judgement call. Flagged ones are the ones
a domain owner would most likely overturn.

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| A "row" | one day's sales of one product variant in one city | `Transaction_Date` is the only unique key; 366 rows = 366 days of 2024 | Onyx may have *intended* rows to be individual transactions - but then IDs would be unique and dates would repeat. They aren't and they don't. |
| "Transaction" | **not used as a metric** | `Transaction_ID` has 303 distinct values over 366 rows and repeats up to 4× - it cannot be counted | the field counted it; that produces the phantom "303 customers" |
| "Customer" | **not used as an entity** | there is no customer identifier in the data | `Customer_Age`/`Gender` describe one notional buyer per row, so they are row attributes, not a customer table |
| "Units sold" | sum of `Units_Sold`; reported as volume only, and ranked only where a permutation test supports the ranking | the pooled column is uniform-looking (KS p=0.45) and only OnePlus's brand share clears its permutation null (p=0.002) | the field read the whole 1-to-5 ordering as demand |
| "Revenue" | sum of `Total_Revenue` = `Price` × `Units_Sold`, verified exact on all 366 rows | matches the data dictionary | none |
| "Average selling price" | `sum(revenue)/sum(units)` = **$783.13**, not `mean(Price)` = **$784.73** | unit-weighted is the correct ASP | the field reports $784.73; the two differ by $1.60 and we will label whichever we show |
| "Android vs iOS" | reported as **brand mix**, not as an OS choice | `Operating_System` is 100% determined by `Brand` (Apple↔iOS) | treating it as an independent dimension double-counts the same split |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| No rows dropped | 0 of 366 | no nulls anywhere, no exact duplicates, no impossible values, revenue arithmetic exact |
| `Dim_Products` / `Dim_Locations` not used as sources of truth | - | fully redundant with `Fact_Sales`; 0 orphans both directions; every column already present |
| `.DS_Store` excluded from the checksum manifest | - | Finder artifact, not part of the distributed dataset |

**No cleaning was performed at G2.** Issues are logged in `analysis/profile.md`; transformation
happens at G4.

## Known limitations

These constrain what the dashboard is allowed to claim. Each must surface as a UI footnote.

- **Effective n is 366, not 18,548.** Every rate, share and cross-tab is sized off 366 daily rows.
- **Unit volumes are unrankable below first place.** The pooled `Units_Sold` column is
  indistinguishable from Uniform(1,99) (KS p=0.45 - a marginal test, not a between-brand one).
  Between brands, Kruskal-Wallis gives H=11.79, p=0.0190, and a 20,000-draw permutation null on
  unit share (seed 0) clears exactly one brand: **OnePlus 23.70% against a null of [18.00, 22.39],
  p=0.002** (Bonferroni 0.009). Apple, Xiaomi, Samsung and Google all sit inside theirs. So
  "OnePlus leads volume" is supportable and **every ranking below first place is not** - which is
  the claim most of the published field leads with.
  *Corrected 2025-05-27: this previously read "no brand can be called the best-seller", justified by
  a ±4.36pp binomial CI. A unit share is a ratio of sums over 366 day-rows, not a proportion of 366
  trials, so the binomial CI did not apply. The permutation null replaces it.*
- **Pakistan (10 rows) and Bangladesh (51) are too thin to rank.** Multan and Rawalpindi are n=1.
  City comparison is defensible only within India (169) and Turkey (136).
- **The 82 zero-sales product variants are not an assortment finding** - uniform sampling of 366
  draws from 274 variants predicts 71.9 unsold, so 82 is inside noise. Do not build on it.
- **No seasonality exists** (monthly revenue CV=0.11). R8's month-over-month requirement can be
  answered, but the honest answer is "flat"; a trend narrative would be invented.
- **Only 2 of 11 cross-tabs survive multiple-comparison correction**, and both marginally.
  `Sales_Channel`×`Age_Group` (p=0.0013) and `Brand`×`Gender` (p=0.0045 vs α=0.004545).
- **The data is synthetic** and shows generator fingerprints: uniform unit draws, no seasonality,
  8.7% "Other" gender, near-independent categorical fields. Per the playbook's anti-patterns, no
  recommendation may rest on a pattern that is a generator artifact.

### What *is* solid

Structural facts that come from the product catalogue rather than random draws, and which the
report can rest on: the price ladder ($327 Redmi Note 13 → $1,844 Z Fold 6, median within-model
price CV 3.2%), brand price separation (ANOVA F=34.83, p≈1.3e-24), and the resulting
**rate-vs-volume divergence** - Apple leads revenue ($3.64M) while OnePlus leads units; Xiaomi is
3rd in units and last in revenue. Also structural: Xiaomi and OnePlus are the only two brands with
no model in the Premium $1000+ band, and they are exactly the two whose revenue share falls below
their unit share.

## Open question

The brief's nine questions (R1-R9) are phrased as volume/ranking questions - "which brands and
models are the top sellers", "how do sales numbers vary by storage size, color, or OS". On this
data those rankings are not statistically distinguishable. Two ways to answer:

1. **Answer them as asked, with uncertainty shown** - rankings with visible confidence intervals,
   and a stated caveat that the ordering is not significant. Honest, and still traceable to R1-R9.
2. **Answer the question behind the question** - reframe from "who sells most" to "where does the
   money actually come from", which the price architecture *can* support.

I recommend doing both: satisfy R1-R9 literally so the G7 requirements trace holds, and let the
thesis rest on the price/mix story. Raised for decision at G3.
