import { describe, expect, it } from "vitest";
import {
  activeTopic,
  filterByTopic,
  pp,
  pvalue,
  topicForConnector,
  type EvidenceRow,
  type Filter,
} from "./data";

describe("topic cross-filter", () => {
  const rows: EvidenceRow[] = [
    { topic: "controls", id: "a" },
    { topic: "finance", id: "b" },
    { topic: "lead", id: "c" },
  ];

  it("keeps every row when no topic filter is active", () => {
    expect(filterByTopic(rows, [])).toEqual(rows);
  });

  it("returns only evidence for the active topic", () => {
    const filters: Filter[] = [{ field: "topic", values: ["finance"] }];
    expect(filterByTopic(rows, filters)).toEqual([{ topic: "finance", id: "b" }]);
    expect(activeTopic(filters)).toBe("finance");
  });

  it("ignores unrelated filter fields instead of emptying unsupported views", () => {
    const filters: Filter[] = [{ field: "control_id", values: ["velocity"] }];
    expect(filterByTopic(rows, filters)).toEqual(rows);
    expect(activeTopic(filters)).toBeNull();
  });

  it("treats an unknown deep-linked topic as an empty-state request", () => {
    const filters: Filter[] = [{ field: "topic", values: ["unknown"] }];
    expect(activeTopic(filters)).toBeNull();
    expect(filterByTopic(rows, filters)).toEqual(rows);
  });
});

describe("connector topics", () => {
  it("maps every signature connector to the shared evidence topic", () => {
    expect(topicForConnector("controls_to_flags")).toBe("controls");
    expect(topicForConnector("flags_to_outcomes")).toBe("status");
    expect(topicForConnector("exposure_to_loss")).toBe("finance");
    expect(topicForConnector("validator_to_files")).toBe("validation");
    expect(topicForConnector("fraud_flag_to_loss_presence")).toBe("positive-control");
    expect(topicForConnector("month_end_cashout_to_reversal")).toBe("lead");
  });
});

describe("evidence formatters", () => {
  it("prints signed percentage points without a double minus", () => {
    expect(pp(8.27518)).toBe("+8.28pp");
    expect(pp(-0.26415)).toBe("−0.26pp");
  });

  it("prints compact p-values", () => {
    expect(pvalue(0.057515)).toBe("0.058");
    expect(pvalue(0.00001)).toBe("<0.001");
  });
});
