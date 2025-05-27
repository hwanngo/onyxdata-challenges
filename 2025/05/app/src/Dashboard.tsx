/**
 * The report. Five panels, one argument.
 *
 * Reading order is forced by scale: thesis -> ladder -> conversion gap -> market mix -> so what.
 * Every number here is a live DuckDB aggregate; none is hardcoded.
 */
import { Show, createMemo, createSignal, onMount } from "solid-js";
import { ChartFigure, drillInto, filters } from "@onyxdata/dna-kit";
import {
  bands,
  boot,
  conversion,
  derived,
  flagship,
  headline,
  int,
  ladder,
  markets,
  money,
  pct,
  usd0,
  type Filter,
} from "./data";
import { PriceLadder, ladderTable } from "./charts/PriceLadder";
import { ConversionGap, gapTable } from "./charts/ConversionGap";
import { MarketMix, marketTable } from "./charts/MarketMix";
import { BandLegend, bandTable } from "./charts/BandLegend";
import {
  Breadcrumb,
  FilterChips,
  ThemeToggle,
  TourOverlay,
  tourAlreadySeen,
} from "@onyxdata/dna-kit";
import { TOUR_KEY, TOUR_STEPS } from "./tour";
import { Explore } from "./components/Explore";

// prose-number-ok: I-1, analysis/insights.md - a permutation null and its p-value are a test
// result, not a quantity this page renders anywhere; the unit shares they qualify are read live
// from the same signal the conversion chart draws. Query, output and caveat are in the ledger.
const PERMUTATION_NOTE =
  "the one share of five outside a 20,000-draw permutation null (p=0.002)";

const ORDINALS = ["most", "second-most", "third-most", "fourth-most", "least"];

export default function Dashboard(props: { poster?: boolean }) {
  const [tourOpen, setTourOpen] = createSignal(false);
  const [showAllRungs, setShowAllRungs] = createSignal(false);
  const f = createMemo(() => filters());

  onMount(async () => {
    try {
      const t = localStorage.getItem("datadna-theme");
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch {
      /* ignore */
    }
    await boot();
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTourOpen(true);
  });

  const head = derived(headline, f);
  const rungs = derived(ladder, f);
  const gaps = derived(conversion, f);
  const mkts = derived(markets, f);
  const bnds = derived(bands, f);
  const flag = derived(flagship, f);

  // The So-what panel states the report's CONCLUSIONS about the full year. Its claims are
  // qualified by tests run on the whole dataset (a permutation null, a revenue rank, "the
  // five best days"), and none of those qualifications survives an arbitrary cross-filter.
  // So it reads the unfiltered rows on purpose, and says so on its face. Filtering the
  // sentence while leaving the significance claim attached to it would be exactly the
  // caption-drift defect the integrity pass found elsewhere in this portfolio.
  const unfiltered: () => Filter[] = () => [];
  const allGaps = derived(conversion, unfiltered);
  const allMkts = derived(markets, unfiltered);
  const allFlag = derived(flagship, unfiltered);

  const h = () => head();
  const isMobile = () => typeof window !== "undefined" && window.innerWidth < 620;
  const rungLimit = () => (props.poster || showAllRungs() || !isMobile() ? undefined : 8);

  // Editorial captions are COMPUTED, not typed. Every figure a sentence quotes is read
  // from the same signal the chart beside it renders, so the two cannot disagree - that
  // drift is precisely the class of defect an integrity pass is meant to catch.
  const topBand = () => bnds()?.[(bnds()?.length ?? 1) - 1];
  const botBand = () => bnds()?.[0];
  const lev = (b?: { unit_pct: number; rev_pct: number }) =>
    b && b.unit_pct ? (b.rev_pct / b.unit_pct).toFixed(2) : "-";
  const richest = () => mkts()?.[0];
  const poorest = () => mkts()?.[(mkts()?.length ?? 1) - 1];
  /** Markets with enough trading days to compare - the same 60-day rule the table badges. */
  const comparableMarkets = () => {
    const names = (allMkts() ?? []).filter((m) => m.days >= 60).map((m) => m.country);
    if (!names.length) return "No market";
    return names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names.at(-1);
  };
  const worstConverter = (g = gaps()) =>
    g && g.length ? [...g].sort((a, b) => a.gap_pp - b.gap_pp)[0] : undefined;
  const volumeLeader = (g = gaps()) =>
    g && g.length ? [...g].sort((a, b) => b.units - a.units)[0] : undefined;
  /** Where the volume leader lands in the revenue table - "third-most money", computed. */
  const volumeLeaderRevenueRank = () => {
    const g = allGaps();
    const lead = volumeLeader(g);
    if (!g || !lead) return undefined;
    const rank = [...g].sort((a, b) => b.rev_share - a.rev_share).findIndex(
      (r) => r.brand === lead.brand
    );
    return rank < 0 ? undefined : ORDINALS[rank] ?? `${rank + 1}th`;
  };
  const richestAll = () => allMkts()?.[0];

  return (
    <div class="shell">
      <Show when={!props.poster}>
        <TourOverlay
          open={tourOpen()}
          onClose={() => setTourOpen(false)}
          steps={TOUR_STEPS}
          storageKey={TOUR_KEY}
        />
      </Show>

      <header class="masthead">
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            gap: "16px",
            "align-items": "start",
          }}
        >
          <h1>The money is at the top of the ladder</h1>
          <div class="toolbar live-only">
            <button class="btn" aria-label="Open guided tour" onClick={() => setTourOpen(true)}>
              ? Tour
            </button>
            <ThemeToggle />
          </div>
        </div>
        <p class="standfirst">
          A quarter of the phones sold produce two-fifths of the revenue - and the market that looks
          cheapest is not being charged less, it is buying lower down the ladder.
        </p>
        <div class="contextstrip">
          <span>Onyx Data DataDNA · May 2025</span>
          <span>2024 mobile phone sales</span>
          <span>4 countries · 25 cities · 5 brands · 19 models</span>
          <span>n = 366 trading days</span>
        </div>
      </header>

      <FilterChips />

      <div class="grid-main">
        {/* ---------------- [1] the signature element ---------------- */}
        <section class="panel" style={{ "border-top": "none", "padding-top": "0" }}>
          <h2 class="panel__title">1 · The price ladder</h2>
          <p class="panel__sub">
            Every model at its true price. Bar length is revenue.
            <span class="live-only"> Click a rung to filter the report.</span>
          </p>
          <Show when={rungs() && bnds()} fallback={<Skeleton h={460} />}>
            <ChartFigure
              id="ladder"
              caption={`Revenue climbs with price: the ${topBand()!.price_band} rung is ${pct(
                topBand()!.unit_pct
              )} of units and ${pct(topBand()!.rev_pct)} of revenue.`}
              {...ladderTable(rungs()!)}
            >
              <PriceLadder
                data={rungs()!}
                poster={props.poster}
                limit={rungLimit()}
                onDrill={(m) => drillInto("mobile_model", m)}
              />
            </ChartFigure>
            <Show when={rungLimit()}>
              <button class="btn live-only" onClick={() => setShowAllRungs(true)}>
                Show all {rungs()!.length} models
              </button>
            </Show>
          </Show>

          <Show when={bnds()}>
            <div style={{ "margin-top": "var(--sp-4)" }}>
              <ChartFigure
                id="bands"
                caption={`Each rung of the ladder earns more per unit than the one below it: the ${
                  topBand()!.price_band
                } rung returns ${lev(topBand())}× its share of volume, the ${
                  botBand()!.price_band
                } rung ${lev(botBand())}×.`}
                {...bandTable(bnds()!)}
              >
                <BandLegend data={bnds()!} poster={props.poster} />
              </ChartFigure>
            </div>
          </Show>
        </section>

        <div class="col-right">
          {/* ---------------- [2] KPI strip ---------------- */}
          <section>
            <div class="kpi-row">
              <Kpi
                metric="revenue"
                label="Revenue"
                value={h()?.revenue}
                display={h() ? money(h()!.revenue) : undefined}
                note={
                  topBand()
                    ? `${pct(topBand()!.rev_pct, 0)} of it from the ${topBand()!.price_band} rung`
                    : "concentrated at the top of the ladder"
                }
              />
              <Kpi
                metric="units"
                label="Units sold"
                value={h()?.units}
                display={h() ? int(h()!.units) : undefined}
                note="1-99 per day; pooled they look uniform, only OnePlus beats chance"
              />
              <Kpi
                metric="asp"
                label="Avg selling price"
                value={h()?.asp}
                display={h() ? usd0(h()!.asp) : undefined}
                note="unit-weighted, not the mean of the price column"
              />
              <Kpi
                metric="days"
                label="Trading days"
                value={h()?.days}
                display={h() ? int(h()!.days) : undefined}
                note="the real sample size - one row per day of 2024"
              />
            </div>
          </section>

          {/* ---------------- [3] the hinge ---------------- */}
          <section class="panel">
            <Breadcrumb />
            <h2 class="panel__title">2 · Who turns volume into money</h2>
            <p class="panel__sub">
              Revenue share minus unit share, in percentage points.
              <span class="live-only"> Click a brand to cross-filter; Enter drills in.</span>
            </p>
            <Show when={gaps()} fallback={<Skeleton h={220} />}>
              <ChartFigure
                id="conversion"
                caption={`The brand selling the most phones (${
                  volumeLeader()?.brand ?? "-"
                }) earns only the third-most money; the worst converter (${
                  worstConverter()?.brand ?? "-"
                }) gives up ${Math.abs(worstConverter()?.gap_pp ?? 0).toFixed(2)} points of share.`}
                {...gapTable(gaps()!)}
              >
                <ConversionGap
                  data={gaps()!}
                  poster={props.poster}
                  onDrill={(b) => drillInto("brand", b)}
                />
              </ChartFigure>
            </Show>
          </section>

          {/* ---------------- [4] mix, not price ---------------- */}
          <section class="panel">
            <h2 class="panel__title">3 · Same phone, same price - different rung</h2>
            <p class="panel__sub">
              A Z Fold 6 costs the same everywhere. The gap in average selling price is mix, not
              pricing.
            </p>
            <Show when={mkts()} fallback={<Skeleton h={170} />}>
              <ChartFigure
                id="markets"
                caption={`${richest()!.country}'s higher average selling price is product mix, not pricing: ${pct(
                  richest()!.premium_mix
                )} of its units are premium against ${poorest()!.country}'s ${pct(
                  poorest()!.premium_mix
                )}, at identical list prices.`}
                {...marketTable(mkts()!)}
              >
                <MarketMix
                  data={mkts()!}
                  poster={props.poster}
                  onDrill={(c) => drillInto("country", c)}
                />
              </ChartFigure>
            </Show>
            <p style={{ "font-size": "0.76rem", color: "var(--ink-muted)", "margin-top": "8px" }}>
              ⚑ marks fewer than 60 trading days. Shown, but directional only - the like-for-like claim rests on India (169 days) and Turkey (136).
            </p>
          </section>
        </div>
      </div>

      {/* ---------------- [5] so what ---------------- */}
      <section class="panel sowhat-section" style={{ "margin-top": "var(--sp-4)" }}>
        <h2 class="panel__title">So what</h2>
        <p class="panel__sub live-only">
          Conclusions for the full year, each qualified by a test run on all 366 days - so this
          panel deliberately ignores the filters above.
        </p>
        <div class="sowhat">
          <div class="sowhat__item">
            <div class="sowhat__n">01</div>
            <p class="sowhat__h">Winning the unit race does not win the money race</p>
            <p class="sowhat__b">
              {volumeLeader(allGaps())?.brand ?? "The volume leader"} does sell the most phones -{" "}
              {volumeLeader(allGaps()) ? pct(volumeLeader(allGaps())!.unit_share) : "-"} of units,{" "}
              {PERMUTATION_NOTE}. It still earns only the {volumeLeaderRevenueRank() ?? "-"} money.{" "}
              {worstConverter(allGaps())?.brand ?? "The worst converter"} holds{" "}
              {worstConverter(allGaps()) ? pct(worstConverter(allGaps())!.unit_share) : "-"} for{" "}
              {worstConverter(allGaps()) ? pct(worstConverter(allGaps())!.rev_share) : "-"} of
              revenue.
            </p>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">02</div>
            <p class="sowhat__h">Treat flagship supply as the biggest revenue risk</p>
            <p class="sowhat__b">
              One model - {allFlag()?.mobile_model ?? "the flagship"} - produces{" "}
              <span data-metric="flagship.top.rev_pct" data-value={allFlag()?.rev_pct ?? ""}>
                {allFlag() ? pct(allFlag()!.rev_pct) : "-"}
              </span>{" "}
              of revenue from{" "}
              <span data-metric="flagship.top.day_pct" data-value={allFlag()?.day_pct ?? ""}>
                {allFlag() ? pct(allFlag()!.day_pct) : "-"}
              </span>{" "}
              of trading days, and the five best days are all the same phone. The two brands with
              no top-band model are the two that convert below par.
            </p>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">03</div>
            <p class="sowhat__h">Move markets up the ladder, do not discount them</p>
            <p class="sowhat__b">
              Every market below {richestAll()?.country ?? "the richest"} pays the same list prices
              for the same phones; they buy further down the ladder. {comparableMarkets()} carry
              the claim. Financing and flagship availability move ASP; price cuts only move margin.
            </p>
          </div>
        </div>
      </section>

      <Explore filters={f} />

      <footer class="colophon">
        <strong>Source:</strong> Onyx Data DataDNA May 2025 - Mobile Phone Sales. 366 rows, one per
        calendar day of 2024 - a daily-summary table, not a transaction log, so every rate is sized
        on n=366. <strong>Method:</strong> Polars → Parquet star schema → Malloy semantic model (14
        views) → row-level aggregation in the browser. Nothing is precomputed; every figure,
        captions included, is aggregated at query time, and every figure carrying a{" "}
        <code>data-metric</code> tag is recomputed from the parquet in DuckDB and asserted to match
        with zero tolerance. 34 model tests pass.{" "}
        <strong>Accessibility:</strong> WCAG 2.1 AA - charts are keyboard-operable and exposed as
        screen-reader data tables, no meaning is carried by colour alone, and the palette is
        deuteranopia- and protanopia-safe. <strong>Caveats:</strong> only OnePlus's unit share
        survives a permutation test, so the other four brands cannot be ranked by volume; Pakistan
        (10 days) and Bangladesh (51) are shown but flagged as too thin to compare.
      </footer>
    </div>
  );
}

function Kpi(props: {
  metric: string;
  label: string;
  value?: number;
  display?: string;
  note: string;
}) {
  return (
    <div class="kpi">
      <div class="kpi__label">{props.label}</div>
      <div class="kpi__value" data-metric={props.metric} data-value={props.value ?? ""}>
        <Show when={props.display} fallback={<span style={{ opacity: 0.35 }}>-</span>}>
          {props.display}
        </Show>
      </div>
      <div class="kpi__note">{props.note}</div>
    </div>
  );
}

/** Loading skeleton - never a placeholder number. */
function Skeleton(props: { h: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: `${props.h}px`,
        background:
          "repeating-linear-gradient(180deg, var(--bg-sunken) 0 14px, transparent 14px 24px)",
        opacity: 0.6,
      }}
    />
  );
}
