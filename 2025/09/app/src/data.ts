/**
 * Data layer - 2025/09 Credit Risk Analytics (Nova Bank).
 *
 * Every number rendered anywhere in this app is computed here, at query time, from the
 * loan-level book. Nothing is precomputed, nothing is hardcoded.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET
 * via DuckDB and asserts the DOM matches - a second engine, a different code path.
 *
 * ARCHITECTURE NOTE (see model/build.py::export_app_data and .workbench/2025/09/RETRO.md):
 * docs/STACK.md specifies DuckDB-WASM. This is the programme's largest book at 32,581
 * loans, but eleven quantised columns of it are 1.3 MB raw / 260 KB gzipped, and scanning
 * 32k rows in JS is sub-10ms. DuckDB-WASM's ~32 MB engine and ~30s cold start would blow
 * the 3s budget to query data smaller than its own binary. Same deviation as 2025/05, with
 * the measured numbers in .workbench/2025/09/RETRO.md.
 *
 * THE RULE THIS MONTH: two boolean conditions decide 42% of every default in this file, and
 * they are EXACT - 2,988 loans, zero exceptions. So `RULES` below is the single definition
 * of them, exported for the UI and asserted in model/test_metrics.py. Nothing may
 * re-implement a rule inline: an earlier draft of the analysis tested the boundary at
 * `>= 0.30` instead of `> 0.30` and turned a deterministic rule into an apparent gradient.
 * The boundary lives in one place now.
 */
import { createMemo, createSignal } from "solid-js";
import type { Filter } from "@onyxdata/dna-kit";
import payload from "./data.json";

// ---------------------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------------------

type Dict = { levels: string[]; codes: number[] };
const P = payload as unknown as {
  n: number;
  cols: Record<string, Dict>;
  lpi_pct: number[];
  rate_bp: number[];
  amnt: number[];
  income_h: number[];
  age: number[];
  status: number[];
  prior_default: number[];
  emp_missing: number[];
  past_delinq: number[];
  provenance: ProvenanceRow[];
  meta: Meta;
};

/**
 * `unemployed` and `ltiExact` are AGGREGATES, not columns: person_emp_length in years and
 * loan_to_income_ratio at full precision are deliberately not shipped in the quantised
 * payload, so the three sentences that quote them cannot be recomputed row-wise here.
 * model/build.py computes them and model/metric_checks.yml re-derives each one from the
 * parquet through DuckDB, so they are verified on the same footing as everything else.
 */
export type Meta = {
  sourceRows: number;
  baseDefaultRate: number;
  rateUnit: string;
  lpiUnit: string;
  unemployed: {
    rows: number;
    reported: number;
    working: number;
    zeroYears: number;
    /** mean over all `reported` applicants - INCLUDES the `zeroYears` who report no job */
    meanYearsReported: number;
    /** mean over the `working` subset - the population the "1,421 of 1,635" count names */
    meanYearsWorking: number;
    medianIncome: number;
    ftMedianIncome: number;
  };
  ltiExact: { n: number; defaultRate: number };
};

export type ProvenanceRow = {
  column_name: string;
  block: "ORIGINAL" | "APPENDED";
  is_derived: boolean;
  effect_on_default: number;
  clears_bonferroni: boolean;
  null_count: number;
  description: string | null;
};

export type Loan = {
  i: number;
  grade: string;
  intent: string;
  home: string;
  gender: string;
  education: string;
  employment: string;
  country: string;
  /** loan-to-income as INTEGER PERCENT. The source column is 2dp and the rule reads it. */
  lpi: number;
  /** interest rate in BASIS POINTS; -1 means missing and is never imputed. */
  rateBp: number;
  amount: number;
  income: number;
  age: number;
  defaulted: 0 | 1;
  priorDefault: 0 | 1;
  empMissing: 0 | 1;
  pastDelinq: number;
};

function decode(): Loan[] {
  const lv = (c: string) => P.cols[c].levels;
  const cd = (c: string) => P.cols[c].codes;
  const out: Loan[] = new Array(P.n);
  for (let i = 0; i < P.n; i++) {
    out[i] = {
      i,
      grade: lv("loan_grade")[cd("loan_grade")[i]],
      intent: lv("loan_intent")[cd("loan_intent")[i]],
      home: lv("person_home_ownership")[cd("person_home_ownership")[i]],
      gender: lv("gender")[cd("gender")[i]],
      education: lv("education_level")[cd("education_level")[i]],
      employment: lv("employment_type")[cd("employment_type")[i]],
      country: lv("country")[cd("country")[i]],
      lpi: P.lpi_pct[i],
      rateBp: P.rate_bp[i],
      amount: P.amnt[i],
      income: P.income_h[i] * 100,
      age: P.age[i],
      defaulted: P.status[i] as 0 | 1,
      priorDefault: P.prior_default[i] as 0 | 1,
      empMissing: P.emp_missing[i] as 0 | 1,
      pastDelinq: P.past_delinq[i],
    };
  }
  return out;
}

const ALL: Loan[] = decode();
export const allRows = () => ALL;
export const PROVENANCE = P.provenance;
export const META = P.meta;
export const [ready] = createSignal(true);

// ---------------------------------------------------------------------------------------
// THE RULES - defined ONCE (see the header note)
// ---------------------------------------------------------------------------------------

export type Rule = {
  key: string;
  label: string;
  /** the condition, written the way it reads on the poster */
  expr: string;
  test: (l: Loan) => boolean;
};

/**
 * The loan-to-income threshold, as ONE number. `WALL_AT` in Dashboard.tsx and the chart
 * boundary in charts/TheWall.tsx both read it, so "30" cannot mean two things on one page.
 */
export const LTI_THRESHOLD_PCT = 30;

export const RULES: Rule[] = [
  {
    key: "renter",
    // prose-number-ok: I1, analysis/insights.md - 0.30 is the rule's DEFINITION, not a
    // measurement of the book. There is nothing to recompute it against: it is the input
    // whose consequences (n, rate, exceptions) are the tagged, verified figures. It is
    // written once here and interpolated everywhere else it appears.
    label: `Renters above ${LTI_THRESHOLD_PCT}% loan-to-income`,
    expr: `RENT  &  loan_percent_income > 0.${LTI_THRESHOLD_PCT}`,
    // STRICTLY greater. At exactly 0.30 renters default at 28.5%; past it, at 100%.
    test: (l) => l.home === "RENT" && l.lpi > LTI_THRESHOLD_PCT,
  },
  {
    key: "debtcon",
    label: "Sub-prime debt consolidation, not a homeowner",
    expr: "grade D-G  &  DEBTCONSOLIDATION  &  not OWN",
    test: (l) =>
      ["D", "E", "F", "G"].includes(l.grade) &&
      l.intent === "DEBTCONSOLIDATION" &&
      l.home !== "OWN",
  },
];

export const matchesAnyRule = (l: Loan) => RULES.some((r) => r.test(l));

export type RuleStat = {
  key: string;
  label: string;
  expr: string;
  n: number;
  defaults: number;
  defaultRate: number;
  /** the number that makes it a rule rather than a tendency */
  exceptions: number;
  principal: number;
  shareOfBook: number;
  shareOfDefaults: number;
  avgRateBp: number;
};

export function ruleStats(rows: Loan[]): RuleStat[] {
  const totalDefaults = rows.reduce((a, l) => a + l.defaulted, 0);
  const one = (key: string, label: string, expr: string, hit: Loan[]): RuleStat => {
    const defaults = hit.reduce((a, l) => a + l.defaulted, 0);
    const priced = hit.filter((l) => l.rateBp >= 0);
    return {
      key, label, expr,
      n: hit.length,
      defaults,
      defaultRate: hit.length ? (100 * defaults) / hit.length : 0,
      exceptions: hit.length - defaults,
      principal: hit.reduce((a, l) => a + l.amount, 0),
      shareOfBook: rows.length ? (100 * hit.length) / rows.length : 0,
      shareOfDefaults: totalDefaults ? (100 * defaults) / totalDefaults : 0,
      avgRateBp: priced.length ? priced.reduce((a, l) => a + l.rateBp, 0) / priced.length : NaN,
    };
  };
  return [
    ...RULES.map((r) => one(r.key, r.label, r.expr, rows.filter(r.test))),
    one("union", "Both rules together", "either of the above", rows.filter(matchesAnyRule)),
  ];
}

// ---------------------------------------------------------------------------------------
// Cross-filter
// ---------------------------------------------------------------------------------------

/**
 * Re-export, never redeclare: the filter VALUES come from the kit's global store, whose
 * `field` is `string`. Narrowing it to `keyof Loan` here made `Accessor<Filter[]>`
 * unassignable to `derived()`, and every consumer degraded to `unknown`.
 * See .workbench/docs/LEARNINGS.md.
 */
export type { Filter };

export function apply(rows: Loan[], filters: Filter[]): Loan[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => f.values.includes(r[f.field as keyof Loan] as string | number))
  );
}

// ---------------------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------------------

export const defaultRate = (rows: Loan[]) =>
  rows.length ? (100 * rows.reduce((a, l) => a + l.defaulted, 0)) / rows.length : 0;

export const meanRateBp = (rows: Loan[]) => {
  const p = rows.filter((l) => l.rateBp >= 0);
  return p.length ? p.reduce((a, l) => a + l.rateBp, 0) / p.length : NaN;
};

export function groupBy<K extends keyof Loan>(rows: Loan[], key: K) {
  const m = new Map<Loan[K], Loan[]>();
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
  defaultRate: number;
  meanRateBp: number;
  principal: number;
  share: number;
};

export function by(rows: Loan[], key: keyof Loan): Group[] {
  return [...groupBy(rows, key)].map(([k, g]) => ({
    k: String(k),
    n: g.length,
    defaultRate: defaultRate(g),
    meanRateBp: meanRateBp(g),
    principal: g.reduce((a, l) => a + l.amount, 0),
    share: rows.length ? (100 * g.length) / rows.length : 0,
  }));
}

// ---------------------------------------------------------------------------------------
// THE WALL - per-1pp bins of loan-to-income, split by housing tenure
// ---------------------------------------------------------------------------------------

export type WallBin = {
  lpi: number;
  byTenure: Record<string, { n: number; defaultRate: number }>;
  /** mean price charged to RENTERS in this bin - the flat line under the wall */
  rentRateBp: number;
  n: number;
};

export const TENURES = ["RENT", "MORTGAGE", "OWN"] as const;

export function wall(rows: Loan[], lo = 5, hi = 45): WallBin[] {
  const out: WallBin[] = [];
  for (let x = lo; x <= hi; x++) {
    const bin = rows.filter((l) => l.lpi === x);
    const byTenure: WallBin["byTenure"] = {};
    for (const t of TENURES) {
      const g = bin.filter((l) => l.home === t);
      byTenure[t] = { n: g.length, defaultRate: g.length ? defaultRate(g) : NaN };
    }
    const rent = bin.filter((l) => l.home === "RENT");
    out.push({ lpi: x, byTenure, rentRateBp: meanRateBp(rent), n: bin.length });
  }
  return out;
}

/**
 * Like-for-like renters either side of the line - the "+14 bp" figure.
 *
 * THE COMPARISON BAND IS A CHOICE, and the integrity pass was right to press on it. "Renters
 * just below the line" is 20-30% loan-to-income: a ten-point band, n=3,979, giving +13.66 bp.
 * The gap is NOT stable across bands, and the honest statement says which band it is:
 *
 *     [0.10, 0.30]  n=10,247   +42.69 bp
 *     [0.15, 0.30]  n= 6,846   +26.63 bp
 *     [0.20, 0.30]  n= 3,979   +13.66 bp   <- published
 *     [0.25, 0.30]  n= 1,802    +7.93 bp
 *     [0.27, 0.30]  n= 1,134    -0.63 bp
 *     [0.28, 0.30]  n=   820    +0.05 bp
 *     [0.30, 0.30]  n=   284   +23.18 bp
 *
 * Every band is inside ±43 bp of zero and the tightest ones are inside 1 bp. The FINDING is
 * that price does not move across a step from 26% default to 100% default, and a gap that
 * collapses toward zero as the comparison tightens strengthens it. The published +14 bp is
 * a mid-range choice, not a best case - but it is a choice, and it is labelled as one.
 */
export const PRICE_BAND = { lo: 20, hi: LTI_THRESHOLD_PCT } as const;

/* Band labels live beside the band itself so a label cannot survive a change to the filter
 * beneath it. Both the dashboard and the guided tour read these. */
export const BAND_LABEL = `${PRICE_BAND.lo}-${PRICE_BAND.hi}%`;
export const NARROW_BAND_LABEL = `exactly ${PRICE_BAND.hi}%`;
export const TIGHT_BAND_LABEL = `${PRICE_BAND.hi - 2}-${PRICE_BAND.hi}%`;
export const ABOVE_LABEL = `above ${LTI_THRESHOLD_PCT}%`;

export function priceOfCertainty(rows: Loan[]) {
  const rent = rows.filter((l) => l.home === "RENT");
  const below = rent.filter((l) => l.lpi >= PRICE_BAND.lo && l.lpi <= PRICE_BAND.hi);
  const above = rent.filter((l) => l.lpi > LTI_THRESHOLD_PCT);
  return {
    below: { n: below.length, defaultRate: defaultRate(below), rateBp: meanRateBp(below) },
    above: { n: above.length, defaultRate: defaultRate(above), rateBp: meanRateBp(above) },
    gapBp: meanRateBp(above) - meanRateBp(below),
  };
}

// ---------------------------------------------------------------------------------------
// THE RANK THAT FLIPS - loan intent, whole book vs rules removed
// ---------------------------------------------------------------------------------------

export type RankFlip = {
  k: string;
  rawRate: number;
  rawRank: number;
  cleanRate: number;
  cleanRank: number;
  n: number;
};

export function rankFlip(rows: Loan[]): RankFlip[] {
  const clean = rows.filter((l) => !matchesAnyRule(l));
  const rank = (rs: Loan[]) => {
    const g = by(rs, "intent").sort((a, b) => b.defaultRate - a.defaultRate);
    return new Map(g.map((x, i) => [x.k, { rate: x.defaultRate, rank: i + 1, n: x.n }]));
  };
  const a = rank(rows);
  const b = rank(clean);
  return [...a].map(([k, v]) => ({
    k,
    rawRate: v.rate,
    rawRank: v.rank,
    cleanRate: b.get(k)?.rate ?? NaN,
    cleanRank: b.get(k)?.rank ?? NaN,
    n: v.n,
  })).sort((x, y) => x.rawRank - y.rawRank);
}

/** The grade ladder, whole book vs rules removed. Publishing the raw D rate is the trap. */
export function ladder(rows: Loan[]) {
  const clean = rows.filter((l) => !matchesAnyRule(l));
  const grades = [...new Set(rows.map((l) => l.grade))].sort();
  return grades.map((g) => ({
    k: g,
    raw: defaultRate(rows.filter((l) => l.grade === g)),
    clean: defaultRate(clean.filter((l) => l.grade === g)),
    n: rows.filter((l) => l.grade === g).length,
  }));
}

// ---------------------------------------------------------------------------------------
// PRICE AGAINST RISK - grade x tenure segments
// ---------------------------------------------------------------------------------------

export function segments(rows: Loan[], minN = 150) {
  const out: { k: string; grade: string; home: string; n: number; defaultRate: number; rateBp: number }[] = [];
  for (const g of [...new Set(rows.map((l) => l.grade))].sort()) {
    for (const h of TENURES) {
      const s = rows.filter((l) => l.grade === g && l.home === h);
      if (s.length >= minN) {
        out.push({ k: `${g}/${h}`, grade: g, home: h, n: s.length,
                   defaultRate: defaultRate(s), rateBp: meanRateBp(s) });
      }
    }
  }
  return out.sort((a, b) => b.defaultRate - a.defaultRate);
}

// ---------------------------------------------------------------------------------------
// Reactive wrapper
// ---------------------------------------------------------------------------------------

export function derived<T>(fn: (rs: Loan[]) => T, filters: () => Filter[]) {
  return createMemo(() => {
    const t0 = performance.now();
    const out = fn(apply(ALL, filters()));
    const ms = performance.now() - t0;
    if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
    return out;
  });
}

// ---------------------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------------------

const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const dec = (n: number, d = 1) => n.toFixed(d);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
/** basis points -> a percentage string. The unit the finding is quoted in. */
export const bpPct = (bp: number, d = 2) => (bp / 100).toFixed(d) + "%";
export const money = (n: number) =>
  Math.abs(n) >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B"
  : Math.abs(n) >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M"
  : Math.abs(n) >= 1e3 ? "$" + Math.round(n / 1e3) + "K"
  : "$" + int(n);
