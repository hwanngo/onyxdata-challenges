/**
 * THE RANKING THAT DISSOLVES - C3.
 *
 * Paired dumbbells, one per country: the hollow ochre mark is revenue per event as the file
 * reports it, the solid green mark is the same mean with sales tax removed.
 *
 * WHAT THIS AXIS MEASURES, precisely. It is mean(revenue) per EVENT, not per unit. The integrity
 * pass found the axis captioned "AVERAGE SELLING PRICE" while every query behind it computed
 * `avg(reported_usd)` and none divided by `quantity` - a seat count with mean 6.03 and range
 * 1-25. So the label asserted a per-unit price that nothing here computed. The axis now names
 * the measure it draws, and the per-unit test is published beside it: same direction, sharper
 * contrast (reported p = 4.8e-72, ex-tax p = 0.243).
 *
 * The reported marks fan out across $166; the restated marks collapse into a band of $53 that
 * is, statistically, one value. The test is NOT a literal - `props.test` is Kruskal-Wallis run
 * in the browser over the rows this chart is drawn from (app/src/stats.ts), and
 * `model/metric_checks.yml` re-derives H from the parquet in SQL.
 *
 * So this panel deliberately does NOT rank the restated marks. An earlier draft of the
 * analysis did exactly that, crowned Canada the new leader, and was wrong: ranking ten
 * countries on a measure that does not differ between them is reading noise as a league
 * table. The restated marks are drawn inside a shaded band labelled "no difference" for that
 * reason, and the countries stay in REPORTED order so the collapse is the visible event.
 *
 * The tax band is printed against each row, because it is the explanation.
 */
import { For } from "solid-js";
import { dec, pval } from "../data";
import type { KWResult } from "../stats";

const W = 500;
const ROW_H = 24;
const PAD = { t: 44, r: 74, b: 46, l: 156 };

type Row = { k: string; aspReported: number; aspExTax: number; taxRate: number; n: number };

export function AspByCountry(props: {
  rows: Row[];
  /** Kruskal-Wallis on ex-tax revenue per event across the countries in view. */
  test: KWResult;
  poster?: boolean;
  onPick?: (country: string) => void;
}) {
  const H = () => PAD.t + props.rows.length * ROW_H + PAD.b;
  const lo = () => Math.floor((Math.min(...props.rows.map((r) => r.aspExTax)) - 40) / 50) * 50;
  const hi = () => Math.ceil((Math.max(...props.rows.map((r) => r.aspReported)) + 30) / 50) * 50;
  const x = (v: number) => PAD.l + ((v - lo()) / (hi() - lo())) * (W - PAD.l - PAD.r);

  const bandLo = () => Math.min(...props.rows.map((r) => r.aspExTax));
  const bandHi = () => Math.max(...props.rows.map((r) => r.aspExTax));

  const ticks = () => {
    const out: number[] = [];
    for (let v = lo(); v <= hi(); v += 100) out.push(v);
    return out;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Revenue per event by country, as reported against ex-tax. Reported, the ` +
        `${props.rows.length} countries span ${dec(
          Math.max(...props.rows.map((r) => r.aspReported)) -
            Math.min(...props.rows.map((r) => r.aspReported)),
          2
        )} dollars and differ significantly. Ex-tax they span ${dec(bandHi() - bandLo(), 2)} ` +
        `dollars and do not differ at all - Kruskal-Wallis p equals ` +
        `${pval(props.test.p, true)}. ` +
        props.rows
          .map(
            (r) =>
              `${r.k}, tax ${Math.round(r.taxRate * 100)} percent: reported ${dec(
                r.aspReported,
                2
              )}, ex-tax ${dec(r.aspExTax, 2)}`
          )
          .join(". ")
      }
    >
      <title>Revenue per event by country, reported against ex-tax</title>

      {/* the "no difference" band - drawn first so marks sit on top */}
      <g aria-hidden="true">
        <rect
          x={x(bandLo())}
          y={PAD.t - 16}
          width={x(bandHi()) - x(bandLo())}
          height={props.rows.length * ROW_H + 18}
          class="asp-band"
        />
        <text
          x={(x(bandLo()) + x(bandHi())) / 2}
          y={PAD.t - 22}
          class="asp-band-label"
          text-anchor="middle"
          data-metric="asp_kw_h_ex_tax"
          data-value={props.test.H}
        >
          p = {pval(props.test.p)} · NO DIFFERENCE
        </text>
      </g>

      <g aria-hidden="true">
        <For each={ticks()}>
          {(t) => (
            <>
              <line x1={x(t)} y1={PAD.t - 4} x2={x(t)} y2={H() - PAD.b + 4} class="gridline" />
              <text x={x(t)} y={H() - PAD.b + 20} class="ticklabel" text-anchor="middle">
                ${t}
              </text>
            </>
          )}
        </For>
        <text x={(PAD.l + W - PAD.r) / 2} y={H() - PAD.b + 38} class="axistitle" text-anchor="middle">
          REVENUE PER EVENT
        </text>
      </g>

      <For each={props.rows}>
        {(r, i) => {
          const y = () => PAD.t + i() * ROW_H + ROW_H / 2 - 4;
          return (
            <g
              tabindex={props.onPick ? 0 : undefined}
              role={props.onPick ? "button" : undefined}
              aria-label={
                props.onPick
                  ? `${r.k}: reported ${dec(r.aspReported, 2)} dollars, ex-tax ${dec(r.aspExTax, 2)}`
                  : undefined
              }
              onClick={() => props.onPick?.(r.k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onPick?.(r.k);
                }
              }}
            >
              {/* A row's marks are two 4px dots. Requiring a hit on one of them fails the
                  44px touch-target rule and, as testing showed, is not reliably clickable at
                  all. This transparent rect makes the whole row the target. */}
              <rect
                x={0}
                y={y() - ROW_H / 2}
                width={W}
                height={ROW_H}
                class="asp-hit"
              />
              <line
                x1={x(r.aspExTax)}
                y1={y()}
                x2={x(r.aspReported)}
                y2={y()}
                class="asp-connector"
              />
              <circle cx={x(r.aspReported)} cy={y()} r={props.poster ? 5 : 4.2} class="asp-reported" />
              <circle cx={x(r.aspExTax)} cy={y()} r={props.poster ? 5 : 4.2} class="asp-restated" />
              <text x={PAD.l - 40} y={y() + 4} class="asp-label" text-anchor="end">
                {r.k}
              </text>
              <text x={PAD.l - 8} y={y() + 4} class="asp-tax" text-anchor="end">
                {Math.round(r.taxRate * 100)}%
              </text>
            </g>
          );
        }}
      </For>

      <g aria-hidden="true">
        <text x={PAD.l - 8} y={PAD.t - 22} class="asp-colhead" text-anchor="end">
          TAX
        </text>
      </g>
    </svg>
  );
}

export function aspTable(rows: Row[]) {
  return {
    columns: [
      "Country",
      "Tax rate",
      "Revenue per event, as reported",
      "Revenue per event, ex-tax",
      "Difference",
    ],
    rows: rows.map((r) => [
      r.k,
      Math.round(r.taxRate * 100) + "%",
      "$" + dec(r.aspReported, 2),
      "$" + dec(r.aspExTax, 2),
      "$" + dec(r.aspReported - r.aspExTax, 2),
    ]),
  };
}
