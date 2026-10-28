# Submission - 2026/10 Sunrise Coffee Chain Analytics

**Status:** this is post-deadline portfolio and practice work. The challenge closed on 24 October 2026.
It was completed afterwards and will not be presented as a live competition entry.

## LinkedIn post

```text
Same cup, different rent.

Sixty Sunrise Coffee stores sold £89.69M over 2023–24. On revenue they are interchangeable: a
store's 2023 revenue says nothing about its 2024 revenue (r = 0.05), regions don't differ (p = 0.77)
and there is no season (p = 0.89).

What separates them is what they cost to run. Rent plus staffing explains 80% of the variance in
store profit; revenue explains 12%. Split the estate at the median fixed cost and margin almost halves,
from 24.2% to 13.5%, on the same revenue per store-month. London's 8.5% margin is a rent bill, not
a demand problem.

Loyalty buys share, not spend. Adoption moves member share of revenue almost perfectly (r = 0.998)
and revenue not at all (r = 0.003). Even the most optimistic lift (£1,747 per store-month) falls short
of the £1,935 it would need to fund £1.73M of redemptions.

The only real demand pattern is the week. Weekends trade 24.4% below weekdays, yet the rota schedules
the same hours, so about a quarter of weekend hours are surplus at weekday productivity.

Recommendations: screen 2025 sites on rent plus staffing; review South London Corner (the only store
negative over 24 months) and London's cost base; run a holdout before funding loyalty further; and
staff to the week, not the season.

Source audit: only 7 of the 24 promises in the data dictionary hold in the delivered files, so status
and rent band are re-derived from their documented definitions rather than taken from the labels.

Built with Python, Polars, SciPy, DuckDB, Parquet, Malloy, SolidJS, UnoCSS and Playwright. Every
figure on the dashboard is independently recomputed from curated data, including eight filter and
drill states.

@OnyxData @SmartFramesUI @DataCareerJumpstart @packt #dataDNA
```

## Submission checklist

- [ ] Follow Onyx Data on LinkedIn before any future live entry
- [x] Single image ready: `exports/dashboard.png` (2560×1440, under 1 MB)
- [x] Tag union checked against the challenge page and the archive (`brief.md`)
- [x] Hashtag: `#dataDNA`
- [x] Portfolio/practice disclosure included

## Entry-form values

| Field | Value |
|---|---|
| Tool used | Other: custom accessible web dashboard |
| Power BI report | n/a |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **Same Cup, Different Rent** |
| Portfolio status | Practice work completed after the challenge deadline |

## Portfolio description

This is a commercial review of 60 Sunrise Coffee stores over 24 months, written for the Chief
Commercial Officer.

**Thesis: same cup, different rent.** Across stores, regions, years and calendar months, revenue is
statistically indistinguishable from chance. Store identity explains exactly the share of revenue
variance that random labels would. Margin is instead set by the fixed cost each store carries.

The signature visual draws every store as a cup. Columns are sorted by rent plus staffing, and each
cup's height is its average monthly revenue. Cost of goods, rent plus staffing, loyalty redemption and
net profit fill the cup from the bottom up. The rims stay level while the profit layer shrinks from
left to right. Exactly one cup, South London Corner, overflows.

Four evidence panels follow:

- a regional cost map (margin tracks cost at r = −0.98)
- year-on-year scatters (revenue forgets, cost remembers)
- a loyalty test (share moves, spend does not)
- the staffing week, where weekend hours don't fall with weekend revenue

A decision rail turns each panel into an action. A 24-row source audit tests every promise in the
archive's data dictionary against the delivered files.

### Technical depth

The raw archive is never modified. A tested Python build writes eight curated Parquet tables with zero
dropped rows, and the build asserts that row count. The source `profitability_status` and rent band
are re-derived from their documented thresholds, because the supplied labels contradict their own
definitions on 600 store-months. A Malloy semantic layer defines six sources and 22 views, all of which
run clean. The test suite has 11 integrity tests, 16 metric tests and 6 selection-verifier tests in
Python, plus 14 frontend unit tests (vitest).

The SolidJS dashboard aggregates in the browser from compact JSON. It offers:

- four URL-backed filters (region, location, cost half, year) that recompute the selection bar, the
  week panel and, under a year filter, every cup and region mark
- a per-store drill-down drawer with 24 months of P&L and the re-derived status
- browser Back and deep links
- a guided tour, light/dark/system themes and screen-reader tables

DuckDB independently recomputes all 656 numbers rendered on the live route and all 649 on the poster
route, at zero tolerance. A month-local verifier also reconciles every filter-dependent and drill-down
figure in eight URL states, including a real zero-store state, directly against the curated Parquet.

## Artifact inventory

| Artifact | Path |
|---|---|
| Submission poster, 2560×1440 | `exports/dashboard.png` |
| Live dashboard | `app/`: `/` and `/poster` |
| Challenge framing | `brief.md` |
| Requirements trace | `REQUIREMENTS.md` |
| Data profile and source contract | `analysis/profile.md`, `analysis/integrity.py` |
| Five-insight evidence ledger | `analysis/insights.md` |
| Assumptions | `assumptions.md` |
| Curated model | `model/build.py`, `data/curated/` |
| Semantic layer | `model/model.malloy` |
| Metric verification | `model/test_metrics.py`, `model/metric_checks.yml`, `model/verify_selection.py` |
| Interaction matrix | `app/interact.mjs` |
| Accessibility and QA evidence | `exports/qa/`, `exports/a11y/` |
| G7 scorecard | `.workbench/2026/10/SCORECARD.md` |

## One-paragraph version

Sunrise Coffee's 60 stores sell alike: no store, region, year or season carries a revenue signal
that repeats. Their profit is set by what each store costs to run. Fixed cost explains 80% of the
variance in store profit, and splitting the estate at the median fixed cost separates a 24.2% margin
from a 13.5% one on identical revenue. Loyalty adoption drives member share but not revenue, and
even the best-case lift falls short of the redemption cost it would need to fund. Weekends trade a
quarter below weekdays on the same staff hours. The CCO should choose 2025 sites on rent plus
staffing, review South London Corner and London's cost base, test loyalty with a holdout before
funding it further, and staff to the week.
