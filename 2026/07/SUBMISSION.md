# Submission - 2026/07 Global AI Adoption & Workforce Displacement Index

**Status:** portfolio work. Today is 2026-07-27 and the July 2026 challenge is the newest in the
archive. Not submitted as a live entry - this programme has no DataDNA account, which is
recorded in `.workbench/docs/LEARNINGS.md` as the binding constraint on everything after this month.

## LinkedIn post

```
A policy coalition is about to allocate national reskilling budgets from a dataset of
global AI adoption. Here is what the file actually knows.

One date.

AI adoption jumps 18.23 points at 2022-Q4 and does nothing else. Not before - the
within-era slope is -0.001 points a quarter, p = 0.997. Not after - +0.013, p = 0.980.
The jump lands exactly on a flag the date dimension already carried.

Fit a straight line through it and you get +1.69 points a quarter, R2 0.676, p < 0.001.
Significant. Publishable. Wrong: the step fits 3.61 times better, and the two readings
imply opposite decisions. One says scale the programme. The other says ask why nothing
has moved in two years.

Three more things the file cannot support:

- The displacement risk index correlates with none of the eight attributes that should
  drive it. Automation susceptibility: -0.018. Skill replaceability: +0.014.
- jobs_created = 0.4157 x jobs_displaced + 175, R2 0.807. Zero of 300 records net
  positive. "Where does creation offset displacement" is answered by construction.
- 284 of 292 country x industry x skill segments are observed once, and the other 8 twice.
  There is effectively no panel: no segment has a usable trajectory and no funded programme
  could be evaluated afterwards.

One number needs no inference: $105.07 of reskilling investment per displaced worker.

The dashboard draws both candidate models over the sixteen observed points, with both
residual sums of squares printed, so you can check the 3.61x from the page.

#DataDNA #OnyxData #DataVisualisation #Accessibility
```

## What is in the box

| Artifact | Path |
|---|---|
| Poster, 2560x1440 | `exports/dashboard.png` |
| CVD + greyscale sims | `exports/a11y/` |
| Live dashboard | `app/` - `just dev 2026 07`, `/` and `/poster` |
| Insight ledger | `analysis/insights.md` - 8 entries, claim → query → output → caveat → so-what |
| Assumptions | `assumptions.md` |
| Star schema + 6 decisions | `model/build.py` |
| Semantic layer | `model/model.malloy` |
| Verification | `model/test_metrics.py`, `model/metric_checks.yml`, `app/interact.mjs` |

## The one-paragraph version

The dataset's only real signal is a level shift at 2022-Q4 that lands on a flag the file already
carried. A straight line through it is statistically significant and is what a policy pack would
contain; the step fits 3.61 times better, and the difference between the two readings is a
funding decision. Everything else the coalition asked for is measurably absent: the displacement
risk index correlates with none of its eight candidate drivers, job creation is job displacement
rescaled, and 284 of 292 segments are observed once so no segment has a usable trajectory. Nine
of the ten questions the two briefs ask have no answer in this file. The one figure that needs no
inference is $105.07 of reskilling investment per displaced worker, and the deliverable is four
named columns that would make the question answerable next time.
