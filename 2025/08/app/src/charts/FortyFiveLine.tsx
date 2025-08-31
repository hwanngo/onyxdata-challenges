/**
 * THE 45° LINE - this month's signature element.
 *
 * x = tenure (days since joining).  y = days since last visit.
 *
 * In any real gym this is a shapeless cloud: long-standing members come in daily, new
 * members drift away, and the two axes are close to independent. Here it is a razor-thin
 * RISING band -- the longer someone has been a member, the longer ago their last visit --
 * because `last_visit_date` IS `join_date` rank-rescaled onto a 60-day window
 * (insights.md I-1, rho = 0.9999).
 *
 * Two devices make that land rather than merely appear:
 *
 *   1. THE GHOST CLOUD. The same 1,998 members with `days_since_visit` shuffled - what
 *      independence would look like - drawn behind the real marks in a hatched, low-
 *      contrast treatment. The reader sees the cloud they expected and the line they got
 *      in one frame. It is a seeded PERMUTATION, not data, and it is labelled as such.
 *   2. THE SELECTION SWEEP. Members a lapse rule would flag are painted in --flag and
 *      drawn as SQUARES rather than circles. The painted region is always a clean slice
 *      off the high-tenure end, so the interaction demonstrates the inversion instead of
 *      captioning it.
 *
 * Encoding is SHAPE-FIRST: flagged = filled square, active = hollow circle, ghost = cross.
 * The chart is fully legible in greyscale and under all three CVD simulations.
 *
 * Accessibility: 1,998 marks must never become 1,998 tab stops or 1,998 table rows. The
 * SVG carries a single descriptive label stating the correlation and the overlap
 * statistic, and the surrounding ChartFigure supplies a BINNED data table (10 tenure
 * deciles) rather than the raw points.
 */
import { For, Show, createMemo } from "solid-js";
import { GHOST, type Flagged, type Member, dec, int } from "../data";

const W = 980;
const H = 430;
const PAD = { t: 62, r: 18, b: 52, l: 68 };   // t leaves a clean band for the legend

export function FortyFiveLine(props: {
  rows: Member[];
  flag: Flagged;
  r: number;
  showGhost: boolean;
  poster?: boolean;
}) {
  const xMax = createMemo(() => Math.max(1, ...props.rows.map((d) => d.tenure_days)));
  const yMax = 60; // the censoring window is fixed; never auto-scale it away

  const px = (v: number) => PAD.l + (v / xMax()) * (W - PAD.l - PAD.r);
  const py = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const rad = () => (props.poster ? 2.2 : 1.9);

  const xTicks = createMemo(() => {
    const step = 200;
    const out: number[] = [];
    for (let v = 0; v <= xMax(); v += step) out.push(v);
    return out;
  });
  const yTicks = [0, 15, 30, 45, 60];

  const summary = createMemo(
    () =>
      `Scatter of ${int(props.rows.length)} members: tenure in days on the horizontal axis, ` +
      `days since last visit on the vertical. The points form a narrow RISING line rather ` +
      `than a cloud: the longer a member has belonged, the longer ago their last visit. The ` +
      `correlation is ${dec(props.r, 4)}. A ${props.flag.threshold}-day lapse rule flags ` +
      `${int(props.flag.flagged)} members, all of whom sit at or above the ` +
      `${int(props.flag.flagged)}th highest tenure. No member with fewer than ` +
      `${int(props.flag.minTenureFlagged)} days of tenure is flagged. The faint background ` +
      `crosses are the same members with the vertical axis shuffled, showing what statistical ` +
      `independence would look like.`
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={summary()}
    >
      <title>Tenure against days since last visit</title>
      <defs>
        <pattern
          id="ghosthatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--grid)" stroke-width="1" />
        </pattern>
      </defs>

      {/* ---- axes ------------------------------------------------------------------ */}
      <g class="axis" aria-hidden="true">
        <For each={yTicks}>
          {(t) => (
            <>
              <line x1={PAD.l} y1={py(t)} x2={W - PAD.r} y2={py(t)} class="gridline" />
              <text x={PAD.l - 10} y={py(t) + 4} class="ticklabel" text-anchor="end">
                {t}
              </text>
            </>
          )}
        </For>
        <For each={xTicks()}>
          {(t) => (
            <text x={px(t)} y={H - PAD.b + 18} class="ticklabel" text-anchor="middle">
              {int(t)}
            </text>
          )}
        </For>
        <text x={PAD.l} y={H - 10} class="axistitle" text-anchor="start">
          TENURE - DAYS SINCE JOINING →
        </text>
        <text
          class="axistitle"
          text-anchor="start"
          transform={`translate(16 ${H - PAD.b}) rotate(-90)`}
        >
          DAYS SINCE LAST VISIT →
        </text>
      </g>

      {/* ---- the ghost cloud: what independence would look like --------------------- */}
      <Show when={props.showGhost}>
        <g class="ghost" aria-hidden="true">
          <For each={GHOST}>
            {(g) => (
              <path
                d={`M${px(g.x) - 1.6},${py(g.y)}h3.2M${px(g.x)},${py(g.y) - 1.6}v3.2`}
                class="ghostmark"
              />
            )}
          </For>
        </g>
      </Show>

      {/* ---- the lapse threshold ---------------------------------------------------- */}
      <line
        x1={PAD.l}
        y1={py(props.flag.threshold)}
        x2={W - PAD.r}
        y2={py(props.flag.threshold)}
        class="threshold"
        aria-hidden="true"
      />
      <text
        x={W - PAD.r}
        y={py(props.flag.threshold) - 7}
        class="thresholdlabel"
        text-anchor="end"
        aria-hidden="true"
      >
        {props.flag.threshold}-DAY LAPSE RULE - {int(props.flag.flagged)} FLAGGED
      </text>

      {/* ---- the data --------------------------------------------------------------- */}
      <g aria-hidden="true">
        <For each={props.rows}>
          {(d) => {
            const flagged = props.flag.flaggedSet.has(d.i);
            return flagged ? (
              // SQUARE + --flag: the set a lapse rule selects
              <rect
                x={px(d.tenure_days) - rad()}
                y={py(d.days_since_visit) - rad()}
                width={rad() * 2}
                height={rad() * 2}
                class="mark mark--flagged"
              />
            ) : (
              // HOLLOW CIRCLE: everyone else
              <circle
                cx={px(d.tenure_days)}
                cy={py(d.days_since_visit)}
                r={rad()}
                class="mark mark--active"
              />
            );
          }}
        </For>
      </g>

      {/* ---- legend: shape first, colour second ------------------------------------- */}
      <g class="legend" transform="translate(68 12)" aria-hidden="true">
        <rect x="0" y="-4" width="8" height="8" class="mark mark--flagged" />
        <text x="13" y="3" class="legendlabel">FLAGGED AS LAPSED</text>
        <circle cx="176" cy="0" r="4" class="mark mark--active" />
        <text x="186" y="3" class="legendlabel">STILL ACTIVE</text>
        <Show when={props.showGhost}>
          <path d="M306,0h7.2M309.6,-3.6v7.2" class="ghostmark" />
          <text x="320" y="3" class="legendlabel legendlabel--ghost">
            SHUFFLED - WHAT INDEPENDENCE WOULD LOOK LIKE
          </text>
        </Show>
      </g>
    </svg>
  );
}

/**
 * Binned rows for the visually-hidden data table.
 *
 * A screen-reader user must not be handed 1,998 table rows. Ten tenure deciles carry the
 * shape of the relationship - mean days-since-visit falling monotonically as tenure rises
 * - which is the only thing the scatter is there to show.
 */
export function fortyFiveTable(rows: Member[]): { columns: string[]; rows: (string | number)[][] } {
  const sorted = [...rows].sort((a, b) => a.tenure_days - b.tenure_days);
  const size = Math.ceil(sorted.length / 10) || 1;
  const out: (string | number)[][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const bin = sorted.slice(i, i + size);
    if (!bin.length) continue;
    const lo = bin[0].tenure_days;
    const hi = bin[bin.length - 1].tenure_days;
    const dsv = bin.reduce((a, r) => a + r.days_since_visit, 0) / bin.length;
    out.push([`${int(lo)}-${int(hi)} d`, bin.length, dec(dsv, 1)]);
  }
  return {
    columns: ["Tenure decile", "Members", "Mean days since visit"],
    rows: out,
  };
}
