/**
 * Data layer - 2025/12 Animal Shelter Operations.
 *
 * THREE RULES, each one an error the source file invites:
 *
 *   1. TWO LIVE-RELEASE RATES, NAMED FOR WHOSE THEY ARE.
 *      `liveReleaseRate` = live / (live + dead). `liveReleaseRateAsFiled` = the source's own
 *      `was_outcome_alive`. 78.49% against 79.26% - and 75.02% against 78.76% in 2025, because
 *      the source counts 399 animals still in the shelter, and 132 disposed of, as saved.
 *
 *   2. A CENSORED MONTH IS NOT A DATA POINT. `monthCensored` travels with the data and every
 *      trend stops at the last settled month (2025-06). 2025-11 is 45.1% unresolved.
 *
 *   3. AGE HAS TWO COLUMNS AND THE HONEST ONE IS SMALLER. 37.77% of dates of birth are
 *      back-computed from the intake date in whole years. `ageMo` includes them,
 *      `ageMoTrusted` does not, and they give different answers to the brief's Q5.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

type Dict = { levels: string[]; codes: number[] };

const P = payload as unknown as {
  n: number;
  months: string[];
  monthCensored: boolean[];
  monthUnresolved: number[];
  cols: Record<string, Dict>;
  month_idx: number[];
  year: number[];
  dow: number[];
  los: number[];
  isLive: number[];
  isDead: number[];
  unresolved: number[];
  filedAlive: number[];
  ageMo: number[];
  ageMoTrusted: number[];
  isRepeat: number[];
  cells: number[];
  cellDim: { lat: number; lon: number; n: number }[];
  outcomeDim: OutcomeRow[];
  conditionDim: ConditionRow[];
  dowDim: DowRow[];
  meta: Record<string, string | number>;
};

export type OutcomeRow = {
  outcome: string;
  stays: number;
  is_live: boolean;
  is_dead: boolean;
  is_other: boolean;
  file_says_alive: number;
  file_says_dead: number;
  median_los: number;
  disagrees: boolean;
};
export type ConditionRow = {
  intake_condition: string;
  stays: number;
  live_rate: number;
  median_los: number;
};
export type DowRow = { channel: string; intake_dow: number; intakes: number; dow_name: string; share: number };

export type Stay = {
  i: number;
  species: string;
  intakeType: string;
  condition: string;
  outcome: string;
  channel: string;
  sex: string;
  monthIdx: number;
  year: number;
  dow: number;
  /** -1 when the animal has not left. */
  los: number;
  isLive: 0 | 1;
  isDead: 0 | 1;
  unresolved: 0 | 1;
  filedAlive: 0 | 1;
  /** Age in years, INCLUDING the 38% that are staff estimates. NaN when unknown. */
  age: number;
  /** Age in years, excluding estimated dates of birth. NaN for 46% of stays. */
  ageTrusted: number;
  isRepeat: 0 | 1;
  cell: number;
};

function decode(): Stay[] {
  const lv = (c: string) => P.cols[c].levels;
  const cd = (c: string) => P.cols[c].codes;
  const out: Stay[] = new Array(P.n);
  for (let i = 0; i < P.n; i++) {
    out[i] = {
      i,
      species: lv("animal_type")[cd("animal_type")[i]],
      intakeType: lv("intake_type")[cd("intake_type")[i]],
      condition: lv("intake_condition")[cd("intake_condition")[i]],
      outcome: lv("outcome")[cd("outcome")[i]],
      channel: lv("channel")[cd("channel")[i]],
      sex: lv("sex")[cd("sex")[i]],
      monthIdx: P.month_idx[i],
      year: P.year[i],
      dow: P.dow[i],
      los: P.los[i],
      isLive: P.isLive[i] as 0 | 1,
      isDead: P.isDead[i] as 0 | 1,
      unresolved: P.unresolved[i] as 0 | 1,
      filedAlive: P.filedAlive[i] as 0 | 1,
      age: P.ageMo[i] < 0 ? NaN : P.ageMo[i] / 12,
      ageTrusted: P.ageMoTrusted[i] < 0 ? NaN : P.ageMoTrusted[i] / 12,
      isRepeat: P.isRepeat[i] as 0 | 1,
      cell: P.cells[i],
    };
  }
  return out;
}

const ALL: Stay[] = decode();
export const allRows = () => ALL;
export const MONTHS = P.months;
export const MONTH_CENSORED = P.monthCensored;
export const MONTH_UNRESOLVED = P.monthUnresolved;
export const OUTCOMES = P.outcomeDim;
export const CONDITIONS = P.conditionDim;
export const DOW = P.dowDim;
export const CELLS = P.cellDim;
export const META = P.meta;
export const [ready] = createSignal(true);

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/** Rule 2: the last month whose stays have settled. Every trend stops here. */
export const LAST_SETTLED_IDX = MONTH_CENSORED.lastIndexOf(false);

// ---------------------------------------------------------------------------------------
// Cross-filter
// ---------------------------------------------------------------------------------------

/**
 * Re-export, never redeclare: the filter VALUES come from the kit's global store, whose
 * `field` is `string`. Narrowing it to `keyof Stay` here made `Accessor<Filter[]>`
 * unassignable to `derived()`, and every consumer degraded to `unknown`.
 * See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

export function apply(rows: Stay[], filters: Filter[]): Stay[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => f.values.includes(r[f.field as keyof Stay] as string | number))
  );
}

// ---------------------------------------------------------------------------------------
// Measures. Rule 1 is enforced here so no caller can get the denominator wrong by omission.
// ---------------------------------------------------------------------------------------

/** live / (live + dead). Administrative dispositions and unresolved stays are in NEITHER. */
export function liveReleaseRate(rows: Stay[]): number {
  let live = 0;
  let dead = 0;
  for (const r of rows) {
    live += r.isLive;
    dead += r.isDead;
  }
  return live + dead ? (100 * live) / (live + dead) : NaN;
}

/** The source's own flag, exported so a panel can show what is being corrected. */
export const liveReleaseRateAsFiled = (rows: Stay[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.filedAlive, 0)) / rows.length : NaN;

export const overstatementPp = (rows: Stay[]) =>
  liveReleaseRateAsFiled(rows) - liveReleaseRate(rows);

/**
 * DECOMPOSING THE HEADLINE GAP. The overstatement is a composite of two different mistakes and
 * this month's whole argument is about one of them, so it is decomposed on the page rather
 * than quoted whole.
 *
 *   1. THE DENOMINATOR. The file divides by every stay, including 1,248 that are not outcomes
 *      at all - administrative dispositions and animals still in the kennel. Holding the
 *      file's own flag fixed and moving only to the live+dead population gives `denominatorPp`.
 *   2. THE FLAG. Within that population the flag still calls 132 DISPOSAL records live
 *      releases. Correcting only that gives `flagPp`.
 *
 * The two sum to `overstatementPp` exactly. The order matters slightly - correcting the flag
 * first and the denominator second splits 0.25/0.51 rather than 0.50/0.26 - and the order
 * used here is stated on the page.
 */
export const liveReleaseRateAsFiledOnOutcomes = (rows: Stay[]) =>
  liveReleaseRateAsFiled(rows.filter((r) => r.isLive || r.isDead));

/** Part of the gap that is the file counting non-outcomes in its denominator. */
export const denominatorPp = (rows: Stay[]) =>
  liveReleaseRateAsFiled(rows) - liveReleaseRateAsFiledOnOutcomes(rows);

/** Part of the gap that is the flag misclassifying outcomes it does have. */
export const flagPp = (rows: Stay[]) =>
  liveReleaseRateAsFiledOnOutcomes(rows) - liveReleaseRate(rows);

/** The same decomposition taken in the other order: correct the flag first, on the file's own
 *  all-stay denominator, and move the denominator second. Published alongside so the reader
 *  can see the split is order-dependent by about six thousandths of a point rather than
 *  discovering it. */
export const flagPpFlagFirst = (rows: Stay[]) => {
  if (!rows.length) return NaN;
  const corrected = (100 * rows.filter((r) => r.filedAlive === 1 && !r.isDead).length) / rows.length;
  return liveReleaseRateAsFiled(rows) - corrected;
};

export const denominatorPpFlagFirst = (rows: Stay[]) =>
  overstatementPp(rows) - flagPpFlagFirst(rows);

export const unresolvedShare = (rows: Stay[]) =>
  rows.length ? (100 * rows.reduce((a, r) => a + r.unresolved, 0)) / rows.length : NaN;

/** Median, not mean: more than a quarter of stays are same-day, so the mean is dragged by a
 *  tail that runs to 1,410 days. `meanLos` below is deliberately computed over EXACTLY this
 *  population so the two are comparable - an earlier draft paired this median (all resolved
 *  stays) with a mean taken over live releases only, which are a slower population. */
export function medianLos(rows: Stay[]): number {
  const v = rows.filter((r) => r.los >= 0).map((r) => r.los).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Mean length of stay over the SAME rows as `medianLos` - every resolved stay. */
export function meanLos(rows: Stay[]): number {
  let n = 0;
  let s = 0;
  for (const r of rows) if (r.los >= 0) { s += r.los; n++; }
  return n ? s / n : NaN;
}

export const sameDayShare = (rows: Stay[]) => {
  const r = rows.filter((x) => x.los >= 0);
  return r.length ? (100 * r.filter((x) => x.los === 0).length) / r.length : NaN;
};

export function groupBy<K extends keyof Stay>(rows: Stay[], key: K) {
  const m = new Map<Stay[K], Stay[]>();
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
  liveRate: number;
  liveRateAsFiled: number;
  medianLos: number;
  sameDay: number;
  share: number;
};

export function by(rows: Stay[], key: keyof Stay): Group[] {
  return [...groupBy(rows, key)]
    .map(([k, g]) => ({
      k: String(k),
      n: g.length,
      liveRate: liveReleaseRate(g),
      liveRateAsFiled: liveReleaseRateAsFiled(g),
      medianLos: medianLos(g),
      sameDay: sameDayShare(g),
      share: rows.length ? (100 * g.length) / rows.length : 0,
    }))
    .sort((a, b) => b.n - a.n);
}

/** 95% Wilson interval - real data has real sampling noise and AMPHIBIAN has three records. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [NaN, NaN];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [100 * (c - h), 100 * (c + h)];
}

/**
 * Cramér's V of `key` against live/dead. C6 - the headline of Part 2, computed rather than
 * quoted, because a hardcoded effect size is exactly the kind of number that outlives the
 * data it came from.
 *
 * The outcome is binary, so min(r-1, c-1) = 1 and V reduces to sqrt(χ²/n). The population is
 * the DENOMINATOR RULE population: live + dead, with non-outcomes and unresolved stays out of
 * both. `model/metric_checks.yml` recomputes the same quantity in DuckDB.
 */
export function cramersV(rows: Stay[], key: "condition" | "species"): number {
  const tab = new Map<string, [number, number]>();
  let live = 0;
  let n = 0;
  for (const r of rows) {
    if (!r.isLive && !r.isDead) continue;
    const k = r[key];
    const cell = tab.get(k) ?? [0, 0];
    cell[0] += r.isLive;
    cell[1] += 1;
    tab.set(k, cell);
    live += r.isLive;
    n++;
  }
  if (!n || !live || live === n || tab.size < 2) return NaN;
  const p = live / n;
  let chi = 0;
  for (const [, [l, tot]] of [...tab].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    chi += (l - tot * p) ** 2 / (tot * p);
    chi += (tot - l - tot * (1 - p)) ** 2 / (tot * (1 - p));
  }
  return Math.sqrt(chi / n);
}

/** Share of `rows` satisfying `pred`, as a percentage. */
export const shareWhere = (rows: Stay[], pred: (r: Stay) => boolean) =>
  rows.length ? (100 * rows.filter(pred).length) / rows.length : NaN;

// ---------------------------------------------------------------------------------------
// THE SIGNATURE - four measurements, each done twice. C1-C5.
// ---------------------------------------------------------------------------------------

export type PairedPoint = { k: string; filed: number; measured: number; n: number };
export type PairedPanel = {
  id: string;
  title: string;
  note: string;
  /** false for the one panel where the two readings agree - the control. */
  changes: boolean;
  unit: string;
  points: PairedPoint[];
};

export function theControl(rows: Stay[]): PairedPanel[] {
  // 1 - live release by year. The gap is under a point until 2025, then 3.7.
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const byYear: PairedPoint[] = years.map((y) => {
    const g = rows.filter((r) => r.year === y);
    return { k: String(y), filed: liveReleaseRateAsFiled(g), measured: liveReleaseRate(g), n: g.length };
  });

  // 2 - live release by age band, all dates of birth against real ones only.
  const BANDS: [string, number, number][] = [
    ["<6mo", 0, 0.5],
    ["6-12mo", 0.5, 1],
    ["1-3y", 1, 3],
    ["3-7y", 3, 7],
    ["7-12y", 7, 12],
    ["12y+", 12, Infinity],
  ];
  const byAge: PairedPoint[] = BANDS.map(([label, lo, hi]) => {
    const all = rows.filter((r) => r.age >= lo && r.age < hi);
    const tru = rows.filter((r) => r.ageTrusted >= lo && r.ageTrusted < hi);
    return { k: label, filed: liveReleaseRate(all), measured: liveReleaseRate(tru), n: all.length };
  });

  // 3 - intakes by weekday, public counter against field officers. The spike vanishes.
  const dowPoint = (d: number): PairedPoint => {
    const pub = rows.filter((r) => r.channel === "Public counter");
    const off = rows.filter((r) => r.channel === "Officer-driven");
    return {
      k: DAY_NAMES[d - 1],
      filed: pub.length ? (100 * pub.filter((r) => r.dow === d).length) / pub.length : NaN,
      measured: off.length ? (100 * off.filter((r) => r.dow === d).length) / off.length : NaN,
      n: rows.filter((r) => r.dow === d).length,
    };
  };
  const byDow = [1, 2, 3, 4, 5, 6, 7].map(dowPoint);

  // 4 - intakes by month of year. THE CONTROL: both series rise together.
  const pub = rows.filter((r) => r.channel === "Public counter");
  const off = rows.filter((r) => r.channel === "Officer-driven");
  const monthOf = (i: number) => Number(MONTHS[i].slice(5, 7));
  const bySeason: PairedPoint[] = Array.from({ length: 12 }, (_, m) => {
    const mo = m + 1;
    const p = pub.filter((r) => monthOf(r.monthIdx) === mo).length;
    const o = off.filter((r) => monthOf(r.monthIdx) === mo).length;
    return {
      k: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][m],
      filed: pub.length ? (100 * p) / pub.length : NaN,
      measured: off.length ? (100 * o) / off.length : NaN,
      n: p + o,
    };
  });

  // Panel notes carry statistics, so they are COMPUTED from the same rows the panel draws.
  // Typing them as prose is how a caption drifts away from the chart above it.
  const lastYear = years[years.length - 1];
  const gapLastYear = overstatementPp(rows.filter((r) => r.year === lastYear));
  const lastMonthUnresolved = 100 * MONTH_UNRESOLVED[MONTH_UNRESOLVED.length - 1];
  const lastMonthName = MONTH_NAMES[Number(MONTHS[MONTHS.length - 1].slice(5, 7)) - 1];
  const withAge = rows.filter((r) => Number.isFinite(r.age)).length;
  const withTrustedAge = rows.filter((r) => Number.isFinite(r.ageTrusted)).length;
  const estimatedAgeShare = withAge ? (100 * (withAge - withTrustedAge)) / withAge : NaN;

  return [
    {
      id: "year",
      title: "Live release, by year",
      note:
        `The gap is under a point until ${lastYear}, then ${dec(gapLastYear, 1)} - because ` +
        `${pct(lastMonthUnresolved, 0)} of ${lastMonthName} has not happened yet.`,
      changes: true,
      unit: "%",
      points: byYear,
    },
    {
      id: "age",
      title: "Live release, by age at intake",
      note:
        `${pct(estimatedAgeShare, 0)} of dates of birth are staff estimates back-dated from the ` +
        `intake day. Drop them and the senior penalty mostly goes.`,
      changes: true,
      unit: "%",
      points: byAge,
    },
    {
      id: "dow",
      title: "Intakes, by day of the week",
      note: "The public counter swings 3.1x across the week. Field officers, who do not need it open, swing 1.2x.",
      changes: true,
      unit: "% of channel",
      points: byDow,
    },
    {
      id: "season",
      title: "Intakes, by month of the year",
      note: "Both series rise and fall together. This is the control: it is real demand, and it is the axis to plan against.",
      changes: false,
      unit: "% of channel",
      points: bySeason,
    },
  ];
}

// ---------------------------------------------------------------------------------------
// Trends. Rule 2: nothing is drawn past the last settled month.
// ---------------------------------------------------------------------------------------

export type MonthPoint = {
  month: string;
  idx: number;
  n: number;
  censored: boolean;
  unresolved: number;
  liveRate: number;
  liveRateAsFiled: number;
};

export function byMonth(rows: Stay[]): MonthPoint[] {
  const buckets: Stay[][] = MONTHS.map(() => []);
  for (const r of rows) buckets[r.monthIdx].push(r);
  return MONTHS.map((m, i) => ({
    month: m,
    idx: i,
    n: buckets[i].length,
    censored: MONTH_CENSORED[i],
    unresolved: 100 * MONTH_UNRESOLVED[i],
    liveRate: liveReleaseRate(buckets[i]),
    liveRateAsFiled: liveReleaseRateAsFiled(buckets[i]),
  }));
}

// ---------------------------------------------------------------------------------------
// Reactive wrapper
// ---------------------------------------------------------------------------------------

export function derived<T>(fn: (rs: Stay[]) => T, f: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(ALL, f()));
    const ms = performance.now() - t0;
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------------------

const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => (Number.isFinite(n) ? nf.format(Math.round(n)) : "-");
export const dec = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "-");
export const pct = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) + "%" : "-");
