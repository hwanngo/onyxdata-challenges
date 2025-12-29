# Submission - 2025/12 Animal Shelter Operations

Artifact: `exports/dashboard.png` (2560×1440). **A single image.**

## LinkedIn post

> **Three of these numbers are about the office.**
>
> This month's DataDNA dataset is real: 52,339 shelter stays from the City of Long Beach
> Animal Care Services, 2017-2025. Real data has real defects, and this one's are the ordinary
> defects of a system built to run a shelter rather than to be analysed - which makes them more
> consequential, not less, because a real shelter is making decisions on them.
>
> **1 · The live-release rate is 78.49%, not the 79.26% the file reports.** Its
> `was_outcome_alive` flag is not a measurement - it is "not explicitly euthanasia or died", so
> anything unusual defaults to *saved*. That includes 132 DISPOSAL records, 120 of them subtype
> `ACS DISPO`, body disposal - which the file's **own** `outcome_is_dead` column flags as dead.
> One record, two columns, opposite answers. It also includes 399 of the 400 animals that are
> still in the kennel. In 2025 alone the gap is 3.7 points, because November is 45% unresolved.
>
> That 0.76-point gap is worth splitting, because two thirds of it is not the misfiled rows at
> all: **0.51 points is the denominator** - 1,248 stays that are not outcomes, counted as if
> they were - and **0.26 points is the flag**. Fix only the 132 obviously-wrong DISPOSAL records
> and you keep two thirds of the error. The fix is definitional, not janitorial.
>
> **2 · Age is a staff guess for 38% of animals.** 17,301 of 45,810 dates of birth share the
> exact month *and* day of the intake date; chance would give about 134 - that is the null with
> the shelter's own intake seasonality in it, not a flat 1/365, which would say 125 and flatter
> the finding. A 129× excess either way. Staff record "about two
> years old" and the system back-dates a DOB from the day the animal arrived. Drop those and the
> apparent senior penalty mostly disappears: animals 12+ go from 77.5% to **87.7%** live release,
> and every adult band lands between 87.7% and 93.3%. The age column is partly a record of how
> much the shelter *knew* about the animal.
>
> **3 · The busiest day of the week is the day the counter is open.** Wednesday carries 19.7% of
> intakes against Monday's 7.8% - but split by who brings the animal in: owner surrenders go
> 3.7% Monday to 21.4% Wednesday, while field officers, who don't need the building open, swing
> 12.8% to 15.4%. Staffing on that pattern would be circular.
>
> **And the one that survives.** Seasonality reads the same in *both* channels - a 2.85× summer
> peak in the officer-driven series too. That agreement is the control: it is what makes the
> weekday result an artefact rather than a guess, and it means the season is the axis worth
> planning against.
>
> Underneath the corrections there's a working shelter: intake **condition** predicts survival
> better than species, age or anything else here (Cramér's V = 0.530, from 95.2% for animals
> arriving normal to 20.8% for severely ill). The largest outcome is RESCUE, not adoption. And a
> repeat intake is usually not a failure - it's an owned dog coming home, 95.1% live against
> 77.3%.
>
> Built with Polars, DuckDB, a Malloy semantic layer and SolidJS. Every figure is recomputed from
> parquet through an independent path and asserted against the page before publication - 49 of 49
> reconcile exactly. Three claims of my own were tested and killed; all three are published.
>
> @OnyxData @ZoomCharts @SmartFramesUI @DataCareerJumpstart
> #dataDNA

**Tag union for THIS month:** `@OnyxData` · `@ZoomCharts` · `@SmartFramesUI` ·
`@DataCareerJumpstart` · `#dataDNA`

## Portfolio entry

**Title:** Three of these numbers are about the office - auditing a shelter's own record

**Description:**

> An audit of 52,339 real shelter stays from Long Beach Animal Care Services. Three of the
> brief's twelve guiding questions turn out to ask the file about its own processes rather than
> about its animals - the live-release flag counts disposals and animals still in the kennel;
> the age column is a staff estimate for 38% of animals, back-dated from the intake day; and the
> weekday intake pattern is the shelter's opening hours. A fourth pattern, seasonality, reads the
> same through both the public counter and the field officers, and that agreement is what proves
> the other three.
>
> The signature chart shows all four measurements carried out twice, side by side. Three move.
> The one that doesn't is drawn in the page's only third colour, because it is the one a shelter
> can actually plan against.

## On technical depth, without DAX

The brief asks for a Power BI report; this is a web build, so there is no DAX to show. In its
place:

- **A semantic layer that names both readings.** `live_release_rate` and
  `live_release_rate_as_filed` are separate measures, so no view can pick the wrong one by
  accident. 15 views run clean.
- **A schema whose shape is an argument.** `dim_outcome` carries my verdict next to the source's
  for every outcome type, so the disagreement is a row rather than a claim. "Still in shelter" is
  an outcome value, not a null. Age has two columns and the honest one is smaller.
- **A build that refuses to write if its own conclusions stop holding** - it raises unless the
  censored months form a contiguous tail, and unless the public-versus-officer weekday contrast
  survives.
- **Verification through a second engine.** 49 of 49 rendered figures recomputed from parquet
  through DuckDB and asserted against the DOM - including the Cramér's V the page quotes, the
  seasonality-aware chance model behind the DOB finding, and both orderings of the headline
  gap's decomposition. Nothing on the page is a literal.
- **Statistics used to bound claims.** Wilson intervals on every rate, because one species here
  has three records; Cramér's V to rank predictors; a chance model for the DOB collision rate;
  and a control series that turns an inference into a finding.
- **Accessibility as measured evidence.** 0 axe violations across four contexts after fixing a
  serious `nested-interactive` defect; every colour pair measured in both themes; the semantic
  pair retuned after measuring 1.07:1 under protanopia.
