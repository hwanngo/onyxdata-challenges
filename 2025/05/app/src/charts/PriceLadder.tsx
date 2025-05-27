/**
 * THE PRICE LADDER - this month's signature element.
 *
 * Every model pinned at its true price on a shared vertical axis; bar length = revenue.
 * The eye sees the bars grow as you climb: that IS the thesis, without annotation.
 *
 * Hand-rolled SVG rather than ECharts, deliberately:
 *   - the layout (price-positioned rungs + band fill + brackets) is bespoke
 *   - every rung is a real focusable DOM node, so keyboard traversal and screen-reader
 *     labelling are native rather than bolted onto a canvas
 * Every chart in this month is hand-rolled for the same reasons.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { money, pct, usd0, type Rung } from "../data";

const BAND_FILL: Record<number, string> = {
  1: "var(--seq-1)",
  2: "var(--seq-2)",
  3: "var(--seq-3)",
  4: "var(--seq-4)",
};

export function PriceLadder(props: {
  data: Rung[];
  poster?: boolean;
  limit?: number;
  onDrill?: (model: string) => void;
}) {
  const rows = createMemo(() => {
    const d = [...props.data].sort((a, b) => b.list_price - a.list_price);
    return props.limit ? d.slice(0, props.limit) : d;
  });

  // The ladder is the hero and owns the full height of the left column: rows are generous.
  const rowH = () => (props.poster ? 28 : 33);
  const labelW = () => (props.poster ? 250 : 172);
  const priceW = () => (props.poster ? 78 : 60);
  const height = () => rows().length * rowH() + 26;
  const maxRev = createMemo(() => Math.max(...rows().map((r) => r.revenue), 1));
  const barMax = () => (props.poster ? 300 : 176);
  // room to the right for the value label plus the premium bracket and its two lines
  const totalW = () => labelW() + priceW() + barMax() + (props.poster ? 250 : 210);
  const bracketX = () => labelW() + priceW() + barMax() + (props.poster ? 78 : 66);

  // bracket spanning the premium rungs - the "25% of units, 40% of revenue" annotation
  const premiumCount = createMemo(() => rows().filter((r) => r.list_price >= 1000).length);

  return (
    <svg
      viewBox={`0 0 ${totalW()} ${height()}`}
      width="100%"
      style={{ "max-width": `${totalW()}px`, height: "auto", display: "block" }}
      role="group"
      aria-label="Price ladder: every phone model positioned at its price, with bar length showing revenue. Revenue rises with price."
    >
      <title>Price ladder - revenue by model, ordered by price</title>

      {/* the spine */}
      <line
        class="axis-line"
        x1={labelW() + priceW()}
        y1={8}
        x2={labelW() + priceW()}
        y2={rows().length * rowH() + 10}
      />

      <For each={rows()}>
        {(r, i) => {
          const y = () => i() * rowH() + 14;
          const w = () => Math.max(2, (r.revenue / maxRev()) * barMax());
          const active = () => isActive("mobile_model", r.mobile_model);
          const anyActive = () => rows().some((x) => isActive("mobile_model", x.mobile_model));
          return (
            <g
              class="ladder-row"
              classList={{ dimmed: anyActive() && !active() }}
              tabindex="0"
              role="button"
              aria-pressed={active()}
              data-metric={`ladder.${r.mobile_model}.revenue`}
              data-value={r.revenue}
              aria-label={`${r.mobile_model}, ${r.brand}, ${usd0(r.list_price)}, revenue ${money(
                r.revenue
              )}, ${pct(r.rev_pct)} of total`}
              onClick={() => toggle("mobile_model", r.mobile_model)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onDrill ? props.onDrill(r.mobile_model) : toggle("mobile_model", r.mobile_model);
                }
              }}
            >
              {/* generous hit area - well beyond the bar height */}
              <rect x={0} y={y() - rowH() / 2 + 2} width={totalW()} height={rowH()} fill="transparent" />
              <text class="ladder-label" x={labelW() - 8} y={y() + 4} text-anchor="end">
                {r.mobile_model}
              </text>
              <text class="ladder-price num" x={labelW() + priceW() - 10} y={y() + 4} text-anchor="end">
                {usd0(r.list_price)}
              </text>
              <rect
                class="bar"
                x={labelW() + priceW() + 1}
                y={y() - rowH() / 2 + 5}
                width={w()}
                height={rowH() - 9}
                fill={BAND_FILL[r.model_band_sort] ?? "var(--seq-2)"}
                stroke={active() ? "var(--ink)" : "none"}
                stroke-width={active() ? 1.5 : 0}
              />
              <text
                class="ladder-price num"
                x={labelW() + priceW() + w() + 7}
                y={y() + 4}
              >
                {money(r.revenue)}
              </text>
            </g>
          );
        }}
      </For>

      {/* Premium bracket. Drawn to the RIGHT of the bars: the left gutter belongs to the
          model labels, and an annotation there collides with them at every viewport. */}
      <Show when={premiumCount() >= 3 && rows().length > 10}>
        <g>
          <path
            class="annot-rule"
            fill="none"
            d={`M ${bracketX()} 14 h 7 v ${premiumCount() * rowH() - 4} h -7`}
          />
          <text class="annot" x={bracketX() + 12} y={14 + (premiumCount() * rowH()) / 2}>
            <tspan x={bracketX() + 12} dy="-0.35em">a quarter of units</tspan>
            <tspan x={bracketX() + 12} dy="1.25em">two-fifths of revenue</tspan>
          </text>
        </g>
      </Show>
    </svg>
  );
}

/** Rows for the visually-hidden data table that mirrors the chart. */
export function ladderTable(data: Rung[]) {
  return {
    columns: ["Model", "Brand", "Price", "Band", "Revenue", "% of revenue", "Days traded"],
    rows: [...data]
      .sort((a, b) => b.list_price - a.list_price)
      .map((r) => [
        r.mobile_model,
        r.brand,
        usd0(r.list_price),
        r.model_band,
        money(r.revenue),
        pct(r.rev_pct),
        String(r.days),
      ]),
  };
}
