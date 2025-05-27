/**
 * EXPLORE - discharges the brief's descriptive requirements (R2, R3, R4, R8, R9)
 * without letting them dilute the argument.
 *
 * Collapsed by default and visually subordinate. Where the insight ledger established
 * that a difference is not significant, the panel SAYS SO rather than implying a finding.
 * That verdict text is the honest answer to the question the brief asked.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import {
  byField,
  derived,
  money,
  monthlyCv,
  months as monthsOf,
  usd0,
  type Filter,
  type Row,
} from "../data";

type Cut = {
  key: string;
  col: string;
  title: string;
  req: string;
  verdict: string;
  significant: boolean;
};

const CUTS: Cut[] = [
  {
    key: "sales_channel",
    col: "sales_channel",
    title: "Sales channel",
    req: "R4",
    // prose-number-ok: "Correction (channel ASP)", analysis/insights.md - a permutation p
    // over a ratio of sums has no single DOM home; the ASPs themselves are in the table below.
    verdict:
      "Online carries 62% of revenue. Unit-weighted ASP spans $743-$806, but reshuffling the channel labels produces a spread at least that wide about half the time (permutation p=0.52) - channel does not change what people buy.",
    significant: true,
  },
  {
    key: "payment_type",
    col: "payment_type",
    title: "Payment type",
    req: "R4",
    // prose-number-ok: IR-5, analysis/insights.md - a chi-square p has no DOM home, and
    // the $3.16M-$3.89M span is the range of the Revenue column of the table below, not a
    // single cell. Both are recorded with their query in the ledger.
    verdict:
      "EMI leads, but the four methods span only $3.16M-$3.89M. Payment type is independent of age group (p=0.72).",
    significant: false,
  },
  {
    key: "customer_age_group",
    col: "customer_age_group",
    title: "Age group",
    req: "R3 · R9",
    // prose-number-ok: IR-6, analysis/insights.md - the $753-$820 span is the range of the
    // ASP column of the table below; the Brand x Age chi-square has no DOM home.
    verdict:
      "No significant pattern. Revenue per unit spans $753-$820 with no monotonic trend - the brief's expected 'younger customers prefer certain brands' is not supported (Brand × Age p=0.14).",
    significant: false,
  },
  {
    key: "storage_size",
    col: "storage_size",
    title: "Storage size",
    req: "R2",
    // prose-number-ok: IR-7, analysis/insights.md - chi-square p, no DOM home.
    verdict:
      "No effect. Storage is independent of brand (p=0.77); the ASP differences here are the price ladder showing through, not a storage preference.",
    significant: false,
  },
  {
    key: "color",
    col: "color",
    title: "Colour",
    req: "R2",
    // prose-number-ok: IR-8, analysis/insights.md - two chi-square p-values, no DOM home.
    verdict:
      "No effect. Colour is independent of brand (p=0.12) and of age group (p=0.36). White's higher ASP is which phones happened to be white, not a colour premium.",
    significant: false,
  },
  {
    key: "operating_system",
    col: "operating_system",
    title: "Operating system",
    req: "R2",
    // prose-number-ok: IR-9, analysis/insights.md - "100% determined" is a structural fact
    // about the schema (a functional dependency), asserted by
    // test_operating_system_is_determined_by_brand, not a figure this chart renders.
    verdict:
      "iOS is Apple and Android is everyone else - the OS field is 100% determined by brand. This chart is the brand chart with fewer categories.",
    significant: false,
  },
];

function CutPanel(props: { cut: Cut; filters: () => Filter[] }) {
  const data = derived((rs: Row[]) => byField(rs, props.cut.col as keyof Row), props.filters);
  const max = createMemo(() => Math.max(...(data() ?? []).map((r: any) => r.revenue), 1));

  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.82rem" }}>
        {props.cut.title}{" "}
        <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>
          {props.cut.req}
        </span>
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
      <Show when={data()}>
        <table class="data">
          <thead>
            <tr>
              <th scope="col">{props.cut.title}</th>
              <th scope="col">Revenue</th>
              <th scope="col">ASP</th>
              <th scope="col">Days</th>
            </tr>
          </thead>
          <tbody>
            <For each={data()}>
              {(r: any) => (
                <tr
                  tabindex="0"
                  role="button"
                  aria-pressed={isActive(props.cut.col, r.k)}
                  aria-label={`${r.k}: revenue ${money(r.revenue)}, average selling price ${usd0(r.asp)}`}
                  onClick={() => toggle(props.cut.col, r.k)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(props.cut.col, r.k);
                    }
                  }}
                >
                  <td>
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        height: "7px",
                        width: `${(r.revenue / max()) * 40}px`,
                        background: "var(--seq-3)",
                        "margin-right": "6px",
                        "vertical-align": "middle",
                      }}
                    />
                    {r.k}
                  </td>
                  <td>{money(r.revenue)}</td>
                  <td>{usd0(r.asp)}</td>
                  <td>{Math.round(r.days)}</td>
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
  const data = derived(monthsOf, props.filters);
  // measured, not asserted - the "flat" verdict is this number
  const cvRes = derived(monthlyCv, props.filters);
  const cv = () => cvRes() ?? 0;
  const max = createMemo(() => Math.max(...(data() ?? []).map((r: any) => r.revenue), 1));
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.82rem" }}>
        Month over month{" "}
        <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>
          R8
        </span>
      </h3>
      <p
        class="panel__sub"
        style={{
          "border-left": "3px solid var(--border-strong)",
          "padding-left": "8px",
          "margin-bottom": "10px",
        }}
      >
        {`Flat, and that is the finding. Monthly revenue varies by a coefficient of ${cv().toFixed(
          2
        )} with no seasonality - December is within a tenth of January. For a retailer spanning India and Turkey, the `}
        <em>absence</em> of a festive peak is the notable result. Month-to-month swings are noise.
      </p>
      <Show when={data()}>
        <svg viewBox="0 0 460 130" width="100%" style={{ height: "auto" }} role="img"
             aria-label="Monthly revenue for 2024, essentially flat with no seasonal peak.">
          <title>Monthly revenue 2024</title>
          <For each={data()}>
            {(r: any, i) => (
              <g>
                <rect
                  x={i() * 38 + 6}
                  y={110 - (r.revenue / max()) * 92}
                  width={28}
                  height={(r.revenue / max()) * 92}
                  fill="var(--seq-2)"
                />
                <text
                  class="ladder-price num"
                  x={i() * 38 + 20}
                  y={124}
                  text-anchor="middle"
                  style={{ "font-size": "9px" }}
                >
                  {r.month_name}
                </text>
              </g>
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
      <summary>
        Explore - the brief's other questions, answered
      </summary>
      <p class="panel__sub" style={{ "max-width": "80ch" }}>
        The brief asked nine questions. Five are answered above, because they carry the argument.
        The rest are here. Where the analysis found no significant difference, this section says so
        rather than dressing noise as a finding - with the test and p-value that justifies the
        verdict.
      </p>
      <div class="explore-grid">
        <For each={CUTS}>{(c) => <CutPanel cut={c} filters={props.filters} />}</For>
        <MonthPanel filters={props.filters} />
      </div>
    </details>
  );
}
