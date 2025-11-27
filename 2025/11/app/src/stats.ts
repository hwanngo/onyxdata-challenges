/**
 * Significance tests, computed in the browser from the rows the page actually ships.
 *
 * WHY THIS FILE EXISTS. Until this was checked, this month's headline statistic - the
 * Kruskal-Wallis p on ex-tax price by country - was a string typed into six source files.
 * Nothing recomputed it, so nothing noticed that it had been calculated on UNQUANTISED
 * float64 revenue while the app ships integer cents. Kruskal-Wallis is rank-based: quantising
 * to cents merges ties (6,086 distinct ex-tax values become 4,722), which moves H from 4.7758
 * to 4.6865 and p from 0.8534 to 0.8607. The published figure was reproducible only from data
 * the dashboard does not contain.
 *
 * That is exactly the defect this month's own lesson names - "quantise derived values once,
 * upstream" (.workbench/docs/LEARNINGS.md 2025/11) - failing on the number it is most quoted for. The
 * fix is not a better literal. It is to delete the literal: every test below runs over the
 * same `Event[]` the charts render, so the statistic cannot describe a different dataset from
 * the one on screen. `H` is additionally specified in `model/metric_checks.yml` as pure SQL
 * and re-derived from the parquet by DuckDB, which agrees with `scipy.stats.kruskal` to 1e-11.
 *
 * The p-value is a deterministic function of (H, df) - the chi-square survival function
 * below, Numerical Recipes' incomplete gamma, matched against `scipy.stats.chi2.sf` in
 * `model/test_metrics.py`.
 */

/** Log-gamma, Lanczos g=7. Underpins the incomplete gamma below. */
function lngamma(z: number): number {
  const C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lngamma(1 - z);
  const w = z - 1;
  let x = C[0];
  for (let i = 1; i < 9; i++) x += C[i] / (w + i);
  const t = w + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (w + 0.5) * Math.log(t) - t + Math.log(x);
}

const EPS = 1e-15;
const ITMAX = 400;

/** Regularised lower incomplete gamma P(a,x) by series. Converges fast for x < a+1. */
function gser(a: number, x: number): number {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 0; n < ITMAX; n++) {
    ap++;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lngamma(a));
}

/** Regularised upper incomplete gamma Q(a,x) by continued fraction (modified Lentz). */
function gcf(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lngamma(a)) * h;
}

/**
 * Upper tail of the chi-square distribution - the p-value for a statistic of `x` on `df`.
 *
 * Both branches are needed and neither is optional: this month quotes p = 6.9e-23 (reported
 * price, far into the tail, where 1 - P would cancel to zero in float64) and p = 0.86
 * (ex-tax, near the centre). The series is used below x = a+1 and the continued fraction
 * above it, which is what keeps 6.9e-23 accurate to four significant figures.
 */
export function chi2sf(x: number, df: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(df) || df <= 0) return NaN;
  if (x <= 0) return 1;
  const a = df / 2;
  const t = x / 2;
  return t < a + 1 ? 1 - gser(a, t) : gcf(a, t);
}

export type KWResult = {
  /** Tie-corrected H. Specified as SQL in model/metric_checks.yml. */
  H: number;
  df: number;
  p: number;
  /** ε²/η² for a rank test: (H - k + 1)/(N - k). Negative when H is below its null mean. */
  eta2: number;
  /** Total observations entering the test - reported so a filtered view stays honest. */
  n: number;
  /** Number of groups compared. */
  k: number;
};

/**
 * Kruskal-Wallis H across groups, WITH the tie correction.
 *
 * The tie correction is the whole point here. Money quantised to cents produces thousands of
 * exact ties; omitting the correction understates H and overstates p, and the difference
 * between the two quantisations of this month's headline test is entirely a tie effect.
 */
export function kruskalWallis(groups: number[][]): KWResult {
  const k = groups.length;
  const N = groups.reduce((a, g) => a + g.length, 0);
  if (k < 2 || N <= k) return { H: NaN, df: Math.max(k - 1, 0), p: NaN, eta2: NaN, n: N, k };

  const vals = new Float64Array(N);
  const grp = new Int32Array(N);
  let w = 0;
  for (let gi = 0; gi < k; gi++) for (const v of groups[gi]) {
    vals[w] = v;
    grp[w] = gi;
    w++;
  }

  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => vals[a] - vals[b]);

  const R = new Float64Array(k);
  const n = new Float64Array(k);
  let tieSum = 0;
  for (let i = 0; i < N; ) {
    let j = i;
    while (j + 1 < N && vals[order[j + 1]] === vals[order[i]]) j++;
    const t = j - i + 1;
    // 1-based average rank of the tied block
    const avg = (i + j) / 2 + 1;
    for (let q = i; q <= j; q++) {
      R[grp[order[q]]] += avg;
      n[grp[order[q]]]++;
    }
    if (t > 1) tieSum += t * t * t - t;
    i = j + 1;
  }

  let s = 0;
  for (let gi = 0; gi < k; gi++) if (n[gi] > 0) s += (R[gi] * R[gi]) / n[gi];
  let H = (12 / (N * (N + 1))) * s - 3 * (N + 1);
  const C = 1 - tieSum / (N * N * N - N);
  if (C > 0) H /= C;

  const df = k - 1;
  return { H, df, p: chi2sf(H, df), eta2: (H - k + 1) / (N - k), n: N, k };
}

export type ChiSqResult = { chi2: number; df: number; p: number; n: number };

/**
 * Pearson chi-square goodness-of-fit of `observed` counts against a base rate applied to
 * `exposure`. Used for C14: are Black Friday codes redeemed seasonally, or at the file's own
 * monthly rate? Cells with zero expectation are dropped from both the statistic and df.
 */
export function chiSquareAgainstBaseRate(observed: number[], exposure: number[]): ChiSqResult {
  const totalObs = observed.reduce((a, b) => a + b, 0);
  const totalExp = exposure.reduce((a, b) => a + b, 0);
  if (!totalExp || !totalObs) return { chi2: NaN, df: 0, p: NaN, n: totalObs };
  const rate = totalObs / totalExp;
  let chi2 = 0;
  let cells = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = exposure[i] * rate;
    if (e <= 0) continue;
    chi2 += ((observed[i] - e) * (observed[i] - e)) / e;
    cells++;
  }
  const df = cells - 1;
  return { chi2, df, p: df > 0 ? chi2sf(chi2, df) : NaN, n: totalObs };
}
