# Insight ledger - 2026/10 Sunrise Coffee Chain

**The gate that decides the Insights score. No query, no claim.**

The executable analysis is `analysis/integrity.py::analyze` (raw CSVs → `analysis/integrity.json`),
pinned by `analysis/test_integrity.py`. Every inline query below runs in DuckDB from inside the raw
archive folder (`.../Sunrise Coffee Chain/`) and reproduces the stated output exactly. G4 must
independently reproduce every published figure from curated Parquet.

## Thesis

> **Same cup, different rent.** Sunrise's 60 stores sell indistinguishably - no store, region, format,
> month or season carries a reproducible revenue signal - so the regional margin league table the
> commercial team is about to use for 2025 site selection is a fixed-cost league table (r = −0.98).
> Pick sites on what they cost to run, prove loyalty with a holdout before funding it, and staff to
> the week, which is the only demand pattern in the data.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | £89.69M revenue and £16.88M net profit over 24 months, an 18.82% estate margin. Regional margins run from 28.4% (Northern Ireland) to 8.5% (London): a ready-made expansion ranking. (I1) |
| **Complication** | That ranking is a cost map. Regional margin tracks rent + staffing at r = −0.9766 and revenue at r = 0.1009; region revenue differs by 7.6% end to end and is indistinguishable (KW p = 0.767). Store identity explains exactly the 4.1% of revenue variance that random labels would; a store's 2023 revenue does not predict its 2024 revenue (r = 0.0503). (I1, I2) The loyalty programme moves member *share* almost perfectly (r = 0.9984) but not revenue, ATV or profit, and costs £1.73M in redemptions. (I3) |
| **Resolution** | The only demand signal is the week: weekends trade 24.4% below weekdays and bank holidays 33.1% below, while staff hours do not move (41.4 → 41.6). Expand where occupancy cost is lowest, run a loyalty holdout before further investment, and take ~a quarter of weekend hours out of the rota. (I4) The source contract shows which supplied labels cannot be trusted along the way. (I5) |

## Question storm

Declared before the narrative was chosen. Brief questions are `Q1-Q14` (see `brief.md`); the rest are
mine. Every answer is a key in `analysis/integrity.json`.

| # | Question | Answer / disposition |
|---:|---|---|
| 1 | Is one daily row one store-day? | No: 10,000 rows over 8,910 store-days; 1,006 store-days carry 2-4 rows with *different* revenue. Coverage 20.3% of 43,800 store-days. |
| 2 | Does the daily fact reconcile to the monthly P&L? | No: same scale (median implied 30.5 days) but store-month r = 0.0307. Two independent samples. |
| 3 | Is the calendar sound? | Yes for flags (0 mismatches, 17 correct E&W bank holidays). Ends 2024-12-30, not 12-31. Undocumented `School-Holiday` on 175 days. |
| 4 | Do the P&L identities close? | Yes: net profit (C09) and member split (C10) close on every row. |
| 5 | Does `profitability_status` follow its own bands? | No: 600 of 1,440 rows disagree (I5). |
| 6 | Does monthly rent/staffing match the store contract? | No: 1,440 of 1,440 rows differ (ratio 0.84-1.16 / 0.72-1.24). |
| 7 | How much revenue variance does store explain? | η² 0.0411 = the 59/1,439 that 60 random labels explain; KW p = 0.49. |
| 8 | Does store revenue repeat year to year? | No: r = 0.0503 (p = 0.70). Odd vs even months r = −0.0731. |
| 9 | Does store *profit* repeat? | Yes: r = 0.6779. Fixed cost repeats at r = 0.9906. |
| 10 | What explains store profit? | Fixed cost R² 0.803; revenue R² 0.1178. |
| 11 | Is there seasonality? | No: month-of-year revenue KW p = 0.8865; quarter revenue within 2.3%. |
| 12 | Is there a weekly pattern? | Yes: day-of-week η² 0.1672 in the daily fact, weekend −24.37%. |
| 13 | Does staffing follow the weekly pattern? | No: weekend 41.63 h vs weekday 41.38 h (MWU p = 0.547); r(hours, revenue) = 0.0032. |
| 14 | Does shift pattern change revenue? | No: η² 0.0005. |
| 15 | Does headcount explain staffing cost? | No: store-level r = 0.0847. |
| 16 | Can catalogue margins produce the P&L margin? | No: lowest product margin 0.660 > blended gross margin 0.621 (C20). |
| 17 | Does the top product of the day change gross margin? | No: r = 0.02 between daily gross margin and the top product's margin. |
| 18 | Is loss a store trait? | No: 58 of 60 stores had at least one loss month; only store 32 lost money over 24 months. |
| Q1 | Which format has the highest margin? | Transport-Hub 25.14% pooled vs High-Street 18.59% - but n = 2 stores, permutation p = 0.2182. **Unsupported as a format effect.** |
| Q2 | Which regions concentrate loss months? | London: 49 of 168 store-months (29.2%), then South-West 19.2%. χ² p < 1e-6 - driven by London's £32.6k fixed cost, not revenue. (status re-derived from margin; I5) |
| Q3 | Does rent buy revenue? | No: store r(rent, revenue) = 0.1469; r(rent, margin) = −0.4203. Rent erodes margin because it buys nothing. |
| Q4 | Which stores improved / deteriorated most? | Top: stores 42, 45, 24 (+£116.8k, +£116.5k, +£90.2k); bottom: 40, 32, 52. But the SD of annual changes (£50.5k) equals what monthly noise alone produces (£51.4k); 4 stores exceed 2 noise-SDs where ~2.7 would by chance. **No store's change is distinguishable from noise.** |
| Q5 | Adoption → member revenue share? | r = 0.9984 at store level. Near-mechanical. |
| Q6 | Do members spend more per transaction? | **Unsupported as specified**: no member-level ATV exists. Proxy: daily ATV vs loyalty transaction share r = −0.0023; store ATV vs adoption r = −0.0476. No sign members spend more. |
| Q7 | Net loyalty value per store? | Member revenue is not incremental revenue. Detectable lift: +£5.44 per +10pp adoption (95% CI −£514 to +£525); redemption £1,201.50 per store-month. (I3) |
| Q8 | Does adoption vary by format/region? | Region: KW p = 0.342 (no). Format: hub 0.4575 vs street 0.3283, n = 2. |
| Q9 | Revenue split by stream / format? | Espresso 45.7%, food 26.1%, filter 19.2%, beans 9.1%. Hub vs street differ by < 1pp on every stream. |
| Q10 | Highest-margin categories, and are they growing? | Price list: Filter 0.883, Espresso 0.839, Cold 0.813, Food 0.740, Merch 0.702, Beans 0.677. Growth **unsupported**: `product_id` names one top product; only the four streams carry revenue. |
| Q11 | Is retail-beans share growing? | No: +0.245pp/yr, p = 0.143. Food: −0.359pp/yr, p = 0.252. No stream share trends. |
| Q12 | Weekday vs weekend by format? | Street −24.17%, hub −26.58%. Same shape. |
| Q13 | Bank holidays for hubs vs streets? | Both hurt: street −33.27%, hub −29.67% (hub n = 8 days). |
| Q14 | Best/worst profit months, repeating? | Best 2024-11 (£816.9k), worst 2023-11 (£564.0k) - the same month. Month pattern YoY r = −0.4887 (p = 0.107). **No repeating season.** |

---

## I1 - The regional margin league table is a fixed-cost league table.

**Claim.** Regional net margin is almost entirely explained by rent + staffing per store, not by revenue.
Every region sells within 7.6% of every other; fixed cost spans 51.8%.

**Query**

```sql
WITH m AS (SELECT * FROM read_csv_auto('data/fact_store_monthly_profitability.csv')),
     s AS (SELECT * FROM read_csv_auto('data/dim_store.csv')),
     region AS (
       SELECT s.region,
              count(DISTINCT m.store_id)                                   AS stores,
              sum(m.total_monthly_revenue_gbp) / count(DISTINCT m.store_id) / 24 AS revenue_per_store_month,
              sum(m.monthly_rent_gbp + m.monthly_staffing_cost_gbp)
                / count(DISTINCT m.store_id) / 24                          AS fixed_per_store_month,
              sum(m.net_profit_gbp) / sum(m.total_monthly_revenue_gbp)     AS net_margin
       FROM m JOIN s USING (store_id) GROUP BY 1)
SELECT region, stores, round(revenue_per_store_month) AS revenue, round(fixed_per_store_month) AS fixed_cost,
       round(net_margin * 100, 1) AS margin_pct,
       round(corr(fixed_per_store_month, net_margin) OVER (), 4)          AS r_margin_fixed,
       round(corr(revenue_per_store_month, net_margin) OVER (), 4)        AS r_margin_revenue
FROM region ORDER BY net_margin DESC;
```

**Output**

| region | stores | revenue / store-month | fixed cost / store-month | margin |
|---|---:|---:|---:|---:|
| Northern-Ireland | 3 | £61,624 | £19,516 | 28.4% |
| West-Midlands | 3 | £63,878 | £22,881 | 24.5% |
| Wales | 6 | £61,489 | £22,674 | 22.8% |
| East-of-England | 6 | £62,578 | £23,935 | 22.1% |
| Yorkshire-and-Humber | 6 | £63,129 | £24,896 | 21.1% |
| South-East | 6 | £61,936 | £24,986 | 19.8% |
| Scotland | 4 | £64,447 | £26,947 | 18.3% |
| East-Midlands | 5 | £63,254 | £26,408 | 18.0% |
| North-East | 4 | £60,901 | £25,210 | 17.8% |
| South-West | 5 | £62,715 | £27,845 | 16.2% |
| North-West | 5 | £59,731 | £26,196 | 16.1% |
| London | 7 | £62,246 | £32,644 | 8.5% |

r(margin, fixed cost) = **−0.9766**; r(margin, revenue) = **0.1009**. Region revenue Kruskal-Wallis
p = 0.767; region margin p = 2.61e-25. At store level, fixed cost explains R² 0.803 of mean net profit
and revenue 0.1178 (`cost_vs_revenue`).

**Caveat.** 3-7 stores per region. The revenue column is itself noise (I2), so its ordering means
nothing; the fixed-cost ordering is stable (store fixed cost 2023 vs 2024 r = 0.9906). Fixed cost is
the P&L's monthly rent + staffing, not the `dim_store` contract (they differ on every row; C07/C08).

**So what.** The benchmark field's headline - "expand where margins lead, Northern Ireland first" - is
correct about *margin* and wrong about *why*. Northern Ireland does not sell more; it costs £13k a month
less than London to run a store. The 2025 site screen should be an **occupancy-cost screen** (rent +
staffing per store-month), not a regional demand map. Split at the median store fixed cost of
£25,579.87, the cheaper half earns a 24.16% margin and the dearer half 13.51%, on revenue of £62,077.90
vs £62,485.98 (`brief.*median_fixed`).
London needs a cost renegotiation case, not a demand case.

---

## I2 - Store revenue is indistinguishable from chance - across stores, regions, years and seasons.

**Claim.** In the monthly P&L, revenue carries no reproducible store, region, month or season identity.
Anything ranked on revenue - including "most improved store" - is ranked on noise.

**Query**

```sql
WITH m AS (SELECT * FROM read_csv_auto('data/fact_store_monthly_profitability.csv')),
     yr AS (
       SELECT store_id,
              avg(total_monthly_revenue_gbp) FILTER (WHERE month_id < '2024')  AS rev_2023,
              avg(total_monthly_revenue_gbp) FILTER (WHERE month_id >= '2024') AS rev_2024,
              avg(net_profit_gbp) FILTER (WHERE month_id < '2024')             AS np_2023,
              avg(net_profit_gbp) FILTER (WHERE month_id >= '2024')            AS np_2024
       FROM m GROUP BY 1),
     grand AS (SELECT avg(total_monthly_revenue_gbp) g FROM m),
     between_ss AS (SELECT sum(24 * power(avg_rev - (SELECT g FROM grand), 2)) ss
                    FROM (SELECT store_id, avg(total_monthly_revenue_gbp) avg_rev FROM m GROUP BY 1)),
     total_ss AS (SELECT sum(power(total_monthly_revenue_gbp - (SELECT g FROM grand), 2)) ss FROM m)
SELECT round((SELECT ss FROM between_ss) / (SELECT ss FROM total_ss), 4) AS eta2_store_revenue,
       round(59 / 1439, 4)                                                AS eta2_if_labels_were_random,
       round(corr(rev_2023, rev_2024), 4)                                 AS r_revenue_2023_2024,
       round(corr(np_2023, np_2024), 4)                                   AS r_profit_2023_2024
FROM yr;
```

**Output**

| eta2_store_revenue | eta2_if_labels_were_random | r_revenue_2023_2024 | r_profit_2023_2024 |
|---:|---:|---:|---:|
| 0.0411 | 0.041 | 0.0503 | 0.6779 |

Supporting (`store_identity`, `repeatability`, `season`, `brief.q4_*`): rent η² 0.9844, staffing
0.8619, member share 0.9216; revenue KW p = 0.49; footfall η² 0.0398 (p = 0.357); odd vs even months
r = −0.0731; month-of-year KW p = 0.8865; best and worst estate months are both Novembers (2024-11
£816.9k, 2023-11 £564.0k); SD of store annual profit change £50.5k vs £51.4k expected from noise.

**Caveat.** This is a statement about the delivered archive. A synthetic generator drawing revenue
independently per store-month produces exactly this; a real chain would not. The defensible wording is
**"no reproducible revenue difference is detectable"**, not "stores perform identically". It is the
central fact the dashboard must make visible - the profitable-store list is real only because costs are.

**So what.** Three brief questions dissolve: "which stores improved most" (Q4), "peak quarters" and
"does the monthly pattern repeat" (Q14) all ask the data to rank noise. The dashboard shows the
ranking *and* the noise band, so a reader can see that the 2023→2024 movers sit inside it.

---

## I3 - Loyalty buys member share, not spend.

**Claim.** Adoption almost perfectly sets the share of revenue attributed to members, but does not move
store revenue, transaction value or profit. Even the most optimistic lift the data allows does not pay
for the £1.73M of redemptions.

**Query**

```sql
WITH m AS (SELECT * FROM read_csv_auto('data/fact_store_monthly_profitability.csv')),
     s AS (SELECT * FROM read_csv_auto('data/dim_store.csv')),
     st AS (SELECT store_id, any_value(s.loyalty_adoption_rate) AS adoption,
                   avg(loyalty_member_revenue_pct) AS member_share,
                   avg(total_monthly_revenue_gbp)  AS revenue,
                   avg(net_profit_gbp)             AS net_profit,
                   avg(loyalty_redemption_cost_gbp) AS redemption
            FROM m JOIN s USING (store_id) GROUP BY 1),
     gm AS (SELECT 1 - sum(total_monthly_cogs_gbp) / sum(total_monthly_revenue_gbp) AS gross_margin FROM m)
SELECT round(corr(adoption, member_share), 4)            AS r_adoption_member_share,
       round(corr(adoption, revenue), 4)                 AS r_adoption_revenue,
       round(corr(adoption, net_profit), 4)              AS r_adoption_net_profit,
       round(regr_slope(revenue, adoption) * 0.1, 2)     AS revenue_per_10pp_adoption,
       round(avg(redemption), 2)                         AS redemption_per_store_month,
       round(avg(redemption) / any_value(gm.gross_margin), 2) AS revenue_needed_to_fund_it,
       (SELECT round(sum(loyalty_redemption_cost_gbp)) FROM m) AS redemption_24m
FROM st, gm;
```

**Output**

| r adoption→member share | r adoption→revenue | r adoption→profit | revenue per +10pp | redemption / store-month | revenue needed | redemption 24m |
|---:|---:|---:|---:|---:|---:|---:|
| 0.9984 | 0.0027 | −0.018 | £5.44 | £1,201.50 | £1,934.53 | £1,730,161 |

From `loyalty`: 95% CI on revenue per +10pp adoption −£514.39 to +£525.27 (n = 60 stores). At the
mean adoption of 33.26%, the **upper** 95% bound on lift is £1,747.22 per store-month - below the
£1,934.53 of revenue needed (at the 62.1% gross margin) to fund the redemptions. Daily: ATV vs loyalty
transaction share r = −0.0023.

**Caveat.** Cross-sectional, observational, n = 60. Adoption could be correlated with something that
suppresses revenue, masking a real lift; the CI is wide. Member revenue share is near-mechanical in this
archive (0.9984), so "member revenue" cannot be read as programme value. Q6 (member vs non-member ATV)
is unsupported as specified: no member-level transaction value exists.

**So what.** "Members generate 33% of revenue" - the field's loyalty headline - is a restatement of
adoption, not a return. The defensible CCO answer is **not "cut it"** but **"do not scale it on this
evidence"**: run a store-level holdout (randomise redemption offers off in a matched set) and fund the
programme only if the measured lift clears ~£1,935 per store-month.

---

## I4 - The week is the only demand pattern, and the rota ignores it.

**Claim.** In the daily sample, day of week explains 16.7% of revenue variance - four times store
identity - and weekends trade 24.4% below weekdays. Staff hours are identical on both.

**Query**

```sql
WITH d AS (SELECT f.*, c.is_weekend
           FROM read_csv_auto('data/fact_daily_sales.csv') AS f
           JOIN read_csv_auto('data/dim_date.csv') AS c USING (date_id))
SELECT is_weekend,
       count(*)                                   AS rows,
       round(avg(total_revenue_gbp), 2)           AS revenue,
       round(avg(total_staff_hours), 2)           AS staff_hours,
       round(avg(total_revenue_gbp) / avg(total_staff_hours), 2) AS revenue_per_hour,
       round(avg(avg_transaction_value_gbp), 4)   AS atv
FROM d GROUP BY 1 ORDER BY 1;
```

**Output**

| is_weekend | rows | revenue | staff hours | revenue / hour | ATV |
|---|---:|---:|---:|---:|---:|
| false | 7,188 | £2,195.85 | 41.38 | £53.06 | £7.4823 |
| true | 2,812 | £1,660.68 | 41.63 | £39.90 | £7.4859 |

From `week`: η² day-of-week 0.1672 vs store 0.0276 vs month 0.0022; staff hours MWU p = 0.547;
r(hours, revenue) = 0.0032; shift pattern η² 0.0005. At weekday productivity a weekend day needs 31.30
hours, so **24.81%** of weekend hours are surplus. Bank holidays: −33.11% (245 rows). The weekend drop
is in transactions, not basket: ATV is £7.48 on both.

**Caveat.** The daily fact is a 20.3% sample that does not reconcile to the P&L (C23), so no £ saving is
claimed - the finding is in hours and revenue-per-hour, inside one table. Staff hours are recorded per
row; 1,006 store-days carry several rows, each treated as an observation.

**So what.** The one lever this archive *can* support: rebuild the weekend and bank-holiday rota to
weekday productivity (~10 fewer hours per store-weekend-day), and plan promotions for Saturday/Sunday
traffic rather than basket size. This is the seasonal/staffing recommendation the brief asks for -
except the season is weekly, not annual.

---

## I5 - The supplied labels fail their own definitions.

**Claim.** The archive's arithmetic closes, but its labels and cross-table promises do not: 17 of 24
documented promises fail, including the status label the brief asks analysts to use for closure
decisions.

**Query**

```sql
WITH m AS (SELECT * FROM read_csv_auto('data/fact_store_monthly_profitability.csv')),
     derived AS (
       SELECT profitability_status AS supplied,
              CASE WHEN net_profit_margin_pct > 0.20  THEN 'Highly-Profitable'
                   WHEN net_profit_margin_pct > 0.08  THEN 'Profitable'
                   WHEN net_profit_margin_pct > -0.02 THEN 'Break-Even'
                   WHEN net_profit_margin_pct > -0.15 THEN 'Loss-Making'
                   ELSE 'Structural-Loss' END     AS from_bands
       FROM m)
SELECT supplied, from_bands, count(*) AS rows
FROM derived WHERE supplied <> from_bands GROUP BY ALL ORDER BY rows DESC;
```

**Output**

| supplied | from documented bands | rows |
|---|---|---:|
| Profitable | Highly-Profitable | 349 |
| Break-Even | Profitable | 159 |
| Loss-Making | Structural-Loss | 59 |
| Break-Even | Loss-Making | 33 |

600 of 1,440. Re-derived, Structural-Loss rises from 17 to 76 store-months. Full contract (24 rows) in
`profile.md`; the daily fact does not reconcile to the P&L (C23, r = 0.0307).

**Caveat.** The label may encode a rule the dictionary does not describe; the mismatch is between the
label and its *documentation*, which is what an analyst would rely on.

**So what.** A closure list built on the supplied `profitability_status` - as every benchmarked entry
did - is built on a label that disagrees with its definition 42% of the time. The dashboard re-derives
status from margin and shows the supplied label only in the audit panel.

---

## Decision summary for the CCO

| Decision | Recommendation | Evidence |
|---|---|---|
| 2025 expansion | Screen sites on **occupancy cost**: stores at or below the median rent + staffing (£25,579.87/month) earn 24.16% vs 13.51% above it, on the same revenue (£62,077.90 vs £62,485.98); do not rank regions on revenue | I1, I2 |
| Review list | **Store 32** (only store negative over 24 months) and London's cost base (49 of 168 loss months), not the supplied status list | I1, I5, Q2 |
| Loyalty | **Hold, don't scale**: holdout test with a ~£1,935 per store-month bar | I3 |
| Staffing / promotions | Cut ~25% of weekend and bank-holiday hours to weekday productivity; promote weekend traffic | I4 |
| Product | Category growth is unmeasurable here; collect line-item sales before re-weighting the menu | Q10, C20 |

## Rejected candidates

| Candidate | Why killed |
|---|---|
| "Transport-Hub is the most profitable format - scale it" | n = 2 stores, permutation p = 0.2182; both are train stations; 11 High-Street stores are also named "Station"/"Hub". |
| "Northern Ireland has the strongest demand" | Its revenue is 9th of 12; its margin leads on cost alone (I1). |
| "Store X improved most from 2023 to 2024" | Change spread equals noise (Q4). Kept as a chart *with* the noise band, not as a finding. |
| "Food share is growing / beans signal at-home coffee" | No stream share trends (all p > 0.14). |
| "Filter coffee is the highest-margin category - grow it" | True of the price list (0.883) but the P&L margin (0.621) is below every catalogue margin (C20); no category-level sales exist. |
| "Q4 is the peak quarter" | Quarter revenue within 2.3%; month-of-year p = 0.8865. |
| Monthly dwell time / revenue per sqft as performance | Revenue per sqft is random revenue over a store constant (η² 0.618 comes from the denominator). |

## Non-obvious checklist

- [x] Two-way interaction: format × weekend, format × bank holiday (Q12, Q13) - same shape.
- [x] Simpson's / mix: region margin vs region cost (I1).
- [x] Rate vs volume: member *share* vs member *value* (I3).
- [x] Distribution vs average: Q4 movers against the noise distribution.
- [x] Changepoints / season: none (Q11, Q14).
- [x] Missingness as signal: documented nulls are absent (C21, C22).
- [x] Survivorship: store_status has no effect on revenue (KW p = 0.833) or margin (p = 0.2585).
- [x] Mix vs performance: stream mix identical across formats (Q9).
