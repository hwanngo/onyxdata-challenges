# Assumptions - 2026/05 Music Streaming Platform Performance

Every judgement call the analysis rests on that the data does not settle. Each is footnoted in
the UI where it affects a number.

## Naming

**A1. The cohort is called "repeat-concentrated accounts", never "fraud".**
The source column is `dim_user.is_fraud_cluster`. It flags **50.2% of users** - a prevalence no
real fraud population has - and it arrives unadjudicated, with no evidence of the determination
behind it. What is *measured* is repetition: 9.4 distinct tracks per 30 plays against 22.5,
within-user Herfindahl 0.4012 vs 0.0751. The page names the measurement, not the accusation. The
source column name appears verbatim once, in the defect ledger and in `dim_flag.source_column`, so
nothing is concealed. `model/test_metrics.py::test_the_word_fraud_appears_only_as_a_documented_source_column`
enforces this.

**A2. "Weekend" means Friday-Sunday.**
The effect block is Fri/Sat/Sun (17.31/17.68/17.77% vs 11.72-11.91% Mon-Thu). Friday behaves like
a weekend day here, so the column is `is_weekend_block` and the label reads "Fri-Sun" rather than
"weekend" anywhere it is charted.

## Money

**A3. Subscription revenue is reconstructed, not given.**
No table states MRR. It is computed as: for each month-end, take each user's most recent event's
`to_tier`, price it from `dim_subscription_plan` ($0 / $9.99 / $14.99), and sum. The dictionary
guarantees the last event's `to_tier` matches `dim_user.subscription_tier`, and that holds for
961 of 961 users, so the reconstruction is anchored. Total over 48 months: **$167,647.19**.

**A4. `trigger_context = 'reconciliation'` is treated as a back-office adjustment, not a marketing
channel.** This is an **inference**, and the page labels it indicative rather than conclusive. The
dictionary calls the column *"Marketing / attribution context (free text)"*. Two structural facts
drive the inference: it appears on **only** upgrade and downgrade - never signup, churn or
retention, which all nine other values do - and it carries 41.5% of upgrades and 64.0% of
downgrades. If it were genuinely a campaign, the customer-driven MRR figure of $5,495.26 is wrong
and the reported $8,143.50 stands.

**A5. Lifetime value is tier price × months held, with the window closed at 2024-12-31.**
Users still active at the end have their last interval truncated there rather than extrapolated.
This understates LTV for recent signups, which is the conservative direction for I4's claim that
the two cohorts cannot be distinguished on value - which is not the same as being equal.
The 95% interval on the difference runs from 21.4% worse to 1.7% better, and the smallest gap
the test could have detected is 16.5% of the comparison mean.

**A6. The session revenue column is split, never summed.**
`estimated_revenue_usd` is ad **income** on Free and a per-stream **royalty cost** on paid tiers -
the dictionary says so explicitly. The curated model carries it as `royalty_or_ad_usd` with
`is_ad_supported` beside it. No column anywhere in the model is named `revenue` unless it is
subscription money.

## Method

**A7. Variety is measured by rarefaction at a fixed 30 plays, not as distinct ÷ sessions.**
Only 774 tracks exist, so the naive ratio is bounded by 774/n and falls mechanically as sessions
rise (ρ = -0.705). The rarefied sample uses `numpy.default_rng(crc32(b"2026-05-music-streaming"))`
- a label-derived seed, so it is reproducible and is not a magic number. Users with fewer than 30
sessions are excluded from that measure (they keep `variety_raw`). The choice of k=30 is a
judgement: k=60 and k=120 give -0.9875 and -0.9879, so the conclusion is not sensitive to it.
The draw is seeded PER USER (`SEED ^ crc32(user_id)`), so no user's sample depends on how many
users preceded it. Seeded once for the whole loop, as it was Until this was checked, the values
moved between builds - `top10_overlap_rarefied` came out 3 on one run and 2 on the next.

**A8. Effect sizes decide, p-values do not.**
At n=224,078 everything is significant - country's Kruskal p is 1.1e-28 while explaining 0.09% of
the variance. Cohen's floor for a *small* effect (η² = 0.01, Cliff's d = 0.147) is the threshold
throughout, and it is printed on every chart that uses it.

**A9. Seasonality is tested on growth residuals, using ω² rather than η².**
With 4 observations per month-of-year, η² is heavily upward-biased (it reads 0.157 here). ω² is
the unbiased form and goes negative (-0.0981). The test is underpowered by construction - four
years cannot firmly establish a season - so the finding is stated as **not detectable**, never as
proven absent.

**A10. The "clean" ranking is built from 29.8% of sessions.**
Removing the repeat-concentrated cohort leaves 66,870 of 224,078 sessions, so ranks in the clean
column are genuinely noisier. Every labelled artist in the signature carries a bootstrap 90% rank
bracket rather than a caption disclaiming it.

## Scope

**A11. `playlist_id` is excluded from every grouping.**
It is random with respect to the track played (3.649% coherence vs 3.680% expected). Only
`playlist_is_public` survives into the model.

**A12. This is synthetic data, and the transferable finding is structural.**
The specific artists, the exact 18.4× over-index, and the sharpness of the 30-second cliff are
artefacts of a generator. What transfers is the *shape* of each error: a play-count ranking
dominated by a repeat-heavy minority; a qualification threshold sitting inside the modal play
length; a system label counted as customer growth. The page says which findings are indicative and
which are conclusive, per the archive brief's own scoring hint.

**A13. Benchmarking is not possible.**
No DataDNA account, so per-entry AI scores are behind a login. The Definition-of-Done line
"beats the highest scorer on ≥2 dimensions" is not checked or claimed for this month.
