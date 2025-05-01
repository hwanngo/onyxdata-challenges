/**
 * Filter chip bar + drill breadcrumb + theme toggle.
 *
 * Cross-filter state must be VISIBLE and clearable in one click - that is explicitly
 * scored. Changes are announced through the dna-kit aria-live region.
 */
import { For, Show } from "solid-js";
// RELATIVE, not "@onyxdata/dna-kit". Importing the package by name from INSIDE the package
// resolves through the workspace symlink and yields a SECOND module instance, so this file
// read a different `filters` signal than the one `toggle()` writes to. The symptom was
// silent and nasty: cross-filtering worked, every chart updated, and the chip bar sat there
// saying "Nothing filtered" with no error anywhere. Caught by a month's interaction matrix.
import { clearAll, clearField, drillPath, drillUpTo, filters, toggle } from "../state/crossfilter";

/** Field -> human label. Months extend this via the `labels` prop. */
const DEFAULT_LABELS: Record<string, string> = {
  brand: "Brand",
  mobile_model: "Model",
  country: "Market",
  city: "City",
  price_band: "Band",
  sales_channel: "Channel",
  payment_type: "Payment",
  customer_age_group: "Age",
  customer_gender: "Gender",
  color: "Colour",
  storage_size: "Storage",
};

export function FilterChips(props: {
  labels?: Record<string, string>;
  /** Empty-state hint. Month-specific - name the objects the user can actually click. */
  hint?: string;
} = {}) {
  const LABEL = () => ({ ...DEFAULT_LABELS, ...(props.labels ?? {}) });
  return (
    <div class="chipbar live-only" role="region" aria-label="Active filters">
      <Show
        when={filters().length}
        fallback={
          <span class="chipbar__hint">
            {props.hint ?? "Nothing filtered - click any mark to cross-filter the whole report."}
          </span>
        }
      >
        <For each={filters()}>
          {(f) => (
            <For each={f.values}>
              {(v) => (
                <button
                  class="chip"
                  onClick={() => toggle(f.field, v)}
                  aria-label={`Remove filter ${LABEL()[f.field] ?? f.field}: ${v}`}
                >
                  <span>
                    {LABEL()[f.field] ?? f.field}: <strong>{v}</strong>
                  </span>
                  <span class="chip__x" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}
            </For>
          )}
        </For>
        <button class="chip chip--clear" onClick={clearAll}>
          Clear all
        </button>
      </Show>
    </div>
  );
}

export function Breadcrumb() {
  return (
    <Show when={drillPath().length}>
      <nav class="live-only" aria-label="Drill path" style={{ "font-size": "0.82rem", "margin-bottom": "8px" }}>
        <button class="btn" style={{ padding: "3px 8px", "min-height": "28px" }} onClick={clearAll}>
          All
        </button>
        <For each={drillPath()}>
          {(d, i) => (
            <>
              <span aria-hidden="true" style={{ margin: "0 6px", color: "var(--ink-muted)" }}>
                ▸
              </span>
              <button
                class="btn"
                style={{ padding: "3px 8px", "min-height": "28px" }}
                onClick={() => drillUpTo(i() + 1)}
              >
                {d.value}
              </button>
            </>
          )}
        </For>
      </nav>
    </Show>
  );
}

export function ThemeToggle() {
  const cur = () => document.documentElement.getAttribute("data-theme") ?? "light";
  return (
    <button
      class="btn live-only"
      aria-label={`Switch to ${cur() === "dark" ? "light" : "dark"} theme`}
      onClick={() => {
        const next = cur() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("datadna-theme", next);
        } catch {
          /* ignore */
        }
      }}
    >
      Theme
    </button>
  );
}
