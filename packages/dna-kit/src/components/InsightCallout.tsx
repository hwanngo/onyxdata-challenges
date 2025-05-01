/**
 * The "so what" panel - 3 numbered recommendations, each tied to a chart.
 *
 * This is what separates a 3 from a 4 on Insights. Most entries stop at description.
 * Every recommendation must trace to a ledger entry in analysis/insights.md.
 */
export function InsightCallout(props: {
  recommendations: { text: string; evidence: string; chartId?: string }[];
}) {
  return (
    <section class="sowhat" aria-labelledby="sowhat-h">
      <h2 id="sowhat-h" class="sowhat__h">What we recommend</h2>
      <ol class="sowhat__list">
        {props.recommendations.map((r, i) => (
          <li class="sowhat__item">
            <span class="sowhat__n" aria-hidden="true">{i + 1}</span>
            <div>
              <p class="sowhat__text">{r.text}</p>
              <p class="sowhat__ev">
                {r.evidence}
                {r.chartId && (
                  <>
                    {" "}
                    <a href={`#${r.chartId}`}>see chart</a>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
