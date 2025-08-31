/** Guided tour - 5 steps. Keyboard-driven, dismissible, remembered in localStorage.
 *
 * NOTHING IN HERE IS A TYPED NUMBER, and that is the whole point of the file's shape.
 *
 * The tour used to be a `const TOUR: TourStep[]` of literal strings. One of them read
 * "981 of them are the 982 longest-standing members" while the KPI tile three inches
 * behind it rendered 982 / 100.0%. 981 was the abandoned SORT-POSITION statistic - the
 * naive "sort by tenure, take the top k, intersect" computation, which returns 981 or 982
 * depending purely on how the four members who share a tenure of 549 days happen to sort.
 * This month replaced it with a VALUE-based definition (a member counts if their tenure is
 * at least the k-th highest present, see data.ts::flaggedBy) and the tour was never
 * updated. The tour auto-opens for every first-time visitor, so the stale number was the
 * first statistic in the product.
 *
 * The fix is structural, not editorial: the tour is now BUILT from the same memos that
 * feed the tiles. If flaggedBy() changes, the tour changes with it. A literal cannot
 * disagree with itself - it can only disagree with the data - so the literals are gone.
 */
import type { TourStep } from "@onyxdata/dna-kit";

export type TourFacts = {
  /** the headline lapse threshold, in days */
  threshold: number;
  /** members a `days_since_visit > threshold` rule selects */
  flagged: number;
  /** % of the flagged set at or above the k-th highest tenure - value-based, tie-safe */
  overlapPct: number;
  /** lowest tenure anywhere in the flagged set */
  minTenureFlagged: number;
  /** members NOT flagged */
  active: number;
  /** gym with the most / least occupied floor-hours per member per week */
  cityHi: string;
  cityLo: string;
  /** % more floor-hours the top gym consumes than the bottom */
  spreadPct: number;
  /** behavioural tests plotted on the effect strip */
  tests: number;
  /** minimum detectable difference in visits/week, as % of the mean */
  mdePct: number;
};

const one = (n: number) => n.toFixed(1);
const zero = (n: number) => Math.round(n).toLocaleString("en-US");
/** English ordinal, so a derived count reads "982nd" and never "982th". */
export const ord = (n: number) => {
  const i = Math.round(n);
  const s = ["th", "st", "nd", "rd"][i % 100 >= 11 && i % 100 <= 13 ? 0 : Math.min(i % 10, 4) % 4] ?? "th";
  return `${i.toLocaleString("en-US")}${s}`;
};

export function buildTour(f: TourFacts): TourStep[] {
  return [
    {
      h: "One column, twice",
      p: "MyGym asked who is churning. This file cannot say - but it will answer confidently and wrongly. last_visit_date is join_date rescaled onto a 60-day window, so recency and tenure are the same variable.",
    },
    {
      h: "The 45° line",
      p: "Tenure across, days since last visit down. A real gym's members scatter into a cloud. Drag the lapse threshold and watch the flagged set stay a clean slice off the long-tenure end.",
    },
    {
      h: "What that costs",
      p:
        `A ${f.threshold}-day lapse rule flags ${zero(f.flagged)} members - and ${one(f.overlapPct)}% of them ` +
        `sit at or above the ${ord(f.flagged)}-highest tenure in the file. No member with under ` +
        `${zero(f.minTenureFlagged)} days of tenure is flagged at all. Run the win-back campaign and you mail ` +
        `your most loyal members first, leaving the ${zero(f.active)} newest alone.`,
    },
    {
      h: "What does survive",
      p:
        `Session length varies by gym - the only behavioural effect that clears the pre-declared ` +
        `correction. ${f.cityHi} consumes ${one(f.spreadPct)}% more floor-hours per member than ${f.cityLo}. ` +
        `That is a staffing answer.`,
    },
    {
      h: "And what doesn't",
      p:
        // prose-number-ok: I-5 - 80% is the POWER LEVEL the MDE is solved at (a fixed design
        // parameter, z(0.975)+z(0.80)=2.8), not a result. The result it produces, mdePct, is
        // interpolated from mde() beside it. Ledger: analysis/insights.md I-5.
        `${zero(f.tests)} pre-declared tests are plotted together so you can see the whole search. ` +
        `Nothing a member bought predicts what they do - and with 80% power to spot a ` +
        `difference of ${one(f.mdePct)}%, that null is a measurement.`,
    },
  ];
}
