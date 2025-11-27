/**
 * Interaction matrix - 2025/11.  node 2025/11/app/interact.mjs
 *
 * Every cross-filter path, the clear-all, the deep link, keyboard activation, and the
 * empty state. A chart that emits a filter but does not consume one loses points, so each
 * case asserts that a DIFFERENT panel moved, not just the one that was clicked.
 */
import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:5173';
const KEY = 'ecom-2025-11-tour-seen';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), KEY);
const p = await ctx.newPage();

const val = (m) => p.$eval(`[data-metric="${m}"]`, (e) => Number(e.getAttribute('data-value')));
const chips = () => p.$$eval('.chip', (n) => n.length);
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
  ok ? pass++ : fail++;
};

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-metric]')?.getAttribute('data-value'));
const base = await val('revenue');
const baseSpan = await val('correction_span_country');
check('baseline renders', base > 28_000_000 && base < 28_010_000, `revenue ${base.toFixed(2)}`);
check('no filters at rest', (await chips()) === 0);

// 1. a country mark in the ASP panel filters the WHOLE report
await p.click('#fig-asp [role="button"]');
await p.waitForTimeout(200);
const afterCountry = await val('revenue');
check('ASP country mark cross-filters', afterCountry < base, `${base.toFixed(0)} -> ${afterCountry.toFixed(0)}`);
check('  and the signature chart consumes it', (await val('correction_span_country')) !== baseSpan);
check('  and a chip appears', (await chips()) > 0);

// 2. the URL carries the state
const url = p.url();
check('filter state is in the URL', url.includes('f='), url.slice(url.indexOf('?')).slice(0, 60));

// 3. deep link restores it in a cold page
const p2 = await ctx.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => document.querySelector('[data-metric]')?.getAttribute('data-value'));
const deep = await p2.$eval('[data-metric="revenue"]', (e) => Number(e.getAttribute('data-value')));
check('deep link restores the filter', Math.abs(deep - afterCountry) < 0.01, `${deep.toFixed(0)}`);
await p2.close();

// 4. clear-all
await p.click('.chip--clear');
await p.waitForTimeout(200);
check('clear-all restores the baseline', Math.abs((await val('revenue')) - base) < 0.01);
check('  and removes every chip', (await chips()) === 0);

// 5. a channel bar filters
await p.click('#fig-channel [role="button"]');
await p.waitForTimeout(200);
const afterChannel = await val('revenue');
check('channel bar cross-filters', afterChannel < base, `${afterChannel.toFixed(0)}`);
await p.click('.chip--clear');
await p.waitForTimeout(150);

// 6. keyboard activation on a signature dot
const dot = await p.$('#fig-span [role="button"]');
await dot.focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(200);
check('signature dot activates by keyboard', (await val('revenue')) !== base);
await p.click('.chip--clear');
await p.waitForTimeout(150);

// 7. an empty intersection must not blank the page
await p.goto(URL + '/?f=' + encodeURIComponent(JSON.stringify(
  [{ field: 'country', values: ['United States'] }, { field: 'currency', values: ['GBP'] }])),
  { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
const bodyText = await p.$eval('body', (e) => e.innerText);
check('impossible filter shows an empty state, not a blank page',
  /no events match this combination/i.test(bodyText) && bodyText.length > 500,
  `${bodyText.length} chars`);
// the FIRST button on the page is the theme toggle; target the recovery action itself
const recover = await p.$('.btn--primary');
await recover.click();
await p.waitForTimeout(300);
check('  and offers a way back',
  Math.abs((await val('revenue')) - base) < 0.01);

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
