/**
 * Price-band legend - and insight I-5 in the same object.
 *
 * The ladder's fill is a sequential ramp, so it needs a legend (a scored criterion).
 * Rather than spend space on a bare colour key, the legend carries the numbers that
 * make the ramp mean something: each band's share of units against its share of
 * revenue, and the leverage between them.
 */
import { For } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { money, pct, type Band } from "../data";

const FILL: Record<number, string> = {
  1: "var(--seq-1)",
  2: "var(--seq-2)",
  3: "var(--seq-3)",
  4: "var(--seq-4)",
};

export function BandLegend(props: { data: Band[]; poster?: boolean }) {
  return (
    <table class="data bandlegend">
      <thead>
        <tr>
          <th scope="col">Price band</th>
          <th scope="col">Units</th>
          <th scope="col">Revenue</th>
          <th scope="col" title="revenue share divided by unit share">
            Leverage
          </th>
        </tr>
      </thead>
      <tbody>
        <For each={props.data}>
          {(b) => {
            const lev = () => (b.unit_pct ? b.rev_pct / b.unit_pct : 0);
            return (
              <tr
                tabindex="0"
                role="button"
                aria-pressed={isActive("price_band", b.price_band)}
                data-metric={`band.${b.price_band}.rev_pct`}
                data-value={b.rev_pct}
                aria-label={`${b.price_band}: ${pct(b.unit_pct)} of units, ${pct(
                  b.rev_pct
                )} of revenue, leverage ${lev().toFixed(2)} times`}
                onClick={() => toggle("price_band", b.price_band)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle("price_band", b.price_band);
                  }
                }}
              >
                <td>
                  {/* the swatch is the legend; the label repeats it in text */}
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: "13px",
                      height: "13px",
                      background: FILL[b.price_band_sort],
                      "margin-right": "7px",
                      "vertical-align": "-2px",
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                  {b.price_band}
                </td>
                <td>
                  <span data-metric={`band.${b.price_band}.unit_pct`} data-value={b.unit_pct}>
                    {pct(b.unit_pct)}
                  </span>
                </td>
                <td>{pct(b.rev_pct)}</td>
                <td style={{ "font-weight": 600 }}>
                  <span data-metric={`band.${b.price_band}.leverage`} data-value={lev()}>
                    {lev().toFixed(2)}×
                  </span>
                </td>
              </tr>
            );
          }}
        </For>
      </tbody>
    </table>
  );
}

export function bandTable(data: Band[]) {
  return {
    columns: ["Price band", "Units", "Unit share", "Revenue", "Revenue share", "Leverage"],
    rows: data.map((b) => [
      b.price_band,
      Math.round(b.units).toLocaleString(),
      pct(b.unit_pct),
      money(b.revenue),
      pct(b.rev_pct),
      (b.unit_pct ? b.rev_pct / b.unit_pct : 0).toFixed(2) + "×",
    ]),
  };
}
