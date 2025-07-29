/** This month's tour content. The overlay lives in @onyxdata/dna-kit. */
import type { TourStep } from "@onyxdata/dna-kit";

export const TOUR_KEY = "datadna-2025-07-tour-seen";

/**
 * Tour copy quotes whole-study figures throughout - the tour runs before the reader has
 * filtered anything, and every number in it is the unfiltered value, said so in the text.
 * The panels themselves recompute; this narration does not.
 */
// prose-number-ok: I-1 / I-3 / I-4 - analysis/insights.md carries the query, output, caveat
// and so-what for each figure quoted below. Whole-study values on all 120 customers:
// MDD 1.5476 points at n=60 per group; R4 difference +0.0134 with a 95% interval of
// -1.077 to +1.104; n=144 per group to detect a one-point effect at 80% power.
export const TOUR_STEPS: TourStep[] = [
  { h: "This survey cannot answer its own questions",
    p: "OmniRetail asked nine questions about what drives satisfaction. This report answers all nine - and the answer to every one is the same. About 90 seconds." },
  { h: "1 - The uncertainty ladder",
    p: "Every group in the study on one satisfaction axis. The dot is the estimate; the bar is its 95% confidence interval. On the six axes drawn by default every bar overlaps every other one - the caption counts the pairs, so it stays true when you filter. The second button adds a seventh axis, the ten satisfaction factors, which is the one exception." },
  { h: "The detection floor",
    // prose-number-ok: I-4 / I-7 - analysis/insights.md. MDD = 1.5476 points at n=60 per
    // group from the observed sd of 3.0255. The widest gap between two levels of one axis is
    // Loyalty (Low 5.844 - Medium 4.474 = 1.3708), which is what the floor claim is scoped to;
    // the widest gap across DIFFERENT axes is 1.8835 (State: IL 6.357 vs Loyalty: Medium
    // 4.474) and exceeds the floor, so the claim deliberately does not cover it.
    p: "Turn on the shaded band. Across all 120 customers it shows the ±1.55 points this study could not have detected. Every difference between two levels of the same axis sits inside it - the widest is 1.37, on loyalty." },
  { h: "2 - The headline question",
    // prose-number-ok: I-3 - analysis/insights.md. R4 across all 120: means 5.3571 (n=56,
    // contacted) vs 5.3438 (n=64), difference +0.0134, Cohen's d=+0.0044, t-test p=0.9808,
    // and a 95% interval on the difference of -1.077 to +1.104. The interval is the point:
    // an earlier revision called this "zero", which the interval does not support.
    p: "Does contacting support hurt satisfaction? Across all 120 customers the difference is 0.013 points on a 10-point scale, d=0.004, p=0.98 - but its 95% interval runs -1.08 to +1.10. That is the honest answer: not 'no effect', but 'not measured'. A full point of damage would fit this data comfortably." },
  { h: "3 - What it would take",
    p: "This is the actual recommendation. To detect a one-point effect you need 144 customers per group; there are about 60. Click any group to filter - and watch the confidence intervals get wider, and the required sample sizes move, as n falls." },
];
