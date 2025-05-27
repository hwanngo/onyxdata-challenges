#!/usr/bin/env python3
"""Measure every foreground/background pair in a month's theme  (Gate G7).

Accessibility is scored twice (AI rubric B + a 30-point award), and contrast is the
part you cannot eyeball. 2025/05 shipped a sequential ramp whose bottom two steps ran
1.40:1 and 2.14:1 -- a real WCAG 1.4.11 failure that looked completely fine on screen.
This is the tool that caught it.

Reads the CSS custom properties straight out of the month's theme.css, so it audits
what actually ships rather than what a design doc claims.

Usage:
    python tools/audit_contrast.py 2025 05
    python tools/audit_contrast.py 2025 05 --propose 3.0   # suggest fixes for failures
"""

from __future__ import annotations

import argparse
import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# WCAG 2.1: normal text 4.5:1, large text 3:1, non-text/graphical objects 3:1.
TEXT_TOKENS = {"ink", "ink-muted", "ink-inverse"}
TEXT_MIN, NONTEXT_MIN = 4.5, 3.0

# Tokens that are surfaces, not marks -- they are the background side of a pair.
SURFACE_TOKENS = {"bg", "bg-raised", "bg-sunken"}

# Tokens that never carry meaning and need no ratio.
#
# `border` and `grid` are hairlines and chart gridlines. WCAG 1.4.11 exempts objects that
# convey no information, and a 3:1 gridline is actively BAD design -- it competes with the
# data it is meant to sit behind. Exempting them is a stated decision, not an oversight:
# anything that carries meaning must be listed below instead.
SKIP = {"border", "focus-ring", "grid"}

# Some tokens are not drawn on --bg. Audit them against the surface they actually sit on,
# otherwise the tool reports a false failure (ink-inverse on bg is 1.00:1 by construction).
PAIRED_AGAINST = {"ink-inverse": "accent"}


# `*-weak` tokens are TINTED SURFACES (callout backgrounds, active-chip fills), not marks.
# Auditing them as foregrounds against --bg is meaningless -- a pale tint is supposed to be
# close to the page. What matters is that body ink stays readable ON them, which nothing
# checked until now: one month put --ink on --accent-weak in a callout and the old SKIP list
# waved it through unmeasured. Each of these is audited as a background for --ink at 4.5:1.
def weak_surfaces(tokens: dict[str, str]) -> list[str]:
    return sorted(n for n in tokens if n.endswith("-weak"))


def _srgb(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def ratio(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def parse_theme(css: str) -> dict[str, dict[str, str]]:
    """Return {block_name: {token: hex}} for every block that defines a `--bg`.

    Previously this matched only `:root` and `:root[data-theme="x"]`, which silently merged
    a light/dark PAIR written the standard way -- a base `:root` plus an override inside
    `@media (prefers-color-scheme: ...)`. Both blocks matched, the second overwrote the
    first, and the audit reported ONE palette while claiming to have checked the theme.
    A month shipped dark-first with a light override and was audited light-only until this
    was found; a whole palette had never been through the tool.

    Now: any rule that declares `--bg` is a palette, named by its media context and
    selector. Month-specific blocks (a poster route that pins its own tokens) are picked up
    for free, which is the point -- those are the ones that actually ship.
    """
    blocks: dict[str, dict[str, str]] = {}

    def add(name: str, body: str) -> None:
        tokens = dict(re.findall(r"--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;", body))
        if "bg" in tokens:
            blocks.setdefault(name, {}).update(tokens)

    # @media blocks first, so their inner rules are attributed to the right palette.
    consumed: list[tuple[int, int]] = []
    for m in re.finditer(r"@media([^{]*)\{", css):
        depth, i = 1, m.end()
        while i < len(css) and depth:
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
            i += 1
        inner, cond = css[m.end() : i - 1], m.group(1).strip()
        consumed.append((m.start(), i))
        label = "light" if "light" in cond else "dark" if "dark" in cond else cond[:24]
        for r in re.finditer(r"([^{}]+)\{([^{}]*)\}", inner):
            add(label, r.group(2))

    # then top-level rules, skipping anything already inside a media block
    outside = css
    for lo, hi in reversed(consumed):
        outside = outside[:lo] + outside[hi:]
    for r in re.finditer(r"([^{}]+)\{([^{}]*)\}", outside):
        sel = r.group(1).strip().split("\n")[-1].strip()
        name = "base" if sel.startswith(":root") else sel[:28]
        add(name, r.group(2))

    return blocks


def decorative_tokens(css: str) -> dict[str, str]:
    """Tokens a month has DECLARED purely decorative, with the reason, as

        /* a11y-decorative: rule -- 1px section dividers and table borders only; never
           used for a gridline, an axis or any data mark */

    WCAG 1.4.11 exempts pure decoration, and forcing a 3:1 section divider makes a page
    look like a spreadsheet for no accessibility gain. But the exemption is a claim, so it
    has to be written down next to the code and it has to name the reason. A token declared
    decorative and then used on a chart mark is a lie the reviewer can check.
    """
    out = {}
    for m in re.finditer(r"a11y-decorative:\s*([\w-]+)\s*(?:--|-)\s*([^*\n]+)", css):
        out[m.group(1).strip()] = m.group(2).strip()
    return out


def propose(target: float, bg: str, seed: str) -> str:
    """Nearest colour of the same hue that clears `target` against `bg`."""
    h = seed.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    hue, _, _ = colorsys.rgb_to_hsv(r, g, b)
    _, sat, _ = colorsys.rgb_to_hsv(r, g, b)
    best, best_d = seed, 1e9
    for v in range(3, 101):
        for s in (sat, min(1.0, sat * 1.15), max(0.0, sat * 0.85)):
            rgb = colorsys.hsv_to_rgb(hue, s, v / 100)
            cand = "#{:02X}{:02X}{:02X}".format(*tuple(round(x * 255) for x in rgb))
            rr = ratio(cand, bg)
            if rr >= target and abs(rr - target) < best_d:
                best, best_d = cand, abs(rr - target)
    return best


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    ap.add_argument(
        "--propose",
        type=float,
        default=None,
        help="suggest a replacement colour at this ratio for each failure",
    )
    args = ap.parse_args()

    theme = ROOT / args.year / args.month / "app" / "src" / "theme.css"
    if not theme.exists():
        raise SystemExit(f"no theme at {theme.relative_to(ROOT)}")

    css = theme.read_text(encoding="utf-8")
    blocks = parse_theme(css)
    decorative = decorative_tokens(css)
    failures = 0
    if decorative:
        print("\nDeclared decorative (WCAG 1.4.11 exempts pure decoration):")
        for k, why in decorative.items():
            print(f"    --{k}: {why}")

    for block, tokens in blocks.items():
        bg = tokens.get("bg")
        if not bg:
            continue
        print(f"\n=== {block.upper()}  (background {bg})")
        print(f"    {'token':<18} {'value':<9} {'ratio':>8}   {'needs':>5}  verdict")
        weak = set(weak_surfaces(tokens))
        for name, val in tokens.items():
            if name in SKIP or name in SURFACE_TOKENS or name in weak:
                continue
            if name in decorative:
                continue
            if not val.startswith("#"):
                continue
            need = TEXT_MIN if name in TEXT_TOKENS else NONTEXT_MIN
            against = tokens.get(PAIRED_AGAINST.get(name, ""), bg)
            r = ratio(val, against)
            ok = r >= need
            failures += not ok
            note = ""
            if not ok and args.propose:
                note = f"  -> try {propose(args.propose, against, val)}"
            on = "" if against == bg else f"  on {PAIRED_AGAINST[name]}"
            print(
                f"    {name:<18} {val:<9} {r:>7.2f}:1   {need:>5}  "
                f"{'PASS' if ok else 'FAIL'}{on}{note}"
            )

        # Tinted surfaces: body ink must stay readable on them.
        ink = tokens.get("ink")
        for name in weak_surfaces(tokens):
            val = tokens[name]
            if not val.startswith("#") or not ink:
                continue
            r = ratio(ink, val)
            ok = r >= TEXT_MIN
            failures += not ok
            note = ""
            if not ok and args.propose:
                note = f"  -> try {propose(args.propose, ink, val)} as the surface"
            print(
                f"    {name:<18} {val:<9} {r:>7.2f}:1   {TEXT_MIN:>5}  "
                f"{'PASS' if ok else 'FAIL'}  ink ON this surface{note}"
            )

    print()
    if failures:
        print(
            f"{failures} pair(s) below the WCAG minimum. Fix them or the accessibility "
            f"claim on the poster is false."
        )
        return 1
    print("All pairs clear WCAG 2.1 AA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
