/**
 * Data layer for 2026/10 Sunrise Coffee - pure functions only, unit-tested in data.test.ts.
 *
 * Grain rules carried from model/build.py:
 *  - store_months.json is the P&L of record (60 stores x 24 months).
 *  - week.json is the DAILY SAMPLE, pre-summed to store x year x weekday x bank-holiday. It does not
 *    reconcile to the P&L, so it is only ever turned into means (sum / n), never money totals.
 *  - Store questions are answered at store grain: a store's value is the pooled ratio over its months.
 */

export type Store = {
  id: number;
  name: string;
  region: string;
  loc: string;
  format: string;
  status_store: string;
  adoption: number;
  opened: number;
  transitName: boolean;
};
export type StoreMonth = {
  s: number;
  m: string;
  rev: number;
  cogs: number;
  rent: number;
  staff: number;
  red: number;
  np: number;
  mem: number;
  st: number;
  src: number;
};
export type WeekRow = {
  s: number;
  y: number;
  d: number;
  bh: boolean;
  n: number;
  rev: number;
  hrs: number;
  txn: number;
  espresso: number;
  filter: number;
  food: number;
  retail_beans: number;
};
export type ContractRow = { id: string; promise: string; test: string; observed: string; verdict: "HOLDS" | "FAILS" };
export type Evidence = {
  region_revenue_p: number;
  eta2_store_revenue: number;
  eta2_null: number;
  noise_sd: number;
  wk_hours_p: number;
  season_p: number;
  format_p: number;
  format_gap_pp: number;
  status_mismatch: number;
  contract_holds: number;
  contract_tested: number;
  daily_r: number;
  daily_coverage: number;
};
export type Bundle = {
  stores: Store[];
  months: StoreMonth[];
  week: WeekRow[];
  contract: ContractRow[];
  evidence: Evidence;
};

export const STATUS = ["Highly-Profitable", "Profitable", "Break-Even", "Loss-Making", "Structural-Loss"] as const;
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const YEARS = [2023, 2024] as const;
export const HALVES = ["Lower-cost half", "Higher-cost half"] as const;

export async function loadBundle(base = "/data"): Promise<Bundle> {
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`${base}/${name}.json`);
    if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  const [stores, months, week, contract, evidence] = await Promise.all([
    get<Store[]>("stores"),
    get<StoreMonth[]>("store_months"),
    get<WeekRow[]>("week"),
    get<ContractRow[]>("contract"),
    get<Evidence>("evidence"),
  ]);
  return { stores, months, week, contract, evidence };
}

// ------------------------------------------------------------------ statistics
export function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
export function sd(xs: number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}
export function corr(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
/** OLS of y on x: slope and its standard error (n-2 df). */
export function linreg(xs: number[], ys: number[]): { slope: number; intercept: number; se: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  const ssr = syy - (sxy * sxy) / sxx;
  return { slope, intercept: my - slope * mx, se: Math.sqrt(ssr / (xs.length - 2) / sxx) };
}
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// ------------------------------------------------------------------ view state
export type ViewState = {
  region: string[];
  loc: string[];
  half: string[];
  year: number[];
  store: number | null; // drill focus, not a filter
};
export const EMPTY: ViewState = { region: [], loc: [], half: [], year: [], store: null };

export function decodeViewState(search: string): ViewState {
  const q = new URLSearchParams(search);
  const list = (k: string) => (q.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const years = list("year").map(Number).filter((y) => (YEARS as readonly number[]).includes(y));
  const store = Number(q.get("store"));
  return {
    region: list("region"),
    loc: list("loc"),
    half: list("half").filter((h) => (HALVES as readonly string[]).includes(h)),
    year: years,
    store: Number.isInteger(store) && store > 0 ? store : null,
  };
}
export function encodeViewState(v: ViewState): string {
  const q = new URLSearchParams();
  if (v.region.length) q.set("region", v.region.join(","));
  if (v.loc.length) q.set("loc", v.loc.join(","));
  if (v.half.length) q.set("half", v.half.join(","));
  if (v.year.length) q.set("year", v.year.join(","));
  if (v.store) q.set("store", String(v.store));
  return q.toString();
}
export const filtersActive = (v: ViewState) => v.region.length + v.loc.length + v.half.length + v.year.length > 0;
export const storeFiltersActive = (v: ViewState) => v.region.length + v.loc.length + v.half.length > 0;
export const yearActive = (v: ViewState) => v.year.length > 0 && v.year.length < YEARS.length;

/** Metric id for a value that a filter can change. Release ids stay stable; filtered values get
 *  their own namespace so the release verifier never compares a filtered number (LEARNINGS 2026/09). */
export const mid = (base: string, filtered: boolean) => (filtered ? `selected.${base}` : base);

// ------------------------------------------------------------------ store grain
export type StoreAgg = {
  id: number;
  months: number;
  rev: number; // per store-month
  cogs: number;
  fixed: number;
  red: number;
  np: number;
  margin: number; // pooled
  lossMonths: number;
  memShare: number;
};

export function monthInYears(m: string, years: number[]): boolean {
  if (!years.length || years.length === YEARS.length) return true;
  return years.includes(Number(m.slice(0, 4)));
}

export function storeAggs(b: Bundle, years: number[] = []): Map<number, StoreAgg> {
  const acc = new Map<number, { n: number; rev: number; cogs: number; fixed: number; red: number; np: number; mem: number; loss: number }>();
  for (const r of b.months) {
    if (!monthInYears(r.m, years)) continue;
    const a = acc.get(r.s) ?? { n: 0, rev: 0, cogs: 0, fixed: 0, red: 0, np: 0, mem: 0, loss: 0 };
    a.n += 1;
    a.rev += r.rev;
    a.cogs += r.cogs;
    a.fixed += r.rent + r.staff;
    a.red += r.red;
    a.np += r.np;
    a.mem += r.mem;
    a.loss += r.np < 0 ? 1 : 0;
    acc.set(r.s, a);
  }
  const out = new Map<number, StoreAgg>();
  for (const [id, a] of acc) {
    out.set(id, {
      id,
      months: a.n,
      rev: a.rev / a.n,
      cogs: a.cogs / a.n,
      fixed: a.fixed / a.n,
      red: a.red / a.n,
      np: a.np / a.n,
      margin: a.np / a.rev,
      lossMonths: a.loss,
      memShare: a.mem / a.rev,
    });
  }
  return out;
}

/** Cost half is a STORE attribute fixed over the full 24 months (matches mart_store.cost_half). */
export function costHalves(b: Bundle): Map<number, (typeof HALVES)[number]> {
  const all = storeAggs(b);
  const med = median([...all.values()].map((s) => s.fixed));
  const out = new Map<number, (typeof HALVES)[number]>();
  for (const s of all.values()) out.set(s.id, s.fixed <= med ? HALVES[0] : HALVES[1]);
  return out;
}

export function selectedStoreIds(b: Bundle, v: ViewState, halves = costHalves(b)): Set<number> {
  return new Set(
    b.stores
      .filter((s) => !v.region.length || v.region.includes(s.region))
      .filter((s) => !v.loc.length || v.loc.includes(s.loc))
      .filter((s) => !v.half.length || v.half.includes(halves.get(s.id)!))
      .map((s) => s.id),
  );
}

export type Summary = {
  stores: number;
  storeMonths: number;
  revenue: number;
  netProfit: number;
  margin: number;
  redemption: number;
  fixedPm: number;
  revenuePm: number;
  lossMonths: number;
};
export function summarize(b: Bundle, ids: Set<number>, years: number[] = []): Summary {
  let n = 0;
  let rev = 0;
  let np = 0;
  let red = 0;
  let fixed = 0;
  let loss = 0;
  const seen = new Set<number>();
  for (const r of b.months) {
    if (!ids.has(r.s) || !monthInYears(r.m, years)) continue;
    seen.add(r.s);
    n += 1;
    rev += r.rev;
    np += r.np;
    red += r.red;
    fixed += r.rent + r.staff;
    loss += r.np < 0 ? 1 : 0;
  }
  return {
    stores: seen.size,
    storeMonths: n,
    revenue: rev,
    netProfit: np,
    margin: n ? np / rev : NaN,
    redemption: red,
    fixedPm: n ? fixed / n : NaN,
    revenuePm: n ? rev / n : NaN,
    lossMonths: loss,
  };
}

// ------------------------------------------------------------------ region cost map
export type RegionRow = {
  region: string;
  stores: number;
  n: number; // store-months
  rev: number; // mean revenue per store-month
  ci: number; // 1.96 * sd / sqrt(n) over store-months
  fixed: number;
  margin: number;
};
export function regionRows(b: Bundle, years: number[] = []): RegionRow[] {
  const regionOf = new Map(b.stores.map((s) => [s.id, s.region]));
  const groups = new Map<string, { revs: number[]; fixed: number; np: number; rev: number; stores: Set<number> }>();
  for (const r of b.months) {
    if (!monthInYears(r.m, years)) continue;
    const reg = regionOf.get(r.s)!;
    const g = groups.get(reg) ?? { revs: [], fixed: 0, np: 0, rev: 0, stores: new Set<number>() };
    g.revs.push(r.rev);
    g.fixed += r.rent + r.staff;
    g.np += r.np;
    g.rev += r.rev;
    g.stores.add(r.s);
    groups.set(reg, g);
  }
  return [...groups.entries()]
    .map(([region, g]) => ({
      region,
      stores: g.stores.size,
      n: g.revs.length,
      rev: g.rev / g.revs.length,
      ci: (1.96 * sd(g.revs)) / Math.sqrt(g.revs.length),
      fixed: g.fixed / g.revs.length,
      margin: g.np / g.rev,
    }))
    .sort((a, b2) => b2.margin - a.margin || a.region.localeCompare(b2.region));
}

// ------------------------------------------------------------------ release-level evidence
export type Release = {
  r2Fixed: number;
  r2Revenue: number;
  medianFixed: number;
  lower: Summary;
  upper: Summary;
  rRegionFixed: number;
  rRegionRevenue: number;
  rRevYoy: number;
  rNpYoy: number;
  yoy: { id: number; rev23: number; rev24: number; np23: number; np24: number }[];
  loyalty: {
    rShare: number;
    rRevenue: number;
    lift10: number;
    lo10: number;
    hi10: number;
    meanAdoption: number;
    upper: number;
    needed: number;
    redemptionPm: number;
    grossMargin: number;
    points: { id: number; adoption: number; share: number; rev: number }[];
  };
};

export function release(b: Bundle): Release {
  const aggs = [...storeAggs(b).values()].sort((a, c) => a.id - c.id);
  const fixed = aggs.map((s) => s.fixed);
  const np = aggs.map((s) => s.np);
  const rev = aggs.map((s) => s.rev);
  const halves = costHalves(b);
  const ids = (h: string) => new Set(aggs.filter((s) => halves.get(s.id) === h).map((s) => s.id));
  const regions = regionRows(b);
  const y23 = storeAggs(b, [2023]);
  const y24 = storeAggs(b, [2024]);
  const yoy = aggs.map((s) => ({
    id: s.id,
    rev23: y23.get(s.id)!.rev,
    rev24: y24.get(s.id)!.rev,
    np23: y23.get(s.id)!.np,
    np24: y24.get(s.id)!.np,
  }));
  const adoptionOf = new Map(b.stores.map((s) => [s.id, s.adoption]));
  const adoption = aggs.map((s) => adoptionOf.get(s.id)!);
  const fit = linreg(adoption, rev);
  const meanAdoption = mean(adoption);
  let cogs = 0;
  let revenue = 0;
  for (const r of b.months) {
    cogs += r.cogs;
    revenue += r.rev;
  }
  const grossMargin = 1 - cogs / revenue;
  const redemptionPm = mean(aggs.map((s) => s.red));
  return {
    r2Fixed: corr(fixed, np) ** 2,
    r2Revenue: corr(rev, np) ** 2,
    medianFixed: median(fixed),
    lower: summarize(b, ids(HALVES[0])),
    upper: summarize(b, ids(HALVES[1])),
    rRegionFixed: corr(regions.map((r) => r.fixed), regions.map((r) => r.margin)),
    rRegionRevenue: corr(regions.map((r) => r.rev), regions.map((r) => r.margin)),
    rRevYoy: corr(yoy.map((y) => y.rev23), yoy.map((y) => y.rev24)),
    rNpYoy: corr(yoy.map((y) => y.np23), yoy.map((y) => y.np24)),
    yoy,
    loyalty: {
      rShare: corr(adoption, aggs.map((s) => s.memShare)),
      rRevenue: corr(adoption, rev),
      lift10: fit.slope * 0.1,
      lo10: (fit.slope - 1.96 * fit.se) * 0.1,
      hi10: (fit.slope + 1.96 * fit.se) * 0.1,
      meanAdoption,
      upper: (fit.slope + 1.96 * fit.se) * meanAdoption,
      needed: redemptionPm / grossMargin,
      redemptionPm,
      grossMargin,
      points: aggs.map((s) => ({ id: s.id, adoption: adoptionOf.get(s.id)!, share: s.memShare, rev: s.rev })),
    },
  };
}

// ------------------------------------------------------------------ the week (daily sample)
export type WeekDay = { d: number; n: number; rev: number; hrs: number };
export type WeekSummary = {
  days: WeekDay[];
  weekdayRev: number;
  weekendRev: number;
  weekdayHrs: number;
  weekendHrs: number;
  gap: number;
  weekdayRph: number;
  weekendRph: number;
  surplus: number;
  bhGap: number;
  n: number;
};
export function weekSummary(rows: WeekRow[], ids: Set<number> | null, years: number[] = []): WeekSummary {
  const yr = (y: number) => !years.length || years.length === YEARS.length || years.includes(y);
  const days = DOW.map((_, i) => ({ d: i + 1, n: 0, rev: 0, hrs: 0 }));
  const bh = { n: 0, rev: 0 };
  const nbh = { n: 0, rev: 0 };
  for (const r of rows) {
    if ((ids && !ids.has(r.s)) || !yr(r.y)) continue;
    const day = days[r.d - 1];
    day.n += r.n;
    day.rev += r.rev;
    day.hrs += r.hrs;
    const t = r.bh ? bh : nbh;
    t.n += r.n;
    t.rev += r.rev;
  }
  const sum = (ds: typeof days, k: "n" | "rev" | "hrs") => ds.reduce((s, d) => s + d[k], 0);
  const wd = days.slice(0, 5);
  const we = days.slice(5);
  const weekdayRev = sum(wd, "rev") / sum(wd, "n");
  const weekendRev = sum(we, "rev") / sum(we, "n");
  const weekdayHrs = sum(wd, "hrs") / sum(wd, "n");
  const weekendHrs = sum(we, "hrs") / sum(we, "n");
  const weekdayRph = sum(wd, "rev") / sum(wd, "hrs");
  const weekendRph = sum(we, "rev") / sum(we, "hrs");
  return {
    days: days.map((d) => ({ d: d.d, n: d.n, rev: d.n ? d.rev / d.n : NaN, hrs: d.n ? d.hrs / d.n : NaN })),
    weekdayRev,
    weekendRev,
    weekdayHrs,
    weekendHrs,
    gap: weekendRev / weekdayRev - 1,
    weekdayRph,
    weekendRph,
    surplus: 1 - weekendRev / weekdayRph / weekendHrs,
    bhGap: bh.rev / bh.n / (nbh.rev / nbh.n) - 1,
    n: sum(days, "n"),
  };
}

// ------------------------------------------------------------------ drill: one store
export function storeMonths(b: Bundle, id: number): StoreMonth[] {
  return b.months.filter((r) => r.s === id).sort((a, c) => a.m.localeCompare(c.m));
}
export function marginRank(b: Bundle, id: number): number {
  const aggs = [...storeAggs(b).values()].sort((a, c) => c.margin - a.margin);
  return aggs.findIndex((s) => s.id === id) + 1;
}

// ------------------------------------------------------------------ formatting
const nf = (d: number) => new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtInt = (v: number) => nf(0).format(v);
export const fmtGbp = (v: number) => `${v < 0 ? "−" : ""}£${nf(0).format(Math.abs(v))}`;
export const fmtGbpK = (v: number, d = 1) => `${v < 0 ? "−" : ""}£${nf(d).format(Math.abs(v) / 1000)}k`;
export const fmtGbpM = (v: number, d = 2) => `${v < 0 ? "−" : ""}£${nf(d).format(Math.abs(v) / 1e6)}M`;
export const fmtPct = (v: number, d = 1) => `${v < 0 ? "−" : ""}${nf(d).format(Math.abs(v) * 100)}%`;
export const fmtSignedPct = (v: number, d = 1) => `${v < 0 ? "−" : "+"}${nf(d).format(Math.abs(v) * 100)}%`;
export const fmtR = (v: number, d = 2) => `${v < 0 ? "−" : ""}${nf(d).format(Math.abs(v))}`;
export const fmtNum = (v: number, d = 1) => `${v < 0 ? "−" : ""}${nf(d).format(Math.abs(v))}`;
export const fmtP = (v: number) =>
  v < 0.001
    ? "< 0.001" // prose-number-ok: I1 - p-value display floor (formatter threshold), not a finding
    : nf(v < 0.01 ? 3 : 2).format(v);
