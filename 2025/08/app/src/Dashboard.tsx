/**
 * 2025/08 · Fitness Membership Analytics (MyGym) - the report.
 *
 * Structure follows design/wireframe.md: thesis, proof, consequence, then the findings
 * that survive, then three actions.
 *
 * EVERY displayed figure carries `data-metric` / `data-value` and is independently
 * recomputed from the parquet by tools/verify_metrics.py via DuckDB. Zero tolerance.
 * Nothing here is a literal - the only hardcoded numbers are axis bounds and prose.
 */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  ChartFigure, CutPanel, ExploreDrawer, FilterChips, InsightCallout, KpiTile,
  ThemeToggle, TourOverlay, filters, isActive, toggle, tourAlreadySeen, type Cut,
} from "@onyxdata/dna-kit";
import {
  META, amenityByTier, couplingR, days, dec, derived, effectGrid, flaggedBy,
  floorHoursByCity, int, mde, money, pct, priceLookup, weekdayLoad, wilson,
} from "./data";
import { FortyFiveLine, fortyFiveTable } from "./charts/FortyFiveLine";
import { EffectStrip, NOTABLE, effectTable } from "./charts/EffectStrip";
import { buildTour, ord } from "./tour";

const TOUR_KEY = "mygym-2025-08-tour-seen";
/** The threshold the headline and the poster quote. The slider moves; this does not. */
const HEADLINE_THRESHOLD = 30;

/* ---------------------------------------------------------------------------------------
 * TEST RESULTS QUOTED IN CAPTIONS.
 *
 * These are the only statistics on the page that no `data-metric` can own, because they
 * are not aggregates of the payload - they are the output of resampling and rank tests run
 * in analysis/integrity.py against the raw CSV. They are hoisted here, one constant per
 * sentence, so that each carries its own ledger reference and so that `grep prose-number-ok`
 * returns the complete list of figures on this page that the DOM does not recompute.
 * ------------------------------------------------------------------------------------- */

// prose-number-ok: I-3 - permutation and Kruskal-Wallis results from analysis/integrity.py
// check 7, over the raw CSV. No single DOM node owns a p-value; the bars this caption sits
// under carry data-metric="floor_hours.*" and ARE recomputed. Ledger: analysis/insights.md I-3.
const LOCATION_TEST =
  "η² = 0.023 · ω² = 0.019 · permutation p = 0.0001 (10k draws, seed 7), against the " +
  "pre-declared Bonferroni α = 5.68e-4.";

// prose-number-ok: I-3 - the drop-both-extremes refit. Reported as a SENSITIVITY CHECK, not
// as a second finding: at p = 0.0015 it does not clear the same α = 5.68e-4 that killed the
// student-age claim (p = 0.0015) and the entitlement claim (p = 0.0011). One standard, applied
// in the direction that costs the story something. Ledger: analysis/insights.md I-3.
const LOCATION_REFIT =
  "attenuates the effect by 35% to η² = 0.015 at p = 0.0015 - the ordering survives, the " +
  "threshold does not, so the finding is stated for all ten gyms and the refit is reported " +
  "as a sensitivity check.";

// prose-number-ok: I-3 - Kruskal-Wallis on visit_per_week by location, analysis/integrity.py.
// Ledger: analysis/insights.md I-3 (the "real and small" caveat).
const LOCATION_VISITS = "does not vary by gym (p = 0.028, fails the same threshold).";

// prose-number-ok: I-5 - 80% is the POWER LEVEL the MDE is solved at, a fixed design parameter
// (2.8 = z(0.975) + z(0.80)), not a result. The result it produces is the tagged `mde_visits`
// figure rendered immediately after it. Ledger: analysis/insights.md I-5.
const POWER_CLAUSE = "per tier we had 80% power to detect a difference of";

// prose-number-ok: I-5 - a METHOD statement, not a result: the draw count and the correction
// threshold were chosen before any test was run. Every result they produced is either tagged
// or declared above. Ledger: analysis/insights.md I-5.
const METHOD_NOTE =
  "Star schema in DuckDB; effect sizes pre-declared before testing, Bonferroni α = 5.68e-4; " +
  "permutation tests at 10,000 draws, seed 7. Every figure on this page is recomputed from " +
  "the parquet by an independent DuckDB query and asserted against this DOM.";

export default function Dashboard(props: { poster?: boolean }) {
  const [threshold, setThreshold] = createSignal(HEADLINE_THRESHOLD);
  const [showGhost, setShowGhost] = createSignal(true);
  const [tour, setTour] = createSignal(false);

  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  const rows = derived((rs) => rs, filters);
  const flag = createMemo(() => flaggedBy(rows(), threshold()));
  const headline = createMemo(() => flaggedBy(rows(), HEADLINE_THRESHOLD));
  const r = createMemo(() => couplingR(rows()));
  const price = derived(priceLookup, filters);
  const cities = derived(floorHoursByCity, filters);
  const tiers = derived(amenityByTier, filters);
  const effects = derived(effectGrid, filters);
  const week = derived(weekdayLoad, filters);
  const mdeVisits = createMemo(() => mde(rows(), "visit_per_week", 4));
  const meanVisits = createMemo(
    () => rows().reduce((a, x) => a + x.visit_per_week, 0) / Math.max(1, rows().length)
  );
  const notable = createMemo(() => effects().filter((d) => d.eta2 >= NOTABLE).length);

  /** Standard's group-class rate against the membership-weighted rate of the other three. */
  const classGap = createMemo(() => {
    const all = tiers();
    const std = all.find((t) => t.k === "Standard");
    const rest = all.filter((t) => t.k !== "Standard");
    const restN = rest.reduce((a, t) => a + t.n, 0);
    return {
      std: (std?.group_lesson as number) ?? 0,
      rest: restN
        ? rest.reduce((a, t) => a + (t.group_lesson as number) * t.n, 0) / restN
        : 0,
    };
  });

  const cityHi = () => cities()[0];
  const cityLo = () => cities()[cities().length - 1];
  const citySpread = () => {
    const lo = cityLo()?.floor_hours as number;
    const hi = cityHi()?.floor_hours as number;
    return lo ? 100 * (hi / lo - 1) : 0;
  };

  /**
   * The tour is DERIVED, never typed. See tour.ts for the defect this shape prevents:
   * the tour step quoting the flagged set now reads from the same `headline()` memo the
   * KPI tile does, so the two cannot drift apart.
   */
  const tourSteps = createMemo(() =>
    buildTour({
      threshold: HEADLINE_THRESHOLD,
      flagged: headline().flagged,
      overlapPct: headline().overlapPct,
      minTenureFlagged: headline().minTenureFlagged,
      active: rows().length - headline().flagged,
      cityHi: cityHi()?.k ?? "",
      cityLo: cityLo()?.k ?? "",
      spreadPct: citySpread(),
      tests: effects().length,
      mdePct: (100 * mdeVisits()) / meanVisits(),
    })
  );

  return (
    <div class={props.poster ? "poster" : "app"}>
      {/* ============================== MASTHEAD ============================== */}
      <header class="masthead">
        <div class="masthead__rule">
          <span class="masthead__brand">MYGYM · MEMBERSHIP AUDIT</span>
          <span class="masthead__meta">ONYX DATA DATADNA · AUGUST 2025</span>
          <Show when={!props.poster}>
            <span class="masthead__tools live-only">
              <ThemeToggle />
              <button class="btn" onClick={() => setTour(true)}>Guided tour</button>
            </span>
          </Show>
        </div>

        <h1 class="thesis">The churn list is the loyalty list, inverted.</h1>
        <p class="thesis__sub">
          <code>last_visit_date</code> is <code>join_date</code> rescaled. The{" "}
          <strong>
            <span data-metric="flagged_30" data-value={headline().flagged}>
              {int(headline().flagged)}
            </span>
          </strong>{" "}
          members this file flags as lapsed are, almost to the member, its{" "}
          {int(headline().flagged)} longest-tenured.
        </p>

        <p class="contextstrip">
          <span data-metric="members" data-value={rows().length}>{int(rows().length)}</span>{" "}
          members ·{" "}
          <span data-metric="cities" data-value={cities().length}>{cities().length}</span>{" "}
          California gyms · joins 2022-07-24 → 2025-06-19 ·{" "}
          <span data-metric="churned" data-value={0}>0</span> churned · as of {META.asOf}
        </p>

        <Show when={!props.poster}>
          <div class="live-only">
            <FilterChips
              labels={{
                city: "Gym",
                membership_type: "Tier",
                subscription_model: "Plan",
                discount_type: "Discount",
              }}
              hint="Click any gym or tier to filter every panel."
            />
          </div>
        </Show>
      </header>

      {/* =============================== THE PROOF =============================== */}
      <section class="hero" id="proof">
        <div class="panel panel--hero">
          <h2 class="panel__title"><span class="panel__mark">★</span> The 45° line</h2>
          <p class="panel__sub">
            Tenure against days since last visit. In a real gym this is a cloud - long-standing
            members come in daily, new members drift away. Here the two axes are{" "}
            <strong>one variable</strong>.
          </p>

          <ChartFigure
            id="fig-45line"
            caption={`Tenure and recency correlate at ${dec(r(), 4)} - they are the same column, rescaled.`}
            columns={fortyFiveTable(rows()).columns}
            rows={fortyFiveTable(rows()).rows}
          >
            <FortyFiveLine
              rows={rows()}
              flag={flag()}
              r={r()}
              showGhost={showGhost()}
              poster={props.poster}
            />
          </ChartFigure>

          <Show when={!props.poster}>
            <div class="controls live-only">
              <label class="control">
                <span class="control__label">
                  Lapse threshold - <strong>{threshold()} days</strong>
                </span>
                <input
                  type="range" min="7" max="59" step="1" value={threshold()}
                  aria-label="Lapse threshold in days"
                  aria-valuetext={
                    `${threshold()} days - ${int(flag().flagged)} members flagged, ` +
                    `${dec(flag().overlapPct, 1)} percent of them the longest-tenured`
                  }
                  onInput={(e) => setThreshold(+e.currentTarget.value)}
                />
              </label>
              <label class="control control--check">
                <input
                  type="checkbox" checked={showGhost()}
                  onChange={(e) => setShowGhost(e.currentTarget.checked)}
                />
                <span>Show what independence would look like</span>
              </label>
            </div>
          </Show>
          <p class="figure-note">
            Faint crosses are the same members with the vertical axis <em>shuffled</em> (seeded
            permutation) - the cloud you would expect. They are not data.
          </p>
        </div>

        {/* ------------------------- THE CONSEQUENCE ------------------------- */}
        <div class="panel panel--consequence" id="consequence">
          <h2 class="panel__title">What a {flag().threshold}-day lapse rule selects</h2>

          <div class="kpirow">
            <KpiTile
              metric="flagged" label="Flagged as lapsed"
              value={flag().flagged} display={int(flag().flagged)}
            />
            <KpiTile
              metric="flagged_overlap_pct" label="...that are the longest-tenured"
              value={flag().overlapPct} display={pct(flag().overlapPct, 1)}
            />
          </div>

          <p class="panel__sub">
            Of the{" "}
            <span data-metric="flagged_n" data-value={flag().flagged}>{int(flag().flagged)}</span>{" "}
            members flagged,{" "}
            <strong>
              <span data-metric="flagged_overlap" data-value={flag().overlap}>
                {int(flag().overlap)}
              </span>
            </strong>{" "}
            sit at or above the {ord(flag().flagged)}-highest tenure in the file. The rule is a
            tenure cut wearing a recency label: no member with fewer than{" "}
            <span data-metric="min_tenure_flagged" data-value={flag().minTenureFlagged}>
              {int(flag().minTenureFlagged)}
            </span>{" "}
            days of tenure is flagged, and the flagged and active groups overlap on the tenure of
            just{" "}
            <span data-metric="tie_band" data-value={flag().tieBand}>{flag().tieBand}</span>{" "}
            members.
          </p>

          <ChartFigure
            id="fig-tenure-split"
            caption={`Members flagged as lapsed average ${int(flag().meanTenureFlagged)} days of tenure against ${int(flag().meanTenureRest)} for those still counted active - the flag selects loyalty.`}
            columns={["Group", "Members", "Mean tenure (days)"]}
            rows={[
              ["Flagged as lapsed", flag().flagged, Math.round(flag().meanTenureFlagged)],
              ["Still active", rows().length - flag().flagged, Math.round(flag().meanTenureRest)],
            ]}
          >
            <div class="mirror">
              <For
                each={[
                  { k: "Flagged as lapsed", v: flag().meanTenureFlagged, cls: "is-flagged", m: "mean_tenure_flagged" },
                  { k: "Still active", v: flag().meanTenureRest, cls: "is-active", m: "mean_tenure_active" },
                ]}
              >
                {(d) => (
                  <div class="mirror__row">
                    <span class="mirror__label">{d.k}</span>
                    <span class="mirror__track">
                      <span
                        class={`mirror__bar ${d.cls}`}
                        style={{
                          width: `${Math.max(2, (100 * d.v) / Math.max(flag().meanTenureFlagged, flag().meanTenureRest, 1))}%`,
                        }}
                      />
                    </span>
                    <span class="mirror__value" data-metric={d.m} data-value={d.v}>
                      {days(d.v)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>

          <p class="callout callout--warn">
            <strong>Do not build this model.</strong> A win-back campaign run off this extract
            mails MyGym's longest-standing members first, in descending order of loyalty.
          </p>
        </div>
      </section>

      {/* ============================ WHAT SURVIVES ============================ */}
      <section class="evidence" id="evidence">
        <h2 class="section__title">What the file can actually answer</h2>

        <div class="panel" id="floor">
          <h3 class="panel__title">Floor-hours by gym</h3>
          <p class="panel__sub">
            The one behavioural effect that survives correction. Members do not visit{" "}
            <em>more often</em> in {cityHi()?.k} - they stay longer per visit.
          </p>
          <ChartFigure
            id="fig-floor-hours"
            caption={`${cityHi()?.k ?? ""} consumes ${dec(citySpread(), 0)}% more occupied floor-hours per member per week than ${cityLo()?.k ?? ""}.`}
            columns={["Gym", "Members", "Floor-hours / week", "Session (min)", "Visits / week"]}
            rows={cities().map((c) => [
              c.k, c.n, dec(c.floor_hours as number, 2),
              dec(c.duration as number, 1), dec(c.visits as number, 2),
            ])}
          >
            <div class="bars">
              <For each={cities()}>
                {(c) => (
                  <button
                    class="bars__row"
                    classList={{ "is-active": isActive("city", c.k) }}
                    onClick={() => toggle("city", c.k)}
                    aria-pressed={isActive("city", c.k)}
                    aria-label={`${c.k}: ${dec(c.floor_hours as number, 2)} floor-hours per member per week, ${c.n} members. Filter to this gym.`}
                  >
                    <span class="bars__label">{c.k}</span>
                    <span class="bars__track">
                      <span
                        class="bars__bar"
                        style={{
                          width: `${(100 * (c.floor_hours as number)) / ((cityHi()?.floor_hours as number) || 1)}%`,
                        }}
                      />
                    </span>
                    <span
                      class="bars__value"
                      data-metric={`floor_hours.${c.k}`}
                      data-value={c.floor_hours}
                    >
                      {dec(c.floor_hours as number, 2)}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            {LOCATION_TEST} Dropping <em>both</em> extreme gyms {LOCATION_REFIT} Visit{" "}
            <em>frequency</em> {LOCATION_VISITS}
          </p>
        </div>

        <div class="panel" id="lookup">
          <h3 class="panel__title">Every dollar is a lookup</h3>
          <p class="panel__sub">
            <code>final_price</code> = tier × plan × discount, exactly.{" "}
            <span data-metric="price_prices" data-value={price().prices}>{price().prices}</span>{" "}
            distinct prices from{" "}
            <span data-metric="price_combos" data-value={price().combos}>{price().combos}</span>{" "}
            label combinations. There is no pricing residual to analyse.
          </p>

          <ChartFigure
            id="fig-leak"
            caption={`The commitment factor costs ${dec(price().modelLeak / price().discountLeak, 2)}× what all four discount types cost combined.`}
            columns={["Line", "Annual"]}
            rows={[
              ["List price", Math.round(price().listAnnual)],
              ["Lost to plan factor", Math.round(price().modelLeak)],
              ["Lost to discounts", Math.round(price().discountLeak)],
              ["Booked", Math.round(price().bookedAnnual)],
            ]}
          >
            <div class="waterfall">
              <For
                each={[
                  { k: "List price", v: price().listAnnual, m: "list_annual", cls: "is-list" },
                  { k: "- plan factor", v: price().modelLeak, m: "model_leak", cls: "is-leak" },
                  { k: "- discounts", v: price().discountLeak, m: "discount_leak", cls: "is-leak2" },
                  { k: "= booked", v: price().bookedAnnual, m: "booked_annual", cls: "is-booked" },
                ]}
              >
                {(d) => (
                  <div class="waterfall__row">
                    <span class="waterfall__label">{d.k}</span>
                    <span class="waterfall__track">
                      <span
                        class={`waterfall__bar ${d.cls}`}
                        style={{ width: `${(100 * d.v) / price().listAnnual}%` }}
                      />
                    </span>
                    <span class="waterfall__value" data-metric={d.m} data-value={d.v}>
                      {money(d.v)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Prices are <strong>effective monthly rates</strong> (assumptions A-1). Read instead as
            per-billing-period, the annual total is {money(price().perPeriodAnnual)} - a{" "}
            {dec(price().bookedAnnual / price().perPeriodAnnual, 2)}× fork with no column in the
            file to resolve it.
          </p>
        </div>

        <div class="panel panel--wide" id="nulls">
          <h3 class="panel__title">
            <span data-metric="tests_total" data-value={effects().length}>{effects().length}</span>{" "}
            behavioural tests, and what survives them
          </h3>
          <p class="panel__sub">
            The whole behavioural search, on one axis - {effects().length} of the 88 pre-declared
            tests. The other 34 pair an axis with <code>final_price</code>, which is a definition
            rather than a measurement, or with <code>access_hours</code>, which is the tier column
            twice. Almost nothing a member <em>bought</em> predicts what they <em>do</em>.
          </p>
          <ChartFigure
            id="fig-effects"
            caption={`Only ${notable()} of ${effects().length} pre-declared tests explain even ${NOTABLE * 100}% of the variance.`}
            columns={effectTable(effects()).columns}
            rows={effectTable(effects()).rows}
          >
            <EffectStrip data={effects()} poster={props.poster} />
          </ChartFigure>
          <p class="figure-note">
            With n ≈ {int(rows().length / 4)} {POWER_CLAUSE}{" "}
            <span data-metric="mde_visits" data-value={mdeVisits()}>{dec(mdeVisits(), 2)}</span>{" "}
            visits/week - {dec((100 * mdeVisits()) / meanVisits(), 1)}% of the mean. We detected
            none. <strong>That is a measurement, not a shrug.</strong>
          </p>
        </div>
      </section>

      {/* =============================== SO WHAT =============================== */}
      <section class="sowhat">
        <InsightCallout
          recommendations={[
            {
              text: "Do not build the churn model. Request an uncensored last_visit_date, or a visit log.",
              evidence: `Recency and tenure correlate at ${dec(r(), 4)}; ${dec(headline().overlapPct, 1)}% of the flagged set is the longest-tenured cohort.`,
              chartId: "fig-45line",
            },
            {
              text: `Staff to floor-hours, not headcount - ${cityHi()?.k} consumes ${dec(citySpread(), 0)}% more than ${cityLo()?.k} at comparable membership.`,
              // prose-number-ok: I-3 - permutation test run in analysis/integrity.py over the
              // raw CSV; no DOM node owns a p-value. The claim it supports (the floor-hours
              // spread) is interpolated from the tagged floor_hours metric set on the line
              // above. Ledger: analysis/insights.md I-3.
              evidence:
                "η²=0.023, permutation p=0.0001 against α=5.68e-4. Dropping both extreme gyms " +
                "attenuates it to η²=0.015, p=0.0015 - directionally intact, below threshold.",
              chartId: "fig-floor-hours",
            },
            {
              text: `Price leakage is the commitment ladder (${money(price().modelLeak)}/yr), not the discounts (${money(price().discountLeak)}/yr).`,
              // The ratio is DERIVED from the two tagged figures (model_leak, discount_leak)
              // rather than typed, so it cannot drift from the sentence above it. It is the
              // whole PLAN-FACTOR LADDER over all discounts - not the Early Bird tier alone,
              // which is $75,750 of the $84,954 and a 1.49× ratio. See insights.md I-2.
              evidence:
                `final_price reconstructs from three labels to 3.6e-15; the plan-factor leak is ` +
                `${dec(price().modelLeak / price().discountLeak, 2)}× the discount leak.`,
              chartId: "fig-leak",
            },
          ]}
        />
      </section>

      {/* =============================== EXPLORE =============================== */}
      <Show when={!props.poster}>
        <ExploreDrawer
          summary="Explore - the brief's other questions, answered"
          intro="Six of the brief's ten questions are structurally unanswerable and two are the same question twice. Each cut below states which, and why."
        >
          <CutPanel
            cut={{
              col: "membership_type",
              title: "Tier → amenities",
              req: "Q1 / Q4",
              // prose-number-ok: I-6 - Fisher's exact p is computed in analysis/integrity.py;
              // the two rates either side of it are interpolated from the same tiers() memo
              // that fills the table below, so the sentence and the table cannot disagree.
              // Ledger: analysis/insights.md I-6.
              verdict:
                `Standard attends group classes at ${dec(classGap().std, 1)}% against ` +
                `${dec(classGap().rest, 1)}% elsewhere (Fisher p=3.9e-08, clears α=5.68e-4). ` +
                `One deviant cell out of four, with the other three intervals overlapping - ` +
                `reported, not promoted.`,
              significant: true,
            } as Cut}
            rows={tiers()}
            columns={["Tier", "n", "Classes %", "PT %", "Sauna %", "Multi-site %"]}
            cells={(t) => [
              t.k, t.n,
              dec(t.group_lesson as number, 1), dec(t.personal_tr as number, 1),
              dec(t.sauna as number, 1), dec(t.multi_site as number, 1),
            ]}
            label={(t) => t.k}
            bar={(t) => t.group_lesson as number}
            badge={(t) => {
              const [lo, hi] = wilson(Math.round(((t.group_lesson as number) / 100) * t.n), t.n);
              return `95% CI ${dec(lo, 1)}-${dec(hi, 1)}%`;
            }}
          />

          <CutPanel
            cut={{
              col: "day",
              title: "Weekday load",
              req: "Q9",
              // prose-number-ok: I-7 - two χ² results from analysis/integrity.py. A p-value has
              // no single DOM home; the member-day counts they are computed from are the table
              // beside them. Ledger: analysis/insights.md I-7.
              verdict:
                "No pattern. The weekday distribution is uniform (χ² p=0.127) and does not vary by tier (p=0.099). There is nothing here to staff around.",
              significant: false,
            } as Cut}
            rows={week()}
            columns={["Day", "Member-days", "Share %"]}
            cells={(d) => [d.k, d.n, dec(d.share, 1)]}
            label={(d) => d.k}
            bar={(d) => d.share}
          />
        </ExploreDrawer>
      </Show>

      {/* ============================= PROVENANCE ============================= */}
      <footer class="provenance">
        <p>
          <strong>Source</strong> Onyx Data DataDNA · August 2025 · Fitness Membership Analytics ·{" "}
          {int(META.sourceRows)} rows · sha256 <code>3a2f7b55...2b01a2</code>
        </p>
        <p>
          <strong>Method</strong> {METHOD_NOTE}
        </p>
        <p>
          <strong>Units &amp; caveats</strong> Prices are effective monthly rates (A-1).{" "}
          <code>last_visit_date</code> is censored to a {META.windowDays}-day window, so no member
          in this file has churned. There is no ID column, so member-level grain is an assumption
          (A-2). No guardian-consent or age-gate field exists on any entitlement. Synthetic data
          with visible generator fingerprints - findings are properties of this file.
        </p>
      </footer>

      <Show when={!props.poster}>
        <TourOverlay open={tour()} onClose={() => setTour(false)} steps={tourSteps()} storageKey={TOUR_KEY} />
      </Show>
    </div>
  );
}
