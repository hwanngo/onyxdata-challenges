# Submission - 2025/05 · Mobile Phone Sales

> The May 2025 challenge closed on 24 May 2025. This is built for practice and portfolio, so the
> copy below is submission-ready rather than submitted. Tags are this month's verified union.

## LinkedIn post

```
The money is at the top of the ladder.

I analysed Onyx Data's May 2025 DataDNA set - 2024 mobile phone sales across India,
Turkey, Bangladesh and Pakistan - and the headline everyone reaches for turns out to
be the one thing the data can't support.

→ The unit race can only be scored for first place. OnePlus really does lead on 23.70%
  of units (outside a 20,000-draw permutation null, p=0.002) - but positions 2 to 5 are
  indistinguishable from chance, so most of the "top seller" rankings published on this
  dataset are noise.

→ Rank by revenue instead and the table inverts. Samsung earns +6.46 points more
  revenue share than the unit share it occupies; Xiaomi loses 6.50. The brand selling
  the most phones earns the third-most money.

→ Markets differ by which rung they buy, not by what they're charged. A Z Fold 6 costs
  $1,844 in India, $1,840 in Turkey, $1,852 in Bangladesh. Decomposed against the global
  $783.13 ASP, India's premium is +$23.26 of product mix and +$0.57 of pricing; Turkey's
  is +$6.02 mix and -$0.46 pricing. 30.1% of India's units are premium against Turkey's
  21.6%. So the lever is mix migration, not discounts.

One more thing worth saying out loud: this is a 366-row daily summary table, not a
transaction log. Every rate here is sized on n=366, not the 18,548 units. Getting that
wrong is how a dashboard ends up confidently reporting the wrong number.

Built as a custom web app: Polars → Parquet star schema → a Malloy semantic layer
(14 views) → SolidJS with in-browser aggregation. Every figure on the page is aggregated
from the row-level fact at query time - none is hardcoded - and the 50 tagged figures are
additionally re-asserted against an independent DuckDB recomputation. Zero discrepancies,
34 model tests. WCAG 2.1 AA: keyboard-operable charts, screen-reader data tables, and no
meaning carried by colour alone.

@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt
#dataDNA
```

- [x] Image attached - `exports/dashboard.png` (2560×1440)
- [x] Tags = union of the Step-2 list, the prefilled share text, and the DOCX (7 tags - see `brief.md`)
- [x] `#dataDNA`
- [ ] Following Onyx Data on LinkedIn

## Entry form

| Field | Value |
|---|---|
| Tool used | Other - custom web app (SolidJS + Vite + UnoCSS; Polars/DuckDB/Malloy build chain) |
| Power BI report | n/a - the ZoomCharts mini-challenge requires ≥2 Drill Down visuals in a .pbix and is not addressable by this stack |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **The money is at the top of the ladder** |

## Portfolio description

> Onyx Data's May 2025 set is a 2024 mobile phone sales table covering four countries, five brands
> and nineteen models. Almost every published entry reads it as a volume story and crowns a
> best-selling brand. It isn't one.
>
> The first thing I did was establish the grain, and it changes everything: the file is **366 rows,
> one per calendar day of 2024** - a daily summary, not a transaction log. `Transaction_ID` is not
> unique (303 distinct values across 366 rows) despite the data dictionary calling it so, and there
> is no customer identifier at all, which makes every per-customer statistic in the field unfounded.
> Sized correctly, `Units_Sold` is indistinguishable from Uniform(1,99) in its pooled marginal
> (KS p=0.45), and a 20,000-draw permutation null on brand unit share clears only one of the five
> brands: OnePlus at 23.70% (p=0.002). Every ranking below first place is noise, which is most of
> what the field published.
>
> What *is* real is the price architecture. Price is model-determined to within about 3%, brand
> price separation is overwhelming (ANOVA p≈1.3e-24), and that produces the report's three findings:
> the revenue league table inverts the unit table (Samsung +6.46pp, Xiaomi -6.50pp); one model, the
> Z Fold 6, carries 11.6% of all revenue from 5.7% of trading days; and country differences in
> average selling price are almost entirely product mix, because the same phone costs the same in
> every market - decomposed at model level, the India-Turkey ASP gap is 4.8% pricing and 95.2% mix
> plus interaction. That last one inverts the natural conclusion - the cheaper-looking markets aren't
> price-sensitive, they're buying lower down the ladder, so the growth lever is financing and
> flagship availability rather than discounting.
>
> **Technical.** The AI rubric names DAX; there is none here, so the modelling is the evidence.
> Raw XLSX → Polars → a conformed Parquet star schema with real surrogate keys (the workbook's own
> "dimension" sheets are fully redundant with the fact, so I rebuilt rather than inherited them) →
> a **Malloy semantic layer of 14 views**, all compiling and executing against DuckDB, carrying
> share-of-parent, period-over-period, rank-within-group and the report's headline measure,
> `conversion_gap_pp`. **34 pytest assertions** cover grain, fan-out, referential integrity and every
> published claim. Then the part that matters most: **no figure anywhere on the page is hardcoded**
> - captions included, they are all aggregated from the row-level fact at query time - and **the 50
> tagged figures are scraped from the DOM and re-asserted against an independent DuckDB
> recomputation of the parquet**, a different engine and a different code path from the browser's
> aggregation, with zero tolerance. A second gate (`tools/lint_prose_numbers.mjs`) fails the build on
> any statistic typed into prose that nothing recomputes. That pair exists because the characteristic
> failure in this month's published field was a polished dashboard reporting revenue wrong by roughly
> 600×, and because the integrity pass on this month found every critical defect in
> exactly the untagged-prose blind spot.
>
> **Interaction.** Every visual both emits and consumes filters, with a visible chip bar and
> one-click clear; brand → model → city drill with a breadcrumb; filter state encoded in the URL so
> any view is shareable; a five-step re-openable tour. Measured by `tools/qa/perf.mjs` against the
> production build on 2025-05-27: interaction-to-paint max **1ms** against a 200ms budget; cold load
> to first real number **1,481-1,553ms** over six runs, against a 3s budget.
>
> **Accessibility**, as a deliverable rather than a checkbox: axe-core clean in four contexts, all
> 18 colour pairs measured in both light and dark themes, protanopia/deuteranopia/tritanopia and
> greyscale simulations of the poster, every chart keyboard-operable and exposed as a screen-reader
> data table, and no meaning carried by colour alone. Measurement changed the design - the first
> sequential ramp failed at 1.40:1 on its lowest step and had to be recomputed.
>
> Where the brief's nine questions have no significant answer, the report says so, with the test and
> p-value. Five of the nine are answered in the negative. That is the honest reading of the data.

## Consents

- [ ] AI feedback by email
- [ ] Draft portfolio entry
