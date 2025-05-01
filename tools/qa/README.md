# QA harnesses

Playwright checks that every month's app must pass at G6/G7. Promoted out of `2025/05/app/`
after the first month, per `.workbench/docs/LEARNINGS.md`: *next month must start faster than this one did.*

All of them take the app's URL as `$QA_URL` (default `http://localhost:4173`) and the month's
tour-storage key as `$QA_TOUR_KEY`, so nothing here is month-specific.

```bash
cd <YYYY>/<MM>/app
pnpm exec vite build && pnpm exec vite preview --port 4173 &

QA_TOUR_KEY=<the month's tour key> node ../../../tools/qa/a11y.mjs        # axe, 4 contexts
QA_TOUR_KEY=... node ../../../tools/qa/overflow.mjs                        # horizontal overflow
QA_TOUR_KEY=... node ../../../tools/qa/perf.mjs                            # cold load + interaction
QA_TOUR_KEY=... node ../../../tools/qa/measure.mjs                         # poster fits 1440?
QA_TOUR_KEY=... node ../../../tools/qa/shot2.mjs <url> <out.png> <w> <h> skip
```

`interact.mjs` is the one file that stays partly month-specific - the interaction matrix asserts
this month's actual numbers and selectors. Copy it into the month and edit the assertions; keep the
structure (cross-filter both directions, chip bar, URL state, drill breadcrumb, clear-all, keyboard
focus, accessible tables, tour open/close, deep link, empty state).

## What each one caught in 2025/05

| Harness | Found |
|---|---|
| `overflow.mjs` | `.sr-only` on a `<table>` forcing 1087px of page width at a 375px viewport |
| `a11y.mjs` | `aria-selected` on `role="button"`; `role="img"` making focusable chart marks presentational |
| `measure.mjs` | poster overflowing its 1440px canvas by 260px, with panels overlapping |
| `perf.mjs` | DuckDB-WASM cold load at 30s against a 3s budget - the reason for the stack deviation |
