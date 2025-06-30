# Insight ledger - 2025/06 · Social Media Content Performance

**The gate that decides the Insights score. No query, no claim.**
Queries run against `Sheet1` registered as `f`; every figure is reproduced by `integrity.py`.

> **This ledger was rewritten once.** My first thesis - "content category explains 79% of engagement
> variance" - was true, reproducible, and *tautological*: the engagement rate is drawn from a band
> keyed to content category, so the claim merely restated the generator. It was caught by an
> adversarial review and independently re-verified before it reached the UI. The discipline that
> saved it is in `.workbench/docs/LEARNINGS.md`: **test uniformity within groups, not just globally.**

## Thesis

> **Only one number in this file is real.** Views is the sole free variable - impressions,
> engagement and the engagement rate are all derived from it or drawn from a label. And what moves
> views is the **format you publish, not the platform, the region, or the hour**: video earns 3.4×
> the median views of an image, while six platforms sit 3.7% apart and an apparent 14.3% regional gap is not significant.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | 5,600 posts, six platforms, eight countries, 17 months. The brief asks what makes content succeed *on different platforms* and what the *regional* trends are. |
| **Complication** | The metric everyone reports is not a measurement (**I-3**): every engagement rate was drawn from one of four uniform bands keyed to content tier. Two more headline columns are pure derivations of a third (**I-4**). |
| **Resolution** | One variable survives - views - and it answers a different question than the brief asked: format is the lever (**I-1**, video 3.4× image), placement is not (**I-2**). A third of the brief's questions are structurally unanswerable (**I-5**). |

---

## I-1 - Format is the lever: video earns 3.4× the views of an image

**Query**
```sql
select Post_Type, count(*) posts, median(Views) median_views,
       round(100.0*sum(Views)/(select sum(Views) from f),1) view_share,
       round(100.0*count(*)/(select count(*) from f),1)     post_share
from f group by 1 order by median_views desc;
```

**Output**
```
Post_Type      posts   median_views   view_share   post_share
Video           2948        913,871       75.8%        52.6%
Carousel          51        430,378        0.9%         0.9%
Article          207        414,267        3.9%         3.7%
Text             458        311,374        4.4%         8.2%
PDF               16        288,737        0.3%         0.3%
Image            996        272,709        7.4%        17.8%
Live Stream      924        263,112        7.3%        16.5%

Post_Type explains 19.0% of log(Views) variance (Kruskal p = 2.2e-243).
```

**Caveat:** `Views` is the only column not derived from another or drawn from a band, so it is the
one place a real effect can live - but this is still synthetic data, and the magnitude should be
read as an ordering, not a forecast. Carousel (n=51) and PDF (n=16) are too thin to rank; the claim
rests on Video (2,948), Image (996) and Live Stream (924).

**So what:** video is 52.6% of the posts and returns 75.8% of the views. Live Stream is the trap -
the most expensive format to produce, 16.5% of output, and the **lowest** median views of all seven.

---

## I-2 - Placement is not a lever: platforms 3.7% apart, regions not significant

**Query**
```sql
select Platform, count(*) n, median(Views) med from f group by 1 order by med desc;
select Region,   count(*) n, median(Views) med from f group by 1 order by med desc;
```

**Output**
```
Platform    n     median views     Region      n    median views
TikTok    1257         382,281     Germany    627        408,850
X.com     1201         377,084     Japan      666        394,176
YouTube   1320         375,669     USA        752        380,354
LinkedIn   525         374,865     Brazil     718        373,660
Facebook   299         369,247     Canada     735        370,070
Instagram  998         368,711     India      691        366,523
                                   Australia  679        366,193
                                   UK         732        357,592

best/worst spread:   platform 3.7%    region 14.3%
eta^2 on log(Views): Platform 0.0038 (p=0.048)   Region 0.0018 (p=0.298, n.s.)
eta^2 on rate:       Platform 0.0049             Region 0.0023 (p=0.070, n.s.)
```

**Caveat:** platform reaches nominal significance on views (p=0.048) - at n=5,600 almost anything
does. The effect size is 0.4% of variance. This is "not a lever", not "no difference".

**Correction:** an earlier draft of this entry quoted a 6.4% regional spread and put the USA on
top. That was read from a truncated table. The real spread is **14.3%** and Germany leads. The
conclusion is unchanged and in fact better illustrated: a 14.3% gap between the best and worst of
eight countries is *still* not statistically significant (p=0.30, η²=0.0018), which is precisely
why eyeballing a ranking is not analysis. Caught by the build; recorded here rather than quietly
fixed.

**So what:** the brief's central question - what works *on different platforms* - has no answer in
this data, and neither does its regional question. Every published entry leads with a platform
comparison anyway.

---

## I-3 - The engagement rate is a label, not a measurement

Every post's engagement rate was drawn from one of four uniform bands selected by content tier. It
is an input to the file, not an outcome of audience behaviour.

**Query**
```python
BANDS = {
    "entertainment": (["#FunContent", "#MemeMonday", "#JustForFun"], 0.05, 0.10),
    "promo": (["#ProductDemo", "#FeatureHighlight", "#SaaSLaunch", "#NewRelease"], 0.08, 0.15),
    "event": (["#EventRecap", "#WebinarReplay", "#EventSummary", "#BehindTheScenes"], 0.10, 0.18),
    "story": (["#SuccessStory", "#CustomerStory", "#Testimonial", "#CustomerSuccess"], 0.15, 0.25),
}
# per band: share inside the bounds, and KS of the normalised values against uniform
```

**Output**
```
band            n     inside bounds   observed range        KS vs uniform
U(0.05,0.10)   316        100.0%      [0.05005, 0.09959]      p = 0.155
U(0.08,0.15)  1378        100.0%      [0.08002, 0.14999]      p = 0.481
U(0.10,0.18)   577        100.0%      [0.10044, 0.17993]      p = 0.425
U(0.15,0.25)  2669        100.0%      [0.15003, 0.24998]      p = 0.043
                                      4,940 / 5,600 rows = 88.2%
```

Round-number bounds, total containment, uniform within band. The 660 uncovered rows are the three
hashtags that straddle categories (#TrendingNow, #DidYouKnow, #CaseStudy2025).

**Caveat:** the fourth band's p=0.043 is a marginal rejection; restricting to its dominant category
raises it (Educational 1,927/2,026 → p=0.083). Either way the exact containment and round bounds are
the stronger evidence.

**Correction (hashtag mirage - the grouped view).** The poster claimed "widest spread inside any
one category - Educational - is only 4.5%". That figure was not a within-category spread. The app
pooled each hashtag's rate across *every* category it appears in and then filed the pool under a
single heading - `g[0].content_category`, the category of whichever row happened to sort first -
so the "spread inside Educational" was really a spread between blended rates arbitrarily assigned.
It is the same straddling noted above: #SuccessStory is 73% Educational but landed under Customer
Story, and #DidYouKnow's pooled 15.24% blends its Educational 19.85% with its Entertainment 7.60%.

- **QUERY** one cell per (`main_hashtag`, `content_category`) pair, `avg(engagement_rate)`,
  `having count(*) >= 50`; spread = max-min within each category.
- **OUTPUT** 13 cells across 5 categories. Widest within-category spread **0.3086pp**
  (Product Promotion, k=3), then Customer Story 0.2649, Event/Webinar 0.2226, Educational 0.1867,
  Entertainment 0.0868. The pooled ranking spans **12.39pp** (#SuccessStory 19.96% → #FunContent
  7.57%).
- **CAVEAT** The 50-post cell floor is a decision, not a property of the data. With no floor the
  cells run down to n=1 and the widest "within-category" spread is 9.24pp - an artefact of thin
  cells, not a finding. At ≥30 it is 0.77pp, at ≥100 it is 0.26pp. 50 keeps every category at 2-3
  rankable hashtags. The threshold is stated in the UI beneath the grouped view.
- **SO WHAT** The correction makes the month's own argument **far** stronger, not weaker: the
  collapse from ranking to controlling is 12.39pp → 0.31pp, a factor of **40**. The broken figure
  understated it as 2.75×. Both halves are now specified in `metric_checks.yml`
  (`mirage_widest_cell_spread`, `mirage_widest_cell_category`) and asserted against the poster DOM,
  so the headline is verified rather than asserted.

**So what:** "educational content outperforms entertainment 2.6×" - the finding this dataset most
invites, and the one the whole field is implicitly reporting - is a restatement of how the file was
built. Any content recommendation drawn from the engagement rate is unfounded. **Say so on the
poster.** That is the difference between a report and a rendering.

---

## I-4 - Three of the four headline metrics are derived from the fourth

**Query**
```sql
select min(Impressions/Views), max(Impressions/Views), corr(Views, Impressions) from f;
select max(abs(Engagement - Engagement_Rate*Views)/Engagement) from f;
```

**Output**
```
Impressions / Views : support exactly [1.100009, 1.299975], mean 1.19984
                      KS vs U(1.1,1.3)  p = 0.684      corr(Views, Impressions) = 0.9979
Engagement          = Engagement_Rate x Views, median relative deviation 6.3e-06
Engagement_Rate     = Engagement / Views (stored rounded to ~4dp)
```

**Caveat:** none - these are deterministic relationships, not statistical ones.

**So what:** an impressions-vs-views chart is a straight line by construction, and "reach" adds
nothing to "views". The four-KPI strip every entry opens with - impressions, views, engagement,
rate - is **one number shown four ways.**

---

## I-5 - A third of the brief's questions are structurally unanswerable

**Query** - every (platform, post type) cell, not just the platform totals. Enumerating one level
up is what let the first draft of this entry state a rule its own data falsifies.
```sql
select Platform, Post_Type, count(*) posts, count(Click_Through_Rate) with_ctr
from f group by 1,2 order by 1,2;
-- and the cells that are neither all nor nothing:
select Platform, Post_Type, count(*) n, count(Click_Through_Rate) w from f
group by 1,2 having count(Click_Through_Rate) between 1 and count(*)-1;
select count(*) tot, count(Clicks) c, count(Click_Through_Rate) ctr,
       sum(case when (Clicks is null) <> (Click_Through_Rate is null) then 1 else 0 end) disagree
from f;
select Post_Type, sum(case when Video_Views>0 then 1 else 0 end)       with_video,
                  sum(case when Live_Stream_Views>0 then 1 else 0 end) with_live
from f group by 1;
```

**Output**
```
By platform:  TikTok 1257/1257 (100%)   Facebook 299/299 (100%)   LinkedIn 304/525 (57.9%)
              YouTube 0/1320   X.com 0/1201   Instagram 0/998

Within LinkedIn, by post type:
  Article      207/207   100%      Image   0/71    0%
  Live Stream   68/68    100%      Text    0/19    0%
  Carousel      25/44   56.8%  <-  Video   0/100   0%
  PDF            4/16   25.0%  <-
                                      207 + 68 + 25 + 4 = 304  (the platform total)

Cells that are PARTIAL, whole file:  LinkedIn Carousel, LinkedIn PDF.  Nothing else.
Clicks and Click_Through_Rate are co-null on all 5,600 rows (0 disagreements).
Video_Views       > 0 on exactly the 2,948 Video posts, nowhere else.
Live_Stream_Views > 0 on exactly the 924 Live Stream posts, nowhere else.
Overall CTR coverage: 1,860 / 5,600 = 33.2%
```

**Correction (2025-06-30).** The first version of this entry wrote "Within LinkedIn: Article 207/207
and Live Stream 68/68 always; Image, Text, Video never", and `analysis/profile.md` drew from it the
rule "**CTR exists exactly where a post can carry a link**... the missingness is deterministic, not
random." Both are false as stated, and they are false in a way the entry's own arithmetic exposes:
207 + 68 = 275, but LinkedIn has 304 CTR rows. The missing 29 are LinkedIn **Carousel 25/44** and
**PDF 4/16** - two cells that are neither all nor nothing. The published enumeration simply omitted
the two rows that broke the rule. A category that never appeared could not be checked.

**The rule, stated so it survives its own data.** Click tracking is a *platform* property with one
exception. Two platforms record clicks on every post (TikTok 1,257/1,257; Facebook 299/299); three
record none at all (YouTube, X.com, Instagram - 3,519 posts, zero). LinkedIn is the exception, and
inside it the availability is decided by post type: Article and Live Stream always, Image / Text /
Video never - and Carousel and PDF **partially**, 29 of 60 posts. Where CTR is present, `Clicks` is
present too, always.

**Caveat:** the partial cells are not explained by anything we tested. Across those 60 LinkedIn
posts, presence of a click count is unrelated to content type (χ² p=0.64), region (p=0.59),
engagement level (p=0.67), publishing hour (p=0.28), post date (Mann-Whitney p=0.91) or any of
views / impressions / engagement / likes / shares / comments / rate (all p≥0.06). Content category
is nominally associated (χ² p=0.03) but over thirteen cells of ≤16 rows, and it does not resolve
into a rule - `#SuccessStory` is 0/6 on Carousel and 3/6 on PDF. So: mostly structural, with a
residue that behaves like a coin flip. The honest statement is "almost deterministic", and the
report says so rather than rounding it to a clean rule.

**Why it matters beyond 60 rows:** an "exactly where a post can carry a link" rule invites you to
impute the blanks - a LinkedIn carousel *can* carry a link, so a zero looks safe. It is not: 25 of
those 44 carousels have a click count and 19 do not, and the two groups are indistinguishable. The
consequence for R5/R6 is unchanged; the licence to fill in blanks is not.

**So what:** **R5** (regional click-through) and **R6** (hashtags driving clicks) are answerable for
33.2% of posts, and any platform CTR ranking silently compares three platforms while dropping three.
**R7** ("which regions show high video view counts or live-stream interest") is really asking about
each region's *format mix* - the video-view column is zero for 47% of rows and cannot distinguish
regional appetite from regional format choice. Naming that beats ranking eight regions on it.

---

## I-6 - The hashtag mirage: η² 0.751 pooled, 0.018 inside a category

The month's signature interaction has its own entry because the UI quotes four of its figures.
The narrative half lives in I-3 (why the engagement rate is a label at all); this is the arithmetic.

**Query**
```sql
-- pooled: one group per hashtag, ignoring the category it belongs to
-- within:  the same, measured inside each content category and pooled over categories
-- increments: the saturated (category x hashtag) R2 minus each one-way R2
select c.main_hashtag, count(*), avg(f.engagement_rate)
from fct_post f join dim_content c using (content_key) group by 1 order by 3 desc;
-- all four are specified as SQL in model/metric_checks.yml:
--   mirage_eta2_pooled, mirage_eta2_within_category,
--   mirage_inc_hashtag_r2, mirage_inc_category_r2
```

**Output**
```
eta^2 hashtag on engagement rate, pooled          0.750531
eta^2 hashtag on engagement rate, within category 0.018092
R2 of the saturated (category x hashtag) cells    0.797358
R2 category alone 0.793624      R2 hashtag alone 0.750531
  -> hashtag adds +0.003734 once category is known
  -> category adds +0.046827 once hashtag is known        (a factor of 12.5)

Pooled ranking of the nine hashtags with n>=100 spans 12.39pp
  (#SuccessStory 19.96% -> #FunContent 7.57%)
Widest spread inside any one category, cells >=50 posts:  0.3086pp (Product Promotion, k=3)
  then Customer Story 0.2649, Event/Webinar 0.2226, Educational 0.1867, Entertainment 0.0868
```

**Caveat:** four numbers here that used to be typed into the UI were wrong, and are corrected as
of 2025-06-30. The within-category η² was published as **0.022**; recomputed it is **0.018092**.
The increments were published as **+0.003** and **+0.046**; they are **+0.0037** and **+0.0468**,
which round to +0.004 and +0.047. None of the errors changed the conclusion - that is exactly why
none of them was caught. All four are now `data-metric` marks recomputed against the parquet by
`tools/verify_metrics.py`, so they cannot drift again. Separately, the 50-post cell floor is a
decision and not a property of the data (see I-3 and `assumptions.md`): with no floor the widest
within-category spread is 9.24pp, at ≥30 it is 0.77pp, at ≥100 it is 0.26pp.

**So what:** ranking hashtags is the single most common thing a social report does with this file,
and it recovers the content tier rather than hashtag effectiveness. The dashboard lets the reader
perform the refutation with one toggle instead of reading a claim about it. **R6** is answered:
no hashtag drives engagement; the tier it belongs to does, and the tier was drawn from a band.

---

## I-7 - Neither the hour nor the weekday is a lever, on either measure

The earlier draft of this entry tested only the engagement rate - the column this report calls a
synthetic label - and therefore quoted evidence it had already disqualified. Both measures are
tested here, and both agree.

**Query**
```sql
select Post_Hour, count(*), median(Views), avg(Engagement_Rate) from f group by 1 order by 1;
select Day_Name,  count(*), median(Views), avg(Engagement_Rate) from f group by 1;
-- Kruskal-Wallis on each axis, against Views and against Engagement_Rate (integrity.py)
```

**Output**
```
axis      response          H     df       p     eta^2
hour      views          6.395    11   0.846   0.00108   (on log views)
hour      engagement rate 14.809   11   0.191   0.00262
weekday   views          6.819     6   0.338   0.00153   (on log views)
weekday   engagement rate 2.812     6   0.832   0.00045

Hours run 08..19 only, twelve values, and the volume profile is bimodal by construction:
  10-12 and 15-17 carry 731-766 posts each; 08-09, 13-14 and 18-19 carry 164-212 each.
Median views by weekday span 354,840 (Mon) to 390,861 (Sat) - a 10.2% ratio, n.s.
```

**Caveat:** four tests, no correction applied, and none is close to significance anyway - the
smallest p is 0.19. Absence of evidence at n=5,600 with η² ≈ 0.001 is a genuinely strong negative
here, not a failure to detect.

**So what:** **R4** ("what is the best time to post") has no answer in this file, and the shape a
reader would naturally read off a volume-by-hour chart - two busy peaks - is a property of the
generator, not of an audience. Saying so is the answer; ranking twelve hours is not.

---

## I-8 - Sponsored beats organic by 29% and the effect is format mix, reversed

**This entry replaces a false one.** Until 2025-06-30 the report said "no significant effect
(p=0.41, η²=0.0001) - sponsored performs identically to organic", and printed it directly above a
median-views table showing Sponsored 471,713 against Organic 365,325. The quoted test was on
`engagement_rate`, the synthetic label; the table was on views. The evidence cited was not evidence
for the claim, and the two disagreed on screen.

**Query**
```sql
select Content_Type, count(*), median(Views) from f group by 1;
select Post_Type, Content_Type, count(*), median(Views) from f group by 1,2 order by 1,2;
-- Kruskal-Wallis on Views by Content_Type, overall and within each Post_Type;
-- incremental R2 of Content_Type over a Post_Type model of log(Views), F-tested.
```

**Output**
```
overall     Organic  n=4,646  median views 365,325
            Sponsored n=  954  median views 471,713      +29.12%
            Kruskal on views  H=22.846  p=1.76e-06       <- real
            Kruskal on rate   H= 0.670  p=0.413          <- the test that used to be quoted

sponsored share of each format, and that format's median views
  Video        22.7%   913,871   <- highest median, heavily sponsored
  Article      27.5%   414,267
  Carousel     19.6%   430,378
  Image        16.3%   272,709
  Text          9.2%   311,374
  PDF           6.2%   288,737
  Live Stream   1.5%   263,112   <- lowest median, almost never sponsored

within each format, organic vs sponsored median views
  Video        1,055,130 vs 710,999   -32.6%   p=0.0022   <- reverses
  Text           302,112 vs 405,051   +34.1%   p=0.0023
  Article        426,364 vs 343,960   -19.3%   p=0.384
  Carousel       459,238 vs 368,354   -19.8%   p=0.722
  Image          272,836 vs 272,606    -0.1%   p=0.239
  Live Stream    263,010 vs 275,628    +4.8%   p=0.965
  PDF            n_sponsored=1 - not testable

each post scored against its own format's median (views / format median):
  organic 1.0130    sponsored 0.8876    Kruskal p=0.039

R2(format)=0.190246   R2(format+content type)=0.194233
  increment 0.003987, partial eta^2 = 0.004924, F(7, 5586)=3.95, p=0.00026
```

**Caveat:** the pooled effect is statistically detectable (p=0.00026) and substantively negligible -
half a percent of the residual variance in log views. It is also *directionally inconsistent*: two
formats move significantly and in opposite directions. "Detectable but useless and unsigned" is the
honest reading; "no effect" would be as wrong as "sponsored wins". The PDF cell has one sponsored
post and is not tested.

**So what:** **R9** ("does sponsored content outperform organic") is a textbook Simpson reversal in
this file. The raw comparison says sponsored wins by 29%; sponsorship is concentrated in Video
(22.7%) and absent from Live Stream (1.5%), and Video's median is 3.5× Live Stream's. Hold format
constant and the largest single effect points the other way. The recommendation is unchanged from
I-1 - **format is the lever** - but the reason a naive R9 answer is wrong is now stated with the
evidence that actually bears on it.

---

## Rejected

| Candidate | Why dropped |
|---|---|
| **"Content category explains 79% of engagement variance"** | My own first thesis. True, reproducible, tautological - the rate is drawn from a band keyed to category (I-3). Killed by adversarial review. |
| **"Educational converts attention to engagement +11.9pp above its view share"** | The same tautology in accounting clothes: engagement = views × band, so the share gap is fully determined by the band. Seductive because it looks like May's genuine rate-vs-volume finding. It is not. |
| "Rank hashtags by engagement" | η²=0.751 overall collapses to **0.018 within category**; hashtag adds +0.004 R² once category is known, category adds +0.047 once hashtag is known. The hashtag is a proxy for the tier. **This survived adversarial review and is kept as the R6 answer (I-6).** |
| "Best time to post" (R4) | Views by hour p=0.85, by weekday p=0.34; rate by hour p=0.19, by weekday p=0.83. Hours bounded 08:00-19:00 with a bimodal volume profile by construction. Nothing outperforms on either measure (**I-7**). |
| "Sponsored outperforms organic" (R9) | The raw +29.1% on views is real (p=1.8e-06) and is format mix: hold format constant and the largest effect reverses (Video -32.6%, p=0.0022). Partial η²=0.0049. **The earlier entry here - "p=0.41, η²=0.0001, performs identically" - was a test on the synthetic rate and is retracted (I-8).** |
| "Impressions as a reach metric" | `Views` × U(1.1,1.3). Zero independent information (I-4). |
| Anything counted by `Post_ID` | 5,000 distinct across 5,600 rows, 557 reused. Second month running the ID column is not a key. |

## So what - three recommendations

1. **Move production budget from live streams to video.** Live Stream is 16.5% of output for 7.3%
   of views and the lowest median of any format; video is 52.6% of output for 75.8% of views. → *I-1*
2. **Stop optimising the platform mix and the posting calendar.** Six platforms sit within 3.7% of
   each other, region is not significant, and no hour or weekday outperforms. → *I-2*
3. **Do not set content strategy from this file's engagement rate - and instrument click tracking
   on the three platforms that lack it.** The rate is a synthetic label (I-3); the one genuinely
   missing measurement is clicks on YouTube, X.com and Instagram, which is 67% of posts. → *I-3, I-5*

## Non-obvious checklist

- [x] two-way interactions - platform × category tested; nothing survives category
- [x] Simpson's paradox - views by platform within category; no reversal
- [x] rate vs volume mismatch - **tested and rejected as tautological**, unlike May where it was real
- [x] concentration - video is 75.8% of views from 52.6% of posts
- [x] distribution vs average - medians throughout; views right-skewed (skew 1.32)
- [x] cohorts - n/a, no account or author entity
- [x] changepoints - 17-month span tested; no trend or break in views
- [x] funnel leakage - **the funnel is fake**: impressions → views is a fixed random factor (I-4)
- [x] lead / lag - hour and weekday both n.s.
- [x] **missingness as signal - the strongest structural finding (I-5)**
- [x] survivorship - video/live-stream columns are zero-by-format, not missing
- [x] mix vs performance decomposition - attempted; it is the rejected tautology above
