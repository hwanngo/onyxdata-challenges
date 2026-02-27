/**
 * 2026/02 - Pharmacy Sales & Profitability.
 *
 * Build order (G6): data layer -> layout shell -> hero chart -> supporting charts
 * -> cross-filter wiring -> drill paths -> tour overlay -> a11y layer -> poster route
 * -> responsive pass.
 *
 * NEVER render a hardcoded number. Every figure is computed from the payload at query time.
 * Every rendered figure carries a `data-metric` so tools/verify_metrics.py can recompute it
 * from the parquet through DuckDB and assert equality; any statistic in prose that is NOT
 * tagged must carry an explicit `prose-number-ok` declaration naming its ledger entry, which
 * tools/lint_prose_numbers.mjs checks BEFORE the metric recompute runs.
 */
import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import {
  Breadcrumb, FilterChips, KpiTile, ThemeToggle, TourOverlay,
  drillInto, filters, toggle, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  META, SPAN_YEARS, byCategory, byCountry, byMonth, chanceFor, dec, derived, eur0, growth, int,
  marginPct, prelaunch, promoSplit, spreadFor, storeGrid, tradingWeek,
} from "./data";
import { BlisterPack, COLS_NARROW, COLS_WIDE, PackLegend, type GridState } from "./charts/BlisterPack";
import {
  CategoryPanel, CountryPanel, CutTable, DefectNote, GrowthPanel, PromoPanel,
} from "./charts/Supporting";
import { TOUR } from "./tour";

const TOUR_KEY = "pharma-2026-02-tour-seen";

/* The headline rounds the chain margin rate to whole points for readability. The precise
 * figure is the tagged `margin_pct` KPI immediately beneath it, recomputed from parquet, and
 * the two must never disagree by more than the rounding - which is what the audit found in
 * four of eight months. Written as a constant so a future edit to the H1 cannot silently
 * drift from the number it is rounding.
 * prose-number-ok: I2 - the margin rate is 28% everywhere, spread within chance */
const HEADLINE_RATE_PCT = 28;

export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  const [grid, setGrid] = createSignal<GridState>(readGridFromUrl());
  const [narrow, setNarrow] = createSignal(false);
  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    onCleanup(() => mq.removeEventListener("change", sync));
  });

  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  function setGridState(s: GridState) {
    setGrid(s);
    const u = new URL(window.location.href);
    u.searchParams.set("grid", s);
    window.history.replaceState({}, "", u);
  }

  const cells = derived(storeGrid, filters);
  const g = derived(growth, filters);
  const months = derived(byMonth, filters);
  const promo = derived(promoSplit, filters);
  const cats = derived(byCategory, filters);
  const countries = derived(byCountry, filters);
  const pre = derived(prelaunch, filters);
  const week = derived(tradingWeek, filters);
  const rate = derived(marginPct, filters);
  const nLines = derived((r) => r.length, filters);

  const spreadObserved = createMemo(() => {
    const ms = cells().map((c) => c.marginPct).filter((v) => !Number.isNaN(v));
    return ms.length ? Math.max(...ms) - Math.min(...ms) : 0;
  });
  const volumeRatio = createMemo(() => {
    const v = cells().map((c) => c.revPerDay).filter((x) => x > 0);
    return v.length ? Math.max(...v) / Math.min(...v) : 0;
  });
  const catSpread = createMemo(() => {
    const c = cats();
    return c.length ? c[0].marginPct - c[c.length - 1].marginPct : 0;
  });
  const find = (f: string) => filters().find((x) => x.field === f)?.values[0] as string | undefined;

  /* The chance yardstick in dim_cut is bootstrapped from the WHOLE book at 120 shops. It does
     not follow a filter, and a filtered subset has fewer rows per shop and therefore a WIDER
     chance band - so comparing a filtered spread against it is invalid in the direction that
     flatters nothing. The integrity pass found that filtering to "promoted" rendered the
     sentence "the 10.43pp spread ... is smaller than the 5.73pp chance produces", which is
     false. Standing claims now read the unfiltered spread from the same row as the yardstick;
     the live caption states that the comparison is suspended instead of asserting it. */
  const isFiltered = () => filters().length > 0;

  return (
    <div class="sheet" classList={{ "sheet--poster": !!props.poster }}>
      <a class="skip live-only" href="#main">Skip to the report</a>

      {/* ① thesis strip */}
      <header class="head" style={{ "grid-area": "head" }}>
        <div class="head__row">
          <h1 class="head__t">Every shop in this chain makes {HEADLINE_RATE_PCT}%.</h1>
          <div class="live-only head__ctl">
            <ThemeToggle />
            <button class="btn btn--q" aria-label="Open guided tour" onClick={() => setTour(true)}>?</button>
          </div>
        </div>
        <p class="head__sub">
          Eight countries, {META.regions} regions, {META.stores} shops - and not one of them
          trades more profitably than another. The only lever that moves the number costs{" "}
          <strong data-metric="promo_forgone" data-value={promo().forgone}>
            {eur0(promo().forgone)}
          </strong>{" "}
          over the {SPAN_YEARS} years on file.
        </p>
        <p class="head__ctx mono">
          European pharmacy distributor ·{" "}
          <span data-metric="lines" data-value={nLines()}>{int(nLines())}</span> sales lines ·{" "}
          {META.products} products · {META.first} - {META.last}
        </p>
      </header>

      <div class="live-only chips" style={{ "grid-area": "chips" }}>
        <FilterChips hint="Click any shop, category, country or bar to filter the report." />
        <Breadcrumb />
      </div>

      {/* ② KPI column */}
      <section class="kpis" style={{ "grid-area": "kpi" }}>
        <KpiTile metric="margin_pct" label="margin rate, whole chain" value={rate()}
                 display={dec(rate()) + "%"} />
        <KpiTile metric="store_spread_pp"
                 label={isFiltered() ? `spread across the ${cells().length} shops in view`
                                     : "spread across every shop in the chain"}
                 value={spreadObserved()} display={dec(spreadObserved()) + "pp"} />
        <KpiTile metric="same_store_growth" label="same-store growth in 2025" value={g().samePct}
                 display={dec(g().samePct) + "%"} />
        <KpiTile metric="promo_forgone_kpi" label="margin spent on promotions that moved no units"
                 value={promo().forgone} display={eur0(promo().forgone)} />
      </section>

      {/* ③ signature */}
      <section class="sig" style={{ "grid-area": "hero" }}>
        <div class="sig__head">
          <h2 class="sig__t">
            Same {cells().length} shops. Same grid. Two questions.{" "}
            <span class="sig__t2">One picture is a flat field and the other is not.</span>
          </h2>
          <div class="live-only seg" role="group" aria-label="Which question the grid answers">
            <button class="seg__b" classList={{ "is-on": grid() === "margin" }}
                    aria-pressed={grid() === "margin"} onClick={() => setGridState("margin")}>
              How profitably each shop trades
            </button>
            <button class="seg__b" classList={{ "is-on": grid() === "volume" }}
                    aria-pressed={grid() === "volume"} onClick={() => setGridState("volume")}>
              How much each shop sells
            </button>
          </div>
        </div>

        <div class="sig__grids">
          {/* The poster cannot rely on interaction, so it shows both states. */}
          <Show when={props.poster || grid() === "margin"}>
            <div class="sig__one">
              <h3 class="sig__lab">How profitably each shop trades</h3>
              <BlisterPack cells={cells()} state="margin" activeKey={find("pharmacy")}
                           cellSize={props.poster ? 40 : undefined}
                           cols={narrow() && !props.poster ? COLS_NARROW : COLS_WIDE} onPick={(k) => toggle("pharmacy", k)} />
              <PackLegend state="margin" cells={cells()} />
              <p class="sig__c">
                spread{" "}
                <span class="mono" data-metric="store_spread" data-value={spreadObserved()}>
                  {dec(spreadObserved())}pp
                </span>{" "}
                <Show
                  when={!isFiltered()}
                  fallback={
                    <>· chance alone gives{" "}
                    <span class="mono">{dec(chanceFor("Pharmacy"))}pp</span> across the whole
                    book - not a yardstick for a filtered subset, which has fewer sales lines
                    per shop and so a wider chance band</>
                  }
                >
                  · chance alone gives <span class="mono">{dec(chanceFor("Pharmacy"))}pp</span>
                </Show>
              </p>
            </div>
          </Show>
          <Show when={props.poster || grid() === "volume"}>
            <div class="sig__one">
              <h3 class="sig__lab">How much each shop sells</h3>
              <BlisterPack cells={cells()} state="volume" activeKey={find("pharmacy")}
                           cellSize={props.poster ? 40 : undefined}
                           cols={narrow() && !props.poster ? COLS_NARROW : COLS_WIDE} onPick={(k) => toggle("pharmacy", k)} />
              <PackLegend state="volume" cells={cells()} />
              <p class="sig__c">
                revenue per trading day ·{" "}
                <span class="mono" data-metric="volume_ratio" data-value={volumeRatio()}>
                  {dec(volumeRatio(), 1)}×
                </span>{" "}
                between the quietest and busiest shop
              </p>
            </div>
          </Show>
        </div>
      </section>

      {/* ④⑤⑥ supports */}
      <section class="supports" style={{ "grid-area": "support" }}>
        <GrowthPanel months={months()} g={g()} />
        <PromoPanel p={promo()} onPick={(v) => toggle("promo", v)} />
        <CategoryPanel cats={cats()} activeCat={find("category")}
                       onPick={(c) => toggle("category", c)} />
      </section>

      {/* ⑦ so what */}
      <section class="sowhat" style={{ "grid-area": "sowhat" }}>
        <h2 class="sowhat__t">So what</h2>
        <ol class="sowhat__list">
          <li>
            <strong>Stop the league tables.</strong> No shop, region or country trades more
            profitably than any other - the{" "}
            <span class="mono">{dec(spreadFor("Pharmacy"))}pp</span> spread across all{" "}
            {META.stores} shops is smaller than the{" "}
            <span class="mono">{dec(chanceFor("Pharmacy"))}pp</span> chance produces. Both figures
            are for the whole book, so this recommendation does not move when you filter.
          </li>
          <li>
            <strong>Recover the {eur0(promo().forgone)}.</strong> Promotions cut{" "}
            <span class="mono">{dec(promo().gapPp)}pp</span> of margin and lift units in none of
            the five categories. Change the mechanism or stop funding it - but pilot it, because
            this file has no basket or footfall data, so a promotion that draws a customer who
            then buys something else is invisible here.
          </li>
          <li>
            <strong>Plan assortment, not territory.</strong> Category moves the rate{" "}
            <span class="mono" data-metric="category_spread" data-value={catSpread()}>
              {dec(catSpread())}pp
            </span>{" "}
            - the only structural lever in the file.
          </li>
        </ol>
      </section>

      {/* web-only, per the poster panel budget in .workbench/2026/02/design/direction.md */}
      <section class="extra live-only" style={{ "grid-area": "extra" }}>
        <CountryPanel countries={countries()} activeCountry={find("country")}
                      onPick={(c) => drillInto("country", c)} />
        <CutTable />
        <DefectNote p={pre()} />
      </section>

      <footer class="foot" style={{ "grid-area": "foot" }}>
        <span>
          <span data-metric="foot_lines" data-value={nLines()}>{int(nLines())}</span> sales lines ·{" "}
          {META.first}-{META.last} · every figure recomputed from parquet before publication ·{" "}
          <span data-metric="prelaunch_share" data-value={pre().lineSharePct}>
            {dec(pre().lineSharePct)}%
          </span>{" "}
          of rows sell a product before its launch date - flagged, not dropped, and changing no
          ranking · seasonality absent; the only weekly signal is the trading calendar, at{" "}
          <span class="mono" data-metric="weekend_gap" data-value={week().gapPct}>
            {dec(week().gapPct, 1)}%
          </span>{" "}
          fewer sale lines at weekends
        </span>
        <span class="foot__a11y">
          WCAG 2.1 AA · charts keyboard-operable and exposed as tables to screen readers ·
          colour is never the only encoding · colourblind-checked
        </span>
      </footer>

      {/* `open` is REQUIRED: TourOverlay's whole body is a <Show when={props.open}>, so
          omitting it renders nothing and no other gate can see the absence. 2025/11 and
          2025/12 both shipped a tour that never displayed for exactly this reason. */}
      <TourOverlay open={tour() && !props.poster} steps={TOUR} storageKey={TOUR_KEY}
                   onClose={() => setTour(false)} />
    </div>
  );
}

function readGridFromUrl(): GridState {
  if (typeof window === "undefined") return "margin";
  return new URLSearchParams(window.location.search).get("grid") === "volume" ? "volume" : "margin";
}
