/**
 * Data layer - 2025/11 E-commerce Analytics.
 *
 * Every number rendered anywhere is computed here from the event-level data.
 * tools/verify_metrics.py recomputes each rendered figure from the PARQUET via DuckDB and
 * asserts the DOM matches - a second engine, a different code path.
 *
 * ONE RULE THIS MONTH, and it is the whole subject of the page:
 *
 *   THERE ARE THREE REVENUE NUMBERS AND THEY ARE NOT INTERCHANGEABLE.
 *
 *     reported  = the file's own net_revenue_usd.        $31,832,281
 *     exTax     = reported - sales tax.                  $28,574,342
 *     net       = exTax, but ZERO when refunded.         $28,006,708   <- use this one
 *
 *   The gap is 12.02%. Money arrives from the build as INTEGER CENTS and only `reported` and
 *   `tax` are transmitted; the other two are derived below, once, so the client cannot
 *   disagree with the build about the arithmetic.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";
import {
  chiSquareAgainstBaseRate,
  kruskalWallis,
  type ChiSqResult,
  type KWResult,
} from "./stats";

type Dict = { levels: string[]; codes: number[] };

const P = payload as unknown as {
  n: number;
  months: string[];
  monthPartial: boolean[];
  cols: Record<string, Dict>;
  month_idx: number[];
  reported: number[];
  tax: number[];
  qty: number[];
  isOrder: number[];
  isRefunded: number[];
  beforeSignup: number[];
  correction: CorrectionRow[];
  geo: GeoRow[];
  meta: Record<string, string | number>;
};

export type CorrectionRow = {
  cut: string;
  groups: number;
  lo: number;
  hi: number;
  span: number;
};

export type GeoRow = {
  country: string;
  region: string;
  currency: string;
  tax_rate_statutory: number;
  events: number;
};

export type Event = {
  i: number;
  channel: string;
  country: string;
  region: string;
  currency: string;
  category: string;
  family: string;
  billing: string;
  segment: string;
  payment: string;
  acquisition: string;
  code: string | null;
  monthIdx: number;
  qty: number;
  /** The file's own figure. Gross of tax, refunds still counted. */
  reported: number;
  tax: number;
  /** reported - tax. */
  exTax: number;
  /** exTax, or 0 when refunded. THE one to use. */
  net: number;
  isOrder: 0 | 1;
  isRefunded: 0 | 1;
  beforeSignup: 0 | 1;
};

function decode(): Event[] {
  const lv = (c: string) => P.cols[c].levels;
  const cd = (c: string) => P.cols[c].codes;
  const out: Event[] = new Array(P.n);
  const codeLv = lv("discount_code");
  const codeCd = cd("discount_code");
  for (let i = 0; i < P.n; i++) {
    const reported = P.reported[i] / 100;
    const tax = P.tax[i] / 100;
    // Subtract in CENTS, then convert - never `reported - tax`. The two differ by one ulp on
    // 5,145 of 48,000 rows, which is invisible in every dollar figure on the page and decides
    // the tie structure of the rank test in charts/AspByCountry. build.py quantises the same
    // derived column the same way so the parquet and this payload cannot drift apart.
    const exTax = (P.reported[i] - P.tax[i]) / 100;
    const c = codeCd[i];
    out[i] = {
      i,
      channel: lv("channel")[cd("channel")[i]],
      country: lv("country")[cd("country")[i]],
      region: lv("region")[cd("region")[i]],
      currency: lv("currency")[cd("currency")[i]],
      category: lv("category")[cd("category")[i]],
      family: lv("family_name")[cd("family_name")[i]],
      billing: lv("billing_cycle")[cd("billing_cycle")[i]],
      segment: lv("segment")[cd("segment")[i]],
      payment: lv("payment_method")[cd("payment_method")[i]],
      acquisition: lv("acquisition_channel")[cd("acquisition_channel")[i]],
      code: c < 0 ? null : codeLv[c],
      monthIdx: P.month_idx[i],
      qty: P.qty[i],
      reported,
      tax,
      exTax,
      net: P.isRefunded[i] ? 0 : exTax,
      isOrder: P.isOrder[i] as 0 | 1,
      isRefunded: P.isRefunded[i] as 0 | 1,
      beforeSignup: P.beforeSignup[i] as 0 | 1,
    };
  }
  return out;
}

const ALL: Event[] = decode();
export const allRows = () => ALL;
export const MONTHS = P.months;
export const MONTH_PARTIAL = P.monthPartial;
export const CORRECTION = P.correction;
export const GEO = P.geo;
export const META = P.meta;
export const [ready] = createSignal(true);

/** The three cuts whose correction is geographic. C4. */
export const GEO_CUTS = ["country", "region", "currency"];
/** Excluded from "non-geographic" because SALE15 is US-only and LOYALTY15 is not. C14. */
export const DISGUISED_GEO_CUT = "discount_code";

// ---------------------------------------------------------------------------------------
// Cross-filter
// ---------------------------------------------------------------------------------------

/**
 * Re-export, never redeclare: the filter VALUES come from the kit's global store, whose
 * `field` is `string`. Narrowing it to `keyof Event` here made `Accessor<Filter[]>`
 * unassignable to `derived()`, and every consumer degraded to `unknown`.
 * See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

export function apply(rows: Event[], filters: Filter[]): Event[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => f.values.includes(r[f.field as keyof Event] as string | number))
  );
}

// ---------------------------------------------------------------------------------------
// Measures. Note which revenue column each one uses.
// ---------------------------------------------------------------------------------------

export const revenue = (rows: Event[]) => rows.reduce((a, r) => a + r.net, 0);
export const revenueReported = (rows: Event[]) => rows.reduce((a, r) => a + r.reported, 0);
export const revenueExTax = (rows: Event[]) => rows.reduce((a, r) => a + r.exTax, 0);
export const taxTotal = (rows: Event[]) => rows.reduce((a, r) => a + r.tax, 0);
export const refundedExTax = (rows: Event[]) =>
  rows.reduce((a, r) => a + (r.isRefunded ? r.exTax : 0), 0);

/** The correction as a percentage of the file's own figure. The page's central measure. */
export function correctionPct(rows: Event[]): number {
  const rep = revenueReported(rows);
  return rep ? (100 * (rep - revenue(rows))) / rep : NaN;
}

/** ASP is a MEAN, which is why the tax defect distorts it. C3. */
export const aspReported = (rows: Event[]) =>
  rows.length ? revenueReported(rows) / rows.length : NaN;
export const aspExTax = (rows: Event[]) => (rows.length ? revenueExTax(rows) / rows.length : NaN);

export const refundRate = (rows: Event[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.isRefunded, 0)) / rows.length : NaN;

export function groupBy<K extends keyof Event>(rows: Event[], key: K) {
  const m = new Map<Event[K], Event[]>();
  for (const r of rows) {
    const g = m.get(r[key]);
    if (g) g.push(r);
    else m.set(r[key], [r]);
  }
  return m;
}

export type Group = {
  k: string;
  n: number;
  reported: number;
  net: number;
  correctionPct: number;
  aspReported: number;
  aspExTax: number;
  refundRate: number;
  share: number;
};

export function by(rows: Event[], key: keyof Event): Group[] {
  const total = revenue(rows);
  return [...groupBy(rows, key)]
    .filter(([k]) => k !== null)
    .map(([k, g]) => ({
      k: String(k),
      n: g.length,
      reported: revenueReported(g),
      net: revenue(g),
      correctionPct: correctionPct(g),
      aspReported: aspReported(g),
      aspExTax: aspExTax(g),
      refundRate: refundRate(g),
      share: total ? (100 * revenue(g)) / total : 0,
    }))
    .sort((a, b) => b.net - a.net);
}

// ---------------------------------------------------------------------------------------
// THE SIGNATURE - one row per cut, one dot per group. C4.
// ---------------------------------------------------------------------------------------

export type SpanRow = {
  cut: string;
  label: string;
  isGeographic: boolean;
  isDisguisedGeo: boolean;
  points: { k: string; pct: number; n: number }[];
  lo: number;
  hi: number;
  span: number;
};

const CUT_FIELD: Record<string, keyof Event> = {
  channel: "channel",
  payment_method: "payment",
  category: "category",
  month: "monthIdx",
  segment: "segment",
  family: "family",
  discount_code: "code",
  currency: "currency",
  region: "region",
  country: "country",
};

const CUT_LABEL: Record<string, string> = {
  channel: "by channel",
  payment_method: "by payment method",
  category: "by category",
  month: "by month",
  segment: "by segment",
  family: "by product family",
  discount_code: "by discount code",
  currency: "by currency",
  region: "by region",
  country: "by country",
};

export function spans(rows: Event[]): SpanRow[] {
  return Object.keys(CUT_FIELD)
    .map((cut) => {
      const groups = by(rows, CUT_FIELD[cut]).filter((g) => Number.isFinite(g.correctionPct));
      const pcts = groups.map((g) => g.correctionPct);
      const lo = Math.min(...pcts);
      const hi = Math.max(...pcts);
      return {
        cut,
        label: CUT_LABEL[cut],
        isGeographic: GEO_CUTS.includes(cut),
        isDisguisedGeo: cut === DISGUISED_GEO_CUT,
        points: groups.map((g) => ({ k: g.k, pct: g.correctionPct, n: g.n })),
        lo,
        hi,
        span: hi - lo,
      };
    })
    .sort((a, b) => a.span - b.span);
}

// ---------------------------------------------------------------------------------------
// Time. Both partial months are marked, never dropped. assumptions A-8.
// ---------------------------------------------------------------------------------------

export type MonthPoint = {
  month: string;
  idx: number;
  n: number;
  partial: boolean;
  reported: number;
  net: number;
  correctionPct: number;
};

export function byMonth(rows: Event[]): MonthPoint[] {
  const n = new Array(MONTHS.length).fill(0);
  const rep = new Array(MONTHS.length).fill(0);
  const net = new Array(MONTHS.length).fill(0);
  for (const r of rows) {
    n[r.monthIdx]++;
    rep[r.monthIdx] += r.reported;
    net[r.monthIdx] += r.net;
  }
  return MONTHS.map((m, i) => ({
    month: m,
    idx: i,
    n: n[i],
    partial: MONTH_PARTIAL[i],
    reported: rep[i],
    net: net[i],
    correctionPct: rep[i] ? (100 * (rep[i] - net[i])) / rep[i] : NaN,
  }));
}

// ---------------------------------------------------------------------------------------
// The two casualties
// ---------------------------------------------------------------------------------------

/** C3c - a TOTAL that changes rank. No sampling-noise objection is available. */
export function regionFlip(rows: Event[]) {
  const g = by(rows, "region");
  const totalRep = revenueReported(rows);
  const totalNet = revenue(rows);
  const withShares = g.map((x) => ({
    k: x.k,
    reported: x.reported,
    net: x.net,
    repShare: totalRep ? (100 * x.reported) / totalRep : 0,
    netShare: totalNet ? (100 * x.net) / totalNet : 0,
  }));
  const repOrder = [...withShares].sort((a, b) => b.reported - a.reported).map((x) => x.k);
  const netOrder = [...withShares].sort((a, b) => b.net - a.net).map((x) => x.k);
  return {
    rows: withShares
      .map((x) => ({
        ...x,
        repRank: repOrder.indexOf(x.k) + 1,
        netRank: netOrder.indexOf(x.k) + 1,
      }))
      .sort((a, b) => a.repRank - b.repRank),
    flipped: repOrder[0] !== netOrder[0],
    topReported: repOrder[0],
    topRestated: netOrder[0],
  };
}

/** C3 - a MEAN that stops existing. Ex-tax, ASP does not differ by country at all. */
export function aspByCountry(rows: Event[]) {
  const taxOf = new Map(GEO.map((g) => [g.country, g.tax_rate_statutory]));
  return by(rows, "country")
    .map((g) => ({ ...g, taxRate: taxOf.get(g.k) ?? 0 }))
    .sort((a, b) => b.aspReported - a.aspReported);
}

// ---------------------------------------------------------------------------------------
// C3, tested rather than asserted.
//
// These four Kruskal-Wallis runs are the evidence for "the country price ranking stops
// existing". Until the integrity pass they were four literals typed into the copy, computed
// off unquantised float64 revenue that the app does not ship. They are computed here, from
// the same rows the dumbbells are drawn from, so the number and the chart cannot disagree.
//
// TWO MEASURES, because the panel used to label one of them as the other. `perEvent` is
// revenue per EVENT - mean(reported) by country, which is what every asp_* query in
// metric_checks.yml computes and what an entrant answering Q9 from the revenue column would
// build. `perUnit` divides by `quantity` (a seat count, mean 6.03, range 1-25) and is the
// literal average selling price. The conclusion is the same under both, and stronger under
// per-unit; publishing both is what lets the axis be honest about which one it draws.
// ---------------------------------------------------------------------------------------

export type PriceTests = {
  perEventReported: KWResult;
  perEventExTax: KWResult;
  perUnitReported: KWResult;
  perUnitExTax: KWResult;
};

function byCountryValues(rows: Event[], value: (r: Event) => number): number[][] {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const g = m.get(r.country);
    if (g) g.push(value(r));
    else m.set(r.country, [value(r)]);
  }
  return [...m.values()];
}

export function priceTests(rows: Event[]): PriceTests {
  return {
    perEventReported: kruskalWallis(byCountryValues(rows, (r) => r.reported)),
    perEventExTax: kruskalWallis(byCountryValues(rows, (r) => r.exTax)),
    perUnitReported: kruskalWallis(byCountryValues(rows, (r) => r.reported / r.qty)),
    perUnitExTax: kruskalWallis(byCountryValues(rows, (r) => r.exTax / r.qty)),
  };
}

/** Calendar month (1-12) of a month index, for the seasonality test. */
const CALENDAR_MONTH = MONTHS.map((m) => Number(m.slice(5, 7)));

/**
 * C14 - are the Black Friday codes redeemed in a season, or at the file's own base rate?
 *
 * Binned by CALENDAR month, not by the file's 19 distinct months: the question is whether
 * November and December behave differently from other Novembers and Decembers, so the two
 * Aprils and two-through-ten Octobers fold together. That is what makes df = 11.
 */
export function bfcmSeasonality(rows: Event[]): ChiSqResult {
  const obs = new Array(12).fill(0);
  const exposure = new Array(12).fill(0);
  for (const r of rows) {
    const c = CALENDAR_MONTH[r.monthIdx] - 1;
    exposure[c]++;
    if (r.code === "BFCM10" || r.code === "BFCM20") obs[c]++;
  }
  return chiSquareAgainstBaseRate(obs, exposure);
}

/** C14 - share of a discount code's redemptions falling in one country. */
export function codeCountryShare(rows: Event[], code: string, country: string): number {
  let n = 0;
  let hit = 0;
  for (const r of rows) {
    if (r.code !== code) continue;
    n++;
    if (r.country === country) hit++;
  }
  return n ? (100 * hit) / n : NaN;
}

/** Events carrying the file's blank region label, which is exactly {US, Canada}. A-2. */
export const blankRegionEvents = (rows: Event[]) =>
  rows.reduce((a, r) => a + (r.region === "North America" ? 1 : 0), 0);

/** Events preceding their own customer's signup_date. C15. */
export const eventsBeforeSignup = (rows: Event[]) =>
  rows.reduce((a, r) => a + r.beforeSignup, 0);

/** The statutory rate charged in a country, as a percentage. */
export const taxRatePct = (country: string) =>
  100 * (GEO.find((g) => g.country === country)?.tax_rate_statutory ?? NaN);

/** The single statutory rate shared by every country in a region, or NaN if they differ. */
export function regionTaxRatePct(region: string): number {
  const rates = [...new Set(GEO.filter((g) => g.region === region).map((g) => g.tax_rate_statutory))];
  return rates.length === 1 ? 100 * rates[0] : NaN;
}

// ---------------------------------------------------------------------------------------
// Reactive wrapper + formatters
// ---------------------------------------------------------------------------------------

export function derived<T>(fn: (rs: Event[]) => T, filters: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(ALL, filters()));
    const ms = performance.now() - t0;
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const dec = (n: number, d = 1) => n.toFixed(d);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
export const usd = (n: number) => "$" + nf.format(Math.round(n));
export const usdM = (n: number) => "$" + (n / 1e6).toFixed(2) + "M";

const SUPER: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻",
};

/**
 * A p-value, rendered the way the copy reads it: three decimals near the centre, and
 * "6.9 x 10^-23" in the tail where three decimals would print "0.000" and say nothing.
 * `plain` swaps the superscripts for "e-23" for aria-labels and CSV/table cells.
 */
export function pval(p: number, plain = false): string {
  if (!Number.isFinite(p)) return "-";
  if (p >= 1e-3) return p.toFixed(3);
  const exp = Math.floor(Math.log10(p));
  const mant = (p / 10 ** exp).toFixed(1);
  if (plain) return `${mant}e${exp}`;
  const sup = String(exp).split("").map((c) => SUPER[c] ?? c).join("");
  return `${mant} × 10${sup}`;
}

/** Effect size for a rank test. Signed, because a negative eta-squared IS the finding. */
export const eff = (n: number) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(4);
