# Submission - 2026/08 African Gig-Economy and Digital Wallet Analytics

**Status:** post-deadline portfolio/practice work. The challenge closed on 24 August 2026; this work
was completed afterward and will not be represented as a live competition entry.

## LinkedIn post

```text
Connected tables. Disconnected risk.

The August DataDNA archive contains 50,000 unique wallet transactions with a clean star schema and
four resolving foreign keys. It can power a convincing dashboard.

It cannot power a defensible risk decision.

The evidence chain breaks four times:

• Risk controls → flags: 0 of 60 prespecified effects and 0 of 570 interactions survive correction;
  the strongest continuous fraud relationship is |r| 0.00632.
• Flags → outcomes: reversal and dispute labels agree with their Boolean flags only at chance
  (φ 0.00414 and 0.00265).
• Exposure → loss: recorded loss correlates −0.00453 with recorded transaction value and exceeds it
  on 12,562 flagged rows.
• Validator → files: the supplied report says 9 of 9 checks passed, while 0 of 54 configured
  constraint names match delivered columns and 5 of 9 relationships require absent fields.

The positive control works: fraud flag and positive loss presence align on all 50,000 rows. The
instrument is live; the other connectors are not.

One lead stays open rather than being promoted or buried. Month-end Cash-Out reversal is +8.28
percentage points, but its 95% interval runs from −0.26 to +16.81 and p=0.058 on n=132. Confirm — do
not deploy.

The recommendation is sequenced: rebuild one transaction-level evidence chain with event timestamps,
control decisions, adjudicated outcomes, recoveries and bounded loss; enforce local amount ÷ FX =
USD; fail validation on absent contracts; then preregister and retest the month-end lead on a holdout
period.

Built with Python, Polars, DuckDB, scipy, Parquet, Malloy, SolidJS, UnoCSS, accessible SVG and
Playwright. Every displayed value is independently recomputed from curated Parquet.

@OnyxData @SmartFramesUI @DataCareerJumpstart @packt #dataDNA
```

## Submission checklist

- [ ] Follow Onyx Data on LinkedIn before any future live entry
- [x] Single image ready: `exports/dashboard.png`
- [x] Tag union checked against Step 2, prefilled share text and FAQ
- [x] Hashtag: `#dataDNA`
- [x] Portfolio/practice disclosure included

## Entry-form values

| Field | Value |
|---|---|
| Tool used | Other — custom accessible web dashboard |
| Power BI report | n/a |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **Connected Tables, Disconnected Risk** |
| Portfolio status | Practice work completed after the challenge deadline |

## Portfolio description

A diagnostic evidence audit of 50,000 synthetic digital-wallet transactions across four African
markets. The delivered tables are mechanically sound, but the expected risk chain is not: controls
do not predict event flags, flags do not reconcile with outcomes, monetary loss does not reconcile
with exposure, and the supplied validator does not target the delivered schema. The signature
“Broken Circuit” visual quantifies each failed connector, preserves a complete positive control, and
holds one month-end Cash-Out reversal result in amber as an unconfirmed holdout target.

### Technical depth

The project uses an immutable raw archive and a Polars build that writes a tested Parquet star schema.
Semantically invalid financial fields remain only under explicit `source_*_unreconciled` or
`source_*_unbounded` names, and Malloy exposes no loss, revenue, exposure or ROI measure. Separate
curated tables hold the six source-claim verdicts, six continuous-control validations, four broken
connectors, status alignment, the open lead with its interval, 63 named validation contracts and the
exposure/loss identity bins. Fourteen Malloy views execute cleanly. Pytest independently constrains
load-bearing metrics against the raw CSVs, while browser metrics are recomputed through DuckDB SQL.

The SolidJS dashboard uses URL-backed topic cross-filtering, connector → evidence → decision drill,
a six-step keyboard-accessible tour, light/dark themes, focusable SVG marks and screen-reader tables.
The browser payload is compact generated JSON rather than DuckDB-WASM because the evidence model is
far smaller than the engine; the semantic and verification layers remain DuckDB-backed at build and
QA time.

## Artifact inventory

| Artifact | Path |
|---|---|
| Submission poster, 2560×1440 | `exports/dashboard.png` |
| Live dashboard | `app/` — `/` and `/poster` |
| Challenge framing | `brief.md` |
| Data profile and source audit | `analysis/profile.md` |
| Five-insight evidence ledger | `analysis/insights.md` |
| Assumptions and semantic boundaries | `assumptions.md` |
| Curated evidence model | `model/build.py`, `data/curated/` |
| Domain glossary | `model/CONTEXT.md` |
| Semantic layer | `model/model.malloy` |
| Metric verification | `model/test_metrics.py`, `model/metric_checks.yml` |
| Interaction matrix | `app/interact.mjs` |
| Accessibility and QA evidence | `exports/qa/`, `exports/a11y/` |

## One-paragraph version

The archive's 50,000 transactions form a clean star schema, but the evidence chain breaks between
risk controls and flags, flags and outcomes, exposure and loss, and the supplied validator and the
files it claims to certify. No main effect or interaction survives correction, event-status systems
agree at chance, loss exceeds transaction amount on 12,562 flagged rows, and none of 54 configured
constraint names exactly matches a delivered column. A complete positive control proves the analysis
can detect an encoded relationship. Month-end Cash-Out reversal remains one unconfirmed +8.28-point
lead whose interval crosses zero. The decision is therefore not “which country or channel is risky,”
but “repair the measurement and validation contracts, then retest the one lead on holdout data.”
