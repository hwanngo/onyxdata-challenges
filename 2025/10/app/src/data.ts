/**
 * Data layer - 2025/10 Consumer Financial Complaints (CFPB).
 *
 * Every number rendered anywhere is computed here from the complaint-level register.
 * tools/verify_metrics.py recomputes each rendered figure from the PARQUET via DuckDB and
 * asserts the DOM matches - a second engine, a different code path.
 *
 * TWO RULES THIS MONTH, both encoding errors I actually made:
 *
 *   1. TIMELINESS DIVIDES BY RESOLVED. `resolved[i]` gates it. Summing `timely` over all
 *      rows gives 93.77% instead of 96.06% - the number I published in the G1 brief.
 *      AND resolution itself is right-censored: 2023-07 is 49% in progress and 2023-08 is
 *      82%, so any OUTCOME series must stop at 2023-04, not merely drop nulls.
 *
 *   2. THE FINAL MONTH IS PARTIAL. `monthPartial` travels with the data. 2023-07's apparent
 *      record of 1,749 is 863 in-progress complaints; its resolved count is 886, below
 *      2023-06's 981. Volume and outcome series need different cutoffs.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

type Dict = { levels: string[]; codes: number[] };
/** Index/value pairs for a mostly-zero column. See build.py `_sparse`. */
type Sparse = { n: number; idx: number[]; val: number[] };

const P = payload as unknown as {
  n: number;
  chiTests: ChiTest[];
  cols: Record<string, Dict>;
  month_idx: number[];
  months: string[];
  monthPartial: boolean[];
  days: number[];
  resolved: number[];
  timely: number[];
  money: number[];
  relief: number[];
  early: Sparse;
  lag: Sparse;
  companies: Company[];
  meta: Record<string, string | number>;
};

/**
 * One association test from the exhaustive grid.
 *
 * The grid is every pair among the file's twelve categorical columns: 12 involving
 * `company_id` and all 66 consumer-side pairs, 78 in total. Nothing is selected.
 */
export type ChiTest = {
  label: string;
  side: "company" | "consumer";
  /**
   * `company`     the 12 company_id tests.
   * `structural`  the 45 pairs among the ten substantive consumer columns.
   * `calendrical` the 21 consumer pairs touching `weekday` or `timeliness` - the calendar
   *               and the fabricated label, where independence is the EXPECTED result.
   */
  family: "company" | "structural" | "calendrical";
  chi2: number;
  df: number;
  ratio: number;
  p: number;
  /** Effect size on a scale that does NOT reward degrees of freedom. */
  cramersV: number;
  n: number;
  /** V >= 0.9 - the pair restates a column. Five are exact functional dependencies. */
  definitional: boolean;
  /** Clears Bonferroni across the whole 78-test grid. The df-corrected verdict. */
  significant: boolean;
  alpha: number;
};

export type Company = {
  company_id: string;
  market_share_pct: number;
  reputation: number;
  enforcement: string;
  size_tier: string;
  complaints: number;
  timely_rate: number;
  avg_response_days: number;
  kpi_per_1pct_share: number;
  kpi_rank: number;
  share_rank: number;
  volume_rank: number;
};

export type Complaint = {
  i: number;
  channel: string;
  state: string;
  region: string;
  product: string;
  issue: string;
  outcome: string;
  monthIdx: number;
  days: number;
  resolved: 0 | 1;
  timely: 0 | 1;
  money: 0 | 1;
  relief: 0 | 1;
  /** Days answered BEFORE received. 0 unless the row is logically impossible. */
  early: number;
  /** Intake lag: days between the consumer submitting and the CFPB receiving. THE REAL CLOCK. */
  lag: number;
};

function expand(s: Sparse): Int32Array {
  const out = new Int32Array(s.n);
  for (let k = 0; k < s.idx.length; k++) out[s.idx[k]] = s.val[k];
  return out;
}

function decode(): Complaint[] {
  const lv = (c: string) => P.cols[c].levels;
  const cd = (c: string) => P.cols[c].codes;
  const early = expand(P.early);
  const lag = expand(P.lag);
  const out: Complaint[] = new Array(P.n);
  for (let i = 0; i < P.n; i++) {
    out[i] = {
      i,
      channel: lv("channel")[cd("channel")[i]],
      state: lv("state")[cd("state")[i]],
      region: lv("region")[cd("region")[i]],
      product: lv("product")[cd("product")[i]],
      issue: lv("issue")[cd("issue")[i]],
      outcome: lv("outcome")[cd("outcome")[i]],
      monthIdx: P.month_idx[i],
      days: P.days[i],
      resolved: P.resolved[i] as 0 | 1,
      timely: P.timely[i] as 0 | 1,
      money: P.money[i] as 0 | 1,
      relief: P.relief[i] as 0 | 1,
      early: early[i],
      lag: lag[i],
    };
  }
  return out;
}

const ALL: Complaint[] = decode();
export const allRows = () => ALL;
export const CHI_TESTS = P.chiTests;
export const COMPANIES = P.companies;
export const MONTHS = P.months;
export const MONTH_PARTIAL = P.monthPartial;
export const META = P.meta;
export const [ready] = createSignal(true);

/** Outcome series must stop here: 2023-05 onward is right-censored (header rule 1). */
export const OUTCOME_CENSOR_FROM = MONTHS.findIndex((m) => m >= "2023-05-01");

// ---------------------------------------------------------------------------------------
// THE SIGNATURE CHART's summary - computed, never typed
// ---------------------------------------------------------------------------------------

const famOf = (f: ChiTest["family"]) => CHI_TESTS.filter((t) => t.family === f);
const span = (s: ChiTest[], get: (t: ChiTest) => number) => ({
  lo: Math.min(...s.map(get)),
  hi: Math.max(...s.map(get)),
});

/**
 * Everything the diagonal panel says about itself, derived from the persisted grid.
 *
 * The caption used to claim "every association test in the file" over fourteen hand-picked
 * tests, and "the two groups do not overlap" - which was true of the fourteen drawn and
 * false of the file. These are the numbers that survive on the exhaustive grid.
 */
export const CHI = (() => {
  const company = famOf("company");
  const structural = famOf("structural");
  const calendrical = famOf("calendrical");
  const consumer = CHI_TESTS.filter((t) => t.side === "consumer");
  const solid = structural.filter((t) => !t.definitional);
  const compR = span(company, (t) => t.ratio);
  const compV = span(company, (t) => t.cramersV);
  return {
    total: CHI_TESTS.length,
    alpha: CHI_TESTS[0].alpha,
    company,
    structural,
    calendrical,
    consumer,
    /** Structural pairs that are not a restatement of a column - the real findings. */
    solid,
    definitional: CHI_TESTS.filter((t) => t.definitional),
    companyRatio: compR,
    companyV: compV,
    /** Weakest company evidence: the smallest p-value any company test achieves. */
    companyMinP: Math.min(...company.map((t) => t.p)),
    structuralMaxP: Math.max(...structural.map((t) => t.p)),
    companySignificant: company.filter((t) => t.significant).length,
    structuralSignificant: structural.filter((t) => t.significant).length,
    calendricalSignificant: calendrical.filter((t) => t.significant).length,
    consumerSignificant: consumer.filter((t) => t.significant).length,
    /** How close the NEAREST consumer pair gets to the strongest company test. */
    closest: Math.min(...consumer.map((t) => t.ratio)) / compR.hi,
    /** The separation that survives on the non-definitional structural set. */
    separation: Math.min(...solid.map((t) => t.ratio)) / compR.hi,
    /** χ²/df is not an effect scale: this many consumer pairs are WEAKER than every
     *  company test on Cramér's V, and still plot higher. */
    weakerThanCompany: consumer.filter((t) => t.cramersV < compV.lo).length,
  };
})();

// ---------------------------------------------------------------------------------------
// Cross-filter
// ---------------------------------------------------------------------------------------

/**
 * Re-export, never redeclare: the filter VALUES come from the kit's global store, whose
 * `field` is `string`. Narrowing it to `keyof Complaint` here made `Accessor<Filter[]>`
 * unassignable to `derived()`, and every consumer degraded to `unknown`.
 * See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

export function apply(rows: Complaint[], filters: Filter[]): Complaint[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => f.values.includes(r[f.field as keyof Complaint] as string | number))
  );
}

// ---------------------------------------------------------------------------------------
// Measures. Note what each one divides by.
// ---------------------------------------------------------------------------------------

/** RULE 1: resolved denominator, enforced here so no caller can get it wrong by omission. */
export function timelyRate(rows: Complaint[]): number {
  let res = 0;
  let tim = 0;
  for (const r of rows) {
    if (r.resolved) {
      res++;
      tim += r.timely;
    }
  }
  return res ? (100 * tim) / res : NaN;
}

/** The wrong version, exported ONLY so one panel can show the 2.30pp gap explicitly. */
export const timelyRateWrongDenominator = (rows: Complaint[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.timely, 0)) / rows.length : NaN;

export const moneyRate = (rows: Complaint[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.money, 0)) / rows.length : NaN;
export const reliefRate = (rows: Complaint[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.relief, 0)) / rows.length : NaN;
export const meanDays = (rows: Complaint[]) =>
  rows.length ? rows.reduce((a, r) => a + r.days, 0) / rows.length : NaN;

export function groupBy<K extends keyof Complaint>(rows: Complaint[], key: K) {
  const m = new Map<Complaint[K], Complaint[]>();
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
  share: number;
  moneyRate: number;
  reliefRate: number;
  timelyRate: number;
  meanDays: number;
  relieved: number;
};

export function by(rows: Complaint[], key: keyof Complaint): Group[] {
  return [...groupBy(rows, key)]
    .map(([k, g]) => ({
      k: String(k),
      n: g.length,
      share: rows.length ? (100 * g.length) / rows.length : 0,
      moneyRate: moneyRate(g),
      reliefRate: reliefRate(g),
      timelyRate: timelyRate(g),
      meanDays: meanDays(g),
      relieved: g.reduce((a, r) => a + r.money, 0),
    }))
    .sort((a, b) => b.n - a.n);
}

// ---------------------------------------------------------------------------------------
// WHERE THE MONEY IS - the supervision priority list (Q3 + Q4)
// ---------------------------------------------------------------------------------------

export type Pair = {
  product: string;
  issue: string;
  n: number;
  relieved: number;
  moneyRate: number;
  shareOfRelief: number;
  shareOfVolume: number;
};

export function reliefPairs(rows: Complaint[], top = 5) {
  const m = new Map<string, { product: string; issue: string; n: number; relieved: number }>();
  for (const r of rows) {
    const k = r.product + " | " + r.issue;
    let e = m.get(k);
    if (!e) {
      e = { product: r.product, issue: r.issue, n: 0, relieved: 0 };
      m.set(k, e);
    }
    e.n++;
    e.relieved += r.money;
  }
  const totalRelief = rows.reduce((a, r) => a + r.money, 0);
  const all: Pair[] = [...m.values()]
    .map((e) => ({
      ...e,
      moneyRate: e.n ? (100 * e.relieved) / e.n : 0,
      shareOfRelief: totalRelief ? (100 * e.relieved) / totalRelief : 0,
      shareOfVolume: rows.length ? (100 * e.n) / rows.length : 0,
    }))
    .sort((a, b) => b.relieved - a.relieved);
  const head = all.slice(0, top);
  return {
    pairs: head,
    topShare: head.reduce((a, p) => a + p.shareOfRelief, 0),
    topVolume: head.reduce((a, p) => a + p.shareOfVolume, 0),
    totalRelief,
  };
}

/** Issues ranked by monetary relief rate - the severity PROXY (assumptions A-5). */
export function issueSeverity(rows: Complaint[], minN = 300): Group[] {
  return by(rows, "issue")
    .filter((g) => g.n >= minN)
    .sort((a, b) => b.moneyRate - a.moneyRate);
}

// ---------------------------------------------------------------------------------------
// TIME - two different cutoffs, deliberately
// ---------------------------------------------------------------------------------------

export type MonthPoint = {
  month: string;
  idx: number;
  n: number;
  partial: boolean;
  censored: boolean;
  timelyRate: number;
  moneyRate: number;
};

export function byMonth(rows: Complaint[]): MonthPoint[] {
  const n = new Array(MONTHS.length).fill(0);
  const res = new Array(MONTHS.length).fill(0);
  const tim = new Array(MONTHS.length).fill(0);
  const mon = new Array(MONTHS.length).fill(0);
  for (const r of rows) {
    n[r.monthIdx]++;
    mon[r.monthIdx] += r.money;
    if (r.resolved) {
      res[r.monthIdx]++;
      tim[r.monthIdx] += r.timely;
    }
  }
  return MONTHS.map((m, i) => ({
    month: m,
    idx: i,
    n: n[i],
    partial: MONTH_PARTIAL[i],
    // RULE 1: outcome measures are unusable from 2023-05 (right-censoring)
    censored: i >= OUTCOME_CENSOR_FROM,
    timelyRate: res[i] ? (100 * tim[i]) / res[i] : NaN,
    moneyRate: n[i] ? (100 * mon[i]) / n[i] : NaN,
  }));
}

export type YearPoint = {
  k: string;
  n: number;
  /** Resolved complaints INSIDE the uncensored window. The bars' denominator. */
  resolved: number;
  /** Timeliness on the censored window. THIS is what the chart draws. */
  rate: number;
  untimely: number;
  /** Resolved complaints over the whole year, censored months included. */
  pooledResolved: number;
  /** The uncensored rate - shown beside the censored one, never instead of it. */
  pooledRate: number;
  /** How many resolved complaints the censor removed from this year. */
  censoredOut: number;
};

/**
 * Timeliness by year - the regime break the pooled figure hides.
 *
 * RULE 1 IS ENFORCED HERE, not merely documented. `OUTCOME_CENSOR_FROM` used to be
 * defined and referenced by nothing, so the rendered 2023 bar pooled the four
 * right-censored months that the footnote directly beneath it warned about. Those months
 * are 0.65 / 3.63 / 49.34 / 81.87% in progress and the fraction that HAS resolved closed
 * at 96.38 / 99.49 / 100.00 / 100.00% - only the fast cases are in yet. Pooling them put
 * the 2023 bar 3.64pp too high (93.1649% shown against 89.5221%).
 *
 * Both numbers are returned. The chart draws the censored one; the accessible table
 * carries the pooled one beside it so nothing is hidden, only correctly labelled.
 */
export function timelyByYear(rows: Complaint[]): YearPoint[] {
  const m = new Map<
    string,
    { res: number; tim: number; n: number; pRes: number; pTim: number }
  >();
  for (const r of rows) {
    const y = MONTHS[r.monthIdx].slice(0, 4);
    let e = m.get(y);
    if (!e) {
      e = { res: 0, tim: 0, n: 0, pRes: 0, pTim: 0 };
      m.set(y, e);
    }
    e.n++;
    if (r.resolved) {
      e.pRes++;
      e.pTim += r.timely;
      if (r.monthIdx < OUTCOME_CENSOR_FROM) {
        e.res++;
        e.tim += r.timely;
      }
    }
  }
  return [...m].sort().map(([y, e]) => ({
    k: y,
    n: e.n,
    resolved: e.res,
    rate: e.res ? (100 * e.tim) / e.res : NaN,
    untimely: e.res - e.tim,
    pooledResolved: e.pRes,
    pooledRate: e.pRes ? (100 * e.pTim) / e.pRes : NaN,
    censoredOut: e.pRes - e.res,
  }));
}

/** In-progress share of a single month - the evidence FOR the censoring rule. */
export function inProgressByMonth(rows: Complaint[]) {
  const n = new Array(MONTHS.length).fill(0);
  const open = new Array(MONTHS.length).fill(0);
  for (const r of rows) {
    n[r.monthIdx]++;
    if (!r.resolved) open[r.monthIdx]++;
  }
  return MONTHS.map((mo, i) => ({
    month: mo,
    n: n[i],
    censored: i >= OUTCOME_CENSOR_FROM,
    inProgress: n[i] ? (100 * open[i]) / n[i] : NaN,
  }));
}

/**
 * Is the 2021 break universal, or compositional?
 *
 * "The break is universal across product, channel and region" was published with no query
 * behind it - `integrity.py` tested Mortgage and nothing else. This is that query. A cut is
 * TESTABLE when it has >= 30 resolved complaints on each side of the boundary, and it FALLS
 * when its 2021 rate is more than 5pp below its pre-2021 rate.
 */
export const BREAK_MIN_N = 30;
export const BREAK_MIN_DROP = 5;

export function breakUniversality(rows: Complaint[]) {
  const cuts: (keyof Complaint)[] = ["product", "channel", "region"];
  let tested = 0;
  let falling = 0;
  const detail: { cut: string; k: string; pre: number; y2021: number; drop: number }[] = [];
  for (const cut of cuts) {
    for (const [k, g] of groupBy(rows, cut)) {
      const pre = g.filter((r) => r.resolved && MONTHS[r.monthIdx] < "2021-01-01");
      const y21 = g.filter((r) => r.resolved && MONTHS[r.monthIdx].startsWith("2021"));
      if (pre.length < BREAK_MIN_N || y21.length < BREAK_MIN_N) continue;
      const a = (100 * pre.reduce((s, r) => s + r.timely, 0)) / pre.length;
      const b = (100 * y21.reduce((s, r) => s + r.timely, 0)) / y21.length;
      tested++;
      if (a - b > BREAK_MIN_DROP) falling++;
      detail.push({ cut: String(cut), k: String(k), pre: a, y2021: b, drop: a - b });
    }
  }
  return { tested, falling, detail: detail.sort((x, y) => y.drop - x.drop) };
}

// ---------------------------------------------------------------------------------------
// THE TWO CLOCKS - one fabricated, one real
//
// `Response_Time_Days` is U(0,30) and separates nothing. The INTAKE LAG separates channels
// enormously, and until now the page asserted that in prose and never drew it, so nothing
// recomputed it. Both clocks are now measured on the same rows, side by side.
// ---------------------------------------------------------------------------------------

export type Clock = {
  k: string;
  n: number;
  /** The fabricated clock: mean Response_Time_Days. Flat by construction. */
  meanDays: number;
  /** The real clock: share of complaints that reached the CFPB later than they were sent. */
  delayedPct: number;
  meanLag: number;
};

export function clocksByChannel(rows: Complaint[], minN = 50): Clock[] {
  return [...groupBy(rows, "channel")]
    .map(([k, g]) => ({
      k: String(k),
      n: g.length,
      meanDays: g.reduce((a, r) => a + r.days, 0) / g.length,
      delayedPct: (100 * g.filter((r) => r.lag > 0).length) / g.length,
      meanLag: g.reduce((a, r) => a + r.lag, 0) / g.length,
    }))
    .filter((c) => c.n >= minN)
    .sort((a, b) => b.n - a.n);
}

/**
 * Kruskal-Wallis epsilon-squared for intake lag by channel - the effect size the page
 * asserted (0.364) and never rendered.
 *
 * Tie correction is not optional here: 79% of complaints have a lag of exactly zero, so
 * the uncorrected H understates by a wide margin. Same formula as scipy's `kruskal`,
 * epsilon^2 = (H - k + 1) / (n - k) as in `analysis/integrity.py`.
 */
export function lagEffectSize(rows: Complaint[], minN = 50) {
  const groups = [...groupBy(rows, "channel")].filter(([, g]) => g.length >= minN);
  const used = groups.flatMap(([, g]) => g);
  const n = used.length;
  const k = groups.length;
  if (k < 2 || n <= k) return { H: NaN, eps2: NaN, k, n };

  const order = used.map((r, i) => [r.lag, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const rank = new Float64Array(n);
  let tieSum = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let q = i; q <= j; q++) rank[order[q][1]] = avg;
    const t = j - i + 1;
    if (t > 1) tieSum += t * t * t - t;
    i = j + 1;
  }
  let at = 0;
  let sum = 0;
  for (const [, g] of groups) {
    let R = 0;
    for (let q = 0; q < g.length; q++) R += rank[at++];
    sum += (R * R) / g.length;
  }
  let H = (12 / (n * (n + 1))) * sum - 3 * (n + 1);
  const corr = 1 - tieSum / (n * n * n - n);
  if (corr > 0) H /= corr;
  return { H, eps2: (H - k + 1) / (n - k), k, n };
}

/** Complaints answered before they were received - the cross-column break, cross-filtered. */
export function impossible(rows: Complaint[]) {
  const bad = rows.filter((r) => r.early > 0);
  return {
    n: bad.length,
    pct: rows.length ? (100 * bad.length) / rows.length : NaN,
    maxDays: bad.length ? Math.max(...bad.map((r) => r.early)) : 0,
    inProgress: rows.filter((r) => !r.resolved).length,
  };
}

// ---------------------------------------------------------------------------------------
// Company side - kept so the dashboard can show what it is NOT
// ---------------------------------------------------------------------------------------

export const companiesByKpi = (top = 10) =>
  [...COMPANIES].sort((a, b) => b.kpi_per_1pct_share - a.kpi_per_1pct_share).slice(0, top);
export const companiesByVolume = (top = 10) =>
  [...COMPANIES].sort((a, b) => b.complaints - a.complaints).slice(0, top);

/**
 * corr(kpi_rank, share_rank) - the whole Q6 finding as one number.
 *
 * The shipped `Complaints_per_1pct_Share` is arithmetically exact and is the market-share
 * ranking inverted, so a regulator ranking on it targets small firms for being small.
 */
export const KPI_RANK_CORR = (() => {
  const n = COMPANIES.length;
  const a = COMPANIES.map((c) => c.kpi_rank);
  const b = COMPANIES.map((c) => c.share_rank);
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
})();

export function tierSummary() {
  const order = ["Large", "Medium", "Small"];
  const m = new Map<string, Company[]>();
  for (const c of COMPANIES) {
    const g = m.get(c.size_tier);
    if (g) g.push(c);
    else m.set(c.size_tier, [c]);
  }
  return order
    .filter((t) => m.has(t))
    .map((t) => {
      const g = m.get(t)!;
      const mean = (f: (c: Company) => number) => g.reduce((a, c) => a + f(c), 0) / g.length;
      return {
        k: t,
        n: g.length,
        share: mean((c) => c.market_share_pct),
        complaints: mean((c) => c.complaints),
        kpi: mean((c) => c.kpi_per_1pct_share),
      };
    });
}

// ---------------------------------------------------------------------------------------
// Reactive wrapper + formatters
// ---------------------------------------------------------------------------------------

export function derived<T>(fn: (rs: Complaint[]) => T, filters: () => Filter[]) {
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
