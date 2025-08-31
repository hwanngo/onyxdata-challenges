/**
 * Interaction test - 2025/08 MyGym.
 *
 * Asserts that the interactivity is REAL: that cross-filtering recomputes every panel from
 * row-level data rather than swapping pre-baked views, and that the signature interaction
 * (the lapse-threshold sweep) demonstrates the thesis rather than decorating it.
 *
 *   QA_URL=http://localhost:5173 node 2025/08/app/interact.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5173';
const TOUR_KEY = 'mygym-2025-08-tour-seen';
let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();
await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => document.querySelector('[data-metric="members"]')?.getAttribute('data-value'),
  { timeout: 30000 }
);

const val = (m) => p.getAttribute(`[data-metric="${m}"]`, 'data-value');

// ---- baseline -------------------------------------------------------------------
ok('baseline members = 1998', Math.round(+(await val('members'))) === 1998);
ok('baseline flagged = 982', Math.round(+(await val('flagged'))) === 982);
ok('nobody is churned', Math.round(+(await val('churned'))) === 0);

// ---- the signature interaction: the lapse sweep ---------------------------------
// The whole thesis is that the flagged set is a tenure slice at ANY threshold. Move the
// slider and the overlap must stay ~100% while the count changes a lot.
const slider = p.locator('input[type="range"]');
await slider.focus();
await slider.fill('14');
await p.waitForFunction(() => +document.querySelector('[data-metric="flagged"]').getAttribute('data-value') !== 982, { timeout: 5000 });
const f14 = Math.round(+(await val('flagged')));
const o14 = +(await val('flagged_overlap_pct'));
ok(`threshold 14 flags more members (${f14} > 982)`, f14 > 982);
ok(`...and the overlap stays ~100% (${o14.toFixed(1)}%)`, o14 > 99);

await slider.fill('45');
await p.waitForFunction((v) => +document.querySelector('[data-metric="flagged"]').getAttribute('data-value') !== v, f14, { timeout: 5000 });
const f45 = Math.round(+(await val('flagged')));
const o45 = +(await val('flagged_overlap_pct'));
ok(`threshold 45 flags fewer (${f45} < ${f14})`, f45 < f14);
ok(`...overlap still ~100% (${o45.toFixed(1)}%) - a tenure slice at every cut`, o45 > 99);

await slider.fill('30');
await p.waitForTimeout(200);

// ---- cross-filter recomputes from row level -------------------------------------
const t0 = Date.now();
await p.click('button[aria-label^="Anaheim"]');
await p.waitForFunction(() => +document.querySelector('[data-metric="members"]').getAttribute('data-value') !== 1998, { timeout: 5000 });
const ms = Date.now() - t0;
const n = Math.round(+(await val('members')));
ok(`gym cross-filter applies (${ms}ms, budget 200ms)`, n === 188 && ms < 200);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));

// price is a lookup, so filtering to one gym must NOT change the combination count much,
// but it MUST change the booked total - proof the panel recomputes rather than caching.
const booked = +(await val('booked_annual'));
ok(`booked revenue recomputed under filter ($${Math.round(booked).toLocaleString()})`, booked > 0 && booked < 826486);

// the flagged set recomputes within the filtered subset, and the thesis still holds
const oCity = +(await val('flagged_overlap_pct'));
ok(`the inversion holds within one gym too (${oCity.toFixed(1)}%)`, oCity > 95);

// ---- keyboard reachability ------------------------------------------------------
await p.locator('.chip--clear').click();
await p.waitForTimeout(200);
ok('clear-all restores the full dataset', Math.round(+(await val('members'))) === 1998);

await p.locator('button[aria-label^="Oakland"]').focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(250);
ok('Enter on a gym bar filters (keyboard parity with mouse)', Math.round(+(await val('members'))) === 165);

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll interaction checks pass.');
process.exit(failed ? 1 : 0);
