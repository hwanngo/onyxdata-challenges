# Wireframe - 2026/06 UK Fintech Neobank (Zephyr Bank)

The poster is the submission. It must read standalone as a static PNG, top-left to
bottom-right, with no ambiguity about reading order.

**2560 × 1440. Nine objects. Row heights budgeted in `.workbench/2026/06/design/direction.md` BEFORE any component was
written** - 2026/05 discovered its budget at G6 and paid about a dozen adjust-remeasure cycles
for it.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ① THIS FILE REPORTS 1,500 TRANSACTIONS. IT CONTAINS 20 FACTS.                                │
│   Status, fraud, failure reason and device never vary within a customer - device_type is      │
│   literally customer_id mod 4. Every rate in this review is a fraction of twenty.             │
│   ────────────────────────────────────────────────────────────────────────────────────────   │
│   Zephyr Bank H1 2026 · 1,500 rows · 20 customers · 2026-01-01 - 2026-05-31 · GBP             │
├──────────────────────┬──────────────────────┬───────────────────────┬────────────────────────┤
│ ② 20                 │  4 of 20             │  725 of 1,500         │  £0.17                 │
│   customers, not     │  customers flagged   │  transactions break   │  net fee variance -    │
│   1,500 transactions │  = the "20% fraud    │  the fee rule         │  hiding £1,174.39      │
│   8.66× wider SEs    │  rate" [5.7%, 43.7%] │                       │  of gross error        │
├──────────────────────┴──────────────────────┴───────────────────────┴────────────────────────┤
│ ③ THE TWENTY BLOCKS  ★ signature                                                             │
│   1,500 marks. Each one is a transaction. Each column is a customer. Twenty facts.           │
│                                                                                               │
│   ▒▒ ██ ▓▓ ██ ██ ▒▒ ██ ░░ ░░ ██ ▓▓ ▓▓ ▒▒ ██ ░░ ▓▓ ██ ██ ░░ ▓▓     ▒ Completed  3 customers  │
│   ▒▒ ██ ▓▓ ██ ██ ▒▒ ██ ░░ ░░ ██ ▓▓ ▓▓ ▒▒ ██ ░░ ▓▓ ██ ██ ░░ ▓▓     █ Declined   7            │
│   ▒▒ ██ ▓▓ ██ ██ ▒▒ ██ ░░ ░░ ██ ▓▓ ▓▓ ▒▒ ██ ░░ ▓▓ ██ ██ ░░ ▓▓     ▓ Reversed   5            │
│   ... 75 rows, every column solid ...                                 ░ Pending    5            │
│   ├──────────────────────────────────────────────────────────┤                               │
│   Rajan Mehta · £1.12m          ordered by customer value          Noah Greenwood · £748     │
│   No column is ever two colours. Re-sort it any way you like; it stays solid.                │
├───────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ ④ WHAT THE PACK SAYS vs WHAT THE FILE SUPPORTS│ ⑤ THE KYC QUESTION CANNOT BE ANSWERED        │
│                                                │                                              │
│  fraud   ●───┤├───  20.0% ±2.0pp   (claimed)  │        flagged   not flagged                 │
│          ├───────────────────┤ [5.7%, 43.7%]   │  non-KYC     0            4                  │
│  decline ●──┤├──   35.0% ±2.4pp                │  KYC         4           12                  │
│          ├──────────────────────┤[15.4,59.2]   │                                              │
│  complete●─┤├─     15.0% ±1.8pp                │  Fisher exact p = 0.5377                     │
│          ├─────────────────┤ [3.2%, 37.9%]     │  Every non-KYC customer has ZERO fraud       │
│                                                │  flags - the opposite of the hypothesis,     │
│  ● naive point (n=1,500)   ├──┤ true (n=20)    │  and not distinguishable from nothing.       │
│  Design effect = 75. SEs are 8.66× wider.      │  The honest deliverable is the power         │
│                                                │  calculation, not a bar chart.               │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ ⑥ THE ONE THING MEASURED PER TRANSACTION      │ ⑦ THE DICTIONARY, SCORED                     │
│   - AND IT CANCELS ITSELF                      │                                              │
│                                                │  14 claims tested · 11 fail                  │
│   over-charged  ████████████  +£587.28         │  ✗ 1,500 individual transactions             │
│  ─────────────────────────────── £0 ──────     │  ✗ device_type = the device used             │
│   under-charged ████████████  -£587.11         │  ✗ transaction_date is YYYY-MM-DD            │
│                                                │  ✗ fx_rate_used NULL for domestic            │
│   NET -£0.17 (-0.023%)  ← the variance report  │  ✗ failed_reason on every failure            │
│   GROSS £1,174.39       ← the actual error     │  ✗ negative = refund                         │
│                                                │  ✗ dimension tables load on their PK (BOM)   │
│   Transfer-International collects £100.39      │  ✗ type_name identifies a type               │
│   of £500 due. Eight £0.00-fee types collect   │  ✗ risk_flag classifies risk                 │
│   £524.40 between them.                        │  ✓ scope · ✓ FKs · ✓ unique ids              │
├───────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ ⑧ SO WHAT - THREE THINGS TO CHANGE                                                           │
│  1. Monitor GROSS absolute fee deviation, not net. The current control shows -0.023% while    │
│     £1,174.39 sits on the wrong side of the rule. This is the one finding the data supports   │
│     at transaction level, and it is actionable this quarter.                                  │
│  2. Report customer counts and intervals, not transaction rates. "4 of 20 customers flagged,  │
│     [5.7%, 43.7%]" is the honest form of "20% fraud rate ±2pp".                               │
│  3. Do not re-tier merchants, target devices, or deprioritise KYC on this file. Fix the       │
│     extract first: one row per transaction, with status and fraud recorded per transaction.   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑨ 1,500 rows · 20 customers · 2026-01-01-2026-05-31 · every figure recomputed from parquet    │
│   before publication · the archive dictionary is wrong in 11 of 14 tested claims, listed in   │
│   ⑦ · no map: five of the ten UK regions hold exactly one customer · no monthly trend line:   │
│   p=0.38 on five points · WCAG 2.1 AA, keyboard-operable charts, screen-reader tables         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Reading order: the thesis states the finding; four KPI figures give its scale; the signature
*shows* the twenty; ④ converts it into the intervals the review actually needs and ⑤ works one
named question through to its power calculation; ⑥ is the constructive half and ⑦ is the
provenance; ⑧ is what to do; ⑨ carries the omissions and their reasons.

## Chart inventory

| Slot | Chart | Title (states the FINDING) | Cross-filters on | Drill |
|---|---|---|---|---|
| **Hero ③** | Unit chart, 1,500 marks in 20 columns | "1,500 marks. Each column is a customer. Twenty facts." | click a column → filters every panel to that customer | customer → their transactions |
| **④** | Point-vs-interval dot plot | "What the pack says, and what the file supports" | click a measure → filters | - |
| **⑤** | 2×2 contingency, 20 cells total | "The KYC question cannot be answered at this n" | click a cell → filters | - |
| **⑥** | Diverging bar around zero | "The one thing measured per transaction - and it cancels itself" | click a type → filters | type → its rows |
| **⑦** | Scored claim list | "14 claims tested, 11 fail" | - | - |
| *(web only)* | Fee scatter, charged vs typical, 1,500 rows | "Every point off the diagonal is a fee on the wrong side of the rule" | click a point | - |
| *(web only)* | Customer table, all 20 | "This is the entire dataset" | click a customer | - |
| *(web only)* | Region table with customer counts | "Five of ten regions hold one customer" | - | - |

**No map and no trend line, deliberately** - both reasons printed in the footer rather than left
as absences.

## Interaction map

- **Cross-filter:** every visual emits and consumes. Chip bar under the thesis, one-click clear.
  Because the unit is the customer, filtering to a customer filters to *one* of twenty - the
  chip bar always prints "n of 20 customers" so the reader sees the denominator shrink.
- **The re-sort control (③):** by value / by status / by customer id. It exists to demonstrate
  that the block solidity is not an artefact of the ordering - the strongest robustness argument
  the page can make, and it is real interaction rather than decoration.
- **Drill path:** **customer → their transactions.** Two levels. There is no third: region,
  segment and device are all customer attributes, so drilling through them would repeat the
  same twenty rows under different labels.
- **Tour:** 5 steps - ① the twenty blocks, ② why that changes every rate, ③ the KYC question and
  its power, ④ the fee rule that does work, ⑤ what to change. `open` passed explicitly.
- **URL state:** `?f=[{field,values}]` plus `&sort=<value|status|id>`.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Signature | re-sort control, hover a column for the customer profile | ordered by value, all 1,500 marks drawn |
| Filter chip bar | shown, with "n of 20 customers" | hidden |
| Tour trigger | `?` button | hidden |
| Fee scatter, customer table, region table | shown | omitted (panel budget) |
| Footnotes | tooltip | printed in footer ⑨ |
