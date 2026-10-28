# app

This month's dashboard.

```bash
just dev <YEAR> <MONTH>          # from the repo root - preferred
# or, if deps are already installed:
pnpm dev                          # from this directory
```

Runs at http://localhost:5173.

Deps are installed by the root `pnpm install` (this is a pnpm workspace member).
Never run `npm install` here - it would create a nested `node_modules` that shadows the workspace
link to `@onyxdata/dna-kit`.

Routes: `/` live interactive · `/poster` the 2560x1440 submission artifact.

## Non-negotiables

- Every displayed figure carries `data-metric` and `data-value`, and has a matching
  SQL expression in `../model/metric_checks.yml`. `just verify` recomputes all of them.
- No hardcoded numbers. Loading skeleton, never a plausible placeholder.
- Every visual emits *and* consumes cross-filters.
- Chart titles state the finding, not the field.
- Every chart wrapped in `<ChartFigure>` so screen readers get the table.
- Month identity lives in `uno.config.ts` and `src/theme.css`. Reusable code goes to `dna-kit`.
