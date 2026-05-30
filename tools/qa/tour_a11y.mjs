/* axe with the TOUR DIALOG OPEN. Shipped months went un-audited
   this state: the harness sets the "tour seen" key precisely so the overlay does NOT appear,
   which means the one modal on the page has never been through axe. */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.QA_URL || 'http://localhost:5173';
const b = await chromium.launch();
let total = 0;

for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  // the first-run tour opens by itself; if storage already suppressed it, use the ? button
  const open = await p.locator('[role="dialog"], .tour').count();
  if (!open) { await p.locator('.tour-btn').click(); await p.waitForTimeout(400); }
  const dlg = await p.locator('[role="dialog"], .tour').count();
  const r = await new AxeBuilder({ page: p }).analyze();
  console.log(`=== tour open, ${scheme}: dialog present=${dlg > 0}, ${r.violations.length} violations`);
  for (const v of r.violations) {
    total++;
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
    console.log(`    e.g. ${v.nodes[0].html.slice(0, 130)}`);
  }
  // keyboard: Esc must close, and focus must be inside the dialog
  const focusInside = await p.evaluate(() => {
    const d = document.querySelector('[role="dialog"], .tour');
    return !!(d && d.contains(document.activeElement));
  });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const closed = (await p.locator('[role="dialog"], .tour').count()) === 0;
  console.log(`    focus trapped inside dialog: ${focusInside} | Esc closes: ${closed}`);
  if (!focusInside || !closed) total++;
  await ctx.close();
}
await b.close();
console.log(total ? `\n${total} PROBLEM(S) with the tour dialog` : '\nTour dialog clean in both themes.');
process.exit(total ? 1 : 0);
