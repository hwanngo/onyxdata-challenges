/**
 * THE SURVIVORS - the charts that are still right.
 *
 * Half of this month's thesis is that most of the file's charts are *shaped* correctly even
 * though every number on them is 12% too high. These panels are deliberately undramatic: they
 * exist to show that the correction moves the level and leaves the ranking alone.
 *
 * Each one draws BOTH series - hollow/dashed for the file's figure, solid for the restated -
 * so the reader sees a constant gap rather than being told about one.
 */
import { For, Show } from "solid-js";
import { type Group, type MonthPoint, dec, usdM, int } from "../data";

// ---------------------------------------------------------------------------------------
// Monthly. Q1's answer is "they don't change" - so the range is annotated as the finding
// rather than a trend line being fitted to noise.
// ---------------------------------------------------------------------------------------

const MW = 460;
const MH = 236;
const MP = { t: 34, r: 18, b: 42, l: 72 };

export function MonthlySeries(props: { points: MonthPoint[]; poster?: boolean }) {
  const full = () => props.points.filter((p) => !p.partial);
  const max = () => Math.max(...props.points.map((p) => p.reported)) * 1.12;
  const x = (i: number) => MP.l + (i / (props.points.length - 1)) * (MW - MP.l - MP.r);
  const y = (v: number) => MH - MP.b - (v / max()) * (MH - MP.t - MP.b);
  const path = (get: (p: MonthPoint) => number) =>
    props.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(get(p))}`).join(" ");

  const loNet = () => Math.min(...full().map((p) => p.net));
  const hiNet = () => Math.max(...full().map((p) => p.net));

  return (
    <svg
      viewBox={`0 0 ${MW} ${MH}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Monthly revenue over ${props.points.length} months, drawn twice: as the file reports ` +
        `it and as restated. Excluding the two partial months at each end, restated revenue ` +
        `stays between ${usdM(loNet())} and ${usdM(hiNet())} every month - a flat series with ` +
        `no trend. The gap between the two lines is a near-constant 12 percent.`
      }
    >
      <title>Monthly revenue, reported against restated</title>
      <g aria-hidden="true">
        <For each={[0, max() / 2, max()]}>
          {(v) => (
            <>
              <line x1={MP.l} y1={y(v)} x2={MW - MP.r} y2={y(v)} class="gridline" />
              <text x={MP.l - 8} y={y(v) + 4} class="ticklabel" text-anchor="end">
                {usdM(v)}
              </text>
            </>
          )}
        </For>
        {/* the flat band is the finding */}
        <rect
          x={MP.l}
          y={y(hiNet())}
          width={MW - MP.l - MP.r}
          height={Math.max(2, y(loNet()) - y(hiNet()))}
          class="flat-band"
        />
        <path d={path((p) => p.reported)} class="series series--reported" />
        <path d={path((p) => p.net)} class="series series--restated" />
        <For each={props.points}>
          {(p, i) => (
            <Show when={p.partial}>
              <rect
                x={x(i()) - 5}
                y={MP.t - 6}
                width="10"
                height={MH - MP.t - MP.b + 6}
                class="partial-mark"
              />
            </Show>
          )}
        </For>
        <text x={MP.l} y={MH - 10} class="ticklabel" text-anchor="start">
          {props.points[0].month.slice(0, 7)}
        </text>
        <text x={MW - MP.r} y={MH - 10} class="ticklabel" text-anchor="end">
          {props.points[props.points.length - 1].month.slice(0, 7)}
        </text>
        <text x={MP.l + 6} y={MP.t - 12} class="flat-label" text-anchor="start">
          19 MONTHS, {usdM(loNet())}-{usdM(hiNet())}. NO TREND.
        </text>
        <text x={MW - MP.r} y={MP.t - 12} class="partial-label" text-anchor="end">
          ▌partial
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------
// Ranked bars - channel, family. Both series drawn; the point is that the ORDER is identical.
// ---------------------------------------------------------------------------------------

const BW = 520;
const ROW = 26;
const BP = { t: 30, r: 78, b: 26, l: 196 };

export function RankedBars(props: {
  rows: Group[];
  title: string;
  unchangedNote?: string;
  poster?: boolean;
  onPick?: (k: string) => void;
}) {
  const H = () => BP.t + props.rows.length * ROW + BP.b;
  const max = () => Math.max(...props.rows.map((r) => r.reported)) * 1.02;
  const w = (v: number) => (v / max()) * (BW - BP.l - BP.r);

  return (
    <svg
      viewBox={`0 0 ${BW} ${H()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `${props.title}. ` +
        props.rows
          .map(
            (r, i) =>
              `${i + 1}. ${r.k}: ${usdM(r.net)} restated, ${usdM(r.reported)} as reported, ` +
              `a ${dec(r.correctionPct, 2)} percent correction`
          )
          .join(". ") +
        (props.unchangedNote ? `. ${props.unchangedNote}` : "")
      }
    >
      <title>{props.title}</title>
      <For each={props.rows}>
        {(r, i) => {
          const y = () => BP.t + i() * ROW;
          return (
            <g
              tabindex={props.onPick ? 0 : undefined}
              role={props.onPick ? "button" : undefined}
              aria-label={props.onPick ? `${r.k}, ${usdM(r.net)} restated` : undefined}
              onClick={() => props.onPick?.(r.k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onPick?.(r.k);
                }
              }}
            >
              {/* reported: hollow outline extending past the solid bar */}
              <rect
                x={BP.l}
                y={y() + 3}
                width={w(r.reported)}
                height={ROW - 12}
                class="bar-reported"
              />
              <rect x={BP.l} y={y() + 3} width={w(r.net)} height={ROW - 12} class="bar-restated" />
              <text x={BP.l - 10} y={y() + ROW / 2 + 1} class="bar-label" text-anchor="end">
                {/* the gutter fits ~30 characters; clip rather than let it run under the bars */}
                {r.k.length > 30 ? r.k.slice(0, 29) + "..." : r.k}
                <title>{r.k}</title>
              </text>
              <text x={BW - BP.r + 8} y={y() + ROW / 2 + 1} class="bar-value" text-anchor="start">
                {usdM(r.net)}
              </text>
            </g>
          );
        }}
      </For>
      <Show when={props.unchangedNote}>
        <text x={BP.l} y={BP.t - 12} class="bar-note" text-anchor="start" aria-hidden="true">
          {props.unchangedNote}
        </text>
      </Show>
    </svg>
  );
}

export function groupTable(rows: Group[], keyHeader: string) {
  return {
    columns: [keyHeader, "Events", "As reported", "As restated", "Correction", "Share"],
    rows: rows.map((r) => [
      r.k,
      int(r.n),
      usdM(r.reported),
      usdM(r.net),
      dec(r.correctionPct, 2) + "%",
      dec(r.share, 1) + "%",
    ]),
  };
}
