/**
 * Statistical helpers.
 *
 * Promoted after being hand-written with identical bodies in four separate months
 * (four separate months) and left outstanding for two more after that.
 * A helper duplicated five times is five chances to round it differently.
 *
 * These are the small number of tests this programme actually reaches for. Each one exists
 * because a month needed it to STOP itself publishing something:
 *
 *   wilson       - a rate without an interval invites a ranking its n cannot support.
 *   mde          - "we found nothing" is not actionable; "a lift above X would have shown"
 *                  is. One month's entire deliverable rested on this.
 *   bootstrapSpread - is the spread across k groups more than chance produces for those
 *                  group sizes? One month's thesis is this function returning "no".
 *
 * NOTHING HERE ROUNDS. Callers format at render; an intermediate round is how 2025/05
 * turned a true 0.44x into a published 0.45x.
 */

/**
 * Wilson score interval for a binomial rate, as PERCENTAGES.
 *
 * Wilson rather than normal-approximation because the normal interval is degenerate near
 * 0 and 1 - exactly where a small category lands, and exactly where someone is tempted to
 * rank it.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [NaN, NaN];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [100 * (c - h), 100 * (c + h)];
}

/** Population standard deviation of a numeric series. */
export function stdev(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (!n) return NaN;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += xs[i];
  const mu = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (xs[i] - mu) ** 2;
  return Math.sqrt(ss / n);
}

/**
 * Minimum detectable effect between two groups, in the units of the measure, at the given
 * power and alpha. Defaults are 80% power, alpha .05 (two-sided).
 *
 * Report this whenever a comparison comes back null. It converts "no difference" into "a
 * difference this big could not have hidden", which is a claim a reader can act on.
 */
export function mde(sd: number, n1: number, n2: number, zAlpha = 1.96, zBeta = 0.84): number {
  if (!n1 || !n2) return NaN;
  return (zAlpha + zBeta) * sd * Math.sqrt(1 / n1 + 1 / n2);
}

/** Share of variance in a measure explained by a grouping. The effect size, not the p-value. */
export function etaSquared(groups: ArrayLike<number>[]): number {
  let n = 0;
  let sum = 0;
  for (const g of groups) for (let i = 0; i < g.length; i++) { sum += g[i]; n++; }
  if (!n) return NaN;
  const gm = sum / n;
  let ssb = 0;
  let sst = 0;
  for (const g of groups) {
    let gs = 0;
    for (let i = 0; i < g.length; i++) { gs += g[i]; sst += (g[i] - gm) ** 2; }
    if (g.length) ssb += g.length * (gs / g.length - gm) ** 2;
  }
  return sst ? ssb / sst : NaN;
}

/**
 * The 95th-percentile max-min spread of a ratio-of-sums statistic produced by CHANCE alone,
 * for groups of the given sizes drawn from the pooled data.
 *
 * TWO PROPERTIES THAT LOOK LIKE FUSSINESS AND ARE NOT - both were paid for the hard way:
 *
 *  1. THE SEED IS DERIVED FROM `label`, not from a shared counter. Running several cuts off
 *     one generator makes each cut's answer depend on how many cuts precede it. Dropping one
 *     row from the cut list moved a published figure from 5.54 to 5.37.
 *  2. SIZES ARE SORTED. The statistic is a function of the SET of group sizes, but a seeded
 *     bootstrap partitions one draw across them in order, so an unsorted input makes the
 *     realised value depend on how the caller happened to group. Two implementations with
 *     the same seed disagreed 5.75 vs 5.68 for exactly this reason.
 *
 * Together they mean two independent implementations reproduce the same number, which is the
 * only reason a bootstrap figure belongs on a poster at all.
 */
export function bootstrapSpread(
  num: ArrayLike<number>,
  den: ArrayLike<number>,
  sizes: ArrayLike<number>,
  label: string,
  reps = 1000,
): number {
  const sorted = Array.from(sizes).sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  const rand = mulberry32(stringSeed(label));
  const n = num.length;
  const out: number[] = [];
  for (let r = 0; r < reps; r++) {
    let lo = Infinity;
    let hi = -Infinity;
    let cursor = 0;
    for (const size of sorted) {
      let sn = 0;
      let sd = 0;
      for (let i = 0; i < size; i++) {
        const idx = (rand() * n) | 0;
        sn += num[idx];
        sd += den[idx];
      }
      cursor += size;
      if (sd) {
        const v = (sn / sd) * 100;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    void cursor;
    out.push(hi - lo);
  }
  out.sort((a, b) => a - b);
  return out[Math.floor(0.95 * (out.length - 1))];
}

/** Deterministic 32-bit seed from a string, so a label always produces the same stream. */
function stringSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG. Math.random cannot be seeded, so it cannot be reproduced. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
