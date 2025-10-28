/**
 * Guided tour - 5 steps. Keyboard-driven, dismissible, remembered.
 *
 * Every figure below is recomputed in `analysis/insights.md` with the query that produced
 * it. A tour step is a paragraph, not a DOM node, so these numbers have no `data-metric`
 * home and each carries a `prose-number-ok` naming the ledger entry that owns it - the
 * convention `tools/lint_prose_numbers.mjs` requires.
 *
 * WHAT CHANGED. Step 1 used to claim "the IDs are issued in strict date order" and "the
 * product-issue taxonomy is a genuine tree". Neither survives: 11.25% of adjacent ID pairs
 * step backwards in date, and 13 of 76 issues appear under more than one product covering
 * a fifth of the register. Step 4 used to tell the reader "the last four months are greyed"
 * when the year chart has no monthly marks and nothing was greyed - and, worse, the bar it
 * described actually POOLED those months. Both are now what the page does.
 */
import type { TourStep } from "@onyxdata/dna-kit";

export const TOUR: TourStep[] = [
  {
    h: "Two datasets, one register",
    // prose-number-ok: I2 - the three positive tests that the consumer half is real
    p: "62,516 complaints are a real register: complaint IDs advance with the calendar in all 75 month-to-month steps, Saturday and Sunday run at 0.52 and 0.37 of an average day, and 63 of 76 issues sit under exactly one product. The 1,081 companies attached to them are a uniform random overlay.",
  },
  {
    h: "The diagonal of nothing",
    // prose-number-ok: I1 - the exhaustive 78-test association grid
    p: "Chi-square against degrees of freedom for all 78 association tests among the file's twelve categorical columns - nothing selected. The line is what no association at all looks like. None of the 12 company-identifier tests clears Bonferroni; the strongest reaches only p=0.285. All 45 pairs among the substantive consumer columns clear it. Height is not effect size, so the verdict is the table's Bonferroni column, not the height.",
  },
  {
    h: "So where do you send examiners?",
    // prose-number-ok: I3 - relief concentration in five product-issue pairs
    p: "Not at companies - the file cannot rank them. Five product-issue pairs carry 65.4% of all monetary relief on 42.2% of complaints. That is a priority list with a denominator.",
  },
  {
    h: "Timeliness broke in 2021",
    // prose-number-ok: I4, I5 - the regime break, and the censoring the bar now applies
    p: "Never below 99.31% through 2020, then 89.02%. The pooled 96.06% figure hides a regime break, and 15 of the 16 product, channel and region cuts big enough to test fall with it - Mortgage is the one that does not. The 2023 bar counts January to April only: from 2023-05 the data is right-censored, and pooling those months would put the bar at 93.16% instead of 89.52%.",
  },
  {
    h: "Two clocks, one of them fake",
    // prose-number-ok: I6 - the two clocks, Kruskal epsilon-squared on the intake lag
    p: "Response time is a uniform draw from 0 to 30 days and tells you nothing - every channel sits between 14.82 and 15.52 days. The intake lag, between a consumer submitting and the complaint being received, is real: Referral is delayed on 75.6% of complaints against Web's 7.8%, Kruskal epsilon-squared 0.364. Both bars are drawn on the same rows.",
  },
];
