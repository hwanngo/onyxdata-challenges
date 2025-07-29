import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "../state/crossfilter";

/**
 * A single "explore" cut: one dimension, its verdict, and a filterable table.
 *
 * Written near-identically three months running (2025/05, /06, /07) before being promoted.
 * The shape that generalises:
 *
 *   - a title and the brief requirement(s) it discharges
 *   - a VERDICT sentence stating what the analysis found, including the test where there
 *     is one. On synthetic DataDNA files the honest verdict is usually "no significant
 *     difference (p=...)", and saying so is the differentiator - no published entry does.
 *   - a table whose rows cross-filter the rest of the report
 *   - `significant` drives only the accent on the verdict rule, never the data marks
 *
 * The row renderer is supplied by the month, because what belongs in the columns is
 * month-specific (May: revenue/ASP; June: median views; July: n, mean, CI).
 */
export type Cut<T = any> = {
  /** the fact-table column this cut groups by, and the field the chips filter on */
  col: string;
  title: string;
  /** brief requirement ids this discharges, e.g. "R2 · R5" */
  req?: string;
  /** what the analysis actually found. State the test and the p-value where there is one. */
  verdict: string;
  /** true only when the effect is real and survives correction */
  significant?: boolean;
};

export function CutPanel<T extends { k: string }>(props: {
  cut: Cut;
  rows: T[] | undefined;
  columns: string[];
  /** cells for one row, excluding the leading label cell which CutPanel renders */
  cells: (row: T) => (string | number)[];
  /** accessible description of a row, e.g. "Video: median 913,871 views from 2,948 posts" */
  label: (row: T) => string;
  /** optional inline bar width 0..1, drawn in the label cell */
  bar?: (row: T) => number;
  /** optional badge, e.g. a thin-sample flag */
  badge?: (row: T) => string | undefined;
  limit?: number;
}) {
  const shown = createMemo(() => (props.rows ?? []).slice(0, props.limit ?? 12));
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.82rem" }}>
        {props.cut.title}{" "}
        <Show when={props.cut.req}>
          <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>
            {props.cut.req}
          </span>
        </Show>
      </h3>
      <p
        class="panel__sub"
        style={{
          "border-left": `3px solid ${props.cut.significant ? "var(--accent)" : "var(--border-strong)"}`,
          "padding-left": "8px",
          "margin-bottom": "10px",
        }}
      >
        {props.cut.verdict}
      </p>
      <Show when={props.rows}>
        <table class="data">
          <thead>
            <tr>
              <For each={props.columns}>{(c) => <th scope="col">{c}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={shown()}>
              {(r) => (
                <tr
                  tabindex="0"
                  role="button"
                  aria-pressed={isActive(props.cut.col, r.k)}
                  aria-label={props.label(r)}
                  onClick={() => toggle(props.cut.col, r.k)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(props.cut.col, r.k);
                    }
                  }}
                >
                  <td>
                    <Show when={props.bar}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          height: "8px",
                          width: `${Math.max(0, Math.min(1, props.bar!(r))) * 40}px`,
                          background: "var(--seq-2)",
                          "margin-right": "6px",
                          "vertical-align": "middle",
                        }}
                      />
                    </Show>
                    {r.k}
                    <Show when={props.badge?.(r)}>
                      <span class="flag">{props.badge!(r)}</span>
                    </Show>
                  </td>
                  <For each={props.cells(r)}>{(c) => <td class="num">{c}</td>}</For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </section>
  );
}

/**
 * The drawer that holds the cuts. Collapsed and visually subordinate by design: the
 * brief's descriptive questions must be discharged without diluting the argument.
 */
export function ExploreDrawer(props: {
  summary?: string;
  intro?: string;
  children: any;
}) {
  return (
    <details class="explore panel live-only">
      <summary>{props.summary ?? "Explore - the brief's other questions, answered"}</summary>
      <Show when={props.intro}>
        <p class="panel__sub" style={{ "max-width": "80ch" }}>{props.intro}</p>
      </Show>
      <div class="explore-grid">{props.children}</div>
    </details>
  );
}
