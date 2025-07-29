/**
 * The report. A research note, not a dashboard.
 *
 * Reading order: thesis -> the uncertainty ladder -> the brief's headline question ->
 * what it would take -> all nine questions -> so what.
 */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  Breadcrumb, ChartFigure, FilterChips, ThemeToggle, TourOverlay,
  clearAll, drillInto, drillUpTo, filters, isActive, toggle, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  boot, dec, derived, distribution, factorLadder, int, ladder, maybe, overall,
  powerTable, separatedPairs, spreadReport, supportEffect, type Estimate,
} from "./data";
import { UncertaintyLadder, ladderTable } from "./charts/UncertaintyLadder";
import { Explore } from "./components/Explore";
import { TOUR_KEY, TOUR_STEPS } from "./tour";
import { WholeStudy } from "./components/WholeStudy";

/**
 * The nine questions, each with the test that answers it.
 *
 * THE OUTCOME VARIABLE IS PART OF THE ANSWER. R2, R5 and R7 ask about LOYALTY, and until
 * this revision all three were answered with a test of SATISFACTION - the right p-value for
 * the wrong question. They now carry a chi-square of loyalty against the named segmentation.
 * The conclusion is unchanged; the evidence finally matches the claim.
 *
 * Every figure here is a whole-study result computed on all 120 customers. It is FROZEN on
 * purpose - a research finding does not change because the reader clicked a chip - and the
 * table is badged as such so it cannot be mistaken for a filtered view.
 *
 * Ledger: analysis/insights.md I-2 (satisfaction axes) and I-6 (loyalty and factor axes).
 * Reproducer: analysis/integrity.py sections I-2 and I-6; asserted in model/test_metrics.py.
 */
// prose-number-ok: I-2 / I-6 - whole-study test results, analysis/insights.md.
// Each p is a named test on all 120 rows; the table is badged "all 120" in the UI and none
// of these values is a function of the cross-filter. Every one is recomputed by
// analysis/integrity.py and asserted to four decimal places in model/test_metrics.py
// (test_I2_satisfaction_axes / test_I6_loyalty_chi_square / test_I6_r9_factor_chi_square),
// which is where a test statistic belongs - metric_checks.yml verifies the DOM against
// DuckDB and has no notion of a p-value.
const QUESTIONS: readonly (readonly [string, string, string, string])[] = [
  ["R1", "Main factors behind high vs low satisfaction",
   "Satisfaction ~ factor", "Kruskal-Wallis p=0.023, η²=0.154 *"],
  ["R2", "Are some segments more loyal?",
   "Loyalty ~ segment", "χ² p=0.40 gender · 0.51 group · 0.39 age band; satisfaction KW p=0.52 gender · 0.49 group"],
  ["R3", "Locations with consistently high/low scores",
   "Satisfaction ~ city", "Kruskal-Wallis p=0.72"],
  ["R4", "Does contacting support hurt satisfaction?",
   "Satisfaction ~ support", "Kruskal-Wallis p=0.96 · t-test p=0.98"],
  ["R5", "Do Price / Product Variety influence loyalty?",
   "Loyalty ~ factor", "χ² p=0.50"],
  ["R6", "Do repeat purchasers report higher satisfaction?",
   "Satisfaction ~ repeat buyer", "Kruskal-Wallis p=0.29, η²=0.011"],
  ["R7", "Regional clusters of loyal or dissatisfied customers",
   "Loyalty ~ location", "χ² p=0.20 city · 0.18 state"],
  ["R8", "Relationship between loyalty and satisfaction",
   "Satisfaction ~ loyalty", "Kruskal-Wallis p=0.09, non-monotonic"],
  ["R9", "Do demographics favour particular factors?",
   "Factor ~ demographic", "χ² p=0.036 gender † · 0.89 age band · 0.73 group"],
] as const;

// ---------------------------------------------------------------------------------------
// FROZEN PROSE. Every string below quotes a whole-study test statistic - a figure computed
// once on all 120 customers and deliberately NOT recomputed under the cross-filter, because
// a p-value re-derived against a subset the reader picked interactively is a forking path
// rather than a result. Each is badged "all 120" at its point of use so the reader can tell
// it apart from the reactive figures beside it, and each names the ledger entry that owns
// it. Held as named constants so the suppression sits on a declaration, greppable, instead
// of being buried in JSX.
// ---------------------------------------------------------------------------------------

// prose-number-ok: I-3 - R4's test statistics, analysis/insights.md. Kruskal-Wallis p=0.9557,
// Welch/pooled t-test p=0.9808, Cohen's d=+0.0044, all on the full 120 rows. The reactive
// figures for this panel (both means, both n, both intervals, the difference and ITS interval)
// are tagged data-metric and recomputed in SQL by tools/verify_metrics.py.
const SUPPORT_TESTS =
  "Whole-study tests on all 120 customers: Kruskal-Wallis p=0.96, two-sample t-test p=0.98, " +
  "Cohen's d=0.004.";

// prose-number-ok: I-4 - 80% is the power LEVEL this design targets, a stated convention in
// the same family as the 95% on every interval. It is an input to the sample-size formula,
// not an output of it; the outputs are the `power.*.need` metrics, which are verified in SQL.
const POWER_SUB = "Customers needed per group to detect a difference, at 80% power.";

// prose-number-ok: I-4 - same 80% power level as POWER_SUB above, and for the same reason:
// it names the convention, it is not a result. Held as a constant because the numbers it
// sits between (n and the MDD) ARE computed and reactive, and a suppression has to attach to
// the node rather than float above a JSX block.
const STANDFIRST_MID = "the smallest difference detectable at 80% power is";

// prose-number-ok: I-2 / I-6 - Bonferroni thresholds, analysis/insights.md.
// Both are stated because the family boundary is arguable and the conclusion is not. The
// earlier revision declared a family of seven while also publishing an eighth test (the age
// correlation, r=+0.020, p=0.827), which understated the correction. Eight tests of
// satisfaction give 0.05/8 = 0.00625; the eighteen between-group tests published across this
// report (8 satisfaction + 7 loyalty + 3 factor, enumerated in insights.md I-6) give
// 0.05/18 = 0.0028. The smallest p anywhere is 0.0231, so it clears neither. Not counted in
// the eighteen: the goodness-of-fit test in Explore, which compares no groups, and R4's
// t-test, which is a second method on a comparison already in the family.
const BONFERRONI_NOTE =
  "Eighteen between-group tests are published here - eight of satisfaction, seven of loyalty, " +
  "three of satisfaction factor. Bonferroni across the eight satisfaction tests is α=0.00625; " +
  "across all eighteen it is α=0.0028. The smallest p anywhere in this report is 0.023, so " +
  "nothing reaches either threshold - the correction does not depend on where you draw the family.";

// prose-number-ok: I-5 - R1's effect size and permutation result, analysis/insights.md.
// η²=0.1540 observed; 4000 label permutations put p=0.0250, i.e. about one time in forty.
const R1_FOOTNOTE =
  "* R1's factor effect (η²=0.154) does not survive correction, and relabelling the factors " +
  "at random produces an effect that large about one time in forty.";

// prose-number-ok: I-6 - R9's nominal result, analysis/insights.md. χ²=17.961, df=9,
// p=0.0356, Cramér's V=0.387, on a 2×10 table whose smallest expected cell is 4.50. FIVE of
// the twenty expected counts fall below five (recounted 2025-07-29; an earlier draft of this
// footnote said four), so the chi-square approximation is already strained before any
// correction is applied.
const R9_FOOTNOTE =
  "† R9's gender split reaches p=0.036 nominally and is the only other test under 0.05. It is " +
  "a 2×10 table on 120 rows with five of its twenty expected cells below five, and it clears " +
  "neither Bonferroni threshold. It is listed so that the count of tests reported is the count " +
  "of tests run.";

// prose-number-ok: I-1 / I-2 / I-6 - method summary, analysis/insights.md. The observed
// whole-study sd is 3.0255, which is the sd every power figure is derived from; both
// Bonferroni thresholds are justified in BONFERRONI_NOTE above.
const COLOPHON_STATS =
  `Kruskal-Wallis across seven pre-declared axes plus an age correlation - eight tests of
   satisfaction, Bonferroni α=0.00625 - and chi-square tests of loyalty and of satisfaction
   factor against each segmentation, eighteen tests in all (α=0.0028). Power at α=0.05, 80%,
   observed sd 3.03. Test statistics are whole-study values and do not respond to the
   filters; every mean, n and interval does.`;

export default function Dashboard(props: { poster?: boolean }) {
  const [tourOpen, setTourOpen] = createSignal(false);
  const [showFloor, setShowFloor] = createSignal(true);
  const [showFactor, setShowFactor] = createSignal(false);
  const f = createMemo(() => filters());

  onMount(async () => {
    try {
      const t = localStorage.getItem("datadna-theme");
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch { /* ignore */ }
    await boot();
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTourOpen(true);
  });

  const lad = derived(ladder, f);
  const fac = derived(factorLadder, f);
  const all = derived(overall, f);
  const support = derived(supportEffect, f);
  const power = derived(powerTable, f);
  const dist = derived(distribution, f);

  /** What is actually on the ladder right now - six axes, plus the tenth if it is toggled on. */
  const shown = createMemo<Estimate[] | undefined>(() => {
    const base = lad();
    if (!base) return undefined;
    return showFactor() && fac() ? [...base, ...fac()!] : base;
  });

  /**
   * The ladder's caption, computed from the rows on screen rather than typed.
   *
   * It used to read "every confidence interval overlaps every other, and every observed
   * difference sits inside the band this study could not have detected." Both halves were
   * absolute, and both were true only of the six default axes at full sample:
   *   - add the satisfaction-factor axis and four pairs separate;
   *   - compare across axes and the widest gap (1.88) exceeds the floor (1.55).
   * Deriving the sentence means it re-states itself under every filter and every toggle.
   */
  const ladderClaim = createMemo(() => {
    const rows = shown();
    const p = power();
    if (!rows || !p) return "";
    if (!rows.length) return "No customers match the current filters, so there is nothing to plot.";
    const sep = separatedPairs(rows);
    const { within, withinAxis } = spreadReport(rows);
    const pairs = (rows.length * (rows.length - 1)) / 2;
    // The poster is a fixed 2560×1440 canvas with no room for a second caption line -
    // a two-line caption pushed three ladder rungs out of the grid cell and `overflow:
    // hidden` swallowed them silently. Same computed numbers, fewer words.
    if (props.poster) {
      const head = sep === 0
        ? `${rows.length} groups, ${pairs} interval pairs, none separated.`
        : `${sep} of ${pairs} interval pairs separate.`;
      if (p.mdd == null) return head;
      return `${head} Widest within-axis gap ${dec(within)} (${withinAxis}), ` +
        `${within <= p.mdd ? "inside" : "beyond"} the ±${dec(p.mdd)} detection floor.`;
    }
    const overlap = rows.length === 1
      ? "One group matches the current filters, so there is no pair to compare."
      : sep === 0
        ? `All ${rows.length} intervals overlap every other one (${pairs} pairs, none separated).`
        : `${sep} of ${pairs} interval pairs do not overlap - ${rows.length} groups shown.`;
    // The floor sentence needs an MDD, which needs an sd. Under a filter that leaves
    // fewer than two customers there is none, and saying so beats printing "±NaN".
    const floor = p.mdd == null
      ? "Too few customers remain to estimate a detection floor."
      : within <= p.mdd
        ? `The widest gap within any single axis is ${dec(within)} points (${withinAxis}), inside the ` +
          `±${dec(p.mdd)} this study could not have detected.`
        : `The widest gap within a single axis is ${dec(within)} points (${withinAxis}), which exceeds ` +
          `the ±${dec(p.mdd)} detection floor.`;
    return `${overlap} ${floor}`;
  });

  /** Ladder rows are "Axis: Value" - map a click back to the real field. */
  const FIELD: Record<string, string> = {
    "Support contacted": "support_contacted", Loyalty: "loyalty_level",
    "Repeat buyer": "purchase_history", Gender: "gender", Group: "group", State: "state",
  };
  /**
   * State is the report's one drill axis: state → the cities inside it, in Explore.
   *
   * It goes through `drillInto` rather than `toggle` so the breadcrumb above panel 2
   * actually records the path. `<Breadcrumb />` was rendered but nothing ever pushed to
   * the drill stack, so it could not appear - a dead component in the tree. Picking a
   * second state REPLACES the first (unwind, then drill) so the crumb stays a genuine
   * one-level path and never reads as a hierarchy that isn't one; picking the active
   * state again just unwinds, leaving any other filters alone.
   */
  const pick = (k: string) => {
    const [axis, value] = k.split(": ");
    const field = FIELD[axis];
    if (!field) return;
    if (field !== "state") return toggle(field, value);
    const wasActive = isActive("state", value);
    drillUpTo(0);
    if (!wasActive) drillInto("state", value);
  };

  return (
    <div class="shell">
      <Show when={!props.poster}>
        <TourOverlay open={tourOpen()} onClose={() => setTourOpen(false)}
                     steps={TOUR_STEPS} storageKey={TOUR_KEY} />
      </Show>

      <header class="masthead">
        <div style={{ display: "flex", "justify-content": "space-between", gap: "16px", "align-items": "start" }}>
          <h1>This survey cannot answer the questions it was designed to ask</h1>
          <div class="toolbar live-only">
            <button class="btn" aria-label="Open guided tour" onClick={() => setTourOpen(true)}>? Tour</button>
            <ThemeToggle />
          </div>
        </div>
        {/* Both figures are reactive: filter the report and n falls, so the detection floor
            rises. Saying "with 120 customers" over a floor recomputed from 41 was the same
            defect as the caption that said 144 over a table reading 140. The old trailing
            claim ("every difference it found is smaller than that") was absolute and is
            false under some filters, so the live build points at the ladder caption, which
            computes it; the poster is a fixed full-sample snapshot and can state the count. */}
        <p class="standfirst">
          OmniRetail asked nine questions about what drives customer satisfaction. With{" "}
          <strong>{all() ? int(all()!.n) : "-"} customers</strong> {STANDFIRST_MID}{" "}
          <strong>{power() ? maybe(power()!.mdd, dec) : "-"} points on a 10-point scale</strong>
          {props.poster
            ? " - wider than any gap the ladder shows within one segmentation."
            : " - and the caption under the ladder counts, live, how many of the observed differences clear that bar."}
        </p>
        <div class="contextstrip">
          <span>Onyx Data DataDNA · July 2025</span>
          <span>OmniRetail · 120 customers</span>
          <span>10 cities · 6 states</span>
          <span>no date column</span>
        </div>
      </header>

      <FilterChips
        hint="Nothing filtered - click any group on the ladder to filter, and watch its confidence interval widen."
        labels={{ support_contacted: "Support", loyalty_level: "Loyalty",
                  purchase_history: "Repeat", gender: "Gender", group: "Group",
                  state: "State", city: "City", satisfaction_factor: "Factor",
                  age_band: "Age" }} />

      {/* Degenerate states are states. State: NY × City: Houston is reachable in two clicks
          and leaves zero rows; before this banner the page filled with em dashes and the
          reader had to work out why. Announced politely so it reaches a screen reader too. */}
      <Show when={all() && all()!.n === 0}>
        <p class="emptystate live-only" role="status">
          <strong>No customers match these filters.</strong> Every figure below is blank because
          there is nothing left to compute, not because the values are zero. Remove a chip, or
          clear all, to bring the report back.
        </p>
      </Show>

      <div class="grid-main">
        <section class="panel" style={{ "border-top": "none", "padding-top": "0" }}>
          <h2 class="panel__title">1 · The uncertainty ladder</h2>
          <p class="panel__sub">
            Each group's mean satisfaction (dot) with its 95% confidence interval (bar).
            <span class="live-only"> Click a group to filter the report.</span>
          </p>
          {/* The layout MUST live in a class, not an inline style. `.poster .live-only
              { display: none }` is a stylesheet rule, and an inline `display: flex` beats
              it - which put both toggle buttons on the printed poster and pushed three
              ladder rungs off the bottom of its grid cell, under a caption still claiming
              seventeen. Caught by reading the PNG, not by any test. */}
          <div class="live-only ladder-toolbar">
            <button class="btn" classList={{ "btn--primary": showFloor() }}
                    aria-pressed={showFloor()} onClick={() => setShowFloor(!showFloor())}>
              {showFloor() ? "Hide" : "Show"} detection floor
            </button>
            {/* The tenth axis, held back by default. See the note on `factorLadder`: it is the
                one axis whose intervals do not all overlap, so the reader gets to add it and
                watch the caption above change rather than being told it never happens. */}
            <button class="btn" classList={{ "btn--primary": showFactor() }}
                    aria-pressed={showFactor()} onClick={() => setShowFactor(!showFactor())}>
              {showFactor() ? "Hide" : "Add"} the 10 satisfaction factors (R1)
            </button>
          </div>
          <Show when={shown() && all() && power()} fallback={<Skeleton h={420} />}>
            <ChartFigure
              id="ladder"
              caption={ladderClaim()}
              {...ladderTable(shown()!)}
            >
              <UncertaintyLadder data={shown()!} overallMean={all()!.mean} mdd={power()!.mdd}
                                 showFloor={showFloor()} poster={props.poster} onPick={pick} />
            </ChartFigure>
            <Show when={showFactor()}>
              <p class="pv-why" style={{ "margin-top": "8px" }}>
                The factor axis splits 120 customers ten ways, into groups averaging twelve.
                It is the only axis whose own levels separate from one another - Product Quality
                sits clear of the four lowest-scoring factors - and the effect still does not
                survive correction, nor does it beat relabelling the factors at random. That is
                R1: the most promising thing in the dataset, and still not a finding.
              </p>
            </Show>
          </Show>
        </section>

        <div class="col-right">
          <section class="panel">
            <Breadcrumb />
            <h2 class="panel__title">2 · The brief's headline question</h2>
            <p class="panel__sub">"Does contacting customer support negatively impact satisfaction?"</p>
            <Show when={support()} fallback={<Skeleton h={170} />}>
              <ChartFigure
                id="support"
                caption={
                  // Both sides of the comparison have to exist. A filter can leave only
                  // customers who contacted support, and "the difference is 0.000" would
                  // then be a number the report invented rather than measured.
                  !support()!.yes || !support()!.no
                    ? "Only one side of this comparison has customers under the current filters, " +
                      "so there is no difference to estimate."
                    : `The point estimate is ${dec(support()!.diff, 3)} points on a ten-point scale, but its ` +
                      `95% interval runs ${dec(support()!.diffLo)} to ${dec(support()!.diffHi)}. That interval is ` +
                      `the answer: it is not "no effect", it is "not measured".`
                }
                columns={["Group", "n", "Mean", "95% CI"]}
                rows={[
                  ...[support()!.yes, support()!.no].filter(Boolean).map((e) => [
                    e!.k === "Yes" ? "Contacted support" : "Did not contact",
                    String(e!.n), dec(e!.mean), `${dec(e!.lo)} - ${dec(e!.hi)}`]),
                  ...(support()!.yes && support()!.no
                    ? [["Difference", "", dec(support()!.diff, 3),
                        `${dec(support()!.diffLo)} - ${dec(support()!.diffHi)}`]]
                    : []),
                ]}
              >
                <table class="data">
                  <tbody>
                    <For each={[["Contacted support", support()!.yes], ["Did not contact", support()!.no]] as const}>
                      {([label, e]) => (
                        <Show when={e}>
                          <tr>
                            <td>{label}</td>
                            <td class="num" data-metric={`support.${e!.k}.mean`} data-value={e!.mean}>
                              {dec(e!.mean)}
                            </td>
                            <td class="num">n={int(e!.n)}</td>
                            <td class="num" style={{ color: "var(--ink-muted)" }}>
                              ±{dec(e!.ci)}
                            </td>
                          </tr>
                        </Show>
                      )}
                    </For>
                    {/* Only rendered when BOTH groups survive the filter. A difference
                        between a group and an absent group is not zero, it is undefined,
                        and tagging a fabricated 0.000 with a data-metric would hand
                        verify_metrics a number to agree with. */}
                    <Show when={support()!.yes && support()!.no}>
                      <tr style={{ "border-top": "2px solid var(--ink)" }}>
                        <td><strong>Difference</strong></td>
                        <td class="num" data-metric="support.diff.value" data-value={support()!.diff}>
                          <strong>{dec(support()!.diff, 3)}</strong>
                        </td>
                        <td class="num">d={dec(support()!.d, 3)}</td>
                        {/* Was a frozen "p=0.98" sitting beside three reactive cells. The interval
                            on the difference is both reactive AND the more honest statistic: it
                            is what distinguishes "zero" from "unmeasured". */}
                        <td class="num" style={{ color: "var(--ink-muted)" }}>
                          <span data-metric="support.diff.lo" data-value={support()!.diffLo}>
                            {dec(support()!.diffLo)}
                          </span>
                          {" - "}
                          <span data-metric="support.diff.hi" data-value={support()!.diffHi}>
                            {dec(support()!.diffHi)}
                          </span>
                        </td>
                      </tr>
                    </Show>
                  </tbody>
                </table>
                <p class="pv-why" style={{ "margin-top": "8px" }}>
                  {SUPPORT_TESTS} <WholeStudy />
                </p>
              </ChartFigure>
            </Show>
          </section>

          <section class="panel">
            <h2 class="panel__title">3 · What it would take</h2>
            <p class="panel__sub">{POWER_SUB}</p>
            <Show when={power()} fallback={<Skeleton h={190} />}>
              <ChartFigure
                id="power"
                /* The "144" here used to be typed while the table below recomputed from the
                   filtered rows - so filtering to Gender=Male made the caption say 144 above a
                   table reading 140. It now reads the same row the table renders, and says
                   nothing at all when the filter leaves too few customers for an sd. */
                caption={power()!.estimable
                  ? `A support experience costing a full point of satisfaction would be invisible in this survey: it needs ${power()!.rows.find((r) => r.diff === 1.0)!.need} customers per group and has about ${power()!.perGroup}.`
                  : "Too few customers match the current filters to estimate a required sample size."}
                columns={["To detect", "Needed per group", "Actually have"]}
                rows={power()!.rows.map((r) => [
                  `${r.diff.toFixed(1)} points`, maybe(r.need, int), String(r.have)])}
              >
                <table class="data">
                  <thead>
                    <tr><th scope="col">To detect</th><th scope="col">Need / group</th><th scope="col">Have</th></tr>
                  </thead>
                  <tbody>
                    <For each={power()!.rows}>
                      {(r) => (
                        <tr>
                          <td>{r.diff.toFixed(1)} points</td>
                          {/* No data-metric when there is no number: an untagged em dash is
                              honest, a tagged NaN is a metric nothing can reconcile. */}
                          <td class="num"
                              data-metric={r.need == null ? undefined : `power.${r.diff.toFixed(1)}.need`}
                              data-value={r.need == null ? undefined : r.need}>
                            {maybe(r.need, int)}
                          </td>
                          <td class="num" classList={{ underpowered: r.need != null && r.need > r.have }}>
                            {int(r.have)}{r.need != null && r.need > r.have ? " ⚑" : ""}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </ChartFigure>
            </Show>
          </section>
        </div>
      </div>

      <section class="panel" id="questions">
        <h2 class="panel__title">
          4 · The nine questions, answered <WholeStudy />
        </h2>
        <p class="panel__sub">{BONFERRONI_NOTE}</p>
        <table class="data">
          <thead><tr>
            <th scope="col">#</th><th scope="col">Question</th>
            <th scope="col">What was tested</th><th scope="col">Result</th>
          </tr></thead>
          <tbody>
            <For each={QUESTIONS}>
              {([id, q, outcome, res]) => (
                <tr>
                  <td class="num" style={{ width: "1%" }}>{id}</td>
                  <td>{q}</td>
                  <td style={{ color: "var(--ink-muted)", "font-size": "0.78rem" }}>{outcome}</td>
                  <td class="num" style={{ color: "var(--ink-muted)" }}>{res}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <p class="pv-why" style={{ "margin-top": "8px" }}>
          <strong>The outcome variable is part of the answer.</strong> R2, R5 and R7 ask about
          loyalty, so they are answered with a chi-square of <em>loyalty</em> against the named
          segmentation - not, as in an earlier revision of this report, with a test of
          satisfaction.<br />
          {R1_FOOTNOTE}<br />
          {R9_FOOTNOTE}
        </p>
      </section>

      <section class="panel">
        <h2 class="panel__title">So what</h2>
        <div class="sowhat">
          <div class="sowhat__item">
            <div class="sowhat__n">01</div>
            <p class="sowhat__h">Act on none of these differences</p>
            <p class="sowhat__b">
              Not one of seven candidate drivers survives correction, and the largest apparent
              effect is reproducible by shuffling labels.
            </p>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">02</div>
            <p class="sowhat__h">Re-run at ~150 responses per comparison group</p>
            <p class="sowhat__b">
              {/* No literal fallback. A skeleton dash is honest while loading; a hardcoded
                  "1.55" would be a number the reader cannot tell apart from a computed one. */}
              The current design cannot see anything smaller than{" "}
              {power() ? maybe(power()!.mdd, dec) : "-"} points. A one-point effect needs{" "}
              {power() ? maybe(power()!.rows.find((r) => r.diff === 1.0)!.need, int) : "-"} per group.
            </p>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">03</div>
            <p class="sowhat__h">Collect a date and an order value</p>
            <p class="sowhat__b">
              Neither exists, despite the brief describing feedback "throughout 2024" - so
              satisfaction cannot be tied to behaviour or trend at any sample size.
            </p>
          </div>
        </div>
      </section>

      <Explore filters={f} />

      <footer class="colophon">
        <strong>Source:</strong> Onyx Data DataDNA July 2025 - Customer Satisfaction (OmniRetail).
        120 customers, one row each, 12 columns, <em>no date column</em>.
        <strong> Method:</strong> Polars → Parquet star schema → Malloy semantic model (12 views,
        every mean paired with its n and a minimum-detectable-difference measure) → row-level
        aggregation in the browser. Every rendered figure is independently recomputed from the
        parquet in DuckDB and asserted to match.
        <strong> Statistics:</strong> {COLOPHON_STATS}
        <strong> Accessibility:</strong> WCAG 2.1 AA - body text is Atkinson Hyperlegible, designed
        for low-vision readers; charts are keyboard-operable and exposed as data tables including n
        and CI bounds; estimate versus interval is carried by shape as well as colour, so the chart
        reads in greyscale. <strong>Caveat:</strong> absence of evidence at n=120 is not evidence of
        absence - that is precisely the finding.
      </footer>
    </div>
  );
}

function Skeleton(props: { h: number }) {
  return <div aria-hidden="true" style={{
    height: `${props.h}px`,
    background: "repeating-linear-gradient(180deg, var(--bg-sunken) 0 14px, transparent 14px 26px)",
    opacity: 0.6 }} />;
}
