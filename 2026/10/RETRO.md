# Retro - 2026/10 Sunrise Coffee Chain Analytics

## Outcome

Shipped G1–G8 with the thesis **Same cup, different rent.** Sixty stores are interchangeable on
revenue at every grain tested. Margin is a ranking of fixed cost. Loyalty moves member share but not
spend. The only demand pattern is the week, and the rota ignores it. The work was done after the
deadline (24 October 2026) as portfolio practice.

## What worked

### The archive brief, not the page, was the spec

The challenge page carried September's food-delivery bullets word for word. The ZIP's
`CHALLENGE_BRIEF.md` described the real coffee-chain task. Checking the page against the archive at
G1 stopped a whole month from answering the wrong brief.

### Per-question axes instead of the requested ones

The brief asks for format comparisons everywhere, but the estate has 58 High-Street stores, 2
Transport-Hub stores and no Retail-Park stores. Rather than chart n = 2 as if it were evidence, each
question got the axis the data could support:

- format answered with n shown and a permutation p
- region with confidence intervals
- location type as a drill
- rent as a continuous variable

The format caveat sits on the poster as one sentence instead of a misleading chart.

### Null results became the story

"No store, region, year or season carries a revenue signal" sounds like an absence. It became the
thesis because it was shown four ways with matched nulls:

- store η² equals the random-label null (59/1439)
- year-on-year store revenue r = 0.05
- region revenue Kruskal–Wallis p = 0.77
- month-of-year p = 0.89

Against that flat revenue, fixed cost's R² of 0.80 is the contrast.

### The signature encodes the thesis

The sixty-cup chart sorts stores by rent plus staffing and stacks each store's P&L inside its revenue.
The level rims and the shrinking profit layer are the finding. The one cup that overflows is decision 2.

## What changed during QA

- **Metric spec first try:** all 656 live metrics reconciled on the first run, because the SQL was
  written directly from `data.ts` definitions (pooled margins, store means, ratio-of-sums week means).
- **Focus restoration bug:** `interact.mjs` found that closing the store drawer lost focus. Opening
  the drawer changed `view()`. The `years` memo then returned a fresh `[]`, which rebuilt every cup,
  so the opener no longer existed. Fixed with a content-equality memo, plus a fallback lookup by
  accessible name.
- **Light-theme contrast:** the shared contrast auditor only parses the last token block (dark). A hand
  check found light `--revenue` at 2.5:1. It was darkened to 3.0:1, and the `--cogs` fill was declared
  decorative behind a 5.2:1 outline rather than darkened. Darkening it would have dropped its contrast
  against the blue layer above it to about 2:1.
- **Poster clipping:** `measure.mjs` caught one evidence panel cutting 2px of its footnote. The grid
  rows were rebalanced and the region rows tightened.
- **Mobile hero:** the hero stats squeezed the title into a one-word column at 390px. The hero header
  now stacks below 1100px.

## What I'd do differently

- Write `interact.mjs` alongside the first interactive component, not at G7. The focus bug existed
  from G6.
- Fix the contrast auditor so it audits every theme block, rather than hand-checking each month.

## Numbers

11 integrity tests and 22 model tests (Python), 14 vitest, 22/22 Malloy views, 656 live and 649
poster metrics reconciled, 8 filter/drill states reconciled, 29/29 interactions, axe zero on four
surfaces plus the tour, 1,491ms cold load, exact 2560×1440 fit.
