/**
 * Data layer - 2025/06.
 *
 * Every number rendered is computed here, at query time, from the row-level post table.
 * Nothing is precomputed, nothing is hardcoded. tools/verify_metrics.py recomputes each
 * rendered figure from the PARQUET via DuckDB in Python and asserts the DOM matches, so
 * this JS path is checked against a real SQL engine.
 *
 * ARCHITECTURE NOTE (see model/build.py::export_app_data): docs/STACK.md specifies
 * DuckDB-WASM. Its engine is 32 MB; this table is 5,600 rows and aggregates in under a
 * millisecond in JS, against a 3s cold-load budget. The DuckDB-WASM client stays in
 * packages/dna-kit for months whose data needs it.
 */
import { createResource, createSignal } from "solid-js";

export type Row = {
  d: string;
  platform: string;
  post_type: string;
  content_category: string;
  main_hashtag: string;
  region: string;
  content_type: string;
  month: number;
  month_name: string;
  day_name: string;
  post_hour: number;
  views: number;
  impressions: number;
  engagement: number;
  engagement_rate: number;
  likes: number;
  shares: number;
  comments: number;
  video_views: number;
  live_stream_views: number;
  clicks: number | null;
  click_through_rate: number | null;
  derived_band: string;
  click_tracking: string;
  is_thin_sample: boolean;
  level_disagrees: boolean;
};

export type Filter = { field: string; values: (string | number)[] };

const base = import.meta.env.BASE_URL || "/";
const [all, setAll] = createSignal<Row[]>([]);
/** The whole corpus, unfiltered. The masthead and the colophon describe the FILE, not the
 *  current selection, so they read this rather than the filtered view. */
export const allRows = all;
export const [ready, setReady] = createSignal(false);

export async function boot() {
  const res = await fetch(`${base}data/posts.json`);
  if (!res.ok) throw new Error(`could not load posts.json: ${res.status}`);
  setAll((await res.json()) as Row[]);
  setReady(true);
}

export function apply(rowsIn: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rowsIn;
  return rowsIn.filter((r) => filters.every((f) => f.values.includes((r as any)[f.field])));
}

// ---------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------
const sum = (rs: Row[], k: keyof Row) => rs.reduce((a, r) => a + ((r[k] as number) || 0), 0);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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

/** Best-over-worst gap, as a percentage. The only "spread" this report ever means. */
export function spreadPct(xs: number[]): number {
  if (!xs.length) return 0;
  const hi = Math.max(...xs);
  const lo = Math.min(...xs);
  return lo ? (hi / lo - 1) * 100 : 0;
}

/** Pearson correlation. Used once, for the impressions-to-views relationship. */
export function corr(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.reduce((a, x) => a + x, 0) / n;
  const my = ys.reduce((a, y) => a + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * η² - the share of variance in `resp` accounted for by the categorical `field`.
 * Between-group sum of squares over total sum of squares, i.e. the R² of a one-way model.
 *
 * Computed here rather than typed into a caption so that (a) it cannot drift from the bars
 * beside it and (b) it responds to the filter set like every other figure on the page.
 * `model/metric_checks.yml` reproduces each one in DuckDB against the parquet.
 */
export function etaSq(rs: Row[], field: keyof Row, resp: (r: Row) => number): number {
  if (rs.length < 2) return 0;
  const ys = rs.map(resp);
  const mu = ys.reduce((a, y) => a + y, 0) / ys.length;
  const g = new Map<any, { n: number; s: number }>();
  rs.forEach((r, i) => {
    const c = g.get(r[field]) ?? { n: 0, s: 0 };
    c.n++; c.s += ys[i];
    g.set(r[field], c);
  });
  let ssb = 0;
  for (const c of g.values()) ssb += c.n * (c.s / c.n - mu) ** 2;
  const sst = ys.reduce((a, y) => a + (y - mu) ** 2, 0);
  return sst ? ssb / sst : 0;
}

/** log(views) - the response the report tests on, because views are right-skewed. */
export const logViews = (r: Row) => Math.log(Math.max(r.views, 1));
export const rateOf = (r: Row) => r.engagement_rate;

/**
 * η² of `field` measured INSIDE each level of `by`, pooled: between-cell sums of squares
 * summed over strata, divided by within-stratum total. Identical to the semi-partial
 * (R²_cells - R²_by) / (1 - R²_by). This is the number the hashtag mirage turns on -
 * "how much does the hashtag explain once the content category is held constant" - and
 * it must be measured on the cells, not on hashtags pooled across categories.
 */
export function etaSqWithin(
  rs: Row[], by: keyof Row, field: keyof Row, resp: (r: Row) => number,
): number {
  let num = 0, den = 0;
  for (const stratum of groupBy(rs, by).values()) {
    if (stratum.length < 2) continue;
    const ys = stratum.map(resp);
    const mu = ys.reduce((a, y) => a + y, 0) / ys.length;
    const cells = new Map<any, { n: number; s: number }>();
    stratum.forEach((r, i) => {
      const c = cells.get(r[field]) ?? { n: 0, s: 0 };
      c.n++; c.s += ys[i];
      cells.set(r[field], c);
    });
    for (const c of cells.values()) num += c.n * (c.s / c.n - mu) ** 2;
    den += ys.reduce((a, y) => a + (y - mu) ** 2, 0);
  }
  return den ? num / den : 0;
}

/**
 * η² over the CELLS of two crossed factors - the R² of the saturated two-factor model.
 * Subtracting a one-way η² from it gives the incremental R² of the other factor: the
 * mirage panel quotes both increments ("hashtag adds X once category is known"), and they
 * are computed here so they cannot drift from the bars they are explaining.
 */
export function etaSqCross(
  rs: Row[], a: keyof Row, b: keyof Row, resp: (r: Row) => number,
): number {
  if (rs.length < 2) return 0;
  const ys = rs.map(resp);
  const mu = ys.reduce((x, y) => x + y, 0) / ys.length;
  const cells = new Map<string, { n: number; s: number }>();
  rs.forEach((r, i) => {
    const key = `${String(r[a])}\u0000${String(r[b])}`;
    const c = cells.get(key) ?? { n: 0, s: 0 };
    c.n++; c.s += ys[i];
    cells.set(key, c);
  });
  let ssb = 0;
  for (const c of cells.values()) ssb += c.n * (c.s / c.n - mu) ** 2;
  const sst = ys.reduce((x, y) => x + (y - mu) ** 2, 0);
  return sst ? ssb / sst : 0;
}

/** What the file IS, as opposed to what the current selection is. Drives the masthead
 *  context strip and the colophon, both of which describe the corpus. */
export function corpus(rs: Row[]) {
  const withClicks = rs.filter((r) => r.clicks != null).length;
  return {
    posts: rs.length,
    platforms: new Set(rs.map((r) => r.platform)).size,
    regions: new Set(rs.map((r) => r.region)).size,
    formats: new Set(rs.map((r) => r.post_type)).size,
    click_coverage: rs.length ? (100 * withClicks) / rs.length : 0,
    no_click_share: rs.length ? (100 * (rs.length - withClicks)) / rs.length : 0,
  };
}

// ---------------------------------------------------------------------------------------
// THE PROVENANCE STRIP - the report's argument, as data.
// `origin` is fixed, not computed: it is what the analysis established (insights.md I-3/I-4)
// and it must not change under filtering.
// ---------------------------------------------------------------------------------------
export type Provenance = {
  key: string;
  name: string;
  value: number;
  display: string;
  origin: "measured" | "derived" | "label" | "partial";
  why: string;
};

export function provenance(rs: Row[]): Provenance[] {
  const views = sum(rs, "views");
  const impressions = sum(rs, "impressions");
  const engagement = sum(rs, "engagement");
  const rate = rs.length ? rs.reduce((a, r) => a + r.engagement_rate, 0) / rs.length : 0;
  const withClicks = rs.filter((r) => r.clicks != null).length;
  const cov = rs.length ? (100 * withClicks) / rs.length : 0;
  const ipv = views ? impressions / views : 0;
  // r is computed, not quoted: the "reach" column is views scaled by a random factor, and
  // the correlation that proves it must move with the filter set like everything else.
  const r = corr(rs.map((x) => x.views), rs.map((x) => x.impressions));
  return [
    {
      key: "views", name: "Views", value: views, display: big(views),
      origin: "measured", why: "the only column not derived from another",
    },
    {
      key: "impressions", name: "Impressions", value: impressions, display: big(impressions),
      origin: "derived", why: `= views × ${ipv.toFixed(3)} (uniform 1.1-1.3, r=${r.toFixed(3)})`,
    },
    {
      key: "engagement", name: "Engagement", value: engagement, display: big(engagement),
      origin: "derived", why: "= engagement rate × views",
    },
    {
      key: "engagement_rate", name: "Engagement rate", value: rate, display: pct(rate * 100, 2),
      origin: "label", why: "drawn from 4 fixed bands keyed to content tier",
    },
    {
      key: "click_coverage", name: "Clicks", value: cov, display: `${pct(cov)} of posts`,
      // Not "3 of 6 platforms": LinkedIn is partial WITHIN itself. See insights.md I-5.
      origin: "partial", why: "2 platforms track every post, LinkedIn some, 3 none",
    },
  ];
}

// ---------------------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------------------
export type FormatRow = {
  k: string; posts: number; med_views: number;
  view_share: number; post_share: number; thin: boolean;
};

export function formats(rs: Row[]): FormatRow[] {
  const tv = sum(rs, "views");
  return [...groupBy(rs, "post_type")]
    .map(([k, g]) => ({
      k: k as string,
      posts: g.length,
      med_views: median(g.map((r) => r.views)),
      view_share: tv ? (100 * sum(g, "views")) / tv : 0,
      post_share: rs.length ? (100 * g.length) / rs.length : 0,
      thin: g.length < 100,
    }))
    .sort((a, b) => b.med_views - a.med_views);
}

export type PlatformRow = {
  k: string; posts: number; med_views: number; view_share: number;
  click_coverage: number; tracking: string;
};

export function platforms(rs: Row[]): PlatformRow[] {
  const tv = sum(rs, "views");
  return [...groupBy(rs, "platform")]
    .map(([k, g]) => ({
      k: k as string,
      posts: g.length,
      med_views: median(g.map((r) => r.views)),
      view_share: tv ? (100 * sum(g, "views")) / tv : 0,
      click_coverage: (100 * g.filter((r) => r.clicks != null).length) / g.length,
      tracking: g[0].click_tracking,
    }))
    .sort((a, b) => b.med_views - a.med_views);
}

export function regions(rs: Row[]) {
  const tv = sum(rs, "views");
  return [...groupBy(rs, "region")]
    .map(([k, g]) => ({
      k: k as string, posts: g.length,
      med_views: median(g.map((r) => r.views)),
      view_share: tv ? (100 * sum(g, "views")) / tv : 0,
    }))
    .sort((a, b) => b.med_views - a.med_views);
}

/** THE HASHTAG MIRAGE. `grouped=false` ranks hashtags (looks like a finding);
 *  `grouped=true` nests them inside their content category (the effect vanishes). */
export type HashRow = {
  k: string; category: string; posts: number; rate: number; med_views: number;
};

export function hashtags(rs: Row[], minPosts = 100): HashRow[] {
  return [...groupBy(rs, "main_hashtag")]
    .map(([k, g]) => ({
      k: k as string,
      // The pooled rate spans every category this hashtag appears in, so `category` is
      // only ever a label of convenience here. It is NOT safe to group on - see
      // hashtagCells(). Kept for the flat ranking's table column.
      category: g[0].content_category,
      posts: g.length,
      rate: g.reduce((a, r) => a + r.engagement_rate, 0) / g.length,
      med_views: median(g.map((r) => r.views)),
    }))
    .filter((r) => r.posts >= minPosts)
    .sort((a, b) => b.rate - a.rate);
}

/** Minimum posts for one (hashtag x category) cell to be rankable. Below this the cells
 *  are thin enough to manufacture a spread: with no floor the widest "within-category"
 *  spread is 9.24pp, against 0.31pp at this threshold. Recorded in assumptions.md. */
export const MIN_CELL_POSTS = 50;

/** THE GROUPED HALF OF THE MIRAGE. One row per (hashtag, category) pair.
 *
 *  This must not be derived from hashtags() above. That function pools a hashtag across
 *  every category it appears in and then labels the pool with a single category, so a
 *  "spread inside a category" computed from it is really a spread between blended rates
 *  filed under arbitrary headings - #SuccessStory is 73% Educational but lands under
 *  Customer Story, and #DidYouKnow's pooled 15.24% blends its Educational 19.85% with
 *  its Entertainment 7.60%. Measuring the cells directly is the only way the grouped
 *  view means what its caption says. */
export function hashtagCells(rs: Row[], minPosts = MIN_CELL_POSTS): HashRow[] {
  const cells = new Map<string, Row[]>();
  for (const r of rs) {
    const key = `${r.content_category}\u0000${r.main_hashtag}`;
    const g = cells.get(key);
    if (g) g.push(r);
    else cells.set(key, [r]);
  }
  return [...cells.values()]
    .map((g) => ({
      k: g[0].main_hashtag as string,
      category: g[0].content_category as string,
      posts: g.length,
      rate: g.reduce((a, r) => a + r.engagement_rate, 0) / g.length,
      med_views: median(g.map((r) => r.views)),
    }))
    .filter((r) => r.posts >= minPosts)
    .sort((a, b) => b.rate - a.rate);
}

export function categories(rs: Row[]) {
  return [...groupBy(rs, "content_category")]
    .map(([k, g]) => ({
      k: k as string,
      posts: g.length,
      rate: g.reduce((a, r) => a + r.engagement_rate, 0) / g.length,
      min_rate: Math.min(...g.map((r) => r.engagement_rate)),
      max_rate: Math.max(...g.map((r) => r.engagement_rate)),
      med_views: median(g.map((r) => r.views)),
    }))
    .sort((a, b) => b.rate - a.rate);
}

export function byField(rs: Row[], field: keyof Row) {
  const tv = sum(rs, "views");
  return [...groupBy(rs, field)]
    .map(([k, g]) => ({
      k: String(k), posts: g.length,
      med_views: median(g.map((r) => r.views)),
      view_share: tv ? (100 * sum(g, "views")) / tv : 0,
      rate: g.reduce((a, r) => a + r.engagement_rate, 0) / g.length,
    }))
    .sort((a, b) => b.med_views - a.med_views);
}

export function months(rs: Row[]) {
  return [...groupBy(rs, "d")].length === 0
    ? []
    : [...groupBy(rs, "month")]
        .map(([m, g]) => ({
          m: m as number, month_name: g[0].month_name,
          posts: g.length, views: sum(g, "views"),
          med_views: median(g.map((r) => r.views)),
        }))
        .sort((a, b) => a.m - b.m);
}

/** Recompute whenever the filter set changes. */
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

// ---------------------------------------------------------------------------------------
// formatters
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const big = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + "bn" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : int(n);
export const pct = (n: number, d = 1) => n.toFixed(d) + "%";
