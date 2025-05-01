#!/usr/bin/env python3
"""Render the poster route to exports/dashboard.png  (Gate G8), and take
self-critique screenshots during G6.

The poster PNG *is* the submission artifact. It must read standalone.

Usage:
    python tools/shoot.py 2025 05                 # poster only
    python tools/shoot.py 2025 05 --critique      # desktop + poster + mobile
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def tour_key(year: str, month: str) -> str:
    """The month's own tour-storage key, read from its source.

    This used to be the literal 'datadna-2025-05-tour-seen' for every month, which is
    only correct for the months that happen to use that prefix. The keys are themed and
    NOT uniform - mygym-, novabank-, ecom-, shelter- and plain datadna- all appear across
    2025 - so seeding the wrong one leaves the guided tour OPEN in the shot, and a tour
    backdrop over a --critique screenshot is exactly the thing the screenshot exists to
    rule out. Silent, because a wrong key looks identical to a month with no tour.
    """
    # Not just tour.ts: months differ on where the constant lives (later ones keep it
    # beside the steps, earlier months in tour.ts). Scan the whole source tree.
    src_dir = ROOT / year / month / "app" / "src"
    if src_dir.exists():
        found: set[str] = set()
        for f in sorted(src_dir.rglob("*.ts*")):
            found.update(
                re.findall(r'["\']([A-Za-z0-9-]*tour-seen)["\']', f.read_text(encoding="utf-8"))
            )
        if len(found) == 1:
            return found.pop()
        if len(found) > 1:
            raise SystemExit(
                f"{year}/{month}: found {len(found)} different tour keys in app/src "
                f"({', '.join(sorted(found))}). One of them is stale - seeding the wrong "
                "one leaves the tour open in the shot. Fix the source, not this tool."
            )
    # No tour.ts, or a month that stores the flag elsewhere. Seeding an unused key is
    # harmless; failing the shoot over it would not be.
    return f"datadna-{year}-{month}-tour-seen"


# The poster route lays out at exactly 2560x1440 CSS pixels, so it is shot at 1x to
# land on 2560x1440 exactly. Shooting it at 2x would emit 5120x2880.
SHOTS = {
    "poster": ("/poster", 2560, 1440, 1),
    "desktop": ("/", 1920, 1080, 1),
    "mobile": ("/", 390, 844, 2),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    ap.add_argument("--url", default="http://localhost:5173")
    ap.add_argument("--critique", action="store_true", help="also shoot desktop and mobile")
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("playwright not installed - run `just setup`") from None

    out_dir = ROOT / args.year / args.month / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)
    wanted = ["poster"] + (["desktop", "mobile"] if args.critique else [])
    key = tour_key(args.year, args.month)

    with sync_playwright() as p:
        b = p.chromium.launch()
        for name in wanted:
            route, w, h, scale = SHOTS[name]
            page = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
            # the tour must not appear in the submission artifact
            page.add_init_script(f"localStorage.setItem({key!r},'1')")
            page.goto(args.url.rstrip("/") + route, wait_until="networkidle")
            # wait for real data rather than a fixed sleep: a skeleton has no data-value.
            # 90s, not 30s: the months that aggregate in DuckDB-WASM pay a cold load for the
            # ~32MB engine before the first row exists, which can reach ~30s. A
            # timeout sitting exactly on the measured load time fails the shoot at random,
            # and an unshot poster is the one artifact the submission cannot do without.
            page.wait_for_function(
                "() => { const e = document.querySelector('[data-metric]');"
                " return e && e.getAttribute('data-value'); }",
                timeout=90000,
            )
            page.wait_for_timeout(800)  # webfonts + transitions settle
            dest = out_dir / ("dashboard.png" if name == "poster" else f"_critique-{name}.png")
            page.screenshot(path=str(dest), full_page=(name != "poster"))
            print(f"{dest.relative_to(ROOT)}  ({w}x{h} @{scale}x)")
            page.close()
        b.close()

    if args.critique:
        print("\nNow LOOK at them. Overcrowding? Dead space? Inconsistent type sizes?")
        print("Misaligned baselines? Any colour doing two jobs?")
    else:
        print("\nRead the poster as a stranger: is the thesis clear in 10 seconds?")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
