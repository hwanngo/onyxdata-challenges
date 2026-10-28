import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { TourOverlay, tourAlreadySeen, type TourStep } from "@onyxdata/dna-kit";
import { ForgetRemember, LoyaltyPanel, RegionMap, SixtyCups, WeekPanel } from "./charts";
import {
  EMPTY,
  HALVES,
  STATUS,
  YEARS,
  costHalves,
  decodeViewState,
  encodeViewState,
  filtersActive,
  fmtGbp,
  fmtGbpK,
  fmtGbpM,
  fmtInt,
  fmtNum,
  fmtP,
  fmtPct,
  fmtR,
  fmtSignedPct,
  loadBundle,
  marginRank,
  mid,
  regionRows,
  release,
  selectedStoreIds,
  storeAggs,
  storeFiltersActive,
  storeMonths,
  summarize,
  weekSummary,
  yearActive,
  type Bundle,
  type ViewState,
} from "./data";

const TOUR_KEY = "sunrise-2026-10-tour-seen";
type Theme = "system" | "light" | "dark";

const TOUR: TourStep[] = [
  { h: "Same cup, different rent", p: "This review asks one question of every chart: does the difference come from what a store sells, or from what it costs to run? The headline answers it before you touch anything." },
  { h: "Sixty Cups", p: "Each column is one store's average month. The grey rim is revenue; the fill is cost of goods, rent + staffing (blue) and loyalty redemption (amber); espresso at the top is net profit. Columns are sorted by rent + staffing. Click or press Enter on any cup to drill into that store's 24 months." },
  { h: "Filter from the toolbar or the charts", p: "Region, location type, cost half and year filter every panel. Click a region row in the cost map to filter by it. Active filters appear as chips; clear one or clear all. The URL carries the view, so you can share it." },
  { h: "Evidence panels say what they cover", p: "Statistical evidence (correlations, intervals, tests) always covers all 60 stores and 24 months and is labelled so. Filtered values sit in the selection bar and in the charts that redraw." },
  { h: "Decisions and the source audit", p: "The bottom rail turns each finding into a decision for the CCO. 'Source audit' opens the 24 documented promises this archive makes and which of them fail." },
];

function readState(poster: boolean): ViewState {
  if (poster || typeof window === "undefined") return { ...EMPTY };
  return decodeViewState(window.location.search);
}

function Metric(props: { id: string; value: number | string; children: any; class?: string }) {
  return (
    <span class={props.class ?? "num"} data-metric={props.id} data-value={props.value}>
      {props.children}
    </span>
  );
}

function Toggle(props: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" class="chip" aria-pressed={props.pressed} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

const NO_YEARS: number[] = [];

export default function Dashboard(props: { poster: boolean }) {
  const [bundle] = createResource(() => loadBundle());
  const [view, setView] = createSignal<ViewState>(readState(props.poster));
  const [tourOpen, setTourOpen] = createSignal(false);
  const [auditOpen, setAuditOpen] = createSignal(false);
  const [theme, setTheme] = createSignal<Theme>("system");
  const [announce, setAnnounce] = createSignal("");

  // -------------------------------------------------------------- state <-> URL
  const commit = (next: ViewState, message: string) => {
    setView(next);
    setAnnounce(message);
    if (props.poster) return;
    const q = encodeViewState(next);
    window.history.pushState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  };
  onMount(() => {
    if (props.poster) return;
    const onPop = () => setView(decodeViewState(window.location.search));
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
    if (!tourAlreadySeen(TOUR_KEY)) setTourOpen(true);
  });
  createEffect(() => {
    const t = theme();
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  });

  const toggleIn = <K extends "region" | "loc" | "half" | "year">(key: K, value: ViewState[K][number]) => {
    const cur = view()[key] as (string | number)[];
    const has = cur.includes(value as never);
    const next = { ...view(), [key]: has ? cur.filter((v) => v !== value) : [...cur, value] } as ViewState;
    commit(next, `${has ? "Removed" : "Added"} filter ${String(value)}.`);
  };
  const clearAll = () => commit({ ...EMPTY }, "All filters cleared.");
  const openStore = (id: number) => commit({ ...view(), store: id }, `Opened store ${id}.`);
  const closeStore = () => commit({ ...view(), store: null }, "Closed store detail.");

  // -------------------------------------------------------------- derived data
  const halves = createMemo(() => (bundle() ? costHalves(bundle()!) : new Map()));
  const rel = createMemo(() => (bundle() ? release(bundle()!) : null));
  // equality by contents: opening a store drawer changes view() but must not rebuild the charts
  // (a rebuilt mark is a new DOM node, and focus could not return to it on close)
  const years = createMemo(() => (yearActive(view()) ? view().year : NO_YEARS), NO_YEARS, {
    equals: (a, b) => a.length === b.length && a.every((y, i) => y === b[i]),
  });
  const aggs = createMemo(() => (bundle() ? storeAggs(bundle()!, years()) : new Map()));
  const selIds = createMemo(() => (bundle() ? selectedStoreIds(bundle()!, view(), halves()) : new Set<number>()));
  const regions = createMemo(() => (bundle() ? regionRows(bundle()!, years()) : []));
  const sel = createMemo(() => (bundle() ? summarize(bundle()!, selIds(), years()) : null));
  const estate = createMemo(() => (bundle() ? summarize(bundle()!, new Set(bundle()!.stores.map((s) => s.id))) : null));
  const weekFiltered = createMemo(() => filtersActive(view()));
  const wk = createMemo(() => (bundle() ? weekSummary(bundle()!.week, storeFiltersActive(view()) ? selIds() : null, years()) : null));
  const regionOptions = createMemo(() => [...new Set(bundle()?.stores.map((s) => s.region) ?? [])].sort());
  const locOptions = createMemo(() => [...new Set(bundle()?.stores.map((s) => s.loc) ?? [])].sort());
  const lossStore = createMemo(() => {
    const b = bundle();
    if (!b) return null;
    const all = storeAggs(b);
    const neg = [...all.values()].filter((s) => s.np < 0);
    return neg.length === 1 ? { agg: neg[0], store: b.stores.find((s) => s.id === neg[0].id)! } : null;
  });
  const london = createMemo(() => (bundle() ? regionRows(bundle()!).find((r) => r.region === "London") : undefined));
  const holds = createMemo(() => bundle()?.contract.filter((c) => c.verdict === "HOLDS").length ?? 0);
  const mismatches = createMemo(() => bundle()?.months.filter((m) => m.st !== m.src).length ?? 0);
  const street = createMemo(() => bundle()?.stores.filter((s) => s.format === "High-Street").length ?? 0);
  const hubs = createMemo(() => bundle()?.stores.filter((s) => s.format === "Transport-Hub").length ?? 0);

  return (
    <Show when={bundle() && rel()} fallback={<div class="empty" role="status">{bundle.error ? `Could not load data: ${String(bundle.error)}` : "Loading the archive…"}</div>}>
      <div class={props.poster ? "poster-sheet" : ""}>
        <div class="sr-only" aria-live="polite">{announce()}</div>

        {/* ============================================================ masthead */}
        <header class="mast">
          <div>
            <p class="mast__eyebrow">Sunrise Coffee · commercial review 2023–24 · for the CCO</p>
            <h1 class="mast__thesis">Same cup, different rent.</h1>
            <p class="mast__sub">
              Sixty stores sell alike: no store, region or season carries a revenue signal that repeats. What separates them is what they cost to run.
              Pick 2025 sites on cost, prove loyalty before funding it, and staff to the week.
            </p>
          </div>
          <div class="kpis" role="list" aria-label="Estate figures, 24 months">
            <div class="kpi" role="listitem"><p class="kpi__label">Revenue</p><Metric id="kpi.revenue" value={estate()!.revenue} class="kpi__value">{fmtGbpM(estate()!.revenue)}</Metric><div class="kpi__note">60 stores × 24 months</div></div>
            <div class="kpi" role="listitem"><p class="kpi__label">Net profit</p><Metric id="kpi.net_profit" value={estate()!.netProfit} class="kpi__value">{fmtGbpM(estate()!.netProfit)}</Metric><div class="kpi__note">after rent, staff, loyalty</div></div>
            <div class="kpi" role="listitem"><p class="kpi__label">Estate margin</p><Metric id="kpi.margin" value={estate()!.margin} class="kpi__value">{fmtPct(estate()!.margin, 2)}</Metric><div class="kpi__note">pooled</div></div>
            <div class="kpi" role="listitem"><p class="kpi__label">Loyalty redemptions</p><Metric id="kpi.redemption" value={estate()!.redemption} class="kpi__value">{fmtGbpM(estate()!.redemption)}</Metric><div class="kpi__note">cash cost, 24 months</div></div>
            <div class="kpi" role="listitem"><p class="kpi__label">Promises that hold</p><span class="kpi__value"><Metric id="kpi.contract_holds" value={holds()}>{holds()}</Metric>/<Metric id="kpi.contract_tested" value={bundle()!.contract.length}>{bundle()!.contract.length}</Metric></span><div class="kpi__note">dictionary vs files</div></div>
          </div>
        </header>

        {/* ============================================================ toolbar (live) */}
        <Show when={!props.poster}>
          <a class="skip-link" href="#main">Skip to the charts</a>
          <div class="toolbar live-only" role="region" aria-label="Filters">
            <label class="fgroup">
              <span class="scope">Region</span>
              <select class="select" aria-label="Add a region filter" value="" onChange={(e) => { const v = e.currentTarget.value; if (v) toggleIn("region", v); e.currentTarget.value = ""; }}>
                <option value="">Add region…</option>
                <For each={regionOptions()}>{(r) => <option value={r}>{r.replace(/-/g, " ")}</option>}</For>
              </select>
            </label>
            <fieldset class="fgroup"><legend>Location</legend>
              <For each={locOptions()}>{(l) => <Toggle label={l.replace(/-/g, " ")} pressed={view().loc.includes(l)} onClick={() => toggleIn("loc", l)} />}</For>
            </fieldset>
            <fieldset class="fgroup"><legend>Cost half</legend>
              <For each={HALVES}>{(h) => <Toggle label={h} pressed={view().half.includes(h)} onClick={() => toggleIn("half", h)} />}</For>
            </fieldset>
            <fieldset class="fgroup"><legend>Year</legend>
              <For each={YEARS}>{(y) => <Toggle label={String(y)} pressed={view().year.includes(y)} onClick={() => toggleIn("year", y)} />}</For>
            </fieldset>
            <span class="toolbar__spacer" />
            <button type="button" class="btn" onClick={clearAll} disabled={!filtersActive(view())}>Clear all</button>
            <button type="button" class="btn" onClick={() => setAuditOpen(true)}>Source audit</button>
            <button type="button" class="btn" aria-label="Open the guided tour" onClick={() => setTourOpen(true)}>?</button>
            <button type="button" class="btn" aria-label={`Colour theme: ${theme()}. Change theme`} onClick={() => setTheme(theme() === "system" ? "dark" : theme() === "dark" ? "light" : "system")}>
              Theme: {theme()}
            </button>
          </div>
          <Show when={filtersActive(view())}>
            <div class="cuts" role="region" aria-label="Active filters">
              <For each={[...view().region.map((v) => ["region", v] as const), ...view().loc.map((v) => ["loc", v] as const), ...view().half.map((v) => ["half", v] as const), ...view().year.map((v) => ["year", v] as const)]}>
                {([k, v]) => (
                  <span class="cut">{String(v).replace(/-/g, " ")}<button type="button" aria-label={`Remove filter ${String(v)}`} onClick={() => toggleIn(k, v as never)}>×</button></span>
                )}
              </For>
            </div>
          </Show>
          <div class="selection live-only" role="status" aria-live="polite">
            <Show when={sel() && sel()!.stores > 0} fallback={<span>No store matches these filters. <button type="button" class="btn" onClick={clearAll}>Clear all</button></span>}>
              <span class="scope">{filtersActive(view()) ? "Selection" : "Whole estate"}</span>
              <span><Metric id="selected.stores" value={sel()!.stores}>{sel()!.stores}</Metric> stores</span>
              <span>revenue <Metric id="selected.revenue" value={sel()!.revenue}>{fmtGbpM(sel()!.revenue)}</Metric></span>
              <span>net profit <Metric id="selected.net_profit" value={sel()!.netProfit}>{fmtGbpM(sel()!.netProfit)}</Metric></span>
              <span>margin <Metric id="selected.margin" value={sel()!.margin}>{fmtPct(sel()!.margin)}</Metric></span>
              <span>revenue / store-month <Metric id="selected.revenue_pm" value={sel()!.revenuePm}>{fmtGbp(sel()!.revenuePm)}</Metric></span>
              <span>rent + staffing / store-month <Metric id="selected.fixed_pm" value={sel()!.fixedPm}>{fmtGbp(sel()!.fixedPm)}</Metric></span>
              <span>loss months <Metric id="selected.loss_months" value={sel()!.lossMonths}>{sel()!.lossMonths}</Metric></span>
            </Show>
          </div>
        </Show>

        {/* ============================================================ hero */}
        <main id="main" class="band" style={{ display: "contents" }}>
          <section class="panel band" aria-labelledby="h-cups">
            <div class="hero__head">
              <div>
                <p class="panel__kicker">Signature · every store, its average month</p>
                <h2 class="panel__title" id="h-cups">Sixty cups: revenue is level, rent decides the profit</h2>
                <ul class="legend" aria-label="Legend">
                  <li><span class="sw sw--rev" />revenue (rim)</li>
                  <li><span class="sw sw--np" />net profit</li>
                  <li><span class="sw sw--loy" />loyalty redemption</li>
                  <li><span class="sw sw--cost" />rent + staffing</li>
                  <li><span class="sw sw--cogs" />cost of goods</li>
                  <li><span class="sw sw--loss" />costs overflow the cup</li>
                </ul>
              </div>
              <div class="hero__stats">
                <div class="stat"><div class="stat__v"><Metric id="hero.margin_lower" value={rel()!.lower.margin}>{fmtPct(rel()!.lower.margin)}</Metric></div><div class="stat__l">margin, lower-cost half · revenue <Metric id="hero.revenue_lower" value={rel()!.lower.revenuePm}>{fmtGbpK(rel()!.lower.revenuePm)}</Metric>/mo</div></div>
                <div class="stat"><div class="stat__v"><Metric id="hero.margin_upper" value={rel()!.upper.margin}>{fmtPct(rel()!.upper.margin)}</Metric></div><div class="stat__l">margin, higher-cost half · revenue <Metric id="hero.revenue_upper" value={rel()!.upper.revenuePm}>{fmtGbpK(rel()!.upper.revenuePm)}</Metric>/mo</div></div>
                <div class="stat"><div class="stat__v">R² <Metric id="hero.r2_fixed" value={rel()!.r2Fixed}>{fmtR(rel()!.r2Fixed)}</Metric> vs <Metric id="hero.r2_revenue" value={rel()!.r2Revenue}>{fmtR(rel()!.r2Revenue)}</Metric></div><div class="stat__l">store profit explained by fixed cost vs by revenue</div></div>
              </div>
            </div>
            <SixtyCups
              stores={bundle()!.stores}
              aggs={aggs()}
              selected={selIds()}
              dimOthers={storeFiltersActive(view())}
              focus={view().store}
              filtered={yearActive(view())}
              medianFixed={rel()!.medianFixed}
              poster={props.poster}
              onPick={openStore}
            />
          </section>

          {/* ============================================================ evidence row */}
          <div class="evidence band">
            <section class="panel" aria-labelledby="h-region">
              <p class="panel__kicker">Expansion · release-level evidence</p>
              <h2 class="panel__title" id="h-region">A cost map, not a demand map</h2>
              <p class="panel__finding">
                Regional margin tracks rent + staffing (r <Metric id="region.r_fixed" value={rel()!.rRegionFixed}>{fmtR(rel()!.rRegionFixed)}</Metric>), not revenue
                (r <Metric id="region.r_revenue" value={rel()!.rRegionRevenue}>{fmtR(rel()!.rRegionRevenue)}</Metric>; differences p <Metric id="region.revenue_p" value={bundle()!.evidence.region_revenue_p}>{fmtP(bundle()!.evidence.region_revenue_p)}</Metric>).
              </p>
              <RegionMap rows={regions()} selectedRegions={view().region} filtered={yearActive(view())} poster={props.poster} onPick={(r) => toggleIn("region", r)} />
              <p class="panel__note">
                Format can't be ranked: <Metric id="format.hub_stores" value={hubs()}>{hubs()}</Metric> Transport-Hub stores against <Metric id="format.street_stores" value={street()}>{street()}</Metric> High-Street, no Retail-Park
                (permutation p <Metric id="format.p" value={bundle()!.evidence.format_p}>{fmtP(bundle()!.evidence.format_p)}</Metric>).
              </p>
            </section>

            <section class="panel" aria-labelledby="h-yoy">
              <p class="panel__kicker">Store review · release-level evidence</p>
              <h2 class="panel__title" id="h-yoy">Revenue forgets, cost remembers</h2>
              <p class="panel__finding">
                A store's 2023 revenue says nothing about its 2024 revenue; its profit does, because its rent and wage bill come with it. Year-on-year "movers" sit inside the noise band
                (<Metric id="yoy.noise_sd" value={bundle()!.evidence.noise_sd}>{fmtGbpK(bundle()!.evidence.noise_sd)}</Metric> a year).
              </p>
              <ForgetRemember rel={rel()!} selected={selIds()} dimOthers={storeFiltersActive(view())} poster={props.poster} />
            </section>

            <section class="panel" aria-labelledby="h-loy">
              <p class="panel__kicker">Loyalty · release-level evidence</p>
              <h2 class="panel__title" id="h-loy">Loyalty buys share, not spend</h2>
              <p class="panel__finding">
                Ten more points of adoption move revenue <Metric id="loyalty.lift10" value={rel()!.loyalty.lift10}>{fmtGbp(rel()!.loyalty.lift10)}</Metric> a store-month
                (95% CI <Metric id="loyalty.lo10" value={rel()!.loyalty.lo10}>{fmtGbp(rel()!.loyalty.lo10)}</Metric> to <Metric id="loyalty.hi10" value={rel()!.loyalty.hi10}>{fmtGbp(rel()!.loyalty.hi10)}</Metric>).
              </p>
              <LoyaltyPanel rel={rel()!} selected={selIds()} dimOthers={storeFiltersActive(view())} poster={props.poster} />
              <p class="panel__note">Member spend per transaction cannot be tested: no field ties a transaction to a member.</p>
            </section>

            <section class="panel" aria-labelledby="h-week">
              <p class="panel__kicker">Staffing · daily sample{weekFiltered() ? " · filtered" : ""}</p>
              <h2 class="panel__title" id="h-week">The week the rota ignores</h2>
              <Show when={wk() && wk()!.n > 0} fallback={<p class="empty">No sampled days for this selection.</p>}>
                <p class="panel__finding">
                  Weekends trade <Metric id={mid("week.gap", weekFiltered())} value={wk()!.gap}>{fmtPct(Math.abs(wk()!.gap))}</Metric> {wk()!.gap < 0 ? "below" : "above"} weekdays while hours stay at{" "}
                  <Metric id={mid("week.hours_weekend", weekFiltered())} value={wk()!.weekendHrs}>{fmtNum(wk()!.weekendHrs)}</Metric>:{" "}
                  <Metric id={mid("week.surplus", weekFiltered())} value={wk()!.surplus}>{fmtPct(wk()!.surplus)}</Metric> of weekend hours are surplus at weekday productivity.
                </p>
                <WeekPanel wk={wk()!} filtered={weekFiltered()} poster={props.poster} />
                <p class="panel__note">
                  Bank holidays <Metric id={mid("week.bh_gap", weekFiltered())} value={wk()!.bhGap}>{fmtSignedPct(wk()!.bhGap)}</Metric>. Daily file is a{" "}
                  <Metric id="week.coverage" value={bundle()!.evidence.daily_coverage}>{fmtPct(bundle()!.evidence.daily_coverage)}</Metric> sample that does not reconcile to the P&L, so hours, not £, are claimed.
                </p>
              </Show>
            </section>
          </div>

          {/* ============================================================ decision rail */}
          <section class="decide band" aria-label="Decisions for the Chief Commercial Officer">
            <div class="decide__item">
              <h2 class="decide__h"><span class="decide__n" aria-hidden="true">1</span>Screen 2025 sites on rent + staffing</h2>
              <p class="decide__ev">Median split <Metric id="decide.median_fixed" value={rel()!.medianFixed}>{fmtGbpK(rel()!.medianFixed)}</Metric>/month separates <Metric id="decide.margin_lower" value={rel()!.lower.margin}>{fmtPct(rel()!.lower.margin)}</Metric> from <Metric id="decide.margin_upper" value={rel()!.upper.margin}>{fmtPct(rel()!.upper.margin)}</Metric> margin; regional revenue does not differ.</p>
            </div>
            <div class="decide__item">
              <h2 class="decide__h"><span class="decide__n" aria-hidden="true">2</span>Review <Metric id="decide.loss_store" value={lossStore()?.store.name ?? ""} class="">{lossStore()?.store.name}</Metric> and London's cost base</h2>
              <p class="decide__ev">The only store negative over 24 months (<Metric id="decide.loss_store_np" value={lossStore()?.agg.np ?? 0}>{fmtGbp(lossStore()?.agg.np ?? 0)}</Metric>/month). London margin <Metric id="decide.london_margin" value={london()?.margin ?? 0}>{fmtPct(london()?.margin ?? 0)}</Metric> on the estate's highest fixed cost.</p>
            </div>
            <div class="decide__item">
              <h2 class="decide__h"><span class="decide__n" aria-hidden="true">3</span>Hold loyalty spend; run a holdout</h2>
              <p class="decide__ev">Fund it only if measured lift clears <Metric id="decide.loyalty_needed" value={rel()!.loyalty.needed}>{fmtGbp(rel()!.loyalty.needed)}</Metric> per store-month; the best case here is <Metric id="decide.loyalty_upper" value={rel()!.loyalty.upper}>{fmtGbp(rel()!.loyalty.upper)}</Metric>.</p>
            </div>
            <div class="decide__item">
              <h2 class="decide__h"><span class="decide__n" aria-hidden="true">4</span>Rota to the week, not the season</h2>
              <p class="decide__ev">Seasonality p <Metric id="decide.season_p" value={bundle()!.evidence.season_p}>{fmtP(bundle()!.evidence.season_p)}</Metric>; weekend hours flat (p <Metric id="decide.hours_p" value={bundle()!.evidence.wk_hours_p}>{fmtP(bundle()!.evidence.wk_hours_p)}</Metric>). Promote weekend traffic, not basket size.</p>
            </div>
            <div class="decide__item decide__audit">
              <h2 class="decide__h">Source audit: trust the arithmetic, not the labels</h2>
              <p class="decide__ev">
                <Metric id="audit.holds" value={holds()}>{holds()}</Metric> of <Metric id="audit.tested" value={bundle()!.contract.length}>{bundle()!.contract.length}</Metric> documented promises hold.
                The status label contradicts its own bands on <Metric id="audit.status_mismatch" value={mismatches()}>{fmtInt(mismatches())}</Metric> store-months (re-derived here);
                daily sample vs P&L r <Metric id="audit.daily_r" value={bundle()!.evidence.daily_r}>{fmtR(bundle()!.evidence.daily_r, 3)}</Metric>.
              </p>
              <Show when={!props.poster}><button type="button" class="btn live-only" style={{ "margin-top": "8px" }} onClick={() => setAuditOpen(true)}>Open the 24-row audit</button></Show>
            </div>
          </section>
        </main>

        <Show when={!props.poster}>
          <footer class="foot live-only">
            Sources: OnyxData DataDNA October 2026 archive (sha256 b54effee…). Pooled margins; status and rent band re-derived from documented bands; the daily file is used as a sample only.
            Built with Python, DuckDB, Malloy and SolidJS; every number on this page is tagged and recomputed independently from curated Parquet.
            Accessibility: keyboard navigation on every chart (arrow keys between marks, Enter to drill), a data table behind each chart, colour never carries meaning alone, light and dark themes, reduced motion respected.
          </footer>
          <StoreDrawer bundle={bundle()!} id={view().store} onClose={closeStore} onRegion={(r) => commit({ ...EMPTY, region: [r] }, `Filtered to ${r}.`)} onEstate={() => commit({ ...EMPTY }, "Back to the whole estate.")} />
          <AuditDrawer bundle={bundle()!} open={auditOpen()} onClose={() => setAuditOpen(false)} />
          <TourOverlay open={tourOpen()} onClose={() => setTourOpen(false)} steps={TOUR} storageKey={TOUR_KEY} />
        </Show>
      </div>
    </Show>
  );
}

// ======================================================================== drawers
function useDialog(open: () => boolean, onClose: () => void) {
  let ref: HTMLDivElement | undefined;
  let prev: HTMLElement | null = null;
  createEffect(() => {
    if (open()) {
      prev = document.activeElement as HTMLElement;
      queueMicrotask(() => ref?.querySelector<HTMLElement>("button, [href], [tabindex]")?.focus());
    } else if (prev) {
      // if the opener was re-rendered, fall back to its replacement by accessible name
      const label = prev.getAttribute("aria-label");
      const target = prev.isConnected ? prev : label ? document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`) : null;
      target?.focus();
      prev = null;
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (!open() || !ref) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "Tab") {
      const f = [...ref.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));
  return (el: HTMLDivElement) => (ref = el);
}

function StoreDrawer(props: { bundle: Bundle; id: number | null; onClose: () => void; onRegion: (r: string) => void; onEstate: () => void }) {
  const store = createMemo(() => props.bundle.stores.find((s) => s.id === props.id) ?? null);
  const agg = createMemo(() => (props.id ? storeAggs(props.bundle).get(props.id) ?? null : null));
  const months = createMemo(() => (props.id ? storeMonths(props.bundle, props.id) : []));
  const setRef = useDialog(() => store() !== null, props.onClose);
  const W = 640;
  const H = 220;
  const lo = () => Math.min(0, ...months().map((m) => m.np));
  const hi = () => Math.max(...months().map((m) => m.rev)) * 1.05;
  const y = (v: number) => 12 + ((hi() - v) / (hi() - lo())) * (H - 40);
  const bw = () => (W - 20) / Math.max(1, months().length);
  return (
    <Show when={store() && agg()}>
      <div class="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
        <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="store-h" ref={setRef}>
          <nav aria-label="Drill path">
            <ol class="crumbs">
              <li><button type="button" onClick={props.onEstate}>Estate</button> ›</li>
              <li><button type="button" onClick={() => props.onRegion(store()!.region)}>{store()!.region.replace(/-/g, " ")}</button> ›</li>
              <li aria-current="page">{store()!.name}</li>
            </ol>
          </nav>
          <div class="drawer__head">
            <div>
              <h2 class="panel__title" id="store-h">{store()!.name}</h2>
              <p class="panel__note" style={{ "margin-top": "0" }}>{store()!.loc.replace(/-/g, " ")} · {store()!.format} · opened {store()!.opened} · {store()!.status_store}</p>
            </div>
            <button type="button" class="btn" onClick={props.onClose} aria-label="Close store detail">Close</button>
          </div>
          <div class="facts">
            <div class="kpi"><p class="kpi__label">Revenue / month</p><Metric id="drill.revenue_pm" value={agg()!.rev} class="kpi__value">{fmtGbp(agg()!.rev)}</Metric></div>
            <div class="kpi"><p class="kpi__label">Rent + staffing / month</p><Metric id="drill.fixed_pm" value={agg()!.fixed} class="kpi__value">{fmtGbp(agg()!.fixed)}</Metric></div>
            <div class="kpi"><p class="kpi__label">Margin (24 months)</p><Metric id="drill.margin" value={agg()!.margin} class="kpi__value">{fmtPct(agg()!.margin)}</Metric></div>
            <div class="kpi"><p class="kpi__label">Net profit / month</p><Metric id="drill.net_profit_pm" value={agg()!.np} class="kpi__value">{fmtGbp(agg()!.np)}</Metric></div>
            <div class="kpi"><p class="kpi__label">Loss months</p><Metric id="drill.loss_months" value={agg()!.lossMonths} class="kpi__value">{agg()!.lossMonths} / 24</Metric></div>
            <div class="kpi"><p class="kpi__label">Margin rank of 60</p><Metric id="drill.margin_rank" value={marginRank(props.bundle, props.id!)} class="kpi__value">{marginRank(props.bundle, props.id!)}</Metric></div>
          </div>
          <figure class="chartfig" style={{ margin: "0" }}>
            <figcaption class="panel__note">24 months: bars are net profit (cherry when negative); the grey line is revenue. Revenue swings month to month; the cost floor does not.</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly revenue and net profit for ${store()!.name}; full values in the table below`}>
              <line class="axis" x1="10" x2={W - 10} y1={y(0)} y2={y(0)} />
              <For each={months()}>
                {(m, i) => (
                  <rect x={10 + i() * bw() + 2} width={bw() - 4} y={Math.min(y(0), y(m.np))} height={Math.abs(y(0) - y(m.np))} fill={m.np < 0 ? "var(--loss)" : "var(--ink)"} data-metric={`drill.${m.m}.np`} data-value={m.np} />
                )}
              </For>
              <polyline fill="none" stroke="var(--revenue-ink)" stroke-width="2.5" points={months().map((m, i) => `${10 + i * bw() + bw() / 2},${y(m.rev)}`).join(" ")} />
              <text x="10" y={H - 6} font-size="13" class="t-muted">{months()[0]?.m}</text>
              <text x={W - 10} y={H - 6} font-size="13" class="t-muted" text-anchor="end">{months()[months().length - 1]?.m}</text>
            </svg>
          </figure>
          <table class="table">
            <caption class="sr-only">Monthly P&L for {store()!.name}</caption>
            <thead><tr><th scope="col">Month</th><th scope="col" class="n">Revenue</th><th scope="col" class="n">Rent + staffing</th><th scope="col" class="n">Net profit</th><th scope="col">Status (derived)</th><th scope="col">Supplied label</th></tr></thead>
            <tbody>
              <For each={months()}>
                {(m) => (
                  <tr>
                    <th scope="row">{m.m}</th>
                    <td class="n" data-metric={`drill.${m.m}.rev`} data-value={m.rev}>{fmtGbp(m.rev)}</td>
                    <td class="n">{fmtGbp(m.rent + m.staff)}</td>
                    <td class="n">{fmtGbp(m.np)}</td>
                    <td>{STATUS[m.st]}</td>
                    <td>{m.st === m.src ? "same" : STATUS[m.src]}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}

function AuditDrawer(props: { bundle: Bundle; open: boolean; onClose: () => void }) {
  const setRef = useDialog(() => props.open, props.onClose);
  return (
    <Show when={props.open}>
      <div class="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
        <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="audit-h" ref={setRef}>
          <div class="drawer__head">
            <h2 class="panel__title" id="audit-h">Source audit: 24 documented promises</h2>
            <button type="button" class="btn" onClick={props.onClose} aria-label="Close source audit">Close</button>
          </div>
          <p class="panel__note">Each row is a guarantee in the archive's data dictionary, tested against the delivered files (analysis/integrity.py). The arithmetic inside each table holds; the cross-table and label promises mostly do not.</p>
          <table class="table">
            <caption class="sr-only">Source contract</caption>
            <thead><tr><th scope="col">ID</th><th scope="col">Promise</th><th scope="col">Observed</th><th scope="col">Verdict</th></tr></thead>
            <tbody>
              <For each={props.bundle.contract}>
                {(c) => (
                  <tr>
                    <th scope="row">{c.id}</th>
                    <td>{c.promise}</td>
                    <td>{c.observed}</td>
                    <td><span class={`verdict verdict--${c.verdict}`}>{c.verdict}</span></td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}
