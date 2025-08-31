/**
 * THE EFFECT-SIZE STRIP - the behavioural half of the pre-declared grid, on one axis.
 *
 * Every (axis × metric) pair from the pre-declared grid, plotted by eta-squared: the share
 * of variance the axis explains. Almost all of them sit on zero.
 *
 * Why this chart exists: "we found nothing" is worthless without evidence that we looked.
 * The strip shows the whole search at once, so a reader can see that the two surviving
 * effects were not cherry-picked out of a fishing expedition - they are the only marks
 * away from the baseline in a grid that was declared before any of it was run.
 *
 * SCOPE. analysis/integrity.py declares 88 tests (11 axes x 8 metrics). This strip plots
 * the 54 BEHAVIOURAL ones and deliberately drops two axes and two metrics:
 *   - `final_price` as a metric - tier explains 87% of its variance, and drawing that bar
 *     beside real behavioural effects is the exact error this dashboard is about (I-2);
 *   - `access_hours` as an axis - it is 1:1 with `membership_type` (I-4), so plotting both
 *     would show the same cut twice and inflate the apparent size of the search.
 * The panel says so on its face; the count on screen is computed, never typed.
 *
 * Encoding is SHAPE-FIRST: a mark above the practical-significance rule is a FILLED
 * DIAMOND, below it a HOLLOW CIRCLE. Colour reinforces, it does not carry.
 */
import { For, Show, createMemo } from "solid-js";
import { type EffectRow, dec, int } from "../data";

const W = 660;
const ROW = 15;
const PAD = { t: 34, r: 96, b: 34, l: 152 };

/**
 * Marks at or above this share-of-variance get the filled treatment and a label.
 * 0.01 is a deliberate, stated line - "explains at least 1% of the variance" - chosen
 * because it is interpretable to a non-statistician, not because it is a p-value.
 */
export const NOTABLE = 0.01;

export function EffectStrip(props: { data: EffectRow[]; poster?: boolean }) {
  const rows = createMemo(() => props.data.slice(0, props.poster ? 14 : 24));
  const max = createMemo(() => Math.max(NOTABLE * 2.5, ...props.data.map((d) => d.eta2)));
  const H = () => rows().length * ROW + PAD.t + PAD.b;
  const x = (v: number) => PAD.l + (v / max()) * (W - PAD.l - PAD.r);
  const notable = createMemo(() => props.data.filter((d) => d.eta2 >= NOTABLE).length);

  return (
    <svg
      viewBox={`0 0 ${W} ${H()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Effect sizes for ${int(props.data.length)} pre-declared tests, as share of variance ` +
        `explained. ${int(notable())} clear the one-percent line; the rest are indistinguishable ` +
        `from zero. The largest is ${props.data[0]?.axis} on ${props.data[0]?.metric} at ` +
        `${dec((props.data[0]?.eta2 ?? 0) * 100, 1)} percent.`
      }
    >
      <title>Share of variance explained, all pre-declared tests</title>

      <text x={PAD.l} y={16} class="axistitle" text-anchor="start" aria-hidden="true">
        SHARE OF VARIANCE EXPLAINED (η²) →
      </text>

      {/* the practical-significance rule, drawn and named rather than implied by colour */}
      <line x1={x(NOTABLE)} y1={PAD.t - 12} x2={x(NOTABLE)} y2={H() - PAD.b + 4} class="rule-notable" aria-hidden="true" />
      <text x={x(NOTABLE)} y={H() - PAD.b + 18} class="rulelabel" text-anchor="middle" aria-hidden="true">
        {NOTABLE * 100}% OF VARIANCE
      </text>

      <line x1={PAD.l} y1={PAD.t - 12} x2={PAD.l} y2={H() - PAD.b + 4} class="axisline" aria-hidden="true" />

      <g aria-hidden="true">
        <For each={rows()}>
          {(d, i) => {
            const y = PAD.t + i() * ROW;
            const big = d.eta2 >= NOTABLE;
            return (
              <>
                <text x={PAD.l - 10} y={y + 4} class="striplabel" text-anchor="end">
                  {d.axis} → {d.metric}
                </text>
                <line x1={PAD.l} y1={y} x2={x(d.eta2)} y2={y} class={big ? "stem stem--big" : "stem"} />
                <Show
                  when={big}
                  fallback={<circle cx={x(d.eta2)} cy={y} r="3" class="emark emark--small" />}
                >
                  {/* filled diamond = clears the line. Shape carries, colour reinforces. */}
                  <path
                    d={`M${x(d.eta2)},${y - 4.6}L${x(d.eta2) + 4.6},${y}L${x(d.eta2)},${y + 4.6}L${x(d.eta2) - 4.6},${y}Z`}
                    class="emark emark--big"
                  />
                </Show>
                <Show when={big}>
                  <text x={x(d.eta2) + 10} y={y + 4} class="stripvalue">
                    {dec(d.eta2 * 100, 1)}%
                  </text>
                </Show>
              </>
            );
          }}
        </For>
      </g>

      <text x={PAD.l} y={H() - 6} class="stripfoot" text-anchor="start" aria-hidden="true">
        {int(props.data.length)} PRE-DECLARED TESTS · {int(notable())} CLEAR {NOTABLE * 100}% ·{" "}
        {int(props.data.length - notable())} INDISTINGUISHABLE FROM ZERO
      </text>
    </svg>
  );
}

export function effectTable(data: EffectRow[]) {
  return {
    columns: ["Axis → metric", "Variance explained"],
    rows: data.slice(0, 24).map((d) => [`${d.axis} → ${d.metric}`, dec(d.eta2 * 100, 2) + "%"]),
  };
}
