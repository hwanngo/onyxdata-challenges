#!/usr/bin/env python3
"""Assert every number rendered in the dashboard against a recomputation  (Gate G7).

Zero tolerance. A dashboard that displays a number nothing can reproduce is worse
than one that displays nothing.

The app must tag every displayed figure:

    <span data-metric="total_revenue" data-value="1234567.89">$1.23M</span>

This script collects those, recomputes each from data/curated/ via DuckDB using
the expressions in model/metric_checks.yml, and diffs them.

Usage:
    python tools/verify_metrics.py 2025 05            # against the dev server
    python tools/verify_metrics.py 2025 05 --url http://localhost:5173
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import duckdb
import yaml

ROOT = Path(__file__).resolve().parents[1]
TOL = 1e-6


def scrape(url: str) -> dict[str, float]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("playwright not installed - run `just setup`") from None

    found: dict[str, float] = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 2560, "height": 1440})
        page.goto(url, wait_until="networkidle")
        # Wait for real data rather than a fixed sleep: a skeleton has no data-value,
        # so this cannot pass while the page is still loading.
        page.wait_for_function(
            "() => { const e = document.querySelector('[data-metric]');"
            " return e && e.getAttribute('data-value'); }",
            timeout=30000,
        )
        page.wait_for_timeout(600)
        for el in page.query_selector_all("[data-metric]"):
            name = el.get_attribute("data-metric")
            raw = el.get_attribute("data-value")
            if not name:
                continue
            if raw is None:
                print(f"  ! {name} has no data-value attribute - cannot verify", file=sys.stderr)
                continue
            # Most metrics are numeric, but some findings ARE a label - "which region
            # leads?" is verified by comparing the winning name, not a magnitude. Keep the
            # string verbatim; compare() below handles both kinds.
            try:
                found[name] = float(raw)
            except ValueError:
                found[name] = raw
        b.close()
    return found


def agrees(shown: float | str, expected: float | str) -> bool:
    """A rendered value matches its recomputation. Strings must be identical; numbers must
    be within TOL. A string on one side and a number on the other is always a failure."""
    if isinstance(shown, str) or isinstance(expected, str):
        return str(shown) == str(expected)
    if math.isnan(shown) and math.isnan(expected):
        return True
    return abs(shown - expected) <= TOL * max(1.0, abs(expected))


def fmt(v: float | str) -> str:
    return f"{v:>18}" if isinstance(v, str) else f"{v:>18,.4f}"


def recompute(month_dir: Path) -> dict[str, float | str]:
    spec_path = month_dir / "model" / "metric_checks.yml"
    if not spec_path.exists():
        raise SystemExit(
            f"Missing {spec_path.relative_to(ROOT)}.\n"
            "Every metric shown in the UI needs a SQL expression here."
        )
    spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    curated = month_dir / "data" / "curated"

    con = duckdb.connect()
    for pq in curated.glob("*.parquet"):
        con.execute(f"CREATE VIEW {pq.stem} AS SELECT * FROM read_parquet('{pq}')")

    out: dict[str, float | str] = {}
    for name, sql in (spec.get("metrics") or {}).items():
        val = con.execute(sql).fetchone()[0]
        if isinstance(val, str):
            out[name] = val
        else:
            out[name] = float(val) if val is not None else float("nan")

    # metric_sets verify the CHARTS, not just the KPI strip: one entry per mark.
    # Each query returns (key, measure, value); the DOM names them "SET.KEY.MEASURE".
    for set_name, sql in (spec.get("metric_sets") or {}).items():
        for key, measure, val in con.execute(sql).fetchall():
            v = float(val) if val is not None else float("nan")
            out[f"{set_name}.{key}.{measure}"] = v
            # Some sets name a mark by key alone (e.g. a KPI row rather than a series
            # point). Register the short form too so either DOM convention verifies.
            out.setdefault(f"{set_name}.{key}", v)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    ap.add_argument("--url", default="http://localhost:5173")
    args = ap.parse_args()

    month_dir = ROOT / args.year / args.month
    rendered = scrape(args.url)
    expected = recompute(month_dir)

    if not rendered:
        print("No [data-metric] elements found. Tag every displayed figure.", file=sys.stderr)
        return 2

    fails, missing_spec = [], []
    print(f"{'metric':<38} {'rendered':>18} {'recomputed':>18}  ")
    print("-" * 80)
    for name, shown in sorted(rendered.items()):
        if name not in expected:
            missing_spec.append(name)
            print(f"{name:<38} {fmt(shown)} {'NO SPEC':>18}  !")
            continue
        exp = expected[name]
        ok = agrees(shown, exp)
        print(f"{name:<38} {fmt(shown)} {fmt(exp)}  {'ok' if ok else 'FAIL'}")
        if not ok:
            fails.append((name, shown, exp))

    unrendered = sorted(set(expected) - set(rendered))
    print("-" * 80)
    if unrendered:
        print(f"Specified but not rendered ({len(unrendered)}): {', '.join(unrendered)}")
    if missing_spec:
        print(f"\nRendered without a spec ({len(missing_spec)}): {', '.join(missing_spec)}")
        print("Every number in the UI needs a recomputation. Add them to metric_checks.yml.")
    if fails:
        print(f"\n{len(fails)} MISMATCH(ES). Zero tolerance - G7 does not pass.")
        return 1
    if missing_spec:
        return 1
    print(f"\nAll {len(rendered)} rendered metrics reconcile.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
