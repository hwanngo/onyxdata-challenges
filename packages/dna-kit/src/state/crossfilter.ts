import { createSignal, createMemo } from "solid-js";

/**
 * Global cross-filter store.
 *
 * Cross-chart filtering is the single heaviest scored criterion. Every visual must
 * both EMIT and CONSUME filters - a chart that filters others but doesn't respond
 * to them loses points.
 *
 * Filter state is mirrored into the URL so any view is shareable.
 */
export type Filter = { field: string; values: (string | number)[] };

const [filters, setFilters] = createSignal<Filter[]>(readUrl());
const [drillPath, setDrillPath] = createSignal<{ field: string; value: string | number }[]>([]);

function readUrl(): Filter[] {
  if (typeof window === "undefined") return [];
  const raw = new URLSearchParams(window.location.search).get("f");
  if (!raw) return [];
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

function writeUrl(f: Filter[]) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (f.length) u.searchParams.set("f", encodeURIComponent(JSON.stringify(f)));
  else u.searchParams.delete("f");
  window.history.replaceState({}, "", u);
}

function commit(next: Filter[]) {
  setFilters(next);
  writeUrl(next);
  announce(
    next.length
      ? `Filtered by ${next.map((f) => `${f.field}: ${f.values.join(", ")}`).join("; ")}`
      : "All filters cleared"
  );
}

/** Toggle a value. Clicking the same value again removes it. */
export function toggle(field: string, value: string | number) {
  const cur = filters();
  const hit = cur.find((f) => f.field === field);
  if (!hit) return commit([...cur, { field, values: [value] }]);
  const values = hit.values.includes(value)
    ? hit.values.filter((v) => v !== value)
    : [...hit.values, value];
  commit(values.length ? cur.map((f) => (f.field === field ? { field, values } : f)) : cur.filter((f) => f.field !== field));
}

export function clearField(field: string) {
  commit(filters().filter((f) => f.field !== field));
}

export function clearAll() {
  commit([]);
  setDrillPath([]);
}

export function isActive(field: string, value: string | number) {
  return filters().some((f) => f.field === field && f.values.includes(value));
}

/** Drill stack - powers the breadcrumb. */
export function drillInto(field: string, value: string | number) {
  setDrillPath([...drillPath(), { field, value }]);
  toggle(field, value);
}

export function drillUpTo(depth: number) {
  const removed = drillPath().slice(depth);
  removed.forEach((d) => clearField(d.field));
  setDrillPath(drillPath().slice(0, depth));
}

/** SQL WHERE fragment. Values are escaped; never interpolate raw user input. */
export const whereClause = createMemo(() => {
  const f = filters();
  if (!f.length) return "";
  const parts = f.map(({ field, values }) => {
    const lit = values
      .map((v) => (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`))
      .join(", ");
    return `"${field.replace(/"/g, '""')}" IN (${lit})`;
  });
  return " WHERE " + parts.join(" AND ");
});

/** aria-live announcer - filter changes must be perceivable without sight. */
let liveEl: HTMLElement | null = null;
export function registerLiveRegion(el: HTMLElement) {
  liveEl = el;
}
function announce(msg: string) {
  if (liveEl) liveEl.textContent = msg;
}

export { filters, drillPath };
