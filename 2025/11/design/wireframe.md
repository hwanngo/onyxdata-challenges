# Poster wireframe - 2025/11  (1920 × 1080, 16:9)

The LinkedIn submission is **a single image**. This is that image. The web page is the same
content unrolled vertically; the poster is the argument compressed to one frame.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ DATADNA · NOVEMBER 2025 · E-COMMERCE ANALYTICS            greenbar #EBF0EA, 64px margins      │
│                                                                                              │
│  THE LEDGER ONLY                    ┌─────────────── RESTATEMENT ──────────────────────┐    │
│  ROUNDS UP                          │  AS REPORTED          $31,832,281   ◌ hollow      │    │
│  ── Libre Bodoni 700, 92px          │  less sales tax       - $3,257,940                │    │
│                                     │  less refunds         -   $567,634                │    │
│  Correcting this file's revenue     │  ─────────────────────────────────                │    │
│  moves the total by 12.02%. That    │  AS RESTATED          $28,006,708   ⦁ solid       │    │
│  correction is flat on every cut    │                       ▼ 12.02%                    │    │
│  except geography.                  └──────────────────────────────────────────────────┘    │
│  ── Source Serif 4, 24px, 60ch                                                               │
│                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  THE SAME 12% CORRECTION, APPLIED TEN WAYS          ── signature, full bleed, ~440px tall     │
│                                                                                              │
│         0%          5%          10%     ▏12.02%      15%          20%                        │
│   channel                                ·⦁·                                                 │
│   payment method                        ·⦁··                                    ← six cuts   │
│   category                             ··⦁··                                      collapse   │
│   month                               ···⦁⦁··                                     onto the   │
│   segment                            ·   ·⦁·   ·                                  line       │
│   product family                    ·· ·⦁⦁⦁·· ·                                              │
│  ══════════════════════════════════════════════════════════════════════                      │
│   currency              ·                  ·    ·     ·                         ← three      │
│   region              ·                   ··          ·                           scatter    │
│   country      ·   ·        ·      ·· ·  ·   ·   ·  ··                                       │
│                US 1.65%                              France 19.34%                          │
│                                                                                              │
├───────────────────────────────────────┬──────────────────────────────────────────────────────┤
│  THE RANKING THAT FLIPS               │  THE RANKING THAT DISSOLVES                          │
│                                       │                                                      │
│   EU        ◌─────────────⦁  $13.69M  │   Reported ASP differs by country                    │
│                 ╲                     │   p = 6.9 × 10⁻²³                                    │
│                  ╳  ← crossing        │                                                      │
│                 ╱                     │   Ex-tax it does not differ at all                   │
│   N.AMERICA ◌─────────────⦁  $11.40M  │   ── p = 0.862, η² = -0.0001                         │
│                                       │                                                      │
│   reported          restated          │   100% of the country price gap is sales tax.        │
├───────────────────────────────────────┴──────────────────────────────────────────────────────┤
│  AND THE HALF THE BRIEF ASKED FOR HAS NO ANSWER                                              │
│  3,995 of 4,000 customers are repeat buyers · 48,000 events over exactly 4,000 customers,     │
│  mean exactly 12.0000 · SALE15 is 100% US, LOYALTY15 is 0% US · Black Friday codes peak in    │
│  May-August, χ² = 6.10, p = 0.867                                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  48,000 events · 4,000 customers · 101 SKUs = 70 families · Apr 2024 - Oct 2025               │
│  Every figure recomputed from parquet by an independent DuckDB path before publication.       │
│  Four claims of my own were withdrawn during analysis; all four are recorded, not deleted.    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Grid

12 columns, 64px margin, 32px gutter. Five horizontal bands:
`header 22% · signature 34% · casualties 22% · loyalty 12% · footer 10%`.

Each band is a named grid area. **Six areas, six items** - 2025/09's poster lost a panel below the
fold because `#kpi` had no area assigned, so the count is asserted in the poster test.

## Encoding rules, applied everywhere

- **as reported** → hollow mark `◌`, ochre, dashed rule
- **as restated** → solid mark `⦁`, ledger green, solid rule
- Fill carries the meaning; the pair measures only 1.89:1 in greyscale, so hue cannot.
- Every figure DM Mono, tabular, right-aligned in columns.
- No map. No donut. No fitted trend line.
