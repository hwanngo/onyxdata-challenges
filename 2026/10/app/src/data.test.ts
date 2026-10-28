// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY,
  corr,
  costHalves,
  decodeViewState,
  encodeViewState,
  fmtP,
  fmtPct,
  linreg,
  marginRank,
  median,
  mid,
  regionRows,
  release,
  sd,
  selectedStoreIds,
  storeAggs,
  summarize,
  weekSummary,
  type Bundle,
  type WeekRow,
} from "./data";

// The real bundle the browser loads - pinned against figures computed independently in
// analysis/integrity.py (Python) and model/metric_checks.yml (DuckDB).
const dir = resolve(__dirname, "../public/data");
const load = (n: string) => JSON.parse(readFileSync(`${dir}/${n}.json`, "utf8"));
const bundle: Bundle = {
  stores: load("stores"),
  months: load("store_months"),
  week: load("week"),
  contract: load("contract"),
  evidence: load("evidence"),
};
const all = new Set(bundle.stores.map((s) => s.id));

describe("statistics", () => {
  it("sample sd, correlation and median", () => {
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5);
    expect(corr([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(corr([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("OLS slope and standard error", () => {
    const fit = linreg([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
    expect(fit.slope).toBeCloseTo(1.99, 10);
    expect(fit.intercept).toBeCloseTo(0.05, 10);
    expect(fit.se).toBeGreaterThan(0);
  });
});

describe("view state", () => {
  it("round-trips through the URL and drops invalid years and halves", () => {
    const v = { ...EMPTY, region: ["London", "Wales"], half: ["Lower-cost half"], year: [2024], store: 32 };
    expect(decodeViewState(`?${encodeViewState(v)}`)).toEqual(v);
    const bad = decodeViewState("?year=2019,2023&half=Middle&store=-4");
    expect(bad.year).toEqual([2023]);
    expect(bad.half).toEqual([]);
    expect(bad.store).toBeNull();
  });
  it("namespaces filter-dependent ids", () => {
    expect(mid("week.gap", false)).toBe("week.gap");
    expect(mid("week.gap", true)).toBe("selected.week.gap");
  });
});

describe("estate and store grain", () => {
  it("totals reconcile to the curated P&L", () => {
    const s = summarize(bundle, all);
    expect(s.stores).toBe(60);
    expect(s.storeMonths).toBe(1440);
    expect(s.revenue).toBeCloseTo(89_685_989.18, 2);
    expect(s.netProfit).toBeCloseTo(16_879_504.07, 2);
    expect(s.lossMonths).toBe(225);
  });
  it("cost halves split 30/30 on the 24-month median", () => {
    const halves = costHalves(bundle);
    const lower = [...halves.values()].filter((h) => h === "Lower-cost half").length;
    expect(lower).toBe(30);
    expect(selectedStoreIds(bundle, { ...EMPTY, half: ["Higher-cost half"] }, halves).size).toBe(30);
  });
  it("a year filter changes store means; South London Corner ranks last on margin", () => {
    const a24 = storeAggs(bundle, [2024]).get(32)!;
    expect(a24.months).toBe(12);
    expect(a24.np).toBeCloseTo(-6595.325833, 5);
    expect(marginRank(bundle, 32)).toBe(60);
  });
  it("zero-row selection returns NaN ratios, not zeros", () => {
    const s = summarize(bundle, new Set());
    expect(s.stores).toBe(0);
    expect(Number.isNaN(s.margin)).toBe(true);
  });
});

describe("release-level evidence", () => {
  const r = release(bundle);
  it("cost explains profit; revenue does not", () => {
    expect(r.r2Fixed).toBeCloseTo(0.8030226639, 8);
    expect(r.r2Revenue).toBeCloseTo(0.1178195514, 8);
    expect(r.lower.margin).toBeCloseTo(0.2416165466, 8);
    expect(r.upper.margin).toBeCloseTo(0.1351456597, 8);
  });
  it("region margin tracks cost, not revenue", () => {
    expect(r.rRegionFixed).toBeCloseTo(-0.9766295225, 8);
    expect(r.rRegionRevenue).toBeCloseTo(0.1008526659, 8);
    expect(regionRows(bundle)[0].region).toBe("Northern-Ireland");
  });
  it("loyalty upper bound stays below the break-even", () => {
    expect(r.loyalty.upper).toBeCloseTo(1747.222067, 4);
    expect(r.loyalty.needed).toBeCloseTo(1934.528310, 4);
    expect(r.loyalty.upper).toBeLessThan(r.loyalty.needed);
  });
});

describe("week (daily sample)", () => {
  it("means are ratios of sums, not means of means", () => {
    const rows: WeekRow[] = [
      { s: 1, y: 2023, d: 1, bh: false, n: 1, rev: 100, hrs: 10, txn: 0, espresso: 0, filter: 0, food: 0, retail_beans: 0 },
      { s: 2, y: 2023, d: 1, bh: false, n: 3, rev: 900, hrs: 30, txn: 0, espresso: 0, filter: 0, food: 0, retail_beans: 0 },
      { s: 1, y: 2023, d: 6, bh: false, n: 2, rev: 300, hrs: 20, txn: 0, espresso: 0, filter: 0, food: 0, retail_beans: 0 },
      { s: 1, y: 2023, d: 2, bh: true, n: 1, rev: 50, hrs: 10, txn: 0, espresso: 0, filter: 0, food: 0, retail_beans: 0 },
    ];
    const w = weekSummary(rows, null);
    expect(w.days[0].rev).toBe(250); // (100 + 900) / 4, not (100 + 300) / 2
    expect(w.weekendRev).toBe(150);
    expect(w.bhGap).toBeCloseTo(50 / ((100 + 900 + 300) / 6) - 1, 12);
    expect(weekSummary(rows, new Set([2])).n).toBe(3);
  });
  it("estate weekend gap and surplus match the ledger", () => {
    const w = weekSummary(bundle.week, null);
    expect(w.gap).toBeCloseTo(-0.243717795, 8);
    expect(w.surplus).toBeCloseTo(0.248106652, 8);
    expect(w.n).toBe(10_000);
  });
});

describe("formatters", () => {
  it("use a true minus and sensible p-value precision", () => {
    expect(fmtPct(-0.2437)).toBe("−24.4%");
    expect(fmtP(0.0004)).toBe("< 0.001");
    expect(fmtP(0.004)).toBe("0.004");
    expect(fmtP(0.547)).toBe("0.55");
  });
});
