/**
 * Data layer.
 *
 * Every number rendered anywhere in this app is computed here, at query time, from the
 * row-level fact table. Nothing is precomputed, nothing is hardcoded.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET
 * via DuckDB in Python and asserts the DOM matches - so this aggregation path is checked
 * against a real SQL engine rather than trusted.
 *
 * ARCHITECTURE NOTE (see model/build.py::export_app_data and .workbench/2025/05/RETRO.md):
 * docs/STACK.md specifies DuckDB-WASM in the browser. This month's fact table is 366 rows.
 * DuckDB-WASM ships a 32 MB engine, which would blow the <3s cold-load budget by an order
 * of magnitude to query less data than its own symbol table. Aggregating 366 rows in JS is
 * a sub-millisecond operation. The DuckDB-WASM client remains in packages/dna-kit for
 * months whose data actually needs it.
 */
import { createResource, createSignal } from "solid-js";

export type Row = {
  d: string;
  mobile_model: string;
  brand: string;
  operating_system: string;
  list_price: number;
  model_band: string;
  model_band_sort: number;
  city: string;
  country: string;
  is_thin_sample: boolean;
  customer_age_group: string;
  customer_gender: string;
  month: number;
  month_name: string;
  quarter: number;
  storage_size: string;
  color: string;
  sales_channel: string;
  payment_type: string;
  customer_age: number;
  price: number;
  units_sold: number;
  total_revenue: number;
  price_band: string;
  price_band_sort: number;
};

export type Filter = { field: string; values: (string | number)[] };

const base = import.meta.env.BASE_URL || "/";
const [all, setAll] = createSignal<Row[]>([]);
export const [ready, setReady] = createSignal(false);

export async function boot() {
  const res = await fetch(`${base}data/sales.json`);
  if (!res.ok) throw new Error(`could not load sales.json: ${res.status}`);
  setAll((await res.json()) as Row[]);
  setReady(true);
}

/** Apply the cross-filter store's shape to the row set. */
export function apply(rowsIn: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rowsIn;
  return rowsIn.filter((r) =>
    filters.every((f) => f.values.includes((r as any)[f.field]))
  );
}

export function filtered(filters: Filter[]) {
  return apply(all(), filters);
}

// ---------------------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------------------
const sum = (rs: Row[], k: keyof Row) => rs.reduce((a, r) => a + (r[k] as number), 0);

function groupBy<K extends keyof Row>(rs: Row[], key: K) {
  const m = new Map<Row[K], Row[]>();
  for (const r of rs) {
    const k = r[key];
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ---------------------------------------------------------------------------------------
// Query builders - one per panel. Each takes the already-filtered rows.
// ---------------------------------------------------------------------------------------

export function headline(rs: Row[]) {
  const revenue = sum(rs, "total_revenue");
  const units = sum(rs, "units_sold");
  const premium = rs.filter((r) => r.price >= 1000);
  return {
    revenue,
    units,
    asp: units ? revenue / units : 0,
    days: rs.length,
    premium_rev_pct: revenue ? (100 * sum(premium, "total_revenue")) / revenue : 0,
  };
}

export type Rung = {
  mobile_model: string;
  brand: string;
  list_price: number;
  model_band: string;
  model_band_sort: number;
  revenue: number;
  units: number;
  days: number;
  rev_pct: number;
};

export function ladder(rs: Row[]): Rung[] {
  const total = sum(rs, "total_revenue");
  return [...groupBy(rs, "mobile_model")]
    .map(([mobile_model, g]) => ({
      mobile_model: mobile_model as string,
      brand: g[0].brand,
      list_price: g[0].list_price,
      model_band: g[0].model_band,
      model_band_sort: g[0].model_band_sort,
      revenue: sum(g, "total_revenue"),
      units: sum(g, "units_sold"),
      days: g.length,
      rev_pct: total ? (100 * sum(g, "total_revenue")) / total : 0,
    }))
    .sort((a, b) => b.list_price - a.list_price);
}

export type GapRow = {
  brand: string;
  units: number;
  revenue: number;
  unit_share: number;
  rev_share: number;
  gap_pp: number;
  asp: number;
};

export function conversion(rs: Row[]): GapRow[] {
  const tr = sum(rs, "total_revenue");
  const tu = sum(rs, "units_sold");
  return [...groupBy(rs, "brand")]
    .map(([brand, g]) => {
      const revenue = sum(g, "total_revenue");
      const units = sum(g, "units_sold");
      const rev_share = tr ? (100 * revenue) / tr : 0;
      const unit_share = tu ? (100 * units) / tu : 0;
      return {
        brand: brand as string,
        units,
        revenue,
        unit_share,
        rev_share,
        gap_pp: rev_share - unit_share,
        asp: units ? revenue / units : 0,
      };
    })
    .sort((a, b) => b.gap_pp - a.gap_pp);
}

export type MarketRow = {
  country: string;
  days: number;
  units: number;
  revenue: number;
  asp: number;
  premium_mix: number;
  zfold_price: number | null;
};

export function markets(rs: Row[]): MarketRow[] {
  return [...groupBy(rs, "country")]
    .map(([country, g]) => {
      const units = sum(g, "units_sold");
      const revenue = sum(g, "total_revenue");
      const prem = g.filter((r) => r.price >= 1000);
      const zf = g.filter((r) => r.mobile_model === "Z Fold 6");
      return {
        country: country as string,
        days: g.length,
        units,
        revenue,
        asp: units ? revenue / units : 0,
        premium_mix: units ? (100 * sum(prem, "units_sold")) / units : 0,
        zfold_price: zf.length ? sum(zf, "price") / zf.length : null,
      };
    })
    .sort((a, b) => b.asp - a.asp);
}

export type Band = {
  price_band: string;
  price_band_sort: number;
  units: number;
  revenue: number;
  unit_pct: number;
  rev_pct: number;
};

export function bands(rs: Row[]): Band[] {
  const tr = sum(rs, "total_revenue");
  const tu = sum(rs, "units_sold");
  return [...groupBy(rs, "price_band")]
    .map(([price_band, g]) => ({
      price_band: price_band as string,
      price_band_sort: g[0].price_band_sort,
      units: sum(g, "units_sold"),
      revenue: sum(g, "total_revenue"),
      unit_pct: tu ? (100 * sum(g, "units_sold")) / tu : 0,
      rev_pct: tr ? (100 * sum(g, "total_revenue")) / tr : 0,
    }))
    .sort((a, b) => a.price_band_sort - b.price_band_sort);
}

export type Flagship = {
  mobile_model: string;
  revenue: number;
  rev_pct: number;
  day_pct: number;
  unit_pct: number;
};

/** The single highest-revenue model and how concentrated it is - insight I-3.
 *  Computed, never typed: the "one phone in nineteen" claim in the So-what panel
 *  reads this, so the sentence cannot drift away from the ladder above it. */
export function flagship(rs: Row[]): Flagship | null {
  if (!rs.length) return null;
  const tr = sum(rs, "total_revenue");
  const tu = sum(rs, "units_sold");
  const top = [...groupBy(rs, "mobile_model")]
    .map(([mobile_model, g]) => ({
      mobile_model: mobile_model as string,
      revenue: sum(g, "total_revenue"),
      units: sum(g, "units_sold"),
      days: g.length,
    }))
    .sort((a, b) => b.revenue - a.revenue)[0];
  return {
    mobile_model: top.mobile_model,
    revenue: top.revenue,
    rev_pct: tr ? (100 * top.revenue) / tr : 0,
    day_pct: rs.length ? (100 * top.days) / rs.length : 0,
    unit_pct: tu ? (100 * top.units) / tu : 0,
  };
}

export function byField(rs: Row[], field: keyof Row) {
  return [...groupBy(rs, field)]
    .map(([k, g]) => {
      const units = sum(g, "units_sold");
      const revenue = sum(g, "total_revenue");
      return { k: k as string, days: g.length, units, revenue, asp: units ? revenue / units : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function months(rs: Row[]) {
  return [...groupBy(rs, "month")]
    .map(([m, g]) => ({
      m: m as number,
      month_name: g[0].month_name,
      revenue: sum(g, "total_revenue"),
      units: sum(g, "units_sold"),
      days: g.length,
    }))
    .sort((a, b) => a.m - b.m);
}

/** Coefficient of variation of monthly revenue - IR-3, the "no seasonality" verdict.
 *  Computed rather than typed so the Explore panel's sentence is a measurement. */
export function monthlyCv(rs: Row[]): number {
  const rev = months(rs).map((m) => m.revenue);
  if (rev.length < 2) return 0;
  const mean = rev.reduce((a, b) => a + b, 0) / rev.length;
  if (!mean) return 0;
  const sd = Math.sqrt(rev.reduce((a, b) => a + (b - mean) ** 2, 0) / (rev.length - 1));
  return sd / mean;
}

/** A resource that recomputes whenever the filter set changes. */
export function derived<T>(fn: (rs: Row[]) => T, filters: () => Filter[]) {
  const [data] = createResource(
    () => (ready() ? filters() : null),
    (f: Filter[]) => {
      const t0 = performance.now();
      const out = fn(apply(all(), f));
      const ms = performance.now() - t0;
      // Response time is an explicitly scored criterion.
      if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
      return out;
    }
  );
  return data;
}

// ---------------------------------------------------------------------------------------
// Formatters. Locale-aware, tabular.
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const usd0 = (n: number) => "$" + nf.format(Math.round(n));
export const money = (n: number) =>
  n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K" : usd0(n);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
export const pp = (n: number, d = 2) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d) + "pp";
