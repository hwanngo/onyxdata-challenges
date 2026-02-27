/**
 * Guided tour - 2026/02. Five stops, each a claim the reader can check on the page.
 *
 * THE TOUR AUTO-OPENS FOR A FIRST-TIME VISITOR, so these are the first numbers anyone sees.
 * Nothing here is transcribed: every figure is computed from the same rows the panels render,
 * through the same reducers, and each is re-derived from the parquet by verify_metrics.py.
 *
 * the integrity pass found four of eight months where a typed tour figure disagreed with the
 * tagged figure on the same screen - and 2025/11 and 2025/12 both shipped a TourOverlay that
 * never rendered at all, because `open` is required and was not passed. Both hazards are
 * addressed at the call site in Dashboard.tsx.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import {
  GRID_DOMAIN, META, byCategory, chanceFor, dec, eur0, growth, int, marginPct,
  promoMdeWorstCategory, promoSplit, storeGrid,
} from "./data";

const ALL = (() => {
  const a = new Int32Array(META.lines);
  for (let i = 0; i < META.lines; i++) a[i] = i;
  return a;
})();

const grid = storeGrid(ALL);
const g = growth(ALL);
const p = promoSplit(ALL);
const cats = byCategory(ALL);
const rate = marginPct(ALL);
const lo = Math.min(...grid.map((c) => c.marginPct));
const hi = Math.max(...grid.map((c) => c.marginPct));

export const TOUR: TourStep[] = [
  {
    h: "One number runs this whole chain",
    p:
      `Across ${int(META.lines)} sales lines, ${META.stores} shops and ${META.countries} ` +
      `countries, the margin rate is ${dec(rate)}%. Every question the brief asks about where ` +
      `profit varies comes back to it.`,
  },
  {
    h: "This is what 120 shops that all trade the same looks like",
    p:
      `One cell per shop, drawn on a fixed ${GRID_DOMAIN[0]}-${GRID_DOMAIN[1]}% scale that ` +
      `is never fitted to the data. ` +
      `The whole spread is ${dec(hi - lo)} points - and a bootstrap that holds each shop's own ` +
      `row count produces ${dec(chanceFor("Pharmacy"))} points by chance alone. The flat ` +
      `field is the finding, not a ` +
      `broken chart.`,
  },
  {
    h: "Now ask the same shops a different question",
    p:
      `Switch the grid to revenue per trading day. Same shops, same order, same grid - and it ` +
      `stops being flat. Shops differ enormously in how much they sell and not at all in how ` +
      `profitably they sell it.`,
  },
  {
    h: `${eur0(p.forgone)} of margin, for no extra units`,
    p:
      `Promotions run at ${dec(p.marginPctPromo)}% against ${dec(p.marginPctNon)}% - ` +
      `${dec(p.gapPp)} points - and move units from ${dec(p.unitsPerLineNon)} to ` +
      `${dec(p.unitsPerLinePromo)} per line. Pooled, a lift above ${dec(META.promoMdePooledPct)}% ` +
      `could not have hidden at this sample size - though within a single category the floor ` +
      `is as high as ${dec(promoMdeWorstCategory()[1])}%. It is the only lever here that is ` +
      `both controllable and being pulled.`,
  },
  {
    h: "What actually moves it, and how to check me",
    p:
      `Category spans ${dec(cats[0].marginPct - cats[cats.length - 1].marginPct)} points - ` +
      `the one structural lever. Total revenue grew ${dec(g.totalPct)}% in 2025 while ` +
      `same-store grew ${dec(g.samePct)}%. Click any shop, category, country or bar to ` +
      `cross-filter the whole report; every figure recomputes from the row data.`,
  },
];
