/** This month's tour content. The overlay itself lives in @onyxdata/dna-kit. */
import type { TourStep } from "@onyxdata/dna-kit";

export const TOUR_KEY = "datadna-2025-05-tour-seen";

export const TOUR_STEPS: TourStep[] = [
  {
    h: "The money is at the top of the ladder",
    p: "This report argues that mobile retail here is a price-ladder business, not a volume business. Five panels, one argument. Takes about 90 seconds.",
  },
  {
    h: "1 - The price ladder",
    p: "Every model sits at its real price. Bar length is revenue. Notice the bars get longer as you climb: a quarter of the units produce two-fifths of the money. Click any rung to filter everything else.",
  },
  {
    h: "2 - Who turns volume into money",
    p: "Revenue share minus unit share. Teal earns above its volume, ochre below. The brand selling the most phones earns only the third-most money - that inversion is the point of the report.",
  },
  {
    h: "3 - Same phone, same price",
    p: "The Z Fold 6 costs the same in every market. So the gap in average selling price is about which rung each market buys on, not about what they are charged. The two markets with enough trading days to test carry the claim; the thin two are shown but flagged.",
  },
  {
    h: "Everything cross-filters",
    p: "Click any brand, model, market or band; the chips at the top show what is active and clear in one click. Charts are keyboard-operable: Tab to a chart, arrow keys to move, Enter to drill, Esc to clear. Every view has its own URL.",
  },
];
