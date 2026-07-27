/**
 * Data layer - 2026/07 Global AI Adoption & Workforce Displacement Index.
 *
 * Every number rendered anywhere is computed here from the JSON exported by model/build.py.
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET via
 * DuckDB in Python and asserts the DOM matches.
 *
 * THE RULE THIS FILE ENFORCES: the two candidate fits always travel together.
 *
 * The file's only real signal is a level shift, and a straight line through it is significant
 * at p = 0.0001. A helper that returned "the trend" would reproduce the error the page exists
 * to correct - so `Quarter` carries `step_fit` and `linear_fit` on every row, and `FIT_RESIDUAL`
 * carries both residual sums of squares.
 */
import { createResource, createSignal } from "solid-js";

export type Quarter = {
  date_id: number; year_quarter_label: string; generative_ai_era: boolean;
  rows: number; mean_adoption: number; mean_tool_hours: number | null; mean_risk: number;
  jobs_displaced: number; reskilling_usd: number;
  step_fit: number; linear_fit: number;
};

export type Question = {
  n: number; asked_by: string; question: string; answer: string;
  statistic: string; verdict: string;
};

export type RiskDriver = {
  driver: string; source: string; what_it_describes: string;
  spearman_rho: number; p_value: number; is_related: boolean;
};

export type Defect = { n: number; column_name: string; defect: string; detail: string };

export type JobRow = {
  index_id: number; jobs_displaced_count: number; jobs_created_count: number;
  jobs_created_fitted: number; creation_ratio: number;
  country_name: string; industry_name: string; skill_category_name: string;
};

export type Skill = {
  skill_category_name: string; ai_replaceability_score: number;
  rows: number; mean_risk: number; jobs_displaced: number; reskilling_usd: number;
};

export type Country = {
  country_name: string; development_tier: string; region: string;
  rows: number; mean_adoption: number; mean_risk: number;
};

export type Segment = {
  country_name: string; industry_name: string; skill_category_name: string; observations: number;
};

export type Filter = { field: string; values: (string | number)[] };

const base = import.meta.env.BASE_URL || "/";

const [quarters, setQuarters] = createSignal<Quarter[]>([]);
const [questions, setQuestions] = createSignal<Question[]>([]);
const [riskDrivers, setRiskDrivers] = createSignal<RiskDriver[]>([]);
const [defects, setDefects] = createSignal<Defect[]>([]);
const [jobs, setJobs] = createSignal<JobRow[]>([]);
const [skills, setSkills] = createSignal<Skill[]>([]);
const [countries, setCountries] = createSignal<Country[]>([]);
const [segments, setSegments] = createSignal<Segment[]>([]);
const [headline, setHeadline] = createSignal<Record<string, any>>({});
export const [ready, setReady] = createSignal(false);

async function grab<T>(name: string): Promise<T> {
  const res = await fetch(`${base}data/${name}.json`);
  if (!res.ok) throw new Error(`could not load ${name}.json: ${res.status}`);
  return (await res.json()) as T;
}

export async function boot() {
  const [q, qs, rv, de, jb, sk, co, sg, hd] = await Promise.all([
    grab<Quarter[]>("quarters"), grab<Question[]>("questions"),
    grab<RiskDriver[]>("risk_validation"), grab<Defect[]>("defects"),
    grab<JobRow[]>("jobs"), grab<Skill[]>("skills"), grab<Country[]>("countries"),
    grab<Segment[]>("segments"), grab<Record<string, any>[]>("headline"),
  ]);
  setQuarters(q); setQuestions(qs); setRiskDrivers(rv); setDefects(de);
  setJobs(jb); setSkills(sk); setCountries(co); setSegments(sg); setHeadline(hd[0]);
  setReady(true);
}

export { quarters, questions, riskDrivers, defects, jobs, skills, countries, segments, headline };

// ---------------------------------------------------------------------------------------
// the fit toggle - the argument, so it is state rather than a style
// ---------------------------------------------------------------------------------------

export type Fit = "both" | "step" | "line";
export const FITS: Fit[] = ["both", "step", "line"];
export const FIT_LABEL: Record<Fit, string> = {
  both: "Both models",
  step: "Step at 2022-Q4",
  line: "Linear trend",
};
/** The note under the toggle. A FUNCTION of the headline, not a constant: every figure in it
 *  is a fitted quantity, and a sentence typed once does not move when the data does. */
export function fitNote(h: Record<string, any>): Record<Fit, string> {
  return {
    both: "Both candidate models drawn over the sixteen observed quarterly means. Neither replaces the points.",
    step: `One level of ${pt(h.pre_mean ?? 0)}% for seven quarters, then ${pt(h.post_mean ?? 0)}% for nine. Residual sum of squares ${pt(h.ss_step ?? 0, 1)}.`,
    line: `A straight line at +${pt(h.linear_slope ?? 0)} points per quarter. R² ${pt(h.linear_r2 ?? 0, 3)}, p ${pval(h.linear_p ?? 1)} - statistically significant, and it does not touch the data. Residual sum of squares ${pt(h.ss_linear ?? 0, 1)}.`,
  };
}

/** The fields a QUARTER actually has.
 *
 *  This set exists because of a bug the perf harness caught at G7: clicking a country emitted
 *  a `development_tier` filter, `applyQuarters` tested every quarter for a field quarters do
 *  not carry, every test failed, and the signature went from sixteen points to zero. The page
 *  silently claimed the series was empty for developed economies.
 *
 *  The reason it cannot carry that field is that the quarterly series is pre-aggregated over
 *  all 300 records, so it has no country attribute to test. That is a property of THIS series,
 *  not of the file: both tiers are present in all 16 quarters (min 4 records per cell), so a
 *  tier-by-quarter series is computable - it is a country-by-quarter one that is not, at a
 *  median of one record per cell. The 2026-07 audit found the chip bar claiming the stronger,
 *  false version. A filter on a field the series does not carry must leave it alone AND say
 *  why. Silently emptying a chart is the failure mode; overstating the reason is the next one. */
export const QUARTER_FIELDS = new Set(["generative_ai_era", "year_quarter_label", "date_id"]);

/** Apply the cross-filter store's shape. Compared as strings: `generative_ai_era` is boolean. */
export function applyQuarters(rows: Quarter[], filters: Filter[]): Quarter[] {
  const usable = filters.filter((f) => QUARTER_FIELDS.has(f.field));
  if (!usable.length) return rows;
  return rows.filter((r) =>
    usable.every((f) => f.values.some((v) => String(v) === String((r as any)[f.field]))));
}

/** Filters that name a field the quarterly series has no cell for. */
export function inapplicableToQuarters(filters: Filter[]): Filter[] {
  return filters.filter((f) => !QUARTER_FIELDS.has(f.field));
}

/** The country list under the active filters - countries DO carry tier and region. */
export function applyCountries(rows: Country[], filters: Filter[]): Country[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => !(f.field in r)
      || f.values.some((v) => String(v) === String((r as any)[f.field]))));
}

export function derived<T>(fn: (rows: Quarter[]) => T, filters: () => Filter[]) {
  const [data] = createResource(
    () => (ready() ? filters() : null),
    (fs: Filter[]) => fn(applyQuarters(quarters(), fs)));
  return data;
}

// ---------------------------------------------------------------------------------------
// formatters
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-GB");
export const int = (n: number) => nf.format(Math.round(n));
export const usd2 = (n: number) =>
  "$" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n: number) => "$" + nf.format(Math.round(n));
export const usdCompact = (n: number) =>
  n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "m" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "k" : usd0(n);
export const pt = (n: number, d = 2) => n.toFixed(d);
export const pp = (n: number, d = 2) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d) + "pp";
export const rho = (n: number) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(3);
/** Below this a p value is printed as a bound rather than a figure. It is the print floor of
 *  `toFixed(3)`, not a result - so it is declared ONCE and interpolated, never typed into a
 *  string where it could drift out of step with the precision beside it. */
const P_FLOOR = 0.001;
export const pval = (n: number) => (n < P_FLOOR ? `< ${P_FLOOR}` : n.toFixed(3));
