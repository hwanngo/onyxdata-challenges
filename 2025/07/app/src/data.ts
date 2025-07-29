/**
 * Data layer - 2025/07.
 *
 * Every number is computed here at query time from the 120-row customer table.
 * tools/verify_metrics.py recomputes each rendered figure from the PARQUET via DuckDB
 * and asserts the DOM matches.
 *
 * THE RULE THIS MONTH: no mean is ever returned without its `n` and its confidence
 * interval. With 120 customers a group mean on its own is misleading, so the types make
 * it impossible to render one - every estimate carries `n`, `ci`, and `underpowered`.
 */
import { createResource, createSignal } from "solid-js";

export type Row = {
  customer_key: number;
  source_customer_id: string;
  satisfaction_score: number;
  age: number;
  age_band: string;
  gender: string;
  group: string;
  loyalty_level: string;
  purchase_history: string;
  support_contacted: string;
  satisfaction_factor: string;
  city: string;
  state: string;
  location: string;
  latitude: number;
  longitude: number;
};

export type Filter = { field: string; values: (string | number)[] };

/** Smallest two-group difference detectable at 80% power with n per group, given sd. */
export const MIN_POWERED_N = 64;
export const Z_ALPHA = 1.96;
export const Z_POWER = 0.8416;

const base = import.meta.env.BASE_URL || "/";
const [all, setAll] = createSignal<Row[]>([]);
export const [ready, setReady] = createSignal(false);

export async function boot() {
  const res = await fetch(`${base}data/customers.json`);
  if (!res.ok) throw new Error(`could not load customers.json: ${res.status}`);
  setAll((await res.json()) as Row[]);
  setReady(true);
}

export function apply(rowsIn: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rowsIn;
  return rowsIn.filter((r) => filters.every((f) => f.values.includes((r as any)[f.field])));
}

export const allRows = () => all();

// ---------------------------------------------------------------------------------------
// An estimate is a mean, its n, and its uncertainty. Never just a mean.
// ---------------------------------------------------------------------------------------
export type Estimate = {
  k: string;
  n: number;
  mean: number;
  sd: number;
  ci: number;            // 95% half-width
  lo: number;
  hi: number;
  mdd: number;           // minimum detectable difference at this n
  underpowered: boolean;
};

function estimate(k: string, xs: number[]): Estimate {
  const n = xs.length;
  const mean = n ? xs.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const ci = n ? (Z_ALPHA * sd) / Math.sqrt(n) : 0;
  const mdd = n ? Math.sqrt((2 * (Z_ALPHA + Z_POWER) ** 2) / n) * sd : 0;
  return {
    k, n, mean, sd, ci,
    lo: Math.max(1, mean - ci), hi: Math.min(10, mean + ci),
    mdd, underpowered: n < MIN_POWERED_N,
  };
}

function groupBy(rs: Row[], key: keyof Row) {
  const m = new Map<any, Row[]>();
  for (const r of rs) {
    const g = m.get(r[key]);
    if (g) g.push(r);
    else m.set(r[key], [r]);
  }
  return m;
}

export function estimatesBy(rs: Row[], field: keyof Row, label?: (k: string) => string): Estimate[] {
  return [...groupBy(rs, field)]
    .map(([k, g]) => estimate(label ? label(String(k)) : String(k),
                              g.map((r) => r.satisfaction_score)))
    .sort((a, b) => b.mean - a.mean);
}

/** THE UNCERTAINTY LADDER - every group in the study on one shared axis.
 *
 *  Six axes with 2-6 levels each, 17 groups in all. `satisfaction_factor` is deliberately
 *  NOT here: it splits 120 customers ten ways, and it is the one axis whose own levels do
 *  not all overlap. It is available behind a toggle (`factorLadder`) so the reader can see
 *  the exception rather than take the caption's word for it - see insights I-7, which
 *  records both the 17-group scoping and what changes when the seventh axis is added.
 */
export const LADDER_AXES: [keyof Row, string][] = [
  ["support_contacted", "Support contacted"],
  ["loyalty_level", "Loyalty"],
  ["purchase_history", "Repeat buyer"],
  ["gender", "Gender"],
  ["group", "Group"],
  ["state", "State"],
];

export function ladder(rs: Row[]): Estimate[] {
  const out: Estimate[] = [];
  for (const [field, prefix] of LADDER_AXES) {
    for (const e of estimatesBy(rs, field)) out.push({ ...e, k: `${prefix}: ${e.k}` });
  }
  return out;
}

/** The seventh axis - ten levels - held back from the default ladder. R1's effect lives here. */
export function factorLadder(rs: Row[]): Estimate[] {
  return estimatesBy(rs, "satisfaction_factor").map((e) => ({ ...e, k: `Factor: ${e.k}` }));
}

/**
 * How many pairs of intervals FAIL to overlap, computed from whatever is drawn.
 *
 * The caption used to assert "every interval overlaps every other". That is true of the six
 * default axes and false the moment the factor axis is added, so the assertion is computed
 * here instead of typed. A claim that recomputes cannot go stale under a cross-filter.
 */
export function separatedPairs(rows: Estimate[]): number {
  let k = 0;
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++)
      if (rows[i].hi < rows[j].lo || rows[j].hi < rows[i].lo) k++;
  return k;
}

/**
 * Spread between the highest and lowest estimate, both across the whole ladder and as the
 * worst gap WITHIN a single axis.
 *
 * The distinction matters: the detection floor is a two-group comparison, so it licenses a
 * claim about two levels of the same axis (max 1.371 unfiltered) and NOT about, say, State:
 * IL against Loyalty: Medium (1.883 unfiltered) - which are different customers cut two
 * different ways and were never a comparison the study proposed.
 */
export function spreadReport(rows: Estimate[]) {
  if (!rows.length) return { cross: 0, within: 0, withinAxis: "" };
  const means = rows.map((e) => e.mean);
  const byAxis = new Map<string, number[]>();
  for (const e of rows) {
    const axis = e.k.includes(": ") ? e.k.slice(0, e.k.indexOf(": ")) : e.k;
    const g = byAxis.get(axis);
    if (g) g.push(e.mean);
    else byAxis.set(axis, [e.mean]);
  }
  let within = 0;
  let withinAxis = "";
  for (const [axis, ms] of byAxis) {
    const s = Math.max(...ms) - Math.min(...ms);
    if (s > within) { within = s; withinAxis = axis; }
  }
  return { cross: Math.max(...means) - Math.min(...means), within, withinAxis };
}

export function overall(rs: Row[]): Estimate {
  return estimate("All customers", rs.map((r) => r.satisfaction_score));
}

/**
 * R4 - the brief's headline question, as a pair.
 *
 * The difference now carries its own 95% interval. Reporting +0.013 alone invited the
 * reading "the effect is zero"; the interval (-1.08 to +1.10 unfiltered) says what is
 * actually true - a full point of damage in either direction is entirely consistent with
 * this data. The finding is "unmeasured", not "zero", and only the interval shows that.
 */
export function supportEffect(rs: Row[]) {
  const es = estimatesBy(rs, "support_contacted");
  const yes = es.find((e) => e.k === "Yes");
  const no = es.find((e) => e.k === "No");
  const diff = yes && no ? yes.mean - no.mean : 0;
  const pooled = yes && no ? Math.sqrt((yes.sd ** 2 + no.sd ** 2) / 2) : 0;
  // Welch standard error of the difference, normal approximation - the same Z_ALPHA the
  // group intervals use, so the two read on one scale.
  const se = yes && no && yes.n && no.n
    ? Math.sqrt(yes.sd ** 2 / yes.n + no.sd ** 2 / no.n)
    : 0;
  return {
    yes, no, diff, d: pooled ? diff / pooled : 0,
    diffLo: diff - Z_ALPHA * se,
    diffHi: diff + Z_ALPHA * se,
  };
}

/**
 * I-4 - what it would take. Computed, never hardcoded.
 *
 * DEGENERATE STATES ARE STATES. The cross-filter can leave zero rows (State: NY × City:
 * Houston) or a handful with no spread, and the arithmetic below then produces garbage
 * that looks like data: sd=0 makes `diff/sd` infinite, so `need` came out as a confident
 * **0 customers per group**, and `perGroup=0` made the MDD `NaN`, which the standfirst
 * rendered as "the smallest difference this study could detect is NaN points".
 *
 * A required sample size is undefined without an sd, so `need` and `mdd` are `null` there
 * rather than a number. Nulls are contagious on purpose - every call site has to decide
 * what to print, and the only honest thing to print is "not estimable".
 */
export type PowerTable = {
  sd: number;
  perGroup: number;
  estimable: boolean;
  rows: { diff: number; need: number | null; have: number }[];
  mdd: number | null;
};

export function powerTable(rs: Row[]): PowerTable {
  const sd = overall(rs).sd;
  const perGroup = Math.floor(rs.length / 2);
  // Two customers is the minimum for a sample sd, and an sd of exactly zero (every score
  // identical) makes the effect size infinite rather than large.
  const estimable = rs.length >= 2 && sd > 0 && perGroup >= 1;
  return {
    sd, perGroup, estimable,
    rows: [0.5, 1.0, 1.5, 2.0].map((diff) => ({
      diff,
      need: estimable ? Math.ceil(((Z_ALPHA + Z_POWER) ** 2 * 2) / (diff / sd) ** 2) : null,
      have: perGroup,
    })),
    mdd: estimable ? Math.sqrt((2 * (Z_ALPHA + Z_POWER) ** 2) / perGroup) * sd : null,
  };
}

export function distribution(rs: Row[]) {
  const counts = new Map<number, number>();
  for (let s = 1; s <= 10; s++) counts.set(s, 0);
  for (const r of rs) counts.set(r.satisfaction_score, (counts.get(r.satisfaction_score) ?? 0) + 1);
  return [...counts].map(([score, n]) => ({ score, n }));
}

export function derived<T>(fn: (rs: Row[]) => T, filters: () => Filter[]) {
  const [data] = createResource(
    () => (ready() ? filters() : null),
    (f: Filter[]) => {
      const t0 = performance.now();
      const out = fn(apply(all(), f));
      const ms = performance.now() - t0;
      if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
      return out;
    }
  );
  return data;
}

const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const dec = (n: number, d = 2) => n.toFixed(d);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";

/**
 * Render a figure that may not exist. An em dash is honest; "NaN" and a fabricated 0 are
 * not, and both were reachable from the cross-filter before 2025-07-29.
 */
export const maybe = (n: number | null | undefined, fmt: (v: number) => string) =>
  n == null || !Number.isFinite(n) ? "-" : fmt(n);
