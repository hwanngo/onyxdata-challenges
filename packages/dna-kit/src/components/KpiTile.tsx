import { Show } from "solid-js";

/**
 * A KPI with a delta and an accessible value.
 *
 * `data-metric` and `data-value` are REQUIRED: tools/verify_metrics.py scrapes them
 * and recomputes each figure from the curated parquet. Zero tolerance for mismatches.
 *
 * Direction is never encoded in colour alone - the arrow glyph carries it too.
 */
export function KpiTile(props: {
  metric: string;          // key in model/metric_checks.yml
  label: string;
  value: number;           // raw, unformatted
  display: string;         // formatted for humans
  delta?: number;          // fractional, e.g. 0.12 = +12%
  deltaLabel?: string;     // "vs prior quarter"
  goodWhen?: "up" | "down";
}) {
  const good = () =>
    props.delta === undefined ? null : (props.delta >= 0) === (props.goodWhen !== "down");
  const arrow = () => (props.delta === undefined ? "" : props.delta >= 0 ? "▲" : "▼");

  return (
    <div class="kpi">
      <div class="kpi__label">{props.label}</div>
      <div
        class="kpi__value"
        data-metric={props.metric}
        data-value={props.value}
      >
        {props.display}
      </div>
      <Show when={props.delta !== undefined}>
        <div
          class="kpi__delta"
          style={{ color: good() ? "var(--good)" : "var(--bad)" }}
        >
          <span aria-hidden="true">{arrow()}</span>{" "}
          {(props.delta! * 100).toFixed(1)}%
          <span class="kpi__delta-label"> {props.deltaLabel ?? ""}</span>
          <span class="sr-only">
            {props.delta! >= 0 ? "increase" : "decrease"}, which is{" "}
            {good() ? "favourable" : "unfavourable"}
          </span>
        </div>
      </Show>
    </div>
  );
}
