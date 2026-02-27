/**
 * G6/G7 interaction matrix - 2026/02 Pharmacy Sales & Profitability.
 *
 * Rewritten from the template scaffold, which asserts 2025/05's mobile-phone-sales metrics.
 * SCAFFOLD_REWRITTEN below is the guard that stops an unedited copy reporting passes: three
 * months shipped this file verbatim and all three SCORECARDs counted the results.
 */
const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) {
  console.error('FAIL  interact.mjs is still the 2025/05 scaffold.');
  process.exit(1);
}

import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:4173';
const TOUR_KEY = process.env.QA_TOUR_KEY || 'pharma-2026-02-tour-seen';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();

let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-metric="margin_pct"]')?.getAttribute('data-value'), { timeout: 30000 });

const val = async (m) => Number(await p.getAttribute(`[data-metric="${m}"]`, 'data-value'));
const baseRate = await val('margin_pct');
const baseLines = await val('lines');

ok(`baseline margin rate is 28.04% (got ${baseRate.toFixed(4)})`, Math.abs(baseRate - 28.0369) < 0.01);
ok(`baseline is 62,139 sales lines`, baseLines === 62139);

/* --- 1. cross-filter from the category panel ------------------------------------------ */
const t0 = Date.now();
await p.click('.cats__row:has-text("Prescription")');
await p.waitForFunction((v) => Number(document.querySelector('[data-metric="lines"]')?.getAttribute('data-value')) !== v, baseLines, { timeout: 5000 });
const ms = Date.now() - t0;
const rxLines = await val('lines');
const rxRate = await val('margin_pct');
ok(`category cross-filter applies (${ms}ms, budget 200ms)`, rxLines === 13120 && ms < 200);
ok(`margin rate recomputes under filter (Prescription = 21.92%)`, Math.abs(rxRate - 21.9222) < 0.01);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));

/* --- 2. the signature responds to the same filter -------------------------------------- */
ok('signature still draws all 120 shops under filter',
   (await p.locator('.pack__svg').first().locator('g.pack__cell').count()) === 120);

/* --- 3. clear-all restores ------------------------------------------------------------- */
await p.locator('.chip--clear').click();
await p.waitForTimeout(220);
ok('clear-all restores the full dataset', (await val('lines')) === baseLines);

/* --- 4. promo panel cross-filters ------------------------------------------------------ */
await p.click('.promo__row:has-text("promoted") >> nth=1');
await p.waitForTimeout(250);
const promoLines = await val('lines');
ok(`promo cross-filter applies (7,431 promoted lines)`, promoLines === 7431);

/* The integrity pass found that in exactly this state the signature caption read "the 10.43pp
   spread is smaller than the 5.73pp chance produces" - false, because the yardstick is
   bootstrapped from the unfiltered 120-shop book and does not follow a filter. Assert the
   comparison is SUSPENDED here, not merely that a chip appeared. Checking that the number
   changed would not have caught this; only reading the claim does. */
const capFiltered = await p.locator('.sig__c').first().innerText();
ok('filtered spread does not claim to beat the whole-book yardstick',
   /not a yardstick for a filtered subset/.test(capFiltered));
ok('filtered spread differs from the unfiltered one (so the caption matters)',
   Math.abs((await val('store_spread')) - 4.608107321603853) > 0.5);

await p.locator('.chip--clear').click();
await p.waitForTimeout(220);
const capWhole = await p.locator('.sig__c').first().innerText();
ok('unfiltered caption restores the chance comparison',
   /chance alone gives/.test(capWhole) && !/not a yardstick/.test(capWhole));

/* --- 5. the signature's OWN state toggle, and its URL ---------------------------------- */
await p.click('.seg__b:has-text("How much each shop sells")');
await p.waitForTimeout(200);
ok('grid state toggles to volume', (await p.url()).includes('grid=volume'));
/* innerText returns RENDERED text and .sig__lab is text-transform:uppercase, so a
   case-sensitive match here silently fails against a correct app. LEARNINGS, 2025/06. */
ok('volume state is the one rendered', /how much/i.test(await p.locator('.sig__lab').innerText()));
await p.click('.seg__b:has-text("How profitably each shop trades")');
await p.waitForTimeout(200);
ok('grid state toggles back to margin', (await p.url()).includes('grid=margin'));

/* --- 6. the grid is keyboard operable -------------------------------------------------- */
await p.locator('.pack__svg').first().focus();
const focused = await p.evaluate(() => document.activeElement?.classList.contains('pack__svg'));
ok('signature grid is focusable', !!focused);
await p.keyboard.press('ArrowRight');
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(150);
const read = await p.locator('.pack__read').innerText();
ok(`arrow keys move the focused shop (read-out: "${read.split('\n')[0].slice(0, 28)}")`, read.length > 30 && !read.includes('Hover or focus'));
await p.keyboard.press('Enter');
await p.waitForTimeout(250);
ok('Enter on a cell cross-filters the report', (await p.locator('.chip').count()) >= 1);
await p.locator('.chip--clear').click();
await p.waitForTimeout(220);

/* --- 7. drill path: country -> breadcrumb ---------------------------------------------- */
await p.click('.ctry__row:has-text("Germany")');
await p.waitForTimeout(250);
ok('country drill pushes a breadcrumb', (await p.locator('nav[aria-label="Drill path"]').count()) === 1);
ok('country drill filters the report', (await val('lines')) === 10628);
await p.locator('.chip--clear').click();
await p.waitForTimeout(220);

/* --- 8. tour re-opens and closes -------------------------------------------------------- */
await p.click('button[aria-label="Open guided tour"]');
await p.waitForTimeout(250);
ok('tour re-opens from the ? button', (await p.locator('[role="dialog"]').count()) === 1);
const h = (await p.locator('#tour-h').innerText()).trim();
const body = (await p.locator('.tour-card p').innerText()).trim();
ok(`tour stop 1 renders real content ("${h.slice(0, 34)}")`, h.length > 8 && body.length > 40);
await p.keyboard.press('Escape');
await p.waitForTimeout(220);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count()) === 0);

/* --- 9. deep link restores state -------------------------------------------------------- */
const p2 = await ctx.newPage();
await p2.goto(URL + '/?f=' + encodeURIComponent(JSON.stringify([{ field: 'country', values: ['Austria'] }])) + '&grid=volume', { waitUntil: 'networkidle' });
await p2.waitForFunction(() => document.querySelector('[data-metric="lines"]')?.getAttribute('data-value'), { timeout: 30000 });
await p2.waitForTimeout(300);
ok('deep link restores the filter (Austria = 4,693 lines)',
   Number(await p2.getAttribute('[data-metric="lines"]', 'data-value')) === 4693);
ok('deep link restores the grid state', /how much/i.test(await p2.locator('.sig__lab').innerText()));

/* --- 10. degenerate state: a filter pair with no rows must not crash -------------------- */
await p2.goto(URL + '/?f=' + encodeURIComponent(JSON.stringify([
  { field: 'country', values: ['Austria'] }, { field: 'category', values: ['Prescription'] },
  { field: 'promo', values: ['Promoted'] },
])), { waitUntil: 'networkidle' });
await p2.waitForTimeout(600);
const errs = [];
p2.on('pageerror', (e) => errs.push(e.message));
const narrow = Number(await p2.getAttribute('[data-metric="lines"]', 'data-value'));
ok(`a three-way filter renders without error (${narrow} lines)`, Number.isFinite(narrow) && errs.length === 0);

await b.close();
if (failed) { console.error(`\n${failed} interaction check(s) FAILED.`); process.exit(1); }
console.log('\nAll interaction checks passed.');
