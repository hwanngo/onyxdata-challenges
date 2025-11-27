/**
 * THE RANKING THAT FLIPS - C3c.
 *
 * A slopegraph. Left column: revenue as the file reports it. Right column: revenue once sales
 * tax and refunds come out. Four regions, and the top two lines cross.
 *
 * The EU leads on the file's own numbers by $1.92M. North America leads once corrected by
 * $0.30M. A $2.23M swing on the single most commonly built chart in this competition.
 *
 * These are TOTALS, so unlike the country ASP panel next door there is no sampling-noise
 * objection available - a sum is a sum.
 *
 * Encoding: the reported end of each line is a HOLLOW mark on a DASHED segment; the restated
 * end is SOLID on a SOLID segment. The crossing pair is drawn at full weight, the other two
 * are muted, so the eye lands on the flip without needing colour to find it.
 */
import { For, Show } from "solid-js";
import { spreadLabels } from "@onyxdata/dna-kit";
import { usdM, dec } from "../data";

const W = 480;
const H = 320;
const PAD = { t: 50, r: 122, b: 44, l: 122 };

/* The two regions that change places are the verifiable claim, so their four totals carry
   data-metric and are recomputed from parquet. The other two regions are context. */
const METRIC_REPORTED: Record<string, string | undefined> = {
  EU: "eu_reported",
  "North America": "na_reported",
};
const METRIC_NET: Record<string, string | undefined> = {
  EU: "eu_revenue",
  "North America": "na_revenue",
};

type Row = {
  k: string;
  reported: number;
  net: number;
  repShare: number;
  netShare: number;
  repRank: number;
  netRank: number;
};

export function RegionFlip(props: { rows: Row[]; poster?: boolean }) {
  const max = () => Math.max(...props.rows.flatMap((r) => [r.reported, r.net])) * 1.08;
  const min = () => 0;
  const y = (v: number) => H - PAD.b - ((v - min()) / (max() - min())) * (H - PAD.t - PAD.b);
  /* Cross-filtering to a single country leaves ONE region, and an earlier version indexed
     rows[1] unconditionally - which threw, and the thrown error silently stopped the chip
     bar from updating. Degenerate states are states. */
  const flipped = () => props.rows.filter((r) => r.repRank <= 2);
  const hasPair = () => flipped().length === 2;

  /* The top two regions sit ~$0.3M apart, so their two-line labels overlap at this scale.
     spreadLabels (dna-kit) pushes them apart while the DOTS stay on their true values -
     only the text moves. */
  const MIN_GAP = 30;
  const labelYs = (get: (r: Row) => number) => {
    const placed = spreadLabels(props.rows.map((r) => y(get(r))), MIN_GAP);
    return new Map(props.rows.map((r, i) => [r.k, placed[i]]));
  };
  const leftY = () => labelYs((r) => r.reported);
  const rightY = () => labelYs((r) => r.net);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Slopegraph of revenue by region, as reported against as restated. ` +
        props.rows
          .map(
            (r) =>
              `${r.k}: reported ${usdM(r.reported)}, rank ${r.repRank}; restated ${usdM(r.net)}, rank ${r.netRank}`
          )
          .join(". ") +
        (props.rows.length >= 2
          ? `. The top two change places: ${props.rows[0].k} leads by ` +
            `${usdM(props.rows[0].reported - props.rows[1].reported)} on the reported figures ` +
            `and the order reverses once corrected.`
          : ". Only one region is in the current filter, so there is no ranking to change.")
      }
    >
      <title>Revenue by region, as reported against as restated</title>

      <g aria-hidden="true">
        <text x={PAD.l} y={PAD.t - 22} class="slope-head" text-anchor="end">
          AS REPORTED
        </text>
        <text x={W - PAD.r} y={PAD.t - 22} class="slope-head" text-anchor="start">
          AS RESTATED
        </text>
        <line x1={PAD.l} y1={PAD.t - 12} x2={PAD.l} y2={H - PAD.b} class="slope-axis" />
        <line
          x1={W - PAD.r}
          y1={PAD.t - 12}
          x2={W - PAD.r}
          y2={H - PAD.b}
          class="slope-axis"
        />
      </g>

      <For each={props.rows}>
        {(r) => {
          const lead = () => r.repRank <= 2;
          return (
            <g aria-hidden="true" class={lead() ? "slope" : "slope slope--muted"}>
              <line
                x1={PAD.l}
                y1={y(r.reported)}
                x2={W - PAD.r}
                y2={y(r.net)}
                class="slope-line"
              />
              <circle cx={PAD.l} cy={y(r.reported)} r={props.poster ? 6 : 5} class="slope-dot-reported" />
              <circle cx={W - PAD.r} cy={y(r.net)} r={props.poster ? 6 : 5} class="slope-dot-restated" />
              <text x={PAD.l - 10} y={leftY().get(r.k)! - 3} class="slope-label" text-anchor="end">
                {r.k}
              </text>
              <text
                x={PAD.l - 10}
                y={leftY().get(r.k)! + 11}
                class="slope-num"
                text-anchor="end"
                data-metric={METRIC_REPORTED[r.k]}
                data-value={METRIC_REPORTED[r.k] ? r.reported : undefined}
              >
                {usdM(r.reported)}
              </text>
              <text x={W - PAD.r + 10} y={rightY().get(r.k)! - 3} class="slope-label" text-anchor="start">
                {r.k}
              </text>
              <text
                x={W - PAD.r + 10}
                y={rightY().get(r.k)! + 11}
                class="slope-num"
                text-anchor="start"
                data-metric={METRIC_NET[r.k]}
                data-value={METRIC_NET[r.k] ? r.net : undefined}
              >
                {usdM(r.net)}
              </text>
            </g>
          );
        }}
      </For>

      {/* The two lines cross by only $0.30M on a $14.8M scale, so the crossing is real but
          easy to miss. Marking the true intersection is annotation; rescaling the axis to make
          it look bigger would be distortion. */}
      <Show when={hasPair()}>
        {(() => {
          const a = flipped()[0];
          const b = flipped()[1];
          const y1a = y(a.reported), y2a = y(a.net);
          const y1b = y(b.reported), y2b = y(b.net);
          const d0 = y1a - y1b, d1 = y2a - y2b;
          const t = d0 === d1 ? 0.5 : d0 / (d0 - d1);
          const cx = PAD.l + t * (W - PAD.r - PAD.l);
          const cy = y1a + t * (y2a - y1a);
          return (
            <g aria-hidden="true">
              {/* Marker only - the note under the chart already says what it means, and a
                  second label here collided with the restated value labels. */}
              <circle cx={cx} cy={cy} r="9" class="slope-cross" />
            </g>
          );
        })()}
      </Show>
      <Show when={hasPair()}>
        <text x={W / 2} y={H - 10} class="slope-note" text-anchor="middle" aria-hidden="true">
          {`✖ they change places - a ${usdM(
            Math.abs(flipped()[0].reported - flipped()[1].reported) +
              Math.abs(flipped()[0].net - flipped()[1].net)
          )} swing`}
        </text>
      </Show>
    </svg>
  );
}

export function regionTable(rows: Row[]) {
  return {
    columns: ["Region", "As reported", "Rank", "As restated", "Rank", "Correction"],
    rows: rows.map((r) => [
      r.k,
      usdM(r.reported),
      String(r.repRank),
      usdM(r.net),
      String(r.netRank),
      dec(100 * (1 - r.net / r.reported), 2) + "%",
    ]),
  };
}
