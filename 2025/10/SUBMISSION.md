# Submission - 2025/10 · Consumer Financial Complaints (CFPB)

## The image

`exports/dashboard.png` - 2560×1440, single image.

## LinkedIn post

> **Two datasets. One register.**
>
> Onyx Data's October DataDNA set is 62,516 consumer complaints and 1,081 companies, and asks
> which companies are worst.
>
> Only one of those two tables is a record of anything.
>
> The complaints are real: complaint IDs advance with the calendar in every one of the 75
> month-to-month steps (ρ=0.99999), weekends collapse to a third of weekday volume, and 63 of
> 76 issues sit under exactly one product.
>
> The companies are a uniform random overlay. Plot **every** association test among the file's
> twelve categorical columns - all 78 of them, nothing selected - as chi-square against its
> degrees of freedom: a statistic equal to its own df is exactly what chance predicts. All 12
> tests involving the company identifier land **on that line**, 0.945 to 1.018× df, and **none
> of them clears Bonferroni**; the strongest reaches only p=0.285. All 45 pairs among the
> substantive consumer columns do clear it, the weakest at p=6.9e-23.
>
> So the file supports supervision **priorities** and answers nothing about supervision
> **targets** - and the two questions it appears to answer best are computed entirely from the
> fabricated half. The shipped "complaints per 1% market share" metric correlates 0.99 with
> 1/market-share; its top ten offenders are the ten smallest firms. Response time is a uniform
> draw from 0 to 30 days.
>
> What the real half does say: five product-issue pairs carry **65.4% of all monetary relief on
> 42.2% of complaints**. Timeliness never dropped below 99.31% through 2020 and fell to
> **89.02%** in 2021 - and 15 of the 16 product, channel and region cuts big enough to test
> fall with it. Mortgage is the one that does not.
>
> Built with SolidJS, DuckDB and a Malloy semantic layer. 67 rendered figures recomputed from
> parquet by an independent DuckDB query and asserted against the DOM. axe-clean across four
> contexts, WCAG AA measured on the shipped stylesheet in both themes.
>
> Things I got wrong and corrected in the repo: I published 93.77% timeliness by counting
> in-progress complaints as failures (it is 96.06%); I called this file "not broken" before
> checking cross-column logic - 2,150 complaints were answered before they were received; and
> an independent audit caught the chart captioning fourteen hand-picked tests as "every
> association test in the file", the word "strict" doing work ρ=0.99999 does not support, and
> a right-censoring rule that was written down and then not applied to the bar it described.
>
> @OnyxData @ZoomCharts @EnterpriseDNA @BCS, The Chartered Institute for IT
> @SmartFramesUI @DataCareerJumpstart
> #dataDNA

## Mechanics

- [x] Single image, 2560×1440 · tags · `#dataDNA`
- [ ] Follow, post, submit *(account actions)*
- **N/A** ZoomCharts mini-challenge - requires Power BI.

## What a reviewer should check first

1. **The diagonal.** Twelve hollow circles sit on a dashed line - every possible company test,
   not a selection - and the consumer pairs spread out above it. The line is what nothing looks
   like. Read the caption before the picture: the two clouds nearly touch (1.15×), the height
   is not effect size, and the verdict is the Bonferroni column of the 78-row data table.
2. **"Where to send examiners."** Five pairs, 65.4% of all relief, with a denominator.
3. **The caveats strip.** The denominator, the censoring, the missing population column, and
   why there is no map.

## Reproducing

```
just fetch 2025 10
python 2025/10/model/build.py
python 2025/10/analysis/integrity.py        # 12 checks
pytest 2025/10/model/test_metrics.py        # 16 assertions
node tools/run_malloy.mjs 2025 10           # 15 views, 2 sources
cd 2025/10/app && pnpm dev
python tools/verify_metrics.py 2025 10      # 36 metrics vs independent DuckDB
python tools/audit_contrast.py 2025 10 && python tools/cvd.py 2025 10
node tools/qa/a11y.mjs && node tools/qa/overflow.mjs && node tools/qa/perf.mjs
python tools/shoot.py 2025 10
```
