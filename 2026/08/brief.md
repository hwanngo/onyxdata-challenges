# Brief - 2026/08

- **Title:** August 2026 DataDNA - African Gig-Economy and Digital Wallet Analytics
- **Challenge page:** https://datadna.onyxdata.co.uk/challenges/august-2026-datadna-african-gig-economy-and-digital-wallet-analytics-challenge/
- **Playground:** https://datadna.onyxdata.co.uk/playground/2026-08-august-2026-datadna-african-gig-economy-and-digital-wallet-analytics-challenge/
- **Dataset ZIP:** https://datadna.onyxdata.co.uk/wp-content/uploads/2026/07/DataDNA-Dataset-Challenge-2026-08-African-Gig-Economy-and-Digital-Wallet-Risk.zip
- **ZIP sha256 (re-verified at G2):** `b5901787471aec55ac2ce9ea8bae294328bcf878c1aac8b539423fdb0228c75d`
- **Era:** 2
- **Status:** challenge closed; this is portfolio/practice work, not a live competition entry

## Scenario

The public challenge describes an operational fintech dataset tracking digital-wallet transactions,
fraud exposure, disputes and gig-economy behaviour across African markets during 2023–2024.

The archive's `CHALLENGE_BRIEF.md` assigns the role directly:

> "Step into the role of a data analyst investigating african gig-economy and digital wallet risk."

It asks for an analytical report that uncovers patterns and makes actionable recommendations. The
archive metadata names the synthetic business `PayPesa`, but the public challenge page does not, so
that name is treated as a source label rather than public scenario canon.

**Decision persona:** fintech risk and operations leadership deciding where fraud controls,
investigation capacity and operational-improvement resources should be prioritised. This persona is
an explicit analytical framing; neither source names a specific executive recipient.

**Decision supported:** which channel × market × worker/account × transaction combinations merit
control changes, and which apparent risk differences are too small or too weakly supported to act on.

## Stated objective

> "Uncover the key drivers of fraud and operational risk, identify customer segments and channels
> most vulnerable to financial losses, evaluate transaction behaviour across markets, and highlight
> where fintech providers should prioritise fraud prevention, operational improvements, and risk
> mitigation to build a safer, more resilient digital payments ecosystem through data-driven
> decision-making."

## Explicit requirements

The page and archive contain four separate requirement sets. Every item below becomes a G7 checklist;
unsupported questions must be labelled unsupported rather than silently omitted.

### A. Challenge page — Operational & Analytical Challenges (12)

- [ ] Reconcile fragmented visibility across customers, transactions, channels, merchants and regions.
- [ ] Compare payment-channel fraud, especially USSD against app transactions.
- [ ] Identify geographic fraud hotspots.
- [ ] Test whether newly onboarded accounts carry elevated early-lifecycle risk.
- [ ] Compare dispute rates across gig-worker segments.
- [ ] Detect temporal patterns and anomalies in cash-out, reversals and fraud.
- [ ] Connect transaction value, fee revenue, fraud loss and reversals across types and channels.
- [ ] Test whether high transaction volume masks fraud, failures or revenue leakage.
- [ ] Relate customer behaviour and transaction velocity to fraud indicators and outcomes.
- [ ] Examine country × channel × customer segment × transaction type combinations.
- [ ] Compare fraud, transaction behaviour and wallet usage across regions.
- [ ] Link transaction behaviour to risk, efficiency and business performance.

**Source-support warning:** the archive documents no merchant dimension and no fee-revenue field.
G2 must determine whether those two page requirements are unsupported; no proxy will be invented.

### B. Archive `CHALLENGE_BRIEF.md` — six supplied claims to test

These are **hypotheses, not accepted facts**:

- [ ] USSD has 2.3× the fraud rate of the app channel.
- [ ] Nigeria and Kenya account for 70% of fraud volume.
- [ ] Accounts under 90 days have 3× the fraud rate of older accounts.
- [ ] Market traders have the highest dispute rate among gig segments.
- [ ] High velocity score correlates with fraud and reversal.
- [ ] Cash-out and reversal rates spike at month end.

Every test must state the measure, denominator, sample size, uncertainty and caveat. “Fraud volume”
is ambiguous between event count, flagged transaction value and fraud-loss value; G2 must test and
name each defensible interpretation rather than choose one silently.

### C. Archive guiding questions (16)

**Temporal**

- [ ] How do key metrics change over time?
- [ ] Are there seasonal or cyclical patterns?
- [ ] When do peaks and valleys occur, and why?
- [ ] What events or conditions are associated with significant changes?

**Entity**

- [ ] Which entities drive the most activity?
- [ ] How do segments perform relative to one another?
- [ ] What characteristics distinguish higher- and lower-performing entities?
- [ ] Are there geographic or categorical hotspots?

**Transaction**

- [ ] What are the most common transaction types and volumes?
- [ ] How are transactions distributed across dimensions?
- [ ] What correlations exist among metrics?
- [ ] Are there anomalies or unexpected patterns?

**Cross-dimensional**

- [ ] How do dimensions interact to affect outcomes?
- [ ] Which attribute combinations are most and least common?
- [ ] Do particular entity pairs have stronger relationships?
- [ ] What useful relationships or associations remain after controlling for base rates?

### D. Archive deliverables (3)

- [ ] **Executive summary:** plain-language findings and recommendations.
- [ ] **Detailed analysis:** visualisations, statistical summaries and answers to the guiding questions.
- [ ] **Actionable insights:** why findings matter, next actions and areas for deeper investigation.

## Source-integrity posture

The archive is machine-generated and includes `DATA_DICTIONARY.md`, schema JSON, a validation report
and a generated EDA. Preflight inspection found that documented key types, row estimates, numeric
ranges and category lists do not consistently match the CSVs. The page also asks for entities and
metrics absent from the documented schema.

Therefore:

- source documentation is evidence to audit, not a contract to trust;
- all six supplied patterns remain hypotheses;
- actual CSV grain, domains, scales and relationships must be established at G2;
- no business interpretation may use a field until its semantics and denominator are defensible.

## Submission mechanics (THIS month)

The page's visible Step 2 list, prefilled share text and FAQ contradict one another. Required union:

- Tags: `@OnyxData` · `@SmartFramesUI` · `@DataCareerJumpstart` · `@packt`
- Hashtag: `#dataDNA`
- One LinkedIn post with a **single dashboard/visualisation image**
- Screenshot format: PNG, JPG or WebP; maximum 10 MB
- One entry only; resubmissions prohibited
- Any BI or visualisation tool permitted
- Optional Power BI `.pbix` upload up to 50 MB or report link
- Sponsors shown: Packt · Data Career Jumpstart · Smart Frames UI
- Prize pool stated: two Packt eBooks plus Data Analytics Interview Software valued at $500
- **No sponsor mini-challenge** appears on the page or in the archive
- No current webinar was listed

This work began after the deadline and will not claim to be a live submission.

## Timeline

| | Date |
|---|---|
| Challenge begins | 01 August 2026 |
| Deadline for entries | 24 August 2026 |
| Entry review and winner selection | 25–30 August 2026 |
| Winners announced and notified | 31 August 2026 |

## Benchmark

The public portfolio gallery showed nine August entries at G1. No sampled detail page exposed the
four AI-review dimensions. Each sampled card carried `data-score="0"`; the visible adjacent numbers
are likes and views, not scores. A score-ranked benchmark is therefore unavailable without private
account data, so the comparison below is qualitative and does **not** label entries high- or
low-scoring.

| Entry | Public AI score | Tool | Useful pattern | Visible limitation |
|---|---|---|---|---|
| [Ugo Nwasuruba — African Gig Economy & Digital Wallet Risk Analysis](https://datadna.onyxdata.co.uk/portfolios/african-gig-economy-digital-wallet-risk-analysis/) | Not published (`data-score=0`) | Power BI report | Overview → Drivers → Recommendations; drill and vulnerability framing | Dense small text; tiny rate gaps shown without uncertainty or materiality |
| [Brian Sule — African Gig Economy and Digital Wallet Risk Report](https://datadna.onyxdata.co.uk/portfolios/african-gig-economy-and-digital-wallet-risk-report/) | Not published | Power BI | Executive risk structure and consistent identity | Composite vulnerability index has no public weighting rationale |
| [Kolawole Olajide — African gig economy and-digital wallet-analytics](https://datadna.onyxdata.co.uk/portfolios/african-gig-economy-and-digital-wallet-analytics-3/) | Not published (`data-score=0`) | Not listed | Role-based pages, persistent filters and cross-dimensional matrices | Many equal-weight visuals; public entry states no findings or actions |
| [Owais Khan — African Gig Economy & Digital Wallet Risk Analysis](https://datadna.onyxdata.co.uk/portfolios/african-gig-economy-digital-wallet-risk-analysis-2/) | Not published (`data-score=0`) | Power BI (author description) | Compact operational overview and market/year filters | KPI overload, raw decimals, non-chronological month labels, no visible thesis |
| [Olatokunbo Awoyade — African Digital Wallet Ecosystem Dashboard](https://datadna.onyxdata.co.uk/portfolios/african-digital-wallet-ecosystem-dashboard/) | Not published (`data-score=0`) | Power BI (author description) | Separate executive, fraud, operations and worker views | Dense poster with small text; mostly descriptive totals and rankings |

**What the stronger sampled designs did:** separated executive overview from drivers and actions;
kept filters persistent; provided a real drill path; used consistent page-level structure; wrote some
insight callouts rather than leaving every chart unexplained.

**Recurring field gaps:** descriptive KPI grids; supplied risk framing repeated rather than tested;
small poster text; unexplained composite scores; no intervals or practical-significance thresholds;
tiny differences around a roughly 50% base rate treated as meaningful; chronological or sorting
errors; weak provenance and no public evidence trail.

**How this month will differentiate:** one evidence-led thesis; all six supplied claims tested;
denominators, effect sizes and uncertainty published; unsupported questions named; one useful drill
and true cross-filtering; an independently legible 2560×1440 poster; every statistic recomputed.

## Lessons applied from `.workbench/docs/LEARNINGS.md`

1. **Test every source promise.** Earlier archives repeatedly misdescribed their files. August's six
   claims and every dictionary definition remain hypotheses until verified against the CSVs.
2. **A unique ID is not the analytical grain.** Establish transaction grain and worker-level
   clustering, and apply filters only to views that carry the filtered field; a visible chip is not
   proof the target chart remains valid.
3. **Counter ratio theatre and null-story bias.** Check denominators and base rates before treating a
   large figure or small rate gap as an effect; attach intervals and positive controls to nulls; seek
   affirmative structure before settling on another measured-absence narrative.

## G1 decision

Proceed to G2 with an evidence-first fraud-control brief, not a confirmation exercise. The thesis is
intentionally unset. G2 must establish what the files actually encode before this dashboard chooses a
story.
