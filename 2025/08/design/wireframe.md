# Wireframe - 2025/08 · Fitness Membership Analytics (MyGym)

The poster is the submission. It must read standalone as a static PNG, top-left to bottom-right,
with no ambiguity about reading order. Exactly 2560×1440.

## Poster (16:9)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ MYGYM · MEMBERSHIP AUDIT                                    Onyx Data DataDNA · Aug 2025 │
│                                                                                          │
│ THE CHURN LIST IS THE LOYALTY LIST, INVERTED.                                            │
│ last_visit_date is join_date rescaled. The 982 members this file flags as lapsed are,    │
│ almost to the member, its 982 longest-tenured.                                           │
│ ──────────────────────────────────────────────────────────────────────────────────────── │
│ 1,998 members · 10 California gyms · joins 2022-07-24 → 2025-06-19 · 0 churned            │
├───────────────────────────────────────────────────┬──────────────────────────────────────┤
│ ★ THE 45° LINE                                    │ WHAT A 30-DAY LAPSE RULE SELECTS     │
│                                                   │                                      │
│   days                                            │  flagged as lapsed     982           │
│   since  ┤ ·  ← ghost cloud (shuffled, seeded)    │  of those, in the                    │
│   last   ┤   ╲·  ·                                │  982 longest-tenured   982 (100.0%)  │
│   visit  ┤  ·  ╲                                  │                                      │
│          ┤       ╲   ← the actual data            │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  mean tenure  │
│          ┤         ╲                              │  "lapsed"   790 d                    │
│          ┤           ╲                            │  ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░              │
│          └────────────────── tenure (days)        │  "active"   280 d                    │
│   [ lapse threshold ──●──── 30 d ]  ρ = 0.9999    │                                      │
├───────────────────────────────────────────────────┴──────────────────────────────────────┤
│ WHAT THE FILE CAN ACTUALLY ANSWER                                                        │
│ ┌───────────────────────────┬──────────────────────────┬───────────────────────────────┐ │
│ │ FLOOR-HOURS BY GYM        │ EVERY DOLLAR IS A LOOKUP │ 88 TESTS · 3 SURVIVORS        │ │
│ │                           │                          │                               │ │
│ │ Anaheim     ▓▓▓▓▓▓ 5.60   │ tier ─┐                  │ ●────────────┊  location→dur  │ │
│ │ Los Angeles ▓▓▓▓▓  4.89   │ plan ─┼→ price  R²=1.00  │ ●───────┊       tier→classes  │ │
│ │ ...                       │ disc ─┘                  │ ○┊              47 nulls      │ │
│ │ Oakland     ▓▓▓    4.15   │ 43 prices, 47 combos     │  ↑ Bonferroni α=5.68e-4       │ │
│ │ +35%  η²=.023 perm p=1e-4 │ model factor 1.67× disc  │ MDE 8.2% - the nulls are real │ │
│ └───────────────────────────┴──────────────────────────┴───────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ SO WHAT                                                                                  │
│ 1  Do not build the churn model. Request an uncensored last_visit_date or a visit log.   │
│ 2  Staff to floor-hours, not headcount: Anaheim consumes 35% more than Oakland.          │
│ 3  Price leakage is the plan-factor ladder ($84,954/yr), not the discounts ($50,960).    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Source: Onyx Data DataDNA Aug 2025 · sha256 3a2f7b55... · every figure recomputed from     │
│ parquet via DuckDB and asserted against the DOM · prices are effective MONTHLY rates (A-1)│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Reading order

1. **Thesis** - one sentence, largest type on the page.
2. **The 45° Line** - the proof. A reader who stops here has the whole argument.
3. **The selection panel** - the consequence, in two numbers (982 / 982, i.e. 100.0%).
   *(Drafted as 982 / 981. The overlap is decided by VALUE, not sort position - see
   `analysis/insights.md` I-1. Corrected 2025-08-31; the shipped app was always value-based.)*
4. **Three evidence panels** - what survives, left to right in descending confidence.
5. **So what** - three actions, each traceable to a panel above.
6. **Provenance strip** - checksum, method, unit.

## Interactive app (differences from the poster)

- **Lapse-threshold slider** is live (7-59 days). Every figure in the selection panel recomputes;
  the painted region in the scatter sweeps. This is the one piece of choreographed motion.
- **Crossfilter**: clicking a gym, tier, plan or discount filters every panel. Active filters
  appear as removable chips. Shape encoding survives filtering.
- **Explore drawer** (`CutPanel` from `dna-kit`) - arbitrary cut of the member table.
- **Guided tour** (`TourOverlay` from `dna-kit`) - 5 steps, keyboard-driven, dismissible, remembered.
- **Theme toggle** - light/dark, both audited.
- Poster route at `/poster` renders the static composition above at exactly 2560×1440.

## Responsive

| Width | Layout |
|---|---|
| ≥1280 | as drawn - 2-col hero, 3-col evidence |
| 768-1279 | hero stacks (scatter full width, selection panel below); evidence 2-col then 1 |
| <768 | single column throughout; scatter keeps a 4:3 box; the effect-size strip scrolls inside its own container, never the page |

Every wide element (scatter, effect strip, data tables) lives in an `overflow-x: auto` container
with `min-width: 0` on its grid parent. **The page body never scrolls horizontally** - this is
checked by `tools/qa/overflow.mjs` at 375, 768, 1024 and 1440.
