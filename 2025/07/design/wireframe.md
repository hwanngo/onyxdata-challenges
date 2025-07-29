# Wireframe - 2025/07 · Customer Satisfaction & Loyalty

Canvas **2560 × 1440**. `tools/qa/measure.mjs` asserts it fits exactly.

## Poster - 16:9

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ THIS SURVEY CANNOT ANSWER THE QUESTIONS IT WAS DESIGNED TO ASK                          │
│ OmniRetail asked nine questions about what drives satisfaction. With 120 customers the   │
│ smallest difference this study could detect is 1.55 points on a 10-point scale - and     │
│ every difference it found is smaller than that.                                          │
│ Onyx Data DataDNA · July 2025 · 120 customers · 10 cities · no dates · n = 120           │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1 · THE UNCERTAINTY LADDER          [1]  │ 2 · THE HEADLINE QUESTION              [2]  │
│ every group's mean, with its 95% CI       │ "Does contacting support hurt satisfaction?"│
│ ▨▨▨ = what this study could not detect    │                                             │
│                                           │        contacted  ────●────   5.357  n=56   │
│  1    3    5    7    9                    │    not contacted  ────●────   5.344  n=64   │
│  ├────┼────┼────┼────┤                    │                                             │
│  Support: Yes  ▨▨▨▨▨●▨▨▨▨▨   n=56         │        difference   +0.013 points           │
│  Support: No   ▨▨▨▨▨●▨▨▨▨▨   n=64         │        Cohen's d    +0.004                  │
│  Loyalty: Low  ▨▨▨▨▨▨●▨▨▨▨   n=45  ⚑      │        p            0.981                   │
│  Loyalty: High ▨▨▨▨▨●▨▨▨▨▨   n=37  ⚑      │                                             │
│  Loyalty: Med  ▨▨▨▨●▨▨▨▨▨▨   n=38  ⚑      │ ↑ not "small". Indistinguishable from zero. │
│  Repeat: Yes   ▨▨▨▨▨●▨▨▨▨▨   n=69         ├─────────────────────────────────────────────┤
│  Repeat: No    ▨▨▨▨▨●▨▨▨▨▨   n=51  ⚑      │ 3 · WHAT IT WOULD TAKE                 [3]  │
│  Female        ▨▨▨▨▨●▨▨▨▨▨   n=66         │  to detect    need/group   have             │
│  Male          ▨▨▨▨▨●▨▨▨▨▨   n=54  ⚑      │   0.5 points        575     ~60             │
│  Phoenix AZ    ▨▨▨▨●▨▨▨▨▨▨   n=19  ⚑      │   1.0 points        144     ~60             │
│  ... 10 cities, every one flagged         │   1.5 points         64     ~60             │
│                                           │   2.0 points         36     ~60             │
│ ↑ every interval overlaps every other.    │                                             │
│   ⚑ = too few customers to detect a       │  ↑ a support experience costing a FULL      │
│     1.5-point difference                  │    point would be invisible here.           │
├──────────────────────────────────────────┴─────────────────────────────────────────────┤
│ 4 · THE NINE QUESTIONS, ANSWERED                                                   [4]  │
│  R1 factors      p=0.023*  R2 segments  p=0.52   R3 locations p=0.72   R4 support p=0.96│
│  R5 factor×loyal n.s.      R6 repeat    p=0.29   R7 clusters  unpowered R8 loyalty p=0.09│
│  R9 demo×factor  chi2 p=.036    * does not survive Bonferroni α=0.00625 across 8 tests   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ SO WHAT                                                                            [5]  │
│ 1. Act on none of these      2. Re-run at ~150 per      3. Collect a date and an order   │
│    differences.                 comparison group.          value. Neither exists.        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Source · method · every figure verified · WCAG 2.1 AA note · caveats                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Reading order:** thesis → `[1]` the ladder (largest object; the argument) → `[2]` the brief's own
headline question answered → `[3]` what it would take → `[4]` all nine discharged → `[5]` so what.

## App - desktop

Same composition plus interaction. The ladder is the filter surface: click any group to filter the
rest; the CI bar recomputes and **visibly widens** as n falls, which is the point.

- **Drill:** state → city → customer list, with breadcrumb.
- **Toggle on the ladder:** *show detection floor* on/off - with it off the estimates look like
  findings; with it on they vanish into the band. The toggle is the demonstration.
- **URL state**, 5-step tour, filter chips with one-click clear.
- **Explore drawer:** age bands, factor × gender, city table, score histogram - each stating its
  test and verdict.

## App - mobile (375px)

Single column. The ladder keeps all rows (they are short) but drops to a compact axis. The
"what it would take" table stays complete - it is the recommendation.

## What each panel discharges

| Panel | Insight | Requirement |
|---|---|---|
| `[1]` Uncertainty ladder | **I-1, I-2, I-4** | R1, R2, R3, R6, R8 |
| `[2]` Headline question | **I-3** | **R4** |
| `[3]` What it would take | **I-4** | - (the recommendation) |
| `[4]` Nine questions | I-5 | **R1-R9 traced** |
| Explore | - | R5, R7, R9 |
