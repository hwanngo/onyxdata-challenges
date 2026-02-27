/**
 * Data layer - 2026/02 Pharmacy Sales & Profitability.
 *
 * Every number rendered anywhere in this app is computed here, at query time, from the
 * row-level fact table. Nothing is precomputed, nothing is hardcoded.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET via
 * DuckDB in Python and asserts the DOM matches - so this aggregation path is checked against a
 * real SQL engine rather than trusted.
 *
 * THREE RULES, carried from the semantic layer because the browser can break them just as
 * easily as SQL can:
 *
 *   1. MARGIN RATE IS sum(margin)/sum(revenue). There is no row-level rate to average, and
 *      no function here returns one.
 *   2. MONEY IS INTEGER CENTS end to end. build.py asserts the parquet and this payload hold
 *      the same integers; formatting to euros happens only at render.
 *   3. SAME-STORE IS A COHORT FIELD, not a filter anyone has to remember.
 *
 * ARCHITECTURE NOTE (docs/STACK.md specifies DuckDB-WASM):
 * the fact table is 62,139 rows in a 1.8 MB payload. DuckDB-WASM ships a 32 MB engine - 17×
 * the data - against a 3s cold-load budget. Aggregating 62k rows of typed arrays in JS is
 * ~2ms. Same measured trade as 2025/05; the WASM client stays in dna-kit for a month whose
 * data actually needs it.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

/**
 * Re-export, never redeclare: the filter VALUES come from the kit's global store, whose
 * `field` is `string`. Narrowing it here to `keyof Row` is what took five months of this
 * repo to `unknown` inference. See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

// ---------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------
export type Pharmacy = {
  pharmacy_key: string; pharmacy_name: string; country: string; region: string; city: string;
  pharmacy_type: string; store_size_band: string; cohort: string; exposure_days: number;
  latitude: number; longitude: number;
};
export type Product = {
  product_key: string; product_name: string; category: string; brand: string;
  brand_within_category: string; list_price_eur: number; is_generic: boolean;
  launches_in_window: boolean;
};
export type DateRow = {
  year: number; quarter: number; month_num: number; month_name: string; year_month: string;
  day_of_week: number; day_name: string; is_weekend: boolean;
};
export type Cut = {
  cut_label: string; cut_family: string; k_groups: number;
  margin_pct_min: number; margin_pct_max: number;
  spread_pp: number; chance_spread_p95_pp: number; exceeds_chance: boolean;
};

export const PHARMACIES = payload.pharmacies as Pharmacy[];
export const PRODUCTS = payload.products as Product[];
export const DATES = payload.dates as DateRow[];
export const CUTS = payload.cuts as Cut[];
export const META = payload.meta as {
  lines: number; stores: number; products: number; countries: number; regions: number;
  first: string; last: string; newStores: number; gridDomain: number[];
  bootstrapReps: number;
  promoMdePooledPct: number; promoMdeByCategoryPct: Record<string, number>;
};

/** The weakest per-category power: the largest lift that could still hide INSIDE a category.
 *  The pooled MDE is the answer to a different question and must not be quoted for the
 *  five-category claim - see model/build.py and the integrity pass. */
export const promoMdeWorstCategory = () => {
  const e = Object.entries(META.promoMdeByCategoryPct);
  return e.reduce((a, b) => (b[1] > a[1] ? b : a), e[0]);
};

/** The signature's fixed domain, from the model. Never auto-fitted - see .workbench/2026/02/design/direction.md. */
export const GRID_DOMAIN = META.gridDomain as [number, number];

/** The observation window, in days and in whole years.
 *
 *  Every euro total on this page is a sum over the WHOLE window, not an annual figure - the
 *  file runs 2024-01-01 to 2025-12-31 and carries no year predicate anywhere. The integrity pass
 *  found the poster headline calling the 24-month promotion cost "a year", which halves nothing
 *  in the arithmetic and doubles the number a reader takes away. Computed here so the prose
 *  cannot drift from the window again. */
export const SPAN_DAYS = DATES.length;
export const SPAN_YEARS = Math.round(SPAN_DAYS / 365.25);

/** Bootstrap 95th percentile for a given cut, straight from dim_cut. The yardstick every
 *  "is this real?" claim on the page depends on, so it is read from the model rather than
 *  typed into prose. */
export const chanceFor = (label: string) =>
  CUTS.find((c) => c.cut_label === label)?.chance_spread_p95_pp ?? 0;
export const spreadFor = (label: string) =>
  CUTS.find((c) => c.cut_label === label)?.spread_pp ?? 0;

// Columnar fact. Typed arrays: 62k rows aggregate in ~2ms.
const PH = Int16Array.from(payload.ph as number[]);
const PR = Int16Array.from(payload.pr as number[]);
const DT = Int16Array.from(payload.dt as number[]);
const U = Int8Array.from(payload.u as number[]);
const REV = Int32Array.from(payload.rev as number[]); // cents
const MAR = Int32Array.from(payload.mar as number[]); // cents
const PROMO = Uint8Array.from(payload.promo as number[]);
const PRE = Uint8Array.from(payload.pre as number[]);
const N = payload.n as number;

export const [ready] = createSignal(true);

// ---------------------------------------------------------------------------------------
// Cross-filter. Rows are an index list so no object is ever materialised.
// ---------------------------------------------------------------------------------------
export type Idx = Int32Array;

const ALL: Idx = (() => {
  const a = new Int32Array(N);
  for (let i = 0; i < N; i++) a[i] = i;
  return a;
})();

/** Field → per-row string value, resolved through the dimension tables. */
function valueOf(field: string, i: number): string | number | undefined {
  switch (field) {
    case "country": return PHARMACIES[PH[i]].country;
    case "region": return PHARMACIES[PH[i]].region;
    case "pharmacy": return PHARMACIES[PH[i]].pharmacy_key;
    case "pharmacy_type": return PHARMACIES[PH[i]].pharmacy_type;
    case "store_size_band": return PHARMACIES[PH[i]].store_size_band;
    case "cohort": return PHARMACIES[PH[i]].cohort;
    case "category": return PRODUCTS[PR[i]].category;
    case "brand": return PRODUCTS[PR[i]].brand;
    case "year": return DATES[DT[i]].year;
    case "year_month": return DATES[DT[i]].year_month;
    case "promo": return PROMO[i] ? "Promoted" : "Not promoted";
    default: return undefined;
  }
}

export function apply(filters: Filter[]): Idx {
  if (!filters.length) return ALL;
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    let keep = true;
    for (const f of filters) {
      const v = valueOf(f.field, i);
      if (v === undefined || !f.values.includes(v)) { keep = false; break; }
    }
    if (keep) out.push(i);
  }
  return Int32Array.from(out);
}

/** Recomputes whenever the filter set changes. */
export function derived<T>(fn: (rows: Idx) => T, filters: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(filters()));
    const ms = performance.now() - t0;
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// Measures. Rule 1: every rate is a ratio of sums.
// ---------------------------------------------------------------------------------------
export const lines = (rows: Idx) => rows.length;
export function revenue(rows: Idx) { let s = 0; for (const i of rows) s += REV[i]; return s; }
export function marginC(rows: Idx) { let s = 0; for (const i of rows) s += MAR[i]; return s; }
export function units(rows: Idx) { let s = 0; for (const i of rows) s += U[i]; return s; }

/** THE number. Ratio of sums, in cents, converted once at the end. */
export function marginPct(rows: Idx) {
  const r = revenue(rows);
  return r ? (marginC(rows) / r) * 100 : 0;
}

// ---------------------------------------------------------------------------------------
// Panel queries. One per panel, each taking filtered rows.
// ---------------------------------------------------------------------------------------

export type Cell = {
  key: string; name: string; country: string; region: string; type: string;
  marginPct: number; revPerDay: number; lines: number; isNew: boolean;
};

/** ③ The signature. One entry per pharmacy, ALWAYS all 120 - order is pharmacy_key, never sorted. */
export function storeGrid(rows: Idx): Cell[] {
  const rev = new Float64Array(PHARMACIES.length);
  const mar = new Float64Array(PHARMACIES.length);
  const cnt = new Int32Array(PHARMACIES.length);
  for (const i of rows) { rev[PH[i]] += REV[i]; mar[PH[i]] += MAR[i]; cnt[PH[i]]++; }
  return PHARMACIES.map((p, j) => ({
    key: p.pharmacy_key,
    name: p.pharmacy_name,
    country: p.country,
    region: p.region,
    type: p.pharmacy_type,
    marginPct: rev[j] ? (mar[j] / rev[j]) * 100 : NaN,
    // Per TRADING DAY, not raw - otherwise the eleven mid-window openings read as weak shops
    // that are merely young. .workbench/2026/02/design/direction.md, signature honesty constraints.
    revPerDay: rev[j] / 100 / p.exposure_days,
    lines: cnt[j],
    isNew: p.cohort === "opened_in_window",
  }));
}

/** ④ Growth decomposed. Rule 3: cohort is a field, so this cannot be got wrong by omission. */
export function growth(rows: Idx) {
  const acc = { total: [0, 0], same: [0, 0], neu: [0, 0] };
  for (const i of rows) {
    const y = DATES[DT[i]].year === 2024 ? 0 : 1;
    acc.total[y] += REV[i];
    if (PHARMACIES[PH[i]].cohort === "established") acc.same[y] += REV[i];
    else acc.neu[y] += REV[i];
  }
  const g = (a: number[]) => (a[0] ? (a[1] / a[0] - 1) * 100 : 0);
  const growthTotal = acc.total[1] - acc.total[0];
  return {
    total: acc.total.map((c) => c / 100),
    same: acc.same.map((c) => c / 100),
    neu: acc.neu.map((c) => c / 100),
    totalPct: g(acc.total),
    samePct: g(acc.same),
    newShareOfGrowth: growthTotal ? ((acc.neu[1] - acc.neu[0]) / growthTotal) * 100 : 0,
  };
}

/** ⑤ The lever. */
export function promoSplit(rows: Idx) {
  const r = [0, 0], m = [0, 0], u = [0, 0], n = [0, 0];
  for (const i of rows) {
    const k = PROMO[i];
    r[k] += REV[i]; m[k] += MAR[i]; u[k] += U[i]; n[k]++;
  }
  const pctOf = (k: number) => (r[k] ? (m[k] / r[k]) * 100 : 0);
  const nonRate = r[0] ? m[0] / r[0] : 0;
  return {
    marginPctPromo: pctOf(1),
    marginPctNon: pctOf(0),
    gapPp: pctOf(0) - pctOf(1),
    unitsPerLinePromo: n[1] ? u[1] / n[1] : 0,
    unitsPerLineNon: n[0] ? u[0] / n[0] : 0,
    linesPromo: n[1],
    linesNon: n[0],
    // Promo revenue valued at the non-promo rate, minus what it actually earned.
    forgone: (r[1] * nonRate - m[1]) / 100,
  };
}

/** ⑥ The only structural lever. */
export function byCategory(rows: Idx) {
  const map = new Map<string, { rev: number; mar: number; u: number; n: number }>();
  for (const i of rows) {
    const c = PRODUCTS[PR[i]].category;
    let e = map.get(c);
    if (!e) { e = { rev: 0, mar: 0, u: 0, n: 0 }; map.set(c, e); }
    e.rev += REV[i]; e.mar += MAR[i]; e.u += U[i]; e.n++;
  }
  return [...map].map(([k, e]) => ({
    k, lines: e.n, units: e.u, revenue: e.rev / 100,
    marginPct: e.rev ? (e.mar / e.rev) * 100 : 0,
  })).sort((a, b) => b.marginPct - a.marginPct);
}

/** Web-only map. Deliberately inert - it answers B10 by showing there is nothing to show. */
export function byCountry(rows: Idx) {
  const map = new Map<string, { rev: number; mar: number; n: number }>();
  for (const i of rows) {
    const c = PHARMACIES[PH[i]].country;
    let e = map.get(c);
    if (!e) { e = { rev: 0, mar: 0, n: 0 }; map.set(c, e); }
    e.rev += REV[i]; e.mar += MAR[i]; e.n++;
  }
  const stores = new Map<string, number>();
  for (const p of PHARMACIES) stores.set(p.country, (stores.get(p.country) ?? 0) + 1);
  return [...map].map(([k, e]) => ({
    k, revenue: e.rev / 100, lines: e.n, stores: stores.get(k) ?? 0,
    marginPct: e.rev ? (e.mar / e.rev) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

/** The pre-launch defect, quantified. Flagged, never dropped. */
export function prelaunch(rows: Idx) {
  let n = 0, rev = 0, total = 0;
  const prods = new Set<number>();
  for (const i of rows) {
    total += REV[i];
    if (PRE[i]) { n++; rev += REV[i]; prods.add(PR[i]); }
  }
  return {
    lines: n, revenue: rev / 100, products: prods.size,
    sharePct: total ? (rev / total) * 100 : 0,
    lineSharePct: rows.length ? (n / rows.length) * 100 : 0,
  };
}

/** The trading week - the only time signal. Measured on COUNT, not size. */
export function tradingWeek(rows: Idx) {
  const n = new Array(8).fill(0);
  const days = new Array(8).fill(0);
  for (const i of rows) n[DATES[DT[i]].day_of_week]++;
  for (const d of DATES) days[d.day_of_week]++;
  const out = [];
  for (let w = 1; w <= 7; w++) {
    out.push({ dow: w, name: DATES.find((d) => d.day_of_week === w)!.day_name,
               perDay: days[w] ? n[w] / days[w] : 0, isWeekend: w > 5 });
  }
  /* POOLED over dates, not the mean of seven per-weekday means. The window is 731 days, so
     three weekdays occur 105 times and four occur 104; averaging the day-means weights a
     105-day weekday the same as a 104-day one and the two estimators disagree in the fourth
     decimal. verify_metrics.py pools, and it was the DOM that was wrong. Two engines exist
     precisely to surface this. */
  let wkLines = 0, wkDays = 0, weLines = 0, weDays = 0;
  for (let w = 1; w <= 7; w++) {
    if (w > 5) { weLines += n[w]; weDays += days[w]; } else { wkLines += n[w]; wkDays += days[w]; }
  }
  const wk = wkDays ? wkLines / wkDays : 0;
  const we = weDays ? weLines / weDays : 0;
  return { days: out, weekdayMean: wk, weekendMean: we, gapPct: wk ? (we / wk - 1) * 100 : 0 };
}

/** Monthly series, for ④'s x-axis. */
export function byMonth(rows: Idx) {
  const map = new Map<string, { rev: number; same: number }>();
  for (const d of DATES) if (!map.has(d.year_month)) map.set(d.year_month, { rev: 0, same: 0 });
  for (const i of rows) {
    const e = map.get(DATES[DT[i]].year_month)!;
    e.rev += REV[i];
    if (PHARMACIES[PH[i]].cohort === "established") e.same += REV[i];
  }
  return [...map].map(([k, e]) => ({ k, revenue: e.rev / 100, same: e.same / 100 }))
    .sort((a, b) => a.k.localeCompare(b.k));
}

// ---------------------------------------------------------------------------------------
// Formatters. Locale-aware, tabular. Euros, because the book is in euros.
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-GB");
export const int = (n: number) => nf.format(Math.round(n));
export const eur0 = (n: number) => "€" + nf.format(Math.round(n));
export const money = (n: number) =>
  n >= 1e6 ? "€" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "€" + (n / 1e3).toFixed(0) + "k" : eur0(n);
export const pct = (n: number, d = 2) => n.toFixed(d) + "%";
export const pp = (n: number, d = 2) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d) + "pp";
export const dec = (n: number, d = 2) => n.toFixed(d);
export const signed = (n: number, d = 2) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d) + "%";
