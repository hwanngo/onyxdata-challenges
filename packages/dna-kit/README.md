# dna-kit

The compounding asset. Every month promotes reusable code here, so month N+1 starts faster than month N.

**Rule:** if you wrote it twice, it belongs here. If it encodes a month's identity (colours, copy,
domain logic), it does not.

```
src/
├── tokens/       design token contract - each month supplies values, never new token names
├── state/        cross-filter store and drill stack
├── data/         DuckDB-WASM client + query helpers
├── charts/       shared axis and tick label formatting
├── components/   KpiTile, InsightCallout, TourOverlay, Controls, CutPanel
├── stats/        Wilson intervals, effect sizes, permutation helpers
└── a11y/         AccessibleTable
```

Everything above is re-exported from `src/index.ts`; months import from `@onyxdata/dna-kit`.

Chart *rendering* is deliberately not here. ECharts option objects encode a month's identity, so
each month builds its own and the kit only supplies the label formatting they share.

## Why Solid

Cross-filtering is the heaviest scored criterion (14 of 34 judge points) and "response time" is
explicitly named. Fine-grained signals mean a filter change updates only the affected chart - no
reconciliation, no memo tuning.

## Why no component library

Chakra/shadcn/Mantine would make every dashboard a sibling. Distinct visual identity per month is
a scored requirement. Primitives live here; personality lives in each month's tokens.
