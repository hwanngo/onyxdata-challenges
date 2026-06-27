/**
 * 2026/06 - UK Fintech Neobank (Zephyr Bank).
 *
 * Nine numbered objects, read in order. Row heights were budgeted in .workbench/2026/06/design/direction.md
 * before any of this was written (2026/05's retro names discovering the budget at G6 as that
 * month's largest avoidable cost).
 */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { KpiTile, TourOverlay, filters, toggle, clearAll, type TourStep } from "@onyxdata/dna-kit";
import { Blocks, SortToggle } from "./charts/Blocks";
import {
  CustomerTable, FeeRule, FeeScatter, Intervals, KycPanel, RegionPanel, Scorecard,
} from "./charts/Panels";
import {
  apply, boot, claims, customers, feeRows, fees, gbp2, gbpSigned, headline, int, pct,
  rates, ready, regions, rateOf, SORT_NOTE, type SortKey,
} from "./data";

/* prose-number-ok: I1, I3, I6 - the tour narrates the three ledger findings in words. Every
   figure it quotes is tagged as a data-metric where it is charted: the row count as
   `transactions`, the cohort counts as `fraud_customers` and `rate.*.customers`, the
   clustering as `design_effect` and `se_inflation`, and the fee totals as
   `fee_gross_over_gbp` / `fee_gross_under_gbp` / `fee_net_variance_gbp`. */
const TOUR: TourStep[] = [
  {
    h: "1,500 marks. Twenty facts.",
    p: "The chart below draws every one of the 1,500 transactions, in 20 columns of 75 - one column per customer. Every column comes out a single solid colour, because transaction status never varies within a customer. Neither does the fraud flag, the failure reason, or the device.",
  },
  {
    h: "So every rate here has a denominator of 20",
    p: "The 20% fraud rate is 4 customers out of 20. The 35% decline rate is 7 of 20. With perfect clustering the design effect equals the cluster size, 75, so every standard error is 8.66 times wider than a 1,500-row calculation gives. The true interval on the fraud rate runs from 5.7% to 43.7%.",
  },
  {
    h: "device_type is customer_id mod 4",
    p: "Customer 1 is iOS, customer 2 is N/A, customer 3 is Android, customer 4 is Web, and then it repeats - five customers per value, with no exceptions. The brief asks twice which device fails most. It is a row number.",
  },
  {
    h: "The one thing that IS measured per transaction",
    p: "The fee. 725 of 1,500 rows break the rule, and unlike the rates it varies within a customer, so its effective sample is 30.5 rather than 20. Gross under-collection is 587.11 pounds and gross over-collection is 587.28, so the net variance report shows minus 17 pence and a clean bill.",
  },
  {
    h: "Try re-ordering the blocks",
    p: "Above the chart you can re-sort the columns by value, by status, or by raw customer id. The blocks stay solid in all three orders, which is how you know the pattern is not an artefact of the sorting. Click any column to filter the page to that customer; press the question-mark key to reopen this tour.",
  },
];

export default function Dashboard(props: { poster?: boolean }) {
  const [sort, setSort] = createSignal<SortKey>("value");
  const [picked, setPicked] = createSignal<number | null>(null);
  const [tourOpen, setTourOpen] = createSignal(false);
  const [failed, setFailed] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await boot();
      if (!props.poster && !localStorage.getItem("dna-2026-06-tour")) {
        setTourOpen(true);
        localStorage.setItem("dna-2026-06-tour", "1");
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

  const h = () => headline();
  const shown = createMemo(() => apply(customers(), filters()));
  const filtering = () => filters().length > 0;

  const onFilter = (field: string, value: string | number) => toggle(field, value);
  const isActive = (field: string, value: string | number) =>
    filters().some((f) => f.field === field && f.values.some((v) => String(v) === String(value)));

  const fraud = createMemo(() => rateOf(shown(), (c) => c.is_flagged_fraud));
  const failing = createMemo(() => rateOf(shown(), (c) => c.is_failing));

  const pickedCustomer = createMemo(() =>
    picked() === null ? null : customers().find((c) => c.customer_id === picked()) ?? null);

  return (
    <div class="page" classList={{ "page--poster": props.poster }}>
      {/* ① */}
      <header class="thesis">
        <h1 class="thesis__h">
          {/* prose-number-ok: I1 - the row count, tagged as `transactions` immediately below */}
          This file reports 1,500 transactions. {/* prose-number-ok: I1 */}
          <span class="thesis__em"> It contains 20 facts.</span>
        </h1>
        <p class="thesis__p">
          Status, fraud flag, failure reason and device never vary within a customer -{" "}
          <code>device_type</code> is literally <code>customer_id mod 4</code>. Every rate in
          this review is a fraction of twenty.
        </p>
        <p class="thesis__meta">
          <Show when={ready()} fallback={<span class="skel skel--line" />}>
            Zephyr Bank H1 2026 ·{" "}
            <span data-metric="transactions" data-value={h().transactions}>{int(h().transactions)}</span> rows ·{" "}
            <span data-metric="customers" data-value={h().customers}>{h().customers}</span> customers ·{" "}
            2026-01-01 - 2026-05-31 · GBP
          </Show>
        </p>
      </header>

      <Show when={failed()}>
        <p class="error" role="alert">Could not load the data: {failed()}</p>
      </Show>

      <Show when={!props.poster && filtering()}>
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
            {shown().length} of {h().customers ?? 20} customers
          </span>
        </div>
      </Show>

      {/* ② */}
      <section class="kpis" aria-label="Headline figures">
        <Show when={ready()} fallback={<For each={[1,2,3,4]}>{() => <div class="skel skel--kpi" />}</For>}>
          <KpiTile
            metric="customers"
            /* prose-number-ok: I3 - `transactions` and `se_inflation` are both tagged */
            label="customers, not 1,500 transactions - 8.66× wider standard errors"
            value={h().customers} display={`${h().customers}`}
          />
          <KpiTile
            metric="fraud_customers"
            label={filtering()
              ? `of ${shown().length} selected customers are flagged`
              /* prose-number-ok: I3 - the interval is rendered and tagged in panel 4 */
              : /* prose-number-ok: I3 */ `customers flagged - the "20% fraud rate" is [5.7%, 43.7%]`}
            value={filtering() ? fraud().k : h().fraud_customers}
            display={`${filtering() ? fraud().k : h().fraud_customers} of ${filtering() ? shown().length : 20}`}
          />
          <KpiTile
            metric="fee_rows_wrong"
            /* prose-number-ok: I6 - 1,500 is `transactions` in the provenance strip */
            label="transactions of 1,500 break the fee rule"
            value={h().fee_rows_wrong} display={int(h().fee_rows_wrong)}
          />
          <KpiTile
            metric="fee_net_variance_gbp"
            /* prose-number-ok: I6 - the gross total is tagged as fee_gross_total_gbp in panel 6 */
            label="net fee variance - hiding £1,174.39 of gross error"
            value={h().fee_net_variance_gbp} display={gbpSigned(h().fee_net_variance_gbp)}
          />
        </Show>
      </section>

      {/* ③ */}
      <section class="sig" aria-label="The Twenty Blocks">
        <h2 class="sec__h"><span class="sec__n">3</span> The Twenty Blocks</h2>
        <Show when={!props.poster && ready()}>
          <SortToggle value={sort()} onChange={setSort} note={SORT_NOTE[sort()]} />
        </Show>
        <Show when={ready()} fallback={<div class="skel skel--chart" />}>
          <Blocks customers={shown()} sort={sort()} poster={props.poster}
                  selected={picked()} onPick={setPicked} />
        </Show>
        <Show when={pickedCustomer()}>
          {(c) => (
            <p class="picked" role="status">
              <b>{c().customer_name}</b> - {c().customer_segment}, {c().region},{" "}
              {c().kyc_verified ? "KYC verified" : "NOT KYC verified"}. All{" "}
              {int(c().transactions)} of their transactions are <b>{c().transaction_status}</b>
              {c().is_flagged_fraud ? " and fraud-flagged" : ""}; device{" "}
              {c().device_type_raw ?? "N/A"} (id mod 4 = {c().customer_id_mod_4}); mean amount{" "}
              {gbp2(c().mean_amount_gbp)}.
              <button class="chip chip--clear" onClick={() => setPicked(null)}>Clear</button>
            </p>
          )}
        </Show>
      </section>

      {/* ④ ⑤ */}
      <section class="two" aria-label="Intervals and the KYC question">
        <div>
          <h2 class="sec__h"><span class="sec__n">4</span> What the pack says, and what the file supports</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <Intervals rates={rates()} headline={h()} />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">5</span> The KYC question cannot be answered</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <KycPanel customers={customers()} headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑥ ⑦ */}
      <section class="two" aria-label="The fee rule and the dictionary scorecard">
        <div>
          <h2 class="sec__h"><span class="sec__n">6</span> The one thing measured per transaction</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <FeeRule fees={fees()} headline={h()} />
          </Show>
        </div>
        <div>
          <h2 class="sec__h"><span class="sec__n">7</span> The dictionary, scored</h2>
          <Show when={ready()} fallback={<div class="skel skel--chart" />}>
            <Scorecard claims={claims()} headline={h()} />
          </Show>
        </div>
      </section>

      {/* ⑧ */}
      <section class="sowhat-block" aria-label="Recommendations">
        <h2 class="sec__h"><span class="sec__n">8</span> So what - three things to change</h2>
        <ol class="recs">
          <li>
            <b>Monitor gross absolute fee deviation, not net.</b> The current control shows{" "}
            <Show when={ready()} fallback="a clean bill">
              {gbpSigned(h().fee_net_variance_gbp)} ({pct(h().fee_net_variance_pct, 3)})
            </Show>{" "}
            while <Show when={ready()}>{gbp2(h().fee_gross_total_gbp)}</Show> sits on the wrong
            side of the rule. This is the one finding the data supports at transaction level, and
            it is actionable this quarter.
          </li>
          <li>
            {/* prose-number-ok: I3 - the counts and the interval are both rendered and
                tagged in panel 4; this restates them as the recommendation. */}
            <b>Report customer counts and intervals, not transaction rates.</b> {/* prose-number-ok: I3 */} "4 of 20
            customers flagged, [5.7%, 43.7%]" is the honest form of "20% fraud rate ±2pp". Every
            figure in this pack should carry the count behind it.
          </li>
          <li>
            <b>Do not re-tier merchants, target devices, or deprioritise KYC on this file.</b>{" "}
            Fix the extract first: one row per transaction, with status and fraud recorded per
            transaction rather than per customer.
          </li>
        </ol>
      </section>

      <Show when={!props.poster && ready()}>
        <section class="explore" aria-label="Explore further">
          <h2 class="sec__h">Explore</h2>
          <div class="explore-grid">
            <CustomerTable customers={customers()}
                           onPick={(id) => onFilter("customer_id", id)}
                           active={(id) => isActive("customer_id", id)} />
            <FeeScatter rows={feeRows()} />
            <RegionPanel regions={regions()} />
          </div>
        </section>
      </Show>

      {/* ⑨ */}
      <footer class="foot">
        <Show when={ready()}>
          <p>
            <b>{int(h().transactions)} rows · {h().customers} customers · 2026-01-01 - 2026-05-31.</b>{" "}
            Every figure is recomputed from parquet before publication, with assertions run
            against the raw CSVs on an independent path. The archive data dictionary is wrong in{" "}
            <b>{h().claims_false} of {h().claims_tested}</b> tested claims, listed in ⑦.
          </p>
          <p>
            No map is drawn: <b>{h().single_customer_regions} of the {h().regions}</b> UK regions
            hold exactly one customer. No monthly trend line is drawn: p ={" "}
            {(h().month_trend_p ?? 0).toFixed(2)} on five points. Both omissions are deliberate
            and are the finding, not a gap.
          </p>
          <p>
            WCAG 2.1 AA · keyboard-operable charts · every chart carries a screen-reader table ·
            block colours are directly labelled because two of the four statuses are
            indistinguishable in greyscale.
          </p>
        </Show>
      </footer>

      <Show when={!props.poster}>
        <button class="tour-btn" onClick={() => setTourOpen(true)} aria-label="Open the guided tour">
          <span aria-hidden="true">?</span>
        </button>
        <TourOverlay open={tourOpen()} onClose={() => setTourOpen(false)}
                     steps={TOUR} storageKey="dna-2026-06-tour" />
      </Show>
    </div>
  );
}
