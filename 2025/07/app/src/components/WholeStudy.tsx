/**
 * "all 120" - the badge that stops a frozen figure from lying.
 *
 * This report contains two kinds of number and they must never be confused:
 *
 *   REACTIVE - every mean, n, interval, and required sample size. Computed from the rows
 *              currently passing the cross-filter. These move when you click a chip.
 *
 *   WHOLE-STUDY - the test results (Kruskal-Wallis, chi-square, the permutation test, the
 *              observed sd). These are computed once, on all 120 customers, and are FROZEN.
 *              Recomputing a p-value against a subset the reader chose interactively would
 *              be a garden of forking paths, not a finding, so the report refuses to do it.
 *
 * A frozen number sitting beside a reactive table is exactly how a dashboard comes to
 * contradict itself: the caption keeps saying 144 while the table beneath it recomputes to
 * 140. Freezing is still the right call for a test statistic - but only if the reader is
 * told, at the point of use, which kind of number they are looking at. That is this badge.
 */
export function WholeStudy(props: { n?: number }) {
  const n = () => props.n ?? 120;
  return (
    <span
      class="wholestudy"
      title={`Whole-study result: computed once on all ${n()} customers. Unaffected by the filters above.`}
    >
      all {n()}
    </span>
  );
}
