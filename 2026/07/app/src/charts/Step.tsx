/**
 * THE STEP - the signature. A fit-comparison chart.
 *
 * Sixteen observed quarterly means of ai_adoption_rate, with BOTH candidate models drawn over
 * them: a stepped solid path (20.24% for seven quarters, then 38.47% for nine) and a straight
 * dashed line (+1.69pp/quarter).
 *
 * WHY THIS AND NOT A TREND LINE. The obvious chart is the quarterly trend, which is what a
 * policy pack would contain and which is significant at p = 0.0001. Drawing only the line is
 * the error the page exists to correct; drawing only the step asserts the conclusion. Drawing
 * BOTH, with their residual sums of squares printed, is the argument - and the two readings
 * imply opposite funding decisions.
 *
 * HONESTY CONSTRAINTS, enforced here:
 *
 *  - All sixteen observed means are drawn as points, in --flat, unmodelled. Both fits are drawn
 *    OVER them; neither replaces them.
 *  - The linear fit is drawn at FULL WEIGHT, not as a strawman. It is a real, significant fit.
 *  - Both residual sums of squares are printed on the chart, so the 3.61x claim is checkable
 *    from the page rather than asserted.
 *  - The y-axis starts at zero, so the +18.23pp step is not exaggerated.
 *
 * COLOUR IS REDUNDANT, BY NECESSITY. --measured and --claimed are 6.18:1 and 5.62:1 against the
 * ground but only 1.10:1 against EACH OTHER in relative luminance (measured at G5). They are
 * identical in greyscale, so the two fits are distinguished by MARK TYPE - stepped solid vs
 * straight dashed - and both are labelled in place.
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import { type Fit, type Quarter, FITS, FIT_LABEL, pt, pval } from "../data";

export function Step(props: {
  quarters: Quarter[];
  fit: Fit;
  headline: Record<string, any>;
  poster?: boolean;
  selected?: number | null;
  onPick?: (id: number | null) => void;
}) {
  const [hover, setHover] = createSignal<number | null>(null);
  const active = () => props.selected ?? hover();

  /* The poster column is 2472px wide and the signature's row budget is 380px, of which the
     header, caption and legend take ~79. A viewBox is scaled to the container's WIDTH, so
     its aspect ratio is what sets the rendered height: 2472/2440 x 380 = 385px. The web
     chart is a different shape because it lives in a 1220px column. */
  const W = () => (props.poster ? 2440 : 940);
  const H = () => (props.poster ? 380 : 420);
  const PAD_L = 58, PAD_T = 18;
  /* The right gutter holds the in-place labels, and its width is set by the longest of them
     ("+1.69pp/qtr · R² 0.676 · p < 0.001"), not by symmetry. Measured: at 210 the poster's
     line annotation painted 22px outside the chart and overflow:hidden ate the tail. */
  const PAD_R = () => (props.poster ? 300 : 210);
  const PAD_B = () => (props.poster ? 44 : 52);

  const rows = createMemo(() => props.quarters.slice().sort((a, b) => a.date_id - b.date_id));
  const YMAX = 52;   // fixed, and above the observed max - the axis starts at 0 by design
  const x = (i: number) =>
    PAD_L + (i / Math.max(rows().length - 1, 1)) * (W() - PAD_L - PAD_R());
  const y = (v: number) => PAD_T + (1 - v / YMAX) * (H() - PAD_T - PAD_B());

  /** The step path: a horizontal run per era with a vertical riser between them. */
  const stepPath = createMemo(() => {
    const r = rows();
    if (!r.length) return "";
    const parts: string[] = [];
    r.forEach((q, i) => {
      const px = x(i), py = y(q.step_fit);
      if (i === 0) parts.push(`M ${px} ${py}`);
      else {
        const prev = r[i - 1];
        if (prev.step_fit !== q.step_fit) parts.push(`L ${px} ${y(prev.step_fit)}`, `L ${px} ${py}`);
        else parts.push(`L ${px} ${py}`);
      }
    });
    return parts.join(" ");
  });

  const linePath = createMemo(() => {
    const r = rows();
    if (!r.length) return "";
    return `M ${x(0)} ${y(r[0].linear_fit)} L ${x(r.length - 1)} ${y(r[r.length - 1].linear_fit)}`;
  });

  const eraIdx = createMemo(() => rows().findIndex((q) => q.generative_ai_era));
  const h = () => props.headline;

  const tableRows = createMemo(() =>
    rows().map((q) => [
      q.year_quarter_label, q.generative_ai_era ? "generative-AI era" : "before",
      q.rows, pt(q.mean_adoption), pt(q.step_fit), pt(q.linear_fit),
    ]));

  return (
    <ChartFigure
      id="step"
      caption="Two models over one series. The statistically significant one does not touch the data."
      columns={["Quarter", "Era", "Records", "Observed mean", "Step fit", "Linear fit"]}
      rows={tableRows()}
    >
      <svg class="stepchart" viewBox={`0 0 ${W()} ${H()}`} width="100%" role="img"
        aria-label={`Mean AI adoption rate by quarter, 2021-Q1 to 2024-Q4, with two candidate models drawn over the sixteen observed points. A step model holds ${pt(h().pre_mean ?? 0)} percent for seven quarters then ${pt(h().post_mean ?? 0)} percent for nine, with residual sum of squares ${pt(h().ss_step ?? 0, 1)}. A linear model rises ${pt(h().linear_slope ?? 0)} points per quarter with residual sum of squares ${pt(h().ss_linear ?? 0, 1)}. The step fits ${pt(h().step_beats_line_by ?? 0)} times better.`}>

        {/* y gridlines, informational so --flat not --rule */}
        <For each={[0, 10, 20, 30, 40, 50]}>
          {(v) => (
            <>
              <line class="sc-grid" x1={PAD_L} y1={y(v)} x2={W() - PAD_R()} y2={y(v)} />
              <text class="sc-tick" x={PAD_L - 8} y={y(v) + 4} text-anchor="end">{v}</text>
            </>
          )}
        </For>

        {/* the era boundary */}
        <Show when={eraIdx() > 0}>
          <line class="sc-era" x1={x(eraIdx())} y1={PAD_T} x2={x(eraIdx())} y2={H() - PAD_B()} />
          <text class="sc-eralab" x={x(eraIdx()) + 6} y={PAD_T + 12}>
            2022-Q4 · generative_ai_era = true
          </text>
        </Show>

        {/* WHERE THE TWO LABEL BLOCKS GO.
            The whole point of the chart is that the two models AGREE at the right-hand end -
            the step's upper level is 38.47 and the line arrives at 43.18. Anchoring each block
            to its own series therefore stacks them on top of each other, which is what the
            first poster capture showed: six lines of type in one illegible pile.
            So the blocks are pushed symmetrically apart around the point where the series
            converge. Each still sits beside the end of the series it describes, and the
            distance between them is now a constant rather than a coincidence. */}
        {(() => {
          const mid = () => (y(h().post_mean ?? 38) + y(rows().at(-1)?.linear_fit ?? 40)) / 2;
          const LX = () => W() - PAD_R() + 10;
          const ROW = 15;
          /* clamped: at the first poster capture the block's top line was pushed above the
             plot area and the chart's own clip took the words "step at 2022-Q4" off */
          const stepTop = () => Math.max(mid() - 56, PAD_T + 14);
          const lineTop = () => mid() + 26;
          return (
            <>
              <Show when={props.fit !== "line"}>
                <line class="sc-lead sc-lead--step" x1={W() - PAD_R()} y1={y(h().post_mean ?? 38)}
                      x2={LX() - 4} y2={stepTop() - 4} />
                <text class="sc-lab sc-lab--step" x={LX()} y={stepTop()}>step at 2022-Q4</text>
                <text class="sc-sub sc-lab--step" x={LX()} y={stepTop() + ROW}>
                  {pt(h().pre_mean ?? 0)}% → {pt(h().post_mean ?? 0)}%
                </text>
                <text class="sc-sub sc-lab--step" x={LX()} y={stepTop() + ROW * 2}>
                  residual SS {pt(h().ss_step ?? 0, 1)} · {pt(h().step_beats_line_by ?? 0)}× better
                </text>
              </Show>
              <Show when={props.fit !== "step"}>
                <line class="sc-lead sc-lead--line" x1={W() - PAD_R()}
                      y1={y(rows().at(-1)?.linear_fit ?? 40)} x2={LX() - 4} y2={lineTop() - 10} />
                <text class="sc-lab sc-lab--line" x={LX()} y={lineTop()}>linear trend</text>
                <text class="sc-sub sc-lab--line" x={LX()} y={lineTop() + ROW}>
                  +{pt(h().linear_slope ?? 0)}pp/qtr · R² {pt(h().linear_r2 ?? 0, 3)} · p {pval(h().linear_p ?? 1)}
                </text>
                <text class="sc-sub sc-lab--line" x={LX()} y={lineTop() + ROW * 2}>
                  residual SS {pt(h().ss_linear ?? 0, 1)}
                </text>
              </Show>
            </>
          );
        })()}

        {/* the two fitted paths themselves */}
        <Show when={props.fit !== "step"}>
          <path class="sc-line" d={linePath()} />
        </Show>
        <Show when={props.fit !== "line"}>
          <path class="sc-step" d={stepPath()} />
        </Show>

        {/* the observed means, drawn last so they sit on top of both models */}
        <For each={rows()}>
          {(q, i) => (
            <g
              classList={{ "sc-active": active() === q.date_id,
                           "sc-dim": active() !== null && active() !== q.date_id }}
              onMouseEnter={() => !props.poster && setHover(q.date_id)}
              onMouseLeave={() => !props.poster && setHover(null)}
              onClick={() => !props.poster &&
                props.onPick?.(props.selected === q.date_id ? null : q.date_id)}
            >
              <circle class="sc-pt" cx={x(i())} cy={y(q.mean_adoption)} r={props.poster ? 5 : 4.5} />
              <Show when={!props.poster}>
                <circle class="sc-hit" cx={x(i())} cy={y(q.mean_adoption)} r={14} />
              </Show>
            </g>
          )}
        </For>

        {/* x ticks - every fourth quarter */}
        <For each={rows()}>
          {(q, i) => (
            <Show when={i() % 4 === 0}>
              <text class="sc-tick" x={x(i())} y={H() - PAD_B() + 16} text-anchor="middle">
                {q.year_quarter_label}
              </text>
            </Show>
          )}
        </For>
        <text class="sc-axis" x={PAD_L - 44} y={PAD_T + 4}>%</text>
      </svg>

      <p class="sc-legend">
        <span class="sc-key sc-key--step" aria-hidden="true" /> <b>solid, stepped</b> - the model
        the data supports.{" "}
        <span class="sc-key sc-key--line" aria-hidden="true" /> <b>dashed, straight</b> - a real
        fit, significant at p {pval(h().linear_p ?? 1)}, that does not touch the points. Within-era slopes are{" "}
        <b class="num">{pt(h().pre_slope ?? 0, 3)}</b> (p {pt(h().pre_slope_p ?? 0, 3)}) and{" "}
        <b class="num">+{pt(h().post_slope ?? 0, 3)}</b> (p {pt(h().post_slope_p ?? 0, 3)}) - both
        flat. The step lands <em>on</em> the <code>generative_ai_era</code> flag, which the date
        dimension already carried.
      </p>
    </ChartFigure>
  );
}

/** The fit toggle. It IS the argument, so it is a real radio group, not a styled div. */
export function FitToggle(props: { value: Fit; onChange: (f: Fit) => void; note: string }) {
  return (
    <div class="fitctl">
      <fieldset class="fitctl__set">
        <legend class="fitctl__legend">Which model?</legend>
        <For each={FITS}>
          {(f) => (
            <label class="fitctl__opt" classList={{ "fitctl__opt--on": props.value === f }}>
              <input type="radio" name="fit" value={f} checked={props.value === f}
                     onChange={() => props.onChange(f)} />
              <span>{FIT_LABEL[f]}</span>
            </label>
          )}
        </For>
      </fieldset>
      <p class="fitctl__note">{props.note}</p>
    </div>
  );
}
