# Requirements trace - 2026/10 Sunrise Coffee

The G7 disposition of every requirement in the archive's `CHALLENGE_BRIEF.md`. The challenge page repeats
September's food-delivery bullets, so the archive brief is the spec (see `brief.md`).

**Answered** means the release supports a bounded answer that is visible in the app. **Answered (ledger)**
means the answer is query-backed in `analysis/insights.md`. It stays off the poster because the answer
is "no difference", and a chart of no difference would crowd out the thesis. **Unsupported** means the
release cannot support the requested conclusion, and the app says so. Every number below is
reproduced by `model/metric_checks.yml`, `model/verify_selection.py` or `analysis/integrity.py`.

A note on format comparisons: the estate has 58 High-Street stores, 2 Transport-Hub stores and no
Retail-Park stores. The two hubs are exactly the two Train-Station stores, so the app's **Location →
Train Station** filter is the format filter, and the n = 2 caveat is shown wherever format appears.

## Analysis areas

| # | Requirement | Visible element | Query evidence | Disposition |
|---|---|---|---|---|
| A1 | Format and region profitability; review/closure candidates by status | Region cost map; format note (n = 2 vs 58, permutation p 0.22); Sixty cups; decision 2; drawer per store | I1; region margin vs fixed cost r = −0.9766, vs revenue r = 0.1009; store 32 is the only store with negative net profit over 24 months | **Answered.** Margin ranks by cost, not by demand. Format is unrankable. The source `profitability_status` label fails its own bands on 600 rows, so the app re-derives status from margin (I5) |
| A2 | Loyalty: adoption → member share and ATV; net value; where it works | Loyalty panel (two scatters plus break-even bars); decision 3 | I3; r(adoption, member share) = 0.9984, r(adoption, revenue) = 0.0027; lift per +10pp £5.44 [−514, 525]; upper bound £1,747 vs £1,935 needed | **Answered.** Loyalty buys share, not spend. Member ATV is **unsupported** (no member-level ATV field) |
| A3 | Revenue mix across stores, formats and time; food share; category margins | Ledger only | Q9–Q11 below | **Answered (ledger).** Mix is flat across formats and years. Category growth is **unsupported** because `product_id` names one top product per day |
| A4 | Day of week, bank holidays, seasonality, format response | The week panel (revenue bars over staff-hour bars); decision 4; Location filter | I4; weekend −24.37%, staff hours 41.38 vs 41.63 (p 0.547), 24.81% surplus; bank holidays −33.11%; season KW p 0.8865 | **Answered.** The week is the only demand pattern. There is no season |

## Questions

| # | Question | Visible element | Answer | Disposition |
|---|---|---|---|---|
| Q1 | Highest-margin format | Format note in the region panel; Train Station filter | Hub 25.14% vs street 18.59%, permutation p = 0.2182, n = 2 | **Unsupported as a format effect** |
| Q2 | Regions concentrating loss months | Region map (London last, 8.5%); selection bar "loss months" under a region filter; decision 2 | London 49 of 168 store-months, driven by £32.6k fixed cost | **Answered** |
| Q3 | Does rent buy revenue? | Sixty cups (sorted by rent + staffing; the rim stays level); hero R² 0.80 vs 0.12 | r(rent, revenue) = 0.1469; r(rent, margin) = −0.4203 | **Answered: no** |
| Q4 | Most improved / deteriorated stores | "Revenue forgets, cost remembers" scatters; noise band £51.4k | Year-on-year revenue r = 0.0503; profit r = 0.6779; no store's change exceeds noise | **Answered: no change is distinguishable from noise** |
| Q5 | Adoption → member revenue share | Loyalty scatter 1 (r = 0.998) | r = 0.9984 | **Answered** (near-mechanical) |
| Q6 | Do members spend more per transaction? | Loyalty panel note | No member ATV field; proxies r = −0.0023 and −0.0476 | **Unsupported as specified** |
| Q7 | Net loyalty value per store | Break-even bars; decision 3 | Best-case lift is below the redemption cost it would need to fund | **Answered: not net-positive on evidence** |
| Q8 | Adoption by format / region | Ledger; Region filter plus loyalty scatter highlight | Region KW p = 0.342; format n = 2 | **Answered (ledger): no difference** |
| Q9 | Revenue split by stream and format | Ledger | Espresso 45.7%, food 26.1%, filter 19.2%, beans 9.1%; hub vs street < 1pp apart on every stream | **Answered (ledger)** |
| Q10 | Highest-margin categories, and growth | Ledger | Filter 0.883 … Beans 0.677 (price list); growth unsupported | **Answered (margin) / unsupported (growth)** |
| Q11 | Is retail-beans (or food) share growing? | Ledger | Beans +0.245pp/yr p = 0.143; food −0.359pp/yr p = 0.252 | **Answered (ledger): no trend** |
| Q12 | Weekday vs weekend by format | Week panel under Location → Train Station | Street −24.17%, hub −26.58% | **Answered: same shape** |
| Q13 | Bank holidays, hubs vs streets | Week panel note under the same filter | Street −33.27%, hub −29.67% (hub n = 8 days) | **Answered: both fall** |
| Q14 | Best / worst profit months; repeating? | Decision 4 (season p 0.89); Year filter | Best 2024-11, worst 2023-11; month-pattern YoY r = −0.4887 | **Answered: no repeating season** |

## Deliverables

| # | Deliverable | Where |
|---|---|---|
| D1 | Executive summary: 3–5 findings and one headline recommendation | Masthead thesis + subhead ("Pick 2025 sites on cost, prove loyalty before funding it, and staff to the week"); four decisions; `SUBMISSION.md` |
| D2 | Detailed analysis: trends, formats, mix, store-level status, loyalty net value | Five evidence panels; store drawer (24 months, margin rank, loss months, re-derived status); `analysis/insights.md` I1–I5 |
| D3 | Actionable insights: stores/regions to review, loyalty verdict, staffing/promo | Decision rail 1–4 plus the source audit card |

## Archive premises (H1–H5)

| Premise | Result | Where shown |
|---|---|---|
| H1 three formats | 58 / 2 / 0 | Format note; source audit |
| H2 daily grain is store × day | 10,000 rows over 8,910 store-days (20.3%); does not reconcile to the P&L (r = 0.031) | Week panel note; source audit |
| H3 rent/staffing match `dim_store` | 0 of 1,440 rows match | Source audit (24-row contract, 7 hold) |
| H4 product margin range / launch date | 0.66–0.904; 36 of 40 launch dates null | Source audit |
| H5 daily schema as documented | Undocumented dwell-time column; `product_id` is the top product | Source audit |
