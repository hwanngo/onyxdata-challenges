/**
 * Data layer - 2026/06 UK Fintech Neobank (Zephyr Bank).
 *
 * Every number rendered anywhere in this app is computed here from the JSON exported by
 * model/build.py. tools/verify_metrics.py independently recomputes each rendered figure from
 * the PARQUET via DuckDB in Python and asserts the DOM matches.
 *
 * THE ONE RULE THIS FILE ENFORCES: a rate never leaves here without its customer count.
 *
 * The fact table has 1,500 rows and 20 rows of information - transaction_status,
 * is_flagged_fraud, failed_reason and device_type never vary within a customer. A helper that
 * returns `0.20` invites "20% of transactions are fraudulent, +/-2pp", which is the exact error
 * the page exists to correct. So `Rate` is a record, not a number, and it carries both
 * denominators and the exact binomial interval computed in build.py.
 */
import { createResource, createSignal } from "solid-js";

export type Customer = {
  customer_id: number; customer_name: string; age_band: string; region: string;
  customer_segment: string; kyc_verified: boolean; account_open_date: string;
  transaction_status: string; is_flagged_fraud: boolean; failed_reason: string | null;
  device_type_raw: string | null; customer_id_mod_4: number;
  transactions: number; mean_amount_gbp: number; total_value_gbp: number;
  min_amount_gbp: number; max_amount_gbp: number; distinct_amounts: number;
  fees_paid_gbp: number; distinct_fees: number; categories_used: number; types_used: number;
  amount_jitter: number; is_failing: boolean;
};

/** A rate is never a bare number. Both denominators and the interval travel with it. */
export type Rate = {
  measure: string; question: string;
  transactions: number; transaction_rate: number;
  customers: number; customer_rate: number;
  naive_ci_halfwidth: number; exact_ci_lo: number; exact_ci_hi: number;
  ci_width_pp: number; naive_width_pp: number;
  design_effect: number; se_inflation: number;
};

export type Fee = {
  transaction_type_id: number; type_name: string; channel: string; is_domestic: boolean;
  typical_fee_gbp: number; name_is_ambiguous: boolean; transactions: number; customers: number;
  charged_gbp: number; expected_gbp: number; over_gbp: number; under_gbp: number;
  rows_wrong: number; net_variance_gbp: number; gross_variance_gbp: number;
};

export type Claim = { n: number; claim: string; verdict: string; evidence: string };
export type FeeRow = {
  transaction_id: number; customer_id: number; transaction_type_id: number; type_name: string;
  channel: string; fee_charged_gbp: number; typical_fee_gbp: number; fee_delta_gbp: number;
  fee_verdict: string; amount_gbp: number; txn_date: string;
};
export type Filter = { field: string; values: (string | number)[] };

const base = import.meta.env.BASE_URL || "/";

const [customers, setCustomers] = createSignal<Customer[]>([]);
const [rates, setRates] = createSignal<Rate[]>([]);
const [fees, setFees] = createSignal<Fee[]>([]);
const [claims, setClaims] = createSignal<Claim[]>([]);
const [feeRows, setFeeRows] = createSignal<FeeRow[]>([]);
const [months, setMonths] = createSignal<any[]>([]);
const [regions, setRegions] = createSignal<any[]>([]);
const [categories, setCategories] = createSignal<any[]>([]);
const [types, setTypes] = createSignal<any[]>([]);
const [headline, setHeadline] = createSignal<Record<string, any>>({});
export const [ready, setReady] = createSignal(false);

async function grab<T>(name: string): Promise<T> {
  const res = await fetch(`${base}data/${name}.json`);
  if (!res.ok) throw new Error(`could not load ${name}.json: ${res.status}`);
  return (await res.json()) as T;
}

export async function boot() {
  const [c, r, f, cl, fr, m, rg, cat, ty, hd] = await Promise.all([
    grab<Customer[]>("customers"), grab<Rate[]>("rates"), grab<Fee[]>("fees"),
    grab<Claim[]>("claims"), grab<FeeRow[]>("fee_rows"), grab<any[]>("months"),
    grab<any[]>("regions"), grab<any[]>("categories"), grab<any[]>("types"),
    grab<Record<string, any>[]>("headline"),
  ]);
  setCustomers(c); setRates(r); setFees(f); setClaims(cl); setFeeRows(fr);
  setMonths(m); setRegions(rg); setCategories(cat); setTypes(ty); setHeadline(hd[0]);
  setReady(true);
}

export { customers, rates, fees, claims, feeRows, months, regions, categories, types, headline };

// ---------------------------------------------------------------------------------------
// filtering - over CUSTOMERS, because that is the unit
// ---------------------------------------------------------------------------------------

export function apply(rows: Customer[], filters: Filter[]): Customer[] {
  if (!filters.length) return rows;
  return rows.filter((c) =>
    filters.every((f) => f.values.some((v) => String(v) === String((c as any)[f.field])))
  );
}

/**
 * Compute a rate over a customer subset. Returns the COUNT and the denominator, never a bare
 * fraction - every caller is forced to render "k of n".
 */
export function rateOf(rows: Customer[], pred: (c: Customer) => boolean) {
  const k = rows.filter(pred).length;
  const n = rows.length;
  return { k, n, rate: n ? k / n : 0, transactions: k * 75 };
}

export const STATUSES = ["Completed", "Declined", "Reversed", "Pending"] as const;
export type Status = (typeof STATUSES)[number];

export type SortKey = "value" | "status" | "id";
export const SORT_LABEL: Record<SortKey, string> = {
  value: "By total value",
  status: "By transaction status",
  id: "By customer id",
};
export const SORT_NOTE: Record<SortKey, string> =
  {
    value: "Ordered by each customer's total transaction value, largest first.",
    status: "Grouped by status. The blocks were already solid before this ordering - grouping only moves them next to each other.",
    id: "Raw customer_id order, exactly as the file supplies it. Still twenty solid blocks.",
  };

export function sortCustomers(rows: Customer[], key: SortKey): Customer[] {
  const out = rows.slice();
  if (key === "value") out.sort((a, b) => b.total_value_gbp - a.total_value_gbp);
  else if (key === "id") out.sort((a, b) => a.customer_id - b.customer_id);
  else {
    const order = { Completed: 0, Declined: 1, Reversed: 2, Pending: 3 } as Record<string, number>;
    out.sort((a, b) =>
      (order[a.transaction_status] ?? 9) - (order[b.transaction_status] ?? 9) ||
      b.total_value_gbp - a.total_value_gbp);
  }
  return out;
}

export function derived<T>(fn: (rows: Customer[]) => T, filters: () => Filter[]) {
  const [data] = createResource(
    () => (ready() ? filters() : null),
    (fs: Filter[]) => fn(apply(customers(), fs))
  );
  return data;
}

// ---------------------------------------------------------------------------------------
// formatters
// ---------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("en-GB");
export const int = (n: number) => nf.format(Math.round(n));
export const gbp2 = (n: number) =>
  "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const gbpSigned = (n: number) => (n < 0 ? "-" : "+") + gbp2(n);
export const gbp0 = (n: number) => "£" + nf.format(Math.round(n));
export const gbpCompact = (n: number) =>
  n >= 1e6 ? "£" + (n / 1e6).toFixed(2) + "m" : n >= 1e3 ? "£" + (n / 1e3).toFixed(0) + "k" : gbp0(n);
export const pct = (n: number, d = 1) => (100 * n).toFixed(d) + "%";
export const pp = (n: number, d = 1) => n.toFixed(d) + "pp";
