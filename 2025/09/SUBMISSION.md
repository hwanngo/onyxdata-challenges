# Submission - 2025/09 · Credit Risk Analytics (Nova Bank)

## The image

`exports/dashboard.png` - 2560×1440, single image, as required.

## LinkedIn post

> **Nine per cent of this loan book defaults 100% of the time.**
>
> Onyx Data's September DataDNA set gives you 32,581 loans and asks who defaults and why.
>
> Two boolean conditions answer it:
>
> `RENT & loan_percent_income > 0.30` → 2,345 loans, 100.0000%
> `grade D-G & DEBTCONSOLIDATION & not OWN` → 741 loans, 100.0000%
>
> Zero exceptions across 2,988 loans. If the true rate were even 99%, observing zero
> survivors has probability about 1e-13 - a *post-selection* figure, since I found the two
> conditions by searching this file, so read it as a description of how exact they are rather
> than as a p-value. That is 42% of every loss in the book.
>
> It's tenure-specific: renters step from 28.5% to 100% between a loan-to-income of 0.30 and
> 0.31, while mortgage-holders cross the same line at 15.7% → 21.6%. And nobody is charged
> for it - renters above the line pay **fourteen basis points** more than renters in the
> 20-30% loan-to-income band below it. The gap depends on which band you pick (-0.6 bp to
> +42.7 bp across every band I tested) and what does not depend on it is that the price line
> is flat across a step from a quarter of these loans defaulting to all of them. 496 *grade-A*
> renters above the line defaulted at 100%, priced at 7.53%.
>
> It also contaminates the obvious answers. Debt consolidation looks like the riskiest loan
> purpose at 28.6%. Remove the two rules and it is the second safest at 10.0%.
>
> On fairness, which the brief names twice: this book has **no declined applications**, so
> approval-stage fairness is untestable here whatever you believe about the data. Separately,
> 16 of 29 columns were appended to the lending book, and six of those sixteen are not
> independent columns at all - two are exact arithmetic on columns already present and four
> are functionally determined by `city`. Of the fourteen appended columns testable against
> default, eleven explain nothing. And 1,421 of 1,635 "Unemployed" applicants report a current
> job averaging 5.44 years.
>
> Built with SolidJS, DuckDB and a Malloy semantic layer. 49 rendered figures recomputed from
> parquet by an independent DuckDB query and asserted against the DOM. axe-clean across four
> contexts, WCAG AA measured on the shipped stylesheet in both themes, readable in greyscale.
>
> This is the third thesis. The first two were killed by adversarial review - one for
> reasoning from null results, one for being false. Both corrections are in the repo.
>
> @OnyxData @ZoomCharts @EnterpriseDNA @BCS, The Chartered Institute for IT
> @SmartFramesUI @DataCareerJumpstart
> #dataDNA

## Mechanics checklist

- [x] Single image, 2560×1440
- [x] Tags: @OnyxData, @ZoomCharts, @EnterpriseDNA, @BCS (The Chartered Institute for IT),
      @SmartFramesUI, @DataCareerJumpstart
- [x] Hashtag `#dataDNA`
- [ ] Follow Onyx Data on LinkedIn *(account action)*
- [ ] Post to LinkedIn *(account action)*
- [ ] Submit via the challenge page *(account action)*
- **Note:** the page states **resubmissions are not permitted** this month.
- **N/A** ZoomCharts mini-challenge - requires Power BI. Out of scope by stack choice.

## What a reviewer should check first

1. **The rule box.** It is the finding, written as the condition that produces it. Two lines.
2. **The Wall.** Red walks the floor, turns ninety degrees at 0.30, pins to 100%. Blue lines
   cross the same point and never turn. The dotted line is the price, and it does nothing.
3. **"What the file cannot tell you."** Sixteen of twenty-nine columns were appended to the
   lending book; of the fourteen testable against default, eleven fail Bonferroni and the
   three that pass are exact restatements of columns already present. And there are no
   declined applications - so the fairness question the brief asks twice gets an honest
   "cannot be answered" rather than a fabricated clean bill of health.

## Reproducing

```
just fetch 2025 09
python 2025/09/model/build.py
python 2025/09/analysis/integrity.py        # 10 standing checks
pytest 2025/09/model/test_metrics.py        # 30 tests
node tools/run_malloy.mjs 2025 09           # 16 views across 2 sources
node tools/lint_prose_numbers.mjs 2025 09   # no untagged, undeclared statistic in the UI
cd 2025/09/app && pnpm dev
python tools/verify_metrics.py 2025 09      # 49 metrics vs an independent DuckDB path
python tools/audit_contrast.py 2025 09
python tools/cvd.py 2025 09
node tools/qa/a11y.mjs && node tools/qa/overflow.mjs && node tools/qa/perf.mjs
python tools/shoot.py 2025 09
```
