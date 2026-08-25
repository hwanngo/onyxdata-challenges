import { For, Show, createMemo } from "solid-js";
import {
  ChartFigure,
  clearAll,
  drillInto,
  filters,
  isActive,
} from "@onyxdata/dna-kit";
import {
  activeTopic,
  int,
  percent,
  pp,
  pvalue,
  signed,
  type Claim,
  type Contract,
  type Control,
  type ExposureBin,
  type Filter,
  type Headline,
  type MonthEndCashout,
  type StatusAlignment,
  type Topic,
} from "../data";

const LEAD_MIN_PP = -5;
const LEAD_MAX_PP = 20;

function activate(topic: Topic) {
  if (isActive("topic", topic)) clearAll();
  else drillInto("topic", topic);
}

function onKey(event: KeyboardEvent, topic: Topic) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate(topic);
  }
}

function dimmed(topic: Topic) {
  const current = activeTopic(filters() as Filter[]);
  return Boolean(current && current !== topic);
}

export function ControlsPanel(props: { controls: Control[]; headline: Headline; poster?: boolean }) {
  const x = (value: number) => 278 + ((value + 0.01) / 0.02) * 260;
  return (
    <ChartFigure
      id="controls-panel"
      caption="Six controls. No calibrated signal."
      columns={["Control", "Point-biserial r", "p-value", "Robust"]}
      rows={props.controls.map((item) => [item.label, item.statistic, item.p_value, String(item.is_robust)])}
    >
      <svg class="support-svg" viewBox="0 0 600 260">
        <g
          role="button"
          tabindex={props.poster ? undefined : 0}
          aria-label={`No prespecified effects survived: ${props.headline.main_effect_survivors} of ${props.headline.main_effect_tests}. No exploratory interactions survived: ${props.headline.interaction_survivors} of ${props.headline.interaction_tests}.`}
          aria-pressed={isActive("topic", "controls")}
          onClick={() => !props.poster && activate("controls")}
          onKeyDown={(event) => !props.poster && onKey(event, "controls")}
          classList={{ "is-dimmed": dimmed("controls") }}
        >
          <text x="24" y="36" class="support__label">MAIN EFFECTS</text>
          <rect x="160" y="18" width="366" height="24" rx="3" class="zero-bar" />
          <text x="542" y="37" text-anchor="end" class="support__stat">
            <tspan data-metric="main_effect_survivors" data-value={props.headline.main_effect_survivors}>
              {props.headline.main_effect_survivors}
            </tspan>
            {" / "}
            <tspan data-metric="main_effect_tests" data-value={props.headline.main_effect_tests}>
              {props.headline.main_effect_tests}
            </tspan>
          </text>
          <text x="24" y="76" class="support__label">INTERACTIONS</text>
          <rect x="160" y="58" width="366" height="24" rx="3" class="zero-bar" />
          <text x="542" y="77" text-anchor="end" class="support__stat">
            <tspan data-metric="interaction_survivors" data-value={props.headline.interaction_survivors}>
              {props.headline.interaction_survivors}
            </tspan>
            {" / "}
            <tspan data-metric="interaction_tests" data-value={props.headline.interaction_tests}>
              {props.headline.interaction_tests}
            </tspan>
          </text>
        </g>

        <line x1="278" y1="112" x2="538" y2="112" class="axis" />
        <line x1={x(0)} y1="104" x2={x(0)} y2="236" class="zero" />
        <text x="278" y="102" class="axis__label">−.01</text>
        <text x={x(0)} y="102" text-anchor="middle" class="axis__label">0</text>
        <text x="538" y="102" text-anchor="end" class="axis__label">+.01</text>
        <For each={props.controls}>
          {(item, index) => (
            <g
              role="button"
              tabindex={props.poster ? undefined : 0}
              aria-label={`${item.label}: r ${signed(item.statistic)}, p ${pvalue(item.p_value)}, not robust`}
              aria-pressed={isActive("topic", "controls")}
              onClick={() => !props.poster && activate("controls")}
              onKeyDown={(event) => !props.poster && onKey(event, "controls")}
              classList={{ "is-dimmed": dimmed("controls") }}
              data-metric={`control.${item.control_id}.r`}
              data-value={item.statistic}
            >
              <text x="24" y={132 + index() * 19} class="support__rowlabel">{item.label}</text>
              <line x1={x(0)} y1={127 + index() * 19} x2={x(item.statistic)} y2={127 + index() * 19} class="stem" />
              <circle cx={x(item.statistic)} cy={127 + index() * 19} r="5" class="dot dot--trace" />
              <text x="570" y={132 + index() * 19} text-anchor="end" class="support__value">{signed(item.statistic)}</text>
            </g>
          )}
        </For>
      </svg>
    </ChartFigure>
  );
}

export function StatusPanel(props: { rows: StatusAlignment[]; poster?: boolean }) {
  const x = (value: number) => 280 + ((value + 0.01) / 0.02) * 250;
  return (
    <ChartFigure
      id="status-panel"
      caption="Flags and outcomes agree at chance."
      columns={["Event", "Phi", "p-value", "Agreement"]}
      rows={props.rows.map((row) => [row.event, row.phi, row.p_value, row.agreement])}
    >
      <svg class="support-svg" viewBox="0 0 600 260">
        <line x1="280" y1="50" x2="530" y2="50" class="axis" />
        <line x1={x(0)} y1="38" x2={x(0)} y2="210" class="zero" />
        <text x="280" y="34" class="axis__label">−.01</text>
        <text x={x(0)} y="34" text-anchor="middle" class="axis__label">0</text>
        <text x="530" y="34" text-anchor="end" class="axis__label">+.01</text>
        <For each={props.rows}>
          {(row, index) => (
            <g
              role="button"
              tabindex={props.poster ? undefined : 0}
              aria-label={`${row.event}: phi ${signed(row.phi)}, p ${pvalue(row.p_value)}, agreement ${percent(row.agreement)}`}
              aria-pressed={isActive("topic", "status")}
              onClick={() => !props.poster && activate("status")}
              onKeyDown={(event) => !props.poster && onKey(event, "status")}
              classList={{ "is-dimmed": dimmed("status") }}
              data-metric={`status.${row.event.toLowerCase()}.phi`}
              data-value={row.phi}
            >
              <text x="28" y={101 + index() * 78} class="status__event">{row.event.toUpperCase()}</text>
              <line x1={x(0)} y1={92 + index() * 78} x2={x(row.phi)} y2={92 + index() * 78} class="stem" />
              <circle cx={x(row.phi)} cy={92 + index() * 78} r="8" class="dot dot--fault" />
              <text x="552" y={88 + index() * 78} text-anchor="end" class="support__stat">φ {row.phi.toFixed(5)}</text>
              <text
                x="552"
                y={111 + index() * 78}
                text-anchor="end"
                class="support__value"
              >
                <tspan
                  data-metric={`status.${row.event.toLowerCase()}.agreement`}
                  data-value={row.agreement}
                >
                  {percent(row.agreement)}
                </tspan>
                {" agreement · p "}
                <tspan
                  data-metric={`status.${row.event.toLowerCase()}.p`}
                  data-value={row.p_value}
                >
                  {pvalue(row.p_value)}
                </tspan>
              </text>
            </g>
          )}
        </For>
      </svg>
    </ChartFigure>
  );
}

export function ExposurePanel(props: {
  bins: ExposureBin[];
  headline: Headline;
  poster?: boolean;
}) {
  const max = createMemo(() => Math.max(...props.bins.map((bin) => bin.transactions), 1));
  const x = (value: number) => 68 + (value / 1000) * 440;
  const y = (value: number) => 230 - (value / 1000) * 190;
  const size = 440 / 16;
  return (
    <ChartFigure
      id="exposure-panel"
      caption={`Recorded loss exceeds exposure on ${int(props.headline.loss_exceeds_amount_rows)} flagged rows.`}
      columns={["Amount midpoint", "Loss midpoint", "Above identity", "Transactions"]}
      rows={props.bins.map((bin) => [bin.amount_mid, bin.loss_mid, String(bin.above_identity), bin.transactions])}
    >
      <svg class="support-svg" viewBox="0 0 600 260">
        <defs>
          <pattern id="overflow-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" class="hatch-line" />
          </pattern>
        </defs>
        <For each={props.bins}>
          {(bin) => (
            <rect
              x={x(bin.amount_mid) - size / 2}
              y={y(bin.loss_mid) - size / 2}
              width={size - 1.5}
              height={size - 1.5}
              class={bin.above_identity ? "bin bin--overflow" : "bin"}
              style={{ opacity: String(0.18 + 0.82 * Math.sqrt(bin.transactions / max())) }}
              aria-hidden="true"
            />
          )}
        </For>
        <line x1={x(0)} y1={y(0)} x2={x(1000)} y2={y(1000)} class="identity" />
        <path d={`M ${x(0)} ${y(0)} L ${x(1000)} ${y(1000)} L ${x(0)} ${y(1000)} Z`} fill="url(#overflow-hatch)" class="overflow-region" />
        <g
          role="button"
          tabindex={props.poster ? undefined : 0}
          aria-label={`${int(props.headline.loss_exceeds_amount_rows)} flagged rows have recorded loss greater than recorded amount. Correlation ${signed(props.headline.loss_amount_r)}.`}
          aria-pressed={isActive("topic", "finance")}
          onClick={() => !props.poster && activate("finance")}
          onKeyDown={(event) => !props.poster && onKey(event, "finance")}
          classList={{ "is-dimmed": dimmed("finance") }}
        >
          <rect x="314" y="48" width="212" height="52" rx="4" class="overflow-label" />
          <text
            x="420"
            y="72"
            text-anchor="middle"
            class="support__stat support__stat--fault"
            data-metric="loss_exceeds_amount_rows"
            data-value={props.headline.loss_exceeds_amount_rows}
          >
            {int(props.headline.loss_exceeds_amount_rows)} ABOVE y=x
          </text>
          <text
            x="420"
            y="91"
            text-anchor="middle"
            class="support__value"
            data-metric="loss_amount_r"
            data-value={props.headline.loss_amount_r}
          >
            loss vs amount r {signed(props.headline.loss_amount_r)}
          </text>
        </g>
        <text x="68" y="251" class="axis__label">RECORDED AMOUNT →</text>
        <text transform="translate(18 222) rotate(-90)" class="axis__label">RECORDED LOSS →</text>
        <text x="306" y="166" transform="rotate(-23 306 166)" class="identity__label">y = x</text>
      </svg>
    </ChartFigure>
  );
}

export function ValidatorPanel(props: {
  contracts: Contract[];
  headline: Headline;
  poster?: boolean;
}) {
  const constraints = createMemo(() => props.contracts.filter((item) => item.kind === "constraint"));
  const relationships = createMemo(() => props.contracts.filter((item) => item.kind === "relationship"));
  return (
    <ChartFigure
      id="validator-panel"
      caption="The validator passed a schema it did not test."
      columns={["Kind", "Contract", "Status", "Detail"]}
      rows={props.contracts.map((item) => [item.kind, item.name, item.status, item.detail])}
    >
      <svg class="support-svg" viewBox="0 0 600 260">
        <g
          role="button"
          tabindex={props.poster ? undefined : 0}
          aria-label={`${constraints().filter((item) => item.status === "MISSING").length} of ${constraints().length} constraint names do not match delivered columns`}
          aria-pressed={isActive("topic", "validation")}
          onClick={() => !props.poster && activate("validation")}
          onKeyDown={(event) => !props.poster && onKey(event, "validation")}
          classList={{ "is-dimmed": dimmed("validation") }}
        >
          <For each={constraints()}>
            {(item, index) => {
              const column = () => index() % 9;
              const row = () => Math.floor(index() / 9);
              return (
                <circle
                  cx={62 + column() * 35}
                  cy={38 + row() * 27}
                  r="8"
                  class="contact contact--missing"
                  aria-hidden="true"
                />
              );
            }}
          </For>
          <text x="365" y="67" class="support__stat support__stat--fault">
            <tspan data-metric="matching_constraint_names" data-value={props.headline.matching_constraint_names}>
              {props.headline.matching_constraint_names}
            </tspan>
            {" / "}
            <tspan data-metric="configured_constraints" data-value={props.headline.configured_constraints}>
              {props.headline.configured_constraints}
            </tspan>
            {" NAMES MATCH"}
          </text>
          <text x="365" y="91" class="support__value">all contacts open</text>
        </g>

        <g
          role="button"
          tabindex={props.poster ? undefined : 0}
          aria-label={`${props.headline.missing_relationships} of ${relationships().length} configured relationships require absent columns`}
          aria-pressed={isActive("topic", "validation")}
          onClick={() => !props.poster && activate("validation")}
          onKeyDown={(event) => !props.poster && onKey(event, "validation")}
          classList={{ "is-dimmed": dimmed("validation") }}
        >
          <For each={relationships()}>
            {(item, index) => (
              <g aria-hidden="true">
                <line x1={58 + index() * 51} y1="218" x2={94 + index() * 51} y2="218" class={item.status === "MISSING" ? "jumper jumper--broken" : "jumper jumper--good"} />
                <Show when={item.status === "MISSING"}>
                  <line x1={73 + index() * 51} y1="208" x2={82 + index() * 51} y2="228" class="jumper-break" />
                  <line x1={82 + index() * 51} y1="208" x2={73 + index() * 51} y2="228" class="jumper-break" />
                </Show>
              </g>
            )}
          </For>
          <text x="520" y="193" text-anchor="end" class="support__stat support__stat--fault">
            <tspan data-metric="missing_relationships" data-value={props.headline.missing_relationships}>
              {props.headline.missing_relationships}
            </tspan>
            {" / "}
            <tspan data-metric="configured_relationships" data-value={props.headline.configured_relationships}>
              {props.headline.configured_relationships}
            </tspan>
            {" ABSENT"}
          </text>
          <text x="520" y="236" text-anchor="end" class="support__value">
            {"supplied report: "}
            <tspan data-metric="validation_checks_passed" data-value={props.headline.validation_checks_passed}>
              {props.headline.validation_checks_passed}
            </tspan>
            {" / "}
            <tspan data-metric="configured_relationships" data-value={props.headline.configured_relationships}>
              {props.headline.configured_relationships}
            </tspan>
            {" passed"}
          </text>
        </g>
      </svg>
    </ChartFigure>
  );
}

export function OpenLead(props: {
  rows: MonthEndCashout[];
  headline: Headline;
  poster?: boolean;
}) {
  const scale = (value: number) =>
    170 + ((value - LEAD_MIN_PP) / (LEAD_MAX_PP - LEAD_MIN_PP)) * 930;
  const monthEnd = () => props.rows.find((row) => row.is_month_end)!;
  const other = () => props.rows.find((row) => !row.is_month_end)!;
  return (
    <ChartFigure
      id="open-lead"
      caption={`${pp(props.headline.cashout_month_end_reversal_diff_pp)} is a confirmation target, not a control.`}
      columns={["Period", "Transactions", "Reversed", "Reversal rate"]}
      rows={props.rows.map((row) => [row.period, row.transactions, row.reversed, row.reversal_rate])}
    >
      <svg class="lead-svg" viewBox="0 0 1280 120">
        <line x1={scale(0)} y1="17" x2={scale(0)} y2="106" class="zero zero--lead" />
        <line
          x1={scale(props.headline.cashout_month_end_reversal_ci_low_pp)}
          y1="61"
          x2={scale(props.headline.cashout_month_end_reversal_ci_high_pp)}
          y2="61"
          class="lead-ci"
        />
        <line x1={scale(props.headline.cashout_month_end_reversal_ci_low_pp)} y1="49" x2={scale(props.headline.cashout_month_end_reversal_ci_low_pp)} y2="73" class="lead-cap" />
        <line x1={scale(props.headline.cashout_month_end_reversal_ci_high_pp)} y1="49" x2={scale(props.headline.cashout_month_end_reversal_ci_high_pp)} y2="73" class="lead-cap" />
        <g
          role="button"
          tabindex={props.poster ? undefined : 0}
          aria-label={`Month-end Cash-Out reversal is ${percent(monthEnd()?.reversal_rate ?? 0)} across ${monthEnd()?.transactions ?? 0} transactions versus ${percent(other()?.reversal_rate ?? 0)} otherwise. Difference ${pp(props.headline.cashout_month_end_reversal_diff_pp)}, confidence interval ${pp(props.headline.cashout_month_end_reversal_ci_low_pp)} to ${pp(props.headline.cashout_month_end_reversal_ci_high_pp)}, p ${pvalue(props.headline.cashout_month_end_reversal_p)}.`}
          aria-pressed={isActive("topic", "lead")}
          onClick={() => !props.poster && activate("lead")}
          onKeyDown={(event) => !props.poster && onKey(event, "lead")}
          classList={{ "is-dimmed": dimmed("lead") }}
        >
          <circle
            cx={scale(props.headline.cashout_month_end_reversal_diff_pp)}
            cy="61"
            r="12"
            class="lead-point"
            data-metric="cashout_month_end_reversal_diff_pp"
            data-value={props.headline.cashout_month_end_reversal_diff_pp}
          />
        </g>
        <text x="28" y="55" class="lead__title">MONTH-END CASH-OUT</text>
        <text x="28" y="79" class="lead__meta">
          <tspan data-metric="cashout_month_end_reversal_rate" data-value={monthEnd()?.reversal_rate ?? 0}>
            {percent(monthEnd()?.reversal_rate ?? 0)}
          </tspan>
          {" · n="}
          <tspan data-metric="cashout_month_end_n" data-value={monthEnd()?.transactions ?? 0}>
            {int(monthEnd()?.transactions ?? 0)}
          </tspan>
          {" vs "}
          <tspan data-metric="cashout_other_reversal_rate" data-value={other()?.reversal_rate ?? 0}>
            {percent(other()?.reversal_rate ?? 0)}
          </tspan>
        </text>
        <text x="1180" y="47" text-anchor="end" class="lead__stat">{pp(props.headline.cashout_month_end_reversal_diff_pp)}</text>
        <text x="1180" y="72" text-anchor="end" class="lead__meta">
          {"CI ["}
          <tspan data-metric="cashout_month_end_reversal_ci_low_pp" data-value={props.headline.cashout_month_end_reversal_ci_low_pp}>
            {pp(props.headline.cashout_month_end_reversal_ci_low_pp)}
          </tspan>
          {", "}
          <tspan data-metric="cashout_month_end_reversal_ci_high_pp" data-value={props.headline.cashout_month_end_reversal_ci_high_pp}>
            {pp(props.headline.cashout_month_end_reversal_ci_high_pp)}
          </tspan>
          {"] · p "}
          <tspan data-metric="cashout_month_end_reversal_p" data-value={props.headline.cashout_month_end_reversal_p}>
            {pvalue(props.headline.cashout_month_end_reversal_p)}
          </tspan>
        </text>
        <text x={scale(LEAD_MIN_PP)} y="111" class="axis__label">{pp(LEAD_MIN_PP, 0)}</text>
        <text x={scale(0)} y="111" text-anchor="middle" class="axis__label">0</text>
        <text x={scale(LEAD_MAX_PP)} y="111" text-anchor="end" class="axis__label">{pp(LEAD_MAX_PP, 0)}</text>
      </svg>
    </ChartFigure>
  );
}

function claimEffect(claim: Claim) {
  if (claim.effect_unit === "ratio") return `${claim.effect.toFixed(3)}×`;
  if (claim.effect_unit === "share") return percent(claim.effect);
  if (claim.effect_unit === "rank") return `rank ${Math.round(claim.effect)}`;
  if (claim.effect_unit === "absolute r") return `|r| ${claim.effect.toFixed(5)}`;
  return pp(claim.effect_pp ?? 100 * claim.effect);
}

export function ClaimScorecard(props: { claims: Claim[] }) {
  return (
    <div class="claim-scorecard">
      <h3>Six supplied findings</h3>
      <p class="drawer__intro">Five are rejected at their stated magnitude. One remains open.</p>
      <ol>
        <For each={props.claims}>
          {(claim) => (
            <li class={`claim claim--${claim.verdict.toLowerCase()}`}>
              <span class="claim__status">{claim.verdict}</span>
              <b>{claim.claim}</b>
              <span>
                <strong
                  data-metric={`claim.${claim.claim_id}.effect`}
                  data-value={claim.effect}
                >
                  {claimEffect(claim)}
                </strong>
                <Show when={claim.p_value !== null}>
                  {" · p "}
                  <span
                    data-metric={`claim.${claim.claim_id}.p`}
                    data-value={claim.p_value ?? 0}
                  >
                    {pvalue(claim.p_value ?? 0)}
                  </span>
                </Show>
              </span>
              <small>{claim.decision}</small>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

export function ContractList(props: { contracts: Contract[] }) {
  return (
    <div class="contract-list">
      <h3>Named validation contracts</h3>
      <table class="data">
        <thead>
          <tr><th>Kind</th><th>Contract</th><th>Status</th><th>Detail</th></tr>
        </thead>
        <tbody>
          <For each={props.contracts}>
            {(item) => (
              <tr>
                <td>{item.kind}</td>
                <td>{item.name}</td>
                <td><span class={`contract-status contract-status--${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{item.detail}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
