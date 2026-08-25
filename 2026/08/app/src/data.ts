import { createSignal } from "solid-js";

export type Filter = { field: string; values: (string | number)[] };
export type Topic =
  | "controls"
  | "status"
  | "finance"
  | "validation"
  | "positive-control"
  | "lead"
  | "claims";

export type EvidenceRow = { topic: Topic; id: string; [key: string]: unknown };

export type Headline = {
  title: string;
  transactions: number;
  used_workers: number;
  markets: number;
  channels: number;
  date_start: string;
  date_end: string;
  main_effect_tests: number;
  main_effect_survivors: number;
  max_main_cramers_v: number;
  interaction_tests: number;
  interaction_survivors: number;
  max_abs_continuous_r: number;
  positive_control_rows: number;
  claims_confirmed: number;
  claims_rejected: number;
  open_leads: number;
  cashout_month_end_reversal_rate: number;
  cashout_other_reversal_rate: number;
  cashout_month_end_reversal_diff_pp: number;
  cashout_month_end_reversal_ci_low_pp: number;
  cashout_month_end_reversal_ci_high_pp: number;
  cashout_month_end_reversal_p: number;
  cashout_month_end_n: number;
  reversal_phi: number;
  dispute_phi: number;
  loss_amount_r: number;
  loss_exceeds_amount_rows: number;
  validation_checks_passed: number;
  configured_relationships: number;
  missing_relationships: number;
  configured_constraints: number;
  matching_constraint_names: number;
};

export type Connector = {
  order: number;
  connector_id: string;
  from_node: string;
  to_node: string;
  status: "BROKEN" | "CONNECTED" | "OPEN";
  label: string;
  primary_value: number;
  primary_unit: string;
  primary_display: string;
  secondary_display: string;
  evidence: string;
  decision: string;
};

export type Claim = {
  order: number;
  claim_id: string;
  claim: string;
  observed: string;
  verdict: "REJECTED" | "OPEN";
  effect: number;
  effect_unit: string;
  effect_pp: number | null;
  ci_low_pp: number | null;
  ci_high_pp: number | null;
  p_value: number | null;
  sample_n: number;
  decision: string;
};

export type Control = {
  order: number;
  control_id: string;
  label: string;
  source_table: string;
  source_field: string;
  target: string;
  metric: string;
  statistic: number;
  abs_statistic: number;
  p_value: number;
  is_robust: boolean;
};

export type StatusAlignment = {
  order: number;
  event: string;
  outcome_label: string;
  event_flag: string;
  phi: number;
  p_value: number;
  agreement: number;
  verdict: string;
};

export type MonthEndCashout = {
  is_month_end: boolean;
  period: string;
  transactions: number;
  reversed: number;
  reversal_rate: number;
};

export type Defect = {
  order: number;
  defect_id: string;
  title: string;
  evidence: string;
  boundary: string;
};

export type ExposureBin = {
  amount_bin: number;
  loss_bin: number;
  above_identity: boolean;
  transactions: number;
  amount_mid: number;
  loss_mid: number;
};

export type Contract = {
  order: number;
  contract_id: string;
  kind: "constraint" | "relationship";
  name: string;
  status: "MISSING" | "AVAILABLE";
  from_table: string;
  from_column: string;
  to_table: string | null;
  to_column: string | null;
  detail: string;
};

const TOPICS: Record<string, Topic> = {
  controls_to_flags: "controls",
  flags_to_outcomes: "status",
  exposure_to_loss: "finance",
  validator_to_files: "validation",
  fraud_flag_to_loss_presence: "positive-control",
  month_end_cashout_to_reversal: "lead",
};
const TOPIC_VALUES = new Set<Topic>([...Object.values(TOPICS), "claims"]);

const [headlineState, setHeadline] = createSignal<Headline | null>(null);
const [connectorState, setConnectors] = createSignal<Connector[]>([]);
const [claimState, setClaims] = createSignal<Claim[]>([]);
const [controlState, setControls] = createSignal<Control[]>([]);
const [statusState, setStatus] = createSignal<StatusAlignment[]>([]);
const [leadState, setLead] = createSignal<MonthEndCashout[]>([]);
const [defectState, setDefects] = createSignal<Defect[]>([]);
const [exposureState, setExposure] = createSignal<ExposureBin[]>([]);
const [contractState, setContracts] = createSignal<Contract[]>([]);
export const [ready, setReady] = createSignal(false);

export const headline = headlineState;
export const connectors = connectorState;
export const claims = claimState;
export const controls = controlState;
export const statusAlignment = statusState;
export const monthEndCashout = leadState;
export const defects = defectState;
export const exposureBins = exposureState;
export const contracts = contractState;

const base = import.meta.env.BASE_URL || "/";

async function get<T>(name: string): Promise<T> {
  const response = await fetch(`${base}data/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`);
  return (await response.json()) as T;
}

export async function boot() {
  const [
    h,
    connectorRows,
    claimRows,
    controlRows,
    statusRows,
    leadRows,
    defectRows,
    exposureRows,
    contractRows,
  ] = await Promise.all([
    get<Headline>("headline.json"),
    get<Connector[]>("connectors.json"),
    get<Claim[]>("claims.json"),
    get<Control[]>("controls.json"),
    get<StatusAlignment[]>("status_alignment.json"),
    get<MonthEndCashout[]>("month_end_cashout.json"),
    get<Defect[]>("defects.json"),
    get<ExposureBin[]>("exposure_bins.json"),
    get<Contract[]>("contracts.json"),
  ]);
  setHeadline(h);
  setConnectors(connectorRows);
  setClaims(claimRows);
  setControls(controlRows);
  setStatus(statusRows);
  setLead(leadRows);
  setDefects(defectRows);
  setExposure(exposureRows);
  setContracts(contractRows);
  setReady(true);
}

export function topicForConnector(connectorId: string): Topic {
  return TOPICS[connectorId] ?? "claims";
}

export function activeTopic(filters: Filter[]): Topic | null {
  const topic = filters.find((filter) => filter.field === "topic")?.values[0];
  return typeof topic === "string" && TOPIC_VALUES.has(topic as Topic)
    ? (topic as Topic)
    : null;
}

export function filterByTopic<T extends EvidenceRow>(rows: T[], filters: Filter[]): T[] {
  const topic = activeTopic(filters);
  return topic ? rows.filter((row) => row.topic === topic) : rows;
}

const P_FLOOR = 0.001;
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const int = (value: number) => integer.format(Math.round(value));
export const decimal = (value: number, digits = 3) => value.toFixed(digits);
export const percent = (value: number, digits = 2) => `${(100 * value).toFixed(digits)}%`;
export const pp = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}pp`;
export const signed = (value: number, digits = 5) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
export const pvalue = (value: number) =>
  value < P_FLOOR ? `<${P_FLOOR.toFixed(3)}` : value.toFixed(3);
