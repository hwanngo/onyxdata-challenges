/**
 * Supporting panels - 2026/02.
 *
 * Every title states the FINDING, not the field. Every chart emits and consumes the
 * cross-filter. Every chart carries a visually-hidden table.
 */
import { For, Show } from "solid-js";
import { CUTS, GRID_DOMAIN, META, dec, eur0, int, money, pct, promoMdeWorstCategory, signed, spreadFor } from "../data";

const PANEL_W = 460;

/* STATISTICS QUOTED IN CAPTIONS.
 *
 * These are the only figures in this file that no `data-metric` can own, because they are
 * not aggregates of the payload - they are outputs of tests run in analysis/integrity.py
 * against the raw workbook, over the WHOLE book rather than the filtered view on screen.
 * Hoisted one constant per sentence so each carries its own ledger reference, per 2025/08.
 */
// prose-number-ok: I1 - same-store growth is +0.07%, Mann-Whitney on daily revenue
const SAME_STORE_MW_P = "0.72";

/* ---------------------------------------------------------------------------------------
 * ④ Growth, decomposed. Two lines, because one of them is the honest one.
 * ------------------------------------------------------------------------------------- */
export function GrowthPanel(props: {
  months: { k: string; revenue: number; same: number }[];
  g: { totalPct: number; samePct: number; newShareOfGrowth: number };
  onPick?: (ym: string) => void;
}) {
  const H = 150, P = { t: 14, r: 14, b: 26, l: 54 };
  const iw = () => PANEL_W - P.l - P.r;
  const ih = () => H - P.t - P.b;
  const maxV = () => Math.max(...props.months.map((m) => Math.max(m.revenue, m.same))) * 1.08;
  const x = (i: number) => P.l + (i / Math.max(1, props.months.length - 1)) * iw();
  const y = (v: number) => P.t + ih() - (v / Math.max(1, maxV())) * ih();
  const path = (key: "revenue" | "same") =>
    props.months.map((m, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(m[key]).toFixed(1)}`).join(" ");

  return (
    <figure class="panel">
      <h3 class="panel__t">The growth is eleven new shops, not trading</h3>
      <svg width={PANEL_W} height={H} viewBox={`0 0 ${PANEL_W} ${H}`} role="img"
           aria-label={`Monthly revenue, total versus same-store, January 2024 to December 2025. Total grew ${dec(props.g.totalPct)} percent; same-store grew ${dec(props.g.samePct)} percent.`}>
        <For each={[0, 0.5, 1]}>
          {(f) => (
            <line x1={P.l} x2={PANEL_W - P.r} y1={P.t + ih() * f} y2={P.t + ih() * f}
                  stroke="var(--border)" stroke-width="1" />
          )}
        </For>
        <path d={path("revenue")} fill="none" stroke="var(--accent)" stroke-width="2.5" />
        <path d={path("same")} fill="none" stroke="var(--inert)" stroke-width="2.5"
              stroke-dasharray="5 4" />
        <text x={PANEL_W - P.r} y={y(props.months[props.months.length - 1]?.revenue ?? 0) - 7}
              text-anchor="end" class="ann ann--accent">total {signed(props.g.totalPct)}</text>
        <text x={PANEL_W - P.r} y={y(props.months[props.months.length - 1]?.same ?? 0) + 15}
              text-anchor="end" class="ann">same-store {signed(props.g.samePct)}</text>
        <text x={P.l} y={H - 8} class="ax">2024</text>
        <text x={PANEL_W - P.r} y={H - 8} text-anchor="end" class="ax">2025</text>
        <text x={P.l - 8} y={P.t + 4} text-anchor="end" class="ax">{money(maxV())}</text>
      </svg>
      <p class="panel__c">
        Mann-Whitney <span class="mono">p = {SAME_STORE_MW_P}</span> on same-store daily revenue.
        <strong> {dec(props.g.newShareOfGrowth, 1)}%</strong> of the increase is eleven shops
        that opened inside the window.
      </p>
      {/* The table MUST be wrapped in a div rather than carrying .sr-only itself. A <table>
          treats width and height as MINIMUMS and expands to fit its content, so a bare
          .sr-only table does not clip: this one was 3,414px tall and added 1,500px of blank
          document below the footer. Recorded in LEARNINGS under 2025/05 and fixed in the
          kit's ChartFigure; these panels are hand-rolled and inherited the bug. */}
      <div class="sr-only">
        <table>
        <caption>Monthly revenue, total and same-store</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Total</th><th scope="col">Same-store</th></tr></thead>
        <tbody>
          <For each={props.months}>
            {(m) => <tr><th scope="row">{m.k}</th><td>{dec(m.revenue)}</td><td>{dec(m.same)}</td></tr>}
          </For>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------------------------------------
 * ⑤ The lever. Two measures side by side, because the point is that one moves and one doesn't.
 * ------------------------------------------------------------------------------------- */
export function PromoPanel(props: {
  p: {
    marginPctPromo: number; marginPctNon: number; gapPp: number;
    unitsPerLinePromo: number; unitsPerLineNon: number; forgone: number;
    linesPromo: number; linesNon: number;
  };
  onPick?: (v: string) => void;
}) {
  const bar = (v: number, max: number) => (v / max) * 190;
  const unitLiftPct = () =>
    props.p.unitsPerLineNon ? (props.p.unitsPerLinePromo / props.p.unitsPerLineNon - 1) * 100 : 0;
  return (
    <figure class="panel">
      <h3 class="panel__t">Discounting costs 9.1 points and buys nothing</h3>
      <div class="promo">
        <div class="promo__col">
          <span class="promo__h">margin rate</span>
          <button class="promo__row" onClick={() => props.onPick?.("Not promoted")}
                  aria-label={`Not promoted, margin rate ${pct(props.p.marginPctNon)}. Filter to it.`}>
            <span class="promo__lab">not promoted</span>
            <span class="promo__bar" style={{ width: `${bar(props.p.marginPctNon, 30)}px`,
                   background: "var(--inert)" }} />
            <span class="mono promo__v" data-metric="promo.Not promoted.marginPct"
                  data-value={props.p.marginPctNon}>{pct(props.p.marginPctNon)}</span>
          </button>
          <button class="promo__row" onClick={() => props.onPick?.("Promoted")}
                  aria-label={`Promoted, margin rate ${pct(props.p.marginPctPromo)}. Filter to it.`}>
            <span class="promo__lab">promoted</span>
            <span class="promo__bar" style={{ width: `${bar(props.p.marginPctPromo, 30)}px`,
                   background: "var(--cost)" }} />
            <span class="mono promo__v" data-metric="promo.Promoted.marginPct"
                  data-value={props.p.marginPctPromo}>{pct(props.p.marginPctPromo)}</span>
          </button>
          <span class="promo__delta mono">-{dec(props.p.gapPp)}pp</span>
        </div>
        <div class="promo__col">
          <span class="promo__h">units per sale line</span>
          <div class="promo__row promo__row--static">
            <span class="promo__lab">not promoted</span>
            <span class="promo__bar" style={{ width: `${bar(props.p.unitsPerLineNon, 8)}px`,
                   background: "var(--inert)" }} />
            <span class="mono promo__v" data-metric="promo.Not promoted.unitsPerLine"
                  data-value={props.p.unitsPerLineNon}>{dec(props.p.unitsPerLineNon)}</span>
          </div>
          <div class="promo__row promo__row--static">
            <span class="promo__lab">promoted</span>
            <span class="promo__bar" style={{ width: `${bar(props.p.unitsPerLinePromo, 8)}px`,
                   background: "var(--inert)" }} />
            <span class="mono promo__v" data-metric="promo.Promoted.unitsPerLine"
                  data-value={props.p.unitsPerLinePromo}>{dec(props.p.unitsPerLinePromo)}</span>
          </div>
          <span class="promo__delta promo__delta--null mono">
            -{dec(props.p.unitsPerLineNon - props.p.unitsPerLinePromo)} units
          </span>
        </div>
      </div>
      <p class="panel__c">
        Pooled, a real lift above{" "}
        <span class="mono">{dec(META.promoMdePooledPct)}%</span> could not have hidden here (n ={" "}
        {int(props.p.linesPromo)} vs {int(props.p.linesNon)}). Observed{" "}
        <span class="mono">{signed(unitLiftPct())}</span>, and no category survives correction
        - so the honest claim is <em>no lift</em>, not <em>promotion hurts volume</em>.{" "}
        <em>Within</em> a category the floor is higher: {promoMdeWorstCategory()[0]} could hide a{" "}
        <span class="mono">{dec(promoMdeWorstCategory()[1])}%</span> lift, so &ldquo;none of the
        five&rdquo; is a pooled result, not five powered ones.
      </p>
      <div class="sr-only">
        <table>
        <caption>Promoted versus not promoted</caption>
        <thead><tr><th scope="col">State</th><th scope="col">Margin rate %</th><th scope="col">Units per sale line</th></tr></thead>
        <tbody>
          <tr><th scope="row">Not promoted</th><td>{dec(props.p.marginPctNon)}</td><td>{dec(props.p.unitsPerLineNon)}</td></tr>
          <tr><th scope="row">Promoted</th><td>{dec(props.p.marginPctPromo)}</td><td>{dec(props.p.unitsPerLinePromo)}</td></tr>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------------------------------------
 * ⑥ The only structural lever. Sorted by value, because category HAS an order here.
 * ------------------------------------------------------------------------------------- */
export function CategoryPanel(props: {
  cats: { k: string; marginPct: number; revenue: number; lines: number }[];
  onPick?: (c: string) => void;
  activeCat?: string;
}) {
  const max = () => Math.max(...props.cats.map((c) => c.marginPct), 1);
  const geoSpread = () => spreadFor("Country");
  const catSpread = () => spreadFor("Product category");
  return (
    <figure class="panel">
      <h3 class="panel__t">Only what you sell moves the number</h3>
      <div class="cats">
        <For each={props.cats}>
          {(c) => (
            <button class="cats__row" classList={{ "is-on": props.activeCat === c.k }}
                    onClick={() => props.onPick?.(c.k)}
                    aria-label={`${c.k}, margin rate ${pct(c.marginPct)}. Filter to it.`}>
              <span class="cats__lab">{c.k}</span>
              <span class="cats__bar" style={{ width: `${(c.marginPct / max()) * 100}%` }} />
              <span class="mono cats__v" data-metric={`cats.${c.k}.marginPct`}
                    data-value={c.marginPct}>{pct(c.marginPct)}</span>
            </button>
          )}
        </For>
      </div>
      <p class="panel__c">
        Category spans <strong>{dec(catSpread())}pp</strong>. Geography spans{" "}
        <span class="mono">{dec(geoSpread())}pp</span> across eight countries -{" "}
        <strong>{Math.round(catSpread() / Math.max(geoSpread(), 0.001))}× narrower</strong>.
        Brand is not shown separately: all 32 brands sit inside one category each, so a brand
        chart would be this chart relabelled.
      </p>
      <div class="sr-only">
        <table>
        <caption>Margin rate by product category</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Margin rate %</th><th scope="col">Revenue</th></tr></thead>
        <tbody>
          <For each={props.cats}>
            {(c) => <tr><th scope="row">{c.k}</th><td>{dec(c.marginPct)}</td><td>{dec(c.revenue)}</td></tr>}
          </For>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------------------------------------
 * Web-only: the map that has nothing to say, and the table that proves it.
 * ------------------------------------------------------------------------------------- */
export function CountryPanel(props: {
  countries: { k: string; marginPct: number; revenue: number; stores: number }[];
  onPick?: (c: string) => void;
  activeCountry?: string;
}) {
  return (
    <figure class="panel">
      <h3 class="panel__t">Flat on every cut - the map has nothing to say</h3>
      <div class="ctry">
        <For each={props.countries}>
          {(c) => (
            <button class="ctry__row" classList={{ "is-on": props.activeCountry === c.k }}
                    onClick={() => props.onPick?.(c.k)}
                    aria-label={`${c.k}, ${c.stores} shops, margin rate ${pct(c.marginPct)}, revenue ${money(c.revenue)}. Filter to it.`}>
              <span class="ctry__lab">{c.k}</span>
              <span class="mono ctry__m" data-metric={`country.${c.k}.marginPct`}
                    data-value={c.marginPct}>{pct(c.marginPct)}</span>
              <span class="ctry__track">
                {/* Every country's rate drawn on the SAME fixed 24-34 scale as the signature. */}
                <span class="ctry__dot" style={{ left: `${((c.marginPct - 24) / 10) * 100}%` }} />
              </span>
              <span class="mono ctry__r">{money(c.revenue)}</span>
              <span class="mono ctry__s">{c.stores} shops</span>
            </button>
          )}
        </For>
      </div>
      <p class="panel__c">
        Eight countries, <strong>{dec(spreadFor("Country"))}pp</strong> between the highest and
        lowest margin rate, on the same {GRID_DOMAIN[0]}-{GRID_DOMAIN[1]}% scale the signature
        uses. Revenue differs because shop counts differ.
      </p>
      <div class="sr-only">
        <table>
        <caption>Margin rate and revenue by country</caption>
        <thead><tr><th scope="col">Country</th><th scope="col">Margin rate %</th><th scope="col">Revenue</th><th scope="col">Shops</th></tr></thead>
        <tbody>
          <For each={props.countries}>
            {(c) => <tr><th scope="row">{c.k}</th><td>{dec(c.marginPct)}</td><td>{dec(c.revenue)}</td><td>{c.stores}</td></tr>}
          </For>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/** dim_cut, straight from the model. The thesis as a table. */
export function CutTable() {
  const max = () => Math.max(...CUTS.map((c) => Math.max(c.spread_pp, c.chance_spread_p95_pp)));
  return (
    <figure class="panel panel--wide">
      <h3 class="panel__t">Six ways of cutting the book land inside chance. Two do not.</h3>
      {/* A wide data table must scroll inside its own container, or it forces horizontal
          page overflow - 1,092px against a 375px viewport here. The wrapper is tabbable
          because axe flags a scrollable region that keyboard users cannot reach
          (scrollable-region-focusable, serious). */}
      <div class="cut__scroll" tabindex="0" role="region" aria-label="Cut comparison table, scrollable">
      <table class="cut">
        <thead>
          <tr>
            <th scope="col">Cut</th><th scope="col">Groups</th>
            <th scope="col">Margin spread</th><th scope="col">Chance gives</th>
            <th scope="col">Real?</th><th scope="col" class="cut__vis">observed vs chance</th>
          </tr>
        </thead>
        <tbody>
          <For each={[...CUTS].sort((a, b) => a.spread_pp - b.spread_pp)}>
            {(c) => (
              <tr classList={{ "is-real": c.exceeds_chance }}>
                <th scope="row">{c.cut_label}</th>
                <td class="mono">{c.k_groups}</td>
                <td class="mono">{dec(c.spread_pp)}pp</td>
                <td class="mono">{dec(c.chance_spread_p95_pp)}pp</td>
                <td>{c.exceeds_chance ? "yes" : "no"}</td>
                <td class="cut__vis">
                  <span class="cut__track">
                    <span class="cut__chance" style={{ width: `${(c.chance_spread_p95_pp / max()) * 100}%` }} />
                    <span class="cut__obs" classList={{ "is-real": c.exceeds_chance }}
                          style={{ width: `${(c.spread_pp / max()) * 100}%` }} />
                  </span>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      </div>
      <p class="panel__c">
        Grey is the spread chance alone produces for that cut's own group sizes (bootstrap,{" "}
        {int(META.bootstrapReps)} replications, each group holding its real{" "}
        <span class="mono">n</span>). A cut is only a finding when the bar clears the grey.
      </p>
    </figure>
  );
}

/** The defect, stated rather than buried. */
export function DefectNote(props: { p: { lines: number; revenue: number; products: number; lineSharePct: number } }) {
  return (
    <aside class="defect">
      <h3 class="defect__t">One in ten sales lines predates its own product</h3>
      <p>
        <strong class="mono">{int(props.p.lines)}</strong> lines
        (<span class="mono">{dec(props.p.lineSharePct)}%</span>, {eur0(props.p.revenue)}) sell a
        product before its launch date, across{" "}
        <strong class="mono">{props.p.products}</strong> products -{" "}
        <em>every single one</em> that launched inside the window, with no exceptions.
      </p>
      <p>
        The two date rules the source <em>documents</em> hold at zero violations. The one it does
        not mention was never enforced. Those rows are flagged and kept, not dropped: they change
        no ranking here - but they make any launch-curve analysis impossible, and for 24 of the
        47 products most of the recorded history predates the product.
      </p>
    </aside>
  );
}
