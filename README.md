# onyxdata-challenges

Every [OnyxData DataDNA](https://datadna.onyxdata.co.uk/challenges/) monthly dataset, solved to
portfolio grade — each new challenge as it lands, plus the 52-dataset back catalogue going back to
January 2021.

Each month ships the same way: one dataset in, one 16:9 poster out, backed by a live interactive
dashboard. The dashboards are the visible part. `packages/dna-kit` — the shared toolkit they are all
built on — is the part that compounds.

**14 months shipped.** Newest first:

| Month | Challenge | Poster |
|---|---|---|
| 2026-08 | Connected Tables, Disconnected Risk | [png](2026/08/exports/dashboard.png) |
| 2026-07 | Global AI Adoption & Workforce Displacement | [png](2026/07/exports/dashboard.png) |
| 2026-06 | UK Fintech Neobank — Transaction Health | [png](2026/06/exports/dashboard.png) |
| 2026-05 | Music Streaming Platform Performance | [png](2026/05/exports/dashboard.png) |
| 2026-04 | Maritime Logistics & Terminal Efficiency | [png](2026/04/exports/dashboard.png) |
| 2026-02 | Pharmacy Sales & Profitability | [png](2026/02/exports/dashboard.png) |
| 2025-12 | Animal Shelter Operations | [png](2025/12/exports/dashboard.png) |
| 2025-11 | E-commerce Analytics | [png](2025/11/exports/dashboard.png) |
| 2025-10 | Consumer Financial Complaints (CFPB) | [png](2025/10/exports/dashboard.png) |
| 2025-09 | Credit Risk (Nova Bank) | [png](2025/09/exports/dashboard.png) |
| 2025-08 | Fitness Membership (MyGym) | [png](2025/08/exports/dashboard.png) |
| 2025-07 | Customer Satisfaction and Loyalty | [png](2025/07/exports/dashboard.png) |
| 2025-06 | Social Media Content Performance | [png](2025/06/exports/dashboard.png) |
| 2025-05 | Mobile Phone Sales | [png](2025/05/exports/dashboard.png) |

---

## What's in here

One folder per month, `<YYYY>/<MM>/`. Everything for that challenge lives inside it — the raw
download, the profiling notes, the insight ledger, the semantic model, the app, and the exported
poster.

```
2025/05/
├── Onyx-Data-...-May-2025/    raw dataset, exactly as downloaded — READ ONLY
├── brief.md                   scraped scenario, requirements, submission mechanics
├── assumptions.md             every judgement call, and why
├── data/curated/              parquet star schema
├── analysis/
│   ├── profile.md             schema, nulls, integrity, data quality findings
│   └── insights.md            claim / query / output / caveat / so-what
├── model/
│   ├── build.py               raw → curated
│   └── model.malloy           semantic layer
├── design/wireframe.md        ASCII wireframe of the poster
├── app/                       the dashboard
├── exports/dashboard.png      the submission artifact
└── SUBMISSION.md              LinkedIn copy + portfolio description
```

Shared at the root:

| Path | What |
|---|---|
| `challenges.yml` | Every registered dataset — status, URLs, access notes. The source of truth. |
| `packages/dna-kit/` | Design tokens, cross-filter store, stats helpers, a11y layer. |
| `tools/` | Scraping, profiling, metric verification, prose-number lint, poster export, and `tools/qa/` — axe, contrast, colour-vision, overflow, perf and interaction harnesses. |
| `templates/_month/` | Skeleton for a new month. |
| `docs/STACK.md` | Pinned versions. Wins over any prose, including this file. |
| `docs/DATA_ACCESS.md` | Why the older downloads fail, and how to recover them. |

## The stack

No backend, no component library. Python is a build tool; the browser gets parquet and a signals
runtime.

| Layer | Choice |
|---|---|
| Data | Python 3.14 + uv + Polars + DuckDB, build-time only |
| Semantic | **Malloy** — a real modelling language, in place of the rubric's DAX line |
| UI | **SolidJS** — fine-grained signals, so a cross-filter updates one chart, not the tree |
| Styling | **UnoCSS** — per-month token presets, so each challenge reskins without forking components |
| Charts | Hand-rolled SVG — every mark is a focusable DOM node, so keyboard traversal and screen-reader labelling are native |
| Export | Playwright — renders the 2560×1440 submission PNG |

Month apps are pnpm workspace members alongside `packages/dna-kit`, so kit edits are live everywhere
with no rebuild or relink.

## Getting started

| Tool | macOS | Linux | Windows |
|---|---|---|---|
| [just](https://just.systems) | `brew install just` | `apt install just` | `winget install Casey.Just` |
| [uv](https://docs.astral.sh/uv/) | `brew install uv` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | `irm https://astral.sh/uv/install.ps1 \| iex` |
| Node 22+ | `brew install node` | via [nvm](https://github.com/nvm-sh/nvm) | `winget install OpenJS.NodeJS` |
| [pnpm](https://pnpm.io) | `corepack enable pnpm` | `corepack enable pnpm` | `corepack enable pnpm` |

Python 3.14 arrives with `just setup` via uv — you don't need it beforehand. `just doctor` tells you
what's missing.

```bash
just doctor                # verify the toolchain
just setup                 # python + deps + playwright chromium + pnpm install

just new <year> <month>    # scaffold a month from templates/_month
```

Then walk a month through the pipeline, in order:

```bash
just brief 2025 05         # scrape the challenge page into brief.md
just fetch 2025 05         # download and unzip the dataset
just profile 2025 05       # EDA report into analysis/profile.md
just build-model 2025 05   # raw → curated parquet
just malloy 2025 05        # compile the semantic layer
just dev 2025 05           # local dashboard at :5173
just verify 2025 05        # recompute every rendered number (needs `just dev` running)
just shoot 2025 05         # export exports/dashboard.png at 2560×1440
```

Eight gates, each ending in a reviewable artifact: recon → profile → **insight ledger** → semantic
model → design → build → verify → ship. The ledger gate is the one that decides whether a month is
merely competent; it is the one never to skip.

## Status

Challenges from May 2025 onward come with a full brief, a scenario and published rubrics, and are
worked oldest-first as they're published. The 52 datasets before that are playground-only — no
brief, no persona, gated downloads, and formats ranging from XLSX to DOCX to JPG. They're backfill,
currently blocked on access; see `docs/DATA_ACCESS.md`.

`challenges.yml` has the live picture of what's registered, done, and blocked.

## Licence

Code is [MIT](LICENSE). Datasets belong to OnyxData and their original sources — see [NOTICE.md](NOTICE.md).
