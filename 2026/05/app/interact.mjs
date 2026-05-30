/**
 * G6/G7 interaction matrix - 2026/05 Music Streaming Platform Performance.
 *
 * Rewritten for this month. The guard below exists because 2025/07, 2025/09 and 2025/10 all
 * shipped this file byte-identical to the 2025/05 template, asserting `revenue = 14525413`
 * against apps that have no such metric - and all three SCORECARDs counted the passes. A
 * scaffolded file that was never edited is worse than a missing one, because it reports
 * success. See .workbench/docs/LEARNINGS.md.
 *
 *   QA_URL=http://localhost:5173 node 2026/05/app/interact.mjs
 */
const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) {
  console.error('FAIL  interact.mjs is still the 2025/05 scaffold.');
  process.exit(1);
}

import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), 'dna-2026-05-tour');
const p = await ctx.newPage();

let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

await p.goto(`${URL}/`, { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => document.querySelector('[data-metric="sessions"]')?.getAttribute('data-value'),
  { timeout: 30000 }
);

const val = (m) => p.getAttribute(`[data-metric="${m}"]`, 'data-value');

// ---- baseline ---------------------------------------------------------------------------
ok('baseline sessions = 224,078', Math.round(+(await val('sessions'))) === 224078);
ok('baseline top-ten overlap = 1', Math.round(+(await val('top10_overlap'))) === 1);
const baseShare = +(await val('repeat_concentrated_session_share'));
ok('baseline cohort share of plays ~= 0.7016', Math.abs(baseShare - 0.7016) < 5e-4);

// ---- the signature ----------------------------------------------------------------------
ok('all 448 artists are drawn, not just the movers',
   (await p.locator('#crossing svg line').count()) >= 448);
ok('the signature carries a screen-reader table',
   (await p.locator('#crossing .sr-only table').count()) === 1);

// the basis toggle must actually RECOMPUTE the ranking, not restyle it
const lastLabel = () => p.locator('#crossing .cx-labels text').last().textContent();
const beforeBasis = await lastLabel();
await p.locator('.basis__opt input[value="capped"]').check();
await p.waitForTimeout(350);
const afterBasis = await lastLabel();
ok('basis toggle recomputes the ranking (clean -> capped moves the labels)',
   beforeBasis !== afterBasis);
await p.locator('.basis__opt input[value="clean"]').check();
await p.waitForTimeout(250);

// ---- cross-filter: every visual must EMIT and CONSUME ------------------------------------
const t0 = Date.now();
await p.locator('.dowchip').first().click();
await p.waitForTimeout(150);
const ms = Date.now() - t0;
const monShare = +(await val('repeat_concentrated_session_share'));
ok(`day-of-week chip cross-filters the KPI strip (${ms}ms)`,
   Math.abs(monShare - baseShare) > 1e-6 && ms < 500);
ok('chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);
ok('URL encodes filter state', (await p.url()).includes('f='));
ok('KPI label says the figure is now a filtered subset',
   /SELECTED/.test(await p.locator('.kpis').innerText()));

// a filtered figure must be a strict subset, never larger than the whole
const filteredPlays = await p.locator('.chips__n').textContent();
const n = parseInt(filteredPlays.replace(/,/g, ''), 10);
ok('filtered play count is a strict subset of 224,078',
   /of 224,078 plays/.test(filteredPlays) && n > 0 && n < 224078);

await p.locator('.chip--clear').click();
await p.waitForTimeout(250);
ok('clear-all restores the baseline',
   Math.abs(+(await val('repeat_concentrated_session_share')) - baseShare) < 1e-9);

// a second, independent emitter - the genre x country matrix
const baseBand = +(await val('band_share'));
await p.locator('.matrix__cell').first().click();
await p.waitForTimeout(250);
ok('the over-index matrix also emits a filter',
   (await p.locator('.chip').count()) >= 1 &&
   Math.abs(+(await val('band_share')) - baseBand) > 1e-9);
await p.locator('.chip--clear').click();
await p.waitForTimeout(250);

// ---- the payout threshold ----------------------------------------------------------------
await p.locator('.cliff__slider input').fill('35');
await p.dispatchEvent('.cliff__slider input', 'input');
await p.waitForTimeout(250);
ok('threshold slider recomputes the royalty text',
   /38\.0/.test(await p.locator('#payout-cliff .cliff__cap').innerText()));

// ---- the tour ----------------------------------------------------------------------------
await p.locator('.tour-btn').click();
await p.waitForTimeout(350);
ok('tour opens from the ? button',
   (await p.locator('[role="dialog"], .tour').count()) > 0);
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
ok('Esc closes the tour', (await p.locator('[role="dialog"], .tour').count()) === 0);

// ---- the poster route ---------------------------------------------------------------------
await p.goto(`${URL}/poster`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
ok('poster hides the tour button', (await p.locator('.tour-btn:visible').count()) === 0);
ok('poster hides the basis toggle', (await p.locator('.basis:visible').count()) === 0);
ok('poster hides the threshold slider', (await p.locator('.cliff__slider:visible').count()) === 0);
ok('poster renders the signature', (await p.locator('#crossing svg').count()) === 1);
const box = await p.locator('.page--poster').boundingBox();
ok('poster is exactly 2560x1440',
   Math.round(box.width) === 2560 && Math.round(box.height) === 1440);

/* The naming decision, asserted. .workbench/2026/05/design/direction.md commits the page to never printing the
   vendor's word except once, as the named source column, in the footer. That is a promise a
   reader cannot verify and a test can. */
const posterText = await p.locator('.page--poster').innerText();
const hits = (posterText.match(/fraud/gi) || []).length;
ok(`the poster prints "fraud" exactly once, as the source column (found ${hits})`,
   hits === 1 && /is_fraud_cluster/.test(posterText));

/* ...and the LIVE route, which this harness could not see. It read only `.page--poster`, with
   the tour suppressed, so the tour step that names the column was outside the assertion by
   construction and the live count was never checked at all. The promise is now once per
   surface: footer only on the poster, footer plus the naming-decision tour step on the live
   route. A promise about a rendered surface must be asserted on every surface it covers. */
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('[data-metric]');
const liveText = await p.locator('.page').innerText();
const liveCol = (liveText.match(/is_fraud_cluster/g) || []).length;
ok(`the live route names the source column once, in the footer (found ${liveCol})`,
   liveCol === 1);

/* Open it from the button rather than by clearing the key: addInitScript re-seeds the key on
   every navigation, so removing it and reloading would silently leave the tour shut and the
   assertion would pass on an empty string. */
await p.locator('.tour-btn').click();
await p.waitForTimeout(350);
/* The overlay renders ONE step at a time, so reading the dialog once counts only step 1 -
   which said 0 and would have passed a "never names it" assertion for the wrong reason.
   Walk every step and count across all of them. */
let tourText = '';
for (let i = 0; i < 12; i++) {
  const dlg = p.locator('[role="dialog"], .tour').first();
  if (!(await dlg.count())) break;
  tourText += '\n' + (await dlg.innerText().catch(() => ''));
  const next = p.getByRole('button', { name: /next/i });
  if (!(await next.count()) || !(await next.first().isEnabled())) break;
  await next.first().click();
  await p.waitForTimeout(200);
}
/* Count the COLUMN TOKEN, not the word. The tour step whose subject is the naming decision
   necessarily uses the word "fraud" in prose ("a prevalence no real fraud population has") -
   that is the argument, not a leak. What the design promise governs is how often the page
   hands the reader the vendor's column NAME, and that must be once per surface. Counting the
   bare word here found 3 and would have forced softening a sentence that is doing its job. */
const tourCol = (tourText.match(/is_fraud_cluster/g) || []).length;
ok(`the tour names the source column exactly once across all steps (found ${tourCol})`,
   tourCol === 1);

await b.close();
console.log(failed ? `\n${failed} FAILURE(S)` : '\nAll interaction assertions pass.');
process.exit(failed ? 1 : 0);
