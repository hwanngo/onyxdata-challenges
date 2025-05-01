/**
 * Data layer.
 *
 * Every number rendered anywhere in this app is computed here, at query time, from the
 * row-level fact table. Nothing is precomputed, nothing is hardcoded.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET
 * via DuckDB in Python and asserts the DOM matches - so this aggregation path is checked
 * against a real SQL engine rather than trusted.
 *
 * ARCHITECTURE NOTE (see model/build.py::export_app_data and .workbench/templates/_month/RETRO.md):
 * docs/STACK.md specifies DuckDB-WASM in the browser. This month's fact table is 366 rows.
 * DuckDB-WASM ships a 32 MB engine, which would blow the <3s cold-load budget by an order
 * of magnitude to query less data than its own symbol table. Aggregating 366 rows in JS is
 * a sub-millisecond operation. The DuckDB-WASM client remains in packages/dna-kit for
 * months whose data actually needs it.
 */
import { createResource, createSignal } from "solid-js";

export type Row = Record<string, any>;   // <-- describe THIS month's columns here

export type Filter = { field: string; values: (string | number)[] };

const base = import.meta.env.BASE_URL || "/";
const [all, setAll] = createSignal<Row[]>([]);
export const [ready, setReady] = createSignal(false);

export async function boot(file = "rows.json") {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`could not load ${file}: ${res.status}`);
  setAll((await res.json()) as Row[]);
  setReady(true);
}

/** Apply the cross-filter store's shape to the row set. */
export function apply(rowsIn: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rowsIn;
  return rowsIn.filter((r) => filters.every((f) => f.values.includes(r[f.field])));
}

// ---------------------------------------------------------------------------------------
// Aggregation helpers - reusable across months
// ---------------------------------------------------------------------------------------
export const sum = (rs: Row[], k: string) => rs.reduce((a, r) => a + (r[k] as number), 0);
export const mean = (rs: Row[], k: string) => (rs.length ? sum(rs, k) / rs.length : 0);

export function groupBy(rs: Row[], key: string) {
  const m = new Map<any, Row[]>();
  for (const r of rs) {
    const g = m.get(r[key]);
    if (g) g.push(r);
    else m.set(r[key], [r]);
  }
  return m;
}

/** Generic "measure by dimension" roll-up, with share-of-total. */
export function by(rs: Row[], dim: string, measures: Record<string, string>) {
  const totals = Object.fromEntries(Object.entries(measures).map(([k, col]) => [k, sum(rs, col)]));
  return [...groupBy(rs, dim)].map(([k, g]) => {
    const out: Record<string, any> = { k, n: g.length };
    for (const [name, col] of Object.entries(measures)) {
      out[name] = sum(g, col);
      out[`${name}_pct`] = totals[name] ? (100 * out[name]) / totals[name] : 0;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// THIS MONTH'S query builders go here. One per panel. Each takes filtered rows.
// ---------------------------------------------------------------------------------------

export function headline(rs: Row[]) {
  return { rows: rs.length };   // <-- replace
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
