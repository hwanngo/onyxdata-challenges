/**
 * Data layer - 2026/04 Maritime Logistics & Terminal Efficiency.
 *
 * Every number rendered anywhere is computed here, at query time, from the row-level payload.
 * tools/verify_metrics.py recomputes each rendered figure from the PARQUET via DuckDB and
 * asserts the DOM matches, so this path is checked against a real SQL engine rather than
 * trusted.
 *
 * THREE RULES, carried from the semantic layer:
 *
 *   1. NO RATE FUNCTION EXISTS, AND NO RATE COLUMN REACHES THE BROWSER. Not
 *      mean-duration-per-terminal, not movements-per-capacity. Every rate this file could
 *      express is noise (largest eta2 = 0.0079), so the data layer does not offer one.
 *      Duration is exposed as a DISTRIBUTION and as a range. dim_year DOES carry
 *      mean_duration in the parquet - a test needs it to prove the ramp is a count fact, not
 *      a duration fact - and build.py drops it from the payload so this rule holds here too.
 *      It used to ship, unrendered, which is a rate waiting to be drawn.
 *   2. `dayLabel` IS NOT A SHIFT. It is a property of the date - a whole calendar day is
 *      "Day" or "Night" - so it is never named `shift` anywhere in this app.
 *   3. THE ONE REAL SIGNAL CARRIES ITS WARNING. `growth()` returns `isSuezYear` alongside the
 *      counts, so the series cannot be drawn without the marker.
 *
 * Durations travel as whole MINUTES, quantised once in build.py. Six decimals of an hour is
 * false precision on a uniform draw.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

export type { Filter };

export type Terminal = {
  terminal_id: number; terminal_label: string; regional_hub: string;
  longitude: number; latitude: number;
};
export type Vessel = {
  vessel_key: string; vessel_label: string; vessel_category: string;
  build_year: number; vessel_age_2024: number;
};
export type DateRow = {
  date_key: number; fiscal_year: number; quarter: number; month: number; week: number;
  day_label: string; day_of_week: number; in_suez_week: boolean;
};
export type Cut = {
  cut_label: string; cut_family: string; k_groups: number;
  kw_p: number; eta2: number; is_predictive: boolean;
};
export type YearRow = {
  fiscal_year: number; movements: number;
  is_suez_year: boolean; yoy_pct: number | null;
  daily_chi2_df: number; chance_chi2_df_max: number;
};

export const TERMINALS = payload.terminals as Terminal[];
export const VESSELS = payload.vessels as Vessel[];
export const DATES = payload.dates as DateRow[];
export const CUTS = payload.cuts as Cut[];
export const YEARS = payload.years as YearRow[];
export const META = payload.meta as {
  movements: number; terminals: number; vessels: number; days: number;
  first: string; last: string; suezStart: string; suezEnd: string;
  badVesselRows: number; movementIdDistinct: number;
  durationDomainHours: [number, number]; containerDomain: [number, number];
};

/** The uniform domain both measures actually occupy. From the model, never auto-fitted. */
export const DURATION_DOMAIN = META.durationDomainHours;
export const BINS = 20;

const T = Int8Array.from(payload.t as number[]);
const V = Int16Array.from(payload.v as number[]);
const D = Int16Array.from(payload.d as number[]);
const DUR = Int32Array.from(payload.dur as number[]); // whole minutes
const CC = Int16Array.from(payload.cc as number[]);
const BAD = Uint8Array.from(payload.bad as number[]);
const N = payload.n as number;

/** Row indices falling inside the Ever Given blockage week, precomputed once. */
export const DATES_IN_SUEZ: Set<number> = (() => {
  const s = new Set<number>();
  for (let i = 0; i < (payload.n as number); i++) {
    if ((payload.dates as DateRow[])[(payload.d as number[])[i]].in_suez_week) s.add(i);
  }
  return s;
})();

export const [ready] = createSignal(true);
export type Idx = Int32Array;

const ALL: Idx = (() => {
  const a = new Int32Array(N);
  for (let i = 0; i < N; i++) a[i] = i;
  return a;
})();

function valueOf(field: string, i: number): string | number | undefined {
  switch (field) {
    case "hub": return TERMINALS[T[i]].regional_hub;
    case "terminal": return TERMINALS[T[i]].terminal_label;
    case "vessel_category": return VESSELS[V[i]].vessel_category;
    case "day_label": return DATES[D[i]].day_label;
    case "year": return DATES[D[i]].fiscal_year;
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

export function derived<T2>(fn: (rows: Idx) => T2, filters: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(filters()));
    const ms = performance.now() - t0;
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

// --- measures. Rule 1: no rate. ---------------------------------------------------------
export const movements = (rows: Idx) => rows.length;
export function containers(rows: Idx) { let s = 0; for (const i of rows) s += CC[i]; return s; }
/** Hours. Reported only alongside its range, never as a lone central tendency. */
export function durationStats(rows: Idx) {
  if (!rows.length) return { mean: 0, min: 0, max: 0, n: 0 };
  let s = 0, lo = Infinity, hi = -Infinity;
  for (const i of rows) { const d = DUR[i]; s += d; if (d < lo) lo = d; if (d > hi) hi = d; }
  return { mean: s / rows.length / 60, min: lo / 60, max: hi / 60, n: rows.length };
}

/** ③ The signature. Counts per bin on the FIXED domain, never auto-fitted. */
export function histogram(rows: Idx, bins = BINS): number[] {
  const [lo, hi] = DURATION_DOMAIN;
  const w = (hi - lo) / bins;
  const out = new Array(bins).fill(0);
  for (const i of rows) {
    const h = DUR[i] / 60;
    let b = Math.floor((h - lo) / w);
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    out[b]++;
  }
  return out;
}

export type Overlay = {
  key: string; field: string; value: string | number;
  /** rescaled to the full-sample total - only for legend ordering, NOT for drawing */
  counts: number[];
  /** the cut's OWN per-bin counts and n. Small multiples draw these, at their own scale. */
  rawCounts: number[]; nRaw: number; n: number;
};

/**
 * The eight real cut-overlays. Each is a genuine histogram of that subset, rescaled to the
 * full-sample total so the shapes are comparable. Rescaling is stated on the chart; without
 * it a 3,000-row year and a 15,000-row whole cannot be read on one axis.
 */
export function overlays(rows: Idx, bins = BINS): Overlay[] {
  const groups = new Map<string, { field: string; value: string | number; idx: number[] }>();
  const push = (field: string, value: string | number, i: number) => {
    const k = `${field}:${value}`;
    let g = groups.get(k);
    if (!g) { g = { field, value, idx: [] }; groups.set(k, g); }
    g.idx.push(i);
  };
  for (const i of rows) {
    push("hub", TERMINALS[T[i]].regional_hub, i);
    push("vessel_category", VESSELS[V[i]].vessel_category, i);
    push("day_label", DATES[D[i]].day_label, i);
    push("year", DATES[D[i]].fiscal_year, i);
  }
  const total = rows.length || 1;
  return [...groups].map(([key, g]) => {
    const counts = histogram(Int32Array.from(g.idx), bins);
    const scale = total / (g.idx.length || 1);
    return { key, field: g.field, value: g.value, n: g.idx.length,
             rawCounts: counts, nRaw: g.idx.length,
             counts: counts.map((c) => c * scale) };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

/** ④ The one real signal, carrying its warning. */
export function growth(rows: Idx) {
  const byYear = new Map<number, number>();
  for (const i of rows) {
    const y = DATES[D[i]].fiscal_year;
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  return YEARS.map((y) => ({
    year: y.fiscal_year,
    movements: byYear.get(y.fiscal_year) ?? 0,
    isSuezYear: y.is_suez_year,
    yoyPct: y.yoy_pct,
  })).sort((a, b) => a.year - b.year);
}

/** ⑤ The empty window - March 2021 at daily resolution. */
export function suezWindow(rows: Idx) {
  const inRange = new Map<number, { n: number; inWeek: boolean }>();
  for (const d of DATES) {
    const ym = Math.floor(d.date_key / 100);
    if (ym === 202103) inRange.set(d.date_key, { n: 0, inWeek: d.in_suez_week });
  }
  for (const i of rows) {
    const e = inRange.get(DATES[D[i]].date_key);
    if (e) e.n++;
  }
  return [...inRange].map(([k, e]) => ({ dateKey: k, day: k % 100, ...e }))
    .sort((a, b) => a.dateKey - b.dateKey);
}

/** Terminal table - web only. Movements and the duration RANGE, never a rate. */
export function byTerminal(rows: Idx) {
  const m = new Map<number, number[]>();
  for (const i of rows) {
    let a = m.get(T[i]);
    if (!a) { a = []; m.set(T[i], a); }
    a.push(DUR[i]);
  }
  return TERMINALS.map((t, j) => {
    const a = m.get(j) ?? [];
    return {
      id: t.terminal_id, label: t.terminal_label, hub: t.regional_hub,
      movements: a.length,
      min: a.length ? Math.min(...a) / 60 : 0,
      max: a.length ? Math.max(...a) / 60 : 0,
    };
  }).sort((a, b) => b.movements - a.movements);
}

export function byHub(rows: Idx) {
  const m = new Map<string, number>();
  for (const i of rows) {
    const h = TERMINALS[T[i]].regional_hub;
    m.set(h, (m.get(h) ?? 0) + 1);
  }
  const stores = new Map<string, number>();
  for (const t of TERMINALS) stores.set(t.regional_hub, (stores.get(t.regional_hub) ?? 0) + 1);
  return [...m].map(([k, n]) => ({ hub: k, movements: n, terminals: stores.get(k) ?? 0 }))
    .sort((a, b) => b.movements - a.movements);
}

export function defects(rows: Idx) {
  let bad = 0;
  for (const i of rows) bad += BAD[i];
  return { corruptRows: bad, corruptPct: rows.length ? (bad / rows.length) * 100 : 0 };
}

// --- formatters -------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-GB");
export const int = (n: number) => nf.format(Math.round(n));
export const dec = (n: number, d = 2) => n.toFixed(d);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
export const signed = (n: number, d = 1) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d) + "%";
export const sci = (n: number) => (n < 0.001 ? n.toExponential(1) : n.toFixed(4));
export const hours = (n: number) => dec(n, 0) + "h";
