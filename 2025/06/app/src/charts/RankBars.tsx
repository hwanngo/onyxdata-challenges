/**
 * Horizontal rank bars - used for formats, platforms and regions.
 *
 * Hand-rolled SVG so every bar is a real focusable DOM node: keyboard traversal and
 * screen-reader labelling are native rather than bolted onto a canvas.
 *
 * Values are always printed on the bar, so length is never the only encoding, and thin
 * samples carry a visible badge rather than being dropped.
 */
import { For, Show, createMemo } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { int, pct } from "../data";

export type Bar = {
  k: string;
  posts: number;
  med_views: number;
  view_share?: number;
  post_share?: number;
  thin?: boolean;
  note?: string;
};

export function RankBars(props: {
  data: Bar[];
  field: string;
  poster?: boolean;
  onDrill?: (k: string) => void;
  /** when set, the axis starts at 0 so near-identical bars LOOK near-identical */
  zeroBased?: boolean;
}) {
  const rows = createMemo(() => props.data);
  const rowH = () => (props.poster ? 54 : 34);
  const labelW = () => (props.poster ? 150 : 116);
  const W = () => (props.poster ? 720 : 470);
  const valW = () => (props.poster ? 130 : 104);
  const barMax = () => W() - labelW() - valW();
  const max = createMemo(() => Math.max(...rows().map((r) => r.med_views), 1));
  const height = () => rows().length * rowH() + 10;

  return (
    <svg
      viewBox={`0 0 ${W()} ${height()}`}
      width="100%"
      style={{ height: "auto", display: "block" }}
      role="group"
      aria-label={`Median views by ${props.field}, ranked`}
    >
      <title>Median views by {props.field}</title>
      <For each={rows()}>
        {(r, i) => {
          const y = () => i() * rowH() + rowH() / 2;
          const w = () => Math.max(2, (r.med_views / max()) * barMax());
          const active = () => isActive(props.field, r.k);
          const anyActive = () => rows().some((x) => isActive(props.field, x.k));
          return (
            <g
              class="ladder-row"
              classList={{ dimmed: anyActive() && !active() }}
              tabindex="0"
              role="button"
              aria-pressed={active()}
              data-metric={`${props.field}.${r.k}.med_views`}
              data-value={r.med_views}
              aria-label={
                `${r.k}: median ${int(r.med_views)} views from ${int(r.posts)} posts` +
                (r.view_share !== undefined ? `, ${pct(r.view_share)} of all views` : "") +
                (r.thin ? " - thin sample, not comparable" : "")
              }
              onClick={() => toggle(props.field, r.k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onDrill ? props.onDrill(r.k) : toggle(props.field, r.k);
                }
              }}
            >
              <rect x={0} y={y() - rowH() / 2} width={W()} height={rowH()} fill="transparent" />
              <text class="ladder-label" x={labelW() - 8} y={y() + 4} text-anchor="end">
                {r.k}
              </text>
              <rect
                class="bar"
                x={labelW()}
                y={y() - rowH() / 2 + 6}
                width={w()}
                height={rowH() - 14}
                fill="var(--seq-4)"
                stroke={active() ? "var(--ink)" : "none"}
                stroke-width={active() ? 2 : 0}
              />
              <text class="ladder-price num" x={labelW() + w() + 7} y={y() + 4}>
                {int(r.med_views)}
              </text>
              <Show when={r.thin}>
                <text class="annot num" x={W() - 2} y={y() + 4} text-anchor="end" fill="var(--warn)">
                  ⚑ n={r.posts}
                </text>
              </Show>
            </g>
          );
        }}
      </For>
    </svg>
  );
}

export function barsTable(data: Bar[], dim: string) {
  return {
    columns: [dim, "Posts", "Median views", "Share of views", "Share of posts"],
    rows: data.map((r) => [
      r.k + (r.thin ? " (thin sample)" : ""),
      int(r.posts),
      int(r.med_views),
      r.view_share !== undefined ? pct(r.view_share) : "-",
      r.post_share !== undefined ? pct(r.post_share) : "-",
    ]),
  };
}
