# Design direction - 2026/10 Sunrise Coffee: Same cup, different rent

`ui-ux-pro-max` invoked at G5 (`--design-system`, density 8, variance 6, motion 3, plus a typography
search). Its output is recorded below and then deliberately overruled where it was generic.

## What the skill proposed, and why most of it was rejected

| Skill output | Verdict | Why |
|---|---|---|
| Style: Data-Dense Dashboard | **Kept** | Correct for a 2560×1440 poster carrying five evidence panels |
| Primary #1E40AF / secondary #3B82F6 / amber #D97706 on #F8FAFC | **Rejected** | The default BI blue. It is what any dashboard gets; it encodes nothing about coffee or about this thesis |
| Fira Code + Fira Sans | **Rejected** | Generic "analytics" pairing; a monospace display face fights a one-line editorial thesis |
| Pattern: Enterprise Gateway (hero video, logo carousel) | **Rejected** | A landing-page pattern, wrong product type |
| Hover tooltips, row highlighting, subtle motion, reduced-motion | **Kept** | Matches the a11y and interaction rubric |

## Colour - two channels, because the thesis has two quantities

The thesis says revenue is noise and cost is signal. **Colour carries that split.** Revenue is drawn in a
deliberately quiet neutral; fixed cost is the only saturated hue on the page.

| Token | Name | Light | Dark | Job (one job only) |
|---|---|---|---|---|
| `--bg` | Oat milk | `#F2F4F1` | `#15120F` | page; a cool green-grey, explicitly *not* cream |
| `--surface` | Steamed | `#FFFFFF` | `#1F1B17` | panels |
| `--ink` | Espresso | `#1E1915` | `#EEE9E4` | text, **net profit** fill |
| `--ink-muted` | Grounds | `#5B534C` | `#B4ABA2` | secondary text |
| `--revenue` | Crema grey | `#958B80` (G7: was #A39A90, 2.5:1 on bg) | `#7D756D` | revenue / the cup rim: the quantity that does not discriminate |
| `--cost` | Lease blue | `#1F5E8C` | `#6FA8D6` | rent + staffing: the quantity that does |
| `--cogs` | Bean | `#CFC6BB` | `#4A423B` | cost of goods (constant ~38%, de-emphasised)  Fill is decorative: every block carries a 1px `--revenue-ink` outline (G7, WCAG 1.4.11) |
| `--loyalty` | Crema amber | `#B86E0A` | `#E9A845` | loyalty redemption and loyalty panel only |
| `--loss` | Cherry | `#A3243B` | `#F07C8E` | below-zero profit; never used for anything else |

Colour is never the only channel: loss is also below the zero line and carries a "−" label; the cost
layer is also a hatched pattern in forced-colours / greyscale; every series is directly labelled.
Contrast ratios are measured in G7 (`tools/audit_contrast.py`), not asserted here.

## Type

| Role | Face | Why |
|---|---|---|
| Display | **Bricolage Grotesque** 700/800, optical size on | Warm, slightly irregular grotesque - café chalkboard energy without the serif cliché. Not used in any previous month |
| Body | **Instrument Sans** 400/500/600 | Compact, neutral, excellent at 15-18px on the poster |
| Figures | **Instrument Sans** 500, `tnum` | Column-true figures. Red Hat Mono was tried and dropped at G6: its slashed zero read as Ø on the poster |

Scale (poster, px): thesis 92 / panel title 30 / finding line 22 / body 17 / axis + footnote 15 minimum.
Live page: 1.0rem base, nothing below 0.8125rem (13px).

## Layout concept

16:9 wants panels **across**, not stacked (LEARNINGS 2026/07). Four bands:

1. **Masthead** (~190px): thesis line left; five KPI tiles right (revenue, net profit, estate margin,
   redemption cost, promises that hold).
2. **Hero, full width** (~560px): *Sixty Cups* (below).
3. **Evidence row**, four equal panels (~470px): Region cost map · Revenue forgets, cost remembers ·
   Loyalty buys share · The week the rota ignores.
4. **Decision rail** (~150px): four CCO decisions with the evidence chip each rests on, the source-contract
   chip and the methods/accessibility footer.

## Signature element - *Sixty Cups*

Every store is one column; the 60 columns are sorted by fixed cost. Each column is a cup of average
monthly revenue, filled from the bottom with what it costs: **bean** (COGS), **lease blue** (rent +
staffing), a thin **amber** line (loyalty redemption). What remains at the top in **espresso** is
net profit; a store whose costs exceed revenue overflows the rim in **cherry**.

Read left to right, the rims stay level (revenue is the same cup everywhere) while the blue rises and
the espresso drains away. One chart carries the thesis: the eye sees that profit falls because cost
rises, not because the cup shrinks. A bracket marks the median split: lower-cost half 24.16% margin,
higher-cost half 13.51%, on the same revenue. R² for cost vs revenue is set beside it.

Interaction: each cup is a focusable button (arrow keys move between cups); click drills into the store
(24-month strip + breadcrumb Region › Store); hovering a region in the cost map highlights its cups.

## Critique against a generic baseline

| Generic version | What changed |
|---|---|
| KPI row of revenue, profit, margin, stores, AOV | KPIs keep revenue and profit but add *redemption cost* and *promises that hold*: the two numbers the thesis needs |
| Region bar chart of profit | Region rows show revenue as a grey dot **with its 95% interval** next to a blue fixed-cost bar - the overlap of the grey intervals is the finding |
| Line chart of monthly revenue "trend" | Dropped: there is no trend. Replaced by the 2023-vs-2024 twin scatter that shows revenue forgets and profit remembers |
| Donut of member vs non-member spend | Dropped: member share is a restatement of adoption. Replaced by adoption against share (a line) and against revenue (flat) with the break-even bar |
| Day-of-week bar chart | Kept, but paired with staff hours on the same axis so the gap *is* the chart |
| Store table with status pills from the supplied label | Status is re-derived; the supplied label appears only in the audit drawer with the 600-row mismatch |
| Decorative coffee photography (every benchmarked entry) | None. The cups are data |

Checked against the banned defaults: no cream `#F4F1EA`, no serif display, no terracotta; no near-black
with acid green; no broadsheet hairline grid (panels are separated by surface tone, not rules).
