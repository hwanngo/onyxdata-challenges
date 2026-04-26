/**
 * Guided tour - 2026/04. Five stops.
 *
 * THE TOUR AUTO-OPENS, so these are the first numbers anyone sees. Every figure is computed
 * from the same reducers the panels use. `open` is passed explicitly at the call site -
 * 2025/11 and 2025/12 both shipped a TourOverlay that never rendered because it was not.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import { CUTS, META, YEARS, dec, int, sci } from "./data";

/* Constants quoted in the tour. None is an aggregate of the payload, so no data-metric can
 * own them; each carries its own ledger reference. */
// prose-number-ok: I1 - nothing predicts move_duration; Cohen's floor for a "small" effect
const COHEN_SMALL = "0.01";
// prose-number-ok: I3 - the Suez disruption is not in the data
const SUEZ_MW_P = "0.504";
// prose-number-ok: I6 - what would have to be true; the VP's stated target, from the brief
const VP_TARGET = "15%";

const largest = [...CUTS].sort((a, b) => b.eta2 - a.eta2)[0];
/* Counted from the model, not typed. The integrity pass found this tour step still describing
   the KILLED G6 design - "the eight thin lines ... drawn as its own histogram over the top" -
   against 14 groups that are drawn as small multiples and a FlatLine that declares an
   `overlays` prop and never reads it. Killing a design means deleting its description too. */
const STRIP_CUTS = ["Regional hub", "Vessel category", "Day label (Day/Night)", "Fiscal year"];
const nOverlayGroups = CUTS.filter((c) => STRIP_CUTS.includes(c.cut_label))
  .reduce((n, c) => n + c.k_groups, 0);
const y0 = YEARS[0], yN = YEARS[YEARS.length - 1];

export const TOUR: TourStep[] = [
  {
    h: "This is every question the brief asks, answered at once",
    p:
      `Twenty bins, ${int(META.movements)} cargo movements, and each bin holds about ` +
      `${int(META.movements / 20)} of them. The duration of a cargo move is a coin toss ` +
      `between zero and a thousand hours. The line across the middle is not a fitted curve - ` +
      `it is ${int(META.movements)} divided by 20.`,
  },
  {
    h: "Below it, the brief's own questions as small multiples",
    p:
      `Regional hub, vessel category, day label, fiscal year - ${nOverlayGroups} groups across ` +
      `four cuts, each drawn as its own histogram AT ITS OWN SAMPLE SIZE with its own ±2 ` +
      `standard-error band. They are not overlaid on the hero: rescaling a small cut onto the ` +
      `full-sample axis multiplies its per-bin error, which made cuts consistent with the same ` +
      `uniform look wildly variable. Not one is a different shape. The largest effect any ` +
      `factor has on movement duration is ${largest.cut_label} at η² = ${sci(largest.eta2)}, ` +
      `against ${COHEN_SMALL} for what statisticians are willing to call "small".`,
  },
  {
    h: "One number in this file is real",
    p:
      `Movements grew from ${int(y0.movements)} in ${y0.fiscal_year} to ` +
      `${int(yN.movements)} in ${yN.fiscal_year}. The daily allocation is more variable than ` +
      `a random one - χ²/df ${dec(y0.daily_chi2_df, 4)} against a simulated maximum of ` +
      `${dec(y0.chance_chi2_df_max, 4)}. That is the only thing here that exceeds chance, ` +
      `which is what makes every null above a measurement rather than a failure to look.`,
  },
  {
    h: "And it is the one that will get you fired",
    p:
      `${y0.fiscal_year} is the lowest year, so that ramp looks exactly like recovery from ` +
      `the 2021 Suez blockage the brief is built around. Look at March 2021 day by day: the ` +
      `blockage week is marked and nothing happens in it. Mann-Whitney on duration against ` +
      `every other day in the file gives p = ${SUEZ_MW_P}.`,
  },
  {
    h: "What to do instead",
    p:
      `The VP asked for a ${VP_TARGET} cut in movement times. This data cannot locate one ` +
      `hour of it, ` +
      `and the report ends with the seven columns that would change that - starting with a ` +
      `terminal capacity the brief itself admits is missing, and a movement key that is not ` +
      `${int(META.movementIdDistinct)} values repeated across ${int(META.movements)} rows.`,
  },
];
