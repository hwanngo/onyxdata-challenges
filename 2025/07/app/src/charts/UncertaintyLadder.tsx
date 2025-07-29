/**
 * THE UNCERTAINTY LADDER - this month's signature element.
 *
 * Every group in the study on one shared 1-10 satisfaction axis: a filled dot for the
 * estimate, an open bar for its 95% confidence interval, and a hatched band behind
 * everything showing the ±MDD region the study could not have detected.
 *
 * Two facts become visible without a caption, on the six axes drawn by default: every
 * interval overlaps every other, and every observed difference between two levels of one
 * axis fits inside the band of what could not have been seen. Neither is asserted in the
 * copy - Dashboard computes the caption from whatever rows are passed in, because both
 * statements change when the reader adds the satisfaction-factor axis or cross-filters.
 * See analysis/insights.md I-7 for the scoping and the counts.
 *
 * Estimate vs interval is encoded by SHAPE first (filled dot / open bar), so the chart is
 * fully legible in greyscale. The floor band is hatched, never filled, so it reads as
 * "area we cannot see into" rather than as data.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { dec, int, type Estimate } from "../data";

export function UncertaintyLadder(props: {
  data: Estimate[];
  overallMean: number;
  /** null when the filtered rows are too few to estimate an sd - then no band is drawn.
   *  It used to be typed `number` and arrive as NaN, which rendered a zero-width band and
   *  an annotation reading "± NaN pts". A floor you cannot compute is not a floor of 0. */
  mdd: number | null;
  showFloor: boolean;
  poster?: boolean;
  onPick?: (k: string) => void;
}) {
  const rows = createMemo(() => props.data);
  // Poster row height is the poster's tightest constraint: the SVG scales by WIDTH, so at
  // 1414px of column against a 900-unit viewBox every viewBox pixel costs 1.57 real ones.
  // 21 put the bottom three rungs outside `.poster .grid-main`, which is `overflow: hidden`
  // - so they vanished in silence under a caption still counting seventeen.
  const rowH = () => (props.poster ? 19 : 26);
  const labelW = () => (props.poster ? 230 : 178);
  const W = () => (props.poster ? 900 : 560);
  const nW = () => 84;
  const plotL = () => labelW();
  const plotR = () => W() - nW();
  const x = (v: number) => plotL() + ((v - 1) / 9) * (plotR() - plotL());
  const height = () => rows().length * rowH() + 40;

  return (
    <svg
      viewBox={`0 0 ${W()} ${height()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label="Satisfaction estimate and 95% confidence interval for every group in the study, on a 1 to 10 scale"
    >
      <title>Satisfaction by group, with 95% confidence intervals</title>
      <defs>
        <pattern id="floorhatch" width="6" height="6" patternUnits="userSpaceOnUse"
                 patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cat-2)" stroke-width="1.4" opacity="0.5" />
        </pattern>
      </defs>

      {/* the detection floor: what this study could not have seen */}
      <Show when={props.showFloor && props.mdd != null && Number.isFinite(props.mdd)}>
        <rect
          class="floorband"
          x={x(Math.max(1, props.overallMean - props.mdd!))}
          y={8}
          width={x(Math.min(10, props.overallMean + props.mdd!)) - x(Math.max(1, props.overallMean - props.mdd!))}
          height={rows().length * rowH() + 6}
        />
        <text class="annot num" x={x(props.overallMean)} y={height() - 4} text-anchor="middle"
              fill="var(--cat-2)">
          ± {dec(props.mdd!)} pts - below this, undetectable
        </text>
      </Show>

      {/* axis */}
      <For each={[1, 3, 5, 7, 9]}>
        {(t) => (
          <>
            <line class="gridline" x1={x(t)} y1={8} x2={x(t)} y2={rows().length * rowH() + 14} />
            <text class="ladder-price num" x={x(t)} y={height() - 20} text-anchor="middle">{t}</text>
          </>
        )}
      </For>

      <For each={rows()}>
        {(e, i) => {
          const y = () => i() * rowH() + rowH() / 2 + 8;
          const active = () => isActive("__ladder", e.k);
          return (
            <g
              class="ladder-row"
              tabindex="0"
              role="button"
              aria-pressed={active()}
              data-metric={`ladder.${e.k}.mean`}
              data-value={e.mean}
              aria-label={
                `${e.k}: mean satisfaction ${dec(e.mean)} out of 10, ` +
                `95% confidence interval ${dec(e.lo)} to ${dec(e.hi)}, n=${e.n}` +
                (e.underpowered ? ". Too few customers to detect a 1.5 point difference." : "")
              }
              onClick={() => props.onPick?.(e.k)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); props.onPick?.(e.k); }
              }}
            >
              <rect x={0} y={y() - rowH() / 2} width={W()} height={rowH()} fill="transparent" />
              <text class="ladder-label" x={labelW() - 10} y={y() + 4} text-anchor="end">{e.k}</text>
              {/* the interval: an open bar with end caps */}
              <line class="ci-bar" x1={x(e.lo)} y1={y()} x2={x(e.hi)} y2={y()} />
              <line class="ci-cap" x1={x(e.lo)} y1={y() - 5} x2={x(e.lo)} y2={y() + 5} />
              <line class="ci-cap" x1={x(e.hi)} y1={y() - 5} x2={x(e.hi)} y2={y() + 5} />
              {/* the estimate: a filled dot. Shape carries the distinction, not colour. */}
              <circle class="est-dot" cx={x(e.mean)} cy={y()} r={4.5} />
              <text class="ladder-price num" x={W() - 6} y={y() + 4} text-anchor="end">
                n={int(e.n)}
              </text>
              <Show when={e.underpowered}>
                <text class="annot" x={W() - nW() + 6} y={y() + 4} fill="var(--warn)">⚑</text>
              </Show>
            </g>
          );
        }}
      </For>
    </svg>
  );
}

export function ladderTable(data: Estimate[]) {
  return {
    columns: ["Group", "n", "Mean satisfaction", "95% CI low", "95% CI high", "Powered?"],
    rows: data.map((e) => [
      e.k, String(e.n), dec(e.mean), dec(e.lo), dec(e.hi),
      e.underpowered ? "no - too few to detect 1.5 pts" : "yes",
    ]),
  };
}
