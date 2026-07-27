/**
 * Supporting panels - 2026/07.
 *
 * Every panel title states a FINDING. Every figure carries data-metric / data-value so
 * tools/verify_metrics.py can recompute it from the parquet and assert the DOM matches.
 *
 * House rule: every null prints its rho and p in text. --measured and --claimed are 1.10:1
 * apart in lightness, so colour cannot be the encoding anywhere on this page.
 */
import { For, Show, createMemo } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import {
  type Country, type Defect, type JobRow, type Question, type RiskDriver, type Segment,
  type Skill, int, pt, pval, rho, usd2, usdCompact,
} from "../data";

// =========================================================================================
// ④  Ten questions, one answer
// =========================================================================================

export function QuestionLedger(props: {
  questions: Question[]; headline: Record<string, any>;
  onPick?: (v: string) => void; active?: (v: string) => boolean;
}) {
  const h = () => props.headline;
  const real = (q: Question) => q.verdict === "REAL";
  return (
    <ChartFigure
      id="questions"
      caption="Ten questions the two briefs ask. One has a real answer."
      columns={["#", "Asked by", "Question", "Answer", "Statistic", "Verdict"]}
      rows={props.questions.map((q) => [q.n, q.asked_by, q.question, q.answer, q.statistic, q.verdict])}
    >
      <ul class="ql">
        <For each={props.questions}>
          {(q) => (
            <li classList={{ "ql--real": real(q) }}>
              <span class="ql__mark" aria-hidden="true">{real(q) ? "✓" : "✗"}</span>
              <span class="ql__q">{q.question}</span>
              <span class="ql__a">{q.answer}</span>
              <span class="ql__s num">{q.statistic}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="cap">
        <b class="num" data-metric="questions_answerable" data-value={h().questions_answerable}>
          {h().questions_answerable}
        </b>{" "}
        of{" "}
        <b class="num" data-metric="questions_asked" data-value={h().questions_asked}>
          {h().questions_asked}
        </b>{" "}
        - and the one that is answered is answered "it has not changed since 2022-Q4". Every
        verdict here is read from <code>dim_question</code>, so no panel on this page can answer
        one of them differently.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑤  The risk index does not measure risk
// =========================================================================================

export function RiskValidation(props: {
  drivers: RiskDriver[]; skills: Skill[]; headline: Record<string, any>;
}) {
  const h = () => props.headline;
  const BAND = 0.2;                       // the |rho| below which we call it no relationship
  const SCALE = 0.5;                      // half-width of the drawn axis
  const pos = (r: number) => `${50 + (50 * r) / SCALE}%`;
  const topReplace = createMemo(() =>
    props.skills.slice().sort((a, b) => b.ai_replaceability_score - a.ai_replaceability_score)[0]);
  const topRisk = createMemo(() =>
    props.skills.slice().sort((a, b) => b.mean_risk - a.mean_risk)[0]);

  return (
    <ChartFigure
      id="risk"
      caption="The displacement risk index does not correlate with anything that describes displacement risk."
      columns={["Driver", "From", "What it describes", "Spearman rho", "p"]}
      rows={props.drivers.map((d) => [
        d.driver, d.source, d.what_it_describes, rho(d.spearman_rho), pval(d.p_value),
      ])}
    >
      <ul class="rv">
        <For each={props.drivers}>
          {(d) => (
            <li>
              <span class="rv__name">{d.driver}</span>
              <span class="rv__track" role="img"
                    aria-label={`${d.driver}: Spearman rho ${rho(d.spearman_rho)}, p ${pval(d.p_value)}`}>
                <i class="rv__band" />
                <i class="rv__zero" />
                <i class="rv__dot" style={{ left: pos(d.spearman_rho) }} />
              </span>
              <b class="num" data-metric={`risk.${d.driver}.rho`} data-value={d.spearman_rho}>
                {rho(d.spearman_rho)}
              </b>
            </li>
          )}
        </For>
      </ul>
      <p class="rv__scale" aria-hidden="true">
        <span>-0.5</span><span>0</span><span>+0.5</span>
      </p>
      <p class="cap">
        The shaded band is |ρ| &lt; {BAND.toFixed(2)} - the width inside which this page calls a
        correlation no relationship. <b class="num" data-metric="risk_drivers_related"
        data-value={h().risk_drivers_related}>{h().risk_drivers_related}</b> of{" "}
        <b class="num" data-metric="risk_drivers_tested" data-value={h().risk_drivers_tested}>
          {h().risk_drivers_tested}
        </b>{" "}
        drivers fall outside it; the largest is{" "}
        <b class="num" data-metric="risk_max_abs_rho" data-value={h().risk_max_abs_rho}>
          {pt(h().risk_max_abs_rho ?? 0, 3)}
        </b>.
      </p>
      <p class="cap cap--detail">
        Concretely: <b>{topReplace()?.skill_category_name}</b> has the highest replaceability
        score in the file ({pt(topReplace()?.ai_replaceability_score ?? 0, 1)}) and is not the
        highest risk - <b>{topRisk()?.skill_category_name}</b> is. Across all eight categories
        the spread is {pt(Math.min(...props.skills.map((s) => s.mean_risk)))}-
        {pt(Math.max(...props.skills.map((s) => s.mean_risk)))}, at Kruskal p ={" "}
        <b class="num">{pt(h().skill_kruskal_p ?? 0, 3)}</b>.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑥  Jobs created is jobs displaced, rescaled
// =========================================================================================

export function JobsPanel(props: {
  jobs: JobRow[]; headline: Record<string, any>; poster?: boolean;
}) {
  const h = () => props.headline;
  /* A viewBox scales to the container's WIDTH, so its aspect ratio sets the rendered height.
     At 480x300 in a 593px poster panel this drew 371px tall and silently clipped its own row.
     Measured with tools/qa/measure.mjs, not guessed. */
  const W = props.poster ? 480 : 480;
  const H = props.poster ? 190 : 300;
  const PAD = props.poster ? 34 : 46;
  const maxD = createMemo(() => Math.max(...props.jobs.map((j) => j.jobs_displaced_count), 1));
  const x = (v: number) => PAD + (v / maxD()) * (W - PAD * 1.3);
  const y = (v: number) => H - PAD - (v / maxD()) * (H - PAD * 1.4);

  return (
    <ChartFigure
      id="jobs"
      caption="Jobs created is jobs displaced, rescaled - so nothing ever nets positive."
      columns={["Measure", "Value"]}
      rows={[
        ["Fitted slope", pt(h().jobs_created_slope ?? 0, 4)],
        ["R²", pt(h().jobs_created_r2 ?? 0, 4)],
        ["Records where created > displaced", int(h().rows_net_positive ?? 0)],
        ["Net jobs across the file", int(h().net_jobs ?? 0)],
      ]}
    >
      <svg class="jobs" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Scatter of jobs created against jobs displaced for all 300 records, with the fitted line at slope ${pt(h().jobs_created_slope ?? 0, 3)} and the break-even diagonal. Every point falls below the diagonal: no record has more jobs created than displaced.`}>
        {/* the y = x diagonal: break-even. Every point is below it. */}
        <line class="jobs__diag" x1={x(0)} y1={y(0)} x2={x(maxD())} y2={y(maxD())} />
        <text class="jobs__diaglab" x={x(maxD()) - 8} y={y(maxD()) + 14} text-anchor="end">
          break-even
        </text>
        <For each={props.jobs}>
          {(j) => <circle class="jobs__pt" cx={x(j.jobs_displaced_count)}
                          cy={y(j.jobs_created_count)} r={props.poster ? 1.8 : 2.4} />}
        </For>
        <line class="jobs__fit" x1={x(0)} y1={y(h().jobs_created_slope * 0 + 174.7)}
              x2={x(maxD())} y2={y(h().jobs_created_slope * maxD() + 174.7)} />
        <text class="jobs__ax" x={W / 2} y={H - 10} text-anchor="middle">jobs displaced</text>
        <text class="jobs__ax" x={14} y={H / 2} text-anchor="middle"
              transform={`rotate(-90 14 ${H / 2})`}>jobs created</text>
      </svg>
      <p class="cap">
        created ={" "}
        <b class="num" data-metric="jobs_created_slope" data-value={h().jobs_created_slope}>
          {pt(h().jobs_created_slope ?? 0, 4)}
        </b>{" "}
        × displaced + 174.7, R² ={" "}
        <b class="num" data-metric="jobs_created_r2" data-value={h().jobs_created_r2}>
          {pt(h().jobs_created_r2 ?? 0, 3)}
        </b>.{" "}
        <b class="num" data-metric="rows_net_positive" data-value={h().rows_net_positive}>
          {h().rows_net_positive}
        </b>{" "}
        of 300 records sit above the diagonal. The challenge page asks where creation offsets
        displacement; the answer is nowhere, and it is nowhere by construction.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑦  There is no panel
// =========================================================================================

export function PanelGap(props: { headline: Record<string, any> }) {
  const h = () => props.headline;
  const once = () => (h().segments ?? 0) - (h().segments_seen_twice ?? 0);
  return (
    <ChartFigure
      id="panelgap"
      caption={`There is no panel: ${once()} of the ${h().segments} segments are observed exactly once.`}
      columns={["Observations", "Segments"]}
      rows={[["once", once()], ["twice", h().segments_seen_twice ?? 0], ["three or more", 0]]}
    >
      <div class="pg">
        <div class="pg__bar" role="img"
             aria-label={`Of ${h().segments} country-industry-skill segments, ${once()} are observed once and ${h().segments_seen_twice} twice. None is observed three times.`}>
          <i class="pg__once" style={{ width: `${(100 * once()) / (h().segments || 1)}%` }} />
          <i class="pg__twice" style={{ width: `${(100 * (h().segments_seen_twice ?? 0)) / (h().segments || 1)}%` }} />
        </div>
        {/* The count was inside the bar until axe measured it at 3.0:1 - white on --flat is
            not 4.5:1 in either theme, and no bar fill that stays "inert grey" would get it
            there. Out of the bar it takes --ink-muted, which is 6.64:1. */}
        <p class="pg__key">
          <b class="num">{once()}</b> seen once · <b class="num">{h().segments_seen_twice}</b> twice
        </p>
        <p class="pg__nums">
          <span>
            <b class="num" data-metric="segments" data-value={h().segments}>{h().segments}</b>
            <small>distinct segments</small>
          </span>
          <span>
            <b class="num" data-metric="segments_seen_twice" data-value={h().segments_seen_twice}>
              {h().segments_seen_twice}
            </b>
            <small>observed twice · none more</small>
          </span>
          <span>
            <b class="num" data-metric="cube_fill_pct" data-value={h().cube_fill_pct}>
              {pt(h().cube_fill_pct ?? 0, 2)}%
            </b>
            <small>
              of the{" "}
              <span data-metric="cube_cells" data-value={h().cube_cells}>
                {int(h().cube_cells ?? 0)}
              </span>
              -cell cube
            </small>
          </span>
        </p>
        <p class="cap">
          A quarter-over-quarter change is computable for {h().segments_seen_twice} of{" "}
          {h().segments} segments. The archive's three Temporal Trends questions are all about the
          population, so all three are answered above; the coalition's question about which
          <em> segments</em> need urgent investment is the one this grain cannot reach - which is
          why every temporal statement on this page is about the population mean per quarter.
        </p>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// web-only
// =========================================================================================

export function CountryTable(props: {
  countries: Country[]; headline: Record<string, any>;
  onPick?: (v: string) => void; active?: (v: string) => boolean;
}) {
  const h = () => props.headline;
  return (
    <ChartFigure
      id="countries"
      caption="Nothing about a country predicts its AI adoption."
      columns={["Country", "Tier", "Region", "Records", "Mean adoption", "Mean risk"]}
      rows={props.countries.map((c) => [
        c.country_name, c.development_tier, c.region, c.rows,
        pt(c.mean_adoption), pt(c.mean_risk),
      ])}
    >
      <div class="ctable-wrap" tabindex="0" role="region" aria-label="Countries, scrollable">
        <table class="ctable">
          <caption class="sr-only">Adoption and risk by country</caption>
          <thead>
            <tr>
              <th scope="col">Country</th><th scope="col">Tier</th>
              <th scope="col">n</th><th scope="col">Adoption</th><th scope="col">Risk</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.countries}>
              {(c) => (
                <tr classList={{ "ctable--on": props.active?.(c.development_tier) }}>
                  <th scope="row">
                    <button type="button" class="ctable__pick"
                            aria-pressed={props.active?.(c.development_tier) ?? false}
                            onClick={() => props.onPick?.(c.development_tier)}>
                      {c.country_name}
                    </button>
                  </th>
                  <td>{c.development_tier}</td>
                  <td class="num">{c.rows}</td>
                  <td class="num">{pt(c.mean_adoption)}</td>
                  <td class="num">{pt(c.mean_risk)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="cap">
        Developed vs emerging: Kruskal p ={" "}
        <b class="num" data-metric="tier_kruskal_p" data-value={h().tier_kruskal_p}>
          {pt(h().tier_kruskal_p ?? 0, 3)}
        </b>. Adoption against digital infrastructure, internet penetration and STEM graduates:
        the largest |ρ| is{" "}
        <b class="num" data-metric="country_max_abs_rho" data-value={h().country_max_abs_rho}>
          {pt(h().country_max_abs_rho ?? 0, 3)}
        </b>, the smallest p is{" "}
        <b class="num" data-metric="country_min_p" data-value={h().country_min_p}>
          {pt(h().country_min_p ?? 0, 3)}
        </b>. <code>gdp_per_capita_usd</code> is excluded from every measure in this model, so it
        cannot be correlated with anything here even by accident - see the defect ledger.
      </p>
    </ChartFigure>
  );
}

export function SkillTable(props: { skills: Skill[] }) {
  const max = () => Math.max(...props.skills.map((s) => s.ai_replaceability_score), 1);
  return (
    <ChartFigure
      id="skills"
      caption="The dimension's own replaceability score does not rank the risk the fact table records."
      columns={["Skill category", "Replaceability", "Mean risk", "Records", "Jobs displaced"]}
      rows={props.skills.map((s) => [
        s.skill_category_name, pt(s.ai_replaceability_score, 1), pt(s.mean_risk),
        s.rows, int(s.jobs_displaced),
      ])}
    >
      <ul class="sk">
        <For each={props.skills}>
          {(s) => (
            <li>
              <span class="sk__name">{s.skill_category_name}</span>
              <span class="sk__track">
                <i class="sk__replace" style={{ width: `${(100 * s.ai_replaceability_score) / max()}%` }} />
              </span>
              <b class="num">{pt(s.ai_replaceability_score, 1)}</b>
              <b class="num sk__risk">{pt(s.mean_risk)}</b>
            </li>
          )}
        </For>
      </ul>
      <p class="cap">
        Bars are the skill's documented <code>ai_replaceability_score</code>; the right column is
        the mean <code>displacement_risk_index</code> the fact table actually records. The bars
        span {pt(Math.min(...props.skills.map((s) => s.ai_replaceability_score)), 1)}-
        {pt(Math.max(...props.skills.map((s) => s.ai_replaceability_score)), 1)} and the risks
        span {pt(Math.min(...props.skills.map((s) => s.mean_risk)))}-
        {pt(Math.max(...props.skills.map((s) => s.mean_risk)))}.
      </p>
    </ChartFigure>
  );
}

export function DefectLedger(props: { defects: Defect[] }) {
  return (
    <ChartFigure
      id="defects"
      caption="Seven defects, four of them structural."
      columns={["#", "Column", "Defect", "Detail"]}
      rows={props.defects.map((d) => [d.n, d.column_name, d.defect, d.detail])}
    >
      <div class="ledger-wrap" tabindex="0" role="region" aria-label="Defect ledger, scrollable">
        <table class="ledger">
          <caption class="sr-only">Defect ledger</caption>
          <thead>
            <tr><th scope="col">#</th><th scope="col">Column</th>
                <th scope="col">Defect</th><th scope="col">Detail</th></tr>
          </thead>
          <tbody>
            <For each={props.defects}>
              {(d) => (
                <tr>
                  <th scope="row" class="num">{d.n}</th>
                  <td><code>{d.column_name}</code></td>
                  <td>{d.defect}</td>
                  <td>{d.detail}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </ChartFigure>
  );
}
