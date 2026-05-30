# Brief - 2026/05

- **Title:** May 2026 DataDNA - Music Streaming Platform Performance Analytics
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/may-2026-datadna-engagement-subscription-churn-content-performance-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-05-may-2026-datadna-engagement-subscription-churn-content-performance-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/04/DataDNA-Dataset-Challenge-Streaming-Analytics-User-Engagement-Subscription-Churn-Content-Performance.zip
- **sha256:** `4c4647cb687d1e2632e9ebcddcaef469e1e0255811c9baa854fa3e8fed1faebd`

## Scenario

> "Music streaming platforms operating across multiple markets face a range of operational and
> strategic challenges, and this dataset highlights several critical areas" - spanning user
> behaviour, content performance, and subscription activity.

The archive's own `CHALLENGE_BRIEF.md` is far more specific, and is the better statement:

> "You are the lead analyst at a **mid-size music streaming service**. The business has provided
> **four years of operational data** covering listening behaviour, subscription lifecycle, content
> catalogue, and user demographics **across 10 markets**. Leadership wants to know what the data is
> telling them - where the opportunities are, where the risks are, and what to do next."

**Persona:** the leadership team of a 961-user, 10-market streaming service, reviewing four
completed years (2021-01-01 → 2024-12-31) and setting the next year's plan.

## Stated objective

> "Uncover growth opportunities, identify churn risks, and detect behavioural patterns - helping
> leadership increase retention, optimise revenue streams, and improve user engagement through
> data-driven decisions."

## Explicit requirements

Two lists again - **eleventh month running that the ZIP carries requirements the challenge page does
not**. Both are requirements; neither is the other.

### A. Challenge page - "Operational & Analytical Challenges" (11)

- [ ] Fragmented visibility across users, content, and subscription tiers makes it difficult to understand true business performance.
- [ ] Variations in listening behaviour (duration, skips, engagement) obscure which users are highly engaged and which are at risk of churn.
- [ ] Subscription lifecycle complexity (signup, upgrade, downgrade, churn) makes it challenging to track real revenue movement and identify growth drivers.
- [ ] Revenue signals (MRR changes, ad revenue, royalties) are distributed across multiple events, limiting clear visibility into net performance.
- [ ] Differences in user segments (age, country, device, tier) create uneven performance that is difficult to compare without structured analysis.
- [ ] High listening volume does not always translate to high revenue, masking inefficiencies in monetisation strategy.
- [ ] Limited visibility into content performance (artists, tracks, genres, playlists) makes it difficult to optimise catalogue investment.
- [ ] Lack of clear linkage between listening behaviour and subscription outcomes weakens the ability to predict churn or conversion.
- [ ] Cross-dimensional interactions (e.g. tier × country × genre) are complex and often under-analysed, hiding high-value opportunities.
- [ ] Potential fraud or anomalous behaviour within listening patterns introduces risk and distorts performance metrics.
- [ ] Difficulty connecting engagement metrics to business outcomes (MRR, retention, lifetime value) limits strategic decision-making.

*(The scaffold's scrape also swept in nav chrome - "Products Dataset Generator DataDNA Talent
Directory" - and the post-submission FAQ. Both removed; they are not requirements.)*

### B. Archive `CHALLENGE_BRIEF.md` - 4 analysis areas, 16 guiding questions

1. **Temporal trends** - how do volume, revenue and subscription events change over time? Seasonal,
   monthly, weekly cycles? Where are the peaks and valleys, and why?
2. **Entity analysis** - which users, artists, tracks, playlists, devices, countries drive activity?
   How do segments compare? Geographic or demographic hotspots?
3. **Transaction patterns** - most common event types, their distribution, correlations between
   listening and subscription outcomes, *"anomalies or unexpected patterns (e.g. suspicious activity)"*.
4. **Cross-dimensional** - tier × country × genre, over/under-indexing vs baseline, entity affinity,
   *"leading indicators that predict future behaviour (upgrades, churn, lifetime value)"*.

Named questions, carried into `.workbench/2026/05/analysis/questions.md` and answered there: total MRR / ARPU / churn
revenue; which tier, country or cohort drives most revenue and most growth; how much revenue is at
risk; net MRR expansion vs contraction per month; behaviour by tier / age / country; **"is there a
*leading indicator* for churn?"**; do heavy free users convert and what does "heavy" mean; most and
least engaged users; which artists/tracks/genres drive plays and revenue; **"are algorithmically
recommended tracks performing differently?"**; how playlist composition influences listening;
suspicious patterns; **"how does the `is_fraud_cluster` segment behave differently?"**; what
operational or quality issues surface.

The archive brief also prints **scoring hints**, which are effectively requirements:
lead with business impact not table dumps · quantify in dollars or percentage-of-base ·
**"use cohort and over-index analysis, not just top-N rankings"** ·
**"distinguish signal from noise - call out where findings are indicative vs conclusive"** ·
propose specific, measurable next actions. And under Getting Started: *"Go beyond top-N. Raw
rankings often hide the real story."*

## The file

| Table | Rows | Grain |
|---|---|---|
| `fact_listening_session` | 224,078 | one row per user × track × device × timestamp |
| `fact_subscription_event` | 3,640 | one row per lifecycle event |
| `bridge_playlist_track` | 21,192 | playlist ↔ track, composite PK |
| `dim_date` | 1,461 | 2021-01-01 → 2024-12-31, no gaps |
| `dim_user` | 961 | |
| `dim_track` / `dim_artist` | 774 / 448 | |
| `dim_playlist` | 767 | |
| `dim_device` | 366 | |
| `dim_country` / `dim_genre` | 10 / 10 | |
| `dim_subscription_plan` | 3 | Free $0 · Premium $9.99 · Family $14.99 |

### The unusual thing about this month: the dictionary is *right*

2026/04 shipped a data dictionary from the same generator family and it was **wrong in eight
places**. This one was tested the same way - `analysis/integrity.py`, 72 falsifiable claims - and
**68 hold**. Every documented row count is exact. Every PK is unique. All 18 FKs resolve with zero
orphans. Every declared invariant holds on every row: `dim_track.genre_id` matches the artist's
genre 774/774; `num_tracks` matches the bridge 767/767; the denormalised `artist_id`/`genre_id`
match `dim_track` 224,078/224,078; `mrr_change = mrr_after - mrr_before` 3,640/3,640; every event
type obeys its stated semantics; `signup` is each user's first event 961/961 and its date equals
`account_created` 961/961. No session precedes its listener's account or its track's release.

**That inverts the month.** The deliverable is not an audit of a broken file. It is an actual
analysis - which is harder, and is what the rubric rewards.

The four falsified claims - two cosmetic, **two that remove a column from the analysis**:

| # | The dictionary says | The file says |
|---:|---|---|
| 1 | `estimated_revenue_usd` = `(listen_seconds/60)*0.003` on Free | Correct, then **rounded to 4 dp**. 32,614 of 65,443 Free rows differ by ≤ $0.0001; total effect **+$0.87** on $852.14 (0.10%). Not a formula error - but the column is not reproducible to the cent from the stated rule. |
| 2 | `gender` ∈ {Male, Female, Non-binary, Prefer not to say} | **Five values** - `Other` (185 users, 19.3%) is undocumented |
| 3 | `playlist_id` is the **"context of the play"** | **It is not. It is random.** Only **3.649%** of sessions play a track that is actually in the named playlist; a track-aware random assignment predicts **3.680%** (binomial z = -0.76). **96.4% of sessions name a playlist that does not contain the track played.** |
| 4 | `new_artist_discovered` = **"First play of this artist by this user"** | **No.** 39,531 of 224,078 rows disagree (82.36% agreement). There are 50,351 true first-plays and 17,474 flags: **precision 81.0%, recall 28.1%**. It is correlated with discovery (a random flag at this base rate scores 22.5% precision) but it is a *sample* of discoveries, not the definition. |

Defect 3 is the consequential one: it makes the brief's question *"How does playlist composition
influence listening patterns?"* **unanswerable**. The one thing `playlist_id` does carry is a single
real bit - **public playlists are 49.8% of playlists but take 75.7% of sessions** (Cliff's d =
+0.908, and playlist size does not explain it: ρ = -0.077, private playlists are the *larger* ones).

And three defects the dictionary does not mention at all:

| # | Defect |
|---:|---|
| 3 | **`bridge_playlist_track.added_date` runs to 2025-12-13** - 2,438 of 21,192 rows (11.5%) fall *outside* the documented 2021-2024 scope. Tracks are added to playlists up to a year after the dataset ends. |
| 4 | **A duplicated subscription event.** User 828 has two identical Premium→Family upgrades on 2024-12-31. It breaks the MRR chain three ways (sum-of-changes $8,143.50 vs ending MRR $8,138.50; `mrr_before` 9.99 against a previous `mrr_after` of 14.99; `from_tier` Premium against a previous `to_tier` of Family). The generator labelled it itself: `trigger_context = 'reconciliation'`. |
| 5 | **`listen_seconds` has a hole.** Zero sessions at 45, 50, 55 or 60 seconds; 2,140 of 224,078 (0.955%) fall in [45,115]. The column is a two-component mixture - partial plays 5-44s, full plays 115-238s - with almost nothing between. |

## What the data actually answers - checked at G1

Every row is a stated requirement. Full working in `analysis/signal.py`.

| The brief asks | The file answers |
|---|---|
| *"How does the `is_fraud_cluster` segment behave differently?"* | **Enormously, and it is the largest effect in the file.** At a fixed 30 plays per user (rarefaction, so session count cannot confound it) a flagged user touches **9.4 distinct tracks vs 22.5** - Cliff's d = **-0.9739**. Within-user Herfindahl 0.4012 vs 0.0751 (d = +0.921). 482 of 961 users, **70.2% of all sessions**. |
| *"Are algorithmically recommended tracks performing differently?"* | **No - not at all.** 53.2% of the catalogue is flagged. listen_seconds Cliff's d = **+0.0026** (p = 0.291); skip d = +0.0045; plays per track d = +0.0512 (p = 0.219). The flag is decorative. |
| *"Are there seasonal, monthly, or weekly cycles?"* | **Weekly yes, monthly no.** Fri/Sat/Sun carry **52.8%** of listening on 43% of the days (17.3/17.7/17.8% vs 11.7-11.9%), unconfounded. Month-of-year survives nothing: after fitting the +10.21%/month growth curve, month-of-year on the residuals gives KW p = 0.926 and **ω² = -0.098** (negative). |
| *"Is there a leading indicator for churn?"* | **Yes, but it is depth, not volume, and it is weak.** Last 30 days before churn vs >90 days: listen_seconds Cliff's d = **-0.122** (p = 1.9e-57), skip rate d = +0.018. Mean session falls 86.1s → 64.6s. Churned users listen **more** overall (265 vs 205 sessions, d = +0.185) but **shorter** (d = -0.252). |
| *"What is total MRR, ARPU, churn revenue?"* | Ending MRR **$8,138.50** (Dec 2024), 650 of 961 paying. ARPU **$8.47**, ARPPU **$12.52**. Churn destroyed **$2,432.86** of MRR over 635 events. 217 users sit on Free having previously paid - **$2,517.83/month** currently forgone. |
| *"Net MRR expansion vs contraction each month?"* | Expansion $13,808.96, contraction -$5,665.46, net **+$8,143.50**. But **32.5% of that net ($2,648.24) carries `trigger_context = 'reconciliation'`** - back-office adjustment, not a customer decision. Customer-driven net is **$5,495.26**. |
| *"Do heavy free users convert to paid?"* | Yes, but the base rate is already high: 77.7% → 91.9% across free-session quartiles (d = +0.226). Heaviness adds **14 points**, not the story the ranking implies. |
| *"Which tier/country/cohort drives revenue?"* | Tier is real (η² 0.016 on duration, 0.019 on skip; Free skips **20.0%** vs Family **9.2%**). Genre is real (η² 0.013). **Country is not** (η² 0.0009), nor gender (0.0003), age (0.0016), device type (0.0032), or year (0.0003). |
| *"High listening volume does not always translate to revenue"* | The page's own bullet, and it is the sharpest thing in the file - see below. |

### The revenue trap, stated plainly

`estimated_revenue_usd` sums to **$852.14** across 224,078 sessions and 48 months. The same users'
subscriptions generate **$167,647.19** over the same period - **197×** more. The session column is
0.508% of the business.

Worse, it is not one quantity. On Free it is ad **income**. On Premium/Family the dictionary calls
it *"per-stream royalty"* - money the platform **pays out**. Summing the column adds a revenue and
a cost together and reports the total as revenue.

And the payout is balanced on a knife edge: the royalty qualifies at **≥ 30 seconds**, and
**46.9% of all sessions land in the 30-44s band**. Moving the threshold to 32s cuts qualifying
plays by **15.1%**; to 35s, by **38.0%**.

## The G1 lead, and its risk

The candidate thesis: **every headline number this dataset hands you is inflated by something that
is not a customer, and the data says by how much.** Revenue by 197×. Growth by 32.5%. Seasonality
entirely. The recommendation flag by 100%. And underneath, 70.2% of all listening - and 70.1% of
the royalty bill - comes from accounts the platform has already flagged.

**The risk, named now:** this is four nulls and one positive, and 2026/04 was criticised in its own
retro for reading as a page of absences. The mitigation is structural - the fraud finding is not a
null, it is the largest effect in the file (d = -0.97), and it is a *dollar* number, not a p-value.
G3 must keep the constructive half at least as prominent as the debunking half.

**A second risk, already realised once at G1 and worth recording:** the fraud signal *looked* like a
coordinated streaming farm - Mariah Carey over-indexes **18.4×** among flagged users. It is not.
**87.5% of her flagged plays are a single account**, and top-3 users account for 73-98% of every
over-indexed artist. Aggregate artist concentration is near-identical (top-10 = 14.7% flagged vs
13.3% clean). The over-index table is a thin-cell artefact, and shipping it would have been the
month's biggest error. It is now a *finding* about why over-indexing needs a denominator check.

## Submission mechanics (THIS month)

- @OnyxData · @SmartFramesUI · @DataCareerJumpstart · @packt
- Hashtag: `#dataDNA`
- **Single image only** - PNG, JPG or WebP, max 10 MB.
- **No ZoomCharts mini-challenge** - the sponsor is absent from the page and there is no read-me in
  the archive. Re-check at G8 before writing the submission.

## Timeline

| | |
|---|---|
| Challenge begins | 01 May 2026 |
| Deadline for entries | 24 May 2026 |
| Entry review & winner selection | 25 May 2026 |
| Winners announced | 31 May 2026 |

**Closed.** Today is 2026-05-30, six days after the deadline. Portfolio work, not a live entry.

**Prizes (for the record):** 2 Packt eBooks, The Data Analytics Interview Software ($500).

## Benchmark

**Unchanged and structural, eleventh month.** `/portfolio/` serves every entry in one payload with
the challenge filter applied client-side and per-entry AI scores behind a login; there is no
DataDNA account. Benchmarking is qualitative only, and the
Definition-of-Done line *"beats the highest scorer on ≥2 dimensions"* cannot be checked or claimed
for this month.

## Lessons being applied from .workbench/docs/LEARNINGS.md

1. **Test what the source promises, not only what it declines to promise** (2026/02, 2026/04). Here
   the source promises a great deal and - for the first time in this programme - largely delivers.
   That had to be *established*, not assumed, and establishing it is what freed the month to do
   analysis instead of audit.
2. **A ratio needs its denominator checked before it is a finding** (2025/06's hashtag effect,
   2026/02's volume ratio). `variety = distinct_tracks / sessions` is mechanically bounded by
   774/n, and flagged users have 2.3× more sessions - so the raw -0.92 was partly arithmetic.
   Rarefaction at fixed n was the fix, and the effect got *stronger* (-0.9739). The same check
   demolished the artist over-index table.
3. **A trend is not a season** (new, this month). The apparent December peak - 15.4% of annual
   listening - is the growth ramp sliced twelve ways. Detrend first, then test month-of-year on the
   residuals. ω², not η², because there are only four observations per month.
4. **Compute the number, never type it** (2026/02, where four typed figures were all wrong). Every
   figure in this brief comes from `analysis/integrity.py` or `analysis/signal.py`.
