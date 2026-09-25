# Retro — 2026/09 Golden Wok Food Delivery Analytics

## Outcome

Shipped G1–G8 with the thesis **Every route. No journey.** The archive is mechanically complete but
semantically unable to support delivery-performance decisions. The final product deliberately exposes
only stable-ID allocation and source-audit evidence.

## What worked

### Mechanical integrity and semantic integrity stayed separate

The clean star schema was treated as the start of verification rather than the conclusion. Once every
key resolved, the analysis tested the connectors leadership would need to act: traffic → time,
distance → time/cost/profit, time → temperature/rating, and value/cost → profit. Near-zero links,
invalid documented ranges and a broken profit identity changed the deliverable from a performance
dashboard into a measurement audit.

### Supplied findings were treated as hypotheses

All five archive claims received explicit populations, operators, observed outputs, caveats and
decisions. The rain claim was corrected during G7 from “rejected” to “unsupported as specified” because
the required Clear comparator does not exist. That distinction matters: an unavailable comparison is
not evidence for the opposite conclusion.

### Filtered browser state gained an independent contract

The shared metric verifier checks release-level DOM values. Client-side filters initially reused those
release metric IDs, making filtered values impossible to reconcile honestly. Selection metrics now use
`selected.*` and `selected_corridor.*`, while `model/verify_selection.py` recomputes default, kitchen,
zone, rider, month and zero-row states directly from curated Parquet.

### The poster was read rather than merely measured

The first G7 stranger review found that the forensic evidence row was technically present but too
small. A failing browser assertion established minimum support-row and label sizes before the layout
was rebalanced. The final 2560×1440 poster fits exactly and keeps the thesis, decision boundary and
evidence legible without interaction.

## What changed during QA

- Rain moved from rejected to unsupported because Clear is absent.
- Reader-facing `REJECTED` labels became `CONTRADICTED`; the machine verdict remains stable.
- “Safe now” became “Descriptive use only” to avoid implying operational approval.
- Absolute synthetic-language claims became a bounded “synthetic-pattern audit.”
- The guided tour gained a focus trap and trigger-focus restoration after tests failed.
- All interactive targets were raised to at least 44×44px.
- Dynamic allocation values received selection-scoped metric IDs and six-state reconciliation.
- Four brief requirements that lacked dedicated poster panels received query-backed closure in
  `REQUIREMENTS.md`: congestion→cost, volume→financial health, temporal allocation and the requested
  five-way interaction.

## What was expensive

- Poster evidence density required multiple measured layout passes.
- Maintaining the distinction between release-level statistical evidence and filtered descriptive
  counts required a separate verifier rather than weakening the shared zero-tolerance contract.
- The challenge brief asks operational questions that the archive cannot semantically answer. Closing
  every bullet honestly took more work than computing attractive but invalid KPIs would have.

## Transferable lessons

1. **A filtered value needs a filtered metric identity.** Do not reuse a release-level metric name for
   client state that changes under filters.
2. **An absent comparator changes the verdict class.** “Cannot reproduce as specified” is unsupported,
   not automatically contradicted.
3. **A complete requirements trace should include unsupported questions.** Omission makes a dashboard
   look selective; a fail-closed query and collection requirement make the boundary actionable.
4. **Audit the modal state separately.** Standard page Axe runs intentionally suppress the first-run
   tour, so the dialog needs its own focus and accessibility harness.
5. **Readability assertions can encode visual critique.** Poster-fit tests catch clipping; minimum row
   and label assertions catch technically fitting but unusable evidence.
6. **Machine verdicts and reader language can differ without corrupting the model.** Stable analytical
   enums can map to clearer public labels at the presentation boundary.

## Promotion decision

No shared `dna-kit` component was promoted this month. The new filtered-state verifier is intentionally
month-local because its filter grammar and metric namespace are release-specific. If a second month
needs the same pattern, extract its URL-state scraper and parameterized DuckDB filter builder into a
shared verification tool after proving the common interface.

## Final verification

- 8 integrity tests
- 18 model tests
- 21/21 Malloy views
- 5 frontend unit tests plus typecheck and production build
- 206 live and 206 poster metrics reconciled
- 163 selection metrics across each of six states reconciled
- 46/46 interaction assertions
- zero Axe violations across four surfaces and the tour in both themes
- 1,488ms cold load; 1ms maximum interaction-to-paint
- exact 2560×1440 poster with zero clipping
- CVD, greyscale, 200% zoom and reduced-motion evidence

Self-score: **31/34**.
