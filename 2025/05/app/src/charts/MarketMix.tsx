/**
 * SAME PHONE, SAME PRICE - DIFFERENT RUNG. Insight I-4.
 *
 * A table rather than a chart, on purpose: the claim is a comparison of four numbers
 * against a like-for-like control column, and a table states that more honestly than
 * a bar chart would. The premium-mix column carries an inline bar so the ladder is
 * still visible at a glance.
 *
 * Thin samples (n<10) are badged, never hidden - the coverage weakness is part of the finding.
 */
import { For, Show } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { money, pct, usd0, type MarketRow } from "../data";

/** Below this many trading days a market is directional only, never comparable.
 *  60 days is "under two months of observation": it flags Pakistan (10) and Bangladesh
 *  (51) while leaving India (169) and Turkey (136), which is exactly the split the
 *  insight ledger says the I-4 claim rests on. */
const COMPARABLE_DAYS = 60;

export function MarketMix(props: {
  data: MarketRow[];
  poster?: boolean;
  onDrill?: (country: string) => void;
}) {
  const maxMix = () => Math.max(...props.data.map((r) => r.premium_mix), 1);
  return (
    <table class="data">
      <thead>
        <tr>
          <th scope="col">Market</th>
          <th scope="col">Premium mix</th>
          <th scope="col">ASP</th>
          <th scope="col">Z Fold 6 price</th>
          <th scope="col">Revenue</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.data}>
          {(r) => (
            <tr
              tabindex="0"
              role="button"
              aria-pressed={isActive("country", r.country)}
              data-metric={`market.${r.country}.asp`}
              data-value={r.asp}
              aria-label={`${r.country}: premium mix ${pct(r.premium_mix)}, ASP ${usd0(
                r.asp
              )}, ${Math.round(r.days)} trading days${
                r.days < COMPARABLE_DAYS ? " - thin sample, directional only" : ""
              }`}
              onClick={() => toggle("country", r.country)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onDrill ? props.onDrill(r.country) : toggle("country", r.country);
                }
              }}
            >
              <td>
                {r.country}
                <Show when={r.days < COMPARABLE_DAYS}>
                  <span class="flag" title="Fewer than 60 trading days - directional only, not comparable">
                    ⚑ n={Math.round(r.days)}
                  </span>
                </Show>
              </td>
              <td>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    height: "8px",
                    width: `${(r.premium_mix / maxMix()) * 54}px`,
                    background: "var(--seq-4)",
                    "margin-right": "6px",
                    "vertical-align": "middle",
                  }}
                />
                <span data-metric={`market.${r.country}.premium_mix`} data-value={r.premium_mix}>
                  {pct(r.premium_mix)}
                </span>
              </td>
              <td>{usd0(r.asp)}</td>
              <td>{r.zfold_price ? usd0(r.zfold_price) : "-"}</td>
              <td>{money(r.revenue)}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

export function marketTable(data: MarketRow[]) {
  return {
    columns: ["Market", "Trading days", "Premium unit mix", "ASP", "Z Fold 6 price", "Revenue"],
    rows: data.map((r) => [
      r.country,
      String(Math.round(r.days)),
      pct(r.premium_mix),
      usd0(r.asp),
      r.zfold_price ? usd0(r.zfold_price) : "not sold",
      money(r.revenue),
    ]),
  };
}
