/**
 * Guided tour - 2025/11. Five stops, each one a claim the reader can check on the page.
 *
 * THE TOUR AUTO-OPENS FOR A FIRST-TIME VISITOR, so these are the first numbers anyone sees -
 * and until this was checked every one of them was typed. Two were wrong: the tax total read
 * $3,257,938 against an actual $3,257,940, and recognisable revenue read $28,006,710 against
 * $28,006,708. Both were off by about two dollars in thirty-one million, which is exactly the
 * size of error that survives review forever: too small to look wrong, and contradicting the
 * restatement block the tour is pointing AT.
 *
 * So nothing here is transcribed. Every figure is computed from the same rows the panels
 * render, through the same reducers, and the quantities are specified in
 * `model/metric_checks.yml` and re-derived from the parquet by `tools/verify_metrics.py`.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import {
  META,
  allRows,
  correctionPct,
  dec,
  int,
  priceTests,
  pval,
  pct,
  refundedExTax,
  regionFlip,
  revenue,
  revenueReported,
  taxTotal,
  usd,
  usdM,
} from "./data";

const ALL = allRows();

const flip = regionFlip(ALL);
const tests = priceTests(ALL);

/* flip.rows is ordered by REPORTED rank, so [0] is the region that leads on the file's own
   figures and [1] is the one that overtakes it after restatement. Both margins are read off
   that pair rather than named, so the sentence stays true if the data ever changes which
   regions they are. */
const reportedLead = Math.abs(flip.rows[0].reported - flip.rows[1].reported);
const restatedLead = Math.abs(flip.rows[1].net - flip.rows[0].net);

const repeatBuyers = META.repeat_buyers as number;
const customers = META.customers as number;
const events = META.events as number;

export const TOUR: TourStep[] = [
  {
    h: "Start with the number that changes",
    p:
      `The file reports ${usd(revenueReported(ALL))} of revenue. ` +
      `${usd(taxTotal(ALL))} of that is sales tax and ${usd(refundedExTax(ALL))} was refunded ` +
      `to the customer and never removed. Recognisable revenue is ${usd(revenue(ALL))} - ` +
      `${pct(correctionPct(ALL), 2)} less.`,
  },
  {
    h: "The correction is flat - except on geography",
    p:
      `One row per way of cutting the data, one dot per group. Six rows collapse onto the ` +
      `${pct(correctionPct(ALL), 2)} line: whichever channel, month or product you pick, ` +
      `everyone takes the same haircut. Three rows spray across the whole chart. Those three ` +
      `are country, region and currency.`,
  },
  {
    h: "So one ranking flips...",
    p:
      `${flip.topReported} leads revenue by ${usdM(reportedLead)} on the file's own figures. ` +
      `${flip.topRestated} leads by ${usdM(restatedLead)} once corrected. These are totals, ` +
      `not averages - there is no sampling noise to blame.`,
  },
  {
    h: "...and one stops existing",
    p:
      `Revenue per event differs by country at p = ${pval(tests.perEventReported.p, true)}. ` +
      `Strip the tax and it does not differ at all - p = ${pval(tests.perEventExTax.p, true)}. ` +
      `The whole of the country price gap is sales tax, which is why this panel refuses to ` +
      `rank the corrected figures.`,
  },
  {
    h: "And the question the brief actually asked",
    p:
      `Identify the loyal customers. There are ${int(repeatBuyers)} of them out of ` +
      `${int(customers)}. The file holds ${int(events)} events across exactly ` +
      `${int(customers)} customers - mean exactly ${dec(events / customers, 4)} - so how much ` +
      `anyone buys is allocation noise. Click any mark on any chart to cross-filter the report.`,
  },
];
