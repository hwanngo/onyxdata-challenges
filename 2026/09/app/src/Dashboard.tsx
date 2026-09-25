import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import {
  AllocationMatrix,
  ClaimScorecard,
  ContractMatrix,
  CoverageRail,
  DecisionLedger,
  DiagnosticRail,
  DialBank,
  EvidenceDrawer,
  GuidedTour,
  Metric,
  ProcessLinkPlot,
  SignalStrip,
} from "./components";
import {
  applyAllocationFilters,
  decodeViewState,
  encodeViewState,
  filterOptions,
  int,
  loadBundle,
  rollupCorridors,
  summarizeAllocations,
  type Filter,
  type FilterField,
  type Focus,
  type ViewState,
} from "./data";

type ThemeMode = "light" | "dark" | "system";
const TOUR_KEY = "dnakit-2026-09-tour-seen";
const FILTER_LABELS: Record<FilterField, string> = {
  kitchen_id: "Kitchen",
  zone_id: "Zone",
  rider_id: "Rider",
  year_month: "Month",
};

function readInitialState(): ViewState {
  return typeof window === "undefined"
    ? { filters: [], focus: null }
    : decodeViewState(window.location.search);
}

function FilterSelect(props: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label class="filter-control" for={props.id}>
      <span>{props.label}</span>
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        <option value="">All</option>
        <For each={props.options}>{(option) => <option value={option}>{option}</option>}</For>
      </select>
    </label>
  );
}

export default function Dashboard(props: { poster: boolean }) {
  const initial = readInitialState();
  const [bundle, { refetch }] = createResource(() => loadBundle());
  const [filters, setFilters] = createSignal<Filter[]>(props.poster ? [] : initial.filters);
  const [focus, setFocus] = createSignal<Focus | null>(props.poster ? null : initial.focus);
  const [announcement, setAnnouncement] = createSignal("");
  const [tourOpen, setTourOpen] = createSignal(false);
  const [tourStep, setTourStep] = createSignal(0);
  const [theme, setTheme] = createSignal<ThemeMode>("system");

  const filteredRows = createMemo(() => {
    const data = bundle();
    return data ? applyAllocationFilters(data.allocations, filters()) : [];
  });
  const summary = createMemo(() => summarizeAllocations(filteredRows()));
  const corridors = createMemo(() => {
    const data = bundle();
    return data ? rollupCorridors(filteredRows(), data.corridors) : [];
  });
  const filtersActive = createMemo(() => filters().length > 0);
  const activeMeasures = createMemo(() => {
    const current = focus();
    const data = bundle();
    if (!current || !data) return new Set<string>();
    if (current.kind === "measure") return new Set([current.id]);
    if (current.kind === "link") {
      const link = data.processLinks.find((row) => row.link_id === current.id);
      return new Set(link ? [link.source_measure, link.target_measure] : []);
    }
    return new Set<string>();
  });

  const writeUrl = (nextFilters: Filter[], nextFocus: Focus | null, replace = false) => {
    if (props.poster) return;
    const query = encodeViewState({ filters: nextFilters, focus: nextFocus });
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history[replace ? "replaceState" : "pushState"](
      { filters: nextFilters, focus: nextFocus, scrollY: window.scrollY },
      "",
      url,
    );
  };

  const selectFilter = (field: FilterField, value: string) => {
    const next = filters().filter((filter) => filter.field !== field);
    if (value) next.push({ field, values: [value] });
    setFilters(next);
    writeUrl(next, focus());
    const rows = applyAllocationFilters(bundle()?.allocations ?? [], next).length;
    setAnnouncement(`${FILTER_LABELS[field]} filter ${value || "cleared"}. ${int(rows)} allocation rows selected.`);
  };

  const clearAll = () => {
    setFilters([]);
    setFocus(null);
    writeUrl([], null);
    setAnnouncement(`All filters cleared. ${int(bundle()?.headline.order_rows ?? 0)} allocation rows selected.`);
  };

  const setEvidenceFocus = (next: Focus | null) => {
    setFocus(next);
    writeUrl(filters(), next);
    setAnnouncement(next ? `${next.kind} evidence opened.` : "Evidence detail closed.");
  };

  const currentFilter = (field: FilterField) =>
    filters().find((filter) => filter.field === field)?.values[0] ?? "";

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    if (props.poster || mode === "light") document.documentElement.dataset.theme = "light";
    else if (mode === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    if (!props.poster) localStorage.setItem("datadna-theme", mode);
  };

  onMount(() => {
    if (props.poster) {
      applyTheme("light");
      return;
    }
    const stored = localStorage.getItem("datadna-theme");
    if (stored === "light" || stored === "dark" || stored === "system") applyTheme(stored);
    else applyTheme("system");

    const onPopState = () => {
      const restored = decodeViewState(window.location.search);
      setFilters(restored.filters);
      setFocus(restored.focus);
      requestAnimationFrame(() => window.scrollTo({ top: history.state?.scrollY ?? 0 }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (tourOpen()) {
        if (event.key === "Escape") setTourOpen(false);
        if (event.key === "ArrowRight") setTourStep((step) => Math.min(4, step + 1));
        if (event.key === "ArrowLeft") setTourStep((step) => Math.max(0, step - 1));
        return;
      }
      if (event.key === "Escape" && focus()) setEvidenceFocus(null);
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setTourStep(0);
        setTourOpen(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKey);
    });
  });

  createEffect(() => {
    if (bundle() && !props.poster && localStorage.getItem(TOUR_KEY) !== "1") {
      setTourOpen(true);
    }
  });

  const closeTour = () => {
    setTourOpen(false);
    localStorage.setItem(TOUR_KEY, "1");
  };

  return (
    <Switch>
      <Match when={bundle.loading}>
        <div class="loading-shell" aria-live="polite" aria-busy="true">
          <span class="loading-rule" />
          <span>Loading the evidence docket…</span>
          <span class="loading-rule" />
        </div>
      </Match>
      <Match when={bundle.error}>
        <div class="error-shell" role="alert">
          <p class="eyebrow">Evidence load failed</p>
          <h1>The audit could not be opened.</h1>
          <p>{String(bundle.error)}</p>
          <button type="button" class="btn btn--primary" onClick={() => refetch()}>Retry data load</button>
        </div>
      </Match>
      <Match when={bundle()} keyed>
        {(data) => {
          const dates = data.allocations.map((row) => row.order_date).sort();
          const startDate = dates[0];
          const endDate = dates.at(-1);
          return (
            <div class="dashboard-shell">
              <a class="skip-link live-only" href="#main-evidence">Skip to evidence</a>
              <div aria-live="polite" class="sr-only">{announcement()}</div>

              <DiagnosticRail
                headline={data.headline}
                startDate={startDate}
                endDate={endDate ?? startDate}
              />

              <header class="thesis-masthead">
                <div class="thesis-copy">
                  <p class="eyebrow">September 2026 · source integrity dispatch</p>
                  <h1>{data.headline.title}</h1>
                  <p class="standfirst">
                    Allocation is complete across{" "}
                    <Metric name="kitchen_zone_pairs" value={data.headline.kitchen_zone_pairs} /> kitchen-zone corridors and{" "}
                    <Metric name="kitchen_rider_pairs" value={data.headline.kitchen_rider_pairs} /> rider-kitchen pairings; delivery performance is not evidenced because{" "}
                    <Metric name="quarantined_measures" value={data.headline.quarantined_measures} /> business measures fail documented semantics and expected linear process links.
                  </p>
                </div>
                <div class="decision-stamp" aria-label="Decision: count allocation, repair measurement, do not optimise">
                  <span>Decision</span>
                  <b>Count allocation</b>
                  <b>Repair measurement</b>
                  <b>Do not optimise</b>
                </div>
                <SignalStrip
                  headline={data.headline}
                  corridorPairs={summary().kitchenZonePairs}
                  riderPairs={summary().kitchenRiderPairs}
                  processLinkCount={data.processLinks.length}
                />
              </header>

              <section class="live-controls live-only" aria-label="Allocation controls">
                <div class="filter-grid">
                  <FilterSelect
                    id="kitchen-filter"
                    label="Kitchen"
                    value={currentFilter("kitchen_id")}
                    options={filterOptions(data.allocations, "kitchen_id")}
                    onChange={(value) => selectFilter("kitchen_id", value)}
                  />
                  <FilterSelect
                    id="zone-filter"
                    label="Zone"
                    value={currentFilter("zone_id")}
                    options={filterOptions(data.allocations, "zone_id")}
                    onChange={(value) => selectFilter("zone_id", value)}
                  />
                  <FilterSelect
                    id="rider-filter"
                    label="Rider"
                    value={currentFilter("rider_id")}
                    options={filterOptions(data.allocations, "rider_id")}
                    onChange={(value) => selectFilter("rider_id", value)}
                  />
                  <FilterSelect
                    id="month-filter"
                    label="Month"
                    value={currentFilter("year_month")}
                    options={filterOptions(data.allocations, "year_month")}
                    onChange={(value) => selectFilter("year_month", value)}
                  />
                </div>
                <div class="utility-controls">
                  <div class="theme-switch" role="group" aria-label="Theme">
                    <For each={["light", "dark", "system"] as ThemeMode[]}>
                      {(mode) => (
                        <button
                          type="button"
                          aria-pressed={theme() === mode}
                          onClick={() => applyTheme(mode)}
                        >
                          {mode}
                        </button>
                      )}
                    </For>
                  </div>
                  <button
                    type="button"
                    class="btn"
                    aria-label="Open guided tour"
                    onClick={() => {
                      setTourStep(0);
                      setTourOpen(true);
                    }}
                  >
                    Guided tour
                  </button>
                </div>
                <div class="chipbar" aria-label="Selected filters">
                  <Show when={filters().length || focus()} fallback={<span class="chipbar__hint">No allocation filters selected.</span>}>
                    <For each={filters()}>
                      {(filter) => (
                        <button type="button" class="chip" onClick={() => selectFilter(filter.field, "")}>
                          {FILTER_LABELS[filter.field]}: {filter.values.join(", ")} <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </For>
                    <Show when={focus()} keyed>
                      {(item) => (
                        <button type="button" class="chip" onClick={() => setEvidenceFocus(null)}>
                          Focus: {item.kind} <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </Show>
                    <button type="button" class="chip chip--clear" onClick={clearAll}>Clear all</button>
                  </Show>
                </div>
                <p class="selection-note">
                  <Metric name="selected.order_rows" value={summary().orderRows} /> of {int(data.headline.order_rows)} allocation rows selected · filters do not recompute release-level statistics.
                </p>
              </section>

              <main id="main-evidence" class="evidence-grid">
                <section class="hero-grid">
                  <div class="matrix-panel">
                    <AllocationMatrix
                      corridors={corridors()}
                      poster={props.poster}
                      focus={focus()}
                      onSelect={(row) => setEvidenceFocus({ kind: "corridor", id: `${row.kitchen_id}|${row.zone_id}` })}
                    />
                    <CoverageRail headline={data.headline} />
                  </div>
                  <div class="dial-panel">
                    <DialBank
                      contracts={data.measureContracts}
                      headline={data.headline}
                      processLinkCount={data.processLinks.length}
                      poster={props.poster}
                      focus={focus()}
                      activeMeasures={activeMeasures()}
                      onSelect={(row) => setEvidenceFocus({ kind: "measure", id: row.source_field })}
                    />
                  </div>
                </section>

                <section class="support-grid" aria-label="Release-level evidence">
                  <ProcessLinkPlot
                    links={data.processLinks}
                    poster={props.poster}
                    filtersActive={filtersActive()}
                    focus={focus()}
                    onSelect={(row) => setEvidenceFocus({ kind: "link", id: row.link_id })}
                  />
                  <ClaimScorecard
                    claims={data.claims}
                    poster={props.poster}
                    filtersActive={filtersActive()}
                    focus={focus()}
                    onSelect={(row) => setEvidenceFocus({ kind: "claim", id: row.claim_id })}
                  />
                  <ContractMatrix
                    contracts={data.contracts}
                    headline={data.headline}
                    poster={props.poster}
                    filtersActive={filtersActive()}
                    focus={focus()}
                    onSelect={(row) => setEvidenceFocus({ kind: "contract", id: row.contract_id })}
                  />
                </section>

                <DecisionLedger
                  requirements={data.collectionRequirements}
                  poster={props.poster}
                  onSelect={(id) => setEvidenceFocus({ kind: "decision", id })}
                />

                <section class="live-explore live-only" aria-label="Detailed evidence tables">
                  <details>
                    <summary>Volume is descriptive; performance is unavailable</summary>
                    <div class="table-scroll" tabIndex={0}>
                      <table class="data-table">
                        <thead><tr><th>Kitchen</th><th>Zone</th><th>Selected orders</th><th>Selected share</th><th>Source rank</th></tr></thead>
                        <tbody>
                          <For each={corridors()}>
                            {(row) => (
                              <tr>
                                <th scope="row">{row.kitchen_name}</th>
                                <td>{row.zone_name}</td>
                                <td>{row.filtered_order_rows}</td>
                                <td>{(row.filtered_share * 100).toFixed(2)}%</td>
                                <td>{row.corridor_rank_within_kitchen}</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </details>
                  <details>
                    <summary>Every business measure is source-audit only</summary>
                    <div class="table-scroll" tabIndex={0}>
                      <table class="data-table">
                        <thead><tr><th>Field</th><th>Status</th><th>Safe use</th><th>Reason</th></tr></thead>
                        <tbody>
                          <For each={data.measureContracts}>
                            {(row) => <tr><th scope="row">{row.source_field}</th><td>Q · {row.semantic_status}</td><td>{row.safe_use}</td><td>{row.reason}</td></tr>}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </details>
                </section>
              </main>

              <footer class="colophon">
                <span>Source: Onyx Data · Golden Wok Food Delivery</span>
                <span>{startDate}—{endDate}</span>
                <span>Synthetic-pattern audit, not proof of a generation mechanism or a Lagos benchmark</span>
                <span>No defensible profit, SLA, quality or rider-performance KPI exposed</span>
                <span>Every figure recomputed from curated evidence</span>
              </footer>

              <EvidenceDrawer
                bundle={data}
                corridors={corridors()}
                focus={focus()}
                onClose={() => setEvidenceFocus(null)}
              />
              <GuidedTour
                open={tourOpen()}
                step={tourStep()}
                onStep={setTourStep}
                onClose={closeTour}
              />
            </div>
          );
        }}
      </Match>
    </Switch>
  );
}
