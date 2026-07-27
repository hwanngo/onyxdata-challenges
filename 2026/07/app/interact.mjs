/**
 * G6/G7 interaction matrix - 2026/07 Global AI Adoption & Workforce Displacement Index.
 *
 * Rewritten for this month. The guard exists because 2025/07, 2025/09 and 2025/10 all shipped
 * this file byte-identical to the 2025/05 template and their SCORECARDs counted the passes.
 *
 * What this file is really for THIS month: the page's entire argument is that a real,
 * significant linear fit is the wrong description of a step. So the assertions below check
 * that both models are actually drawn, that the sixteen observed points are drawn UNDER them
 * and never replaced, that the residual sums of squares are printed rather than asserted, and
 * that the two fits stay distinguishable when colour is removed.
 *
 *   QA_URL=http://localhost:5173 node 2026/07/app/interact.mjs
 */
const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) { console.error('FAIL  still the scaffold.'); process.exit(1); }

import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), 'dna-2026-07-tour');
const p = await ctx.newPage();

let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

await p.goto(`${URL}/`, { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => document.querySelector('[data-metric="rows"]')?.getAttribute('data-value'),
  { timeout: 30000 });

const val = (m) => p.getAttribute(`[data-metric="${m}"]`, 'data-value');

// ---- baseline ------------------------------------------------------------------------------
ok('baseline rows = 300', Math.round(+(await val('rows'))) === 300);
ok('16 quarters', Math.round(+(await val('quarters'))) === 16);
ok('292 segments', Math.round(+(await val('segments'))) === 292);
ok('0 of 8 risk drivers related', Math.round(+(await val('risk_drivers_related'))) === 0);

// ---- ③ the signature: BOTH models, over the observed points --------------------------------
/* All sixteen observed means must be present as their own marks. If a fit ever replaces the
   points, the page is asserting a conclusion instead of showing a comparison. */
ok('all 16 observed quarterly means are drawn as points',
   (await p.locator('#step svg circle.sc-pt').count()) === 16);
ok('the step fit is drawn', (await p.locator('#step svg path.sc-step').count()) === 1);
ok('the linear fit is drawn', (await p.locator('#step svg path.sc-line').count()) === 1);
ok('the signature carries a screen-reader table',
   (await p.locator('#step .sr-only table').count()) === 1);

/* The step path must actually STEP: a horizontal run, a vertical riser, a horizontal run.
   A path with no vertical segment would be a line wearing the step's colour. */
const stepGeom = await p.evaluate(() => {
  const d = document.querySelector('#step path.sc-step').getAttribute('d');
  const pts = [...d.matchAll(/([ML]) ([\d.]+) ([\d.]+)/g)].map((m) => [+m[2], +m[3]]);
  let risers = 0, levels = new Set();
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][0] - pts[i - 1][0]) < 0.01 && Math.abs(pts[i][1] - pts[i - 1][1]) > 1) risers++;
    levels.add(Math.round(pts[i][1] * 10));
  }
  return { risers, levels: levels.size, n: pts.length };
});
ok(`the step path has exactly one riser and two levels (risers=${stepGeom.risers}, levels=${stepGeom.levels})`,
   stepGeom.risers === 1 && stepGeom.levels === 2);

/* The two accents are 1.10:1 apart in relative luminance - indistinguishable in greyscale.
   Redundant encoding is therefore load-bearing, not decorative: the fits MUST differ by
   dash pattern, and each must be labelled in place. */
const dash = await p.evaluate(() => ({
  step: getComputedStyle(document.querySelector('#step path.sc-step')).strokeDasharray,
  line: getComputedStyle(document.querySelector('#step path.sc-line')).strokeDasharray,
}));
ok(`the two fits differ by mark type, not only colour (step "${dash.step}", line "${dash.line}")`,
   dash.step !== dash.line && /\d/.test(dash.line));
const stepText = await p.locator('#step').innerText();
ok('both fits are labelled in place', /step at 2022-Q4/.test(stepText) && /linear trend/.test(stepText));

/* The 3.61x claim must be checkable FROM THE PAGE. Both residual sums of squares are printed,
   and their quotient must equal the ratio the model computed. */
const ssPrinted = [...stepText.matchAll(/residual SS ([\d.]+)/g)].map((m) => +m[1]);
ok(`both residual sums of squares are printed (${ssPrinted.join(', ')})`, ssPrinted.length === 2);
const ratio = Math.max(...ssPrinted) / Math.min(...ssPrinted);
ok(`the printed residuals reproduce the "times better" claim (${ratio.toFixed(2)}x)`,
   Math.abs(ratio - 3.61) < 0.02);

/* The y-axis starts at zero, so the +18.23pp step cannot be exaggerated by a cropped axis. */
const yTicks = await p.evaluate(() =>
  [...document.querySelectorAll('#step svg text.sc-tick')]
    .map((t) => t.textContent.trim()).filter((t) => /^\d+$/.test(t)).map(Number));
ok(`the y-axis starts at 0 (ticks ${yTicks.join(', ')})`, yTicks.includes(0));

// ---- the fit toggle IS the argument, so it must be a real radio group -----------------------
ok('the fit toggle is a real radio group, not styled divs',
   (await p.locator('.fitctl__set input[type="radio"]').count()) === 3);
await p.locator('.fitctl__opt input[value="line"]').check();
await p.waitForTimeout(250);
ok('selecting "linear trend" hides the step path',
   (await p.locator('#step svg path.sc-step').count()) === 0
   && (await p.locator('#step svg path.sc-line').count()) === 1);
ok('the observed points survive the toggle - a fit never replaces the data',
   (await p.locator('#step svg circle.sc-pt').count()) === 16);
await p.locator('.fitctl__opt input[value="step"]').check();
await p.waitForTimeout(250);
ok('selecting "step" hides the linear path',
   (await p.locator('#step svg path.sc-line').count()) === 0);
ok('the note under the toggle changes with the selection',
   /Residual sum of squares 128\.9/.test(await p.locator('.fitctl__note').textContent()));
await p.locator('.fitctl__opt input[value="both"]').check();
await p.waitForTimeout(250);
ok('"both" restores the comparison',
   (await p.locator('#step svg path.sc-step').count()) === 1
   && (await p.locator('#step svg path.sc-line').count()) === 1);

// ---- cross-filter ---------------------------------------------------------------------------
const t0 = Date.now();
await p.locator('.ctable__pick').first().click();
await p.waitForTimeout(150);
const ms = Date.now() - t0;
ok(`the country table cross-filters the page (${ms}ms)`,
   (await p.locator('.chip').count()) >= 1 && ms < 500);
ok('the filter narrows the country count in the context strip',
   Math.round(+(await val('countries'))) < 30);
ok('the chip bar states the denominator in countries, records and quarters',
   /of 30 countries/.test(await p.locator('.chips__n').textContent()));

/* THE REGRESSION THIS ASSERTION EXISTS FOR. A `development_tier` filter used to be tested
   against quarters, which do not carry that field, so every quarter failed and the signature
   went from 16 points to 0 - the page silently claimed the series was empty. It cannot narrow
   the series, because the series is pre-aggregated and carries no country field; it must SAY that rather
   than render nothing. */
ok('a country filter never empties the quarterly series',
   (await p.locator('#step svg circle.sc-pt').count()) === 16);
ok('the page states why the country filter cannot reach the series',
   /cannot narrow the quarterly series/.test(await p.locator('.chips__blocked').textContent()));

await p.locator('.chip--clear').click();
await p.waitForTimeout(250);
ok('clear-all restores all 30 countries', Math.round(+(await val('countries'))) === 30);
ok('clear-all leaves all 16 points', (await p.locator('#step svg circle.sc-pt').count()) === 16);

// ---- clicking a quarter reports BOTH fitted values, never one -------------------------------
await p.locator('#step svg circle.sc-hit').nth(3).click();
await p.waitForTimeout(250);
const picked = await p.locator('.picked').textContent();
ok('clicking a quarter reports the observed mean and BOTH fitted values',
   /Step model predicts/.test(picked) && /linear model predicts/i.test(picked));

// ---- ⑤ every null prints its rho and p ------------------------------------------------------
const rv = await p.locator('#risk').innerText();
ok('all eight risk drivers are drawn', (await p.locator('.rv li').count()) === 8);
ok('every driver prints a signed rho', (rv.match(/[+-]0\.\d{3}/g) || []).length >= 8);
ok('the band this page calls "no relationship" is stated, not implied', /\|ρ\| < 0\.20/.test(rv));

// ---- ⑥ ⑦ ------------------------------------------------------------------------------------
ok('all 300 job records are plotted, none sampled',
   (await p.locator('#jobs svg circle.jobs__pt').count()) === 300);
ok('the break-even diagonal is drawn', (await p.locator('#jobs svg line.jobs__diag').count()) === 1);
const pg = await p.locator('#panelgap').innerText();
ok('the panel gap states the observed-once count', /284 seen once/.test(pg));

// ---- the tour --------------------------------------------------------------------------------
await p.locator('.tour-btn').click();
await p.waitForTimeout(350);
ok('tour opens from the ? button', (await p.locator('[role="dialog"], .tour').count()) > 0);
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
ok('Esc closes the tour', (await p.locator('[role="dialog"], .tour').count()) === 0);
await p.keyboard.press('?');
await p.waitForTimeout(350);
ok('the ? key reopens the tour', (await p.locator('[role="dialog"], .tour').count()) > 0);
await p.keyboard.press('Escape');

// ---- the poster ------------------------------------------------------------------------------
await p.goto(`${URL}/poster`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
ok('poster hides the tour button', (await p.locator('.tour-btn:visible').count()) === 0);
ok('poster hides the fit toggle', (await p.locator('.fitctl:visible').count()) === 0);
ok('poster draws both fits and all 16 points',
   (await p.locator('#step svg path.sc-step').count()) === 1
   && (await p.locator('#step svg path.sc-line').count()) === 1
   && (await p.locator('#step svg circle.sc-pt').count()) === 16);
const box = await p.locator('.page--poster').boundingBox();
ok('poster is exactly 2560x1440',
   Math.round(box.width) === 2560 && Math.round(box.height) === 1440);

/* .workbench/2026/07/design/direction.md commits the poster to printing the three omissions and their measured
   reasons rather than leaving them as gaps. */
const posterText = await p.locator('.page--poster').innerText();
ok('poster states why there is no map', /No map is drawn/.test(posterText));
ok('poster states why there is no risk ranking', /No top-N risk ranking is drawn/.test(posterText));
ok('poster states that GDP is excluded', /gdp_per_capita_usd/.test(posterText));

/* The direction doc promises the caption states the step lands ON a pre-existing flag rather
   than discovering a date. 2026/05 shipped a poster that printed its key word twice because
   nothing checked the design doc against the render. */
ok('poster says the step lands on a flag the data already carried',
   /already carried/.test(posterText));

await b.close();
console.log(failed ? `\n${failed} FAILURE(S)` : '\nAll interaction assertions pass.');
process.exit(failed ? 1 : 0);
