/**
 * The report. Four panels, one argument.
 *
 * Reading order: thesis -> provenance strip (what is real) -> the one lever that works ->
 * the ones that don't -> the mirage -> so what. The strip comes BEFORE any ranking on
 * purpose: you should be told what is real before you are shown a league table.
 */
import { Show, createMemo, createSignal, onMount } from "solid-js";
import {
  Breadcrumb, ChartFigure, FilterChips, ThemeToggle, TourOverlay,
  drillInto, filters, tourAlreadySeen,
} from "@onyxdata/dna-kit";
import {
  allRows, boot, corpus, derived, etaSq, etaSqCross, etaSqWithin, formats, hashtagCells,
  hashtags, int, logViews, pct, platforms, provenance, rateOf, ready, regions, spreadPct,
} from "./data";
import { ProvenanceStrip, provenanceTable } from "./charts/Provenance";
import { RankBars, barsTable } from "./charts/RankBars";
import { Mirage, mirageTable } from "./charts/Mirage";
import { Explore } from "./components/Explore";
import { TOUR_KEY, tourSteps } from "./tour";

/**
 * How many `data-metric` marks each route carries. These are facts about the VERIFICATION
 * HARNESS, not about the dataset, so there is no SQL that could recompute them - they are
 * measured by running the harness and reading the tail of its output:
 *
 *   uv run python tools/verify_metrics.py 2025 06 --url http://localhost:5306
 *   uv run python tools/verify_metrics.py 2025 06 --url http://localhost:5306/poster
 *
 * Measured 2025-06-30; the run is filed in exports/qa/verify-metrics.txt. If you add or
 * remove a tagged figure, re-run both and update these two numbers - the colophon is
 * making a checkable claim about the report and it must stay checkable.
 */
const VERIFIED_LIVE = 39;
const VERIFIED_POSTER = 36;

// prose-number-ok: I-2 - analysis/insights.md. Kruskal-Wallis on views across the eight
// regions on all 5,600 rows: p = 0.2982, η² = 0.0018 on log(views). A test result has no
// bar, cell or tile whose value it is, and unlike the spread it qualifies it is a statement
// about the whole file rather than the current selection - so it is fixed prose with a
// ledger entry, not a mark. The spread beside it IS tagged and asserted.
// Reproduced by analysis/integrity.py and quoted in insights.md I-2.
const REGION_TEST =
  "on the same measure - not significant (Kruskal p = 0.30 on the full file). " +
  "Region is not a lever either.";

export default function Dashboard(props: { poster?: boolean }) {
  const [tourOpen, setTourOpen] = createSignal(false);
  const f = createMemo(() => filters());

  onMount(async () => {
    try {
      const t = localStorage.getItem("datadna-theme");
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch { /* ignore */ }
    await boot();
    if (!props.poster && !tourAlreadySeen(TOUR_KEY)) setTourOpen(true);
  });

  const prov = derived(provenance, f);
  const fmt = derived(formats, f);
  const plat = derived(platforms, f);
  const reg = derived(regions, f);
  const hash = derived((rs) => hashtags(rs), f);
  const hashCells = derived((rs) => hashtagCells(rs), f);

  /** The corpus, unfiltered - the masthead and colophon describe the file, not the view. */
  const corp = createMemo(() => corpus(allRows()));
  /** Format shares, keyed, so the recommendations quote the same objects the bars render. */
  const fmtBy = createMemo(() => new Map((fmt() ?? []).map((r) => [r.k, r])));
  const platSpread = createMemo(() => spreadPct((plat() ?? []).map((r) => r.med_views)));
  /** Share of the variance in log(views) that platform accounts for - recomputed under the
   *  filter set, like every other figure. Verified in metric_checks.yml unfiltered. */
  const platEta = derived((rs) => 100 * etaSq(rs, "platform", logViews), f);
  /** The two halves of the mirage, as effect sizes: hashtag on the rate pooled, then the
   *  same thing measured inside each content category. Both verified in metric_checks.yml. */
  const mirageEta = derived((rs) => etaSq(rs, "main_hashtag", rateOf), f);
  const mirageEtaWithin = derived(
    (rs) => etaSqWithin(rs, "content_category", "main_hashtag", rateOf), f,
  );
  /** The same argument as a model comparison: what each factor adds to the other. The
   *  saturated (category × hashtag) R² minus each one-way R². Both verified in
   *  metric_checks.yml; the asymmetry between them is the finding. */
  const mirageIncHashtag = derived(
    (rs) => etaSqCross(rs, "content_category", "main_hashtag", rateOf)
            - etaSq(rs, "content_category", rateOf), f,
  );
  const mirageIncCategory = derived(
    (rs) => etaSqCross(rs, "content_category", "main_hashtag", rateOf)
            - etaSq(rs, "main_hashtag", rateOf), f,
  );
  const videoImage = createMemo(() => {
    const v = fmtBy().get("Video")?.med_views ?? 0;
    const i = fmtBy().get("Image")?.med_views ?? 0;
    return i ? v / i : 0;
  });

  return (
    <div class="shell">
      <Show when={!props.poster}>
        {/* The tour quotes the same numbers the panels render, so it is built FROM them
            rather than transcribed - a transcription is the one thing that can drift. */}
        <TourOverlay open={tourOpen()} onClose={() => setTourOpen(false)}
                     steps={tourSteps(fmt(), plat())} storageKey={TOUR_KEY} />
      </Show>

      <header class="masthead">
        <div style={{ display: "flex", "justify-content": "space-between", gap: "16px", "align-items": "start" }}>
          <h1>Only one number in this file is real</h1>
          <div class="toolbar live-only">
            <button class="btn" aria-label="Open guided tour" onClick={() => setTourOpen(true)}>? Tour</button>
            <ThemeToggle />
          </div>
        </div>
        <p class="standfirst">
          Views is the only metric that was measured. Impressions, engagement and the engagement
          rate are derived from it or drawn from a label - and the thing that moves views is the
          format you publish, not the platform, the region or the hour.
        </p>
        <div class="contextstrip">
          <span>Onyx Data DataDNA · June 2025</span>
          <Show when={ready()} fallback={<span>loading...</span>}>
            <span data-metric="total_posts" data-value={corp().posts}>
              {int(corp().posts)} posts
            </span>
            <span>
              <span data-metric="n_platforms" data-value={corp().platforms}>
                {corp().platforms}
              </span>{" platforms · "}
              <span data-metric="n_regions" data-value={corp().regions}>
                {corp().regions}
              </span>{" countries · "}
              <span data-metric="n_formats" data-value={corp().formats}>
                {corp().formats}
              </span>{" formats"}
            </span>
          </Show>
          <span>Jan 2024 - May 2025</span>
        </div>
      </header>

      <FilterChips
        hint="Nothing filtered - click any format, platform or hashtag to cross-filter the report."
        labels={{
        post_type: "Format", platform: "Platform", region: "Region",
        content_category: "Category", main_hashtag: "Hashtag", content_type: "Type",
        day_name: "Day", post_hour: "Hour",
      }} />

      {/* ---------------- [1] the signature element ---------------- */}
      <section class="panel">
        <h2 class="panel__title">1 · What is actually measured here</h2>
        <p class="panel__sub">
          The five headline metrics, with the origin of each. Three of them are not observations.
        </p>
        <Show when={prov()} fallback={<Skeleton h={220} />}>
          <ChartFigure
            id="provenance"
            caption="Three of the four numbers a social dashboard normally opens with are derived from the fourth, or drawn from a label."
            {...provenanceTable(prov()!)}
          >
            <ProvenanceStrip data={prov()!} poster={props.poster} />
          </ChartFigure>
        </Show>
      </section>

      <div class="grid-main">
        {/* ---------------- [2] the one real lever ---------------- */}
        <section class="panel">
          <h2 class="panel__title">2 · Format is the lever</h2>
          <p class="panel__sub">
            Median views by format - ranked on the one measured metric.
            <span class="live-only"> Click a format to cross-filter; Enter drills in.</span>
          </p>
          <Show when={fmt()} fallback={<Skeleton h={280} />}>
            <ChartFigure
              id="formats"
              caption={
                `Video earns ${videoImage().toFixed(1)}× the median views of an image: ` +
                `${pct(fmtBy().get("Video")?.post_share ?? 0)} of posts returning ` +
                `${pct(fmtBy().get("Video")?.view_share ?? 0)} of all views. ` +
                `Live Stream costs the most to produce and returns the least.`
              }
              {...barsTable(fmt()!, "Format")}
            >
              <RankBars data={fmt()!} field="post_type" poster={props.poster}
                        onDrill={(k) => drillInto("post_type", k)} />
            </ChartFigure>
          </Show>
        </section>

        <div class="col-right">
          {/* ---------------- [3] the ones that aren't ---------------- */}
          <section class="panel">
            <Breadcrumb />
            <h2 class="panel__title">3 · Placement is not</h2>
            {/* The spread and the η² are stated here ONCE, as tagged marks, and deliberately
                not repeated in the figure caption below. A caption is a template string, so a
                number interpolated into it is invisible to both verify_metrics (no DOM mark)
                and lint_prose_numbers (no literal to see) - the exact blind spot this month's
                audit was about. Anything quantitative in this panel lives in a span. */}
            <p class="panel__sub">
              Median views by platform.{" "}
              <Show when={plat() && platEta() !== undefined}>
                {plat()!.length} platforms,{" "}
                <span data-metric="platform_spread_pct" data-value={platSpread()}>
                  {pct(platSpread())}
                </span>{" "}
                apart - platform explains{" "}
                <span data-metric="platform_eta2_logviews_pct" data-value={platEta()!}>
                  {pct(platEta()!)}
                </span>{" "}
                of the variance in views.
              </Show>
            </p>
            <Show when={plat()} fallback={<Skeleton h={200} />}>
              <ChartFigure
                id="platforms"
                caption={
                  `No platform outperforms: the best and worst of ${plat()!.length} ` +
                  `sit ${pct(platSpread())} apart on median views.`
                }
                {...barsTable(plat()!, "Platform")}
              >
                <RankBars data={plat()!} field="platform" poster={props.poster}
                          onDrill={(k) => drillInto("platform", k)} />
              </ChartFigure>
            </Show>
            <Show when={reg()}>
              <p class="pv-why" style={{ "margin-top": "6px" }}>
                {reg()!.length} regions span{" "}
                <span data-metric="region_spread_pct" data-value={spreadPct(reg()!.map((r) => r.med_views))}>
                  {pct(spreadPct(reg()!.map((r) => r.med_views)))}
                </span>{" "}
                {REGION_TEST}
              </p>
            </Show>
          </section>

          {/* ---------------- [4] the mirage ---------------- */}
          <section class="panel">
            <h2 class="panel__title">4 · The hashtag mirage</h2>
            <p class="panel__sub">
              Rank hashtags and they look like a lever.
              <span class="live-only"> Press the second button and watch the effect disappear.</span>
            </p>
            <Show
              when={hash() && hashCells() && mirageEta() !== undefined
                    && mirageEtaWithin() !== undefined && mirageIncHashtag() !== undefined
                    && mirageIncCategory() !== undefined}
              fallback={<Skeleton h={240} />}
            >
              <ChartFigure
                id="mirage"
                caption="Ranking hashtags recovers the content tier, not hashtag effectiveness: measured within a category, every hashtag performs the same."
                {...mirageTable(hash()!, hashCells()!)}
              >
                <Mirage data={hash()!} cells={hashCells()!} poster={props.poster}
                        eta={mirageEta() ?? 0} etaWithin={mirageEtaWithin() ?? 0}
                        incHashtag={mirageIncHashtag() ?? 0}
                        incCategory={mirageIncCategory() ?? 0} />
              </ChartFigure>
            </Show>
          </section>
        </div>
      </div>

      {/* ---------------- [5] so what ---------------- */}
      <section class="panel">
        <h2 class="panel__title">So what</h2>
        <div class="sowhat">
          <div class="sowhat__item">
            <div class="sowhat__n">01</div>
            <p class="sowhat__h">Move production budget from live streams to video</p>
            <Show when={fmt()} fallback={<p class="sowhat__b">...</p>}>
              <p class="sowhat__b">
                Live Stream is{" "}
                <Share row={fmtBy().get("Live Stream")} k="Live Stream" m="post_share" /> of
                output for{" "}
                <Share row={fmtBy().get("Live Stream")} k="Live Stream" m="view_share" /> of
                views and the lowest median of any format. Video is{" "}
                <Share row={fmtBy().get("Video")} k="Video" m="post_share" /> of output for{" "}
                <Share row={fmtBy().get("Video")} k="Video" m="view_share" /> of views.
              </p>
            </Show>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">02</div>
            <p class="sowhat__h">Stop optimising the platform mix and the calendar</p>
            <Show when={plat()} fallback={<p class="sowhat__b">...</p>}>
              <p class="sowhat__b">
                {plat()!.length} platforms sit within{" "}
                <span data-metric="platform_spread_pct" data-value={platSpread()}>
                  {pct(platSpread())}
                </span>{" "}
                of each other, region is not significant, and no hour or weekday outperforms.
                That effort buys nothing.
              </p>
            </Show>
          </div>
          <div class="sowhat__item">
            <div class="sowhat__n">03</div>
            <p class="sowhat__h">Don't set strategy from this engagement rate - instrument clicks</p>
            <Show when={ready()} fallback={<p class="sowhat__b">...</p>}>
              <p class="sowhat__b">
                The rate is a synthetic label. The one genuinely missing measurement is clicks
                on YouTube, X.com and Instagram -{" "}
                <span data-metric="no_click_share_pct" data-value={corp().no_click_share}>
                  {pct(corp().no_click_share, 0)}
                </span>{" "}
                of posts carry no click count at all.
              </p>
            </Show>
          </div>
        </div>
      </section>

      <Explore filters={f} />

      <footer class="colophon">
        <strong>Source:</strong> Onyx Data DataDNA June 2025 - Social Media Content Performance.{" "}
        <Show when={ready()}>
          <span data-metric="total_posts" data-value={corp().posts}>{int(corp().posts)}</span>
          {" posts, "}
        </Show>
        one row per post, 2024-01-01 to 2025-05-01. <strong>Note:</strong> the brief
        describes four platforms and a 2024 dataset; the file contains <em>six</em> platforms
        (YouTube is the largest) and <em>seventeen</em> months. This report uses what the data
        contains. <strong>Method:</strong> Polars → Parquet star schema → Malloy semantic model
        (12 views) → row-level aggregation in the browser at query time. Nothing is precomputed.{" "}
        <strong>What is verified - and what is not:</strong> every figure carrying a{" "}
        <code>data-metric</code> attribute is scraped from the rendered DOM and re-asserted
        against a DuckDB recomputation of the parquet, zero tolerance - {VERIFIED_LIVE} marks
        on the report, {VERIFIED_POSTER} on the poster. That is not every number here: a
        statistic belonging to no single bar (a p-value, an η²) cannot be checked that way, so
        each names an entry in the insight ledger carrying its query and caveat, and{" "}
        <code>lint_prose_numbers.mjs</code> fails the build on any that does neither. 21 model
        assertions pass. <strong>Accessibility:</strong> WCAG 2.1 AA - charts are
        keyboard-operable and exposed as screen-reader data tables, and the measured/derived
        distinction is carried by colour, hatch pattern <em>and</em> text, so it survives
        greyscale and colour-vision deficiency. <strong>Caveats:</strong> the engagement rate is
        drawn from fixed bands and cannot support content recommendations; click-through is
        recorded on{" "}
        <Show when={ready()}>
          <span data-metric="prov.click_coverage" data-value={corp().click_coverage}>
            {pct(corp().click_coverage)}
          </span>
        </Show>{" "}
        of posts and its absence is <em>almost</em> a rule - two LinkedIn formats carry it on
        some posts and not others (ledger I-5); Carousel (n=51) and PDF (n=16) are not rankable.
      </footer>
    </div>
  );
}

/** A format's share of posts or of views, quoted in the recommendations and tagged so the
 *  recommendation and the bar above it cannot disagree. */
function Share(props: {
  row?: { post_share: number; view_share: number };
  k: string;
  m: "post_share" | "view_share";
}) {
  const v = () => props.row?.[props.m] ?? 0;
  return (
    <span data-metric={`post_type.${props.k}.${props.m}`} data-value={v()}>
      {pct(v())}
    </span>
  );
}

/** Loading skeleton - never a placeholder number. */
function Skeleton(props: { h: number }) {
  return (
    <div aria-hidden="true" style={{
      height: `${props.h}px`,
      background: "repeating-linear-gradient(180deg, var(--bg-sunken) 0 14px, transparent 14px 26px)",
      opacity: 0.6,
    }} />
  );
}
