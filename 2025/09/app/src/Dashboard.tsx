/**
 * 2025/09 · Credit Risk Analytics (Nova Bank) - the report.
 *
 * Structure follows design/wireframe.md: the finding stated AS CODE, the proof beneath it,
 * what it costs, what it contaminates, and what the file cannot say - with the caveats
 * placed where a reader will reach them rather than where they can be missed.
 *
 * EVERY displayed figure carries `data-metric` / `data-value` and is independently
 * recomputed from the parquet by tools/verify_metrics.py via DuckDB. Zero tolerance.
 */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  ChartFigure, FilterChips, InsightCallout, KpiTile, ThemeToggle,
  TourOverlay, filters, isActive, toggle, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  ABOVE_LABEL, BAND_LABEL, LTI_THRESHOLD_PCT, META, NARROW_BAND_LABEL, PROVENANCE, RULES,
  TIGHT_BAND_LABEL, bpPct, by, dec, defaultRate, derived, int, ladder, matchesAnyRule,
  money, pct, priceOfCertainty, rankFlip, ruleStats, segments, wall,
} from "./data";
import { TheWall, wallTable } from "./charts/TheWall";
import { TOUR } from "./tour";

const TOUR_KEY = "novabank-2025-09-tour-seen";
/** The bin at which renters reach 100%. Quoted on the poster; the slider does not move it.
 *  Read from data.ts so the chart boundary and the rule cannot disagree. */
const WALL_AT = LTI_THRESHOLD_PCT;

/**
 * The null hypothesis the rule box quotes against: "the true default rate under these two
 * conditions is 99%, not 100%, and 2,988 for 2,988 was luck."
 *
 * prose-number-ok: I1, analysis/insights.md - a STIPULATED parameter, not a measurement.
 * Nothing in the data computes it; it is the assumption whose consequence (the rendered
 * probability beside it) is tagged and recomputed by DuckDB as `rule.union.h0_p`.
 */
const H0_TRUE_RATE = 0.99;

/**
 * Rows of the provenance strip drawn on the POSTER. The live app draws all 25.
 *
 * This is a fit constraint, not an editorial one, and it used to be 12 - which did not fit.
 * The panel's `overflow: hidden` cut the last rows off silently, so the poster showed a row
 * sliced in half and the reader never learned there were more. tools/qa/measure.mjs gained a
 * clipping check and caught it. Change this number only against a measure.mjs run.
 */
const POSTER_PROV_ROWS = 8;


export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  const [lo, setLo] = createSignal(5);
  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  const rows = derived((rs) => rs, filters);
  const rules = derived(ruleStats, filters);
  const bins = createMemo(() => wall(rows(), lo(), 45));
  const price = derived(priceOfCertainty, filters);
  const flips = derived(rankFlip, filters);
  const grades = derived(ladder, filters);
  const segs = derived(segments, filters);

  const union = () => rules().find((r) => r.key === "union")!;
  const gradeD = () => grades().find((g) => g.k === "D")!;
  /** Aggregates the quantised payload cannot rebuild row-wise - see data.ts::Meta. They do
   *  not respond to the cross-filter, which is why they are stated as facts about the file
   *  rather than about the current selection. */
  const U = META.unemployed;
  /** Loans with no interest rate recorded. -1 is the sentinel; nothing imputes it. */
  const noRate = createMemo(() => rows().filter((l) => l.rateBp < 0));
  const base = () => defaultRate(rows());
  const gradeA = createMemo(() =>
    rows().filter((l) => l.grade === "A" && l.home === "RENT" && l.lpi > WALL_AT)
  );

  const originals = createMemo(() => PROVENANCE.filter((p) => p.block === "ORIGINAL"));
  const appended = createMemo(() => PROVENANCE.filter((p) => p.block === "APPENDED"));
  const appendedNull = createMemo(() => appended().filter((p) => !p.clears_bonferroni));

  return (
    <div class={props.poster ? "poster" : "app"}>
      {/* ============================== MASTHEAD ============================== */}
      <header class="masthead">
        <div class="masthead__rule">
          <span class="masthead__brand">NOVA BANK · CREDIT RISK REVIEW</span>
          <span class="masthead__meta">ONYX DATA DATADNA · SEPTEMBER 2025</span>
          <Show when={!props.poster}>
            <span class="masthead__tools live-only">
              <ThemeToggle />
              <button class="btn" onClick={() => setTour(true)}>Guided tour</button>
            </span>
          </Show>
        </div>

        <h1 class="thesis">
          Nine per cent of the book defaults{" "}
          <span data-metric="rule.union.rate" data-value={union().defaultRate}>
            {dec(union().defaultRate, 0)}%
          </span>{" "}
          of the time.
        </h1>

        {/* THE RULE, SET AS CODE - the signature typographic move. */}
        <div class="rulebox">
          <For each={rules().filter((r) => r.key !== "union")}>
            {(r) => (
              <div class="rulebox__row">
                <span class="rulebox__expr">{r.expr}</span>
                <span class="rulebox__out">
                  →{" "}
                  <span data-metric={`rule.${r.key}.n`} data-value={r.n}>{int(r.n)}</span>{" "}
                  loans,{" "}
                  <span data-metric={`rule.${r.key}.rate`} data-value={r.defaultRate}>
                    {dec(r.defaultRate, 4)}%
                  </span>
                </span>
              </div>
            )}
          </For>
          <p class="rulebox__note">
            <strong>
              <span data-metric="rule.union.exceptions" data-value={union().exceptions}>
                {union().exceptions}
              </span>{" "}
              exceptions
            </strong>{" "}
            in{" "}
            <span data-metric="rule.union.n" data-value={union().n}>{int(union().n)}</span>{" "}
            loans. If the true rate under these conditions were {H0_TRUE_RATE * 100}%,
            observing zero survivors has probability{" "}
            <span data-metric="rule.union.h0_p"
                  data-value={Math.pow(H0_TRUE_RATE, union().n)}>
              {Math.pow(H0_TRUE_RATE, union().n).toExponential(0)}
            </span>.{" "}
            <em class="rulebox__caveat">
              That is a post-selection probability. The two conditions were found by
              searching this file, so it measures how <em>exact</em> they are - not how
              surprising it is that some rule this exact exists somewhere in 29 columns.
            </em>
          </p>
        </div>

        <p class="contextstrip">
          <span data-metric="loans" data-value={rows().length}>{int(rows().length)}</span>{" "}
          loans ·{" "}
          <span data-metric="base_default_rate" data-value={base()}>{pct(base(), 2)}</span>{" "}
          default overall ·{" "}
          <span data-metric="rule.union.share_defaults" data-value={union().shareOfDefaults}>
            {pct(union().shareOfDefaults, 1)}
          </span>{" "}
          of every loss ·{" "}
          <span data-metric="rule.union.principal" data-value={union().principal}>
            {money(union().principal)}
          </span>{" "}
          of principal
        </p>

        <Show when={!props.poster}>
          <div class="live-only">
            <FilterChips
              labels={{ grade: "Grade", intent: "Purpose", home: "Tenure", country: "Country" }}
              hint="Click any grade, purpose or tenure to filter every panel."
            />
          </div>
        </Show>
      </header>

      {/* =============================== THE PROOF =============================== */}
      <section class="hero" id="proof">
        <div class="panel panel--hero">
          <h2 class="panel__title"><span class="panel__mark">★</span> The wall</h2>
          <p class="panel__sub">
            Default rate against loan-to-income, one percentage point at a time. Renters walk
            along the floor and then turn ninety degrees. Mortgage-holders and owners cross the
            same point and never turn.
          </p>

          <ChartFigure
            id="fig-wall"
            caption={`Past a loan-to-income of ${WALL_AT}%, every one of the ${int(rules()[0].n)} renter loans in this book defaulted - while mortgage-holders above the same line default at ${dec(defaultRate(rows().filter((l) => l.home === "MORTGAGE" && l.lpi > WALL_AT)), 1)}%.`}
            columns={wallTable(bins()).columns}
            rows={wallTable(bins()).rows}
          >
            <TheWall bins={bins()} wallAt={WALL_AT} aboveCount={rules()[0].n} poster={props.poster} />
          </ChartFigure>

          <Show when={!props.poster}>
            <div class="controls live-only">
              <label class="control">
                <span class="control__label">
                  Show from loan-to-income - <strong>{lo()}%</strong>
                </span>
                <input
                  type="range" min="5" max="28" step="1" value={lo()}
                  aria-label="Lowest loan-to-income shown"
                  aria-valuetext={`showing from ${lo()} percent; the wall is at ${WALL_AT} percent, above which all ${int(rules()[0].n)} renter loans defaulted`}
                  onInput={(e) => setLo(+e.currentTarget.value)}
                />
              </label>
            </div>
          </Show>
          <p class="figure-note">
            Bins are one percentage point wide because the finding is a single-step
            discontinuity - any coarser binning hides it. The dotted line is the interest rate
            charged to renters, on the right-hand axis. Bars along the bottom are loans per bin.
          </p>
        </div>

        {/* --------------------------- WHAT IT COSTS --------------------------- */}
        <div class="panel" id="cost">
          <h2 class="panel__title">What it costs</h2>
          <div class="kpirow">
            <KpiTile
              metric="price_gap_bp" label="Price of certain default"
              value={price().gapBp} display={`+${Math.round(price().gapBp)} bp`}
            />
            <KpiTile
              metric="rule.union.share_defaults_kpi" label="Share of all losses"
              value={union().shareOfDefaults} display={pct(union().shareOfDefaults, 0)}
            />
          </div>
          <p class="panel__sub">
            Like-for-like renters, either side of the line. &ldquo;Just below&rdquo; is the{" "}
            {BAND_LABEL} band - stated because the size of the gap depends on it (
            {NARROW_BAND_LABEL} gives a wider one, {TIGHT_BAND_LABEL} gives almost none).
            What does not depend on the band is that the price line is flat across a step
            from a quarter of these loans defaulting to all of them.
          </p>
          <ChartFigure
            id="fig-price"
            caption={`Renters above the line default at ${dec(price().above.defaultRate, 0)}% and pay ${bpPct(price().above.rateBp)} - ${Math.round(price().gapBp)} basis points more than renters in the ${BAND_LABEL} band, who default at ${dec(price().below.defaultRate, 1)}%.`}
            columns={["Renters", "Loans", "Default", "Interest charged"]}
            rows={[
              [`${BAND_LABEL} loan-to-income`, price().below.n, dec(price().below.defaultRate, 2) + "%", bpPct(price().below.rateBp)],
              [ABOVE_LABEL, price().above.n, dec(price().above.defaultRate, 2) + "%", bpPct(price().above.rateBp)],
            ]}
          >
            <div class="bars">
              <For each={[
                { k: `${BAND_LABEL} LTI`, d: price().below, m: "below" },
                { k: ABOVE_LABEL, d: price().above, m: "above" },
              ]}>
                {(r) => (
                  <div class="bars__row" style={{ cursor: "default" }}>
                    <span class="bars__label">{r.k}</span>
                    <span class="bars__track">
                      <span class="bars__bar" style={{ width: `${r.d.defaultRate}%` }} />
                    </span>
                    <span class="bars__value" data-metric={`price.${r.m}.rate`} data-value={r.d.defaultRate}>
                      {dec(r.d.defaultRate, 1)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="callout">
            <strong>
              <span data-metric="grade_a_wall.n" data-value={gradeA().length}>{int(gradeA().length)}</span>{" "}
              grade-A renters
            </strong>{" "}
            sit above the line. Every one defaulted, and they were priced at{" "}
            <span data-metric="grade_a_wall.rate" data-value={
              gradeA().filter((l) => l.rateBp >= 0).reduce((a, l) => a + l.rateBp, 0) /
              Math.max(1, gradeA().filter((l) => l.rateBp >= 0).length)
            }>
              {bpPct(
                gradeA().filter((l) => l.rateBp >= 0).reduce((a, l) => a + l.rateBp, 0) /
                Math.max(1, gradeA().filter((l) => l.rateBp >= 0).length)
              )}
            </span>{" "}
            - the bank's best rate.
          </p>
        </div>
      </section>

      {/* ============================ WHAT IT CONTAMINATES ============================ */}
      <section class="evidence" id="evidence">
        <h2 class="section__title" style={{ "grid-column": "1 / -1" }}>
          What the rules contaminate, and what the file cannot say
        </h2>

        <div class="panel" id="flip">
          <h3 class="panel__title">The rank that flips</h3>
          <p class="panel__sub">
            Loan purpose, whole book against the same book with the two rules removed. This is
            the answer to the brief's Q2 - and it inverts.
          </p>
          <ChartFigure
            id="fig-flip"
            caption={`Debt consolidation looks like the riskiest purpose at ${dec(flips()[0].rawRate, 2)}%. With the rules removed it is the second safest at ${dec(flips().find((f) => f.k === "DEBTCONSOLIDATION")!.cleanRate, 2)}%.`}
            columns={["Purpose", "Loans", "Whole book", "Rank", "Rules removed", "Rank"]}
            rows={flips().map((f) => [f.k, f.n, dec(f.rawRate, 2) + "%", f.rawRank, dec(f.cleanRate, 2) + "%", f.cleanRank])}
          >
            <div class="flip">
              <For each={flips()}>
                {(f) => (
                  <div class="flip__row">
                    <span>{f.k.slice(0, 1) + f.k.slice(1).toLowerCase()}</span>
                    <span class="flip__track">
                      <span class="flip__seg flip__raw" style={{ left: "0%", width: `${f.rawRate}%` }} />
                      <span class="flip__seg flip__clean" style={{ left: "0%", width: `${f.cleanRate}%`, top: "12px" }} />
                      <span class="flip__value" style={{ position: "absolute", right: "0", top: "2px" }}
                            data-metric={`flip.${f.k}.raw`} data-value={f.rawRate}>
                        #{f.rawRank} {dec(f.rawRate, 1)}% →{" "}
                        <span class={f.cleanRank !== f.rawRank ? "flip__moved" : ""}
                              data-metric={`flip.${f.k}.clean`} data-value={f.cleanRate}>
                          #{f.cleanRank} {dec(f.cleanRate, 1)}%
                        </span>
                      </span>
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Upper bar: whole book. Lower bar: rules removed. Every entrant who ranks purposes on
            the raw book reports rule 2 as a property of debt consolidation.
          </p>
        </div>

        <div class="panel" id="ladder">
          <h3 class="panel__title">The ladder, re-read</h3>
          <p class="panel__sub">
            The grade ladder is real, but the raw D figure is partly the rules. Publishing{" "}
            <span data-metric="ladder.D.raw" data-value={gradeD().raw}>
              {dec(gradeD().raw, 2)}%
            </span>{" "}
            as a risk gradient would repeat, in miniature, the error this page is about.
          </p>
          <ChartFigure
            id="fig-ladder"
            caption={`Grade D falls from ${dec(grades().find((g) => g.k === "D")!.raw, 2)}% to ${dec(grades().find((g) => g.k === "D")!.clean, 2)}% once the two rules are removed. The cliff is real; its height is not.`}
            columns={["Grade", "Loans", "Whole book", "Rules removed"]}
            rows={grades().map((g) => [g.k, g.n, dec(g.raw, 2) + "%", dec(g.clean, 2) + "%"])}
          >
            <div class="bars">
              <For each={grades()}>
                {(g) => (
                  <button class="bars__row" classList={{ "is-active": isActive("grade", g.k) }}
                          onClick={() => toggle("grade", g.k)} aria-pressed={isActive("grade", g.k)}
                          aria-label={`Grade ${g.k}: ${dec(g.raw, 1)}% default whole book, ${dec(g.clean, 1)}% with rules removed, ${g.n} loans. Filter to this grade.`}>
                    <span class="bars__label">Grade {g.k}</span>
                    <span class="bars__track">
                      <span class="bars__bar" style={{ width: `${g.clean}%` }} />
                    </span>
                    <span class="bars__value" data-metric={`ladder.${g.k}.clean`} data-value={g.clean}>
                      {dec(g.clean, 1)}%
                    </span>
                  </button>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">Bars show the clean-book rate. Full table in the caption's data table.</p>
        </div>

        <div class="panel" id="cannot">
          <h3 class="panel__title">What the file cannot tell you</h3>
          <p class="panel__sub">
            Sixteen of twenty-nine columns were appended to the lending book. Six are not
            independent columns at all: two ratio columns are exact arithmetic on columns
            already present, four geography columns are determined by the <code>city</code>{" "}
            column. Sorted by effect on default
            {props.poster ? `, top ${POSTER_PROV_ROWS} of 25 shown` : ""}.
          </p>
          <ChartFigure
            id="fig-provenance"
            caption={`Only ${appended().length - appendedNull().length} of ${appended().length} appended columns explain anything about default, and all of them are arithmetic on columns already present.`}
            columns={["Column", "Block", "Effect on default", "Nulls"]}
            rows={PROVENANCE.slice(0, 25).map((p) => [
              p.column_name, p.block, dec(p.effect_on_default * 100, 2) + "%", p.null_count,
            ])}
          >
            <div class="prov">
              <For each={PROVENANCE.slice(0, props.poster ? POSTER_PROV_ROWS : 25)}>
                {(p) => (
                  <div class="prov__row">
                    <span class="prov__name">{p.column_name}</span>
                    <span class={`prov__block ${p.block === "ORIGINAL" ? "is-original" : "is-appended"}`}>
                      {p.block === "ORIGINAL" ? "ORIG" : "ADDED"}
                    </span>
                    <span class="prov__track">
                      <span class={`prov__bar ${p.block === "ORIGINAL" ? "is-original" : "is-appended"}`}
                            style={{ width: `${Math.max(0.6, (p.effect_on_default / 0.42) * 100)}%` }} />
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="callout callout--slate">
            <strong>
              <span data-metric="unemployed.working" data-value={U.working}>
                {int(U.working)}
              </span>{" "}
              of{" "}
              <span data-metric="unemployed.reported" data-value={U.reported}>
                {int(U.reported)}
              </span>{" "}
              &ldquo;Unemployed&rdquo; applicants report a current job
            </strong>{" "}
            averaging{" "}
            <span data-metric="unemployed.mean_years_working" data-value={U.meanYearsWorking}>
              {dec(U.meanYearsWorking, 2)}
            </span>{" "}
            years. That mean is over the ones who report a job; across every applicant who
            reports a value it is{" "}
            <span data-metric="unemployed.mean_years_reported" data-value={U.meanYearsReported}>
              {dec(U.meanYearsReported, 2)}
            </span>
            , because{" "}
            <span data-metric="unemployed.zero_years" data-value={U.zeroYears}>
              {int(U.zeroYears)}
            </span>{" "}
            of them correctly report none. They earn a median{" "}
            <span data-metric="unemployed.median_income" data-value={U.medianIncome}>
              {"$" + int(U.medianIncome)}
            </span>{" "}
            against{" "}
            <span data-metric="unemployed.ft_median_income" data-value={U.ftMedianIncome}>
              {"$" + int(U.ftMedianIncome)}
            </span>{" "}
            for the full-time employed. And there is{" "}
            <strong>no application or approval column at all</strong> - every row is a funded
            loan, so approval-stage fairness is untestable here whatever you believe about
            the rest.
          </p>
        </div>
      </section>

      {/* =============================== SO WHAT =============================== */}
      <section class="sowhat">
        <InsightCallout
          recommendations={[
            {
              text: `Cap loan-to-income at ${LTI_THRESHOLD_PCT}% for renters, or price it. ${int(rules()[0].n)} loans, ${money(rules()[0].principal)}, currently +${Math.round(price().gapBp)} basis points against the ${BAND_LABEL} band.`,
              evidence: `Renters above the line default at ${dec(rules()[0].defaultRate, 4)}% with zero exceptions across ${int(rules()[0].n)} loans.`,
              chartId: "fig-wall",
            },
            {
              text: "Re-rank loan purposes on the book with the two rules removed before setting any purpose-level policy.",
              evidence: `Debt consolidation moves from #1 riskiest (${dec(flips()[0].rawRate, 2)}%) to #${flips().find((f) => f.k === "DEBTCONSOLIDATION")!.cleanRank} (${dec(flips().find((f) => f.k === "DEBTCONSOLIDATION")!.cleanRate, 2)}%).`,
              chartId: "fig-flip",
            },
            {
              text: "Do not certify this book as fair, and do not certify it as unfair. Ask for the declined applications.",
              evidence: `No application or approval column exists; every row is a funded loan. Separately, sixteen of twenty-nine columns were appended to the lending book, and ${appended().length - appendedNull().length} of the ${appended().length} testable ones explain anything at all about default.`,
              chartId: "fig-provenance",
            },
          ]}
        />
      </section>

      {/* ============================= PROVENANCE ============================= */}
      <footer class="provenance">
        <p>
          <strong>Source</strong> Onyx Data DataDNA · September 2025 · Credit Risk Analytics ·{" "}
          {int(META.sourceRows)} loans · sha256 <code>d209ebed...070b</code>
        </p>
        <p>
          <strong>Method</strong> Star schema in DuckDB; column effects pre-declared before
          testing, Bonferroni α=2.0e-3. Every figure on this page is recomputed from the
          parquet by an independent DuckDB query and asserted against this DOM.
        </p>
        <p>
          <strong>Units &amp; caveats</strong> Loan-to-income is the source's own 2-decimal
          column, which is what the rule reads - on the full-precision ratio the same rule
          gives{" "}
          <span data-metric="lti_exact.rate" data-value={META.ltiExact.defaultRate}>
            {dec(META.ltiExact.defaultRate, 2)}%
          </span>{" "}
          over{" "}
          <span data-metric="lti_exact.n" data-value={META.ltiExact.n}>
            {int(META.ltiExact.n)}
          </span>{" "}
          loans, so the exact label is downstream of the rounding. Interest is quoted in
          basis points;{" "}
          <span data-metric="int_rate_missing" data-value={noRate().length}>
            {int(noRate().length)}
          </span>{" "}
          loans have no rate recorded and are never imputed, so every price on this page is a
          mean over the loans that have one. The two rules are almost certainly generator
          artefacts; the action is identical either way, because a default label{" "}
          <span data-metric="rule.union.share_defaults_footer" data-value={union().shareOfDefaults}>
            {pct(union().shareOfDefaults, 0)}
          </span>{" "}
          decided by two boolean conditions must be found before any model is fitted. Both
          rules were found by searching this file, so every exactness figure quoted above is
          post-selection. This book contains no declined applications.
        </p>
      </footer>

      <Show when={!props.poster}>
        <TourOverlay open={tour()} onClose={() => setTour(false)} steps={TOUR} storageKey={TOUR_KEY} />
      </Show>
    </div>
  );
}
