import { describe, expect, it } from "vitest";
import {
  applyAllocationFilters,
  decodeViewState,
  encodeViewState,
  rollupCorridors,
  summarizeAllocations,
  type AllocationRow,
  type Corridor,
  type ViewState,
} from "./data";

const allocations: AllocationRow[] = [
  {
    order_id: "o1",
    order_date: "2024-01-01",
    kitchen_id: "k1",
    zone_id: "z1",
    rider_id: "r1",
    time_slot_id: "s1",
  },
  {
    order_id: "o2",
    order_date: "2024-01-02",
    kitchen_id: "k1",
    zone_id: "z2",
    rider_id: "r2",
    time_slot_id: "s2",
  },
  {
    order_id: "o3",
    order_date: "2023-12-31",
    kitchen_id: "k2",
    zone_id: "z1",
    rider_id: "r1",
    time_slot_id: "s1",
  },
];

const corridors: Corridor[] = [
  {
    kitchen_id: "k1",
    kitchen_name: "Kitchen One",
    zone_id: "z1",
    zone_name: "Zone One",
    zone_tier: "Core",
    order_rows: 1,
    allocation_share: 1 / 3,
    corridor_rank_within_kitchen: 1,
  },
  {
    kitchen_id: "k1",
    kitchen_name: "Kitchen One",
    zone_id: "z2",
    zone_name: "Zone Two",
    zone_tier: "Outer",
    order_rows: 1,
    allocation_share: 1 / 3,
    corridor_rank_within_kitchen: 1,
  },
  {
    kitchen_id: "k2",
    kitchen_name: "Kitchen Two",
    zone_id: "z1",
    zone_name: "Zone One",
    zone_tier: "Core",
    order_rows: 1,
    allocation_share: 1 / 3,
    corridor_rank_within_kitchen: 1,
  },
];

describe("allocation filtering", () => {
  it("intersects stable-ID and month filters", () => {
    const filtered = applyAllocationFilters(allocations, [
      { field: "kitchen_id", values: ["k1"] },
      { field: "year_month", values: ["2024-01"] },
    ]);
    expect(filtered.map((row) => row.order_id)).toEqual(["o1", "o2"]);
  });

  it("keeps the complete corridor grid while recomputing selected counts", () => {
    const filtered = applyAllocationFilters(allocations, [
      { field: "rider_id", values: ["r2"] },
    ]);
    const rolled = rollupCorridors(filtered, corridors);

    expect(rolled).toHaveLength(3);
    expect(rolled.find((row) => row.kitchen_id === "k1" && row.zone_id === "z2")).toMatchObject({
      filtered_order_rows: 1,
      filtered_share: 1,
    });
    expect(rolled.find((row) => row.kitchen_id === "k2" && row.zone_id === "z1")).toMatchObject({
      filtered_order_rows: 0,
      filtered_share: 0,
    });
  });

  it("summarizes only safe allocation dimensions", () => {
    expect(summarizeAllocations(allocations)).toEqual({
      orderRows: 3,
      kitchens: 2,
      zones: 2,
      riders: 2,
      timeSlots: 2,
      kitchenZonePairs: 3,
      kitchenRiderPairs: 3,
      kitchenSlotPairs: 3,
    });
  });
});

describe("shareable view state", () => {
  it("round-trips filters and evidence focus", () => {
    const state: ViewState = {
      filters: [{ field: "zone_id", values: ["z1"] }],
      focus: { kind: "corridor", id: "k1|z1" },
    };
    expect(decodeViewState(`?${encodeViewState(state)}`)).toEqual(state);
  });

  it("fails closed on malformed URL state", () => {
    expect(decodeViewState("?f=%7Bnot-json&focus=unknown")).toEqual({
      filters: [],
      focus: null,
    });
  });
});
