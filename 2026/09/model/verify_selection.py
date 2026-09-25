#!/usr/bin/env python3
"""Reconcile September's filtered allocation marks against curated Parquet.

The shared G7 verifier checks release-level metrics. This month-local verifier checks
client-side selection metrics for the default state, each supported filter dimension,
and a real zero-row combination.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import NamedTuple
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import duckdb

TOL = 1e-6
FILTER_COLUMNS = {
    "kitchen_id": "kitchen_id",
    "zone_id": "zone_id",
    "rider_id": "rider_id",
    "year_month": "strftime(order_date, '%Y-%m')",
}


class VerificationCase(NamedTuple):
    name: str
    filters: list[dict[str, object]]


def open_curated(month_dir: Path) -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect()
    for path in sorted((month_dir / "data" / "curated").glob("*.parquet")):
        escaped = str(path).replace("'", "''")
        connection.execute(f"CREATE VIEW {path.stem} AS SELECT * FROM read_parquet('{escaped}')")
    return connection


def _where_clause(filters: list[dict[str, object]]) -> tuple[str, list[str]]:
    clauses: list[str] = []
    parameters: list[str] = []
    for item in filters:
        field = item.get("field")
        values = item.get("values")
        if field not in FILTER_COLUMNS or not isinstance(values, list):
            raise ValueError(f"Unsupported filter: {item}")
        if not values:
            clauses.append("FALSE")
            continue
        placeholders = ", ".join("?" for _ in values)
        clauses.append(f"{FILTER_COLUMNS[str(field)]} IN ({placeholders})")
        parameters.extend(str(value) for value in values)
    return (" AND ".join(clauses) or "TRUE", parameters)


def recompute_selection(
    connection: duckdb.DuckDBPyConnection,
    filters: list[dict[str, object]],
) -> dict[str, float]:
    where, parameters = _where_clause(filters)
    order_rows, kitchen_zone_pairs, kitchen_rider_pairs = connection.execute(
        f"""
        SELECT count(*)::DOUBLE,
               count(DISTINCT (kitchen_id, zone_id))::DOUBLE,
               count(DISTINCT (kitchen_id, rider_id))::DOUBLE
        FROM fct_order_allocation
        WHERE {where}
        """,
        parameters,
    ).fetchone()

    metrics = {
        "selected.order_rows": float(order_rows),
        "selected.kitchen_zone_pairs": float(kitchen_zone_pairs),
        "selected.kitchen_rider_pairs": float(kitchen_rider_pairs),
    }
    rows = connection.execute(
        f"""
        WITH selected AS (
          SELECT kitchen_id, zone_id
          FROM fct_order_allocation
          WHERE {where}
        ),
        totals AS (
          SELECT count(*)::DOUBLE AS denominator
          FROM selected
        ),
        selected_corridors AS (
          SELECT kitchen_id, zone_id, count(*)::DOUBLE AS order_rows
          FROM selected
          GROUP BY kitchen_id, zone_id
        )
        SELECT corridor.kitchen_id,
               corridor.zone_id,
               coalesce(selected_corridors.order_rows, 0)::DOUBLE AS order_rows,
               CASE
                 WHEN totals.denominator = 0 THEN 0::DOUBLE
                 ELSE coalesce(selected_corridors.order_rows, 0) / totals.denominator
               END AS allocation_share
        FROM fact_corridor_allocation AS corridor
        CROSS JOIN totals
        LEFT JOIN selected_corridors USING (kitchen_id, zone_id)
        ORDER BY corridor.kitchen_id, corridor.zone_id
        """,
        parameters,
    ).fetchall()
    for kitchen_id, zone_id, rows_count, share in rows:
        key = f"selected_corridor.{kitchen_id}|{zone_id}"
        metrics[f"{key}.orders"] = float(rows_count)
        metrics[f"{key}.share"] = float(share)
    return metrics


def build_cases(connection: duckdb.DuckDBPyConnection) -> list[VerificationCase]:
    kitchen_id, zone_id, rider_id, year_month = connection.execute(
        """
        SELECT min(kitchen_id),
               min(zone_id),
               min(rider_id),
               min(strftime(order_date, '%Y-%m'))
        FROM fct_order_allocation
        """
    ).fetchone()
    empty = connection.execute(
        """
        WITH kitchens AS (SELECT DISTINCT kitchen_id FROM fct_order_allocation),
             zones AS (SELECT DISTINCT zone_id FROM fct_order_allocation),
             riders AS (SELECT DISTINCT rider_id FROM fct_order_allocation),
             present AS (
               SELECT DISTINCT kitchen_id, zone_id, rider_id
               FROM fct_order_allocation
             )
        SELECT kitchens.kitchen_id, zones.zone_id, riders.rider_id
        FROM kitchens
        CROSS JOIN zones
        CROSS JOIN riders
        LEFT JOIN present USING (kitchen_id, zone_id, rider_id)
        WHERE present.kitchen_id IS NULL
        ORDER BY kitchens.kitchen_id, zones.zone_id, riders.rider_id
        LIMIT 1
        """
    ).fetchone()
    if empty is None:
        raise RuntimeError("No zero-row kitchen/zone/rider combination exists")

    def one(field: str, value: str) -> list[dict[str, object]]:
        return [{"field": field, "values": [value]}]

    return [
        VerificationCase("default", []),
        VerificationCase("kitchen", one("kitchen_id", kitchen_id)),
        VerificationCase("zone", one("zone_id", zone_id)),
        VerificationCase("rider", one("rider_id", rider_id)),
        VerificationCase("month", one("year_month", year_month)),
        VerificationCase(
            "zero-row",
            [
                {"field": "kitchen_id", "values": [empty[0]]},
                {"field": "zone_id", "values": [empty[1]]},
                {"field": "rider_id", "values": [empty[2]]},
            ],
        ),
    ]


def _case_url(base_url: str, filters: list[dict[str, object]]) -> str:
    parts = urlsplit(base_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if filters:
        query["f"] = json.dumps(filters, separators=(",", ":"))
    else:
        query.pop("f", None)
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path or "/", urlencode(query), parts.fragment)
    )


def scrape_selection(page, url: str) -> dict[str, float]:
    page.goto(url, wait_until="networkidle")
    page.wait_for_function(
        "() => document.querySelector('[data-metric=\"selected.order_rows\"]')?.getAttribute('data-value') !== null",
        timeout=30_000,
    )
    rendered: dict[str, float] = {}
    conflicts: list[str] = []
    for element in page.query_selector_all(
        '[data-metric^="selected."], [data-metric^="selected_corridor."]'
    ):
        name = element.get_attribute("data-metric")
        raw = element.get_attribute("data-value")
        if not name or raw is None:
            continue
        value = float(raw)
        if name in rendered and not agrees(rendered[name], value):
            conflicts.append(name)
        rendered[name] = value
    if conflicts:
        raise RuntimeError(f"Conflicting duplicate selection metrics: {sorted(set(conflicts))}")
    return rendered


def agrees(shown: float, expected: float) -> bool:
    if math.isnan(shown) and math.isnan(expected):
        return True
    return abs(shown - expected) <= TOL * max(1.0, abs(expected))


def verify_case(
    name: str,
    rendered: dict[str, float],
    expected: dict[str, float],
) -> list[str]:
    errors: list[str] = []
    missing = sorted(set(expected) - set(rendered))
    extra = sorted(set(rendered) - set(expected))
    if missing:
        errors.append(f"{name}: missing rendered metrics: {', '.join(missing)}")
    if extra:
        errors.append(f"{name}: rendered metrics without recomputation: {', '.join(extra)}")
    for metric in sorted(set(rendered) & set(expected)):
        if not agrees(rendered[metric], expected[metric]):
            errors.append(
                f"{name}: {metric} rendered {rendered[metric]:.10g}, "
                f"recomputed {expected[metric]:.10g}"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5173/")
    parser.add_argument(
        "--month-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed - run `just setup`", file=sys.stderr)
        return 2

    connection = open_curated(args.month_dir)
    cases = build_cases(connection)
    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 950})
        context.add_init_script("localStorage.setItem('dnakit-2026-09-tour-seen', '1')")
        page = context.new_page()
        for case in cases:
            expected = recompute_selection(connection, case.filters)
            rendered = scrape_selection(page, _case_url(args.url, case.filters))
            errors = verify_case(case.name, rendered, expected)
            failures.extend(errors)
            status = "PASS" if not errors else "FAIL"
            print(
                f"{status}  {case.name:<8} "
                f"{len(rendered):>3} metrics · "
                f"{int(expected['selected.order_rows']):>4} selected rows"
            )
        browser.close()
    connection.close()

    if failures:
        print("\nSelection reconciliation failures:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"\nAll {len(cases)} filtered states reconcile to curated Parquet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
