/**
 * Hand-rolled SVG charts. Every mark is a DOM node: focusable where it is interactive, labelled for
 * screen readers, and tagged with data-metric/data-value so tools/verify_metrics.py can recompute it.
 */
import { For, Show, createMemo } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import {
  DOW,
  DOW_LONG,
  fmtGbp,
  fmtGbpK,
  fmtNum,
  fmtPct,
  fmtR,
  mid,
  type Release,
  type RegionRow,
  type Store,
  type StoreAgg,
  type WeekSummary,
} from "./data";

const ticks = (lo: number, hi: number, step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
};
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Roving focus between sibling marks: arrows move, Enter/Space activate. */
function onMarkKey(e: KeyboardEvent, activate: () => void) {
  const el = e.currentTarget as SVGElement;
  const sibs = [...(el.parentElement?.querySelectorAll<SVGElement>(":scope > .mark") ?? [])];
  const i = sibs.indexOf(el);
  const go = (j: number) => sibs[Math.max(0, Math.min(sibs.length - 1, j))]?.focus();
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(i + 1); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(i - 1); }
  else if (e.key === "Home") { e.preventDefault(); go(0); }
  else if (e.key === "End") { e.preventDefault(); go(sibs.length - 1); }
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
}

// ======================================================================== Sixty Cups
export function SixtyCups(props: {
  stores: Store[];
  aggs: Map<number, StoreAgg>;
  selected: Set<number>;
  dimOthers: boolean;
  focus: number | null;
  filtered: boolean; // year filter changes the values -> selected.* ids
  medianFixed: number;
  poster: boolean;
  onPick: (id: number) => void;
}) {
  const W = 2400;
  const H = () => (props.poster ? 372 : 400);
  const left = 64;
  const right = 12;
  const top = 18;
  const bottom = 58;
  const order = createMemo(() => [...props.aggs.values()].sort((a, b) => a.fixed - b.fixed || a.id - b.id));
  const yMax = createMemo(() => Math.max(...order().map((s) => Math.max(s.rev, s.cogs + s.fixed + s.red))) * 1.04);
  const y = (v: number) => lin(0, yMax(), H() - bottom, top)(v);
  const step = () => (W - left - right) / order().length;
  const bw = () => step() * 0.72;
  const x = (i: number) => left + i * step() + (step() - bw()) / 2;
  const nameOf = createMemo(() => new Map(props.stores.map((s) => [s.id, s])));
  const splitIndex = createMemo(() => order().filter((s) => s.fixed <= props.medianFixed).length);
  const lossStore = createMemo(() => order().find((s) => s.np < 0));

  const label = (s: StoreAgg) => {
    const st = nameOf().get(s.id)!;
    return `${st.name}, ${st.region}. Average month: revenue ${fmtGbp(s.rev)}, cost of goods ${fmtGbp(s.cogs)}, rent and staffing ${fmtGbp(s.fixed)}, loyalty redemption ${fmtGbp(s.red)}, net profit ${fmtGbp(s.np)}, margin ${fmtPct(s.margin)}. Press Enter for the store's 24 months.`;
  };

  return (
    <ChartFigure
      id="fig-cups"
      caption="Sixty Cups: every store's average month, sorted by rent plus staffing. Revenue rims stay level while fixed cost rises and net profit drains."
      columns={["Store", "Region", "Revenue / month", "COGS", "Rent + staffing", "Redemption", "Net profit", "Margin"]}
      rows={order().map((s) => [nameOf().get(s.id)!.name, nameOf().get(s.id)!.region, fmtGbp(s.rev), fmtGbp(s.cogs), fmtGbp(s.fixed), fmtGbp(s.red), fmtGbp(s.np), fmtPct(s.margin)])}
    >
      <div class="cups-scroll">
        <svg viewBox={`0 0 ${W} ${H()}`} role="group" aria-label="Sixty cups chart: one column per store" style={{ "min-width": props.poster ? "0" : "980px" }}>
          <For each={ticks(0, yMax(), 20000)}>
            {(t) => (
              <g aria-hidden="true">
                <line class="grid" x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
                <text x={left - 10} y={y(t) + 6} text-anchor="end" class="t-muted t-num" font-size="17">{fmtGbpK(t, 0)}</text>
              </g>
            )}
          </For>
          {/* median split */}
          <g aria-hidden="true">
            <line x1={left + splitIndex() * step()} x2={left + splitIndex() * step()} y1={top - 6} y2={H() - bottom + 8} stroke="var(--ink-muted)" stroke-dasharray="6 6" stroke-width="2" />
          </g>
          <g>
            <For each={order()}>
              {(s, i) => {
                const dim = () => props.dimOthers && !props.selected.has(s.id);
                const base = (k: string) => mid(`cups.${s.id}.${k}`, props.filtered);
                const cogsTop = () => y(s.cogs);
                const fixedTop = () => y(s.cogs + s.fixed);
                const redTop = () => y(s.cogs + s.fixed + s.red);
                return (
                  <g
                    class="mark"
                    classList={{ "is-dim": dim(), "is-focus": props.focus === s.id }}
                    tabindex={props.poster ? undefined : i() === 0 ? 0 : -1}
                    role={props.poster ? undefined : "button"}
                    aria-label={props.poster ? undefined : label(s)}
                    onClick={() => !props.poster && props.onPick(s.id)}
                    onKeyDown={(e) => onMarkKey(e, () => props.onPick(s.id))}
                  >
                    <title>{label(s)}</title>
                    <rect class="mark__halo" x={x(i()) - 4} y={top - 4} width={bw() + 8} height={H() - bottom - top + 8} rx="6" fill="none" />
                    <rect x={x(i())} y={cogsTop()} width={bw()} height={y(0) - cogsTop()} fill="var(--cogs)" stroke="var(--revenue-ink)" stroke-width="1" data-metric={base("cogs")} data-value={s.cogs} />
                    <rect x={x(i())} y={fixedTop()} width={bw()} height={cogsTop() - fixedTop()} fill="var(--cost)" data-metric={base("fixed")} data-value={s.fixed} />
                    <rect x={x(i())} y={redTop()} width={bw()} height={Math.max(1.5, fixedTop() - redTop())} fill="var(--loyalty)" data-metric={base("red")} data-value={s.red} />
                    <Show
                      when={s.np >= 0}
                      fallback={<rect x={x(i())} y={redTop()} width={bw()} height={y(s.rev) - redTop()} fill="var(--loss)" data-metric={base("np")} data-value={s.np} />}
                    >
                      <rect x={x(i())} y={y(s.rev)} width={bw()} height={redTop() - y(s.rev)} fill="var(--ink)" data-metric={base("np")} data-value={s.np} />
                    </Show>
                    <line x1={x(i()) - 3} x2={x(i()) + bw() + 3} y1={y(s.rev)} y2={y(s.rev)} stroke="var(--revenue)" stroke-width="4" data-metric={base("rev")} data-value={s.rev} />
                  </g>
                );
              }}
            </For>
          </g>
          {/* x axis: fixed cost under every tenth cup */}
          <g aria-hidden="true">
            <line class="axis" x1={left} x2={W - right} y1={y(0)} y2={y(0)} />
            <For each={order().filter((_, i) => i % 10 === 0 || i === order().length - 1)}>
              {(s) => {
                const i = order().indexOf(s);
                return <text x={x(i) + bw() / 2} y={H() - bottom + 26} text-anchor="middle" class="t-muted t-num" font-size="17">{fmtGbpK(s.fixed, 1)}</text>;
              }}
            </For>
            <text x={left} y={H() - 6} class="t-muted" font-size="17">Rent + staffing per store-month (sorted, low → high) · dashed line = median split</text>
            <Show when={lossStore()}>
              {(ls) => {
                const i = order().indexOf(ls());
                return (
                  <text x={W - right} y={H() - 6} text-anchor="end" font-size="17" font-weight="600" fill="var(--loss)">
                    ▲ {nameOf().get(ls().id)!.name}: the only store whose costs overflow its cup (column {i + 1})
                  </text>
                );
              }}
            </Show>
          </g>
        </svg>
      </div>
    </ChartFigure>
  );
}

// ======================================================================== Region cost map
export function RegionMap(props: {
  rows: RegionRow[];
  selectedRegions: string[];
  filtered: boolean;
  poster: boolean;
  onPick: (region: string) => void;
}) {
  const W = 600;
  const rowH = () => (props.poster ? 21 : 26);
  const top = 26;
  const H = () => top + props.rows.length * rowH() + 30;
  const labelW = 150;
  const revX0 = labelW;
  const revX1 = 330;
  const fixX0 = 350;
  const fixX1 = 520;
  const revLo = () => Math.min(...props.rows.map((r) => r.rev - r.ci)) * 0.99;
  const revHi = () => Math.max(...props.rows.map((r) => r.rev + r.ci)) * 1.01;
  const fixHi = () => Math.max(...props.rows.map((r) => r.fixed)) * 1.05;
  const rx = (v: number) => lin(revLo(), revHi(), revX0 + 8, revX1)(v);
  const fx = (v: number) => lin(0, fixHi(), fixX0, fixX1)(v);
  const short = (r: string) => r.replace("Yorkshire-and-Humber", "Yorks & Humber").replace("East-of-England", "East of England").replace(/-/g, " ");
  return (
    <ChartFigure
      id="fig-region"
      caption="Regions ranked by net margin. Revenue intervals overlap for every region; fixed cost does not."
      columns={["Region", "Stores", "Revenue / store-month", "95% interval ±", "Rent + staffing / store-month", "Net margin"]}
      rows={props.rows.map((r) => [short(r.region), r.stores, fmtGbp(r.rev), fmtGbp(r.ci), fmtGbp(r.fixed), fmtPct(r.margin)])}
    >
      <svg viewBox={`0 0 ${W} ${H()}`} role="group" aria-label="Region cost map">
        <text x={revX0 + 8} y={16} font-size="14" class="t-muted">Revenue ± 95% CI</text>
        <text x={fixX0} y={16} font-size="14" fill="var(--cost)" font-weight="600">Rent + staffing</text>
        <text x={W} y={16} font-size="14" class="t-muted" text-anchor="end">Margin</text>
        <g>
          <For each={props.rows}>
            {(r, i) => {
              const yy = () => top + i() * rowH() + rowH() / 2;
              const dim = () => props.selectedRegions.length > 0 && !props.selectedRegions.includes(r.region);
              const base = (k: string) => mid(`region.${r.region}.${k}`, props.filtered);
              return (
                <g
                  class="mark"
                  classList={{ "is-dim": dim() }}
                  tabindex={props.poster ? undefined : i() === 0 ? 0 : -1}
                  role={props.poster ? undefined : "button"}
                  aria-pressed={props.poster ? undefined : props.selectedRegions.includes(r.region)}
                  aria-label={props.poster ? undefined : `${short(r.region)}: ${r.stores} stores, revenue ${fmtGbp(r.rev)} plus or minus ${fmtGbp(r.ci)}, rent and staffing ${fmtGbp(r.fixed)}, margin ${fmtPct(r.margin)}. Press Enter to filter.`}
                  onClick={() => !props.poster && props.onPick(r.region)}
                  onKeyDown={(e) => onMarkKey(e, () => props.onPick(r.region))}
                >
                  <rect class="mark__halo" x={0} y={yy() - rowH() / 2} width={W} height={rowH()} rx="4" fill="none" />
                  <text x={0} y={yy() + 6} font-size="16">{short(r.region)} <tspan class="t-muted">({r.stores})</tspan></text>
                  <line x1={rx(r.rev - r.ci)} x2={rx(r.rev + r.ci)} y1={yy()} y2={yy()} stroke="var(--revenue)" stroke-width="3" data-metric={base("ci")} data-value={r.ci} />
                  <circle cx={rx(r.rev)} cy={yy()} r="5.5" fill="var(--bg-raised)" stroke="var(--revenue-ink)" stroke-width="2.5" data-metric={base("rev")} data-value={r.rev} />
                  <rect x={fixX0} y={yy() - rowH() * 0.32} width={fx(r.fixed) - fixX0} height={rowH() * 0.64} fill="var(--cost)" rx="2" data-metric={base("fixed")} data-value={r.fixed} />
                  <text x={W} y={yy() + 6} font-size="16" text-anchor="end" class="t-num" data-metric={base("margin")} data-value={r.margin}>{fmtPct(r.margin)}</text>
                </g>
              );
            }}
          </For>
        </g>
        <g aria-hidden="true">
          <text x={revX0 + 8} y={H() - 8} font-size="13" class="t-muted t-num">{fmtGbpK(revLo(), 0)}</text>
          <text x={revX1} y={H() - 8} font-size="13" class="t-muted t-num" text-anchor="end">{fmtGbpK(revHi(), 0)}</text>
          <text x={fixX0} y={H() - 8} font-size="13" class="t-muted t-num">£0</text>
          <text x={fixX1} y={H() - 8} font-size="13" class="t-muted t-num" text-anchor="end">{fmtGbpK(fixHi(), 0)}</text>
        </g>
      </svg>
    </ChartFigure>
  );
}

// ======================================================================== Forget / remember
function MiniScatter(props: {
  id: string;
  title: string;
  xs: number[];
  ys: number[];
  ids: number[];
  metric: (id: number, axis: "x" | "y") => string;
  color: string;
  dim: (id: number) => boolean;
  rMetric: string;
  r: number;
  poster: boolean;
}) {
  const S = 270;
  const PH = 196;
  const pad = 14;
  const lo = () => Math.min(...props.xs, ...props.ys);
  const hi = () => Math.max(...props.xs, ...props.ys);
  const sc = (v: number) => lin(lo(), hi(), pad, S - 10)(v);
  const sy = (v: number) => lin(lo(), hi(), PH - 6, 10)(v);
  return (
    <svg viewBox={`0 0 ${S} ${PH + 46}`} role="img" aria-labelledby={`${props.id}-t`}>
      <title id={`${props.id}-t`}>{props.title}</title>
      <rect x={pad} y={4} width={S - 10 - pad} height={PH - 4} fill="var(--bg-sunken)" rx="4" aria-hidden="true" />
      <line x1={sc(lo())} y1={sy(lo())} x2={sc(hi())} y2={sy(hi())} stroke="var(--ink-muted)" stroke-dasharray="4 5" aria-hidden="true" />
      <For each={props.ids}>
        {(id, i) => (
          <circle
            cx={sc(props.xs[i()])}
            cy={sy(props.ys[i()])}
            r="4.2"
            fill={props.color}
            fill-opacity="0.85"
            classList={{ "is-dim": props.dim(id) }}
            data-metric={props.metric(id, "y")}
            data-value={props.ys[i()]}
          />
        )}
      </For>
      <text x={pad} y={PH + 18} font-size="14" class="t-muted">x 2023 · y 2024</text>
      <text x={S - 10} y={PH + 18} font-size="16" text-anchor="end" font-weight="700">
        r = <tspan class="t-num" data-metric={props.rMetric} data-value={props.r}>{fmtR(props.r)}</tspan>
      </text>
      <text x={pad} y={PH + 40} font-size="15">{props.title}</text>
    </svg>
  );
}

export function ForgetRemember(props: { rel: Release; selected: Set<number>; dimOthers: boolean; poster: boolean }) {
  const y = () => props.rel.yoy;
  const dim = (id: number) => props.dimOthers && !props.selected.has(id);
  return (
    <ChartFigure
      id="fig-yoy"
      caption="Each store's 2023 average against its 2024 average. Revenue scatters (no memory); net profit lines up (cost remembers)."
      columns={["Store", "Revenue 2023 / month", "Revenue 2024 / month", "Net profit 2023 / month", "Net profit 2024 / month"]}
      rows={y().map((p) => [p.id, fmtGbp(p.rev23), fmtGbp(p.rev24), fmtGbp(p.np23), fmtGbp(p.np24)])}
    >
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "10px" }}>
        <MiniScatter
          id="sc-rev" title="Revenue / store-month" xs={y().map((p) => p.rev23)} ys={y().map((p) => p.rev24)} ids={y().map((p) => p.id)}
          metric={(id) => `yoy.${id}.rev24`} color="var(--revenue-ink)" dim={dim} rMetric="yoy.r_revenue" r={props.rel.rRevYoy} poster={props.poster}
        />
        <MiniScatter
          id="sc-np" title="Net profit / store-month" xs={y().map((p) => p.np23)} ys={y().map((p) => p.np24)} ids={y().map((p) => p.id)}
          metric={(id) => `yoy.${id}.np24`} color="var(--ink)" dim={dim} rMetric="yoy.r_profit" r={props.rel.rNpYoy} poster={props.poster}
        />
      </div>
    </ChartFigure>
  );
}

// ======================================================================== Loyalty
export function LoyaltyPanel(props: { rel: Release; selected: Set<number>; dimOthers: boolean; poster: boolean }) {
  const L = () => props.rel.loyalty;
  const S = 270;
  const PH = 170;
  const pad = 14;
  const ax = () => {
    const xs = L().points.map((p) => p.adoption);
    return [Math.min(...xs) - 0.02, Math.max(...xs) + 0.02] as const;
  };
  const sx = (v: number) => lin(ax()[0], ax()[1], pad, S - 10)(v);
  const shareY = (v: number) => lin(0, 0.8, PH - 6, 10)(v);
  const revs = () => L().points.map((p) => p.rev);
  const revY = (v: number) => lin(Math.min(...revs()) * 0.97, Math.max(...revs()) * 1.03, PH - 6, 10)(v);
  const dim = (id: number) => props.dimOthers && !props.selected.has(id);
  const barMax = () => Math.max(L().upper, L().needed) * 1.08;
  return (
    <ChartFigure
      id="fig-loyalty"
      caption="Adoption sets the share of revenue booked to members almost perfectly, and does not move store revenue. Even the upper confidence bound on lift is below what the redemptions cost."
      columns={["Store", "Adoption", "Member share of revenue", "Revenue / store-month"]}
      rows={L().points.map((p) => [p.id, fmtPct(p.adoption), fmtPct(p.share), fmtGbp(p.rev)])}
    >
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "10px" }}>
        <svg viewBox={`0 0 ${S} ${PH + 46}`} role="img" aria-labelledby="loy-a-t">
          <title id="loy-a-t">Adoption vs member share of revenue</title>
          <rect x={pad} y={4} width={S - 10 - pad} height={PH - 4} fill="var(--bg-sunken)" rx="4" aria-hidden="true" />
          <For each={L().points}>
            {(p) => <circle cx={sx(p.adoption)} cy={shareY(p.share)} r="4.2" fill="var(--loyalty)" classList={{ "is-dim": dim(p.id) }} data-metric={`loyalty.${p.id}.share`} data-value={p.share} />}
          </For>
          <text x={S - 10} y={PH + 18} font-size="16" text-anchor="end" font-weight="700">r = <tspan class="t-num" data-metric="loyalty.r_share" data-value={L().rShare}>{fmtR(L().rShare, 3)}</tspan></text>
          <text x={pad} y={PH + 18} font-size="14" class="t-muted">x adoption →</text>
          <text x={pad} y={PH + 40} font-size="15">Member share of revenue</text>
        </svg>
        <svg viewBox={`0 0 ${S} ${PH + 46}`} role="img" aria-labelledby="loy-b-t">
          <title id="loy-b-t">Adoption vs revenue per store-month</title>
          <rect x={pad} y={4} width={S - 10 - pad} height={PH - 4} fill="var(--bg-sunken)" rx="4" aria-hidden="true" />
          <For each={L().points}>
            {(p) => <circle cx={sx(p.adoption)} cy={revY(p.rev)} r="4.2" fill="var(--revenue-ink)" classList={{ "is-dim": dim(p.id) }} data-metric={`loyalty.${p.id}.rev`} data-value={p.rev} />}
          </For>
          <text x={S - 10} y={PH + 18} font-size="16" text-anchor="end" font-weight="700">r = <tspan class="t-num" data-metric="loyalty.r_revenue" data-value={L().rRevenue}>{fmtR(L().rRevenue, 3)}</tspan></text>
          <text x={pad} y={PH + 18} font-size="14" class="t-muted">x adoption →</text>
          <text x={pad} y={PH + 40} font-size="15">Revenue / store-month</text>
        </svg>
      </div>
      <svg viewBox="0 0 560 74" role="img" aria-labelledby="loy-c-t" style={{ "margin-top": "6px" }}>
        <title id="loy-c-t">Most optimistic revenue lift versus revenue needed to fund redemptions</title>
        <text x="0" y="20" font-size="15">Best case (95% CI upper)</text>
        <rect x="200" y="7" height="18" width={lin(0, barMax(), 0, 280)(L().upper)} fill="var(--revenue-ink)" rx="2" />
        <text x={206 + lin(0, barMax(), 0, 280)(L().upper)} y="21" font-size="15" class="t-num" data-metric="loyalty.upper" data-value={L().upper}>{fmtGbp(L().upper)}</text>
        <text x="0" y="56" font-size="15">Needed to fund redemptions</text>
        <rect x="200" y="43" height="18" width={lin(0, barMax(), 0, 280)(L().needed)} fill="var(--loyalty)" rx="2" />
        <text x={206 + lin(0, barMax(), 0, 280)(L().needed)} y="57" font-size="15" class="t-num" data-metric="loyalty.needed" data-value={L().needed}>{fmtGbp(L().needed)}</text>
      </svg>
    </ChartFigure>
  );
}

// ======================================================================== The week
export function WeekPanel(props: { wk: WeekSummary; filtered: boolean; poster: boolean }) {
  const W = 560;
  const H = 270;
  const left = 8;
  const colW = (W - left) / 7;
  const revMax = () => Math.max(...props.wk.days.map((d) => d.rev)) * 1.12;
  const hrsMax = () => Math.max(...props.wk.days.map((d) => d.hrs)) * 1.12;
  const rh = (v: number) => lin(0, revMax(), 0, 112)(v);
  const hh = (v: number) => lin(0, hrsMax(), 0, 66)(v);
  const m = (k: string) => mid(`week.${k}`, props.filtered);
  return (
    <ChartFigure
      id="fig-week"
      caption="Mean revenue and staff hours per sampled store-day by weekday. Revenue drops at the weekend; hours do not."
      columns={["Day", "Sampled store-days", "Mean revenue", "Mean staff hours"]}
      rows={props.wk.days.map((d) => [DOW_LONG[d.d - 1], d.n, fmtGbp(d.rev), fmtNum(d.hrs, 1)])}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Revenue and staff hours by weekday">
        <text x={left} y={16} font-size="14" class="t-muted">Revenue per store-day</text>
        <text x={left} y={156} font-size="14" fill="var(--cost)" font-weight="600">Staff hours per store-day</text>
        <For each={props.wk.days}>
          {(d) => {
            const cx = left + (d.d - 1) * colW;
            const weekend = d.d >= 6;
            return (
              <g>
                <rect x={cx + 8} y={140 - rh(d.rev)} width={colW - 16} height={rh(d.rev)} fill={weekend ? "var(--revenue)" : "var(--ink)"} rx="2" data-metric={m(`${d.d}.rev`)} data-value={d.rev} />
                <text x={cx + colW / 2} y={136 - rh(d.rev)} text-anchor="middle" font-size="13" class="t-num">{fmtGbpK(d.rev, 1)}</text>
                <rect x={cx + 8} y={242 - hh(d.hrs)} width={colW - 16} height={hh(d.hrs)} fill="var(--cost)" rx="2" data-metric={m(`${d.d}.hrs`)} data-value={d.hrs} />
                <text x={cx + colW / 2} y={238 - hh(d.hrs)} text-anchor="middle" font-size="13" class="t-num">{fmtNum(d.hrs, 1)}</text>
                <text x={cx + colW / 2} y={264} text-anchor="middle" font-size="14" font-weight={weekend ? "700" : "400"}>{DOW[d.d - 1]}</text>
              </g>
            );
          }}
        </For>
      </svg>
    </ChartFigure>
  );
}
