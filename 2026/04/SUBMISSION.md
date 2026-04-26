# Submission - 2026/04 Maritime Logistics & Terminal Efficiency (Mar-Apr 2026)

**The challenge closed 20 April 2026.** Portfolio work, not a live entry.

## LinkedIn post

```
There is one real number in this dataset. It is also the one that will get you fired.

The brief: you are a Senior Operations Analyst at a maritime logistics company. Find the
bottlenecks, find the underperforming terminals and vessels, and cut cargo movement times by
15%. Start with the 2021 Suez blockage.

So I looked for what predicts a long cargo move. Regional hub explains 0.009% of the
variation. Vessel category, 0.05%. Day or night, 0.02%. The terminal, 0.29%. The largest
effect in the entire file is the vessel's build year, at 0.79%. Statisticians call 1% "small".
Nothing here reaches it.

Then I looked at the Suez week. The Ever Given blocked the canal 23-29 March 2021. Movement
duration in that week against every other day in four years: Mann-Whitney p = 0.504. Within
2021, March and April actually run 5.1% ABOVE the other ten months.

The archive ships its own data dictionary, which documents the generator for every column.
That should be a gift. It is wrong in eleven places - move_duration is described as normal and
is Uniform(0,1000); container_count is described as Poisson and has a variance-to-mean ratio
of 165; "movement_id" is called the primary key and has 1,001 values across 15,000 rows.

But one thing IS real. Movements grew 3,000 → 3,750 → 4,050 → 4,200. The daily allocation is
more variable than a random one, beyond the maximum of a thousand simulations. That single
signal is what makes every null above a measurement rather than a failure to look.

And it is the dangerous one. 2021 is the lowest year, so that ramp looks exactly like recovery
from a disruption that left no trace. Put it on a slide next to the brief and you will be
wrong twice.

The report ends where an honest one has to: seven columns that would make the VP's three
questions answerable. Starting with the terminal capacity the brief itself admits is missing.

Built with SolidJS, Polars, DuckDB and a Malloy semantic layer. Every figure recomputed from
parquet by a second engine before publication.

@OnyxData @SmartFramesUI @DataCareerJumpstart @packt #dataDNA
```

- [x] Image - `exports/dashboard.png` (2560×1440)
- [x] Tags = union of the Step-2 list and the prefilled share text (`@packt` appears only in
      the latter). **No ZoomCharts this month** - the sponsor is absent from the page and there
      is no read-me in the archive, re-checked at G8
- [ ] Following Onyx Data on LinkedIn - *user action*

## Entry form

| Field | Value |
|---|---|
| Tool used | Other - custom web app (SolidJS + Malloy/DuckDB) |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **There is one real number in this dataset** |

## Portfolio description

> A maritime logistics VP asks three questions: where are the bottlenecks, which terminals and
> vessels underperform, and how do we cut movement times 15%? This report answers all three
> with "the data cannot support this" - and then proves it rather than asserting it.
>
> Nothing in the file predicts how long a cargo move takes. Across every axis the brief names -
> regional hub, vessel category, shift, terminal, vessel age, cargo size, year - the largest
> effect is η² = 0.0079, against 0.01 for what is worth calling small. Both headline measures
> are Uniform(0,1000), which the archive's own data dictionary gets wrong along with seven
> other claims it makes about itself. The 2021 Suez blockage the brief is built around left no
> trace: p = 0.504.
>
> What stops that being an excuse is a positive control. One thing in the file is genuinely
> structured - movement counts grow monotonically, and the daily allocation exceeds the maximum
> of a thousand simulated multinomials. The instrument works. The nulls are measurements. And
> that single real signal is flagged as the most dangerous object in the dataset, because 2021
> is the lowest year and the ramp will be handed to the Suez story by anyone who does not check.
>
> **Technical.** Rubric A names DAX; there is none, so the modelling is made legible instead.
> The curated layer is built by a script whose five decisions each *raise* on violation -
> including the thesis itself, so the build fails rather than quietly publishing a changed
> finding. It refuses to expose a rate column anywhere, because every rate this file could
> express is noise and a model that cannot compute one cannot have it charted. A **Malloy**
> semantic layer of 15 views sits on top. Verification runs on two engines and two routes: 32
> pytest assertions that mostly pin *absences*, then every rendered figure scraped from the DOM
> and recomputed through DuckDB.
>
> **Accessibility.** Zero axe violations across four contexts and separately with the guided
> tour open. The histogram is keyboard-traversable and exposed as a table. The signature
> survives all three colourblindness simulations and full greyscale, because it is encoded on
> position and texture rather than hue.

## Consents

- [ ] AI feedback by email - *user action*
- [ ] Draft portfolio entry - *user action*
