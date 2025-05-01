import { createResource, Show } from "solid-js";
import { init } from "@onyxdata/dna-kit";

/**
 * Build order (G6): data layer -> layout shell -> hero chart -> supporting charts
 * -> cross-filter wiring -> drill paths -> tour overlay -> a11y layer -> poster route
 * -> responsive pass.
 *
 * NEVER render a hardcoded number. Every figure is computed from the parquet at
 * query time. While loading, show a skeleton - not a plausible placeholder.
 */
export default function Dashboard(props: { poster: boolean }) {
  const [ready] = createResource(async () => {
    await init({
      // dim_date: "/data/dim_date.parquet",
      // fct_main: "/data/fct_main.parquet",
    });
    return true;
  });

  return (
    <Show when={ready()} fallback={<div class="skeleton">Loading data...</div>}>
      <header class="hd">
        <h1 class="hd__thesis">{/* the one-sentence thesis from analysis/insights.md */}</h1>
        <p class="hd__context">{/* who · what data · what period · n= */}</p>
      </header>

      {/* live-only: filter chips, tour trigger */}
      <div class="live-only">{/* <FilterChipBar /> <TourTrigger /> */}</div>

      <section class="kpis">{/* 4-5 KpiTile, each with data-metric + data-value */}</section>
      <section class="hero">{/* hero chart, annotated */}</section>
      <section class="support">{/* 3 supporting charts */}</section>
      <section class="sowhat">{/* <InsightCallout /> - 3 numbered recommendations */}</section>
    </Show>
  );
}
