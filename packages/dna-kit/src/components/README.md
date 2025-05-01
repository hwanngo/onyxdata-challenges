# components/

Primitives only. Anything encoding a month's identity (colours, copy, domain logic) stays in that
month's app.

Present:
- `KpiTile` - a single figure with its label, caveat and `data-metric` verification hook
- `InsightCallout` - a stated finding, not a chart caption
- `TourOverlay` - 4-6 step first-run tour, dismissible, re-openable from a `?` button.
  Judges explicitly look for in-report tutorial overlays.
- `Controls` - the shared filter/reset bar
- `CutPanel` - active cuts, one-click clear per cut and clear-all

Still to build - promote from the first month that needs them:
- `EmptyState` - an empty screen is an invitation to act, not an error
- `Footnote` - surfaces `assumptions.md` caveats in the UI
