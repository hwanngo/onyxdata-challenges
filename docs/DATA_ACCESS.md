# DATA_ACCESS.md - why Era 1 downloads fail, and how to recover them



## The split

| | Era 1 - 2021-01 → 2025-04 (52) | Era 2 - 2025-05 onward |
|---|---|---|
| Download | **gated** | direct ZIP on `wp-content/uploads` |
| `curl` works? | no | yes |
| Brief | none | full challenge page |

## Why Era 1 is gated

Era 1 datasets are distributed to registered users. Playground detail pages track per-dataset
download counts, and the site carries Login / Register / Account: a download needs a DataDNA
account, and some months are delivered by email signup instead. An unauthenticated `curl`
therefore cannot fetch them.

**The supported route is to register with Onyx Data and download normally.** Everything below is
about what to do for a month where that is not possible - a dataset withdrawn from the site, or a
link that now 404s - and about proving that whatever you did get is actually the right file.

## The old archive is dead

`onyxdata.co.uk/data-dna-dataset-challenge/datadna-dataset-archive/` now **301-redirects to the new
homepage**. Any pre-2025 link lands somewhere useless while returning 200 OK.

> **Never treat HTTP 200 as success.** Assert the body starts with the ZIP magic bytes `PK\x03\x04`
> and the Content-Type is an archive. An HTML login page returning 200 is the *expected* failure mode.

---

## When a dataset is no longer available

### Route A - Wayback Machine *(only route that yields Onyx's exact file)*

The old archive listed direct download links for every dataset before it started redirecting.

```bash
curl "http://archive.org/wayback/available?url=onyxdata.co.uk/data-dna-dataset-challenge/datadna-dataset-archive/"

# enumerate every archived Onyx upload
curl "http://web.archive.org/cdx/search/cdx?url=onyxdata.co.uk/wp-content/uploads/*&output=json&collapse=urlkey&limit=5000" \
  | grep -Ei '\.(zip|xlsx|csv)'
```

Also try the staging mirror `onyxdata.embedinfosoft.com`, which carried the same archive.

### Route B - the original upstream source

Most Era 1 datasets are republished public data, not Onyx originals. Where the upstream publisher
is identifiable, go to them directly rather than to a redistribution: it is the only copy whose
provenance you can actually state in `assumptions.md`.

### Route C - a near-equivalent public dataset

Equivalent data, **not identical**. Mapping with confidence tiers is in `challenges.yml`
(`fallback_confidence`: `H` high · `M` likely, verify shape · `S` Onyx-synthetic, unavailable elsewhere).

### Route D - accept it's unrecoverable

Set `status: blocked` with a reason in `challenges.yml` and move on. **Never substitute silently.**

---

## Verification - not optional

**Match on row count and column names. Never on filename.**

Community writeups and Playground pages usually state the shape - e.g. the Apr 2025 healthcare
writeup says 55,500 patients, which pins it to one specific public file.

Record in `assumptions.md`:
- source URL and retrieval date
- expected vs actual row count, and the column list
- whether this is Onyx's own file (Route A) or a substitute (Route B/C)

**If it's a substitute, the G1 benchmarking step is void for that month** - your numbers cannot
reconcile against published entries. Note it in the retro and don't chase the discrepancy.

## Known traps

| Dataset | Trap |
|---|---|
| 2021/06 Covid-19 | Living dataset. JHU/OWID change daily; the 2021 vintage is gone. Right columns, wrong numbers, no error |
| 2022/09 Data Science Salaries | ai-jobs.net updates continuously. Same problem |
| 2022/08 Star Wars | Could be SWAPI (character/film records) *or* the FiveThirtyEight survey (respondent opinions). Completely different files, same name |
| 2023/07 ×2, 2024/05 ×3 | Month collisions in Onyx's own tagging. No 2023-05, 2023-06, or 2024-06 exists. Resolve by publication order or suffix the folder |
| A 2025 e-commerce month | Challenge slug contains a non-breaking hyphen (U+2011) in "e-commerce". ASCII hyphen 404s. Copy from the DOM |
