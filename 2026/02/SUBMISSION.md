# Submission - 2026/02 Pharmacy Sales & Profitability (Jan-Feb 2026)

**The challenge closed 20 February 2026.** This is portfolio work, not a live entry - the
copy below is written to be submittable, and the deadline is recorded so nobody mistakes it
for one.

## LinkedIn post

```
Every shop in this European pharmacy chain makes 28%.

Eight countries, 38 regions, 120 shops, 62,139 sales lines - and I could not find a single
place where profitability varies. Store size band: 0.03pp. Urban vs suburban vs rural:
0.12pp. Across eight countries: 0.32pp. Even the full spread across all 120 individual shops
- 4.61pp - is smaller than the 5.73pp that chance alone produces for groups that size.

So I stopped looking for where, and started looking at what:

→ 2025 revenue grew 4.43%. Same-store growth was +0.07% (p=0.72). 98.5% of the increase was
  eleven new shops. The headline every BI tool would put on this file is a statement about
  the property portfolio, not about trading.

→ Promotions cost 9.08 points of margin - €82,709 over the two years on file - and lifted volume in none of the
  five product categories. Pooled, a lift above 2.35% could not have hidden at this sample
  size; within a single category the floor runs 3.46-7.01%, so this is one powered pooled
  result rather than five powered ones. The
  same flag moves realised price by -12.61%, so it is live, not a dead column.

→ 10% of the rows sell a product before its launch date. All 47 products that launched inside
  the window, zero exceptions. The two date rules the source documents hold perfectly; the
  one it never mentions was never enforced.

The signature chart is 120 shops as 120 cells, toggled between "how profitably does each shop
trade" and "how much does each shop sell". Same shops, same grid, two questions. One picture
is a flat field and the other is not. That is the whole report.

Built with SolidJS, Polars, DuckDB and a Malloy semantic layer. Every figure on the page is
recomputed from parquet by a second engine and asserted before publication - 29/29 reconcile.
Eight claims I wanted to make are published as killed, with the reason.

@OnyxData @ZoomCharts @SmartFramesUI @DataCareerJumpstart @packt #dataDNA
```

- [x] Image attached - `exports/dashboard.png` (2560×1440)
- [x] Tags = union of Step-2 list, prefilled share text, FAQ **and** the archive read-me -
      four lists, no two of which agree (`brief.md`)
- [x] `#dataDNA`
- [ ] Following Onyx Data on LinkedIn - *user action*

## Entry form

| Field | Value |
|---|---|
| Tool used | Other - custom web app (SolidJS + Malloy/DuckDB) |
| Power BI report | n/a. The ZoomCharts mini-challenge requires ≥2 Drill Down Visuals in Power BI and is not available to this entry - noted as a decision, not an oversight |
| Screenshot | `exports/dashboard.png` |
| Portfolio title | **Every shop in this chain makes 28%** |

## Portfolio description

> A European pharmacy chain wants to know where its profit varies. It doesn't. Across eight
> countries, 38 regions and 120 shops, the margin rate is 28% everywhere - and the full spread
> across all 120 individual shops is *smaller than the spread chance produces* for groups that
> size. Four of the brief's ten questions ask where profitability differs; the honest answer to
> all four is that it doesn't, and this report says so rather than manufacturing a league table
> out of noise.
>
> What it does instead is find the two things that genuinely move the number, and point at the
> one the business controls: promotions cost 9.08 points of margin and €82,709 over the two years
> on file while
> lifting volume in none of the five product categories. It also decomposes the 4.43% revenue
> growth into 98.5% new shop openings and 1.5% actual trading, and flags that 10% of the rows
> sell products before their launch date - a defect that changes no ranking, and is reported
> with that limit attached rather than oversold.
>
> **Technical.** Rubric A names DAX; there is none here, so the modelling is made legible
> instead. The curated layer is a conformed star schema built by a script that *raises* if any
> of six premises stops holding - including the thesis itself, so the build fails rather than
> quietly publishing a changed finding. On top of it sits a **Malloy** semantic layer of 21
> views: a three-level geography drill, nested share-of-parent, period-over-period on a
> same-store cohort, and a two-way promotion × category interaction. Margin rate is
> `sum(margin)/sum(revenue)` everywhere and there is deliberately no row-level rate column for
> a view to average by accident. Money travels as integer cents end to end, asserted identical
> between the parquet and the browser payload. Verification runs on two engines and two routes:
> 46 pytest assertions on known-good literals, then every rendered figure scraped from the DOM
> and recomputed through DuckDB - 28/28 on the live page and 29/29 on the poster. A separate
> lint fails the build on any statistic in prose that nothing recomputes.
>
> **Accessibility.** Zero axe violations across desktop light, desktop dark, mobile and poster -
> and separately with the guided tour dialog open, which the harness normally suppresses. The
> 120-cell signature is keyboard-traversable and exposed to screen readers as a 120-row table.
> Nothing is encoded by colour alone: the grid uses fill proportion, so it survives greyscale
> and all three colourblindness simulations, which are committed alongside the poster. Contrast
> is measured rather than asserted, in both themes.

## Consents

- [ ] AI feedback by email - *user action*
- [ ] Draft portfolio entry - *user action*

## Note on benchmarking

`/portfolio/` serves every entry in one payload with the challenge filter applied client-side
and per-entry AI scores behind a login. Without a DataDNA account the Definition-of-Done line
*"beats the highest scorer on ≥2 dimensions"* cannot be evaluated, so it is not claimed here.
Ninth consecutive month with no scores exposed.
