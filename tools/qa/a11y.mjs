import { tourKeyFor } from './tourkey.mjs';
// The month's own key, not the literal 'tour-seen' (which matches no month). See tourkey.mjs.
const TOUR_KEY = tourKeyFor(process.argv[2], process.argv[3]);
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const b = await chromium.launch();
for (const [name, url, w, h, theme] of [
  ['desktop light',(process.env.QA_URL || 'http://localhost:4173') + '/',1440,950,'light'],
  ['desktop dark',(process.env.QA_URL || 'http://localhost:4173') + '/',1440,950,'dark'],
  ['mobile light',(process.env.QA_URL || 'http://localhost:4173') + '/',375,812,'light'],
  ['poster',(process.env.QA_URL || 'http://localhost:4173') + '/poster',2560,1440,'light'],
]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  await ctx.addInitScript(([t,k]) => { localStorage.setItem(k,'1'); localStorage.setItem('datadna-theme', t); }, [theme, TOUR_KEY]);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil:'networkidle' });
  await p.waitForFunction(() => { const e = document.querySelector('[data-metric]'); return !!(e && e.getAttribute('data-value')); },{timeout:30000});
  await p.waitForTimeout(400);
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  console.log(`\n=== ${name}: ${r.violations.length} violations`);
  for (const v of r.violations) console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)\n    e.g. ${v.nodes[0].html.slice(0,120)}`);
  await ctx.close();
}
await b.close();
