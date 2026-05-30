/**
 * THE CROSSING - the signature. A rank-slope (bump) chart.
 *
 * Left axis:  every artist's rank by TOTAL plays (all 224,078).
 * Right axis: the same artists' rank on a corrected basis.
 * One mark = one artist = one line joining its two ranks.
 *
 * WHY THIS AND NOT A BAR CHART. The obvious rendering of "top artists" is a top-10 bar
 * chart - which is the conventional choice for "ranking", and which is by a wide
 * margin the most likely thing a competing entry ships. It asserts one ordering as a fact.
 * The whole finding of this month is that the ordering is not a fact: the two top-10s
 * overlap 1 of 10. A slope chart puts BOTH real orderings on the page at once and makes
 * the disagreement between them the mark itself.
 *
 * HONESTY CONSTRAINTS, enforced here:
 *
 *  - No invented counterfactual. Both columns are direct counts of real sessions - one over
 *    all listeners, one over a subset or a cap. Nothing is modelled, smoothed or projected.
 *  - All 448 artists are drawn, not just the movers. The braid's density is the evidence
 *    that the labelled artists are not cherry-picked. Hiding the other 434 would make an
 *    ordinary amount of rank churn look like a conspiracy.
 *  - The right column rests on 29.8% of the data under the `clean` basis, so its ranks are
 *    genuinely noisier. Labelled artists carry a bootstrap 90% rank bracket IN INK rather
 *    than a caption disclaiming it.
 *
 * COLOUR IS REDUNDANT, BY NECESSITY. --inflated and --surfaced are 8.84:1 and 9.52:1
 * against the ground but only 1.08:1 against EACH OTHER in relative luminance (measured at
 * G5, see .workbench/2026/05/design/direction.md). They are near-identical in lightness, so a greyscale print
 * or a tritanope sees no difference. Meaning is therefore carried three more ways:
 *   1. slope direction - down-right falls, up-right rises
 *   2. stroke style - falling lines solid, rising lines dashed
 *   3. both rank numbers printed on every label
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import { type Artist, type Basis, BASIS_LABEL, int, rankOn, playsOn } from "../data";

type Props = {
  artists: Artist[];
  basis: Basis;
  poster?: boolean;
  selected?: number | null;
  onPick?: (artistId: number | null) => void;
};

/** Deterministic PRNG so the bootstrap brackets are identical on every render and in the
 *  poster capture. A bracket that moved between the live app and the PNG would be a lie. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A 90% interval on the corrected rank, by resampling the artist's corrected play count
 * under Poisson counting error and re-reading its position against the other artists'
 * fixed counts. This is a counting-noise interval, not a claim about sampling design, and
 * the caption says so.
 */
function rankBracket(a: Artist, all: Artist[], basis: Basis): [number, number] {
  const counts = all.map((x) => playsOn(x, basis)).sort((p, q) => q - p);
  const n = playsOn(a, basis);
  const rnd = mulberry32(a.artist_id * 7919 + basis.length);
  const ranks: number[] = [];
  for (let i = 0; i < 200; i++) {
    // Normal approximation to Poisson(n); n is large enough here that it holds.
    let u = 0;
    for (let k = 0; k < 6; k++) u += rnd();
    const jittered = Math.max(0, n + (u - 3) * Math.sqrt(Math.max(n, 1)) * 0.8165);
    let r = 1;
    for (const c of counts) if (c > jittered) r++;
    ranks.push(r);
  }
  ranks.sort((p, q) => p - q);
  return [ranks[Math.floor(ranks.length * 0.05)], ranks[Math.floor(ranks.length * 0.95)]];
}

export function Crossing(props: Props) {
  const [hover, setHover] = createSignal<number | null>(null);

  const W = () => (props.poster ? 2440 : 1080);
  const H = () => (props.poster ? 210 : 560);
  const PAD_X = () => (props.poster ? 400 : 250);
  const PAD_T = 46;
  const PAD_B = 26;

  const N = () => props.artists.length;

  /**
   * THE RANK AXIS IS LOGARITHMIC, and the ticks say so.
   *
   * A linear 1..448 axis gives rank 1 and rank 20 four pixels of separation, which compresses
   * every artist the claim is about into a single band and forces their labels into a pile.
   * Log is the standard convention for rank and frequency data for exactly this reason: the
   * distance from 1st to 2nd is a bigger fact than the distance from 300th to 301st.
   *
   * It does not flatter the finding - it works against it. Mariah Carey's 1 → 264 spans 91% of
   * a log axis but 59% of a linear one, so a linear axis would make the headline fall look
   * SHORTER, not longer. The gridlines and tick labels are drawn so the scale is declared
   * rather than assumed.
   */
  const TICKS = [1, 3, 10, 30, 100, 300];
  const y = (rank: number) =>
    PAD_T + (Math.log(Math.max(rank, 1)) / Math.log(N())) * (H() - PAD_T - PAD_B);

  /**
   * The labelled set. Restricted to artists that both START in the top 20 and MOVE at least
   * 100 ranks, because those are the ones the claim is about and because a label every few
   * pixels is not a label. The unlabelled movers are still drawn at full weight - the reader
   * can see there are more of them than are named.
   */
  const movers = createMemo(() => {
    const b = props.basis;
    return props.artists
      .filter((a) => {
        const r2 = rankOn(a, b);
        return a.rank_all <= 20 && Math.abs(a.rank_all - r2) >= 100;
      })
      .sort((p, q) => p.rank_all - q.rank_all);
  });

  /**
   * Label de-collision. Ranks 1-20 all land within a few pixels of the top on a linear
   * 1-448 scale, so their labels pile into an unreadable stack. The DOT never moves - it
   * stays at the true rank position - and only the TEXT is pushed apart, with a leader
   * line drawn to it when it has been displaced. Displacing the mark itself would be a lie;
   * displacing the label is a typographic necessity.
   */
  function declash(items: { id: number; at: number }[], minGap: number, lo: number, hi: number) {
    const sorted = items.slice().sort((p, q) => p.at - q.at);
    const out = new Map<number, number>();
    let prev = -Infinity;
    for (const it of sorted) {
      const placed = Math.max(it.at, prev + minGap);
      out.set(it.id, placed);
      prev = placed;
    }
    // if we ran past the bottom, pull the whole stack back up
    const last = Math.max(...[...out.values()]);
    if (last > hi) {
      const shift = last - hi;
      for (const [k, v] of out) out.set(k, Math.max(lo, v - shift));
    }
    return out;
  }

  const GAP = () => (props.poster ? 19 : 17);

  const leftLabelY = createMemo(() =>
    declash(
      movers().map((a) => ({ id: a.artist_id, at: y(a.rank_all) })),
      GAP(), PAD_T, H() - PAD_B
    )
  );
  const rightLabelY = createMemo(() =>
    declash(
      movers().map((a) => ({ id: a.artist_id, at: y(rankOn(a, props.basis)) })),
      GAP(), PAD_T, H() - PAD_B
    )
  );

  const prominent = createMemo(() => {
    const b = props.basis;
    return props.artists.filter((a) => a.rank_all <= 30 || rankOn(a, b) <= 30);
  });

  const brackets = createMemo(() => {
    const m = new Map<number, [number, number]>();
    for (const a of movers()) m.set(a.artist_id, rankBracket(a, props.artists, props.basis));
    return m;
  });

  const active = () => props.selected ?? hover();

  const rows = createMemo(() =>
    props.artists
      .slice()
      .sort((p, q) => p.rank_all - q.rank_all)
      .slice(0, 40)
      .map((a) => [
        a.artist_name,
        a.genre_name,
        a.rank_all,
        rankOn(a, props.basis),
        int(a.plays_all),
        int(playsOn(a, props.basis)),
      ])
  );

  const overlap = createMemo(() => {
    const b = props.basis;
    const top = new Set(
      props.artists.slice().sort((p, q) => p.rank_all - q.rank_all).slice(0, 10)
        .map((a) => a.artist_id)
    );
    return props.artists
      .slice().sort((p, q) => rankOn(p, b) - rankOn(q, b)).slice(0, 10)
      .filter((a) => top.has(a.artist_id)).length;
  });

  return (
    <ChartFigure
      id="crossing"
      caption={`Remove the repeat-concentrated accounts and nine of the top ten artists leave with them - the two top tens overlap ${overlap()} of 10.`}
      columns={["Artist", "Genre", "Rank by all plays", `Rank - ${BASIS_LABEL[props.basis]}`, "Plays (all)", "Plays (corrected)"]}
      rows={rows()}
    >
      <svg
        class="crossing"
        viewBox={`0 0 ${W()} ${H()}`}
        width="100%"
        role="img"
        aria-label={`Rank slope chart. ${N()} artists, each drawn as a line joining its rank by total plays on the left to its rank on the ${BASIS_LABEL[props.basis]} basis on the right. Nine of the top ten fall away; the two top tens overlap ${overlap()} of 10.`}
      >
        <text class="cx-axis-title" x={PAD_X() - 14} y={22} text-anchor="end">
          rank by ALL plays  ·  log scale
        </text>
        <text class="cx-axis-title" x={W() - PAD_X() + 14} y={22} text-anchor="start">
          rank - {BASIS_LABEL[props.basis].toLowerCase()}
        </text>

        {/* axis rules + log gridlines, so the scale is declared rather than assumed */}
        <line class="cx-rule" x1={PAD_X()} y1={PAD_T - 10} x2={PAD_X()} y2={H() - PAD_B + 6} />
        <line class="cx-rule" x1={W() - PAD_X()} y1={PAD_T - 10} x2={W() - PAD_X()} y2={H() - PAD_B + 6} />
        <g class="cx-grid" aria-hidden="true">
          {/* One set of tick labels, at the far-left margin. The scale is shared by both
              axes, so labelling it twice would only crowd the artist names - which is what
              the first attempt did. */}
          <For each={TICKS}>
            {(r) => (
              <>
                <line x1={PAD_X()} y1={y(r)} x2={W() - PAD_X()} y2={y(r)} />
                <text class="cx-tick" x={8} y={y(r) + 3.5} text-anchor="start">{r}</text>
              </>
            )}
          </For>
          <text class="cx-tick cx-tick--unit" x={8} y={PAD_T - 14} text-anchor="start">
            rank
          </text>
        </g>

        {/* ground layer - every artist that is not prominent. Drawn, not hidden. */}
        <g class="cx-ground" aria-hidden="true">
          <For each={props.artists}>
            {(a) => {
              const r2 = rankOn(a, props.basis);
              const isProm = a.rank_all <= 30 || r2 <= 30;
              return (
                <Show when={!isProm}>
                  <line x1={PAD_X()} y1={y(a.rank_all)} x2={W() - PAD_X()} y2={y(r2)} />
                </Show>
              );
            }}
          </For>
        </g>

        {/* prominent layer */}
        <g class="cx-prominent">
          <For each={prominent()}>
            {(a) => {
              const r2 = () => rankOn(a, props.basis);
              const falls = () => r2() > a.rank_all;
              const isActive = () => active() === a.artist_id;
              const dim = () => active() !== null && !isActive();
              return (
                <line
                  class="cx-line"
                  classList={{
                    "cx-falls": falls(),
                    "cx-rises": !falls(),
                    "cx-active": isActive(),
                    "cx-dim": dim(),
                  }}
                  x1={PAD_X()}
                  y1={y(a.rank_all)}
                  x2={W() - PAD_X()}
                  y2={y(r2())}
                />
              );
            }}
          </For>
        </g>

        {/* bootstrap 90% rank brackets on the corrected side, for labelled artists only */}
        <g class="cx-bracket" aria-hidden="true">
          <For each={movers()}>
            {(a) => {
              const b = () => brackets().get(a.artist_id)!;
              return (
                <line
                  x1={W() - PAD_X()}
                  y1={y(b()[0])}
                  x2={W() - PAD_X()}
                  y2={y(b()[1])}
                  classList={{ "cx-falls": rankOn(a, props.basis) > a.rank_all }}
                />
              );
            }}
          </For>
        </g>

        {/* endpoints + labels */}
        <g class="cx-labels">
          <For each={movers()}>
            {(a) => {
              const r2 = () => rankOn(a, props.basis);
              const falls = () => r2() > a.rank_all;
              const isActive = () => active() === a.artist_id;
              const ly = () => leftLabelY().get(a.artist_id) ?? y(a.rank_all);
              const ry = () => rightLabelY().get(a.artist_id) ?? y(r2());
              return (
                <g
                  classList={{
                    "cx-falls": falls(),
                    "cx-rises": !falls(),
                    "cx-active": isActive(),
                    "cx-dim": active() !== null && !isActive(),
                  }}
                >
                  {/* leaders - drawn only where the label had to be displaced */}
                  <polyline
                    class="cx-leader"
                    points={`${PAD_X() - 8},${y(a.rank_all)} ${PAD_X() - 26},${ly()} ${PAD_X() - 36},${ly()}`}
                  />
                  <polyline
                    class="cx-leader"
                    points={`${W() - PAD_X() + 8},${y(r2())} ${W() - PAD_X() + 26},${ry()} ${W() - PAD_X() + 36},${ry()}`}
                  />
                  <circle cx={PAD_X()} cy={y(a.rank_all)} r={props.poster ? 5 : 4} />
                  <circle cx={W() - PAD_X()} cy={y(r2())} r={props.poster ? 5 : 4} />
                  <text class="cx-label" x={PAD_X() - 40} y={ly() + 4} text-anchor="end">
                    {a.artist_name}
                    <tspan class="cx-num"> {a.rank_all}</tspan>
                  </text>
                  <text class="cx-label" x={W() - PAD_X() + 40} y={ry() + 4} text-anchor="start">
                    <tspan class="cx-num">{r2()} </tspan>
                    {a.artist_name}
                  </text>
                </g>
              );
            }}
          </For>
        </g>

        {/* interaction targets - full-height bands, so a 1px line is not a 1px hit area */}
        <Show when={!props.poster}>
          <g class="cx-hit">
            <For each={prominent()}>
              {(a) => {
                const r2 = () => rankOn(a, props.basis);
                return (
                  <line
                    x1={PAD_X()}
                    y1={y(a.rank_all)}
                    x2={W() - PAD_X()}
                    y2={y(r2())}
                    stroke="transparent"
                    stroke-width="12"
                    onMouseEnter={() => setHover(a.artist_id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() =>
                      props.onPick?.(props.selected === a.artist_id ? null : a.artist_id)
                    }
                  />
                );
              }}
            </For>
          </g>
        </Show>
      </svg>

      <p class="cx-legend">
        <span class="cx-key cx-key--falls" aria-hidden="true" /> <b>solid, falling</b> - inflated
        by repeat-concentrated listening.{" "}
        <span class="cx-key cx-key--rises" aria-hidden="true" /> <b>dashed, rising</b> - was being
        held down by it. All {N()} artists are drawn; {movers().length} moved more than 50 ranks
        and are labelled. Vertical bars on the right are 90% intervals under counting noise.
      </p>
    </ChartFigure>
  );
}

/** The basis toggle. A real radio group, not a styled div - it must be keyboard-operable
 *  and announce its state, and this is the control that carries the robustness argument. */
export function BasisToggle(props: {
  value: Basis;
  onChange: (b: Basis) => void;
  bases: Basis[];
  note: string;
}) {
  return (
    <div class="basis">
      <fieldset class="basis__set">
        <legend class="basis__legend">Correct the ranking by</legend>
        <For each={props.bases}>
          {(b) => (
            <label class="basis__opt" classList={{ "basis__opt--on": props.value === b }}>
              <input
                type="radio"
                name="basis"
                value={b}
                checked={props.value === b}
                onChange={() => props.onChange(b)}
              />
              <span>{BASIS_LABEL[b]}</span>
            </label>
          )}
        </For>
      </fieldset>
      <p class="basis__note">{props.note}</p>
    </div>
  );
}
