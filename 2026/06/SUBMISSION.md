# Submission - 2026/06 UK Fintech Neobank (Zephyr Bank)

**Status:** portfolio work. The challenge closed 24 June 2026; today is 2026-06-27, three days
after the deadline. Not submitted as a live entry.

## LinkedIn post

```
Zephyr Bank's H1 review pack says 1,500 transactions, a 20% fraud rate and a 35% decline rate.

The file contains 20 facts.

Every customer has exactly 75 rows, and four columns never vary within a customer:
transaction_status, is_flagged_fraud, failed_reason, and device_type - which is literally
customer_id mod 4 (1→iOS, 2→N/A, 3→Android, 0→Web, five customers each, no exceptions).

So every rate in the pack is a fraction of twenty wearing a denominator of fifteen hundred.
With perfect clustering the design effect equals the cluster size, 75, so standard errors are
8.66× wider than reported:

  "20% fraud rate, ±2.0pp"   →   4 of 20 customers, [5.7%, 43.7%]
  "35% decline rate, ±2.4pp" →   7 of 20 customers, [15.4%, 59.2%]
  "15% completion rate"      →   3 of 20 customers, [3.2%, 37.9%]

Three of the brief's named questions turn out to be unanswerable rather than merely
unanswered. Which device fails most? It's a row number. Do non-KYC customers show more fraud?
All four have zero flags - the opposite direction, Fisher p = 0.54, and nothing was learned.
Which regions concentrate fraud? Five of the ten hold exactly one customer.

But one thing IS measured per transaction, and it's broken: the fee.

725 of 1,500 rows deviate from the documented fee. Gross under-collection £587.11, gross
over-collection £587.28 - so the net variance report shows -£0.17, a clean bill, while
£1,174.39 of fees sit on the wrong side of the rule. Transfer-International collects £100.39
of £500 due; eight types whose typical fee is £0.00 collect £524.40 between them.

It varies WITHIN a customer (as does the FX rule), so it isn't pinned to n=20 like the rates
are. It isn't free of the clustering either - ICC 0.65, design effect 49.2, effective n 30.5 -
but that is the largest effective sample in the file. And it's why a net-variance control can't
see it. Monitor gross absolute deviation.

A note on method: this analysis caught itself in its own trap. Grouping by type_name merges
the two ATM Withdrawal ids - one domestic at £0.00, one international at £1.50 - and produced
a failure rate of 0.625 that belongs to neither. Keyed on the id there are only two values.

Built with Polars + DuckDB, a Malloy semantic layer, SolidJS, and a hand-built unit chart that
draws every one of the 1,500 marks. The interaction harness counts them, and computes the
distinct fill within each of the 20 columns to assert the maximum is 1 - under two different
orderings. axe: 0 violations across desktop light, desktop dark, mobile and the poster,
including with the tour dialog open.

@OnyxData @SmartFramesUI @DataCareerJumpstart
#dataDNA
```

## Image

`exports/dashboard.png` - 2560×1440 PNG, 386 KB. Well inside the 10 MB limit.

## Submission mechanics - verified against the challenge page at G1, re-checked at G8

- Tag: **@OnyxData · @SmartFramesUI · @DataCareerJumpstart**
- **`@packt` is NOT on this month's list.** It was on 2026/05's. Checked against the page, not
  carried over.
- Hashtag: **`#dataDNA`**
- **Single image only.**
- **No ZoomCharts mini-challenge** - absent from the page and no read-me in the archive.
  Re-checked at G8: still absent.

## Checklist

- [x] Poster is exactly 2560×1440 and fits with 0px slack
- [x] Every figure reconciles against a recomputation (19/19, both routes)
- [x] No placeholder or invented number - prose lint clean
- [x] Accessibility note printed in the poster footer
- [x] Both omissions (no map, no trend line) printed with their reasons, and asserted by
      `interact.mjs`
- [x] Tag list taken from this month's page
