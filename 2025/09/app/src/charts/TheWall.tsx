/**
 * THE WALL - this month's signature element.
 *
 * x = loan-to-income in 1-PERCENTAGE-POINT bins.  y = default rate, 0-100%.
 *
 * Three step-lines, one per housing tenure. RENT runs along the floor to 30% and then turns
 * ninety degrees and pins itself to the ceiling for the rest of the chart. MORTGAGE and OWN
 * cross the same point and never turn.
 *
 * Everything about the encoding is chosen to make that silhouette survive:
 *
 *   * STEP interpolation, never a curve. A step function is the honest rendering of a rule,
 *     and a smoothed line would draw a gradient that does not exist.
 *   * 1-PP BINS, not 5. The entire finding is a single-step discontinuity between 30 and 31;
 *     any coarser binning hides it. (An earlier draft of the analysis tested the boundary at
 *     >= 0.30 rather than > 0.30 and turned the rule into an apparent gradient. The chart
 *     must not repeat that mistake visually.)
 *   * The PRICE COUNTER-LINE on a second axis: mean interest charged to renters across the
 *     same bins. It is flat straight through the wall. Two lines, same x, same instant: one
 *     goes vertical, one does nothing. That is the "so what", drawn rather than captioned.
 *   * A SAMPLE-SIZE STRIP along the bottom, so nobody can dismiss the ceiling as small-n.
 *
 * Accessibility: the three tenures differ in STROKE WEIGHT (3.5 / 2 / 1.5) and DASH PATTERN
 * before they differ in colour, and only one of them touches the ceiling. The chart reads in
 * greyscale and under all three CVD simulations. The hidden data table ships one row per
 * bin, which is small enough to be genuinely useful rather than a token.
 */
import { For, Show, createMemo } from "solid-js";
import { TENURES, type WallBin, bpPct, dec, int } from "../data";

const W = 1180;
const H = 430;
const PAD = { t: 54, r: 92, b: 74, l: 62 };
const STRIP = 34; // sample-size strip height, inside the bottom padding

const STYLE: Record<string, { cls: string; width: number; dash: string }> = {
  RENT: { cls: "wall-rent", width: 3.5, dash: "" },
  MORTGAGE: { cls: "wall-mortgage", width: 2, dash: "" },
  OWN: { cls: "wall-own", width: 1.5, dash: "5 3" },
};

export function TheWall(props: {
  bins: WallBin[];
  /** the bin at which RENT reaches 100% - drawn as the boundary */
  wallAt: number;
  /** TOTAL renter loans above the line, from the full book.
      NOT derived from `bins`: the x-axis stops at 45% for legibility while loans run to
      83%, so counting the visible bins under-reported 2,345 as 1,969 on the first poster. */
  aboveCount: number;
  poster?: boolean;
}) {
  const bins = createMemo(() => props.bins.filter((b) => b.n > 0));
  const lo = () => bins()[0]?.lpi ?? 5;
  const hi = () => bins()[bins().length - 1]?.lpi ?? 45;

  const plotB = () => H - PAD.b;
  const x = (v: number) => PAD.l + ((v - lo()) / (hi() - lo() + 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => plotB() - (v / 100) * (plotB() - PAD.t);
  // right-hand axis for the price line, 0-25%
  const yr = (bp: number) => plotB() - (bp / 2500) * (plotB() - PAD.t);

  /** Step path: hold each value across its own bin, then jump. */
  const stepPath = (get: (b: WallBin) => number, scale: (v: number) => number) => {
    let d = "";
    for (const b of bins()) {
      const v = get(b);
      if (!isFinite(v)) continue;
      const x0 = x(b.lpi);
      const x1 = x(b.lpi + 1);
      const yy = scale(v);
      d += d ? `L${x0},${yy}` : `M${x0},${yy}`;
      d += `L${x1},${yy}`;
    }
    return d;
  };

  const maxN = createMemo(() => Math.max(1, ...bins().map((b) => b.n)));
  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = createMemo(() => bins().map((b) => b.lpi).filter((v) => v % 5 === 0));

  const rentAbove = () => props.aboveCount;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Default rate against loan-to-income in one-point steps, split by housing tenure. ` +
        `Renters run below 35 percent up to a loan-to-income of ${props.wallAt} percent, then ` +
        `jump to 100 percent and stay there: every one of the ${int(rentAbove())} renter loans ` +
        `above the line defaulted. Mortgage holders and owners cross the same point without ` +
        `changing. The interest rate charged to renters, plotted on the right-hand axis, is ` +
        `flat across the whole range.`
      }
    >
      <title>The wall: default rate by loan-to-income and housing tenure</title>
      <defs>
        <pattern id="wallhatch" width="6" height="6" patternUnits="userSpaceOnUse"
                 patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="wall-hatchline" />
        </pattern>
      </defs>

      {/* --- the region past the wall, hatched so it reads without colour --- */}
      <rect
        x={x(props.wallAt + 1)} y={PAD.t}
        width={W - PAD.r - x(props.wallAt + 1)} height={plotB() - PAD.t}
        fill="url(#wallhatch)" class="wall-zone" aria-hidden="true"
      />

      {/* --- axes --- */}
      <g aria-hidden="true">
        <For each={yTicks}>
          {(t) => (
            <>
              <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} class="gridline" />
              <text x={PAD.l - 9} y={y(t) + 4} class="ticklabel" text-anchor="end">{t}%</text>
            </>
          )}
        </For>
        <For each={xTicks()}>
          {(t) => (
            <text x={x(t)} y={plotB() + 16} class="ticklabel" text-anchor="middle">{t}%</text>
          )}
        </For>
        <text x={PAD.l} y={H - 8} class="axistitle" text-anchor="start">
          LOAN AS A PERCENTAGE OF INCOME →
        </text>
        <text x={W - PAD.r + 8} y={PAD.t - 14} class="axistitle axistitle--right" text-anchor="start">
          INTEREST
        </text>
      </g>

      {/* --- the ceiling --- */}
      <line x1={x(props.wallAt + 1)} y1={y(100)} x2={W - PAD.r} y2={y(100)}
            class="wall-ceiling" aria-hidden="true" />
      <text x={x(props.wallAt + 1) + 10} y={y(100) - 10} class="wall-ceiling-label" aria-hidden="true">
        ALL {int(rentAbove())} DEFAULTED
      </text>

      {/* --- the boundary --- */}
      <line x1={x(props.wallAt + 1)} y1={PAD.t - 10} x2={x(props.wallAt + 1)} y2={plotB()}
            class="wall-boundary" aria-hidden="true" />
      <text x={x(props.wallAt + 1)} y={plotB() + 16} class="wall-boundary-label"
            text-anchor="middle" aria-hidden="true">
        0.{props.wallAt}
      </text>

      {/* --- the price counter-line: flat straight through --- */}
      <path d={stepPath((b) => b.rentRateBp, yr)} class="wall-price" aria-hidden="true" />
      <text x={W - PAD.r + 6} y={yr(1190) + 4} class="wall-price-label" aria-hidden="true">
        PRICE CHARGED
      </text>

      {/* --- the three tenure lines. RENT is drawn LAST so its pinned segment sits above
             the ceiling annotation rather than under it. --- */}
      <For each={["OWN", "MORTGAGE", "RENT"] as const}>
        {(t) => (
          <path
            d={stepPath((b) => b.byTenure[t].defaultRate, y)}
            class={`wall-line ${STYLE[t].cls}`}
            stroke-width={STYLE[t].width}
            stroke-dasharray={STYLE[t].dash || undefined}
            aria-hidden="true"
          />
        )}
      </For>

      {/* --- direct labels, no legend --- */}
      <g aria-hidden="true">
        <text x={W - PAD.r + 6} y={y(100) + 4} class="wall-label wall-rent-t">RENT</text>
        <text x={W - PAD.r + 6} y={y(22) + 4} class="wall-label wall-mortgage-t">MORTGAGE</text>
        <text x={W - PAD.r + 6} y={y(10) + 4} class="wall-label wall-own-t">OWN</text>
      </g>

      {/* --- sample-size strip: nobody gets to say "small n" --- */}
      <g aria-hidden="true" transform={`translate(0 ${plotB() + 24})`}>
        <For each={bins()}>
          {(b) => (
            <rect
              x={x(b.lpi) + 0.5} y={STRIP - (b.n / maxN()) * STRIP}
              width={Math.max(1, x(b.lpi + 1) - x(b.lpi) - 1)}
              height={(b.n / maxN()) * STRIP}
              class="wall-nbar"
            />
          )}
        </For>
        <text x={PAD.l - 9} y={STRIP} class="ticklabel" text-anchor="end">n</text>
      </g>
    </svg>
  );
}

/** One row per bin - small enough to be genuinely useful to a screen-reader user. */
export function wallTable(bins: WallBin[]) {
  return {
    columns: ["Loan-to-income", "Renters n", "Renters default", "Mortgage default", "Owner default", "Renter price"],
    rows: bins
      .filter((b) => b.n > 0)
      .map((b) => [
        `${b.lpi}%`,
        b.byTenure.RENT.n,
        isFinite(b.byTenure.RENT.defaultRate) ? dec(b.byTenure.RENT.defaultRate, 1) + "%" : "-",
        isFinite(b.byTenure.MORTGAGE.defaultRate) ? dec(b.byTenure.MORTGAGE.defaultRate, 1) + "%" : "-",
        isFinite(b.byTenure.OWN.defaultRate) ? dec(b.byTenure.OWN.defaultRate, 1) + "%" : "-",
        isFinite(b.rentRateBp) ? bpPct(b.rentRateBp) : "-",
      ]),
  };
}
