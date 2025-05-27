/**
 * WHO TURNS VOLUME INTO MONEY - insight I-2, the hinge of the report.
 *
 * Diverging bars around a zero line: revenue share minus unit share, in percentage points.
 * Colour is the teal/ochre gain-loss axis, but the sign, the direction from zero and the
 * printed label are all redundant encodings - nothing here depends on hue.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { money, pct, pp, type GapRow } from "../data";

export function ConversionGap(props: {
  data: GapRow[];
  poster?: boolean;
  onDrill?: (brand: string) => void;
}) {
  const rows = createMemo(() => [...props.data].sort((a, b) => b.gap_pp - a.gap_pp));
  // 35 on the poster, not 38: the poster is a fixed 2560x1440 canvas and the market
  // table below must fit whole. tools/qa/measure.mjs cannot see this because the
  // poster grid clips rather than scrolls -- see exports/qa/measure.txt.
  const rowH = () => (props.poster ? 35 : 36);
  const labelW = () => (props.poster ? 110 : 84);
  // right gutter reserved for the "units rank -> revenue rank" column, so the value
  // label at the end of a long bar can never collide with it
  const rankW = () => (props.poster ? 96 : 74);
  const W = () => (props.poster ? 820 : 500);
  const plotW = () => W() - labelW() - rankW();
  const mid = () => labelW() + plotW() / 2;
  // headroom so the value label always fits inside the plot area
  const extent = createMemo(() => Math.max(8, ...rows().map((r) => Math.abs(r.gap_pp))) * 1.45);
  const scale = () => plotW() / 2 / extent();
  const height = () => rows().length * rowH() + 34;

  const ranks = createMemo(() => {
    const byUnits = [...props.data].sort((a, b) => b.units - a.units).map((r) => r.brand);
    const byRev = [...props.data].sort((a, b) => b.revenue - a.revenue).map((r) => r.brand);
    return Object.fromEntries(
      props.data.map((r) => [r.brand, [byUnits.indexOf(r.brand) + 1, byRev.indexOf(r.brand) + 1]])
    ) as Record<string, [number, number]>;
  });

  return (
    <svg
      viewBox={`0 0 ${W()} ${height()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label="Diverging bar chart of revenue share minus unit share by brand. Samsung and Apple earn more revenue than their volume; OnePlus and Xiaomi earn less."
    >
      <title>Revenue share minus unit share, by brand</title>

      {/* axis ticks */}
      <For each={[-8, -4, 0, 4, 8]}>
        {(t) => (
          <>
            <line
              class={t === 0 ? "zero-line" : "gridline"}
              x1={mid() + t * scale()}
              y1={14}
              x2={mid() + t * scale()}
              y2={rows().length * rowH() + 14}
            />
            <text
              class="ladder-price num"
              x={mid() + t * scale()}
              y={rows().length * rowH() + 28}
              text-anchor="middle"
            >
              {t > 0 ? `+${t}` : t}
            </text>
          </>
        )}
      </For>

      <For each={rows()}>
        {(r, i) => {
          const y = () => i() * rowH() + 14;
          const w = () => Math.abs(r.gap_pp) * scale();
          const x = () => (r.gap_pp >= 0 ? mid() : mid() - w());
          const active = () => isActive("brand", r.brand);
          const anyActive = () => rows().some((b) => isActive("brand", b.brand));
          const rk = () => ranks()[r.brand];
          return (
            <g
              class="ladder-row"
              classList={{ dimmed: anyActive() && !active() }}
              tabindex="0"
              role="button"
              aria-pressed={active()}
              data-metric={`gap.${r.brand}.gap_pp`}
              data-value={r.gap_pp}
              aria-label={`${r.brand}: ${pp(r.gap_pp)} - ${pct(r.rev_share, 2)} of revenue from ${pct(
                r.unit_share,
                2
              )} of units. Ranks ${rk()[0]} by units, ${rk()[1]} by revenue.`}
              onClick={() => toggle("brand", r.brand)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onDrill ? props.onDrill(r.brand) : toggle("brand", r.brand);
                }
              }}
            >
              <rect x={0} y={y() - rowH() / 2 + 4} width={W()} height={rowH() - 2} fill="transparent" />
              <text class="ladder-label" x={labelW() - 10} y={y() + 5} text-anchor="end">
                {r.brand}
              </text>
              <rect
                class="bar"
                x={x()}
                y={y() - rowH() / 2 + 8}
                width={Math.max(1.5, w())}
                height={rowH() - 18}
                fill={r.gap_pp >= 0 ? "var(--good)" : "var(--bad)"}
                stroke={active() ? "var(--ink)" : "none"}
                stroke-width={active() ? 1.5 : 0}
              />
              {/* the sign is printed, so hue is never the only encoder */}
              <text
                class="ladder-price num"
                x={r.gap_pp >= 0 ? x() + w() + 7 : x() - 7}
                y={y() + 5}
                text-anchor={r.gap_pp >= 0 ? "start" : "end"}
                style={{ "font-weight": 600, fill: "var(--ink)" }}
              >
                {pp(r.gap_pp)}
              </text>
              <Show when={rk()[0] !== rk()[1]}>
                <text
                  class="annot num"
                  x={W() - 4}
                  y={y() + 5}
                  text-anchor="end"
                  fill="var(--ink-muted)"
                >
                  {rk()[0]}
                  {"→"}
                  {rk()[1]}
                </text>
              </Show>
            </g>
          );
        }}
      </For>
    </svg>
  );
}

export function gapTable(data: GapRow[]) {
  return {
    columns: ["Brand", "Units", "Unit share", "Revenue", "Revenue share", "Gap (pp)", "ASP"],
    rows: [...data]
      .sort((a, b) => b.gap_pp - a.gap_pp)
      .map((r) => [
        r.brand,
        Math.round(r.units).toLocaleString(),
        pct(r.unit_share, 2),
        money(r.revenue),
        pct(r.rev_share, 2),
        pp(r.gap_pp),
        "$" + Math.round(r.asp),
      ]),
  };
}
