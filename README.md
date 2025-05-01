# onyxdata-dnakit

Solving every [OnyxData DataDNA](https://datadna.onyxdata.co.uk/challenges/) monthly dataset to
portfolio grade - the 52-dataset back catalogue from January 2021, plus each new monthly
challenge as it lands - with a shared toolkit that gets better every month.

The dashboards are the output. **`packages/dna-kit` is the actual product.**

---

## Prerequisites

| Tool | macOS | Linux | Windows |
|---|---|---|---|
| [just](https://just.systems) | `brew install just` | `apt install just` or `cargo install just` | `winget install Casey.Just` |
| [uv](https://docs.astral.sh/uv/) | `brew install uv` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | `irm https://astral.sh/uv/install.ps1 \| iex` |
| Node 22+ | `brew install node` | via [nvm](https://github.com/nvm-sh/nvm) | `winget install OpenJS.NodeJS` |
| [pnpm](https://pnpm.io) | `corepack enable pnpm` | `corepack enable pnpm` | `corepack enable pnpm` |

Python 3.13 is installed by `just setup` via uv - you don't need it beforehand.

`just doctor` checks all of this and tells you what's missing.

## Quick start

```bash
just doctor                # verify the toolchain
just setup                 # python 3.13 + deps + playwright chromium + pnpm install

# start a month (copies templates/_month into <year>/<month> and registers it in the workspace)
just new <year> <month>

# run the pipeline for a month, in order
just brief 2025 05         # G1 - scrape the challenge page into brief.md
just fetch 2025 05         # G2 - download and unzip the dataset (profile.py needs it)
just profile 2025 05       # G2 - EDA report into analysis/profile.md
just build-model 2025 05   # G4 - raw -> curated parquet
just malloy 2025 05        # G4 - compile the hand-written semantic layer
just dev 2025 05           # G6 - local dashboard at :5173
just verify 2025 05        # G7 - recompute every rendered number (needs `just dev` in another terminal)
just shoot 2025 05         # G8 - export exports/dashboard.png at 2560x1440
```

---

## How the work is organised

One month per folder, `<YYYY>/<MM>/`. Everything for that challenge lives there.

```
2025/05/
├── Onyx-Data-...-May-2025/    raw dataset, exactly as downloaded - READ ONLY
├── brief.md                   scraped scenario, requirements, submission mechanics
├── assumptions.md             every judgement call, and why
├── data/curated/              parquet star schema
├── analysis/
│   ├── profile.md             schema, nulls, integrity, data quality findings
│   └── insights.md            THE LEDGER - claim / query / output / caveat / so-what
├── model/
│   ├── build.py               raw -> curated
│   └── model.malloy           semantic layer
├── design/
│   └── wireframe.md           ASCII wireframe of the poster
├── app/                       the dashboard
├── exports/dashboard.png      the submission artifact
└── SUBMISSION.md              LinkedIn copy + portfolio description
```

Shared, at the root:

| Path | What |
|---|---|
| `challenges.yml` | Every registered dataset, with status, URLs, and access notes. |
| `docs/STACK.md` | Pinned versions. Source of truth over any prose. |
| `docs/DATA_ACCESS.md` | Why Era 1 downloads fail and how to recover them. |
| `packages/dna-kit/` | Design tokens, cross-filter store, stats helpers, a11y layer. |
| `tools/` | Scraping, profiling, metric verification, prose-number lint, scaffold gate, poster export, and `tools/qa/` - axe, contrast, colour-vision, overflow, perf and interaction harnesses. |
| `templates/_month/` | Skeleton for a new month. |
| `pnpm-workspace.yaml` | Month apps are workspace members - one `pnpm install` wires them all to dna-kit. |
| `.workbench/` | **Not tracked.** Local working notes - the pipeline playbook, scoring rubrics, running lessons log, and each month's design rationale, self-score and retro. Referenced from comments throughout; kept out of the repo on purpose. |

---

## Two eras, different problems

The archive splits, and the split matters more than it looks.

**Era 2 - 2025-05 onward, one per month.** Full challenge pages: a business scenario, a stated
objective, sometimes an explicit requirements list, published rubrics, and a portfolio gallery of
scored entries to benchmark against. Datasets are direct, ungated ZIPs. **Start here.**

**Era 1 - 2021-01 to 2025-04, 52 datasets.** Playground only. No brief, no scenario, no persona -
you invent the business framing before anything else. Downloads are account- or email-gated.
Formats are messy: XLSX, TXT, DOCX, PDF, even JPG, often with the data dictionary buried in a Word
doc. Roughly a dozen are Onyx-generated synthetic sets that exist nowhere else.

Treat Era 1 as backfill. See `docs/DATA_ACCESS.md` before attempting one.

---

## What "good" means here

The submission is a **single image** posted to LinkedIn. Everything must collapse into one 16:9
poster that reads standalone - while also working as a live interactive app.

Three rubrics are in play - the judge rubric plus two automated ones. Two things dominate:

- **Interactivity is 14 of the judge rubric's 34 points** - cross-filtering, drill-down, response
  time, and an in-report tutorial overlay. Not polish. The score.
- **Accessibility is a named automated-rubric dimension and a 30-point award category.** Almost no
  entrant builds an accessible dashboard. It is the cheapest available edge.

A competent dashboard scores 3/5. Getting to 4-5 needs a stated thesis, non-obvious findings, and
a visual identity that couldn't be swapped with any other month's.

---

## Stack, and why it's unusual

Be unconventional where it costs nothing; conventional where the rubric punishes you.

| | | |
|---|---|---|
| Python 3.13 + uv + Polars + DuckDB | data layer | build-time only |
| **Malloy** | semantic layer | a real modelling language - our answer to the rubric's "DAX / data modelling" line |
| **SolidJS** | UI | fine-grained signals: a cross-filter updates one chart, not the tree. Response time is scored |
| **UnoCSS** | styling | per-month token presets, so each challenge reskins without forking components |
| Hand-rolled SVG | charts | every mark is a focusable DOM node, so keyboard traversal and screen-reader labelling are native rather than bolted onto a canvas. ECharts is declared for standard chart types but not yet used |
| Observable Plot | editorial charts | declared for static annotated panels; not yet used |
| DuckDB-WASM | in-browser SQL | shipped in dna-kit; every month so far aggregates in memory instead - see challenges.yml 2025/05 for why |
| Playwright | export + self-critique | renders the submission PNG; screenshots for design review |

**No backend** - Python is a build tool, not a server. **No component library** - it would make
every dashboard a sibling of the last. **Deployment deferred** until the kit stabilises.

JS packages are managed with **pnpm workspaces**. `packages/dna-kit` and every `<YYYY>/<MM>/app` are
workspace members, so month apps consume dna-kit via `workspace:*` - edits to the kit are live in
every month with no rebuild or relink. `templates/**` is excluded from the workspace because the
template app shares a package name with every month it spawns; `just new` renames the copy.

Versions in `docs/STACK.md`; re-verify periodically, this program runs for months.

---

## The pipeline

The process is deliberately gated, because the tempting path - go straight from "downloaded the
zip" to "built a dashboard" - skips the part that actually earns the score. Without a forced stop
to hunt for a non-obvious finding, a month caps out at 3/5.

Eight gates, each ending in a stop and a reviewable artifact: recon → profile → **insight ledger**
→ semantic model → design → build → verify → ship. The ledger gate is the one that decides the
Insights score; it is the one never to skip.

The full checklist and the per-gate definition of done live in `.workbench/` (untracked).

---

## Status

`challenges.yml` is the source of truth: what is registered, what is done, what is blocked.
Era 2 is worked oldest-first as each challenge is published; Era 1 is backfill, blocked pending
access.
