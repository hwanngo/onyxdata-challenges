/**
 * Supporting panels - what the file says about animals, which is real.
 *
 * Same encoding law as the signature: hollow/dashed is the file's reading, solid is the
 * corrected one. Where only one reading exists (condition, species) the marks are solid.
 */
import { For, Show } from "solid-js";
import { type Group, type MonthPoint, dec, int, pct, wilson } from "../data";

// ---------------------------------------------------------------------------------------
// The live-release trend. Rule 2: nothing is drawn past the last settled month, and the
// censored tail is shown AS censored rather than dropped.
// ---------------------------------------------------------------------------------------

const TW = 560;
const TH = 240;
const TP = { t: 28, r: 20, b: 40, l: 48 };

export function TrendPanel(props: { points: MonthPoint[]; lastSettled: number; poster?: boolean }) {
  /* 107 monthly points across 560px is a scribble, and the thing this chart exists to show -
     the two readings separating at the end - disappears into the noise. Quarterly keeps the
     shape, the seasonality and the censored tail, and can actually be read. Each quarter is a
     pooled rate, not a mean of monthly rates, so small months do not get equal weight. */
  const quarters = () => {
    const out: { label: string; idx: number; live: number; dead: number; filedNum: number; n: number; censored: boolean }[] = [];
    for (const p of props.points) {
      if (!p.n) continue;
      const y = p.month.slice(0, 4);
      const q = Math.floor((Number(p.month.slice(5, 7)) - 1) / 3) + 1;
      const label = `${y}Q${q}`;
      let cur = out[out.length - 1];
      if (!cur || cur.label !== label) {
        cur = { label, idx: p.idx, live: 0, dead: 0, filedNum: 0, n: 0, censored: false };
        out.push(cur);
      }
      cur.idx = p.idx;
      cur.n += p.n;
      cur.censored = cur.censored || p.censored;
      cur.live += (p.liveRate / 100) * p.n || 0;
      cur.filedNum += (p.liveRateAsFiled / 100) * p.n || 0;
    }
    return out;
  };
  /** The unresolved share of the last month drawn - quoted in the aria-label, so computed
   *  from the same points rather than typed. `worst_month_unresolved_pct` in
   *  metric_checks.yml recomputes it; the report body renders it with data-metric. */
  const finalUnresolved = () => props.points[props.points.length - 1]?.unresolved ?? NaN;
  const rate = (q: { live: number; n: number }) => (100 * q.live) / q.n;
  const filedRate = (q: { filedNum: number; n: number }) => (100 * q.filedNum) / q.n;
  const vals = () => quarters().flatMap((q) => [rate(q), filedRate(q)]).filter(Number.isFinite);
  const lo = () => Math.min(...vals()) - 3;
  const hi = () => Math.max(...vals()) + 3;
  const x = (i: number) => TP.l + (i / Math.max(1, props.points.length - 1)) * (TW - TP.l - TP.r);
  const y = (v: number) => TH - TP.b - ((v - lo()) / (hi() - lo())) * (TH - TP.t - TP.b);
  const settled = () => quarters().filter((q) => !q.censored);
  const path = (get: (q: ReturnType<typeof quarters>[number]) => number) =>
    settled().map((q, i) => `${i ? "L" : "M"}${x(q.idx)},${y(get(q))}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${TW} ${TH}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="img"
      aria-label={
        `Monthly live-release rate drawn two ways, as the file reports it and as measured. ` +
        `The series runs to ${props.points[props.lastSettled]?.month.slice(0, 7)}, the last month ` +
        `whose stays have settled. The six months after it are shaded because they are still ` +
        `resolving - the final month is ${pct(finalUnresolved(), 1)} unresolved - and the ` +
        `file's own flag counts an animal still in the shelter as a live release.`
      }
    >
      <g aria-hidden="true">
        <For each={[lo() + 3, (lo() + hi()) / 2, hi() - 3]}>
          {(v) => (
            <>
              <line x1={TP.l} y1={y(v)} x2={TW - TP.r} y2={y(v)} class="gridline" />
              <text x={TP.l - 8} y={y(v) + 4} class="ticklabel" text-anchor="end">
                {dec(v, 0)}%
              </text>
            </>
          )}
        </For>
        {/* the censored tail, drawn AS censored */}
        <rect
          x={x(props.lastSettled)}
          y={TP.t - 8}
          width={TW - TP.r - x(props.lastSettled)}
          height={TH - TP.t - TP.b + 8}
          class="censor-band"
        />
        <text x={x(props.lastSettled) - 6} y={TP.t - 12} class="censor-label" text-anchor="end">
          ← QUARTERLY, TO THE LAST SETTLED MONTH   ·   STILL RESOLVING →
        </text>
        <path d={path(filedRate)} class="trend trend--filed" />
        <path d={path(rate)} class="trend trend--measured" />
        <text x={TP.l} y={TH - 10} class="ticklabel" text-anchor="start">
          {props.points[0]?.month.slice(0, 7)}
        </text>
        <text x={x(props.lastSettled)} y={TH - 10} class="ticklabel" text-anchor="middle">
          {props.points[props.lastSettled]?.month.slice(0, 7)}
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------
// Ranked rate bars with Wilson intervals. Real data has real sampling noise and one of
// these categories has three records.
// ---------------------------------------------------------------------------------------

const BW = 460;
const ROW = 28;
const BP = { t: 26, r: 96, b: 24, l: 120 };

export function RateBars(props: {
  rows: Group[];
  title: string;
  minN?: number;
  poster?: boolean;
  onPick?: (k: string) => void;
}) {
  const shown = () => props.rows;
  const H = () => BP.t + shown().length * ROW + BP.b;
  const x = (v: number) => BP.l + (v / 100) * (BW - BP.l - BP.r);

  return (
    <svg
      viewBox={`0 0 ${BW} ${H()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      /* NOT role="img": these bars contain role="button" marks, and an img must have no
         interactive descendants (axe: nested-interactive, serious). */
      role="group"
      aria-label={
        `${props.title}. ` +
        shown()
          .map((r) => {
            const [lo, hi] = wilson(Math.round((r.liveRate / 100) * r.n), r.n);
            return `${r.k}: ${dec(r.liveRate, 1)} percent on ${int(r.n)} stays, 95% interval ${dec(lo, 1)} to ${dec(hi, 1)}`;
          })
          .join("; ")
      }
    >
      <For each={shown()}>
        {(r, i) => {
          const yy = () => BP.t + i() * ROW;
          const ci = () => wilson(Math.round((r.liveRate / 100) * r.n), r.n);
          const wide = () => ci()[1] - ci()[0] > 12;
          return (
            <g
              tabindex={props.onPick ? 0 : undefined}
              role={props.onPick ? "button" : undefined}
              aria-label={props.onPick ? `${r.k}, ${dec(r.liveRate, 1)} percent` : undefined}
              onClick={() => props.onPick?.(r.k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onPick?.(r.k);
                }
              }}
            >
              <rect x={0} y={yy()} width={BW} height={ROW} class="bar-hit" />
              <rect x={BP.l} y={yy() + 6} width={x(r.liveRate) - BP.l} height={ROW - 16} class="rate-bar" />
              {/* the interval, always drawn - a rate without one is a rank pretending to be a fact */}
              <line x1={x(ci()[0])} y1={yy() + ROW / 2 - 2} x2={x(ci()[1])} y2={yy() + ROW / 2 - 2} class="rate-ci" />
              <text x={BP.l - 10} y={yy() + ROW / 2 + 2} class="bar-label" text-anchor="end">
                {r.k}
              </text>
              <text x={BW - BP.r + 8} y={yy() + ROW / 2 + 2} class="bar-value" text-anchor="start">
                {pct(r.liveRate, 1)}
              </text>
              <text x={BW - BP.r + 54} y={yy() + ROW / 2 + 2} class="bar-n" text-anchor="start">
                {int(r.n)}
              </text>
              <Show when={wide()}>
                <text x={BW - BP.r + 8} y={yy() + ROW / 2 + 12} class="bar-warn" text-anchor="start">
                  too few to rank
                </text>
              </Show>
            </g>
          );
        }}
      </For>
      <text x={BW - BP.r + 8} y={BP.t - 10} class="bar-colhead" text-anchor="start" aria-hidden="true">
        LIVE
      </text>
      <text x={BW - BP.r + 54} y={BP.t - 10} class="bar-colhead" text-anchor="start" aria-hidden="true">
        STAYS
      </text>
    </svg>
  );
}

export function groupTable(rows: Group[], head: string) {
  return {
    columns: [head, "Stays", "Live release", "95% interval", "Median stay (days)"],
    rows: rows.map((r) => {
      const [lo, hi] = wilson(Math.round((r.liveRate / 100) * r.n), r.n);
      return [r.k, int(r.n), pct(r.liveRate, 1), `${dec(lo, 1)}-${dec(hi, 1)}`, dec(r.medianLos, 0)];
    }),
  };
}
