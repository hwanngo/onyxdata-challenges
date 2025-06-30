# Submission - 2025/06 · Social Media Content Performance

> Challenge closed 24 Jun 2025. Built for practice and portfolio; copy is submission-ready.

## LinkedIn post

```
Only one number in this June 2025 DataDNA file is real.

I audited the dataset before analysing it, and most of what looks like performance
turned out not to be a measurement:

→ Impressions = views × a random factor between 1.1 and 1.3 (r=0.998). It carries no
  information beyond views.
→ Engagement = engagement rate × views. Fully determined.
→ The engagement rate itself was drawn from four fixed bands keyed to content tier -
  Entertainment 5-10%, Product Promotion 8-15%, Event 10-18%, Customer Story and
  Educational 15-25%. Round bounds, 100% containment, uniform inside each band.

So "educational content outperforms entertainment 2.6×" - the finding this dataset most
invites - restates how the file was built. I nearly published it myself before an
adversarial review killed it.

What survives: views is the one free variable, and format moves it.
→ Video earns 3.4× the median views of an image: 52.6% of posts returning 75.8% of views.
→ Live Stream is the trap - costliest to produce, 16.5% of output, lowest median of any format.
→ Placement does not move it. Six platforms sit 3.7% apart; eight regions look 14.3% apart
  but that gap is not significant (p=0.30). No hour and no weekday outperforms.
→ Ranking hashtags recovers the content tier, not hashtag effectiveness: η² falls from
  0.751 to 0.018 once you hold category constant.

Also worth saying: the brief describes four platforms and a 2024 dataset. The file has
six platforms (YouTube is the largest) and runs seventeen months to May 2025.

Built as a custom web app - Polars → Parquet star schema → a 12-view Malloy semantic
layer → SolidJS with in-browser aggregation. All 27 rendered figures are recomputed from
the parquet in DuckDB and asserted to match. WCAG 2.1 AA: keyboard-operable charts,
screen-reader data tables, and the measured/derived distinction carried by colour, hatch
pattern AND text so it survives greyscale and colour-vision deficiency.

@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt
#dataDNA
```

- [x] Image - `exports/dashboard.png` (2560×1440)
- [x] Tags = union of Step-2, share text and the PDF (7 - see `brief.md`)
- [x] `#dataDNA`
- [ ] Follow Onyx Data on LinkedIn

## Entry form

| Field | Value |
|---|---|
| Tool used | Other - custom web app (SolidJS + Vite + UnoCSS; Polars/DuckDB/Malloy build chain) |
| Power BI report | n/a - ZoomCharts mini-challenge requires ≥2 Drill Down visuals in a .pbix |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **Only one number in this file is real** |

## Portfolio description

> This report starts by auditing its own dataset, and that audit is the finding.
>
> Of the five metrics a social dashboard normally leads with, only **views** is a measurement.
> `Impressions` is views multiplied by a uniform random factor on [1.1, 1.3] - support exactly
> [1.100009, 1.299975], r=0.998 - so it carries no independent information. `Engagement` is the
> engagement rate times views, exactly. And the **engagement rate is not an outcome at all**: every
> value was drawn from one of four uniform bands selected by content tier, with round-number bounds
> and 100% containment across 88.2% of rows. That means "educational content outperforms
> entertainment 2.6×" - the conclusion this data most invites, and the one the published field is
> implicitly reporting - restates the generator's parameter table rather than describing an audience.
> I reached that conclusion first myself; an adversarial review of my own thesis killed it, and the
> methodology lesson (test uniformity *within* groups, not just globally) mattered more than the
> finding would have.
>
> What survives is worth having. Views is the one free variable, and **format moves it**: video
> earns 3.4× the median views of an image and returns 75.8% of all views from 52.6% of posts, while
> Live Stream - the most expensive format to produce - occupies 16.5% of output for 7.3% of views
> and the lowest median of all seven. **Placement does not move it**: six platforms sit within 3.7%
> of each other (platform explains 0.4% of the variance), the eight regions' apparent 14.3% gap is
> not significant at p=0.30, and neither publishing hour (p=0.19) nor weekday (p=0.83) has any
> effect. The hashtag question resolves the same way: ranking hashtags recovers the content tier,
> not hashtag effectiveness - η² collapses from 0.751 to 0.018 once category is held constant, and
> the dashboard lets you perform that refutation yourself with one toggle.
>
> Two things the brief gets wrong about its own data, both verified: it names four platforms when
> the file has six (YouTube is the largest), and calls it "a 2024 dataset" when it runs seventeen
> months to May 2025. Click-through is also structurally absent - two platforms record it on
> every post, three record none at all, and LinkedIn records it by post type with two formats that
> do so only partially. It is measurable on 33.2% of posts, and any platform CTR ranking silently
> drops three of six platforms.
>
> **Technical.** The AI rubric names DAX; there is none here, so the modelling is the evidence.
> Raw XLSX → Polars → a conformed Parquet star schema (`fct_post` plus five dimensions, with the
> click-tracking rule modelled as data rather than left implicit) → a **12-view Malloy semantic
> layer** that compiles and runs, whose measures are deliberately split into REAL and DERIVED so no
> view can present a label as an outcome. 21 pytest assertions guard grain, fan-out, orphans and the
> central claim. Then **all 27 figures rendered on the page are scraped from the DOM and re-asserted
> against an independent DuckDB recomputation of the parquet** - a different engine from the
> browser's aggregation - with zero tolerance.
>
> **Accessibility** as a deliverable: axe-core clean across desktop light, desktop dark, mobile and
> the poster; every colour pair measured in both themes; protanopia, deuteranopia, tritanopia and
> greyscale renders of the poster. The measured-versus-manufactured distinction is carried by
> colour, a hatch pattern *and* the literal word, so the argument is fully legible with no colour
> at all.

## Consents

- [ ] AI feedback by email
- [ ] Draft portfolio entry
