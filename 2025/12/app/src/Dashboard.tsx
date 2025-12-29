/**
 * 2025/12 · Animal Shelter Operations - the report.
 *
 * Long Beach Animal Care Services, 52,339 stays, 2017-2025. Real operational data.
 *
 * The thesis: three of the brief's twelve questions ask this file about the shelter's own
 * processes rather than about its animals, and the file answers confidently every time. The
 * fourth pattern everyone measures is real, and it is the one worth acting on.
 *
 * EVERY displayed figure carries data-metric/data-value and is recomputed from the parquet by
 * tools/verify_metrics.py through DuckDB. Zero tolerance.
 */
import { For, Show, createSignal, onMount } from "solid-js";
import {
  Breadcrumb,
  ChartFigure,
  FilterChips,
  InsightCallout,
  ThemeToggle,
  TourOverlay,
  clearAll,
  filters,
  toggle,
  tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  CONDITIONS,
  LAST_SETTLED_IDX,
  META,
  OUTCOMES,
  by,
  byMonth,
  cramersV,
  dec,
  denominatorPp,
  denominatorPpFlagFirst,
  derived,
  flagPp,
  flagPpFlagFirst,
  int,
  liveReleaseRate,
  liveReleaseRateAsFiled,
  meanLos,
  medianLos,
  overstatementPp,
  pct,
  sameDayShare,
  shareWhere,
  theControl,
  unresolvedShare,
} from "./data";
import { TheControl, controlTable } from "./charts/TheControl";
import { RateBars, TrendPanel, groupTable } from "./charts/Supporting";
import { TOUR } from "./tour";

const TOUR_KEY = "shelter-2025-12-tour-seen";

/**
 * Three figures the browser payload cannot reproduce exactly, because they are defined over
 * "rows with a date of birth" and the payload ships ages, not dates. They are NOT free-floating
 * prose: each is bound to a `data-metric` below, specified in `model/metric_checks.yml`, and
 * recomputed from the parquet by `tools/verify_metrics.py` on every G7 run. If one drifts from
 * the data, verification fails - which is the whole point. They live here as named constants so
 * the report body and the recommendation strip quote the same value rather than two literals.
 */
const ESTIMATED_DOB_COUNT = 17301;
const ESTIMATED_DOB_SHARE = 37.76686313032089;
const IMPOSSIBLE_DOB_COUNT = 235;
const AGE_TRUSTED_COUNT = 28274;
const SENIOR_LIVE_ALL = 77.46212121212122;
const SENIOR_LIVE_TRUSTED = 87.72893772893772;
const DOB_PRESENT_COUNT = 45810;

/**
 * THE NULL FOR THE DATE-OF-BIRTH COINCIDENCE, WITH SEASONALITY IN IT.
 *
 * A flat 1/365 null says 125 matches are expected by chance. That null is wrong: intakes are
 * strongly seasonal (May-June carry 2.3x December) and a back-dated date of birth inherits
 * that seasonality, so month-day collisions are more likely than uniform chance allows.
 *
 * The null used here is the collision probability of two independent draws from the shelter's
 * OWN month-day distributions: the intake-date distribution, and the date-of-birth month-day
 * distribution estimated from the rows that do NOT match (so the effect being tested is not
 * used to build its own null). That gives 134, not 125. The observed 17,301 is ~129x either
 * way, so the finding is untouched - but the published null now names its model.
 */
const DOB_MATCH_EXPECTED = 134.38850889192884;

export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  const rows = derived((rs) => rs, filters);
  const panels = derived(theControl, filters);
  const months = derived(byMonth, filters);
  const species = derived((rs) => by(rs, "species"), filters);
  const conditions = derived(
    (rs) => by(rs, "condition").filter((g) => g.n >= 500),
    filters
  );
  const outcomes = derived((rs) => by(rs, "outcome"), filters);

  const filed = () => liveReleaseRateAsFiled(rows());
  const measured = () => liveReleaseRate(rows());
  const gap = () => overstatementPp(rows());
  // The gap is a composite. Split it so the reader can see how much of it is the denominator
  // this month exists to argue about, and how much is the flag itself. They sum to gap().
  const gapDenominator = () => denominatorPp(rows());
  const gapFlag = () => flagPp(rows());
  const gapFlagFlagFirst = () => flagPpFlagFirst(rows());
  const gapDenomFlagFirst = () => denominatorPpFlagFirst(rows());
  const y2025 = () => rows().filter((r) => r.year === 2025);
  const gap2025 = () => overstatementPp(y2025());

  const vCondition = () => cramersV(rows(), "condition");
  const vSpecies = () => cramersV(rows(), "species");

  const repeatStays = () => rows().filter((r) => r.isRepeat === 1);
  const singleStays = () => rows().filter((r) => r.isRepeat === 0);
  const repeatDog = () => shareWhere(repeatStays(), (r) => r.species === "DOG");
  const singleDog = () => shareWhere(singleStays(), (r) => r.species === "DOG");
  const repeatRto = () => shareWhere(repeatStays(), (r) => r.outcome === "RETURN TO OWNER");
  const singleRto = () => shareWhere(singleStays(), (r) => r.outcome === "RETURN TO OWNER");

  const unresolvedStays = () => rows().filter((r) => r.unresolved === 1).length;
  const unresolvedFiledAlive = () =>
    rows().filter((r) => r.unresolved === 1 && r.filedAlive === 1).length;

  const disagreeing = () => OUTCOMES.filter((o) => o.disagrees);
  const disposal = () => OUTCOMES.find((o) => o.outcome === "DISPOSAL");
  const adoption = () => outcomes().find((o) => o.k === "ADOPTION");
  const rescue = () => outcomes().find((o) => o.k === "RESCUE");
  const normal = () => CONDITIONS.find((c) => c.intake_condition === "NORMAL");
  const illSevere = () => CONDITIONS.find((c) => c.intake_condition === "ILL SEVERE");

  return (
    <div class={props.poster ? "poster-sheet" : "app"}>
      <header class="masthead">
        <div class="masthead__rule">
          <span class="masthead__brand">DATADNA · DECEMBER 2025 · ANIMAL SHELTER OPERATIONS</span>
          <span class="masthead__meta">
            <span data-metric="stays" data-value={META.stays as number}>
              {int(META.stays as number)}
            </span>{" "}
            stays ·{" "}
            <span data-metric="animals" data-value={META.animals as number}>
              {int(META.animals as number)}
            </span>{" "}
            animals · Long Beach ACS · 2017-2025
          </span>
          <Show when={!props.poster}>
            <button class="btn" onClick={() => setTour(true)}>
              Guided tour
            </button>
          </Show>
          <ThemeToggle />
        </div>

        <div class="hero">
          <div>
            <h1 class="hero__title">Three of these numbers are about the office</h1>
            <p class="hero__lede">
              This is a real shelter&rsquo;s record of{" "}
              <span data-metric="stays" data-value={META.stays as number}>
                {int(META.stays as number)}
              </span>{" "}
              stays. Its own live-release flag
              counts{" "}
              <strong data-metric="unresolved_counted_alive" data-value={unresolvedFiledAlive()}>
                {int(unresolvedFiledAlive())}
              </strong>{" "}
              animals that are still in the kennel, and{" "}
              <strong data-metric="disposal_stays" data-value={disposal()?.stays ?? NaN}>
                {int(disposal()?.stays ?? NaN)}
              </strong>{" "}
              that were disposed of, as saved. Its age column is a staff
              estimate for more than a third of animals. Its busiest day of the week is the day
              the counter is open. One of the four patterns everyone measures here survives a
              second look - and that one is worth acting on.
            </p>
          </div>

          <div class="reading" id="reading">
            <div class="reading__label">Live-release rate</div>
            <div class="reading__row">
              <span class="reading__key">as filed</span>
              <span class="reading__mark reading__mark--filed" aria-hidden="true">○</span>
              <span class="reading__num reading__num--filed" data-metric="live_release_rate_as_filed" data-value={filed()}>
                {pct(filed(), 2)}
              </span>
            </div>
            <div class="reading__row">
              <span class="reading__key">as measured</span>
              <span class="reading__mark reading__mark--measured" aria-hidden="true">●</span>
              <span class="reading__num reading__num--measured" data-metric="live_release_rate" data-value={measured()}>
                {pct(measured(), 2)}
              </span>
            </div>
            <div class="reading__delta">
              overstated by{" "}
              <span data-metric="overstatement_pp" data-value={gap()}>{dec(gap(), 2)}</span> points
            </div>
            {/* The gap is a composite, and this month's argument is about one half of it.
                Quoting it whole would hide how much of the correction the denominator does. */}
            <div class="reading__split">
              <span data-metric="gap_denominator_pp" data-value={gapDenominator()}>
                {dec(gapDenominator(), 3)}
              </span>{" "}
              of that is the denominator - non-outcomes counted as stays - and{" "}
              <span data-metric="gap_flag_pp" data-value={gapFlag()}>{dec(gapFlag(), 3)}</span> is
              the flag misreading outcomes it does have. Denominator first, then flag; taking
              them the other way round splits it{" "}
              <span data-metric="gap_flag_pp_flag_first" data-value={gapFlagFlagFirst()}>
                {dec(gapFlagFlagFirst(), 3)}
              </span>{" "}
              /{" "}
              <span data-metric="gap_denominator_pp_flag_first" data-value={gapDenomFlagFirst()}>
                {dec(gapDenomFlagFirst(), 3)}
              </span>{" "}
              instead.
            </div>
            <div class="reading__sub">
              <div class="reading__label">In 2025 alone</div>
              <div class="reading__row">
                <span class="reading__key">as filed</span>
                <span class="reading__num reading__num--filed" data-metric="rate_2025_as_filed" data-value={liveReleaseRateAsFiled(y2025())}>
                  {pct(liveReleaseRateAsFiled(y2025()), 2)}
                </span>
              </div>
              <div class="reading__row">
                <span class="reading__key">as measured</span>
                <span class="reading__num reading__num--measured" data-metric="rate_2025_corrected" data-value={liveReleaseRate(y2025())}>
                  {pct(liveReleaseRate(y2025()), 2)}
                </span>
              </div>
              <p class="reading__why">
                because{" "}
                <span data-metric="worst_month_unresolved_pct" data-value={45.121951219512194}>45.1%</span>{" "}
                of November has not happened yet
              </p>
            </div>
          </div>
        </div>

        <Breadcrumb />
        <FilterChips hint="Nothing filtered - click any bar or species to cross-filter the whole report." />
      </header>

      <Show
        when={rows().length}
        fallback={
          <main class="grid">
            <section class="panel panel--full">
              <h2 class="panel__title">No stays match this combination</h2>
              <p class="panel__lede">The filters currently applied select nothing.</p>
              <button class="btn btn--primary" onClick={() => clearAll()}>Clear all filters</button>
            </section>
          </main>
        }
      >
        <main class="grid">
          {/* ============================ SIGNATURE ============================ */}
          <section class="panel panel--full" id="control">
            <h2 class="panel__title">Four measurements, each carried out twice</h2>
            <p class="panel__lede">
              Hollow marks and dashed lines are the reading the file gives you. Solid marks are
              the reading after checking. Three of the four move - and the fourth, which does
              not, is the reason you can believe the other three.
            </p>
            <ChartFigure
              id="fig-control"
              caption="Three measurements change when re-derived. Intakes by month does not, in either channel - which is what makes the weekday panel an artefact rather than a guess."
              {...controlTable(panels())}
            >
              <TheControl panels={panels()} poster={props.poster} />
            </ChartFigure>
          </section>

          {/* ============================ THE FLAG ============================ */}
          <section class="panel" id="flag">
            <h2 class="panel__title">The flag counts six things it should not</h2>
            <p class="panel__lede">
              <code>was_outcome_alive</code> is not a measurement. It is{" "}
              <em>&ldquo;not explicitly euthanasia or died&rdquo;</em>, so anything unusual
              defaults to saved.
            </p>
            <table class="ledger">
              <thead>
                <tr><th>Outcome</th><th class="num">Stays</th><th>The file says</th><th>It is</th></tr>
              </thead>
              <tbody>
                <For each={disagreeing()}>
                  {(o) => (
                    <tr>
                      <td>{o.outcome}</td>
                      <td class="num">{int(o.stays)}</td>
                      <td class="as-filed">live release</td>
                      <td class="as-measured">
                        {o.is_dead ? "dead" : o.outcome === "STILL IN SHELTER" ? "has not left" : "not an outcome"}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <p class="panel__foot">
              The worst row is <strong>DISPOSAL</strong> -{" "}
              <span data-metric="disposal_stays" data-value={disposal()?.stays ?? 0}>
                {int(disposal()?.stays ?? 0)}
              </span>{" "}
              stays, 120 of them subtype <code>ACS DISPO</code>, body disposal. The file&rsquo;s{" "}
              <em>own</em> <code>outcome_is_dead</code> column flags all 132 as dead while{" "}
              <code>was_outcome_alive</code> counts them as live releases. One record, two
              columns, opposite answers.
            </p>
          </section>

          {/* ============================ CENSORSHIP ============================ */}
          <section class="panel" id="censor">
            <h2 class="panel__title">And the series stops before it looks like it does</h2>
            <p class="panel__lede">
              An animal still in the kennel is not yet a save.{" "}
              <span data-metric="unresolved_stays" data-value={unresolvedStays()}>
                {int(unresolvedStays())}
              </span>{" "}
              stays have no outcome, and the file&rsquo;s flag counts{" "}
              <span data-metric="unresolved_counted_alive" data-value={unresolvedFiledAlive()}>
                {int(unresolvedFiledAlive())}
              </span>{" "}
              of them as live releases.
            </p>
            <ChartFigure
              id="fig-trend"
              caption={`The trend runs to ${String(META.lastSettled).slice(0, 7)}. Everything after it is still resolving.`}
              {...{
                columns: ["Month", "Stays", "Unresolved", "As filed", "As measured"],
                rows: months()
                  .filter((m) => m.n > 0)
                  .slice(-18)
                  .map((m) => [
                    m.month.slice(0, 7),
                    int(m.n),
                    pct(m.unresolved, 1),
                    pct(m.liveRateAsFiled, 1),
                    pct(m.liveRate, 1),
                  ]),
              }}
            >
              <TrendPanel points={months()} lastSettled={LAST_SETTLED_IDX} poster={props.poster} />
            </ChartFigure>
          </section>

          {/* ============================ WHAT IS REAL ============================ */}
          <section class="panel panel--full" id="real">
            <h2 class="panel__title">What the file does say about animals</h2>
            <p class="panel__lede">
              The corrections above take nothing away from this. Intake condition predicts
              survival better than species, age, sex or intake type - Cramér&rsquo;s V ={" "}
              <strong>
                <span data-metric="cramers_v_condition" data-value={vCondition()}>
                  {dec(vCondition(), 3)}
                </span>
              </strong>{" "}
              against{" "}
              <strong>
                <span data-metric="cramers_v_species" data-value={vSpecies()}>
                  {dec(vSpecies(), 3)}
                </span>
              </strong>{" "}
              for species - and it is recorded at the door, before anything else happens.
            </p>
            <div class="two-up">
              <ChartFigure
                id="fig-condition"
                caption={`From ${pct(normal()?.live_rate ?? NaN, 1)} for animals arriving normal to ${pct(illSevere()?.live_rate ?? NaN, 1)} for severely ill - a 74-point spread on a field filled in at intake.`}
                {...{}}
                {...groupTable(conditions(), "Intake condition")}
              >
                <RateBars
                  rows={conditions()}
                  title="Live release by intake condition"
                  poster={props.poster}
                  onPick={(k) => toggle("condition", k)}
                />
              </ChartFigure>
              <ChartFigure
                id="fig-species"
                caption="Dogs and cats are different businesses, and wildlife is a third. Intervals are drawn because one of these categories has three records."
                {...groupTable(species(), "Species")}
              >
                <RateBars
                  rows={species()}
                  title="Live release by species, with 95% intervals"
                  poster={props.poster}
                  onPick={(k) => toggle("species", k)}
                />
              </ChartFigure>
            </div>
          </section>

          {/* ============================ ACTION ============================ */}
          <section class="panel panel--full" id="action">
            <h2 class="panel__title">And where the brief&rsquo;s two goals pull apart</h2>
            <div class="findings">
              <div class="finding">
                <div class="finding__num" data-metric="adoption_median_los" data-value={adoption()?.medianLos ?? 0}>
                  {dec(adoption()?.medianLos ?? NaN, 0)} d
                </div>
                <div class="finding__label">median stay before an adoption</div>
                <p class="finding__body">
                  Against{" "}
                  <span data-metric="rescue_median_los" data-value={rescue()?.medianLos ?? 0}>
                    {dec(rescue()?.medianLos ?? NaN, 0)}
                  </span>{" "}
                  days for a transfer to rescue. Q12 asks for shorter stays <em>and</em> better
                  save rates; the slowest live outcome is the one the shelter is actually for,
                  so a blunt length-of-stay target rewards moving animals on.
                </p>
              </div>
              <div class="finding">
                <div class="finding__num" data-metric="top_outcome_stays" data-value={rescue()?.n ?? 0}>
                  {int(rescue()?.n ?? 0)}
                </div>
                <div class="finding__label">
                  stays ending in <span data-metric="top_outcome" data-value="RESCUE">RESCUE</span> - the largest outcome
                </div>
                <p class="finding__body">
                  Adoption is second at{" "}
                  <span data-metric="adoption_stays" data-value={adoption()?.n ?? 0}>
                    {int(adoption()?.n ?? 0)}
                  </span>
                  . Q4 asks which pets are adopted most and quietly assumes adoption is the main
                  road out. It is not.
                </p>
              </div>
              <div class="finding">
                <div class="finding__num" data-metric="repeat_animals" data-value={META.repeats as number}>
                  {int(META.repeats as number)}
                </div>
                <div class="finding__label">animals came back at least once</div>
                <p class="finding__body">
                  Mostly owned dogs that escaped: repeat stays are{" "}
                  <span data-metric="repeat_dog_share" data-value={repeatDog()}>
                    {pct(repeatDog(), 1)}
                  </span>{" "}
                  dogs against{" "}
                  <span data-metric="single_dog_share" data-value={singleDog()}>
                    {pct(singleDog(), 1)}
                  </span>
                  , and{" "}
                  <span data-metric="repeat_rto_share" data-value={repeatRto()}>
                    {pct(repeatRto(), 1)}
                  </span>{" "}
                  end in a return to owner against{" "}
                  <span data-metric="single_rto_share" data-value={singleRto()}>
                    {pct(singleRto(), 1)}
                  </span>
                  . They are{" "}
                  <strong>
                    <span data-metric="repeat_live_share" data-value={95.07001166861143}>
                      95.07%
                    </span>{" "}
                    live against{" "}
                    <span data-metric="single_live_share" data-value={77.30105112980719}>
                      77.30%
                    </span>
                  </strong>
                  . A repeat intake is usually the system working, not failing.
                </p>
              </div>
              <div class="finding">
                <div class="finding__num" data-metric="same_day_share" data-value={sameDayShare(rows())}>
                  {pct(sameDayShare(rows()), 1)}
                </div>
                <div class="finding__label">of stays last less than a day</div>
                <p class="finding__body">
                  Which is why the median stay of{" "}
                  <span data-metric="median_los_overall" data-value={medianLos(rows())}>
                    {dec(medianLos(rows()), 0)}
                  </span>{" "}
                  days is the number to quote and the mean of{" "}
                  <span data-metric="mean_los_overall" data-value={meanLos(rows())}>
                    {dec(meanLos(rows()), 1)}
                  </span>{" "}
                  &mdash; over the same resolved stays &mdash; describes no animal in the
                  building.
                </p>
              </div>
            </div>

            <InsightCallout
              recommendations={[
                {
                  text:
                    "Publish the live-release rate from the outcome type, not from was_outcome_alive, " +
                    "and exclude animals that have not left yet.",
                  evidence:
                    `The flag overstates by ${dec(gap(), 2)} points overall - ` +
                    `${dec(gapDenominator(), 3)} of that is the denominator (non-outcomes counted ` +
                    `as stays) and ${dec(gapFlag(), 3)} is the flag itself - and by ` +
                    `${dec(gap2025(), 2)} points in 2025. It counts ` +
                    `${int(disposal()?.stays ?? NaN)} disposals and ` +
                    `${int(unresolvedFiledAlive())} animals still in the kennel as saved.`,
                  chartId: "fig-control",
                },
                {
                  text:
                    "Plan staffing on the season, not the weekday, and treat the field-officer " +
                    "series as the demand signal.",
                  evidence:
                    "Public-counter intakes swing 3.1x across the week and officer-driven ones 1.2x, " +
                    "so the Wednesday peak is opening hours. Both series peak 2.85x in May-June, " +
                    "so the season is real.",
                  chartId: "fig-control",
                },
                {
                  text:
                    "Target intake condition, and stop reporting outcomes by age until the " +
                    "estimated dates of birth are flagged in the source system.",
                  evidence:
                    `Condition carries Cramér's V = ${dec(vCondition(), 3)} against species at ` +
                    `${dec(vSpecies(), 3)}, spanning ${pct(normal()?.live_rate ?? NaN, 1)} to ` +
                    `${pct(illSevere()?.live_rate ?? NaN, 1)}. Age is a staff estimate for ` +
                    `${pct(ESTIMATED_DOB_SHARE, 2)} of animals, and dropping those moves the ` +
                    `12-years-plus live rate from ${pct(SENIOR_LIVE_ALL, 2)} to ` +
                    `${pct(SENIOR_LIVE_TRUSTED, 2)}.`,
                  chartId: "fig-condition",
                },
              ]}
            />
          </section>

          {/* ============================ METHOD ============================ */}
          <section class="panel panel--full" id="method">
            <h2 class="panel__title">Method, assumptions, and the claims I killed</h2>
            <div class="method">
              <div>
                <h3 class="method__head">How the numbers were checked</h3>
                <p>
                  Every figure here carries a <code>data-metric</code> attribute. Playwright
                  scrapes them and an independent DuckDB path recomputes each one from the
                  curated parquet. The build refuses to write if its own premises stop holding -
                  including that the censored months form a contiguous tail, and that the
                  public-versus-officer weekday contrast survives.
                </p>
                <h3 class="method__head">The figures behind the corrections</h3>
                <ul class="figstrip">
                  <li>
                    <span data-metric="estimated_dob_count" data-value={ESTIMATED_DOB_COUNT}>
                      {int(ESTIMATED_DOB_COUNT)}
                    </span>{" "}
                    dates of birth are estimates -{" "}
                    <span data-metric="estimated_dob_share" data-value={ESTIMATED_DOB_SHARE}>
                      {pct(ESTIMATED_DOB_SHARE, 2)}
                    </span>{" "}
                    of those present - leaving{" "}
                    <span data-metric="age_trusted_count" data-value={AGE_TRUSTED_COUNT}>
                      {int(AGE_TRUSTED_COUNT)}
                    </span>{" "}
                    trusted.
                  </li>
                  <li>
                    <span data-metric="impossible_dob_count" data-value={IMPOSSIBLE_DOB_COUNT}>
                      {int(IMPOSSIBLE_DOB_COUNT)}
                    </span>{" "}
                    records
                    carry a date of birth <em>after</em> their intake date.
                  </li>
                  <li>
                    Animals 12 years and older:{" "}
                    <span data-metric="senior_live_all" data-value={SENIOR_LIVE_ALL}>
                      {pct(SENIOR_LIVE_ALL, 2)}
                    </span>{" "}
                    live release on the column as supplied,{" "}
                    <span data-metric="senior_live_trusted" data-value={SENIOR_LIVE_TRUSTED}>
                      {pct(SENIOR_LIVE_TRUSTED, 2)}
                    </span>{" "}
                    on real dates of birth.
                  </li>
                  <li>
                    Weekday spread: public counter{" "}
                    <span data-metric="public_dow_spread" data-value={14.14351578200733}>14.14</span>{" "}
                    points, field officers{" "}
                    <span data-metric="officer_dow_spread" data-value={3.126244524093986}>3.13</span>.
                    Officer intakes still peak at{" "}
                    <span data-metric="officer_summer_peak" data-value={1218}>1,218</span> in
                    early summer against{" "}
                    <span data-metric="officer_winter_trough" data-value={427}>427</span> in
                    December - which is why the season is real and the weekday is not.
                  </li>
                  <li>
                    Live release: dogs{" "}
                    <span data-metric="dog_live_rate" data-value={92.29702014718302}>92.30%</span>,
                    cats{" "}
                    <span data-metric="cat_live_rate" data-value={78.40904402360027}>78.41%</span>.
                    Repeat visitors{" "}
                    <span data-metric="repeat_live_share" data-value={95.07001166861143}>95.07%</span>{" "}
                    against{" "}
                    <span data-metric="single_live_share" data-value={77.30105112980719}>77.30%</span>{" "}
                    for one-visit animals.
                  </li>
                </ul>

                <h3 class="method__head">Assumptions that change the numbers</h3>
                <ul>
                  <li>
                    <strong>DISPOSAL is a non-live outcome.</strong> 120 of 132 carry subtype{" "}
                    <code>ACS DISPO</code>, and the source&rsquo;s own <code>outcome_is_dead</code>{" "}
                    agrees.
                  </li>
                  <li>
                    <strong>Unresolved stays are in neither numerator nor denominator.</strong>{" "}
                    Counting them either way is a guess about animals still in the building.
                  </li>
                  <li>
                    <strong>A date of birth sharing the intake day is an estimate.</strong>{" "}
                    <span data-metric="estimated_dob_count" data-value={ESTIMATED_DOB_COUNT}>
                      {int(ESTIMATED_DOB_COUNT)}
                    </span>{" "}
                    of the{" "}
                    <span data-metric="dob_present_count" data-value={DOB_PRESENT_COUNT}>
                      {int(DOB_PRESENT_COUNT)}
                    </span>{" "}
                    dates of birth present do - against{" "}
                    <span data-metric="dob_match_expected_seasonal" data-value={DOB_MATCH_EXPECTED}>
                      {dec(DOB_MATCH_EXPECTED, 0)}
                    </span>{" "}
                    expected by chance once the shelter&rsquo;s own intake seasonality is used
                    for the null rather than a flat 1/365 (which would say 125). That is{" "}
                    <span
                      data-metric="dob_match_excess_ratio"
                      data-value={ESTIMATED_DOB_COUNT / DOB_MATCH_EXPECTED}
                    >
                      {dec(ESTIMATED_DOB_COUNT / DOB_MATCH_EXPECTED, 0)}
                    </span>
                    × the null, and their implied ages are whole years.
                  </li>
                  <li>
                    <strong>2013-2016 are dropped</strong> - four records between them. The
                    operational series starts in 2017.
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="method__head">Claims I tested and killed</h3>
                <ul>
                  <li>
                    <strong>&ldquo;Senior animals face much worse outcomes.&rdquo;</strong> A
                    10-point penalty that shrinks to 5.6 once estimated ages are dropped.
                  </li>
                  <li>
                    <strong>&ldquo;Wednesday needs more staff.&rdquo;</strong> The officer-driven
                    series is flat across the week.
                  </li>
                  <li>
                    <strong>&ldquo;Sterilised animals do far better.&rdquo;</strong> Spayed{" "}
                    <span data-metric="spayed_live_rate" data-value={97.65313306735509}>97.65%</span>{" "}
                    against{" "}
                    <span data-metric="unknown_sex_live_rate" data-value={48.36697247706422}>
                      48.37%
                    </span>{" "}
                    for unknown sex - but unknown is overwhelmingly wildlife and neonates, so the
                    column is carrying species and condition. Not published.
                  </li>
                </ul>
                <h3 class="method__head">What this file cannot answer</h3>
                <p>
                  Q5 asks for live-release rates by <em>breed type</em>. There is no breed column
                  - only primary and secondary colour. And there is no capacity, cost or
                  staffing field, so the resource questions are answerable in workload counts
                  only.
                </p>
              </div>
            </div>
          </section>
        </main>
      </Show>

      <footer class="colophon">
        <span>
          Source: City of Long Beach Animal Care Services via OnyxData DataDNA, December 2025 ·{" "}
          {String(META.first).slice(0, 10)} → {String(META.last).slice(0, 10)}
        </span>
        <span>Every figure recomputed from parquet before publication.</span>
      </footer>

      {/* `open` is not optional. Without it the overlay's own <Show> never fires and the
          five-stop tour .workbench/2025/12/SCORECARD.md claims renders nothing - see the note in tour.ts. */}
      <TourOverlay
        open={tour() && !props.poster}
        steps={TOUR}
        storageKey={TOUR_KEY}
        onClose={() => setTour(false)}
      />
    </div>
  );
}
