# Submission - 2025/07 · Customer Satisfaction & Loyalty

> Challenge closed 24 Jul 2025. Built for practice and portfolio.

## LinkedIn post

```
OmniRetail asked nine questions about what drives customer satisfaction.
This survey cannot answer any of them, and that is the finding.

→ Satisfaction scores are indistinguishable from a uniform random draw across 1-10
  (chi-square p=0.637). No satisfied majority, no detractor cluster.
→ Eighteen tests: seven declared drivers plus age against satisfaction, seven
  segmentations against loyalty, three demographics against satisfaction factor. Not one
  survives Bonferroni at any defensible family size.
→ The brief's headline question - does contacting support hurt satisfaction? - comes out
  at +0.013 points on a 10-point scale, d = 0.004. But its 95% interval runs -1.08 to
  +1.10. So the answer is not "no effect". It is "not measured": a full point of damage
  in either direction fits this data comfortably.
→ Loyalty is non-monotonic against satisfaction: Low 5.84, High 5.65, Medium 4.47. A real
  relationship would be ordered. That is what noise looks like.

The useful part is the power analysis. With 120 customers the smallest difference this
study could detect at 80% power is 1.55 points - around a sixth of the scale. A support
experience that genuinely cost a full point of satisfaction would be invisible here. To
detect one point you need 144 customers per group; OmniRetail has about 60.

So the deliverable is not a satisfaction dashboard. It is a measurement design:
1. Act on none of these differences.
2. Re-run at ~150 responses per comparison group.
3. Collect a date and an order value - neither exists, despite the brief describing
   feedback "throughout 2024", so satisfaction cannot be tied to behaviour or trend at
   any sample size.

The centrepiece is an uncertainty ladder: every group in the study on one satisfaction
axis, each as a point estimate with its 95% confidence interval, over a shaded band
marking what the study could not have seen. On the six axes it draws by default, all 136
interval pairs overlap - and the caption is computed from the rows on screen, so it
re-states itself when you filter or add the seventh axis.
Not one of the ten published entries for this dataset draws a confidence interval.

Built as a custom web app - Polars → Parquet star schema → a Malloy semantic layer whose
measures pair every mean with its n and a minimum-detectable-difference - SolidJS, with
all 23 rendered figures recomputed in DuckDB and asserted to match. Body text is Atkinson
Hyperlegible, designed by the Braille Institute for low-vision readers; the chart encodes
estimate versus interval by shape as well as colour, so it reads in greyscale.

@OnyxData @ZoomCharts @EnterpriseDNA @BCS @SmartFramesUI @DataCareerJumpstart @packt
#dataDNA
```

- [x] Image - `exports/dashboard.png` (2560×1440) · Tags = the 7-tag union · `#dataDNA`
- [ ] Follow Onyx Data on LinkedIn

## Entry form

| Field | Value |
|---|---|
| Tool used | Other - custom web app (SolidJS + Vite + UnoCSS; Polars/DuckDB/Malloy build chain) |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **This survey cannot answer the questions it was designed to ask** |

## Portfolio description

> OmniRetail collected 120 customer satisfaction responses and asked nine questions of them. This
> report answers all nine, and the answer to every one is the same.
>
> Satisfaction here is **indistinguishable from a uniform random draw** over the 1-10 scale
> (χ²=7.00, p=0.637; mean 5.35 where uniform expects 5.50). Seven candidate drivers were declared
> before testing - loyalty level, support contact, repeat purchase, customer group, gender,
> location and satisfaction factor - and, with the age correlation that was also published, **not
> one of those eight survives Bonferroni correction** at α=0.00625. Three of the brief's questions
> ask about *loyalty* rather than satisfaction, so they are answered with a chi-square of loyalty
> against each segmentation: seven more tests, smallest p = 0.18. Eighteen tests in all; the
> smallest p anywhere is 0.023. The brief's own headline question, whether contacting support
> damages satisfaction, resolves to a difference of **0.013 points on a ten-point scale** (Cohen's
> d = 0.004, p = 0.98) - but with a 95% interval on that difference of **-1.08 to +1.10**, so the
> honest verdict is "not measured" rather than "no effect". Loyalty runs *non-monotonically*
> against satisfaction - Low 5.84, High 5.65, Medium 4.47 - which is the signature of noise rather
> than a paradox worth reporting.
>
> The useful finding is the one the brief did not ask for. At 80% power with roughly sixty
> customers per group, **the smallest difference this study could detect is 1.55 points**, about a
> sixth of the scale. A support experience that genuinely cost a full point of satisfaction would be
> invisible. Detecting that one-point effect needs 144 customers per group. So the correct
> deliverable is a measurement design, not a dashboard: act on none of these differences, re-run at
> ~150 per comparison group, and start collecting a date and an order value - neither is in the
> file, despite the brief describing feedback "throughout 2024", which means satisfaction cannot be
> tied to behaviour or trend at any sample size.
>
> The centrepiece is an **uncertainty ladder**: seventeen groups - six segmentation axes - on one
> shared satisfaction axis, each drawn as a point estimate with its 95% confidence interval, over a
> hatched band marking the region the study could not have seen into. All 136 interval pairs
> overlap, and every difference between two levels of the same axis (widest: 1.37, on loyalty)
> falls inside the ±1.55 undetectable band. Both of those sentences are **computed from the rows on
> screen rather than typed**, so they re-state themselves under every filter. A second toggle adds
> a seventh axis - the ten satisfaction factors, roughly twelve customers each - which is the one
> place intervals do separate: Product Quality clears the four lowest-scoring factors. That is R1,
> the most promising thing in the file, shown with its own refutation attached rather than left
> out. None of the ten published entries for this dataset draws a confidence
> interval at all.
>
> **Technical.** Raw CSV → Polars → a conformed Parquet star schema (`fct_customer` plus location,
> factor and segment dimensions, with `Location` split from "City.ST" so the brief's "cities or
> states" can be answered at either level) → a **12-view Malloy semantic layer** whose design
> argument is power-awareness: every mean travels with its `n`, a 95% CI half-width, and
> `min_detectable_difference` as a first-class measure, because a mean without its sample size is
> misleading on this data. 15 pytest assertions guard the grain and every published claim,
> including that the loyalty ordering stays non-monotonic and that no location is adequately
> powered. All 23 rendered figures are scraped from the DOM and re-asserted against an independent
> DuckDB recomputation - including the required-sample-size table, which is recomputed from the
> observed standard deviation rather than hardcoded.
>
> **Accessibility.** axe-core clean across desktop light, desktop dark, mobile and poster; every
> colour pair measured in both themes; protanopia, deuteranopia, tritanopia and greyscale renders.
> Estimate versus interval is carried by **shape first** - a filled dot against an open bar - so the
> chart survives greyscale entirely, and the accessible data tables expose `n` and both confidence
> bounds rather than just the mean. Body text is Atkinson Hyperlegible, designed by the Braille
> Institute for low-vision readers, with disambiguated numerals - a substantive choice for a report
> built on reading numbers carefully.
