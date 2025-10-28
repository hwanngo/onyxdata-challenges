/**
 * Interaction harness - 2025/10 · Consumer Financial Complaints (CFPB)
 *
 * REPLACED 2025-10-28. This file was a verbatim copy of another month's script: it asserted a
 * `[data-metric="revenue"]` of 14,525,413, clicked `g[aria-label^="Samsung"]` and looked for a
 * ladder of phone models. None of that exists in this month, so it timed out on its first
 * `waitForFunction` and had never been run against this dashboard. A harness that cannot pass
 * is worse than no harness: it reads as coverage in review.
 *
 * Every expected value below is a number this month's own verification chain already asserts
 * (model/metric_checks.yml -> tools/verify_metrics.py), so this script and the DuckDB
 * recomputation cannot drift apart silently.
 *
 *   pnpm --filter datadna-2025-10 exec vite preview --port 5310 --strictPort &
 *   QA_URL=http://localhost:5310 QA_TOUR_KEY=datadna-2025-10-tour-seen node interact.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:4173';
const TOUR_KEY = process.env.QA_TOUR_KEY || 'datadna-2025-10-tour-seen';

const N_ALL = 62516;          // metric_checks: complaints
const N_WEB = 45423;          // fct_complaint where channel = 'Web'
const TIMELY_ALL = 96.0621;   // metric_checks: timely_rate
const EPS2_ALL = 0.3644;      // metric_checks: lag_eps2 (Kruskal-Wallis, tie-corrected)
const N_CHANNEL_ROWS = 6;     // channels with n >= 50; Email (n=2) is excluded by design

let failures = 0;
const ok = (n, c) => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const near = (a, b, tol = 0.005) => Math.abs(a - b) < tol;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();
const val = async (m) => Number(await p.getAttribute(`[data-metric="${m}"]`, 'data-value'));

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => document.querySelector('[data-metric="complaints"]')?.getAttribute('data-value'),
  { timeout: 30000 });

// ---- baseline -------------------------------------------------------------------------
ok(`baseline complaints = ${N_ALL.toLocaleString()}`, (await val('complaints')) === N_ALL);
ok(`baseline timeliness = ${TIMELY_ALL}% (resolved denominator)`, near(await val('timely_rate'), TIMELY_ALL));
ok(`the real clock renders an effect size (eps2 = ${EPS2_ALL})`, near(await val('lag_eps2'), EPS2_ALL, 0.0005));

// ---- cross-filter from the two-clocks panel -------------------------------------------
const t0 = Date.now();
await p.click('button[aria-label^="Web:"]');
await p.waitForFunction(
  (n) => Number(document.querySelector('[data-metric="complaints"]')?.getAttribute('data-value')) !== n,
  N_ALL, { timeout: 5000 });
const ms = Date.now() - t0;
ok(`channel cross-filter applies (${ms}ms, budget 200ms)`, (await val('complaints')) === N_WEB && ms < 200);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));
ok('the pressed bar reports its state to assistive tech',
  (await p.getAttribute('button[aria-label^="Web:"]', 'aria-pressed')) === 'true');

// EVERY panel must consume the filter, not just emit it. These are computed by different
// code paths: a year series, a Kruskal-Wallis, a Pareto, a cross-column defect, a censor.
const webTimely = await val('timely_rate');
ok('the timeliness panel recomputed under the filter', !near(webTimely, TIMELY_ALL));
ok('the relief priority list recomputed under the filter', (await val('top5_relief_share')) > 0);
ok('the integrity callout recomputed under the filter', (await val('early_n')) < 2150);
ok('the censoring hold-out recomputed under the filter', (await val('censored_resolved')) < 3075);

// ---- clear ----------------------------------------------------------------------------
await p.locator('.chip--clear').click();
await p.waitForTimeout(200);
ok('clear-all restores the full register', (await val('complaints')) === N_ALL);
ok('...and the effect size with it', near(await val('lag_eps2'), EPS2_ALL, 0.0005));

// ---- keyboard + assistive tech --------------------------------------------------------
const kb = await p.evaluate(() => {
  const el = document.querySelector('.bars--clock button.bars__row');
  el.focus();
  return document.activeElement === el;
});
ok('channel bars are keyboard focusable', kb);
await p.keyboard.press('Enter');
await p.waitForTimeout(250);
ok('Enter on a focused bar filters', (await val('complaints')) !== N_ALL);
await p.locator('.chip--clear').click();
await p.waitForTimeout(200);

// ---- screen-reader data tables --------------------------------------------------------
const perFig = await p.$$eval('.chartfig', (figs) =>
  Object.fromEntries(figs.map((f) => [f.id, f.querySelectorAll('.sr-only table tbody tr').length])));
ok(`the diagonal ships all 78 tests as a table (${perFig['fig-diagonal']} rows)`,
  perFig['fig-diagonal'] === 78);
ok(`the two-clocks table carries both clocks for ${N_CHANNEL_ROWS} channels (${perFig['fig-channels']} rows)`,
  perFig['fig-channels'] === N_CHANNEL_ROWS);
ok(`the timeliness table carries censored AND pooled for 7 years (${perFig['fig-timely']} rows)`,
  perFig['fig-timely'] === 7);
const cols = await p.$$eval('#fig-diagonal .sr-only thead th', (th) => th.map((n) => n.textContent));
ok("...with Cramér's V and the Bonferroni verdict, which the picture cannot carry",
  cols.includes("Cramér's V") && cols.includes('Clears Bonferroni'));

// ---- guided tour ----------------------------------------------------------------------
await p.click('button:has-text("Guided tour")');
await p.waitForTimeout(250);
ok('tour re-opens from the masthead button', (await p.locator('[role="dialog"]').count()) === 1);
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count()) === 0);

// ---- deep link + empty state ----------------------------------------------------------
const link = '/?f=' + encodeURIComponent(JSON.stringify([{ field: 'channel', values: ['Web'] }]));
const p2 = await ctx.newPage();
await p2.goto(URL + link, { waitUntil: 'networkidle' });
await p2.waitForFunction(
  () => document.querySelector('[data-metric="complaints"]')?.getAttribute('data-value'),
  { timeout: 30000 });
ok(`deep link restores filter state (Web = ${N_WEB.toLocaleString()})`,
  Number(await p2.getAttribute('[data-metric="complaints"]', 'data-value')) === N_WEB);

const empty = '/?f=' + encodeURIComponent(JSON.stringify([
  { field: 'channel', values: ['Fax'] }, { field: 'product', values: ['Student loan'] }]));
await p2.goto(URL + empty, { waitUntil: 'networkidle' });
await p2.waitForTimeout(800);
const zero = Number(await p2.getAttribute('[data-metric="complaints"]', 'data-value'));
ok('an empty filter combination renders without error', zero === 0);

await b.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall interaction checks pass');
process.exit(failures ? 1 : 0);
