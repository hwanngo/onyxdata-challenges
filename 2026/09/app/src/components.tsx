import { For, Show, createEffect, type JSX } from "solid-js";
import {
  int,
  measureLabel,
  pct,
  signed,
  type Claim,
  type CollectionRequirement,
  type DataBundle,
  type Focus,
  type Headline,
  type MeasureContract,
  type ProcessLink,
  type RolledCorridor,
  type SourceContract,
} from "./data";

export function Metric(props: {
  name: string;
  value: number;
  class?: string;
  children?: JSX.Element;
}) {
  return (
    <span class={props.class} data-metric={props.name} data-value={String(props.value)}>
      {props.children ?? int(props.value)}
    </span>
  );
}

type TableCell = string | number | null | undefined;

export function ChartFigure(props: {
  id?: string;
  class?: string;
  title: string;
  summary: string;
  headers: string[];
  rows: TableCell[][];
  children: JSX.Element;
}) {
  return (
    <figure id={props.id} class={`chartfig ${props.class ?? ""}`} aria-label={props.summary}>
      <figcaption>
        <h2>{props.title}</h2>
        <p>{props.summary}</p>
      </figcaption>
      {props.children}
      <div class="sr-only">
        <table class="sr-table">
          <caption>{props.title}</caption>
          <thead>
            <tr>
              <For each={props.headers}>{(header) => <th scope="col">{header}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row) => (
                <tr>
                  <For each={row}>{(cell) => <td>{cell ?? "Not available"}</td>}</For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function DiagnosticRail(props: {
  headline: Headline;
  startDate: string;
  endDate: string;
}) {
  return (
    <div class="diagnostic-rail" role="region" aria-label="Source audit status">
      <span class="rail-title">Source audit</span>
      <span>Golden Wok</span>
      <span>{props.startDate}—{props.endDate}</span>
      <Metric name="order_rows" value={props.headline.order_rows}>
        {int(props.headline.order_rows)} orders
      </Metric>
      <span class="rail-boundary">Allocation safe / performance unavailable</span>
      <span class="rail-key" aria-label="Legend">
        <b>■</b> allocated <b>Q</b> quarantined <b>×</b> contradicted <b>?</b> unsupported
      </span>
    </div>
  );
}

export function SignalStrip(props: {
  headline: Headline;
  corridorPairs: number;
  riderPairs: number;
  processLinkCount: number;
}) {
  return (
    <div class="signal-strip" aria-label="Decision signals">
      <div class="signal">
        <Metric name="selected.kitchen_zone_pairs" value={props.corridorPairs} class="signal-value" />
        <span class="signal-denominator">/ {props.headline.kitchens * props.headline.zones}</span>
        <span class="signal-label">corridors populated</span>
      </div>
      <div class="signal">
        <Metric name="selected.kitchen_rider_pairs" value={props.riderPairs} class="signal-value" />
        <span class="signal-denominator">/ {props.headline.kitchens * props.headline.riders}</span>
        <span class="signal-label">rider × kitchen pairs</span>
      </div>
      <div class="signal">
        <Metric
          name="process_links_surviving_correction"
          value={props.headline.process_links_surviving_correction}
          class="signal-value"
        />
        <span class="signal-denominator">/ {props.processLinkCount}</span>
        <span class="signal-label">expected links survive</span>
      </div>
      <div class="signal signal--warn">
        <Metric
          name="quarantined_measures"
          value={props.headline.quarantined_measures}
          class="signal-value"
        />
        <span class="signal-denominator">/ {props.headline.quarantined_measures}</span>
        <span class="signal-label">measures quarantined</span>
      </div>
    </div>
  );
}

function numericId(value: string) {
  const suffix = Number(value.split("_").at(-1));
  return Number.isFinite(suffix) ? suffix : 0;
}

export function AllocationMatrix(props: {
  corridors: RolledCorridor[];
  poster: boolean;
  focus: Focus | null;
  onSelect: (corridor: RolledCorridor) => void;
}) {
  const kitchens = () =>
    [...new Map(props.corridors.map((row) => [row.kitchen_id, row.kitchen_name])).entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    );
  const zones = () =>
    [...new Map(props.corridors.map((row) => [row.zone_id, row.zone_name])).entries()].sort(
      ([left], [right]) => numericId(left) - numericId(right),
    );
  const max = () => Math.max(1, ...props.corridors.map((row) => row.filtered_order_rows));
  const selectedId = () => (props.focus?.kind === "corridor" ? props.focus.id : "");
  const cell = (kitchenId: string, zoneId: string) =>
    props.corridors.find((row) => row.kitchen_id === kitchenId && row.zone_id === zoneId)!;
  const moveCellFocus = (event: KeyboardEvent & { currentTarget: HTMLButtonElement }) => {
    const grid = event.currentTarget.closest(".matrix-grid");
    const cells = Array.from(
      grid?.querySelectorAll<HTMLButtonElement>(".matrix-cell:not(:disabled)") ?? [],
    );
    const current = cells.indexOf(event.currentTarget);
    const columns = zones().length;
    let next = current;
    if (event.key === "ArrowRight") next = Math.min(cells.length - 1, current + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "ArrowDown") next = Math.min(cells.length - 1, current + columns);
    else if (event.key === "ArrowUp") next = Math.max(0, current - columns);
    else if (event.key === "Home") next = current - (current % columns);
    else if (event.key === "End") next = current + (columns - 1 - (current % columns));
    else if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    } else return;
    event.preventDefault();
    cells[next]?.focus();
  };

  return (
    <ChartFigure
      id="allocation-matrix"
      class="matrix-figure"
      title="Every cell is filled. That is the warning."
      summary="All kitchen-zone combinations occur. Cell values are descriptive allocation counts, not route performance."
      headers={["Kitchen", "Zone", "Orders", "Share", "Rank within kitchen"]}
      rows={props.corridors.map((row) => [
        `${row.kitchen_name} (${row.kitchen_id})`,
        `${row.zone_name} (${row.zone_id})`,
        row.filtered_order_rows,
        pct(row.filtered_share),
        row.corridor_rank_within_kitchen,
      ])}
    >
      <div class="matrix-scroll" role="group" aria-label="Kitchen by zone allocation grid">
        <div
          class="matrix-grid"
          style={`--zone-count:${zones().length}`}
        >
          <div class="matrix-corner" aria-hidden="true">
            kitchen / zone
          </div>
          <For each={zones()}>
            {([zoneId, zoneName]) => (
              <div class="matrix-axis matrix-axis--zone" title={`${zoneName} · ${zoneId}`}>
                {zoneId.replace("val_", "Z")}
              </div>
            )}
          </For>
          <For each={kitchens()}>
            {([kitchenId, kitchenName]) => (
              <>
                <div class="matrix-axis matrix-axis--kitchen" title={`${kitchenName} · ${kitchenId}`}>
                  <span>{kitchenId.replace("KIT-", "").replace("-001", "")}</span>
                  <small>{kitchenName.replace("Golden Wok ", "")}</small>
                </div>
                <For each={zones()}>
                  {([zoneId, zoneName]) => {
                    const corridor = () => cell(kitchenId, zoneId);
                    const key = () => `${kitchenId}|${zoneId}`;
                    const level = () => corridor().filtered_order_rows / max();
                    return (
                      <button
                        type="button"
                        class={`matrix-cell ${corridor().filtered_order_rows === 0 ? "matrix-cell--zero" : ""}`}
                        style={`--level:${level()}`}
                        aria-label={`${kitchenName} to ${zoneName}: ${corridor().filtered_order_rows} filtered orders, ${pct(corridor().filtered_share)} of current selection`}
                        aria-pressed={selectedId() === key()}
                        disabled={props.poster}
                        data-metric={`selected_corridor.${key()}.orders`}
                        data-value={String(corridor().filtered_order_rows)}
                        onClick={() => props.onSelect(corridor())}
                        onKeyDown={moveCellFocus}
                      >
                        {corridor().filtered_order_rows}
                        <span
                          class="sr-only"
                          data-metric={`selected_corridor.${key()}.share`}
                          data-value={String(corridor().filtered_share)}
                        >
                          {pct(corridor().filtered_share)}
                        </span>
                      </button>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </div>
      </div>
      <div class="mobile-kitchen-strips" aria-hidden="true">
        <For each={kitchens()}>
          {([kitchenId, kitchenName]) => {
            const rows = () => props.corridors.filter((row) => row.kitchen_id === kitchenId);
            const active = () => rows().filter((row) => row.filtered_order_rows > 0).length;
            const total = () => rows().reduce((sum, row) => sum + row.filtered_order_rows, 0);
            return (
              <div class="kitchen-strip">
                <span>{kitchenName.replace("Golden Wok ", "")}</span>
                <b>{active()} / {rows().length} zones</b>
                <small>{int(total())} selected orders</small>
              </div>
            );
          }}
        </For>
      </div>
      <div class="matrix-annotation">
        <span>
          <b>Count, not performance.</b> Range <b>{Math.min(...props.corridors.map((row) => row.order_rows))}</b>–
          <b>{Math.max(...props.corridors.map((row) => row.order_rows))}</b> source rows per corridor
        </span>
        <span>
          Largest cell{" "}
          <Metric name="largest_corridor_rows" value={Math.max(...props.corridors.map((row) => row.order_rows))} />
          {" · "}
          <Metric
            name="largest_corridor_share"
            value={Math.max(...props.corridors.map((row) => row.allocation_share))}
          >
            {pct(Math.max(...props.corridors.map((row) => row.allocation_share)))}
          </Metric>
        </span>
      </div>
    </ChartFigure>
  );
}

export function CoverageRail(props: { headline: Headline }) {
  const baseMatches = () => props.headline.order_rows - props.headline.rider_base_mismatches;
  return (
    <div class="coverage-rail">
      <div>
        <span>Rider × fact kitchen</span>
        <b>
          <Metric name="kitchen_rider_pairs" value={props.headline.kitchen_rider_pairs} /> /
          {props.headline.kitchens * props.headline.riders}
        </b>
      </div>
      <div>
        <span>Kitchen × slot</span>
        <b>
          <Metric name="kitchen_slot_pairs" value={props.headline.kitchen_slot_pairs} /> /
          {props.headline.kitchens * props.headline.time_slots}
        </b>
      </div>
      <div>
        <span>Rider at base kitchen</span>
        <b>
          <Metric name="rider_base_matches" value={baseMatches()} /> match ·{" "}
          <Metric name="rider_base_mismatches" value={props.headline.rider_base_mismatches} /> cross-base
        </b>
      </div>
    </div>
  );
}

export function DialBank(props: {
  contracts: MeasureContract[];
  headline: Headline;
  processLinkCount: number;
  poster: boolean;
  focus: Focus | null;
  activeMeasures: Set<string>;
  onSelect: (contract: MeasureContract) => void;
}) {
  return (
    <ChartFigure
      id="dial-bank"
      class="dial-figure"
      title="Nine dials. No defensible delivery chain."
      summary="Every business measure is quarantined for source audit only; no dial is a target or performance gauge."
      headers={["Source field", "Status", "Safe use", "Reason"]}
      rows={props.contracts.map((contract) => [
        contract.source_field,
        contract.semantic_status,
        contract.safe_use,
        contract.reason,
      ])}
    >
      <div class="dial-bank">
        <For each={props.contracts}>
          {(contract) => {
            const selected = () =>
              (props.focus?.kind === "measure" && props.focus.id === contract.source_field) ||
              props.activeMeasures.has(contract.source_field);
            return (
              <button
                type="button"
                class="measure-dial"
                classList={{ "measure-dial--active": selected() }}
                aria-label={`${measureLabel(contract.source_field)}: quarantined; ${contract.reason}`}
                aria-pressed={selected()}
                disabled={props.poster}
                onClick={() => props.onSelect(contract)}
              >
                <span class="dial-ring" aria-hidden="true">
                  <span>Q</span>
                </span>
                <b>{measureLabel(contract.source_field)}</b>
                <small>source audit only</small>
              </button>
            );
          }}
        </For>
      </div>
      <div class="dial-summary">
        <span>
          <Metric name="pairwise_measure_tests" value={props.headline.pairwise_measure_tests} /> pairwise tests
        </span>
        <span>
          max |r|{" "}
          <Metric name="max_abs_pairwise_r" value={props.headline.max_abs_pairwise_r}>
            {props.headline.max_abs_pairwise_r.toFixed(5)}
          </Metric>
        </span>
        <span>
          <Metric
            name="process_links_surviving_correction"
            value={props.headline.process_links_surviving_correction}
          />{" "}
          / {props.processLinkCount} expected links
        </span>
      </div>
    </ChartFigure>
  );
}

export function ProcessLinkPlot(props: {
  links: ProcessLink[];
  poster: boolean;
  filtersActive: boolean;
  focus: Focus | null;
  onSelect: (link: ProcessLink) => void;
}) {
  const domain = 0.04;
  const x = (value: number) => 205 + ((value + domain) / (domain * 2)) * 310;
  const y = (index: number) => 39 + index * 28;
  const selected = (id: string) => props.focus?.kind === "link" && props.focus.id === id;
  return (
    <ChartFigure
      id="process-links"
      class="support-card process-card"
      title="Expected linear links are near zero."
      summary="Eight expected linear relationships cluster near zero; none survives multiplicity correction."
      headers={["Link", "Source", "Target", "Pearson r", "p-value", "Status"]}
      rows={props.links.map((link) => [
        link.link_id,
        link.source_measure,
        link.target_measure,
        link.correlation_r,
        link.p_value,
        link.status,
      ])}
    >
      <Show when={props.filtersActive}>
        <span class="release-level-badge">Release level · not refiltered</span>
      </Show>
      <svg
        class="process-plot"
        viewBox="0 0 600 275"
        role="group"
        aria-label="Eight expected process-link correlations on a fixed negative-to-positive ruler"
      >
        <line x1={x(0)} x2={x(0)} y1="16" y2="252" class="process-zero" />
        <text x={x(-domain)} y="15" class="plot-tick">negative</text>
        <text x={x(0)} y="15" class="plot-tick" text-anchor="middle">zero</text>
        <text x={x(domain)} y="15" class="plot-tick" text-anchor="end">positive</text>
        <For each={props.links}>
          {(link, index) => (
            <g
              class="process-mark"
              classList={{ "process-mark--active": selected(link.link_id) }}
              role={props.poster ? undefined : "button"}
              tabindex={props.poster ? undefined : 0}
              aria-label={`${measureLabel(link.source_measure)} to ${measureLabel(link.target_measure)}: correlation ${signed(link.correlation_r)}, p ${link.p_value.toFixed(3)}, disconnected`}
              onClick={() => !props.poster && props.onSelect(link)}
              onKeyDown={(event) => {
                if (!props.poster && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  props.onSelect(link);
                }
              }}
            >
              <text x="0" y={y(index()) + 4} class="plot-label">
                {measureLabel(link.source_measure)} → {measureLabel(link.target_measure)}
              </text>
              <line x1={x(0)} x2={x(link.correlation_r)} y1={y(index())} y2={y(index())} />
              <circle cx={x(link.correlation_r)} cy={y(index())} r="5" />
              <text
                x="590"
                y={y(index()) + 4}
                text-anchor="end"
                class="plot-value"
                data-metric={`process_link.${link.link_id}.r`}
                data-value={String(link.correlation_r)}
              >
                {signed(link.correlation_r)}
              </text>
            </g>
          )}
        </For>
      </svg>
    </ChartFigure>
  );
}

function claimVerdictLabel(verdict: Claim["verdict"]) {
  return verdict === "REJECTED" ? "CONTRADICTED" : verdict;
}

function observedClaim(claim: Claim) {
  if (claim.value_unit.includes("ratio")) return `${claim.observed_value.toFixed(5)}×`;
  if (claim.value_unit.includes("share")) return pct(claim.observed_value);
  if (claim.value_unit.includes("mean")) return `NGN ${int(claim.observed_value)}`;
  return int(claim.observed_value);
}

export function ClaimScorecard(props: {
  claims: Claim[];
  poster: boolean;
  filtersActive: boolean;
  focus: Focus | null;
  onSelect: (claim: Claim) => void;
}) {
  const count = (verdict: Claim["verdict"]) => props.claims.filter((row) => row.verdict === verdict).length;
  return (
    <ChartFigure
      id="claim-scorecard"
      class="support-card claims-card"
      title="Five supplied claims produce no operational action."
      summary="Three conflict with the delivered fields; two are unsupported as specified."
      headers={["Claim", "Observed value", "Sample", "Verdict", "Decision"]}
      rows={props.claims.map((claim) => [
        claim.claim,
        observedClaim(claim),
        claim.sample_n,
        claimVerdictLabel(claim.verdict),
        claim.decision,
      ])}
    >
      <Show when={props.filtersActive}>
        <span class="release-level-badge">Release level · not refiltered</span>
      </Show>
      <div class="claim-list">
        <For each={props.claims}>
          {(claim) => (
            <button
              type="button"
              class="claim-row"
              classList={{ "claim-row--active": props.focus?.kind === "claim" && props.focus.id === claim.claim_id }}
              aria-pressed={props.focus?.kind === "claim" && props.focus.id === claim.claim_id}
              disabled={props.poster}
              onClick={() => props.onSelect(claim)}
            >
              <span class={`verdict verdict--${claim.verdict.toLowerCase()}`}>
                {claim.verdict === "UNSUPPORTED" ? "?" : claim.verdict === "REJECTED" ? "×" : "✓"}
                <b>{claimVerdictLabel(claim.verdict)}</b>
              </span>
              <span class="claim-copy">
                <b>{claim.claim}</b>
                <small>{claim.decision}</small>
              </span>
              <span class="claim-observed">
                <Metric name={`claim.${claim.claim_id}.observed`} value={claim.observed_value}>
                  {observedClaim(claim)}
                </Metric>
                <small>
                  n={""}
                  <Metric name={`claim.${claim.claim_id}.sample_n`} value={claim.sample_n} />
                </small>
              </span>
            </button>
          )}
        </For>
      </div>
      <div class="claim-summary">
        <span>
          <Metric name="claims_rejected" value={count("REJECTED")} /> contradicted
        </span>
        <span>
          <Metric name="claims_unsupported" value={count("UNSUPPORTED")} /> unsupported
        </span>
        <span>
          <Metric name="claims_confirmed" value={count("CONFIRMED")} /> confirmed
        </span>
      </div>
    </ChartFigure>
  );
}

export function ContractMatrix(props: {
  contracts: SourceContract[];
  headline: Headline;
  poster: boolean;
  filtersActive: boolean;
  focus: Focus | null;
  onSelect: (contract: SourceContract) => void;
}) {
  const constraints = () => props.contracts.filter((contract) => contract.kind === "constraint");
  const relationships = () => props.contracts.filter((contract) => contract.kind === "relationship");
  const statusCount = (kind: SourceContract["kind"], status: SourceContract["status"]) =>
    props.contracts.filter((contract) => contract.kind === kind && contract.status === status).length;
  return (
    <ChartFigure
      id="contract-matrix"
      class="support-card contract-card"
      title="The validator passed names it never saw."
      summary="The supplied report says checks passed although no configured constraint matches a delivered table-column pair."
      headers={["Contract", "Kind", "Status", "From", "To", "Detail"]}
      rows={props.contracts.map((contract) => [
        contract.contract_id,
        contract.kind,
        contract.status,
        `${contract.from_table}.${contract.from_column}`,
        contract.to_table ? `${contract.to_table}.${contract.to_column}` : null,
        contract.detail,
      ])}
    >
      <Show when={props.filtersActive}>
        <span class="release-level-badge">Release level · not refiltered</span>
      </Show>
      <div class="contract-summary">
        <span>
          report <Metric name="validation_checks_passed" value={props.headline.validation_checks_passed} /> passed
        </span>
        <span>
          <Metric name="matching_constraints" value={props.headline.matching_constraints} /> /{" "}
          <Metric name="configured_constraints" value={props.headline.configured_constraints} /> constraints match
        </span>
        <span>
          <Metric name="unavailable_relationships" value={props.headline.unavailable_relationships} /> missing ·{" "}
          <Metric name="invalid_relationships" value={props.headline.invalid_relationships} /> invalid relation
        </span>
      </div>
      <div class="sr-only" aria-label="Contract status totals">
        <Metric name="contract_status.constraint_missing.count" value={statusCount("constraint", "MISSING")} /> constraints missing.
        <Metric name="contract_status.relationship_available.count" value={statusCount("relationship", "AVAILABLE")} /> relationships available.
        <Metric name="contract_status.relationship_missing.count" value={statusCount("relationship", "MISSING")} /> relationships missing.
        <Metric name="contract_status.relationship_invalid.count" value={statusCount("relationship", "INVALID")} /> relationships invalid.
      </div>
      <div class="constraint-grid" aria-label="Configured constraint status matrix">
        <For each={constraints()}>
          {(contract) => (
            <button
              type="button"
              class="contract-cell"
              classList={{ "contract-cell--active": props.focus?.kind === "contract" && props.focus.id === contract.contract_id }}
              title={`${contract.contract_id}: ${contract.status}`}
              aria-label={`${contract.contract_id}: ${contract.status}`}
              disabled={props.poster}
              onClick={() => props.onSelect(contract)}
            >
              ×
            </button>
          )}
        </For>
      </div>
      <div class="relationship-rail" aria-label="Configured relationship status">
        <For each={relationships()}>
          {(contract) => (
            <button
              type="button"
              class={`relationship-jump relationship-jump--${contract.status.toLowerCase()}`}
              aria-label={`${contract.contract_id}: ${contract.status}`}
              disabled={props.poster}
              onClick={() => props.onSelect(contract)}
            >
              <span>{contract.status === "MISSING" ? "×" : contract.status === "INVALID" ? "!" : "•"}</span>
              <small>{contract.sequence - constraints().length}</small>
            </button>
          )}
        </For>
      </div>
      <p class="contract-conclusion">Passed is not the same as tested.</p>
    </ChartFigure>
  );
}

export function DecisionLedger(props: {
  requirements: CollectionRequirement[];
  poster: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <section class="decision-ledger" aria-labelledby="decision-title">
      <div class="decision-heading">
        <p class="eyebrow">Operating instruction</p>
        <h2 id="decision-title">Count allocation. Repair measurement. Do not optimise.</h2>
        <p>
          <Metric name="missing_collection_requirements" value={props.requirements.length} /> missing requirements block operational attribution.
        </p>
      </div>
      <button type="button" class="decision-column decision-column--safe" disabled={props.poster} onClick={() => props.onSelect("safe")}>
        <span>Descriptive use only</span>
        <b>ID-based volume and corridor share</b>
        <p>Audit contracts and prioritise re-instrumentation using stable allocation IDs.</p>
      </button>
      <button type="button" class="decision-column decision-column--block" disabled={props.poster} onClick={() => props.onSelect("block")}>
        <span>Block now</span>
        <b>SLA, weather, quality and profit</b>
        <p>No radius, routing, closure or rider reassignment decision from this release.</p>
      </button>
      <button type="button" class="decision-column decision-column--collect" disabled={props.poster} onClick={() => props.onSelect("collect")}>
        <span>Collect next</span>
        <b>{props.requirements[0]?.requirement}</b>
        <p>{props.requirements.slice(1, 4).map((item) => item.requirement).join(" · ")}</p>
      </button>
    </section>
  );
}

export function EvidenceDrawer(props: {
  bundle: DataBundle;
  corridors: RolledCorridor[];
  focus: Focus | null;
  onClose: () => void;
}) {
  const corridor = () =>
    props.focus?.kind === "corridor"
      ? props.corridors.find((row) => `${row.kitchen_id}|${row.zone_id}` === props.focus?.id)
      : undefined;
  const measure = () =>
    props.focus?.kind === "measure"
      ? props.bundle.measureContracts.find((row) => row.source_field === props.focus?.id)
      : undefined;
  const link = () =>
    props.focus?.kind === "link"
      ? props.bundle.processLinks.find((row) => row.link_id === props.focus?.id)
      : undefined;
  const claim = () =>
    props.focus?.kind === "claim"
      ? props.bundle.claims.find((row) => row.claim_id === props.focus?.id)
      : undefined;
  const contract = () =>
    props.focus?.kind === "contract"
      ? props.bundle.contracts.find((row) => row.contract_id === props.focus?.id)
      : undefined;

  return (
    <Show when={props.focus}>
      <aside class="evidence-drawer live-only" aria-label="Evidence detail">
        <div class="drawer-top">
          <nav aria-label="Drill path">
            <span>Evidence</span>
            <span aria-hidden="true">/</span>
            <b>{props.focus?.kind}</b>
          </nav>
          <button type="button" class="btn" onClick={props.onClose}>Close</button>
        </div>
        <Show when={corridor()} keyed>
          {(row) => (
            <div>
              <p class="eyebrow">Allocation corridor</p>
              <h2>{row.kitchen_name} → {row.zone_name}</h2>
              <dl>
                <div><dt>Stable IDs</dt><dd>{row.kitchen_id} · {row.zone_id}</dd></div>
                <div>
                  <dt>Selected orders</dt>
                  <dd>
                    <Metric name={`selected_corridor.${row.kitchen_id}|${row.zone_id}.orders`} value={row.filtered_order_rows} />
                  </dd>
                </div>
                <div><dt>Source rank</dt><dd>{row.corridor_rank_within_kitchen}</dd></div>
              </dl>
              <p class="drawer-boundary">Volume is descriptive. No route-performance measure is available.</p>
            </div>
          )}
        </Show>
        <Show when={measure()} keyed>
          {(row) => (
            <div>
              <p class="eyebrow">Measure contract</p>
              <h2>{measureLabel(row.source_field)}</h2>
              <p>{row.reason}</p>
              <dl>
                <div><dt>Status</dt><dd>Q · {row.semantic_status}</dd></div>
                <div><dt>Safe use</dt><dd>{row.safe_use}</dd></div>
                <div><dt>Curated field</dt><dd>{row.curated_field}</dd></div>
              </dl>
            </div>
          )}
        </Show>
        <Show when={link()} keyed>
          {(row) => (
            <div>
              <p class="eyebrow">Process link</p>
              <h2>{measureLabel(row.source_measure)} → {measureLabel(row.target_measure)}</h2>
              <dl>
                <div>
                  <dt>Pearson r</dt>
                  <dd><Metric name={`process_link.${row.link_id}.r`} value={row.correlation_r}>{signed(row.correlation_r, 6)}</Metric></dd>
                </div>
                <div>
                  <dt>p-value</dt>
                  <dd><Metric name={`process_link.${row.link_id}.p`} value={row.p_value}>{row.p_value.toFixed(4)}</Metric></dd>
                </div>
                <div><dt>Corrected α</dt><dd>{row.corrected_alpha.toFixed(6)}</dd></div>
              </dl>
              <p class="drawer-boundary">{row.decision}</p>
            </div>
          )}
        </Show>
        <Show when={claim()} keyed>
          {(row) => (
            <div>
              <p class="eyebrow">Supplied claim · {claimVerdictLabel(row.verdict)}</p>
              <h2>{row.claim}</h2>
              <dl>
                <div>
                  <dt>Observed</dt>
                  <dd><Metric name={`claim.${row.claim_id}.observed`} value={row.observed_value}>{observedClaim(row)}</Metric></dd>
                </div>
                <div>
                  <dt>Population</dt>
                  <dd>n=<Metric name={`claim.${row.claim_id}.sample_n`} value={row.sample_n} /></dd>
                </div>
              </dl>
              <p>{row.observed}</p>
              <p class="drawer-boundary">{row.decision}</p>
            </div>
          )}
        </Show>
        <Show when={contract()} keyed>
          {(row) => (
            <div>
              <p class="eyebrow">Validation contract · {row.status}</p>
              <h2>{row.contract_id}</h2>
              <p>{row.detail}</p>
              <dl>
                <div><dt>From</dt><dd>{row.from_table}.{row.from_column}</dd></div>
                <Show when={row.to_table}>
                  <div><dt>To</dt><dd>{row.to_table}.{row.to_column}</dd></div>
                </Show>
              </dl>
            </div>
          )}
        </Show>
        <Show when={props.focus?.kind === "decision"}>
          <div>
            <p class="eyebrow">Decision boundary</p>
            <h2>{props.focus?.id === "safe" ? "Descriptive use only" : props.focus?.id === "block" ? "Block now" : "Collect next"}</h2>
            <Show when={props.focus?.id === "collect"} fallback={<p>Use stable allocation counts only. Operational attribution remains blocked.</p>}>
              <ol class="requirement-list">
                <For each={props.bundle.collectionRequirements}>{(item) => <li>{item.requirement}</li>}</For>
              </ol>
            </Show>
          </div>
        </Show>
      </aside>
    </Show>
  );
}

const TOUR_STEPS = [
  ["A complete allocation lattice", "Every kitchen-zone pair appears. Select a cell to inspect count, share and stable IDs."],
  ["Nine quarantined dials", "The source measures are preserved for audit but are not operational KPIs."],
  ["A flat process chain", "Expected links between traffic, time, quality and profit cluster near zero."],
  [
    "Plausible claims fail",
    "Three findings conflict with the delivered fields; two are unsupported as specified.",
  ],
  ["The decision boundary", "Count allocation, repair measurement, and do not optimise this network yet."],
] as const;

export function GuidedTour(props: {
  open: boolean;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  let dialog: HTMLDivElement | undefined;
  let returnFocus: HTMLElement | undefined;
  createEffect(() => {
    if (props.open) {
      returnFocus ??= document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
      queueMicrotask(() => dialog?.focus());
    } else if (returnFocus) {
      const target = returnFocus;
      returnFocus = undefined;
      queueMicrotask(() => target.focus());
    }
  });
  const trapFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const current = () => TOUR_STEPS[props.step];
  return (
    <Show when={props.open}>
      <div class="tour-backdrop live-only" onClick={(event) => event.target === event.currentTarget && props.onClose()}>
        <div
          ref={dialog}
          class="tour-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          tabIndex={-1}
          onKeyDown={trapFocus}
        >
          <p class="tour-count">{props.step + 1} / {TOUR_STEPS.length}</p>
          <h2 id="tour-title">{current()[0]}</h2>
          <p>{current()[1]}</p>
          <div class="tour-actions">
            <button type="button" class="btn" disabled={props.step === 0} onClick={() => props.onStep(props.step - 1)}>Back</button>
            <button type="button" class="btn" onClick={props.onClose}>Close</button>
            <button
              type="button"
              class="btn btn--primary"
              onClick={() => props.step === TOUR_STEPS.length - 1 ? props.onClose() : props.onStep(props.step + 1)}
            >
              {props.step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
