/**
 * EXPLORE - the brief's remaining questions, each with its test and verdict.
 *
 * Every panel states what the analysis found. On this dataset that is almost always
 * "no detectable difference", and saying so with the test is the honest answer.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { dec, derived, distribution, estimatesBy, int, type Filter, type Row } from "../data";
import { WholeStudy } from "./WholeStudy";

type Cut = { col: keyof Row; title: string; req: string; verdict: string };

/**
 * EVERY VERDICT BELOW IS A WHOLE-STUDY RESULT, computed once on all 120 customers.
 *
 * The table under each verdict is reactive - it recomputes from whatever the cross-filter
 * leaves standing. The verdict is not, and must not be: these are test statistics, and
 * re-running a hypothesis test against a subset the reader assembled by clicking is a
 * garden of forking paths, not evidence. So each panel renders its verdict with an
 * "all 120" badge, and the two kinds of number never get mistaken for one another.
 *
 * R2, R5 and R7 ask about LOYALTY. They are now answered with tests of loyalty. The
 * previous revision answered all three with tests of satisfaction - the right arithmetic
 * on the wrong variable - and reached the same conclusion by luck rather than by evidence.
 */
const CUTS: Cut[] = [
  // prose-number-ok: I-5 / I-6 - R1 and R5, analysis/insights.md. Satisfaction ~ factor:
  // Kruskal-Wallis p=0.0231, η²=0.1540, permutation p=0.0250 over 4000 relabellings.
  // Loyalty ~ factor: χ²=17.411, df=18, p=0.4951, V=0.269. Bonferroni α=0.00625 (family of
  // eight satisfaction tests) - corrected here from the α=0.0071 an earlier revision quoted,
  // which had left the published age correlation out of its own family.
  { col: "satisfaction_factor", title: "Satisfaction factor", req: "R1 · R5",
    verdict: "R1 - satisfaction: the largest apparent effect (η²=0.154, p=0.023) and the only one worth showing, but it splits 120 customers ten ways, does not survive Bonferroni (α=0.00625), and relabelling at random produces an effect this large about 1 time in 40. R5 - loyalty: the factor a customer names has no detectable bearing on how loyal they are (χ² p=0.50)." },
  // prose-number-ok: I-2 / I-6 - R2, analysis/insights.md. Satisfaction ~ age: Pearson
  // r=+0.0202, p=0.8268. Loyalty ~ gender χ²=1.809, df=2, p=0.4048, V=0.123; ~ group
  // χ²=1.351, p=0.5090; ~ age band χ²=6.288, df=6, p=0.3917, V=0.162 (bands 25-34/35-44/
  // 45-54/55+ exactly as model/build.py cuts them, so the test and the UI cannot drift).
  { col: "age_band", title: "Age band", req: "R2",
    verdict: "R2 asks about loyalty, so loyalty is what is tested: no segment is detectably more loyal than another (χ² p=0.39 age band, 0.40 gender, 0.51 group). Satisfaction shows nothing either - age correlates with it at r=+0.020 (p=0.83)." },
  // prose-number-ok: I-2 / I-6 - R3 and R7, analysis/insights.md. Satisfaction ~ city:
  // Kruskal-Wallis p=0.7219. Loyalty ~ city: χ²=22.819, df=18, p=0.1976, V=0.308, smallest
  // expected cell 1.85. City sizes run 6 (San Antonio.TX) to 19 (Phoenix.AZ); 19 of the 30
  // city×loyalty cells hold fewer than five customers and one is empty.
  { col: "city", title: "City", req: "R3 · R7",
    verdict: "R3 - satisfaction: no detectable difference (p=0.72). R7 - loyalty: no regional cluster either (χ² p=0.20), and the test is barely admissible - the ten cities hold 6-19 customers each, 19 of 30 city×loyalty cells hold fewer than five, and one is empty. There is no spatial structure to cluster." },
  // prose-number-ok: I-2 / I-6 - R3 at state grain, analysis/insights.md. Texas n=41 is the
  // largest group anywhere in the study. Loyalty ~ state: χ²=13.895, df=10, p=0.1778, V=0.241.
  { col: "state", title: "State", req: "R3",
    verdict: "Aggregating to state gives the largest groups available - Texas reaches n=41 - and still detects nothing, on satisfaction or on loyalty (χ² p=0.18)." },
  // prose-number-ok: I-2 - R8, analysis/insights.md. Satisfaction ~ loyalty: Kruskal-Wallis
  // p=0.0863, η²=0.0399. Means: Low 5.844 (n=45) > High 5.649 (n=37) > Medium 4.474 (n=38).
  { col: "loyalty_level", title: "Loyalty level", req: "R8",
    verdict: "Non-monotonic: Low reports the HIGHEST mean satisfaction, above High, with Medium lowest. A real relationship would be ordered. This is what noise looks like (p=0.09)." },
  // prose-number-ok: I-2 / I-6 - R6, analysis/insights.md. Satisfaction ~ repeat buyer:
  // Kruskal-Wallis p=0.2892, η²=0.0111. Loyalty ~ repeat buyer: χ²=2.256, df=2, p=0.3237.
  { col: "purchase_history", title: "Repeat buyer", req: "R6",
    verdict: "No detectable difference in satisfaction (p=0.29, η²=0.011), and none in loyalty either (χ² p=0.32)." },
];

function CutPanel(props: { cut: Cut; filters: () => Filter[] }) {
  const data = derived((rs: Row[]) => estimatesBy(rs, props.cut.col), props.filters);
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.82rem" }}>
        {props.cut.title}{" "}
        <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>{props.cut.req}</span>
      </h3>
      <p class="panel__sub" style={{ "border-left": "3px solid var(--border-strong)",
                                     "padding-left": "8px", "margin-bottom": "10px" }}>
        {props.cut.verdict} <WholeStudy />
      </p>
      <Show when={data()}>
        <table class="data">
          <thead>
            <tr><th scope="col">{props.cut.title}</th><th scope="col">n</th>
                <th scope="col">Mean</th><th scope="col">95% CI</th></tr>
          </thead>
          <tbody>
            <For each={data()!.slice(0, 12)}>
              {(e) => (
                <tr tabindex="0" role="button"
                    aria-pressed={isActive(props.cut.col as string, e.k)}
                    aria-label={`${e.k}: mean ${dec(e.mean)}, n=${e.n}, 95% CI ${dec(e.lo)} to ${dec(e.hi)}${e.underpowered ? ", underpowered" : ""}`}
                    onClick={() => toggle(props.cut.col as string, e.k)}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(props.cut.col as string, e.k); } }}>
                  <td>{e.k}{e.underpowered ? <span class="flag">⚑</span> : null}</td>
                  <td class="num">{int(e.n)}</td>
                  <td class="num">{dec(e.mean)}</td>
                  <td class="num" style={{ color: "var(--ink-muted)" }}>±{dec(e.ci)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </section>
  );
}

// prose-number-ok: I-1 - analysis/insights.md. Chi-square of the observed score counts
// against a uniform distribution over 1-10: χ²=7.00 on 9 df, p=0.6371, whole-study mean 5.35
// against the 5.50 uniform expects and sd 3.03 against 2.87. The histogram beneath this
// sentence IS reactive and redraws under the cross-filter; the test does not, hence the badge.
const DIST_VERDICT =
  "Flat. A chi-square against a uniform distribution over 1-10 gives p=0.637 - there is no " +
  "satisfied majority and no detractor cluster to segment.";

function DistPanel(props: { filters: () => Filter[] }) {
  const data = derived(distribution, props.filters);
  const max = createMemo(() => Math.max(...(data() ?? []).map((r) => r.n), 1));
  return (
    <section>
      <h3 class="panel__title" style={{ "font-size": "0.82rem" }}>Score distribution</h3>
      <p class="panel__sub" style={{ "border-left": "3px solid var(--accent)",
                                     "padding-left": "8px", "margin-bottom": "10px" }}>
        {DIST_VERDICT} <WholeStudy />
      </p>
      <Show when={data()}>
        <svg viewBox="0 0 440 130" width="100%" style={{ height: "auto" }} role="img"
             aria-label="Histogram of satisfaction scores 1 to 10, approximately flat.">
          <title>Satisfaction score distribution</title>
          <For each={data()}>
            {(r, i) => (
              <g>
                <rect x={i() * 43 + 6} y={106 - (r.n / max()) * 92} width={34}
                      height={(r.n / max()) * 92} fill="var(--seq-3)" />
                <text class="ladder-price num" x={i() * 43 + 23} y={122} text-anchor="middle">
                  {r.score}
                </text>
              </g>
            )}
          </For>
        </svg>
      </Show>
    </section>
  );
}

export function Explore(props: { filters: () => Filter[] }) {
  return (
    <details class="explore panel live-only">
      <summary>Explore - every cut, with its confidence interval</summary>
      <p class="panel__sub" style={{ "max-width": "80ch" }}>
        Every group here carries its n and its 95% interval, because on 120 customers a mean on its
        own is misleading. ⚑ marks a group too small to detect a 1.5-point difference - which is
        all of them.
      </p>
      <div class="explore-grid">
        <For each={CUTS}>{(c) => <CutPanel cut={c} filters={props.filters} />}</For>
        <DistPanel filters={props.filters} />
      </div>
    </details>
  );
}
