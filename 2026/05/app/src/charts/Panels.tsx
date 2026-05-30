/**
 * Supporting panels - 2026/05.
 *
 * Every panel title states a FINDING, not a topic. Every figure carries data-metric /
 * data-value so tools/verify_metrics.py can recompute it from the parquet and assert the
 * DOM matches.
 *
 * PANEL ORDER IS LOAD-BEARING. CohortShape (④) must render before CohortValue (⑤): ④ is
 * what earns the right to rename the vendor's `is_fraud_cluster` to "repeat-concentrated
 * accounts" by showing the split is real and enormous under a confound-free measure. Drawing
 * conclusions from the cohort before establishing that would be unfair to 482 paying
 * subscribers. See .workbench/2026/05/design/direction.md, "The naming decision".
 */
import { For, Show, createMemo } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import {
  type Artist, type Axis, type Defect, type Flag,
  int, pct, pctRaw, secsFmt, signed, usd0, usd2, DOW,
} from "../data";

// =========================================================================================
// ④  The cohort, defined by measured behaviour
// =========================================================================================

export function CohortShape(props: {
  cohort: any[];
  flags: Flag[];
  headline: Record<string, number>;
  onFilter?: (field: string, value: string | number) => void;
  active?: (field: string, value: string | number) => boolean;
  poster?: boolean;
}) {
  const rc = () => props.cohort.find((c) => c.is_repeat_concentrated) ?? {};
  const br = () => props.cohort.find((c) => !c.is_repeat_concentrated) ?? {};
  const d = () =>
    props.flags.find((f) => f.flag === "is_repeat_concentrated")?.cliffs_delta ?? 0;

  const bar = (v: number, max: number) => `${Math.max(2, (100 * v) / max)}%`;
  /* One formatter for the rarefied count, used by the caption, the marks and the
     screen-reader table, so the three cannot round differently from each other. */
  const tracks30 = (c: any) => c?.tracks_at_30?.toFixed(1) ?? "-";

  return (
    <ChartFigure
      id="cohort-shape"
      /* Computed, not typed. The integrity pass found this reading "9.5 ... against 22.5"
         while cohort.json holds 9.401826 and 22.582418 and the tagged elements directly
         below rendered 9.4 and 22.5 - a caption disagreeing with its own panel, and with
         the screen-reader table in this very component. */
      caption={`It is not a crime, it is a listening shape: ${tracks30(rc())} distinct tracks `
             + `per 30 plays against ${tracks30(br())}.`}
      columns={["Cohort", "Listeners", "Distinct tracks per 30 plays", "Within-listener concentration", "Mean sessions"]}
      rows={props.cohort.map((c) => [
        c.is_repeat_concentrated ? "Repeat-concentrated" : "Broad listening",
        int(c.people),
        tracks30(c),
        c.hhi?.toFixed(4) ?? "-",
        c.mean_sessions?.toFixed(1) ?? "-",
      ])}
    >
      <div class="shape">
        <div class="shape__metric">
          <span class="shape__cap">distinct tracks in a fixed 30 plays</span>
          <div class="shape__row">
            <span class="shape__name">
              <Show when={!props.poster} fallback={<>Repeat-concentrated</>}>
                <button
                  type="button"
                  class="shape__pick"
                  aria-pressed={props.active?.("is_repeat_concentrated", "true") ?? false}
                  onClick={() => props.onFilter?.("is_repeat_concentrated", "true")}
                >
                  Repeat-concentrated
                </button>
              </Show>
            </span>
            <span class="shape__bar">
              <i class="shape__fill shape__fill--inflated" style={{ width: bar(rc().tracks_at_30 ?? 0, 25) }} />
            </span>
            <b class="num" data-metric="tracks_at_30_flagged" data-value={rc().tracks_at_30}>
              {(rc().tracks_at_30 ?? 0).toFixed(1)}
            </b>
          </div>
          <div class="shape__row">
            <span class="shape__name">
              <Show when={!props.poster} fallback={<>Broad listening</>}>
                <button
                  type="button"
                  class="shape__pick"
                  aria-pressed={props.active?.("is_repeat_concentrated", "false") ?? false}
                  onClick={() => props.onFilter?.("is_repeat_concentrated", "false")}
                >
                  Broad listening
                </button>
              </Show>
            </span>
            <span class="shape__bar">
              <i class="shape__fill shape__fill--surfaced" style={{ width: bar(br().tracks_at_30 ?? 0, 25) }} />
            </span>
            <b class="num" data-metric="tracks_at_30_clean" data-value={br().tracks_at_30}>
              {(br().tracks_at_30 ?? 0).toFixed(1)}
            </b>
          </div>
        </div>

        <p class="shape__why">
          Rarefied at a <b>fixed 30 plays per listener</b>, so session count cannot drive it.
          The naive ratio (distinct ÷ sessions) is bounded by 774/n and this cohort has 2.3×
          more sessions - correcting for that makes the gap <em>wider</em>, not narrower.
          Cliff's d = <b class="num">{signed(d())}</b>. Within-listener concentration
          (Herfindahl) <b class="num">{(rc().hhi ?? 0).toFixed(4)}</b> against{" "}
          <b class="num">{(br().hhi ?? 0).toFixed(4)}</b>.
        </p>
        <p class="shape__name-note">
          {/* prose-number-ok: I2 - the naming decision (assumptions.md A1). The cohort's
              user share is charted as repeat_concentrated_user_share in the KPI strip.

              The SOURCE COLUMN IS NOT NAMED HERE. .workbench/2026/05/design/direction.md commits the page to
              printing the vendor's word exactly once, in the footer, and interact.mjs
              asserts the count - this panel is where the argument is made, the footer is
              where the provenance is disclosed. Naming it in both places broke the promise
              and the test caught it. */}
          The vendor flag this cohort comes from marks{" "}
          <b class="num" data-metric="repeat_concentrated_user_share"
             data-value={props.headline.repeat_concentrated_user_share}>
            {pct(props.headline.repeat_concentrated_user_share ?? 0)}
          </b>{" "}
          of all users - a prevalence no genuine abuse population has - and it arrives with no evidence of the determination
          behind it. This page therefore names the cohort for what is measured above:
          repetition. The source column is disclosed verbatim in the footer.
        </p>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑤  Neither a farm nor a loss
// =========================================================================================

export function CohortValue(props: {
  artists: Artist[];
  cohort: any[];
  headline: Record<string, number>;
}) {
  const top = createMemo(() =>
    props.artists.slice().sort((a, b) => a.rank_all - b.rank_all)[0]
  );
  const rc = () => props.cohort.find((c) => c.is_repeat_concentrated) ?? {};
  const br = () => props.cohort.find((c) => !c.is_repeat_concentrated) ?? {};
  const h = () => props.headline;

  return (
    <ChartFigure
      id="cohort-value"
      /* prose-number-ok: I3 - top_listener_share is tagged as a data-metric in the body
         of this same panel; the caption states it in words. */
      /* prose-number-ok: I3 - top_listener_share is tagged as a data-metric in this same
         panel's body; the caption states it in words. */
      caption="Neither a farm nor a loss: one account supplies 87.5% of the top artist's repeat plays, and the cohort cannot be shown to be worth less."
      columns={["Measure", "Repeat-concentrated", "Broad listening"]}
      rows={[
        ["Listeners", int(rc().people ?? 0), int(br().people ?? 0)],
        ["Mean lifetime value", usd2(rc().mean_ltv ?? 0), usd2(br().mean_ltv ?? 0)],
        ["Mean sessions", (rc().mean_sessions ?? 0).toFixed(1), (br().mean_sessions ?? 0).toFixed(1)],
      ]}
    >
      <div class="farm">
        <p class="farm__head">
          <b>{top()?.artist_name}</b> - {int(top()?.plays_flagged ?? 0)} plays from the cohort,
          across {int(top()?.flagged_listeners ?? 0)} listeners.
        </p>
        <div class="farm__bar" role="img"
          aria-label={`Of ${top()?.artist_name}'s repeat-concentrated plays, ${pct(top()?.top_listener_share ?? 0)} come from a single account.`}>
          <i class="farm__one" style={{ width: pct(top()?.top_listener_share ?? 0) }} />
        </div>
        <p class="farm__cap">
          <b class="num" data-metric="top_listener_share" data-value={top()?.top_listener_share ?? 0}>
            {pct(top()?.top_listener_share ?? 0)}
          </b>{" "}
          {/* prose-number-ok: I3 - the 73-98% range across five artists has no single DOM
               home; each artist's share is in dim_artist_rank.top_listener_share. */}
          of them are <b>one account</b>. Across every over-indexed artist the top three {/* prose-number-ok: I3 */}
          listeners carry 73-98%. {/* prose-number-ok: I3 */} That is individual repetition, not a coordinated farm - so
          there is nothing to shut down.
        </p>

        <div class="farm__ltv">
          <span class="shape__cap">mean lifetime value</span>
          <div class="shape__row">
            <span class="shape__name">Repeat-concentrated</span>
            <span class="shape__bar">
              <i class="shape__fill shape__fill--inflated"
                 style={{ width: `${(100 * (rc().mean_ltv ?? 0)) / 200}%` }} />
            </span>
            <b class="num" data-metric="ltv_flagged_usd" data-value={rc().mean_ltv}>
              {usd2(rc().mean_ltv ?? 0)}
            </b>
          </div>
          <div class="shape__row">
            <span class="shape__name">Broad listening</span>
            <span class="shape__bar">
              <i class="shape__fill shape__fill--surfaced"
                 style={{ width: `${(100 * (br().mean_ltv ?? 0)) / 200}%` }} />
            </span>
            <b class="num" data-metric="ltv_clean_usd" data-value={br().mean_ltv}>
              {usd2(br().mean_ltv ?? 0)}
            </b>
          </div>
          <p class="farm__cap">
            p = <b class="num">{(h().ltv_mannwhitney_p ?? 0).toFixed(3)}</b> - indistinguishable,
            not equal: the gap could be{" "}
            <b class="num" data-metric="ltv_diff_ci_lo_pct" data-value={h().ltv_diff_ci_lo_pct}>
              {(h().ltv_diff_ci_lo_pct ?? 0).toFixed(1)}%
            </b>{" "}
            to{" "}
            <b class="num" data-metric="ltv_diff_ci_hi_pct" data-value={h().ltv_diff_ci_hi_pct}>
              +{(h().ltv_diff_ci_hi_pct ?? 0).toFixed(1)}%
            </b>, and{" "}
            <b class="num" data-metric="ltv_mde_pct" data-value={h().ltv_mde_pct}>
              {(h().ltv_mde_pct ?? 0).toFixed(1)}%
            </b>{" "}
            is the smallest this test could see. <b>You cannot ban them.</b> But{" "}
            <b class="num">{pct(h().royalty_flagged_share ?? 0)}</b> of the royalty bill
            ({usd2(h().royalty_on_flagged_usd ?? 0)} of {usd2(h().royalty_usd ?? 0)}) is theirs.
          </p>
        </div>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑥  The 30-second cliff
// =========================================================================================

export function PayoutCliff(props: {
  duration: any[];
  threshold: any[];
  headline: Record<string, number>;
  cut: number;
  onCut?: (s: number) => void;
  poster?: boolean;
}) {
  const bins = createMemo(() => {
    const m = new Map<number, number>();
    for (const d of props.duration) m.set(d.bin_start, (m.get(d.bin_start) ?? 0) + d.sessions);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([bin, n]) => ({ bin, n }));
  });
  const maxN = () => Math.max(...bins().map((b) => b.n), 1);
  // The poster row is fixed, so the histogram gets its own aspect there rather than
  // letting `width:100%` set its height from the column width.
  const W = 620, PAD_L = 8, PAD_B = 22;
  const H = props.poster ? 100 : 190;
  const x = (s: number) => PAD_L + (s / 240) * (W - PAD_L * 2);
  const bw = () => (5 / 240) * (W - PAD_L * 2);

  const atCut = () =>
    props.threshold.find((t) => t.threshold_seconds === props.cut) ??
    props.threshold.find((t) => t.threshold_seconds === 30);

  return (
    <ChartFigure
      id="payout-cliff"
      /* prose-number-ok: I5 - both deltas are rows of fact_threshold_sensitivity and are
         tagged individually as threshold.<s>.qualifying marks below. */
      /* prose-number-ok: I5 - both deltas are rows of fact_threshold_sensitivity, tagged
         individually as threshold.<seconds>.qualifying marks in this panel. */
      caption="Move the payout line two seconds and 15.1% of payable plays vanish; five seconds and 38.0% do."
      columns={["Threshold (s)", "Qualifying plays", "Royalty", "Change vs 30s"]}
      rows={props.threshold.map((t) => [
        t.threshold_seconds, int(t.qualifying_plays), usd2(t.royalty_usd),
        pctRaw(t.pct_change_vs_30s),
      ])}
    >
      <svg class="cliff" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label="Histogram of listen duration in five-second bins. Mass piles between 30 and 44 seconds, immediately above the 30-second royalty threshold, and the range from 45 to 114 seconds is almost empty.">
        <For each={bins()}>
          {(b) => (
            <rect
              class="cliff__bar"
              classList={{
                "cliff__bar--band": b.bin >= 30 && b.bin < 45,
                "cliff__bar--under": b.bin < 30,
              }}
              x={x(b.bin)}
              y={H - PAD_B - ((H - PAD_B - 8) * b.n) / maxN()}
              width={Math.max(bw() - 1, 1)}
              height={((H - PAD_B - 8) * b.n) / maxN()}
            />
          )}
        </For>
        <line class="cliff__cut" x1={x(props.cut)} y1={2} x2={x(props.cut)} y2={H - PAD_B} />
        <text
          class="cliff__cutlab"
          x={Math.min(x(props.cut) + 5, W - PAD_L - 140)}
          y={14}
        >
          {props.cut}s - the payout line
        </text>
        <line class="cx-rule" x1={PAD_L} y1={H - PAD_B} x2={W - PAD_L} y2={H - PAD_B} />
        <For each={[0, 30, 60, 120, 180, 240]}>
          {(tick) => (
            <text
              class="cliff__tick"
              x={x(tick)}
              y={H - PAD_B + 15}
              /* the first and last ticks sit on the viewBox edge; centring them there puts
                 half the glyph outside it, where SVG silently clips */
              text-anchor={tick === 0 ? "start" : tick === 240 ? "end" : "middle"}
            >
              {tick}s
            </text>
          )}
        </For>
        <text class="cliff__note" x={x(70)} y={H - PAD_B - 14}>
          nothing at 45-60s
        </text>
      </svg>

      <Show when={!props.poster}>
        <label class="cliff__slider">
          <span>Payout threshold: <b class="num">{props.cut}s</b></span>
          <input
            type="range" min="20" max="60" step="1" value={props.cut}
            onInput={(e) => props.onCut?.(+e.currentTarget.value)}
            aria-label="Payout threshold in seconds"
          />
        </label>
      </Show>

      {/* Every point on the sensitivity curve is a chart mark and is verified as one.
          Rendered visually-hidden because the poster shows the curve, not the table. */}
      <div class="sr-only">
        <For each={props.threshold}>
          {(t) => (
            <span
              data-metric={`threshold.${t.threshold_seconds}.qualifying`}
              data-value={t.qualifying_plays}
            >
              {int(t.qualifying_plays)}
            </span>
          )}
        </For>
      </div>
      <p class="cliff__cap">
        <b class="num" data-metric="band_share" data-value={props.headline.band_share}>
          {pct(props.headline.band_share ?? 0)}
        </b>{" "}
        of all plays sit in the 30-44s band. At{" "}
        <b class="num">{atCut()?.threshold_seconds}s</b> the platform pays{" "}
        <b class="num">{usd2(atCut()?.royalty_usd ?? 0)}</b> on{" "}
        <b class="num">{int(atCut()?.qualifying_plays ?? 0)}</b> plays -{" "}
        <b class="num">{pctRaw(atCut()?.pct_change_vs_30s ?? 0)}</b> against the 30s rule.
        The bill is a setting, not an observation.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑦  The column called revenue
// =========================================================================================

export function RevenueScale(props: { headline: Record<string, number> }) {
  const h = () => props.headline;
  const sub = () => h().subscription_revenue_total_usd ?? 0;
  const sess = () => h().session_column_total_usd ?? 0;

  return (
    <ChartFigure
      id="revenue-scale"
      /* prose-number-ok: I7 - 0.5% is the reciprocal of session_vs_subscription_ratio,
         which is tagged as a data-metric in this panel's body. */
      /* prose-number-ok: I7 - 0.5% is the reciprocal of session_vs_subscription_ratio,
         tagged as a data-metric in this panel's body. */
      caption="The column called revenue is 0.5% of revenue - and it adds ad income to royalty cost."
      columns={["Source", "48-month total"]}
      rows={[
        ["Subscription revenue (reconstructed from the event log)", usd2(sub())],
        ["estimated_revenue_usd (the session column)", usd2(sess())],
      ]}
    >
      <div class="revscale" role="img"
        aria-label={`Subscription revenue is ${usd2(sub())} over 48 months. The session-level column totals ${usd2(sess())} - ${h().session_vs_subscription_ratio}times smaller, drawn here at true scale as a hairline.`}>
        <div class="revscale__row">
          <span class="revscale__lab">Subscription revenue</span>
          <span class="revscale__track"><i class="revscale__fill revscale__fill--real" /></span>
          <b class="num" data-metric="subscription_revenue_total_usd" data-value={sub()}>{usd2(sub())}</b>
        </div>
        <div class="revscale__row">
          <span class="revscale__lab"><code>estimated_revenue_usd</code></span>
          <span class="revscale__track">
            <i class="revscale__fill revscale__fill--fake"
               style={{ width: `${Math.max(0.14, (100 * sess()) / sub())}%` }} />
          </span>
          <b class="num" data-metric="session_column_total_usd" data-value={sess()}>{usd2(sess())}</b>
        </div>
      </div>
      <p class="cliff__cap">
        Both bars are at true scale; the second is a hairline because it is{" "}
        <b class="num" data-metric="session_vs_subscription_ratio"
           data-value={h().session_vs_subscription_ratio}>
          {h().session_vs_subscription_ratio}×
        </b>{" "}
        smaller. Worse, it is not one quantity: on Free it is ad <b>income</b>, on paid tiers
        it is the per-stream royalty the platform <b>pays out</b>. Summing the column nets a
        cost against a revenue. The curated model has no field named <code>revenue</code>.
      </p>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑧  Growth quality
// =========================================================================================

export function GrowthQuality(props: { mrr: any[]; headline: Record<string, number> }) {
  const h = () => props.headline;
  const byYear = createMemo(() => {
    const m = new Map<number, { net: number; recon: number; cust: number }>();
    for (const r of props.mrr) {
      const y = new Date(r.month).getUTCFullYear();
      const g = m.get(y) ?? { net: 0, recon: 0, cust: 0 };
      g.net += r.net_usd; g.recon += r.reconciliation_net_usd; g.cust += r.customer_net_usd;
      m.set(y, g);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
      .map(([year, g]) => ({ year, ...g, share: g.net ? g.recon / g.net : 0 }));
  });

  return (
    <ChartFigure
      id="growth-quality"
      caption="A third of net MRR growth is the back office, and its share grows every year."
      columns={["Year", "Net MRR", "Customer-driven", "Reconciliation", "Reconciliation share"]}
      rows={byYear().map((r) => [r.year, usd2(r.net), usd2(r.cust), usd2(r.recon), pct(r.share)])}
    >
      <div class="growth">
        <div class="growth__split" role="img"
          aria-label={`Of ${usd2(h().net_mrr_usd ?? 0)} net MRR added over 48 months, ${usd2(h().customer_net_mrr_usd ?? 0)} is customer-driven and ${usd2(h().reconciliation_net_usd ?? 0)} carries the reconciliation label.`}>
          <i class="growth__cust"
             style={{ width: pct(1 - (h().reconciliation_share_of_net ?? 0)) }}>
            <span>customer-driven</span>
          </i>
          <i class="growth__recon" style={{ width: pct(h().reconciliation_share_of_net ?? 0) }}>
            <span>reconciliation</span>
          </i>
        </div>
        <div class="growth__nums">
          <span>
            <b class="num" data-metric="customer_net_mrr_usd" data-value={h().customer_net_mrr_usd}>
              {usd2(h().customer_net_mrr_usd ?? 0)}
            </b>
            <small>customer-driven</small>
          </span>
          <span>
            <b class="num" data-metric="reconciliation_net_usd" data-value={h().reconciliation_net_usd}>
              {usd2(h().reconciliation_net_usd ?? 0)}
            </b>
            <small>{pct(h().reconciliation_share_of_net ?? 0)} of the net</small>
          </span>
        </div>
        <ul class="growth__years">
          <For each={byYear()}>
            {(r) => (
              <li>
                <span class="num">{r.year}</span>
                <span class="growth__mini">
                  <i style={{ width: pct(r.share) }} />
                </span>
                <span class="num">{pct(r.share)}</span>
              </li>
            )}
          </For>
        </ul>
        <p class="cliff__cap">
          <code>trigger_context = 'reconciliation'</code> appears on upgrades and downgrades{" "}
          <b>only</b> - never on a signup, churn or retention event, which all nine other
          values do. No marketing channel behaves that way. Stated as indicative, not proven.
        </p>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// ⑨  What moves listening
// =========================================================================================

export function AxisPanel(props: {
  axes: Axis[];
  flags: Flag[];
  dow: any[];
  headline: Record<string, number>;
  onFilter?: (field: string, value: string | number) => void;
  active?: (field: string, value: string | number) => boolean;
}) {
  const max = () => Math.max(...props.axes.map((a) => a.eta_squared), 0.05);
  const h = () => props.headline;
  const algo = () =>
    props.flags.find((f) => f.flag === "is_algorithmic_recommendation");

  return (
    <ChartFigure
      id="axis-panel"
      caption="What moves listening, and what everyone slices by instead - five of the brief's seven segment axes are below the small-effect floor."
      /* prose-number-ok: I10 - 0.01 is Cohen's published threshold, not a measurement. */
      columns={["Axis", "Effect size (eta squared)", "Clears Cohen's 0.01 floor?"]}
      rows={props.axes.map((a) => [a.axis, a.eta_squared.toFixed(5), a.clears_cohen_floor ? "yes" : "no"])}
    >
      <ul class="axes">
        <For each={props.axes}>
          {(a) => (
            <li classList={{ "axes--real": a.clears_cohen_floor }}>
              <span class="axes__name">{a.axis}</span>
              <span class="axes__track">
                <i class="axes__fill" style={{ width: `${(100 * a.eta_squared) / max()}%` }} />
                <i class="axes__floor" style={{ left: `${(100 * 0.01) / max()}%` }} />
              </span>
              <b class="num" data-metric={`axis.${a.axis}.eta_squared`} data-value={a.eta_squared}>
                {a.eta_squared.toFixed(4)}
              </b>
              <span class="axes__verdict">{a.clears_cohen_floor ? "REAL" : "noise"}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="axes__floorcap">
        {/* prose-number-ok: I10 - 0.01 is Cohen's published threshold and 224,078 is the
            row count, tagged as `sessions` in the provenance strip. */}
        The vertical rule is Cohen's floor for a <em>small</em> effect, η² = 0.01. Every {/* prose-number-ok: I10 */}
        p-value on this chart is significant at n = 224,078 {/* prose-number-ok: I10 - n is `sessions` in the provenance strip */} - country's is 1.1e-28 while
        explaining {pctRaw(100 * (props.axes.find((a) => a.axis === "Country")?.eta_squared ?? 0), 2)}{" "}
        of the variance. That is why effect size decides here and p does not.
      </p>
      <div class="axes__extras">
        <p>
          {/* prose-number-ok: I8 - 43% is 3/7 of the calendar, arithmetic not measurement;
               the weekend share itself is tagged as data-metric below. */}
          <b>The real cycle is weekly.</b> Fri-Sun take{" "}
          <b class="num" data-metric="weekend_share" data-value={h().weekend_share}>
            {pct(h().weekend_share ?? 0)}
          </b>{" "}
          of plays on 43% of the days. {/* prose-number-ok: I8 */}{" "}
          <For each={props.dow}>
            {(d) => (
              <button
                type="button"
                class="dowchip"
                classList={{
                  "dowchip--hi": d.dow_num >= 5,
                  "dowchip--on": props.active?.("dow_num", d.dow_num),
                }}
                aria-pressed={props.active?.("dow_num", d.dow_num) ?? false}
                onClick={() => props.onFilter?.("dow_num", d.dow_num)}
                data-metric={`dow.${d.session_weekday}.share`}
                data-value={d.share_of_sessions}
              >
                {DOW[d.dow_num]} {pct(d.share_of_sessions, 1)}
              </button>
            )}
          </For>
        </p>
        <p>
          <b>There is no month-of-year season.</b> After fitting the{" "}
          <b class="num">{pctRaw(100 * (h().monthly_growth_rate ?? 0), 2)}</b>/month growth
          curve (R² {(h().growth_r_squared ?? 0).toFixed(3)}), month-of-year on the residuals
          gives ω² = <b class="num">{signed(h().season_omega_squared ?? 0, 3)}</b> at
          p = <b class="num">{(h().season_kruskal_p ?? 0).toFixed(2)}</b>. The apparent
          December peak is the ramp.
        </p>
        <p>
          {/* prose-number-ok: I10 - the flagged share of the catalogue; the effect size
               itself is tagged as algo_cliffs_delta immediately after. */}
          <b><code>is_algorithmic_recommendation</code> does nothing.</b> 53.2% of the {/* prose-number-ok: I10 */}
          catalogue carries it; Cliff's d ={" "}
          <b class="num" data-metric="algo_cliffs_delta" data-value={h().algo_cliffs_delta}>
            {signed(h().algo_cliffs_delta ?? 0)}
          </b>{" "}
          on listen duration, p = {(algo()?.mannwhitney_p ?? 0).toFixed(2)}.
        </p>
      </div>
    </ChartFigure>
  );
}

// =========================================================================================
// web-only panels
// =========================================================================================

export function OverIndex(props: {
  genreCountry: any[];
  onFilter?: (field: string, value: string | number) => void;
  active?: (field: string, value: string | number) => boolean;
}) {
  const genres = createMemo(() => [...new Set(props.genreCountry.map((r) => r.genre_name))].sort());
  const countries = createMemo(() =>
    [...new Set(props.genreCountry.map((r) => r.country_name))].sort()
  );
  const look = createMemo(() => {
    const m = new Map<string, any>();
    for (const r of props.genreCountry) m.set(`${r.genre_name}|${r.country_name}`, r);
    return m;
  });

  return (
    <ChartFigure
      id="over-index"
      /* prose-number-ok: I12 - the first row of the fact_genre_country table this panel
         renders in full immediately below. */
      caption="Reggae in South Africa over-indexes 2.28× - the one cross-dimensional interaction that survives."
      columns={["Genre", "Country", "Plays", "Over-index"]}
      rows={props.genreCountry
        .slice()
        .sort((a, b) => b.over_index - a.over_index)
        .slice(0, 20)
        .map((r) => [r.genre_name, r.country_name, int(r.sessions), r.over_index.toFixed(2) + "×"])}
    >
      <div class="matrix-wrap" tabindex="0" role="region"
           aria-label="Genre by country over-index matrix, scrollable">
        <table class="matrix">
          <caption class="sr-only">Genre by country over-index</caption>
          <thead>
            <tr>
              <th scope="col">Genre</th>
              <For each={countries()}>{(c) => <th scope="col">{c.slice(0, 3)}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={genres()}>
              {(g) => (
                <tr>
                  <th scope="row">{g}</th>
                  <For each={countries()}>
                    {(c) => {
                      const r = () => look().get(`${g}|${c}`);
                      const oi = () => r()?.over_index ?? 1;
                      return (
                        <td classList={{ "matrix--hi": oi() >= 1.5, "matrix--lo": oi() <= 0.7 }}>
                          <button
                            type="button"
                            class="matrix__cell"
                            aria-pressed={props.active?.("genre_name", g) ?? false}
                            onClick={() => props.onFilter?.("genre_name", g)}
                            title={`${g} x ${c}: ${int(r()?.sessions ?? 0)} plays, ${oi().toFixed(2)}x. Click to filter the page to ${g}.`}
                          >
                            {oi().toFixed(2)}
                          </button>
                        </td>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="cliff__cap">
        {/* prose-number-ok: I12 - Cramér's V for the genre x country table. */}
        Share within the cell ÷ share expected from the margins. Cramér's V = 0.0925, and the {/* prose-number-ok: I12 */}
        smallest cell holds 585 plays - no thin cells, so no over-index here is manufactured
        by a small denominator.
      </p>
    </ChartFigure>
  );
}

export function ChurnPanel(props: { churn: any[]; postChurn: any[] }) {
  const order = ["0-14d", "15-30d", "31-60d", "61-90d", "91-180d", "181d+"];
  const rows = createMemo(() =>
    order.map((w) => props.churn.find((c) => c.window_label === w)).filter(Boolean)
  );
  const maxSec = () => Math.max(...rows().map((r: any) => r.mean_listen_seconds), 1);

  return (
    <ChartFigure
      id="churn-panel"
      caption="The leading indicator is depth, not volume - sessions shorten in the 30 days before a cancel."
      columns={["Window before churn", "Sessions", "Mean listen seconds", "Skip rate"]}
      rows={rows().map((r: any) => [
        r.window_label, int(r.sessions), r.mean_listen_seconds.toFixed(1), pct(r.skip_rate),
      ])}
    >
      <ul class="churn">
        <For each={rows()}>
          {(r: any) => (
            <li>
              <span class="churn__w">{r.window_label}</span>
              <span class="churn__track">
                <i style={{ width: `${(100 * r.mean_listen_seconds) / maxSec()}%` }}
                   classList={{ "churn__near": r.window_label === "0-14d" || r.window_label === "15-30d" }} />
              </span>
              <b class="num">{secsFmt(r.mean_listen_seconds)}</b>
            </li>
          )}
        </For>
      </ul>
      <p class="cliff__cap">
        And churn is not an exit:{" "}
        <For each={props.postChurn}>
          {(p) => <span class="dowchip">{p.next_event} {int(p.events)}</span>}
        </For>{" "}
        - 560 of 635 churn events are followed by another, 355 by an upgrade. Churned
        listeners run <em>more</em> sessions than never-churned (265 vs 205) but{" "}
        <em>shorter</em> ones. A volume-based health score points the wrong way here.
      </p>
    </ChartFigure>
  );
}

export function DefectLedger(props: { defects: Defect[]; headline: Record<string, number> }) {
  return (
    <ChartFigure
      id="defect-ledger"
      caption="The archive's data dictionary is true in 68 of 72 tested claims. Here are the four that are not, and three it does not mention."
      columns={["#", "Kind", "Column", "Documented", "Actual", "Rows affected"]}
      rows={props.defects.map((d) => [
        d.n, d.kind, d.column, d.documented, d.actual, int(d.rows_affected),
      ])}
    >
      <div class="ledger-wrap" tabindex="0" role="region"
           aria-label="Data dictionary defect ledger, scrollable">
        <table class="ledger">
          <caption class="sr-only">Defect ledger</caption>
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Column</th>
              <th scope="col">Documented</th><th scope="col">Actual</th>
              <th scope="col">Rows</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.defects}>
              {(d) => (
                <tr classList={{ "ledger--undoc": d.kind === "undocumented" }}>
                  <th scope="row" class="num">{d.n}</th>
                  <td><code>{d.column}</code></td>
                  <td>{d.documented}</td>
                  <td>{d.actual}</td>
                  <td class="num">{int(d.rows_affected)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="cliff__cap">
        Rows 1-4 are claims the dictionary makes that the file breaks; rows 5-7 are defects it
        does not mention. This is the first month in this programme whose shipped documentation
        was mostly <em>true</em> - {props.headline.dictionary_claims_held} of{" "}
        {props.headline.dictionary_claims_tested} claims hold - which is why this month is an
        analysis rather than an audit.
      </p>
    </ChartFigure>
  );
}
