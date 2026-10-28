# Wireframe - 2026/10 poster (2560 × 1440)

Budgeted row heights (px): masthead 190 · hero 560 · evidence 470 · decision rail 150 · gutters 4×17.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SUNRISE COFFEE · COMMERCIAL REVIEW 2023-24                     ┌────────┬────────┬───────┬────────┬────┐│
│ Same cup, different rent.                                      │REVENUE │NET PROF│MARGIN │REDEEM  │7/24││
│ 60 stores sell alike; what separates them is what they cost.   │£89.69M │£16.88M │18.82% │£1.73M  │hold││
│                                                                └────────┴────────┴───────┴────────┴────┘│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SIXTY CUPS — each column is one store's average month, sorted by rent + staffing                        │
│                                                                                                         │
│  rim ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  ← revenue ≈ level everywhere     │
│      ████████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░   ← espresso = net profit            │
│      ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ← lease blue rises left→right      │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ← bean = COGS                       │
│  0 ──────────────────────────────────────────────────────────────▼ cherry spill (store 32)             │
│      ├──── lower-cost half: 24.16% ───────┤├──── higher-cost half: 13.51% ───┤   R² cost 0.80 · rev 0.12  │
├──────────────────────────┬──────────────────────────┬──────────────────────────┬────────────────────────┤
│ COST MAP, NOT DEMAND MAP │ REVENUE FORGETS,         │ LOYALTY BUYS SHARE,      │ THE WEEK THE ROTA      │
│ region   rev±CI   fixed  │ COST REMEMBERS           │ NOT SPEND                │ IGNORES                │
│ N.Irel   ─●─      ▬▬     │ 2023→2024 revenue        │ adoption→share  r .998   │ Mon ▇▇▇▇▇  — hours     │
│ W.Mids   ─●─      ▬▬▬    │  · ·:·.· r 0.05          │ adoption→revenue r .003  │ ...                    │
│ ...                      │ 2023→2024 profit         │ lift ceiling £1,747      │ Sat ▇▇▇    — hours     │
│ London   ─●─      ▬▬▬▬▬▬ │  ⟋ r 0.68                │ needed       £1,935 ▲    │ weekend −24.4%, hrs =  │
│ r(margin,fixed) −0.98    │                          │                          │ 24.8% surplus hours    │
├──────────────────────────┴──────────────────────────┴──────────────────────────┴────────────────────────┤
│ DECIDE: ① Screen 2025 sites on occupancy cost  ② Review store 32 + London lease base  ③ Hold loyalty —  │
│ holdout test  ④ Cut ~25% weekend/bank-holiday hours │ Source contract 7/24 hold · status label wrong     │
│ on 600 rows · daily sample ≠ P&L   │ Methods · accessibility note · stack                               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Live route (`/`): same four bands in a scrolling page, plus a sticky filter bar under the masthead
(region, location type, cost half, year · active-cut chips · clear all · ? tour · theme), a store drawer
(drill: Region › Store › 24 months) and an audit drawer (24-row source contract, status mismatch).
Mobile (375px): bands stack; Sixty Cups scrolls horizontally inside its panel with a sorted table
alternative directly below it.
