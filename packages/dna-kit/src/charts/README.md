# charts/

Shared axis and tick label formatting (`labels.ts`).

There are deliberately no chart wrappers here. An ECharts option object encodes a month's visual
identity, and a distinct identity per month is a scored requirement - a shared wrapper would make
every dashboard a sibling. Each month builds its own charts against the rules below, and only the
label formatting they genuinely share lives here.

Every chart a month builds must, by default:

- emit `toggle(field, value)` on click, and reflect `isActive()` in its styling
- provide a tooltip that ADDS information rather than restating the label
- support keyboard traversal: arrow keys move between series points, Enter drills, Esc clears
- be wrapped in `<ChartFigure>` so screen readers get the underlying table
- never encode meaning in colour alone

Titles state the FINDING, not the field. "Partner channel converts 2.3x better in APAC",
not "Sales by Channel and Region". Cheapest storytelling win available.

Observable Plot belongs here too, for 1-2 static annotated editorial panels per month.
Never for anything that must cross-filter.
