#!/usr/bin/env python3
"""Reconcile October's filter-dependent and drill-down figures against curated Parquet.

tools/verify_metrics.py checks the default page. Everything a filter or a drill changes is
tagged `selected.*` or `drill.*` in the DOM; this month-local verifier loads one URL state per
filter dimension (plus a combined drill state and a real zero-row state), scrapes those tags,
and recomputes every one with DuckDB SQL - a separate engine from the browser's TypeScript.

Filter semantics mirrored from app/src/data.ts:
  region / loc / half  select stores (half = store's 24-month rent+staffing vs the median)
  year                 restricts months; only a single year counts as a filter
  store                opens the drill drawer; never filters
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import NamedTuple
from urllib.parse import urlencode

import duckdb

TOL = 1e-6
TOUR_KEY = "sunrise-2026-10-tour-seen"
YEARS = (2023, 2024)


class Case(NamedTuple):
    name: str
    region: tuple[str, ...] = ()
    loc: tuple[str, ...] = ()
    half: tuple[str, ...] = ()
    year: tuple[int, ...] = ()
    store: int | None = None

    def query(self) -> str:
        q: dict[str, str] = {}
        if self.region:
            q["region"] = ",".join(self.region)
        if self.loc:
            q["loc"] = ",".join(self.loc)
        if self.half:
            q["half"] = ",".join(self.half)
        if self.year:
            q["year"] = ",".join(map(str, self.year))
        if self.store:
            q["store"] = str(self.store)
        return urlencode(q)

    @property
    def store_filtered(self) -> bool:
        return bool(self.region or self.loc or self.half)

    @property
    def year_active(self) -> bool:
        return 0 < len(self.year) < len(YEARS)

    @property
    def filtered(self) -> bool:
        return self.store_filtered or bool(self.year)


def open_curated(month_dir: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for path in sorted((month_dir / "data" / "curated").glob("*.parquet")):
        escaped = str(path).replace("'", "''")
        con.execute(f"CREATE VIEW {path.stem} AS SELECT * FROM read_parquet('{escaped}')")
    # one row per store with its cost half - the same median rule as data.ts costHalves()
    con.execute(
        """
        CREATE TEMP VIEW store_half AS
        WITH s AS (SELECT store_id, avg(monthly_rent_gbp + monthly_staffing_cost_gbp) AS fixed
                   FROM fct_store_month GROUP BY 1)
        SELECT s.store_id, d.region, d.location_type,
               CASE WHEN s.fixed <= (SELECT median(fixed) FROM s) THEN 'Lower-cost half' ELSE 'Higher-cost half' END AS half
        FROM s JOIN dim_store d USING (store_id)
        """
    )
    return con


def _in(col: str, values: tuple) -> tuple[str, list]:
    if not values:
        return "TRUE", []
    return f"{col} IN ({', '.join('?' for _ in values)})", list(values)


def selected_ids(con: duckdb.DuckDBPyConnection, case: Case) -> list[int]:
    parts = [_in("region", case.region), _in("location_type", case.loc), _in("half", case.half)]
    where = " AND ".join(p[0] for p in parts)
    params = [v for p in parts for v in p[1]]
    return [
        r[0]
        for r in con.execute(
            f"SELECT store_id FROM store_half WHERE {where} ORDER BY 1", params
        ).fetchall()
    ]


def recompute(con: duckdb.DuckDBPyConnection, case: Case) -> dict[str, float]:
    out: dict[str, float] = {}
    ids = selected_ids(con, case)
    years = list(case.year) if case.year_active else list(YEARS)
    yr = f'"year" IN ({", ".join(map(str, years))})'
    id_list = ", ".join(map(str, ids)) or "NULL"

    # ---------------------------------------------------------------- selection bar
    if ids:
        row = con.execute(
            f"""
            SELECT count(DISTINCT store_id), sum(total_monthly_revenue_gbp), sum(net_profit_gbp),
                   sum(net_profit_gbp) / sum(total_monthly_revenue_gbp), avg(total_monthly_revenue_gbp),
                   avg(monthly_rent_gbp + monthly_staffing_cost_gbp), count(*) FILTER (WHERE net_profit_gbp < 0)
            FROM fct_store_month WHERE store_id IN ({id_list}) AND {yr}
            """
        ).fetchone()
        for k, v in zip(
            ("stores", "revenue", "net_profit", "margin", "revenue_pm", "fixed_pm", "loss_months"),
            row,
            strict=True,
        ):
            out[f"selected.{k}"] = float(v)

    # ---------------------------------------------------------------- week panel (any filter)
    if case.filtered and ids:
        store_clause = f"f.store_id IN ({id_list})" if case.store_filtered else "TRUE"
        base = f"""
            SELECT dd.dow_index AS d, dd.dow_index >= 6 AS we, dd.is_uk_bank_holiday AS bh,
                   f.total_revenue_gbp AS rev, f.total_staff_hours AS hrs
            FROM fct_daily_sample f JOIN dim_date dd USING (date_id)
            WHERE {store_clause} AND year(dd.full_date) IN ({", ".join(map(str, years))})
        """
        gap, hrs_we, surplus, bh_gap = con.execute(
            f"""
            WITH w AS ({base})
            SELECT avg(rev) FILTER (WHERE we) / avg(rev) FILTER (WHERE NOT we) - 1,
                   avg(hrs) FILTER (WHERE we),
                   1 - avg(rev) FILTER (WHERE we) / (sum(rev) FILTER (WHERE NOT we) / sum(hrs) FILTER (WHERE NOT we))
                       / avg(hrs) FILTER (WHERE we),
                   avg(rev) FILTER (WHERE bh) / avg(rev) FILTER (WHERE NOT bh) - 1
            FROM w
            """
        ).fetchone()
        out.update(
            {
                "selected.week.gap": gap,
                "selected.week.hours_weekend": hrs_we,
                "selected.week.surplus": surplus,
                "selected.week.bh_gap": bh_gap,
            }
        )
        for d, rev, hrs in con.execute(
            f"WITH w AS ({base}) SELECT d, avg(rev), avg(hrs) FROM w GROUP BY d"
        ).fetchall():
            out[f"selected.week.{d}.rev"] = rev
            out[f"selected.week.{d}.hrs"] = hrs

    # ---------------------------------------------------------------- year-dependent charts
    if case.year_active:
        for sid, rev, cogs, fixed, red, np_ in con.execute(
            f"""
            SELECT store_id, avg(total_monthly_revenue_gbp), avg(total_monthly_cogs_gbp),
                   avg(monthly_rent_gbp + monthly_staffing_cost_gbp), avg(loyalty_redemption_cost_gbp), avg(net_profit_gbp)
            FROM fct_store_month WHERE {yr} GROUP BY 1
            """
        ).fetchall():
            for k, v in (("rev", rev), ("cogs", cogs), ("fixed", fixed), ("red", red), ("np", np_)):
                out[f"selected.cups.{sid}.{k}"] = v
        for region, rev, ci, fixed, margin in con.execute(
            f"""
            SELECT d.region, avg(f.total_monthly_revenue_gbp),
                   1.96 * stddev_samp(f.total_monthly_revenue_gbp) / sqrt(count(*)),
                   avg(f.monthly_rent_gbp + f.monthly_staffing_cost_gbp),
                   sum(f.net_profit_gbp) / sum(f.total_monthly_revenue_gbp)
            FROM fct_store_month f JOIN dim_store d USING (store_id) WHERE {yr} GROUP BY 1
            """
        ).fetchall():
            for k, v in (("rev", rev), ("ci", ci), ("fixed", fixed), ("margin", margin)):
                out[f"selected.region.{region}.{k}"] = v

    # ---------------------------------------------------------------- drill drawer (24 months, unfiltered)
    if case.store:
        rev, fixed, margin, np_, loss = con.execute(
            """
            SELECT avg(total_monthly_revenue_gbp), avg(monthly_rent_gbp + monthly_staffing_cost_gbp),
                   sum(net_profit_gbp) / sum(total_monthly_revenue_gbp), avg(net_profit_gbp),
                   count(*) FILTER (WHERE net_profit_gbp < 0)
            FROM fct_store_month WHERE store_id = ?
            """,
            [case.store],
        ).fetchone()
        rank = con.execute(
            """
            WITH m AS (SELECT store_id, sum(net_profit_gbp) / sum(total_monthly_revenue_gbp) AS margin
                       FROM fct_store_month GROUP BY 1)
            SELECT count(*) + 1 FROM m WHERE margin > (SELECT margin FROM m WHERE store_id = ?)
            """,
            [case.store],
        ).fetchone()[0]
        out.update(
            {
                "drill.revenue_pm": rev,
                "drill.fixed_pm": fixed,
                "drill.margin": margin,
                "drill.net_profit_pm": np_,
                "drill.loss_months": loss,
                "drill.margin_rank": rank,
            }
        )
        for month, mrev, mnp in con.execute(
            "SELECT month_id, total_monthly_revenue_gbp, net_profit_gbp FROM fct_store_month WHERE store_id = ?",
            [case.store],
        ).fetchall():
            out[f"drill.{month}.rev"] = mrev
            out[f"drill.{month}.np"] = mnp
    return {k: float(v) for k, v in out.items()}


def build_cases(con: duckdb.DuckDBPyConnection) -> list[Case]:
    region = con.execute("SELECT min(region) FROM dim_store").fetchone()[0]
    loc = con.execute(
        "SELECT location_type FROM dim_store GROUP BY 1 ORDER BY count(*) LIMIT 1"
    ).fetchone()[0]
    loss_store = con.execute(
        "SELECT store_id FROM fct_store_month GROUP BY 1 HAVING sum(net_profit_gbp) < 0"
    ).fetchone()[0]
    loss_region = con.execute(
        "SELECT region FROM dim_store WHERE store_id = ?", [loss_store]
    ).fetchone()[0]
    empty = con.execute(
        """
        WITH r AS (SELECT DISTINCT region FROM dim_store), l AS (SELECT DISTINCT location_type FROM dim_store)
        SELECT r.region, l.location_type FROM r CROSS JOIN l
        WHERE NOT EXISTS (SELECT 1 FROM dim_store d WHERE d.region = r.region AND d.location_type = l.location_type)
        ORDER BY 1, 2 LIMIT 1
        """
    ).fetchone()
    if empty is None:
        raise RuntimeError("No zero-store region x location combination exists")
    return [
        Case("default"),
        Case("region", region=(region,)),
        Case("location", loc=(loc,)),
        Case("cost-half", half=("Higher-cost half",)),
        Case("year", year=(2023,)),
        Case("both-years", year=YEARS),
        Case("drill", region=(loss_region,), year=(2024,), store=loss_store),
        Case("zero-row", region=(empty[0],), loc=(empty[1],)),
    ]


def agrees(shown: float, expected: float) -> bool:
    if math.isnan(shown) and math.isnan(expected):
        return True
    return abs(shown - expected) <= TOL * max(1.0, abs(expected))


def verify_case(name: str, rendered: dict[str, float], expected: dict[str, float]) -> list[str]:
    errors: list[str] = []
    missing = sorted(set(expected) - set(rendered))
    extra = sorted(set(rendered) - set(expected))
    if missing:
        errors.append(
            f"{name}: missing rendered metrics: {', '.join(missing[:12])}{' ...' if len(missing) > 12 else ''}"
        )
    if extra:
        errors.append(
            f"{name}: rendered without recomputation: {', '.join(extra[:12])}{' ...' if len(extra) > 12 else ''}"
        )
    for metric in sorted(set(rendered) & set(expected)):
        if not agrees(rendered[metric], expected[metric]):
            errors.append(
                f"{name}: {metric} rendered {rendered[metric]:.10g}, recomputed {expected[metric]:.10g}"
            )
    return errors


def scrape(page, url: str) -> dict[str, float]:
    page.goto(url, wait_until="networkidle")
    page.wait_for_function(
        "() => document.querySelector('[data-metric=\"kpi.revenue\"]')?.getAttribute('data-value') !== null",
        timeout=30_000,
    )
    page.wait_for_timeout(300)
    rendered: dict[str, float] = {}
    for el in page.query_selector_all('[data-metric^="selected."], [data-metric^="drill."]'):
        name, raw = el.get_attribute("data-metric"), el.get_attribute("data-value")
        if not name or raw is None:
            continue
        value = float(raw)
        if name in rendered and not agrees(rendered[name], value):
            raise RuntimeError(f"Conflicting duplicate metric {name}")
        rendered[name] = value
    return rendered


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default="http://localhost:5173/")
    ap.add_argument("--month-dir", type=Path, default=Path(__file__).resolve().parents[1])
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed - run `just setup`", file=sys.stderr)
        return 2

    con = open_curated(args.month_dir)
    cases = build_cases(con)
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 950})
        ctx.add_init_script(f"localStorage.setItem('{TOUR_KEY}', '1')")
        page = ctx.new_page()
        for case in cases:
            expected = recompute(con, case)
            q = case.query()
            rendered = scrape(page, args.url.rstrip("/") + "/" + (f"?{q}" if q else ""))
            errors = verify_case(case.name, rendered, expected)
            failures.extend(errors)
            print(
                f"{'PASS' if not errors else 'FAIL'}  {case.name:<11} {len(rendered):>4} metrics  ?{q}"
            )
        browser.close()
    con.close()
    if failures:
        print("\nSelection reconciliation failures:", file=sys.stderr)
        for f in failures:
            print(f"- {f}", file=sys.stderr)
        return 1
    print(f"\nAll {len(cases)} filter / drill states reconcile to curated Parquet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
