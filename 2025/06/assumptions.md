# Assumptions - 2025/06 · Social Media Content Performance

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

> **Backfilled 2025-06-30.** This file sat as an unedited template while `brief.md` and
> `analysis/profile.md` both cited it as the record of decisions. Every entry below is transcribed
> from a decision already evidenced elsewhere in the month - the citation is given in each row -
> not reconstructed from memory. Where a decision carries a number, that number was recomputed from
> `data/curated/` before it was written here.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/05/Onyx-Data-DataDNA-Dataset-Challenge-Social-Media-Content-Performance-Dataset-June-2025.zip` - note the upload folder is 2025/**05**, the previous month |
| Retrieved | 2025-06-30. Validated by ZIP magic bytes `PK\x03\x04`, not HTTP status (`docs/DATA_ACCESS.md`) |
| Onyx's file, or a substitute? | **Onyx's own file.** Direct ZIP, Era 2. No substitution, so G1 benchmarking is valid for this month |
| Expected rows / actual rows | The brief states no row count. `Sheet1` = **5,600 rows × 24 columns**; `fct_post` = **5,600 rows**. Nothing dropped |
| sha256 (ZIP) | `30dbee11bed4d76f8e9fe71989a24f234039eae930311ce21dd7de33f6979e29` |
| sha256 (XLSX) | `4a1411362c9483a46cacaf28234fefecad55f44c6f4d99c006ac4db0a9539789` |
| Sheet used | `Sheet1` - the only data sheet |

## Business semantics

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| "performance" | **median `Views`** | `Views` is the only column neither derived from another nor drawn from a band (`insights.md` I-3, I-4). Every ranking in the report is on it | The engagement rate - which is what the field ranks on, and which this report argues is a label rather than an outcome |
| "engagement rate" | a **label**, not a measurement | Drawn from one of four uniform bands keyed to content tier: 100% containment inside round bounds, uniform within band (`insights.md` I-3) | Reading it as behaviour, which makes any "category outperforms" claim circular |
| centre of a distribution | **median**, never mean | Views are right-skewed (skew **1.32**); a mean is pulled by the tail | Mean views, as most published entries use |
| "spread" between groups | **best ÷ worst - 1**, a ratio | Applied identically to platform, region and format so the three are comparable. Stated in `model/metric_checks.yml` | An absolute difference in views, which is unreadable across formats of different scale |
| response for variance decomposition | **`ln(views)`** | Right skew again; η² on raw views overstates the tail's leverage. Where the two differ, both are reported (`analysis/profile.md`) | η² on raw views |
| scope of the report | the **six** platforms in the file, over **seventeen** months | The brief names four platforms and calls it "a 2024 dataset". Both are contradicted by the file, and YouTube - which the brief omits - is the largest at 1,320 posts. **Decision: report what the data contains and footnote the discrepancy** (`brief.md`; `profile.md` DQ5) | Following the brief and dropping Facebook and YouTube, i.e. a third of the platforms. Entrants who did that are not directly comparable to us |
| "region" | the `Region` column, read as a **country** | Eight values, all countries (USA, UK, Germany, Japan, India, Brazil, Canada, Australia); `Latitude`/`Longitude` are one fixed centroid pair per country, not per post | A sub-national geography, which the file does not contain |
| engagement band | **derived from `Engagement_Rate`**; the source label is kept alongside | `Engagement_Level` disagrees with its own thresholds on **89 rows (1.6%)** - all below 0.10 yet labelled Medium (`profile.md` DQ4). Trusting the label silently would hide the defect | Taking `Engagement_Level` as given |
| a rankable hashtag (flat view) | ≥ **100** posts | Below this the pooled means are noise: `#CaseStudy2025` has n=1 and the highest mean rate in the file (26.9%) | No floor - which puts an n=1 hashtag at the top of the ranking |
| a rankable (hashtag × category) cell | ≥ **50** posts (`MIN_CELL_POSTS`) | **A decision, not a property of the data.** With no floor the widest within-category spread is 9.24pp, an artefact of thin cells; at ≥30 it is 0.77pp, at ≥50 0.31pp, at ≥100 0.26pp. 50 keeps every category at 2-3 rankable hashtags (`insights.md` I-3, I-6). **The threshold is printed in the UI beneath the grouped view** | Any other floor. The direction of the finding is identical at 30 and at 100; only the magnitude moves |
| "hashtag effect" | measured **inside** a content category | A hashtag pooled across categories inherits its categories' bands. Measuring the cells directly is the only way the grouped panel means what its caption says (`insights.md` I-6) | The pooled ranking - which is precisely the mirage that panel exists to refute |
| within-category η² | the **pooled** form: between-cell SS summed over categories ÷ within-category total SS = **0.018092** | Equals the semi-partial (R²cells - R²category)/(1 - R²category), and is the form `metric_checks.yml` recomputes against the parquet | The n-weighted mean of the five per-category η², **0.0224**. Both are defensible; the report quotes the pooled one everywhere as of 2025-06-30 (`profile.md`, `insights.md` I-6) |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped at any stage** | 0 of 5,600 | 5,600 in `Sheet1`, 5,600 in `fct_post`. There is no filtering step to audit |
| `Clicks` / `Click_Through_Rate` nulls **kept as null** - never zero-filled, never imputed | 3,740 (66.8%) | The absence is structural and is itself the finding (`insights.md` I-5). A zero would read as "nobody clicked" rather than "not measured". Carried as an explicit `click_tracking_available` flag so no view can average over absent data |
| The two **partial** LinkedIn cells left exactly as found | 60 (Carousel 44, PDF 16 - 29 with a click count, 31 without) | Nothing tested separates them: content type χ² p=0.64, region p=0.59, hour p=0.28, post date p=0.91, and every metric p≥0.06. Imputing would be invention (`insights.md` I-5) |
| `Video_Views` / `Live_Stream_Views` zeros treated as **structural, not missing** | 2,652 and 4,676 zeros | `Video_Views` > 0 on exactly the 2,948 Video posts and nowhere else; `Live_Stream_Views` > 0 on exactly the 924 Live Stream posts. Zero-by-format, so R7 measures format mix rather than regional appetite (`insights.md` I-5) |
| `Post_ID` **not** used as a key; no de-duplication | 5,000 distinct IDs across 5,600 rows - 557 reused | The rows are not duplicates (0 fully identical rows); the ID column is simply not unique. Second month running. Grain is one row per post, asserted in `model/test_metrics.py` |
| `Engagement` **never** decomposed into likes + shares + comments | all 5,600 | `Engagement == Likes + Shares + Comments` holds on **0** rows; the ratio averages 0.58 and ranges 0.15-1.49 (`profile.md` DQ2) |
| Carousel (n=51) and PDF (n=16) shown but **not ranked** | 67 | Too thin to support an ordering. Flagged `is_thin_sample` in `dim_format` and hatched in the UI (`insights.md` I-1) |
| Region centroids used for the map, not per-post coordinates | all 5,600 | `Latitude`/`Longitude` take one fixed value per country, so they carry no within-country information |

> **Log every row you lose and why.** Nothing was lost this month; the table above is the audit.

## Known limitations

- **This is synthetic data and the report says so.** Impressions = `Views` × U(1.1, 1.3),
  engagement = rate × views, and the rate is drawn from a band. Magnitudes are an ordering, not a
  forecast. The provenance strip exists to make that unmissable before any ranking is shown.
- **Five of the brief's nine questions are answered in the negative**, and two (R5, R6) are
  answerable for only 33.2% of posts. On this data that is the correct answer, not a shortfall.
- **R7 is malformed as asked.** "Which regions show high video view counts or live-stream interest"
  cannot separate regional appetite from regional format choice, because both columns are
  zero-by-format.
- **Significance at n=5,600 is cheap.** Platform reaches p=0.048 on views with η²=0.0038; content
  type reaches p=0.0003 with partial η²=0.0049. The report leads with effect size and says "not a
  lever" rather than "no difference" (`insights.md` I-2, I-8).
- **No confidence intervals on the format medians.** Bootstrapping them was scoped out of G3. The
  ordering is stable enough at n=2,948 (Video) and n=996 (Image) that it would not change a
  conclusion, but the omission is real.
- **The challenge closed 24 Jun 2025.** Practice and portfolio build; no entry was submitted, and
  no judge score exists to calibrate the self-scores against.
