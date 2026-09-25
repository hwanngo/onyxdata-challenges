# Submission - 2026/09 Golden Wok Food Delivery Analytics

**Status:** post-deadline portfolio/practice work. The challenge closed on 24 September 2026; this work
was completed afterward and will not be represented as a live competition entry.

## LinkedIn post

```text
Every route. No journey.

The September DataDNA archive contains 5,000 unique orders, complete foreign keys, all 80 possible
kitchen-zone corridors and all 240 rider-kitchen pairings. It looks ready for delivery analytics.

It can describe allocation. It cannot explain delivery performance.

Nine business measures fail their documented semantics or expected process links. Across 36 pairwise
tests, none survives correction, and the expected traffic → time → quality → profit chain stays near
zero. Every supplied profit row also fails the stated value − cost identity.

The five supplied findings do not survive their own fields: three are contradicted and two are
unsupported as specified. Clear weather is absent from the rain comparison, VI is absent from the
named corridor, and the archive contains no defensible route identity or reconciled unit economics.

The supplied validator adds a final warning. It reports 10 of 10 checks passed, but none of 54
configured constraints names a delivered table-column pair, while three of seven relationships require
missing fields and one connects incompatible keys.

The recommendation is deliberately narrow: count stable-ID allocation, repair the measurement
contract, and do not change routing, radius, SLA, kitchen, rider or corridor-profit policy yet. Collect
service timestamps, route identity, observed weather, order status, reconciled unit economics,
temperature provenance and assignment history first.

Built with Python, Polars, NumPy, SciPy, DuckDB, Parquet, Malloy, SolidJS, UnoCSS and Playwright.
Every rendered figure is independently recomputed from curated evidence, including six filtered states.

@OnyxData @SmartFramesUI @DataCareerJumpstart @packt #dataDNA
```

## Submission checklist

- [ ] Follow Onyx Data on LinkedIn before any future live entry
- [x] Single image ready: `exports/dashboard.png`
- [x] Tag union checked against the challenge page and archive
- [x] Hashtag: `#dataDNA`
- [x] Portfolio/practice disclosure included
- [x] Final PNG is 2560×1440 and below 10 MB

## Entry-form values

| Field | Value |
|---|---|
| Tool used | Other — custom accessible web dashboard |
| Power BI report | n/a |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **Every Route. No Journey.** |
| Portfolio status | Practice work completed after the challenge deadline |

## Portfolio description

A source-integrity investigation of 5,000 synthetic Golden Wok delivery records across four kitchens,
20 zone IDs, 60 riders and 48 source time slots. The archive is mechanically complete: every fact key
resolves, every kitchen-zone pair appears and every rider is paired with every kitchen. That breadth
creates false confidence. The documented ranges, time labels, weather semantics, profit identity and
expected service relationships fail, so the file can describe where rows were allocated but cannot
support delivery-performance or profitability decisions.

The signature visual contrasts a completely filled allocation lattice with nine isolated quarantine
dials. Supporting panels show eight near-zero expected process links, five failed supplied claims and a
validator whose configured contracts do not target the release. The decision ledger converts the audit
into an operating boundary: descriptive allocation only, block optimisation, and collect seven missing
evidence groups before retesting.

### Technical depth

The project preserves the source archive unchanged and uses a tested Python build to write 14 curated
Parquet tables and eight finite browser JSON files. Semantically invalid measures remain under explicit
`source_*` names and Malloy exposes allocation and audit evidence rather than invented SLA, profit,
quality or rider-performance measures. Twenty-one Malloy views execute cleanly. Eighteen model tests
and eight integrity tests constrain the grain, keys, source claims, measure quarantine, validation
contracts and raw-to-curated reconciliation.

The SolidJS dashboard provides four URL-backed allocation filters, six evidence drill types, browser
Back restoration, a five-step keyboard-accessible tour, light/dark/system themes, mobile alternatives,
screen-reader tables and reduced-motion behavior. DuckDB independently reconciles 206 rendered metrics
on both live and poster routes. A month-local verifier additionally reconciles 163 selection metrics in
each of six client states directly against curated Parquet. Generated JSON is used in the browser
instead of DuckDB-WASM because the evidence payload is much smaller than the engine; DuckDB remains the
build-time and QA computation boundary.

## Artifact inventory

| Artifact | Path |
|---|---|
| Submission poster, 2560×1440 | `exports/dashboard.png` |
| Live dashboard | `app/` — `/` and `/poster` |
| Challenge framing | `brief.md` |
| Requirements trace | `REQUIREMENTS.md` |
| Data profile and source audit | `analysis/profile.md` |
| Five-insight evidence ledger | `analysis/insights.md` |
| Assumptions and semantic boundaries | `assumptions.md` |
| Curated evidence model | `model/build.py`, `data/curated/` |
| Semantic layer | `model/model.malloy` |
| Metric verification | `model/test_metrics.py`, `model/metric_checks.yml`, `model/verify_selection.py` |
| Interaction matrix | `app/interact.mjs` |
| Accessibility and QA evidence | `exports/qa/`, `exports/a11y/` |
| G7 scorecard | `.workbench/2026/09/SCORECARD.md` |

## One-paragraph version

The Golden Wok archive fills all 80 kitchen-zone corridors and all 240 rider-kitchen pairings, but its
nine business measures do not form a defensible delivery process: none of 36 pairwise tests survives
correction, expected traffic-to-profit links remain near zero, every supplied profit row fails its
stated identity, and all five archive findings are contradicted or unsupported. The supplied validator
also reports 10 passed checks while none of 54 configured constraints targets a delivered field. The
decision is therefore not which route to optimise, but to count allocation, repair the measurement and
validation contracts, and collect service timestamps, route identity, observed weather and reconciled
unit economics before changing the network.
