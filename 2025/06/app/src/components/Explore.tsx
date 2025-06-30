/**
 * EXPLORE - discharges the brief's descriptive requirements (R2, R4, R7, R8, R9)
 * without letting them dilute the argument.
 *
 * Collapsed and visually subordinate. Where the analysis found no significant effect, the
 * panel SAYS SO with the test and the p-value. That is the honest answer to the question
 * the brief asked, and no published entry gives it.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { byField, derived, int, months, pct, type Filter, type Row } from "../data";

type Cut = { col: keyof Row; title: string; req: string; verdict: string; real: boolean };

const CUTS: Cut[] = [
  {
    col: "content_category", title: "Content category", req: "R2 · R8",
    // prose-number-ok: I-2 / I-3, analysis/insights.md - η² is a variance decomposition
    // over the whole table, not the value of any one row in it. The medians it is computed
    // from are rendered directly beneath.
    verdict:
      "Drives the engagement rate by construction - the rate is drawn from a band keyed to this field, so any 'category outperforms' reading is circular. On the one real metric, views, category still separates (η²=0.20 on log views, Kruskal p<1e-300), which is the defensible version.",
    real: true,
  },
  {
    col: "region", title: "Region", req: "R2 · R5 · R7",
    // prose-number-ok: I-2 region spread, analysis/insights.md - the 14.3% is a max/min ratio
    // across the whole region table, not any single mark; the medians are rendered beneath.
    verdict:
      "No significant effect. Median views span 14.3% across eight countries (Germany 408,850 to UK 357,592) and the Kruskal test gives p=0.30. R7's 'regions with high video interest' is really asking about each region's format mix - the video-view column is zero for 47% of posts by construction.",
    real: false,
  },
  {
    col: "post_hour", title: "Publishing hour", req: "R4",
    // prose-number-ok: I-7 hour and weekday, analysis/insights.md - a Kruskal p across
    // twelve hour groups is not the value of any one of the rows beneath it.
    // The p quoted is now the test on the measure this table shows (median views).
    verdict:
      "No significant effect on views (Kruskal p=0.85; on the synthetic engagement rate, p=0.19). Hours are bounded to 08:00-19:00 and the volume profile is bimodal by construction, so 'busiest hour' is a generator artifact, not audience behaviour.",
    real: false,
  },
  {
    col: "day_name", title: "Day of week", req: "R4",
    // prose-number-ok: I-7 hour and weekday, analysis/insights.md - same reason.
    verdict:
      "No significant effect on views (Kruskal p=0.34; on the engagement rate, p=0.83). No weekday outperforms.",
    real: false,
  },
  {
    col: "content_type", title: "Organic vs sponsored", req: "R9",
    // prose-number-ok: I-8 organic vs sponsored, analysis/insights.md - the verdict is a
    // model comparison (a raw gap, then the same contrast within each format), so it has
    // no single mark. The medians it reconciles against are the rows beneath.
    //
    // THIS SENTENCE WAS WRONG UNTIL 2025-06-30. It read "no significant effect (p=0.41,
    // η²=0.0001) ... performs identically to organic" while the table below it showed
    // Sponsored 471,713 against Organic 365,325. The quoted test was on engagement_rate -
    // the column this very report calls a synthetic label - so the evidence cited was not
    // evidence for the claim. The gap on views is real (p=1.8e-06); it is format mix.
    verdict:
      "The raw gap is real and misleading: sponsored posts take a 29.1% higher median views (471,713 against 365,325, Kruskal p=1.8e-06). It is format mix, not sponsorship - sponsored is 22.7% of Video, the highest-median format, and 1.5% of Live Stream, the lowest. Hold format constant and the sign flips: within Video sponsored is 32.6% LOWER (p=0.0022), within Text 34.1% higher (p=0.0023), nothing elsewhere; scored against its own format's median, the typical sponsored post sits at 0.89 and the typical organic one at 1.01. Pooled, the effect is detectable and negligible - content type adds partial η²=0.0049 to a format model of log views (p=0.0003), half a percent of the residual variance. There is no lever here, and the raw ranking points the wrong way.",
    real: false,
  },
];

function CutPanel(props: { cut: Cut; filters: () => Filter[] }) {
  const data = derived((rs: Row[]) => byField(rs, props.cut.col), props.filters);
  const max = createMemo(() => Math.max(...(data() ?? []).map((r) => r.med_views), 1));
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.8rem" }}>
        {props.cut.title}{" "}
        <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>
          {props.cut.req}
        </span>
      </h3>
      <p
        class="panel__sub"
        style={{
          "border-left": `4px solid ${props.cut.real ? "var(--accent)" : "var(--border-strong)"}`,
          "padding-left": "8px", "margin-bottom": "10px",
        }}
      >
        {props.cut.verdict}
      </p>
      <Show when={data()}>
        <table class="data">
          <thead>
            <tr>
              <th scope="col">{props.cut.title}</th>
              <th scope="col">Posts</th>
              <th scope="col">Median views</th>
            </tr>
          </thead>
          <tbody>
            <For each={data()!.slice(0, 12)}>
              {(r) => (
                <tr
                  tabindex="0"
                  role="button"
                  aria-pressed={isActive(props.cut.col as string, r.k)}
                  aria-label={`${r.k}: ${int(r.posts)} posts, median ${int(r.med_views)} views`}
                  onClick={() => toggle(props.cut.col as string, r.k)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(props.cut.col as string, r.k);
                    }
                  }}
                >
                  <td>
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block", height: "8px",
                        width: `${(r.med_views / max()) * 38}px`,
                        background: "var(--seq-2)", "margin-right": "6px",
                        "vertical-align": "middle",
                      }}
                    />
                    {r.k}
                  </td>
                  <td>{int(r.posts)}</td>
                  <td>{int(r.med_views)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </section>
  );
}

function MonthPanel(props: { filters: () => Filter[] }) {
  const data = derived(months, props.filters);
  const max = createMemo(() => Math.max(...(data() ?? []).map((r) => r.views), 1));
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.8rem" }}>
        Over time{" "}
        <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>R4 · R8</span>
      </h3>
      <p class="panel__sub" style={{
        "border-left": "4px solid var(--border-strong)", "padding-left": "8px",
        "margin-bottom": "10px",
      }}>
        Seventeen months, January 2024 to May 2025 - <em>not</em> the twelve the brief describes.
        No trend and no seasonal break in views.
      </p>
      <Show when={data()}>
        <svg viewBox="0 0 460 120" width="100%" style={{ height: "auto" }} role="img"
             aria-label="Monthly views, flat across the 17-month span with no trend.">
          <title>Views by month</title>
          <For each={data()}>
            {(r, i) => (
              <rect x={i() * 26 + 4} y={100 - (r.views / max()) * 88}
                    width={20} height={(r.views / max()) * 88} fill="var(--seq-2)" />
            )}
          </For>
        </svg>
      </Show>
    </section>
  );
}

export function Explore(props: { filters: () => Filter[] }) {
  return (
    <details class="explore panel live-only">
      <summary>Explore - the brief's other questions, answered</summary>
      <p class="panel__sub" style={{ "max-width": "80ch" }}>
        The brief asked nine questions. Four are answered above because they carry the argument.
        The rest are here - and four of the five have no significant answer. This section says so,
        with the test, rather than dressing noise as a finding.
      </p>
      <div class="explore-grid">
        <For each={CUTS}>{(c) => <CutPanel cut={c} filters={props.filters} />}</For>
        <MonthPanel filters={props.filters} />
      </div>
    </details>
  );
}
