# Submission - 2025/08 · Fitness Membership Analytics (MyGym)

## The image

`exports/dashboard.png` - 2560×1440, single image, as required.

## LinkedIn post

> **The churn list is the loyalty list, inverted.**
>
> Onyx Data's August DataDNA set gives you 1,998 gym members and asks, among other things,
> whether you can identify churn risks.
>
> You can. That's the problem.
>
> `last_visit_date` in this file is `join_date` rescaled - they correlate at 0.9999. So a
> 30-day lapse rule flags 982 members, and every one of them sits at or above the 982nd
> highest tenure in the file. No member with under 549 days of membership gets flagged at
> all. Run the win-back campaign and you mail your most loyal members first, in descending
> order of loyalty.
>
> What the file *can* answer is where, not who: session length varies by gym at η²=0.023
> (permutation p=0.0001, against a pre-declared α=5.68e-4), which works out to a 35% spread
> in occupied floor-hours per member per week. That's a staffing answer. Drop the two extreme
> gyms and the ordering survives but η² attenuates 35% to 0.015 at p=0.0015 - below the same
> threshold, so that refit is reported as a sensitivity check, not as a second result.
>
> What it can't answer is price. Every dollar in the dataset reconstructs from three
> categorical labels to within 3.6e-15 - 43 distinct prices from 47 label combinations.
> There is no pricing residual to analyse.
>
> Built with SolidJS, DuckDB and a Malloy semantic layer. Every figure on the poster is
> recomputed from the parquet by an independent DuckDB query and asserted against the
> rendered DOM - 30 metrics, zero tolerance. axe-clean across four contexts, WCAG AA
> measured on the shipped stylesheet in both themes, and the whole thing readable in
> greyscale because nothing is encoded in colour alone.
>
> The thesis you're reading is the second one. My first was wrong, an adversarial review
> killed it, and the correction is in the repo.
>
> @OnyxData @ZoomCharts @Enterprise DNA @BCS, The Chartered Institute for IT
> @Smart Frames UI @Data Career Jumpstart
> #dataDNA

## Mechanics checklist

Union of the Step-2 list, the prefilled LinkedIn text and the FAQ, per the standing rule.

- [x] Single image, 2560×1440
- [x] Tags: @OnyxData, @ZoomCharts, @Enterprise DNA, @BCS (The Chartered Institute for IT),
      @Smart Frames UI, @Data Career Jumpstart
- [x] Hashtag `#dataDNA`
- [ ] Follow Onyx Data on LinkedIn *(account action - cannot be done from here)*
- [ ] Post to LinkedIn *(account action)*
- [ ] Complete the submission form at the challenge URL *(account action)*
- **N/A** ZoomCharts mini-challenge - requires Power BI and ≥2 ZoomCharts Drill Down visuals.
  Out of scope by stack choice, not oversight. The $300 voucher track is forgone deliberately.

## What a reviewer should check first

1. **The 45° line.** If tenure and recency were independent this would be a cloud. It is a
   line. The faint crosses behind it are the same members with the vertical axis shuffled -
   that *is* the cloud, drawn for comparison.
2. **The two numbers beside it.** 982 flagged; 982 of them at or above the 982nd-highest
   tenure. The rule is a tenure cut wearing a recency label.
3. **The provenance strip.** Checksum, method, units, and the fact that no member in this
   file has churned at all.

## Reproducing

```
just fetch 2025 08          # downloads and checksums the ZIP
python 2025/08/model/build.py
python 2025/08/analysis/integrity.py        # 8 standing checks + 2 rejected candidates
pytest 2025/08/model/test_metrics.py        # 44 assertions
node tools/run_malloy.mjs 2025 08           # 13 semantic-layer views
cd 2025/08/app && pnpm dev
python tools/verify_metrics.py 2025 08      # 30 metrics vs an independent DuckDB path
python tools/audit_contrast.py 2025 08
python tools/cvd.py 2025 08
node tools/qa/a11y.mjs && node tools/qa/overflow.mjs && node tools/qa/perf.mjs
node 2025/08/app/interact.mjs               # 14 interaction assertions
python tools/shoot.py 2025 08
```
