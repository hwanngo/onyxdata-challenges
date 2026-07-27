# Assumptions - 2026/07 Global AI Adoption & Workforce Displacement Index

Every judgement call the analysis rests on that the data does not settle.

**A1. The step at 2022-Q4 is treated as a level shift, not an acceleration.**
A step fits 3.61× better than a line (residual SS 128.9 vs 465.2), and both within-era slopes are
indistinguishable from zero (p = 0.997 and p = 0.980). The linear fit is *also* statistically
significant (p = 0.0001), so this is a modelling choice - made on residual fit, and stated on the
page with both numbers so a reader can disagree.

**A2. The step is not evidence about generative AI.**
It lands exactly on `generative_ai_era`, a pre-existing column of `dim_date`. The page reports
what the data contains - a level shift at a known boundary - and does not infer a causal claim
about AI's effect on labour markets from it.

**A3. The 95% claim boundary is Spearman, not Pearson.**
`gdp_per_capita_usd` is scaled wrongly by ~500× (A6), and several columns are bounded scores.
Rank correlation is robust to a monotone rescaling, so a null under Spearman is a real null
rather than an artefact of units.

**A4. "$105.07 per displaced worker" is the file's own arithmetic, not a claim about the world.**
The brief states the data is synthetic. What transfers is the structural finding - that
investment is uncorrelated with displacement (ρ = 0.107, p = 0.065) - not the magnitude.

**A5. Absence of evidence is reported as such, with power acknowledged.**
`data_confidence_score` is tested on 25 low-confidence rows: that establishes no *large*
difference exists, not that none does. The page says so rather than claiming a proven null.

**A6. `gdp_per_capita_usd` is excluded from every measure.**
Range $4.13m-$42.27m with Germany above the United States. A uniform scaling error would leave
ranks intact, but the ordering is also implausible, so the column is unusable even as a proxy.
It survives only in the defect ledger.

**A7. Nulls are left null, never imputed.**
9 in `avg_wage_change_pct` and 9 in `ai_tool_usage_hours_per_week`, in 18 distinct rows - no row
is null in both. Any measure over those columns states its own denominator.

**A8. The unit of analysis is the row, and no segment-level change is computed.**
284 of 292 segments are observed once; the remaining 8 are observed twice, at different
quarters, which is too few to support any segment-level trend. Every temporal statement on the
page is about the
*population mean per quarter*, never about a segment's trajectory, and the page says which.

**A9. No map is drawn and no trend line is drawn.**
Country explains nothing (all |ρ| < 0.07, tier p = 0.823) and the time series is a step. Both
omissions are printed on the poster with their reasons rather than left as gaps.

**A10. Benchmarking is not possible.**
No DataDNA account; per-entry AI scores are behind a login. The Definition-of-Done line "beats the
highest scorer on ≥2 dimensions" is not checked and not claimed. **After this month this becomes
the binding constraint on the programme** - every remaining dataset is Era 1 and gated.
