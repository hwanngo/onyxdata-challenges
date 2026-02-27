/**
 * THE BLISTER PACK - the signature.  (.workbench/2026/02/design/direction.md)
 *
 * 120 pharmacies as 120 cells in a pill-card grid, 20 x 6. Two states:
 *
 *   margin  - how profitably each shop trades. A flat field.
 *   volume  - how much each shop sells. Not a flat field.
 *
 * Same shops, same grid, two questions. The reader does the comparison.
 *
 * FIVE HONESTY CONSTRAINTS, each one a way this chart could lie:
 *
 *   1. FIXED DOMAIN. The margin state is drawn on 24-34%, from the model, never auto-fitted.
 *      Auto-fitting a 4.61pp spread across the full ramp would manufacture visible variation
 *      out of noise and invert the finding. GRID_DOMAIN comes from meta, not from the data.
 *   2. NEVER SORTED. Cells sit in pharmacy_key order, which is arbitrary with respect to both
 *      measures. Sorting either state would create a gradient that is not there.
 *   3. THIN CELLS ARE STIPPLED. PH0115 has 16 sales lines and a 24.73% rate, which on a fixed
 *      domain is the one visibly different cell in the flat state. It is noise, so it is drawn
 *      hatched and excluded from nothing - the reader can see both the value and its weakness.
 *   4. VOLUME IS PER TRADING DAY. Eleven shops opened mid-window; raw revenue would draw them
 *      as weak rather than young.
 *   5. FILL PROPORTION, NOT HUE - AND NOTHING ELSE. Both states encode by how full the pill
 *      is, so they survive greyscale and all three CVD simulations. An earlier draft also
 *      modulated opacity with the value; that was a redundant second channel encoding the
 *      same number, and at the faint end it put the fill at ~1.8:1 against the card, below
 *      the 3:1 floor for meaningful non-text content. One channel, at full strength.
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { GRID_DOMAIN, type Cell, dec, eur0, int, pct } from "../data";

const COLS_WIDE = 20;
const COLS_NARROW = 10;
const CELL = 26;
const GAP = 5;
const RADIUS = 7;
/** Below this many sales lines a rate is not worth reading. PH0115 has 16. */
export const THIN = 100;
export { COLS_WIDE, COLS_NARROW };

export type GridState = "margin" | "volume";

function frac(c: Cell, state: GridState, maxRpd: number) {
  if (state === "margin") {
    const [lo, hi] = GRID_DOMAIN;
    return Math.max(0, Math.min(1, (c.marginPct - lo) / (hi - lo)));
  }
  return maxRpd ? Math.max(0, Math.min(1, c.revPerDay / maxRpd)) : 0;
}

export function BlisterPack(props: {
  cells: Cell[];
  state: GridState;
  onPick?: (key: string) => void;
  activeKey?: string;
  /** Cell edge in px. The poster is a WIDE canvas and wants a bigger cell, not a smaller one. */
  cellSize?: number;
  /** Columns. 20 on desktop; 10 below 768px so 120 cells fit 375px without page overflow
      AND each cell keeps a usable tap target. A bare 20-col grid is 615px wide and does not
      shrink - it forced 671px of horizontal scroll at 375px, which is the responsive failure
      the same .sr-only table hid on the vertical axis. */
  cols?: number;
}) {
  const [hover, setHover] = createSignal<number | null>(null);
  const [focus, setFocus] = createSignal<number>(-1);
  const cell = () => props.cellSize ?? CELL;
  const cols = () => props.cols ?? COLS_WIDE;
  const step = () => cell() + GAP;
  const rows = () => Math.ceil(props.cells.length / cols());
  const maxRpd = createMemo(() => Math.max(...props.cells.map((c) => c.revPerDay)));
  const w = () => cols() * step() - GAP;
  const h = () => rows() * step() - GAP;

  const shown = () => {
    const i = hover() ?? (focus() >= 0 ? focus() : null);
    return i === null ? null : props.cells[i];
  };

  const label = (c: Cell) =>
    props.state === "margin"
      ? `${c.name}, ${c.region}, ${c.country}. Margin rate ${pct(c.marginPct)}${
          c.lines < THIN ? `, only ${c.lines} sales lines - too few to rank` : ""
        }${c.isNew ? ", opened mid-window" : ""}`
      : `${c.name}, ${c.region}, ${c.country}. ${eur0(c.revPerDay)} per trading day${
          c.isNew ? ", opened mid-window" : ""
        }`;

  /** Arrow keys walk the grid; Enter cross-filters. */
  const onKey = (e: KeyboardEvent) => {
    const n = props.cells.length;
    let i = focus();
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "ArrowDown") i = Math.min(n - 1, i + cols());
    else if (e.key === "ArrowUp") i = Math.max(0, i - cols());
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Enter" || e.key === " ") {
      if (i >= 0) { props.onPick?.(props.cells[i].key); e.preventDefault(); }
      return;
    } else return;
    e.preventDefault();
    setFocus(i);
  };

  return (
    <figure class="pack" aria-labelledby={`pack-${props.state}-cap`}>
      <svg
        width={w()}
        height={h()}
        viewBox={`0 0 ${w()} ${h()}`}
        role="group"
        tabindex="0"
        aria-label={
          props.state === "margin"
            ? `Margin rate for each of ${props.cells.length} pharmacies, drawn on a fixed 24 to 34 percent scale. Use arrow keys to move between shops, Enter to filter the report.`
            : `Revenue per trading day for each of ${props.cells.length} pharmacies. Use arrow keys to move between shops, Enter to filter the report.`
        }
        onKeyDown={onKey}
        onFocus={() => focus() < 0 && setFocus(0)}
        onBlur={() => setFocus(-1)}
        class="pack__svg"
      >
        <defs>
          {/* Constraint 3: thin cells are hatched, not hidden. */}
          <pattern id="thin" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="var(--bg-raised)" />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--inert)" stroke-width="2" />
          </pattern>
        </defs>
        <For each={props.cells}>
          {(c, i) => {
            const col = () => i() % cols();
            const row = () => Math.floor(i() / cols());
            const x = () => col() * step();
            const y = () => row() * step();
            const f = () => frac(c, props.state, maxRpd());
            const fh = () => Math.max(2, f() * cell());
            const thin = () => c.lines < THIN;
            const active = () => props.activeKey === c.key;
            return (
              <g
                class="pack__cell"
                onMouseEnter={() => setHover(i())}
                onMouseLeave={() => setHover(null)}
                onClick={() => props.onPick?.(c.key)}
                aria-hidden="true"
              >
                {/* the blister well */}
                <rect
                  x={x()} y={y()} width={cell()} height={cell()} rx={RADIUS}
                  fill="var(--bg-raised)" stroke="var(--border)" stroke-width="1"
                />
                {/* the fill - constraint 5, proportion not hue */}
                <clipPath id={`clip-${props.state}-${i()}`}>
                  <rect x={x()} y={y()} width={cell()} height={cell()} rx={RADIUS} />
                </clipPath>
                <rect
                  x={x()}
                  y={y() + cell() - fh()}
                  width={cell()}
                  height={fh()}
                  clip-path={`url(#clip-${props.state}-${i()})`}
                  fill={thin() ? "url(#thin)" : props.state === "margin" ? "var(--inert)" : "var(--accent)"}
                />
                {/* constraint 4 marker: opened mid-window */}
                <Show when={c.isNew}>
                  <path
                    d={`M ${x() + cell() - 8} ${y()} L ${x() + cell()} ${y()} L ${x() + cell()} ${y() + 8} Z`}
                    fill="var(--ink)"
                  />
                </Show>
                <rect
                  x={x()} y={y()} width={cell()} height={cell()} rx={RADIUS}
                  fill="none"
                  stroke={active() || focus() === i() ? "var(--focus)" : "transparent"}
                  stroke-width="2.5"
                />
              </g>
            );
          }}
        </For>
      </svg>

      <div class="pack__read" aria-live="polite">
        <Show
          when={shown()}
          fallback={<span class="pack__hint">Hover or focus a shop. Arrow keys move, Enter filters.</span>}
        >
          {(c) => (
            <>
              <strong>{c().name}</strong>
              <span class="pack__meta">
                {c().region}, {c().country} · {c().type}
                {c().isNew ? " · opened mid-window" : ""}
              </span>
              <span class="pack__val">
                {pct(c().marginPct)} margin · {eur0(c().revPerDay)}/trading day · {int(c().lines)} lines
                {c().lines < THIN ? " - too few to rank" : ""}
              </span>
            </>
          )}
        </Show>
      </div>

      {/* Screen readers get 120 rows, not a canvas. */}
      {/* The table MUST be wrapped in a div rather than carrying .sr-only itself. A <table>
          treats width and height as MINIMUMS and expands to fit its content, so a bare
          .sr-only table does not clip: this one was 3,414px tall and added 1,500px of blank
          document below the footer. Recorded in LEARNINGS under 2025/05 and fixed in the
          kit's ChartFigure; these panels are hand-rolled and inherited the bug. */}
      <div class="sr-only">
        <table>
        <caption>
          {props.state === "margin"
            ? "Margin rate by pharmacy, fixed 24 to 34 percent scale"
            : "Revenue per trading day by pharmacy"}
        </caption>
        <thead>
          <tr><th scope="col">Pharmacy</th><th scope="col">Region</th><th scope="col">Country</th>
            <th scope="col">Margin rate %</th><th scope="col">Revenue per trading day</th>
            <th scope="col">Sales lines</th></tr>
        </thead>
        <tbody>
          <For each={props.cells}>
            {(c) => (
              <tr>
                <th scope="row">{c.name}</th>
                <td>{c.region}</td><td>{c.country}</td>
                <td>{dec(c.marginPct)}</td><td>{dec(c.revPerDay)}</td><td>{c.lines}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/** Legend. Constraint 1 is stated to the reader, not just enforced in code. */
export function PackLegend(props: { state: GridState; cells: Cell[] }) {
  const maxRpd = () => Math.max(...props.cells.map((c) => c.revPerDay));
  return (
    <div class="pack__legend">
      <Show
        when={props.state === "margin"}
        fallback={
          <>
            <span class="pack__scale">
              <span class="sw sw--v1" /><span class="sw sw--v3" /><span class="sw sw--v5" />
            </span>
            <span>€0 → {eur0(maxRpd())} per trading day</span>
          </>
        }
      >
        <span class="pack__scale">
          <span class="sw sw--i1" /><span class="sw sw--i3" /><span class="sw sw--i5" />
        </span>
        <span>
          fixed scale {GRID_DOMAIN[0]}-{GRID_DOMAIN[1]}% - <em>not</em> fitted to the data
        </span>
      </Show>
      <span class="pack__key"><span class="sw sw--thin" /> fewer than {THIN} sales lines</span>
      <span class="pack__key"><span class="sw sw--new" /> opened mid-window</span>
    </div>
  );
}
