/**
 * 2026/04 - International Maritime Logistics & Terminal Efficiency.
 *
 * Every rendered figure carries a `data-metric` so verify_metrics.py can recompute it from
 * the parquet through DuckDB. Any statistic in prose that is NOT tagged carries an explicit
 * `prose-number-ok` declaration naming its ledger entry.
 */
import { Show, createMemo, createSignal, onMount } from "solid-js";
import {
  Breadcrumb, FilterChips, KpiTile, ThemeToggle, TourOverlay,
  drillInto, filters, toggle, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  CUTS, DATES_IN_SUEZ, META, YEARS, byTerminal, dec, defects, derived, growth, histogram,
  int, movements, overlays, sci, suezWindow,
} from "./data";
import { CutStrip, FlatLine } from "./charts/FlatLine";
import { CutPanel, DefectPanel, GrowthPanel, SuezPanel, TerminalPanel } from "./charts/Supporting";
import { TOUR } from "./tour";

const TOUR_KEY = "maritime-2026-04-tour-seen";

/* Statistics quoted in captions. These are outputs of tests over the WHOLE file in
 * analysis/integrity.py, not aggregates of the filtered view, so no data-metric can own them.
 * One constant per sentence, each carrying its own ledger reference.
 */
// prose-number-ok: I3 - the Suez disruption is not in the data
const SUEZ_MW_P = "0.504";
// prose-number-ok: I1 - nothing predicts move_duration; KS of the duration column vs uniform
const KS_UNIFORM_P = "0.6129";
// prose-number-ok: I1 - Cohen's floor for a "small" effect, the yardstick the eta2 is read against
const COHEN_SMALL = "0.01";
// prose-number-ok: I6 - what would have to be true; the VP's stated target, quoted from the brief
const VP_TARGET = "15%";

export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  const [iso, setIso] = createSignal<string | undefined>(readIsoFromUrl());

  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  function setIsolated(k: string | undefined) {
    setIso(k);
    const u = new URL(window.location.href);
    if (k) u.searchParams.set("cut", k);
    else u.searchParams.delete("cut");
    window.history.replaceState({}, "", u);
  }

  const counts = derived((r) => histogram(r), filters);
  const overs = derived((r) => overlays(r), filters);
  const years = derived(growth, filters);
  const suez = derived(suezWindow, filters);
  const terms = derived(byTerminal, filters);
  const defs = derived(defects, filters);
  const nMoves = derived(movements, filters);
  const suezWeekN = derived(
    (r) => { let n = 0; for (const i of r) if (DATES_IN_SUEZ.has(i)) n++; return n; },
    filters,
  );

  const largest = createMemo(() => [...CUTS].sort((a, b) => b.eta2 - a.eta2)[0]);
  const find = (f: string) => filters().find((x) => x.field === f)?.values[0] as string | undefined;

  return (
    <div class="sheet" classList={{ "sheet--poster": !!props.poster }}>
      <a class="skip live-only" href="#main">Skip to the report</a>

      <header class="head" style={{ "grid-area": "head" }}>
        <div class="head__row">
          <h1 class="head__t">There is one real number in this dataset.</h1>
          <div class="live-only head__ctl">
            <ThemeToggle />
            <button class="btn btn--q" aria-label="Open guided tour" onClick={() => setTour(true)}>?</button>
          </div>
        </div>
        <p class="head__sub">
          Cargo movements grow every year. Because 2021 is the lowest, that ramp looks like the
          Suez disruption - and there was no disruption. Nothing else in the file varies at all.
        </p>
        <p class="head__ctx mono">
          Global Maritime Solutions ·{" "}
          <span data-metric="movements" data-value={nMoves()}>{int(nMoves())}</span> movements ·{" "}
          {META.terminals} terminals · {int(META.vessels)} vessels · {META.first} - {META.last}
        </p>
      </header>

      <div class="live-only chips" style={{ "grid-area": "chips" }}>
        <FilterChips hint="Click a hub, terminal, vessel category or year to filter the report." />
        <Breadcrumb />
      </div>

      <section class="kpis" style={{ "grid-area": "kpi" }}>
        <KpiTile metric="largest_eta2" label="the largest effect any factor has on move duration"
                 value={largest().eta2} display={sci(largest().eta2)} />
        {/* A Mann-Whitney statistic cannot be recomputed in SQL, so it must not wear a
            data-metric - a tag nothing can verify is worse than no tag. The tile shows the
            movement count for the blockage week, which IS recomputable, and the p-value sits
            in the label as a declared prose number. */}
        <KpiTile metric="suez_week_movements"
                 label={`movements in the blockage week - Mann-Whitney p = ${SUEZ_MW_P} against every other day`}
                 value={suezWeekN()} display={int(suezWeekN())} />
        <KpiTile metric="movement_id_distinct"
                 label={`distinct values of "movement_id" across ${int(META.movements)} rows`}
                 value={META.movementIdDistinct} display={int(META.movementIdDistinct)} />
      </section>

      <section class="sig" style={{ "grid-area": "hero" }} id="main">
        <h2 class="sig__t">
          Twenty bins. {int(nMoves())} movements. Every duration equally likely.
        </h2>
        <FlatLine counts={counts()} compact={props.poster} />
        {/* WEB ONLY. The G5 panel budget is ten objects and the strip would be an eleventh
            - exactly the drift the budget exists to prevent. On the poster its claim is
            carried by the eta-squared panel, which is in the budget. */}
        <div class="live-only"><CutStrip overlays={overs()} isolated={iso()} onIsolate={setIsolated} /></div>
        <p class="sig__c">
          Kolmogorov-Smirnov against Uniform(0,1000): <span class="mono">p = {KS_UNIFORM_P}</span>.
          The shaded band is ±2 standard errors of a uniform - every bar sits inside it. The
          largest effect any factor has on this distribution is{" "}
          <span class="mono">η² = {sci(largest().eta2)}</span>, against {COHEN_SMALL} for what is worth
          calling small.
        </p>
      </section>

      <section class="supports" style={{ "grid-area": "support" }}>
        <GrowthPanel years={years()} chi2={YEARS[0].daily_chi2_df}
                     chance={YEARS[0].chance_chi2_df_max}
                     onPick={(y) => toggle("year", y)} />
        <SuezPanel days={suez()} />
        <CutPanel />
      </section>

      <section class="sowhat" style={{ "grid-area": "sowhat" }}>
        <h2 class="sowhat__t">What would have to be collected</h2>
        <p class="sowhat__lead">
          The VP asked for a {VP_TARGET} reduction in movement times. This data cannot locate a single
          hour of it. Seven columns would make the same three questions answerable:
        </p>
        <ol class="sowhat__list">
          <li><strong>terminal_capacity</strong> - absent; the brief itself concedes it "should be added"</li>
          <li><strong>queue / wait time</strong> - there is one duration and no stages to decompose it into</li>
          <li><strong>arrival and departure timestamps</strong> rather than a scalar hour count</li>
          <li><strong>a unique movement key</strong> - the present one has {int(META.movementIdDistinct)} values for {int(META.movements)} rows</li>
          <li><strong>shift on the movement</strong>, not on the date - a whole day is currently "Day" or "Night"</li>
          <li><strong>one vessel key</strong>, not two disagreeing on {int(META.badVesselRows)} rows</li>
          <li><strong>a hub label tied to geography</strong> - the present one does not predict longitude</li>
        </ol>
      </section>

      <section class="extra live-only" style={{ "grid-area": "extra" }}>
        <TerminalPanel rows={terms()} active={find("terminal")}
                       onPick={(t) => drillInto("terminal", t)} />
        <DefectPanel corruptRows={defs().corruptRows} corruptPct={defs().corruptPct} />
      </section>

      <footer class="foot" style={{ "grid-area": "foot" }}>
        <span>
          <span data-metric="foot_movements" data-value={nMoves()}>{int(nMoves())}</span>{" "}
          movements · {META.first}-{META.last} · every figure recomputed from parquet before
          publication · the data dictionary shipped in the archive is wrong in eleven places,
          listed in the report · <strong>no map is drawn</strong>: terminal coordinates are
          uniform over the globe and the hub label is not geographic
        </span>
        <span class="foot__a11y">
          WCAG 2.1 AA · charts keyboard-operable and exposed as tables to screen readers ·
          colour is never the only encoding · colourblind-checked
        </span>
      </footer>

      {/* `open` is REQUIRED: TourOverlay's body is a <Show when={props.open}>, so omitting it
          renders nothing and no gate can see the absence. 2025/11 and 2025/12 both shipped a
          tour that never displayed for exactly this reason. */}
      <TourOverlay open={tour() && !props.poster} steps={TOUR} storageKey={TOUR_KEY}
                   onClose={() => setTour(false)} />
    </div>
  );
}

function readIsoFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("cut") ?? undefined;
}
