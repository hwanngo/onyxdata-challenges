export type AllocationRow = {
  order_id: string;
  order_date: string;
  kitchen_id: string;
  zone_id: string;
  rider_id: string;
  time_slot_id: string;
};

export type Corridor = {
  kitchen_id: string;
  kitchen_name: string;
  zone_id: string;
  zone_name: string;
  zone_tier: string;
  order_rows: number;
  allocation_share: number;
  corridor_rank_within_kitchen: number;
};

export type RolledCorridor = Corridor & {
  filtered_order_rows: number;
  filtered_share: number;
};

export type Headline = {
  title: string;
  order_rows: number;
  calendar_dates: number;
  kitchens: number;
  zones: number;
  riders: number;
  time_slots: number;
  kitchen_zone_pairs: number;
  kitchen_rider_pairs: number;
  kitchen_slot_pairs: number;
  largest_corridor_rows: number;
  largest_corridor_share: number;
  rider_base_mismatches: number;
  quarantined_measures: number;
  pairwise_measure_tests: number;
  process_links_surviving_correction: number;
  max_abs_pairwise_r: number;
  supplied_claims_confirmed: number;
  supplied_claims_failed: number;
  validation_checks_passed: number;
  configured_constraints: number;
  matching_constraints: number;
  configured_relationships: number;
  unavailable_relationships: number;
  invalid_relationships: number;
};

export type ProcessLink = {
  sequence: number;
  link_id: string;
  source_measure: string;
  target_measure: string;
  correlation_r: number;
  abs_correlation_r: number;
  p_value: number;
  corrected_alpha: number;
  survives_correction: boolean;
  status: "connected" | "disconnected";
  decision: string;
};

export type Claim = {
  sequence: number;
  claim_id: string;
  claim: string;
  sample_n: number;
  observed_value: number;
  claimed_value: number | null;
  value_unit: string;
  observed: string;
  verdict: "REJECTED" | "UNSUPPORTED" | "CONFIRMED";
  decision: string;
};

export type MeasureContract = {
  source_field: string;
  curated_field: string;
  semantic_status: "quarantined";
  safe_use: string;
  reason: string;
};

export type SourceContract = {
  sequence: number;
  contract_id: string;
  kind: "constraint" | "relationship";
  status: "MISSING" | "INVALID" | "AVAILABLE" | "MATCH";
  from_table: string;
  from_column: string;
  to_table: string | null;
  to_column: string | null;
  detail: string;
};

export type CollectionRequirement = {
  sequence: number;
  requirement_id: string;
  requirement: string;
  blocks: string;
  status: "MISSING";
};

export type DataBundle = {
  allocations: AllocationRow[];
  headline: Headline;
  corridors: Corridor[];
  processLinks: ProcessLink[];
  claims: Claim[];
  measureContracts: MeasureContract[];
  contracts: SourceContract[];
  collectionRequirements: CollectionRequirement[];
};

export type FilterField = "kitchen_id" | "zone_id" | "rider_id" | "year_month";
export type Filter = { field: FilterField; values: string[] };
export type FocusKind = "corridor" | "measure" | "link" | "claim" | "contract" | "decision";
export type Focus = { kind: FocusKind; id: string };
export type ViewState = { filters: Filter[]; focus: Focus | null };

const FILTER_FIELDS = new Set<FilterField>([
  "kitchen_id",
  "zone_id",
  "rider_id",
  "year_month",
]);
const FOCUS_KINDS = new Set<FocusKind>([
  "corridor",
  "measure",
  "link",
  "claim",
  "contract",
  "decision",
]);

function filterValue(row: AllocationRow, field: FilterField): string {
  return field === "year_month" ? row.order_date.slice(0, 7) : row[field];
}

export function applyAllocationFilters(rows: AllocationRow[], filters: Filter[]): AllocationRow[] {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((filter) => filter.values.includes(filterValue(row, filter.field))),
  );
}

export function summarizeAllocations(rows: AllocationRow[]) {
  const pairs = (left: keyof AllocationRow, right: keyof AllocationRow) =>
    new Set(rows.map((row) => `${row[left]}|${row[right]}`)).size;
  return {
    orderRows: rows.length,
    kitchens: new Set(rows.map((row) => row.kitchen_id)).size,
    zones: new Set(rows.map((row) => row.zone_id)).size,
    riders: new Set(rows.map((row) => row.rider_id)).size,
    timeSlots: new Set(rows.map((row) => row.time_slot_id)).size,
    kitchenZonePairs: pairs("kitchen_id", "zone_id"),
    kitchenRiderPairs: pairs("kitchen_id", "rider_id"),
    kitchenSlotPairs: pairs("kitchen_id", "time_slot_id"),
  };
}

export function rollupCorridors(
  rows: AllocationRow[],
  corridorMeta: Corridor[],
): RolledCorridor[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.kitchen_id}|${row.zone_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const denominator = rows.length;
  return corridorMeta.map((corridor) => {
    const filteredOrderRows = counts.get(`${corridor.kitchen_id}|${corridor.zone_id}`) ?? 0;
    return {
      ...corridor,
      filtered_order_rows: filteredOrderRows,
      filtered_share: denominator ? filteredOrderRows / denominator : 0,
    };
  });
}

export function filterOptions(rows: AllocationRow[], field: FilterField): string[] {
  return [...new Set(rows.map((row) => filterValue(row, field)))].sort();
}

function validFilters(value: unknown): Filter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { field?: unknown; values?: unknown };
    if (
      typeof candidate.field !== "string" ||
      !FILTER_FIELDS.has(candidate.field as FilterField) ||
      !Array.isArray(candidate.values) ||
      !candidate.values.every((entry) => typeof entry === "string")
    ) {
      return [];
    }
    return [
      {
        field: candidate.field as FilterField,
        values: [...new Set(candidate.values as string[])],
      },
    ];
  });
}

export function encodeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.filters.length) params.set("f", JSON.stringify(state.filters));
  if (state.focus) params.set("focus", `${state.focus.kind}:${state.focus.id}`);
  return params.toString();
}

export function decodeViewState(search: string): ViewState {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const filters = params.has("f") ? validFilters(JSON.parse(params.get("f") ?? "[]")) : [];
    const rawFocus = params.get("focus");
    if (!rawFocus) return { filters, focus: null };
    const separator = rawFocus.indexOf(":");
    if (separator <= 0) return { filters: [], focus: null };
    const kind = rawFocus.slice(0, separator) as FocusKind;
    const id = rawFocus.slice(separator + 1);
    if (!FOCUS_KINDS.has(kind) || !id) return { filters: [], focus: null };
    return { filters, focus: { kind, id } };
  } catch {
    return { filters: [], focus: null };
  }
}

async function fetchJson<T>(base: string, file: string): Promise<T> {
  const response = await fetch(`${base}data/${file}`);
  if (!response.ok) throw new Error(`${file} failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function loadBundle(base = import.meta.env.BASE_URL || "/"): Promise<DataBundle> {
  const [
    allocations,
    headline,
    corridors,
    processLinks,
    claims,
    measureContracts,
    contracts,
    collectionRequirements,
  ] = await Promise.all([
    fetchJson<AllocationRow[]>(base, "allocations.json"),
    fetchJson<Headline>(base, "headline.json"),
    fetchJson<Corridor[]>(base, "corridors.json"),
    fetchJson<ProcessLink[]>(base, "process_links.json"),
    fetchJson<Claim[]>(base, "claims.json"),
    fetchJson<MeasureContract[]>(base, "measure_contracts.json"),
    fetchJson<SourceContract[]>(base, "contracts.json"),
    fetchJson<CollectionRequirement[]>(base, "collection_requirements.json"),
  ]);
  return {
    allocations,
    headline,
    corridors,
    processLinks,
    claims,
    measureContracts,
    contracts,
    collectionRequirements,
  };
}

export const int = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));
export const pct = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`;
export const signed = (value: number, digits = 4) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;

export const measureLabel = (field: string) =>
  ({
    order_value_ngn: "Value",
    delivery_distance_km: "Distance",
    promised_delivery_min: "Promise",
    actual_delivery_min: "Actual",
    traffic_friction_score: "Traffic",
    food_temp_on_arrival_c: "Temperature",
    customer_rating: "Rating",
    delivery_cost_ngn: "Cost",
    order_profit_ngn: "Profit",
  })[field] ?? field.replaceAll("_", " ");
