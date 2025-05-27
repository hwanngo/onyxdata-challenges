# Wireframe - 2025/05 · Mobile Phone Sales

The poster is the submission. It must read standalone as a static PNG, top-left to bottom-right,
with no ambiguity about reading order.

Canvas **2560 × 1440** (16:9), exported at 2× from a 1280 × 720 CSS layout.

---

## Poster - 16:9

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  THE MONEY IS AT THE TOP OF THE LADDER                                          [Δ] 112px  │
│  A quarter of the phones sold produce two-fifths of the revenue - and the market that       │
│  looks cheapest is not being charged less, it is buying lower down.                   25px  │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Onyx Data DataDNA · May 2025 · 366 trading days of 2024 · 4 countries · 19 models · n=366  │
├──────────────────────────────────┬─────────────────────────────────────────────────────────┤
│  THE PRICE LADDER          [1]   │  $14.53M      18,548      $783        366          [2]  │
│  every model at its true price,  │  revenue      units       ASP         trading days       │
│  bar length = revenue            │  ▔▔▔▔▔▔▔      ▔▔▔▔▔▔      ▔▔▔▔▔       ▔▔▔▔▔▔▔▔▔▔▔        │
│                                  │  40% from     uniform     unit-       one row per        │
│  $1,844 ▐███████████████ Z Fold 6│  top quarter  1-99/day    weighted    day of 2024        │
│         └ one model, 11.6% ──┐   ├─────────────────────────────────────────────────────────┤
│  $1,249 ▐██████████ S25 Ultra│   │  WHO TURNS VOLUME INTO MONEY                       [3]  │
│  $1,143 ▐████████ 15 Pro   ╔═╪═╗ │  revenue share minus unit share, percentage points       │
│  $1,054 ▐███████ 14 Pro    ║ │ ║ │            -8    -4     0    +4    +8                    │
│  $1,048 ▐███████ Pixel 9Pro║25%║ │  Samsung          │  ███████████ +6.46  ▲ 4th→2nd        │
│  ─────────────────────────  ║of ║ │  Apple            │  ████ +2.30         ▲ 2nd→1st        │
│  $  855 ▐█████ iPhone 15   ║un ║ │  Google           │  █ +0.59                              │
│  $  846 ▐█████ 12 Pro      ║its║ │  OnePlus   █████  │  -2.85              ▼ 1st→3rd        │
│  $  843 ▐████ iPhone 14    ║   ║ │  Xiaomi ████████  │  -6.50              ▼ 3rd→5th        │
│  $  835 ▐████ 14 Ultra     ║40%║ │                                                          │
│  $  752 ▐████ Pixel 9      ║of ║ │  ↑ the brand selling the MOST phones earns the 3rd-most  │
│  ─────────────────────────  ║rev║ │    money. The 3rd-biggest seller earns the least.        │
│  $  666 ▐███ OnePlus 11R   ╚═╪═╝ ├─────────────────────────────────────────────────────────┤
│  $  555 ▐██ Nord 4           │   │  SAME PHONE, SAME PRICE - DIFFERENT RUNG           [4]  │
│  $  528 ▐██ Pixel 8a             │   country   premium mix        ASP    like-for-like      │
│  $  527 ▐██ Mi 13T Pro           │   India     ███████ 30.1%     $809    Z Fold 6 $1,844    │
│  ─────────────────────────       │   Turkey    █████ 21.6%       $788    Z Fold 6 $1,840    │
│  $  452 ▐█ iPhone SE             │   Bangladesh ████ 19.3%       $700    Z Fold 6 $1,852    │
│  $  447 ▐█ Galaxy A55            │   Pakistan  ███ 15.9%  ⚑n=10  $690    -                  │
│  $  367 ▐█ Poco X6 Pro           │   ↑ prices are flat across markets. The ASP gap is 95%   │
│  $  347 ▐█ Galaxy M15            │     mix, 5% pricing.            ⚑ = thin sample, n<10     │
│  $  327 ▐█ Redmi Note 13         │                                                          │
├──────────────────────────────────┴─────────────────────────────────────────────────────────┤
│  SO WHAT                                                                              [5]  │
│  1. Winning units ≠ winning money.          2. Flagship supply is the        3. Move mkts  │
│     OnePlus does lead volume (p=0.002)         biggest single revenue           up the      │
│     but earns 3rd-most. Below 1st the          risk: one model = 11.6%          ladder, do  │
│     race can't be scored at all.               of revenue from 5.7% of days.    not discount│
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Every figure recomputed from source at query time · 34 metric tests · WCAG 2.1 AA:         │
│  keyboard-operable charts, screen-reader data tables, no colour-only encoding · Malloy+DuckDB│
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Reading order** is forced by scale: the 112px thesis, then `[1]` the ladder (largest object on the
canvas, left column, full height), then `[2]`→`[3]`→`[4]` descending the right column, then `[5]`
the recommendations spanning full width. No panel competes with the ladder for attention.

**No dead space:** the ladder's own vertical extent sets the poster height; the right column's four
panels are sized to fill it exactly. **No overcrowding:** 19 rungs is the densest element and each
gets 34px of vertical rhythm at poster scale.

---

## App - desktop (≥1280px)

Same composition, plus the interaction layer. The poster route is this view with chrome removed.

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ THE MONEY IS AT THE TOP OF THE LADDER              [ ? tour ]  [ ☀/☾ ]  [ ⤓ poster ]        │
│ subtitle · context strip                                                                    │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ ACTIVE: [Samsung ×] [India ×] [Premium $1000+ ×]                        [ clear all ]       │
│         ▲ chip bar - appears only when a filter is set; aria-live announces changes         │
├──────────────────────────────────┬─────────────────────────────────────────────────────────┤
│ THE PRICE LADDER                 │ KPI ×4  (recompute live under filter, with Δ vs all)     │
│  · click a rung  → filter model  ├─────────────────────────────────────────────────────────┤
│  · click a band  → filter band   │ WHO TURNS VOLUME INTO MONEY                              │
│  · ↑↓ traverse, Enter drill      │  · click a brand → cross-filter everything               │
│  · Esc clears                    │  · drill: brand → model → city  (breadcrumb above)       │
│                                  ├─────────────────────────────────────────────────────────┤
│  hidden <table> mirrors every    │ SAME PHONE, SAME PRICE - DIFFERENT RUNG                  │
│  rung for screen readers         │  · click a country → cross-filter; ⚑ badge on thin cells │
│                                  ├─────────────────────────────────────────────────────────┤
│                                  │ EXPLORE (secondary, collapsed by default)                │
│                                  │  channel · payment · age · colour · storage · month      │
│                                  │  ▲ discharges R2/R3/R4/R8/R9; labelled "no significant   │
│                                  │    difference" where the ledger says so                  │
├──────────────────────────────────┴─────────────────────────────────────────────────────────┤
│ SO WHAT - 3 recommendations, each linking back to the chart that supports it                │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Drill path:** `brand → model → city`, with breadcrumb `All ▸ Samsung ▸ Z Fold 6` and a back
affordance at each level. **URL state:** `?brand=Samsung&country=India&band=premium&drill=model`
so any view is shareable. **Tour:** 5 steps - thesis → ladder → conversion gap → mix panel →
try clicking; dismissible, re-openable from `?`.

---

## App - mobile (375px)

Single column. The ladder stays the hero but truncates to the **top 8 rungs** with
"show all 19" - the concentration story is in the top rungs, so the truncation preserves the
argument rather than damaging it.

```
┌──────────────────────────┐
│ THE MONEY IS AT THE TOP   │  thesis wraps to 3 lines, 31px
│ OF THE LADDER             │
│ subtitle                  │
├──────────────────────────┤
│ [filter chips, wrap]      │
├──────────────────────────┤
│ KPI 2×2 grid              │
├──────────────────────────┤
│ THE PRICE LADDER          │  top 8 rungs + [show all 19]
│ $1,844 ▐███████ Z Fold 6  │
│ ...                       │
├──────────────────────────┤
│ WHO TURNS VOLUME → MONEY  │  diverging bars, labels inline
├──────────────────────────┤
│ SAME PHONE, SAME PRICE    │  table becomes stacked rows
├──────────────────────────┤
│ SO WHAT  1 / 2 / 3        │  stacked
└──────────────────────────┘
```

Charts reflow rather than scroll horizontally; the page body never scrolls sideways. Touch targets
≥44px - rung hit areas are padded well beyond the 34px bar height. Text resizes to 200% without
loss of function (the ladder's labels wrap; bars shrink).

---

## What each panel discharges

| Panel | Insight | Brief requirement |
|---|---|---|
| Thesis + context strip | - | framing |
| `[1]` Price Ladder | I-3, I-5 | R1, R2 |
| `[2]` KPI strip | I-1 (units are noise) | - |
| `[3]` Conversion gap | **I-1, I-2** | R1 |
| `[4]` Market mix | **I-4** | R5, R6 |
| `[5]` So what | all | - |
| Explore drawer | minor / rejected-but-asked | R2, R3, R4, R8, R9 |

Every one of R1-R9 lands somewhere; the Explore drawer exists precisely so the brief's descriptive
questions are answered without letting them dilute the argument.

---

## Amended 2025-05-27

Panel [5] and the mix footnote above were redrawn to match the shipped copy after the portfolio
audit. Two claims in the original wireframe did not survive re-derivation:

- *"Units are a uniform random draw (KS p=0.45); all five brand CIs overlap"* - the KS test is on the
  pooled marginal and cannot speak to between-brand differences, and the binomial CIs were the wrong
  interval for a ratio of sums. A 20,000-draw permutation null separates OnePlus (p=0.002) and no
  one else. See `analysis/insights.md` I-1.
- *"The ASP gap is 100% mix, 0% pricing"* - decomposed at model level against the global unit-weighted
  ASP of $783.13, the India-Turkey gap is 4.8% price and 95.2% mix plus interaction. Dominant, not
  total. See `analysis/insights.md` I-4.
