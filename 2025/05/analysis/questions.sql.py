#!/usr/bin/env python3
"""G3 question storm - every question answered in SQL, output captured verbatim.

Cheap, fast, disposable by design: this is the evidence behind analysis/insights.md.
Anything quoted as a CLAIM in the ledger is produced here.

    python 2025/05/analysis/questions.sql.py > 2025/05/analysis/questions_output.txt
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl

ROOT = Path(__file__).resolve().parents[3]
XLSX = (
    ROOT
    / "2025/05/Onyx-Data-DataDNA-Dataset-Challenge-Mobile-Phone-Sales-Dataset-May-2025"
    / "Onyx Data - DataDNA Dataset Challenge - Mobile Phone Sales Dataset - May 2025.xlsx"
)

QUESTIONS: list[tuple[str, str]] = [
    # ---- descriptive, and what the brief literally asks (R1-R9) ----
    (
        "Q01 [R1] Top brands by revenue and by units - do the ranks agree?",
        """
        select Brand,
               sum(Units_Sold)                                             units,
               sum(Total_Revenue)                                          revenue,
               round(avg(Price), 0)                                        avg_price,
               rank() over (order by sum(Units_Sold)   desc)               units_rank,
               rank() over (order by sum(Total_Revenue) desc)              rev_rank
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q02 [R1] Revenue concentration by model - Pareto",
        """
        with m as (select Mobile_Model, Brand, sum(Total_Revenue) rev from f group by 1, 2)
        select Mobile_Model, Brand, rev,
               round(100.0 * rev / sum(rev) over (), 2)                          pct_of_rev,
               round(100.0 * sum(rev) over (order by rev desc) / sum(rev) over (), 2) cum_pct,
               row_number() over (order by rev desc)                              rn
        from m order by rev desc
    """,
    ),
    (
        "Q03 [R1] How few models carry 50% / 80% of revenue?",
        """
        with m as (select Mobile_Model, sum(Total_Revenue) rev from f group by 1),
             c as (select Mobile_Model, rev,
                          sum(rev) over (order by rev desc) / sum(rev) over () cum,
                          row_number() over (order by rev desc) rn from m)
        select min(rn) filter (where cum >= 0.5) models_for_50pct,
               min(rn) filter (where cum >= 0.8) models_for_80pct,
               count(*)                          total_models
        from c
    """,
    ),
    (
        "Q04 [R2] Price band: units share vs revenue share",
        """
        select case when Price <  400 then '1 Budget   <$400'
                    when Price <  700 then '2 Mid      $400-699'
                    when Price < 1000 then '3 High     $700-999'
                    else                   '4 Premium  $1000+' end            band,
               count(*)                                                       n_days,
               sum(Units_Sold)                                                units,
               sum(Total_Revenue)                                             revenue,
               round(100.0 * sum(Units_Sold)    / sum(sum(Units_Sold))    over (), 1) unit_pct,
               round(100.0 * sum(Total_Revenue) / sum(sum(Total_Revenue)) over (), 1) rev_pct
        from f group by 1 order by 1
    """,
    ),
    # avg_price is retained ONLY to show it differs from the ASP; assumptions.md declares
    # mean(Price) the wrong statistic and the app renders the unit-weighted one. Quoting
    # avg_price in prose is how the channel-ASP defect happened -- see insights.md.
    (
        "Q05 [R2] Storage size - does it move anything?",
        """
        select Storage_Size, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue,
               round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 2) asp_unit_weighted,
               round(avg(Price), 2) avg_price_DO_NOT_QUOTE
        from f group by 1 order by 1
    """,
    ),
    (
        "Q06 [R2] Colour - does it move anything?",
        """
        select Color, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue,
               round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 2) asp_unit_weighted,
               round(avg(Price), 2) avg_price_DO_NOT_QUOTE
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q07 [R2] OS split - and is it anything other than Apple vs rest?",
        """
        select Operating_System, count(distinct Brand) brands,
               string_agg(distinct Brand, ', ') brand_list,
               sum(Units_Sold) units, sum(Total_Revenue) revenue
        from f group by 1
    """,
    ),
    (
        "Q08 [R3/R9] Age group profile - units, revenue, and the price they pay",
        """
        select Customer_Age_Group, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue,
               round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 0) rev_per_unit,
               round(avg(Price), 0) avg_price
        from f group by 1 order by 1
    """,
    ),
    (
        "Q09 [R3] Gender profile",
        """
        select Customer_Gender, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue, round(avg(Price), 0) avg_price
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q10 [R4] Channel: revenue, units, and average price",
        """
        select Sales_Channel, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue, round(avg(Price), 0) avg_price,
               round(100.0 * sum(Total_Revenue) / sum(sum(Total_Revenue)) over (), 1) rev_pct
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q11 [R4] Payment type",
        """
        select Payment_Type, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue, round(avg(Price), 0) avg_price
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q12 [R5/R6] Country: revenue, units, price, and how thin the sample is",
        """
        select Country, count(*) n_days, count(distinct City) cities,
               sum(Units_Sold) units, sum(Total_Revenue) revenue,
               round(avg(Price), 0) avg_price,
               round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 0) rev_per_unit
        from f group by 1 order by revenue desc
    """,
    ),
    (
        "Q13 [R6] City ranking - with the row count that makes most of it meaningless",
        """
        select City, Country, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue
        from f group by 1, 2 order by revenue desc
    """,
    ),
    (
        "Q14 [R8] Month over month",
        """
        select month(Transaction_Date) mo, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue,
               round(100.0 * (sum(Total_Revenue) - lag(sum(Total_Revenue))
                     over (order by month(Transaction_Date)))
                     / lag(sum(Total_Revenue)) over (order by month(Transaction_Date)), 1) mom_pct
        from f group by 1 order by 1
    """,
    ),
    # ---- the non-obvious list ----
    (
        "Q15 [rate vs volume] Brand: unit share vs revenue share, and the gap",
        """
        select Brand,
               round(100.0 * sum(Units_Sold)    / sum(sum(Units_Sold))    over (), 2) unit_share,
               round(100.0 * sum(Total_Revenue) / sum(sum(Total_Revenue)) over (), 2) rev_share,
               round(100.0 * sum(Total_Revenue) / sum(sum(Total_Revenue)) over ()
                   - 100.0 * sum(Units_Sold)    / sum(sum(Units_Sold))    over (), 2) gap_pp
        from f group by 1 order by gap_pp desc
    """,
    ),
    (
        "Q16 [concentration] Revenue share of the top 3 models vs the bottom 10",
        """
        with m as (select Mobile_Model, sum(Total_Revenue) rev,
                          row_number() over (order by sum(Total_Revenue) desc) rn from f group by 1)
        select sum(rev) filter (where rn <= 3)  top3,
               sum(rev) filter (where rn > 9)   bottom10,
               round(100.0 * sum(rev) filter (where rn <= 3) / sum(rev), 1) top3_pct,
               round(100.0 * sum(rev) filter (where rn > 9)  / sum(rev), 1) bottom10_pct
        from m
    """,
    ),
    (
        "Q17 [within-brand spread] Each brand's cheapest and dearest model",
        """
        with m as (select Brand, Mobile_Model, round(avg(Price), 0) p,
                          sum(Total_Revenue) rev from f group by 1, 2)
        select Brand,
               min(p) cheapest, max(p) dearest, round(max(p) * 1.0 / min(p), 1) spread_x,
               count(*) models,
               arg_min(Mobile_Model, p) cheapest_model, arg_max(Mobile_Model, p) dearest_model
        from m group by 1 order by spread_x desc
    """,
    ),
    (
        "Q18 [Simpson] Does the brand revenue rank hold inside each country?",
        """
        with r as (select Country, Brand, sum(Total_Revenue) rev,
                          rank() over (partition by Country order by sum(Total_Revenue) desc) rk
                   from f group by 1, 2)
        select Country,
               max(case when rk = 1 then Brand end) top_brand,
               max(case when rk = 2 then Brand end) runner_up,
               max(case when rk = 5 then Brand end) last_place,
               count(*)                             brands_present
        from r group by 1
    """,
    ),
    (
        "Q19 [mix vs performance] Is a country's ASP driven by product mix?",
        """
        select Country,
               round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 0)                  actual_rev_per_unit,
               round(100.0 * sum(Total_Revenue) filter (where Price >= 1000)
                     / sum(Total_Revenue), 1)                                        pct_rev_premium,
               round(100.0 * sum(Units_Sold) filter (where Price >= 1000)
                     / sum(Units_Sold), 1)                                           pct_units_premium
        from f group by 1 order by actual_rev_per_unit desc
    """,
    ),
    (
        "Q20 [channel x age] The one cross-tab that survives correction",
        """
        select Sales_Channel, Customer_Age_Group, count(*) n_days,
               round(100.0 * count(*) / sum(count(*)) over (partition by Sales_Channel), 1) pct_of_channel
        from f group by 1, 2 order by 1, 2
    """,
    ),
    (
        "Q21 [distribution vs average] Units_Sold spread - the average hides nothing because it is noise",
        """
        select round(avg(Units_Sold), 1) mean_u, median(Units_Sold) median_u,
               min(Units_Sold) min_u, max(Units_Sold) max_u,
               round(stddev(Units_Sold), 1) sd_u,
               quantile_cont(Units_Sold, 0.25) q1, quantile_cont(Units_Sold, 0.75) q3
        from f
    """,
    ),
    (
        "Q22 [survivorship] Days where a premium model sold vs its share of revenue",
        """
        select case when Price >= 1000 then 'premium $1000+' else 'rest' end tier,
               count(*) n_days, round(100.0 * count(*) / sum(count(*)) over (), 1) pct_days,
               sum(Total_Revenue) revenue,
               round(100.0 * sum(Total_Revenue) / sum(sum(Total_Revenue)) over (), 1) pct_rev
        from f group by 1 order by 1
    """,
    ),
    (
        "Q23 [changepoint] Best and worst revenue day, and how extreme they are",
        """
        select Transaction_Date, Mobile_Model, Brand, Price, Units_Sold, Total_Revenue
        from f order by Total_Revenue desc limit 5
    """,
    ),
    (
        "Q24 [lead/lag] Quarterly revenue - is there any trend at all?",
        """
        select quarter(Transaction_Date) q, count(*) n_days, sum(Units_Sold) units,
               sum(Total_Revenue) revenue
        from f group by 1 order by 1
    """,
    ),
    (
        "Q25 [premium dependency] Share of each country's revenue from its single best model",
        """
        with cm as (select Country, Mobile_Model, sum(Total_Revenue) rev from f group by 1, 2),
             t  as (select Country, sum(rev) tot from cm group by 1)
        select cm.Country, cm.Mobile_Model best_model, cm.rev, t.tot,
               round(100.0 * cm.rev / t.tot, 1) pct_of_country
        from cm join t using (Country)
        qualify row_number() over (partition by cm.Country order by cm.rev desc) = 1
        order by pct_of_country desc
    """,
    ),
    (
        "Q26 [the ASP trap] Unit-weighted ASP vs mean of Price",
        """
        select round(sum(Total_Revenue) * 1.0 / sum(Units_Sold), 2) asp_unit_weighted,
               round(avg(Price), 2)                                 mean_of_price_column,
               round(avg(Price) - sum(Total_Revenue) * 1.0 / sum(Units_Sold), 2) difference
        from f
    """,
    ),
]


def main() -> int:
    fact = pl.read_excel(XLSX, sheet_id=0)["Fact_Sales"]
    con = duckdb.connect()
    con.register("f", fact.to_arrow())
    with pl.Config(tbl_rows=30, tbl_cols=15, fmt_str_lengths=40, tbl_width_chars=200):
        for title, sql in QUESTIONS:
            print("\n" + "=" * 100)
            print(title)
            print("=" * 100)
            print(con.execute(sql).pl())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
