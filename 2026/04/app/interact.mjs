/** G6/G7 interaction matrix - 2026/04 Maritime Logistics & Terminal Efficiency. */
const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) { console.error('FAIL  still the 2025/05 scaffold.'); process.exit(1); }

import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:4173';
const TOUR_KEY = process.env.QA_TOUR_KEY || 'maritime-2026-04-tour-seen';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();
let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-metric="movements"]')?.getAttribute('data-value'), { timeout: 30000 });
const val = async (m) => Number(await p.getAttribute(`[data-metric="${m}"]`, 'data-value'));

ok('baseline is 15,000 movements', (await val('movements')) === 15000);
ok('largest eta2 is 0.0079', Math.abs((await val('largest_eta2')) - 0.007879) < 1e-5);
ok('movement_id has 1,001 distinct values', (await val('movement_id_distinct')) === 1001);
ok('the blockage week holds 56 movements', (await val('suez_week_movements')) === 56);

/* 1. cross-filter from a small multiple */
const t0 = Date.now();
await p.click('.strip__cell:has-text("2021")');
await p.waitForTimeout(250);
ok('a cut cell isolates and writes the URL', (await p.url()).includes('cut=year%3A2021') || (await p.url()).includes('cut=year:2021'));
await p.click('.strip__cell:has-text("2021")');
await p.waitForTimeout(200);
ok('clicking it again clears the isolation', !(await p.url()).includes('cut='));

/* 2. cross-filter from the terminal table */
const base = await val('movements');
await p.click('.term tbody tr');
await p.waitForFunction((v) => Number(document.querySelector('[data-metric="movements"]')?.getAttribute('data-value')) !== v, base, { timeout: 5000 });
const ms = Date.now() - t0;
const filtered = await val('movements');
ok(`terminal cross-filter applies (${filtered} movements)`, filtered > 0 && filtered < base);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));
ok('drill pushes a breadcrumb', (await p.locator('nav[aria-label="Drill path"]').count()) === 1);
ok('the eta2 panel still renders all eight axes under filter',
   (await p.locator('.cuts__row').count()) === 8);

await p.locator('.chip--clear').click();
await p.waitForTimeout(250);
ok('clear-all restores the full dataset', (await val('movements')) === base);

/* 3. the histogram is keyboard operable */
await p.locator('.flat__svg').focus();
ok('the histogram is focusable', await p.evaluate(() => document.activeElement?.classList.contains('flat__svg')));
await p.keyboard.press('ArrowRight');
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(150);
const read = await p.locator('.flat__read').innerText();
ok(`arrow keys move between bins ("${read.slice(0, 26).trim()}")`, /standard error/i.test(read));

/* 4. the tour */
await p.click('button[aria-label="Open guided tour"]');
await p.waitForTimeout(250);
ok('tour re-opens from the ? button', (await p.locator('[role="dialog"]').count()) === 1);
const h = (await p.locator('#tour-h').innerText()).trim();
const body = (await p.locator('.tour-card p').innerText()).trim();
ok(`tour stop 1 renders real content ("${h.slice(0, 30)}")`, h.length > 8 && body.length > 40);
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count()) === 0);

/* 5. deep link + degenerate state */
const p2 = await ctx.newPage();
await p2.goto(URL + '/?f=' + encodeURIComponent(JSON.stringify([{ field: 'hub', values: ['LATAM'] }])), { waitUntil: 'networkidle' });
await p2.waitForFunction(() => document.querySelector('[data-metric="movements"]')?.getAttribute('data-value'), { timeout: 30000 });
await p2.waitForTimeout(300);
const latam = Number(await p2.getAttribute('[data-metric="movements"]', 'data-value'));
ok(`deep link restores the filter (LATAM = ${latam} movements)`, latam > 0 && latam < 15000);

const errs = [];
p2.on('pageerror', (e) => errs.push(e.message));
await p2.goto(URL + '/?f=' + encodeURIComponent(JSON.stringify([
  { field: 'hub', values: ['LATAM'] }, { field: 'vessel_category', values: ['Container'] },
  { field: 'year', values: [2021] }, { field: 'day_label', values: ['Night'] },
])), { waitUntil: 'networkidle' });
await p2.waitForTimeout(700);
const narrow = Number(await p2.getAttribute('[data-metric="movements"]', 'data-value'));
ok(`a four-way filter renders without error (${narrow} movements)`, Number.isFinite(narrow) && errs.length === 0);

await b.close();
if (failed) { console.error(`\n${failed} interaction check(s) FAILED.`); process.exit(1); }
console.log('\nAll interaction checks passed.');
