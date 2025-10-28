/**
 * 2025/10 · Consumer Financial Complaints (CFPB) - the report.
 *
 * A regulator's supervision brief. The thesis is that the file is two datasets: a real
 * complaint register and a uniform random company overlay. So the page shows the split
 * first, then hands over the priority list the real half supports.
 *
 * EVERY displayed figure carries data-metric/data-value and is independently recomputed
 * from the parquet by tools/verify_metrics.py via DuckDB. Zero tolerance. Prose statistics
 * that have no single DOM home are caught by tools/lint_prose_numbers.mjs and must name the
 * ledger entry that owns them.
 */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  ChartFigure, FilterChips, InsightCallout, KpiTile, ThemeToggle,
  TourOverlay, filters, isActive, toggle, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  BREAK_MIN_DROP, BREAK_MIN_N, CHI, CHI_TESTS, COMPANIES, KPI_RANK_CORR, META, MONTHS,
  breakUniversality, by, clocksByChannel, dec, derived, impossible, inProgressByMonth, int,
  issueSeverity, lagEffectSize, pct, reliefPairs, tierSummary, timelyByYear, timelyRate,
  timelyRateWrongDenominator,
} from "./data";
import { TheDiagonal, diagonalTable } from "./charts/TheDiagonal";
import { TOUR } from "./tour";

const TOUR_KEY = "datadna-2025-10-tour-seen";
/** The year bars are zoomed: this is their left edge, in percentage points. */
const YR_BASE = 85;

export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  const rows = derived((rs) => rs, filters);
  const pairs = derived((rs) => reliefPairs(rs, 5), filters);
  const severity = derived((rs) => issueSeverity(rs), filters);
  const years = derived(timelyByYear, filters);
  const clocks = derived((rs) => clocksByChannel(rs), filters);
  const lagEffect = derived((rs) => lagEffectSize(rs), filters);
  const broken = derived(breakUniversality, filters);
  const impossibles = derived(impossible, filters);
  const monthsInProgress = derived(inProgressByMonth, filters);

  const timely = () => timelyRate(rows());
  const timelyWrong = () => timelyRateWrongDenominator(rows());
  const resolved = () => rows().filter((r) => r.resolved).length;
  const nProducts = () => new Set(rows().map((r) => r.product)).size;
  const nIssues = () => new Set(rows().map((r) => r.issue)).size;
  const nStates = () => new Set(rows().map((r) => r.state)).size;

  const tiers = tierSummary();
  const mortgage2021 = createMemo(() => {
    const m = rows().filter(
      (r) => r.product === "Mortgage" && MONTHS[r.monthIdx].startsWith("2021") && r.resolved
    );
    return m.length ? (100 * m.reduce((a, r) => a + r.timely, 0)) / m.length : NaN;
  });
  /**
   * EMPTY STATE. A cross-filter can select zero rows - Fax × Student loan is one of several -
   * and `years()` is then empty, so `reduce` with `years()[0]` as the seed returned
   * `undefined` and the next property access took the whole page down. `interact.mjs` now
   * asserts that combination renders. `Math.min(...[])` is `Infinity`, so the range helpers
   * below return NaN rather than printing "Infinity" into a caption.
   */
  const EMPTY_YEAR = {
    k: "-", n: 0, resolved: 0, rate: NaN, untimely: 0,
    pooledResolved: 0, pooledRate: NaN, censoredOut: 0,
  };
  const worstYear = () =>
    years().reduce((a, b) => (b.rate < a.rate ? b : a), years()[0] ?? EMPTY_YEAR);
  const lo = (xs: number[]) => (xs.length ? Math.min(...xs) : NaN);
  const hi = (xs: number[]) => (xs.length ? Math.max(...xs) : NaN);
  /** Years whose bar excludes right-censored months - 2023 only, but derived, not assumed. */
  const censoredYears = () => years().filter((y) => y.censoredOut > 0);
  const censoredOut = () => censoredYears().reduce((a, y) => a + y.censoredOut, 0);
  const worstOpenMonth = () =>
    monthsInProgress().reduce((a, b) => (b.inProgress > a.inProgress ? b : a),
      monthsInProgress()[0]);

  return (
    <div class={props.poster ? "poster" : "app"}>
      {/* ============================== MASTHEAD ============================== */}
      <header class="masthead">
        <div class="masthead__rule">
          <span class="masthead__brand">CFPB · COMPLAINT REGISTER REVIEW</span>
          <span class="masthead__meta">ONYX DATA DATADNA · OCTOBER 2025</span>
          <Show when={!props.poster}>
            <span class="masthead__tools live-only">
              <ThemeToggle />
              <button class="btn" onClick={() => setTour(true)}>Guided tour</button>
            </span>
          </Show>
        </div>

        <h1 class="thesis">Two datasets. <em>One register.</em></h1>
        <p class="thesis__sub">
          <strong>
            <span data-metric="complaints" data-value={rows().length}>{int(rows().length)}</span>{" "}
            complaints are a real register</strong> - complaint IDs advance with the calendar in
          every one of the{" "}
          <span data-metric="id_month_steps_rising" data-value={META.idMonthStepsRising as number}>
            {int(META.idMonthStepsRising as number)}
          </span>{" "}
          month-to-month steps, Sunday runs at{" "}
          <span data-metric="sun_index" data-value={META.sunIndex as number}>
            {dec(META.sunIndex as number, 2)}×
          </span>{" "}
          an average day, and{" "}
          <span data-metric="issues_single_parent" data-value={META.issuesSingleParent as number}>
            {int(META.issuesSingleParent as number)}
          </span>{" "}
          of{" "}
          <span data-metric="issues_total" data-value={META.issuesTotal as number}>
            {int(META.issuesTotal as number)}
          </span>{" "}
          issues sit under exactly one product.{" "}
          <strong>
            The <span data-metric="companies" data-value={COMPANIES.length}>{int(COMPANIES.length)}</span>{" "}
            companies attached to them are a uniform random overlay.</strong>{" "}
          So this file supports supervision <em>priorities</em> and answers nothing about
          supervision <em>targets</em>.
        </p>

        <p class="contextstrip">
          {MONTHS[0].slice(0, 7)} → {MONTHS[MONTHS.length - 1].slice(0, 7)} ·{" "}
          <span data-metric="resolved" data-value={resolved()}>{int(resolved())}</span> resolved ·{" "}
          <span data-metric="timely_rate" data-value={timely()}>{pct(timely(), 2)}</span> timely
          among resolved ·{" "}
          <span data-metric="products" data-value={nProducts()}>{nProducts()}</span> products ·{" "}
          <span data-metric="issues" data-value={nIssues()}>{nIssues()}</span> issues ·{" "}
          <span data-metric="states" data-value={nStates()}>{nStates()}</span> states
        </p>

        <Show when={!props.poster}>
          <div class="live-only">
            <FilterChips
              labels={{ product: "Product", issue: "Issue", channel: "Channel", region: "Region" }}
              hint="Click any product, channel or region to filter every panel."
            />
          </div>
        </Show>
      </header>

      {/* =============================== THE PROOF =============================== */}
      <section class="hero" id="proof">
        <div class="panel panel--hero">
          <h2 class="panel__title"><span class="panel__mark">★</span> The diagonal of nothing</h2>
          <p class="panel__sub">
            Every pair among the file's twelve categorical columns - the complete grid, nothing
            selected. Chi-square against its degrees of freedom. The dashed line is what{" "}
            <em>no association at all</em> looks like: a statistic equal to its own degrees of
            freedom is exactly what chance predicts.
          </p>
          <ChartFigure
            id="fig-diagonal"
            caption={
              `All ${CHI.total} association tests among the file's twelve categorical columns. ` +
              `${CHI.companySignificant} of the ${CHI.company.length} company-identifier tests clear Bonferroni ` +
              `(α=${CHI.alpha.toExponential(2)}); the weakest company evidence is p=${dec(CHI.companyMinP, 3)}. ` +
              `${CHI.structuralSignificant} of ${CHI.structural.length} pairs among the substantive consumer ` +
              `columns clear it, the weakest at p=${CHI.structuralMaxP.toExponential(1)}. ` +
              `The ${CHI.calendrical.length - CHI.calendricalSignificant} consumer pairs that fail all touch ` +
              `weekday or timeliness, where landing on the line is the expected result.`
            }
            columns={diagonalTable(CHI_TESTS).columns}
            rows={diagonalTable(CHI_TESTS).rows}
          >
            <TheDiagonal tests={CHI_TESTS} poster={props.poster} />
          </ChartFigure>
          <p class="figure-note">
            Log-log, because the tests span five orders of magnitude in degrees of freedom.
            <strong> The two clouds do not separate cleanly and the chart does not pretend they
            do:</strong> the nearest consumer pair comes within{" "}
            <span data-metric="diagonal_closest" data-value={CHI.closest}>
              {dec(CHI.closest, 2)}×
            </span>{" "}
            of the strongest company test, and only across the non-definitional structural
            pairs does the gap open to{" "}
            <span data-metric="diagonal_separation" data-value={CHI.separation}>
              {dec(CHI.separation, 2)}×
            </span>.{" "}
            <strong>Height is not effect size.</strong> χ²/df rewards degrees of freedom:{" "}
            <span data-metric="chi_weaker_than_company" data-value={CHI.weakerThanCompany}>
              {CHI.weakerThanCompany}
            </span>{" "}
            of the {CHI.consumer.length} consumer pairs have a smaller Cramér's V than{" "}
            <em>every</em> company test - which sit at{" "}
            <span data-metric="company_v_min" data-value={CHI.companyV.lo}>
              {dec(CHI.companyV.lo, 3)}
            </span>
            -
            <span data-metric="company_v_max" data-value={CHI.companyV.hi}>
              {dec(CHI.companyV.hi, 3)}
            </span>{" "}
            - and still plot above them. V is itself inflated on a{" "}
            {int(COMPANIES.length)}-level axis, so the verdict rests on the Bonferroni column of
            the table, not on the height. {CHI.definitional.length} pairs are drawn as crosses
            because Cramér's V is at or above the definitional threshold; all but one are exact
            functional dependencies, and the exception,{" "}
            <code>product × issue</code> at V={dec(
              CHI.definitional.reduce((a, b) => (b.cramersV < a.cramersV ? b : a)).cramersV, 4)},
            is the nesting this page publishes two panels away.
          </p>
        </div>

        {/* --------------------------- WHERE THE MONEY IS --------------------------- */}
        <div class="panel" id="money">
          <h2 class="panel__title">Where to send examiners</h2>
          <div class="kpirow">
            <KpiTile
              metric="top5_relief_share" label="Of all monetary relief"
              value={pairs().topShare} display={pct(pairs().topShare, 1)}
            />
            <KpiTile
              metric="top5_volume_share" label="...from this share of complaints"
              value={pairs().topVolume} display={pct(pairs().topVolume, 1)}
            />
          </div>
          <p class="panel__sub">
            Five product-issue pairs carry two thirds of every dollar of relief in the register.
          </p>
          <ChartFigure
            id="fig-pairs"
            caption={`The top five product-issue pairs account for ${pct(pairs().topShare, 1)} of all monetary relief on ${pct(pairs().topVolume, 1)} of complaints.`}
            columns={["Product", "Issue", "Complaints", "With relief", "Relief rate", "Share of all relief"]}
            rows={pairs().pairs.map((p) => [
              p.product, p.issue, p.n, p.relieved, dec(p.moneyRate, 1) + "%", dec(p.shareOfRelief, 1) + "%",
            ])}
          >
            <div class="pairs">
              <For each={pairs().pairs}>
                {(p) => (
                  <div class="pairs__row">
                    <span class="pairs__name">
                      {p.issue}
                      <small>{p.product} · {int(p.n)} complaints · {dec(p.moneyRate, 1)}% relieved</small>
                      <span class="pairs__track">
                        <span class="pairs__bar" style={{ width: `${(p.shareOfRelief / pairs().pairs[0].shareOfRelief) * 100}%` }} />
                      </span>
                    </span>
                    <span class="pairs__value" data-metric={`pair.${p.issue}.relief_share`} data-value={p.shareOfRelief}>
                      {dec(p.shareOfRelief, 1)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Relief rate is a <strong>proxy for severity</strong>, not a measure of harm - the file
            has no severity column (assumptions A-5). Across{" "}
            <span data-metric="severity_issues" data-value={severity().length}>{severity().length}</span>{" "}
            issues with n≥300 it runs{" "}
            <span data-metric="severity_min" data-value={severity()[severity().length - 1]?.moneyRate}>
              {dec(severity()[severity().length - 1]?.moneyRate ?? 0, 2)}%
            </span>{" "}
            to{" "}
            <span data-metric="severity_max" data-value={severity()[0]?.moneyRate}>
              {dec(severity()[0]?.moneyRate ?? 0, 2)}%
            </span>.
          </p>
        </div>
      </section>

      {/* ============================ EVIDENCE ============================ */}
      <section class="evidence" id="evidence">
        <h2 class="section__title" style={{ "grid-column": "1 / -1" }}>
          What the real half says, and what the fabricated half cannot
        </h2>

        <div class="panel" id="timeliness">
          <h3 class="panel__title">Timeliness broke in 2021</h3>
          <p class="panel__sub">
            The pooled {pct(timely(), 2)} hides a regime break - and one product never breaks.
          </p>
          <ChartFigure
            id="fig-timely"
            caption={
              `Timeliness never falls below ${dec(lo(years().filter((y) => y.k <= "2020").map((y) => y.rate)), 2)}% ` +
              `through 2020, then drops to ${pct(worstYear().rate, 2)} in ${worstYear().k}. Mortgage holds at ` +
              `${pct(mortgage2021(), 2)} that year. ${censoredYears().map((y) => y.k).join(", ")} counts ` +
              `January-April only: the months from 2023-05 are right-censored, and pooling them raises ` +
              `that bar to ${pct(censoredYears()[0]?.pooledRate ?? NaN, 2)}.`
            }
            columns={["Year", "Resolved (drawn)", "Timely % (drawn)", "Untimely", "Resolved (pooled)", "Timely % (pooled)"]}
            rows={years().map((y) => [
              y.censoredOut ? `${y.k} (Jan-Apr)` : y.k,
              y.resolved, dec(y.rate, 2) + "%", y.untimely,
              y.pooledResolved, dec(y.pooledRate, 2) + "%",
            ])}
          >
            <div class="yr">
              <For each={years()}>
                {(y) => (
                  <div class="yr__row">
                    <span>{y.k}{y.censoredOut ? "*" : ""}</span>
                    <span class="yr__track">
                      <span
                        class={`yr__bar ${y.rate < 97 ? "is-broken" : ""}`}
                        style={{ width: `${Math.max(2, ((y.rate - YR_BASE) / (100 - YR_BASE)) * 100)}%` }}
                      />
                    </span>
                    <span class="yr__value" data-metric={`timely.${y.k}`} data-value={y.rate}>
                      {dec(y.rate, 2)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Bars start at {YR_BASE}%. <strong>* excludes the right-censored months.</strong>{" "}
            <span data-metric="censored_resolved" data-value={censoredOut()}>{int(censoredOut())}</span>{" "}
            resolved complaints from 2023-05 onward are held out, because{" "}
            <span data-metric="max_in_progress" data-value={worstOpenMonth().inProgress}>
              {pct(worstOpenMonth().inProgress, 1)}
            </span>{" "}
            of {worstOpenMonth().month.slice(0, 7)} is still in progress and only the fast cases
            have closed; pooling them puts that bar at{" "}
            <span data-metric="timely_2023_pooled" data-value={censoredYears()[0]?.pooledRate}>
              {pct(censoredYears()[0]?.pooledRate ?? NaN, 2)}
            </span>{" "}
            instead. <strong>The break is not compositional:</strong> of{" "}
            <span data-metric="break_tested" data-value={broken().tested}>{broken().tested}</span>{" "}
            product, channel and region cuts with at least {BREAK_MIN_N} resolved complaints on
            each side of the boundary,{" "}
            <span data-metric="break_falling" data-value={broken().falling}>{broken().falling}</span>{" "}
            fall by more than {BREAK_MIN_DROP}pp. The one that does not is Mortgage, at{" "}
            <span data-metric="mortgage_2021" data-value={mortgage2021()}>{pct(mortgage2021(), 2)}</span>.
          </p>
        </div>

        <div class="panel panel--fake" id="clocks">
          <h3 class="panel__title">Two clocks, one fabricated</h3>
          <p class="panel__sub">
            <code>Response_Time_Days</code> is a uniform draw from 0 to 30 and separates nothing
            (upper bar). The intake lag - submission to receipt - is real and separates channels
            enormously (lower bar).
          </p>
          <ChartFigure
            id="fig-channels"
            caption={
              `Response time is flat across the ${clocks().length} channels with n≥50 ` +
              `(${dec(lo(clocks().map((c) => c.meanDays)), 2)}-${dec(hi(clocks().map((c) => c.meanDays)), 2)} days) ` +
              `because it is a uniform random draw. On the same rows the intake lag runs ` +
              `${dec(lo(clocks().map((c) => c.delayedPct)), 1)}%-${dec(hi(clocks().map((c) => c.delayedPct)), 1)}% delayed. ` +
              `Email is excluded from both ranges: n=${by(rows(), "channel").find((c) => c.k === "Email")?.n ?? 0}.`
            }
            columns={["Channel", "Complaints", "Mean response days (fabricated)", "% delayed at intake (real)", "Mean intake lag (days)"]}
            rows={clocks().map((c) => [
              c.k, c.n, dec(c.meanDays, 2), dec(c.delayedPct, 2) + "%", dec(c.meanLag, 3),
            ])}
          >
            <div class="bars bars--clock">
              <For each={clocks()}>
                {(c) => (
                  <button
                    class="bars__row"
                    classList={{ "is-active": isActive("channel", c.k) }}
                    onClick={() => toggle("channel", c.k)}
                    aria-pressed={isActive("channel", c.k)}
                    aria-label={`${c.k}: ${int(c.n)} complaints, mean response ${dec(c.meanDays, 2)} days, ${dec(c.delayedPct, 1)} percent delayed at intake. Filter to this channel.`}
                  >
                    <span class="bars__label">{c.k}</span>
                    <span class="bars__track">
                      <span class="clockbar clockbar--fake">
                        <i style={{ width: `${(c.meanDays / 30) * 100}%` }} />
                      </span>
                      <span class="clockbar clockbar--real">
                        <i style={{ width: `${c.delayedPct}%` }} />
                      </span>
                    </span>
                    <span class="bars__value" data-metric={`channel.${c.k}.days`} data-value={c.meanDays}>
                      {dec(c.meanDays, 2)}
                    </span>
                    <span class="bars__value bars__value--real" data-metric={`channel.${c.k}.delayed`} data-value={c.delayedPct}>
                      {dec(c.delayedPct, 0)}%
                    </span>
                  </button>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Upper bar: mean response days out of 30. Lower bar: share delayed at intake.
            Channel explains the real clock and nothing of the fake one - Kruskal-Wallis
            ε² ={" "}
            <span data-metric="lag_eps2" data-value={lagEffect().eps2}>
              {dec(lagEffect().eps2, 3)}
            </span>{" "}
            on the intake lag.
          </p>
          <p class="callout callout--fake">
            <strong>
              <span data-metric="early_n" data-value={impossibles().n}>{int(impossibles().n)}</span>{" "}
              complaints (
              <span data-metric="early_pct" data-value={impossibles().pct}>{pct(impossibles().pct, 2)}</span>
              ) were answered before they were received
            </strong>{" "}
            - up to{" "}
            <span data-metric="early_max" data-value={impossibles().maxDays}>{int(impossibles().maxDays)}</span>{" "}
            days early - and all{" "}
            <span data-metric="in_progress" data-value={impossibles().inProgress}>{int(impossibles().inProgress)}</span>{" "}
            in-progress complaints carry a response date. Four of the five identities the
            dictionary states hold exactly; the table is still logically inconsistent.
          </p>
        </div>

        <div class="panel panel--fake" id="kpi">
          <h3 class="panel__title">What every other entry will publish</h3>
          <p class="panel__sub">
            The file ships the answer to "which companies complain most relative to market
            share" as a column. It is arithmetically exact and ranks firms by how small they are.
          </p>
          <ChartFigure
            id="fig-tiers"
            caption={`Complaint volume is identical across size tiers (${dec(lo(tiers.map((t) => t.complaints)), 1)}-${dec(hi(tiers.map((t) => t.complaints)), 1)}), while the shipped KPI varies ${dec(tiers[2].kpi / tiers[0].kpi, 1)}× - entirely through its denominator.`}
            columns={["Size tier", "Firms", "Mean market share", "Mean complaints", "Mean shipped KPI"]}
            rows={tiers.map((t) => [t.k, t.n, dec(t.share, 4) + "%", dec(t.complaints, 1), dec(t.kpi, 1)])}
          >
            <div class="bars">
              <For each={tiers}>
                {(t) => (
                  <div class="bars__row" style={{ cursor: "default" }}>
                    <span class="bars__label">{t.k} ({t.n})</span>
                    <span class="bars__track">
                      <span class="bars__bar" style={{ width: `${(t.kpi / tiers[2].kpi) * 100}%`, background: "var(--fake)" }} />
                    </span>
                    <span class="bars__value" data-metric={`tier.${t.k}.kpi`} data-value={t.kpi}>
                      {int(t.kpi)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </ChartFigure>
          <p class="figure-note">
            Bars are the shipped KPI. Mean complaints per firm:{" "}
            <For each={tiers}>
              {(t, i) => (
                <>
                  {i() > 0 ? " · " : ""}
                  {t.k}{" "}
                  <span data-metric={`tier.${t.k}.complaints`} data-value={t.complaints}>
                    {dec(t.complaints, 1)}
                  </span>
                </>
              )}
            </For>
            . All ten top-KPI firms are the smallest in the file, and the KPI ranking correlates{" "}
            <span data-metric="kpi_rank_corr" data-value={KPI_RANK_CORR}>{dec(KPI_RANK_CORR, 3)}</span>{" "}
            with the market-share ranking inverted.
          </p>
        </div>
      </section>

      {/* =============================== SO WHAT =============================== */}
      <section class="sowhat">
        <InsightCallout
          recommendations={[
            {
              text: `Prioritise five product-issue pairs. They carry ${pct(pairs().topShare, 1)} of all monetary relief on ${pct(pairs().topVolume, 1)} of complaints.`,
              evidence: `Relief rate ranges ${dec(severity()[severity().length - 1]?.moneyRate ?? 0, 2)}%-${dec(severity()[0]?.moneyRate ?? 0, 2)}% across ${severity().length} issues with n≥300.`,
              chartId: "fig-pairs",
            },
            {
              text: `Investigate what changed in 2021. Timeliness fell to ${pct(worstYear().rate, 2)} and has not recovered - everywhere except mortgages.`,
              evidence: `${broken().falling} of ${broken().tested} product, channel and region cuts with n≥${BREAK_MIN_N} either side fall by more than ${BREAK_MIN_DROP}pp. Mortgage held at ${pct(mortgage2021(), 2)}.`,
              chartId: "fig-timely",
            },
            {
              text: "Do not rank companies from this file, and do not use the shipped per-market-share metric. Ask for an attributable register.",
              evidence: `None of the ${CHI.company.length} company-identifier association tests clears Bonferroni; the strongest reaches only p=${dec(CHI.companyMinP, 3)}. The shipped KPI correlates ${dec(KPI_RANK_CORR, 3)} with the size ranking inverted.`,
              chartId: "fig-diagonal",
            },
          ]}
        />
      </section>

      {/* ============================= PROVENANCE ============================= */}
      <footer class="provenance">
        <p>
          <strong>Source</strong> Onyx Data DataDNA · October 2025 · Consumer Financial
          Complaints · {int(META.sourceRows as number)} complaints, {int(COMPANIES.length)}{" "}
          companies · sha256 <code>73a60d72...c384</code>
        </p>
        <p>
          <strong>Method</strong> Star schema in DuckDB; the complete {CHI.total}-test association
          grid over twelve categorical columns, plotted against degrees of freedom. Every figure
          on this page is recomputed from the parquet by an independent DuckDB query and asserted
          against this DOM.
        </p>
        <p>
          <strong>Units &amp; caveats</strong> Timeliness divides by <em>resolved</em> complaints:
          including the {int(impossibles().inProgress)} in progress as failures gives{" "}
          <span data-metric="timely_wrong" data-value={timelyWrong()}>{pct(timelyWrong(), 2)}</span>{" "}
          instead of {pct(timely(), 2)}. Resolution is right-censored from 2023-05, so the year
          bars hold those months out. The final month is truncated at 2023-08-28. Monetary relief
          is a proxy for severity, not a measure of harm. Complaint IDs are <em>not</em> in strict
          date order -{" "}
          <span data-metric="id_backwards_pct" data-value={META.idBackwardsPct as number}>
            {pct(META.idBackwardsPct as number, 2)}
          </span>{" "}
          of adjacent pairs step backwards by a median of one day - and the product-issue
          taxonomy is hierarchical rather than a tree:{" "}
          <span data-metric="multi_parent_row_pct" data-value={META.multiParentRowPct as number}>
            {pct(META.multiParentRowPct as number, 2)}
          </span>{" "}
          of rows carry an issue that appears under more than one product, of which{" "}
          <span data-metric="off_hierarchy_row_pct" data-value={META.offHierarchyRowPct as number}>
            {pct(META.offHierarchyRowPct as number, 2)}
          </span>{" "}
          sit outside their issue's modal product. There is no population column, so state counts
          rank population, not risk - which is why this page has no map. Companies are anonymised,
          so no institution can be named from this file.
        </p>
      </footer>

      <Show when={!props.poster}>
        <TourOverlay open={tour()} onClose={() => setTour(false)} steps={TOUR} storageKey={TOUR_KEY} />
      </Show>
    </div>
  );
}
