import { For, Match, Show, Switch, createMemo } from "solid-js";
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
  signed,
  topicForConnector,
  type Connector,
  type Filter,
  type Headline,
  type Topic,
} from "../data";

const LANES = [
  { id: "controls_to_flags", y: 120 },
  { id: "flags_to_outcomes", y: 215 },
  { id: "exposure_to_loss", y: 310 },
  { id: "validator_to_files", y: 405 },
];

function activate(topic: Topic, connectorId: string) {
  if (isActive("topic", topic)) clearAll();
  else drillInto("topic", topic);
  const url = new URL(window.location.href);
  url.searchParams.set("focus", connectorId);
  window.history.replaceState({}, "", url);
}

function keyActivate(event: KeyboardEvent, topic: Topic, connectorId: string) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate(topic, connectorId);
  }
}

export function BrokenCircuit(props: { connectors: Connector[]; headline: Headline; poster?: boolean }) {
  const broken = createMemo(() =>
    LANES.map((lane) => ({
      ...lane,
      connector: props.connectors.find((item) => item.connector_id === lane.id)!,
    })).filter((item) => item.connector),
  );
  const positive = createMemo(() =>
    props.connectors.find((item) => item.connector_id === "fraud_flag_to_loss_presence"),
  );
  const selectedTopic = () => activeTopic(filters() as Filter[]) ?? undefined;

  return (
    <ChartFigure
      id="signature"
      caption="Four evidence connectors break between clean tables and a risk decision."
      columns={["Connector", "From", "To", "Status", "Primary evidence", "Secondary evidence"]}
      rows={props.connectors
        .filter((item) => item.connector_id !== "month_end_cashout_to_reversal")
        .map((item) => [
          item.connector_id,
          item.from_node,
          item.to_node,
          item.status,
          item.primary_display,
          item.secondary_display,
        ])}
    >
      <svg class="circuit" viewBox="0 0 1280 470" aria-hidden="false">
        <defs>
          <pattern id="fault-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" class="hatch-line" />
          </pattern>
        </defs>

        <Show when={positive()}>
          {(item) => (
            <g
              class="control-bus"
              role="button"
              tabindex={props.poster ? undefined : 0}
              aria-label={`${item().from_node} to ${item().to_node}: ${item().primary_display}, connected positive control`}
              aria-pressed={isActive("topic", "positive-control")}
              onClick={() => !props.poster && activate("positive-control", item().connector_id)}
              onKeyDown={(event) =>
                !props.poster && keyActivate(event, "positive-control", item().connector_id)
              }
              data-metric={`connector.${item().connector_id}.primary`}
              data-value={item().primary_value}
            >
              <rect x="36" y="18" width="1208" height="64" rx="10" class="control-bus__well" />
              <circle cx="86" cy="50" r="13" class="node node--good" />
              <line x1="104" y1="50" x2="1132" y2="50" class="trace trace--good" />
              <circle cx="1150" cy="50" r="13" class="node node--good" />
              <text x="124" y="43" class="circuit__label">POSITIVE CONTROL · FRAUD FLAG → POSITIVE LOSS PRESENCE</text>
              <text x="124" y="66" class="circuit__stat">
                <tspan data-metric="positive_control_rows" data-value={props.headline.positive_control_rows}>
                  {int(props.headline.positive_control_rows)}
                </tspan>
                {" of "}
                <tspan data-metric="transactions" data-value={props.headline.transactions}>
                  {int(props.headline.transactions)}
                </tspan>
                {" ALIGNED · the instrument is live"}
              </text>
              <text x="1205" y="58" text-anchor="end" class="circuit__status circuit__status--good">CONNECTED</text>
            </g>
          )}
        </Show>

        <For each={broken()}>
          {(lane, index) => {
            const item = () => lane.connector;
            const topic = () => topicForConnector(item().connector_id);
            const dimmed = () => selectedTopic() && selectedTopic() !== topic();
            return (
              <g
                class="circuit-lane"
                classList={{ "is-dimmed": Boolean(dimmed()), "is-active": selectedTopic() === topic() }}
                role="button"
                tabindex={props.poster ? undefined : 0}
                aria-label={`${item().from_node} to ${item().to_node}: broken. ${item().primary_display}. ${item().secondary_display}. ${item().decision}`}
                aria-pressed={isActive("topic", topic())}
                onClick={() => !props.poster && activate(topic(), item().connector_id)}
                onKeyDown={(event) =>
                  !props.poster && keyActivate(event, topic(), item().connector_id)
                }
                data-metric={`connector.${item().connector_id}.primary`}
                data-value={item().primary_value}
              >
                <text x="42" y={lane.y - 22} class="circuit__index">0{index() + 1}</text>
                <rect x="80" y={lane.y - 32} width="244" height="64" rx="5" class="module" />
                <text x="101" y={lane.y - 5} class="module__title">{item().from_node.toUpperCase()}</text>
                <text x="101" y={lane.y + 18} class="module__meta">SOURCE MODULE</text>

                <line x1="324" y1={lane.y} x2="566" y2={lane.y} class="trace trace--fault" />
                <rect x="566" y={lane.y - 12} width="18" height="24" class="terminal" />
                <rect x="618" y={lane.y - 12} width="18" height="24" class="terminal" />
                <rect x="586" y={lane.y - 18} width="30" height="36" fill="url(#fault-hatch)" class="break-gap" />
                <line x1="636" y1={lane.y} x2="904" y2={lane.y} class="trace trace--fault" />

                <rect x="904" y={lane.y - 32} width="332" height="64" rx="5" class="module" />
                <text x="925" y={lane.y - 5} class="module__title">{item().to_node.toUpperCase()}</text>
                <text x="925" y={lane.y + 18} class="module__meta">TARGET MODULE</text>

                <text x="601" y={lane.y - 25} text-anchor="middle" class="circuit__status circuit__status--fault">BROKEN</text>
                <Switch fallback={
                  <>
                    <text x="348" y={lane.y - 12} class="circuit__stat">{item().primary_display}</text>
                    <text x="660" y={lane.y - 12} class="circuit__stat">{item().secondary_display}</text>
                    <text x="660" y={lane.y + 24} class="circuit__evidence">{item().evidence}</text>
                  </>
                }>
                  <Match when={item().connector_id === "controls_to_flags"}>
                    <text x="348" y={lane.y - 12} class="circuit__stat">
                      <tspan data-metric="main_effect_survivors" data-value={props.headline.main_effect_survivors}>{props.headline.main_effect_survivors}</tspan>
                      {" of "}
                      <tspan data-metric="main_effect_tests" data-value={props.headline.main_effect_tests}>{props.headline.main_effect_tests}</tspan>
                    </text>
                    <text x="660" y={lane.y - 12} class="circuit__stat">
                      <tspan data-metric="interaction_survivors" data-value={props.headline.interaction_survivors}>{props.headline.interaction_survivors}</tspan>
                      {" of "}
                      <tspan data-metric="interaction_tests" data-value={props.headline.interaction_tests}>{props.headline.interaction_tests}</tspan>
                      {" interactions"}
                    </text>
                    <text x="660" y={lane.y + 24} class="circuit__evidence">
                      {"max |r| "}
                      <tspan data-metric="max_abs_continuous_r" data-value={props.headline.max_abs_continuous_r}>{props.headline.max_abs_continuous_r.toFixed(5)}</tspan>
                    </text>
                  </Match>
                  <Match when={item().connector_id === "flags_to_outcomes"}>
                    <text x="348" y={lane.y - 12} class="circuit__stat">
                      {"φ "}<tspan data-metric="reversal_phi" data-value={props.headline.reversal_phi}>{props.headline.reversal_phi.toFixed(5)}</tspan>
                    </text>
                    <text x="660" y={lane.y - 12} class="circuit__stat">
                      {"φ "}<tspan data-metric="dispute_phi" data-value={props.headline.dispute_phi}>{props.headline.dispute_phi.toFixed(5)}</tspan>
                    </text>
                    <text x="660" y={lane.y + 24} class="circuit__evidence">both agreement rates ≈ chance</text>
                  </Match>
                  <Match when={item().connector_id === "exposure_to_loss"}>
                    <text x="348" y={lane.y - 12} class="circuit__stat">
                      {"r "}<tspan data-metric="loss_amount_r" data-value={props.headline.loss_amount_r}>{signed(props.headline.loss_amount_r)}</tspan>
                    </text>
                    <text x="660" y={lane.y - 12} class="circuit__stat">
                      {"loss > amount on "}<tspan data-metric="loss_exceeds_amount_rows" data-value={props.headline.loss_exceeds_amount_rows}>{int(props.headline.loss_exceeds_amount_rows)}</tspan>{" rows"}
                    </text>
                    <text x="660" y={lane.y + 24} class="circuit__evidence">source loss is unbounded</text>
                  </Match>
                  <Match when={item().connector_id === "validator_to_files"}>
                    <text x="348" y={lane.y - 12} class="circuit__stat">
                      <tspan data-metric="matching_constraint_names" data-value={props.headline.matching_constraint_names}>{props.headline.matching_constraint_names}</tspan>{" of "}<tspan data-metric="configured_constraints" data-value={props.headline.configured_constraints}>{props.headline.configured_constraints}</tspan>
                    </text>
                    <text x="660" y={lane.y - 12} class="circuit__stat">
                      <tspan data-metric="missing_relationships" data-value={props.headline.missing_relationships}>{props.headline.missing_relationships}</tspan>{" of "}<tspan data-metric="configured_relationships" data-value={props.headline.configured_relationships}>{props.headline.configured_relationships}</tspan>{" relationships unavailable"}
                    </text>
                    <text x="660" y={lane.y + 24} class="circuit__evidence">
                      {"report says "}<tspan data-metric="validation_checks_passed" data-value={props.headline.validation_checks_passed}>{props.headline.validation_checks_passed}</tspan>{" of "}<tspan data-metric="configured_relationships" data-value={props.headline.configured_relationships}>{props.headline.configured_relationships}</tspan>{" passed"}
                    </text>
                  </Match>
                </Switch>
              </g>
            );
          }}
        </For>
      </svg>
    </ChartFigure>
  );
}
