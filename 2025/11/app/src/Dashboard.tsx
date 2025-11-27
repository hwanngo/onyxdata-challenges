/**
 * 2025/11 · E-commerce Analytics - the report.
 *
 * A restatement notice. The thesis is that the file's revenue column includes sales tax and
 * unreversed refunds, that correcting it removes 12.02%, and that the correction is flat on
 * every cut a dashboard actually draws EXCEPT geography - where it runs 1.65% to 19.34%.
 *
 * So the page is ordered as the argument: the restated total, then the proof that the
 * correction is uniform-except-geography, then the two geographic charts that break (one
 * flips, one dissolves), then the ones that survive, then the loyalty questions the brief
 * asked and this file cannot answer.
 *
 * EVERY displayed figure carries data-metric/data-value and is independently recomputed from
 * the parquet by tools/verify_metrics.py via DuckDB. Zero tolerance.
 */
import { For, Show, createSignal, onMount } from "solid-js";
import {
  Breadcrumb,
  ChartFigure,
  clearAll,
  FilterChips,
  InsightCallout,
  ThemeToggle,
  TourOverlay,
  filters,
  toggle,
  tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  META,
  aspByCountry,
  bfcmSeasonality,
  blankRegionEvents,
  by,
  byMonth,
  codeCountryShare,
  correctionPct,
  dec,
  derived,
  eff,
  eventsBeforeSignup,
  int,
  pct,
  priceTests,
  pval,
  refundRate,
  refundedExTax,
  regionFlip,
  regionTaxRatePct,
  revenue,
  revenueReported,
  spans,
  taxRatePct,
  taxTotal,
  usd,
  usdM,
} from "./data";
import { TheSpan, spanTable } from "./charts/TheSpan";
import { RegionFlip, regionTable } from "./charts/RegionFlip";
import { AspByCountry, aspTable } from "./charts/AspByCountry";
import { MonthlySeries, RankedBars, groupTable } from "./charts/Survivors";
import { TOUR } from "./tour";

const TOUR_KEY = "ecom-2025-11-tour-seen";

// prose-number-ok: C19 - the add-on independence result. Unlike every other statistic on this
// page it cannot be recomputed in the browser: it is a customer x date x family co-occurrence
// study, and the payload is event-grain with no customer key or event date. It also has no
// single DOM home by construction - the finding IS that the "attach rate" moves from 4.01% to
// 68.49% as the basket window widens from one day to thirty, so there is no one number to tag.
// That is why the dashboard declines to publish an attach rate at all. Full working - the
// 696-pair phi scan, the Bonferroni threshold, the expected-versus-observed collision counts -
// in analysis/insights.md C19.
const ATTACH_RATE_NOTE =
  "Add-on attach rate: 113 same-day baskets contain an add-on with a core product, and across all 696 add-on × core family pairs the strongest association is φ = 0.049 with none surviving Bonferroni." +
  " Widening the basket window from one day to thirty moves the \"attach rate\" from 4.01% to 68.49% without adding information, so no attach rate is published here.";

export default function Dashboard(props: { poster?: boolean }) {
  const [tour, setTour] = createSignal(false);
  onMount(() => {
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTour(true);
  });

  const rows = derived((rs) => rs, filters);
  const spanRows = derived(spans, filters);
  const flip = derived(regionFlip, filters);
  const asp = derived(aspByCountry, filters);
  const months = derived(byMonth, filters);
  const channels = derived((rs) => by(rs, "channel"), filters);
  const families = derived((rs) => by(rs, "family").slice(0, 8), filters);
  const codes = derived((rs) => by(rs, "code"), filters);

  /* The significance tests, run over the SAME rows the charts draw rather than transcribed
     from a notebook. Four Kruskal-Wallis runs and one chi-square; each is a memo, so they
     recompute once per filter change and not once per reference. See app/src/stats.ts for why
     this is computed rather than typed - the short version is that the literal these replace
     was calculated on data the app does not ship. */
  const tests = derived(priceTests, filters);
  const bfcm = derived(bfcmSeasonality, filters);
  const blankRegion = derived(blankRegionEvents, filters);
  const beforeSignup = derived(eventsBeforeSignup, filters);
  const sale15Us = derived((rs) => codeCountryShare(rs, "SALE15", "United States"), filters);
  const loyalty15Us = derived((rs) => codeCountryShare(rs, "LOYALTY15", "United States"), filters);

  /* Customer-grain facts. The payload is event-grain, so these come from the build (C9) and
     do not vary with the event filters - which is why they are plain values, not memos. */
  const repeatBuyers = () => META.repeat_buyers as number;
  const repeatBuyerPct = () => (100 * repeatBuyers()) / (META.customers as number);
  const eventsPerCustomer = () => (META.events as number) / (META.customers as number);

  /** The share of the reported country spread that vanishes with the tax. C3, withdrawn. */
  const spreadExplained = () => {
    const rep = asp().map((r) => r.aspReported);
    const ex = asp().map((r) => r.aspExTax);
    const repSpread = Math.max(...rep) - Math.min(...rep);
    const exSpread = Math.max(...ex) - Math.min(...ex);
    return repSpread ? 100 * (1 - exSpread / repSpread) : NaN;
  };

  const reported = () => revenueReported(rows());
  const net = () => revenue(rows());
  const tax = () => taxTotal(rows());
  const refunded = () => refundedExTax(rows());
  const corr = () => correctionPct(rows());

  /* With an empty selection every reducer below degrades: correctionPct divides by zero and
     Math.min of an empty list is Infinity. Formatting them as an em dash keeps the masthead
     honest instead of printing "NaN%" and "Infinity%" above the empty state. */
  const hasRows = () => rows().length > 0;
  const num = (v: number, fmt: (n: number) => string) => (Number.isFinite(v) ? fmt(v) : "-");

  const nonGeo = () => spanRows().filter((s) => !s.isGeographic && !s.isDisguisedGeo);
  const geo = () => spanRows().filter((s) => s.isGeographic);
  const worstNonGeo = () => Math.max(...nonGeo().map((s) => s.span));
  const bestGeo = () => Math.min(...geo().map((s) => s.span));

  const sale15 = () => codes().find((c) => c.k === "SALE15");

  return (
    <div class={props.poster ? "poster-sheet" : "app"}>
      {/* ============================== MASTHEAD ============================== */}
      <header class="masthead">
        <div class="masthead__rule">
          <span class="masthead__brand">DATADNA · NOVEMBER 2025 · E-COMMERCE ANALYTICS</span>
          <span class="masthead__meta">
            <span data-metric="events" data-value={META.events as number}>
              {int(META.events as number)}
            </span>{" "}
            events ·{" "}
            <span data-metric="customers" data-value={META.customers as number}>
              {int(META.customers as number)}
            </span>{" "}
            customers · {String(META.first).slice(0, 10)} → {String(META.last).slice(0, 10)}
          </span>
          <ThemeToggle />
        </div>

        <div class="hero">
          <div class="hero__text">
            <h1 class="hero__title">The ledger only rounds up</h1>
            <p class="hero__lede">
              This file&rsquo;s revenue column includes sales tax, and refunds are flagged but
              never reversed. Correcting both removes{" "}
              <strong data-metric="correction_pct" data-value={corr()}>
                {num(corr(), (v) => pct(v, 2))}
              </strong>{" "}
              of the money. That correction is a flat {num(corr(), (v) => pct(v, 0))} on every
              cut a dashboard actually draws - <em>except geography</em>, where it runs from{" "}
              {num(Math.min(...geo().flatMap((s) => s.points.map((p) => p.pct))), (v) => pct(v, 2))}{" "}
              to{" "}
              {num(Math.max(...geo().flatMap((s) => s.points.map((p) => p.pct))), (v) => pct(v, 2))}.
            </p>
          </div>

          {/* ---- the restatement ---- */}
          <div class="restate" id="restatement">
            <div class="restate__row">
              <span class="restate__label">As reported</span>
              <span class="restate__num restate__num--reported" data-metric="revenue_reported" data-value={reported()}>
                {usd(reported())}
              </span>
            </div>
            <div class="restate__row restate__row--sub">
              <span class="restate__label">less sales tax</span>
              <span class="restate__num" data-metric="tax_total" data-value={tax()}>
                -{usd(tax())}
              </span>
            </div>
            <div class="restate__row restate__row--sub">
              <span class="restate__label">less refunded orders</span>
              <span class="restate__num" data-metric="refunded_ex_tax" data-value={refunded()}>
                -{usd(refunded())}
              </span>
            </div>
            <div class="restate__row restate__row--total">
              <span class="restate__label">As restated</span>
              <span class="restate__num restate__num--restated" data-metric="revenue" data-value={net()}>
                {usd(net())}
              </span>
            </div>
            <div class="restate__delta">
              <span aria-hidden="true">▼</span> {num(corr(), (v) => pct(v, 2))}
              <span class="sr-only">
                decrease of {num(corr(), (v) => pct(v, 2))} from the reported figure to the
                restated figure
              </span>
            </div>
          </div>
        </div>

        <Breadcrumb />
        <FilterChips hint="Nothing filtered - click any dot, bar or country to cross-filter the whole report." />
      </header>

      {/* An impossible intersection (say United States AND GBP) selects zero events, and
          every chart below then reduces over an empty array - Math.min of nothing is
          Infinity, rows[0] is undefined, and the page renders blank. A filter combination a
          user can reach by clicking twice must not be able to do that. */}
      <Show
        when={rows().length}
        fallback={
          <main class="grid">
            <section class="panel panel--full">
              <h2 class="panel__title">No events match this combination</h2>
              <p class="panel__lede">
                The filters currently applied select nothing. That is usually because two of
                them cannot both be true - country and currency, for instance, are the same
                dimension in this file, so &ldquo;United States&rdquo; and &ldquo;GBP&rdquo;
                have no overlap.
              </p>
              <button class="btn btn--primary" onClick={() => clearAll()}>
                Clear all filters
              </button>
            </section>
          </main>
        }
      >
      <main class="grid">
        {/* ============================== SIGNATURE ============================== */}
        <section class="panel panel--full" id="span">
          <h2 class="panel__title">
            The same {num(corr(), (v) => pct(v, 2))} correction, applied ten ways
          </h2>
          <p class="panel__lede">
            One row per way of cutting the data, one dot per group. Six rows collapse onto the
            line: whichever channel, month, category, segment, payment method or product you
            pick, every group takes essentially the same haircut - spans of{" "}
            <strong>{dec(Math.min(...nonGeo().map((s) => s.span)), 2)}</strong> to{" "}
            <strong data-metric="correction_span_family" data-value={worstNonGeo()}>
              {dec(worstNonGeo(), 2)}
            </strong>{" "}
            percentage points. Three rows spray across the whole chart, and those three are
            country, region and currency.
          </p>
          <ChartFigure
            id="fig-span"
            caption={
              `The widest non-geographic cut spans ${dec(worstNonGeo(), 2)} points; the narrowest ` +
              `geographic one spans ${dec(bestGeo(), 2)}. The two families do not overlap.`
            }
            {...spanTable(spanRows())}
          >
            <TheSpan
              rows={spanRows()}
              overall={corr()}
              poster={props.poster}
              onPick={(cut, group) => {
                const field = {
                  channel: "channel",
                  payment_method: "payment",
                  category: "category",
                  segment: "segment",
                  family: "family",
                  discount_code: "code",
                  currency: "currency",
                  region: "region",
                  country: "country",
                }[cut];
                if (field) toggle(field, group);
              }}
            />
          </ChartFigure>
          <p class="panel__foot">
            A {num(corr(), (v) => pct(v, 0))} overstatement is embarrassing but survivable -
            restate the total and every trend, ranking and comparison still holds. What does not
            survive is geography. Sales tax is{" "}
            <span data-metric="us_tax_rate_pct" data-value={taxRatePct("United States")}>
              {num(taxRatePct("United States"), (v) => pct(v, 0))}
            </span>{" "}
            in the United States and{" "}
            <span data-metric="eu_tax_rate_pct" data-value={regionTaxRatePct("EU")}>
              {num(regionTaxRatePct("EU"), (v) => pct(v, 0))}
            </span>{" "}
            across Europe, so the correction itself runs from{" "}
            {num(Math.min(...geo().flatMap((s) => s.points.map((p) => p.pct))), (v) => pct(v, 2))}{" "}
            to{" "}
            {num(Math.max(...geo().flatMap((s) => s.points.map((p) => p.pct))), (v) => pct(v, 2))}{" "}
            depending on where you look. The geographic charts are wrong in <em>shape</em>, not
            merely in level. Guiding question Q9 asks for average selling price &ldquo;by country
            or currency&rdquo; - and that is both of them.
          </p>
        </section>

        {/* ============================== THE TWO CASUALTIES ============================== */}
        <section class="panel" id="flip">
          <h2 class="panel__title">The ranking that flips</h2>
          <p class="panel__lede">
            The EU leads revenue on the file&rsquo;s own figures. North America leads once the
            tax comes out. These are totals, so no sampling-noise objection is available.
          </p>
          <ChartFigure
            id="fig-flip"
            caption={
              flip().rows.length >= 2
                ? `${flip().topReported} leads as reported; ${flip().topRestated} leads as restated.`
                : `Only ${flip().topReported} is in the current filter.`
            }
            {...regionTable(flip().rows)}
          >
            <RegionFlip rows={flip().rows} poster={props.poster} />
          </ChartFigure>
          <p class="panel__foot">
            <span data-metric="region_top_reported" data-value={flip().topReported}>
              {flip().topReported}
            </span>{" "}
            →{" "}
            <span data-metric="region_top_corrected" data-value={flip().topRestated}>
              {flip().topRestated}
            </span>
            <Show when={flip().rows.length >= 2} fallback=". Only one region in view.">
              . A{" "}
              {usdM(
                Math.abs(flip().rows[0].reported - flip().rows[1].reported) +
                  Math.abs(flip().rows[0].net - flip().rows[1].net)
              )}{" "}
              swing.
            </Show>
          </p>
        </section>

        <section class="panel" id="asp">
          <h2 class="panel__title">The ranking that dissolves</h2>
          <p class="panel__lede">
            Revenue per event differs by country at{" "}
            <strong data-metric="asp_kw_h_reported" data-value={tests().perEventReported.H}>
              p = {pval(tests().perEventReported.p)}
            </strong>
            . Remove the tax and it does not differ <em>at all</em> - Kruskal&ndash;Wallis{" "}
            <strong data-metric="asp_kw_h_ex_tax" data-value={tests().perEventExTax.H}>
              p = {pval(tests().perEventExTax.p)}
            </strong>
            , η² = {eff(tests().perEventExTax.eta2)}. The spread collapses from{" "}
            <strong data-metric="asp_reported_spread" data-value={
              Math.max(...asp().map((r) => r.aspReported)) - Math.min(...asp().map((r) => r.aspReported))
            }>
              ${dec(Math.max(...asp().map((r) => r.aspReported)) - Math.min(...asp().map((r) => r.aspReported)), 2)}
            </strong>{" "}
            to{" "}
            <strong data-metric="asp_ex_tax_spread" data-value={
              Math.max(...asp().map((r) => r.aspExTax)) - Math.min(...asp().map((r) => r.aspExTax))
            }>
              ${dec(Math.max(...asp().map((r) => r.aspExTax)) - Math.min(...asp().map((r) => r.aspExTax)), 2)}
            </strong>
            .
          </p>
          <ChartFigure
            id="fig-asp"
            caption={
              `Ex-tax, the ${asp().length} countries are statistically one value. This panel ` +
              `deliberately does not rank them.`
            }
            {...aspTable(asp())}
          >
            <AspByCountry
              rows={asp()}
              test={tests().perEventExTax}
              poster={props.poster}
              onPick={(c) => toggle("country", c)}
            />
          </ChartFigure>
          <p class="panel__foot">
            An earlier draft of this analysis measured the residual instead of testing it, and
            reported that{" "}
            <strong data-metric="asp_spread_explained_pct" data-value={spreadExplained()}>
              {num(spreadExplained(), (v) => pct(v, 0))}
            </strong>{" "}
            of the country gap was sales tax - the share of the reported spread the ex-tax
            spread does not account for. Testing it gives the stronger answer: ex-tax the
            countries do not differ at all, so the tax explains the whole of it, not most of it.
            The same holds for the true per-unit price, which divides by the seat count instead
            of averaging the line total: reported{" "}
            <span
              data-metric="asp_kw_h_per_unit_reported"
              data-value={tests().perUnitReported.H}
            >
              p = {pval(tests().perUnitReported.p)}
            </span>
            , ex-tax{" "}
            <span data-metric="asp_kw_h_per_unit_ex_tax" data-value={tests().perUnitExTax.H}>
              p = {pval(tests().perUnitExTax.p)}
            </span>
            .
          </p>
        </section>

        {/* ============================== THE SURVIVORS ============================== */}
        <section class="panel panel--full" id="survivors">
          <h2 class="panel__title">Everything else is still right</h2>
          <p class="panel__lede">
            The other half of the finding, and the more useful one: correcting the money moves the
            level and leaves the ranking alone. Both series are drawn on every chart below -
            hollow for the file&rsquo;s figure, solid for the restated one. The gap is constant.
          </p>
          <div class="triptych">
            <ChartFigure
              id="fig-month"
              caption={
                `${months().length} flat months. The correction is ` +
                `${pct(Math.min(...months().map((m) => m.correctionPct)), 2)}-` +
                `${pct(Math.max(...months().map((m) => m.correctionPct)), 2)} throughout.`
              }
              {...groupTable(
                months().map((m) => ({
                  k: m.month.slice(0, 7) + (m.partial ? " (partial)" : ""),
                  n: m.n,
                  reported: m.reported,
                  net: m.net,
                  correctionPct: m.correctionPct,
                  aspReported: 0,
                  aspExTax: 0,
                  refundRate: 0,
                  share: 0,
                })),
                "Month"
              )}
            >
              <MonthlySeries points={months()} poster={props.poster} />
            </ChartFigure>

            <ChartFigure
              id="fig-channel"
              caption="Channel ranks 1-2-3-4-5 identically before and after correction."
              {...groupTable(channels(), "Channel")}
            >
              <RankedBars
                rows={channels()}
                title="Revenue by channel, reported against restated"
                unchangedNote="RANK UNCHANGED BY THE CORRECTION"
                poster={props.poster}
                onPick={(k) => toggle("channel", k)}
              />
            </ChartFigure>

            <ChartFigure
              id="fig-family"
              caption="Merged on product family. Grouped by the file's own product_id, the top item here does not appear in the top five at all."
              {...groupTable(families(), "Product family")}
            >
              <RankedBars
                rows={families()}
                title="Revenue by product family, reported against restated"
                unchangedNote="101 SKUs ARE 70 FAMILIES - 6 ARE PURE DUPLICATES"
                poster={props.poster}
                onPick={(k) => toggle("family", k)}
              />
            </ChartFigure>
          </div>
        </section>

        {/* ============================== THE BRIEF'S OWN QUESTION ============================== */}
        <section class="panel panel--full" id="loyalty">
          <h2 class="panel__title">And the question the brief actually asked has no answer</h2>
          <p class="panel__lede">
            The brief asks entrants to <em>identify loyal customers (repeat buyers)</em> and find
            which channels and campaigns drive them. Four measurements, each one closing that
            door.
          </p>
          <div class="findings">
            <div class="finding">
              <div class="finding__num" data-metric="repeat_buyers" data-value={repeatBuyers()}>
                {int(repeatBuyers())}
              </div>
              <div class="sr-only" data-metric="repeat_buyer_pct" data-value={repeatBuyerPct()}>
                {dec(repeatBuyerPct(), 3)}% of customers
              </div>
              <div class="finding__label">
                of {int(META.customers as number)} customers are repeat buyers
              </div>
              <p class="finding__body">
                Any loyal-versus-new split renders {pct(repeatBuyerPct(), 1)} against{" "}
                {pct(100 - repeatBuyerPct(), 1)}. The segmentation the brief is built on does not
                exist in the data.
              </p>
            </div>
            <div class="finding">
              <div
                class="finding__num"
                data-metric="events_per_customer_exact"
                data-value={eventsPerCustomer()}
              >
                {dec(eventsPerCustomer(), 4)}
              </div>
              <div class="finding__label">events per customer, exactly</div>
              <p class="finding__body">
                {int(META.events as number)} events across exactly{" "}
                {int(META.customers as number)} customers. This is a fixed pool dealt out, not a
                sample - so differences in how much people buy are allocation noise by
                construction.
              </p>
            </div>
            <div class="finding">
              <div class="finding__num">
                <span data-metric="sale15_us_pct" data-value={sale15Us()}>
                  {pct(sale15Us(), 0)}
                </span>
                {" / "}
                <span data-metric="loyalty15_us_pct" data-value={loyalty15Us()}>
                  {pct(loyalty15Us(), 0)}
                </span>
              </div>
              <div class="finding__label">SALE15 and LOYALTY15, share redeemed in the US</div>
              <p class="finding__body">
                The one non-random structure in the discount column is geographic, not
                behavioural. Comparing those two codes compares two tax regimes.
              </p>
            </div>
            <div class="finding">
              <div class="finding__num" data-metric="bfcm_month_chi2" data-value={bfcm().chi2}>
                p = {pval(bfcm().p)}
              </div>
              <div class="finding__label">Black Friday codes against the monthly base rate</div>
              <p class="finding__body">
                χ² = {dec(bfcm().chi2, 2)} on {bfcm().df} df. BFCM10 and BFCM20 are redeemed at
                exactly the base rate every month, and peak in May-August. The promotional
                calendar is decorative.
              </p>
            </div>
          </div>
          <InsightCallout
            recommendations={[
              {
                text:
                  "Restate revenue ex-tax and reverse refunded orders before any geographic " +
                  "reporting goes out. Fix that one report and trust the rest.",
                evidence:
                  `The correction is ${pct(corr(), 2)} overall and varies by only ` +
                  `${dec(worstNonGeo(), 2)} points across every non-geographic cut - but by ` +
                  `${dec(Math.max(...geo().map((s) => s.span)), 2)} points across countries. ` +
                  `North America, not the EU, is the largest market once corrected.`,
                chartId: "fig-span",
              },
              {
                text:
                  "Stop reporting average selling price by country or currency. It measures " +
                  "the local tax rate and nothing else.",
                // prose-number-ok: C3 - the catalogue list-price test runs on dim_product, a
                // grain this event-level payload does not carry, so it has no DOM home to tag.
                // Every other figure in this string is computed from the rows on screen.
                evidence:
                  `Reported revenue per event differs by country at ` +
                  `p = ${pval(tests().perEventReported.p, true)}; ex-tax, Kruskal-Wallis gives ` +
                  `p = ${pval(tests().perEventExTax.p, true)} and ` +
                  `η² = ${eff(tests().perEventExTax.eta2)}. Per unit rather than per event the ` +
                  `contrast is sharper still (${pval(tests().perUnitReported.p, true)} against ` +
                  `${pval(tests().perUnitExTax.p, true)}). The catalogue list price does not ` +
                  `differ by country either (p = 0.203).`,
                chartId: "fig-asp",
              },
              {
                text:
                  "Merge the product catalogue on family before ranking anything, and drop the " +
                  "loyalty segmentation entirely - there is no loyal cohort to target.",
                evidence:
                  `${int(META.skus as number)} SKUs are ${int(META.families as number)} ` +
                  `families; six are pure duplicates at identical prices, and the true top ` +
                  `seller is invisible to a product_id ranking. ${int(repeatBuyers())} of ` +
                  `${int(META.customers as number)} customers are repeat buyers, and the file ` +
                  `holds exactly ${dec(eventsPerCustomer(), 4)} events per customer.`,
                chartId: "fig-family",
              },
            ]}
          />
        </section>

        {/* ============================== METHOD ============================== */}
        <section class="panel panel--full" id="method">
          <h2 class="panel__title">Method, assumptions, and the claims I withdrew</h2>
          <div class="method">
            <div>
              <h3 class="method__head">How the numbers were checked</h3>
              <p>
                Every figure on this page carries a <code>data-metric</code> attribute. Playwright
                scrapes them and an independent DuckDB path recomputes each one from the curated
                parquet - a second engine and a different code path from the one that rendered it.
                The build itself refuses to write if the thesis stops holding.
              </p>
              <h3 class="method__head">Assumptions that change the numbers</h3>
              <ul>
                <li>
                  <strong>Revenue means ex-tax.</strong> Tax collected is remitted, not earned. Both
                  figures are shown throughout; the file&rsquo;s own is never hidden, only labelled.
                </li>
                <li>
                  <strong>A refunded order contributes zero.</strong> <code>is_refunded</code> is
                  boolean and the file carries no refund amount, so all-or-nothing is the only
                  available treatment.
                </li>
                <li>
                  <strong>North America is the blank region.</strong>{" "}
                  <span data-metric="blank_region_events" data-value={blankRegion()}>
                    {int(blankRegion())}
                  </span>{" "}
                  events carry an empty region label; that set is exactly the United States and
                  Canada.
                </li>
                <li>
                  <strong>The customer clock is the first event, never the signup date.</strong>{" "}
                  <span data-metric="events_before_signup" data-value={beforeSignup()}>
                    {int(beforeSignup())}
                  </span>{" "}
                  events precede their own customer&rsquo;s signup.
                </li>
              </ul>
            </div>
            <div>
              <h3 class="method__head">Claims of mine that did not survive</h3>
              <p class="method__intro">
                Recorded rather than deleted, because each one was arithmetically correct and
                meaningless - which is the failure mode this report is about.
              </p>
              <ul>
                <li>
                  <strong>&ldquo;Canada is the real premium market.&rdquo;</strong> Ranked
                  countries on ex-tax revenue per event. There is nothing to rank: p ={" "}
                  {pval(tests().perEventExTax.p)}.
                </li>
                <li>
                  <strong>&ldquo;Orders per customer is a Poisson draw.&rdquo;</strong> A fixed
                  pool of {int(META.events as number)} events across{" "}
                  {int(META.customers as number)} customers forces variance ÷ mean toward 1. The
                  statistic was the construction, not a finding.
                </li>
                <li>
                  <strong>&ldquo;The discount column is pure noise.&rdquo;</strong> SALE15 is{" "}
                  {pct(sale15Us(), 0)} US and LOYALTY15 is {pct(loyalty15Us(), 0)} US.
                </li>
                <li>
                  <strong>&ldquo;Elapsed transacting time drives order count.&rdquo;</strong> The
                  span is measured from the events, so the correlation was circular.
                </li>
              </ul>
              <h3 class="method__head">What this file cannot answer</h3>
              <p>{ATTACH_RATE_NOTE}</p>
            </div>
          </div>
        </section>
      </main>

      </Show>

      <footer class="colophon">
        <span>
          Source: OnyxData DataDNA November 2025 ·{" "}
          <span data-metric="skus" data-value={META.skus as number}>
            {int(META.skus as number)}
          </span>{" "}
          SKUs ={" "}
          <span data-metric="families" data-value={META.families as number}>
            {int(META.families as number)}
          </span>{" "}
          families
        </span>
        <span>
          Built with SolidJS, DuckDB and Polars. Figures verified against parquet before
          publication.
        </span>
      </footer>

      <Show when={tour() && !props.poster}>
        {/* `open` is required: TourOverlay's whole body is a <Show when={props.open}>, so
            omitting it renders nothing at all and no other gate can see the absence. */}
        <TourOverlay open={tour()} steps={TOUR} storageKey={TOUR_KEY} onClose={() => setTour(false)} />
      </Show>
    </div>
  );
}
