# Wireframe - 2026/02 Pharmacy Sales & Profitability

The poster is the submission. It must read standalone as a static PNG, top-left to bottom-right,
with no ambiguity about reading order.

**2560 × 1440. Eleven objects, per the panel budget in `.workbench/2026/02/design/direction.md`. Nothing else.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  ① EVERY SHOP IN THIS CHAIN MAKES 28%.                                                       │
│     Eight countries, 38 regions, 120 shops - and not one of them trades more profitably       │
│     than another. The only lever that moves the number costs €82,709 over 2 years.                  │
│     ─────────────────────────────────────────────────────────────────────────────────────    │
│     European pharmacy distributor · 62,139 sales lines · 220 products · Jan 2024 - Dec 2025   │
├────────────────────┬─────────────────────────────────────────────────────────────────────────┤
│ ②                  │  ③  THE BLISTER PACK  ★ signature                                       │
│  28.04%            │                                                                          │
│  margin rate,      │   HOW PROFITABLY EACH SHOP TRADES     HOW MUCH EACH SHOP SELLS          │
│  whole chain       │   ●●●●●●●●●●●●●●●●●●●●                ◐○●◔●○◕○◔●◕○◐◔○●◕◐○◔              │
│                    │   ●●●●●●●●●●●●●●●●●●●●                ○◕◔●○◐○◕●◔○◐◕○●◔○◕◐●              │
│  0.32pp            │   ●●●●●●●●●●●●●●●●●●●●                ◕◔○◐◕●◔○◐○◕●○◔◐○●◔◕○              │
│  spread across     │   ●●●●●●●●●●●●●●●●●●●●                ○●◕○◔◐●◔○◕◐○◔●◕○◐●○◔              │
│  8 countries       │   ●●●●●●●●●●●●●●●●●●●●                ◔○◐◕○◔○●◕◐●○◕◔○◐◔○●◕              │
│                    │   ●●●●●●●●●●●●●●●●●●●●                ●◕○◔◐○◕◐○●◔◕○◐◔●○◕◔○              │
│  +0.07%            │                                                                          │
│  same-store        │   fixed domain 24-34%                 revenue per trading day            │
│  growth in 2025    │   spread 4.61pp · chance gives 5.73pp  8.0× between shops                │
│                    │                                                                          │
│  €82,709           │   Same 120 shops. Same grid. Two questions.                              │
│  margin spent on   │   One picture is a flat field and the other is not.                      │
│  promotions that   │                                                                          │
│  moved no units    │   ◹ = opened mid-window (11 shops), shown per trading day                │
├────────────────────┴──────────────────┬──────────────────────────┬──────────────────────────  ┤
│ ④ THE GROWTH IS ELEVEN NEW SHOPS,     │ ⑤ DISCOUNTING COSTS 9.1  │ ⑥ ONLY WHAT YOU SELL     │
│    NOT TRADING                        │    POINTS AND BUYS        │    MOVES THE NUMBER      │
│                                       │    NOTHING                │                          │
│   €4.41M ┤        ╭── total +4.43%    │  margin%  units/line      │  Wellness      33.6% ██  │
│          │   ╭────╯                   │   29.0 ▏  7.19    not     │  Personal Care 33.5% ██  │
│   €4.22M ┤───┴──── same-store +0.07%  │   19.9 ▏  7.02    promo   │  OTC           29.4% █   │
│          └──────────────────────       │       ▏           promo   │  Med. Devices  25.0% ▊   │
│           2024          2025           │   -9.08pp   -0.17 units   │  Prescription  21.9% ▋   │
│                                        │   MDE 2.34% · p=0.031     │                          │
│   Mann-Whitney p = 0.72                │   no lift in any of 5     │  vs geography: 0.32pp    │
│   98.5% of growth is new shops         │   categories              │  ↑ 36× wider             │
├───────────────────────────────────────┴──────────────────────────┴──────────────────────────┤
│ ⑦ SO WHAT                                                                                    │
│   1. Stop the league tables. No shop, region or country trades more profitably than any       │
│      other - the 4.61pp spread across 120 shops is smaller than the 5.73pp chance produces.  │
│   2. Recover the €82,709. Promotions cut 9.08 points of margin and lift units in none of the  │
│      five categories (pooled MDE 2.35%, observed -2.39%). Change the mechanism or stop it.    │
│   3. Plan assortment, not territory. Category moves the rate 11.66pp - 36× the geographic     │
│      spread. It is the only structural lever in the file.                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑧ 62,139 sales lines · Jan 2024-Dec 2025 · every figure recomputed from parquet before        │
│   publication · 10.01% of rows sell a product before its launch date (flagged, not dropped;   │
│   changes no ranking) · seasonality absent, p=0.21 · WCAG 2.1 AA, keyboard-operable charts,   │
│   screen-reader tables on every visual, colourblind-checked                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Reading order is unambiguous: the thesis states the finding, the KPI column gives it in four
numbers, the signature proves it perceptually, the three supports answer *why not growth / what
does it cost / what actually works*, and the so-what says what to do.

## Chart inventory

| Slot | Chart | Title (states the FINDING, not the field) | Cross-filters on | Drill path |
|---|---|---|---|---|
| **Hero ③** | 120-cell matrix small-multiple, two states | "Same 120 shops. Same grid. Two questions." | click a cell → that pharmacy | cell → pharmacy detail in tooltip; Enter filters whole report |
| **Support ④** | Two-line series, total vs same-store | "The growth is eleven new shops, not trading" | click a year → filters period | cohort → country → region |
| **Support ⑤** | Paired bar, margin% and units/line, promo vs not | "Discounting costs 9.1 points and buys nothing" | click promo / not promo | category breakout on click |
| **Support ⑥** | Horizontal bar, margin% by category, sorted by value | "Only what you sell moves the number" | click a category | category → brand (nested label only) |
| *(web only)* | Map of Europe, 8 countries, **inert** fill | "Flat on every cut - the map has nothing to say" | click a country | country → region → pharmacy |
| *(web only)* | `dim_cut` table, spread vs chance for all 7 cuts | "Six cuts inside chance, two outside" | click a cut | - |

The map and the `dim_cut` table are **deliberately web-only**. They answer B10 and underpin I2,
but neither survives the eleven-object poster budget, and that is a decision made at G5 rather
than a casualty at G7.

## Interaction map

- **Cross-filter:** every visual emits and consumes. Chip bar directly under the thesis strip,
  with a one-click clear-all.
- **Drill path:** **country → region → pharmacy**, breadcrumb in the chip bar row. Three levels,
  not four - `city` is 1:1 with `region` and is a display label only, so a city step would be a
  click that cannot change the grouping.
- **Tour:** 5 steps - ① the 28% figure, ② the flat grid, ③ the toggle to the volume grid,
  ④ the €82,709, ⑤ how to cross-filter. Auto-opens once, re-openable from `?`,
  `open` prop passed explicitly *(2025/11 and 2025/12 both shipped a tour that never rendered)*.
- **URL state:** `?f=[{field,values}]` for filters plus `&grid=margin|volume` for the signature
  state, so a specific view - including which side of the thesis you are looking at - is
  shareable.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Signature grid | one state at a time, toggled | **both states side by side** - the poster cannot rely on interaction |
| Filter chip bar | shown | hidden |
| Tour trigger | `?` button | hidden |
| Map + `dim_cut` table | shown | omitted (panel budget) |
| Footnotes | tooltip | printed in footer ⑧ |
