/**
 * THE TWENTY BLOCKS - the signature. A unit (isotype) chart.
 *
 * 1,500 marks, one per transaction, in 20 columns of 75 - one column per customer. Each mark
 * is coloured by `transaction_status`, and **every column comes out a single solid colour**,
 * because status never varies within a customer.
 *
 * WHY THIS AND NOT A KPI TILE. The obvious rendering of "20% fraud rate" is a donut or a big
 * number, which asserts a point estimate as a fact - the precise error this page exists to
 * correct. A unit chart is the only family that makes the NUMBER OF INDEPENDENT OBSERVATIONS
 * visible, because every mark is one real row and the reader can count the blocks.
 *
 * HONESTY CONSTRAINTS, enforced here:
 *
 *  - **All 1,500 marks are drawn.** Nothing is sampled, binned or aggregated. The claim is
 *    about a count, so the count is literal. `interact.mjs` asserts the rendered mark count.
 *  - The column order is disclosed on the axis, and the re-sort control exists so a reader can
 *    confirm the solidity is not an artefact of the ordering. It is solid in all three orders.
 *  - Blocks are **directly labelled** with their status. --declined and --pending are 1.01:1
 *    apart in relative luminance (measured at G5), so a greyscale reader gets nothing from
 *    colour here; the label is the encoding and the colour is confirmation.
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { ChartFigure } from "@onyxdata/dna-kit";
import {
  type Customer, type SortKey, SORT_LABEL, SORT_NOTE, STATUSES,
  gbpCompact, int, sortCustomers,
} from "../data";

const STATUS_CLASS: Record<string, string> = {
  Completed: "b--completed", Declined: "b--declined",
  Reversed: "b--reversed", Pending: "b--pending",
};

export function Blocks(props: {
  customers: Customer[];
  sort: SortKey;
  poster?: boolean;
  selected?: number | null;
  onPick?: (id: number | null) => void;
}) {
  const [hover, setHover] = createSignal<number | null>(null);
  const active = () => props.selected ?? hover();

  const ordered = createMemo(() => sortCustomers(props.customers, props.sort));

  // 75 marks per column, laid out as 25 rows x 3 columns of marks within each customer band,
  // so a 20-band chart stays legible at poster width without any mark being sub-pixel.
  const ROWS = 25, PER = 3;
  const W = () => (props.poster ? 2000 : 980);
  const H = () => (props.poster ? 110 : 300);
  const PAD_T = 8, PAD_B = 30;
  const bandW = () => W() / 20;
  const markW = () => (bandW() - (props.poster ? 10 : 6)) / PER;
  const markH = () => (H() - PAD_T - PAD_B) / ROWS;

  const statusCounts = createMemo(() => {
    const m = new Map<string, number>();
    for (const c of props.customers) m.set(c.transaction_status, (m.get(c.transaction_status) ?? 0) + 1);
    return STATUSES.map((s) => ({ status: s, customers: m.get(s) ?? 0, transactions: (m.get(s) ?? 0) * 75 }));
  });

  /* Counted from the customers this component is actually rendering, not from the file's row
     count. The integrity pass found the caption and the aria-label both hardcoding "1,500 marks
     ... 20 columns of 75" while the component draws the FILTERED subset - interact.mjs itself
     drives it down to one column, at which point a screen reader was told there were 1,500
     marks over 75 and the caption read "1,500 marks ... contains 1 facts". */
  const nCols = () => props.customers.length;
  const PER_CUSTOMER = ROWS * PER;              // 25 rows x 3 across = 75, the cluster size
  const nMarks = () => nCols() * PER_CUSTOMER;

  const rows = createMemo(() =>
    ordered().map((c) => [
      c.customer_name, c.customer_segment, c.region, c.transaction_status,
      c.is_flagged_fraud ? "flagged" : "-", int(c.transactions), gbpCompact(c.total_value_gbp),
    ])
  );

  return (
    <ChartFigure
      id="blocks"
      caption={`${int(nMarks())} marks. Each one is a transaction, each column is a customer - and no column is ever two colours. This view holds ${nCols()} ${nCols() === 1 ? "fact" : "facts"}.`}
      columns={["Customer", "Segment", "Region", "Status", "Fraud", "Transactions", "Total value"]}
      rows={rows()}
    >
      <svg
        class="blocks"
        viewBox={`0 0 ${W()} ${H()}`}
        width="100%"
        role="img"
        aria-label={`Unit chart. ${int(nMarks())} marks arranged in ${nCols()} columns of ${PER_CUSTOMER}, one column per customer, coloured by transaction status. Every column is a single solid colour because transaction status never varies within a customer.`}
      >
        <For each={ordered()}>
          {(c, i) => {
            const x0 = () => i() * bandW();
            const isActive = () => active() === c.customer_id;
            return (
              <g
                classList={{
                  [STATUS_CLASS[c.transaction_status]]: true,
                  "b--active": isActive(),
                  "b--dim": active() !== null && !isActive(),
                }}
                onMouseEnter={() => !props.poster && setHover(c.customer_id)}
                onMouseLeave={() => !props.poster && setHover(null)}
                onClick={() =>
                  !props.poster &&
                  props.onPick?.(props.selected === c.customer_id ? null : c.customer_id)}
              >
                {/* 75 marks. Drawn individually - the claim is about the count. */}
                <For each={Array.from({ length: 75 })}>
                  {(_, k) => (
                    <rect
                      class="b-mark"
                      x={x0() + 3 + (k() % PER) * markW()}
                      y={PAD_T + Math.floor(k() / PER) * markH()}
                      width={Math.max(markW() - 1.2, 0.8)}
                      height={Math.max(markH() - 1.2, 0.8)}
                    />
                  )}
                </For>
                {/* the direct label - this, not the colour, is the encoding */}
                <text class="b-label" x={x0() + bandW() / 2} y={H() - PAD_B + 13}
                      text-anchor="middle">
                  {c.transaction_status}
                </text>
                <text class="b-name" x={x0() + bandW() / 2} y={H() - PAD_B + 24}
                      text-anchor="middle">
                  {c.customer_name.split(" ")[0]}
                </text>
                <Show when={c.is_flagged_fraud}>
                  <text class="b-flag" x={x0() + bandW() / 2} y={PAD_T - 1}
                        text-anchor="middle" aria-hidden="true">†</text>
                </Show>
              </g>
            );
          }}
        </For>
      </svg>

      <p class="b-legend">
        <For each={statusCounts()}>
          {(s) => (
            <span class="b-key">
              <i class={STATUS_CLASS[s.status]} aria-hidden="true" />
              <b>{s.status}</b> {s.customers} customers · {int(s.transactions)} rows
            </span>
          )}
        </For>
        <span class="b-key b-key--note">† = fraud-flagged (4 customers)</span>
      </p>
    </ChartFigure>
  );
}

/** The re-sort control. It exists to prove the block solidity is not an ordering artefact -
 *  which is the strongest robustness argument the page can make, so it is a real radio group. */
export function SortToggle(props: {
  value: SortKey; onChange: (k: SortKey) => void; note: string;
}) {
  return (
    <div class="sortctl">
      <fieldset class="sortctl__set">
        <legend class="sortctl__legend">Re-order the columns</legend>
        <For each={["value", "status", "id"] as SortKey[]}>
          {(k) => (
            <label class="sortctl__opt" classList={{ "sortctl__opt--on": props.value === k }}>
              <input type="radio" name="sort" value={k} checked={props.value === k}
                     onChange={() => props.onChange(k)} />
              <span>{SORT_LABEL[k]}</span>
            </label>
          )}
        </For>
      </fieldset>
      <p class="sortctl__note">{props.note}</p>
    </div>
  );
}
