# STACK.md - pinned versions

**Source of truth.** Where this file and any prose disagree, this file wins.

Re-verify in Phase 0 and whenever something breaks - this program runs for months.

## Runtime

| Thing | Pin | Notes |
|---|---|---|
| Python | 3.13.x | current stable line. don't chase the next minor when it lands. Skip free-threaded builds, no benefit here |
| Node | 22 LTS or 24 | |
| pnpm | 10.x | pinned via `packageManager` in the root package.json; enable with `corepack enable pnpm` |
| uv | latest | Python env + lockfile |
| just | latest | task runner |

**Package manager: pnpm, not npm.** Workspaces make `packages/dna-kit` and every `<YYYY>/<MM>/app`
one install. Month apps depend on the kit via `workspace:*`, so kit edits are live everywhere with
no relink - which matters when the kit changes every month by design. pnpm's content-addressed store
also keeps every month app from carrying its own copy of ECharts and DuckDB-WASM.

Keep pnpm's strict, non-flat `node_modules`. If a Vite plugin breaks on a missing transitive
dependency, add it to that package's `package.json` - do not reach for `node-linker=hoisted`,
which hides the real problem.

## Python

| Package | Pin | Role |
|---|---|---|
| polars | latest | dataframes |
| duckdb | latest | build-time SQL |
| patito | latest | Polars-native schema contracts on curated output |
| python-docx | latest | Era 1 data dictionaries in DOCX |
| pdfplumber | latest | Era 1 data dictionaries in PDF |
| openpyxl | latest | XLSX ingest |
| pytest | latest | metric assertions |
| ruff | latest | lint + format |
| scipy, numpy | pinned in pyproject | tests and integrity checks import them directly |
| pandas | pinned in pyproject | analysis/integrity.py, and one month's build.py |
| Pillow | pinned in pyproject | colour-vision-deficiency simulation in tools/cvd.py |
| pyarrow | pinned in pyproject | parquet IO |

## Frontend

| Package | Pin | Role | Notes |
|---|---|---|---|
| solid-js | ^1.9 | UI | fine-grained signals; substitute Svelte 5 only with a stated reason |
| vite | ^8 | build | |
| typescript | ^5.9 | | TS 7 (Go rewrite) is upcoming - do not adopt mid-program |
| unocss | ^66.7 | styling | per-month token presets |
| echarts | ^6.1 | interactive charts | declared, not yet imported - every chart shipped so far is hand-rolled SVG |
| @observablehq/plot | ^0.6 | editorial charts | declared, not yet imported |
| @duckdb/duckdb-wasm | ^1.32 | in-browser SQL | client shipped in dna-kit; months aggregate in memory so far |
| vitest | ^4 | unit tests | |
| playwright | ^1.62 | poster export + self-critique screenshots | |
| @axe-core/playwright | ^4.12 | accessibility audit | drives tools/qa/a11y.mjs |
| vite-plugin-solid | ^2.11 | build | required by every month's vite.config.ts |
| @malloydata/malloy, @malloydata/db-duckdb | ^0.0.426 | semantic layer | compiled by tools/run_malloy.mjs |
| @axe-core/playwright | latest | a11y | |

## Explicitly rejected

| Rejected | Why |
|---|---|
| TypeScript 7 | The Go rewrite drops `ts.ScriptTarget` and friends from the JS compiler API, which `tools/lint_prose_numbers.mjs` builds its AST with. `tsc --noEmit` is fine; the programmatic surface is not. Held at 5.x until the linter is ported |
| Vue 4 | Still pre-release (Rust compiler rewrite); stable Vue is 3.5.x. Not a foundation for a multi-month program |
| React 19 | Fine, but Solid's reactivity model is a better fit for cross-filter dashboards. React 19.2.x is current major; no React 20 announced |
| Chakra / shadcn / Mantine | A component library makes every dashboard a sibling. The whole point is a distinct identity per month |
| Tailwind | Not wrong - UnoCSS gives the same model plus per-month presets. Panda CSS is the acceptable substitute |
| FastAPI / Litestar | No backend needed. Python is build-time. If a real need appears (HTTP range requests, export endpoint), use Litestar + Granian and say why |
| Streamlit | Design ceiling caps the Design score |
| Niche chart libraries | Interactivity is the heaviest scored item. Don't gamble it |

## Change log

| Change | Why |
|---|---|
| Initial pins | Verified against current releases |
