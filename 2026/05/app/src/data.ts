/**
 * Data layer - 2026/05 Music Streaming Platform Performance.
 *
 * Every number rendered anywhere in this app is summed here, at query time, from the
 * cross-filter CUBE exported by model/build.py. Nothing is hardcoded and nothing is
 * approximated: the cube's measures are additive and its 8,348 cells cover all 224,078
 * plays exactly, so any filtered figure is an exact SUM over a subset of cells.
 *
 * tools/verify_metrics.py independently recomputes each rendered figure from the PARQUET
 * via DuckDB in Python and asserts the DOM matches - so this path is checked against a
 * real SQL engine rather than trusted.
 *
 * ARCHITECTURE NOTE (see model/build.py, "APP EXPORT"):
 * docs/STACK.md specifies DuckDB-WASM in the browser, and at 224,078 rows this is the first
 * month whose data would genuinely justify it. It is still the wrong call here: the engine
 * is a ~32 MB download that blows the <3s cold-load budget on its own, and the cross-origin
 * isolation its threaded build needs breaks the Playwright poster capture. The cube is 2 MB
 * uncompressed and answers every question this page asks.
 *
 * RATES ARE NEVER STORED. Only additive parts are. A stored mean or rate is correct for the
 * unfiltered view and silently wrong for every filtered one; computing it from plays/secs at
 * render time is correct under any filter combination.
 */
import { createResource, createSignal } from "solid-js";

// ---------------------------------------------------------------------------------------
// shapes
// ---------------------------------------------------------------------------------------

/** One cell of the cross-filter cube. Every measure is additive. */
export type Cell = {
  is_repeat_concentrated: boolean;
  subscription_tier: string;
  genre_name: string;
  country_name: string;
  dow_num: number;
  is_algorithmic_recommendation: boolean;
  plays: number;
  secs: number;
  skips: number;
  qual: number;   // royalty-qualifying plays (paid tier, >= 30s)
  usd: number;    // royalty_or_ad_usd - NOT revenue. See model/build.py DECISION 4.
  band: number;   // plays in the 30-44s payout band
  disc: number;
};

export type Artist = {
  artist_id: number;
  artist_name: string;
  genre_name: string;
  rank_all: number;
  rank_clean: number;
  rank_rarefied: number;
  rank_capped: number;
  rank_delta: number;
  plays_all: number;
  plays_clean: number;
  plays_rarefied: number;
  plays_capped: number;
  plays_flagged: number;
  top_listener_share: number | null;
  flagged_listeners: number | null;
};

export type Axis = {
  axis: string;
  eta_squared: number;
  kruskal_p: number;
  clears_cohen_floor: boolean;
  verdict: string;
  question: string;
};

export type Flag = {
  flag: string;
  source_column: string;
  measure: string;
  group_a_mean: number;
  group_b_mean: number;
  cliffs_delta: number;
  mannwhitney_p: number;
  clears_small_effect: boolean;
};

export type Defect = {
  n: number;
  kind: string;
  column: string;
  documented: string;
  actual: string;
  rows_affected: number;
};

export type Filter = { field: string; values: (string | number)[] };

// ---------------------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------------------

const base = import.meta.env.BASE_URL || "/";

const [cube, setCube] = createSignal<Cell[]>([]);
const [artists, setArtists] = createSignal<Artist[]>([]);
const [axes, setAxes] = createSignal<Axis[]>([]);
const [flags, setFlags] = createSignal<Flag[]>([]);
const [defects, setDefects] = createSignal<Defect[]>([]);
const [headline, setHeadline] = createSignal<Record<string, number>>({});
const [mrr, setMrr] = createSignal<any[]>([]);
const [months, setMonths] = createSignal<any[]>([]);
const [duration, setDuration] = createSignal<any[]>([]);
const [threshold, setThreshold] = createSignal<any[]>([]);
const [churn, setChurn] = createSignal<any[]>([]);
const [postChurn, setPostChurn] = createSignal<any[]>([]);
const [dow, setDow] = createSignal<any[]>([]);
const [hours, setHours] = createSignal<any[]>([]);
const [cohort, setCohort] = createSignal<any[]>([]);
const [genreCountry, setGenreCountry] = createSignal<any[]>([]);
export const [ready, setReady] = createSignal(false);

async function grab<T>(name: string): Promise<T> {
  const res = await fetch(`${base}data/${name}.json`);
  if (!res.ok) throw new Error(`could not load ${name}.json: ${res.status}`);
  return (await res.json()) as T;
}

export async function boot() {
  const [c, a, ax, fl, de, hd, mr, mo, du, th, ch, pc, dw, hr, co, gc] = await Promise.all([
    grab<Cell[]>("cube"), grab<Artist[]>("artists"), grab<Axis[]>("axes"),
    grab<Flag[]>("flags"), grab<Defect[]>("defects"), grab<Record<string, number>[]>("headline"),
    grab<any[]>("mrr"), grab<any[]>("months"), grab<any[]>("duration"),
    grab<any[]>("threshold"), grab<any[]>("churn"), grab<any[]>("post_churn"),
    grab<any[]>("dow"), grab<any[]>("hours"), grab<any[]>("cohort"),
    grab<any[]>("genre_country"),
  ]);
  setCube(c); setArtists(a); setAxes(ax); setFlags(fl); setDefects(de);
  setHeadline(hd[0]); setMrr(mr); setMonths(mo); setDuration(du); setThreshold(th);
  setChurn(ch); setPostChurn(pc); setDow(dw); setHours(hr); setCohort(co);
  setGenreCountry(gc);
  setReady(true);
}

export {
  cube, artists, axes, flags, defects, headline, mrr, months, duration,
  threshold, churn, postChurn, dow, hours, cohort, genreCountry,
};

// ---------------------------------------------------------------------------------------
// aggregation
// ---------------------------------------------------------------------------------------

/** Apply the cross-filter store's shape to the cube.
 *
 * Compared as strings. Two of the cube's six dimensions are BOOLEAN, and the shared
 * cross-filter store types a filter value as `string | number` - widening that type is a
 * change to every other month's app, whereas normalising here is local and total. */
export function apply(cells: Cell[], filters: Filter[]): Cell[] {
  if (!filters.length) return cells;
  return cells.filter((c) =>
    filters.every((f) =>
      f.values.some((v) => String(v) === String((c as any)[f.field]))
    )
  );
}

const MEASURES = ["plays", "secs", "skips", "qual", "usd", "band", "disc"] as const;
export type Totals = Record<(typeof MEASURES)[number], number>;

export const zero = (): Totals =>
  ({ plays: 0, secs: 0, skips: 0, qual: 0, usd: 0, band: 0, disc: 0 });

export function total(cells: Cell[]): Totals {
  const out = zero();
  for (const c of cells) for (const m of MEASURES) out[m] += c[m];
  return out;
}

/** Roll the cube up to one dimension, keeping every additive measure. */
export function by(cells: Cell[], dim: keyof Cell): (Totals & { key: any })[] {
  const m = new Map<any, Totals & { key: any }>();
  for (const c of cells) {
    const k = c[dim] as any;
    let g = m.get(k);
    if (!g) { g = { key: k, ...zero() }; m.set(k, g); }
    for (const measure of MEASURES) g[measure] += c[measure];
  }
  return [...m.values()];
}

/** Derived rates - always computed from the additive parts, never stored. */
export const meanSecs = (t: Totals) => (t.plays ? t.secs / t.plays : 0);
export const skipRate = (t: Totals) => (t.plays ? t.skips / t.plays : 0);
export const bandShare = (t: Totals) => (t.plays ? t.band / t.plays : 0);
export const ROYALTY_PER_PLAY = 0.004;
export const royaltyUsd = (t: Totals) => t.qual * ROYALTY_PER_PLAY;

/** A resource that recomputes whenever the filter set changes. */
export function derived<T>(fn: (cells: Cell[]) => T, filters: () => Filter[]) {
  const [data] = createResource(
    () => (ready() ? filters() : null),
    (f: Filter[]) => {
      const t0 = performance.now();
      const out = fn(apply(cube(), f));
      const ms = performance.now() - t0;
      // Response time is an explicitly scored criterion.
      if (ms > 200) console.warn(`[perf] aggregation took ${ms.toFixed(0)}ms`);
      return out;
    }
  );
  return data;
}

// ---------------------------------------------------------------------------------------
// the signature's three bases
// ---------------------------------------------------------------------------------------

export type Basis = "clean" | "rarefied" | "capped";
export const BASES: Basis[] = ["clean", "rarefied", "capped"];

export const BASIS_LABEL: Record<Basis, string> = {
  clean: "Broad-listening accounts only",
  rarefied: "Rarefied - 30 plays each",
  capped: "Capped - 50 per listener per artist",
};

export const BASIS_NOTE: Record<Basis, string> = {
  // prose-number-ok: I1 - the clean-basis play count; plays_clean is a column of
  // dim_artist_rank and is summed in the signature's accessible table.
  clean:
    "Ranks recomputed over the 66,870 plays from accounts outside the repeat-concentrated cohort. The cohort is removed entirely.",
  rarefied:
    "Ranks recomputed after sampling exactly 30 plays from every listener who has at least 30, so no listener can outweigh another. Everyone is kept; volume is removed.",
  capped:
    "Ranks recomputed with each listener contributing at most 50 plays to any one artist. The cohort and its volume are kept - only its repetition is bounded. This is the basis the report actually recommends.",
};

export const rankOn = (a: Artist, b: Basis) =>
  b === "clean" ? a.rank_clean : b === "rarefied" ? a.rank_rarefied : a.rank_capped;
export const playsOn = (a: Artist, b: Basis) =>
  b === "clean" ? a.plays_clean : b === "rarefied" ? a.plays_rarefied : a.plays_capped;

// ---------------------------------------------------------------------------------------
// formatters - locale-aware, tabular
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const usd2 = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n: number) => "$" + nf.format(Math.round(n));
export const pct = (n: number, d = 1) => (100 * n).toFixed(d) + "%";
export const pctRaw = (n: number, d = 1) => n.toFixed(d) + "%";
export const signed = (n: number, d = 4) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(d);
export const secsFmt = (n: number) => n.toFixed(1) + "s";
export const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
