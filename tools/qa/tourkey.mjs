/**
 * The month's OWN tour-storage key, read from the month's source.
 *
 * WHY THIS FILE EXISTS
 *
 * Six harnesses seed `localStorage[<tour key>] = '1'` to get the guided overlay out of the way
 * before they measure anything. Five of them defaulted to the literal `'tour-seen'`, which
 * matches NO month in this programme - keys are `pharma-`, `maritime-`, `mygym-`, `novabank-`,
 * `ecom-`, `shelter-`, `datadna-` prefixed. So the overlay stayed open and:
 *
 *   - `perf.mjs` clicked its backdrop every time and reported NOT MEASURED, while its own
 *     diagnostic ("is the guided tour open?") pointed straight at its own default;
 *   - `a11y.mjs` audited the page WITH a modal dialog over it, which is not the page it
 *     claims to audit;
 *   - `overflow.mjs` and `measure.mjs` measured geometry under a backdrop.
 *
 * `shoot.py` was fixed for exactly this in the same remediation and the .mjs tools were
 * not. Recorded in .workbench/docs/LEARNINGS.md: when a defect is found in one tool, grep the others for
 * its shape.
 *
 * Usage:  const TOUR_KEY = tourKeyFor(process.argv[2], process.argv[3]);
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function tourKeyFor(year, month) {
  if (process.env.QA_TOUR_KEY) return process.env.QA_TOUR_KEY;
  if (!year || !month) return 'tour-seen';

  const src = join(process.cwd(), year, month, 'app', 'src');
  const keys = new Set();

  /* Match what is PASSED TO localStorage, and string constants whose name says tour -
   * not "anything containing the word tour". Keys are not uniform in shape either:
   * some months use `<prefix>-tour-seen`, others `dna-<year>-<month>-tour`,
   * and every month also has a `tour-btn` CSS class that a looser pattern happily eats.
   * Matching on the call site rather than on the string is what makes this stable. */
  const PATTERNS = [
    /localStorage\.(?:get|set|remove)Item\(\s*["'`]([^"'`]+)["'`]/g,
    /(?:tourAlreadySeen|markTourSeen)\(\s*["'`]([^"'`]+)["'`]/g,
    /\bconst\s+\w*TOUR\w*KEY\w*\s*=\s*["'`]([^"'`]+)["'`]/gi,
  ];

  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(e)) continue;
      const text = readFileSync(full, 'utf8');
      for (const re of PATTERNS) {
        for (const m of text.matchAll(re)) if (/tour/i.test(m[1])) keys.add(m[1]);
      }
    }
  };
  walk(src);

  // Two keys means one of them is dead and we cannot tell which. Refusing beats seeding the
  // wrong one, because a wrong key looks identical to a month with no tour.
  if (keys.size > 1) {
    console.error(
      `REFUSING: ${year}/${month} declares ${keys.size} tour keys: ${[...keys].join(', ')}. ` +
      `Seeding the wrong one leaves the overlay open and every click lands on its backdrop.`,
    );
    process.exit(1);
  }
  return [...keys][0] ?? 'tour-seen';
}
