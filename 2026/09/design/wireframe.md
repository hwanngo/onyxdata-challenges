# Wireframe - 2026/09 Every Route, No Journey

## Direction

**A dispatch manifest crossed with an evidence docket.** The page uses an editorial, asymmetric,
data-dense grid: warm rice-paper surfaces, near-black rules, vermilion stamps, ochre quarantine
hatching and mono figures. The visual signature is not another broken circuit. It is the contrast
between a completely filled **allocation lattice** and a bank of nine physically isolated
**measurement dials**.

The design deliberately avoids restaurant-dashboard clichés: no map pins, delivery scooters, wok
illustrations, traffic-light gauges, rounded SaaS cards, glass effects or decorative neon. Golden Wok
appears through restrained material cues—paper, ink, vermilion and brass—not themed clip art.

UI/UX Pro Max synthesis:

- **Pattern:** operations dashboard, but written as an editorial investigation rather than live
  monitoring.
- **Style:** editorial grid + data-dense dashboard + bold poster typography.
- **Variance / motion / density:** 8 / 3 / 8. Asymmetric, subtle motion, compact evidence.
- **Charts:** adjacency matrix for precise network coverage; compact coefficient ruler for the
  process chain; text-first verdict scorecard; contract status matrix. No Sankey: there is no real
  event flow. No gauges: the measures have no defensible target.
- **Accessibility:** direct labels, text/status symbols in addition to colour, screen-reader tables,
  visible focus, reduced motion and a mobile representation that does not shrink 80 cells into
  untappable marks.
- **Stack:** SolidJS + UnoCSS. The design search has no native Solid profile; React guidance was used
  only for analogous JSX accessibility/performance checks, while G6 must use Solid signals/resources.

## Poster frame

**2560 × 1440. Six objects.** Horizontal margins 72px; twelve columns; 20px gutters. Vertical budget:
24px top + 20px bottom + five 10px gaps + 56/194/506/300/220/70px objects = 1440px.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ① SOURCE AUDIT · GOLDEN WOK · 2023-01-01—2024-12-31 · 5,000 ORDERS · ALLOCATION SAFE / PERFORMANCE NO │
│    KEY  ■ ALLOCATED CELL   Q QUARANTINED DIAL   × CONTRADICTED   ? UNSUPPORTED   ▨ RELEASE EVIDENCE  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ② EVERY ROUTE.                                                                      ┌─────────────────┐ │
│    NO JOURNEY.                                                                      │ DECISION STAMP  │ │
│                                                                                    │ COUNT ALLOCATION│ │
│    All 80 kitchen-zone corridors and all 240 rider-kitchen pairings appear,         │ REPAIR MEASURE  │ │
│    but nine business measures behave as disconnected bounded draws.                 │ DO NOT OPTIMISE │ │
│                                                                                    └─────────────────┘ │
│    80 / 80 CORRIDORS     240 / 240 RIDER PAIRS     0 / 8 LINKS     9 / 9 QUARANTINED                │
├────────────────────────────────────────────────────────────┬───────────────────────────────────────────┤
│ ③ EVERY CELL IS FILLED. THAT IS THE WARNING.               │ ④ NINE DIALS. NO DELIVERY CHAIN.          │
│                                                            │                                           │
│             Z01 Z02 Z03 Z04 Z05 ... Z20                   │       ╭────╮   ╭────╮   ╭────╮             │
│  KITCHEN 1    ■   ■   ■   ■   ■  ...  ■   20/20 FILLED  │       │ Q  │   │ Q  │   │ Q  │             │
│  KITCHEN 2    ■   ■   ■   ■   ■  ...  ■   20/20 FILLED  │       ╰────╯   ╰────╯   ╰────╯             │
│  KITCHEN 3    ■   ■   ■   ■   ■  ...  ■   20/20 FILLED  │       VALUE    DISTANCE  PROMISE            │
│  KITCHEN 4    ■   ■   ■   ■   ■  ...  ■   20/20 FILLED  │                                           │
│                                                            │       ╭────╮   ╭────╮   ╭────╮             │
│  CELL = computed corridor count · exact label in the build │       │ Q  │   │ Q  │   │ Q  │             │
│  41—79 orders · largest cell 79 / 1.58% of file            │       ╰────╯   ╰────╯   ╰────╯             │
│                                                            │       ACTUAL   TRAFFIC   TEMP               │
│  SECOND LATTICE                                            │                                           │
│  rider × fact kitchen   240/240      kitchen × slot 192/192│       ╭────╮   ╭────╮   ╭────╮             │
│  base match 1,264       cross-base 3,736                   │       │ Q  │   │ Q  │   │ Q  │             │
│                                                            │       ╰────╯   ╰────╯   ╰────╯             │
│  Annotation: this is complete allocation, not route proof. │       RATING    COST      PROFIT             │
│                                                            │                                           │
│                                                            │  36 pairwise tests · max |r| .03038         │
│                                                            │  0/8 expected links survive correction      │
├─────────────────────────────────┬────────────────────────────┬────────────────────────────────────────────┤
│ ⑤a THE EXPECTED CHAIN IS FLAT. │ ⑤b FIVE CLAIMS. NO ACTION. │ ⑤c THE VALIDATOR PASSED NAMES IT NEVER SAW.│
│                                 │                            │                                            │
│  -.04  -.02   0   +.02  +.04   │ × Rush + outer    n=539   │ REPORT      10 PASSED                       │
│  traffic → time       ● -.0027 │ ? Rain delay    1.00393×  │ CONSTRAINTS 0 / 54 MATCH                    │
│  distance → time        ● .0111│ × >8km loss       0 loss  │ RELATIONS   3 MISSING · 1 INVALID           │
│  time → temp           ● -.0084│ × Slow → cold   4.31% n=4710│                                          │
│  time → rating        ● -.0155 │ ? Lekki / VI       VI absent│ □□□□□□□□□□□□□□□□□□ × 3 rows                  │
│  distance → cost         ● .0164│                           │ □□□□□□□□□□□□□□□□□□                        │
│  distance → profit    ● -.00002│ 3 CONTRADICTED · 2 UNSUPPORTED│ □□□□□□□□□□□□□□□□                    │
│  value → profit            ● .0257│ 0 CONFIRMED             │ jumper row: ━━╳━━━━╳━━╳━━━━!━━             │
│  cost → profit          ● .0118│                           │                                            │
│  fixed ±.04 ruler · direct labels│ each row carries denominator│ Passed is not the same as tested.          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑥ COUNT ALLOCATION. REPAIR MEASUREMENT. DO NOT OPTIMISE.                                                │
│                                                                                                        │
│  01 SAFE NOW                         02 BLOCK NOW                         03 COLLECT NEXT                  │
│  ID-based volume and corridor share  SLA · weather · quality · profit   Six service timestamps          │
│  Contract and domain auditing        Radius · routing · closures        Route identity + coordinates     │
│  Re-instrumentation priority         Rider reassignment                 Observed weather + order status  │
│                                                                          Reconciled unit economics       │
│                                                                          Temperature + assignment history│
│                                                                                                        │
│  Seven missing requirements. Rebuild the measurement contract before changing the delivery network.    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SOURCE Onyx Data · archive SHA recorded · synthetic-file diagnosis, not a Lagos delivery benchmark ·   │
│ no profit/SLA/quality measure exposed · every figure recomputed from curated Parquet · WCAG 2.1 AA ·   │
│ keyboard-operable chart marks · screen-reader tables · colour never carries status alone               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The matrix uses structural marks only. G6 must bind every cell label, fill and annotation from
`corridors.json`; no fabricated example value may enter the DOM, source constants or poster.

## Reading order

1. **Status rail:** establishes that this is a source audit and defines the visual grammar.
2. **Thesis:** delivers the decision boundary before any chart can be mistaken for operations advice.
3. **Allocation lattice:** proves mechanical completeness and fully crossed assignment.
4. **Dial bank:** contrasts that completeness with nine quarantined, disconnected business fields.
5. **Three evidence panels:** show the failed process chain, supplied claims and validator contract.
6. **Decision strip:** turns diagnosis into a safe-now / block-now / collect-next operating instruction.

The central contrast is spatial as well as verbal: the lattice physically touches every row and column;
the dials occupy separate ruled compartments with no connecting stroke. This is not a severed circuit.
Nothing was ever connected in the first place.

## Visual system

### Colour tokens

Candidate text/background pairs were pre-checked above WCAG AA; G6 must still run
`tools/audit_contrast.py` against the implemented token file before release.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5EFE3` | `#12100D` | warm paper / ink-black canvas |
| `--bg-raised` | `#FFFDF8` | `#1B1814` | evidence surface |
| `--bg-sunken` | `#E9E0D1` | `#0C0B09` | selected bands / dense tables |
| `--ink` | `#191713` | `#F8F0E3` | primary text and rules |
| `--ink-muted` | `#625A50` | `#BDB2A3` | secondary text |
| `--border` | `#C9BDAA` | `#4B4339` | grid and card rules |
| `--border-strong` | `#766A5B` | `#8D806F` | controls and axes |
| `--accent` | `#B33426` | `#FF7059` | vermilion focus / active allocation |
| `--accent-weak` | `#F0D8D1` | `#3A1D18` | selected background |
| `--good` | `#1F665B` | `#68C2AE` | safe-now status, always text-labelled |
| `--bad` | `#992F2B` | `#FF8175` | contradicted / invalid, always `×` labelled |
| `--warn` | `#8A5A0A` | `#E8B657` | quarantine / unsupported, always hatch or `Q/?` |
| `--focus` | `#005FCC` | `#8FC5FF` | keyboard focus only |

Do not use a red-to-green scale for the corridor matrix. Corridor cells use one vermilion sequential
ramp plus exact counts. Status is encoded with label + symbol + texture.

### Typography

- **Display:** `Barlow Condensed`, 600–700. Tall, compressed dispatch-poster headlines.
- **Body/UI:** `Public Sans`, 400–700. Neutral and readable at dashboard density.
- **Figures:** `JetBrains Mono`, 400–600, tabular numbers enabled.
- Hero thesis: 112px poster / `clamp(3.25rem, 8vw, 7rem)` live; line-height 0.86.
- Section title: 24px poster; uppercase; 0.04em tracking.
- Body: 16–18px live; never below 16px on mobile.
- Micro-label: 13–14px poster/live desktop only; mobile minimum 14px.

### Surface and shape

- Zero-radius main panels; 1px ruled dividers; 3px accent rules only for the decision boundary.
- No shadows. Hierarchy comes from rules, scale, inversion and paper tones.
- Vermilion “stamp” is a CSS rectangle with text, not a raster asset.
- Quarantine texture is a sparse diagonal hatch at ≥3:1 non-text contrast.
- Icons, if needed, use one 1.75px Lucide outline family; no emoji.

## Chart inventory

| Slot | Chart | Finding-led title | Emits / consumes | Drill |
|---|---|---|---|---|
| **Hero ③** | 4 × 20 adjacency heat matrix with direct count labels; two compact pair-coverage rails below | **Every cell is filled. That is the warning.** | emits `kitchen_id`, `zone_id`, corridor; consumes allocation filters | corridor → count/share/rank/source IDs |
| **Hero ④** | 3 × 3 isolated dial bank; uniform perimeter ticks, centre `Q`, no target needle | **Nine dials. No defensible delivery chain.** | emits `source_field`; consumes selected process link/claim by highlighting involved dials | measure → contract/reason/source distribution |
| **⑤a** | eight-row coefficient lollipop on fixed `−.04…+.04` ruler | **Expected linear links are near zero.** | emits `link_id`; consumes dial focus | link → r/p/corrected alpha/decision |
| **⑤b** | five-row verdict scorecard with symbol, observed result and denominator | **Five supplied claims produce no operational action.** | emits `claim_id`; consumes related measure/corridor focus | claim → formula/population/caveat |
| **⑤c** | 3 × 18 constraint-cell matrix plus seven-relationship jumper rail | **The validator passed names it never saw.** | emits `kind`, `status`, `contract_id`; consumes release topic | contract group → exact table/column/detail |
| **⑥** | three-column decision ledger | **Count allocation. Repair measurement. Do not optimise.** | emits `decision=safe|block|collect`; consumes topic focus | collect item → requirement detail |
| *(live only)* | sortable 80-row corridor table | **Volume is descriptive; performance is unavailable.** | emits/consumes kitchen, zone and corridor | row → exact IDs and denominator |
| *(live only)* | nine-row measure contract table | **Every business measure is source-audit only.** | emits/consumes source field | field → reason and forbidden use |

### Dial semantics

The dial bank is a metaphor with strict guardrails:

- no needle, target, red/amber/green arc or “performance” wording;
- equal perimeter ticks communicate bounded occupancy, not achievement;
- centre label is always `Q / QUARANTINED`;
- focus outlines one dial and the corresponding link/claim evidence;
- screen-reader label states the field, status and reason—not a visual angle.

## Number-to-model contract

Every printed number must use the named metric or set in `model/metric_checks.yml`.

| Poster mark | Contract |
|---|---|
| 5,000 orders | `order_rows` |
| 80/80 corridor grid | `kitchen_zone_pairs`; denominator `kitchens × zones` |
| 240/240 rider-kitchen grid | `kitchen_rider_pairs`; denominator `kitchens × riders` |
| 192/192 kitchen-slot grid | `kitchen_slot_pairs`; denominator `kitchens × time_slots` |
| largest corridor 79 / 1.58% | `largest_corridor_rows`, `largest_corridor_share` |
| base 1,264 / cross-base 3,736 | `rider_base_matches`, `rider_base_mismatches` |
| 9 quarantined | `quarantined_measures` |
| 36 pairwise tests / max 0.03038 | `pairwise_measure_tests`, `max_abs_pairwise_r` |
| 0/8 expected links | `process_links_surviving_correction`, `process_links` |
| coefficient rows | `process_link.*.r` metric set |
| 3 contradicted / 2 unsupported / 0 confirmed | `claims_rejected`, `claims_unsupported`, `claims_confirmed` |
| claim observed values and denominators | `claim.*.observed`, `claim.*.sample_n` metric set |
| validator 10 passed / 0 of 54 | `validation_checks_passed`, `matching_constraints`, `configured_constraints` |
| three missing / one invalid relationship | `unavailable_relationships`, `invalid_relationships` |
| seven missing requirements | `missing_collection_requirements` |

## Interaction map

### State model

- **Allocation filters:** `kitchen_id`, `zone_id`, `rider_id`, `year_month`.
- **Evidence focus:** `source_field`, `link_id`, `claim_id`, `contract_id`, `decision`.
- Filters change descriptive allocation counts only. They never recompute release-level statistical
  tests on arbitrary small subsets.
- Evidence modules consume allocation filters by showing a visible **RELEASE LEVEL — NOT REFILTERED**
  badge and highlighting related fields, never by returning a misleading zero-row result.

### Cross-filter behaviour

- Matrix cell click/focus selects one corridor; row/column labels select a kitchen or zone.
- Selecting a kitchen or zone dims unmatched matrix cells to 24%, updates the live corridor table and
  keeps the complete-grid denominator visible.
- Dial selection highlights process links and supplied claims that mention that field.
- Link selection highlights its two dials and opens the evidence drawer.
- Claim selection highlights the relevant dials/corridor context and opens formula + population +
  caveat.
- Contract selection filters the contract table and marks the release-summary panel.
- Every selected state creates a removable chip. **Clear all** remains first in keyboard order after
  the chip list.

### Drill and navigation

- **Corridor:** lattice cell → corridor evidence → source IDs. No performance drill exists.
- **Measure:** dial → measure contract → reason / safe use.
- **Process:** coefficient → r / p / corrected alpha → decision.
- **Claim:** verdict row → predicate / population / observed result / caveat.
- **Validation:** matrix or jumper → contract type → exact table and column names.
- Shared breadcrumb sits above the right-side evidence drawer.
- URL state: `?f=<encoded allocation filters>&focus=<type:id>&drill=<level>`.
- Browser back restores filter, focus, drill level and scroll position.

### Tour

Five steps, keyboard operable, reopenable from a labelled `Guided tour` button:

1. Full corridor lattice.
2. Nine quarantined dials.
3. Flat expected process links.
4. Five failed supplied claims and validator mismatch.
5. Safe / block / collect decision boundary.

Arrow keys move; Escape closes; visible `1 / 5`; focus returns to trigger.

### Motion

- 180ms opacity/background transitions for focus and filtering.
- Evidence drawer enters in ≤240ms with translate + opacity only.
- No dial rotation, pulsing status, autoplay, parallax or count-up animation.
- With `prefers-reduced-motion`, all transitions become immediate while state remains obvious.

## Responsive contract

| Width | Treatment |
|---|---|
| **≥1440px** | Full asymmetric 12-column layout; matrix and dial bank share the hero row 7/5. |
| **1024–1439px** | Hero stacks matrix above dial bank; evidence row becomes 2 + 1 panels; decision ledger remains three columns. |
| **768–1023px** | Matrix gets an internal labelled scroll region, never body-level horizontal scroll; evidence panels stack; sticky filter summary. |
| **≤767px** | Replace the 80-cell visual with four kitchen strips: `20/20 zones`, total orders and top three corridors. Full matrix is an expandable accessible table. Dial bank remains 3 × 3. Decision ledger stacks Safe → Block → Collect. |
| **375px minimum** | 16px body, 44px controls, one-column content, no clipped thesis, no precision tapping on chart marks. |

Poster mode is fixed at 2560 × 1440 and never inherits the mobile simplification.

## Accessibility contract

- One `h1`; sequential `h2` sections; skip link to the main evidence.
- Every chart uses `<ChartFigure>` with a visible finding-led caption, concise `aria-label` summary and
  an equivalent data table.
- Matrix cells have keyboard focus only in live desktop/tablet mode; arrow keys move within the grid.
  Enter selects; Escape clears. Mobile uses the list/table representation instead.
- Tooltip information is reachable by focus and click, not hover only.
- Status uses symbol + word + texture: `× CONTRADICTED`, `? UNSUPPORTED`, `Q QUARANTINED`.
- Body text contrast ≥4.5:1; chart marks and focus boundaries ≥3:1; visible focus ring 2–4px.
- All controls ≥44 × 44px with ≥8px spacing.
- Numeric columns use tabular figures; exact values stay visible beside graphical marks.
- Loading reserves final chart dimensions and uses neutral skeletons—never plausible numbers.
- Error states use `role="alert"`, identify the failed file and provide a retry action.

## Live app vs poster

| | Live | Poster |
|---|---|---|
| Allocation matrix | filterable, keyboard grid, corridor drawer | all 80 cells and counts printed |
| Dial bank | field focus and contract drawer | all nine statuses printed |
| Process links | link focus, p/alpha tooltip | all eight r values directly labelled |
| Claims | expandable formula/population/caveat | five compact verdict rows |
| Contracts | sortable/filterable 61-row table | 54-cell summary + seven-link rail |
| Filter chips | shown | hidden |
| Evidence drawer | shown | omitted; essential evidence printed inline |
| Tour | shown | hidden |
| Theme | light/dark/system | fixed warm-paper light theme |
| Footer | concise with expandable methodology | full provenance, limitations and accessibility note |

## G6 component handoff

- `DiagnosticRail`
- `ThesisMasthead`
- `DecisionStamp`
- `SignalStrip`
- `AllocationMatrix`
- `CoverageRail`
- `DialBank` / `MeasureDial`
- `ProcessLinkPlot`
- `ClaimScorecard`
- `ContractMatrix`
- `DecisionLedger`
- `EvidenceDrawer`
- `FilterChipBar`
- `DrillBreadcrumb`
- `GuidedTour`
- `ChartFigure` wrappers and accessible fallback tables

Reusable controls, chart wrappers and accessibility primitives should come from `@onyxdata/dna-kit`.
Month-specific SVG/data marks stay in `2026/09/app/src/`.

## Explicit exclusions

- No map: coordinates and route identity do not support an operational route map.
- No profit, SLA, late-delivery, weather, temperature-quality or rider-performance KPI.
- No top/bottom kitchen or rider ranking based on quarantined measures.
- No Sankey/process map: the release has no coherent event log.
- No red-green gauge bank: the dials have no targets and are quarantine objects.
- No broken-wire or electrical-circuit hero; August already owns that metaphor.
- No raw source values in tooltip copy without a `SOURCE AUDIT ONLY` label.
