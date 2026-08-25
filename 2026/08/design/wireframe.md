# Wireframe - 2026/08 Connected Tables, Disconnected Risk

**2560 × 1440. Six objects.** Vertical budget: 32px top + 24px bottom + five 12px gaps +
60/230/500/300/150/84px objects = 1440px exactly. Horizontal: 96px margins, twelve columns,
20px gutters.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ① DIAGNOSTIC STATUS RAIL · PAYPESA SYNTHETIC ARCHIVE · 2023-01-01—2024-12-31 · 50,000 TRANSACTIONS    │
│    LEGEND  ■ BROKEN / gap+hatch     ● CONNECTED / continuous trace     ◉ OPEN / ring+whisker          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ② CONNECTED TABLES. DISCONNECTED RISK.                                    ┌───────────────────────────┐ │
│    The archive forms a clean star schema, but its controls do not predict │ POSITIVE CONTROL          │ │
│    flags, flags do not reconcile with outcomes, loss does not reconcile   │ FRAUD FLAG ━━━━━ LOSS > 0 │ │
│    with exposure, and the validator does not test the delivered files.    │ 50,000 / 50,000 ALIGNED   │ │
│    Convincing dashboard mechanics; no defensible risk prioritisation.     │ CONNECTED · instrument live│ │
│                                                                            └───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ③ THE BROKEN CIRCUIT                                                                                   │
│                                                                                                        │
│    RISK CONTROLS       ━━━━━━━┫  ┣━━━━━━━       EVENT FLAGS                                             │
│    risk · velocity            OPEN             fraud · dispute · reversal                              │
│                       0/60 MAIN · 0/570 INTERACTIONS · MAX |r| .00632                                   │
│                                                                                                        │
│    EVENT FLAGS         ━━━━━━━┫  ┣━━━━━━━       OUTCOME LABELS                                          │
│                       φ .00414 · φ .00265 · ≈50% agreement                                             │
│                                                                                                        │
│    RECORDED EXPOSURE   ━━━━━━━┫  ┣━━━━━━━       RECORDED LOSS                                           │
│                       r −.00453       /////// 12,562 LOSS > AMOUNT ///////                              │
│                                                                                                        │
│    VALIDATOR           ○ ○ ○ ○ ○ ○ ○ ○ ○     ━━━━━━━       DELIVERED FILES                            │
│                        ○ ○ ○ ○ ○ ○ ○ ○ ○      ╳ ╳ ╳ ╳ ╳     0/54 constraint names                     │
│                        ○ ○ ○ ○ ○ ○ ○ ○ ○      5/9 relationships absent · report says 9/9 passed       │
│                        ○ ○ ○ ○ ○ ○ ○ ○ ○                                                             │
│                        ○ ○ ○ ○ ○ ○ ○ ○ ○                                                             │
│                        ○ ○ ○ ○ ○ ○ ○ ○ ○                                                             │
│                                                                                                        │
│    Click or focus a break → evidence → decision. Trace width never represents volume.                  │
├──────────────────────────┬──────────────────────────┬──────────────────────────┬─────────────────────────┤
│ ④a SIX CONTROLS.         │ ④b FLAGS AND OUTCOMES   │ ④c LOSS EXCEEDS         │ ④d THE VALIDATOR PASSED │
│     NO CALIBRATED SIGNAL │     AGREE AT CHANCE      │     EXPOSURE             │     WHAT IT DIDN'T TEST  │
│                          │                          │                          │                         │
│  0/60  ├──────────────   │ -.01   0      +.01      │ loss  · · · · //////    │ ○○○○○○○○○  ×6 rows     │
│  0/570 ├──────────────   │         ● φ .00414      │      · · · //////       │                         │
│                          │         ○ φ .00265      │      · · /////          │ jumper rail:            │
│ -.01     0       +.01    │                          │      ───── y=x           │ ━━╳━━╳━╳━━╳━━╳━━       │
│      · · ● · · ·         │ printed p + agreement   │ amount →                │ 5 of 9 absent           │
│      max |r| .00632      │ direct labels           │ 12,562 above line       │ 9/9 supplied pass       │
├──────────────────────────┴──────────────────────────┴──────────────────────────┴─────────────────────────┤
│ ⑤ CONFIRM — DO NOT DEPLOY                                                                              │
│    Month-end Cash-Out reversal                                                                         │
│                                      ├──────────────────────◉────────────────────────────────┤           │
│                                   −0.26pp                 +8.28pp                       +16.81pp          │
│    zero ┃                                          p=.058 · n=132 · 59.09% vs 50.82%                    │
│    Preregister this denominator and a materiality threshold; retest on a later holdout period.          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑥ SOURCE Onyx Data · original archive SHA recorded · synthetic-file diagnosis, not an African-market   │
│    claim · invalid currency/loss totals deliberately excluded · every displayed value recomputed from  │
│    curated Parquet · WCAG 2.1 AA · keyboard-operable SVG marks · screen-reader tables · reduced motion │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Reading order

The status rail defines the three states. The thesis immediately proves the analysis is live with the
positive control. The Broken Circuit gives the mechanism. Four support modules independently work
each failed connector. The open lead is separated at full width so amber uncertainty cannot be
mistaken for a fifth failure or a green recommendation. The footer states every boundary the static
reviewer cannot discover by interaction.

## Chart inventory

| Slot | Chart | Finding-led title | Emits / consumes | Drill |
|---|---|---|---|---|
| **Hero ③** | fixed-width evidence-chain schematic; four broken lanes + green bus | **Four connectors break between clean tables and a risk decision.** | `topic` / emphasizes matching support and drawer | connector → evidence → decision |
| **④a** | zero-hit bars + six-point symmetric coefficient ruler | **Six controls. No calibrated signal.** | `topic=controls`, `control_id` / responds to circuit focus | control → statistic/method |
| **④b** | two-row coefficient dot plot, fixed -0.01…+0.01 | **Flags and outcomes agree at chance.** | `topic=status`, `event` | event → 2×2 evidence |
| **④c** | binned exposure × loss identity plot with y=x and hatch | **Recorded loss exceeds exposure on 12,562 rows.** | `topic=finance`, overflow region | overflow → bins / source rows (live only) |
| **④d** | 6×9 hollow contact matrix + nine-jumper rail | **The validator passed a schema it did not test.** | `topic=validation`, contract type | contract → missing name/detail |
| **⑤** | one-row forest plot | **+8.28pp is a confirmation target, not a control.** | `topic=lead`, period | period → numerator/denominator |
| *(live only)* | six-row verdict scorecard | **Five supplied findings fail; one stays open.** | `topic=claims`, verdict | claim → formula/population/caveat |

## Interaction map

- **Cross-filter:** all objects share `topic`. `FilterChipBar` sits below the diagnostic rail; clear
  all is always present. A view that lacks a lower-grain field highlights context rather than
  returning zero rows.
- **Circuit focus:** hover/focus/click one lane; others fade to 20%; related support module and drawer
  remain at full weight.
- **Drill path:** connector → evidence → decision, with shared `DrillBreadcrumb` above the drawer.
- **Finance drill:** hatched overflow → binned cells → offending records, live only.
- **Validation drill:** matrix/jumper → constraint or relationship name → missing delivered field.
- **Tour:** six steps: positive control, four broken lanes, open lead. Arrow keys; Escape; `1/6`.
- **URL state:** `?f=<encoded filters>&focus=<connector_id>&drill=<level>`.
- **Empty state:** unknown/deep-linked topic renders the full circuit plus “No evidence matches this
  topic” in the drawer; never a blank signature.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Circuit | hover/focus isolation; click drill | all lanes shown; evidence printed |
| Filter chips | shown | hidden |
| Evidence drawer | shown; six-claim scorecard and named contracts | omitted |
| Finance identity plot | hover bins, overflow drill | static binned density + hatch |
| Open lead | period focus and denominator tooltip | fixed CI, p and n printed |
| Tour | first-run, reopenable `.tour-btn` | hidden |
| Theme | light/dark/system | light porcelain, fixed for submission |
| Footer | concise and expandable notes | full provenance, limits and accessibility note |

## Poster object budget

| Object | Height |
|---|---:|
| ① status rail | 60px |
| ② thesis + positive control | 230px |
| ③ Broken Circuit | 500px |
| ④ four support modules | 300px |
| ⑤ open lead | 150px |
| ⑥ footer | 84px |
| five row gaps | 60px |
| top + bottom padding | 56px |
| **Total** | **1440px** |
