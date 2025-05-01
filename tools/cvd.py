#!/usr/bin/env python3
"""Colour-vision-deficiency simulation of the poster  (Gate G7 accessibility evidence).

Accessibility is scored in AI rubric B *and* carries its own 30-point award. "We used a
colourblind-safe palette" is a claim; four rendered images are evidence. This produces
them, so the claim can be checked rather than believed.

Method: Viénot, Brettel & Mollon (1999) - convert sRGB to LMS, project onto the plane of
colours the missing cone cannot distinguish, convert back. This is the standard
dichromat simulation, not a hue rotation.

Greyscale is included because it is the harshest test of "does meaning survive without
colour" and it catches encodings that a CVD sim happens to leave separable.

    python tools/cvd.py 2025 08
    python tools/cvd.py 2025 08 --src exports/dashboard.png

Writes <month>/exports/a11y/poster-{protanopia,deuteranopia,tritanopia,greyscale}.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# sRGB <-> LMS (Hunt-Pointer-Estevez, normalised to D65), via linear RGB.
RGB2LMS = np.array(
    [
        [0.31399022, 0.63951294, 0.04649755],
        [0.15537241, 0.75789446, 0.08670142],
        [0.01775239, 0.10944209, 0.87256922],
    ]
)
LMS2RGB = np.linalg.inv(RGB2LMS)

# Dichromat projection matrices in LMS (Viénot/Brettel/Mollon 1999).
SIM = {
    "protanopia": np.array(
        [
            [0.0, 1.05118294, -0.05116099],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ]
    ),
    "deuteranopia": np.array(
        [
            [1.0, 0.0, 0.0],
            [0.9513092, 0.0, 0.04866992],
            [0.0, 0.0, 1.0],
        ]
    ),
    "tritanopia": np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [-0.86744736, 1.86727089, 0.0],
        ]
    ),
}


def to_linear(srgb: np.ndarray) -> np.ndarray:
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def to_srgb(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0.0, 1.0)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def simulate(img: Image.Image, kind: str) -> Image.Image:
    a = np.asarray(img.convert("RGB"), dtype=np.float64) / 255.0
    lin = to_linear(a)
    lms = lin @ RGB2LMS.T
    lms = lms @ SIM[kind].T
    return Image.fromarray((to_srgb(lms @ LMS2RGB.T) * 255).round().astype(np.uint8))


def greyscale(img: Image.Image) -> Image.Image:
    """Luminance-correct greyscale (Rec.709 on LINEAR light, not on gamma-encoded bytes).

    `Image.convert("L")` weights the gamma-encoded channels, which flatters a palette by
    exaggerating differences it should not. Doing it in linear light is the honest test.
    """
    a = np.asarray(img.convert("RGB"), dtype=np.float64) / 255.0
    y = to_linear(a) @ np.array([0.2126, 0.7152, 0.0722])
    g = (to_srgb(y) * 255).round().astype(np.uint8)
    return Image.fromarray(np.dstack([g, g, g]))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    ap.add_argument("--src", default="exports/dashboard.png")
    args = ap.parse_args()

    month_dir = ROOT / args.year / args.month
    src = month_dir / args.src
    if not src.exists():
        raise SystemExit(f"no poster at {src.relative_to(ROOT)} - run tools/shoot.py first")

    out_dir = month_dir / "exports" / "a11y"
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(src)
    print(f"source {src.relative_to(ROOT)}  {img.width}x{img.height}")
    for kind in SIM:
        p = out_dir / f"poster-{kind}.png"
        simulate(img, kind).save(p, optimize=True)
        print(f"  wrote {p.relative_to(ROOT)}")
    p = out_dir / "poster-greyscale.png"
    greyscale(img).save(p, optimize=True)
    print(f"  wrote {p.relative_to(ROOT)}")

    print("\nNow LOOK at them. The question is not 'are the colours different' but")
    print("'can I still tell which mark is which'. If the answer needs colour, the")
    print("encoding is wrong - add shape, pattern or a direct label.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
