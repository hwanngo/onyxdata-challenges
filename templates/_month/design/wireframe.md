# Wireframe - <YYYY>/<MM>

The poster is the submission. It must read standalone as a static PNG, top-left to bottom-right,
with no ambiguity about reading order.

```
┌────────────────────────────────────────────────────────────────┐
│ TITLE - the one-sentence thesis of the whole report            │
│ context strip: who · what data · what period · n=              │
├──────────────┬─────────────────────────────────────────────────┤
│ KPI   KPI    │                                                 │
│ KPI   KPI    │           HERO CHART (the thesis, visually)     │
│              │           with direct annotation                │
│ 4-5 max,     │                                                 │
│ each with a  ├──────────────┬──────────────┬───────────────────┤
│ delta and a  │  support 1   │  support 2   │  support 3        │
│ sparkline    │              │              │                   │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│ SO WHAT - 3 numbered recommendations, each tied to a chart     │
├────────────────────────────────────────────────────────────────┤
│ footer: data source · n · assumptions · accessibility note     │
└────────────────────────────────────────────────────────────────┘
```

Replace with this month's actual layout.

## Chart inventory

| Slot | Chart | Title (states the FINDING, not the field) | Cross-filters on | Drill path |
|---|---|---|---|---|
| Hero | | | | |
| Support 1 | | | | |
| Support 2 | | | | |
| Support 3 | | | | |

## Interaction map

- **Cross-filter:** every visual emits and consumes. Chip bar at:
- **Drill path:** → → , breadcrumb at:
- **Tour:** steps
- **URL state:** encoded as

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Filter chip bar | shown | hidden |
| Tour trigger | `?` button | hidden |
| Footnotes | tooltip | printed in footer |
