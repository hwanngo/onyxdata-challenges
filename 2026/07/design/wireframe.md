# Wireframe - 2026/07 Global AI Adoption & Workforce Displacement Index

**2560 × 1440. Nine objects. Row heights budgeted in `.workbench/2026/07/design/direction.md` before any component.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ① THIS FILE KNOWS ONE DATE AND NOTHING ELSE.                                                 │
│   One +18.23pt jump in AI adoption, landing exactly on a flag the date dimension already      │
│   carried, flat for seven quarters before and eight after. Nothing else in it predicts        │
│   anything. The coalition is about to allocate reskilling funding on this.                    │
│   ────────────────────────────────────────────────────────────────────────────────────────   │
│   300 records · 30 countries · 25 industries · 8 skills · 16 quarters · 2021-Q1 - 2024-Q4     │
├──────────────────────┬──────────────────────┬───────────────────────┬────────────────────────┤
│ ② 1 of 10            │  0 of 8              │  0 of 300             │  $105.07               │
│   questions the two  │  attributes predict  │  records where job    │  reskilling investment │
│   briefs ask has a   │  the displacement    │  creation exceeds     │  per displaced worker  │
│   real answer        │  risk index          │  displacement         │                        │
├──────────────────────┴──────────────────────┴───────────────────────┴────────────────────────┤
│ ③ THE STEP  ★ signature                                                                      │
│   Two models over one series. The significant one does not touch the data.                    │
│                                                                                               │
│  50┤                                                                                          │
│    │                                            ●            ╱ ─ ─ ─  the LINE                │
│  40┤        ●   ●  ●  ●        ●     ●   ●   ● ╱─ ─          +1.69pp/qtr                      │
│    │   ┌───────────────────────────────────────────── 38.47%  R² 0.676 · p 0.0001             │
│  30┤   │             ╱ ─ ─ ─                                  residual SS 465.2               │
│    │  ╱─ ─ ─ ─ ─                        the STEP ─────────                                    │
│  20┤●──●──●──●──●──●──● 20.24%                              residual SS 128.9 · 3.61× better  │
│    │                  │                                                                        │
│  10┤                  └ 2022-Q4 · generative_ai_era = True                                    │
│   0└──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬                                          │
│      21Q1         22Q1         23Q1         24Q1                                              │
│   within-era slopes -0.001pp/qtr (p 0.997) · +0.013pp/qtr (p 0.980) - both flat               │
│   The step lands ON the flag. The file did not discover a date; it was built around one.      │
├───────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ ④ TEN QUESTIONS. ONE ANSWER.                  │ ⑤ THE RISK INDEX DOES NOT MEASURE RISK       │
│                                                │                                              │
│  ✓ How has adoption changed?  ONE STEP        │  ρ with the attributes that define exposure: │
│  ✗ Is displacement accelerating?  p 0.980      │  automation_susceptibility      -0.018       │
│  ✗ Developed vs emerging?  p 0.823             │  ai_replaceability_score        +0.014       │
│  ✗ Infrastructure & talent?  |ρ|<0.07          │  ai_augmentation_potential      -0.035       │
│  ✗ Risk by skill category?  p 0.770            │  digital_infrastructure_score   -0.066       │
│  ✗ Does the index track drivers?  0 of 8       │  stem_graduates_per_100k        -0.079       │
│  ✗ Creation offsetting displacement?  0/300    │  internet_penetration_pct       ...          │
│  ✗ Reskilling keeping pace?  ρ 0.107           │  avg_ai_investment_pct_revenue  ...          │
│  ✗ Does data confidence vary?  p 0.311         │  median_reskilling_duration     ...          │
│  ✗ Which segments need funding?  NO DATA       │  ── none reaches |ρ| 0.10 ──                 │
│                                                │  Manual Skilled Trades: highest              │
│                                                │  replaceability (79.6), 4th risk.            │
│                                                │  Cognitive & Analytical: lowest (20.9), 6th. │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ ⑥ JOBS CREATED IS JOBS DISPLACED, RESCALED    │ ⑦ THERE IS NO PANEL                          │
│                                                │                                              │
│   created ●●●                                  │   292 segments                                │
│      ●●●●●●●  ╱ created = 0.4157×displaced+175 │   ████████████████████████ 284 seen once     │
│    ●●●●● ╱                       R² 0.807      │   █ 8 seen twice                             │
│   ●●● ╱        ratio 0.201-0.899, never > 1    │   ─ 0 seen three times                       │
│  ●●╱                                           │                                              │
│  └──────────── displaced                       │   96,000 cells in the cube · 300 filled      │
│   0 of 300 records net positive.               │   = 0.31%                                    │
│   Net across the file: -290,430 jobs.          │   A quarter-over-quarter change is           │
│   Answered by construction, not measurement.   │   computable for 8 of 292 segments.          │
├───────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ ⑧ SO WHAT - FOUR COLUMNS THAT WOULD MAKE THIS ANSWERABLE                                     │
│  1. REPEATED MEASURES. The same country × industry × skill, every quarter. Without it no      │
│     segment has a trajectory and no reskilling programme can be evaluated after funding.      │
│  2. AN INDEPENDENT JOB-CREATION COUNT. Currently 0.4157 × displacement. Measure creation      │
│     where it happens, not as a fraction of loss.                                              │
│  3. A RISK INDEX VALIDATED AGAINST ITS OWN DRIVERS. Publish the ρ with automation             │
│     susceptibility and skill replaceability beside the score. Today both are ≈ 0.             │
│  4. RESKILLING SPEND TIED TO THE DISPLACEMENT IT ANSWERS. Today ρ = 0.107 (p 0.065), and      │
│     the total is $105.07 per displaced worker - which is the one number here that needs no    │
│     inference, and the one worth taking to the coalition.                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑨ 300 records · 2021-Q1-2024-Q4 · the archive brief states the data is synthetic · every      │
│   figure recomputed from parquet before publication · no map: country explains |ρ|<0.07 of    │
│   adoption and tier p=0.823 · no top-N risk ranking: the index correlates -0.018 with         │
│   automation susceptibility · gdp_per_capita_usd is ~500× too large and is excluded from      │
│   every measure · WCAG 2.1 AA, keyboard-operable charts, screen-reader tables                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Reading order: the thesis; four figures that scale it; the signature proving the step; ④ scores
every question the two briefs ask and ⑤ works the central one through; ⑥⑦ are the two structural
defects that make the rest unanswerable; ⑧ is the constructive half - a collection spec, not a
complaint; ⑨ carries provenance and the two omissions with their reasons.

## Chart inventory

| Slot | Chart | Title (states the FINDING) | Cross-filters | Drill |
|---|---|---|---|---|
| **Hero ③** | Fit comparison - 16 points, step path, linear path | "Two models over one series. The significant one does not touch the data." | click a quarter → filters | quarter → its records |
| **④** | Scored question list, 10 rows | "Ten questions. One answer." | click a question → filters to its evidence | - |
| **⑤** | Correlation lollipops vs a ±0.20 band | "The risk index does not measure risk" | click a driver → filters | - |
| **⑥** | Scatter, created vs displaced, with the fitted line and the y = x diagonal | "Jobs created is jobs displaced, rescaled" | click a point | - |
| **⑦** | Unit bar - 292 segments by observation count | "There is no panel" | - | - |
| *(web only)* | Country table, 30 rows, adoption + risk | "Nothing about a country predicts its adoption" | click a country | - |
| *(web only)* | Skill table with replaceability vs observed risk | "The dimension's own score does not rank the risk" | click a skill | - |
| *(web only)* | Defect ledger, 7 rows | "Seven defects, four of them structural" | - | - |

**No map and no top-N risk ranking, deliberately** - both reasons printed in the footer.

## Interaction map

- **Cross-filter:** every visual emits and consumes; chip bar under the thesis with a
  one-click clear and a live record count.
- **The fit toggle (③):** step / line / both. It is the argument, so it is a real radio group
  and the residual SS updates with it.
- **Drill path:** **quarter → its records.** Two levels. There is no third: with 292 segments
  observed once, a segment drill would return a single row every time.
- **Tour:** 5 steps - ① the step, ② why a line is the wrong model here, ③ the risk index,
  ④ jobs created, ⑤ what to collect. `open` passed explicitly.
- **URL state:** `?f=[{field,values}]` plus `&fit=<step|line|both>`.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Signature | fit toggle, hover a quarter for its mean, n and both fitted values | both fits drawn, residual SS printed |
| Filter chip bar | shown, with the record count | hidden |
| Tour trigger | `?` button | hidden |
| Country table, skill table, defect ledger | shown | omitted (panel budget) |
| Footnotes | tooltip | printed in footer ⑨ |
