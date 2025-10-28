# Wireframe - 2025/10 · Consumer Financial Complaints (CFPB)

The poster is the submission. It must read standalone as a static PNG, top-left to
bottom-right, with no ambiguity about reading order.

> **Written 2025-10-28, retroactively.** This file shipped as the unmodified template - the
> same gap `analysis/insights.md` and `.workbench/2025/10/analysis/questions.md` had. It is reconstructed from the
> layout that exists in `app/src/theme.css` (`.poster` grid) and measured against the built
> artifact with `tools/qa/measure.mjs`, so it describes the poster rather than an intention.
> Every row height below is a measurement, not a target.

## The composition - 2560 × 1440, exact

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ MASTHEAD                                                            h = 277px    │
│   "Two datasets. One register."          <- the thesis, four words               │
│   sub: the three proofs the register is real + what the companies are            │
│   context strip: span · resolved · timely · products · issues · states           │
├───────────────────────────────┬─────────────────────┬────────────────────────────┤
│ ★ THE DIAGONAL OF NOTHING     │ WHERE TO SEND       │ WHAT EVERY OTHER ENTRY     │
│   the signature element       │   EXAMINERS         │   WILL PUBLISH             │
│   all 78 association tests    │                     │                            │
│   log-log, χ² vs df           │  KPI     KPI        │  the shipped Q6 metric,    │
│   4 mark types + identity     │  65.4%   42.2%      │  and what it really ranks  │
│   line, direct labels         │                     │                            │
│   caption states the VERDICT  │  5 product-issue    │  3 tier bars, volume flat  │
│   (Bonferroni), not the shape │  pairs, Pareto bars │  and KPI 11× - same rows   │
│                    h = 570px  │          h = 570px  │              h = 570px     │
├───────────────────────────────┴─────────────────────┴────────────────────────────┤
│ WHAT THE REAL HALF SAYS, AND WHAT THE FABRICATED HALF CANNOT          h = 30px   │
├───────────────────────────────┬─────────────────────┬────────────────────────────┤
│ TIMELINESS BROKE IN 2021      │ TWO CLOCKS,         │ SO WHAT                    │
│   7 year bars, zoomed to 85%  │   ONE FABRICATED    │   3 numbered moves, each   │
│   2023 marked * - censored    │  6 channels × 2     │   with its evidence line   │
│   note: 15 of 16 cuts fall    │  bars: fake flat,   │   and a "see chart" link   │
│                               │  real 8%-76%        │                            │
│                               │  + integrity callout│                            │
│                    h = 380px  │          h = 380px  │              h = 380px     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PROVENANCE - source · method · units & caveats                        h = 75px   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Grid: `1.42fr 1fr 1fr` columns; rows `auto 1.5fr auto 1fr auto`, 14/20px gaps, 30/44/22px pad.

## Reading order, and why

1. **Thesis first, picture second.** The masthead is the argument in two sentences. This month's
   finding is a *negative* about half the file, and a negative needs a claim before it needs a
   chart - a reader who meets the χ² scatter cold has no reason to care about a line.
2. **The signature element is the widest cell in the top row**, at 1.42fr, because it is the
   only element that has to survive being looked at for ten seconds.
3. **The payoff sits immediately to its right.** "You cannot rank companies" is useless without
   "here is what you *can* do", so `WHERE TO SEND EXAMINERS` is adjacent, not below the fold.
4. **The refutation is third**, deliberately: the shipped KPI is what every other entry will
   lead with, so it is shown and dismantled rather than ignored.
5. **The bottom row is evidence, not headline** - smaller, denser, and every panel there is
   answering a specific brief question (Q5, Q8).
6. **`SO WHAT` occupies a full panel slot**, not a footer strip. Three recommendations, each
   carrying its own evidence sentence and a link to the chart that supports it.

## What the poster must survive

| Test | Where |
|---|---|
| Fits 2560×1440 with nothing clipped | `tools/qa/measure.mjs` → `exports/qa/measure.txt` |
| No figure clipped inside its own panel | per-figure clip check; the two-clock rows failed this first, and the grid ratio moved 1.55fr → 1.5fr rather than the second clock being dropped |
| Greyscale + protan / deutan / tritan | `tools/cvd.py` → `exports/a11y/` - four mark shapes, no colour-only encoding |
| axe-core on the `/poster` route | `tools/qa/a11y.mjs`, 0 violations |
| Every number recomputed | `tools/verify_metrics.py`, 67/67 |

## Rejected layouts

| Candidate | Why dropped |
|---|---|
| A map of the 51 states | **There is no denominator in the file.** Ranking states by volume ranks population (top 4 = CA, FL, TX, NY). A choropleth here would be the single most confidently wrong element on the page. Asserted in `test_metrics.py::test_state_ranking_has_no_denominator`. |
| A monthly timeliness line instead of year bars | Right-censoring from 2023-05 makes the last four months uninterpretable, and a line invites the eye to follow it into the censored region. Bars with an explicit `*` and a hold-out count are honest at a glance. |
| KPI tiles across the masthead | The headline numbers here are *comparisons* (0 of 12 against 45 of 45), not levels. A tile row would have promoted four decorative scalars over the one thing worth reading. |
| A second panel for the intake lag | It belongs on the *same rows* as the fabricated clock or the comparison is lost. Two tracks per channel row, same widths, same scale - one panel, two clocks. |
