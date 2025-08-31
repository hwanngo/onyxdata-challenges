# Brief - 2025/08 · Fitness Membership Analytics (MyGym)

**Gate G1 artifact.** Source of truth for what was asked. Everything downstream cites this file.

- **Title:** August 2025 DataDNA - Fitness Membership Analytics
- **Challenge page:** <https://datadna.onyxdata.co.uk/challenges/august-2025-datadna-fitness-membership-analytics-challenge/>
- **Playground:** <https://datadna.onyxdata.co.uk/playground/2025-08-august-2025-datadna-fitness-membership-analytics-challenge/>
- **Dataset ZIP:** sha256 `3a2f7b55...2b01a2` · per-file checksums recorded in `challenges.yml`
- **Era:** 2
- **Grain:** 1,998 rows × 26 columns, one CSV. **No ID column of any kind.**

## Scenario

> In this challenge, you'll take on the role of a data analyst at MyGym, a fast-growing fitness
> center chain with multiple locations across California. MyGym offers a wide range of membership
> tiers, subscription models, and amenities, including group classes, personal training, and
> multi-location access. Gaining insights into how members engage with these services is crucial
> for optimizing operations and designing targeted, effective membership offers.

The challenge page, the in-ZIP PDF and the in-ZIP DOCX agree word for word. **Fourth month running
the requirements were inside the archive** - the DOCX carries ten example questions the page omits.

## Stated objective

> Use this dataset to develop an analytical report or dashboard that helps MyGym:

| | Ask |
|---|---|
| **M1** | Understand which member segments bring the most value |
| **M2** | Identify areas for pricing, subscription, or service optimization |
| **M3** | Improve customer experience through data-driven insights |
| **M4** | Optimize staffing and facility allocation across locations |
| **M5** | Explore trends in retention, usage, and upgrade behavior |

## Explicit requirements

There is **no numbered requirements list this month** - a departure from May, June and July, which
each posed nine numbered questions. The DOCX offers ten *example questions* and states explicitly:
*"These are exploration prompts, not a checklist. Feel free to go beyond them and uncover
unexpected patterns."*

That is licence to answer the questions that **can** be answered and say plainly which cannot.
Answerability below is from the structural checks in the next section, not from a first impression.

- [ ] **Q1** Which membership types are linked to the highest retention or revenue? - *revenue: arithmetically; retention: **no***
- [ ] **Q2** Do pricing models (monthly vs. early bird annual) affect churn or satisfaction? - ***no*** *(no churn, no satisfaction column)*
- [ ] **Q3** Are some locations performing better in engagement or profitability? - ***partly*** *(the one real signal lives here)*
- [ ] **Q4** How does personal training / group class usage influence value? - ***definitionally not*** *(value is a label)*
- [ ] **Q5** What effect do discount types have on final revenue? - ***arithmetically***: -5 / -10 / -15%, exactly
- [ ] **Q6** Is there a relationship between tenure and service usage or upgrade behavior? - *tenure: tested, null; upgrade: **no data***
- [ ] **Q7** Do access types (off-peak, all hours, priority) impact visit frequency? - ***this is Q1 restated***; access ≡ tier
- [ ] **Q8** What geographic patterns emerge from multi-location access behavior? - ***weakly***; does not survive correction
- [ ] **Q9** How do segments use the gym through the week? - *tested, **null***; weekdays are uniform
- [ ] **Q10** Can you identify clusters of high-value members or churn risks? - ***no churn risk exists to identify***

Six of ten are structurally unanswerable and two more are the same question wearing different
labels. Establishing *that*, with evidence, is the deliverable - not a tenth gym dashboard ranking
four tiers by a number the tier itself defines.

## Verifying the brief's own claims against the file

The June lesson: check what the brief asserts before building on it.

| Brief says | File says | Verdict |
|---|---|---|
| "multiple locations across California" | 10 cities, all CA; lat/lon 1:1 with city name | **holds** |
| "a wide range of membership tiers" | 4 tiers: Basic 20, Standard 30, Premium 50, Elite 70 | **holds** |
| "subscription models" | 3: Monthly, Quarterly, Early Bird (Annual) | **holds** |
| "amenities ... group classes, personal training, multi-location access" | 4 boolean flags + PT hours | **holds** |
| "retention ... behavior" (M5) | **every member visited within the last 60 days** | **fails** - no churn in the file |
| "upgrade behavior" (M5, Q6) | one row per member; no tier history, no prior-tier column | **fails** - not recorded |
| "fast-growing" | joins span 2022-07-24 → 2025-06-19; growth is checkable | **partial** - to be tested at G2 |

## Structural facts established while reading the file

Full evidence at G2 with the seven standing checks; these are the load-bearing ones.

1. **`final_price` is a lookup, not a measurement.** `membership_type → subscription_price` is 1:1
   (4 tiers, 4 prices, zero variance within tier). `subscription_model` maps to a multiplier of
   exactly 1.0 / 0.9 / 0.75. `discount_type → discount_rate` is 1:1 (0 / .05 / .10 / .15). And
   `final_price = subscription_price × model_factor × (1 - rate)` to within 3.6e-15. **Three
   categorical labels determine every dollar in the file.**
2. **`access_hours` is 1:1 with `membership_type`** - Basic→Off-peak only, Standard→Weekdays only,
   Premium→All hours, Elite→All hours + Priority. Q7 and Q1 are one question.
3. **Nothing is churned.** `last_visit_date` occupies exactly 60 consecutive days
   (2025-05-24 → 2025-07-22), all 60 present, none missing. 0% of members are inactive beyond 60 days.
4. **Entitlement and behaviour are uncorrelated - which is NOT evidence that entitlements go
   unenforced.** Access tier explains 0.81% of check-in-time variance (η²=0.0081, KW p=0.00111),
   which **fails** the pre-declared α=5.68e-4; check-in time is uniform over 08:00-21:00
   (KS p=0.26) regardless of tier. And the one comparison that could show non-enforcement runs
   the **wrong way**: 58.52% of "Weekdays only" members list Sat or Sun against **62.85%** of
   everyone else - weekday-only members train on weekends *less*, not more (χ² p=0.077).
   Off-peak members use the 17:00-20:00 peak at 21.83% vs 22.76%, 0.9pp apart.
   *This is a null result about the generator, not a finding about MyGym's door policy.* The
   earlier draft of this file asserted "the entitlements are not enforced" as fact #4; that claim
   was killed at G3 and the assertion is retracted here rather than only further down the page.
   See `analysis/insights.md` → Correction.
5. **Two further deterministic columns.** `duration_in_gym_minutes` = check-out - check-in exactly
   (max error 0). The token count of `days_per_week` equals `visit_per_week` for all 1,998 rows.
6. **`sum(final_price)` is a category error.** It adds a monthly rate to a quarterly rate to an
   annual rate. Annualised under the two defensible readings the total forks **1.43×**
   ($826k vs $579k). The reading has to be declared, not assumed.
7. **No ID column at all.** The standing ID-uniqueness check has nothing to check - a first in four
   months. Grain is *asserted* as one row per member and cannot be verified; no two rows are identical.

## Where the value is

The one finding that survives Bonferroni correction and could change a decision: **session duration
varies by location** (η²=0.023, ω²=0.019, permutation p=0.0001 over 10k permutations; Anaheim 115
min vs San Diego 95 min). Dropping *both* extremes keeps the ordering of the remaining 8 but
attenuates η² by 35% to 0.015 at p=0.0015 - which **fails** the same α=5.68e-4 that killed two
other claims, so it is reported as a sensitivity check, not as corroboration (insights.md I-3).
Members do not visit more often in Anaheim; they stay longer. In floor-hours per
member per week that is **4.15 (Oakland) → 5.60 (Anaheim), a 35% spread.** That is an **M4** answer
- staffing and facility allocation - and it is the only one the data supports.

Second: **Standard-tier members attend group classes at 40.6% against ~54% everywhere else**
(Fisher p=3.9e-08; 95% CI [36.7, 44.7] vs [48.2, 58.3]). A single deviant cell, but it clears
correction comfortably. Supporting panel, not a headline.

Third, from arithmetic rather than statistics: **the plan-factor ladder costs $84,954/yr against
$50,960 for all four discount types combined** - 1.67×. Split by rung: Early Bird (Annual, n=624)
is **$75,750 = 1.486×** the discounts, Quarterly (n=187) is $9,204, Monthly (n=1,187) is $0 by
definition. If MyGym wants to attack price leakage, the discounts are not where the money goes -
89% of the ladder's cost is the annual rung.
*(Corrected 2025-08-31: this sentence previously attributed the whole $84,954 to "the Early Bird
annual factor". The app and poster were already correct - they say "commitment ladder" / "plan
factor". `analysis/insights.md` I-2 carries the query.)*

## Thesis (survived adversarial review at G3 - after being rewritten)

> **MyGym's data cannot tell it who is churning - but it will confidently tell it the wrong
> answer.** `last_visit_date` is `join_date` rescaled (ρ=0.9999): the 982 members this file flags
> as lapsed are, *almost* to the member, its 982 longest-tenured. Any churn model built here spends the
> retention budget on the most loyal members in the building, in inverse order of loyalty. The one
> thing the file does know is *which* building - session length varies 35% in floor-hours across
> ten locations.

**This replaced an earlier candidate** - *"charging a 3.5× premium for entitlements it does not
enforce, to members who cannot churn"* - which an adversarial review killed and I verified as
killed before accepting. Two of its three supporting claims were the June tautology in new
clothing: inferring a real-world behaviour from the generator's failure to correlate two columns.
Full refutations in `analysis/insights.md` → **Correction**.

The structural facts above are unchanged; what changed is which of them is load-bearing. Fact 3
(the 60-day window) was recorded as "churn is unanswerable". The question I failed to ask was
**bounded by what?** - and the answer to that is the month.

## Submission mechanics (THIS month)

Union of the Step-2 list, the prefilled LinkedIn text and the FAQ, per the standing rule.

- **Tags:** @OnyxData, @ZoomCharts, @Enterprise DNA, @BCS (The Chartered Institute for IT),
  @Smart Frames UI, @Data Career Jumpstart
- **Hashtag:** `#dataDNA`
- **Single image only** - the post must carry one visualisation image
- **Follow** Onyx Data on LinkedIn
- **Submission form:** the challenge page URL above
- **Sponsor mini-challenge:** ZoomCharts Drill Down Visuals for **Power BI** - requires ≥2 ZoomCharts
  visuals in a Power BI report, plus `#builtwithzoomcharts`. **Not applicable to this entry**
  (SolidJS, not Power BI); the $300 voucher track is out of scope by stack choice, not oversight.

## Timeline

| | Date |
|---|---|
| Opens | August 2025 |
| Deadline | end of August 2025 |
| Judging | September 2025 |
| Announced | September 2025 |

The challenge has only just closed. This is portfolio work against a
past prompt, not a live entry - the same footing as May, June and July.

## Benchmark

No AI scores are exposed in the DataDNA portfolio for any month - established earlier in this
programme, where all 445 scraped entries carried `data-score="0"`. The definition-of-done line "beats the
highest scorer on ≥2 dimensions" is therefore **not mechanically checkable**, and benchmarking
stays qualitative.

**What the field will predictably do here:** a four-tier revenue ranking and a churn-risk segment.
The first restates the price list; the second describes members who do not exist. Both will look
professional and neither will be true.

**What that leaves open:** naming the price column as a lookup, naming the 60-day floor on
`last_visit_date`, and reporting the location-duration effect with an effect size rather than a
ranking.

## Lessons applied from .workbench/docs/LEARNINGS.md

1. **Read every file in the ZIP.** The ten questions were in the DOCX, not on the page - fourth
   month running the archive carried requirements the web page did not.
2. **Verify the brief's own factual claims against the file first** (June). Two of the mission's
   five bullets - retention and upgrade behaviour - describe data that is not present.
3. **Check every numeric column for being a deterministic function of another** (June). Here it
   caught the entire price family plus `duration_in_gym_minutes` and `days_per_week`.
4. **Before claiming an axis explains a metric, ask whether the metric was constructed from it**
   (June). `final_price` by `membership_type` gives η²=0.87 - and means nothing.
5. **When nothing is significant, compute what would have been detectable** (July). The
   minimum detectable difference is what turns a null result into a finding.
