/**
 * THE DIAGONAL OF NOTHING - this month's signature element.
 *
 * THE COMPLETE GRID of association tests among the file's twelve categorical columns -
 * twelve involving `Company_ID_1081` and all sixty-six consumer-side pairs, seventy-eight
 * in total - plotted as chi-square against degrees of freedom on log-log axes, with the
 * line chi2 = df drawn through it. Nothing is selected. `model/build.py` refuses to build
 * a grid that is not the full cross-product.
 *
 * WHAT THAT LINE IS. A chi-square statistic has an expected value equal to its degrees of
 * freedom under the null, so a test that lands on the line has found precisely what chance
 * predicts - no more, no less. All twelve company tests sit on it.
 *
 * WHY THE CHART CHANGED. An earlier version drew fourteen hand-picked tests and captioned
 * them "every association test in the file", concluding that the two clouds do not overlap.
 * On the full grid they nearly touch: the closest consumer pair, `state x weekday`, is only
 * 1.15x above the strongest company test. The company side was never the problem - all
 * twelve possible company tests land in 0.945-1.018 and the six that were unpublished fall
 * inside the published band - but "no overlap" was a property of the selection.
 *
 * SO THE MARKS CARRY THE DISTINCTION THE RATIO CANNOT MAKE.
 *
 *   hollow circle    company    the 12 company_id tests. None clears Bonferroni.
 *   filled diamond   structural a pair among the ten substantive consumer columns, and not
 *                               a restatement of one. 39 of them, all significant.
 *   cross            definitional  Cramér's V >= 0.9 - the pair IS a definition. Five are
 *                               exact functional dependencies (state x region, and so on);
 *                               product x issue at V = 0.9467 is the near-tautology that
 *                               used to set the headline maximum.
 *   hollow diamond   calendrical a pair touching `weekday` or `timeliness`, where landing
 *                               on the line is the EXPECTED result in real data, not a
 *                               defect. All eight non-significant consumer pairs are here.
 *
 * AND THE HEIGHT IS NOT THE EFFECT SIZE. chi2/df rewards degrees of freedom. Every company
 * test sits at Cramér's V 0.128-0.134; `weekday x product` has V = 0.027 and plots 5.7x
 * higher because it has 48 df against 8,640. Forty-six of the sixty-six consumer pairs are
 * WEAKER than every company test on V and still plot above them. The verdict the thesis
 * rests on is therefore the Bonferroni column in the table, not the height on the chart.
 *
 * Why log-log: the tests span five orders of magnitude in df and six in chi-square. On
 * linear axes the identity line is unreadable and the company cluster collapses into a dot.
 *
 * Accessibility: four distinct SHAPES, filled and hollow, so the chart reads in greyscale
 * and under all three CVD simulations; the identity line is dashed and labelled in words as
 * well as symbols; and the full 78-row table below carries chi-square, df, ratio, Cramér's V
 * and the Bonferroni verdict for every test.
 */
import { For, createMemo } from "solid-js";
import { type ChiTest, dec, int } from "../data";

const W = 900;
const H = 520;
const PAD = { t: 46, r: 176, b: 62, l: 74 };

const diamond = (x: number, y: number, r: number) =>
  `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;

export function TheDiagonal(props: { tests: ChiTest[]; poster?: boolean }) {
  const xs = () => props.tests.map((t) => t.df);
  const ys = () => props.tests.map((t) => t.chi2);
  const lo = createMemo(() => Math.min(...xs(), ...ys()) * 0.5);
  const hi = createMemo(() => Math.max(...xs(), ...ys()) * 2.2);

  const lx = (v: number) =>
    PAD.l +
    ((Math.log10(Math.max(v, 1e-9)) - Math.log10(lo())) /
      (Math.log10(hi()) - Math.log10(lo()))) *
      (W - PAD.l - PAD.r);
  const ly = (v: number) =>
    H -
    PAD.b -
    ((Math.log10(Math.max(v, 1e-9)) - Math.log10(lo())) /
      (Math.log10(hi()) - Math.log10(lo()))) *
      (H - PAD.t - PAD.b);

  const decades = createMemo(() => {
    const out: number[] = [];
    for (let e = Math.ceil(Math.log10(lo())); e <= Math.floor(Math.log10(hi())); e++) {
      out.push(10 ** e);
    }
    return out;
  });

  const fam = (name: ChiTest["family"], def: boolean) =>
    props.tests.filter((t) => t.family === name && t.definitional === def);
  const company = createMemo(() => props.tests.filter((t) => t.side === "company"));
  const solid = createMemo(() => fam("structural", false));
  const defin = createMemo(() => props.tests.filter((t) => t.definitional));
  const cal = createMemo(() => fam("calendrical", false));
  const consumer = createMemo(() => props.tests.filter((t) => t.side === "consumer"));
  const ratios = (s: ChiTest[]) => s.map((t) => t.ratio);

  const r = () => (props.poster ? 5.5 : 4.6);

  /** Three points worth naming: the strongest real finding, the nearest approach to the
   *  line, and one definitional pair so the reader can see what a tautology looks like. */
  const called = createMemo(() => {
    const top = [...solid()].sort((a, b) => b.ratio - a.ratio)[0];
    const near = [...consumer()].sort((a, b) => a.ratio - b.ratio)[0];
    const tau = [...defin()].sort((a, b) => a.ratio - b.ratio)[0];
    return [
      { t: top, note: "strongest real pair" },
      { t: tau, note: "definitional" },
      { t: near, note: "nearest the line" },
    ].filter((x) => x.t);
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={
        `Chi-square against degrees of freedom, log-log, for all ${props.tests.length} association ` +
        `tests among the file's twelve categorical columns - nothing is selected. The dashed ` +
        `diagonal marks chi-square equal to degrees of freedom, which is what no association ` +
        `at all looks like. All ${company().length} tests involving the company identifier sit ` +
        `on that line, at ${dec(Math.min(...ratios(company())), 3)} to ` +
        `${dec(Math.max(...ratios(company())), 3)} times their degrees of freedom, and none of ` +
        `them clears the Bonferroni threshold. Of the ${consumer().length} consumer-side pairs, ` +
        `${consumer().filter((t) => t.significant).length} do. The consumer pairs spread across ` +
        `four orders of magnitude rather than forming a second cluster: ${solid().length} are ` +
        `real findings drawn as filled diamonds, ${defin().length} are definitional and drawn as ` +
        `crosses, and ${cal().length} involve weekday or timeliness and are drawn hollow because ` +
        `landing on the line is the expected result for those. The closest consumer pair comes ` +
        `within ${dec(Math.min(...ratios(consumer())) / Math.max(...ratios(company())), 2)} times ` +
        `the strongest company test, so the two groups very nearly touch. Height on this chart ` +
        `is not effect size - the table below carries Cramér's V for every test.`
      }
    >
      <title>
        Chi-square against degrees of freedom for all {props.tests.length} association tests
        among the file's twelve categorical columns
      </title>

      {/* ---- grid ---- */}
      <g aria-hidden="true">
        <For each={decades()}>
          {(d) => (
            <>
              <line x1={lx(d)} y1={PAD.t} x2={lx(d)} y2={H - PAD.b} class="gridline" />
              <line x1={PAD.l} y1={ly(d)} x2={W - PAD.r} y2={ly(d)} class="gridline" />
              <text x={lx(d)} y={H - PAD.b + 16} class="ticklabel" text-anchor="middle">
                {d >= 1000 ? `${d / 1000}k` : d}
              </text>
              <text x={PAD.l - 8} y={ly(d) + 4} class="ticklabel" text-anchor="end">
                {d >= 1000 ? `${d / 1000}k` : d}
              </text>
            </>
          )}
        </For>
        <text x={PAD.l} y={H - 12} class="axistitle" text-anchor="start">
          DEGREES OF FREEDOM →
        </text>
        <text
          class="axistitle"
          text-anchor="start"
          transform={`translate(18 ${H - PAD.b}) rotate(-90)`}
        >
          CHI-SQUARE →
        </text>
      </g>

      {/* ---- the identity line: what nothing looks like ---- */}
      <line
        x1={lx(lo())}
        y1={ly(lo())}
        x2={lx(hi())}
        y2={ly(hi())}
        class="diag-identity"
        aria-hidden="true"
      />
      <text
        x={lx(hi() * 0.4)}
        y={ly(hi() * 0.4) - 9}
        class="diag-identity-label"
        text-anchor="end"
        aria-hidden="true"
      >
        χ² = df - WHAT NOTHING LOOKS LIKE
      </text>

      {/* ---- consumer pairs on weekday / timeliness: hollow, because the line is the
              EXPECTED answer for these and not a defect ---- */}
      <g aria-hidden="true">
        <For each={cal()}>
          {(t) => (
            <path d={diamond(lx(t.df), ly(t.chi2), r())} class="diag-calendrical" />
          )}
        </For>
      </g>

      {/* ---- real consumer findings: filled diamonds ---- */}
      <g aria-hidden="true">
        <For each={solid()}>
          {(t) => <path d={diamond(lx(t.df), ly(t.chi2), r())} class="diag-consumer" />}
        </For>
      </g>

      {/* ---- definitional pairs: crosses. A tautology is not a finding ---- */}
      <g aria-hidden="true">
        <For each={defin()}>
          {(t) => {
            const x = lx(t.df);
            const y = ly(t.chi2);
            const q = r() + 1.4;
            return (
              <path
                d={`M${x - q},${y - q}L${x + q},${y + q}M${x - q},${y + q}L${x + q},${y - q}`}
                class="diag-definitional"
              />
            );
          }}
        </For>
      </g>

      {/* ---- company tests: hollow circles, on the line ---- */}
      <g aria-hidden="true">
        <For each={company()}>
          {(t) => <circle cx={lx(t.df)} cy={ly(t.chi2)} r={r()} class="diag-company" />}
        </For>
      </g>

      {/* ---- three named points, no legend clutter ---- */}
      <g aria-hidden="true">
        <For each={called()}>
          {(c) => (
            <text
              x={lx(c.t.df) + 9}
              y={ly(c.t.chi2) + 3.5}
              class="diag-label diag-label--consumer"
            >
              {c.t.label} · {c.t.ratio >= 10 ? dec(c.t.ratio, 0) : dec(c.t.ratio, 2)}×
            </text>
          )}
        </For>
      </g>

      {/* ---- the key ---- */}
      <g aria-hidden="true">
        <path d={diamond(W - PAD.r + 11, PAD.t + 9, 5)} class="diag-consumer" />
        <text x={W - PAD.r + 22} y={PAD.t + 13} class="diag-key">
          REAL PAIR
        </text>
        <text x={W - PAD.r + 22} y={PAD.t + 26} class="diag-key diag-key--sub">
          {solid().length} of {consumer().length}, all significant
        </text>

        <path
          d={`M${W - PAD.r + 5},${PAD.t + 45}L${W - PAD.r + 17},${PAD.t + 57}M${W - PAD.r + 5},${PAD.t + 57}L${W - PAD.r + 17},${PAD.t + 45}`}
          class="diag-definitional"
        />
        <text x={W - PAD.r + 22} y={PAD.t + 55} class="diag-key">
          DEFINITIONAL
        </text>
        <text x={W - PAD.r + 22} y={PAD.t + 68} class="diag-key diag-key--sub">
          V ≥ 0.9 - restates a column
        </text>

        <path d={diamond(W - PAD.r + 11, PAD.t + 87, 5)} class="diag-calendrical" />
        <text x={W - PAD.r + 22} y={PAD.t + 91} class="diag-key">
          WEEKDAY / TIMELY
        </text>
        <text x={W - PAD.r + 22} y={PAD.t + 104} class="diag-key diag-key--sub">
          the line is expected here
        </text>

        <circle cx={W - PAD.r + 11} cy={PAD.t + 123} r="5" class="diag-company" />
        <text x={W - PAD.r + 22} y={PAD.t + 127} class="diag-key">
          COMPANY OVERLAY
        </text>
        <text x={W - PAD.r + 22} y={PAD.t + 140} class="diag-key diag-key--sub">
          {dec(Math.min(...ratios(company())), 3)}-{dec(Math.max(...ratios(company())), 3)}× df
        </text>
        <text x={W - PAD.r + 22} y={PAD.t + 153} class="diag-key diag-key--sub">
          0 of {company().length} significant
        </text>
      </g>
    </svg>
  );
}

const VERDICT: Record<ChiTest["family"], string> = {
  company: "company overlay",
  structural: "consumer register",
  calendrical: "weekday / timeliness",
};

/** Every test, with the two columns the chart cannot draw: effect size and the verdict. */
export function diagonalTable(tests: ChiTest[]) {
  return {
    columns: ["Test", "Family", "χ²", "df", "χ² / df", "Cramér's V", "Clears Bonferroni"],
    rows: [...tests]
      .sort((a, b) => b.ratio - a.ratio)
      .map((t) => [
        t.label,
        t.definitional ? "definitional" : VERDICT[t.family],
        int(t.chi2),
        int(t.df),
        t.ratio >= 10 ? dec(t.ratio, 0) : dec(t.ratio, 3),
        dec(t.cramersV, 4),
        t.significant ? "yes" : "no",
      ]),
  };
}
