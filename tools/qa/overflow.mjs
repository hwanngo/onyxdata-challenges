import { tourKeyFor } from './tourkey.mjs';
// The month's own key, not the literal 'tour-seen' (which matches no month). See tourkey.mjs.
const TOUR_KEY = tourKeyFor(process.argv[2], process.argv[3]);
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [375, 768, 1024, 1440]) {
  const ctx = await b.newContext({ viewport:{width:w,height:900} });
  await ctx.addInitScript((k)=>localStorage.setItem(k,'1'), process.env.QA_TOUR_KEY || 'tour-seen');
  const p = await ctx.newPage();
  await p.goto((process.env.QA_URL || 'http://localhost:4173') + '/',{waitUntil:'networkidle'});
  await p.waitForFunction(() => { const e = document.querySelector('[data-metric]'); return !!(e && e.getAttribute('data-value')); },{timeout:30000});
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log(`${w}px -> scrollWidth ${r.sw} clientWidth ${r.cw} ${r.sw>r.cw ? 'HORIZONTAL OVERFLOW' : 'ok'}`);
  await ctx.close();
}
await b.close();
