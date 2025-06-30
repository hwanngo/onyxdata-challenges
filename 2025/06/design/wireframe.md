# Wireframe - 2025/06 · Social Media Content Performance

The poster is the submission. It must read standalone as a static PNG, top-left to
bottom-right, with no ambiguity about reading order.

Canvas **2560 × 1440** (16:9). `tools/qa/measure.mjs` asserts it fits exactly.

---

## Poster - 16:9

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ONLY ONE NUMBER IN THIS FILE IS REAL                                                      │
│ Views is the only metric that was measured. Impressions, engagement and the engagement    │
│ rate are derived from it or drawn from a label - and the thing that moves views is the    │
│ format you publish, not the platform, the region or the hour.                             │
│ Onyx Data DataDNA · June 2025 · 5,600 posts · 6 platforms · 8 countries · Jan 24-May 25   │
╞══════════════════════════════════════════════════════════════════════════════════════════╡
│ THE PROVENANCE STRIP                                                                 [1]  │
│  VIEWS            4,806,275,234   ███ MEASURED                                            │
│  IMPRESSIONS      5,766,555,744   ▨▨▨ DERIVED  = views × U(1.1-1.3), r=0.998               │
│  ENGAGEMENT         646,491,442   ▨▨▨ DERIVED  = rate × views                             │
│  ENGAGEMENT RATE          15.28%  ▨▨▨ LABEL    drawn from 4 fixed bands by content tier    │
│  CLICKS              recorded on 33.2% of posts     ⚑ PARTIAL - 2 track all, LinkedIn some │
╞═══════════════════════════════════════╤══════════════════════════════════════════════════╡
│ 2 · FORMAT IS THE LEVER               │ 3 · PLACEMENT IS NOT                              │
│ median views, and share of output vs  │ median views. Six platforms, 3.7% apart.          │
│ share of attention                    │                                                   │
│                                       │  TikTok     382,281 ████████████████████          │
│ Video       913,871 ██████████████████│  X.com      377,084 ███████████████████▉          │
│   52.6% of posts → 75.8% of views     │  YouTube    375,669 ███████████████████▉          │
│ Carousel    430,378 ████████ ⚑n=51    │  LinkedIn   374,865 ███████████████████▉          │
│ Article     414,267 ████████           │  Facebook   369,247 ███████████████████▊         │
│ Text        311,374 ██████             │  Instagram  368,711 ███████████████████▊         │
│ PDF         288,737 █████    ⚑n=16    │  ─────────────────────────────────────────        │
│ Image       272,709 █████              │  8 regions span 14.3%; p=0.30, n.s.        │
│ Live Stream 263,112 █████              │  Platform explains 0.4% of view variance.        │
│   16.5% of posts → 7.3% of views      │                                                   │
│                                       ├──────────────────────────────────────────────────┤
│ ↑ Live Stream costs the most to make  │ 4 · THE HASHTAG MIRAGE                       [4]  │
│   and returns the least.              │ rank hashtags and you recover the content tier,   │
│                                       │ not hashtag effectiveness.                        │
│                                       │   hashtag adds +0.004 R² once category is known   │
│                                       │   category adds +0.047 once hashtag is known      │
│                                       │   within-category η² collapses 0.751 → 0.018      │
╞═══════════════════════════════════════╧══════════════════════════════════════════════════╡
│ SO WHAT                                                                              [5]  │
│ 1. Move production budget      2. Stop optimising the      3. Don't set strategy from the │
│    from live streams to           platform mix and the        engagement rate here - and  │
│    video.                         posting calendar.           instrument clicks on the 3  │
│                                                               platforms that lack them.   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Source · method · every figure recomputed and verified · WCAG 2.1 AA note · caveats       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Reading order** is forced by the hard rules and by scale: the thesis, then `[1]` the provenance
strip spanning full width (the argument), then the two panels that survive it, then the mirage,
then the recommendations. The strip sits above the charts deliberately - you must be told what is
real before you are shown any ranking.

**No dead space:** the two-column band is sized so the left format list (7 rows) and the right
stack (platform list + mirage) fill the same height. **No overcrowding:** four data objects total.

---

## App - desktop (≥1280px)

Same composition plus the interaction layer; the poster route is this with chrome removed.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ONLY ONE NUMBER IN THIS FILE IS REAL          [ ? tour ]  [ ☀/☾ ]  [ ⤓ poster ]           │
│ standfirst · context strip                                                                │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ACTIVE: [Video ×] [TikTok ×]                                      [ clear all ]           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ THE PROVENANCE STRIP - recomputes live under filter; the DERIVED/LABEL marks never change │
│   · click MEASURED to filter to nothing (it is the whole dataset) - the derived rows are  │
│     not clickable, and say why on hover/focus                                             │
├───────────────────────────────────────┬──────────────────────────────────────────────────┤
│ FORMAT IS THE LEVER                   │ PLACEMENT IS NOT                                  │
│  · click a format → cross-filter      │  · click a platform → cross-filter                │
│  · ↑↓ traverse, Enter drills          │  · click-coverage badge per platform              │
│    format → platform → region         │                                                   │
│  · ⚑ badges on n<100 formats          ├──────────────────────────────────────────────────┤
│                                       │ THE HASHTAG MIRAGE                                │
│                                       │  · toggle: rank hashtags ⇄ group within category  │
│                                       │    - the toggle IS the demonstration              │
├───────────────────────────────────────┴──────────────────────────────────────────────────┤
│ EXPLORE (collapsed) - R2 category×region · R4 hour & weekday · R7 video/live · R9 organic │
│   each states the verdict and the test: "no significant difference (p=0.19)"              │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ SO WHAT - 3 recommendations, each linked to the panel that supports it                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Drill path:** `format → platform → region`, breadcrumb + back at each level.
**URL state:** `?f=[{"field":"post_type","values":["Video"]}]` - any view is shareable.
**Tour:** 5 steps - thesis → provenance strip → format → placement → the mirage toggle.

**The mirage toggle is the interaction worth building.** One control flips the hashtag chart between
"ranked by engagement" (which looks like a finding) and "grouped within content category" (where the
differences vanish). The user performs the refutation themselves rather than reading about it.

---

## App - mobile (375px)

Single column. The provenance strip stays first and complete - it is the argument, not a summary.
Format list keeps all 7 rows (they are short). Platform list collapses to top 3 + "show all 6".

```
┌──────────────────────────┐
│ ONLY ONE NUMBER IN THIS  │  thesis wraps, 31px
│ FILE IS REAL             │
│ standfirst               │
├──────────────────────────┤
│ [filter chips, wrap]     │
├──────────────────────────┤
│ PROVENANCE STRIP         │  stacked rows, hatch preserved
├──────────────────────────┤
│ FORMAT IS THE LEVER      │
├──────────────────────────┤
│ PLACEMENT IS NOT         │  top 3 + show all
├──────────────────────────┤
│ THE HASHTAG MIRAGE       │  toggle stays
├──────────────────────────┤
│ SO WHAT 1 / 2 / 3        │
└──────────────────────────┘
```

Tables scroll inside their own container; the body never scrolls sideways. Touch targets ≥44px.

---

## What each panel discharges

| Panel | Insight | Requirement |
|---|---|---|
| Thesis + context | - | framing |
| `[1]` Provenance strip | **I-3, I-4** | - (it is why the rest is honest) |
| `[2]` Format is the lever | **I-1** | R1, R3 |
| `[3]` Placement is not | **I-2**, I-5 coverage badges | R1, R5 |
| `[4]` Hashtag mirage | I-3 | **R6** |
| `[5]` So what | all | - |
| Explore drawer | rejected-but-asked | R2, R4, R7, R8, R9 |

All nine requirements land. The Explore drawer exists so the brief's descriptive questions are
answered - mostly in the negative, with the test - without diluting the argument.
