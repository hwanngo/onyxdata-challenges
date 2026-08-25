#!/usr/bin/env python3
"""Download and unzip a DataDNA dataset into <YEAR>/<MONTH>/<zip-stem>/.

The critical behaviour here is refusing to trust HTTP 200. Era 1 datasets are
account- or email-gated, and the old archive 301-redirects to the homepage, so
the expected failure mode is a 200 response whose body is an HTML login page.
We assert the ZIP magic bytes before writing anything.

Usage:
    python tools/fetch_dataset.py 2025 06
    python tools/fetch_dataset.py 2025 06 --url https://.../file.zip
    python tools/fetch_dataset.py 2021 01 --session ~/.onyxdata-session
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import zipfile
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "challenges.yml"
ZIP_MAGIC = b"PK\x03\x04"
UA = "onyxdata-dnakit/0.1 (+research; contact via repo)"


class Blocked(Exception):
    """Dataset could not be retrieved. Never substitute silently."""


def load_registry() -> dict:
    return yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))


def find_entry(reg: dict, folder: str) -> dict:
    for c in reg.get("challenges", []):
        if c.get("folder") == folder:
            return c
    raise SystemExit(f"{folder} is not in challenges.yml - add it first.")


def looks_like_zip(body: bytes) -> bool:
    return body[:4] == ZIP_MAGIC


def make_read_only(root: Path) -> None:
    """Remove write permissions from every extracted source file."""
    for path in root.rglob("*"):
        if path.is_file():
            path.chmod(path.stat().st_mode & ~0o222)


def remove_raw_dir(root: Path) -> None:
    """Make a protected archive removable before an explicit forced replacement."""
    for path in root.rglob("*"):
        path.chmod(path.stat().st_mode | 0o200)
    root.chmod(root.stat().st_mode | 0o200)
    shutil.rmtree(root)


def diagnose(body: bytes, content_type: str) -> str:
    head = body[:400].decode("utf-8", "replace").lower()
    if "<html" in head or "text/html" in content_type:
        if any(w in head for w in ("login", "sign in", "register", "password")):
            return "HTML login page - this dataset is account-gated"
        if "kit.com" in head or "convertkit" in head:
            return "Kit/ConvertKit email-capture page - dataset is delivered by email"
        return "HTML page, not an archive - likely a redirect to the homepage"
    return f"unexpected content-type {content_type!r}, first bytes {body[:8]!r}"


def download(url: str, session_file: Path | None) -> bytes:
    s = requests.Session()
    s.headers["User-Agent"] = UA
    if session_file and session_file.exists():
        import http.cookiejar

        jar = http.cookiejar.MozillaCookieJar(str(session_file))
        jar.load(ignore_discard=True, ignore_expires=True)
        s.cookies = jar  # type: ignore[assignment]

    r = s.get(url, allow_redirects=True, timeout=120)
    if r.status_code != 200:
        raise Blocked(f"HTTP {r.status_code} from {url}")

    body = r.content
    if not looks_like_zip(body):
        raise Blocked(diagnose(body, r.headers.get("content-type", "")))
    return body


def mark_blocked(folder: str, reason: str) -> None:
    """Record the block in challenges.yml rather than failing silently."""
    print(f"\n  BLOCKED  {folder}: {reason}", file=sys.stderr)
    print(
        "  Set status: blocked and blocked_reason in challenges.yml, then see "
        "docs/DATA_ACCESS.md for recovery routes.\n"
        "  Do NOT substitute another dataset without recording it in assumptions.md.",
        file=sys.stderr,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("year")
    ap.add_argument("month")
    ap.add_argument("--url", help="override the registry dataset_url")
    ap.add_argument("--session", type=Path, help="Netscape cookie jar for gated downloads")
    ap.add_argument("--force", action="store_true", help="re-download even if raw folder exists")
    args = ap.parse_args()

    folder = f"{args.year}/{args.month}"
    reg = load_registry()
    entry = find_entry(reg, folder)
    dest_parent = ROOT / args.year / args.month
    dest_parent.mkdir(parents=True, exist_ok=True)

    existing = entry.get("dataset_folder")
    if existing and (dest_parent / existing).is_dir() and not args.force:
        print(f"Raw data already present at {folder}/{existing} - leaving it alone.")
        print("Raw data is immutable. Use --force only if you know it is corrupt.")
        return 0

    url = args.url or entry.get("dataset_url")
    if not url:
        mark_blocked(
            folder,
            "no dataset_url in registry"
            + (" (Era 1 is gated - no direct link exists)" if entry.get("era") == 1 else ""),
        )
        return 2

    print(f"Fetching {url}")
    try:
        body = download(url, args.session)
    except Blocked as e:
        mark_blocked(folder, str(e))
        return 2

    stem = Path(url.split("?")[0]).stem
    zip_path = dest_parent / f"{stem}.zip"
    zip_path.write_bytes(body)
    sha = hashlib.sha256(body).hexdigest()

    out_dir = dest_parent / stem
    if out_dir.exists():
        remove_raw_dir(out_dir)
    out_dir.mkdir()
    with zipfile.ZipFile(zip_path) as z:
        bad = z.testzip()
        if bad:
            mark_blocked(folder, f"corrupt archive, first bad member {bad}")
            return 2
        z.extractall(out_dir)
    zip_path.unlink()
    make_read_only(out_dir)

    files = sorted(p.relative_to(out_dir) for p in out_dir.rglob("*") if p.is_file())
    print(f"\nExtracted to {out_dir.relative_to(ROOT)}/  ({len(files)} files)")
    for f in files[:25]:
        print(f"  {f}")
    if len(files) > 25:
        print(f"  ... and {len(files) - 25} more")

    print(f"\nsha256: {sha}")
    print(f"Record in challenges.yml under {folder}:")
    print(f'  dataset_folder: "{stem}"')
    print(f'  sha256: "{sha}"')
    print("\nThis folder is now READ-ONLY. All transforms output to data/curated/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
