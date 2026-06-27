/**
 * Supporting panels - 2026/06.
 *
 * Every panel title states a FINDING. Every figure carries data-metric / data-value so
 * tools/verify_metrics.py can recompute it from the parquet and assert the DOM matches.
 *
 * The house rule, enforced in every panel: a rate is never shown without the count behind it.
 */
import { For, Show, createMemo } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import {
  type Claim, type Customer, type Fee, type FeeRow, type Rate,
  gbp2, gbpSigned, gbpCompact, int, pct, pp,
} from "../data";

// =========================================================================================
// ④  What the pack says vs what the file supports
// =========================================================================================

export function Intervals(props: { rates: Rate[]; headline: Record<string, any> }) {
  const show = createMemo(() =>
    props.rates.filter((r) =>
      ["Fraud-flagged", "Declined", "Reversed", "Completed"].includes(r.measure)));
  // one shared 0-100% scale so the two mark types are directly comparable
  const x = (p: number) => `${(100 * p).toFixed(2)}%`;

  return (
    <ChartFigure
      id="intervals"
      caption="What the pack says, and what the file supports: the same numbers with an honest denominator."
      columns={["Measure", "Transactions", "Customers", "Naive 95% CI", "Exact 95% CI on n=20"]}
      rows={props.rates.map((r) => [
        r.measure, /* prose-number-ok: I3 */ `${int(r.transactions)} / 1,500`, `${r.customers} / 20`,
        `±${pp(r.naive_width_pp / 2)}`,
        `[${pct(r.exact_ci_lo)}, ${pct(r.exact_ci_hi)}]`,
      ])}
    >
      <ul class="iv">
        <For each={show()}>
          {(r) => (
            <li>
              <span class="iv__name">{r.measure}</span>
              <span class="iv__track" role="img"
                aria-label={`${r.measure}: reported ${pct(r.transaction_rate)} with a naive interval of plus or minus ${pp(r.naive_width_pp / 2)}; the true interval on 20 customers is ${pct(r.exact_ci_lo)} to ${pct(r.exact_ci_hi)}.`}>
                {/* the TRUE interval is a bar; the naive estimate is a point. Different mark
                    types, because --reported and --measured are 1.27:1 apart in lightness. */}
                <i class="iv__true"
                   style={{ left: x(r.exact_ci_lo), width: x(r.exact_ci_hi - r.exact_ci_lo) }} />
                <i class="iv__naive"
                   style={{ left: x(r.transaction_rate - r.naive_ci_halfwidth),
                            width: x(2 * r.naive_ci_halfwidth) }} />
                <i class="iv__point" style={{ left: x(r.transaction_rate) }} />
              </span>
              <b class="num" data-metric={`rate.${r.measure}.customers`} data-value={r.customers}>
                {r.customers} of 20
              </b>
              <span class="iv__ci num">
                [{pct(r.exact_ci_lo)}, {pct(r.exact_ci_hi)}]
              </span>
            </li>
          )}
        </For>
      </ul>
      <p class="iv__scale" aria-hidden="true">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>{/* prose-number-ok: I3 - axis ticks, not measurements */}
      </p>
      <p class="cap">
        <span class="iv__key iv__key--point" aria-hidden="true" /> {/* prose-number-ok: I3 */} <b>point + hairline</b> - what
        a 1,500-row denominator gives.{" "}
        <span class="iv__key iv__key--true" aria-hidden="true" /> <b>bar</b> - the exact binomial
        interval on the 20 customers that actually vary. Design effect{" "}
        <b class="num" data-metric="design_effect" data-value={props.headline.design_effect}>
          {props.headline.design_effect}
        </b>, so standard errors are{" "}
        <b class="num" data-metric="se_inflation" data-value={props.headline.se_inflation}>
          {(props.headline.se_inflation ?? 0).toFixed(2)}×
        </b> wider.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑤  The KYC question
// =========================================================================================

export function KycPanel(props: { customers: Customer[]; headline: Record<string, any> }) {
  const cell = (kyc: boolean, fraud: boolean) =>
    props.customers.filter((c) => c.kyc_verified === kyc && c.is_flagged_fraud === fraud).length;
  const h = () => props.headline;

  return (
    <ChartFigure
      id="kyc"
      caption="The KYC question cannot be answered at this n - and it points the other way."
      columns={["KYC status", "Fraud-flagged", "Not flagged", "Total"]}
      rows={[
        ["Non-KYC", cell(false, true), cell(false, false), cell(false, true) + cell(false, false)],
        ["KYC verified", cell(true, true), cell(true, false), cell(true, true) + cell(true, false)],
      ]}
    >
      <table class="twobytwo">
        <caption class="sr-only">KYC status by fraud flag, in customers</caption>
        <thead>
          <tr>
            {/* an empty <th> is an axe violation (empty-table-header, minor) even though it
                is the conventional corner cell of a contingency table */}
            <th scope="col"><span class="sr-only">KYC status</span></th>
            <th scope="col">Flagged</th>
            <th scope="col">Not flagged</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Non-KYC</th>
            <td class="twobytwo--zero">
              <b class="num" data-metric="non_kyc_flagged" data-value={h().non_kyc_flagged}>
                {cell(false, true)}
              </b>
            </td>
            <td><b class="num">{cell(false, false)}</b></td>
          </tr>
          <tr>
            <th scope="row">KYC verified</th>
            <td><b class="num">{cell(true, true)}</b></td>
            <td><b class="num">{cell(true, false)}</b></td>
          </tr>
        </tbody>
      </table>
      <p class="cap">
        Every one of the{" "}
        <b class="num" data-metric="non_kyc_customers" data-value={h().non_kyc_customers}>
          {h().non_kyc_customers}
        </b>{" "}
        non-KYC customers has <b>zero</b> fraud flags; all four flagged customers are verified.
        Fisher exact{" "}
        <b class="num" data-metric="kyc_fisher_p" data-value={h().kyc_fisher_p}>
          p = {(h().kyc_fisher_p ?? 0).toFixed(4)}
        </b>{" "}
        - which means <em>nothing was learned</em>, in either direction. {/* prose-number-ok: I4 - "2x2" is a table shape, not a statistic */} This is not evidence
        that unverified customers are safer. It is evidence that a 2×2 with twenty observations
        cannot answer the question, and Compliance should not deprioritise KYC remediation on it.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑥  The fee rule - the positive control
// =========================================================================================

export function FeeRule(props: { fees: Fee[]; headline: Record<string, any> }) {
  const h = () => props.headline;
  const max = () => Math.max(...props.fees.map((f) => Math.max(f.over_gbp, f.under_gbp)), 1);
  const ranked = createMemo(() =>
    props.fees.slice().sort((a, b) => b.gross_variance_gbp - a.gross_variance_gbp).slice(0, 9));

  return (
    <ChartFigure
      id="feerule"
      caption="The one thing measured per transaction - and the variance report cancels it to zero."
      columns={["Type", "Channel", "Typical fee", "Rows wrong", "Charged", "Expected", "Net", "Gross"]}
      rows={props.fees.map((f) => [
        f.type_name, f.channel, gbp2(f.typical_fee_gbp), f.rows_wrong,
        gbp2(f.charged_gbp), gbp2(f.expected_gbp),
        gbpSigned(f.net_variance_gbp), gbp2(f.gross_variance_gbp),
      ])}
    >
      <div class="fee">
        <div class="fee__totals" role="img"
          aria-label={`Gross over-collection ${gbp2(h().fee_gross_over_gbp ?? 0)}, gross under-collection ${gbp2(h().fee_gross_under_gbp ?? 0)}, netting to ${gbpSigned(h().fee_net_variance_gbp ?? 0)}.`}>
          <div class="fee__side">
            <span class="fee__lab">over-charged</span>
            <i class="fee__bar fee__bar--over" style={{ width: "100%" }} />
            <b class="num" data-metric="fee_gross_over_gbp" data-value={h().fee_gross_over_gbp}>
              +{gbp2(h().fee_gross_over_gbp ?? 0)}
            </b>
          </div>
          <div class="fee__zero"><span>net £0</span></div>
          <div class="fee__side">
            <span class="fee__lab">under-charged</span>
            <i class="fee__bar fee__bar--under"
               style={{ width: pct((h().fee_gross_under_gbp ?? 0) / (h().fee_gross_over_gbp || 1), 4) }} />
            <b class="num" data-metric="fee_gross_under_gbp" data-value={h().fee_gross_under_gbp}>
              -{gbp2(h().fee_gross_under_gbp ?? 0)}
            </b>
          </div>
        </div>

        <p class="fee__punch">
          <span>
            NET
            <b class="num" data-metric="fee_net_variance_gbp" data-value={h().fee_net_variance_gbp}>
              {gbpSigned(h().fee_net_variance_gbp ?? 0)}
            </b>
            <small>what the variance report shows</small>
          </span>
          <span>
            GROSS
            <b class="num" data-metric="fee_gross_total_gbp" data-value={h().fee_gross_total_gbp}>
              {gbp2(h().fee_gross_total_gbp ?? 0)}
            </b>
            <small>what is actually wrong</small>
          </span>
          <span>
            ROWS
            <b class="num" data-metric="fee_rows_wrong" data-value={h().fee_rows_wrong}>
              {int(h().fee_rows_wrong ?? 0)}
            </b>
            <small>of 1,500 break the rule</small> {/* prose-number-ok: I6 - 1,500 is `transactions` in the provenance strip */}
          </span>
        </p>

        <ul class="fee__types">
          <For each={ranked()}>
            {(f) => (
              <li>
                <span class="fee__tname">
                  {f.type_name} <small>{f.channel} · typical {gbp2(f.typical_fee_gbp)}</small>
                </span>
                <span class="fee__track">
                  <i class="fee__seg fee__seg--under"
                     style={{ width: pct(f.under_gbp / max(), 3) }} />
                  <i class="fee__seg fee__seg--over"
                     style={{ width: pct(f.over_gbp / max(), 3) }} />
                </span>
                <b class="num">{gbp2(f.gross_variance_gbp)}</b>
              </li>
            )}
          </For>
        </ul>
        <p class="cap">
          `Transfer - International` collects{" "}
          {/* prose-number-ok: I6 - every one of these is a row of fact_fee_variance, rendered
              in full in the accessible table above and tagged in aggregate as
              fee_gross_total_gbp. There is no single DOM home for a per-type figure. */}
          {/* prose-number-ok: I6 */} £100.39 of £500.00 due, while eight types whose typical fee is £0.00 collect £524.40
          between them. It varies <em>within</em> a customer - as does the FX rule - so unlike
          the rates it is not pinned to n = 20. It is not free of the clustering either: the
          fee-wrong indicator has ICC{" "}
          {/* data-value carries full precision so metric_checks.yml's SQL can verify it;
              the TEXT is rounded here. Quantise once, at the point of display - the first
              pass shipped "ICC 0.6510666952343056" to the poster and every harness passed. */}
          <b class="num" data-metric="fee_icc" data-value={h().fee_icc}>
            {(h().fee_icc ?? 0).toFixed(2)}
          </b>, a design effect of{" "}
          <b class="num" data-metric="fee_design_effect" data-value={h().fee_design_effect}>
            {(h().fee_design_effect ?? 0).toFixed(1)}
          </b>{" "}
          and an effective{" "}
          <b class="num" data-metric="fee_effective_n" data-value={h().fee_effective_n}>
            n = {(h().fee_effective_n ?? 0).toFixed(1)}
          </b>. That is still the largest effective sample in the file, and it is the reason a
          net-variance control cannot see it. <b>Monitor gross absolute deviation.</b>
        </p>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑦  The dictionary, scored
// =========================================================================================

export function Scorecard(props: { claims: Claim[]; headline: Record<string, any> }) {
  const h = () => props.headline;
  const bad = (v: string) => v !== "TRUE";
  return (
    <ChartFigure
      id="scorecard"
      caption={`The archive data dictionary, scored: ${h().claims_false} of ${h().claims_tested} claims do not hold.`}
      columns={["#", "Claim", "Verdict", "Evidence"]}
      rows={props.claims.map((c) => [c.n, c.claim, c.verdict, c.evidence])}
    >
      <ul class="score">
        <For each={props.claims}>
          {(c) => (
            <li classList={{ "score--bad": bad(c.verdict) }}>
              <span class="score__mark" aria-hidden="true">{bad(c.verdict) ? "✗" : "✓"}</span>
              <span class="score__claim">{c.claim}</span>
              <span class="score__verdict">{c.verdict}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="cap">
        <b class="num" data-metric="claims_false" data-value={h().claims_false}>{h().claims_false}</b>
        {" "}of{" "}
        <b class="num" data-metric="claims_tested" data-value={h().claims_tested}>{h().claims_tested}</b>
        {" "}fail. Full evidence for each is in the screen-reader table above and in
        `analysis/integrity.py`, which tests 24 claims in total.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// web-only
// =========================================================================================

export function FeeScatter(props: { rows: FeeRow[] }) {
  const W = 560, H = 300, PAD = 40;
  const maxV = () => Math.max(...props.rows.map((r) => Math.max(r.fee_charged_gbp, r.typical_fee_gbp)), 3);
  const x = (v: number) => PAD + (v / maxV()) * (W - PAD * 1.4);
  const y = (v: number) => H - PAD - (v / maxV()) * (H - PAD * 1.6);
  const sample = createMemo(() => props.rows);

  return (
    <ChartFigure
      id="feescatter"
      caption="Every point off the diagonal is a fee on the wrong side of the rule."
      columns={["Verdict", "Rows"]}
      rows={[
        ["correct", props.rows.filter((r) => r.fee_verdict === "correct").length],
        ["over-charged", props.rows.filter((r) => r.fee_verdict === "over-charged").length],
        ["under-charged", props.rows.filter((r) => r.fee_verdict === "under-charged").length],
      ]}
    >
      <svg class="scatter" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        /* prose-number-ok: I6 - the row count, tagged as `transactions` */
        aria-label="Scatter of fee charged against typical fee for all 1,500 transactions. Points on the diagonal are correct; points above it are over-charged and points below are under-charged.">
        <line class="scatter__diag" x1={x(0)} y1={y(0)} x2={x(maxV())} y2={y(maxV())} />
        <For each={sample()}>
          {(r) => (
            <circle
              class="scatter__pt"
              classList={{
                "scatter__pt--over": r.fee_verdict === "over-charged",
                "scatter__pt--under": r.fee_verdict === "under-charged",
              }}
              cx={x(r.typical_fee_gbp)} cy={y(r.fee_charged_gbp)} r={2.2}
            />
          )}
        </For>
        <text class="scatter__ax" x={W / 2} y={H - 8} text-anchor="middle">typical fee (£)</text>
        <text class="scatter__ax" x={12} y={H / 2} text-anchor="middle"
              transform={`rotate(-90 12 ${H / 2})`}>fee charged (£)</text>
      </svg>
      <p class="cap">
        {/* prose-number-ok: I6 - the row count and the four values typical_fee_gbp takes,
            both readable from fact_fee_variance in the table above */}
        {/* prose-number-ok: I6 */} All 1,500 transactions plotted. The diagonal is the rule. Points sit in vertical stacks
        because `typical_fee_gbp` takes only four values (£0.00, £1.00, £1.50, £2.50).
      </p>
    </ChartFigure>
  );
}

export function CustomerTable(props: {
  customers: Customer[]; onPick?: (id: number) => void;
  active?: (id: number) => boolean;
}) {
  const ranked = createMemo(() =>
    props.customers.slice().sort((a, b) => b.total_value_gbp - a.total_value_gbp));
  return (
    <ChartFigure
      id="customers"
      caption="This is the entire dataset. Twenty rows."
      columns={["Customer", "Segment", "Region", "KYC", "Status", "Fraud", "Mean amount", "Total value", "Fees"]}
      rows={ranked().map((c) => [
        c.customer_name, c.customer_segment, c.region, c.kyc_verified ? "yes" : "no",
        c.transaction_status, c.is_flagged_fraud ? "flagged" : "-",
        gbp2(c.mean_amount_gbp), gbpCompact(c.total_value_gbp), gbp2(c.fees_paid_gbp),
      ])}
    >
      <div class="ctable-wrap" tabindex="0" role="region"
           aria-label="All twenty customers, scrollable">
        <table class="ctable">
          <caption class="sr-only">All twenty customers</caption>
          <thead>
            <tr>
              <th scope="col">Customer</th><th scope="col">Segment</th><th scope="col">Region</th>
              <th scope="col">KYC</th><th scope="col">Status</th><th scope="col">Value</th>
              <th scope="col">Fees</th>
            </tr>
          </thead>
          <tbody>
            <For each={ranked()}>
              {(c) => (
                <tr classList={{ "ctable--on": props.active?.(c.customer_id) }}>
                  <th scope="row">
                    <button type="button" class="ctable__pick"
                            aria-pressed={props.active?.(c.customer_id) ?? false}
                            onClick={() => props.onPick?.(c.customer_id)}>
                      {c.customer_name}{c.is_flagged_fraud ? " †" : ""}
                    </button>
                  </th>
                  <td>{c.customer_segment}</td>
                  <td>{c.region}</td>
                  <td>{c.kyc_verified ? "yes" : "no"}</td>
                  <td>{c.transaction_status}</td>
                  <td class="num">{gbpCompact(c.total_value_gbp)}</td>
                  <td class="num">{gbp2(c.fees_paid_gbp)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </ChartFigure>
  );
}

export function RegionPanel(props: { regions: any[] }) {
  const max = () => Math.max(...props.regions.map((r) => r.customers), 1);
  return (
    <ChartFigure
      id="regions"
      /* prose-number-ok: I-region (.workbench/2026/06/analysis/questions.md 12) - 0% and 100% are the only rates a
         one-customer region can take; it is arithmetic, not a measurement. */
      caption="Five of the ten UK regions hold exactly one customer, so a regional rate is 0% or 100%."
      columns={["Region", "Customers", "Flagged", "Value"]}
      rows={props.regions.map((r) => [r.region, r.customers, r.flagged, gbpCompact(r.value_gbp)])}
    >
      <ul class="regions">
        <For each={props.regions}>
          {(r) => (
            <li classList={{ "regions--thin": r.customers === 1 }}>
              <span class="regions__name">{r.region}</span>
              <span class="regions__track">
                <For each={Array.from({ length: r.customers })}>
                  {() => <i />}
                </For>
              </span>
              <b class="num">{r.customers}</b>
            </li>
          )}
        </For>
      </ul>
      <p class="cap">
        One dot per customer. Regions with a single dot cannot produce a rate - the brief asks
        which regions concentrate fraud, and half of them have a sample size of one.
      </p>
    </ChartFigure>
  );
}
