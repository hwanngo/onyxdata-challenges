/**
 * 2026/07 - Global AI Adoption & Workforce Displacement Index.
 *
 * Nine numbered objects, read in order. Row heights budgeted in .workbench/2026/07/design/direction.md before any
 * component existed - the practice that halved 2026/05's G6 cost.
 */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { KpiTile, TourOverlay, filters, toggle, clearAll, type TourStep } from "@onyxdata/dna-kit";
import { Step, FitToggle } from "./charts/Step";
import {
  CountryTable, DefectLedger, JobsPanel, PanelGap, QuestionLedger, RiskValidation, SkillTable,
} from "./charts/Panels";
import {
  applyCountries, applyQuarters, boot, countries, defects, headline, inapplicableToQuarters,
  int, jobs, pt, pval, questions, quarters, ready, riskDrivers, skills, usd2, fitNote, type Fit,
} from "./data";

/** The tour is a FUNCTION of the headline, not a constant array.
 *
 *  Every figure in it is a fitted quantity. 2025/08 shipped a tour that said "981 of them are
 *  the 982 longest-standing members" while the KPI behind it rendered 982 - a hardcoded string
 *  cannot disagree with itself, only with the data, and nothing was comparing them. */
function tour(h: Record<string, any>): TourStep[] {
  return [
    {
      h: "One step, and nothing since",
      p: `The chart draws sixteen observed quarterly means with both candidate models over them. A step at 2022-Q4 fits ${pt(h.step_beats_line_by ?? 0)} times better than a straight line. Within each era the slope is indistinguishable from flat: p of ${pt(h.pre_slope_p ?? 0, 3)} before and ${pt(h.post_slope_p ?? 0, 3)} after.`,
    },
    {
      h: "Why the line matters even though it is wrong",
      p: `The linear fit is real. It is significant at p ${pval(h.linear_p ?? 1)} with an R-squared of ${pt(h.linear_r2 ?? 0, 3)}, and it is what a policy pack would contain. But adoption rising ${pt(h.linear_slope ?? 0)} points a quarter and adoption moving once two years ago imply opposite funding decisions - one says scale the programme, the other says ask why nothing has moved.`,
    },
    {
      h: "The risk index does not measure risk",
      p: `It is documented as a composite score estimating a segment's exposure to AI-driven displacement. Across ${h.risk_drivers_tested ?? 8} candidate drivers - industry automation susceptibility and skill replaceability among them - the strongest reaches an absolute rho of only ${pt(h.risk_max_abs_rho ?? 0, 3)}, and ${h.risk_drivers_related ?? 0} clear the threshold this page calls a relationship.`,
    },
    {
      h: "And jobs created is jobs displaced, rescaled",
      p: `Created equals ${pt(h.jobs_created_slope ?? 0, 4)} times displaced plus an intercept, with an R-squared of ${pt(h.jobs_created_r2 ?? 0, 3)}. On the 295 records where the ratio is defined it never reaches one, and ${h.rows_net_positive ?? 0} of ${h.rows ?? 300} have more jobs created than displaced. Where creation offsets displacement is answered by construction, not by measurement.`,
    },
    {
      h: "What to do instead",
      p: `Panel 8 lists four columns that would make the coalition's question answerable. The one figure here that needs no inference is ${usd2(h.reskilling_per_displaced_worker ?? 0)} of reskilling investment per displaced worker. Click any quarter to filter the page; press the question-mark key to reopen this tour.`,
    },
  ];
}

export default function Dashboard(props: { poster?: boolean }) {
  const [fit, setFit] = createSignal<Fit>("both");
  const [picked, setPicked] = createSignal<number | null>(null);
  const [tourOpen, setTourOpen] = createSignal(false);
  const [failed, setFailed] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await boot();
      if (!props.poster && !localStorage.getItem("dna-2026-07-tour")) {
        setTourOpen(true);
        localStorage.setItem("dna-2026-07-tour", "1");
      }
    } catch (e) { setFailed(String(e)); }
  });

  const onKey = (e: KeyboardEvent) => { if (e.key === "?" && !props.poster) setTourOpen(true); };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  const h = () => headline();
  const shown = createMemo(() => applyQuarters(quarters(), filters()));
  const shownCountries = createMemo(() => applyCountries(countries(), filters()));
  const blocked = createMemo(() => inapplicableToQuarters(filters()));
  const filtering = () => filters().length > 0;
  const onFilter = (field: string, value: string | number) => toggle(field, value);
  const isActive = (field: string, value: string | number) =>
    filters().some((f) => f.field === field && f.values.some((v) => String(v) === String(value)));

  return (
    <div class="page" classList={{ "page--poster": props.poster }}>
      {/* ① */}
      <header class="thesis">
        <h1 class="thesis__h">
          This file knows one date
          <span class="thesis__em"> and nothing else.</span>
        </h1>
        <p class="thesis__p">
          One{" "}
          <b class="num" data-metric="step_size_pp" data-value={h().step_size_pp}>
            +{pt(h().step_size_pp ?? 0)} point
          </b>{" "}
          jump in AI adoption, landing exactly on a flag the date dimension already carried, flat
          for the seven quarters before and the eight after.
          Nothing else in it predicts anything - and a policy coalition is about to allocate
          national reskilling funding on it.
        </p>
        <p class="thesis__meta">
          <Show when={ready()} fallback={<span class="skel skel--line" />}>
            <span data-metric="rows" data-value={h().rows}>{int(h().rows)}</span> records ·{" "}
            <span data-metric="countries" data-value={shownCountries().length}>
              {shownCountries().length}
            </span> countries ·{" "}
            <span data-metric="industries" data-value={h().industries}>{h().industries}</span> industries ·{" "}
            <span data-metric="skills" data-value={h().skills}>{h().skills}</span> skill categories ·{" "}
            <span data-metric="quarters" data-value={h().quarters}>{h().quarters}</span> quarters ·
            {" "}2021-Q1 - 2024-Q4 · the archive brief states the data is synthetic
          </Show>
        </p>
      </header>

      <Show when={failed()}>
        <p class="error" role="alert">Could not load the data: {failed()}</p>
      </Show>

      <Show when={!props.poster && filtering()}>
        <div class="chips">
          <span class="chips__lab">Filtered:</span>
          <For each={filters()}>
            {(f) => (
              <For each={f.values}>
                {(v) => (
                  <button class="chip" onClick={() => toggle(f.field, v)}>
                    {String(v)} <span aria-hidden="true">×</span>
                    <span class="sr-only">remove filter</span>
                  </button>
                )}
              </For>
            )}
          </For>
          <button class="chip chip--clear" onClick={clearAll}>Clear all</button>
          <span class="chips__n">
            {shownCountries().length} of {countries().length} countries ·{" "}
            {int(shownCountries().reduce((a, c) => a + c.rows, 0))} records ·{" "}
            {shown().length} of {h().quarters ?? 16} quarters
          </span>
          <Show when={blocked().length}>
            {/* Say what is actually true. The 2026-07 audit found this claiming "no segment is
                observed in more than one quarter, so there is no country-by-quarter cell to
                filter to" - which is false twice over: 8 segments ARE seen twice, and both
                tiers span all 16 quarters (min 4 records per cell). The real constraint is
                that the quarterly series is pre-aggregated over every record and carries no
                country attribute, so this is a limit of the published series, not of the file.
                A build limitation dressed as a data finding is the worse failure. */}
            <p class="chips__blocked" role="status">
              <b>{blocked().map((f) => f.field).join(", ")}</b> cannot narrow the quarterly
              series: it is aggregated over all {int(h().rows)} records and carries no country
              attribute, so the series above is still all {h().quarters} quarters. At this grain
              a country-by-quarter cell holds a median of one record, which is why the series is
              published whole.
            </p>
          </Show>
        </div>
      </Show>

      {/* ② */}
      <section class="kpis" aria-label="Headline figures">
        <Show when={ready()} fallback={<For each={[1,2,3,4]}>{() => <div class="skel skel--kpi" />}</For>}>
          <KpiTile metric="questions_answerable"
                   label={`of ${h().questions_asked} questions the two briefs ask has a real answer`}
                   value={h().questions_answerable}
                   display={`${h().questions_answerable} of ${h().questions_asked}`} />
          <KpiTile metric="risk_drivers_related"
                   label={`of ${h().risk_drivers_tested} attributes predict the displacement risk index`}
                   value={h().risk_drivers_related}
                   display={`${h().risk_drivers_related} of ${h().risk_drivers_tested}`} />
          <KpiTile metric="rows_net_positive"
                   label="of 300 records where job creation exceeds displacement"
                   value={h().rows_net_positive} display={`${h().rows_net_positive} of 300`} />
          <KpiTile metric="reskilling_per_displaced_worker"
                   label="reskilling investment per displaced worker"
                   value={h().reskilling_per_displaced_worker}
                   display={usd2(h().reskilling_per_displaced_worker)} />
        </Show>
      </section>

      {/* ③ */}
      <section class="sig" aria-label="The Step">
        <h2 class="sec__h"><span class="sec__n">3</span> The Step</h2>
        <Show when={!props.poster && ready()}>
          <FitToggle value={fit()} onChange={setFit} note={fitNote(h())[fit()]} />
        </Show>
        <Show when={ready()} fallback={<div class="skel skel--chart" />}>
          <Step quarters={shown()} fit={props.poster ? "both" : fit()} headline={h()}
                poster={props.poster} selected={picked()} onPick={setPicked} />
        </Show>
        <Show when={picked() !== null}>
          {(() => {
            const q = () => quarters().find((x) => x.date_id === picked());
            return (
              <p class="picked" role="status">
                <b>{q()?.year_quarter_label}</b> - {q()?.rows} records, mean adoption{" "}
                <b class="num">{pt(q()?.mean_adoption ?? 0)}%</b>. Step model predicts{" "}
                <b class="num">{pt(q()?.step_fit ?? 0)}%</b>; linear model predicts{" "}
                <b class="num">{pt(q()?.linear_fit ?? 0)}%</b>.
                <button class="chip chip--clear" onClick={() => setPicked(null)}>Clear</button>
              </p>
            );
          })()}
        </Show>
      </section>

      {/* ④ ⑤ */}
      <section class="two" aria-label="What the file can answer">
        <div>
          <h2 class="sec__h"><span class="sec__n">4</span> Ten questions. One answer.</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <QuestionLedger questions={questions()} headline={h()} />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">5</span> The risk index does not measure risk</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <RiskValidation drivers={riskDrivers()} skills={skills()} headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑥ ⑦ */}
      <section class="two" aria-label="The two structural defects">
        <div>
          <h2 class="sec__h"><span class="sec__n">6</span> Jobs created is jobs displaced, rescaled</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <JobsPanel jobs={jobs()} headline={h()} poster={props.poster} />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">7</span> There is no panel</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <PanelGap headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑧ */}
      <section class="sowhat-block" aria-label="What to collect">
        <h2 class="sec__h">
          <span class="sec__n">8</span> So what - four columns that would make this answerable
        </h2>
        <ol class="recs">
          <li>
            <b>Repeated measures.</b> The same country × industry × skill, every quarter. Without
            it no segment has a trajectory, and no reskilling programme funded on this can be
            evaluated afterwards.
          </li>
          <li>
            <b>An independent job-creation count.</b> Currently{" "}
            <Show when={ready()}>{pt(h().jobs_created_slope, 4)}</Show> × displacement. Measure
            creation where it happens, not as a fraction of loss.
          </li>
          <li>
            <b>A risk index validated against its own drivers.</b> Publish the correlation with
            automation susceptibility and skill replaceability beside the score. Today both are
            approximately zero.
          </li>
          <li>
            <b>Reskilling spend tied to the displacement it answers.</b> Today ρ ={" "}
            <Show when={ready()}>{pt(h().reskilling_rho, 3)}</Show> (p ={" "}
            <Show when={ready()}>{pt(h().reskilling_p, 3)}</Show>), and the total is{" "}
            <Show when={ready()}>{usd2(h().reskilling_per_displaced_worker)}</Show> per displaced
            worker - the one number here that needs no inference, and the one worth taking to the
            coalition.
          </li>
        </ol>
      </section>

      <Show when={!props.poster && ready()}>
        <section class="explore" aria-label="Explore further">
          <h2 class="sec__h">Explore</h2>
          <div class="explore-grid">
            <CountryTable countries={shownCountries()} headline={h()}
                          onPick={(v) => onFilter("development_tier", v)}
                          active={(v) => isActive("development_tier", v)} />
            <SkillTable skills={skills()} />
            <DefectLedger defects={defects()} />
          </div>
        </section>
      </Show>

      {/* ⑨ */}
      <footer class="foot">
        <Show when={ready()}>
          <p>
            <b>{int(h().rows)} records · 2021-Q1 - 2024-Q4.</b> The archive brief states the data
            is synthetic. Every figure is recomputed from parquet before publication, with
            assertions run against the raw CSVs on an independent path.
          </p>
          <p>
            {/* Stated as a MAXIMUM, not as a bound. "never reaches |ρ| = 0.061" is refuted by
                the observed 0.061046, which is the very number being printed - the bound and
                the max were the same value, so the sentence contradicted its own figure. */}
            <b>No map is drawn:</b> the strongest country attribute reaches only |ρ| ={" "}
            <span data-metric="country_max_abs_rho" data-value={h().country_max_abs_rho}>
              {pt(h().country_max_abs_rho ?? 0, 3)}
            </span>{" "}
            against adoption, and development tier gives Kruskal p ={" "}
            <span data-metric="tier_kruskal_p" data-value={h().tier_kruskal_p}>
              {pt(h().tier_kruskal_p ?? 0, 3)}
            </span>.{" "}
            <b>No top-N risk ranking is drawn:</b> across{" "}
            <span data-metric="risk_drivers_tested" data-value={h().risk_drivers_tested}>
              {h().risk_drivers_tested}
            </span>{" "}
            candidate drivers the index reaches at most |ρ| ={" "}
            <span data-metric="risk_max_abs_rho" data-value={h().risk_max_abs_rho}>
              {pt(h().risk_max_abs_rho ?? 0, 3)}
            </span>, so a ranking of it would be a ranking of noise.{" "}
            <code>gdp_per_capita_usd</code> is ~500× too large and is excluded from every measure.
            All three omissions are deliberate and are findings, not gaps.
          </p>
          <p>
            WCAG 2.1 AA · keyboard-operable charts · every chart carries a screen-reader table ·
            the two models are distinguished by mark type, not colour, because the two accents are
            indistinguishable in greyscale.
          </p>
        </Show>
      </footer>

      <Show when={!props.poster}>
        <button class="tour-btn" onClick={() => setTourOpen(true)} aria-label="Open the guided tour">
          <span aria-hidden="true">?</span>
        </button>
        <TourOverlay open={tourOpen()} onClose={() => setTourOpen(false)}
                     steps={tour(h())} storageKey="dna-2026-07-tour" />
      </Show>
    </div>
  );
}
