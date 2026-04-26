# Wireframe - 2026/04 Maritime Logistics & Terminal Efficiency

The poster is the submission. It must read standalone as a static PNG, top-left to
bottom-right, with no ambiguity about reading order.

**2560 × 1440. Ten objects, per the panel budget in `.workbench/2026/04/design/direction.md`. Nothing else.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ①  THERE IS ONE REAL NUMBER IN THIS DATASET.                                                 │
│    Cargo movements grow every year. Because 2021 is the lowest, that ramp looks like the      │
│    Suez disruption - and there was no disruption. Nothing else in the file varies at all.     │
│    ──────────────────────────────────────────────────────────────────────────────────────    │
│    Global Maritime Solutions · 15,000 movements · 50 terminals · 1,000 vessels · 2021-2024    │
├──────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ ②                │ ③  THE FLAT LINE  ★ signature                                             │
│  η² 0.0029       │                                                                            │
│  the largest     │  movements   ╭─────────────────────────────────────────────────────╮      │
│  effect of any   │  per bin  750├─████████████████████████████████████████████████████├──    │
│  factor on move  │              ╰─────────────────────────────────────────────────────╯      │
│  duration        │              0    200    400    600    800   1000   move_duration (hours)  │
│                  │              ↑ eight overlaid cuts - hub, vessel category, day, year       │
│  p 0.504         │                                                                            │
│  Suez week vs    │  Twenty bins. Fifteen thousand movements. Every duration equally likely.   │
│  every other day │  KS vs Uniform(0,1000) p = 0.6129. The line at 750 is 15,000/20, not a     │
│                  │  fitted curve. Y-axis 600-900 so the flatness is visible without being     │
│  1,001           │  exaggerated.                                                              │
│  distinct values │                                                                            │
│  of "movement_id"│                                                                            │
│  across 15,000   │                                                                            │
│  rows            │                                                                            │
├──────────────────┴──────────────────────┬──────────────────────────┬─────────────────────────┤
│ ④ THE ONE REAL SIGNAL - AND WHY IT      │ ⑤ THE EMPTY WINDOW       │ ⑥ EVERY AXIS THE BRIEF  │
│    IS THE DANGEROUS ONE                 │                          │    NAMES, AND WHAT IT   │
│                                         │  movements/day, Mar 2021 │    EXPLAINS             │
│  4,200 ┤                          ╭──   │   16 ┤ ▏▏ ▏▏▏ ▏ ▏▏ ▏▏    │                         │
│        │                    ╭─────╯     │   12 ┤▏▏▏▏▏█▏▏█▏▏▏▏▏█▏   │ Terminal        0.0029  │
│  3,000 ┤────────╮     ╭─────╯           │    8 ┤▏▏▏▏▏█▏▏█▏▏▏▏▏█▏   │ Vessel build yr 0.0079  │
│        │  2021  ╰─────╯                 │    4 ┤▏▏▏▏▏█▏▏█▏▏▏▏▏█▏   │ Month           0.0011  │
│        └────────────────────────────    │      └─────────────────   │ Vessel category 0.0005  │
│         2021   2022   2023   2024       │       1    15    23-29 ▲  │ Day / Night     0.0002  │
│                                         │            the blockage   │ Regional hub    0.0001  │
│  +25.0%  +8.0%  +3.7%   ρ=+0.83         │                          │ Fiscal year     0.0001  │
│  χ²/df 1.1731 vs a simulated max of     │  MW p = 0.504 on duration │                         │
│  1.1525 - the only thing here that      │  Nothing happened in the  │ Cohen's floor for a     │
│  exceeds chance. And ONLY in the count: │  week the whole brief is  │ "small" effect is 0.01. │
│  duration by year p = 0.712.            │  built around.            │ Nothing reaches a fifth.│
├─────────────────────────────────────────┴──────────────────────────┴─────────────────────────┤
│ ⑦ WHAT WOULD HAVE TO BE COLLECTED                                                            │
│   The VP asked for a 15% reduction in movement times. This data cannot locate a single hour   │
│   of it. Seven columns would make the same three questions answerable:                        │
│   1. terminal_capacity - absent; the brief itself concedes it "should be added"               │
│   2. queue / wait time - there is one duration and no stages to decompose it into             │
│   3. arrival + departure timestamps rather than a scalar hour count                           │
│   4. a unique movement key - movement_id_raw has 1,001 values for 15,000 rows                 │
│   5. shift on the MOVEMENT, not on the date (a whole day is currently "Day" or "Night")       │
│   6. one vessel key, not two disagreeing on 909 rows                                          │
│   7. a hub label tied to geography - the present one predicts longitude at p = 0.19           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑧ 15,000 movements · 2021-01-01-2024-12-31 · every figure recomputed from parquet before      │
│   publication · the data dictionary shipped in the archive is wrong in eleven places, listed │
│   in the report · no map is drawn: terminal coordinates are uniform over the globe and the    │
│   hub label is not geographic · WCAG 2.1 AA, keyboard-operable charts, screen-reader tables   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Reading order: the thesis states the finding; three KPI figures give the scale of the absence;
the signature proves it perceptually; ④⑤⑥ answer *what is real / what the brief asked for /
what every factor explains*; ⑦ is the constructive half.

## Chart inventory

| Slot | Chart | Title (states the FINDING) | Cross-filters on | Drill |
|---|---|---|---|---|
| **Hero ③** | Histogram, 20 bins, with 8 real cut-overlays | "Twenty bins. Every duration equally likely." | click a legend cut → isolate that overlay | bin → count, expected, deviation in SE |
| **④** | Line, movements by year, 2021 flagged | "The one real signal - and why it is the dangerous one" | click a year → filters report | year → month |
| **⑤** | Daily bars, March 2021, blockage band marked | "The empty window" | click a day → filters | - |
| **⑥** | Ordered η² bars vs Cohen's 0.01 floor | "Every axis the brief names, and what it explains" | click an axis → filters to it | - |
| *(web only)* | Terminal table, movements + duration spread | "Fifty terminals, equal by construction" | click a terminal | hub → terminal |
| *(web only)* | The eight dictionary defects, documented vs actual | "The archive documents its own generator, and is wrong eight times" | - | - |

**No map, deliberately** - the reason is printed in the footer rather than left as an absence.

## Interaction map

- **Cross-filter:** every visual emits and consumes. Chip bar under the thesis, one-click clear.
- **Drill path:** **hub → terminal**. Two levels, not three - the hub label is not geographic
  (KW p=0.19), so a third level would imply a hierarchy that does not exist.
- **Tour:** 5 steps - ① the flat line, ② what it means that it is flat, ③ the one real signal,
  ④ the empty Suez window, ⑤ what to collect. `open` passed explicitly.
- **URL state:** `?f=[{field,values}]` plus `&cut=<axis>` for the isolated overlay.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Signature overlays | isolate one by clicking the legend | all eight drawn at once |
| Filter chip bar | shown | hidden |
| Tour trigger | `?` button | hidden |
| Terminal table + defect table | shown | omitted (panel budget) |
| Footnotes | tooltip | printed in footer ⑧ |
