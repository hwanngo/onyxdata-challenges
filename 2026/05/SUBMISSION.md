# Submission - 2026/05 Music Streaming Platform Performance

**Status:** portfolio work. The challenge closed 24 May 2026; today is 2026-05-30, six days
after the deadline. Not submitted as a live entry.

## LinkedIn post

```
Nine of this streaming service's top ten artists are there because of 482 accounts that play
the same handful of tracks over and over. And they are paying customers you cannot ban.

Four years, 224,078 plays, 961 listeners, 10 markets. Three findings:

1. THE LEAGUE TABLE DOES NOT SURVIVE. Rank the catalogue by plays, then rank it again using
   only broad-listening accounts. The two top tens overlap 1 of 10. Mariah Carey goes 1 → 264.
   Shaggy goes 10 → 1. Rank correlation across 377 artists is 0.665.

2. YOU CANNOT FIX IT BY BANNING ANYONE. These accounts are worth $161.52 against $179.17
   - a gap the data cannot resolve (95% CI: 21.4% worse to 1.7% better; MDE 16.5%)
   (p = 0.19) - indistinguishable. And it is not a coordinated farm: 87.5% of the top artist's
   repeat plays come from ONE account. The only lever is how plays are counted.

3. THE SAME FAILURE, THREE MORE TIMES, IN MONEY. The royalty qualifies at 30 seconds and 46.9%
   of plays sit in the 30-44s band - a two-second redefinition moves 15.1% of the bill. The
   column named "revenue" totals $852 against $167,647 of real subscription revenue, and it
   adds ad income to royalty cost. And 32.5% of reported MRR growth carries a back-office
   "reconciliation" label, never a customer decision.

What I did NOT find, and checked hard for: the recommendation flag does nothing (Cliff's
d = +0.0026 on 53% of the catalogue), and there is no month-of-year season - the December peak
everyone will chart is the +10.2%/month growth ramp (ω² = -0.098 after detrending).

Two traps I nearly shipped. "Variety" as distinct÷sessions is bounded by 774/n and this cohort
has 2.3× more sessions, so the effect was partly arithmetic - rarefying every listener to a
fixed 30 plays made it stronger, not weaker (d = -0.974). And an artist over-index table put
one artist at 18.4× and looked exactly like a streaming farm, until the denominator check
showed 87.5% of it was a single account.

A note on language: the source column is called is_fraud_cluster and flags 50.2% of all users,
unadjudicated. This page never repeats that word. The cohort is named for what was actually
measured - 9.4 distinct tracks per 30 plays against 22.5.

Built with Polars + DuckDB, a Malloy semantic layer, SolidJS, and a hand-built rank-slope
chart. Every figure recomputed from parquet by a second engine before publication: 45 DOM
metrics, 33 assertions against the raw CSVs, prose-number lint. axe: 0 violations across
desktop light, desktop dark, mobile and the poster - including with the tour dialog open.

@OnyxData @SmartFramesUI @DataCareerJumpstart @packt
#dataDNA
```

## Image

`exports/dashboard.png` - 2560×1440 PNG, 760 KB. Well inside the 10 MB limit.

## Submission mechanics - verified against the challenge page at G1, re-checked at G8

- Tag: **@OnyxData · @SmartFramesUI · @DataCareerJumpstart · @packt**
- Hashtag: **`#dataDNA`**
- **Single image only** - PNG, JPG or WebP, max 10 MB.
- **No ZoomCharts mini-challenge this month.** The sponsor is absent from the challenge page
  and there is no read-me in the archive. Re-checked at G8: still absent.
- Resubmissions are not permitted.

## Checklist

- [x] Poster is exactly 2560×1440 and fits with 0px slack (`tools/qa/measure.mjs`)
- [x] Every figure on it reconciles against a recomputation (45/45, both routes)
- [x] No placeholder or invented number anywhere - prose lint clean
- [x] Accessibility note printed in the poster footer
- [x] The naming disclosure is printed in the footer, and `interact.mjs` asserts the source
      column is named **once on the poster** (footer) and **twice on the live route** (footer
      plus the tour step that argues the naming decision) - both counts asserted, not one
- [x] Tag list taken from this month's page, not carried over
