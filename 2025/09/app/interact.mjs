/**
 * Interaction test - 2025/09 Credit Risk Analytics (Nova Bank).
 *
 * WHY THIS FILE EXISTS IN THIS SHAPE. Until 2025-09-26 this path held a verbatim copy of
 * 2025/05's test, asserting that month's phone-sales revenue. It could not pass here and
 * had presumably never been run: the shipped `SUBMISSION.md` reproduction block did not
 * list it. An interaction test that asserts another month's numbers is worse than none,
 * because its failure looks like an environment problem rather than a missing test.
 *
 * Unlike a11y / overflow / perf / measure, which are generic and live in tools/qa/, an
 * interaction test asserts THIS month's findings. Every expected value below was recomputed
 * from 2025/09/data/curated/*.parquet through DuckDB on 2025-09-26 - including the
 * cross-filtered ones - so a DOM that agrees with this file agrees with the parquet.
 *
 *   cd 2025/09/app
 *   QA_URL=http://localhost:5309 QA_TOUR_KEY=novabank-2025-09-tour-seen node interact.mjs
 *
 * The tour key is `novabank-2025-09-tour-seen`, NOT `datadna-...`. With the wrong key the
 * guided tour opens on load and its backdrop swallows every click.
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:4173';
const TOUR_KEY = process.env.QA_TOUR_KEY || 'novabank-2025-09-tour-seen';

let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
/** DOM data-value comparison at the precision the page renders, not at float equality. */
const near = (a, b, tol = 5e-4) => Math.abs(Number(a) - Number(b)) <= tol;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();

await p.goto(URL + '/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-metric="loans"]')?.getAttribute('data-value'));

/** Every tagged figure on the page, as a map. */
const metrics = () =>
  p.$$eval('[data-metric]', (ns) =>
    Object.fromEntries(ns.map((n) => [n.getAttribute('data-metric'), n.getAttribute('data-value')])));

// ---------------------------------------------------------------------------------------
// BASELINE - the unfiltered book
// ---------------------------------------------------------------------------------------
let m = await metrics();
ok('baseline book is 32,581 loans', Number(m.loans) === 32581);
ok('baseline default rate is 21.8164%', near(m.base_default_rate, 21.81639605905282));
ok('the two rules cover 2,988 loans with 0 exceptions at 100.0000%',
   Number(m['rule.union.n']) === 2988 &&
   Number(m['rule.union.exceptions']) === 0 &&
   near(m['rule.union.rate'], 100));
ok('rule 1 = 2,345 renters, rule 2 = 741 debt-consolidation loans',
   Number(m['rule.renter.n']) === 2345 && Number(m['rule.debtcon.n']) === 741);
ok('they carry $41,607,350 and 42.0371% of every default',
   Number(m['rule.union.principal']) === 41607350 &&
   near(m['rule.union.share_defaults'], 42.03714124929657));
ok('the price gap is the published 20-30% band: +13.6565 bp',
   near(m.price_gap_bp, 13.656530606414208));
ok('the raw grade-D rate is rendered as 59.0458% so the page can refuse it',
   near(m['ladder.D.raw'], 59.0457804743519) && near(m['ladder.D.clean'], 46.331767256956994));

// ---------------------------------------------------------------------------------------
// CROSS-FILTER - the grade ladder bars are real <button>s
// ---------------------------------------------------------------------------------------
const bars = p.locator('button.bars__row');
ok('the grade ladder is seven real buttons', (await bars.count()) === 7);
const target = p.locator('button.bars__row[aria-label^="Grade D:"]');
ok('grade D is addressable by its aria-label', (await target.count()) === 1);

const t0 = Date.now();
await target.click();
await p.waitForFunction(() => Number(document.querySelector('[data-metric="loans"]')?.getAttribute('data-value')) !== 32581,
  null, { timeout: 5000 });
const ms = Date.now() - t0;

m = await metrics();
ok(`grade cross-filter applies in ${ms}ms (budget 200ms)`, ms < 200);
ok('filtering to grade D leaves 3,626 loans', Number(m.loans) === 3626);
ok('...and the headline default rate becomes the ladder rung itself, 59.0458%',
   near(m.base_default_rate, 59.0457804743519) && near(m.base_default_rate, m['ladder.D.raw']));
// Recomputed from parquet under the same filter: renter 373, debtcon 555, union 859
// (69 loans satisfy both), $11,039,250, 40.1214% of grade D's own defaults.
ok('the rules survive the filter: 373 + 555 -> 859 loans, still 0 exceptions at 100%',
   Number(m['rule.renter.n']) === 373 && Number(m['rule.debtcon.n']) === 555 &&
   Number(m['rule.union.n']) === 859 && Number(m['rule.union.exceptions']) === 0 &&
   near(m['rule.union.rate'], 100));
ok('...carrying $11,039,250 and 40.1214% of grade D defaults',
   Number(m['rule.union.principal']) === 11039250 &&
   near(m['rule.union.share_defaults'], 40.121438580102755));
ok('the missing-rate count recomputes under the filter (3,116 -> 312)',
   Number(m.int_rate_missing) === 312);
ok('the grade-A wall panel degrades to a real zero rather than a stale figure',
   Number(m['grade_a_wall.n']) === 0);
ok('the file-level "Unemployed" aggregates do NOT move - they describe the file, not the selection',
   Number(m['unemployed.working']) === 1421 && Number(m['unemployed.reported']) === 1635 &&
   near(m['unemployed.mean_years_working'], 5.441942294159043));
// The ladder itself cross-filters, so under a grade filter only the selected rung remains.
ok('the ladder redraws to the selected rung alone, announced with aria-pressed',
   (await p.locator('button.bars__row').count()) === 1 &&
   (await p.locator('button.bars__row[aria-pressed="true"]').count()) === 1);
ok('the chip bar shows the active filter', (await p.locator('.chip').count()) >= 1);

const deepLink = await p.url();
ok('the URL encodes filter state', deepLink.includes('f=') && deepLink.includes('grade'));

// ---------------------------------------------------------------------------------------
// CLEAR, DEEP LINK, TOUR, ACCESSIBLE TABLES
// ---------------------------------------------------------------------------------------
await p.locator('.chip--clear').click();
await p.waitForFunction(() => Number(document.querySelector('[data-metric="loans"]')?.getAttribute('data-value')) === 32581,
  null, { timeout: 5000 });
ok('clear-all restores the full 32,581-loan book', Number((await metrics()).loans) === 32581);

// The slider narrows the wall chart's x-axis. It must NOT move the rule, which reads the
// data and not the chart -- a first poster shipped a ceiling label counting displayed bins.
const slider = p.locator('[aria-label="Lowest loan-to-income shown"]');
ok('the wall has a loan-to-income slider', (await slider.count()) === 1);
await slider.fill('20');
await p.waitForTimeout(250);
m = await metrics();
ok('moving the slider does not move the rule (it reads the data, not the chart)',
   Number(m['rule.renter.n']) === 2345 && Number(m['rule.union.n']) === 2988);
await slider.fill('5');
await p.waitForTimeout(200);

const srRows = await p.locator('.chartfig .sr-only table tbody tr').count();
const figures = await p.locator('figure').count();
ok(`every chart is mirrored by an accessible data table (${figures} figures, ${srRows} rows)`,
   figures === 5 && srRows === 81);

await p.locator('button:has-text("Guided tour")').click();
await p.waitForTimeout(250);
ok('the guided tour re-opens after being dismissed', (await p.locator('[role="dialog"]').count()) === 1);
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
ok('Esc closes the tour', (await p.locator('[role="dialog"]').count()) === 0);

const p2 = await ctx.newPage();
await p2.goto(deepLink, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => document.querySelector('[data-metric="loans"]')?.getAttribute('data-value'));
await p2.waitForTimeout(250);
ok('a deep link restores the grade-D filter (3,626 loans)',
   Number(await p2.getAttribute('[data-metric="loans"]', 'data-value')) === 3626);

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nall interaction checks pass');
process.exit(failed ? 1 : 0);
