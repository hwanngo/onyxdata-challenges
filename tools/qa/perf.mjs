import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* The month's OWN tour-storage key, read from its source.
 *
 * This tool took `2026 05` on the command line and ignored both arguments, then seeded the
 * literal 'tour-seen' - which matches no month in the programme. Every month's overlay was
 * therefore still OPEN, and its backdrop swallows every click, so the interaction budget
 * silently went unmeasured wherever the harness ran. shoot.py was fixed for exactly this in
 * that remediation; perf.mjs was not, and its own diagnostic ("is the guided tour
 * open?") was pointing at its own default the whole time.
 *
 * Keys are not uniform: pharma-, maritime-, mygym-, novabank-, ecom-, shelter-, datadna-. */
function tourKeyFor(year, month) {
  if (process.env.QA_TOUR_KEY) return process.env.QA_TOUR_KEY;
  if (!year || !month) return 'tour-seen';
  const src = join(process.cwd(), year, month, 'app', 'src');
  const keys = new Set();
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(e)) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/["'`]([\w-]*tour-seen)["'`]/g)) {
        keys.add(m[1]);
      }
    }
  };
  walk(src);
  if (keys.size > 1) {
    console.error(`REFUSING: ${year}/${month} declares ${keys.size} tour keys: ` +
                  `${[...keys].join(', ')}. Seeding the wrong one leaves the overlay open ` +
                  `and every click lands on its backdrop.`);
    process.exit(1);
  }
  return [...keys][0] ?? 'tour-seen';
}

const [YEAR, MONTH] = process.argv.slice(2);
const TOUR_KEY = tourKeyFor(YEAR, MONTH);
const URL = process.env.QA_URL || 'http://localhost:4173';
// Selector for an interactive chart mark.
// Two patterns are in use across months: SVG marks carrying role="button", and real
// <button> elements wrapping a mark (later months -- a native button is preferable,
// it gets keyboard and AT behaviour for free). Match either, and let QA_CLICK_SEL
// override for a month that does something else again.
// A later month added a third pattern: an SVG mark with role="button" that is a FILTER control
// rather than a figure, so it carries no data-metric of its own. Requiring both attributes
// silently skipped the whole interaction budget that month, which is worse than failing it.
// Three later months added a FOURTH pattern and all reported NOT MEASURED for it:
// a real <button aria-pressed> that emits a cross-filter but carries no data-metric of its
// own, because the number it filters lives in a sibling. Requiring :has([data-metric])
// excluded every emitter those months have. The rule this encodes: a filter control is
// identified by what it DOES (aria-pressed / role=button inside a figure), not by whether a
// tagged figure happens to be nested inside it.
const CLICK_SEL =
  process.env.QA_CLICK_SEL ||
  '[role="button"][data-metric], button[aria-pressed],' +
  ' figure [role="button"], .chartfig [role="button"]';

import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();

const hasData = () => {
  const e = document.querySelector('[data-metric]');
  return !!(e && e.getAttribute('data-value'));
};

const t0 = Date.now();
await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(hasData, { timeout: 30000 });
console.log(`cold load to first real number: ${Date.now() - t0}ms  (budget 3000ms)`);

// Interaction-to-paint: click a chart mark and wait for ANY rendered metric to change.
// THREE THINGS CAN GO WRONG HERE AND THEY NEED DIFFERENT FIXES. This used to print one
// message for all of them and exit 0, so a run that measured nothing read as a run that
// passed. A month lost a debug cycle to it: the message said "no interactive marks matched",
// which reads as a selector bug, and the real cause was the guided tour sitting open with
// its backdrop swallowing every click - because QA_TOUR_KEY was wrong for that month.
const times = [];
let matched = 0;      // elements the selector found
let clicked = 0;      // clicks that actually landed
for (let i = 0; i < 5; i++) {
  const els = await p.$$(CLICK_SEL);
  matched = Math.max(matched, els.length);
  if (!els.length) break;
  const before = await p.$$eval('[data-metric]', (ns) =>
    ns.map((n) => n.getAttribute('data-value')).join('|'));
  // In a dense strip plot marks overlap, so a given element may be obscured by a sibling.
  // A user clicking there still hits the topmost mark and still gets a filter, so an
  // obscured element is not a product defect - but it used to abort the whole run.
  //
  // It is also not enough to stop at the first HITTABLE element. The selector deliberately
  // matches anything that behaves like a control, so it also catches theme toggles and
  // segment switches that change no metric. Broadening the selector to cover the newer
  // emitters therefore broke two earlier months, whose inert controls happen to sort earlier
  // in the DOM - the classic shape of a cross-cutting "fix". So: walk candidates until one
  // click BOTH lands AND moves a rendered number. That is the thing being measured.
  let ok = false;
  for (let k = 0; k < Math.min(els.length, 16) && !ok; k++) {
    const cand = els[(i + k) % els.length];
    try { await cand.click({ timeout: 1200 }); } catch { continue; /* obscured */ }
    clicked++;
    const t = Date.now();
    try {
      await p.waitForFunction(
        (v) => [...document.querySelectorAll('[data-metric]')]
          .map((n) => n.getAttribute('data-value')).join('|') !== v,
        before, { timeout: 2500 });
      times.push(Date.now() - t);
      ok = true;
    } catch {
      // Inert control, or an already-active mark. Reset and try the next candidate.
    }
    const clr = await p.$('.chip--clear');
    if (clr) { await clr.click(); await p.waitForTimeout(120); }
  }
  if (!ok && !clicked) break;
}

let failure = null;
if (!times.length) {
  if (matched === 0) {
    failure =
      `interaction-to-paint: NOT MEASURED - the selector matched no elements.\n` +
      `  selector: ${CLICK_SEL}\n` +
      `  This month's interactive marks use a pattern the default selector does not cover.\n` +
      `  Set QA_CLICK_SEL to match them.`;
  } else if (clicked === 0) {
    failure =
      `interaction-to-paint: NOT MEASURED - ${matched} mark(s) matched, but every click was\n` +
      `  intercepted or obscured, so none landed.\n` +
      `  FIRST THING TO CHECK: is the guided tour open? Its backdrop covers the page and eats\n` +
      `  every click. That happens when QA_TOUR_KEY does not match the month's actual key -\n` +
      `  grep the month's app/src for 'tour-seen'. Keys are NOT uniform across months\n` +
      `  (e.g. mygym-, novabank-, ecom-, shelter-, and plain datadna- all appear).\n` +
      `  QA_TOUR_KEY currently: ${TOUR_KEY}`;
  } else {
    failure =
      `interaction-to-paint: NOT MEASURED - ${clicked} click(s) landed but no rendered metric\n` +
      `  ever changed. Either the marks are not wired to the filter, or every mark picked was\n` +
      `  already active. Cross-filtering may be broken.`;
  }
  console.error(failure);
} else {
  console.log(`interaction-to-paint: ${times.join('ms, ')}ms  max ${Math.max(...times)}ms (budget 200ms)`);
  // Print the selector on SUCCESS too, not only on failure. A month whose emitters the
  // default cannot see must set QA_CLICK_SEL, and if the evidence file does not record
  // which selector produced the number, the number cannot be reproduced from the repo -
  // which is the whole point of committing the evidence.
  console.log(`  measured by clicking: ${CLICK_SEL}`);
  if (process.env.QA_CLICK_SEL) {
    console.log('  (QA_CLICK_SEL override - the default selector does not match this month)');
  }
}
await b.close();
// An unmeasured budget is not a passed budget - see the comment above the loop.
if (failure) process.exit(1);
