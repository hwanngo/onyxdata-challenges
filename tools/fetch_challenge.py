#!/usr/bin/env python3
"""Scrape an Era 2 challenge page into brief.md  (Gate G1).

Per-challenge details vary and each page contradicts itself: the Step-2 tag list,
the prefilled LinkedIn share text, and the FAQ each name a different sponsor set.
We collect all three and take the union.

Usage:
    python tools/fetch_challenge.py 2025 05
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "challenges.yml"
UA = "onyxdata-dnakit/0.1 (+research; contact via repo)"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    args = ap.parse_args()

    folder = f"{args.year}/{args.month}"
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    entry = next((c for c in reg["challenges"] if c["folder"] == folder), None)
    if entry is None:
        raise SystemExit(f"{folder} not in challenges.yml")
    if entry.get("era") == 1:
        raise SystemExit(
            f"{folder} is Era 1 - no challenge page exists.\n"
            "You must invent the business framing yourself. See .workbench/docs/PLAYBOOK.md G1."
        )

    url = entry["challenge_url"]
    html = requests.get(url, headers={"User-Agent": UA}, timeout=60).text
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    # dataset link - never guess this, naming and upload month are inconsistent
    zips = [a["href"] for a in soup.find_all("a", href=True) if a["href"].lower().endswith(".zip")]

    # sponsor tags: union across the three contradictory lists on the page
    tags = sorted(set(re.findall(r"@([A-Za-z][A-Za-z0-9 &._-]{2,30})", text)))

    # requirement bullets - when present these are a de facto spec
    bullets = [li.get_text(" ", strip=True) for li in soup.find_all("li")]
    bullets = [b for b in bullets if 40 < len(b) < 400]

    md = [
        f"# Brief - {args.year}/{args.month}",
        "",
        f"- **Title:** {entry['title']}",
        f"- **Challenge page:** {url}",
        f"- **Playground:** {entry.get('playground_url')}",
        f"- **Dataset ZIP:** {zips[0] if zips else '**NOT FOUND - scrape manually**'}",
        "",
        "## Scenario",
        "",
        "> TODO: paste the scenario paragraphs verbatim from the page.",
        "",
        "## Stated objective",
        "",
        "> TODO: verbatim.",
        "",
        "## Explicit requirements",
        "",
        "> If the page carries a bulleted list of gaps the report *should address*, every bullet",
        "> below is a requirement and becomes a G7 checklist. If there is no such list, say so",
        "> explicitly - do not leave this section empty.",
        "",
    ]
    md += [f"- [ ] {b}" for b in bullets[:20]] or ["- (no requirements list found on this page)"]
    md += [
        "",
        "## Submission mechanics (THIS month)",
        "",
        "Union of the Step-2 list, the prefilled share text, and the FAQ - they contradict each other.",
        "",
    ]
    md += [f"- @{t}" for t in tags[:20]]
    md += [
        "- Hashtag: `#dataDNA`",
        "- Single image only.",
        "",
        "## Timeline",
        "",
        "> TODO: start, deadline, judging window, announcement.",
        "",
        "## Benchmark",
        "",
        "> TODO: 3-5 published entries from /portfolio/ with their visible AI scores.",
        "> What did the high scorers do? What did the low scorers miss?",
        "",
        "## Lessons being applied from .workbench/docs/LEARNINGS.md",
        "",
        "1. TODO\n2. TODO\n3. TODO",
    ]

    dest = ROOT / args.year / args.month / "brief.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(md), encoding="utf-8")
    print(f"Wrote {dest.relative_to(ROOT)}")
    print("Scraping is a starting point, not the brief. Fill every TODO by reading the page.")
    if zips:
        print(f"\nDataset URL found: {zips[0]}\nAdd it to challenges.yml.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
