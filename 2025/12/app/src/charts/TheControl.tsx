/**
 * THE CONTROL - this month's signature element.
 *
 * Four measurements, each carried out twice: the way the file reports it (hollow marks,
 * dashed line) and the way it reads after checking (solid marks, solid line).
 *
 * Three of the four change:
 *   1  live release by year - the two readings separate by 3.7 points in 2025, because the
 *      source counts 399 animals still in the shelter as saved
 *   2  live release by age - 38% of dates of birth are staff estimates back-dated from the
 *      intake day, and dropping them removes most of the apparent senior penalty
 *   3  intakes by weekday - the public counter swings 3.1x across the week, field officers 1.2x
 *
 * The fourth does not change, and that is the point. Intakes by month rise and fall together
 * in both channels, so the summer peak is real demand rather than an artefact of when the
 * building is open. Panel 4 is the CONTROL: without it, panel 3 is a guess.
 *
 * It is drawn in the page's only third colour for that reason.
 *
 * ACCESSIBILITY: fill carries the distinction - hollow for the filed reading, solid for the
 * measured one - so the pairing survives greyscale and all three CVD simulations. Each panel
 * also carries its own aria-label stating what changed, and the figure below it repeats every
 * number as a table.
 */
import { For, Show } from "solid-js";
import { type PairedPanel, dec } from "../data";

const W = 300;
const H = 190;
const PAD = { t: 26, r: 14, b: 30, l: 40 };

function Panel(props: { panel: PairedPanel; index: number; poster?: boolean }) {
  const pts = () => props.panel.points;
  const vals = () => pts().flatMap((p) => [p.filed, p.measured]).filter(Number.isFinite);
  const lo = () => Math.min(...vals());
  const hi = () => Math.max(...vals());
  const pad = () => Math.max(1, (hi() - lo()) * 0.18);
  const y = (v: number) =>
    H - PAD.b - ((v - (lo() - pad())) / (hi() - lo() + 2 * pad())) * (H - PAD.t - PAD.b);
  const x = (i: number) => PAD.l + (i / Math.max(1, pts().length - 1)) * (W - PAD.l - PAD.r);
  const path = (get: (p: { filed: number; measured: number }) => number) =>
    pts()
      .map((p, i) => (Number.isFinite(get(p)) ? `${i ? "L" : "M"}${x(i)},${y(get(p))}` : ""))
      .join(" ");

  const worst = () =>
    pts().reduce(
      (a, p) => Math.max(a, Math.abs(p.filed - p.measured) || 0),
      0
    );

  return (
    <figure class={props.panel.changes ? "ctl" : "ctl ctl--holds"}>
      <figcaption class="ctl__head">
        <span class="ctl__n" aria-hidden="true">{props.index + 1}</span>
        <span class="ctl__title">{props.panel.title}</span>
        <span class={props.panel.changes ? "ctl__verdict" : "ctl__verdict ctl__verdict--holds"}>
          {props.panel.changes ? `moves ${dec(worst(), 1)}${props.panel.unit === "%" ? "pp" : "pp"}` : "holds"}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ height: "auto", display: "block" }}
        role="img"
        aria-label={
          `${props.panel.title}, measured two ways. ` +
          pts()
            .map((p) => `${p.k}: as filed ${dec(p.filed, 1)}, as measured ${dec(p.measured, 1)}`)
            .join("; ") +
          `. ${props.panel.note}`
        }
      >
        <g aria-hidden="true">
          <For each={[lo(), hi()]}>
            {(v) => (
              <>
                <line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} class="gridline" />
                <text x={PAD.l - 6} y={y(v) + 3} class="ctl__tick" text-anchor="end">
                  {dec(v, 0)}
                </text>
              </>
            )}
          </For>
          <path d={path((p) => p.filed)} class="ctl__line ctl__line--filed" />
          <path d={path((p) => p.measured)} class="ctl__line ctl__line--measured" />
          <For each={pts()}>
            {(p, i) => (
              <>
                <Show when={Number.isFinite(p.filed)}>
                  <circle cx={x(i())} cy={y(p.filed)} r={props.poster ? 4 : 3.2} class="ctl__dot ctl__dot--filed" />
                </Show>
                <Show when={Number.isFinite(p.measured)}>
                  <circle cx={x(i())} cy={y(p.measured)} r={props.poster ? 4 : 3.2} class="ctl__dot ctl__dot--measured" />
                </Show>
              </>
            )}
          </For>
          <For each={pts()}>
            {(p, i) => (
              <Show when={pts().length <= 8 || i() % 2 === 0}>
                <text x={x(i())} y={H - 10} class="ctl__tick" text-anchor="middle">
                  {p.k}
                </text>
              </Show>
            )}
          </For>
        </g>
      </svg>
      <p class="ctl__note">{props.panel.note}</p>
    </figure>
  );
}

export function TheControl(props: { panels: PairedPanel[]; poster?: boolean }) {
  return (
    <div class="control-grid">
      <For each={props.panels}>
        {(p, i) => <Panel panel={p} index={i()} poster={props.poster} />}
      </For>
    </div>
  );
}

export function controlTable(panels: PairedPanel[]) {
  return {
    columns: ["Measurement", "Group", "As filed", "As measured", "Difference"],
    rows: panels.flatMap((p) =>
      p.points.map((pt) => [
        p.title,
        pt.k,
        dec(pt.filed, 2),
        dec(pt.measured, 2),
        dec(pt.filed - pt.measured, 2),
      ])
    ),
  };
}
