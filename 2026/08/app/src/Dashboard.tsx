import {
  Breadcrumb,
  FilterChips,
  ThemeToggle,
  TourOverlay,
  clearAll,
  drillInto,
  filters,
  type TourStep,
} from "@onyxdata/dna-kit";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { BrokenCircuit } from "./charts/Circuit";
import {
  ClaimScorecard,
  ContractList,
  ControlsPanel,
  ExposurePanel,
  OpenLead,
  StatusPanel,
  ValidatorPanel,
} from "./charts/Evidence";
import {
  activeTopic,
  boot,
  claims,
  connectors,
  contracts,
  controls,
  defects,
  exposureBins,
  headline,
  int,
  monthEndCashout,
  percent,
  pp,
  pvalue,
  ready,
  signed,
  statusAlignment,
  type Filter,
  type Headline,
  type Topic,
} from "./data";

const TOUR_KEY = "dna-2026-08-tour";

function tour(h: Headline): TourStep[] {
  return [
    {
      h: "The instrument is live",
      p: `Positive loss presence matches the fraud flag on ${int(h.positive_control_rows)} of ${int(h.transactions)} rows. The dashboard can detect the one relationship the archive deliberately encodes.`,
    },
    {
      h: "Controls do not reach event flags",
      p: `${h.main_effect_survivors} of ${h.main_effect_tests} prespecified effects and ${h.interaction_survivors} of ${h.interaction_tests} exploratory interactions survive correction. The largest continuous fraud relationship is ${signed(h.max_abs_continuous_r)}.`,
    },
    {
      h: "Flags do not reach outcomes",
      p: `Reversal and dispute agreement are indistinguishable from chance. Their phi coefficients are ${signed(h.reversal_phi)} and ${signed(h.dispute_phi)}.`,
    },
    {
      h: "Loss does not reconcile with exposure",
      p: `Recorded loss and recorded amount correlate ${signed(h.loss_amount_r)}. Loss exceeds amount on ${int(h.loss_exceeds_amount_rows)} flagged rows, so no financially weighted recommendation is defensible.`,
    },
    {
      h: "The validator tested another schema",
      p: `The supplied report says ${h.validation_checks_passed} checks passed. In the delivered files, ${h.matching_constraint_names} configured constraint names match and ${h.missing_relationships} configured relationships require absent columns.`,
    },
    {
      h: "Confirm — do not deploy",
      p: `Month-end Cash-Out reversal is ${pp(h.cashout_month_end_reversal_diff_pp)} with a confidence interval from ${pp(h.cashout_month_end_reversal_ci_low_pp)} to ${pp(h.cashout_month_end_reversal_ci_high_pp)} and p ${pvalue(h.cashout_month_end_reversal_p)}. Preregister and retest it on a holdout period.`,
    },
  ];
}

export default function Dashboard(props: { poster?: boolean }) {
  const [tourOpen, setTourOpen] = createSignal(false);
  const [failed, setFailed] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await boot();
      if (!props.poster) {
        try {
          if (localStorage.getItem(TOUR_KEY) !== "1") setTourOpen(true);
        } catch {
          setTourOpen(true);
        }
      }
    } catch (error) {
      setFailed(String(error));
    }
  });

  const onQuestion = (event: KeyboardEvent) => {
    if (event.key === "?" && !props.poster) setTourOpen(true);
  };
  window.addEventListener("keydown", onQuestion);
  onCleanup(() => window.removeEventListener("keydown", onQuestion));

  const topic = createMemo(() => activeTopic(filters() as Filter[]));
  const focusedConnector = createMemo(() => {
    const current = topic();
    return current
      ? connectors().find((item) => {
          const map: Record<Topic, string> = {
            controls: "controls_to_flags",
            status: "flags_to_outcomes",
            finance: "exposure_to_loss",
            validation: "validator_to_files",
            "positive-control": "fraud_flag_to_loss_presence",
            lead: "month_end_cashout_to_reversal",
            claims: "controls_to_flags",
          };
          return item.connector_id === map[current];
        })
      : null;
  });

  const drillDecision = () => {
    const item = focusedConnector();
    if (item) drillInto("decision", item.decision);
  };

  return (
    <div class="bench" classList={{ "bench--poster": Boolean(props.poster) }}>
      <a class="skip" href="#signature">Skip to the Broken Circuit</a>

      <header class="status-rail">
        <div>
          <span class="status-rail__eyebrow">Risk evidence diagnostic</span>
          <span>PayPesa synthetic archive</span>
        </div>
        <Show when={ready() && headline()}>
          {(h) => (
            <div class="status-rail__context">
              <span data-metric="transactions" data-value={h().transactions}>{int(h().transactions)} transactions</span>
              <span>{h().date_start}—{h().date_end}</span>
              <span data-metric="markets" data-value={h().markets}>{h().markets} markets</span>
              <span data-metric="channels" data-value={h().channels}>{h().channels} channel types</span>
            </div>
          )}
        </Show>
        <div class="status-rail__legend" aria-label="Evidence status legend">
          <span><i class="legend-mark legend-mark--fault" /> Broken</span>
          <span><i class="legend-mark legend-mark--good" /> Connected</span>
          <span><i class="legend-mark legend-mark--open" /> Open</span>
        </div>
        <div class="live-only status-rail__tools">
          <ThemeToggle />
          <button class="btn tour-btn" aria-label="Open guided tour" onClick={() => setTourOpen(true)}>Tour</button>
        </div>
      </header>

      <div class="live-only controls-strip">
        <FilterChips
          labels={{ topic: "Evidence", decision: "Decision" }}
          hint="Click any circuit lane or evidence mark to cross-filter the diagnostic bench."
        />
        <Breadcrumb />
      </div>

      <Show when={failed()}>
        <p class="error" role="alert">Could not load the evidence model: {failed()}</p>
      </Show>

      <Show when={ready() && headline()} fallback={<div class="loading" aria-label="Loading evidence"><span /><span /><span /></div>}>
        {(h) => (
          <>
            <section class="thesis-block">
              <div class="thesis-block__copy">
                <p class="section-kicker">Diagnostic conclusion</p>
                <h1>Connected tables.<br /><em>Disconnected risk.</em></h1>
                <p class="thesis-block__standfirst">
                  The archive forms a clean star schema, but controls do not predict flags, flags do
                  not reconcile with outcomes, loss does not reconcile with exposure, and the
                  validator does not test the delivered files. Convincing mechanics; no defensible
                  risk prioritisation.
                </p>
              </div>
              <button
                class="positive-control"
                type="button"
                disabled={props.poster}
                aria-label={`Positive control: ${int(h().positive_control_rows)} of ${int(h().transactions)} rows align`}
                onClick={() => !props.poster && drillInto("topic", "positive-control")}
              >
                <span class="positive-control__label">Positive control</span>
                <span class="positive-control__trace" aria-hidden="true"><i /><b /><i /></span>
                <strong>
                  <span data-metric="positive_control_rows" data-value={h().positive_control_rows}>
                    {int(h().positive_control_rows)}
                  </span>
                  {" / "}
                  <span data-metric="transactions" data-value={h().transactions}>
                    {int(h().transactions)}
                  </span>
                </strong>
                <small>fraud flag → positive loss presence</small>
              </button>
            </section>

            <section class="signature-block">
              <div class="section-heading">
                <div>
                  <p class="section-kicker">Expected evidence chain</p>
                  <h2>The Broken Circuit</h2>
                </div>
                <p>Four mechanically connected modules terminate before the decision evidence they claim to carry.</p>
              </div>
              <BrokenCircuit connectors={connectors()} headline={h()} poster={props.poster} />
            </section>

            <section class="support-grid" aria-label="Broken connector evidence">
              <ControlsPanel controls={controls()} headline={h()} poster={props.poster} />
              <StatusPanel rows={statusAlignment()} poster={props.poster} />
              <ExposurePanel bins={exposureBins()} headline={h()} poster={props.poster} />
              <ValidatorPanel contracts={contracts()} headline={h()} poster={props.poster} />
            </section>

            <section class="lead-block">
              <OpenLead rows={monthEndCashout()} headline={h()} poster={props.poster} />
            </section>

            <Show when={!props.poster}>
              <aside class="evidence-drawer" aria-label="Evidence drawer">
                <div class="evidence-drawer__head">
                  <div>
                    <p class="section-kicker">Selected evidence</p>
                    <h2>{focusedConnector()?.label ?? "Choose a circuit lane"}</h2>
                  </div>
                  <Show when={filters().length}>
                    <button class="btn chip--clear" onClick={clearAll}>Clear all</button>
                  </Show>
                </div>
                <Show
                  when={topic()}
                  fallback={<p class="drawer-empty">The full diagnostic remains visible. Select any circuit break to inspect its formula, population and decision boundary.</p>}
                >
                  <Show when={focusedConnector()}>
                    {(item) => (
                      <div class="drawer-summary">
                        <span class={`status-pill status-pill--${item().status.toLowerCase()}`}>{item().status}</span>
                        <p><b>{item().from_node} → {item().to_node}</b></p>
                        <p>{item().primary_display} · {item().secondary_display}</p>
                        <p class="muted">{item().evidence}</p>
                        <button class="btn btn--primary" onClick={drillDecision}>Drill to decision</button>
                      </div>
                    )}
                  </Show>
                  <Show when={topic() === "controls" || topic() === "lead" || topic() === "claims"}>
                    <ClaimScorecard claims={claims()} />
                  </Show>
                  <Show when={topic() === "validation"}>
                    <ContractList contracts={contracts()} />
                  </Show>
                  <Show when={topic() === "finance"}>
                    <div class="drawer-detail">
                      <h3>Financial decision boundary</h3>
                      <p>
                        Recorded loss versus recorded amount has r {signed(h().loss_amount_r)}.
                        Loss exceeds amount on <b data-metric="loss_exceeds_amount_rows" data-value={h().loss_exceeds_amount_rows}>{int(h().loss_exceeds_amount_rows)}</b> flagged rows.
                      </p>
                      <p>Do not publish loss severity, market exposure, ROI or revenue impact from these magnitudes.</p>
                    </div>
                  </Show>
                  <Show when={topic() === "status"}>
                    <div class="drawer-detail">
                      <h3>Two status systems, no chronology</h3>
                      <For each={statusAlignment()}>
                        {(row) => <p><b>{row.event}</b>: φ {signed(row.phi)} · p {pvalue(row.p_value)} · {percent(row.agreement)} agreement.</p>}
                      </For>
                    </div>
                  </Show>
                  <Show when={topic() === "positive-control"}>
                    <div class="drawer-detail">
                      <h3>Why the green bus matters</h3>
                      <p>The analysis recovers the one designed switch on every row. The nulls elsewhere are measurements, not a broken instrument.</p>
                    </div>
                  </Show>
                </Show>
              </aside>
            </Show>

            <footer class="colophon">
              <p>
                Source: original Onyx Data archive · synthetic-file diagnosis, not a claim about
                African markets or gig workers · invalid currency and loss totals deliberately
                excluded · every displayed value recomputed from curated Parquet.
              </p>
              <p>
                Accessibility: WCAG AA contrast, keyboard-operable SVG marks, direct status labels,
                screen-reader data tables and reduced-motion support.
              </p>
            </footer>
          </>
        )}
      </Show>

      <Show when={ready() && headline()}>
        {(h) => (
          <TourOverlay
            open={tourOpen()}
            onClose={() => setTourOpen(false)}
            steps={tour(h())}
            storageKey={TOUR_KEY}
          />
        )}
      </Show>
    </div>
  );
}
