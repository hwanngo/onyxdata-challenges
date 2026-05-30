# Wireframe - 2026/05 Music Streaming Platform Performance

The poster is the submission. It must read standalone as a static PNG, top-left to bottom-right,
with no ambiguity about reading order.

**2560 × 1440. Eleven objects, per the panel budget in `.workbench/2026/05/design/direction.md`. Nothing else.**

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ①  NINE OF THE TOP TEN ARTISTS ARE THERE BECAUSE OF 482 ACCOUNTS - AND THEY PAY FULL PRICE.    │
│    Every headline number here is set by a counting rule, not by the music: who counts as a      │
│    listener, where a play becomes payable, and whether the back office counts as growth.        │
│    ─────────────────────────────────────────────────────────────────────────────────────────   │
│    961 listeners · 224,078 plays · 774 tracks · 10 markets · 2021-01-01 - 2024-12-31            │
├──────────────────────┬──────────────────────┬───────────────────────┬──────────────────────────┤
│ ②  1 of 10           │  50.2% / 70.2%       │  $161.52 vs $179.17   │  46.9%                   │
│    top-ten artists   │  of users make       │  lifetime value,      │  of plays sit in the     │
│    survive           │  70.2% of the plays  │  p = 0.189            │  30-44s payout band      │
├──────────────────────┴──────────────────────┴───────────────────────┴──────────────────────────┤
│ ③  THE CROSSING  ★ signature                                                                   │
│    Remove the repeat-concentrated accounts and nine of the top ten artists leave with them.     │
│                                                                                                 │
│    rank by ALL plays                                            rank by BROAD-LISTENING plays   │
│     1 ┤ Mariah Carey ●╲                                        ╱● Shaggy                  ┤ 1   │
│     2 ┤ Emmylou Harris ●╲╲                                    ╱╱                          ┤ 2   │
│     3 ┤ James Brown ●╲  ╲ ╲──────╲___                  ___╱──╱╱                           ┤ 3   │
│    10 ┤ Shaggy ●──────╲──╲─────────────╲────────╱─────╱                                   ┤ 10  │
│    42 ┤                ╲  ●─────────────╲──────╱───────────────● Emmylou Harris           ┤ 42  │
│   264 ┤                 ●───────────────────────────────────────────────● Mariah Carey    ┤ 264 │
│       └───────────────────────────────────────────────────────────────────────────────┘        │
│    solid = falls (inflated)   dashed = rises (was hidden)   448 artists drawn, 14 labelled      │
│    Overlap 1 of 10 · Spearman rho = 0.665 · right column = 66,870 plays, 90% rank brackets shown│
├─────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ ④ IT IS NOT A CRIME, IT IS A SHAPE      │ ⑤ NEITHER A FARM NOR A LOSS                          │
│                                          │                                                      │
│   distinct tracks per 30 plays           │   Mariah Carey's 3,241 flagged plays:                │
│   ┌────────────────────────────┐         │   ████████████████████████░░░  87.5% = ONE account   │
│   │ repeat-conc.  ████ 9.5     │         │   48 flagged listeners, 2,835 plays from the top one │
│   │ broad         █████████ 22.5│        │                                                      │
│   └────────────────────────────┘         │   lifetime value                                     │
│   Cliff's d = -0.974, rarefied at a      │   repeat-conc.  $161.52  ████████████████            │
│   FIXED 30 plays so session count        │   broad         $179.17  ██████████████████          │
│   cannot drive it. Herfindahl 0.40 vs    │   Mann-Whitney p = 0.189 - not distinguishable       │
│   0.08. Read this before ⑤.              │   You cannot ban them. They pay.                     │
├──────────────────────────┬───────────────┴──────────────┬───────────────────────────────────────┤
│ ⑥ THE 30-SECOND CLIFF    │ ⑦ THE COLUMN CALLED REVENUE  │ ⑧ A THIRD OF GROWTH IS THE BACK OFFICE│
│                          │    IS 0.5% OF REVENUE        │                                       │
│  plays                   │                              │  net MRR, 48 months                   │
│  │▁▁▁█████▁▁▁▁▁▁▁▁▄▆█▆▄▁ │  subscription   $167,647.19  │  ┌──────────────────────────────┐     │
│  └──┬──────────────────  │  ████████████████████████    │  │ customer-driven  $5,495.26   │     │
│    30s  the payout line  │                              │  │ ████████████████████ 67.5%   │     │
│                          │  session column      $852.14 │  │ reconciliation   $2,648.24   │     │
│  32s → -15.1% payable    │  ▏ (a hairline, at scale)    │  │ ████████ 32.5%               │     │
│  35s → -38.0%            │                              │  └──────────────────────────────┘     │
│  46.9% of plays sit in   │  ...and it adds Free-tier ad   │  and the share grows every year:      │
│  the 30-44s band.        │  INCOME to paid-tier royalty │  13.2% (2021) → 47.2% (2024)          │
│  The bill is a setting.  │  COST. Never sum it.         │  'reconciliation' appears on upgrades │
│                          │                              │  and downgrades ONLY - never signup.  │
├──────────────────────────┴──────────────────────────────┴───────────────────────────────────────┤
│ ⑨ WHAT MOVES LISTENING, AND WHAT EVERYONE SLICES BY INSTEAD                                    │
│   Hour of day      ████████████ 0.0445 │ REAL      Device type  ▌0.0032 │ below Cohen's floor    │
│   Subscription tier ████ 0.0159        │ REAL      Age band     ▌0.0016 │ 0.01 = "small"         │
│   Genre            ███ 0.0126          │ REAL      Country      ▏0.0009 │                        │
│   Fri-Sun = 52.8% of plays on 43% of the days · growth +10.21%/mo, R² 0.809   Year   ▏0.0003     │
│   is_algorithmic_recommendation: Cliff's d = +0.0026 (p = 0.29)  ── nothing   Gender ▏0.0003     │
│   Month-of-year season, after detrending: omega² = -0.098 (p = 0.93) ── nothing                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑩ SO WHAT - THREE THINGS TO CHANGE                                                             │
│   1. Cap plays per user per artist before ranking. Licensing and editorial currently run off a  │
│      table where 9 of the top 10 are one cohort's repeats.                                      │
│   2. Don't ban - re-weight. Keep the $161.52. Cap the influence on ranking, recommendation and  │
│      royalty attribution: 70.1% of the royalty bill ($416.69 of $594.67) sits on this cohort.   │
│   3. Report two numbers where you now report one. Split ad income from royalty cost, and state  │
│      MRR growth net of reconciliation: $5,495.26 customer-driven, not $8,143.50.                │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑪ 224,078 plays · 2021-01-01-2024-12-31 · every figure recomputed from parquet before          │
│   publication, 33 assertions against the raw CSVs · the archive's data dictionary is TRUE in    │
│   68 of 72 tested claims; the four failures are listed in the report · the cohort here is named │
│   for its measured behaviour; the source column is `is_fraud_cluster` and this page treats it   │
│   as an observed listening pattern, not an adjudication · no map: country explains 0.09% of     │
│   listening depth · WCAG 2.1 AA, keyboard-operable charts, screen-reader tables                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Reading order: the thesis states the finding; four KPI figures give its scale; the signature proves
it perceptually; **④ earns the cohort's name before ⑤ draws any conclusion from it**; ⑥⑦⑧ are the
same failure three more times, in money; ⑨ separates what is real from what is sliced; ⑩ is the
constructive half; ⑪ carries provenance and the naming disclosure.

## Chart inventory

| Slot | Chart | Title (states the FINDING) | Cross-filters on | Drill |
|---|---|---|---|---|
| **Hero ③** | Rank-slope (bump), 448 lines, 14 labelled | "Remove the repeat-concentrated accounts and nine of the top ten artists leave with them" | click an artist → filters every panel | artist → genre → its own play history |
| **④** | Paired bar, rarefied | "It is not a crime, it is a shape" | click a cohort → filters | - |
| **⑤** | Stacked single-bar + paired LTV bar | "Neither a farm nor a loss" | - | artist → its flagged listeners |
| **⑥** | Step histogram, 5s bins, draggable threshold | "Move the payout line two seconds and 15.1% of payable plays vanish" | drag threshold → recomputes ⑦'s royalty | - |
| **⑦** | Two bars at true scale | "The column called revenue is 0.5% of revenue" | - | tier → ad vs royalty split |
| **⑧** | Stacked bar + 4-year trend | "A third of growth is the back office" | click a year → filters | year → month → event type |
| **⑨** | Lollipops vs Cohen's 0.01 floor | "What moves listening, and what everyone slices by instead" | click an axis → filters to it | - |
| *(web only)* | Genre × country over-index matrix | "Reggae in South Africa over-indexes 2.28×" | click a cell | genre → country |
| *(web only)* | Pre-churn window table | "The leading indicator is depth, not volume" | - | window → sessions |
| *(web only)* | Defect ledger, 7 rows | "The dictionary is true 68 times out of 72. Here are the four" | - | - |

**No map, deliberately** - country explains η² = 0.0009 of listening depth. The reason is printed
in the footer rather than left as an absence.

## Interaction map

- **Cross-filter:** every visual emits and consumes. Chip bar under the thesis, one-click clear.
- **The basis toggle (③):** `broad-listening only` / `rarefied to 30 plays` / `capped at 50 per
  user per artist`. A real radio group, keyboard-operable. This is the robustness argument.
- **Drill path:** **artist → genre**. Two levels. There is no third: the playlist dimension is
  random (3.649% vs 3.680% expected) and a drill into it would imply a hierarchy that is not there.
- **Tour:** 6 steps - ① the crossing, ② why the cohort is not called fraud, ③ why they can't be
  banned, ④ the 30-second cliff, ⑤ the reconciliation share, ⑥ what to change. `open` passed
  explicitly (2025/11 shipped a tour that never rendered because it was not).
- **URL state:** `?f=[{field,values}]` plus `&basis=<clean|rarefied|capped>`.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Signature | basis toggle, hover an artist to isolate its line | `clean` basis, all 448 drawn, 14 labelled |
| Threshold in ⑥ | draggable, recomputes ⑦ | fixed at 30s with the 32/35s deltas printed |
| Filter chip bar | shown | hidden |
| Tour trigger | `?` button | hidden |
| Over-index matrix, churn table, defect ledger | shown | omitted (panel budget) |
| Footnotes | tooltip | printed in footer ⑪ |
