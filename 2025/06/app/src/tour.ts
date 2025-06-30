/** This month's tour content. The overlay itself lives in @onyxdata/dna-kit.
 *
 * The steps are BUILT from the same rows the panels render rather than transcribed from
 * them. A tour is the easiest place in a dashboard for a number to go stale - it is prose,
 * nothing recomputes it, and nobody re-reads it after the data changes. So nothing here is
 * typed: every figure below is passed in from `formats()` and `platforms()`.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import { pct, spreadPct } from "./data";

export const TOUR_KEY = "datadna-2025-06-tour-seen";

type Fmt = { k: string; med_views: number; view_share: number; post_share: number };
type Plat = { k: string; med_views: number };

export function tourSteps(fmt?: Fmt[], plat?: Plat[]): TourStep[] {
  const by = new Map((fmt ?? []).map((r) => [r.k, r]));
  const video = by.get("Video");
  const image = by.get("Image");
  const ratio = video && image && image.med_views ? video.med_views / image.med_views : 0;
  const nPlat = plat?.length ?? 0;
  const spread = spreadPct((plat ?? []).map((r) => r.med_views));

  const formatLine =
    video && ratio
      ? `Ranked on the one real metric. Video earns ${ratio.toFixed(1)}x the median views of ` +
        `an image and returns ${pct(video.view_share)} of all views from ` +
        `${pct(video.post_share)} of posts. Live Stream costs the most to make and returns ` +
        `the least.`
      : "Ranked on the one real metric - median views by format.";

  const placeLine = nPlat
    ? `The ${nPlat} platforms sit within ${pct(spread)} of each other and region is not ` +
      `statistically significant. The brief asks what works on which platform; this data ` +
      `has no answer.`
    : "Platform and region are not levers here.";

  return [
    {
      h: "Only one number in this file is real",
      p: "This report starts by auditing its own dataset. Most of what looks like performance here was not measured. Four panels, about 90 seconds.",
    },
    {
      h: "1 - The provenance strip",
      p: "The five headline metrics, with where each came from. Three are struck through: impressions is views times a random factor, engagement is rate times views, and the engagement rate itself was drawn from four fixed bands. Only views was measured.",
    },
    { h: "2 - Format is the lever", p: formatLine },
    { h: "3 - Placement is not", p: placeLine },
    {
      h: "4 - Try the mirage toggle",
      p: "Rank hashtags and they look like a lever. Press 'group by content category' and the differences vanish - the hashtag was only ever a proxy for the content tier. Everything cross-filters; charts are keyboard-operable and every view has its own URL.",
    },
  ];
}
