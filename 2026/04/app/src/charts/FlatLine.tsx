/**
 * THE FLAT LINE - the signature.  (.workbench/2026/04/design/direction.md)
 *
 * A histogram of move_duration, 20 bins, 15,000 movements. It is a dead flat rectangle.
 * Over it, the same histogram computed within each of the EIGHT axes the brief names, all
 * tracing the same line.
 *
 * THREE HONESTY CONSTRAINTS, each a way this chart could lie:
 *
 *   1. FIXED DOMAIN, from the model. 0-1000 hours, never fitted to the data.
 *   2. THE REFERENCE LINE IS ARITHMETIC, NOT A FIT. n/bins - 15,000/20 = 750 - which is what
 *      a uniform predicts. No counterfactual "what real data looks like" is drawn anywhere.
 *   3. THE Y-BAND IS STATED. Starting at zero would compress the variation to invisibility
 *      and OVERSTATE the flatness; auto-fitting would manufacture drama out of Poisson noise.
 *      The band is expected ± 20% and its reason is printed on the chart.
 *   4. THE NOISE ENVELOPE IS DRAWN. Expected +/- 2 standard errors, sqrt(expected). Without
 *      it a reader cannot tell whether a bar that sits above the line means anything.
 *
 * WHAT THIS CHART USED TO DO, AND WHY IT DOESN'T:
 * the first version overlaid each cut's histogram as a LINE, rescaled to the full-sample
 * total, and the design doc claimed they would "all trace the same flat line". They do not.
 * A 2021 subset is 3,000 rows, so its per-bin standard error is 12.2 -- and rescaling by 5x
 * to make it comparable multiplies that to 61. Two standard errors is +/-124 on a 750
 * baseline, against +/-55 for the full sample. The result was spaghetti that made cuts
 * consistent with the same uniform look wildly variable: noise amplified by the very step
 * meant to make it comparable. The cuts now appear as SMALL MULTIPLES at their own n, each
 * with its own envelope, which is the resolution the claim actually lives at.
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { DURATION_DOMAIN, type Overlay, dec, int } from "../data";

/* The poster is a WIDE canvas. A width:100% SVG scales its HEIGHT with the column, so at
   2072px the web geometry renders 702px tall and the sheet overflows - the trap recorded in
   dna-kit tokens.css. The poster gets its own wider viewBox, not a scaled copy. */
const WEB = { W: 1180, H: 400 };
const POSTER = { W: 2000, H: 330 };
const P = { t: 26, r: 26, b: 54, l: 74 };
/* The y-band, as a fraction of the expected count. Stated on the chart because the choice is
 * itself a claim: zero would overstate the flatness, auto-fit would manufacture drama.
 * prose-number-ok: I2 - both headline measures are Uniform(0,1000) */
const Y_BAND = 0.2;

/* Takes `counts` and `compact` and nothing else.
 *
 * It used to declare `overlays`, `isolated` and `onIsolate` as well, left over from the G6
 * design where every cut was rescaled and drawn over the hero. That design was killed -
 * rescaling a 3,000-row cut onto the full-sample axis multiplies its per-bin standard error,
 * so cuts consistent with the same uniform looked wildly variable - and replaced by CutStrip's
 * small multiples at each cut's own n. The props survived the design by nine months, and the
 * auto-opening tour went on describing "eight thin lines drawn over the top" that this
 * component never drew. Nothing flagged it: TypeScript is happy to accept a prop you ignore.
 * Removed so the signature states what the component does. */
export function FlatLine(props: {
  counts: number[];
  compact?: boolean;
}) {
  const [focus, setFocus] = createSignal(-1);
  const [hover, setHover] = createSignal<number | null>(null);
  const bins = () => props.counts.length;
  const total = () => props.counts.reduce((a, b) => a + b, 0);
  const expected = () => total() / Math.max(1, bins());
  // Constraint 3: the band is expected ± 20%, stated on the chart.
  const lo = () => expected() * (1 - Y_BAND);
  const hi = () => expected() * (1 + Y_BAND);
  const G = () => (props.compact ? POSTER : WEB);
  const W = () => G().W, H = () => G().H;
  const iw = () => W() - P.l - P.r, ih = () => H() - P.t - P.b;
  const bw = () => iw() / Math.max(1, bins());
  const x = (b: number) => P.l + b * bw();
  const y = (v: number) => P.t + ih() - ((v - lo()) / Math.max(1e-9, hi() - lo())) * ih();
  const se = () => Math.sqrt(expected());
  const dev = (b: number) => (props.counts[b] - expected()) / Math.max(1e-9, se());

  const onKey = (e: KeyboardEvent) => {
    let i = focus();
    if (e.key === "ArrowRight") i = Math.min(bins() - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = bins() - 1;
    else return;
    e.preventDefault();
    setFocus(i);
  };

  const active = () => hover() ?? (focus() >= 0 ? focus() : null);

  return (
    <figure class="flat">
      <svg width={W()} height={H()} viewBox={`0 0 ${W()} ${H()}`} role="group" tabindex="0"
           class="flat__svg" onKeyDown={onKey}
           onFocus={() => focus() < 0 && setFocus(0)} onBlur={() => setFocus(-1)}
           aria-label={`Histogram of cargo movement duration in ${bins()} bins from ${DURATION_DOMAIN[0]} to ${DURATION_DOMAIN[1]} hours. Every bin holds close to ${int(expected())} movements. Arrow keys move between bins.`}>
        {/* the expected line - arithmetic, not a fit */}
        <line x1={P.l} x2={W() - P.r} y1={y(expected())} y2={y(expected())}
              class="flat__expected" aria-hidden="true" />
        <text x={W() - P.r} y={y(expected()) - 8} text-anchor="end" class="flat__explabel">
          {int(expected())} = {int(total())} ÷ {bins()}, what a uniform predicts
        </text>

        {/* the bars */}
        <For each={props.counts}>
          {(c, i) => (
            <g onMouseEnter={() => setHover(i())} onMouseLeave={() => setHover(null)}>
              <rect x={x(i()) + 2} y={y(c)} width={bw() - 4}
                    height={Math.max(1, P.t + ih() - y(c))}
                    class="flat__bar" classList={{ "is-on": active() === i() }} />
            </g>
          )}
        </For>

        {/* Constraint 4: the noise envelope. Expected +/- 2 SE. */}
        <rect x={P.l} y={y(expected() + 2 * se())} width={iw()}
              height={Math.max(1, y(expected() - 2 * se()) - y(expected() + 2 * se()))}
              class="flat__envelope" aria-hidden="true" />
        <text x={P.l + 8} y={y(expected() + 2 * se()) - 6} class="flat__envlabel">
          ±2 standard errors of a uniform ({dec(2 * se(), 0)})
        </text>

        {/* axes */}
        <line x1={P.l} x2={W() - P.r} y1={P.t + ih()} y2={P.t + ih()} class="flat__axis" aria-hidden="true" />
        <For each={[0, 200, 400, 600, 800, 1000]}>
          {(v) => (
            <text x={P.l + (v / DURATION_DOMAIN[1]) * iw()} y={H() - 30} text-anchor="middle"
                  class="ax">{v}</text>
          )}
        </For>
        <text x={W() / 2} y={H() - 10} text-anchor="middle" class="ax">move_duration (hours)</text>
        <text x={P.l - 10} y={y(expected()) + 4} text-anchor="end" class="ax">{int(expected())}</text>
        <text x={P.l - 10} y={P.t + 4} text-anchor="end" class="ax">{int(hi())}</text>
        <text x={P.l - 10} y={P.t + ih()} text-anchor="end" class="ax">{int(lo())}</text>
      </svg>

      <div class="flat__read" aria-live="polite">
        <Show when={active() !== null}
              fallback={<span class="flat__hint">Hover or focus a bin. Arrow keys move between bins.</span>}>
          <span class="mono">
            {DURATION_DOMAIN[1] / bins() * active()!}-{DURATION_DOMAIN[1] / bins() * (active()! + 1)}h:{" "}
            <strong>{int(props.counts[active()!])}</strong> movements · expected{" "}
            {int(expected())} · {dec(dev(active()!), 1)} standard errors
          </span>
        </Show>
      </div>

      <div class="flat__note">
        y-axis spans {int(lo())}-{int(hi())}, expected ±{Y_BAND * 100}%. Starting at zero would flatten
        this further and overstate the finding; fitting it to the data would manufacture drama
        out of counting noise.
      </div>

      {/* the table MUST be wrapped in a div - a bare .sr-only table does not clip on either
          axis (LEARNINGS: 2025/05 width, 2026/02 height) */}
      <div class="sr-only">
        <table>
          <caption>Cargo movement duration, {bins()} bins</caption>
          <thead><tr><th scope="col">Bin (hours)</th><th scope="col">Movements</th>
            <th scope="col">Expected if uniform</th><th scope="col">Deviation (SE)</th></tr></thead>
          <tbody>
            <For each={props.counts}>
              {(c, i) => (
                <tr>
                  <th scope="row">
                    {DURATION_DOMAIN[1] / bins() * i()}-{DURATION_DOMAIN[1] / bins() * (i() + 1)}
                  </th>
                  <td>{int(c)}</td><td>{int(expected())}</td><td>{dec(dev(i()), 2)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Legend. Each cut is a real toggle, not a swatch. */
export function FlatLegend(props: {
  overlays: Overlay[]; isolated?: string; onIsolate?: (k: string | undefined) => void;
}) {
  const families = () => {
    const m = new Map<string, Overlay[]>();
    for (const o of props.overlays) {
      let a = m.get(o.field);
      if (!a) { a = []; m.set(o.field, a); }
      a.push(o);
    }
    return [...m];
  };
  const LABEL: Record<string, string> = {
    hub: "Regional hub", vessel_category: "Vessel category",
    day_label: "Day label", year: "Fiscal year",
  };
  return (
    <div class="flat__legend">
      <span class="flat__legendlead">
        Overlaid, every cut the brief names - each a real histogram of that subset, rescaled to
        the full sample so the shapes compare:
      </span>
      <For each={families()}>
        {([field, os]) => (
          <span class="flat__group">
            <span class="flat__groupname">{LABEL[field] ?? field}</span>
            <For each={os}>
              {(o) => (
                <button class="flat__chip"
                        classList={{ "is-iso": props.isolated === o.key }}
                        aria-pressed={props.isolated === o.key}
                        onClick={() => props.onIsolate?.(props.isolated === o.key ? undefined : o.key)}>
                  {o.value} <span class="mono">n={int(o.n)}</span>
                </button>
              )}
            </For>
          </span>
        )}
      </For>
    </div>
  );
}

/**
 * THE CUTS, AS SMALL MULTIPLES.
 *
 * Each cut drawn at ITS OWN n with ITS OWN +/-2 SE envelope, rather than rescaled onto the
 * full-sample axis. That is the honest resolution for this claim: a 3,000-row year cannot be
 * compared to a 15,000-row whole on one axis without multiplying its noise fivefold.
 *
 * Each panel is deliberately small. At this size the eye reads TEXTURE - is this flat or is
 * it a shape - which is exactly the question, and it cannot read a 40-unit wiggle as a trend.
 */
export function CutStrip(props: { overlays: Overlay[]; isolated?: string;
                                  onIsolate?: (k: string | undefined) => void }) {
  const w = 128, h = 46;
  const LABEL: Record<string, string> = {
    hub: "Regional hub", vessel_category: "Vessel category",
    day_label: "Day label", year: "Fiscal year",
  };
  const families = () => {
    const m = new Map<string, Overlay[]>();
    for (const o of props.overlays) {
      let a = m.get(o.field);
      if (!a) { a = []; m.set(o.field, a); }
      a.push(o);
    }
    return [...m];
  };
  return (
    <div class="strip">
      <p class="strip__lead">
        The same histogram inside every cut the brief names - each at its own sample size, with
        its own ±2 standard-error band. Not one of them is a different shape.
      </p>
      <For each={families()}>
        {([field, os]) => (
          <div class="strip__fam">
            <span class="strip__famname">{LABEL[field] ?? field}</span>
            <div class="strip__row">
              <For each={os}>
                {(o) => {
                  // Each panel uses its OWN expected count and its OWN standard error.
                  const exp = () => o.nRaw / o.counts.length;
                  const se = () => Math.sqrt(exp());
                  const lo = () => exp() - 3.2 * se();
                  const hi = () => exp() + 3.2 * se();
                  const bw2 = w / o.counts.length;
                  const yy = (v: number) =>
                    h - ((v - lo()) / Math.max(1e-9, hi() - lo())) * h;
                  return (
                    <button class="strip__cell"
                            classList={{ "is-iso": props.isolated === o.key }}
                            aria-pressed={props.isolated === o.key}
                            onClick={() => props.onIsolate?.(
                              props.isolated === o.key ? undefined : o.key)}
                            aria-label={`${o.value}, ${int(o.nRaw)} movements. Distribution across ${o.counts.length} duration bins.`}>
                      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
                        <rect x="0" y={yy(exp() + 2 * se())} width={w}
                              height={Math.max(1, yy(exp() - 2 * se()) - yy(exp() + 2 * se()))}
                              class="strip__env" />
                        <line x1="0" x2={w} y1={yy(exp())} y2={yy(exp())} class="strip__exp" />
                        <For each={o.rawCounts}>
                          {(c, i) => (
                            <rect x={i() * bw2 + 0.5} y={yy(c)} width={bw2 - 1}
                                  height={Math.max(1, h - yy(c))} class="strip__bar" />
                          )}
                        </For>
                      </svg>
                      <span class="strip__lab">{o.value}</span>
                      <span class="strip__n mono">n={int(o.nRaw)}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
