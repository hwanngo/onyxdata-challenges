/**
 * THE HASHTAG MIRAGE - the month's best interaction.
 *
 * One toggle flips between "rank hashtags by engagement rate" (which looks like a finding
 * and is what the field would publish) and "group them inside their content category"
 * (where the differences vanish). The user performs the refutation themselves rather than
 * reading a claim about it.
 */
import { For, Show, createMemo, createSignal } from "solid-js";
import { isActive, toggle } from "@onyxdata/dna-kit";
import { MIN_CELL_POSTS, int, pct, type HashRow } from "../data";

export function Mirage(props: {
  data: HashRow[];
  cells: HashRow[];
  poster?: boolean;
  /** η² of hashtag on the engagement rate, pooled across categories - the mirage. */
  eta: number;
  /** the same η² measured INSIDE each category and pooled - what is left of it. */
  etaWithin: number;
  /** incremental R² of hashtag over a category-only model of the engagement rate. */
  incHashtag: number;
  /** incremental R² of category over a hashtag-only model. The asymmetry IS the finding. */
  incCategory: number;
}) {
  const [grouped, setGrouped] = createSignal(props.poster ? true : false);

  // Grouped view reads CELLS - a hashtag measured inside one category - not props.data,
  // whose rates are pooled across categories. See data.ts hashtagCells().
  const cats = createMemo(() => {
    const m = new Map<string, HashRow[]>();
    for (const h of props.cells) {
      const g = m.get(h.category);
      if (g) g.push(h);
      else m.set(h.category, [h]);
    }
    return [...m].map(([k, v]) => ({
      category: k,
      rows: [...v].sort((a, b) => b.rate - a.rate),
      mean: v.reduce((a, r) => a + r.rate, 0) / v.length,
      spread: Math.max(...v.map((r) => r.rate)) - Math.min(...v.map((r) => r.rate)),
    })).sort((a, b) => b.mean - a.mean);
  });

  const flat = createMemo(() => [...props.data].sort((a, b) => b.rate - a.rate));
  const max = () => Math.max(...props.data.map((r) => r.rate), 0.01);

  const Bar = (p: { r: HashRow; indent?: boolean; cell?: boolean }) => (
    <div
      class="bar-row"
      tabindex="0"
      role="button"
      aria-pressed={isActive("main_hashtag", p.r.k)}
      data-metric={p.cell ? `hashcell.${p.r.category}|${p.r.k}.rate` : `hashtag.${p.r.k}.rate`}
      data-value={p.r.rate}
      aria-label={
        p.cell
          ? `${p.r.k} within ${p.r.category}: engagement rate ${pct(p.r.rate * 100, 2)} across ${int(p.r.posts)} posts`
          : `${p.r.k}, all categories: engagement rate ${pct(p.r.rate * 100, 2)} across ${int(p.r.posts)} posts`
      }
      onClick={() => toggle("main_hashtag", p.r.k)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle("main_hashtag", p.r.k);
        }
      }}
      style={{ padding: "3px 0", cursor: "pointer", "padding-left": p.indent ? "14px" : "0" }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "min-width": 0 }}>
        <span style={{ "font-size": "0.8rem", "min-width": "150px" }}>{p.r.k}</span>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block", height: "11px",
            width: `${(p.r.rate / max()) * 130}px`,
            background: "var(--seq-3)",
          }}
        />
      </div>
      <span class="num" style={{ "font-size": "0.8rem", "font-weight": 600 }}>
        {pct(p.r.rate * 100, 1)}
      </span>
    </div>
  );

  // On the poster there is no toggle to press, so the comparison must be shown side by
  // side and small: the two numbers that make the point, plus one worked example.
  if (props.poster) {
    const worst = () => cats().reduce((a, c) => (c.spread > a.spread ? c : a), cats()[0]);
    return (
      <div>
        <table class="data">
          <thead>
            <tr>
              <th scope="col">Ranking hashtags says</th>
              <th scope="col">Controlling for category says</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong class="num" data-metric="mirage_eta2_pooled" data-value={props.eta}>
                  η² = {props.eta.toFixed(2)}
                </strong>{" "}
                - hashtag looks like it explains three quarters of the variation in
                engagement rate.
              </td>
              <td>
                <strong
                  class="num"
                  data-metric="mirage_eta2_within_category"
                  data-value={props.etaWithin}
                >
                  η² = {props.etaWithin.toFixed(3)}
                </strong>{" "}
                - inside a content category the hashtag explains almost nothing.
              </td>
            </tr>
            <tr>
              <td>
                Top of the ranking: <strong>{flat()[0]?.k}</strong> at{" "}
                <span class="num">{pct((flat()[0]?.rate ?? 0) * 100, 1)}</span>, bottom:{" "}
                <strong>{flat()[flat().length - 1]?.k}</strong> at{" "}
                <span class="num">{pct((flat()[flat().length - 1]?.rate ?? 0) * 100, 1)}</span>.
              </td>
              <td>
                Widest spread inside any one category -{" "}
                <strong
                  data-metric="mirage_widest_cell_category"
                  data-value={worst()?.category ?? ""}
                >
                  {worst()?.category}
                </strong>{" "}
                - is only{" "}
                <span
                  class="num"
                  data-metric="mirage_widest_cell_spread"
                  data-value={(worst()?.spread ?? 0) * 100}
                >
                  {pct((worst()?.spread ?? 0) * 100, 1)}
                </span>
                , measuring each hashtag within the category rather than across all of them.
              </td>
            </tr>
          </tbody>
        </table>
        <p class="pv-why" style={{ "margin-top": "8px" }}>
          Hashtag adds{" "}
          <span
            class="num"
            data-metric="mirage_inc_hashtag_r2"
            data-value={props.incHashtag}
          >
            +{props.incHashtag.toFixed(3)}
          </span>{" "}
          R² once category is known; category adds{" "}
          <span
            class="num"
            data-metric="mirage_inc_category_r2"
            data-value={props.incCategory}
          >
            +{props.incCategory.toFixed(3)}
          </span>{" "}
          once hashtag is known. The hashtag was only ever a proxy for the content tier.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div class="live-only" style={{ display: "flex", gap: "8px", "margin-bottom": "10px" }}>
        <button
          class="btn"
          classList={{ "btn--primary": !grouped() }}
          aria-pressed={!grouped()}
          onClick={() => setGrouped(false)}
        >
          Rank hashtags
        </button>
        <button
          class="btn"
          classList={{ "btn--primary": grouped() }}
          aria-pressed={grouped()}
          onClick={() => setGrouped(true)}
        >
          Group by content category
        </button>
      </div>

      <Show
        when={grouped()}
        fallback={
          <>
            <For each={flat()}>{(r) => <Bar r={r} />}</For>
            <p class="pv-why" style={{ "margin-top": "8px" }}>
              Ranked like this, hashtags look like a lever. They are not - press
              &ldquo;group by content category&rdquo;.
            </p>
          </>
        }
      >
        <For each={cats()}>
          {(c) => (
            <div style={{ "margin-bottom": "10px" }}>
              <div
                style={{
                  "font-weight": 700, "font-size": "0.78rem", "text-transform": "uppercase",
                  "letter-spacing": "0.04em", "border-bottom": "2px solid var(--border)",
                  "padding-bottom": "3px", "margin-bottom": "3px",
                  display: "flex", "justify-content": "space-between",
                }}
              >
                <span>{c.category}</span>
                <span class="num" style={{ color: "var(--ink-muted)", "font-weight": 400 }}>
                  spread {pct(c.spread * 100, 1)}
                </span>
              </div>
              <For each={c.rows}>{(r) => <Bar r={r} indent cell />}</For>
            </div>
          )}
        </For>
        <p class="pv-why">
          Inside a category every hashtag performs the same. The apparent effect was the
          category showing through: η² falls from{" "}
          <span class="num" data-metric="mirage_eta2_pooled" data-value={props.eta}>
            {props.eta.toFixed(2)}
          </span>{" "}
          to{" "}
          <span class="num" data-metric="mirage_eta2_within_category" data-value={props.etaWithin}>
            {props.etaWithin.toFixed(3)}
          </span>{" "}
          once category is held constant. Each bar is that hashtag measured{" "}
          <em>within</em> this category, over cells of at least {MIN_CELL_POSTS} posts.
        </p>
      </Show>
    </div>
  );
}

/** The figure has two states, so its accessible table carries both: the pooled ranking a
 *  sighted user sees first, then the same hashtags measured inside each category. Giving
 *  only the pooled half would reproduce the exact confusion the chart exists to dispel. */
export function mirageTable(data: HashRow[], cells: HashRow[]) {
  return {
    columns: ["Hashtag", "Measured over", "Posts", "Engagement rate"],
    rows: [
      ...[...data]
        .sort((a, b) => b.rate - a.rate)
        .map((r) => [r.k, "All categories", int(r.posts), pct(r.rate * 100, 2)]),
      ...[...cells]
        .sort((a, b) =>
          a.category === b.category ? b.rate - a.rate : a.category.localeCompare(b.category),
        )
        .map((r) => [r.k, `Within ${r.category}`, int(r.posts), pct(r.rate * 100, 2)]),
    ],
  };
}
