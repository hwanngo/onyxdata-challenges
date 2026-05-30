/**
 * 2026/05 - Music Streaming Platform Performance.
 *
 * Eleven numbered objects with a mandatory reading order (design/wireframe.md). The
 * numbering is not decoration: ④ must be read before ⑤, because ④ is what establishes the
 * cohort split by measured behaviour and so earns the right to rename the vendor's
 * `is_fraud_cluster` and to draw conclusions from the cohort at all.
 */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { KpiTile, TourOverlay, filters, toggle, clearAll, type TourStep } from "@onyxdata/dna-kit";
import { Crossing, BasisToggle } from "./charts/Crossing";
import {
  AxisPanel, ChurnPanel, CohortShape, CohortValue, DefectLedger,
  GrowthQuality, OverIndex, PayoutCliff, RevenueScale,
} from "./charts/Panels";
import {
  apply, artists, axes, boot, cohort, churn, cube, defects, dow, duration, flags,
  genreCountry, headline, int, mrr, pct, pctRaw, postChurn, ready, threshold, total, usd2,
  BASES, BASIS_NOTE, type Basis,
} from "./data";

/* A FUNCTION of the data, not a literal. 2025/08 shipped a tour claiming "981 of the 982"
   while the KPI behind it rendered 982; 2026/05 shipped "9.5 ... against 22.5" while the panel
   beneath it rendered 9.4 and 22.5. A tour step that restates a number will eventually
   disagree with it, so the number is interpolated from the same row the panel draws. */
const tour = (rc: any, br: any): TourStep[] => [
  {
    h: "Nine of the top ten artists are not really there",
    p: "The chart on this page joins each artist's rank by total plays to its rank once repeat-concentrated listening is corrected for. Mariah Carey falls from 1 to 264. Shaggy rises from 10 to 1. Only one of the top ten survives.",
  },
  {
    h: "Why this page does not say 'fraud'",
    p: "The source column is called is_fraud_cluster and it flags half of all users - a prevalence no real fraud population has, arriving with no evidence behind it. What is actually measured is repetition: " + (rc?.tracks_at_30 ?? 0).toFixed(1) + " distinct tracks per 30 plays against " + (br?.tracks_at_30 ?? 0).toFixed(1) + ". So the cohort is named for that instead.",
  },
  {
    h: "And why you cannot simply remove them",
    // prose-number-ok: I4, I3 - the LTV interval and the single-account share, in narrative
    // form. Both are tagged as data-metric where they are charted, in panel 5. The word
    // "equivalence" used to sit here and in the copy; p = 0.19 at 38.6% power is not
    // equivalence, and the integrity pass found five surfaces reading it as such.
    p: "These accounts are worth $161.52 against $179.17 - a gap this test cannot resolve, and the data still allows anything from 21% worse to 2% better, so neither 'they are worth less' nor 'they are worth the same' is supported. One single account supplies 87.5% of the top artist's repeat plays, so there is no ring to shut down either. The only available lever is how plays are counted.",
  },
  {
    h: "The same failure, in money",
    // prose-number-ok: I5, I7 - the payout cliff and the revenue-scale figures, both tagged
    // where they are charted, in panels 6 and 7.
    p: "The royalty qualifies at 30 seconds, and 46.9% of all plays land in the 30 to 44 second band. Drag the threshold slider in panel 6: two seconds moves 15.1% of the bill. Meanwhile the column named revenue totals $852 against $167,647 of real subscription revenue, and it adds ad income to royalty cost.",
  },
  {
    h: "A third of growth is the back office",
    // prose-number-ok: I6 - the MRR split, tagged where it is charted, in panel 8.
    p: "Of $8,143.50 net MRR added over four years, $2,648.24 carries the reconciliation label - which appears on upgrades and downgrades only, never on a signup or a churn. Customer-driven growth is $5,495.26.",
  },
  {
    h: "Try the basis toggle",
    p: "Above the chart you can recompute the ranking three ways: remove the cohort, rarefy every listener to 30 plays, or cap each listener at 50 plays per artist. The braid stays braided under all three. Click any artist to inspect it; press the question-mark key to reopen this tour.",
  },
];

export default function Dashboard(props: { poster?: boolean }) {
  const [basis, setBasis] = createSignal<Basis>("clean");
  const [cut, setCut] = createSignal(30);
  const [picked, setPicked] = createSignal<number | null>(null);
  const [tourOpen, setTourOpen] = createSignal(false);
  const [failed, setFailed] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await boot();
      if (!props.poster && !localStorage.getItem("dna-2026-05-tour")) {
        setTourOpen(true);
        localStorage.setItem("dna-2026-05-tour", "1");
      }
    } catch (e) {
      setFailed(String(e));
    }
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "?" && !props.poster) setTourOpen(true);
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  const cells = createMemo(() => apply(cube(), filters()));
  const t = createMemo(() => total(cells()));
  const h = () => headline();

  /* Cross-filter plumbing. Every visual must both EMIT and CONSUME - a chart that filters
     others but does not respond to them scores nothing. The QA harness caught this: with the
     KPI strip reading straight from `headline`, five clicks landed and no rendered figure
     ever moved, and it reported the cross-filter as broken. It was. */
  const onFilter = (field: string, value: string | number) => toggle(field, value);
  const isActive = (field: string, value: string | number) =>
    filters().some(
      (f) => f.field === field && f.values.some((v) => String(v) === String(value))
    );

  /* Two of the four KPIs are exact sums over the filtered cube, so they move with any
     selection. The other two are listener-level (lifetime value) and rank-level (the top-ten
     overlap); neither is expressible as a sum over session cells, so they stay global and the
     label says so rather than silently showing an unfiltered number next to filtered ones. */
  const filteredShare = createMemo(() => {
    const all = t();
    if (!all.plays) return null;
    const rc = cells().filter((c) => c.is_repeat_concentrated)
      .reduce((a, c) => a + c.plays, 0);
    return rc / all.plays;
  });
  const filteredBand = createMemo(() => {
    const all = t();
    return all.plays ? all.band / all.plays : null;
  });
  const filtering = () => filters().length > 0;

  const pickedArtist = createMemo(() =>
    picked() === null ? null : artists().find((a) => a.artist_id === picked()) ?? null
  );

  const rankOnBasis = (a: any) =>
    basis() === "clean" ? a.rank_clean : basis() === "rarefied" ? a.rank_rarefied : a.rank_capped;

  return (
    <div class="page" classList={{ "page--poster": props.poster }}>
      {/* ① thesis */}
      <header class="thesis">
        <h1 class="thesis__h">
          Nine of the top ten artists are there because of 482 accounts -
          <span class="thesis__em"> and they are paying customers you cannot ban.</span>
        </h1>
        <p class="thesis__p">
          Every headline number in this business is set by a counting rule rather than by the
          music: who counts as a listener, where a play becomes payable, and whether the back
          office counts as growth.
        </p>
        <p class="thesis__meta">
          <Show when={ready()} fallback={<span class="skel skel--line" />}>
            <span data-metric="users" data-value={h().users}>{int(h().users)}</span> listeners ·{" "}
            <span data-metric="sessions" data-value={h().sessions}>{int(h().sessions)}</span> plays ·{" "}
            <span data-metric="tracks_played" data-value={h().tracks_played}>{int(h().tracks_played)}</span> tracks played ·{" "}
            <span data-metric="markets" data-value={h().markets}>{int(h().markets)}</span> markets ·
            {" "}2021-01-01 - 2024-12-31
          </Show>
        </p>
      </header>

      <Show when={failed()}>
        <p class="error" role="alert">Could not load the data: {failed()}</p>
      </Show>

      {/* filter chips - live only */}
      <Show when={!props.poster && filters().length > 0}>
        <div class="chips">
          <span class="chips__lab">Filtered:</span>
          <For each={filters()}>
            {(f) => (
              <For each={f.values}>
                {(v) => (
                  <button class="chip" onClick={() => toggle(f.field, v)}>
                    {String(v)} <span aria-hidden="true">×</span>
                    <span class="sr-only">remove filter</span>
                  </button>
                )}
              </For>
            )}
          </For>
          <button class="chip chip--clear" onClick={clearAll}>Clear all</button>
          <span class="chips__n">
            {int(t().plays)} of {int(h().sessions ?? 0)} plays
          </span>
        </div>
      </Show>

      {/* ② KPI strip */}
      <section class="kpis" aria-label="Headline figures">
        <Show
          when={ready()}
          fallback={<For each={[1, 2, 3, 4]}>{() => <div class="skel skel--kpi" />}</For>}
        >
          <KpiTile
            metric="top10_overlap"
            label={
              filtering()
                ? "of the top ten survive - a ranking over all plays, not this filter"
                : "of the top ten artists survive the correction"
            }
            value={h().top10_overlap}
            display={`${h().top10_overlap} of 10`}
          />
          <KpiTile
            metric="repeat_concentrated_session_share"
            label={
              filtering()
                ? "of the SELECTED plays come from the repeat-concentrated cohort"
                : `${pct(h().repeat_concentrated_user_share)} of listeners make this share of the plays`
            }
            value={filteredShare() ?? h().repeat_concentrated_session_share}
            display={pct(filteredShare() ?? h().repeat_concentrated_session_share)}
          />
          <KpiTile
            metric="ltv_flagged_usd"
            /* prose-number-ok: I4 - the comparison value; ltv_clean_usd is tagged in panel 5 */
            label={
              filtering()
                ? "their lifetime value - a listener-level figure, not affected by this filter"
                : "their lifetime value, against $179.17 - not a distinguishable gap"
            }
            value={h().ltv_flagged_usd}
            display={usd2(h().ltv_flagged_usd)}
          />
          <KpiTile
            metric="band_share"
            label={
              filtering()
                ? "of the SELECTED plays sit in the 30-44s payout band"
                : "of plays sit in the 30-44s payout band"
            }
            value={filteredBand() ?? h().band_share}
            display={pct(filteredBand() ?? h().band_share)}
          />
        </Show>
      </section>

      {/* ③ signature */}
      <section class="sig" aria-label="The Crossing">
        <h2 class="sec__h"><span class="sec__n">3</span> The Crossing</h2>
        <Show when={!props.poster && ready()}>
          <BasisToggle value={basis()} onChange={setBasis} bases={BASES} note={BASIS_NOTE[basis()]} />
        </Show>
        <Show when={ready()} fallback={<div class="skel skel--chart" />}>
          <Crossing
            artists={artists()}
            basis={basis()}
            poster={props.poster}
            selected={picked()}
            onPick={setPicked}
          />
        </Show>
        <Show when={pickedArtist()}>
          {(a) => (
            <p class="picked" role="status">
              <b>{a().artist_name}</b> ({a().genre_name}) - rank{" "}
              <b class="num">{a().rank_all}</b> by all plays ({int(a().plays_all)}), rank{" "}
              <b class="num">{rankOnBasis(a())}</b> corrected. {int(a().plays_flagged)} of its
              plays come from the cohort, across {int(a().flagged_listeners ?? 0)} listeners.
              <button class="chip chip--clear" onClick={() => setPicked(null)}>Clear</button>
            </p>
          )}
        </Show>
      </section>

      {/* ④ then ⑤ - the order is load-bearing */}
      <section class="two" aria-label="What the cohort is, and what it is worth">
        <div>
          <h2 class="sec__h"><span class="sec__n">4</span> It is not a crime, it is a shape</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <CohortShape
              cohort={cohort()} flags={flags()} headline={h()}
              poster={props.poster} onFilter={onFilter} active={isActive}
            />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">5</span> Neither a farm nor a loss</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <CohortValue artists={artists()} cohort={cohort()} headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑥ ⑦ ⑧ - the same failure, three more times, in money */}
      <section class="three" aria-label="The same failure in money">
        <div>
          <h2 class="sec__h"><span class="sec__n">6</span> The 30-second cliff</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <PayoutCliff
              duration={duration()} threshold={threshold()} headline={h()}
              cut={cut()} onCut={setCut} poster={props.poster}
            />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">7</span> The column called revenue</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <RevenueScale headline={h()} />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">8</span> A third of growth is the back office</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <GrowthQuality mrr={mrr()} headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑨ */}
      <section class="wide" aria-label="What moves listening">
        <h2 class="sec__h">
          <span class="sec__n">9</span> What moves listening, and what everyone slices by instead
        </h2>
        <Show when={ready()} fallback={<div class="skel skel--chart" />}>
          <AxisPanel
            axes={axes()} flags={flags()} dow={dow()} headline={h()}
            onFilter={onFilter} active={isActive}
          />
        </Show>
      </section>

      {/* ⑩ so what */}
      <section class="sowhat-block" aria-label="Recommendations">
        <h2 class="sec__h"><span class="sec__n">10</span> So what - three things to change</h2>
        <ol class="recs">
          <li>
            <b>Cap plays per listener per artist before ranking.</b> Licensing and editorial
            currently run off a table in which nine of the top ten are one cohort's repeats.
            The capped basis on the chart above <em>is</em> the corrected table; it is already
            computed.
          </li>
          <li>
            <b>Do not ban - re-weight.</b> Keep the{" "}
            <Show when={ready()} fallback="lifetime value">{usd2(h().ltv_flagged_usd)}</Show>.
            Bound the influence on ranking, recommendation and royalty attribution:{" "}
            <Show when={ready()} fallback="most">{pct(h().royalty_flagged_share)}</Show> of the
            royalty bill is attributed to this cohort's listening.
          </li>
          <li>
            <b>Report two numbers where you now report one.</b> Split Free-tier ad income from
            paid-tier royalty cost, and state MRR growth net of reconciliation:{" "}
            <Show when={ready()} fallback="the customer-driven figure">
              {usd2(h().customer_net_mrr_usd)}
            </Show>{" "}
            customer-driven, not{" "}
            <Show when={ready()} fallback="the reported one">{usd2(h().net_mrr_usd)}</Show>.
          </li>
        </ol>
      </section>

      {/* web-only exploration */}
      <Show when={!props.poster && ready()}>
        <section class="explore" aria-label="Explore further">
          <h2 class="sec__h">Explore</h2>
          <div class="explore-grid">
            <OverIndex genreCountry={genreCountry()} onFilter={onFilter} active={isActive} />
            <ChurnPanel churn={churn()} postChurn={postChurn()} />
            <DefectLedger defects={defects()} headline={h()} />
          </div>
        </section>
      </Show>

      {/* ⑪ footer */}
      <footer class="foot">
        <Show when={ready()}>
          <p>
            <b>{int(h().sessions)} plays · 2021-01-01 - 2024-12-31.</b> Every figure is
            recomputed from parquet before publication, with 33 assertions run against the raw
            CSVs on an independent path. The archive's data dictionary is{" "}
            <b>true in {h().dictionary_claims_held} of {h().dictionary_claims_tested}</b> tested
            claims; the four failures are listed in the report.
          </p>
          <p>
            The cohort on this page is named for its <b>measured behaviour</b>. The source column
            is <code>is_fraud_cluster</code>; it flags {pct(h().repeat_concentrated_user_share)}{" "}
            of all users, arrives unadjudicated, and this page treats it as an observed listening
            pattern rather than a finding of wrongdoing.
          </p>
          <p>
            No map is drawn: country explains{" "}
            {pctRaw(100 * (axes().find((a) => a.axis === "Country")?.eta_squared ?? 0), 2)} of
            listening depth. WCAG 2.1 AA · keyboard-operable charts · every chart carries a
            screen-reader table.
          </p>
        </Show>
      </footer>

      <Show when={!props.poster}>
        <button class="tour-btn" onClick={() => setTourOpen(true)} aria-label="Open the guided tour">
          <span aria-hidden="true">?</span>
        </button>
        <TourOverlay
          open={tourOpen()}
          onClose={() => setTourOpen(false)}
          steps={tour(cohort().find((c: any) => c.is_repeat_concentrated),
                      cohort().find((c: any) => !c.is_repeat_concentrated))}
          storageKey="dna-2026-05-tour"
        />
      </Show>
    </div>
  );
}
