# Submission - 2025/11 E-commerce Analytics

Artifact: `exports/dashboard.png` (2560×1440). **A single image**, per this month's rules.

---

## LinkedIn post

> **The ledger only rounds up.**
>
> This month's DataDNA file reports $31.8M of e-commerce revenue. $3.26M of that is sales tax
> and $568K was refunded to the customer and never reversed. Recognisable revenue is $28.0M -
> **12.02% less**.
>
> The interesting part isn't the size of the correction. It's the *shape*.
>
> **1 · The correction is a flat 12% on almost every cut.** Slice by channel, month, category,
> segment, payment method or product and every group takes the same haircut - spans of 0.58 to
> 4.71 percentage points. Those charts are all still right. Only the numbers on them are wrong.
>
> **2 · Except geography, where it runs 1.65% to 19.34%.** The US pays 0% sales tax and Europe
> pays 20%. So the geographic charts are wrong in *shape*: the EU leads revenue by $1.92M on
> the file's own figures and **North America leads by $0.30M once corrected** - a $2.23M swing
> on the chart everyone builds. And revenue per event, which differs significantly by
> country as reported (p = 6.9 × 10⁻²³), **stops differing at all** once tax comes out
> (p = 0.862). 100% of the country price gap is VAT - and the same holds for the true per-unit
> price (p = 4.8 × 10⁻⁷² reported, p = 0.243 ex-tax). The brief asks for ASP "by country or
> currency" - both of them measure the tax code.
>
> **3 · And the question the brief is built on has no answer.** It asks entrants to identify
> the loyal customers. 3,995 of 4,000 are repeat buyers. The file holds 48,000 events across
> exactly 4,000 customers - mean exactly 12.0000 - so it is a fixed pool dealt out, and how
> much anyone buys is allocation noise. No channel differs by as much as 0.29 orders per
> customer. The code named LOYALTY15 ranks 8th of 13. The two Black Friday codes are redeemed
> at exactly the base rate every month and peak in May-August.
>
> Built with Polars, DuckDB, a Malloy semantic layer and SolidJS. Every figure on the page is
> recomputed from parquet through an independent DuckDB path and asserted against the DOM
> before publication - 42 of 42 reconcile exactly. Four claims of my own were withdrawn during
> analysis; all four are published as withdrawn.
>
> @OnyxData @ZoomCharts @SmartFramesUI @DataCareerJumpstart
> #dataDNA

**Tag union for THIS month** (Step 2 list ∪ prefilled share text ∪ FAQ):
`@OnyxData` · `@ZoomCharts` · `@SmartFramesUI` · `@DataCareerJumpstart` · `#dataDNA`

---

## Portfolio entry

**Title:** The Ledger Only Rounds Up - where a 12% revenue error does and doesn't matter

**Description:**

> An audit of the November 2025 DataDNA e-commerce dataset. The file's revenue column includes
> sales tax and counts refunded orders, overstating revenue by 12.02%. The report shows that
> this correction is almost perfectly uniform - so the monthly trend, the channel ranking and
> the product ranking all survive it - and that the one place it is *not* uniform is geography,
> where sales tax ranges from 0% in the United States to 20% across Europe and the correction
> itself from 1.65% to 19.34%. Two consequences follow: the regional revenue ranking flips, and
> country-level revenue per event stops being a real difference at all.
>
> The signature chart plots ten ways of cutting the same correction as ten strips of dots. Six
> collapse onto the 12.02% line; three spray across the whole width. No axis literacy is
> required to read it.
>
> The report also declines to answer two of the brief's twelve guiding questions, with evidence
> for why they cannot be answered from this file, and publishes four claims the author made and
> then withdrew.

---

## On technical depth, without DAX

This challenge is scored with Power BI in mind, and this entry has no DAX to show. What stands
in its place is depth the tooling makes checkable rather than claimable:

- **A semantic layer, not measures in a report.** A Malloy model with three explicitly named
  revenue measures - `revenue_reported`, `revenue_ex_tax`, `revenue` - so that no view can pick
  the wrong one by accident. 21 views run clean.
- **A star schema whose shape is an argument.** `dim_geo` is keyed on country and carries
  region, currency and tax rate as attributes, because each is functionally dependent on it -
  the table shape says "revenue by currency and revenue by country are the same question".
  There is deliberately no cohort dimension, and a test asserts its absence, because 37.9% of
  events precede their own customer's signup date.
- **A build that refuses to write if its conclusions stop holding.** `build.py` raises on eight
  premises including the thesis itself.
- **Verification through a second engine.** Every rendered figure carries a `data-metric`
  attribute; Playwright scrapes them and DuckDB recomputes each one from parquet. 42 of 42
  reconcile exactly - after that check caught the build and the browser disagreeing in the
  fourth decimal because one used float64 and the other integer cents.
- **Statistics used to bound claims, not decorate them.** Kruskal-Wallis with η², Wilson
  intervals, χ², minimum detectable difference, Bonferroni across 696 φ coefficients, and a
  multinomial argument that overturned one of my own conclusions.
- **Accessibility as measured evidence.** 0 axe violations across four contexts; every colour
  pair measured in both themes; three CVD simulations plus greyscale. The measurement changed
  the design - the semantic colour pair scored 1.39:1 in greyscale, so fill became the primary
  encoding and hue the secondary.
