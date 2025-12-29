/**
 * Guided tour - 2025/12. Five stops, each a claim the reader can check on the page.
 *
 * THE SHAPE MATTERS. `TourStep` is `{ h, p }`, and the kit's overlay reads exactly those two
 * keys. An earlier version of this file exported `{ target, title, body }` and the Dashboard
 * mounted the overlay without its `open` prop, so `<Show when={props.open}>` was never true and
 * the tour .workbench/2025/12/SCORECARD.md claims as a five-stop onboarding rendered nothing at all - a claimed
 * feature with no DOM. Typing the array as `TourStep[]` is what stops that recurring.
 *
 * THE TOUR AUTO-OPENS FOR A FIRST-TIME VISITOR, so every number in it is a front-page number
 * and none of them is typed. Each is computed here from the same rows the dashboard draws, so
 * a tour stop cannot drift away from the panel it is pointing at. The quantities themselves
 * are specified in `model/metric_checks.yml` and rendered with `data-metric` in the report
 * body, where `tools/verify_metrics.py` asserts them against DuckDB.
 */
import type { TourStep } from "@onyxdata/dna-kit";
import {
  CONDITIONS,
  OUTCOMES,
  allRows,
  cramersV,
  dec,
  int,
  liveReleaseRate,
  liveReleaseRateAsFiled,
  pct,
} from "./data";

const ALL = allRows();

const filed = liveReleaseRateAsFiled(ALL);
const corrected = liveReleaseRate(ALL);
const disposals = ALL.filter((r) => r.outcome === "DISPOSAL").length;
const unresolvedFiledAlive = ALL.filter((r) => r.unresolved === 1 && r.filedAlive === 1).length;

const rate = (c: string) => CONDITIONS.find((r) => r.intake_condition === c)?.live_rate ?? NaN;
const medianLosOf = (o: string) => OUTCOMES.find((r) => r.outcome === o)?.median_los ?? NaN;

export const TOUR: TourStep[] = [
  {
    h: "The headline number, twice",
    p:
      `The shelter's live-release rate is ${pct(corrected, 2)}, not the ${pct(filed, 2)} its own ` +
      `flag reports. That flag counts ${int(disposals)} animals that were disposed of, and ` +
      `${int(unresolvedFiledAlive)} that are still in the kennel, as saved.`,
  },
  {
    h: "Four measurements, each done twice",
    p:
      "Hollow marks are the file's reading; solid marks are the corrected one. Three panels " +
      "move. Watch the fourth.",
  },
  {
    h: "This is the control",
    p:
      "Intakes by month read the same whether the animal came through the public counter or " +
      "from a field officer. That agreement is what proves the weekday panel above is an " +
      "artefact rather than a guess - and it means the season is the axis worth planning on.",
  },
  {
    h: "What the file does say about animals",
    p:
      `Condition at intake predicts survival better than species, age or anything else here: ` +
      `${pct(rate("NORMAL"), 1)} for animals arriving normal against ` +
      `${pct(rate("ILL SEVERE"), 1)} for severely ill. Cramér's V = ` +
      `${dec(cramersV(ALL, "condition"), 3)}.`,
  },
  {
    h: "And where the two goals conflict",
    p:
      `Adoption is the slowest live outcome - a median of ${dec(medianLosOf("ADOPTION"), 0)} days ` +
      `against rescue's ${dec(medianLosOf("RESCUE"), 0)}. Any target to cut length of stay that ` +
      `does not exclude adoptions rewards transferring animals out. Click any bar or mark to ` +
      `cross-filter the report.`,
  },
];
