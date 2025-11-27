/**
 * THE SPAN - this month's signature element.
 *
 * Ten cuts of the same 12.02% correction, one row each, one dot per group in that cut.
 * A vertical rule marks the overall correction.
 *
 * Six rows collapse onto the rule: cut the data by channel, payment method, category, month,
 * segment or product family and every group takes the same ~12% haircut (spans of 0.58 to
 * 4.71 points). Three rows spray across the entire width: by currency, region and country the
 * correction runs from 1.65% to 19.34%, because the file's revenue column includes sales tax
 * and the tax rate is 0% in the United States and 20% across Europe.
 *
 * That is the whole thesis in one frame, and it needs no axis literacy to read - six tight
 * stacks and three sprays. A waterfall would show the correction's SIZE but not its
 * UNIFORMITY, which is the actual finding.
 *
 * The tenth row, `by discount code`, is drawn between the two families and marked, because
 * its 13.99-point span is geography in disguise: SALE15 is redeemed only in the tax-free US
 * and LOYALTY15 only outside it. Hiding it would be tidier and dishonest.
 *
 * ACCESSIBILITY. Geographic dots are SOLID, non-geographic dots are HOLLOW. Fill carries the
 * distinction because the measured contrast between the two theme colours is only 1.89:1 in
 * greyscale - hue cannot carry it alone (.workbench/2025/11/design/direction.md). The rows are also sorted by
 * span and separated by a labelled rule, so the grouping survives with no colour at all.
 */
import { For, Show, createMemo } from "solid-js";
import { type SpanRow, dec } from "../data";

const W = 980;
const ROW_H = 30;
const PAD = { t: 54, r: 176, b: 104, l: 168 };  // b reserves ticks + axis title + the two key rows
/* Poster geometry. The scrolling page wants a tall chart in a narrow column; the poster
   needs the same ten rows in a 16:9 band, so it gets a wider frame and tighter rows rather
   than a shrunken copy of the web version. */
const PW = 1860;
const PROW_H = 24;
const PPAD = { t: 46, r: 190, b: 116, l: 210 };

export function TheSpan(props: {
  rows: SpanRow[];
  overall: number;
  poster?: boolean;
  onPick?: (cut: string, group: string) => void;
}) {
  const w = () => (props.poster ? PW : W);
  const rowH = () => (props.poster ? PROW_H : ROW_H);
  const pad = () => (props.poster ? PPAD : PAD);
  const H = () => pad().t + props.rows.length * rowH() + pad().b;

  const lo = () => 0;
  const hi = () => Math.ceil(Math.max(...props.rows.map((r) => r.hi)) / 5) * 5;
  const x = (v: number) =>
    pad().l + ((v - lo()) / (hi() - lo())) * (w() - pad().l - pad().r);

  const ticks = createMemo(() => {
    const out: number[] = [];
    for (let v = 0; v <= hi(); v += 5) out.push(v);
    return out;
  });

  const r = () => (props.poster ? 5.2 : 4.4);
  /** Index of the first geographic row - the rule goes above it. */
  const firstGeo = createMemo(() => props.rows.findIndex((s) => s.isGeographic));
  const nonGeo = () => props.rows.filter((s) => !s.isGeographic && !s.isDisguisedGeo);
  const geo = () => props.rows.filter((s) => s.isGeographic);

  const summary = () =>
    `Ten ways of cutting the same ${dec(props.overall, 2)} percent revenue correction, plotted as ` +
    `one row per cut and one dot per group. ${nonGeo().length} non-geographic cuts - ` +
    `${nonGeo().map((s) => s.label.replace("by ", "")).join(", ")} - have spans of ` +
    `${dec(Math.min(...nonGeo().map((s) => s.span)), 2)} to ` +
    `${dec(Math.max(...nonGeo().map((s) => s.span)), 2)} percentage points, so every group takes ` +
    `essentially the same correction. The ${geo().length} geographic cuts - ` +
    `${geo().map((s) => s.label.replace("by ", "")).join(", ")} - have spans of ` +
    `${dec(Math.min(...geo().map((s) => s.span)), 2)} to ` +
    `${dec(Math.max(...geo().map((s) => s.span)), 2)} points, running from ` +
    `${dec(Math.min(...geo().flatMap((s) => s.points.map((p) => p.pct))), 2)} percent to ` +
    `${dec(Math.max(...geo().flatMap((s) => s.points.map((p) => p.pct))), 2)} percent. ` +
    `The two families do not overlap. Discount code is drawn separately because its span is ` +
    `caused by geography: one code is redeemed only in the tax-free United States.`;

  return (
    <svg
      viewBox={`0 0 ${w()} ${H()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={summary()}
    >
      <title>The same correction, applied ten ways</title>

      {/* ---- grid + axis ---- */}
      <g aria-hidden="true">
        <For each={ticks()}>
          {(t) => (
            <>
              <line x1={x(t)} y1={pad().t - 14} x2={x(t)} y2={H() - pad().b} class="gridline" />
              <text x={x(t)} y={H() - pad().b + 18} class="ticklabel" text-anchor="middle">
                {t}%
              </text>
            </>
          )}
        </For>
        <text x={x(hi() / 2)} y={H() - pad().b + 40} class="axistitle" text-anchor="middle">
          SHARE OF THE FILE&rsquo;S OWN REVENUE FIGURE THAT IS NOT REVENUE
        </text>
      </g>

      {/* ---- the overall correction: the line everything is measured against ---- */}
      <line
        x1={x(props.overall)}
        y1={pad().t - 20}
        x2={x(props.overall)}
        y2={H() - pad().b}
        class="span-overall"
        aria-hidden="true"
      />
      <text
        x={x(props.overall)}
        y={pad().t - 26}
        class="span-overall-label"
        text-anchor="middle"
        aria-hidden="true"
      >
        {dec(props.overall, 2)}% OVERALL
      </text>

      {/* ---- rows ---- */}
      <For each={props.rows}>
        {(row, i) => {
          const y = () => pad().t + i() * rowH() + rowH() / 2;
          const solid = () => row.isGeographic;
          return (
            <g>
              <Show when={i() === firstGeo() && firstGeo() > 0}>
                <line
                  x1={pad().l - 158}
                  y1={pad().t + i() * rowH() - 3}
                  x2={w() - pad().r + 40}
                  y2={pad().t + i() * rowH() - 3}
                  class="span-divider"
                  aria-hidden="true"
                />
              </Show>

              <text x={pad().l - 14} y={y() + 4} class="span-rowlabel" text-anchor="end">
                {row.label}
              </text>

              {/* the range, so a row reads even where dots overlap */}
              <line
                x1={x(row.lo)}
                y1={y()}
                x2={x(row.hi)}
                y2={y()}
                class={solid() ? "span-range span-range--geo" : "span-range"}
                aria-hidden="true"
              />

              <For each={row.points}>
                {(p) => (
                  <circle
                    cx={x(p.pct)}
                    cy={y()}
                    r={r()}
                    class={solid() ? "span-dot span-dot--geo" : "span-dot"}
                    tabindex={props.onPick ? 0 : undefined}
                    role={props.onPick ? "button" : undefined}
                    aria-label={
                      props.onPick
                        ? `${row.label}, ${p.k}: ${dec(p.pct, 2)} percent correction on ${p.n} events`
                        : undefined
                    }
                    onClick={() => props.onPick?.(row.cut, p.k)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        props.onPick?.(row.cut, p.k);
                      }
                    }}
                  >
                    <title>{`${p.k} - ${dec(p.pct, 2)}% (${p.n.toLocaleString()} events)`}</title>
                  </circle>
                )}
              </For>

              {/* span readout on the right */}
              <text
                x={w() - pad().r + 46}
                y={y() + 4}
                class="span-value"
                text-anchor="end"
                data-metric={`correction_span_${row.cut}`}
                data-value={row.span}
              >
                {dec(row.span, 2)}
              </text>
              <Show when={row.isDisguisedGeo}>
                <text x={w() - pad().r + 54} y={y() + 4} class="span-note" text-anchor="start">
                  ← geography
                </text>
              </Show>
            </g>
          );
        }}
      </For>

      <text x={w() - pad().r + 46} y={pad().t - 14} class="span-colhead" text-anchor="end">
        SPAN (pp)
      </text>

      {/* ---- direct labels on the extremes of the widest row ---- */}
      <For each={[props.rows[props.rows.length - 1]]}>
        {(row) => {
          const y = () => pad().t + (props.rows.length - 1) * ROW_H + rowH() / 2;
          const loP = () => row.points.reduce((a, b) => (a.pct < b.pct ? a : b));
          const hiP = () => row.points.reduce((a, b) => (a.pct > b.pct ? a : b));
          return (
            <g aria-hidden="true">
              <text x={x(loP().pct)} y={y() + 17} class="span-extreme" text-anchor="middle">
                {loP().k} {dec(loP().pct, 2)}%
              </text>
              <text x={x(hiP().pct)} y={y() + 17} class="span-extreme" text-anchor="middle">
                {hiP().k} {dec(hiP().pct, 2)}%
              </text>
            </g>
          );
        }}
      </For>

      {/* ---- key. Fill is the encoding; the words say so. ---- */}
      <g aria-hidden="true" transform={`translate(${pad().l - 158} ${H() - pad().b + 84})`}>
        <circle cx="6" cy="-4" r="4.4" class="span-dot" />
        <text x="18" y="0" class="span-key">
          hollow · one group of a non-geographic cut
        </text>
        <circle cx="6" cy="14" r="4.4" class="span-dot span-dot--geo" />
        <text x="18" y="18" class="span-key">
          solid · one country, region or currency
        </text>
      </g>
    </svg>
  );
}

/** The hidden data table behind the chart - WCAG, and genuinely useful. */
export function spanTable(rows: SpanRow[]) {
  return {
    columns: ["Cut", "Groups", "Lowest", "Highest", "Span (pp)", "Family"],
    rows: rows.map((r) => [
      r.label,
      String(r.points.length),
      dec(r.lo, 2) + "%",
      dec(r.hi, 2) + "%",
      dec(r.span, 2),
      r.isGeographic ? "geographic" : r.isDisguisedGeo ? "geography in disguise" : "other",
    ]),
  };
}
