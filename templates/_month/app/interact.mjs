/**
 * G6/G7 interaction matrix. EVERY ASSERTION BELOW BELONGS TO 2025/05 (mobile phone sales).
 * Rewrite them for this month, then set SCAFFOLD_REWRITTEN = true.
 *
 * Why this guard exists: three months all shipped this file byte-identical
 * to the template, asserting `revenue = 14525413` against apps that have no such metric -
 * and all three SCORECARDs counted the passes. A scaffolded file that was never edited is
 * worse than a missing one, because it reports success. See .workbench/docs/LEARNINGS.md.
 */
const SCAFFOLD_REWRITTEN = false;
if (!SCAFFOLD_REWRITTEN) {
  console.error('FAIL  interact.mjs is still the 2025/05 scaffold. Rewrite the assertions for');
  console.error('      this month and set SCAFFOLD_REWRITTEN = true. Refusing to report passes');
  console.error('      for a month whose metrics this file has never seen.');
  process.exit(1);
}

import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:950} });
await ctx.addInitScript((k)=>localStorage.setItem(k,'1'), process.env.QA_TOUR_KEY || 'tour-seen');
const p = await ctx.newPage();
/* `ok` used to only console.log, so a FAIL still exited 0 and the caller saw success -
   the same fail-by-passing shape as every tool in the audit table. */
let failed = 0;
const ok = (n,c)=>{ if(!c) failed++; console.log(`${c?'PASS':'FAIL'}  ${n}`); };
await p.goto((process.env.QA_URL || 'http://localhost:4173') + '/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>document.querySelector('[data-metric="revenue"]')?.textContent?.includes('$'),{timeout:30000});

const rev = () => p.getAttribute('[data-metric="revenue"]','data-value');
const base = await rev();
ok('baseline revenue = 14525413', Math.round(+base) === 14525413);

// cross-filter from the conversion gap (brand)
const t0 = Date.now();
await p.click('g[aria-label^="Samsung"]');
await p.waitForFunction(v=>document.querySelector('[data-metric="revenue"]')?.getAttribute('data-value')!==v,base,{timeout:5000});
const ms = Date.now()-t0;
const samsung = await rev();
ok(`brand cross-filter applies (${ms}ms, budget 200ms)`, Math.round(+samsung)===3481021 && ms<200);
ok('chip bar shows the active filter', (await p.locator('.chip').count())>=1);
ok('URL encodes filter state', (await p.url()).includes('f='));

/* MANDATORY, AND NOT OPTIONAL BECAUSE IT LOOKS TRIVIAL.
   Assert the signature still has marks under the filter. The cross-filter store is field-name
   based, so a filter naming a dimension the target's grain does not carry matches NOTHING and
   the chart renders empty - which reads as "no data for this selection" rather than "wrong
   question". A month shipped that bug past a green interact.mjs, because this file asserted a
   chip appeared and never asserted the chart survived. `perf.mjs` caught it instead.
   Replace the selector with THIS month's signature marks. */
ok('the filter never empties the signature',
   (await p.locator('#signature svg .mark').count()) > 0);

// ladder responds to the brand filter (cross-chart, both directions)
const rungs = await p.locator('g[aria-label*="Samsung,"]').count();
ok('ladder cross-filters to Samsung models only', rungs===4);

// market panel also responds
const india = await p.locator('tr[aria-label^="India"]').getAttribute('aria-label');
ok('market panel recomputed under filter', /India: premium mix/.test(india));

// drill: Enter on a brand pushes a breadcrumb
await p.locator('.chip--clear').click();
await p.waitForTimeout(150);
await p.locator('g[aria-label^="Samsung"]').focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(250);
ok('Enter drills in and shows a breadcrumb', (await p.locator('nav[aria-label="Drill path"]').count())===1);

// clear all
await p.locator('.chip--clear').click();
await p.waitForTimeout(200);
ok('clear-all restores the full dataset', Math.round(+(await rev()))===14525413);

// keyboard: tab reaches a ladder rung
await p.keyboard.press('Escape');
const kb = await p.evaluate(()=>{ const g=document.querySelector('g[role="button"]'); g.focus(); return document.activeElement===g; });
ok('chart marks are keyboard focusable', kb);

// screen-reader tables present and populated
const srRows = await p.locator('.chartfig .sr-only table tbody tr').count();
ok(`accessible data tables mirror every chart (${srRows} rows = 19 ladder + 5 brands + 4 markets + 4 bands)`, srRows===32);

// tour re-openable
await p.click('button[aria-label="Open guided tour"]');
await p.waitForTimeout(200);
ok('tour re-opens from the ? button', (await p.locator('[role="dialog"]').count())===1);
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count())===0);

// deep link
const p2 = await ctx.newPage();
await p2.goto('http://localhost:4173/?f=%5B%7B%22field%22%3A%22country%22%2C%22values%22%3A%5B%22India%22%5D%7D%5D',{waitUntil:'networkidle'});
await p2.waitForFunction(()=>document.querySelector('[data-metric="revenue"]')?.textContent?.includes('$'),{timeout:30000});
await p2.waitForTimeout(300);
ok('deep link restores filter state (India = 6969334)', Math.round(+(await p2.getAttribute('[data-metric="revenue"]','data-value')))===6969334);

// empty state: a filter combination with no rows must not crash
await p2.evaluate(()=>{const u=new URL(location.href);u.searchParams.set('f',encodeURIComponent(JSON.stringify([{field:'country',values:['India']},{field:'brand',values:['Nokia']}])));location.href=u.toString();});
await p2.waitForTimeout(1200);
const zero = await p2.getAttribute('[data-metric="revenue"]','data-value');
ok('empty result renders without error', zero==='0');
await b.close();

if (failed) { console.error(`\n${failed} interaction check(s) FAILED.`); process.exit(1); }
console.log('\nAll interaction checks passed.');
