# Assumptions - 2025/08 · Fitness Membership Analytics (MyGym)

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number also appears as a footnote in the dashboard.

There is **no data dictionary in this ZIP**. Column semantics are inferred from names and verified
against the data. That makes this file unusually load-bearing this month.

## Data provenance

| | |
|---|---|
| Source URL | `https://datadna.onyxdata.co.uk/wp-content/uploads/2025/07/DataDNA-Dataset-Challenge-Fitness-Membership-Analytics-Dataset-August-2025.zip` |
| Retrieved | 2025-08-31, validated by ZIP magic bytes (`PK\x03\x04`), not HTTP status |
| Onyx's file, or a substitute? | **Onyx's own file.** No substitution. |
| Expected rows / actual rows | not stated anywhere in the brief / **1,998** |
| sha256 (ZIP) | `3a2f7b552af56fcb0b8061d55ea9f0069ca423111da37bd626c29fe1252b01a2` |
| sha256 (CSV) | `09cfc87eb5a59f7a8704d900f84aba7f5e24429f4b99ba2113f66472c5f72be0` |

Per-file checksums for all six archive members are recorded in `challenges.yml`.

## Business semantics

| | Term | How I defined it | Why | Alternative reading |
|---|---|---|---|---|
| **A-1** | **`final_price` unit** | An **effective monthly rate**. Annual revenue = `sum(final_price) × 12`. | It is the only reading under which a 0.75× "Early Bird (Annual)" factor is not absurd - an annual plan billed once at 0.75 × the monthly list price would cost $15/yr against $240/yr for monthly. Under the monthly reading, "commit longer, pay less per month" is the standard subscription pattern and the 1.00 / 0.90 / 0.75 ladder is coherent. | `final_price` is the amount charged **per billing period**. Annualising under that reading gives **579,098** against **826,486** - a **1.43× fork**. No column resolves it. |
| **A-2** | **Grain** | One row = one member. | The brief describes member-level attributes throughout, and there are no duplicate rows. | **This is unverifiable.** There is no ID column of any kind (DQ1). Zero duplicates is not evidence - the distinct-value space across 26 columns is ~1e28, so zero collisions in 1,998 draws is expected under any hypothesis. A row could be a member-month, a household, or a contract. |
| **A-3** | **"Churned"** | Not defined, because **it cannot be**. | `last_visit_date` is bounded to a 60-day window; 0% of members fall outside it. Any churn threshold would return zero by construction. | Some entrants will define churn as "no visit in 30 days" and report 49.1%. That number is an artefact of where the window happens to end, not a churn rate. |
| **A-4** | **Tenure** | `last_visit_date - join_date`, in days. | `join_date` spans 2022-07-24 → 2025-06-19 and is genuinely variable (890 distinct values), so tenure is measurable even though retention is not. | `today - join_date` - but "today" is undefined for a historical file, and it would add a constant to every row, changing nothing. |
| **A-5** | **As-of date** | **2025-07-22**, the maximum `last_visit_date`. | The file carries no extract date. Using its own maximum is the only choice that does not invent information. | Any later date would push every member's inactivity up by a constant and would be a number I made up. |
| **A-6** | **`avg_time_check_in` / `_out`** | An average across the member's visits, not a single event. | The column name says `avg_`, and `duration_in_gym_minutes` is exactly their difference on every row. | If they were a single visit's timestamps, `visit_per_week` would be uncorrelated with them - which is what we observe either way, so nothing downstream changes. |
| **A-7** | **`days_per_week`** | The set of weekdays the member typically attends. | Its token count equals `visit_per_week` on all 1,998 rows. | Could be days the member is *entitled* to attend - but then "Weekdays only" members would not list Sat/Sun, and 58.5% of them do. The typical-attendance reading is the one the data supports. |
| **A-8** | **`latitude` / `longitude`** | **City centroids, not member addresses.** | They are 1:1 with `home_gym_location` - 10 cities, 10 coordinate pairs. | None available. This rules out any distance-to-gym or catchment analysis; the map is a locator, not a density surface, and is labelled as such. |
| **A-9** | **"Student" discount** | A discount *label*, with no eligibility guarantee. | It carries no age signal - holders are the file's **oldest** cohort (mean 32.1 vs 30.2). | Mature students exist, so an older student cohort is not impossible. But eligibility-checked fields left-skew; this one right-shifts. The claim made in the UI is "carries no age signal", not "these people are not students". |

## Data handling

| Decision | Rows affected | Rationale |
|---|---|---|
| **No rows dropped.** | 0 of 1,998 | There are zero nulls in the file and no malformed values. Every row reaches every figure. |
| Raw folder never written to | - | Standing rule. All transforms output to `data/curated/`. |
| `Elite` (n=199) and `Quarterly` (n=187) flagged as thin | 386 | Not excluded - flagged. Both are shown with visibly wider intervals rather than as point estimates. |
| `Carousel`-style thin-cell suppression | n/a | No cell is thin enough to need it this month; the smallest location is Oakland at n=165. |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can
> reproduce. This month the log is empty, which is itself worth stating.

## Known limitations

- **This is synthetic data with visible generator fingerprints.** `has_drink_subscription` is
  exactly 999/999. Check-in time is uniform on 08:00-21:00 (KS p=0.26). The four amenity flags sit
  at ~50% and are independent of age, tier and location. Findings should be read as *properties of
  this file*, and the UI says so rather than implying MyGym is a real chain with real members.
- **Effect sizes are small where they exist.** The location→duration effect is η²=0.023 / ω²=0.019.
  ω² is reported beside η² because at 2% of variance the bias correction is a fifth of the estimate.
- **The Standard-tier group-class gap is a single deviant cell** (40.6% vs ~54%, the other three
  intervals overlapping). It clears Bonferroni at p=3.9e-08, but one isolated cell is exactly the
  shape a generator artefact takes. Reported with that caveat, not as strategy.
- **The minors finding is a missing control, not an observed violation.** The amenity flags are
  independent of age, so "176 members aged 12-15 hold sauna access" describes the *data model*: no
  guardian-consent, supervision or age-gate column exists. Framed in the UI as a question for MyGym
  to answer about its access-control system, not as an assertion that children are being harmed.
- **No AI scores are published** for any DataDNA month (all portfolio entries carry
  `data-score="0"`), so the definition-of-done line "beats the top scorer on ≥2 dimensions" cannot
  be mechanically checked. Benchmarking for this month is qualitative.
- **The ZoomCharts sponsor track is out of scope** - it requires Power BI and ≥2 ZoomCharts visuals.
  This entry is SolidJS. A deliberate stack choice, not an oversight.
- **Not deployed.** `docs/STACK.md` defers deployment; the deliverable is the poster PNG.
