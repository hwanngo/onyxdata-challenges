# Insight ledger - 2026/05 Music Streaming Platform Performance

**The gate that decides the Insights score.** No query, no claim.

Every query below runs against `data/curated/*.parquet` via DuckDB and is reproduced by
`model/test_metrics.py` (33 assertions) against the **raw CSVs** on a second, independent path.

## Thesis

> **Nine of this service's top ten artists are there because of 482 accounts that play the same
> handful of tracks over and over - and they are paying customers you cannot ban. Every headline number in
> this business is set by a counting rule rather than by the music: who counts as a listener,
> where a play becomes payable, and whether the back office counts as growth.**

## Narrative arc

| | Insight |
|---|---|
| **Situation** | The service compounds at +10.21%/month, ends 2024 at $8,138.50 MRR with 650 payers, and has four clean years of well-documented data. 68 of the archive's 72 dictionary claims hold. |
| **Complication** | The catalogue league table that drives editorial and licensing does not survive removing 482 accounts - **9 of its top 10 leave with them** - and those accounts are worth the same as everyone else, so there is nothing to enforce against. The same pattern repeats in the money: 46.9% of plays sit within 14 seconds of the royalty threshold, and 32.5% of "growth" is a back-office adjustment. |
| **Resolution** | Stop treating counting rules as observations. Publish the league table per-user-capped, split ad income from royalty cost, and report MRR net of reconciliation - **$5,495.26 customer-driven, not $8,143.50**. |

---

## Ledger

### I1 - Nine of the top ten artists leave when 482 accounts do. Mariah Carey falls from #1 to #264; Shaggy rises from #10 to #1.

**Query**
```sql
WITH a AS (SELECT artist_id FROM dim_artist_rank ORDER BY rank_all   LIMIT 10),
     b AS (SELECT artist_id FROM dim_artist_rank ORDER BY rank_clean LIMIT 10)
SELECT (SELECT count(*) FROM a JOIN b USING (artist_id)) AS top10_overlap;

SELECT artist_name, rank_all, rank_clean, plays_all, plays_clean, top_listener_share
FROM dim_artist_rank ORDER BY rank_all LIMIT 10;
```

**Output**
```
top10_overlap = 1

artist_name     rank_all  rank_clean  plays_all  plays_clean  top_listener_share
Mariah Carey           1         264       3316           75               0.875
Emmylou Harris         2          42       2884          385               0.884
James Brown            3         123       2651          172               0.785
Cat Stevens            4          43       2507          382               0.349
Luis Miguel            5          14       2484          623               0.621
J. Cole                6          54       2458          331               0.555
The Eagles             7         136       2401          151               0.324
Otis Redding           8         184       2305          108               0.670
Beastie Boys           9          82       2277          248               0.759
Shaggy                10           1       2267         1314               0.195
```
`top_listener_share` is the fraction of that artist's repeat-concentrated plays coming from its
single largest such listener. **Shaggy - the one artist that survives into the clean top ten - is
also the one with the lowest value, 0.195.** That is the mechanism in one column.
Spearman ρ between the two play-count vectors across all 377 played artists: **0.665**.

**Caveat:** the clean column rests on 29.8% of sessions, so its ranks are genuinely noisier -
the chart carries a bootstrap 90% rank bracket on every labelled artist rather than leaving that
in a caption. Mariah Carey's 1 → 264 survives any plausible interval. This is synthetic data, so
the *specific artists* are arbitrary; the *structural finding* - that a play-count ranking is
dominated by a small repeat-heavy population - is the transferable one.

**So what:** editorial, playlisting and licensing spend run off this table. Cap plays per user
per artist before ranking, and the ranking becomes a statement about the catalogue rather than
about 482 accounts.

---

### I2 - The cohort is not a crime, it is a listening shape: 9.4 distinct tracks per 30 plays against 22.5.

**Query**
```sql
SELECT
  CASE WHEN is_repeat_concentrated THEN 'repeat-concentrated' ELSE 'broad listening' END AS cohort,
  count(*)                       AS people,
  round(avg(tracks_at_30), 1)    AS tracks_per_30_plays,
  round(avg(repeat_concentration), 4) AS within_user_herfindahl,
  round(avg(sessions), 1)        AS mean_sessions,
  round(avg(variety_raw), 4)     AS naive_variety_ratio
FROM dim_listener GROUP BY 1;
```

**Output**
```
cohort                people  rarefiable  tracks_per_30_plays  within_user_herfindahl  mean_sessions  naive_variety
repeat-concentrated      482         438                 9.45                  0.4012          326.2         0.2307
broad listening          479         364                22.49                  0.0751          139.6         0.6357
```
`rarefiable` is the count with a non-null `tracks_at_30` - a listener with fewer than 30 plays
cannot be rarefied to 30. **The rarefied means are over those columns, not over `people`**, and
the drop is asymmetric (9.1% of the cohort, 24.0% of broad listeners), which is itself an effect
of the cohort playing more. The direction of that bias is *against* the finding: the broad
listeners it removes are the lightest, so the surviving 364 are the more active - and their
distinct-track count is still 2.4x the cohort's.
Cliff's d on the rarefied measure = **-0.9739** (Mann-Whitney p ≈ 1e-123).

**The rarefied draw is seeded PER USER** (`SEED ^ crc32(user_id)`), so no user's sample depends
on how many users preceded it in iteration. Until the integrity pass one generator was consumed
across the whole loop, which made every value here a function of polars' group order - an order
polars does not promise. Two consecutive builds gave `top10_overlap_rarefied` = 3 and then 2.
**The finding is unaffected and the third decimal is not the finding**: under per-user seeding
the effect still strengthens monotonically under rarefaction (d -0.9194 raw → -0.9739 at k=30,
-0.9875 at k=60, -0.9879 at k=120), which is the property that licenses the claim. But a number
that changes between builds cannot be checked by anyone, so it was not reproducible in the sense
this ledger promises.

**Correction.** `tracks_per_30_plays` was published as 9.5 and 22.5; it is
**9.4452 and 22.4918**, so both were rounded away from the true value and the caption, the KPI
marks and the screen-reader table in `Panels.tsx` disagreed with this ledger and with each
other. All four now read one formatter over one row. The `rarefiable` column was absent.

**Caveat:** the naive ratio in the last column is **partly arithmetic** - only 774 tracks exist,
so distinct/sessions is bounded by 774/n, and this cohort has 2.3× more sessions (ρ between
sessions and ratio = -0.705). Rarefaction to a fixed 30 plays removes that entirely, and the
effect gets *stronger*, not weaker: d -0.919 → -0.974. Both columns are shown so the difference
is auditable rather than asserted.

**So what:** this is why the page never prints the source column's name. `is_fraud_cluster`
flags 50.2% of users - a prevalence no real fraud population has - and it is an unadjudicated
vendor label. What is *measured* is repetition, and repetition is what the recommendation acts on.

---

### I3 - It is not a streaming farm. 87.5% of the #1 artist's flagged plays come from a single account.

**Query**
```sql
-- the FIVE ARTISTS THE OVER-INDEX TABLE FLAGGED, which is the set this insight is about.
SELECT artist_name, plays_flagged, flagged_listeners,
       top_flagged_user_plays, round(top_listener_share, 3) AS top_user_share
FROM dim_artist_rank
WHERE artist_name IN ('Mariah Carey', 'The Who', 'The Black Keys',
                      'Little Richard', 'Elton John')
ORDER BY top_user_share DESC;
-- and the top-THREE share behind the "73-98%" claim, from the sessions themselves
WITH f AS (SELECT artist_name, user_id, count(*) n FROM fact_session
           WHERE is_repeat_concentrated GROUP BY 1, 2),
     r AS (SELECT *, row_number() OVER (PARTITION BY artist_name ORDER BY n DESC) rk,
                  sum(n) OVER (PARTITION BY artist_name) tot FROM f)
SELECT artist_name, round(100.0 * sum(n) FILTER (WHERE rk <= 3) / max(tot), 1) AS top3_pct
FROM r GROUP BY 1;
```

**Output**
```
artist_name           plays_flagged  flagged_listeners  top_flagged_user_plays  top_user_share  top3_pct
Mariah Carey                   3241                 48                    2835           0.875      98.3
The Who                         852                 21                     632           0.742      97.9
The Black Keys                 1079                 29                     635           0.589      87.5
Little Richard                 2116                 32                     740           0.350      97.7
Elton John                     1939                 47                     592           0.305      73.3

for scale, the whole-table maximum is not in this set:
Blur           plays_flagged 1652  flagged_listeners 40  top_user_share 0.963
```

**Correction.** The SQL above previously read
`WHERE plays_flagged >= 800 ORDER BY top_listener_share DESC LIMIT 5`, which selects a
*different* five artists (Blur 0.963, Madonna 0.898, Emmylou Harris 0.884, Mariah 0.875,
Boston 0.858). Every row printed below it was real and exact, and the 73-98% bracket
reproduces to the decimal - but the query text described a selection it did not perform, so a
reader re-running it got different artists and no way to tell which was wrong. The query now
names the set this insight is actually about. **An Output block and the query above it must be
regenerated together; a stale SQL line makes correct numbers unverifiable.**
Aggregate concentration is near-identical between cohorts: top-10 artists take **14.7%** of
repeat-concentrated plays vs **13.3%** of broad-listening plays.

**Caveat:** this is the finding that *nearly went the other way*. The first cut computed an
over-index of flagged share ÷ clean share per artist, which put Mariah Carey at **18.4×** and
looked exactly like coordinated boosting. Shipping that table would have been the month's biggest
error. The denominator check - how many distinct accounts produce the volume - is what dissolved
it.

**So what:** there is no ring to shut down and no coordinated actor to report. The behaviour is
individual and legitimate-looking, which means the only available lever is how plays are counted.

---

### I4 - These accounts cannot be shown to pay less. $161.52 against $179.17, p = 0.189 - and the interval is [-21.4%, +1.7%].

**Query**
```sql
SELECT ltv_flagged_usd, ltv_clean_usd, ltv_mannwhitney_p,
       repeat_concentrated_user_share, repeat_concentrated_session_share,
       royalty_on_flagged_usd, royalty_usd, royalty_flagged_share
FROM headline;
```

**Output**
```
ltv_flagged_usd  ltv_clean_usd  p       user_share  session_share  royalty_flagged  royalty_all  share
         161.52         179.17  0.1889      0.5016         0.7016          416.69       594.67  0.7007
```

**Caveat, and it is the load-bearing one:** LTV is reconstructed from the event log as tier
price × months held, so it inherits the $5.00 duplicate-event defect (I9) - immaterial at this
scale. The difference is *directionally* lower for the cohort but not distinguishable from zero
at n=482/479.

**How wide is "not distinguishable"?** Pooled SD $163.80, so the smallest gap detectable at 80%
power is **$29.61 - 16.5% of the clean mean** - and achieved power against the observed
difference is **0.386**. The 95% interval on the difference runs **[-21.4%, +1.7%]**, and the
cohort's aggregate LTV is $77,850.36 against $85,820.19, **9.3% lower**. So the honest reading
is *we could not tell*, and a real 15% shortfall would have produced exactly this p-value.
**This is a null that is quoted, not a parity that is demonstrated** - the earlier phrasing
"these accounts pay the same" was corrected by the integrity pass, which found it on five
surfaces with no power stated anywhere. What licenses the recommendation is not that they are
equal but that their subscription-tier mix is indistinguishable (Family 161/168, Free 159/152,
Premium 162/159), so there is no pricing lever to pull either.

**So what:** this is the constraint that makes the whole page a measurement argument rather than
a fraud report. You cannot ban 50.2% of your users on evidence that cannot resolve a 16% gap. But
70.1% of the royalty bill - **$416.69 of $594.67** - is attributed to their listening, so the
attribution rule is worth more than the enforcement action.

---

### I5 - Move the payout line two seconds and 15.1% of payable plays disappear. Five seconds, 38.0%.

**Query**
```sql
SELECT threshold_seconds, qualifying_plays, royalty_usd, pct_change_vs_30s
FROM fact_threshold_sensitivity ORDER BY threshold_seconds;
```

**Output**
```
threshold_seconds  qualifying_plays  royalty_usd  pct_change_vs_30s
               20            152664       610.66              +2.69
               25            150649       602.60              +1.33
               28            149489       597.96              +0.55
               30            148668       594.67               0.00
               32            126177       504.71             -15.13
               35             92190       368.76             -37.99
               40             79384       317.54             -46.60
               45             77397       309.59             -47.94
               60             77396       309.58             -47.94
```

*(The 20s row was published as a duplicate of the 25s row, and the 60s row was omitted, until
the integrity pass recomputed the block from `fact_threshold_sensitivity`. Neither error touched
the headline - 15.1% and 38.0% are the 32s and 35s rows - which is exactly why a stale row can
sit in a ledger for a month.)*
**46.93%** of all 224,078 sessions (105,150) fall in the 30-44 second band.

**Caveat:** the sensitivity is amplified by a generator artefact - `listen_seconds` is a
two-component mixture with **zero sessions at 45, 50, 55 or 60 seconds** (I10), which piles mass
against the threshold. The *magnitude* here is therefore partly synthetic. The *mechanism* is not:
any platform whose qualification rule sits inside the modal play length has a payout that is a
policy choice, and this one does.

**So what:** the royalty bill is not an observation, it is a setting. It belongs in the finance
review with a sensitivity band attached, not in a dashboard as a single number.

---

### I6 - A third of reported MRR growth is a back-office adjustment. $2,648.24 of $8,143.50.

**Query**
```sql
SELECT net_mrr_usd, reconciliation_net_usd, customer_net_mrr_usd,
       round(reconciliation_share_of_net, 4) AS share FROM headline;

SELECT date_part('year', month) AS yr,
       round(sum(net_usd), 2)                 AS net,
       round(sum(customer_net_usd), 2)        AS customer_driven,
       round(sum(reconciliation_net_usd), 2)  AS reconciliation
FROM fact_mrr_month GROUP BY 1 ORDER BY 1;

SELECT DISTINCT event_type FROM fact_subscription_event WHERE is_reconciliation;
```

**Output**
```
net_mrr_usd  reconciliation_net_usd  customer_net_mrr_usd  share
    8143.50                 2648.24               5495.26  0.3252

  yr      net  customer_driven  reconciliation
2021  1248.92          1084.05          164.87
2022  1883.51          1318.88          564.63
2023  2363.05          1693.49          669.56
2024  2648.02          1398.84         1249.18
                                       (columns sum to 8143.50 / 5495.26 / 2648.24)

event_type: upgrade, downgrade      <- and nothing else
```

**Correction.** The by-year `net` and `customer_driven` columns above were
stale - published as 806.72 / 2087.28 / 2314.85 / 2934.65 against a true 1248.92 / 1883.51 /
2363.05 / 2648.02. The `reconciliation` column was exact, and **both allocations sum to the
same correct totals** (8143.50 and 5495.26), which is precisely why nothing caught it: every
figure this insight's headline and "so what" depend on is a total, and the totals were right.
The trend read from the stale split - reconciliation rising 20.4% → 42.6% of net - is really
**13.2% → 47.2%**, a *steeper* rise than published. **A subtotal that reconciles to the right
grand total is not verified; check the breakdown against the source, not against its own sum.**

**Caveat:** `trigger_context` is documented as *"Marketing / attribution context (free text)"*, so
`reconciliation` is nominally just another channel value. Two things say otherwise: it appears on
**only** upgrade and downgrade - never on signup, churn or retention, which every genuine channel
does - and it carries **41.5% of upgrades and 64.0% of downgrades**. No marketing channel behaves
like that. This is an inference from structure, not a documented fact, and the page labels it as
indicative.

**So what:** customer-driven net MRR is **$5,495.26**, and the gap is widening - reconciliation
was 13.2% of net in 2021 and 47.2% in 2024. A board deck reporting $8,143.50 as growth is
reporting the finance team's corrections as demand.

---

### I7 - The column called revenue is 0.508% of revenue, and half of it is a cost.

**Query**
```sql
SELECT session_column_total_usd, subscription_revenue_total_usd,
       session_vs_subscription_ratio, ending_mrr_usd, arpu_usd, arppu_usd FROM headline;

SELECT subscription_tier, count(*) AS plays, round(sum(royalty_or_ad_usd), 2) AS column_total
FROM fact_session GROUP BY 1 ORDER BY 3 DESC;
```

**Output**
```
session_column_total  subscription_revenue_total  ratio  ending_mrr  arpu  arppu
              852.14                   167647.19  196.7     8138.50  8.47  12.52

subscription_tier   plays  column_total
Premium             96613        360.71     <- per-stream royalty: money PAID OUT
Free                65443        257.46     <- ad income: money RECEIVED
Family              62022        233.96     <- per-stream royalty: money PAID OUT
```

**Caveat:** the dictionary is not wrong here, it is precise - it says *"ad revenue for Free tier;
**per-stream royalty** for paid"*. The category error is in summing the column, not in the column.
Anyone who writes `SUM(estimated_revenue_usd)` produces a number that is 0.5% of the business with
a cost and a revenue netted against each other.

**So what:** two columns, not one. Ad income ($257.46) is revenue; royalty ($594.67) is cost of
sales. The curated model has no column named `revenue` at all - it is `royalty_or_ad_usd`, and
subscription money lives in a separate table.

---

### I8 - There is no December peak. The seasonality everyone will chart is the growth curve.

**Query**
```sql
SELECT season_omega_squared, season_kruskal_p, monthly_growth_rate, growth_r_squared,
       weekend_share FROM headline;

SELECT dow_num, session_weekday, sessions, round(share_of_sessions * 100, 2) AS pct
FROM fact_dow ORDER BY dow_num;
```

**Output**
```
season_omega_squared  season_kruskal_p  monthly_growth  growth_r2  weekend_share
             -0.0981            0.9260          0.1021     0.8093         0.5276

dow_num  session_weekday  sessions    pct
      1  Monday             26589  11.87
      2  Tuesday            26683  11.91
      3  Wednesday          26337  11.75
      4  Thursday           26252  11.72
      5  Friday             38785  17.31
      6  Saturday           39613  17.68
      7  Sunday             39819  17.77
```
Raw month-of-year makes December look like **15.41%** of annual listening against a flat 8.33%.
After fitting the log-linear growth curve and testing month-of-year on the *residuals*: **ω² =
-0.0981, KW p = 0.926**.

**Caveat:** η² on the residuals is 0.157 and would look like a large effect - but there are only
**four observations per month-of-year**, where η² is heavily upward-biased. ω² is the unbiased
form and goes negative, which is the honest reading of "less structure than chance would give".
The test is also underpowered by construction: four years cannot establish a season firmly, so
this is stated as *not detectable*, not as *proven absent*.

**So what:** Q4 campaign planning built on a month-of-year chart is planning against the growth
trend. The cycle that *is* real is weekly - **Fri-Sun carry 52.76% of listening on 42.9% of the
days** - and it is unconfounded, because weekdays are evenly spread over 1,461 days.

---

### I9 - Churn is not an exit. 560 of 635 churn events are followed by another event; 355 by an upgrade.

**Query**
```sql
SELECT next_event, events FROM fact_post_churn ORDER BY events DESC;

SELECT window_label, sessions, users, round(mean_listen_seconds, 1) AS mean_sec,
       round(skip_rate * 100, 2) AS skip_pct
FROM fact_churn_window ORDER BY sort_key;
```

**Output**
```
next_event               events
upgrade                     355
churn                       130
(none - still lapsed)        75
retention                    75

window_label  sessions  users  mean_sec  skip_pct
0-14d             3304    ...      66.7    16.34
15-30d            3441             64.6    17.00
31-60d            7754             78.3    14.25
61-90d            8720             84.8    14.71
91-180d          16844             86.1    15.56
181d+            20554             84.7    14.29
```
Last 30 days vs >90 days before churn: Cliff's d = **-0.122** (p = 1.9e-57). Churned users run
**more** sessions than never-churned (265 vs 205, d = +0.185) but **shorter** ones (94.8s vs
107.3s, d = -0.252).

**Caveat:** d = -0.122 is below Cohen's "small" threshold of 0.147. This is a real but weak
signal, and it is stated as indicative. 144 of 453 churned users churn more than once, so the
windows are not independent observations of distinct people.

**So what:** two things. The leading indicator is **session depth, not session count** - a
volume-based health score points the wrong way here. And "win-back" is the wrong frame for a
population that returns 56% of the time on its own; the intervention window is the 30 days of
shortening sessions, not the month after the cancel.

---

### I10 - The recommendation flag does nothing, and five of the brief's seven segment axes are noise.

**Query**
```sql
SELECT flag, source_column, measure, round(cliffs_delta, 4) AS d,
       round(mannwhitney_p, 4) AS p, clears_small_effect FROM dim_flag ORDER BY effect_magnitude DESC;

SELECT axis, round(eta_squared, 5) AS eta2, clears_cohen_floor, verdict
FROM dim_axis ORDER BY eta_squared DESC;
```

**Output**
```
flag                          measure                        d        p       clears
is_repeat_concentrated        distinct tracks in 30 plays  -0.9739  0.0000    true
is_algorithmic_recommendation listen_seconds               +0.0026  0.2910    false

axis               eta2      clears  verdict
Hour of day     0.04449        true  real
Subscription tier 0.01587      true  real
Genre           0.01261        true  real
Device type     0.00320       false  below Cohen's small-effect floor
Age band        0.00155       false  ...
Country         0.00093       false  ...
Year            0.00033       false  ...
Gender          0.00026       false  ...
Day of week     0.00008       false  ...
```

**Caveat:** every one of these p-values is significant at n=224,078 - country's Kruskal p is
1.1e-28 and it explains **0.09%** of the variance. That is the whole point of reporting η² beside
p. The nulls are credible only because tier, genre and hour sit above the floor in the same table
using the same method: the instrument demonstrably works.

**So what:** 53.2% of the catalogue is tagged `is_algorithmic_recommendation` and the tag predicts
nothing - not duration, not skips, not plays per track (d = +0.051, p = 0.219). Either the
recommender is not working or the flag is not recording what it claims; both require the same next
step, which is instrumenting *surfaced* vs *chosen* rather than tagging the track.

---

### I11 - The brief asks how playlist composition influences listening. The column is random.

**Query**
```sql
SELECT playlist_coherence, playlist_coherence_expected FROM headline;
-- coherence = share of sessions whose (playlist_id, track_id) exists in bridge_playlist_track
-- expected  = mean over sessions of (playlists containing that track) / 767
```

**Output**
```
playlist_coherence  playlist_coherence_expected
           0.03649                      0.03680
```
Binomial z = **-0.76**. **96.4%** of sessions name a playlist that does not contain the track
played. Playlists are 49.8% public but public ones take **75.67%** of sessions (Cliff's d =
+0.908), and size does not explain it (ρ = -0.077; private playlists are the *larger* ones).

**Caveat:** this is a data defect, not a business finding, and the page treats it as such - it
appears as a note attached to the unanswerable question rather than as a panel.

**So what:** one of the brief's named questions cannot be answered from this file, and saying so
is more useful than charting a relationship that is provably random. The one bit that survives -
public playlists take 3× their share of listening - is worth instrumenting properly.

---

### I12 - Genre travels with geography: Reggae in South Africa over-indexes 2.28×, Hip-Hop in the US 2.03×, Latin in Brazil 2.03×.

*Web-only. Cut from the poster on panel budget, not on strength - but it renders in the app, so
per rule 3 it carries a ledger entry.*

**Query**
```sql
SELECT genre_name, country_name, sessions, round(over_index, 3) AS over_index
FROM fact_genre_country ORDER BY over_index DESC LIMIT 5;

SELECT min(sessions) AS thinnest_cell, count(*) AS cells FROM fact_genre_country;
```

**Output**
```
genre_name  country_name    sessions  over_index
Reggae      South Africa        2181       2.282
Hip-Hop     United States       3569       2.032
Latin       Brazil              3558       2.029

thinnest_cell = 585    cells = 100
```
Chi-square of independence across the 10 × 10 table: **Cramér's V = 0.0925**.

**Caveat:** V = 0.0925 is a *weak* association overall - the matrix is mostly flat, and only a
handful of cells reach 2×. It survives the thin-cell check that killed I3's artist table: the
smallest of the 100 cells holds **585 plays**, so no over-index here rests on a small
denominator. This is the only cross-dimensional interaction in the file that does.

**So what:** the three strongest cells are each a genre in a market with a real cultural claim to
it, which is what makes this the one segment finding worth acting on. It argues for
market-specific editorial rather than the country-level engagement cuts the brief asks for - those
explain η² = 0.0009 of listening depth (I10).

---

## Rejected

| Candidate | Why dropped |
|---|---|
| Top-10 artists by plays | **It is the artefact.** I1 exists because this is the chart everyone else will ship. |
| "Suspicious artists" over-index table (Mariah Carey 18.4×) | **Thin cells.** 87.5% of the volume is one account (I3). It would have been the month's biggest error. |
| Month-of-year seasonality bar chart | The ramp, not a season (I8). ω² negative. |
| `estimated_revenue_usd` by country / device / genre | Summing a cost and a revenue together (I7). Every such chart is meaningless regardless of the cut. |
| Playlist composition analysis | The join is random (I11). |
| Geographic map of listening | Country explains η² = 0.0009 of depth. A map would render noise at high resolution. |

| "Heavy free users convert" funnel | True but the base rate is already 77.7%; heaviness adds 14pp. Too weak to carry a panel. |
| Gini / Pareto on user engagement | Top 10% = 42.9% of sessions. Real, unremarkable, and every streaming deck has it. |
| Age/gender demographic panel | η² = 0.0016 / 0.0003. Noise. |
| `new_artist_discovered` discovery funnel | The flag is 28.1% recall against true first-plays. Not trustworthy enough to build on. |

## Non-obvious checklist

Worked deliberately in G3:

- [x] **two-way interactions** - genre × country real (V=0.0925, no thin cells); tier × country, device × genre not
- [x] **Simpson's paradox** - the entire signature. The artist ranking reverses on a subgroup split (I1)
- [x] **rate vs volume mismatch** - the month's organising idea. Every real finding is a rate; every trap is a volume (I9 especially)
- [x] **concentration** - across users unremarkable (top 10% = 42.9%); *within* user it is the finding (Herfindahl 0.40 vs 0.075, I2)
- [x] **distribution vs average** - mean 92.3s vs median 35s with negative kurtosis; the mean describes a value that almost never occurs (I5, I10)
- [x] **cohorts** - signup-month cohorts show no retention difference; tenure to first churn median 149d
- [x] **changepoints & anomalies** - none in the growth curve (R²=0.809); the anomaly is a duplicated event (I6 caveat)
- [x] **funnel leakage** - it leaks *backwards*: churn → upgrade 355 times (I9)
- [x] **lead / lag** - the pre-churn depth decline, d = -0.122 (I9)
- [x] **missingness as signal** - only two nullable columns, both structural and both correct
- [x] **survivorship** - 71 of 448 artists never played; immaterial to every question asked
- [x] **mix vs performance decomposition** - MRR net split into customer-driven vs reconciliation (I6)
