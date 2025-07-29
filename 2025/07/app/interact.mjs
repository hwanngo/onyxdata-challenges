/**
 * INTERACTION MATRIX - 2025/07 Customer Satisfaction & Loyalty.
 *
 * This file was, until 2025-07-29, a byte-identical copy of templates/_month/app/interact.mjs:
 * a MOBILE PHONE SALES script asserting revenue=14525413, a Samsung cross-filter and
 * India=6969334. None of those selectors exists in this app, so it could never have run -
 * while .workbench/2025/07/SCORECARD.md reported "10/10 interaction checks" passing. It now asserts this
 * month's selectors and this month's numbers.
 *
 * Every expected value below is recomputed independently in Python from the curated parquet
 * (analysis/integrity.py, model/test_metrics.py) - none is copied from the UI it is checking.
 *
 *   pnpm --filter datadna-2025-07 build
 *   pnpm --filter datadna-2025-07 exec vite preview --port 5307 --strictPort &
 *   cd 2025/07/app && QA_URL=http://localhost:5307 \
 *     QA_TOUR_KEY=datadna-2025-07-tour-seen node interact.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5307';
const TOUR_KEY = process.env.QA_TOUR_KEY || 'datadna-2025-07-tour-seen';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const near = (a, b, tol = 5e-4) => Number.isFinite(+a) && Math.abs(+a - b) < tol;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

const metric = (name) => p.getAttribute(`[data-metric="${name}"]`, 'data-value');
const rungs = () => p.locator('#ladder g.ladder-row').count();
const caption = (id) => p.locator(`#${id}-cap`).innerText();
const openExplore = () => p.locator('details.explore').evaluate((d) => { d.open = true; });

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-metric="power.1.0.need"]'), { timeout: 30000 });
await p.waitForTimeout(250);

// ---------------------------------------------------------------------------------------
// 1. BASELINE. The whole-study figures, computed in the browser, matching DuckDB.
// ---------------------------------------------------------------------------------------
ok('baseline: a one-point effect needs 144 customers per group',
   (await metric('power.1.0.need')) === '144');
ok('baseline: R4 support difference = +0.0134 points',
   near(await metric('support.diff.value'), 0.013392857142857));
ok('baseline: the difference carries its own 95% interval, -1.0770 to +1.1038',
   near(await metric('support.diff.lo'), -1.076969269652872) &&
   near(await metric('support.diff.hi'), 1.1037549839385856));
ok('baseline: the ladder draws 17 rungs across six axes', (await rungs()) === 17);

// The caption is COMPUTED from the rows on screen, not typed. This is the audit fix: the
// old copy asserted "every interval overlaps every other" as a constant.
ok('ladder caption counts the overlapping pairs rather than asserting them',
   /All 17 intervals overlap every other one \(136 pairs, none separated\)/.test(await caption('ladder')));
ok('ladder caption scopes the detection floor to WITHIN one axis (1.37, loyalty)',
   /widest gap within any single axis is 1\.37 points \(Loyalty\), inside the ±1\.55/.test(await caption('ladder')));

// ---------------------------------------------------------------------------------------
// 2. CROSS-FILTER, LADDER -> EVERYTHING, and it is a DRILL on the state axis.
// ---------------------------------------------------------------------------------------
const t0 = Date.now();
await p.locator('g[data-metric="ladder.State: TX.mean"]').click();
await p.waitForFunction(() => document.querySelector('[data-metric="power.1.0.need"]')
  ?.getAttribute('data-value') !== '144', null, { timeout: 5000 });
const ms = Date.now() - t0;

ok(`state cross-filter applies in ${ms}ms (budget 200ms)`, ms < 200);
ok('Texas (n=41) needs 168 per group, not 144 - the power table recomputes',
   (await metric('power.1.0.need')) === '168');
ok('the ladder collapses to 12 rungs - one state remains',
   (await rungs()) === 12);
ok('R4 recomputes under the filter: +1.4251 with a 95% interval of -0.5700 to +3.4202',
   near(await metric('support.diff.value'), 1.425120772946860) &&
   near(await metric('support.diff.lo'), -0.570003) &&
   near(await metric('support.diff.hi'), 3.420245));
const stand = await p.locator('.standfirst').innerText();
ok('the standfirst says 41 customers, not 120 - n and the floor move together',
   /With\s+41 customers/.test(stand) && /2\.89 points/.test(stand));
ok('the ladder caption re-states itself: 1 of 66 pairs now separate',
   /1 of 66 interval pairs do not overlap - 12 groups shown/.test(await caption('ladder')));
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));
ok('the state axis DRILLS: a breadcrumb records the path',
   (await p.locator('nav[aria-label="Drill path"]').count()) === 1 &&
   (await p.locator('nav[aria-label="Drill path"]').innerText()).includes('TX'));

// cross-chart, the other direction: Explore's city panel is now Texas-only
await openExplore();
await p.waitForTimeout(250);
const cityRows = p.locator('section:has(> h3:text-is("City")) table.data tbody tr');
ok('Explore drills state -> city: 4 Texas cities remain of 10',
   (await cityRows.count()) === 4);

// ---------------------------------------------------------------------------------------
// 3. CLEAR ALL restores the full study, and unwinds the drill.
// ---------------------------------------------------------------------------------------
await p.locator('.chip--clear').click();
await p.waitForTimeout(300);
ok('clear-all restores all 120 customers',
   (await metric('power.1.0.need')) === '144' && (await rungs()) === 17);
ok('clear-all also empties the drill breadcrumb',
   (await p.locator('nav[aria-label="Drill path"]').count()) === 0);

// ---------------------------------------------------------------------------------------
// 4. EXPLORE -> LADDER. Filtering from a table row must move the chart.
// ---------------------------------------------------------------------------------------
await openExplore();
await p.locator('section:has(> h3:text-is("Loyalty level")) table.data tbody tr')
  .filter({ hasText: 'Medium' }).first().click();
await p.waitForTimeout(300);
ok('Explore row -> ladder: filtering to Loyalty Medium leaves one loyalty rung',
   (await p.locator('#ladder g[data-metric^="ladder.Loyalty:"]').count()) === 1);
await p.locator('.chip--clear').click();
await p.waitForTimeout(300);

// ---------------------------------------------------------------------------------------
// 5. THE TWO TOGGLES. Both change what the ladder claims, which is the point of them.
// ---------------------------------------------------------------------------------------
ok('the detection floor is drawn by default', (await p.locator('.floorband').count()) === 1);
await p.getByRole('button', { name: /detection floor/ }).click();
await p.waitForTimeout(200);
ok('the floor toggle removes the band and flips its own label',
   (await p.locator('.floorband').count()) === 0 &&
   /Show detection floor/i.test(await p.getByRole('button', { name: /detection floor/ }).innerText()));
await p.getByRole('button', { name: /detection floor/ }).click();
await p.waitForTimeout(200);

await p.getByRole('button', { name: /satisfaction factors/ }).click();
await p.waitForTimeout(350);
ok('adding the seventh axis puts 27 rungs on the ladder', (await rungs()) === 27);
ok('and the caption admits the exception: 16 of 351 pairs separate',
   /16 of 351 interval pairs do not overlap - 27 groups shown/.test(await caption('ladder')));
ok('the factor axis blows past the detection floor (3.47 > 1.55), and the caption says so',
   /widest gap within a single axis is 3\.47 points \(Factor\), which exceeds the ±1\.55/
     .test(await caption('ladder')));
await p.getByRole('button', { name: /satisfaction factors/ }).click();
await p.waitForTimeout(300);
ok('hiding the factor axis restores the 17-rung ladder', (await rungs()) === 17);

// ---------------------------------------------------------------------------------------
// 6. KEYBOARD. Every mark that filters on click must filter on Enter.
// ---------------------------------------------------------------------------------------
const focused = await p.evaluate(() => {
  const g = document.querySelector('#ladder g.ladder-row');
  g.focus();
  return document.activeElement === g;
});
ok('ladder rungs are keyboard focusable', focused);
await p.keyboard.press('Enter');
await p.waitForTimeout(350);
ok('Enter on a focused rung applies the filter', (await p.locator('.chip').count()) >= 1);
await p.locator('.chip--clear').click();
await p.waitForTimeout(300);

// ---------------------------------------------------------------------------------------
// 7. ACCESSIBLE TABLES. Every chart is mirrored as data for a screen reader.
// ---------------------------------------------------------------------------------------
const srRows = await p.locator('.chartfig .sr-only table tbody tr').count();
ok(`accessible tables mirror every chart (${srRows} rows = 17 ladder + 3 support + 4 power)`,
   srRows === 24);
const ladderHead = await p.locator('#ladder .sr-only table thead').innerText();
ok('the ladder data table exposes n and BOTH confidence bounds, not just the mean',
   /\bn\b/.test(ladderHead) && /95% CI low/.test(ladderHead) && /95% CI high/.test(ladderHead));

// ---------------------------------------------------------------------------------------
// 8. TOUR. Re-openable and dismissible without a mouse.
// ---------------------------------------------------------------------------------------
await p.click('button[aria-label="Open guided tour"]');
await p.waitForTimeout(300);
ok('tour re-opens from the ? button', (await p.locator('[role="dialog"]').count()) === 1);
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count()) === 0);

// ---------------------------------------------------------------------------------------
// 9. DEEP LINK. A pasted URL must restore the same view.
// ---------------------------------------------------------------------------------------
const link = (f) => `${URL}/?f=` + encodeURIComponent(JSON.stringify(f));
const p2 = await ctx.newPage();
p2.on('pageerror', (e) => errors.push('deep-link: ' + e.message));
await p2.goto(link([{ field: 'state', values: ['IL'] }]), { waitUntil: 'networkidle' });
await p2.waitForFunction(() => document.querySelector('[data-metric="power.1.0.need"]'), { timeout: 30000 });
await p2.waitForTimeout(400);
ok('deep link restores State: IL - 14 customers, 142 needed per group',
   (await p2.getAttribute('[data-metric="power.1.0.need"]', 'data-value')) === '142' &&
   /With\s+14 customers/.test(await p2.locator('.standfirst').innerText()));

// ---------------------------------------------------------------------------------------
// 10. EMPTY STATE. Two clicks reach it, so it is a state, not an edge case.
//     Before 2025-07-29 this rendered "the smallest difference this study could detect is
//     NaN points" and a power table confidently reading 0 customers per group.
// ---------------------------------------------------------------------------------------
await p2.goto(link([{ field: 'state', values: ['NY'] }, { field: 'city', values: ['Houston'] }]),
              { waitUntil: 'networkidle' });
await p2.waitForTimeout(1000);
ok('empty result renders an explicit empty state, not zeros',
   (await p2.locator('.emptystate').count()) === 1);
ok('empty result prints no fabricated figures - no NaN, no invented 0',
   !/NaN/.test(await p2.locator('.shell').innerText()) &&
   (await p2.locator('[data-metric]').count()) === 0);
ok('empty result reports "nothing to plot" rather than an overlap claim',
   /No customers match the current filters/.test(await p2.locator('#ladder-cap').innerText()));

ok('no uncaught page errors anywhere in the run', errors.length === 0);
if (errors.length) console.log('   errors:', errors);

await b.close();
console.log(`\n${pass}/${pass + fail} interaction checks pass`);
process.exit(fail ? 1 : 0);
