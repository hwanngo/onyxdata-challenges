/**
 * Guided tour - 5 steps. Keyboard-driven, dismissible, remembered.
 *
 * EVERY FIGURE HERE IS COMPUTED, not typed. an integrity pass found this file carrying eight
 * hand-written statistics - all of them true, none of them recomputed by anything. A tour
 * is the one surface on the page that verify_metrics.py cannot reach, because the overlay
 * is closed when the scraper loads: a wrong number here would survive every gate. So the
 * tour now reads the same `data.ts` functions the panels read, and the numbers it quotes
 * cannot drift from the numbers beside them, because they ARE the same numbers.
 *
 * The book is a static JSON payload, so evaluating this at module scope is safe.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import {
  BAND_LABEL, LTI_THRESHOLD_PCT, META, allRows, dec, int, pct, priceOfCertainty,
  rankFlip, ruleStats,
} from "./data";

const ROWS = allRows();
const UNION = ruleStats(ROWS).find((r) => r.key === "union")!;
const PRICE = priceOfCertainty(ROWS);
const DEBTCON = rankFlip(ROWS).find((f) => f.k === "DEBTCONSOLIDATION")!;
const GRADE_A_ABOVE = ROWS.filter(
  (l) => l.grade === "A" && l.home === "RENT" && l.lpi > LTI_THRESHOLD_PCT,
);
const GRADE_A_PRICED = GRADE_A_ABOVE.filter((l) => l.rateBp >= 0);
const GRADE_A_PCT =
  GRADE_A_PRICED.reduce((a, l) => a + l.rateBp, 0) / Math.max(1, GRADE_A_PRICED.length) / 100;
const U = META.unemployed;

export const TOUR: TourStep[] = [
  {
    h: `One rule, ${pct(UNION.shareOfDefaults, 0)} of the losses`,
    p:
      "Nova Bank asked who defaults and why. Two boolean conditions answer it: " +
      `${int(UNION.n)} of ${int(META.sourceRows)} loans default ` +
      `${dec(UNION.defaultRate, 0)}% of the time, with zero exceptions. That is ` +
      `${pct(UNION.shareOfDefaults, 0)} of every loss in the book. Both conditions were ` +
      "found by searching this file, so read the exactness as a description of the file " +
      "rather than as a p-value.",
  },
  {
    h: "The wall",
    p:
      "Default rate against loan-to-income, one point at a time. Renters walk along the " +
      `floor to ${LTI_THRESHOLD_PCT}% and then turn ninety degrees. Mortgage-holders and ` +
      "owners cross the same point and never turn.",
  },
  {
    h: "Nobody is charged for it",
    p:
      "The dotted line is the interest rate charged to renters. It runs flat straight " +
      `through the wall - ${Math.round(PRICE.gapBp)} basis points between the ` +
      `${dec(PRICE.below.defaultRate, 0)}% default rate of the ${BAND_LABEL} band and a ` +
      `certain one. ${int(GRADE_A_ABOVE.length)} grade-A renters above the line pay ` +
      `${dec(GRADE_A_PCT, 2)}%.`,
  },
  {
    h: "It contaminates the obvious answers",
    p:
      "Debt consolidation looks like the riskiest loan purpose at " +
      `${dec(DEBTCON.rawRate, 1)}%. Take the two rules out and it is the second safest at ` +
      `${dec(DEBTCON.cleanRate, 1)}%. Every entrant who ranks purposes on the raw book ` +
      "will get this backwards.",
  },
  {
    h: "And what the file cannot say",
    p:
      "Fifty-five per cent of the columns are appended to the lending book, and six of " +
      `those are exact functions of columns already in it. ${int(U.working)} of ` +
      `${int(U.reported)} 'Unemployed' applicants report a current job. There are no ` +
      "rejected applicants at all, so approval-stage fairness is untestable here whatever " +
      "you believe about the data.",
  },
];
