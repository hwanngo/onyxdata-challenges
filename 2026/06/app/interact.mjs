/**
 * G6/G7 interaction matrix - 2026/06 UK Fintech Neobank.
 *
 * Rewritten for this month. The guard exists because 2025/07, 2025/09 and 2025/10 all shipped
 * this file byte-identical to the 2025/05 template and their SCORECARDs counted the passes.
 *
 *   QA_URL=http://localhost:5173 node 2026/06/app/interact.mjs
 */
const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) { console.error('FAIL  still the scaffold.'); process.exit(1); }

import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), 'dna-2026-06-tour');
const p = await ctx.newPage();

let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

await p.goto(`${URL}/`, { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => document.querySelector('[data-metric="transactions"]')?.getAttribute('data-value'),
  { timeout: 30000 });

const val = (m) => p.getAttribute(`[data-metric="${m}"]`, 'data-value');

// ---- baseline ----------------------------------------------------------------------------
ok('baseline transactions = 1,500', Math.round(+(await val('transactions'))) === 1500);
ok('baseline customers = 20', Math.round(+(await val('customers'))) === 20);
ok('design effect = 75', Math.round(+(await val('design_effect'))) === 75);
ok('4 of 20 customers flagged', Math.round(+(await val('fraud_customers'))) === 4);

// ---- the signature -----------------------------------------------------------------------
/* The claim is about a COUNT, so the count must be literal. All 1,500 marks are drawn; none
   is sampled, binned or aggregated. */
ok('all 1,500 marks are drawn, none sampled',
   (await p.locator('#blocks svg rect.b-mark').count()) === 1500);
ok('20 columns, one per customer',
   (await p.locator('#blocks svg > g').count()) === 20);
ok('the signature carries a screen-reader table',
   (await p.locator('#blocks .sr-only table').count()) === 1);

/* Every column must be a SINGLE colour - that is the whole finding. Asserted by computing the
   distinct fill across each column's 75 marks in the live DOM. */
const solid = await p.evaluate(() => {
  const cols = [...document.querySelectorAll('#blocks svg > g')];
  return cols.map((g) => new Set(
    [...g.querySelectorAll('rect.b-mark')].map((r) => getComputedStyle(r).fill)).size);
});
ok(`every one of the ${solid.length} columns is a single colour (max distinct = ${Math.max(...solid)})`,
   solid.length === 20 && Math.max(...solid) === 1);

// the re-sort control must actually re-order, and the blocks must stay solid
const firstBefore = await p.locator('#blocks svg > g .b-name').first().textContent();
await p.locator('.sortctl__opt input[value="id"]').check();
await p.waitForTimeout(350);
const firstAfter = await p.locator('#blocks svg > g .b-name').first().textContent();
ok('re-sort control re-orders the columns', firstBefore !== firstAfter);
const stillSolid = await p.evaluate(() => {
  const cols = [...document.querySelectorAll('#blocks svg > g')];
  return Math.max(...cols.map((g) => new Set(
    [...g.querySelectorAll('rect.b-mark')].map((r) => getComputedStyle(r).fill)).size));
});
ok('blocks stay solid under a different ordering - not an artefact of the sort', stillSolid === 1);
await p.locator('.sortctl__opt input[value="value"]').check();
await p.waitForTimeout(250);

// ---- cross-filter ------------------------------------------------------------------------
const t0 = Date.now();
await p.locator('.ctable__pick').first().click();
await p.waitForTimeout(150);
const ms = Date.now() - t0;
ok(`customer table cross-filters the page (${ms}ms)`,
   Math.round(+(await val('fraud_customers'))) <= 1 && ms < 500);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('chip bar states the denominator in customers',
   /of 20 customers/.test(await p.locator('.chips__n').textContent()));
ok('URL encodes filter state', (await p.url()).includes('f='));
ok('the signature filters down to the selected customer',
   (await p.locator('#blocks svg > g').count()) === 1);
/* ...and its CAPTION and screen-reader label must follow it down. Both hardcoded "1,500 marks
   ... 20 columns of 75" Until this was checked, so in exactly this state a screen reader was
   told there were 1,500 marks over 75 columns while one column was drawn, and the caption read
   "contains 1 facts". Assert the text, not only the mark count. */
const capOne = await p.locator('#blocks figcaption').innerText();
ok('caption follows the filter (75 marks, 1 fact)',
   /\b75 marks\b/.test(capOne) && /holds 1 fact\b/.test(capOne) && !/1,500/.test(capOne));
const ariaOne = await p.getAttribute('#blocks svg', 'aria-label');
ok('screen-reader label follows the filter (75 marks in 1 column)',
   /75 marks/.test(ariaOne) && /1 columns? of 75/.test(ariaOne));
await p.locator('.chip--clear').click();
await p.waitForTimeout(250);
ok('clear-all restores 20 columns', (await p.locator('#blocks svg > g').count()) === 20);
const capAll = await p.locator('#blocks figcaption').innerText();
ok('caption restores to 1,500 marks and 20 facts',
   /1,500 marks/.test(capAll) && /holds 20 facts/.test(capAll));

// ---- the rate discipline -----------------------------------------------------------------
/* The house rule: no rate appears without the count behind it. Asserted on the rendered text
   of the KPI strip and the interval panel. */
const kpi = await p.locator('.kpis').innerText();
ok('the fraud KPI renders "k of n", never a bare percentage', /\d+ of 20/.test(kpi));
const iv = await p.locator('#intervals').innerText();
ok('the interval panel prints a customer count for every measure',
   (iv.match(/of 20/g) || []).length >= 4);
ok('the interval panel prints the exact interval', /\[5\.7%, 43\.7%\]/.test(iv));

// ---- the fee rule ------------------------------------------------------------------------
const fee = await p.locator('#feerule').innerText();
ok('the fee panel shows NET and GROSS side by side',
   /NET/.test(fee) && /GROSS/.test(fee) && /1,174\.39/.test(fee) && /0\.17/.test(fee));

// ---- the tour ----------------------------------------------------------------------------
await p.locator('.tour-btn').click();
await p.waitForTimeout(350);
ok('tour opens from the ? button', (await p.locator('[role="dialog"], .tour').count()) > 0);
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
ok('Esc closes the tour', (await p.locator('[role="dialog"], .tour').count()) === 0);

// ---- the poster --------------------------------------------------------------------------
await p.goto(`${URL}/poster`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
ok('poster hides the tour button', (await p.locator('.tour-btn:visible').count()) === 0);
ok('poster hides the re-sort control', (await p.locator('.sortctl:visible').count()) === 0);
ok('poster draws all 1,500 marks too',
   (await p.locator('#blocks svg rect.b-mark').count()) === 1500);
const box = await p.locator('.page--poster').boundingBox();
ok('poster is exactly 2560x1440',
   Math.round(box.width) === 2560 && Math.round(box.height) === 1440);

/* .workbench/2026/06/design/direction.md commits the poster to printing the two omissions and their reasons
   rather than leaving them as gaps. */
const posterText = await p.locator('.page--poster').innerText();
ok('poster states why there is no map', /No map is drawn/.test(posterText));
ok('poster states why there is no trend line', /No monthly trend line/.test(posterText));

await b.close();
console.log(failed ? `\n${failed} FAILURE(S)` : '\nAll interaction assertions pass.');
process.exit(failed ? 1 : 0);
