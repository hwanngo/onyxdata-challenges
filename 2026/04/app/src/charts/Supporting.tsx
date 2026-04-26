/**
 * Supporting panels - 2026/04. Every title states the FINDING.
 */
import { For, Show } from "solid-js";
import { CUTS, META, dec, int, sci, signed } from "../data";

/* STATISTICS QUOTED IN CAPTIONS. Outputs of tests over the WHOLE file in
 * analysis/integrity.py, not aggregates of the filtered view, so no data-metric can own them.
 * One constant per sentence, each carrying its own ledger reference (the 2025/08 pattern).
 */
// prose-number-ok: I5 - the one real signal is in the count only; duration by year
const DURATION_BY_YEAR_P = "0.712";
// prose-number-ok: I3 - the Suez disruption is not in the data
const SUEZ_MW_P = "0.504";
// prose-number-ok: I3 - within 2021, March and April run above the other ten months
const MAR_APR_ABOVE = "5.1%";
// prose-number-ok: I1 - Cohen's floor for a "small" effect, the rule drawn on the eta2 panel
const COHEN_SMALL = "0.01";
// prose-number-ok: I1 - terminals take equal work; chi-square across all fifty
const TERMINAL_CHI2 = "41.0 on 49 df";
// prose-number-ok: I1 - terminals take equal work; the chi-square ratio, below chance
const TERMINAL_CHI2_RATIO = "0.84";

/* ④ The one real signal, carrying its warning. */
export function GrowthPanel(props: {
  years: { year: number; movements: number; isSuezYear: boolean; yoyPct: number | null }[];
  chi2: number; chance: number;
  onPick?: (y: number) => void;
}) {
  const W = 430, H = 190, P = { t: 18, r: 18, b: 34, l: 60 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = () => Math.max(...props.years.map((y) => y.movements)) * 1.12;
  const x = (i: number) => P.l + (i / Math.max(1, props.years.length - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / Math.max(1, max())) * ih;
  return (
    <figure class="panel">
      <h3 class="panel__t">The one real signal - and why it is the dangerous one</h3>
      {/* role="group", NOT role="img". An img cannot contain interactive children - axe flags
          nested-interactive at SERIOUS, which is exactly the violation 2025/12 carried through
          a whole gate. Adding the clickable year dots turned this element from an image into
          a container, and the role has to change with it. */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group"
           aria-label={`Cargo movements by fiscal year, ${props.years.map((y) => `${y.year}: ${y.movements}`).join(", ")}. 2021 is the lowest year and is flagged. Each year is selectable.`}>
        <path d={props.years.map((yy, i) => `${i ? "L" : "M"} ${x(i)} ${y(yy.movements)}`).join(" ")}
              class="grw__line" />
        <For each={props.years}>
          {(yy, i) => (
            <g>
              <Show when={yy.isSuezYear}>
                {/* the warning is a column in dim_year, so it cannot be omitted here */}
                <circle cx={x(i())} cy={y(yy.movements)} r="9" class="grw__suezring" />
              </Show>
              {/* the interactive mark. fill must be paintable or the circle only hit-tests
                  on its stroke - dna-kit tokens.css records that from 2025/11. */}
              <circle cx={x(i())} cy={y(yy.movements)} r="11" class="grw__hit"
                      role="button" tabindex="0"
                      aria-label={`${yy.year}, ${int(yy.movements)} movements. Filter the report to this year.`}
                      onClick={() => props.onPick?.(yy.year)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          props.onPick?.(yy.year);
                        }
                      }} />
              <circle cx={x(i())} cy={y(yy.movements)} r="4.5" class="grw__dot"
                      classList={{ "is-suez": yy.isSuezYear }} aria-hidden="true" />
              <text x={x(i())} y={H - 18} text-anchor="middle" class="ax">{yy.year}</text>
              <Show when={yy.yoyPct !== null}>
                <text x={x(i())} y={y(yy.movements) - 16} text-anchor="middle" class="ann">
                  {signed(yy.yoyPct!)}
                </text>
              </Show>
            </g>
          )}
        </For>
        <text x={P.l - 8} y={y(max() / 1.12) + 4} text-anchor="end" class="ax">
          {int(Math.max(...props.years.map((v) => v.movements)))}
        </text>
      </svg>
      <p class="panel__c">
        Daily allocation <span class="mono">χ²/df {dec(props.chi2, 4)}</span> against a
        simulated maximum of <span class="mono">{dec(props.chance, 4)}</span> - the only thing
        here that exceeds chance. <strong>And only in the count:</strong> duration by year
        <span class="mono"> p = {DURATION_BY_YEAR_P}</span>. 2021 is the lowest year, which is precisely why
        this line gets attached to a disruption that is not in the data.
      </p>
      <div class="sr-only">
        <table>
          <caption>Cargo movements by fiscal year</caption>
          <thead><tr><th scope="col">Year</th><th scope="col">Movements</th>
            <th scope="col">Year on year</th><th scope="col">Suez year</th></tr></thead>
          <tbody>
            <For each={props.years}>
              {(yy) => <tr><th scope="row">{yy.year}</th><td>{yy.movements}</td>
                <td>{yy.yoyPct === null ? "-" : dec(yy.yoyPct, 1)}</td>
                <td>{yy.isSuezYear ? "yes" : "no"}</td></tr>}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ⑤ The empty window. */
export function SuezPanel(props: { days: { day: number; n: number; inWeek: boolean }[] }) {
  const W = 430, H = 190, P = { t: 18, r: 14, b: 34, l: 40 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = () => Math.max(4, ...props.days.map((d) => d.n)) * 1.15;
  const bw = () => iw / Math.max(1, props.days.length);
  return (
    <figure class="panel">
      <h3 class="panel__t">The empty window</h3>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`Daily cargo movements through March 2021. The Ever Given blocked the Suez Canal on the 23rd to 29th, marked. Nothing distinguishes those days.`}>
        <For each={props.days}>
          {(d, i) => (
            <rect x={P.l + i() * bw() + 1} y={P.t + ih - (d.n / max()) * ih}
                  width={Math.max(1, bw() - 2)} height={(d.n / max()) * ih}
                  class="suez__bar" classList={{ "is-week": d.inWeek }} />
          )}
        </For>
        <line x1={P.l} x2={W - P.r} y1={P.t + ih} y2={P.t + ih} class="flat__axis" />
        <For each={[1, 8, 15, 23, 29]}>
          {(dd) => (
            <text x={P.l + (dd - 0.5) * bw()} y={H - 18} text-anchor="middle" class="ax">{dd}</text>
          )}
        </For>
        <text x={W / 2} y={H - 4} text-anchor="middle" class="ax">March 2021</text>
      </svg>
      <p class="panel__c">
        The blockage ran <span class="mono">{META.suezStart}</span> to{" "}
        <span class="mono">{META.suezEnd}</span>, shown in oxide. Mann-Whitney on duration
        against every other day in the file: <span class="mono">p = {SUEZ_MW_P}</span>. Within 2021,
        March and April run <strong>{MAR_APR_ABOVE} above</strong> the other ten months.
      </p>
      <div class="sr-only">
        <table>
          <caption>Daily movements, March 2021</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Movements</th>
            <th scope="col">In blockage week</th></tr></thead>
          <tbody>
            <For each={props.days}>
              {(d) => <tr><th scope="row">{d.day}</th><td>{d.n}</td>
                <td>{d.inWeek ? "yes" : "no"}</td></tr>}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ⑥ Every axis, and what it explains. */
export function CutPanel(props: { onPick?: (label: string) => void }) {
  const FLOOR = 0.01; // Cohen's floor for a "small" effect
  const max = () => Math.max(FLOOR, ...CUTS.map((c) => c.eta2)) * 1.15;
  const sorted = () => [...CUTS].sort((a, b) => b.eta2 - a.eta2);
  /* The caption below is computed from the rows this panel draws, never asserted. The integrity
     pass found it hardcoded as "nothing reaches a fifth of it, and the largest is a 50-level
     terminal factor" while the top bar of this very chart was a 123-group vessel-build-year cut
     at 79% of the floor - a caption contradicting the picture above it. */
  const top = () => sorted()[0];
  const pctOfFloor = () => Math.round((top().eta2 / FLOOR) * 100);
  return (
    <figure class="panel">
      <h3 class="panel__t">Every axis the brief names, and what it explains</h3>
      <div class="cuts">
        <For each={sorted()}>
          {(c) => (
            <div class="cuts__row">
              <span class="cuts__lab">{c.cut_label}</span>
              <span class="cuts__track">
                <span class="cuts__bar" style={{ width: `${(c.eta2 / max()) * 100}%` }} />
                <span class="cuts__floor" style={{ left: `${(FLOOR / max()) * 100}%` }} />
              </span>
              <span class="mono cuts__v" data-metric={`cut.${c.cut_label}.eta2`}
                    data-value={c.eta2}>{sci(c.eta2)}</span>
            </div>
          )}
        </For>
      </div>
      <p class="panel__c">
        η², the share of variance in movement duration each factor explains. The rule marks{" "}
        <span class="mono">{COHEN_SMALL}</span> - Cohen's floor for a <em>small</em> effect. Nothing
        reaches it: the largest is {top().cut_label.toLowerCase()} at{" "}
        <span class="mono">{sci(top().eta2)}</span>, {pctOfFloor()}% of the floor, and it is the{" "}
        {top().k_groups}-group cut - the most groups on the list, which is where chance
        concentrates.
      </p>
      <div class="sr-only">
        <table>
          <caption>Variance in movement duration explained, by factor</caption>
          <thead><tr><th scope="col">Factor</th><th scope="col">Groups</th>
            <th scope="col">Kruskal-Wallis p</th><th scope="col">eta squared</th></tr></thead>
          <tbody>
            <For each={sorted()}>
              {(c) => <tr><th scope="row">{c.cut_label}</th><td>{c.k_groups}</td>
                <td>{dec(c.kw_p, 4)}</td><td>{sci(c.eta2)}</td></tr>}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* Web-only: fifty terminals, equal by construction. */
export function TerminalPanel(props: {
  rows: { id: number; label: string; hub: string; movements: number; min: number; max: number }[];
  onPick?: (label: string) => void; active?: string;
}) {
  const max = () => Math.max(1, ...props.rows.map((r) => r.movements));
  return (
    <figure class="panel panel--wide">
      <h3 class="panel__t">Fifty terminals, equal by construction</h3>
      <div class="term__scroll" tabindex="0" role="region"
           aria-label="Terminal table, scrollable">
        <table class="term">
          <thead>
            <tr><th scope="col">Terminal</th><th scope="col">Hub</th>
              <th scope="col">Movements</th><th scope="col" class="term__vis">share</th>
              <th scope="col">duration range (h)</th></tr>
          </thead>
          <tbody>
            <For each={props.rows.slice(0, 12)}>
              {(r) => (
                <tr classList={{ "is-on": props.active === r.label }}
                    onClick={() => props.onPick?.(r.label)}>
                  <th scope="row">{r.label}</th>
                  <td>{r.hub}</td>
                  <td class="mono">{int(r.movements)}</td>
                  <td class="term__vis">
                    <span class="term__track">
                      <span class="term__bar" style={{ width: `${(r.movements / max()) * 100}%` }} />
                    </span>
                  </td>
                  <td class="mono">{dec(r.min, 0)}-{dec(r.max, 0)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="panel__c">
        Top twelve of fifty by movement count. χ² across all fifty is{" "}
        <span class="mono">{TERMINAL_CHI2}</span> - a ratio of <strong>{TERMINAL_CHI2_RATIO}</strong>, <em>below</em>{" "}
        chance. Every terminal spans essentially the full 0-1000h range, so no column here can
        be ranked. This table exists to show that, not to support a decision.
      </p>
    </figure>
  );
}

/* Web-only: the eight dictionary defects. */
export function DefectPanel(props: { corruptRows: number; corruptPct: number }) {
  /* DOCUMENTED-VS-ACTUAL. The left column QUOTES docs/DATA_DICTIONARY.md verbatim; the right
   * column is the verified counter-value from analysis/integrity.py against the raw CSVs.
   * These are citations and test outputs, not aggregates of the filtered view, so no
   * data-metric can own them - and the two that ARE aggregates (movement_id distinct values,
   * and the row count) are interpolated from META, which build.py writes.
   * prose-number-ok: I2 - both headline measures are Uniform(0,1000)
   * prose-number-ok: I4 - the schema cannot hold the answers either
   */
  const ROWS: [string, string, string][] = [
    ["move_duration", "normal distribution", "Uniform(0,1000) - KS p=0.6129 vs uniform, 4.8e-48 vs normal"],
    ["container_count", "Poisson", "Uniform(0,1000) - var/mean 164.86, not 1.0"],
    ["regional_hub", "3 values", "4 - LATAM is undocumented"],
    ["vessel_category", "3 values", "4 - Container is undocumented"],
    ["build_year", "1990-2023", "1900-2023"],
    ["movement_id", "primary key", `${int(META.movementIdDistinct)} distinct across ${int(META.movements)} rows`],
    ["fact columns", "six", "nine - date_id, vessel_key and vessel_category are undocumented"],
    ["dim_time", "about 5,000 rows", `${int(META.days)}`],
  ];
  return (
    <figure class="panel panel--wide">
      <h3 class="panel__t">
        The archive documents its own generator, and is wrong eight times
      </h3>
      <div class="term__scroll" tabindex="0" role="region"
           aria-label="Documented versus actual, scrollable">
        <table class="term term--defect">
          <thead>
            <tr><th scope="col">Column</th><th scope="col">The dictionary says</th>
              <th scope="col">The file says</th></tr>
          </thead>
          <tbody>
            <For each={ROWS}>
              {([c, said, is]) => (
                <tr><th scope="row" class="mono">{c}</th><td>{said}</td>
                  <td class="term__is">{is}</td></tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="panel__c">
        A ninth defect is in the data rather than the documentation: the fact table carries two
        vessel keys, and the second disagrees with the dimension on{" "}
        <strong data-metric="corrupt_rows" data-value={props.corruptRows}>
          {int(props.corruptRows)}
        </strong>{" "}
        of {int(META.movements)} rows (<span class="mono">{dec(props.corruptPct, 2)}%</span>).
        The mismatch is unpatterned - it corrupts a join and means nothing else.
      </p>
    </figure>
  );
}
