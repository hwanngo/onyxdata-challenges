# Insight ledger - 2025/08 · Fitness Membership Analytics (MyGym)

**The gate that decides the Insights score. No query, no claim.**
Every figure below is reproduced by `analysis/integrity.py` (all checks pass) and re-asserted
against a second engine by `model/test_metrics.py` and `tools/verify_metrics.py`.

> **This ledger was rewritten once, and the rewrite is the month.** My first thesis was
> *"MyGym is charging a 3.5× premium for entitlements it does not enforce, to members who cannot
> churn"*, supported by two "actionable" findings: a student discount going to older members, and
> 176 children with sauna access. An adversarial review killed both and found the coupling I had
> missed. I verified every refutation independently before accepting it. See **Correction** below.
> The lesson that generalises is in `.workbench/docs/LEARNINGS.md`: **a bounded column is worth one more
> question - bounded *by what?*** I stopped at "churn is unanswerable" when the real finding was
> that the file answers it *backwards*.

## Thesis

> **MyGym's data cannot tell it who is churning - but it will confidently tell it the wrong
> answer.** `last_visit_date` is `join_date` rescaled: the 982 members this file flags as lapsed
> are, *almost* to the member, its 982 longest-tenured. The lapse rule is a tenure cut wearing a recency
> label - no member with under 549 days of tenure is flagged. Any churn model built here spends the retention
> budget on the most loyal members in the building, in inverse order of loyalty. The one thing the
> file does know is *which* building - session length varies 35% in floor-hours across ten
> locations, and that is a staffing answer, not a marketing one.

## Narrative arc

| | Insight |
|---|---|
| **Situation** | 1,998 members, four tiers, ten California gyms, three years of join dates. The brief asks ten questions; nine of them are about pricing, retention, churn or upgrades. |
| **Complication** | The pricing questions have no residual to analyse - every dollar is a lookup from three labels (**I-2**). And the retention questions are worse than unanswerable: `last_visit_date` is a monotone remap of `join_date` (ρ=0.9999), so the churn segment the brief asks for is a loyalty ranking with the sign flipped (**I-1**). |
| **Resolution** | One question survives with a real answer, and it is the one nobody will lead with: **where**. Session length varies by location at η²=0.023 (permutation p=0.0001, against a pre-declared α=5.68e-4), and it converts to a 35% spread in occupied floor-hours per member - an M4 staffing answer (**I-3**). Dropping both extreme gyms attenuates it by 35% to η²=0.015, p=0.0015, which does *not* clear the same α; that refit is reported as a sensitivity check, not as a second finding. |

---

## I-1 - The churn list is the loyalty list, inverted

**Query**
```sql
-- the coupling
select corr(tenure_days, days_since_visit) from fct_member;
select count(*) from (select join_date from fct_member
                      group by 1 having count(distinct last_visit_date) = 1);
-- the consequence
-- TIE-SAFE: membership decided by VALUE, not sort position. See the caveat.
with lapsed as (select * from fct_member where days_since_visit > 30),
     kth as (select tenure_days t from fct_member order by tenure_days desc
             limit 1 offset (select count(*) - 1 from lapsed))
select count(*) n_lapsed,
       count(*) filter (where tenure_days >= (select t from kth)) overlap
from lapsed;
-- and the form that does not depend on the cut at all:
select min(tenure_days) filter (where days_since_visit >  30) min_flagged,
       max(tenure_days) filter (where days_since_visit <= 30) max_active
from fct_member;
```

**Output**
```
Spearman(join_date, last_visit_date)   = 0.999852
Pearson (tenure, days_since_visit)     = 0.999849
874 / 890 join dates map to exactly ONE last_visit_date   (97.6% of rows)
distinct (join, last_visit) pairs observed: 906

tenure band per last_visit_date -- monotone, essentially disjoint:
  2025-05-24   tenure 1018-1035   n=41
  2025-05-25   tenure 1002-1018   n=30
  ...
  2025-07-21   tenure   48-  64   n=41
  2025-07-22   tenure   33-  47   n=27

members a 30-day rule flags as lapsed        : 982
of those, at or above the 982nd tenure (549d): 982   (100.0%)
mean tenure, "lapsed" : 790.3 d      mean tenure, "active" : 280.4 d

min tenure among FLAGGED : 549      max tenure among ACTIVE : 549
members whose tenure lies in the overlap band : 4
at a 45-day threshold the two groups are PERFECTLY separated (0 overlap)
```

**Caveat on the overlap statistic:** the obvious computation - sort by tenure, take the top 982,
intersect - returns **981 or 982** depending purely on how four members who share a tenure of 549
days happen to sort. That is an under-defined statistic, not a disagreement about facts, and it was
caught when the JS app and the Python analysis printed different headline numbers. Membership is
therefore decided by **value**: a member counts if their tenure is at least the 982nd-highest
present. The claim that needs no tie-breaking at all is the separation one - *no member with under
549 days of tenure is flagged* - and at a 45-day threshold the split is perfect.

**Why the hedge "almost to the member" is the honest wording, even at 100.0%.** 985 members have
tenure ≥ 549 days, and only 982 of them are flagged - three members with a boundary tenure are
*active*. So the flagged set is one valid choice of "the 982 longest-tenured", not the only one.
Under the value reading every flagged member is at or above the cut (982/982 = 100.0%); under the
sort reading it is 981/982. **The UI, the poster and this ledger all say "almost to the member"**,
which is true under both readings. Anywhere that said flatly "to the member" was stating the
strong form of a statistic whose weak form is 981 - corrected 2025-08-31.

**Caveat:** this is a generator artefact - no real gym's tenure and recency correlate at 0.9999.
The claim is *not* that MyGym's members behave this way. It is that **this file, used as labelled,
produces a specific inverted answer**, and that every entrant building the Q10 churn segment will
ship it. The 60-day censoring window is real too (0 members inactive beyond 60 days, `max_days_
inactive` = 59 in every cut), but it is the *symptom*; the rank map is the cause.

**So what:** do not build the churn model. If MyGym runs a win-back campaign off this extract, it
mails its 982 longest-standing members and leaves its newest 1,016 alone - precisely backwards.
**The remediation is a data request, not a model:** an uncensored `last_visit_date`, or a visit
log. Naming that is worth more than any segment built on the column as it stands.

---

## I-2 - Every dollar is a lookup from three labels

**Query**
```sql
select max(abs(f.final_price_monthly
               - t.list_price_monthly * m.price_factor * (1 - c.discount_rate)))
from fct_member f join dim_tier t using (tier_key)
                  join dim_model m using (model_key)
                  join dim_discount c using (discount_key);
select count(distinct final_price_monthly) prices,
       (select count(*) from (select distinct tier_key, model_key, discount_key from fct_member)) combos
from fct_member;
```

**Output**
```
final_price reconstructed from THREE LABELS ALONE, max error 3.55e-15
  membership_type   -> price   1:1   Basic 20 · Standard 30 · Premium 50 · Elite 70
  subscription_model-> factor  exact 1.00 / 0.90 / 0.75
  discount_type     -> rate    exact 0 / .05 / .10 / .15
43 distinct prices from 47 label combinations. Zero within-tier price variance.

Also deterministic:
  duration_in_gym_minutes = check_out - check_in                (max error 0)
  visit_per_week          = token count of days_per_week        (all 1,998 rows)

Where the pricing money actually goes (annualised, monthly reading A-1):
  list price                          $962,400
  lost to the PLAN-FACTOR LADDER        $84,954   (8.8% of list)   = 1.667x the discounts
     of which Early Bird (Annual) n=624 $75,750                    = 1.486x the discounts
                Quarterly         n=187  $9,204                    = 0.181x the discounts
                Monthly          n=1187      $0   (factor 1.00, by definition no leak)
  lost to all four discount types       $50,960   (5.3% of list)
     of which Student  n=385 $25,504 · Loyalty n=384 $17,385 · Promo n=389 $8,071 · None $0
  booked                              $826,486
```

**Caveat:** these are deterministic identities, not statistical relationships. `membership_type`
explains **87%** of price variance - a number that looks like a headline finding and means
nothing, because the tier *is* the price. This is the single trap of the month.

**So what:** Q5 ("what effect do discount types have on final revenue?") has an arithmetic answer -
-5%, -10%, -15%, exactly - and no analytic one. The one observation with a decision in it: the
**plan-factor ladder costs 1.67× what all four discount types cost combined** - $84,954 against
$50,960. If MyGym wants to look at price leakage, it is looking at the wrong lever; the discounts
are not where the money goes. That is an M2-shaped answer drawn from arithmetic, and it is
labelled as arithmetic.

**Correction, 2025-08-31 - the 1.67× was attributed to the wrong thing.** This paragraph and
`brief.md` both read "the **Early Bird annual factor** costs 1.67× ...". $84,954 is the **whole
ladder**, not the Early Bird rung. Split out: Early Bird (Annual) is **$75,750 = 1.486×** the
discounts, Quarterly is $9,204 = 0.181×, Monthly is $0 because its factor is 1.00. The
recommendation is unchanged in direction and the app and poster were already correct - they say
"commitment ladder" and "plan-factor leak", and the app now *derives* the ratio from the two
tagged figures rather than printing a literal. Only the two prose documents carried the wrong
noun, and a reader checking "Early Bird = $84,954" against the data would have found $75,750.

> **Query**
> ```sql
> select m.subscription_model,
>        count(*) as n,
>        sum(t.list_price_monthly * (1 - m.price_factor)) * 12 as ladder_leak_annual
> from fct_member f join dim_tier t using (tier_key) join dim_model m using (model_key)
> group by 1 order by 3 desc;
> ```
> **Output** `Early Bird (Annual) 624 → $75,750 · Quarterly 187 → $9,204 · Monthly 1,187 → $0`
> (sum $84,954, reconciles with `model_leak`). Discount leak $50,960.10.
> **Caveat** arithmetic, not inference; and annualised under the A-1 monthly reading only.
> **So what** the lever is the *annual* rung specifically: 624 members at 0.75× account for 89%
> of the ladder's cost. That is a sharper recommendation than "the ladder", not a weaker one.

---

## I-3 - The one real behavioural effect is *where*, not *who*

**Query**
```sql
select l.city, count(*) n, avg(f.duration_in_gym_minutes) dur, avg(f.visit_per_week) vis,
       avg(f.visit_per_week * f.duration_in_gym_minutes / 60.0) occupied_hours_per_week
from fct_member f join dim_location l using (location_key) group by 1 order by dur desc;
```
plus a 10,000-permutation test on η², and a drop-both-extremes refit (`integrity.py` check 7).

**Output**
```
city            n    duration   visits   occupied hrs/wk
Anaheim       188      115.1     2.88         5.60
Sacramento    226      113.7     2.59         4.84
San Francisco 201      109.0     2.65         4.85
Los Angeles   173      103.2     2.87         4.89
Fresno        265      107.7     2.61         4.70
Long Beach    223      105.0     2.58         4.48
San Jose      167       97.4     2.80         4.50
Bakersfield   189      101.2     2.54         4.38
San Diego     201       94.6     2.70         4.28
Oakland       165       96.8     2.62         4.15

duration by location   eta2 = 0.0231   omega2 = 0.0187   KW p = 8.19e-07  -- CLEARS
                       permutation p = 0.00010  (10k perms, seed 7)
drop BOTH extremes     eta2 = 0.0151   omega2 = 0.0108  KW p = 0.00145    -- FAILS
                       permutation p = 0.00130  (10k perms, seed 7)
                       eta2 attenuates 0.0231 -> 0.0151, a 34.9% drop
visit frequency by location            KW p = 0.0280   -- FAILS
occupied hours/week    eta2 = 0.0152           KW p = 5.32e-04 -- clears by a hair
```

**The significance standard, stated once and applied everywhere (added 2025-08-31).**
One threshold governs this month: the **pre-declared Bonferroni α = 0.05 / 88 = 5.68e-4**, fixed
before any test was run. Applied without exception:

| Test | p | α = 5.68e-4 | Verdict |
|---|---|---|---|
| duration × location, 10 gyms | 8.19e-07 (KW) · 1.0e-04 (perm) | clears by 3 orders | **finding** |
| occupied hours/wk × location | 5.32e-04 | clears by 7% | translation, flagged as marginal |
| **duration × location, both extremes dropped** | **1.45e-03** | **fails** | **sensitivity check** |
| access_hours × check-in time | 1.11e-03 | fails | killed |
| Student vs rest, age | 1.50e-03 (MWU) · 1.56e-03 (t) | fails | killed |
| visit_per_week × location | 2.80e-02 | fails | killed |

The row in bold is the one this ledger previously got wrong. It was published as *"robust to
dropping both extremes ... still holds"* at p=0.00145 - **a larger p-value than either of the two
claims killed for failing this exact threshold** (0.00111 and 0.00150). That is an asymmetric
standard: strict when it kills a claim, lenient when it defends one. Corrected in the direction
that costs the story something rather than the one that rescues it.

Two consequences, both taken:
1. **The refit is requalified.** It is a sensitivity check whose result is *directional*: the
   ordering of the remaining eight gyms is unchanged and the point estimate stays positive, but
   η² attenuates 34.9%, which says roughly a third of the effect lives in Anaheim and San Diego.
   It is no longer described anywhere as "robust", "holds" or "still holds".
2. **The killed claims stay killed.** Nothing here re-opens them. Symmetry could equally have been
   restored by relaxing α - refusing that is the point. The headline finding does not need the
   refit: at KW p=8.19e-07 over all ten gyms it clears by three orders of magnitude, and the
   floor-hours spread is a descriptive quantity that no p-value gates.

The one argument *for* the old wording - that a post-hoc sensitivity refit is not a member of the
88-test family and should be judged at α=0.05 - is real, and is exactly why it must not be used
here: it is available only to the claim being defended, never to the claims already killed (which
*were* family members). A standard that can only be applied in one direction is not a standard.

**Caveat:** the effect is **real and small** - both words load-bearing, which is why ω² sits beside
η². Members do *not* visit more often in Anaheim (p=0.028, fails the 5.68e-4 threshold); they stay
longer per visit. The occupied-hours framing is a derived quantity whose own test clears only
marginally, so the pre-declared metric (duration, p=8.2e-07) is the finding and floor-hours is the
translation. Anaheim and San Diego are the extremes; dropping both leaves the *ordering* intact but
takes 34.9% off η² and the result below the pre-declared threshold - see the standards table above.
The honest reading is that the effect is genuine across all ten gyms and concentrated in two of them.

**So what:** the **only** M4 answer in the file. Anaheim consumes 35% more floor-hours per member
per week than Oakland at nearly the same headcount - that is a staffing and equipment-rotation
number, not a marketing one. Every other axis in this dataset is flat; this one is not.

---

## I-4 - Access tier is the same cut as membership tier, wearing a different label

**Query**
```sql
select membership_type, access_hours, list_price_monthly, members from dim_tier;
select count(*) from (select access_hours from dim_tier group by 1 having count(*) > 1);
```

**Output**
```
Basic     $20  -> "Off-peak only"                  n=394
Standard  $30  -> "Weekdays only"                  n=593
Premium   $50  -> "All hours"                      n=812
Elite     $70  -> "All hours + Priority access"    n=199
1:1 in both directions. 0 access levels span more than one tier.
```

**Caveat:** an identity, not a correlation - nothing statistical is being claimed.

**So what:** **Q7** (do access types affect visit frequency?) and **Q1** (do membership types?) are
one question, and a dashboard offering both as separate filters is offering the same cut twice.
The star schema refuses to model the distinction: `access_hours` is an attribute of `dim_tier`, not
a dimension. What the file *cannot* say is whether the entitlement is enforced - there is no
check-in-denied event, no visit log, only a member-level average. The 3.5× price ladder's value
proposition is **untestable here**, which is a question for MyGym, not a finding about MyGym.

---

## I-5 - Nothing about a member predicts how they use the gym

**Query**
```sql
-- 88 pre-declared tests: 11 categorical axes x 8 metrics, Bonferroni alpha = 5.68e-4
-- (integrity.py check 5); plus the power calculation in check 7
```

**Output**
```
axes clearing correction on visit_per_week   : 0 of 11
axes clearing correction on tenure_days      : 0 of 11
axes clearing correction on days_since_visit : 0 of 11
best non-clearing: discount_type p=0.0022, has_drink_subscription p=0.0029

minimum detectable difference, 80% power, alpha=.05, n~500/tier:
  visit_per_week           0.22 visits/wk   =  8.2% of the mean
  duration_in_gym_minutes  7.68 min         =  7.3% of the mean
```

**Caveat:** this is a null result, and it is only worth reporting *because* the power calculation
is attached. Without it, "we found nothing" is indistinguishable from "we didn't look."

**So what:** MyGym could have seen an 8% difference in visit frequency between any two tiers and
there is none. Tier, plan, discount, gender, amenity ownership and multi-site access all fail to
predict how often a member turns up, how long they have been a member, or when they last came.
**Segmentation by what a member bought tells you nothing about what they do.** That is a finding
about the product, not a gap in the analysis - and it is the reason I-3 (location) matters: it is
the only axis left standing.

---

## I-6 - Standard tier attends group classes less, and it is one cell, not a pattern

Promoted from *Rejected* to a numbered entry on 2025-08-31 because the app renders it as a
supporting panel and quotes its p-value in prose. A figure on the page needs a ledger row.

**Query**
```sql
select membership_type, count(*) n,
       100.0 * avg(attend_group_lesson::int) pct_classes
from fct_member f join dim_tier t using (tier_key)
group by 1 order by pct_classes;
-- plus Fisher's exact, Standard vs the other three pooled (analysis/integrity.py check 7)
```

**Output**
```
Standard   40.64%   95% CI [36.7, 44.7]   n=593
Basic      53.30%   95% CI [48.2, 58.3]   n=394
Premium    54.31%   95% CI [50.8, 57.8]   n=812
Elite      55.28%   95% CI [48.1, 62.3]   n=199

Standard 40.64% vs pooled rest 54.16%   Fisher exact p = 3.88e-08   -- CLEARS 5.68e-4
```

**Caveat:** one deviant cell out of four, and the other three intervals all overlap each other.
That is the shape a generator artefact takes, not the shape a behavioural gradient takes - a real
tier effect would be monotone in price, and this is not (Basic 53.3% sits between Standard 40.6%
and Premium 54.3%). It clears the pre-declared threshold comfortably and is reported for that
reason; it is not promoted to the thesis for this one.

**So what:** if the gap is real, Standard members are paying for a class entitlement they use least
- a packaging question. Stated as a question, because a single isolated cell cannot distinguish
"Standard members behave differently" from "the generator drew this cell differently."

---

## I-7 - Q9 has no answer: weekday load is uniform and does not vary by tier

**Query**
```sql
select d.day_name, count(*) member_days,
       100.0 * count(*) / sum(count(*)) over () share_pct
from bri_member_day d group by 1 order by member_days desc;
-- plus chi-square goodness-of-fit against uniform, and day x tier independence
```

**Output**
```
Wed 807 (15.09%) · Sun 802 (15.00%) · Tue 777 · Fri 769 · Thu 743 · Sat 741 · Mon 708 (13.24%)
5,347 member-days from 1,998 members (fan-out 2.68x)

chi-square vs uniform          p = 0.127   -- no departure from flat
chi-square day x membership_type p = 0.099 -- no interaction
```

**Caveat:** the bridge fans out, so these are member-*days*, not members; never join it to a
headcount without a `distinct`. Both p-values are far above α=5.68e-4 and above an uncorrected
0.05, so this is a clean null rather than a marginal one.

**So what:** **Q9 ("which day should we staff for?") has no answer in this file.** The 1.85pp
spread between Wednesday and Monday is noise on 5,347 draws. The staffing answer the data *does*
support is I-3's - staff by *gym*, not by day.

---

## Correction - what this ledger said first, and why it changed

Recorded rather than quietly fixed, per the standing rule.

| Killed claim | Refutation (independently verified) |
|---|---|
| **"MyGym charges a 3.5× premium for entitlements it does not enforce."** | The *identity* survives (I-4); "unenforced" does not. 58.5% of Weekdays-only members list a weekend day - **less** than the 62.8% of everyone else. Off-peak members use peak hours at 21.8% vs 22.8%. Access→check-in η²=0.0081, p=0.001, which **fails** the pre-declared α=5.68e-4. Three null results. Asserting non-enforcement from them is inferring a real-world behaviour from the generator's failure to correlate two columns - **June's tautology in a new costume.** |
| **"A student discount handed to the oldest members - $17,872/yr misallocated."** | Fails its own threshold: Student-vs-rest p=0.0015 against α=5.68e-4, Cohen d=0.18. And the dollar figure is base rate: **64.5% of all members are over 25**, so an age-blind assignment already sends $16,454 there. Excess attributable to the skew is **$1,418 - 7.9% of the headline.** What *does* clear correction is the omnibus (discount_type × age, KW p=1.11e-05), a two-sided gradient - Promo skews young (28.5), Student old (32.1). Kept as one sentence, no dollar figure, not in the UI. |
| **"176 children with sauna and late-night access."** | Dead. Every amenity flag is independent of minor status: `uses_sauna` χ² **p=1.000** (minors 51.1%, adults 50.9%), group lessons p=1.000, drinks p=0.948, multi-site p=0.794. "94 of the 12-15s use the sauna" is 53.4% against a 51.0% base rate, binomial **p=0.55** - it is 0.51 × 176. The data affirmatively says no association exists. Survives only as a one-line schema note: no guardian/consent field exists and no entitlement is age-gated in the schema. Footnote, not thesis. |

**What I got wrong, in one line:** I found a bounded column and stopped at "so the question is
unanswerable." The next question - *bounded by what?* - was the whole month.

## Rejected

| Candidate | Why dropped |
|---|---|
| "Premium is 40.6% of members but 50.1% of revenue" | True, and a pure restatement of the price list: Premium costs 2.5× Basic. Rate-vs-volume looks like May's genuine finding and is a tautology here (I-2). |
| "Which tier retains best" | `max_days_inactive` is 59 in **every** tier. There is nothing to rank (I-1). |
| "Elite members visit 9% more often" | 2.87 vs 2.63 visits/wk, against an MDE of 0.22. It does not clear correction (p=0.028 for location, worse for tier), and n=199 for Elite. Noise. |
| "Geographic patterns in multi-location access" (Q8) | χ² p=0.024 by city, against α=5.68e-4. Fails. The variable is a two-band draw keyed to tier (30% Basic/Standard, 80% Premium/Elite), not a member choice. |
| "Best day of the week to staff" (Q9) | Weekday distribution is uniform (χ² p=0.127) and does not vary by tier (p=0.099). Wed 15.1% to Mon 13.2% is nothing. Recorded in full as **I-7** - it is rendered in the app, so it needs a ledger row. |
| "Tenure drives usage / upgrades" (Q6) | Spearman |ρ| < 0.04 against visits, duration, PT hours and price; all n.s. And there is no upgrade, prior-tier or transition column at all. |
| **Standard-tier group-class gap** | 40.6% [36.7, 44.7] vs Basic 53.3%, Premium 54.3%, Elite 55.3%; Fisher p=3.9e-08, clears correction comfortably. **Kept** - promoted to **I-6** on 2025-08-31 because it is rendered in the app. Supporting panel with an explicit caveat, not a thesis clause. |
| Anything counted by an ID | There is no ID column. Fourth month, fourth answer to the standing check. |

## Non-obvious checklist

Worked deliberately in G3:

- [x] **two-way interactions** - access × tier is an identity (I-4); tier × location on duration, no reversal
- [x] **Simpson's paradox** - duration by location within tier; ordering stable, no reversal
- [x] **rate vs volume mismatch** - tested and **rejected as tautological** (Premium's revenue share is its price), unlike May where it was real
- [x] **concentration** - Premium 40.6% of members / 50.1% of revenue; entirely explained by the price ladder
- [x] **distribution vs average** - duration tested against uniform *within each location*, not just pooled (the June lesson); rejects in 5 of 10
- [x] **cohorts** - join-date cohorts are the finding: they *are* the recency column (I-1)
- [x] **changepoints** - 3 years of join dates; no break in join rate, and none possible in last-visit
- [x] **funnel leakage** - the price funnel is arithmetic (I-2); the plan-factor ladder leaks 1.67× the
      discounts, and 89% of that ladder is the Early Bird rung alone ($75,750 of $84,954)
- [x] **lead / lag** - tenure vs every usage metric, all |ρ| < 0.04, all n.s.
- [x] **missingness as signal** - zero nulls; the structural absence is a **bounded range**, and asking what bounded it produced the thesis
- [x] **survivorship** - **the central finding.** Everyone in the file is a survivor by construction; the 60-day window is a censor, and it is rank-ordered by tenure
- [x] **mix vs performance decomposition** - attempted on revenue; it is the rejected tautology above
- [x] **statistical power** - MDE computed for every null (I-5), so "we found nothing" is a measurement
