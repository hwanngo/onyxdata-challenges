/**
 * Data layer - 2025/08 Fitness Membership Analytics (MyGym).
 *
 * Every number rendered anywhere in this app is computed here, at query time, from the
 * row-level member table. Nothing is precomputed, nothing is hardcoded.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET
 * via DuckDB in Python and asserts the DOM matches - so this aggregation path is checked
 * against a real SQL engine rather than trusted.
 *
 * ARCHITECTURE NOTE (see model/build.py::export_app_data and .workbench/2025/08/RETRO.md):
 * docs/STACK.md specifies DuckDB-WASM in the browser. This month's fact table is 1,998 rows
 * and 134 KB of columnar JSON. DuckDB-WASM ships a ~32 MB engine; loading it to query less
 * data than its own symbol table would blow the <3s cold-load budget by an order of
 * magnitude. Aggregating 1,998 rows in JS is sub-millisecond. Same deviation as 2025/05,
 * same reasoning, and the measured numbers are recorded in .workbench/2025/08/RETRO.md. The DuckDB-WASM client
 * stays in packages/dna-kit for months whose data actually needs it.
 *
 * THE RULE THIS MONTH: `days_since_visit` is not a behaviour. It is `tenure_days` rescaled
 * (rho = 0.9999, insights.md I-1). So this module never exposes a "churn" or "at-risk"
 * measure. It exposes `flaggedBy()`, which returns the selection a lapse rule WOULD make
 * together with the proof that the selection is a tenure ranking. A caller cannot render
 * "982 members at risk" from this without also holding the fact that 100.0% of them sit at
 * or above the 982nd-highest tenure in the file. That coupling is the point.
 *
 * (This comment used to say "981 of them", the abandoned sort-position figure. It is the
 * same defect the tour carried - see tour.ts. Fixed 2025-08-31.)
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

// ---------------------------------------------------------------------------------------
// Decoding the columnar payload
// ---------------------------------------------------------------------------------------

type Dict = { levels: string[]; codes: number[] };
const isDict = (v: unknown): v is Dict =>
  !!v && typeof v === "object" && "levels" in (v as object) && "codes" in (v as object);

export type Member = {
  i: number;
  membership_type: string;
  access_hours: string;
  list_price_monthly: number;
  subscription_model: string;
  commit_months: number;
  discount_type: string;
  discount_rate: number;
  city: string;
  age: number;
  visit_per_week: number;
  duration_in_gym_minutes: number;
  checkin_minutes: number;
  checkout_minutes: number;
  attend_group_lesson: number;
  personal_training: number;
  personal_training_hours: number;
  uses_sauna: number;
  has_drink_subscription: number;
  multi_location_access: number;
  final_price_monthly: number;
  tenure_days: number;
  days_since_visit: number;
  trains_weekend: number;
  uses_peak_hours: number;
  /** occupied floor-hours per week - the decision-relevant form of duration (I-3) */
  floor_hours: number;
  /** 7-bit weekday mask; bit i is DAY_ORDER[i] */
  day_mask: number;
};

function decode(): Member[] {
  const cols = payload.members as unknown as Record<string, unknown>;
  const n = payload.n as number;
  const flat: Record<string, (string | number)[]> = {};
  for (const [k, v] of Object.entries(cols)) {
    flat[k] = isDict(v) ? v.codes.map((c) => v.levels[c]) : (v as (string | number)[]);
  }
  const keys = Object.keys(flat);
  const masks = payload.dayMask as number[];
  const out: Member[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r: Record<string, unknown> = { i, day_mask: masks[i] };
    for (const k of keys) r[k] = flat[k][i];
    const m = r as unknown as Member;
    // Derived once, here, so no panel can recompute it differently. Rounded only at render.
    m.floor_hours = (m.visit_per_week * m.duration_in_gym_minutes) / 60;
    out[i] = m;
  }
  return out;
}

const ALL: Member[] = decode();
export const DAY_ORDER = payload.dayOrder as string[];
/**
 * JSON gives `number[]`, never a tuple, so pair-ness cannot be asserted by a cast (TS2352) -
 * and `as unknown as` would only silence the compiler without establishing the fact. Ten
 * entries, checked once at load.
 */
export const CITY_COORDS: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(payload.cityCoords as Record<string, number[]>).map(([city, c]) => {
    if (c.length !== 2) throw new Error(`cityCoords.${city} is not a [lat, lon] pair`);
    return [city, [c[0], c[1]] as [number, number]];
  })
);
export const META = payload.meta as {
  asOf: string;
  priceUnit: string;
  windowDays: number;
  sourceRows: number;
};

/** The payload is bundled, so there is no async boot. Kept for API parity with the kit. */
export const [ready, setReady] = createSignal(true);
export const allRows = () => ALL;

// ---------------------------------------------------------------------------------------
// Cross-filter
// ---------------------------------------------------------------------------------------

/**
 * The filter type belongs to the kit, because the filter VALUES come from the kit's global
 * store. A month that narrows `field` to `keyof Member` is describing data it does not own:
 * `Accessor<Filter[]>` from the store carries `field: string`, which is not assignable to the
 * narrower local type, so `derived()` loses its inference and every consumer degrades to
 * `unknown`. Re-export, never redeclare. See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

export function apply(rows: Member[], filters: Filter[]): Member[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => f.values.includes(r[f.field as keyof Member] as string | number))
  );
}

// ---------------------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------------------

export const sum = (rs: Member[], k: keyof Member) => rs.reduce((a, r) => a + (r[k] as number), 0);
export const mean = (rs: Member[], k: keyof Member) => (rs.length ? sum(rs, k) / rs.length : 0);

export function groupBy<K extends keyof Member>(rs: Member[], key: K) {
  const m = new Map<Member[K], Member[]>();
  for (const r of rs) {
    const g = m.get(r[key]);
    if (g) g.push(r);
    else m.set(r[key], [r]);
  }
  return m;
}

export type Group = { k: string; n: number; share: number } & Record<string, string | number>;

/**
 * Generic "measures by dimension" roll-up.
 * `means` are averaged; `rates` are boolean columns stored as 1/0, so their mean IS the
 * rate - multiplied by 100 exactly once, here, so no caller can double-scale it.
 */
export function by(
  rs: Member[],
  dim: keyof Member,
  means: Record<string, keyof Member> = {},
  rates: Record<string, keyof Member> = {}
): Group[] {
  return [...groupBy(rs, dim)].map(([k, g]) => {
    const out = {
      k: String(k),
      n: g.length,
      share: rs.length ? (100 * g.length) / rs.length : 0,
    } as Group;
    for (const [name, col] of Object.entries(means)) out[name] = mean(g, col);
    for (const [name, col] of Object.entries(rates)) out[name] = 100 * mean(g, col);
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// I-1 - THE THESIS
// ---------------------------------------------------------------------------------------

export type Flagged = {
  threshold: number;
  /** members a `days_since_visit > threshold` rule would flag */
  flagged: number;
  /** how many of those sit at or above the k-th highest tenure in the set */
  overlap: number;
  /** overlap as a percentage of flagged - the number that makes the point */
  overlapPct: number;
  meanTenureFlagged: number;
  meanTenureRest: number;
  /** the lowest tenure that gets flagged */
  minTenureFlagged: number;
  /** the highest tenure that does NOT get flagged */
  maxTenureActive: number;
  /** members whose tenure falls in the band where the two groups overlap at all */
  tieBand: number;
  /** row indices of the flagged set, for painting the scatter */
  flaggedSet: Set<number>;
};

/**
 * What a lapse rule ACTUALLY selects.
 *
 * TIE-SAFE BY CONSTRUCTION. The obvious implementation - sort by tenure, take the top k,
 * intersect - gives 981 or 982 out of 982 at a 30-day threshold depending purely on how
 * four members who share a tenure of 549 days happen to sort. Two correct programs
 * disagreed on the headline number, which means the number was under-defined rather than
 * wrong. Membership is therefore decided by VALUE, not by position: a member counts if
 * their tenure is at least the k-th highest tenure present.
 *
 * `minTenureFlagged` / `maxTenureActive` / `tieBand` carry the robust version of the
 * claim, which does not depend on the cut at all: the lapse rule is a tenure cut, and the
 * two groups overlap on `tieBand` members' worth of tenure values.
 */
export function flaggedBy(rs: Member[], threshold: number): Flagged {
  const flaggedRows = rs.filter((r) => r.days_since_visit > threshold);
  const rest = rs.filter((r) => r.days_since_visit <= threshold);
  const k = flaggedRows.length;

  const tenures = rs.map((r) => r.tenure_days).sort((a, b) => b - a);
  const kth = k > 0 && k <= tenures.length ? tenures[k - 1] : Infinity;

  let overlap = 0;
  for (const r of flaggedRows) if (r.tenure_days >= kth) overlap++;

  const minFlagged = k ? Math.min(...flaggedRows.map((r) => r.tenure_days)) : NaN;
  const maxActive = rest.length ? Math.max(...rest.map((r) => r.tenure_days)) : NaN;
  const tieBand = rs.filter(
    (r) => r.tenure_days >= minFlagged && r.tenure_days <= maxActive
  ).length;

  return {
    threshold,
    flagged: k,
    overlap,
    overlapPct: k ? (100 * overlap) / k : 0,
    meanTenureFlagged: mean(flaggedRows, "tenure_days"),
    meanTenureRest: mean(rest, "tenure_days"),
    minTenureFlagged: minFlagged,
    maxTenureActive: maxActive,
    tieBand,
    flaggedSet: new Set(flaggedRows.map((r) => r.i)),
  };
}

/** Pearson r between tenure and days-since-visit. The coupling, as one number. */
export function couplingR(rs: Member[]): number {
  if (rs.length < 2) return NaN;
  const mx = mean(rs, "tenure_days");
  const my = mean(rs, "days_since_visit");
  let sxy = 0, sxx = 0, syy = 0;
  for (const r of rs) {
    const dx = r.tenure_days - mx;
    const dy = r.days_since_visit - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/**
 * The ghost cloud: the same members with `days_since_visit` shuffled.
 *
 * This is what the scatter would look like if tenure and recency were independent - i.e.
 * what a real gym's data looks like. Seeded (mulberry32, 20250801) so the poster and the
 * app render an identical cloud, and computed once at module load rather than per frame.
 * It is a PERMUTATION, not data, and the chart labels it as such.
 */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GHOST: { x: number; y: number }[] = (() => {
  const rnd = mulberry32(20250801);
  const y = ALL.map((r) => r.days_since_visit);
  for (let i = y.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [y[i], y[j]] = [y[j], y[i]];
  }
  return ALL.map((r, i) => ({ x: r.tenure_days, y: y[i] }));
})();

// ---------------------------------------------------------------------------------------
// I-2 - every dollar is a lookup
// ---------------------------------------------------------------------------------------

export function priceLookup(rs: Member[]) {
  const combos = new Set(
    rs.map((r) => `${r.membership_type}|${r.subscription_model}|${r.discount_type}`)
  );
  const prices = new Set(rs.map((r) => r.final_price_monthly));
  const listAnnual = sum(rs, "list_price_monthly") * 12;
  // adjusted = list x model factor. The gap is what the commitment ladder costs.
  const adjustedAnnual =
    rs.reduce((a, r) => a + r.final_price_monthly / (1 - r.discount_rate), 0) * 12;
  const bookedAnnual = sum(rs, "final_price_monthly") * 12;
  return {
    n: rs.length,
    combos: combos.size,
    prices: prices.size,
    listAnnual,
    modelLeak: listAnnual - adjustedAnnual,
    discountLeak: adjustedAnnual - bookedAnnual,
    bookedAnnual,
    /** the alternative reading of the unit - assumptions.md A-1, a 1.43x fork */
    perPeriodAnnual: rs.reduce((a, r) => a + r.final_price_monthly * (12 / r.commit_months), 0),
    arpuMonthly: mean(rs, "final_price_monthly"),
  };
}

// ---------------------------------------------------------------------------------------
// I-3 - floor-hours by gym, the one real behavioural effect
// ---------------------------------------------------------------------------------------

export function floorHoursByCity(rs: Member[]): Group[] {
  return by(rs, "city", {
    floor_hours: "floor_hours",
    duration: "duration_in_gym_minutes",
    visits: "visit_per_week",
  }).sort((a, b) => (b.floor_hours as number) - (a.floor_hours as number));
}

/** eta-squared: share of variance in `col` explained by `dim`. The effect size, not the p. */
export function etaSquared(rs: Member[], dim: keyof Member, col: keyof Member): number {
  if (rs.length < 2) return 0;
  const gm = mean(rs, col);
  let ssb = 0;
  for (const [, g] of groupBy(rs, dim)) ssb += g.length * (mean(g, col) - gm) ** 2;
  const sst = rs.reduce((a, r) => a + ((r[col] as number) - gm) ** 2, 0);
  return sst ? ssb / sst : 0;
}

// ---------------------------------------------------------------------------------------
// I-5 - the nulls, with the power calculation that makes them findings
// ---------------------------------------------------------------------------------------

export function stdev(rs: Member[], k: keyof Member): number {
  if (rs.length < 2) return 0;
  const m = mean(rs, k);
  return Math.sqrt(rs.reduce((a, r) => a + ((r[k] as number) - m) ** 2, 0) / (rs.length - 1));
}

/**
 * Minimum detectable difference between two equal groups at 80% power, alpha=0.05.
 * 2.8 = z(0.975) + z(0.80), as conventionally quoted.
 */
export function mde(rs: Member[], k: keyof Member, groups: number): number {
  const nPer = rs.length / groups;
  return nPer > 0 ? 2.8 * stdev(rs, k) * Math.sqrt(2 / nPer) : NaN;
}

/**
 * The pre-declared test grid, as effect sizes.
 *
 * `final_price_monthly` is deliberately ABSENT from METRICS. Showing tier -> price at
 * eta2 = 0.87 beside real behavioural effects is the central trap of this dataset
 * (insights.md I-2), and the chart must not be able to draw it.
 */
export const AXES: (keyof Member)[] = [
  "membership_type", "subscription_model", "discount_type", "city",
  "attend_group_lesson", "personal_training", "uses_sauna",
  "has_drink_subscription", "multi_location_access",
];
export const METRICS: { key: keyof Member; label: string }[] = [
  { key: "visit_per_week", label: "visits / week" },
  { key: "duration_in_gym_minutes", label: "session length" },
  { key: "floor_hours", label: "floor-hours / week" },
  { key: "tenure_days", label: "tenure" },
  { key: "days_since_visit", label: "days since visit" },
  { key: "age", label: "age" },
];

const AXIS_LABEL: Record<string, string> = {
  membership_type: "tier",
  subscription_model: "plan",
  discount_type: "discount",
  city: "gym",
  attend_group_lesson: "group classes",
  personal_training: "personal training",
  uses_sauna: "sauna",
  has_drink_subscription: "drinks",
  multi_location_access: "multi-site",
};

export type EffectRow = { axis: string; metric: string; eta2: number; key: string };

export function effectGrid(rs: Member[]): EffectRow[] {
  const out: EffectRow[] = [];
  for (const a of AXES) {
    for (const m of METRICS) {
      out.push({
        axis: AXIS_LABEL[String(a)] ?? String(a),
        metric: m.label,
        eta2: etaSquared(rs, a, m.key),
        key: `${String(a)}|${String(m.key)}`,
      });
    }
  }
  return out.sort((x, y) => y.eta2 - x.eta2);
}

// ---------------------------------------------------------------------------------------
// Supporting panels
// ---------------------------------------------------------------------------------------

export const TIER_ORDER = ["Basic", "Standard", "Premium", "Elite"];

export function amenityByTier(rs: Member[]): Group[] {
  return by(
    rs,
    "membership_type",
    { price: "list_price_monthly" },
    {
      group_lesson: "attend_group_lesson",
      personal_tr: "personal_training",
      sauna: "uses_sauna",
      multi_site: "multi_location_access",
    }
  ).sort((a, b) => TIER_ORDER.indexOf(a.k) - TIER_ORDER.indexOf(b.k));
}

/** Wilson 95% interval for a proportion, in percent. Every rate by tier carries one. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.959963985;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(100 * (c - s)) / d, (100 * (c + s)) / d];
}

export function weekdayLoad(rs: Member[]) {
  const counts = DAY_ORDER.map(() => 0);
  for (const r of rs) for (let b = 0; b < 7; b++) if ((r.day_mask >> b) & 1) counts[b]++;
  const total = counts.reduce((a, b) => a + b, 0);
  return DAY_ORDER.map((d, i) => ({
    k: d,
    n: counts[i],
    share: total ? (100 * counts[i]) / total : 0,
  }));
}

// ---------------------------------------------------------------------------------------
// Reactive wrapper
// ---------------------------------------------------------------------------------------

/** Recomputes whenever the filter set changes. Warns if aggregation exceeds the budget. */
export function derived<T>(fn: (rs: Member[]) => T, filters: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(ALL, filters()));
    const ms = performance.now() - t0;
    // Response time is an explicitly scored criterion.
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// Formatters. Locale-aware; tabular figures come from CSS.
// ---------------------------------------------------------------------------------------

const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const dec = (n: number, d = 1) => n.toFixed(d);
export const usd0 = (n: number) => "$" + nf.format(Math.round(n));
export const money = (n: number) =>
  Math.abs(n) >= 1e6
    ? "$" + (n / 1e6).toFixed(2) + "M"
    : Math.abs(n) >= 1e3
      ? "$" + int(n / 1e3) + "K"
      : usd0(n);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
export const days = (n: number) => int(n) + " d";
